// ===== State =====
let currentDate = new Date();
let weekOffset = 0;
let viewYear = new Date().getFullYear();
let viewMonth = new Date().getMonth() + 1;
let lightMode = false;
let goalsCache = [];

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
    else if (btn.dataset.view === 'goals') loadGoalsView();
    else if (btn.dataset.view === 'week') loadWeek();
    else if (btn.dataset.view === 'month') loadMonth();
  });
});

// ===================================================================
//  DAY CONTEXT BANNER
// ===================================================================
const DAY_CONTEXTS = {
  0: { label: 'Rest Day', emoji: '🌿', sub: 'Sunday is fully protected — rest without guilt', color: '#27ae60', type: 'rest' },
  1: { label: 'APSC Focus Day', emoji: '📚', sub: 'Mon · Deep APSC study — Syllabus, notes, revision', color: '#e67e22', type: 'apsc' },
  2: { label: 'Tech Prep Day', emoji: '💻', sub: 'Tue · DDIA + Design Patterns + DSA', color: '#3498db', type: 'job' },
  3: { label: 'APSC Focus Day', emoji: '📚', sub: 'Wed · Deep APSC study — Syllabus, notes, revision', color: '#e67e22', type: 'apsc' },
  4: { label: 'Tech Prep Day', emoji: '💻', sub: 'Thu · DDIA + Design Patterns + DSA', color: '#3498db', type: 'job' },
  5: { label: 'APSC Focus Day', emoji: '📚', sub: 'Fri · Deep APSC study — Syllabus, notes, revision', color: '#e67e22', type: 'apsc' },
  6: { label: 'Tech Prep + Project Day', emoji: '🚀', sub: 'Sat · PySpark / LangChain / RAG build + weekly review', color: '#9b59b6', type: 'review' },
};

function renderDayBanner(date) {
  const ctx = DAY_CONTEXTS[date.getDay()];
  const banner = document.getElementById('day-banner');
  banner.style.setProperty('--banner-color', ctx.color);
  banner.className = `day-banner day-banner--${ctx.type}`;
  banner.innerHTML = `
    <span class="banner-emoji">${ctx.emoji}</span>
    <div class="banner-text">
      <strong>${ctx.label}</strong>
      <span>${ctx.sub}</span>
    </div>
  `;
}

// ===================================================================
//  TODAY VIEW
// ===================================================================
async function loadToday() {
  const dateStr = fmt(currentDate);
  document.getElementById('today-date-label').textContent = niceDate(currentDate);
  renderDayBanner(currentDate);

  const res = await fetch(`${API}/api/today?for_date=${dateStr}`);
  const tasks = await res.json();

  const list = document.getElementById('task-list');
  list.innerHTML = '';

  let doneCount = 0;
  tasks.forEach((t, idx) => {
    if (t.done) doneCount++;
    if (lightMode && t.optional) return;

    const li = document.createElement('li');
    li.className = `task-item${t.done ? ' done' : ''}${t.optional ? ' optional' : ''}`;
    const catDot = getCategoryDot(t.category, t.goal_color);
    li.innerHTML = `
      <span class="task-index">${idx + 1}</span>
      ${catDot}
      <span class="checkbox">${t.done ? '✓' : ''}</span>
      <span class="task-name">${t.task_name}</span>
      ${t.optional ? '<span class="optional-tag">optional</span>' : ''}
    `;
    li.addEventListener('click', () => toggleTask(t.task_id, dateStr));
    list.appendChild(li);
  });

  const pct = tasks.length ? Math.round((doneCount / tasks.length) * 100) : 0;
  document.getElementById('today-progress').style.width = pct + '%';

  let progressMsg = `${doneCount}/${tasks.length} done`;
  if (pct === 100) progressMsg += ' 🎉 All done!';
  else if (pct >= 75) progressMsg += ' — almost there!';
  else if (pct >= 50) progressMsg += ' — solid progress!';
  else if (pct === 0) progressMsg += ' — great, just getting started!';
  document.getElementById('today-progress-text').textContent = progressMsg;

  loadMiscTasks(dateStr);
}

