// HolodexPlus — Options page script

const channelTagsEl      = document.getElementById('channelTags');
const newChannelEl       = document.getElementById('newChannel');
const addChannelBtn      = document.getElementById('addChannelBtn');
const topicTagsEl        = document.getElementById('topicTags');
const newTopicEl         = document.getElementById('newTopic');
const addTopicBtn        = document.getElementById('addTopicBtn');
const keywordTagsEl      = document.getElementById('keywordTags');
const newKeywordEl       = document.getElementById('newKeyword');
const addKeywordBtn      = document.getElementById('addKeywordBtn');
const preStartMinEl      = document.getElementById('preStartMin');
const reopenMinEl        = document.getElementById('reopenMin');
const autoplayEnabledEl  = document.getElementById('autoplayEnabled');
const activeTabEl        = document.getElementById('activeTab');
const notificationsEl    = document.getElementById('notificationsEnabled');
const saveBtn            = document.getElementById('saveBtn');
const saveStatusEl       = document.getElementById('saveStatus');

let channels = [];
let topics   = [];
let keywords = [];

// ── Init ──────────────────────────────────────────────────────────────────────

(async () => {
  const data = await chrome.storage.local.get([
    'watchedChannels', 'watchedTopics', 'watchedKeywords', 'preStartMin', 'reopenMin',
    'autoplayEnabled', 'activeTab', 'notificationsEnabled',
  ]);

  channels = (data.watchedChannels ?? []).map(ch =>
    typeof ch === 'string' ? { name: ch, checkMentions: false } : ch);
  topics   = data.watchedTopics    ?? [];
  keywords = data.watchedKeywords  ?? [];
  preStartMinEl.value       = data.preStartMin           ?? 3;
  reopenMinEl.value         = data.reopenMin             ?? 10;
  autoplayEnabledEl.checked = data.autoplayEnabled       ?? true;
  activeTabEl.checked       = data.activeTab             ?? false;
  notificationsEl.checked   = data.notificationsEnabled  ?? true;

  renderTags();
  renderTopicTags();
  renderKeywordTags();
})();

// Close any open per-channel dropdown when clicking outside
document.addEventListener('click', () => {
  document.querySelectorAll('.tag-dropdown.open').forEach(d => d.classList.remove('open'));
});

// ── Channel tags ──────────────────────────────────────────────────────────────

function renderTags() {
  channelTagsEl.innerHTML = '';
  if (channels.length === 0) {
    channelTagsEl.innerHTML = '<span style="color:#6b7280;font-size:13px;">尚未新增頻道</span>';
    return;
  }
  channels.forEach((entry) => {
    const wrap = document.createElement('div');
    wrap.className = 'tag-wrap';

    const tag = document.createElement('span');
    tag.className = 'tag';
    tag.appendChild(document.createTextNode(entry.name));

    // Gear button
    const gearBtn = document.createElement('button');
    gearBtn.className   = 'tag-opts-btn';
    gearBtn.textContent = '⚙';
    gearBtn.title       = '選項';

    // Dropdown panel
    const dropdown = document.createElement('div');
    dropdown.className = 'tag-dropdown';

    const mentionsLabel = document.createElement('label');
    const mentionsCheck = document.createElement('input');
    mentionsCheck.type    = 'checkbox';
    mentionsCheck.checked = entry.checkMentions ?? false;
    mentionsCheck.addEventListener('change', () => { entry.checkMentions = mentionsCheck.checked; });
    mentionsLabel.appendChild(mentionsCheck);
    mentionsLabel.appendChild(document.createTextNode(' 偵測 mentions（被提及時也開啟）'));
    dropdown.appendChild(mentionsLabel);

    gearBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      document.querySelectorAll('.tag-dropdown.open').forEach(d => { if (d !== dropdown) d.classList.remove('open'); });
      dropdown.classList.toggle('open');
    });

    const removeBtn = document.createElement('button');
    removeBtn.className   = 'remove-tag';
    removeBtn.textContent = '✕';
    removeBtn.title       = '移除';
    removeBtn.addEventListener('click', () => {
      channels = channels.filter(c => c !== entry);
      renderTags();
    });

    tag.appendChild(gearBtn);
    tag.appendChild(removeBtn);
    wrap.appendChild(tag);
    wrap.appendChild(dropdown);
    channelTagsEl.appendChild(wrap);
  });
}

