import { Context, Hono } from 'hono';
import { Env, Queue } from './queue/queue.js';
import { cors } from 'hono/cors';
import { getHTML } from './utils/template.js';
import * as hasher from './utils/hasher.js';
import { parseDelay } from './utils/delay.js';
import groups from './../groups.json' with { type: 'json' };
import * as groupUtil from './utils/group.js';
import SCHEMAS_VALIDATIONS from './schemas-validation.js';
import z from 'zod';

const groupsAllowed: { [key: string]: boolean } = {};
groups.forEach((group: string) => {
	groupsAllowed[`${group}`] = true;
});

export { Queue };

const app = new Hono();

app.use('*', cors());

app.use('*', async (c, next) => {
	const apiKey = c.req.header('x-api-key') || c.req.query('x-api-key');

	if (apiKey !== (c.env as Env).API_KEY) {
		return c.json(
			{
				message: 'Unauthorized: Missing or invalid API key',
			},
			401,
		);
	}

	await next();
});

function getQueueInstance(c: Context, groupId?: string) {
	const env = c.env as Env;
	let queueId = env.QUEUE.idFromName(groupUtil.get(groupId));
	const queueStub = env.QUEUE.get(queueId) as DurableObjectStub<Queue>;
	return queueStub;
}

app.post('/publish', async (c) => {
	const url = c.req.query('url');
	const payload = await c.req.json();

	if (!url) {
		return c.json({ message: 'Url is required' }, 404);
	}

	let groupId = c.req.query('groupId');
	if (!groupsAllowed[groupUtil.get(groupId)]) {
		return c.json({ message: 'Group id not found' }, 404);
	}

	const queueStub = getQueueInstance(c, groupUtil.get(groupId));
	if (queueStub === null) {
		return c.json({ message: 'Queue not found' }, 500);
	}

	let visibilityAt = 0;
	try {
		const delay = c.req.query('delay');
		if (delay) {
			const result = parseDelay(delay);
			if (!result.success) {
				if (result.error === 'INVALID_FORMAT') {
					throw new Error('Invalid delay format. Valid formats: 1s, 30s, 1m, 30m, 1h');
				}
				throw new Error('Maximum delay is 24 hours');
			}
			visibilityAt = result.visibilityAt;
		}

		const schema = SCHEMAS_VALIDATIONS[groupUtil.get(groupId)];
		if (schema) {
			schema.parse(payload);
		}
	} catch (error: any) {
		if (error instanceof z.ZodError) {
			return c.json(
				{
					message: 'Validation failed',
					error: JSON.parse(error.message),
				},
				400,
			);
		}

		return c.json(
			{
				message: error.message,
				error: error.message,
			},
			400,
		);
	}

	const jsonString = JSON.stringify(payload);
	const id = await hasher.get(jsonString);

	const storedMessage = await queueStub.add(id, url as string, payload, visibilityAt);
	return c.json({ storedMessage: storedMessage });
});

app.get('/process', async (c) => {
	let groupId = c.req.query('groupId');
	if (!groupsAllowed[groupUtil.get(groupId)]) {
		return c.json({ message: 'Group id not found' }, 404);
	}

	const queueStub = getQueueInstance(c, groupUtil.get(groupId));
	if (queueStub === null) {
		return c.json({ message: 'Queue not found' }, 500);
	}

	const limit = (c.env as Env).TOTAL_MESSAGES_PULL_PER_TIME;
	await queueStub.consume(limit, groupId || 'DEFAULT');
	return c.json({ ok: true });
});

app.get('/stats', async (c) => {
	let groupId = c.req.query('groupId');
	if (!groupsAllowed[groupUtil.get(groupId)]) {
		return c.json({ message: 'Group id not found' }, 404);
	}

	const queueStub = getQueueInstance(c, groupUtil.get(groupId));
	if (queueStub === null) {
		return c.json({ message: 'Durable Object not found' }, 500);
	}

	const stats = await queueStub.getStats();
	return c.json(stats);
});

