// HolodexPlus — Popup script

const channelListEl = document.getElementById('channelList');
const emptyHint     = document.getElementById('emptyHint');
const newChannelEl  = document.getElementById('newChannel');
const addBtn        = document.getElementById('addBtn');
const optionsBtn    = document.getElementById('optionsBtn');
const clearBtn      = document.getElementById('clearBtn');
const lastCheckEl   = document.getElementById('lastCheck');
const optionsLink   = document.getElementById('optionsLink');

// ── Init ──────────────────────────────────────────────────────────────────────

loadAndRender();

// Refresh last-check time
chrome.storage.local.get('lastCheck', ({ lastCheck }) => {
  if (lastCheck) {
    lastCheckEl.textContent = new Date(lastCheck).toLocaleTimeString('zh-TW');
  }
});

// ── Render ────────────────────────────────────────────────────────────────────

async function loadAndRender() {
  const { watchedChannels = [] } = await chrome.storage.local.get('watchedChannels');
  renderList(watchedChannels);
}

function renderList(channels) {
  // Remove all items except the empty-hint template
  [...channelListEl.querySelectorAll('li:not(#emptyHint)')].forEach(el => el.remove());

  if (channels.length === 0) {
    emptyHint.style.display = '';
    return;
  }

  emptyHint.style.display = 'none';
  channels.forEach((ch) => {
    const li = document.createElement('li');
    li.textContent = ch;

    const btn = document.createElement('button');
    btn.className = 'remove-btn';
    btn.textContent = '✕';
    btn.title = '移除';
    btn.addEventListener('click', () => removeChannel(ch));

    li.appendChild(btn);
    channelListEl.appendChild(li);
  });
}

// ── Add / Remove ─────────────────────────────────────────────────────────────

addBtn.addEventListener('click', addChannel);
newChannelEl.addEventListener('keydown', (e) => { if (e.key === 'Enter') addChannel(); });

async function addChannel() {
  const val = newChannelEl.value.trim();
  if (!val) return;

  const { watchedChannels = [] } = await chrome.storage.local.get('watchedChannels');
  if (watchedChannels.includes(val)) {
    newChannelEl.value = '';
    return;
  }

  watchedChannels.push(val);
  await chrome.storage.local.set({ watchedChannels });
  newChannelEl.value = '';
  renderList(watchedChannels);
}

async function removeChannel(name) {
  const { watchedChannels = [] } = await chrome.storage.local.get('watchedChannels');
  const updated = watchedChannels.filter(ch => ch !== name);
  await chrome.storage.local.set({ watchedChannels: updated });
  renderList(updated);
}

// ── Buttons ───────────────────────────────────────────────────────────────────

optionsBtn.addEventListener('click', () => chrome.runtime.openOptionsPage());
optionsLink.addEventListener('click', (e) => { e.preventDefault(); chrome.runtime.openOptionsPage(); });

clearBtn.addEventListener('click', async () => {
  if (!confirm('確定清除所有已開啟記錄？')) return;
  await chrome.runtime.sendMessage({ type: 'CLEAR_OPENED_STREAMS' });
  alert('已清除記錄。');
});
