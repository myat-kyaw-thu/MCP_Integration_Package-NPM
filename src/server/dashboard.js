/**
 * Returns the inspector dashboard HTML.
 * Self-contained: inline CSS + JS, no external deps.
 */
export function getDashboardHTML(serverName, tools) {
  const toolListJSON = JSON.stringify(tools.map(t => ({
    name: t.name,
    description: t.description,
    inputSchema: t.inputSchema,
  })));

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${serverName} — MCP Inspector</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --bg: #0f1117; --surface: #1a1d27; --border: #2a2d3a;
    --text: #e1e4ed; --text-dim: #8b8fa3; --accent: #6c63ff;
    --green: #34d399; --red: #f87171; --yellow: #fbbf24;
    --font: 'SF Mono', 'Cascadia Code', 'Fira Code', 'Consolas', monospace;
  }
  body { font-family: var(--font); background: var(--bg); color: var(--text); font-size: 13px; height: 100vh; display: flex; flex-direction: column; }
  header { padding: 12px 20px; border-bottom: 1px solid var(--border); display: flex; align-items: center; gap: 12px; background: var(--surface); }
  header h1 { font-size: 14px; font-weight: 600; }
  header .dot { width: 8px; height: 8px; border-radius: 50%; background: var(--green); animation: pulse 2s infinite; }
  @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: .4; } }
  header .meta { margin-left: auto; color: var(--text-dim); font-size: 11px; }

  .container { display: flex; flex: 1; overflow: hidden; }

  /* Sidebar */
  .sidebar { width: 280px; border-right: 1px solid var(--border); display: flex; flex-direction: column; background: var(--surface); }
  .sidebar h2 { padding: 12px 16px 8px; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: var(--text-dim); }
  .tool-list { flex: 1; overflow-y: auto; }
  .tool-item { padding: 10px 16px; border-bottom: 1px solid var(--border); cursor: pointer; transition: background .15s; }
  .tool-item:hover { background: rgba(108,99,255,.1); }
  .tool-item .name { font-weight: 600; font-size: 13px; }
  .tool-item .desc { color: var(--text-dim); font-size: 11px; margin-top: 2px; }

  /* Main panel */
  .main { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
  .tabs { display: flex; border-bottom: 1px solid var(--border); background: var(--surface); }
  .tab { padding: 10px 20px; cursor: pointer; font-size: 12px; color: var(--text-dim); border-bottom: 2px solid transparent; transition: all .15s; }
  .tab.active { color: var(--accent); border-bottom-color: var(--accent); }

  /* Logs panel */
  .logs { flex: 1; overflow-y: auto; padding: 0; }
  .log-entry { display: flex; align-items: center; gap: 12px; padding: 8px 16px; border-bottom: 1px solid var(--border); font-size: 12px; cursor: pointer; transition: background .1s; }
  .log-entry:hover { background: rgba(108,99,255,.05); }
  .log-entry.selected { background: rgba(108,99,255,.1); }
  .log-time { color: var(--text-dim); white-space: nowrap; }
  .log-method { background: var(--accent); color: #fff; padding: 2px 8px; border-radius: 3px; font-size: 10px; font-weight: 600; }
  .log-tool { font-weight: 600; }
  .log-duration { color: var(--text-dim); margin-left: auto; white-space: nowrap; }
  .log-status { width: 8px; height: 8px; border-radius: 50%; }
  .log-status.ok { background: var(--green); }
  .log-status.err { background: var(--red); }
  .empty-state { display: flex; align-items: center; justify-content: center; flex: 1; color: var(--text-dim); font-size: 14px; }

  /* Detail panel */
  .detail { border-top: 1px solid var(--border); max-height: 40%; overflow-y: auto; padding: 16px; background: var(--surface); display: none; }
  .detail.visible { display: block; }
  .detail h3 { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: var(--text-dim); margin-bottom: 8px; }
  .detail pre { background: var(--bg); padding: 12px; border-radius: 6px; overflow-x: auto; font-size: 12px; margin-bottom: 16px; white-space: pre-wrap; word-break: break-all; }

  /* Test panel */
  .test-panel { flex: 1; padding: 20px; overflow-y: auto; display: none; }
  .test-panel.visible { display: block; }
  .test-panel label { display: block; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: var(--text-dim); margin-bottom: 6px; }
  .test-panel select, .test-panel textarea { width: 100%; background: var(--bg); border: 1px solid var(--border); color: var(--text); font-family: var(--font); font-size: 13px; padding: 10px; border-radius: 6px; margin-bottom: 16px; outline: none; }
  .test-panel select:focus, .test-panel textarea:focus { border-color: var(--accent); }
  .test-panel textarea { min-height: 100px; resize: vertical; }
  .test-btn { background: var(--accent); color: #fff; border: none; padding: 10px 24px; border-radius: 6px; font-family: var(--font); font-size: 13px; font-weight: 600; cursor: pointer; transition: opacity .15s; }
  .test-btn:hover { opacity: .85; }
  .test-btn:disabled { opacity: .5; cursor: not-allowed; }
  .test-result { margin-top: 16px; }
  .test-result pre { background: var(--bg); padding: 12px; border-radius: 6px; font-size: 12px; white-space: pre-wrap; word-break: break-all; }
  .counter { background: var(--border); color: var(--text-dim); padding: 2px 8px; border-radius: 10px; font-size: 10px; margin-left: 6px; }
</style>
</head>
<body>
<header>
  <div class="dot"></div>
  <h1>${serverName}</h1>
  <span class="meta">MCP Inspector</span>
</header>
<div class="container">
  <div class="sidebar">
    <h2>Tools</h2>
    <div class="tool-list" id="toolList"></div>
  </div>
  <div class="main">
    <div class="tabs">
      <div class="tab active" data-tab="logs">Logs <span class="counter" id="logCount">0</span></div>
      <div class="tab" data-tab="test">Test Tool</div>
    </div>
    <div class="logs" id="logsPanel">
      <div class="empty-state" id="emptyState">Waiting for requests…</div>
    </div>
    <div class="detail" id="detailPanel"></div>
    <div class="test-panel" id="testPanel">
      <label for="toolSelect">Tool</label>
      <select id="toolSelect"></select>
      <label for="argsInput">Arguments (JSON)</label>
      <textarea id="argsInput">{}</textarea>
      <button class="test-btn" id="testBtn" onclick="runTest()">Execute</button>
      <div class="test-result" id="testResult"></div>
    </div>
  </div>
</div>
<script>
const TOOLS = ${toolListJSON};
let logs = [];
let selectedLogIndex = -1;

// Render tool sidebar
const toolList = document.getElementById('toolList');
TOOLS.forEach(t => {
  const el = document.createElement('div');
  el.className = 'tool-item';
  el.innerHTML = '<div class="name">' + esc(t.name) + '</div><div class="desc">' + esc(t.description || '') + '</div>';
  el.onclick = () => { document.getElementById('toolSelect').value = t.name; switchTab('test'); };
  toolList.appendChild(el);
});

// Render tool select
const sel = document.getElementById('toolSelect');
TOOLS.forEach(t => { const o = document.createElement('option'); o.value = t.name; o.textContent = t.name; sel.appendChild(o); });
sel.onchange = () => {
  const tool = TOOLS.find(t => t.name === sel.value);
  if (tool && tool.inputSchema && tool.inputSchema.properties) {
    const example = {};
    for (const [k, v] of Object.entries(tool.inputSchema.properties)) { example[k] = v.type === 'number' ? 0 : ''; }
    document.getElementById('argsInput').value = JSON.stringify(example, null, 2);
  }
};
if (TOOLS.length) sel.dispatchEvent(new Event('change'));

// Tabs
document.querySelectorAll('.tab').forEach(tab => tab.onclick = () => switchTab(tab.dataset.tab));
function switchTab(name) {
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === name));
  document.getElementById('logsPanel').style.display = name === 'logs' ? '' : 'none';
  document.getElementById('detailPanel').style.display = name === 'logs' && selectedLogIndex >= 0 ? 'block' : 'none';
  document.getElementById('testPanel').style.display = name === 'test' ? 'block' : 'none';
}

// SSE log stream
const evtSrc = new EventSource('/api/events');
evtSrc.onmessage = (e) => {
  const entry = JSON.parse(e.data);
  logs.push(entry);
  document.getElementById('logCount').textContent = logs.length;
  document.getElementById('emptyState')?.remove();
  appendLogRow(entry, logs.length - 1);
};

function appendLogRow(entry, index) {
  const panel = document.getElementById('logsPanel');
  const row = document.createElement('div');
  row.className = 'log-entry';
  const time = new Date(entry.timestamp).toLocaleTimeString();
  row.innerHTML =
    '<span class="log-time">' + time + '</span>' +
    '<span class="log-method">CALL</span>' +
    '<span class="log-tool">' + esc(entry.tool) + '</span>' +
    '<span class="log-duration">' + entry.duration + 'ms</span>' +
    '<div class="log-status ' + (entry.error ? 'err' : 'ok') + '"></div>';
  row.onclick = () => showDetail(index, row);
  panel.appendChild(row);
  panel.scrollTop = panel.scrollHeight;
}

function showDetail(index, rowEl) {
  selectedLogIndex = index;
  const entry = logs[index];
  document.querySelectorAll('.log-entry').forEach(r => r.classList.remove('selected'));
  if (rowEl) rowEl.classList.add('selected');
  const detail = document.getElementById('detailPanel');
  detail.className = 'detail visible';
  detail.innerHTML =
    '<h3>Request</h3><pre>' + esc(JSON.stringify(entry.args, null, 2)) + '</pre>' +
    '<h3>' + (entry.error ? 'Error' : 'Response') + '</h3><pre>' + esc(entry.error || entry.response || 'null') + '</pre>';
}

// Test tool execution
async function runTest() {
  const btn = document.getElementById('testBtn');
  const resultDiv = document.getElementById('testResult');
  const tool = document.getElementById('toolSelect').value;
  let args;
  try { args = JSON.parse(document.getElementById('argsInput').value); } catch { resultDiv.innerHTML = '<pre style="color:var(--red)">Invalid JSON</pre>'; return; }
  btn.disabled = true; btn.textContent = 'Running…';
  try {
    const res = await fetch('/api/test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tool, args }) });
    const data = await res.json();
    resultDiv.innerHTML = '<pre>' + esc(JSON.stringify(data, null, 2)) + '</pre>';
  } catch (err) {
    resultDiv.innerHTML = '<pre style="color:var(--red)">' + esc(err.message) + '</pre>';
  }
  btn.disabled = false; btn.textContent = 'Execute';
}

function esc(s) { const d = document.createElement('div'); d.textContent = String(s ?? ''); return d.innerHTML; }
</script>
</body>
</html>`;
}