app.get('/dashboard', async (c) => {
	const groupId = groupUtil.get(c.req.query('groupId'));
	const queueStub = getQueueInstance(c, groupId);
	if (queueStub === null) {
		return c.json({ message: 'Durable Object not found' }, 500);
	}

	const apiKey = c.req.header('x-api-key') || c.req.query('x-api-key');
	const tab = c.req.query('tab') || 'overview';
	const page = parseInt(c.req.query('page') || '1');
	const limit = 10;
	const offset = (page - 1) * limit;

	const stats = await queueStub.getStats();
	const consumerStats = (c.env as Env).ENABLE_CONTROL_CONCURRENCY ? await queueStub.getConsumerStats() : null;
	const selectOptions = groups.map((g) => `<option value="${g}" ${g === groupId ? 'selected' : ''}>${g}</option>`).join('');

	let content = '';
	let basedLink = `/dashboard?x-api-key=${apiKey}&groupId=${groupId}`;
	if (tab === 'messages') {
		const messages = await queueStub.getMessages(limit, offset);
		const totalMessagesRaw = await queueStub.getTotalMessages();
		const totalMessages = Number(totalMessagesRaw) || 0;
		const totalPages = Math.ceil(totalMessages / limit);

		const messageRows = messages
			.map((msg) => {
				const createdAt = new Date(Number(msg.created_at)).toLocaleString();
				const payloadStr = String(msg.payload || '');
				const payloadTruncated = payloadStr.length > 100 ? payloadStr.substring(0, 100) + '...' : payloadStr;
				const statusText = Number(msg.status) === 0 ? 'Pending' : Number(msg.status) === 1 ? 'Processing' : 'Unknown';
				return `
				<tr>
					<td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${msg.id}</td>
					<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${msg.url}</td>
					<td class="px-6 py-4 text-sm text-gray-500">${payloadTruncated}</td>
					<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${createdAt}</td>
					<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${statusText}</td>
					<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${msg.retries}</td>
				</tr>
			`;
			})
			.join('');

		const pagination = [];
		if (page > 1) {
			pagination.push(
				`<a href="${basedLink}&tab=messages&page=${page - 1}" class="relative inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-l-md hover:bg-gray-50">Previous</a>`,
			);
		}
		for (let i = Math.max(1, page - 2); i <= Math.min(totalPages, page + 2); i++) {
			const activeClass =
				i === page ? 'bg-indigo-50 border-indigo-500 text-indigo-600' : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50';
			pagination.push(
				`<a href="${basedLink}&tab=messages&page=${i}" class="relative inline-flex items-center px-4 py-2 text-sm font-medium ${activeClass} border">${i}</a>`,
			);
		}
		if (page < totalPages) {
			pagination.push(
				`<a href="${basedLink}&tab=messages&page=${page + 1}" class="relative inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-r-md hover:bg-gray-50">Next</a>`,
			);
		}

		content = `
			<div class="px-4 py-0 sm:px-0">
				<!-- Group Selector -->
				<div class="mb-6">
					<label for="groupSelect" class="block text-sm font-medium text-gray-700">Select Group</label>
					<select id="groupSelect" onchange="window.location.href='/dashboard?x-api-key=${apiKey}&groupId=' + this.value + '&tab=messages'" class="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md">
						${selectOptions}
					</select>
				</div>

				<!-- Tab Navigation -->
				<div class="mb-6">
					<div class="border-b border-gray-200">
						<nav class="-mb-px flex space-x-8" aria-label="Tabs">
							<a href="${basedLink}" class="border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm">
								Overview
							</a>
							<a href="${basedLink}&tab=messages" class="border-indigo-500 text-indigo-600 whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm">
								Messages
							</a>
							${
								(c.env as Env).ENABLE_CONTROL_CONCURRENCY
									? `
							<a href="/consumers?x-api-key=${apiKey}&groupId=${groupId}" class="border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm">
								Consumers
							</a>
							`
									: ''
							}
						</nav>
					</div>
				</div>

				<div class="mb-6">
					<div class="bg-white shadow overflow-hidden sm:rounded-md">
						<div class="px-4 py-5 sm:px-6">
							<h3 class="text-lg leading-6 font-medium text-gray-900">Messages (${totalMessages})</h3>
						</div>
						<div class="overflow-x-auto">
							<table class="min-w-full divide-y divide-gray-200">
								<thead class="bg-gray-50">
									<tr>
										<th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
										<th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">URL</th>
										<th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Payload</th>
										<th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created At</th>
										<th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
										<th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Retries</th>
									</tr>
								</thead>
								<tbody class="bg-white divide-y divide-gray-200">
									${messageRows}
								</tbody>
							</table>
						</div>
						<div class="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
							<div class="flex-1 flex justify-between sm:hidden">
								${page > 1 ? `<a href="${basedLink}&tab=messages&page=${page - 1}" class="relative inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50">Previous</a>` : ''}
								${page < totalPages ? `<a href="${basedLink}&tab=messages&page=${page + 1}" class="ml-3 relative inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50">Next</a>` : ''}
							</div>
							<div class="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
								<div>
									<p class="text-sm text-gray-700">
										Showing <span class="font-medium">${offset + 1}</span> to <span class="font-medium">${Math.min(offset + limit, totalMessages)}</span> of <span class="font-medium">${totalMessages}</span> results
									</p>
								</div>
								<div>
									<nav class="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
										${pagination.join('')}
									</nav>
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>
		`;
	} else {
		content = `
			<div class="px-4 py-0 sm:px-0">
				<!-- Group Selector -->
				<div class="mb-6">
					<label for="groupSelect" class="block text-sm font-medium text-gray-700">Select Group</label>
					<select id="groupSelect" onchange="window.location.href='/dashboard?x-api-key=${apiKey}&groupId=' + this.value" class="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md">
						${selectOptions}
					</select>
				</div>

				<!-- Tab Navigation -->
				<div class="mb-6">
					<div class="border-b border-gray-200">
						<nav class="-mb-px flex space-x-8" aria-label="Tabs">
							<a href="${basedLink}" class="border-indigo-500 text-indigo-600 whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm">
								Overview
							</a>
							<a href="${basedLink}&tab=messages" class="border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm">
								Messages
							</a>
							${
								(c.env as Env).ENABLE_CONTROL_CONCURRENCY
									? `
							<a href="/consumers?x-api-key=${apiKey}&groupId=${groupId}" class="border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm">
								Consumers
							</a>
							`
									: ''
							}
						</nav>
					</div>
				</div>

				<div class="mb-6">
					<div class="bg-white shadow rounded-lg p-6">
						<div class="grid grid-cols-2 gap-4 sm:grid-cols-4 ${(c.env as Env).ENABLE_CONTROL_CONCURRENCY ? 'lg:grid-cols-7' : 'lg:grid-cols-4'}">
							<div class="text-center">
								<div class="text-2xl font-bold text-blue-600">${stats.totalMessagesDql}</div>
								<div class="text-sm text-gray-500">Total of message on dead letter queue</div>
							</div>
							<div class="text-center">
								<div class="text-2xl font-bold text-yellow-600">${stats.totalMessagesPending}</div>
								<div class="text-sm text-gray-500">Total messages pending</div>
							</div>
							<div class="text-center">
								<div class="text-2xl font-bold text-purple-600">${stats.totalMessagesProcessing}</div>
								<div class="text-sm text-gray-500">Total messages processing</div>
							</div>
							<div class="text-center">
								<div class="text-2xl font-bold text-green-600">${stats.totalMessagesWaitingRetry}</div>
								<div class="text-sm text-gray-500">Total message waiting to retry</div>
							</div>
							${
								(c.env as Env).ENABLE_CONTROL_CONCURRENCY && consumerStats
									? `
							<div class="text-center">
								<div class="text-2xl font-bold text-indigo-600">${consumerStats.waiting}</div>
								<div class="text-sm text-gray-500">Waiting consumers</div>
							</div>
							<div class="text-center">
								<div class="text-2xl font-bold text-orange-600">${consumerStats.working}</div>
								<div class="text-sm text-gray-500">Working consumers</div>
							</div>
							<div class="text-center">
								<div class="text-2xl font-bold text-red-600">${consumerStats.expired}</div>
								<div class="text-sm text-gray-500">Expired consumers</div>
							</div>
							`
									: ''
							}
						</div>
					</div>
				</div>
			</div>
		`;
	}

	const html = getHTML('Dashboard', content);
	return new Response(html, {
		headers: {
			'content-type': 'text/html;charset=UTF-8',
		},
	});
});

