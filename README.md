# Simple Queue

A reliable, easy-to-use message queue system built on Cloudflare Workers. Open-source alternative to paid services like Zeplo or Qstash.

The queue for people only know What's API and how to make requests

Read in [Portuguese](README-pt.md)

## Why Choose Simple Queue?

- Set up once
- Scales with your needs without changing configurations
- Pay only for what you use
- You need only to know what an API is and how to make HTTP requests
- You need to run automations or actions that take a long time, and at the same time limit actions to avoid overloading your server.

Imagine sending messages between your apps without worrying about them getting lost or your systems crashing. Simple Queue makes it simple and affordable!

### Key Benefits:

- **Easy Setup**: Set it up once and forget about it. No complex server configurations needed.
- **Pay Only for What You Use**: Serverless technology means you only pay for actual usage – save money!
- **Reliable Delivery**: Messages are stored safely and delivered even if your apps are busy or offline.
- **Automatic Retries**: If something goes wrong, it tries again automatically.
- **Organize Your Messages**: Group messages by app or task to keep things tidy.
- **No Tech Experts Needed**: Works with simple HTTP requests – if you know APIs, you're good to go.
- **Cost-Effective**: No need for expensive DevOps teams or infrastructure.
- **Secure**: Protect your messages with API keys.

## How It Works

1. **Send Messages**: Your app sends messages via simple HTTP requests.
2. **Store Safely**: Messages are stored in a reliable queue.
3. **Process Automatically**: A scheduler picks up messages and sends them to your destination apps.
4. **Handle Errors**: If delivery fails, it retries or moves to a "dead letter" queue for review.

## Quick Start

1. **Clone the Project**: Download the code from GitHub.
2. **Install Dependencies**: Run `npm install`.
3. **Run Locally**: Use `npm run dev` to test on your machine.
4. **Deploy**: Run `npm run deploy` to put it live on Cloudflare.
5. **Set Up Scheduler**: Use Supabase to create a simple cron job that processes messages every few seconds.

