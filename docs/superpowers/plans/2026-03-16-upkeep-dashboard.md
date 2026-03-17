# Upkeep Dashboard Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a single-file HTML app (`upkeep.html`) that tracks recurring life tasks with Notion as the backend and optional Google Calendar integration.

**Architecture:** Single HTML file with vanilla JS. Notion API calls proxied through corsproxy.io for CORS. Google Calendar calls go direct via browser OAuth (GIS). No build tools, no dependencies beyond Google Fonts and one GIS script tag.

**Tech Stack:** HTML, CSS, vanilla JavaScript, Notion API, Google Calendar API, Google Identity Services

**Spec:** `docs/superpowers/specs/2026-03-16-upkeep-dashboard-design.md`

---

## Chunk 1: Foundation and Notion Read

### Task 1: HTML Shell and Design System CSS

**Files:**
- Create: `upkeep.html`

This task creates the complete HTML structure and all CSS. Every subsequent task only adds JavaScript.

- [ ] **Step 1: Create upkeep.html with full HTML structure and CSS**

Write the complete file with:
- `<!DOCTYPE html>`, charset, viewport meta, base path considerations for `/upkeep`
- Google Fonts link: Pacifico, Fredoka:wght@600, Quicksand:wght@400;500;600
- Google Identity Services script tag
- Full `<style>` block implementing the Riley Daniels design system:
  - CSS custom properties: `--primary: #C0396B`, `--text: #4A3033`, `--bg: #F5E6E8`, `--secondary-bg: #E8C4CF`, `--cards: #FFFFFF`
  - Category colors: Health red, Car orange, Beauty pink, Grooming purple, Home green, Finance yellow, Other gray
  - Typography: Pacifico for `.logo`, Fredoka SemiBold for `h1,h2,h3,.card-name,.modal-title`, Quicksand for `body`
  - Border radius: 16px cards, 10px inputs/buttons, 24px modals
  - Sticky header with flexbox layout
  - Stats pills: small rounded pills with count + label, colored backgrounds
  - Filter bar: horizontal scrollable row of pill buttons, raspberry when `.active`
  - Card grid: `display: grid; grid-template-columns: repeat(auto-fill, minmax(275px, 1fr)); gap: 14px`
  - Card styles: white bg, `box-shadow: 0 2px 8px rgba(0,0,0,0.08)`, hover lift with `transform: translateY(-2px)` and increased shadow, 16px radius
  - Overdue card: `border-left: 4px solid #e74c3c`
  - Card stat boxes: 2x2 grid inside card, blush bg, uppercase 10px labels, bold values
  - Due badges: colored pills (red/amber/yellow/green/purple/gray per spec)
  - Card actions: full-width mark-done button (raspberry), edit/delete icon buttons
  - Delete confirm state: `.btn-delete.confirming { background: #e74c3c; color: white }`
  - Modal: fixed overlay with centered card, 24px radius, backdrop blur, close on backdrop click
  - Modal form fields: text input, select, number + unit inline group, date, textarea
  - Loading spinner: centered CSS spinner
  - Error state: centered message with retry button
  - Toast: fixed bottom-center, slide-up animation, success (green) and error (red) variants
  - Card loading overlay: semi-transparent with small spinner
  - Responsive: `@media (max-width: 600px)` single column, smaller padding, stacked header
- Complete `<body>` HTML:
  - Header: logo span ("Upkeep"), stats container div, GCal connect button, Add Item button
  - Filter bar: div with "All" button + one button per category (with emoji)
  - Main area: loading spinner div, error state div (hidden), card grid div
  - Modal: overlay div containing form with all fields per spec
  - Toast container: empty div for dynamically added toasts
- Empty `<script>` tag (logic added in subsequent tasks)

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Upkeep Dashboard</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Fredoka:wght@600&family=Pacifico&family=Quicksand:wght@400;500;600&display=swap" rel="stylesheet">
  <script src="https://accounts.google.com/gsi/client" async defer></script>
  <style>
    /* ... full CSS as described above ... */
  </style>