app.get('/consumers', async (c) => {
	if (!(c.env as Env).ENABLE_CONTROL_CONCURRENCY) {
		return c.json({ message: 'Feature disabled. Set ENABLE_CONTROL_CONCURRENCY=true' }, 403);
	}

	const apiKey = c.req.header('x-api-key') || c.req.query('x-api-key');
	const groupId = c.req.query('groupId') || 'DEFAULT';
	const page = parseInt(c.req.query('page') || '1');
	const limit = 20;
	const offset = (page - 1) * limit;

	const queueStub = getQueueInstance(c, groupId);
	const consumerStats = await queueStub.getConsumerStats();
	const consumers = await queueStub.getConsumers(limit, offset);

	const groupOptions = groups.map((g) => `<option value="${g}" ${g === groupId ? 'selected' : ''}>${g}</option>`).join('');

	const consumerRows = consumers
		.map((c) => {
			const statusClass = c.status === 'WAITING' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800';
			const createdAt = new Date(Number(c.created_at)).toLocaleString();
			const expiredAt = c.expired_at ? new Date(Number(c.expired_at)).toLocaleString() : '-';
			const isExpired = c.expired_at && c.expired_at < Date.now();

			const deleteBtn =
				c.status === 'WAITING'
					? `<button onclick="deleteConsumer('${c.id}', '${groupId}')" class="text-red-600 hover:text-red-900">Delete</button>`
					: `<span class="text-gray-400">Delete</span>`;

			return `
      <tr>
        <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${c.id}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${c.group_id}</td>
        <td class="px-6 py-4 whitespace-nowrap">
          <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusClass}">
            ${isExpired ? 'EXPIRED' : c.status}
          </span>
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${createdAt}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${expiredAt}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${deleteBtn}</td>
      </tr>
    `;
		})
		.join('');

	const content = `
    <div class="px-4 py-6">
      <h2 class="text-2xl font-bold mb-6">Consumer Management</h2>
      
      <!-- Stats -->
      <div class="bg-white shadow rounded-lg p-6 mb-6">
        <div class="grid grid-cols-4 gap-4">
          <div class="text-center">
            <div class="text-3xl font-bold text-blue-600">${consumerStats.total}</div>
            <div class="text-sm text-gray-500">Total</div>
          </div>
          <div class="text-center">
            <div class="text-3xl font-bold text-green-600">${consumerStats.waiting}</div>
            <div class="text-sm text-gray-500">Waiting</div>
          </div>
          <div class="text-center">
            <div class="text-3xl font-bold text-yellow-600">${consumerStats.working}</div>
            <div class="text-sm text-gray-500">Working</div>
          </div>
          <div class="text-center">
            <div class="text-3xl font-bold text-red-600">${consumerStats.expired}</div>
            <div class="text-sm text-gray-500">Expired</div>
          </div>
        </div>
      </div>

      <!-- Create Form -->
      <div class="bg-white shadow rounded-lg p-6 mb-6">
        <h3 class="text-lg font-medium mb-4">Create Consumers</h3>
        <form action="/consumers?x-api-key=${apiKey}" method="POST" class="flex gap-4 items-end">
          <div>
            <label class="block text-sm font-medium text-gray-700">Group</label>
            <select name="groupId" class="mt-1 block w-full border-gray-300 rounded-md shadow-sm">
              ${groupOptions}
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700">Number of Consumers</label>
            <input type="number" name="count" min="1" max="100" value="5" 
              class="mt-1 block w-32 border-gray-300 rounded-md shadow-sm" required>
          </div>
          <button type="submit" 
            class="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700">
            Create
          </button>
        </form>
      </div>

      <!-- Filter by Group -->
      <div class="bg-white shadow rounded-lg p-4 mb-6">
        <form class="flex gap-4 items-end">
          <input type="hidden" name="x-api-key" value="${apiKey}">
          <div>
            <label class="block text-sm font-medium text-gray-700">Filter by Group</label>
            <select name="groupId" onchange="this.form.submit()" 
              class="mt-1 block w-full border-gray-300 rounded-md shadow-sm">
              <option value="">All Groups</option>
              ${groupOptions}
            </select>
          </div>
        </form>
      </div>

      <!-- Consumer List -->
      <div class="bg-white shadow rounded-lg overflow-hidden overflow-x-auto">
        <div class="px-6 py-4 border-b">
          <h3 class="text-lg font-medium">Consumers</h3>
        </div>
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500">ID</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500">Group</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500">Status</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500">Created</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500">Expires</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500">Action</th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            ${consumerRows || '<tr><td colspan="6" class="px-6 py-4 text-center text-gray-500">No consumers yet</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
    
    <script>
    async function deleteConsumer(consumerId, groupId) {
      if (!confirm('Are you sure you want to delete this consumer?')) return;
      
      const apiKey = new URLSearchParams(window.location.search).get('x-api-key');
      const formData = new FormData();
      formData.append('consumerId', consumerId);
      formData.append('groupId', groupId);
      
      const response = await fetch('/consumers?x-api-key=' + apiKey + '&_method=DELETE', {
        method: 'POST',
        body: formData
      });
      
      if (response.ok) {
        location.reload();
      } else {
        const data = await response.json();
        alert('Error: ' + data.message);
      }
    }
    </script>
  `;

	return new Response(getHTML('Consumers', content), {
		headers: { 'content-type': 'text/html;charset=UTF-8' },
	});
});