addChannelBtn.addEventListener('click', addChannel);
newChannelEl.addEventListener('keydown', (e) => { if (e.key === 'Enter') addChannel(); });

function addChannel() {
  const val = newChannelEl.value.trim();
  if (!val || channels.some(c => c.name === val)) { newChannelEl.value = ''; return; }
  channels.push({ name: val, checkMentions: false });
  newChannelEl.value = '';
  renderTags();
}

// ── Topic tags ────────────────────────────────────────────────────────────────

function renderTopicTags() {
  topicTagsEl.innerHTML = '';
  if (topics.length === 0) {
    topicTagsEl.innerHTML = '<span style="color:#6b7280;font-size:13px;">尚未新增標籤</span>';
    return;
  }
  topics.forEach((t) => {
    const tag = document.createElement('span');
    tag.className = 'tag';
    const name = document.createTextNode(t);
    const btn  = document.createElement('button');
    btn.className   = 'remove-tag';
    btn.textContent = '✕';
    btn.title       = '移除';
    btn.addEventListener('click', () => {
      topics = topics.filter(x => x !== t);
      renderTopicTags();
    });
    tag.appendChild(name);
    tag.appendChild(btn);
    topicTagsEl.appendChild(tag);
  });
}

addTopicBtn.addEventListener('click', addTopic);
newTopicEl.addEventListener('keydown', (e) => { if (e.key === 'Enter') addTopic(); });

function addTopic() {
  const val = newTopicEl.value.trim();
  if (!val || topics.includes(val)) { newTopicEl.value = ''; return; }
  topics.push(val);
  newTopicEl.value = '';
  renderTopicTags();
}

// ── Keyword tags ──────────────────────────────────────────────────────────────

function renderKeywordTags() {
  keywordTagsEl.innerHTML = '';
  if (keywords.length === 0) {
    keywordTagsEl.innerHTML = '<span style="color:#6b7280;font-size:13px;">尚未新增關鍵字</span>';
    return;
  }
  keywords.forEach((k) => {
    const tag = document.createElement('span');
    tag.className = 'tag';
    const name = document.createTextNode(k);
    const btn  = document.createElement('button');
    btn.className   = 'remove-tag';
    btn.textContent = '✕';
    btn.title       = '移除';
    btn.addEventListener('click', () => {
      keywords = keywords.filter(x => x !== k);
      renderKeywordTags();
    });
    tag.appendChild(name);
    tag.appendChild(btn);
    keywordTagsEl.appendChild(tag);
  });
}

addKeywordBtn.addEventListener('click', addKeyword);
newKeywordEl.addEventListener('keydown', (e) => { if (e.key === 'Enter') addKeyword(); });

function addKeyword() {
  const val = newKeywordEl.value.trim();
  if (!val || keywords.includes(val)) { newKeywordEl.value = ''; return; }
  keywords.push(val);
  newKeywordEl.value = '';
  renderKeywordTags();
}

// ── Save ──────────────────────────────────────────────────────────────────────

saveBtn.addEventListener('click', async () => {
  const preStartMin = parseInt(preStartMinEl.value, 10) || 3;
  const reopenMin   = parseInt(reopenMinEl.value,   10) || 10;

  await chrome.storage.local.set({
    watchedChannels:      channels,
    watchedTopics:        topics,
    watchedKeywords:      keywords,
    preStartMin,
    reopenMin,
    autoplayEnabled:      autoplayEnabledEl.checked,
    activeTab:            activeTabEl.checked,
    notificationsEnabled: notificationsEl.checked,
  });

  // Tell background to reload thresholds on next poll
  chrome.runtime.sendMessage({ type: 'SETTINGS_UPDATED' });

  saveStatusEl.textContent = '✓ 設定已儲存';
  setTimeout(() => { saveStatusEl.textContent = ''; }, 2500);
});