</head>
<body>
  <!-- Header -->
  <header class="header">
    <span class="logo">Upkeep</span>
    <div class="stats" id="stats"></div>
    <button class="btn-gcal" id="gcalBtn" onclick="handleGCalClick()">Connect Google Calendar</button>
    <button class="btn-primary" onclick="openModal()">+ Add Item</button>
  </header>

  <!-- Filter Bar -->
  <div class="filter-bar" id="filterBar">
    <button class="filter-pill active" data-category="all" onclick="setFilter('all')">All</button>
    <button class="filter-pill" data-category="Health" onclick="setFilter('Health')">&#10084;&#65039; Health</button>
    <button class="filter-pill" data-category="Car" onclick="setFilter('Car')">&#128663; Car</button>
    <button class="filter-pill" data-category="Beauty" onclick="setFilter('Beauty')">&#128132; Beauty</button>
    <button class="filter-pill" data-category="Grooming" onclick="setFilter('Grooming')">&#9986;&#65039; Grooming</button>
    <button class="filter-pill" data-category="Home" onclick="setFilter('Home')">&#127968; Home</button>
    <button class="filter-pill" data-category="Finance" onclick="setFilter('Finance')">&#128176; Finance</button>
    <button class="filter-pill" data-category="Other" onclick="setFilter('Other')">&#128204; Other</button>
  </div>

  <!-- Main Content -->
  <main class="main">
    <div class="loading" id="loading"><div class="spinner"></div></div>
    <div class="error-state" id="errorState" style="display:none">
      <p>Failed to load items from Notion</p>
      <button class="btn-primary" onclick="init()">Retry</button>
    </div>
    <div class="card-grid" id="cardGrid"></div>
    <div class="empty-state" id="emptyState" style="display:none"></div>
  </main>

  <!-- Modal -->
  <div class="modal-overlay" id="modalOverlay" onclick="closeModalOnBackdrop(event)">
    <div class="modal">
      <h2 class="modal-title" id="modalTitle">Add new item</h2>
      <form id="itemForm" onsubmit="handleSubmit(event)">
        <input type="hidden" id="editingId" value="">
        <div class="form-group">
          <label for="itemName">Item name</label>
          <input type="text" id="itemName" required placeholder="e.g. Oil change">
        </div>
        <div class="form-group">
          <label for="itemCategory">Category</label>
          <select id="itemCategory">
            <option value="Health">&#10084;&#65039; Health</option>
            <option value="Car">&#128663; Car</option>
            <option value="Beauty">&#128132; Beauty</option>
            <option value="Grooming">&#9986;&#65039; Grooming</option>
            <option value="Home">&#127968; Home</option>
            <option value="Finance">&#128176; Finance</option>
            <option value="Other" selected>&#128204; Other</option>
          </select>
        </div>
        <div class="form-group">
          <label>Frequency</label>
          <div class="freq-group">
            <input type="number" id="freqValue" min="1" value="1" required>
            <select id="freqUnit">
              <option value="days">days</option>
              <option value="weeks">weeks</option>
              <option value="months" selected>months</option>
              <option value="years">years</option>
            </select>
          </div>
        </div>
        <div class="form-group">
          <label for="lastDone">Last done</label>
          <input type="date" id="lastDone">
        </div>
        <div class="form-group">
          <label for="itemNotes">Notes</label>
          <textarea id="itemNotes" rows="3" placeholder="Optional notes..."></textarea>
        </div>
        <button type="submit" class="btn-primary btn-submit" id="submitBtn">Save</button>
      </form>
    </div>
  </div>

  <!-- Toasts -->
  <div class="toast-container" id="toastContainer"></div>

  <script>
    // All JS goes here in subsequent tasks
  </script>
</body>
</html>
```

**Note to implementer:** The CSS block above is summarized. Write the FULL CSS implementing every style described. Reference the spec's design system section for exact values. The HTML emoji codes above are placeholders... use actual emoji characters in the real file.

- [ ] **Step 2: Open in browser and visually verify**

Open `upkeep.html` in a browser. Verify:
- Fonts load (Pacifico logo, Fredoka headings, Quicksand body)
- Header is sticky with blush background
- Filter pills render horizontally
- Loading spinner shows centered
- Modal opens/closes (test by removing `style="display:none"` temporarily)
- Colors match spec (raspberry primary, charcoal rose text, blush bg)
- Responsive: resize to mobile width, verify single column

- [ ] **Step 3: Commit**

```bash
git add upkeep.html
git commit -m "feat: add HTML shell and complete design system CSS"
```

---

### Task 2: Config, State, and Utility Functions

**Files:**
- Modify: `upkeep.html` (add to `<script>` block)

- [ ] **Step 1: Add config constants and state**

Add to the top of the `<script>` block:

```javascript
// === CONFIG ===
const NOTION_PROXY = 'https://corsproxy.io/?url=https://api.notion.com';
const NOTION_TOKEN = 'REDACTED_TOKEN';
const NOTION_DB = 'beaf32f0b4f541c9a1e50be57fe7cd62';
const NOTION_VERSION = '2022-06-28';
const GCAL_CLIENT_ID = '5655386906-q337i8k06j5s8112rvitom9fdph6po6l.apps.googleusercontent.com';
const GCAL_SCOPE = 'https://www.googleapis.com/auth/calendar.events';