function getCategoryDot(category, goalColor) {
  const colors = { apsc: '#e67e22', job: '#3498db', personal: '#2ecc71', general: '#8b8fa3' };
  const color = goalColor || colors[category] || colors.general;
  return `<span class="cat-dot" style="background:${color}" title="${category}"></span>`;
}

function getCatColor(category) {
  return { apsc: '#e67e22', job: '#3498db', personal: '#2ecc71', general: '#8b8fa3' }[category] || '#8b8fa3';
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
  currentDate = new Date(currentDate);
  currentDate.setDate(currentDate.getDate() - 1);
  loadToday();
});
document.getElementById('today-next').addEventListener('click', () => {
  currentDate = new Date(currentDate);
  currentDate.setDate(currentDate.getDate() + 1);
  loadToday();
});

document.getElementById('light-mode-cb').addEventListener('change', e => {
  lightMode = e.target.checked;
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
    `Week: ${formatShort(data.week_start)} – ${formatShort(data.week_end)}`;

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
      if (row.days[d] === 'rest') {
        tr += `<td class="cell-rest">🌿</td>`;
      } else if (isFuture) {
        tr += `<td class="cell-future">–</td>`;
      } else {
        tr += row.days[d] ? `<td class="cell-done">✓</td>` : `<td class="cell-miss">✗</td>`;
      }
    });
    const weekPct = Math.round((row.done_count / 6) * 100);
    tr += `<td class="stat-cell">${row.done_count}/6<br><span style="font-size:.75rem;font-weight:400;color:var(--text-dim)">${weekPct}%</span></td>`;
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
      const dateStr = `${data.year}-${String(data.month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const isFuture = dateStr > today;
      if (row.days[d] === 'rest') {
        tr += `<td class="cell-rest">🌿</td>`;
      } else if (isFuture) {
        tr += `<td class="cell-future">–</td>`;
      } else {
        tr += row.days[d] ? `<td class="cell-done">✓</td>` : `<td class="cell-miss">✗</td>`;
      }
    }
    const activeDays = data.active_days;
    const monthPct = activeDays ? Math.round((row.done_count / activeDays) * 100) : 0;
    tr += `<td class="stat-cell">${row.done_count}/${activeDays}<br><span style="font-size:.75rem;font-weight:400;color:var(--text-dim)">${monthPct}%</span></td>`;
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
  const [tasksRes, goalsRes] = await Promise.all([
    fetch(`${API}/api/tasks`),
    fetch(`${API}/api/goals`),
  ]);
  const tasks = await tasksRes.json();
  const goals = await goalsRes.json();
  const ul = document.getElementById('edit-task-list');
  ul.innerHTML = '';
  tasks.forEach(t => {
    const li = document.createElement('li');
    li.className = 'edit-task-item';
    const goalOptions = goals.map(g =>
      `<option value="${g.id}" ${t.goal_id === g.id ? 'selected' : ''}>${g.emoji} ${g.name}</option>`
    ).join('');
    li.innerHTML = `
      <span class="cat-dot" style="background:${getCatColor(t.category)}"></span>
      <span class="edit-task-name">${t.name}</span>
      <select class="cat-select task-cat-select" data-id="${t.id}">
        <option value="general" ${t.category === 'general' ? 'selected' : ''}>General</option>
        <option value="apsc" ${t.category === 'apsc' ? 'selected' : ''}>📚 APSC</option>
        <option value="job" ${t.category === 'job' ? 'selected' : ''}>💼 Job</option>
        <option value="personal" ${t.category === 'personal' ? 'selected' : ''}>💪 Personal</option>
      </select>
      <select class="cat-select task-goal-select" data-id="${t.id}">
        <option value="0" ${!t.goal_id ? 'selected' : ''}>⚪ General</option>
        ${goalOptions}
      </select>
      <button class="optional-btn${t.optional ? ' optional-on' : ''}" data-id="${t.id}" title="Mark optional">⚡</button>
      <button class="rename-btn" title="Rename">✎</button>
      <button class="delete-btn" title="Delete">&times;</button>
    `;
    li.querySelector('.rename-btn').addEventListener('click', () => startRename(li, t));
    li.querySelector('.delete-btn').addEventListener('click', () => deleteTask(t.id));
    li.querySelector('.task-cat-select').addEventListener('change', async e => {
      await fetch(`${API}/api/tasks/${t.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: e.target.value }),
      });
      loadToday();
    });
    li.querySelector('.task-goal-select').addEventListener('change', async e => {
      const gid = parseInt(e.target.value) || null;
      await fetch(`${API}/api/tasks/${t.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goal_id: gid }),
      });
      loadToday();
    });
    li.querySelector('.optional-btn').addEventListener('click', async () => {
      await fetch(`${API}/api/tasks/${t.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ optional: !t.optional }),
      });
      loadEditList(); loadToday();
    });
    ul.appendChild(li);
  });
}

