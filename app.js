// ================================================================
// CONFIGURATION
// ================================================================
const CONFIG = {
  // Replace with your deployed Apps Script Web App URL
  API_URL: 'https://script.google.com/macros/s/AKfycbxSv0FjYBL_NpWKZp9KDDOXYLLwI3vX0aa5yzBBFwiD6emwYYmIOO5_NCWK5KpSCSaLlQ/exec',
  STORAGE_KEYS: {
    DEVICE_TOKEN: 'upkeep_device_token',
    CACHED_ITEMS: 'upkeep_cached_items',
    CACHE_TIMESTAMP: 'upkeep_cache_ts'
  }
};

// ================================================================
// CATEGORY DEFINITIONS
// ================================================================
const CATEGORIES = {
  'Car':      { color: '#EF4444', soft: '#FEF2F2', icon: '\u{1F697}' },
  'Health':   { color: '#3B82F6', soft: '#EFF6FF', icon: '\u{1F3E5}' },
  'Grooming': { color: '#8B5CF6', soft: '#F5F3FF', icon: '\u2702\uFE0F' },
  'Home':     { color: '#22C55E', soft: '#F0FDF4', icon: '\u{1F3E0}' }
};
const DEFAULT_CATEGORY = { color: '#6B7280', soft: '#F9FAFB', icon: '\u2753' };

function getCategoryInfo(name) {
  return CATEGORIES[name] || DEFAULT_CATEGORY;
}

// ================================================================
// STATE
// ================================================================
let currentItems = [];
let isOnline = navigator.onLine;
let expandedCardId = null;

// ================================================================
// PIN HANDLING
// ================================================================
let pinBuffer = '';

function initPinScreen() {
  var token = localStorage.getItem(CONFIG.STORAGE_KEYS.DEVICE_TOKEN);
  if (token) {
    showDashboard();
    fetchItems(token);
    return;
  }

  document.getElementById('pin-screen').classList.remove('hidden');
  document.querySelectorAll('.pin-key[data-key]').forEach(function(btn) {
    btn.addEventListener('click', function() {
      handlePinKey(btn.dataset.key);
    });
  });
}

function handlePinKey(key) {
  if (key === 'back') {
    pinBuffer = pinBuffer.slice(0, -1);
    document.getElementById('pin-error').textContent = '';
  } else if (pinBuffer.length < 4) {
    pinBuffer += key;
  }
  updatePinDots();
  if (pinBuffer.length === 4) {
    submitPin(pinBuffer);
  }
}

function updatePinDots() {
  document.querySelectorAll('.pin-dot').forEach(function(dot, i) {
    dot.classList.toggle('filled', i < pinBuffer.length);
  });
}

function submitPin(pin) {
  fetch(CONFIG.API_URL + '?action=getItems&pin=' + encodeURIComponent(pin))
    .then(function(response) { return response.json(); })
    .then(function(data) {
      if (data.error) {
        document.getElementById('pin-error').textContent = 'Wrong PIN';
        var dots = document.getElementById('pin-dots');
        dots.classList.add('shake');
        setTimeout(function() {
          dots.classList.remove('shake');
          pinBuffer = '';
          updatePinDots();
        }, 400);
        return;
      }
      if (data.deviceToken) {
        localStorage.setItem(CONFIG.STORAGE_KEYS.DEVICE_TOKEN, data.deviceToken);
      }
      cacheItems(data.items);
      currentItems = data.items;
      showDashboard();
      renderItems(currentItems);
    })
    .catch(function() {
      document.getElementById('pin-error').textContent = 'Connection error';
      pinBuffer = '';
      updatePinDots();
    });
}

