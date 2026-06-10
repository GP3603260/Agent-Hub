const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const Anthropic = require('@anthropic-ai/sdk');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(express.json());
app.use(express.static('public'));

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ─── In-memory store ────────────────────────────────────────────────────────
const memory = {
  jobs: {},        // job_id → { context, status, owner, createdAt }
  agentLogs: [],   // all messages between agents
  sharedContext: { // global facts all agents can read
    company: 'Superior Dairy Solutions LLC',
    location: 'San Antonio / New Braunfels, TX',
    clients: ['Oak Farms', 'Hiland Dairy'],
    payPeriod: 'weekly',
  },
};

// ─── Agent Definitions ───────────────────────────────────────────────────────
const AGENTS = {
  manager: {
    name: 'Manager Agent',
    emoji: '👑',
    systemPrompt: `You are the Manager Agent for Superior Dairy Solutions LLC, a Texas-based industrial contracting business.
You coordinate a team of three specialist agents:
- sourcing: finds and compares vendors/materials/parts
- finance: handles invoicing, cash flow, P&L, and payments
- timesheet: tracks employee hours, payroll, and job-site time

Your job:
1. Understand the user's request
2. Break it into tasks and assign each to the right agent
3. Collect their responses and synthesize a final answer
4. Keep the user informed of progress

When delegating, output JSON in this exact format:
{ "delegate": [{ "agent": "sourcing|finance|timesheet", "task": "specific task description" }], "summary": "what you are doing" }

When synthesizing a final answer (no more delegation needed), output:
{ "final": true, "response": "your complete answer to the user" }`,
  },

  sourcing: {
    name: 'Sourcing Agent',
    emoji: '📦',
    systemPrompt: `You are the Sourcing Agent for Superior Dairy Solutions LLC (San Antonio, TX).
You find and compare vendors for construction materials, industrial/dairy equipment parts, and tools & consumables.
You prioritize PRICE and LEAD TIME. Vendors: Grainger, McMaster-Carr, Home Depot Pro, Fastenal, Ferguson, Global Industrial, MSC Industrial, Amazon Business.
Return clear, structured results with vendor name, price, lead time in days, stock status, and a recommendation.
Be concise — your output gets passed to the Manager Agent.`,
  },

  finance: {
    name: 'Finance Agent',
    emoji: '💰',
    systemPrompt: `You are the Finance Agent for Superior Dairy Solutions LLC (San Antonio, TX).
You handle: invoice generation and tracking, cash flow monitoring, accounts receivable/payable, P&L snapshots, margin analysis, and budget vs actuals.
Clients include Oak Farms and Hiland Dairy. Invoice series: GAP04+.
Return structured financial data clearly. Flag overdue payments and cash risks.
Be concise — your output gets passed to the Manager Agent.`,
  },

  timesheet: {
    name: 'Timesheet Agent',
    emoji: '🕐',
    systemPrompt: `You are the Timesheet Agent for Superior Dairy Solutions LLC.
You track employee hours by crew member and job site (Oak Farms - San Antonio, Hiland Dairy - Conroe TX).
You calculate regular hours, overtime (Texas: >40hrs/week at 1.5x), per diem, and payroll summaries.
Pay period: weekly. Flag missing entries and schedule conflicts.
Return clean structured data. Be concise — your output gets passed to the Manager Agent.`,
  },
};

// ─── Memory helpers ───────────────────────────────────────────────────────────
function logMessage(from, to, type, content, jobId = null) {
  const entry = { id: uuidv4(), from, to, type, content, jobId, timestamp: new Date().toISOString() };
  memory.agentLogs.push(entry);
  if (memory.agentLogs.length > 500) memory.agentLogs.shift();
  io.emit('log', entry);
  return entry;
}

function createJob(description, initiatedBy = 'user') {
  const jobId = uuidv4().slice(0, 8);
  memory.jobs[jobId] = { id: jobId, description, status: 'active', initiatedBy, createdAt: new Date().toISOString(), context: {}, results: {} };
  io.emit('job:created', memory.jobs[jobId]);
  return jobId;
}

function updateJob(jobId, updates) {
  if (memory.jobs[jobId]) {
    Object.assign(memory.jobs[jobId], updates, { updatedAt: new Date().toISOString() });
    io.emit('job:updated', memory.jobs[jobId]);
  }
}

// ─── Run a single agent ───────────────────────────────────────────────────────
async function runAgent(agentKey, task, jobId, conversationHistory = []) {
  const agent = AGENTS[agentKey];
  if (!agent) throw new Error(`Unknown agent: ${agentKey}`);

  logMessage(agentKey, 'hub', 'task_start', task, jobId);
  io.emit('agent:thinking', { agent: agentKey, jobId });

  const tools = agentKey === 'sourcing' ? [{ type: 'web_search_20250305', name: 'web_search' }] : undefined;

  const contextBlock = `\nShared context: ${JSON.stringify(memory.sharedContext)}\nJob ID: ${jobId}`;
  const messages = [
    ...conversationHistory,
    { role: 'user', content: task + contextBlock },
  ];

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1000,
    system: agent.systemPrompt,
    tools,
    messages,
  });

  const textBlock = response.content.find(b => b.type === 'text');
  const result = textBlock ? textBlock.text.trim() : '(no response)';

  logMessage('hub', agentKey, 'task_result', result, jobId);
  io.emit('agent:done', { agent: agentKey, jobId, result });

  return result;
}