For detailed setup, check the [full documentation](#how-to-run) below.

Open the groups.json file.
Add a new name to the list. (Use simple names without special characters, like user_queue, product_queue, chatbot_queue.)

For chat queues, also add the group (with its chat config) to `chatbot_group.json`. (See [Chat Queue](#chat-queue-for-chatbots).)

### HOW TO PUBLISH A MESSAGE ON DEFAULT GROUP ID

```bash
curl --request POST \
  --url 'SIMPLE_QUEUE_URL_HERE/publish?url=URL_RECEIVE_MESSAGE' \
  --header 'Content-Type: application/json' \
  --header 'User-Agent: insomnia/11.0.2' \
  --header 'x-api-key: api_key_here' \
  --data '{
	"message": "Hi test, How are you doing",
	"timestamp": "1780776976949",
	"test": true
}'
```

### HOW TO PUBLISH A MESSAGE ON A CUSTOM GROUP ID

```bash
curl --request POST \
  --url 'SIMPLE_QUEUE_URL_HERE/publish?groupId=GROUP_ID_FROM_FILE_GROUPS.JSON&url=URL_RECEIVE_MESSAGE' \
  --header 'Content-Type: application/json' \
  --header 'User-Agent: insomnia/11.0.2' \
  --header 'x-api-key: api_key_here' \
  --data '{
	"message": "Hi test, How are you doing",
	"timestamp": "1780776976949",
	"test": true
}'
```

### HOW TO SET MESSAGE DELAY

You can delay message delivery using the `delay` query parameter. The message will only be processed after the specified delay has passed.

**Important:** If you don't specify a delay, the message will be processed immediately (no waiting).

**Supported formats:**
- `Xs` - seconds (e.g., `30s`)
- `Xm` - minutes (e.g., `1m`, `30m`)
- `Xh` - hours (e.g., `1h`)
- `0s`, `0m`, `0h` - immediate delivery (same as not setting delay)

**Maximum delay:** 24 hours

**Example - Delay message by 1 minute:**

```bash
curl --request POST \
  --url 'SIMPLE_QUEUE_URL_HERE/publish?url=URL_RECEIVE_MESSAGE&delay=1m' \
  --header 'Content-Type: application/json' \
  --header 'x-api-key: api_key_here' \
  --data '{
	"message": "Hi test, delayed by 1 minute"
}'
```

**Example - Delay message by 30 seconds on a custom group:**

```bash
curl --request POST \
  --url 'SIMPLE_QUEUE_URL_HERE/publish?groupId=mygroup&url=URL_RECEIVE_MESSAGE&delay=30s' \
  --header 'Content-Type: application/json' \
  --header 'x-api-key: api_key_here' \
  --data '{
	"message": "Hi test, delayed by 30 seconds"
}'
```

**Error responses:**
- `400 Bad Request` - `"Invalid delay format. Valid formats: 1s, 30s, 1m, 30m, 1h"`
- `400 Bad Request` - `"Maximum delay is 24 hours"`

## Chat Queue (For Chatbots)

The Chat Queue is a special mode designed for chatbot workloads (e.g., Telegram bots). It batches rapid consecutive messages from the same chat session into a single delivery and enforces a minimum interval between deliveries per session, so your bot logic is never overwhelmed.

- **Message Coalescing**: Multiple messages sent by the same user (same `sessionId`) within a short period are merged into one message.
- **Per-Session Rate Limiting**: A session is never processed more than once within the configured interval.
- **No Lost Messages**: Everything is stored in the queue until delivered successfully.

### How It Works

1. **Publish**: A message arrives (e.g., via a Telegram webhook). The `sessionIdKey` config extracts the session ID from the payload.
2. **Coalesce**: When the configured condition matches an incoming payload, its message text is appended to a compatible pending text message from the same session inside the time window (joined with `\n`). If the condition does not match, or there is no compatible message to append to, the complete payload is enqueued as a separate chat message. For example, a Telegram audio update without `message.text` stays a separate entry with its audio fields intact.
3. **Process**: The scheduler calls `/process-chat-queue`. Only messages whose `updated_at` is older than `intervalBeforeProcessInSecond` are delivered, so the same session is processed at most once per interval.

### HOW TO SETUP THE CHAT QUEUE

1. **Configure your API key and env vars**: set `API_KEY` (and optionally the others) in `wrangler.jsonc`. See [Environment Variables](#environment-variables).
2. **Register the group in `groups.json`**: add the group name as a plain string (e.g., `"chatbot_queue"`). (Use simple names without special characters.)
3. **Register the group in `chatbot_group.json`**: add the same group name with its chat config — see [Configuring Chat Groups](#configuring-chat-groups) below.
4. **Run it**: `npm run dev` for local testing, or `npm run deploy` to deploy to Cloudflare.

#### Configuring Chat Groups

Chat groups are configured in `chatbot_group.json`:

```json
[
  {
    "name": "DEFAULT",
    "messageKey": "message.text",
    "sessionIdKey": "message.chat.id",
    "intervalBeforeProcessInSecond": 15,
    "condition": {
      "key": "message.text",
      "operator": "exists",
      "value": ""
    }
  }
]
```

| Field | Description |
|-------|-------------|
| `name` | Chat group identifier (used as `groupId`) |
| `messageKey` | Dot-path in the payload where the user's message text lives |
| `sessionIdKey` | Dot-path in the payload that identifies the chat session/user |
| `intervalBeforeProcessInSecond` | Minimum seconds between deliveries for the same session |
| `condition` | Optional rule evaluated against each incoming payload to decide whether to append its message text or enqueue the full payload separately |
| `condition.key` | Dot-path in the incoming payload to check |
| `condition.operator` | `exists` (truthy value), `contains` (string or array inclusion), or `equal` (strict equality) |
| `condition.value` | Comparison value for `contains` and `equal`; unused by `exists` |

> **Important**: For a chat group to work with every endpoint, the group name must be registered in **both** files: `groups.json` (as a plain string) **and** `chatbot_group.json` (with its chat config). `/publish` validates against `groups.json`, while `/process-chat-queue`, `/stats-chat-queue` and `/dashboard-chat-queue` validate against `chatbot_group.json`.

### HOW TO PUBLISH A MESSAGE ON THE CHAT QUEUE

Publish any chat payload with `queueType=chatQueue`:

```bash
curl --request POST \
  --url 'SIMPLE_QUEUE_URL_HERE/publish?queueType=chatQueue&url=URL_RECEIVE_MESSAGE&groupId=DEFAULT' \
  --header 'Content-Type: application/json' \
  --header 'x-api-key: api_key_here' \
  --data '{
	"message": {
		"chat": { "id": 123456789 },
		"text": "Hello from the chat queue!"
	}
}'
```

- The payload shape must match the `sessionIdKey` and `messageKey` dot-paths of your chat group (e.g., `message.chat.id` and `message.text`).
- `groupId` is optional and defaults to `DEFAULT`. It must be registered in `groups.json`.
- `url` is the destination that receives the (coalesced) message payload.
- `delay` is optional — see [How To Set Message Delay](#how-to-set-message-delay).
- Response: `{"storedMessage": true}` on success, `{"storedMessage": false}` if the message could not be stored.
- Alternative endpoint: `POST /publish-chat-queue?url=...&groupId=...` (same behavior, no `queueType` needed).

#### Setting Up the Telegram Webhook

Point your Telegram bot's webhook to the queue so incoming messages are fed straight into the chat queue:

```bash
curl -X POST "https://api.telegram.org/botYOUR_BOT_TOKEN/setWebhook" \
     -H "Content-Type: application/json" \
     -d '{
       "url": "YOUR_SIMPLE_QUEUE_URL/publish?queueType=chatQueue&url=YOUR_DESTINATION_URL&x-api-key=api_key_here",
       "allowed_updates": ["message", "edited_message", "callback_query"],
       "drop_pending_updates": true
     }'
```

- `queueType=chatQueue` routes the request to the Chat Queue.
- `url` is the destination that receives the (coalesced) message payload.
- `x-api-key` must match your `API_KEY` env var.
- `groupId` is optional and defaults to `DEFAULT`. Use it to target a specific chat group.
- Telegram requires an HTTPS webhook URL (e.g., use ngrok for local testing).

### HOW TO CONSUME MESSAGES FROM THE CHAT QUEUE

Consuming is scheduler-driven: an external cron (e.g., Supabase) calls `/process-chat-queue`, and the queue POSTs each due message to its `url` destination.

```bash
curl --request GET \
  --url 'SIMPLE_QUEUE_URL_HERE/process-chat-queue?groupId=DEFAULT' \
  --header 'x-api-key: api_key_here'
```

- Response: `{"ok": true}`. Messages are delivered asynchronously right after the response.
- Only messages whose `updated_at` is older than `intervalBeforeProcessInSecond` are picked up (per-session rate limiting).
- Batch size per call is `TOTAL_MESSAGES_PULL_PER_TIME`.
- Your destination receives a `POST` with headers `User-Agent: SimpleQueue`, `x-api-key`, `Content-Type: application/json` and `group-id` (plus `consumer-id` when [concurrency control](#consumer-based-concurrency-control) is enabled).
- Failed deliveries are retried up to `TOTAL_RETRIES_BEFORE_DQL` times, then moved to the dead-letter queue.

#### Scheduling the Processing

Create a Supabase cron job that triggers `/process-chat-queue` every few seconds:

- Create a new cronjob
- Add a name
- Set the schedule to execute every 5 seconds
- Type **SQL Snippet**
- SQL snippet:

```sql
select
net.http_get(
    url:='http://localhost:8787/process-chat-queue?groupId=group_id_here',
    headers:=jsonb_build_object('x-api-key', 'YOUR_API_KEY'),
    timeout_milliseconds:=60000
);
```

Replace `http://localhost:8787` with your deployed URL and `group_id_here` with a chat group registered in `chatbot_group.json`.

If `ENABLE_CONTROL_CONCURRENCY=true`, also set up the [`/reset-consumers`](#resetting-expired-consumers) cron job.

### Other Chat Queue Endpoints

| Endpoint | Description |
|----------|-------------|
| `POST /publish-chat-queue?groupId=&url=&delay=` | Publish a message to a chat queue |
| `POST /publish?...&queueType=chatQueue` | Alternative way to publish (any group) |
| `GET /process-chat-queue?groupId=` | Deliver pending chat messages |
| `GET /stats-chat-queue?groupId=` | Chat queue statistics |
| `GET /dashboard-chat-queue?groupId=` | Chat queue dashboard |

The chat queue supports the same features as the regular queue: [delayed delivery](#how-to-set-message-delay) and [consumer-based concurrency control](#consumer-based-concurrency-control).

### HOW TO SETUP THE SCHEDULER

- Create a Supabase account
- Setup the cronjob on integration page
- Create a new cronjob
  - Add a name
  - Set the schedule to execute every 5 seconds
  - Type **SQL Snippet**
  - SQL snippet:

  ```sql
  select
  net.http_get(
      url:='YOUR_SIMPLE_QUEUE_APPLICATION_URL/process',
      headers:=jsonb_build_object('x-api-key', 'YOUR_API_KEY'),
      timeout_milliseconds:=60000
  );
  ```

  - SQL snippet to consume a specific group

  ```sql
  select
  net.http_get(
      url:='YOUR_SIMPLE_QUEUE_APPLICATION_URL/process?groupId=GROUP_ID_FROM_FILE_GROUPS.JSON',
      headers:=jsonb_build_object('x-api-key', 'YOUR_API_KEY'),
      timeout_milliseconds:=60000
  );

  - Click on button to save
  ```

## ARCHITECTURE

![Architecture](./architecture.png)

## Performance & Costs

- **Low Cost**: Processing 1 million messages costs around $5.
  - 1 million Cloudflare Workers to publish: $0.33
  - 1 million Cloudflare Workers to consume the messages: $0.33
  - 1 million Cloudflare Durable Objects storage for the queue's data: $2
  - 1 million Cloudflare Durable Objects get and delete the queue's data: $2 (update register when consuming the message and delete operation when message processed successfully)
- **Scalable**: Grows with your needs without extra setup.

## Get Help

Need assistance? We're here to help!

Email: [tiagorosadacost@gmail.com](mailto:tiagorosadacost@gmail.com)

---

## Technical Details (For Developers)

### Technologies Used

- Cloudflare Workers
- Durable Objects (SQLite storage)
- Node.js & TypeScript
- Supabase (for scheduling)

### Full Setup Instructions

- Clone the repository
- Run `npm install`
- Run `npm run dev` for local development
- Run `npm run deploy` to deploy to Cloudflare Workers
- Import the Insomnia collection `Insomnia_2026-01-11.yaml` for testing

### Setting Up Groups

Edit `groups.json` to add new groups (e.g., user_queue, product_queue).

### Data Validation

Use [this tool](https://transform.tools/json-to-zod) to generate validation schemas and add them to `src/schemas-validation.ts`.

### Scheduler Setup

Create a Supabase account and set up a cron job:

```sql
select net.http_get(
    url:='YOUR_QUEUE_URL/process',
    headers:=jsonb_build_object('x-api-key', 'YOUR_API_KEY'),
    timeout_milliseconds:=60000
);
```

### Environment Variables

- `API_KEY`: Protects your application
- `HTTP_REQUEST_TIMEOUT`: Request timeout in seconds
- `TOTAL_RETRIES_BEFORE_DQL`: Retry attempts before dead letter
- `TOTAL_MESSAGES_PULL_PER_TIME`: Messages processed per batch
- `ENABLE_CONTROL_CONCURRENCY`: Enable/disable consumer-based concurrency control (default: false)
- `LIMIT_CONSUMER_PROCESS`: Consumer expiry time in minutes when using concurrency control (default: 15)

### Limitations (Free Tier)

- 128MB memory limit
- 1,000 requests/minute
- 100,000 writes/day

---

## Consumer-Based Concurrency Control

A powerful feature that gives you precise control over how many messages are processed simultaneously. Perfect for rate-limiting sensitive third-party APIs or preventing server overload.

### Why Use This Feature?

- **Rate Limit Protection**: Prevent overwhelming third-party APIs or downstream services
- **Fair Distribution**: Messages are processed evenly across your consumer pool
- **Automatic Recovery**: Expired consumers are automatically reset to prevent stuck messages
- **No Waiting**: Requests are sent without waiting for response (fire-and-forget), improving throughput
- **Visibility**: Track consumer status (WAITING, WORKING) in real-time via dashboard

### How It Works

1. **Create Consumers**: Register consumer instances that will process messages
2. **Process Messages**: Each message is assigned to a WAITING consumer
3. **Fire-and-Forget**: Requests are sent immediately without waiting for response
4. **Notify Completion**: Third-party apps call an endpoint when done processing
5. **Auto-Reset**: Consumers expire after a timeout to handle abandoned processing

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    External Scheduler                             │
│               (calls /process every 5 seconds)                   │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                   GET /process?groupId=X                         │
│           (only if ENABLE_CONTROL_CONCURRENCY=true)              │
└───────────────────────────────┬─────────────────────────────────┘
                                │
         ┌──────────────────────┼──────────────────────┐
         ▼                      ▼                      ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│   Consumer-1    │  │   Consumer-2    │  │   Consumer-N    │
│   (WAITING)    │  │   (WORKING)     │  │   (WAITING)    │
│                 │  │  expires in 15m │  │                 │
└────────┬────────┘  └────────┬────────┘  └────────┬────────┘
         │                    │                    │
         └────────────────────┼────────────────────┘
                              │
                              ▼
                    Message Processing
                    + Header: consumer-id: <uuid>
```

### Enabling the Feature

Set the environment variable in `wrangler.jsonc`:

```jsonc
"vars": {
  "ENABLE_CONTROL_CONCURRENCY": true,
  "LIMIT_CONSUMER_PROCESS": 15
}
```

### Creating Consumers

Navigate to the dashboard or use the API to create consumers:

```bash
# Via dashboard: GET /consumers?x-api-key=YOUR_KEY
# Select group, enter count, click Create

# Via API
curl --request POST \
  --url 'SIMPLE_QUEUE_URL/consumers?x-api-key=api_key_here' \
  --header 'Content-Type: application/json' \
  --data '{"groupId": "DEFAULT", "count": 5}'
```

### Processing Messages

When consumers are available, messages are sent with `consumer-id` and `group-id` headers:

```bash
# Third-party receives request with:
# Header: consumer-id: 550e8400-e29b-41d4-a716-446655440000
# Header: group-id: DEFAULT
# Header: x-api-key: api_key_here
# Body: { ...your payload... }
```

Your application should use the `consumer-id` header to notify completion when done processing.

### Notifying Completion

After processing, your application notifies the queue:

```bash
curl --request POST \
  --url 'SIMPLE_QUEUE_URL/consumer-is-ready-process-next-message?groupId=DEFAULT' \
  --header 'Content-Type: application/json' \
  --data '{"consumerId": "550e8400-e29b-41d4-a716-446655440000"}'
```

### Resetting Expired Consumers

If a consumer times out (was processing for too long), reset them:

```bash
curl --request GET \
  --url 'SIMPLE_QUEUE_URL/reset-consumers?groupIds=DEFAULT,queue1&x-api-key=api_key_here'
```

### Setting Up the Reset Scheduler

Create a second Supabase cron job to automatically reset expired consumers:

- Create a new cronjob
- Add a name (e.g., "Reset Expired Consumers")
- Set the schedule to execute every 30 seconds (or your preferred interval)
- Type **SQL Snippet**
- SQL snippet for all groups:

```sql
select
net.http_get(
    url:='YOUR_SIMPLE_QUEUE_APPLICATION_URL/reset-consumers?groupIds=DEFAULT,queue1,queue2',
    headers:=jsonb_build_object('x-api-key', 'YOUR_API_KEY'),
    timeout_milliseconds:=60000
);
```

**Note:** Adjust `groupIds` to match your configured groups in `groups.json`.

### Managing Consumers via Dashboard

Access the consumer management page:

```
GET /consumers?x-api-key=api_key_here
```

Features:
- View all consumers (WAITING, WORKING, EXPIRED)
- Filter by group
- Delete WAITING consumers
- Create new consumers
- Monitor expiry times

### Consumer Status

| Status | Description |
|--------|-------------|
| `WAITING` | Ready to process messages |
| `WORKING` | Currently processing a message |
| `EXPIRED` | Timed out while working (needs reset) |

### Benefits Summary

| Benefit | Description |
|---------|-------------|
| **Precise Control** | Limit concurrent processing to exact numbers |
| **No Bottlenecks** | Fire-and-forget sends don't wait for responses |
| **Auto-Recovery** | Expired consumers are automatically reset |
| **Visibility** | Real-time status via dashboard |
| **Scalability** | Add more consumers anytime |
| **Flexibility** | Different limits per group |

### Load Test Results

Find scripts in `loadtest/` folder. Sample performance:

- 3k requests in 14.35s
- Average latency: 568ms
- Up to 1,188 req/sec