// ================================================================
// DATA FETCHING
// ================================================================
function fetchItems(token) {
  showSkeleton(true);
  fetch(CONFIG.API_URL + '?action=getItems&token=' + encodeURIComponent(token))
    .then(function(response) { return response.json(); })
    .then(function(data) {
      if (data.error) {
        localStorage.removeItem(CONFIG.STORAGE_KEYS.DEVICE_TOKEN);
        location.reload();
        return;
      }
      currentItems = data.items;
      cacheItems(data.items);
      isOnline = true;
      document.getElementById('offline-banner').classList.add('hidden');
      showSkeleton(false);
      renderItems(currentItems);
    })
    .catch(function() {
      var cached = getCachedItems();
      if (cached) {
        currentItems = cached;
        isOnline = false;
        document.getElementById('offline-banner').classList.remove('hidden');
        showSkeleton(false);
        renderItems(currentItems);
      } else {
        showSkeleton(false);
        showToast('Unable to load data', 'error');
      }
    });
}

// ================================================================
// CACHING
// ================================================================
function cacheItems(items) {
  try {
    localStorage.setItem(CONFIG.STORAGE_KEYS.CACHED_ITEMS, JSON.stringify(items));
    localStorage.setItem(CONFIG.STORAGE_KEYS.CACHE_TIMESTAMP, Date.now().toString());
  } catch (e) {
    // localStorage full — silently fail
  }
}

function getCachedItems() {
  try {
    var data = localStorage.getItem(CONFIG.STORAGE_KEYS.CACHED_ITEMS);
    return data ? JSON.parse(data) : null;
  } catch (e) {
    return null;
  }
}

// ================================================================
// RENDERING — Safe DOM construction (no innerHTML)
// ================================================================
function renderItems(items) {
  var overdue = items
    .filter(function(i) { return i.daysUntilDue < 0; })
    .sort(function(a, b) { return a.daysUntilDue - b.daysUntilDue; });

  var dueSoon = items
    .filter(function(i) { return i.daysUntilDue >= 0 && i.daysUntilDue <= 7; })
    .sort(function(a, b) { return a.daysUntilDue - b.daysUntilDue; });

  // Overdue section
  var overdueSection = document.getElementById('section-overdue');
  var overdueCards = document.getElementById('overdue-cards');
  if (overdue.length > 0) {
    overdueSection.classList.remove('hidden');
    document.getElementById('overdue-count').textContent = overdue.length;
    clearChildren(overdueCards);
    overdue.forEach(function(item) { overdueCards.appendChild(buildCard(item)); });
  } else {
    overdueSection.classList.add('hidden');
  }

  // Due This Week section
  var dueSoonSection = document.getElementById('section-due-soon');
  var dueSoonCards = document.getElementById('due-soon-cards');
  if (dueSoon.length > 0) {
    dueSoonSection.classList.remove('hidden');
    document.getElementById('due-soon-count').textContent = dueSoon.length;
    clearChildren(dueSoonCards);
    dueSoon.forEach(function(item) { dueSoonCards.appendChild(buildCard(item)); });
  } else {
    dueSoonSection.classList.add('hidden');
  }

  // Category bars
  renderCategoryBars(items);

  // Show content
  document.getElementById('content').classList.remove('hidden');
}

