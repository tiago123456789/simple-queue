import axios from 'redaxios';
import Message from '../types/message.js';
import STATUS from '../types/status.js';
import { Consumer } from '../types/consumer.js';
import { DurableObject } from 'cloudflare:workers';

export interface Env {
	QUEUE: DurableObjectNamespace<Queue>;
	API_KEY: string;
	HTTP_REQUEST_TIMEOUT: number;
	TOTAL_RETRIES_BEFORE_DQL: number;
	TOTAL_MESSAGES_PULL_PER_TIME: number;
	ENABLE_CONTROL_CONCURRENCY: boolean;
	LIMIT_CONSUMER_PROCESS: number;
}

const CONSUMER_STATUS = {
	WAITING: 'WAITING',
	WORKING: 'WORKING',
} as const;

export class Queue extends DurableObject {
	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env);
		ctx.blockConcurrencyWhile(async () => {
			await this.migrate();
		});
	}

	private async migrate() {
		await this.ctx.storage.sql.exec(`
			CREATE TABLE IF NOT EXISTS queue(
				id TEXT PRIMARY KEY,
				url TEXT NOT NULL,
				payload TEXT NOT NULL,
				created_at INTEGER NOT NULL,
				status INTEGER,
				retries INTEGER DEFAULT 0,
				visibility_at INTEGER DEFAULT 0
			);
			CREATE INDEX IF NOT EXISTS queue_idx ON queue(id);

			CREATE TABLE IF NOT EXISTS queue_dlq(
				id TEXT PRIMARY KEY,
				url TEXT NOT NULL,
				payload TEXT NOT NULL,
				created_at INTEGER NOT NULL,
				status INTEGER,
				retries INTEGER DEFAULT 0
			);
			CREATE INDEX IF NOT EXISTS queue_dlq_idx ON queue_dlq(id);

			CREATE TABLE IF NOT EXISTS consumers(
				id TEXT PRIMARY KEY,
				group_id TEXT NOT NULL,
				created_at INTEGER NOT NULL,
				status TEXT NOT NULL,
				expired_at INTEGER
			);
			CREATE INDEX IF NOT EXISTS consumers_idx ON consumers(id);
		`);
		try {
			await this.ctx.storage.sql.exec(`ALTER TABLE queue ADD COLUMN visibility_at INTEGER DEFAULT 0;`);
		} catch (e) {}
	}

	private getConsumerExpiryMs(): number {
		const limit = (this.env as Env).LIMIT_CONSUMER_PROCESS;
		return (limit > 0 ? limit : 15) * 60 * 1000;
	}

	async createConsumers(count: number): Promise<string[]> {
		const ids: string[] = [];
		const groupId = this.ctx.id.toString();
		for (let i = 0; i < count; i++) {
			const id = crypto.randomUUID();
			await this.ctx.storage.sql.exec(
				`INSERT INTO consumers (id, group_id, created_at, status, expired_at) 
				VALUES (?, ?, ?, ?, ?)`,
				...[id, groupId, Date.now(), CONSUMER_STATUS.WAITING, null],
			);
			ids.push(id);
		}
		return ids;
	}

	async getWaitingConsumers(limit: number): Promise<Consumer[]> {
		const expiredAt = Date.now() + this.getConsumerExpiryMs();
		const results = await this.ctx.storage.sql.exec(
			`UPDATE consumers 
			SET status = ?, expired_at = ?
			WHERE id IN (
				SELECT id FROM consumers 
				WHERE status = ? 
				ORDER BY created_at ASC LIMIT ?
			)
			RETURNING id, group_id, created_at, status, expired_at;`,
			...[CONSUMER_STATUS.WORKING, expiredAt, CONSUMER_STATUS.WAITING, limit],
		);

		return results.toArray().map((item) => ({
			id: String(item.id),
			group_id: String(item.group_id),
			created_at: Number(item.created_at),
			status: String(item.status) as 'WAITING' | 'WORKING',
			expired_at: item.expired_at !== null ? Number(item.expired_at) : null,
		}));
	}

	async markConsumerReady(consumerId: string): Promise<boolean> {
		await this.ctx.storage.sql.exec(
			`UPDATE consumers SET status = ?, expired_at = NULL WHERE id = ?`,
			...[CONSUMER_STATUS.WAITING, consumerId],
		);
		return true;
	}

	async resetExpiredConsumers(): Promise<number> {
		const result = await this.ctx.storage.sql.exec(
			`UPDATE consumers 
			SET status = ?, expired_at = NULL 
			WHERE expired_at IS NOT NULL AND expired_at < ? AND status = ?`,
			...[CONSUMER_STATUS.WAITING, Date.now(), CONSUMER_STATUS.WORKING],
		);
		return result.toArray().length;
	}

	async deleteConsumer(consumerId: string): Promise<{ success: boolean; message: string }> {
		const check = await this.ctx.storage.sql.exec(`SELECT status FROM consumers WHERE id = ?`, [consumerId]);
		const item = check.toArray()[0];

		if (!item) {
			return { success: false, message: 'Consumer not found' };
		}

		if (item.status !== CONSUMER_STATUS.WAITING) {
			return { success: false, message: 'Cannot delete consumer that is WORKING. Wait for it to become WAITING.' };
		}

		await this.ctx.storage.sql.exec(`DELETE FROM consumers WHERE id = ?`, ...[consumerId]);
		return { success: true, message: 'Consumer deleted' };
	}

	async getConsumerStats(): Promise<{ total: number; waiting: number; working: number; expired: number }> {
		const total = await this.ctx.storage.sql.exec(`SELECT count(id) as count FROM consumers;`);
		const waiting = await this.ctx.storage.sql.exec(
			`SELECT count(id) as count FROM consumers WHERE status = ?;`,
			...[CONSUMER_STATUS.WAITING],
		);
		const working = await this.ctx.storage.sql.exec(
			`SELECT count(id) as count FROM consumers WHERE status = ?;`,
			...[CONSUMER_STATUS.WORKING],
		);
		const expired = await this.ctx.storage.sql.exec(
			`SELECT count(id) as count FROM consumers WHERE expired_at IS NOT NULL AND expired_at < ?;`,
			...[Date.now()],
		);

		return {
			total: Number(total.toArray()[0]?.count) || 0,
			waiting: Number(waiting.toArray()[0]?.count) || 0,
			working: Number(working.toArray()[0]?.count) || 0,
			expired: Number(expired.toArray()[0]?.count) || 0,
		};
	}

	async getConsumers(limit: number = 100, offset: number = 0): Promise<Consumer[]> {
		const results = await this.ctx.storage.sql.exec(
			`SELECT id, group_id, created_at, status, expired_at 
			FROM consumers ORDER BY created_at DESC LIMIT ? OFFSET ?;`,
			...[limit, offset],
		);
		return results.toArray().map((item) => ({
			id: String(item.id),
			group_id: String(item.group_id),
			created_at: Number(item.created_at),
			status: String(item.status) as 'WAITING' | 'WORKING',
			expired_at: item.expired_at !== null ? Number(item.expired_at) : null,
		}));
	}

	private async delete(id: string) {
		await this.ctx.storage.sql.exec(`DELETE FROM queue WHERE id = ?;`, ...[id]);
	}

	private async setMessagesPendingByIds(ids: string[]) {
		if (ids.length === 0) return;
		const placeholders = ids.map(() => '?').join(',');
		await this.ctx.storage.sql.exec(`UPDATE queue SET status = ? WHERE id IN (${placeholders})`, ...[STATUS.PENDING, ...ids]);
	}

	private async process(message: Message, groupId: string) {
		let url = message.url;

		try {
			console.log('Processing message with id:', message.id);
			await axios.post(url, message.payload, {
				timeout: (this.env as Env).HTTP_REQUEST_TIMEOUT * 1000,
				headers: {
					'User-Agent': 'SimpleQueue',
					'x-api-key': (this.env as Env).API_KEY,
					'Content-Type': 'application/json',
					'group-id': groupId,
				},
			});

			console.log('Removing message with id:', message.id, 'because processed with success');
			await this.delete(message.id);
		} catch (error) {
			console.error(error);
			console.log('Increasing the retries of message with id:', message.id, 'because failed');
			await this.incrementRetriesById(message.id);
		}
	}

	private async incrementRetriesById(id: string) {
		await this.ctx.storage.sql.exec(
			`UPDATE queue SET status = ?, retries = retries + 1, created_at = ? WHERE id = ?`,
			...[STATUS.PENDING, Date.now(), id],
		);
	}

	private async getNextFromQueue(limit: number = 1): Promise<Array<Message>> {
		const results = await this.ctx.storage.sql.exec(
			`UPDATE queue SET status = ?
			WHERE id in (SELECT id FROM queue WHERE status = ? AND (visibility_at = 0 OR visibility_at <= ?) ORDER BY created_at ASC LIMIT ?)
			RETURNING id, url, payload, retries;`,
			...[STATUS.PROCESSING, STATUS.PENDING, Date.now(), limit],
		);

		const items = results.toArray();
		if (!items[0]) {
			return [];
		}

		return items.map((item) => {
			return {
				id: item.id,
				url: item.url,
				retries: item.retries,
				payload: item.payload,
			} as Message;
		});
	}

	private async moveMessageToDlq(item: Message) {
		await this.ctx.storage.sql.exec(
			`INSERT INTO queue_dlq(id, url, payload, created_at, status)
			VALUES (?, ?, ?, ?, ?)`,
			...[item.id, item.url, JSON.stringify(item.payload), Date.now(), STATUS.PENDING],
		);
	}

	async consume(limitPerTime: number = 1, groupId: string): Promise<void> {
		if ((this.env as Env).ENABLE_CONTROL_CONCURRENCY) {
			const consumerStats = await this.getConsumerStats();
			if (consumerStats.waiting == 0) {
				console.log('No waiting consumers available, resetting messages to pending');
				return Promise.resolve();
			}

			const messages = await this.getNextFromQueue(consumerStats.waiting);
			if (messages.length === 0) {
				return Promise.resolve();
			}

			const consumers = await this.getWaitingConsumers(consumerStats.waiting);
			const processCount = Math.min(messages.length, consumers.length);
			const messagesToProcess = messages.slice(0, processCount);
			for (let i = 0; i < messagesToProcess.length; i++) {
				const message = messagesToProcess[i];
				const consumerId = consumers[i].id;

				if (message.retries > (this.env as Env).TOTAL_RETRIES_BEFORE_DQL) {
					await this.moveMessageToDlq(message);
					await this.delete(message.id);
					await this.markConsumerReady(consumerId);
				} else {
					this.processWithoutWaiting(message, consumerId, groupId);
					await this.delete(message.id);
				}
			}

			return Promise.resolve();
		}

		const messages = await this.getNextFromQueue(limitPerTime);
		if (messages.length === 0) {
			return Promise.resolve();
		}

		let requestTriggerParallel = [];
		for (let message of messages) {
			if (message.retries > (this.env as Env).TOTAL_RETRIES_BEFORE_DQL) {
				console.log('Moving message with id:', message.id, 'because reached the total of retries');
				await this.moveMessageToDlq(message);
				await this.delete(message.id);
			} else {
				requestTriggerParallel.push(this.process(message, groupId));
			}
		}

		await Promise.all(requestTriggerParallel);
		requestTriggerParallel = [];
		return Promise.resolve();
	}

	private processWithoutWaiting(message: Message, consumerId: string, groupId: string) {
		console.log('Sending message (fire-and-forget):', message.id, 'consumer:', consumerId);
		axios
			.post(message.url, message.payload, {
				timeout: (this.env as Env).HTTP_REQUEST_TIMEOUT * 1000,
				headers: {
					'User-Agent': 'SimpleQueue',
					'x-api-key': (this.env as Env).API_KEY,
					'Content-Type': 'application/json',
					'consumer-id': consumerId,
					'group-id': groupId,
				},
			})
			.catch((error) => {
				console.error('Error sending message (fire-and-forget):', message.id, error.message);
			});
	}

	async add(id: string, url: string, payload: { [key: string]: any }, visibilityAt: number = 0): Promise<boolean> {
		try {
			await this.ctx.storage.sql.exec(
				`INSERT INTO queue (id, url, payload, created_at, status, visibility_at)
				VALUES (?, ?, ?, ?, ?, ?)`,
				...[id, url, JSON.stringify(payload), Date.now(), STATUS.PENDING, visibilityAt],
			);
			return true;
		} catch (error) {
			console.error(error);
			return Promise.resolve(false);
		}
	}

	async getMessages(limit: number = 10, offset: number = 0) {
		const results = await this.ctx.storage.sql.exec(
			`SELECT id, url, payload, created_at, status, retries FROM queue ORDER BY created_at ASC LIMIT ? OFFSET ?`,
			...[limit, offset],
		);

		const items = results.toArray();
		return items.map((item) => ({
			id: item.id,
			url: item.url,
			payload: item.payload,
			created_at: item.created_at,
			status: item.status,
			retries: item.retries,
		}));
	}

	async getTotalMessages() {
		const result = await this.ctx.storage.sql.exec(`SELECT count(id) as total FROM queue;`);
		return result.toArray()[0].total;
	}

	async getStats() {
		const totalMessagesDql = await this.ctx.storage.sql.exec(`SELECT count(id) as total FROM queue_dlq;`);
		const totalMessagesPending = await this.ctx.storage.sql.exec(
			`SELECT count(id) as total FROM queue where status = ? AND retries = 0;`,
			...[STATUS.PENDING],
		);
		const totalMessagesProcessing = await this.ctx.storage.sql.exec(
			`SELECT count(id) as total FROM queue where status = ?;`,
			...[STATUS.PROCESSING],
		);

		const totalMessagesWaitingRetry = await this.ctx.storage.sql.exec(
			`SELECT count(id) as total FROM queue where retries > 0 and status = ?;`,
			...[STATUS.PENDING],
		);

		return {
			totalMessagesDql: totalMessagesDql.toArray()[0].total,
			totalMessagesPending: totalMessagesPending.toArray()[0].total,
			totalMessagesProcessing: totalMessagesProcessing.toArray()[0].total,
			totalMessagesWaitingRetry: totalMessagesWaitingRetry.toArray()[0].total,
		};
	}
}