const CATEGORIES = {
  Health:   { emoji: '\u2764\uFE0F', color: '#e74c3c' },
  Car:      { emoji: '\uD83D\uDE97', color: '#e67e22' },
  Beauty:   { emoji: '\uD83D\uDC84', color: '#e91e8f' },
  Grooming: { emoji: '\u2702\uFE0F', color: '#9b59b6' },
  Home:     { emoji: '\uD83C\uDFE0', color: '#27ae60' },
  Finance:  { emoji: '\uD83D\uDCB0', color: '#f1c40f' },
  Other:    { emoji: '\uD83D\uDCCC', color: '#95a5a6' }
};

// === STATE ===
let items = [];
let activeFilter = 'all';
let gcalToken = sessionStorage.getItem('gcal_token') || null;
```

- [ ] **Step 2: Add frequency conversion utilities**

```javascript
// === UTILITIES ===
const FREQ_MULTIPLIERS = { days: 1, weeks: 7, months: 30, years: 365 };

function freqToDays(value, unit) {
  return value * (FREQ_MULTIPLIERS[unit] || 1);
}

const NAMED_FREQUENCIES = {
  1: 'Daily', 7: 'Weekly', 14: 'Every 2 weeks', 30: 'Monthly',
  60: 'Every 2 months', 90: 'Quarterly', 180: 'Every 6 months', 365: 'Yearly'
};

function freqLabel(days) {
  if (NAMED_FREQUENCIES[days]) return NAMED_FREQUENCIES[days];
  if (days % 365 === 0) return `Every ${days / 365} years`;
  if (days % 30 === 0) return `Every ${days / 30} months`;
  if (days % 7 === 0) return `Every ${days / 7} weeks`;
  return `Every ${days} days`;
}
```

- [ ] **Step 3: Add date and badge utilities**

```javascript
function daysBetween(dateStr, today) {
  const d = new Date(dateStr + 'T00:00:00');
  const t = new Date(today + 'T00:00:00');
  return Math.round((d - t) / 86400000);
}

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

function nextDueDate(lastDone, freqDays) {
  if (!lastDone) return null;
  const d = new Date(lastDone + 'T00:00:00');
  d.setDate(d.getDate() + freqDays);
  return d.toISOString().split('T')[0];
}

function daysUntilDue(lastDone, freqDays) {
  const next = nextDueDate(lastDone, freqDays);
  if (!next) return null;
  return daysBetween(next, todayStr());
}

