[README.md](https://github.com/user-attachments/files/28805832/README.md)
# Agent-Hub
Agent team managing dairy solutions
[pac[index.html](https://github.com/user-attachments/files/28805845/index.html)kage.json](https://github.com/user-attachments/files/28805834/package.json)[hub.js](h<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Agent Hub — Superior Dairy Solutions</title>
<script src="https://cdn.socket.io/4.7.2/socket.io.min.js"></script>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --bg: #0f0f10; --surface: #1a1a1c; --surface2: #242426;
    --border: rgba(255,255,255,0.08); --border2: rgba(255,255,255,0.14);
    --text: #e8e8ea; --muted: #888; --accent: #EF9F27;
    --green: #1D9E75; --blue: #378ADD; --purple: #7F77DD; --red: #E24B4A;
  }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: var(--bg); color: var(--text); min-height: 100vh; }
  .layout { display: grid; grid-template-columns: 260px 1fr; grid-template-rows: 56px 1fr; height: 100vh; overflow: hidden; }
  .topbar { grid-column: 1/-1; display: flex; align-items: center; gap: 12px; padding: 0 20px; border-bottom: 1px solid var(--border); background: var(--surface); }
  .topbar-logo { font-size: 16px; font-weight: 600; color: var(--text); }
  .topbar-sub { font-size: 12px; color: var(--muted); }
  .status-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--green); margin-left: auto; }
  .sidebar { background: var(--surface); border-right: 1px solid var(--border); overflow-y: auto; padding: 16px 12px; display: flex; flex-direction: column; gap: 6px; }
  .sidebar-label { font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.06em; padding: 8px 8px 4px; }
  .agent-pill { display: flex; align-items: center; gap: 10px; padding: 9px 10px; border-radius: 8px; cursor: pointer; border: 1px solid transparent; transition: all 0.15s; }
  .agent-pill:hover { background: var(--surface2); border-color: var(--border); }
  .agent-pill.thinking { background: rgba(239,159,39,0.1); border-color: var(--accent); }
  .agent-pill.done { background: rgba(29,158,117,0.1); border-color: var(--green); }
  .agent-emoji { font-size: 18px; width: 28px; text-align: center; }
  .agent-info { flex: 1; }
  .agent-name { font-size: 13px; font-weight: 500; color: var(--text); }
  .agent-status { font-size: 11px; color: var(--muted); margin-top: 1px; }
  .pulse { display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: var(--accent); animation: pulse 1s ease-in-out infinite; }
  @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.3; } }
  .main { display: flex; flex-direction: column; overflow: hidden; }
  .chat-area { flex: 1; overflow-y: auto; padding: 20px; display: flex; flex-direction: column; gap: 14px; }
  .msg { display: flex; gap: 10px; max-width: 820px; }
  .msg.user { flex-direction: row-reverse; align-self: flex-end; }
  .msg-bubble { padding: 10px 14px; border-radius: 12px; font-size: 14px; line-height: 1.55; max-width: 640px; white-space: pre-wrap; }
  .msg.user .msg-bubble { background: var(--accent); color: #1a0d00; border-radius: 12px 4px 12px 12px; }
  .msg.agent .msg-bubble { background: var(--surface2); color: var(--text); border: 1px solid var(--border); border-radius: 4px 12px 12px 12px; }
  .msg.system .msg-bubble { background: rgba(55,138,221,0.1); color: #85B7EB; border: 1px solid rgba(55,138,221,0.2); font-size: 12px; border-radius: 8px; align-self: center; }
  .msg-label { font-size: 11px; color: var(--muted); margin-bottom: 4px; }
  .msg.user .msg-label { text-align: right; }
  .input-row { padding: 16px 20px; border-top: 1px solid var(--border); display: flex; gap: 10px; background: var(--surface); }
  #msgInput { flex: 1; background: var(--surface2); border: 1px solid var(--border2); border-radius: 10px; padding: 10px 14px; font-size: 14px; color: var(--text); outline: none; resize: none; font-family: inherit; }
  #msgInput:focus { border-color: var(--accent); }
  #sendBtn { background: var(--accent); color: #1a0d00; border: none; border-radius: 10px; padding: 10px 20px; font-size: 14px; font-weight: 600; cursor: pointer; white-space: nowrap; }
  #sendBtn:hover { background: #FAC775; }
  #sendBtn:disabled { opacity: 0.4; cursor: default; }
  .log-panel { height: 180px; border-top: 1px solid var(--border); overflow-y: auto; background: #0a0a0b; padding: 10px 20px; }
  .log-row { font-size: 11px; font-family: 'SF Mono', 'Fira Code', monospace; color: var(--muted); padding: 2px 0; display: flex; gap: 10px; }
  .log-row .ts { color: #444; flex-shrink: 0; }
  .log-row .from { color: var(--accent); flex-shrink: 0; width: 80px; }
  .log-row .to { color: var(--purple); flex-shrink: 0; width: 80px; }
  .log-row .content { color: #aaa; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .quick-btns { display: flex; gap: 6px; flex-wrap: wrap; padding: 0 20px 10px; }
  .quick-btn { font-size: 12px; padding: 5px 12px; border-radius: 20px; border: 1px solid var(--border2); background: transparent; color: var(--muted); cursor: pointer; white-space: nowrap; }
  .quick-btn:hover { border-color: var(--accent); color: var(--accent); }
  .empty-chat { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; color: var(--muted); }
  .empty-chat .big { font-size: 32px; }
  .empty-chat p { font-size: 14px; }
</style>
</head>
<body>
<div class="layout">

  <div class="topbar">
    <div>
      <div class="topbar-logo">⚡ Agent Hub</div>
      <div class="topbar-sub">Superior Dairy Solutions LLC</div>
    </div>
    <div class="status-dot" id="statusDot" title="Connected"></div>
  </div>

  <div class="sidebar">
    <div class="sidebar-label">Agents</div>
    <div class="agent-pill" id="pill-manager">
      <div class="agent-emoji">👑</div>
      <div class="agent-info">
        <div class="agent-name">Manager</div>
        <div class="agent-status" id="status-manager">Ready</div>
      </div>
    </div>
    <div class="agent-pill" id="pill-finance">
      <div class="agent-emoji">💰</div>
      <div class="agent-info">
        <div class="agent-name">Finance</div>
        <div class="agent-status" id="status-finance">Ready</div>
      </div>
    </div>
    <div class="agent-pill" id="pill-sourcing">
      <div class="agent-emoji">📦</div>
      <div class="agent-info">
        <div class="agent-name">Sourcing</div>
        <div class="agent-status" id="status-sourcing">Ready</div>
      </div>
    </div>
    <div class="agent-pill" id="pill-timesheet">
      <div class="agent-emoji">🕐</div>
      <div class="agent-info">
        <div class="agent-name">Timesheet</div>
        <div class="agent-status" id="status-timesheet">Ready</div>
      </div>
    </div>

    <div class="sidebar-label" style="margin-top:12px;">Recent jobs</div>
    <div id="jobsList" style="font-size:12px; color:var(--muted); padding: 0 8px;">No jobs yet</div>
  </div>

  <div class="main">
    <div class="chat-area" id="chatArea">
      <div class="empty-chat" id="emptyChat">
        <div class="big">⚡</div>
        <p>Send a message to your agent team</p>
        <p style="font-size:12px;">The Manager routes your request to the right agents automatically</p>
      </div>
    </div>

    <div class="quick-btns">
      <button class="quick-btn" onclick="quickSend('Find me the best price on 2 inch stainless butterfly valves, need them fast')">📦 Source a part</button>
      <button class="quick-btn" onclick="quickSend('Generate invoice GAP11 for Oak Farms for last week\'s labor — 3 crew, 5 days')">💰 New invoice</button>
      <button class="quick-btn" onclick="quickSend('Show me crew hours for this week across all job sites')">🕐 Hours summary</button>
      <button class="quick-btn" onclick="quickSend('Give me a full status update: outstanding invoices, this week\'s hours, and any materials I need to order')">📊 Full status</button>
    </div>

    <div class="input-row">
      <textarea id="msgInput" rows="2" placeholder="Ask anything — the Manager will route it to the right agent…"></textarea>
      <button id="sendBtn" onclick="sendMessage()">Send</button>
    </div>

    <div class="log-panel" id="logPanel">
      <div class="log-row"><span class="ts">──</span><span style="color:#444;font-size:11px;">Agent communication log</span></div>
    </div>
  </div>

</div>

<script>
const socket = io();
let currentJobId = null;
const agentStates = {};

socket.on('connect', () => {
  document.getElementById('statusDot').style.background = 'var(--green)';
});
socket.on('disconnect', () => {
  document.getElementById('statusDot').style.background = 'var(--red)';
});

socket.on('init', (data) => {
  if (data.recentJobs) renderJobs(data.recentJobs);
});

socket.on('agent:thinking', ({ agent }) => {
  setAgentStatus(agent, 'thinking', '<span class="pulse"></span> Working…');
});
socket.on('agent:done', ({ agent }) => {
  setAgentStatus(agent, 'done', 'Done');
  setTimeout(() => setAgentStatus(agent, '', 'Ready'), 3000);
});
socket.on('manager:delegating', ({ tasks, summary }) => {
  setAgentStatus('manager', 'thinking', '<span class="pulse"></span> Delegating…');
  addSystemMsg(`Manager: ${summary || 'Delegating to ' + tasks.map(t => t.agent).join(', ')}`);
});
socket.on('job:response', ({ jobId, result }) => {
  if (jobId === currentJobId) {
    addAgentMsg(result);
    setAgentStatus('manager', '', 'Ready');
    enableInput();
  }
});
socket.on('job:error', ({ jobId, error }) => {
  if (jobId === currentJobId) {
    addSystemMsg('Error: ' + error);
    enableInput();
  }
});
socket.on('job:created', (job) => {
  refreshJobs();
});
socket.on('log', (entry) => {
  addLogRow(entry);
});

function setAgentStatus(agent, state, html) {
  const pill = document.getElementById('pill-' + agent);
  const status = document.getElementById('status-' + agent);
  if (!pill || !status) return;
  pill.className = 'agent-pill' + (state ? ' ' + state : '');
  status.innerHTML = html;
}

async function refreshJobs() {
  try {
    const r = await fetch('/api/jobs');
    const jobs = await r.json();
    renderJobs(jobs);
  } catch(e) {}
}

function renderJobs(jobs) {
  const el = document.getElementById('jobsList');
  if (!jobs.length) { el.textContent = 'No jobs yet'; return; }
  el.innerHTML = jobs.slice(0, 8).map(j => `
    <div style="padding:5px 0; border-bottom:1px solid var(--border); cursor:pointer;" onclick="loadJob('${j.id}')">
      <div style="color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${j.description.slice(0,36)}${j.description.length > 36 ? '…' : ''}</div>
      <div style="color:var(--muted);font-size:10px;">${j.status} · ${new Date(j.createdAt).toLocaleTimeString()}</div>
    </div>`).join('');
}

function addUserMsg(text) {
  hideEmpty();
  const area = document.getElementById('chatArea');
  area.innerHTML += `<div class="msg user"><div><div class="msg-label">You</div><div class="msg-bubble">${escHtml(text)}</div></div></div>`;
  scrollChat();
}

function addAgentMsg(text) {
  const area = document.getElementById('chatArea');
  area.innerHTML += `<div class="msg agent"><div><div class="msg-label">👑 Manager Agent</div><div class="msg-bubble">${escHtml(text)}</div></div></div>`;
  scrollChat();
}

function addSystemMsg(text) {
  const area = document.getElementById('chatArea');
  area.innerHTML += `<div class="msg system"><div class="msg-bubble">${escHtml(text)}</div></div>`;
  scrollChat();
}

function addLogRow(entry) {
  const panel = document.getElementById('logPanel');
  const ts = new Date(entry.timestamp).toLocaleTimeString();
  const content = typeof entry.content === 'string' ? entry.content.slice(0, 120) : JSON.stringify(entry.content).slice(0, 120);
  panel.innerHTML += `<div class="log-row"><span class="ts">${ts}</span><span class="from">${entry.from}</span><span class="to">→ ${entry.to}</span><span class="content">${escHtml(content)}</span></div>`;
  panel.scrollTop = panel.scrollHeight;
}

function hideEmpty() {
  const e = document.getElementById('emptyChat');
  if (e) e.style.display = 'none';
}

function scrollChat() {
  const area = document.getElementById('chatArea');
  area.scrollTop = area.scrollHeight;
}

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function disableInput() {
  document.getElementById('sendBtn').disabled = true;
  document.getElementById('msgInput').disabled = true;
}

function enableInput() {
  document.getElementById('sendBtn').disabled = false;
  document.getElementById('msgInput').disabled = false;
}

async function sendMessage() {
  const input = document.getElementById('msgInput');
  const msg = input.value.trim();
  if (!msg) return;
  input.value = '';
  addUserMsg(msg);
  disableInput();
  setAgentStatus('manager', 'thinking', '<span class="pulse"></span> Thinking…');

  try {
    const r = await fetch('/api/message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: msg }),
    });
    const data = await r.json();
    currentJobId = data.jobId;
    addSystemMsg(`Job ${data.jobId} started`);
  } catch(e) {
    addSystemMsg('Failed to send. Is the hub running?');
    enableInput();
  }
}

function quickSend(msg) {
  document.getElementById('msgInput').value = msg;
  sendMessage();
}

function loadJob(jobId) {
  currentJobId = jobId;
}

document.getElementById('msgInput').addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
});
</script>
</body>
</html>
ttps://github.com/user-attachments/files/28805841/hub.js)
