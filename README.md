# Agent Hub
### Superior Dairy Solutions LLC — Multi-agent orchestration server

The Agent Hub is the central nervous system for your AI agent team. All agents connect through here. The Manager Agent receives your request, delegates to the right sub-agents, collects their results, and sends back a unified answer.

---

## Architecture

```
You (chat / SMS / API)
        │
        ▼
  ┌─────────────┐
  │   Manager   │  ← receives all requests, routes and synthesizes
  └──────┬──────┘
         │ delegates to
    ┌────┼────────────┐
    ▼    ▼            ▼
 Finance  Sourcing  Timesheet
 Agent    Agent     Agent
```

All agents share:
- A **job context** per task (passed automatically)
- A **shared memory** store (company name, clients, pay period, etc.)
- A **real-time log** of every message between agents

---

## Setup

### 1. Deploy to Railway (recommended)

1. Push this folder to a GitHub repo
2. Go to railway.app → New Project → Deploy from GitHub
3. Set environment variables:
   ```
   ANTHROPIC_API_KEY=sk-ant-...
   PORT=4000
   ```
4. Railway assigns a public URL automatically

### 2. Open the dashboard

Visit your Railway URL in any browser.
You'll see the live agent team dashboard with:
- Agent status (idle / thinking / done)
- Real-time job log
- Chat interface to the full team

---

## API endpoints

All agents are accessible via REST API — useful for connecting your SMS bot or other tools.

### Send a message to the full team (Manager routes it)
```
POST /api/message
{ "message": "Find the best price on 2 inch valves and generate a PO" }
→ { "jobId": "abc123", "status": "processing" }
```
Result arrives via Socket.io event: `job:response`

### Send directly to one agent
```
POST /api/agent/sourcing
POST /api/agent/finance
POST /api/agent/timesheet
{ "task": "your task description" }
```

### Get all jobs
```
GET /api/jobs
```

### Get a single job + its results
```
GET /api/jobs/:jobId
```

### Read/update shared memory
```
GET  /api/memory
PATCH /api/memory
{ "newEmployee": "Carlos", "ratePerHour": 22 }
```

### Get agent logs
```
GET /api/logs
```

---

## Connecting your SMS bot

In your `sourcing-sms-bot`, replace the direct Anthropic call with a call to the hub:

```javascript
// Instead of calling Anthropic directly:
const response = await fetch(`${process.env.HUB_URL}/api/agent/sourcing`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ task: userMessage }),
});
const { jobId } = await response.json();

// Then poll for result (or use socket.io):
let result = null;
for (let i = 0; i < 20; i++) {
  await new Promise(r => setTimeout(r, 2000));
  const job = await fetch(`${process.env.HUB_URL}/api/jobs/${jobId}`).then(r => r.json());
  if (job.status === 'complete') { result = job.finalResponse || job.results?.sourcing; break; }
}
```

Add `HUB_URL=https://your-hub.up.railway.app` to your SMS bot's env vars.

---

## Files
```
agent-hub/
├── src/
│   └── hub.js          ← core server (routing, memory, agents)
├── public/
│   └── index.html      ← real-time dashboard UI
├── package.json
├── .env.example
└── README.md
```

---

## Cost
- Anthropic API only — ~$0.003–0.015 per agent call
- Railway hosting: free tier handles light usage
- No per-seat or per-agent fees
