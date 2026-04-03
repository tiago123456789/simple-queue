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
