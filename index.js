
// ─── STATE ────────────────────────────────────────────────────────
let allItems = [];
let filteredItems = [];
let localActions = {}; // id → { status, note, history }

const state = {
  search: '',
  statusFilter: 'all',
  priorityFilter: 'all',
  sourceFilter: 'all',
  ownerFilter: 'all',
  sort: localStorage.getItem('sb_sort') || 'score-desc',
  density: localStorage.getItem('sb_density') || 'comfortable',
  drawerItemId: null,
};

// ─── HELPERS ──────────────────────────────────────────────────────
function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function scoreClass(s) {
  if (s >= 90) return 'score-critical';
  if (s >= 70) return 'score-high';
  if (s >= 40) return 'score-medium';
  return 'score-low';
}

function scoreBarColor(s) {
  if (s >= 90) return 'var(--red)';
  if (s >= 70) return 'var(--amber)';
  if (s >= 40) return 'var(--blue)';
  return 'var(--text-dim)';
}

function uniqueTags(tags) {
  return [...new Set(tags)];
}

function getItemStatus(item) {
  return (localActions[item.id] && localActions[item.id].status) || item.status;
}

function showToast(msg, type) {
  const wrap = document.getElementById('toast-wrap');
  const t = document.createElement('div');
  t.className = 'toast';
  const icons = { success: '✓', error: '✕', info: '→' };
  t.innerHTML = `<span style="color:${type==='success'?'var(--green)':type==='error'?'var(--red)':'var(--accent)'}">${icons[type]||'·'}</span> ${msg}`;
  wrap.appendChild(t);
  setTimeout(() => t.remove(), 2600);
}