function dueBadge(daysLeft) {
  if (daysLeft === null) return { class: 'badge-gray', text: 'no date' };
  if (daysLeft < 0) return { class: 'badge-red', text: `${Math.abs(daysLeft)}d overdue` };
  if (daysLeft === 0) return { class: 'badge-amber', text: 'due today!' };
  if (daysLeft <= 7) return { class: 'badge-yellow', text: `in ${daysLeft}d` };
  if (daysLeft <= 30) return { class: 'badge-green', text: `in ${daysLeft} days` };
  return { class: 'badge-purple', text: `in ${daysLeft} days` };
}
```

- [ ] **Step 4: Add toast system**

```javascript
// === TOASTS ===
function showToast(message, type = 'success') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('show'));
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}
```

- [ ] **Step 5: Verify utilities work in browser console**

Open browser console, test:
- `freqLabel(7)` returns `"Weekly"`
- `freqLabel(21)` returns `"Every 3 weeks"`
- `freqLabel(90)` returns `"Quarterly"`
- `daysUntilDue('2026-03-10', 7)` returns a number
- `dueBadge(-3)` returns `{ class: 'badge-red', text: '3d overdue' }`

- [ ] **Step 6: Commit**

```bash
git add upkeep.html
git commit -m "feat: add config, state, and utility functions"
```

---

### Task 3: Notion API Helpers

**Files:**
- Modify: `upkeep.html` (add to `<script>` block after utilities)

- [ ] **Step 1: Add Notion fetch wrapper**

```javascript
// === NOTION API ===
async function notionFetch(endpoint, options = {}) {
  const url = `${NOTION_PROXY}/v1${endpoint}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${NOTION_TOKEN}`,
      'Notion-Version': NOTION_VERSION,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Notion API error: ${res.status}`);
  }
  return res.json();
}
```

- [ ] **Step 2: Add query (load all items) with pagination**

```javascript
async function loadItems() {
  let allPages = [];
  let cursor = undefined;
  do {
    const body = { page_size: 100 };
    if (cursor) body.start_cursor = cursor;
    const data = await notionFetch(`/databases/${NOTION_DB}/query`, {
      method: 'POST',
      body: JSON.stringify(body)
    });
    allPages = allPages.concat(data.results);
    cursor = data.has_more ? data.next_cursor : undefined;
  } while (cursor);
  return allPages.map(parseNotionPage);
}
```

- [ ] **Step 3: Add Notion page parser**

```javascript
function parseNotionPage(page) {
  const p = page.properties;
  return {
    id: page.id,
    name: p['Item Name']?.title?.[0]?.plain_text || '',
    category: p['Category']?.multi_select?.[0]?.name || 'Other',
    frequency: p['Frequency (days)']?.number || 30,
    lastDone: p['Last Done']?.date?.start || null,
    notes: p['Notes']?.rich_text?.[0]?.plain_text || '',
    calendarEventId: p['Calendar Event ID']?.rich_text?.[0]?.plain_text || ''
  };
}
```

- [ ] **Step 4: Add create, update, and archive helpers**

```javascript
function notionProperties(item) {
  const props = {
    'Item Name': { title: [{ text: { content: item.name } }] },
    'Category': { multi_select: [{ name: item.category }] },
    'Frequency (days)': { number: item.frequency },
    'Notes': { rich_text: item.notes ? [{ text: { content: item.notes } }] : [] }
  };
  if (item.lastDone) {
    props['Last Done'] = { date: { start: item.lastDone } };
  } else if (item.lastDone === null) {
    props['Last Done'] = { date: null };
  }
  if (item.calendarEventId !== undefined) {
    props['Calendar Event ID'] = {
      rich_text: item.calendarEventId ? [{ text: { content: item.calendarEventId } }] : []
    };
  }
  return props;
}

async function createItem(item) {
  const data = await notionFetch('/pages', {
    method: 'POST',
    body: JSON.stringify({
      parent: { database_id: NOTION_DB },
      properties: notionProperties(item)
    })
  });
  return parseNotionPage(data);
}

async function updateItem(pageId, updates) {
  const data = await notionFetch(`/pages/${pageId}`, {
    method: 'PATCH',
    body: JSON.stringify({ properties: notionProperties(updates) })
  });
  return parseNotionPage(data);
}

async function archiveItem(pageId) {
  await notionFetch(`/pages/${pageId}`, {
    method: 'PATCH',
    body: JSON.stringify({ archived: true })
  });
}
```

- [ ] **Step 5: Test Notion connection in browser console**

Open the page, run in console:
```javascript
loadItems().then(i => console.log(i)).catch(e => console.error(e))
```
Verify it returns an array of parsed items (or empty array if DB is empty). If CORS error, verify corsproxy.io is accessible.

- [ ] **Step 6: Commit**

```bash
git add upkeep.html
git commit -m "feat: add Notion API helpers with pagination"
```

---

### Task 4: Card Rendering and Init

**Files:**
- Modify: `upkeep.html` (add to `<script>` block after Notion helpers)

- [ ] **Step 1: Add card HTML generator**

```javascript
// === RENDERING ===
function renderCard(item) {
  const days = daysUntilDue(item.lastDone, item.frequency);
  const badge = dueBadge(days);
  const nextDue = nextDueDate(item.lastDone, item.frequency);
  const cat = CATEGORIES[item.category] || CATEGORIES.Other;
  const isOverdue = days !== null && days < 0;

  return `
    <div class="card ${isOverdue ? 'card-overdue' : ''}" data-id="${item.id}" id="card-${item.id}">
      <div class="card-header">
        <span class="card-category" style="color:${cat.color}">${cat.emoji} ${item.category}</span>
        <div class="card-actions-top">
          <button class="btn-icon btn-edit" onclick="openEditModal('${item.id}')" title="Edit">&#9998;</button>
          <button class="btn-icon btn-delete" data-id="${item.id}" onclick="handleDelete(this, '${item.id}')" title="Delete">&#10005;</button>
        </div>
      </div>
      <h3 class="card-name">${escapeHtml(item.name)}</h3>
      <div class="card-stats">
        <div class="stat-box">
          <span class="stat-label">Last done</span>
          <span class="stat-value">${item.lastDone || '...'}</span>
        </div>
        <div class="stat-box">
          <span class="stat-label">Frequency</span>
          <span class="stat-value">${freqLabel(item.frequency)}</span>
        </div>
        <div class="stat-box">
          <span class="stat-label">Next due</span>
          <span class="stat-value">${nextDue || '...'}</span>
        </div>
        <div class="stat-box">
          <span class="stat-label">Status</span>
          <span class="stat-value badge ${badge.class}">${badge.text}</span>
        </div>
      </div>
      ${item.notes ? `<p class="card-notes">${escapeHtml(item.notes)}</p>` : ''}
      <button class="btn-primary btn-done" onclick="handleMarkDone('${item.id}')">&#10003; Mark as Done</button>
      <div class="card-loading" style="display:none"><div class="spinner-small"></div></div>
    </div>
  `;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
```

- [ ] **Step 2: Add grid render, stats, and filter logic**

```javascript
function renderCards() {
  const grid = document.getElementById('cardGrid');
  const empty = document.getElementById('emptyState');

  const filtered = activeFilter === 'all'
    ? items
    : items.filter(i => i.category === activeFilter);

  const sorted = [...filtered].sort((a, b) => {
    const da = daysUntilDue(a.lastDone, a.frequency);
    const db = daysUntilDue(b.lastDone, b.frequency);
    if (da === null && db === null) return 0;
    if (da === null) return 1;
    if (db === null) return -1;
    return da - db;
  });

  if (sorted.length === 0) {
    grid.innerHTML = '';
    const catLabel = activeFilter === 'all' ? '' : activeFilter;
    empty.textContent = catLabel ? `No ${catLabel} items yet` : 'No items yet... add one!';
    empty.style.display = 'block';
  } else {
    empty.style.display = 'none';
    grid.innerHTML = sorted.map(renderCard).join('');
  }

  renderStats();
}

function renderStats() {
  const stats = document.getElementById('stats');
  const total = items.length;
  let overdue = 0, soon = 0, onTrack = 0;
  items.forEach(item => {
    const d = daysUntilDue(item.lastDone, item.frequency);
    if (d === null) return;
    if (d < 0) overdue++;
    else if (d <= 14) soon++;
    else onTrack++;
  });

  let html = `<span class="stat-pill stat-gray">${total} tracked</span>`;
  if (overdue) html += `<span class="stat-pill stat-red">${overdue} overdue</span>`;
  if (soon) html += `<span class="stat-pill stat-amber">${soon} soon</span>`;
  if (onTrack) html += `<span class="stat-pill stat-green">${onTrack} on track</span>`;
  stats.innerHTML = html;
}

function setFilter(category) {
  activeFilter = category;
  document.querySelectorAll('.filter-pill').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.category === category);
  });
  renderCards();
}
```

- [ ] **Step 3: Add init function**

```javascript
// === INIT ===
async function init() {
  const loading = document.getElementById('loading');
  const errorState = document.getElementById('errorState');
  const grid = document.getElementById('cardGrid');

  loading.style.display = 'flex';
  errorState.style.display = 'none';
  grid.innerHTML = '';

  try {
    items = await loadItems();
    loading.style.display = 'none';
    renderCards();
    updateGCalButton();
  } catch (err) {
    loading.style.display = 'none';
    errorState.style.display = 'flex';
    console.error('Failed to load:', err);
  }
}

document.addEventListener('DOMContentLoaded', init);
```

- [ ] **Step 4: Test in browser**

Open the page. Verify:
- Spinner shows briefly, then cards appear (or error state if Notion is unreachable)
- Cards display item name, category with emoji, stats grid, mark done button
- Stats pills in header update correctly
- Filter buttons filter cards by category
- Cards sorted by urgency (most overdue first)
- Overdue cards have red left border
- Empty state shows when filtering to empty category

- [ ] **Step 5: Commit**

```bash
git add upkeep.html
git commit -m "feat: add card rendering, stats, filters, and init"
```

---

**Important:** All JavaScript functions in subsequent tasks MUST use `function` declarations (not `const`/`let` arrow functions). This ensures hoisting works correctly since some functions (e.g., `handleSubmit` in Task 5) reference GCal helpers defined later (Task 8). Function declarations are hoisted; arrow function assignments are not.

---

## Chunk 2: CRUD Operations

### Task 5: Modal and Add Item

**Files:**
- Modify: `upkeep.html` (add to `<script>` block)

- [ ] **Step 1: Add modal open/close logic**

```javascript
// === MODAL ===
function openModal(editItem = null) {
  const overlay = document.getElementById('modalOverlay');
  const title = document.getElementById('modalTitle');
  const form = document.getElementById('itemForm');
  const editingId = document.getElementById('editingId');
  const submitBtn = document.getElementById('submitBtn');

  form.reset();
  editingId.value = '';
  submitBtn.disabled = false;
  submitBtn.textContent = 'Save';

  if (editItem) {
    title.textContent = 'Edit item';
    editingId.value = editItem.id;
    document.getElementById('itemName').value = editItem.name;
    document.getElementById('itemCategory').value = editItem.category;
    // Reverse-engineer frequency unit from days
    const { value, unit } = daysToFreqInput(editItem.frequency);
    document.getElementById('freqValue').value = value;
    document.getElementById('freqUnit').value = unit;
    document.getElementById('lastDone').value = editItem.lastDone || '';
    document.getElementById('itemNotes').value = editItem.notes || '';
  } else {
    title.textContent = 'Add new item';
  }

  overlay.style.display = 'flex';
}

function daysToFreqInput(days) {
  if (days % 365 === 0) return { value: days / 365, unit: 'years' };
  if (days % 30 === 0) return { value: days / 30, unit: 'months' };
  if (days % 7 === 0) return { value: days / 7, unit: 'weeks' };
  return { value: days, unit: 'days' };
}

function closeModal() {
  document.getElementById('modalOverlay').style.display = 'none';
}

function closeModalOnBackdrop(e) {
  if (e.target === e.currentTarget) closeModal();
}

function openEditModal(itemId) {
  const item = items.find(i => i.id === itemId);
  if (item) openModal(item);
}
```

- [ ] **Step 2: Add form submit handler**

```javascript
async function handleSubmit(e) {
  e.preventDefault();
  const submitBtn = document.getElementById('submitBtn');
  const editingId = document.getElementById('editingId').value;

  const formData = {
    name: document.getElementById('itemName').value.trim(),
    category: document.getElementById('itemCategory').value,
    frequency: freqToDays(
      parseInt(document.getElementById('freqValue').value),
      document.getElementById('freqUnit').value
    ),
    lastDone: document.getElementById('lastDone').value || null,
    notes: document.getElementById('itemNotes').value.trim()
  };

  if (!formData.name || !formData.frequency || formData.frequency <= 0) {
    showToast('Please fill in required fields', 'error');
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = 'Saving...';

  try {
    if (editingId) {
      // Edit existing
      const oldItem = items.find(i => i.id === editingId);
      const updated = await updateItem(editingId, formData);
      const idx = items.findIndex(i => i.id === editingId);
      items[idx] = updated;

      // GCal: if frequency or name changed, recreate event
      if (gcalToken && oldItem &&
          (oldItem.frequency !== formData.frequency || oldItem.name !== formData.name)) {
        await recreateGCalEvent(updated);
      }

      showToast('Item updated');
    } else {
      // Add new
      const created = await createItem(formData);
      items.push(created);

      // GCal: create event for new item
      if (gcalToken && created.lastDone) {
        await createGCalEventForItem(created);
      }

      showToast('Item added');
    }
    closeModal();
    renderCards();
  } catch (err) {
    showToast(`Save failed: ${err.message}`, 'error');
    submitBtn.disabled = false;
    submitBtn.textContent = 'Save';
  }
}
```

- [ ] **Step 3: Test in browser**

- Click "Add Item" button... modal opens with "Add new item" title
- Fill in name "Test item", category "Car", frequency 2 weeks, last done today
- Submit... loading state shows, item appears in grid, toast shows "Item added"
- Click edit on the new card... modal opens with "Edit item" and pre-filled values
- Change the name, save... card updates, toast shows

- [ ] **Step 4: Commit**

```bash
git add upkeep.html
git commit -m "feat: add modal with create and edit item functionality"
```

---

### Task 6: Mark Done and Delete

**Files:**
- Modify: `upkeep.html` (add to `<script>` block)

- [ ] **Step 1: Add mark done handler**

```javascript
// === ACTIONS ===
async function handleMarkDone(itemId) {
  const card = document.getElementById(`card-${itemId}`);
  const loadingEl = card.querySelector('.card-loading');
  loadingEl.style.display = 'flex';

  try {
    const item = items.find(i => i.id === itemId);
    const today = todayStr();
    const updates = { ...item, lastDone: today };

    // GCal: delete old event, create new one
    if (gcalToken) {
      if (item.calendarEventId) {
        await deleteGCalEvent(item.calendarEventId).catch(() => {});
      }
      const newNext = nextDueDate(today, item.frequency);
      if (newNext) {
        const eventId = await createGCalEvent(item.name, newNext);
        updates.calendarEventId = eventId || '';
      }
    }

    const updated = await updateItem(itemId, updates);
    const idx = items.findIndex(i => i.id === itemId);
    items[idx] = updated;
    renderCards();
    showToast(`${item.name} marked done`);
  } catch (err) {
    loadingEl.style.display = 'none';
    showToast(`Failed to mark done: ${err.message}`, 'error');
  }
}
```

- [ ] **Step 2: Add two-tap delete handler**

```javascript
const deleteTimers = {};

function handleDelete(btn, itemId) {
  if (btn.classList.contains('confirming')) {
    // Second tap: actually delete
    clearTimeout(deleteTimers[itemId]);
    btn.classList.remove('confirming');
    btn.textContent = '\u2715';
    performDelete(itemId);
  } else {
    // First tap: enter confirm state
    btn.classList.add('confirming');
    btn.textContent = 'Confirm?';
    deleteTimers[itemId] = setTimeout(() => {
      btn.classList.remove('confirming');
      btn.textContent = '\u2715';
    }, 3000);
  }
}

async function performDelete(itemId) {
  const card = document.getElementById(`card-${itemId}`);
  const loadingEl = card.querySelector('.card-loading');
  loadingEl.style.display = 'flex';

  try {
    const item = items.find(i => i.id === itemId);

    // GCal: delete event if exists
    if (gcalToken && item.calendarEventId) {
      await deleteGCalEvent(item.calendarEventId).catch(() => {});
    }

    await archiveItem(itemId);
    items = items.filter(i => i.id !== itemId);
    renderCards();
    showToast(`${item.name} deleted`);
  } catch (err) {
    loadingEl.style.display = 'none';
    showToast(`Failed to delete: ${err.message}`, 'error');
  }
}
```

- [ ] **Step 3: Test in browser**

- Click "Mark as Done" on a card... card shows loading, date updates to today, toast shows
- Click delete (X)... button turns red with "Confirm?" text
- Wait 3 seconds... button resets to X
- Click delete again, then click "Confirm?" immediately... item removed, toast shows

- [ ] **Step 4: Commit**

```bash
git add upkeep.html
git commit -m "feat: add mark done and two-tap delete functionality"
```

---

## Chunk 3: Google Calendar Integration

### Task 7: Google Calendar Auth

**Files:**
- Modify: `upkeep.html` (add to `<script>` block)

- [ ] **Step 1: Add GCal auth functions**

```javascript
// === GOOGLE CALENDAR ===
let tokenClient = null;

function initGCal() {
  if (typeof google === 'undefined' || !google.accounts) return;
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: GCAL_CLIENT_ID,
    scope: GCAL_SCOPE,
    callback: (response) => {
      if (response.access_token) {
        gcalToken = response.access_token;
        sessionStorage.setItem('gcal_token', gcalToken);
        updateGCalButton();
        showToast('Google Calendar connected');
      }
    }
  });
}

function handleGCalClick() {
  if (gcalToken) {
    // Disconnect
    gcalToken = null;
    sessionStorage.removeItem('gcal_token');
    updateGCalButton();
    showToast('Google Calendar disconnected');
  } else {
    // Connect
    if (!tokenClient) initGCal();
    if (tokenClient) {
      tokenClient.requestAccessToken();
    } else {
      showToast('Google sign-in not available', 'error');
    }
  }
}

function updateGCalButton() {
  const btn = document.getElementById('gcalBtn');
  if (gcalToken) {
    btn.textContent = '\u2705 Calendar connected';
    btn.classList.add('connected');
  } else {
    btn.textContent = 'Connect Google Calendar';
    btn.classList.remove('connected');
  }
}
```

- [ ] **Step 2: Add GCal init call to the DOMContentLoaded handler**

Update the `init` function to call `initGCal()` at the start:

```javascript
// Add at the beginning of init():
initGCal();
```

- [ ] **Step 3: Test in browser**

- Page loads with "Connect Google Calendar" button
- Click it... Google OAuth popup appears
- After auth... button changes to "Calendar connected"
- Refresh page... button still shows connected (sessionStorage)
- Click connected button... disconnects, button resets

- [ ] **Step 4: Commit**

```bash
git add upkeep.html
git commit -m "feat: add Google Calendar OAuth via GIS"
```

---

### Task 8: Google Calendar Event CRUD

**Files:**
- Modify: `upkeep.html` (add to `<script>` block, after GCal auth functions)

- [ ] **Step 1: Add GCal API helpers**

```javascript
async function gcalFetch(endpoint, options = {}) {
  const res = await fetch(`https://www.googleapis.com/calendar/v3${endpoint}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${gcalToken}`,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  if (res.status === 401) {
    // Token expired
    gcalToken = null;
    sessionStorage.removeItem('gcal_token');
    updateGCalButton();
    throw new Error('Calendar session expired... please reconnect');
  }
  if (!res.ok && res.status !== 404) {
    throw new Error(`Calendar error: ${res.status}`);
  }
  if (res.status === 204 || res.status === 404) return null;
  return res.json();
}