function buildCard(item) {
  var cat = getCategoryInfo(item.category);
  var badge = getBadgeInfo(item);
  var freq = formatFrequency(item.frequencyDays);
  var nextDue = formatDate(item.nextDue);
  var lastDone = item.lastDone ? formatDate(item.lastDone) : 'Never';
  var hasCost = item.lastCost !== null || item.totalCost !== null;
  var hasNotes = item.notes && item.notes.trim().length > 0;

  // Card wrapper
  var card = el('div', 'card');
  card.dataset.id = item.id;

  // --- Collapsed row ---
  var collapsed = el('div', 'card-collapsed');
  collapsed.setAttribute('role', 'button');
  collapsed.setAttribute('tabindex', '0');

  var iconWrap = el('div', 'card-icon');
  iconWrap.style.backgroundColor = cat.soft;
  var iconSpan = el('span');
  iconSpan.style.fontSize = '1.125rem';
  iconSpan.textContent = cat.icon;
  iconWrap.appendChild(iconSpan);

  var info = el('div', 'card-info');
  var nameSpan = el('span', 'card-name');
  nameSpan.textContent = item.name;
  var metaSpan = el('span', 'card-meta');
  metaSpan.textContent = freq + ' \u00B7 Due: ' + nextDue;
  info.appendChild(nameSpan);
  info.appendChild(metaSpan);

  var badgeEl = el('div', 'card-badge badge-' + badge.cls);
  badgeEl.textContent = badge.text;

  collapsed.appendChild(iconWrap);
  collapsed.appendChild(info);
  collapsed.appendChild(badgeEl);

  // --- Expanded details ---
  var expanded = el('div', 'card-expanded hidden');

  // Notes
  if (hasNotes) {
    var notesRow = el('div', 'card-detail card-notes');
    var notesIcon = el('span', 'card-detail-icon');
    notesIcon.textContent = '\u{1F4DD}';
    var notesText = el('span');
    notesText.textContent = item.notes;
    notesRow.appendChild(notesIcon);
    notesRow.appendChild(notesText);
    expanded.appendChild(notesRow);
  }

  // Last done
  var doneRow = el('div', 'card-detail card-last-done');
  var doneIcon = el('span', 'card-detail-icon');
  doneIcon.textContent = '\u{1F4C5}';
  var doneText = el('span');
  doneText.textContent = 'Last done: ' + lastDone;
  doneRow.appendChild(doneIcon);
  doneRow.appendChild(doneText);
  expanded.appendChild(doneRow);

  // Cost
  if (hasCost) {
    var costRow = el('div', 'card-detail card-cost');
    var costIcon = el('span', 'card-detail-icon');
    costIcon.textContent = '\u{1F4B0}';
    var costText = el('span');
    costText.textContent = 'Last: $' + formatCost(item.lastCost) + ' \u00B7 Total: $' + formatCost(item.totalCost);
    costRow.appendChild(costIcon);
    costRow.appendChild(costText);
    expanded.appendChild(costRow);
  }

  // Mark Done button
  var markDoneBtn = el('button', 'btn-mark-done');
  markDoneBtn.style.backgroundColor = cat.color;
  markDoneBtn.textContent = 'Mark Done';
  if (!isOnline) markDoneBtn.disabled = true;
  expanded.appendChild(markDoneBtn);

  // Confirm section
  var confirmSection = el('div', 'mark-done-confirm hidden');

  var costLabel = el('label', 'cost-label');
  costLabel.textContent = 'Cost (optional)';
  confirmSection.appendChild(costLabel);

  var costInput = el('input', 'cost-input');
  costInput.type = 'number';
  costInput.placeholder = '$0.00';
  costInput.step = '0.01';
  costInput.min = '0';
  confirmSection.appendChild(costInput);

  var confirmBtn = el('button', 'btn-confirm');
  confirmBtn.style.backgroundColor = cat.color;
  confirmBtn.textContent = 'Confirm';
  confirmSection.appendChild(confirmBtn);

  expanded.appendChild(confirmSection);

  // --- Event listeners ---
  collapsed.addEventListener('click', function() {
    handleCardToggle(card);
  });
  collapsed.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleCardToggle(card);
    }
  });

  markDoneBtn.addEventListener('click', function(e) {
    e.stopPropagation();
    markDoneBtn.classList.add('hidden');
    confirmSection.classList.remove('hidden');
    costInput.focus();
  });

  confirmBtn.addEventListener('click', function(e) {
    e.stopPropagation();
    var cost = costInput.value ? parseFloat(costInput.value) : null;
    performMarkDone(item.id, cost, confirmBtn);
  });

  // Prevent input clicks from collapsing card
  costInput.addEventListener('click', function(e) { e.stopPropagation(); });

  card.appendChild(collapsed);
  card.appendChild(expanded);
  return card;
}