// ─── Manager orchestration loop ───────────────────────────────────────────────
async function runManager(userMessage, jobId) {
  const history = [];
  let iterations = 0;
  const MAX_ITER = 4;

  updateJob(jobId, { status: 'manager_thinking' });
  logMessage('user', 'manager', 'request', userMessage, jobId);

  while (iterations < MAX_ITER) {
    iterations++;

    // Build context from any results collected so far
    const job = memory.jobs[jobId];
    const resultsContext = Object.keys(job.results).length > 0
      ? `\n\nResults collected so far:\n${JSON.stringify(job.results, null, 2)}`
      : '';

    history.push({ role: 'user', content: userMessage + resultsContext });

    const managerResponse = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 800,
      system: AGENTS.manager.systemPrompt,
      messages: history,
    });

    const textBlock = managerResponse.content.find(b => b.type === 'text');
    const rawText = textBlock ? textBlock.text.trim() : '{}';
    history.push({ role: 'assistant', content: rawText });

    logMessage('manager', 'hub', 'decision', rawText, jobId);

    let parsed;
    try {
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
    } catch (e) {
      // Manager gave a plain text response — treat as final
      updateJob(jobId, { status: 'complete', finalResponse: rawText });
      return rawText;
    }

    if (!parsed) {
      updateJob(jobId, { status: 'complete', finalResponse: rawText });
      return rawText;
    }

    // Final answer
    if (parsed.final) {
      updateJob(jobId, { status: 'complete', finalResponse: parsed.response });
      logMessage('manager', 'user', 'final_response', parsed.response, jobId);
      return parsed.response;
    }

    // Delegate to sub-agents
    if (parsed.delegate && parsed.delegate.length > 0) {
      updateJob(jobId, { status: `delegating (${parsed.delegate.map(d => d.agent).join(', ')})` });
      io.emit('manager:delegating', { jobId, tasks: parsed.delegate, summary: parsed.summary });

      // Run delegated agents (sequentially for simplicity)
      for (const delegation of parsed.delegate) {
        const { agent, task } = delegation;
        if (AGENTS[agent]) {
          const result = await runAgent(agent, task, jobId);
          memory.jobs[jobId].results[agent] = result;
          updateJob(jobId, { results: memory.jobs[jobId].results });
        }
      }
      // Loop back — manager synthesizes the results
      userMessage = `Original request: "${userMessage}"\n\nYou have received results from the agents. Now synthesize a final answer.`;
    }
  }

  const fallback = 'Task completed. Check agent logs for details.';
  updateJob(jobId, { status: 'complete', finalResponse: fallback });
  return fallback;
}

// ─── REST API ─────────────────────────────────────────────────────────────────

// Send a message to the manager (main entry point)
app.post('/api/message', async (req, res) => {
  const { message, jobId: existingJobId } = req.body;
  if (!message) return res.status(400).json({ error: 'message required' });

  const jobId = existingJobId || createJob(message);
  res.json({ jobId, status: 'processing' }); // respond immediately, result comes via socket

  try {
    const result = await runManager(message, jobId);
    io.emit('job:response', { jobId, result });
  } catch (err) {
    console.error(err);
    updateJob(jobId, { status: 'error', error: err.message });
    io.emit('job:error', { jobId, error: err.message });
  }
});

// Send directly to a specific agent (bypass manager)
app.post('/api/agent/:agentKey', async (req, res) => {
  const { agentKey } = req.params;
  const { task } = req.body;
  if (!task) return res.status(400).json({ error: 'task required' });
  if (!AGENTS[agentKey]) return res.status(404).json({ error: 'unknown agent' });

  const jobId = createJob(task);
  res.json({ jobId, status: 'processing' });

  try {
    const result = await runAgent(agentKey, task, jobId);
    io.emit('job:response', { jobId, result });
  } catch (err) {
    updateJob(jobId, { status: 'error', error: err.message });
    io.emit('job:error', { jobId, error: err.message });
  }
});

// Get all jobs
app.get('/api/jobs', (req, res) => {
  const jobs = Object.values(memory.jobs).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 50);
  res.json(jobs);
});

// Get a single job
app.get('/api/jobs/:jobId', (req, res) => {
  const job = memory.jobs[req.params.jobId];
  if (!job) return res.status(404).json({ error: 'not found' });
  res.json(job);
});

// Get recent logs
app.get('/api/logs', (req, res) => {
  res.json(memory.agentLogs.slice(-100));
});

// Read/write shared memory
app.get('/api/memory', (req, res) => res.json(memory.sharedContext));
app.patch('/api/memory', (req, res) => {
  Object.assign(memory.sharedContext, req.body);
  io.emit('memory:updated', memory.sharedContext);
  res.json(memory.sharedContext);
});

// Agent status
app.get('/api/agents', (req, res) => {
  res.json(Object.entries(AGENTS).map(([key, a]) => ({ key, name: a.name, emoji: a.emoji })));
});

// Health
app.get('/health', (req, res) => res.json({ status: 'ok', agents: Object.keys(AGENTS), timestamp: new Date().toISOString() }));

// ─── Socket.io ────────────────────────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log('Dashboard connected:', socket.id);
  // Send current state on connect
  socket.emit('init', {
    agents: Object.entries(AGENTS).map(([key, a]) => ({ key, name: a.name, emoji: a.emoji })),
    recentJobs: Object.values(memory.jobs).slice(-10),
    recentLogs: memory.agentLogs.slice(-50),
    sharedContext: memory.sharedContext,
  });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => console.log(`Agent Hub running on port ${PORT}`));