app.post('/consumers', async (c) => {
	if (!(c.env as Env).ENABLE_CONTROL_CONCURRENCY) {
		return c.json({ message: 'Feature disabled' }, 403);
	}

	if (c.req.query('_method') === 'DELETE') {
		const body = await c.req.parseBody();
		const consumerId = String(body.consumerId);
		const groupId = String(body.groupId);

		if (!consumerId || !groupId) {
			return c.json({ message: 'consumerId and groupId required' }, 400);
		}

		if (!groupsAllowed[groupId]) {
			return c.json({ message: 'Group not found' }, 404);
		}

		const queueStub = getQueueInstance(c, groupId);
		const result = await queueStub.deleteConsumer(consumerId);

		if (!result.success) {
			return c.json({ message: result.message }, 400);
		}

		return c.json({ ok: true, message: result.message });
	}

	const body = await c.req.parseBody();
	const groupId = String(body.groupId || 'DEFAULT');
	const count = parseInt(String(body.count || '1'));

	if (!groupsAllowed[groupId]) {
		return c.json({ message: 'Group not found' }, 404);
	}

	if (isNaN(count) || count < 1 || count > 100) {
		return c.json({ message: 'Invalid count (1-100)' }, 400);
	}

	const queueStub = getQueueInstance(c, groupId);
	await queueStub.createConsumers(count);

	const apiKey = c.req.header('x-api-key') || c.req.query('x-api-key');
	return c.redirect(`/consumers?x-api-key=${apiKey}&groupId=${groupId}`);
});