function renderCategoryBars(items) {
  var byCategory = {};
  items.forEach(function(item) {
    var cat = item.category || 'Unknown';
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(item);
  });

  var order = ['Car', 'Health', 'Grooming', 'Home'];
  var sorted = order.filter(function(c) { return byCategory[c]; });
  Object.keys(byCategory).forEach(function(c) {
    if (sorted.indexOf(c) === -1) sorted.push(c);
  });

  var container = document.getElementById('category-bars');
  clearChildren(container);

  sorted.forEach(function(catName) {
    var catItems = byCategory[catName];
    var catInfo = getCategoryInfo(catName);
    var overdueCount = catItems.filter(function(i) { return i.daysUntilDue < 0; }).length;
    var overdueText = overdueCount > 0 ? ' \u00B7 ' + overdueCount + ' overdue' : '';
    var sortedItems = catItems.slice().sort(function(a, b) { return a.daysUntilDue - b.daysUntilDue; });

    var bar = el('div', 'category-bar');
    bar.dataset.category = catName;

    var header = el('button', 'category-bar-header');
    header.style.backgroundColor = catInfo.color;

    var iconEl = el('span', 'category-bar-icon');
    iconEl.textContent = catInfo.icon;
    var nameEl = el('span', 'category-bar-name');
    nameEl.textContent = catName;
    var countsEl = el('span', 'category-bar-counts');
    countsEl.textContent = catItems.length + ' item' + (catItems.length !== 1 ? 's' : '') + overdueText;
    var chevronEl = el('span', 'category-bar-chevron');
    chevronEl.textContent = '\u25BC';

    header.appendChild(iconEl);
    header.appendChild(nameEl);
    header.appendChild(countsEl);
    header.appendChild(chevronEl);

    var content = el('div', 'category-bar-content hidden');
    var cardList = el('div', 'card-list');
    sortedItems.forEach(function(item) { cardList.appendChild(buildCard(item)); });
    content.appendChild(cardList);

    header.addEventListener('click', function() {
      bar.classList.toggle('open');
      content.classList.toggle('hidden');
    });

    bar.appendChild(header);
    bar.appendChild(content);
    container.appendChild(bar);
  });
}

// ================================================================
// CARD TOGGLE
// ================================================================
function handleCardToggle(card) {
  var expanded = card.querySelector('.card-expanded');
  var wasOpen = !expanded.classList.contains('hidden');

  // Close previously open card
  if (expandedCardId && expandedCardId !== card.dataset.id) {
    var prev = document.querySelector('.card[data-id="' + expandedCardId + '"] .card-expanded');
    if (prev) prev.classList.add('hidden');
    var prevCard = document.querySelector('.card[data-id="' + expandedCardId + '"]');
    if (prevCard) resetMarkDoneState(prevCard);
  }

  expanded.classList.toggle('hidden');
  expandedCardId = wasOpen ? null : card.dataset.id;

  if (wasOpen) resetMarkDoneState(card);
}

function resetMarkDoneState(card) {
  var markDoneBtn = card.querySelector('.btn-mark-done');
  var confirmSection = card.querySelector('.mark-done-confirm');
  if (markDoneBtn) markDoneBtn.classList.remove('hidden');
  if (confirmSection) {
    confirmSection.classList.add('hidden');
    var input = confirmSection.querySelector('.cost-input');
    if (input) input.value = '';
  }
}

// ================================================================
// BADGE LOGIC
// ================================================================
function getBadgeInfo(item) {
  var d = item.daysUntilDue;
  if (d < 0) return { cls: 'overdue', text: Math.abs(d) + 'd overdue' };
  if (d <= 7) return { cls: 'due-soon', text: d + 'd left' };
  if (d <= 30) return { cls: 'coming-up', text: 'in ' + d + 'd' };
  return { cls: 'good', text: 'in ' + d + 'd' };
}

