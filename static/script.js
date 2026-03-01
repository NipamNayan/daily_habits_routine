// ===== State =====
let currentDate = new Date();
let weekOffset = 0;
let viewYear = new Date().getFullYear();
let viewMonth = new Date().getMonth() + 1;

const API = '';

// ===== Helpers =====
function fmt(d) {
  const yy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}
function niceDate(d) {
  return d.toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

// ===== Tab switching =====
document.querySelectorAll('.tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(`view-${btn.dataset.view}`).classList.add('active');

    if (btn.dataset.view === 'today') loadToday();
    else if (btn.dataset.view === 'week') loadWeek();
    else if (btn.dataset.view === 'month') loadMonth();
  });
});

// ===================================================================
//  TODAY VIEW
// ===================================================================
async function loadToday() {
  const dateStr = fmt(currentDate);
  document.getElementById('today-date-label').textContent = niceDate(currentDate);

  const res = await fetch(`${API}/api/today?for_date=${dateStr}`);
  const tasks = await res.json();

  const list = document.getElementById('task-list');
  list.innerHTML = '';

  let doneCount = 0;
  tasks.forEach((t, idx) => {
    if (t.done) doneCount++;
    const li = document.createElement('li');
    li.className = `task-item${t.done ? ' done' : ''}`;
    li.innerHTML = `
      <span class="task-index">${idx + 1}</span>
      <span class="checkbox">${t.done ? '\u2713' : ''}</span>
      <span class="task-name">${t.task_name}</span>
    `;
    li.addEventListener('click', () => toggleTask(t.task_id, dateStr));
    list.appendChild(li);
  });

  const pct = tasks.length ? Math.round((doneCount / tasks.length) * 100) : 0;
  document.getElementById('today-progress').style.width = pct + '%';
  document.getElementById('today-progress-text').textContent = `${doneCount}/${tasks.length} done (${pct}%)`;
}

async function toggleTask(taskId, dateStr) {
  await fetch(`${API}/api/toggle`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ task_id: taskId, date: dateStr }),
  });
  loadToday();
}

document.getElementById('today-prev').addEventListener('click', () => {
  currentDate.setDate(currentDate.getDate() - 1);
  loadToday();
});
document.getElementById('today-next').addEventListener('click', () => {
  currentDate.setDate(currentDate.getDate() + 1);
  loadToday();
});

// ===================================================================
//  WEEK VIEW
// ===================================================================
async function loadWeek() {
  const res = await fetch(`${API}/api/week?week_offset=${weekOffset}`);
  const data = await res.json();

  const today = fmt(new Date());

  document.getElementById('week-label').textContent =
    `Week: ${formatShort(data.week_start)} \u2013 ${formatShort(data.week_end)}`;

  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  const thead = document.getElementById('week-thead');
  thead.innerHTML = '<th>Task</th>';
  days.forEach(d => {
    const dateStr = data.date_headers[d];
    const isToday = dateStr === today;
    thead.innerHTML += `<th${isToday ? ' style="color:var(--accent)"' : ''}>${d}<br><span style="font-size:.7rem;font-weight:400">${dateStr.slice(5)}</span></th>`;
  });
  thead.innerHTML += '<th>Score</th>';

  const tbody = document.getElementById('week-tbody');
  tbody.innerHTML = '';
  data.rows.forEach(row => {
    let tr = `<td>${row.task_name}</td>`;
    days.forEach(d => {
      const dateStr = data.date_headers[d];
      const isFuture = dateStr > today;
      if (isFuture) {
        tr += `<td class="cell-future">\u2013</td>`;
      } else {
        tr += row.days[d]
          ? `<td class="cell-done">\u2713</td>`
          : `<td class="cell-miss">\u2717</td>`;
      }
    });
    const weekPct = Math.round((row.done_count / 7) * 100);
    tr += `<td class="stat-cell">${row.done_count}/7<br><span style="font-size:.75rem;font-weight:400;color:var(--text-dim)">${weekPct}%</span></td>`;
    tbody.innerHTML += `<tr>${tr}</tr>`;
  });
}