function startRename(li, task) {
  const nameSpan = li.querySelector('.edit-task-name');
  const renameBtn = li.querySelector('.rename-btn');
  const oldName = task.name;
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'rename-input';
  input.value = oldName;
  nameSpan.replaceWith(input);
  input.focus();
  input.select();
  renameBtn.textContent = '✓';
  renameBtn.title = 'Save';
  const save = async () => {
    const newName = input.value.trim();
    if (newName && newName !== oldName) {
      await fetch(`${API}/api/tasks/${task.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName }),
      });
    }
    loadEditList(); loadToday();
  };
  renameBtn.onclick = save;
  input.addEventListener('keydown', e => { if (e.key === 'Enter') save(); });
}

async function deleteTask(taskId) {
  if (!confirm('Delete this task and all its history?')) return;
  await fetch(`${API}/api/tasks/${taskId}`, { method: 'DELETE' });
  loadEditList(); loadToday();
}

document.getElementById('add-task-btn').addEventListener('click', addNewTask);
document.getElementById('new-task-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') addNewTask();
});

async function addNewTask() {
  const input = document.getElementById('new-task-input');
  const catSelect = document.getElementById('new-task-category');
  const name = input.value.trim();
  if (!name) return;
  await fetch(`${API}/api/tasks`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, category: catSelect.value }),
  });
  input.value = '';
  loadEditList(); loadToday();
}

// ===== Init =====
loadToday();

// ===================================================================
//  MISC TASKS
// ===================================================================
async function loadMiscTasks(dateStr) {
  const res = await fetch(`${API}/api/misc?date=${dateStr}`);
  const tasks = await res.json();
  const ul = document.getElementById('misc-task-list');
  ul.innerHTML = '';
  tasks.forEach(t => {
    const li = document.createElement('li');
    li.className = `misc-task-item${t.done ? ' done' : ''}`;
    li.innerHTML = `
      <span class="checkbox">${t.done ? '✓' : ''}</span>
      <span class="misc-task-title">${t.title}</span>
      <button class="delete-btn misc-delete-btn" title="Delete">&times;</button>
    `;
    li.querySelector('.checkbox').addEventListener('click', () => toggleMiscTask(t.id, dateStr));
    li.querySelector('.misc-task-title').addEventListener('click', () => toggleMiscTask(t.id, dateStr));
    li.querySelector('.misc-delete-btn').addEventListener('click', e => {
      e.stopPropagation();
      deleteMiscTask(t.id, dateStr);
    });
    ul.appendChild(li);
  });
}

async function toggleMiscTask(id, dateStr) {
  await fetch(`${API}/api/misc/toggle`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id }),
  });
  loadMiscTasks(dateStr);
}

async function deleteMiscTask(id, dateStr) {
  await fetch(`${API}/api/misc/${id}`, { method: 'DELETE' });
  loadMiscTasks(dateStr);
}

document.getElementById('misc-add-btn').addEventListener('click', addMiscTask);
document.getElementById('misc-task-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') addMiscTask();
});

async function addMiscTask() {
  const input = document.getElementById('misc-task-input');
  const title = input.value.trim();
  if (!title) return;
  const dateStr = fmt(currentDate);
  await fetch(`${API}/api/misc`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, date: dateStr }),
  });
  input.value = '';
  loadMiscTasks(dateStr);
}

// ===================================================================
//  GOALS VIEW
// ===================================================================
let editingGoalId = null;

async function loadGoalsView() {
  const res = await fetch(`${API}/api/goals`);
  goalsCache = await res.json();
  renderGoalsList();
}

async function renderGoalsList() {
  const container = document.getElementById('goals-list');
  container.innerHTML = '';

  if (goalsCache.length === 0) {
    container.innerHTML = `<p class="empty-goals">No goals yet — click "+ Add Goal" to create one!</p>`;
    return;
  }

  for (const goal of goalsCache) {
    let stats = { week_pct: 0, streak: 0, task_count: 0 };
    try {
      const sRes = await fetch(`${API}/api/goals/${goal.id}/stats`);
      stats = await sRes.json();
    } catch (_) {}

    const card = document.createElement('div');
    card.className = 'goal-card';
    card.style.setProperty('--goal-color', goal.color);

    const streakTxt = stats.streak > 0 ? `🔥 ${stats.streak}-day streak` : 'No streak yet';
    const pctClass = stats.week_pct >= 75 ? 'pct-high' : stats.week_pct >= 40 ? 'pct-mid' : 'pct-low';

    card.innerHTML = `
      <div class="goal-card-header">
        <span class="goal-emoji">${goal.emoji}</span>
        <div class="goal-card-title">
          <h3>${goal.name}</h3>
          <p class="goal-desc">${goal.description}</p>
        </div>
        <div class="goal-card-actions">
          <button class="icon-btn edit-goal-btn" title="Edit">✎</button>
          <button class="icon-btn delete-goal-btn" title="Delete">×</button>
        </div>
      </div>
      <div class="goal-stats">
        <div class="goal-stat-bar-wrap">
          <div class="goal-stat-bar">
            <div class="goal-stat-fill ${pctClass}" style="width:${stats.week_pct}%"></div>
          </div>
          <span class="goal-stat-label">${stats.week_pct}% last 7 days</span>
        </div>
        <span class="goal-streak">${streakTxt}</span>
      </div>
      <p class="goal-task-count">${stats.task_count} task${stats.task_count !== 1 ? 's' : ''} linked</p>
    `;

    card.querySelector('.edit-goal-btn').addEventListener('click', () => openGoalForm(goal));
    card.querySelector('.delete-goal-btn').addEventListener('click', () => deleteGoal(goal.id, goal.name));
    container.appendChild(card);
  }
}

function openGoalForm(goal = null) {
  editingGoalId = goal ? goal.id : null;
  document.getElementById('goal-form-id').value = goal ? goal.id : '';
  document.getElementById('goal-form-emoji').value = goal ? goal.emoji : '🎯';
  document.getElementById('goal-form-name').value = goal ? goal.name : '';
  document.getElementById('goal-form-color').value = goal ? goal.color : '#6c63ff';
  document.getElementById('goal-form-desc').value = goal ? goal.description : '';
  document.getElementById('goal-form').classList.remove('hidden');
  document.getElementById('goal-form-name').focus();
}

function closeGoalForm() {
  editingGoalId = null;
  document.getElementById('goal-form').classList.add('hidden');
}

document.getElementById('add-goal-btn').addEventListener('click', () => openGoalForm());
document.getElementById('goal-form-cancel').addEventListener('click', closeGoalForm);

document.getElementById('goal-form-save').addEventListener('click', async () => {
  const name = document.getElementById('goal-form-name').value.trim();
  if (!name) { document.getElementById('goal-form-name').focus(); return; }
  const payload = {
    name,
    emoji: document.getElementById('goal-form-emoji').value.trim() || '🎯',
    color: document.getElementById('goal-form-color').value,
    description: document.getElementById('goal-form-desc').value.trim(),
  };
  if (editingGoalId) {
    await fetch(`${API}/api/goals/${editingGoalId}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } else {
    await fetch(`${API}/api/goals`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  }
  closeGoalForm();
  loadGoalsView();
});

async function deleteGoal(goalId, goalName) {
  if (!confirm(`Delete goal "${goalName}"? Tasks will be unlinked but not deleted.`)) return;
  await fetch(`${API}/api/goals/${goalId}`, { method: 'DELETE' });
  loadGoalsView();
}