// ================================================================
// MARK DONE
// ================================================================
function performMarkDone(itemId, cost, confirmBtn) {
  if (!isOnline) {
    showToast('Cannot mark done while offline', 'error');
    return;
  }

  confirmBtn.classList.add('btn-loading');

  var token = localStorage.getItem(CONFIG.STORAGE_KEYS.DEVICE_TOKEN);
  var url = CONFIG.API_URL + '?action=markDone&token=' + encodeURIComponent(token) + '&itemId=' + encodeURIComponent(itemId);
  if (cost !== null) url += '&cost=' + cost;

  fetch(url)
    .then(function(response) { return response.json(); })
    .then(function(data) {
      confirmBtn.classList.remove('btn-loading');
      if (data.success) {
        if (data.calendarSynced === false) {
          showToast('Done \u2014 but calendar sync failed', 'error');
        } else {
          showToast('Item marked done \u2713');
        }
        expandedCardId = null;
        fetchItems(token);
      } else {
        showToast("Couldn\u2019t save \u2014 try again", 'error');
      }
    })
    .catch(function() {
      confirmBtn.classList.remove('btn-loading');
      showToast("Couldn\u2019t save \u2014 try again", 'error');
    });
}

// ================================================================
// UI HELPERS
// ================================================================
function showDashboard() {
  document.getElementById('pin-screen').classList.add('hidden');
  document.getElementById('dashboard').classList.remove('hidden');
  setHeaderDate();
}

function setHeaderDate() {
  var now = new Date();
  var formatted = now.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric'
  });
  document.getElementById('header-date').textContent = formatted;
}

function showSkeleton(show) {
  document.getElementById('skeleton').classList.toggle('hidden', !show);
  if (show) {
    document.getElementById('content').classList.add('hidden');
  }
}

function showToast(message, type) {
  var container = document.getElementById('toast-container');
  var toast = document.createElement('div');
  toast.className = 'toast' + (type === 'error' ? ' toast-error' : '');
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(function() {
    if (toast.parentNode) toast.remove();
  }, 3200);
}

// ================================================================
// DOM HELPERS
// ================================================================
function el(tag, className) {
  var element = document.createElement(tag);
  if (className) element.className = className;
  return element;
}

function clearChildren(parent) {
  while (parent.firstChild) {
    parent.removeChild(parent.firstChild);
  }
}

// ================================================================
// FORMATTING HELPERS
// ================================================================
function formatFrequency(days) {
  if (days >= 365 && days % 365 === 0) return 'Every ' + (days / 365) + ' year' + (days / 365 > 1 ? 's' : '');
  if (days >= 30 && days % 30 === 0) return 'Every ' + (days / 30) + ' month' + (days / 30 > 1 ? 's' : '');
  if (days >= 7 && days % 7 === 0) return 'Every ' + (days / 7) + ' week' + (days / 7 > 1 ? 's' : '');
  return 'Every ' + days + ' days';
}

function formatDate(isoString) {
  if (!isoString) return 'N/A';
  var d = new Date(isoString + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatCost(value) {
  if (value === null || value === undefined) return '0.00';
  return value.toFixed(2);
}

// ================================================================
// OFFLINE DETECTION
// ================================================================
window.addEventListener('online', function() {
  isOnline = true;
  document.getElementById('offline-banner').classList.add('hidden');
  // Re-enable Mark Done buttons
  document.querySelectorAll('.btn-mark-done').forEach(function(btn) {
    btn.disabled = false;
  });
  var token = localStorage.getItem(CONFIG.STORAGE_KEYS.DEVICE_TOKEN);
  if (token) fetchItems(token);
});

window.addEventListener('offline', function() {
  isOnline = false;
  document.getElementById('offline-banner').classList.remove('hidden');
  document.querySelectorAll('.btn-mark-done').forEach(function(btn) {
    btn.disabled = true;
  });
});

// ================================================================
// INIT
// ================================================================
document.addEventListener('DOMContentLoaded', function() {
  initPinScreen();

  // Register service worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js')
      .catch(function() { /* SW registration failed — app still works */ });
  }
});