function formatShort(iso) {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

document.getElementById('week-prev').addEventListener('click', () => { weekOffset--; loadWeek(); });
document.getElementById('week-next').addEventListener('click', () => { weekOffset++; loadWeek(); });

// ===================================================================
//  MONTH VIEW
// ===================================================================
async function loadMonth() {
  const res = await fetch(`${API}/api/month?year=${viewYear}&month=${viewMonth}`);
  const data = await res.json();

  const today = fmt(new Date());

  document.getElementById('month-label').textContent = `${data.month_name} ${data.year}`;

  const thead = document.getElementById('month-thead');
  thead.innerHTML = '<th>Task</th>';
  for (let d = 1; d <= data.num_days; d++) {
    const dateStr = `${data.year}-${String(data.month).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const isToday = dateStr === today;
    thead.innerHTML += `<th${isToday ? ' style="color:var(--accent)"' : ''}>${d}</th>`;
  }
  thead.innerHTML += '<th>Score</th>';

  const tbody = document.getElementById('month-tbody');
  tbody.innerHTML = '';
  data.rows.forEach(row => {
    let tr = `<td>${row.task_name}</td>`;
    for (let d = 1; d <= data.num_days; d++) {
      const dateStr = `${data.year}-${String(data.month).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      const isFuture = dateStr > today;
      if (isFuture) {
        tr += `<td class="cell-future">\u2013</td>`;
      } else {
        tr += row.days[d]
          ? `<td class="cell-done">\u2713</td>`
          : `<td class="cell-miss">\u2717</td>`;
      }
    }
    const monthPct = data.num_days ? Math.round((row.done_count / data.num_days) * 100) : 0;
    tr += `<td class="stat-cell">${row.done_count}/${data.num_days}<br><span style="font-size:.75rem;font-weight:400;color:var(--text-dim)">${monthPct}%</span></td>`;
    tbody.innerHTML += `<tr>${tr}</tr>`;
  });
}

document.getElementById('month-prev').addEventListener('click', () => {
  viewMonth--;
  if (viewMonth < 1) { viewMonth = 12; viewYear--; }
  loadMonth();
});
document.getElementById('month-next').addEventListener('click', () => {
  viewMonth++;
  if (viewMonth > 12) { viewMonth = 1; viewYear++; }
  loadMonth();
});

// ===================================================================
//  MANAGE / EDIT TASKS
// ===================================================================
let editOpen = false;

document.getElementById('manage-btn').addEventListener('click', () => {
  editOpen = !editOpen;
  const panel = document.getElementById('edit-panel');
  panel.classList.toggle('hidden', !editOpen);
  if (editOpen) loadEditList();
});

document.getElementById('edit-panel-close').addEventListener('click', () => {
  editOpen = false;
  document.getElementById('edit-panel').classList.add('hidden');
});

async function loadEditList() {
  const res = await fetch(`${API}/api/tasks`);
  const tasks = await res.json();
  const ul = document.getElementById('edit-task-list');
  ul.innerHTML = '';
  tasks.forEach(t => {
    const li = document.createElement('li');
    li.className = 'edit-task-item';
    li.innerHTML = `
      <span class="edit-task-name">${t.name}</span>
      <button class="rename-btn" title="Rename">&#9998;</button>
      <button class="delete-btn" title="Delete">&times;</button>
    `;
    li.querySelector('.rename-btn').addEventListener('click', () => startRename(li, t));
    li.querySelector('.delete-btn').addEventListener('click', () => deleteTask(t.id));
    ul.appendChild(li);
  });
}

function startRename(li, task) {
  const nameSpan = li.querySelector('.edit-task-name');
  const renameBtn = li.querySelector('.rename-btn');
  const oldName = task.name;

  // Replace span with input
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'rename-input';
  input.value = oldName;
  nameSpan.replaceWith(input);
  input.focus();
  input.select();

  renameBtn.innerHTML = '&#10003;';
  renameBtn.title = 'Save';

  const save = async () => {
    const newName = input.value.trim();
    if (newName && newName !== oldName) {
      await fetch(`${API}/api/tasks/${task.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName }),
      });
    }
    loadEditList();
    loadToday();
  };

  renameBtn.onclick = save;
  input.addEventListener('keydown', e => { if (e.key === 'Enter') save(); });
}

async function deleteTask(taskId) {
  if (!confirm('Delete this task and all its history?')) return;
  await fetch(`${API}/api/tasks/${taskId}`, { method: 'DELETE' });
  loadEditList();
  loadToday();
}

document.getElementById('add-task-btn').addEventListener('click', addNewTask);
document.getElementById('new-task-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') addNewTask();
});

async function addNewTask() {
  const input = document.getElementById('new-task-input');
  const name = input.value.trim();
  if (!name) return;
  await fetch(`${API}/api/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  input.value = '';
  loadEditList();
  loadToday();
}

// ===== Init =====
loadToday();