// ─── LOAD DATA ────────────────────────────────────────────────────
async function loadData() {
  renderSkeletons();
  // Simulate network latency
  await new Promise(r => setTimeout(r, 580));

  try {
    const res = await fetch('./review-items.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    allItems = await res.json();
    buildFilterOptions();
    applyFilters();
    updateCounts();
  } catch (err) {
    renderError(err.message);
  }
}

function renderSkeletons() {
  const list = document.getElementById('queue-list');
  list.innerHTML = Array.from({length: 8}, () => `
    <div class="skel-item skeleton" aria-hidden="true">
      <div class="skel-line" style="width:70%;"></div>
      <div class="skel-line" style="width:40%; height:8px; opacity:0.6;"></div>
    </div>
  `).join('');
  document.getElementById('queue-count').textContent = 'Loading…';
}

function renderError(msg) {
  document.getElementById('queue-list').innerHTML = `
    <div class="state-box" role="alert">
      <div class="state-icon">⚠</div>
      <h3>Failed to load items</h3>
      <p>${msg}</p>
      <button class="action-btn" onclick="loadData()" style="margin-top:8px;">Try again</button>
    </div>
  `;
  document.getElementById('queue-count').textContent = 'Error';
}

// ─── FILTER OPTIONS ───────────────────────────────────────────────
function buildFilterOptions() {
  // Sources
  const sources = [...new Set(allItems.map(i => i.source))].sort();
  const srcSel = document.getElementById('source-filter');
  sources.forEach(s => {
    const opt = document.createElement('option');
    opt.value = s;
    opt.textContent = s;
    srcSel.appendChild(opt);
  });

  // Owners
  const owners = [...new Set(allItems.map(i => i.owner).filter(Boolean))].sort();
  const ownSel = document.getElementById('owner-filter');
  owners.forEach(o => {
    const opt = document.createElement('option');
    opt.value = o;
    opt.textContent = o;
    ownSel.appendChild(opt);
  });

  // Set saved sort
  document.getElementById('sort-select').value = state.sort;
}

// ─── FILTERING + SORTING ──────────────────────────────────────────
function applyFilters() {
  const q = state.search.toLowerCase();

  filteredItems = allItems.filter(item => {
    const status = getItemStatus(item);
    if (state.statusFilter !== 'all' && status !== state.statusFilter) return false;
    if (state.priorityFilter !== 'all' && item.priority !== state.priorityFilter) return false;
    if (state.sourceFilter !== 'all' && item.source !== state.sourceFilter) return false;
    if (state.ownerFilter === 'unassigned' && item.owner) return false;
    if (state.ownerFilter !== 'all' && state.ownerFilter !== 'unassigned' && item.owner !== state.ownerFilter) return false;
    if (q && !item.title.toLowerCase().includes(q) && !item.summary.toLowerCase().includes(q)) return false;
    return true;
  });

  // Sort
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  filteredItems.sort((a, b) => {
    if (state.sort === 'score-desc') return b.score - a.score;
    if (state.sort === 'score-asc') return a.score - b.score;
    if (state.sort === 'date-desc') return new Date(b.createdAt) - new Date(a.createdAt);
    if (state.sort === 'date-asc') return new Date(a.createdAt) - new Date(b.createdAt);
    if (state.sort === 'priority') return (priorityOrder[a.priority]||2) - (priorityOrder[b.priority]||2);
    return 0;
  });

  renderList();
  updateCounts();
}

// ─── RENDER LIST ──────────────────────────────────────────────────
function renderList() {
  const list = document.getElementById('queue-list');
  const countEl = document.getElementById('queue-count');

  if (filteredItems.length === 0) {
    const hasFilters = state.search || state.statusFilter !== 'all' || state.priorityFilter !== 'all' || state.sourceFilter !== 'all' || state.ownerFilter !== 'all';
    list.innerHTML = `
      <div class="state-box" role="status">
        <div class="state-icon">${hasFilters ? '⊘' : '◻'}</div>
        <h3>${hasFilters ? 'No matching items' : 'Queue is empty'}</h3>
        <p>${hasFilters ? 'Try adjusting your filters or search.' : 'All caught up!'}</p>
        ${hasFilters ? `<button class="action-btn" onclick="resetFilters()" style="margin-top:8px;">Clear filters</button>` : ''}
      </div>
    `;
    countEl.innerHTML = '<strong>0</strong> items';
    return;
  }

  countEl.innerHTML = `<strong>${filteredItems.length}</strong> of <strong>${allItems.length}</strong> items`;

  list.innerHTML = filteredItems.map((item, idx) => {
    const status = getItemStatus(item);
    const tags = uniqueTags(item.tags || []).slice(0, 4);
    return `
      <div
        class="queue-item p-${item.priority}"
        role="listitem"
        tabindex="0"
        data-id="${item.id}"
        data-idx="${idx}"
        aria-label="${item.title}, ${item.priority} priority, ${status}"
      >
        <div class="item-top">
          <span class="item-title">${escHtml(item.title)}</span>
          <span class="item-score ${scoreClass(item.score)}" title="Risk score">${item.score}</span>
        </div>
        <div class="item-meta">
          <span class="badge badge-status-${status.replace(/\s/g,'-')}">${status}</span>
          <span class="badge badge-source">${escHtml(item.source)}</span>
          ${item.owner
            ? `<span class="badge badge-owner">${escHtml(item.owner)}</span>`
            : `<span class="badge badge-no-owner">unassigned</span>`
          }
          ${tags.map(t => `<span class="tag-pill">${escHtml(t)}</span>`).join('')}
          <span class="item-time">${timeAgo(item.createdAt)}</span>
        </div>
      </div>
    `;
  }).join('');

  // Click listeners
  list.querySelectorAll('.queue-item').forEach(el => {
    el.addEventListener('click', () => openDrawer(el.dataset.id));
    el.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openDrawer(el.dataset.id);
      }
    });
  });
}

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ─── COUNTS ───────────────────────────────────────────────────────
function updateCounts() {
  const counts = {};
  allItems.forEach(item => {
    const s = getItemStatus(item);
    counts[s] = (counts[s]||0) + 1;
    counts['priority_'+item.priority] = (counts['priority_'+item.priority]||0) + 1;
  });

  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val || 0; };
  set('count-all', allItems.length);
  set('count-open', counts['open']||0);
  set('count-in-review', counts['in-review']||0);
  set('count-escalated', counts['escalated']||0);
  set('count-reviewed', counts['reviewed']||0);
  set('count-snoozed', counts['snoozed']||0);
  set('count-high', counts['priority_high']||0);
  set('count-medium', counts['priority_medium']||0);
  set('count-low', counts['priority_low']||0);
}

// ─── DRAWER ───────────────────────────────────────────────────────
function openDrawer(id) {
  const item = allItems.find(i => i.id === id);
  if (!item) return;
  state.drawerItemId = id;
  renderDrawer(item);
  document.getElementById('drawer-overlay').classList.add('open');
  document.getElementById('drawer-overlay').removeAttribute('aria-hidden');
  const drawer = document.getElementById('drawer');
  drawer.classList.add('open');
  drawer.removeAttribute('aria-hidden');
  document.getElementById('drawer-close').focus();
  document.body.style.overflow = 'hidden';
}

function closeDrawer() {
  document.getElementById('drawer-overlay').classList.remove('open');
  document.getElementById('drawer-overlay').setAttribute('aria-hidden','true');
  const drawer = document.getElementById('drawer');
  drawer.classList.remove('open');
  drawer.setAttribute('aria-hidden','true');
  document.body.style.overflow = '';
  state.drawerItemId = null;
}

