// HolodexPlus — Options page script

const channelTagsEl      = document.getElementById('channelTags');
const newChannelEl       = document.getElementById('newChannel');
const addChannelBtn      = document.getElementById('addChannelBtn');
const preStartMinEl      = document.getElementById('preStartMin');
const reopenMinEl        = document.getElementById('reopenMin');
const autoplayEnabledEl  = document.getElementById('autoplayEnabled');
const activeTabEl        = document.getElementById('activeTab');
const notificationsEl    = document.getElementById('notificationsEnabled');
const saveBtn            = document.getElementById('saveBtn');
const saveStatusEl       = document.getElementById('saveStatus');

let channels = [];

// ── Init ──────────────────────────────────────────────────────────────────────

(async () => {
  const data = await chrome.storage.local.get([
    'watchedChannels', 'preStartMin', 'reopenMin',
    'autoplayEnabled', 'activeTab', 'notificationsEnabled',
  ]);

  channels = data.watchedChannels ?? [];
  preStartMinEl.value       = data.preStartMin           ?? 3;
  reopenMinEl.value         = data.reopenMin             ?? 10;
  autoplayEnabledEl.checked = data.autoplayEnabled       ?? true;
  activeTabEl.checked       = data.activeTab             ?? false;
  notificationsEl.checked   = data.notificationsEnabled  ?? true;

  renderTags();
})();

// ── Channel tags ──────────────────────────────────────────────────────────────

function renderTags() {
  channelTagsEl.innerHTML = '';
  if (channels.length === 0) {
    channelTagsEl.innerHTML = '<span style="color:#6b7280;font-size:13px;">尚未新增頻道</span>';
    return;
  }
  channels.forEach((ch) => {
    const tag = document.createElement('span');
    tag.className = 'tag';

    const name = document.createTextNode(ch);
    const btn  = document.createElement('button');
    btn.className   = 'remove-tag';
    btn.textContent = '✕';
    btn.title       = '移除';
    btn.addEventListener('click', () => {
      channels = channels.filter(c => c !== ch);
      renderTags();
    });

    tag.appendChild(name);
    tag.appendChild(btn);
    channelTagsEl.appendChild(tag);
  });
}

addChannelBtn.addEventListener('click', addChannel);
newChannelEl.addEventListener('keydown', (e) => { if (e.key === 'Enter') addChannel(); });

function addChannel() {
  const val = newChannelEl.value.trim();
  if (!val || channels.includes(val)) { newChannelEl.value = ''; return; }
  channels.push(val);
  newChannelEl.value = '';
  renderTags();
}

// ── Save ──────────────────────────────────────────────────────────────────────

saveBtn.addEventListener('click', async () => {
  const preStartMin = parseInt(preStartMinEl.value, 10) || 3;
  const reopenMin   = parseInt(reopenMinEl.value,   10) || 10;

  await chrome.storage.local.set({
    watchedChannels:      channels,
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
