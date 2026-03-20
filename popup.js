// HolodexPlus — Popup script

const channelListEl = document.getElementById('channelList');
const emptyHint     = document.getElementById('emptyHint');
const newChannelEl  = document.getElementById('newChannel');
const addBtn        = document.getElementById('addBtn');
const topicListEl      = document.getElementById('topicList');
const topicEmptyHint   = document.getElementById('topicEmptyHint');
const newTopicEl       = document.getElementById('newTopic');
const addTopicBtn      = document.getElementById('addTopicBtn');
const keywordListEl    = document.getElementById('keywordList');
const keywordEmptyHint = document.getElementById('keywordEmptyHint');
const newKeywordEl     = document.getElementById('newKeyword');
const addKeywordBtn    = document.getElementById('addKeywordBtn');
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
  const { watchedChannels = [], watchedTopics = [], watchedKeywords = [] } =
    await chrome.storage.local.get(['watchedChannels', 'watchedTopics', 'watchedKeywords']);
  renderList(watchedChannels);
  renderTopicList(watchedTopics);
  renderKeywordList(watchedKeywords);
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

// ── Topic list ─────────────────────────────────────────────────────────────────

function renderTopicList(topics) {
  [...topicListEl.querySelectorAll('li:not(#topicEmptyHint)')].forEach(el => el.remove());
  if (topics.length === 0) { topicEmptyHint.style.display = ''; return; }
  topicEmptyHint.style.display = 'none';
  topics.forEach((t) => {
    const li  = document.createElement('li');
    li.textContent = t;
    const btn = document.createElement('button');
    btn.className   = 'remove-btn';
    btn.textContent = '✕';
    btn.title       = '移除';
    btn.addEventListener('click', () => removeTopic(t));
    li.appendChild(btn);
    topicListEl.appendChild(li);
  });
}

addTopicBtn.addEventListener('click', addTopic);
newTopicEl.addEventListener('keydown', (e) => { if (e.key === 'Enter') addTopic(); });

async function addTopic() {
  const val = newTopicEl.value.trim();
  if (!val) return;
  const { watchedTopics = [] } = await chrome.storage.local.get('watchedTopics');
  if (watchedTopics.includes(val)) { newTopicEl.value = ''; return; }
  watchedTopics.push(val);
  await chrome.storage.local.set({ watchedTopics });
  newTopicEl.value = '';
  renderTopicList(watchedTopics);
}

async function removeTopic(name) {
  const { watchedTopics = [] } = await chrome.storage.local.get('watchedTopics');
  const updated = watchedTopics.filter(t => t !== name);
  await chrome.storage.local.set({ watchedTopics: updated });
  renderTopicList(updated);
}

// ── Keyword list ──────────────────────────────────────────────────────────────

function renderKeywordList(keywords) {
  [...keywordListEl.querySelectorAll('li:not(#keywordEmptyHint)')].forEach(el => el.remove());
  if (keywords.length === 0) { keywordEmptyHint.style.display = ''; return; }
  keywordEmptyHint.style.display = 'none';
  keywords.forEach((k) => {
    const li  = document.createElement('li');
    li.textContent = k;
    const btn = document.createElement('button');
    btn.className   = 'remove-btn';
    btn.textContent = '✕';
    btn.title       = '移除';
    btn.addEventListener('click', () => removeKeyword(k));
    li.appendChild(btn);
    keywordListEl.appendChild(li);
  });
}

addKeywordBtn.addEventListener('click', addKeyword);
newKeywordEl.addEventListener('keydown', (e) => { if (e.key === 'Enter') addKeyword(); });

async function addKeyword() {
  const val = newKeywordEl.value.trim();
  if (!val) return;
  const { watchedKeywords = [] } = await chrome.storage.local.get('watchedKeywords');
  if (watchedKeywords.includes(val)) { newKeywordEl.value = ''; return; }
  watchedKeywords.push(val);
  await chrome.storage.local.set({ watchedKeywords });
  newKeywordEl.value = '';
  renderKeywordList(watchedKeywords);
}

async function removeKeyword(name) {
  const { watchedKeywords = [] } = await chrome.storage.local.get('watchedKeywords');
  const updated = watchedKeywords.filter(k => k !== name);
  await chrome.storage.local.set({ watchedKeywords: updated });
  renderKeywordList(updated);
}

// ── Buttons ───────────────────────────────────────────────────────────────────

optionsBtn.addEventListener('click', () => chrome.runtime.openOptionsPage());
optionsLink.addEventListener('click', (e) => { e.preventDefault(); chrome.runtime.openOptionsPage(); });

clearBtn.addEventListener('click', async () => {
  if (!confirm('確定清除所有已開啟記錄？')) return;
  await chrome.runtime.sendMessage({ type: 'CLEAR_OPENED_STREAMS' });
  alert('已清除記錄。');
});