function renderDrawer(item) {
  const actions = localActions[item.id] || {};
  const status = actions.status || item.status;
  const history = actions.history || [];
  const tags = uniqueTags(item.tags || []);

  document.getElementById('drawer-title').textContent = item.title;
  document.getElementById('drawer-id').textContent = item.id;

  document.getElementById('drawer-badges').innerHTML = `
    <span class="badge badge-status-${status.replace(/\s/g,'-')}">${status}</span>
    <span class="badge badge-source">${escHtml(item.source)}</span>
    ${item.owner ? `<span class="badge badge-owner">${escHtml(item.owner)}</span>` : `<span class="badge badge-no-owner">unassigned</span>`}
  `;

  const body = document.getElementById('drawer-body');
  body.innerHTML = `
    <div>
      <div class="drawer-section-label">Summary</div>
      <div class="summary-box">${escHtml(item.summary)}</div>
    </div>

    <div>
      <div class="drawer-section-label">Signals</div>
      <div class="meta-grid">
        <div class="meta-cell">
          <div class="meta-cell-label">Risk score</div>
          <div class="meta-cell-value">${item.score} / 100</div>
          <div class="score-bar-track">
            <div class="score-bar-fill" id="score-bar" style="width:0%; background:${scoreBarColor(item.score)};"></div>
          </div>
        </div>
        <div class="meta-cell">
          <div class="meta-cell-label">Priority</div>
          <div class="meta-cell-value" style="text-transform:capitalize;">${item.priority}</div>
        </div>
        <div class="meta-cell">
          <div class="meta-cell-label">Created</div>
          <div class="meta-cell-value">${new Date(item.createdAt).toLocaleDateString('en-GB', {day:'numeric',month:'short',year:'numeric'})}</div>
        </div>
        <div class="meta-cell">
          <div class="meta-cell-label">Owner</div>
          <div class="meta-cell-value">${item.owner || '—'}</div>
        </div>
      </div>
    </div>

    ${tags.length > 0 ? `
    <div>
      <div class="drawer-section-label">Tags</div>
      <div class="tags-wrap">${tags.map(t => `<span class="drawer-tag">${escHtml(t)}</span>`).join('')}</div>
    </div>
    ` : ''}

    <div>
      <div class="drawer-section-label">Actions</div>
      <div class="action-bar" id="action-bar">
        <button class="action-btn success ${status==='reviewed'?'applied':''}" data-action="reviewed" aria-label="Mark as reviewed">
          ✓ Mark reviewed
        </button>
        <button class="action-btn warning ${status==='snoozed'?'applied':''}" data-action="snoozed" aria-label="Snooze this item">
          ◷ Snooze
        </button>
        <button class="action-btn danger ${status==='escalated'?'applied':''}" data-action="escalated" aria-label="Escalate this item">
          ↑ Escalate
        </button>
        <button class="action-btn ${status==='in-review'?'applied':''}" data-action="in-review" aria-label="Mark as in review">
          ◎ In review
        </button>
      </div>
    </div>

    <div>
      <div class="drawer-section-label">Add note</div>
      <textarea
        class="action-note"
        id="note-input"
        placeholder="Add context, observations, or handoff notes…"
        aria-label="Add a note to this item"
      >${escHtml(actions.note || '')}</textarea>
      <div style="margin-top:8px;">
        <button class="action-btn" id="save-note-btn" aria-label="Save note">Save note</button>
      </div>
    </div>

    ${history.length > 0 ? `
    <div>
      <div class="drawer-section-label">Activity</div>
      <div id="history-list">
        ${history.slice().reverse().map(h => `
          <div class="history-entry">
            <div class="history-dot ${h.color || ''}"></div>
            <span>${escHtml(h.text)}</span>
            <span class="history-time">${h.time}</span>
          </div>
        `).join('')}
      </div>
    </div>
    ` : ''}
  `;

  // Animate score bar
  requestAnimationFrame(() => {
    setTimeout(() => {
      const bar = document.getElementById('score-bar');
      if (bar) bar.style.width = item.score + '%';
    }, 50);
  });

  // Action buttons
  document.getElementById('action-bar').querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', () => {
      const action = btn.dataset.action;
      applyAction(item.id, action);
    });
  });

  // Save note
  document.getElementById('save-note-btn').addEventListener('click', () => {
    const note = document.getElementById('note-input').value.trim();
    if (!localActions[item.id]) localActions[item.id] = { history: [] };
    localActions[item.id].note = note;
    if (note) {
      pushHistory(item.id, 'Note added', 'green');
    }
    showToast('Note saved', 'success');
    applyFilters();
  });

  // Nav buttons
  const idx = filteredItems.findIndex(i => i.id === item.id);
  const prevBtn = document.getElementById('nav-prev');
  const nextBtn = document.getElementById('nav-next');
  prevBtn.disabled = idx <= 0;
  nextBtn.disabled = idx >= filteredItems.length - 1;

  prevBtn.onclick = () => { if (idx > 0) openDrawer(filteredItems[idx-1].id); };
  nextBtn.onclick = () => { if (idx < filteredItems.length-1) openDrawer(filteredItems[idx+1].id); };
}