async function createGCalEvent(itemName, dateStr) {
  const data = await gcalFetch('/calendars/primary/events', {
    method: 'POST',
    body: JSON.stringify({
      summary: itemName,
      start: { date: dateStr },
      end: { date: dateStr },
      colorId: '2',
      reminders: {
        useDefault: false,
        overrides: [{ method: 'popup', minutes: 4320 }]
      }
    })
  });
  return data?.id || '';
}

async function deleteGCalEvent(eventId) {
  await gcalFetch(`/calendars/primary/events/${eventId}`, {
    method: 'DELETE'
  });
}

async function createGCalEventForItem(item) {
  const next = nextDueDate(item.lastDone, item.frequency);
  if (!next) return;
  try {
    const eventId = await createGCalEvent(item.name, next);
    if (eventId) {
      await updateItem(item.id, { ...item, calendarEventId: eventId });
      const idx = items.findIndex(i => i.id === item.id);
      if (idx >= 0) items[idx].calendarEventId = eventId;
    }
  } catch (err) {
    console.error('GCal event creation failed:', err);
  }
}

async function recreateGCalEvent(item) {
  try {
    if (item.calendarEventId) {
      await deleteGCalEvent(item.calendarEventId).catch(() => {});
    }
    await createGCalEventForItem(item);
  } catch (err) {
    console.error('GCal event recreation failed:', err);
  }
}
```

- [ ] **Step 2: Test end-to-end with GCal connected**

- Connect Google Calendar
- Add a new item with a last done date... check Google Calendar for the event
- Mark an item as done... old event deleted, new event created on next due date
- Edit an item's name... old event deleted, new event with new name created
- Delete an item... event removed from calendar

- [ ] **Step 3: Test with GCal disconnected**

- Disconnect Google Calendar
- Add, edit, mark done, delete items... all work, no GCal errors, no event creation attempts

- [ ] **Step 4: Commit**

```bash
git add upkeep.html
git commit -m "feat: add Google Calendar event create/delete integration"
```

---

## Chunk 4: Polish and Final Verification

### Task 9: Final Polish and Edge Cases

**Files:**
- Modify: `upkeep.html`

- [ ] **Step 1: Add keyboard support**

```javascript
// Close modal on Escape
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeModal();
});
```

- [ ] **Step 2: Verify all edge cases**

Test each scenario in the browser:
- Empty database: shows "No items yet... add one!"
- Item with no Last Done date: shows "no date" gray badge, "..." for dates
- All items overdue: header shows red overdue pill, no green/amber pills
- Filter to empty category: shows "No {Category} items yet"
- Rapid mark-done clicks: loading overlay prevents double-action
- Delete timeout: first click shows "Confirm?", wait 3s, resets
- Network error: shows error toast with message
- Notion down on load: shows error state with retry button
- GCal token expired mid-session: shows reconnect toast, button resets
- Mobile layout: single column, header stacks appropriately

- [ ] **Step 3: Review all text for em dashes**

Search the entire file for `—` (em dash). Replace any found with `...` (ellipsis). The spec explicitly prohibits em dashes.

- [ ] **Step 4: Final commit**

```bash
git add upkeep.html
git commit -m "feat: add keyboard support and verify edge cases"
```

---

### Task 10: End-to-End Smoke Test

**Files:** None (testing only)

- [ ] **Step 1: Full flow test**

Open `upkeep.html` in browser. Run through this complete sequence:

1. Page loads, spinner shows, then cards appear (or empty state)
2. Add item: "Oil Change", Car, every 3 months, last done 2026-01-15
3. Add item: "Haircut", Grooming, every 6 weeks, last done 2026-03-01
4. Add item: "Dentist", Health, every 6 months, no last done date
5. Verify sort order: Oil Change (most overdue) first, then Haircut, then Dentist (no date, last)
6. Verify stats: "3 tracked", overdue count, soon count
7. Filter to "Car"... only Oil Change shows
8. Filter to "Finance"... empty state shows "No Finance items yet"
9. Filter back to "All"
10. Mark Oil Change as done... date updates to today, card moves down in sort
11. Edit Haircut... change frequency to monthly, save
12. Delete Dentist... first click shows "Confirm?", second click deletes
13. Connect Google Calendar... verify events appear in calendar
14. Disconnect Google Calendar
15. Refresh page... all data persists from Notion, GCal shows disconnected

- [ ] **Step 2: Mobile test**

Open in phone or use browser devtools mobile view (375px width):
- Header stacks properly
- Cards are single column
- Modal is usable on small screen
- Filter bar scrolls horizontally
- Toasts are visible

- [ ] **Step 3: Final commit (if any fixes needed)**

```bash
git add upkeep.html
git commit -m "fix: address issues found during smoke test"
```