app.get('/reset-consumers', async (c) => {
	if (!(c.env as Env).ENABLE_CONTROL_CONCURRENCY) {
		return c.json({ message: 'Feature disabled' }, 403);
	}

	const groupIdsParam = c.req.query('groupIds');
	if (!groupIdsParam) {
		return c.json({ message: 'groupIds query parameter required (comma-separated)' }, 400);
	}

	const groupIds = groupIdsParam.split(',').map((g) => g.trim());
	const results: { [key: string]: number } = {};

	for (const groupId of groupIds) {
		if (!groupsAllowed[groupId]) {
			results[groupId] = -1;
			continue;
		}

		const queueStub = getQueueInstance(c, groupId);
		const resetCount = await queueStub.resetExpiredConsumers();
		results[groupId] = resetCount;
	}

	return c.json({
		ok: true,
		results,
		message: 'Expired consumers reset successfully',
	});
});

app.post('/consumer-is-ready-process-next-message', async (c) => {
	if (!(c.env as Env).ENABLE_CONTROL_CONCURRENCY) {
		return c.json({ message: 'Feature disabled' }, 403);
	}

	const groupId = c.req.query('groupId');
	if (!groupId || !groupsAllowed[groupId]) {
		return c.json({ message: 'Invalid groupId' }, 400);
	}

	const body = await c.req.json();
	const consumerId = String(body.consumerId);

	if (!consumerId) {
		return c.json({ message: 'consumerId is required' }, 400);
	}

	const queueStub = getQueueInstance(c, groupId);
	await queueStub.markConsumerReady(consumerId);

	return c.json({ ok: true, message: 'Consumer marked as WAITING' });
});

export default app;
