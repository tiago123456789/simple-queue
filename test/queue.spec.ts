import { env } from 'cloudflare:test';
import axios from 'redaxios';
import { describe, it, expect, vi, afterEach } from 'vitest';

vi.mock('redaxios');
const mockedAxios = vi.mocked(axios);

const getChatPayloadsForSession = async (queue: any, sessionId: number) => {
	const messages = await queue.getMessagesChatQueue(1000, 0);
	return messages
		.map((message: any) => JSON.parse(message.payload))
		.filter((payload: any) => payload.message?.chat?.id === sessionId);
};

describe('Queue', () => {
	afterEach(() => {
		vi.clearAllMocks();
	});

	it('Should add a message to the queue', async () => {
		const id = env.QUEUE.idFromName('test');
		const queue = env.QUEUE.get(id);
		await queue.add('test-id', 'http://example.com', { key: 'value' });
		const stats = await queue.getStats();
		expect(1).toBe(stats.totalMessagesPending);
	});

	it('Should remove message from queue after process message with success', async () => {
		const id = env.QUEUE.idFromName('test');
		const queue = env.QUEUE.get(id);
		await queue.add('test-id', 'http://example.com', { key: 'value' });
		let stats = await queue.getStats();
		expect(1).toBe(stats.totalMessagesPending);

		await queue.consume();
		stats = await queue.getStats();
		expect(0).toBe(stats.totalMessagesPending);
	});

	it('Should remove message from queue after process message with success with option enabled control concurrency', async () => {
		env.ENABLE_CONTROL_CONCURRENCY = true;

		const id = env.QUEUE.idFromName('test');
		const queue = env.QUEUE.get(id);
		await queue.add('test-id', 'http://example.com', { key: 'value' });
		let stats = await queue.getStats();
		expect(1).toBe(stats.totalMessagesPending);

		await queue.consume();
		stats = await queue.getStats();
		expect(0).toBe(stats.totalMessagesPending);
	});

	it('Should update column retries if request failed when process a message', async () => {
		const id = env.QUEUE.idFromName('test');
		const queue = env.QUEUE.get(id);
		await queue.add('test-id', 'http://example.com', { key: 'value' });
		mockedAxios.post.mockRejectedValueOnce({
			response: {
				status: 404,
				data: { mesage: 'Invalid the requests.' },
			},
		});
		await queue.consume();
		let stats = await queue.getStats();
		expect(1).toBe(stats.totalMessagesWaitingRetry);
	});

	it('Should append matching text messages in the chat queue', async () => {
		const id = env.QUEUE.idFromName('DEFAULT');
		const queue = env.QUEUE.get(id);
		const sessionId = Date.now();

		await queue.addInChatQueue('text-1', 'http://example.com', {
			message: { chat: { id: sessionId }, text: 'hello' },
		}, 0, 'DEFAULT');
		await queue.addInChatQueue('text-2', 'http://example.com', {
			message: { chat: { id: sessionId }, text: 'world' },
		}, 0, 'DEFAULT');

		const payloads = await getChatPayloadsForSession(queue, sessionId);
		expect(payloads).toHaveLength(1);
		expect(payloads[0].message.text).toBe('hello\nworld');
	});

	it('Should keep audio payloads separate from matching text messages', async () => {
		const id = env.QUEUE.idFromName('DEFAULT');
		const queue = env.QUEUE.get(id);
		const sessionId = Date.now() + 1;
		const audioPayload = {
			message: {
				chat: { id: sessionId },
				audio: { file_id: 'audio-file-id', mime_type: 'audio/mpeg' },
			},
		};

		await queue.addInChatQueue('audio-1', 'http://example.com', audioPayload, 0, 'DEFAULT');
		await queue.addInChatQueue('text-1', 'http://example.com', {
			message: { chat: { id: sessionId }, text: 'hello' },
		}, 0, 'DEFAULT');
		await queue.addInChatQueue('text-2', 'http://example.com', {
			message: { chat: { id: sessionId }, text: 'world' },
		}, 0, 'DEFAULT');

		const payloads = await getChatPayloadsForSession(queue, sessionId);
		expect(payloads).toHaveLength(2);
		expect(payloads.find((payload: any) => payload.message.audio)?.message.audio).toEqual(audioPayload.message.audio);
		expect(payloads.find((payload: any) => payload.message.text)?.message.text).toBe('hello\nworld');
	});
});