function applyAction(id, action) {
  if (!localActions[id]) localActions[id] = { history: [] };
  localActions[id].status = action;
  const labels = { reviewed:'Marked as reviewed', snoozed:'Snoozed', escalated:'Escalated', 'in-review':'Set to in review' };
  const colors = { reviewed:'green', snoozed:'', escalated:'red', 'in-review':'amber' };
  pushHistory(id, labels[action] || action, colors[action]);
  showToast(labels[action] || action, 'success');
  applyFilters();
  updateCounts();
  const item = allItems.find(i => i.id === id);
  if (item) renderDrawer(item);
}

function pushHistory(id, text, color) {
  if (!localActions[id]) localActions[id] = {};
  if (!localActions[id].history) localActions[id].history = [];
  localActions[id].history.push({ text, color, time: new Date().toLocaleTimeString('en-GB', {hour:'2-digit',minute:'2-digit'}) });
}

// ─── FILTER INTERACTIONS ──────────────────────────────────────────
document.querySelectorAll('[data-filter]').forEach(chip => {
  chip.addEventListener('click', () => {
    const { filter, value } = chip.dataset;
    const group = document.querySelectorAll(`[data-filter="${filter}"]`);
    group.forEach(c => { c.classList.remove('selected'); c.setAttribute('aria-pressed','false'); });
    chip.classList.add('selected');
    chip.setAttribute('aria-pressed','true');
    state[filter + 'Filter'] = value;
    applyFilters();
  });
  chip.addEventListener('keydown', e => { if (e.key==='Enter'||e.key===' ') { e.preventDefault(); chip.click(); } });
});

document.getElementById('source-filter').addEventListener('change', e => {
  state.sourceFilter = e.target.value;
  applyFilters();
});

document.getElementById('owner-filter').addEventListener('change', e => {
  state.ownerFilter = e.target.value;
  applyFilters();
});

document.getElementById('sort-select').addEventListener('change', e => {
  state.sort = e.target.value;
  localStorage.setItem('sb_sort', state.sort);
  applyFilters();
});

document.getElementById('search').addEventListener('input', e => {
  state.search = e.target.value;
  applyFilters();
});

function resetFilters() {
  state.search = '';
  state.statusFilter = 'all';
  state.priorityFilter = 'all';
  state.sourceFilter = 'all';
  state.ownerFilter = 'all';
  document.getElementById('search').value = '';
  document.getElementById('source-filter').value = 'all';
  document.getElementById('owner-filter').value = 'all';
  document.querySelectorAll('[data-filter]').forEach(c => {
    const isAll = c.dataset.value === 'all';
    c.classList.toggle('selected', isAll);
    c.setAttribute('aria-pressed', isAll ? 'true' : 'false');
  });
  applyFilters();
}

document.getElementById('reset-btn').addEventListener('click', resetFilters);

// ─── DENSITY TOGGLE ────────────────────────────────────────────────
const densityBtn = document.getElementById('density-toggle');
function applyDensity() {
  const isCompact = state.density === 'compact';
  document.body.classList.toggle('compact', isCompact);
  densityBtn.classList.toggle('active', isCompact);
  densityBtn.setAttribute('aria-pressed', String(isCompact));
  document.getElementById('density-label').textContent = isCompact ? 'comfortable' : 'compact';
  document.getElementById('density-icon').textContent = isCompact ? '⊟' : '☰';
}

densityBtn.addEventListener('click', () => {
  state.density = state.density === 'compact' ? 'comfortable' : 'compact';
  localStorage.setItem('sb_density', state.density);
  applyDensity();
});

applyDensity();

// ─── DRAWER EVENTS ────────────────────────────────────────────────
document.getElementById('drawer-close').addEventListener('click', closeDrawer);
document.getElementById('drawer-overlay').addEventListener('click', closeDrawer);

document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && state.drawerItemId) closeDrawer();

  // ⌘K / Ctrl+K → focus search
  if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
    e.preventDefault();
    document.getElementById('search').focus();
    document.getElementById('search').select();
  }

  // Arrow key navigation in drawer
  if (state.drawerItemId) {
    const idx = filteredItems.findIndex(i => i.id === state.drawerItemId);
    if (e.key === 'ArrowRight' && idx < filteredItems.length - 1) openDrawer(filteredItems[idx+1].id);
    if (e.key === 'ArrowLeft' && idx > 0) openDrawer(filteredItems[idx-1].id);
  }
});

// ─── INIT ─────────────────────────────────────────────────────────
loadData();
