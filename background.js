// HolodexPlusExtension — background.js (Service Worker)
// Receives intercepted API data from content.js and opens watch tabs as needed.
// Also runs a per-minute alarm so time-based rules fire even when the Holodex
// page hasn't issued a fresh API call, reusing the last cached response.

const TICK_ALARM            = 'holodexPlusExtensionTick';
const OPENED_STREAM_TTL_MS  = 6  * 60 * 60 * 1000;  // 6 hours
const LAST_STREAMS_TTL_MS   = 2  * 60 * 60 * 1000;  // 2 hours (stale guard)
const MAX_MANUAL_CLOSES     = 2;                     // stop reopening after this many manual closes

// ── Alarm setup ───────────────────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create(TICK_ALARM, { periodInMinutes: 1 });
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === TICK_ALARM) tickCheck();
});

async function tickCheck() {
  const { lastStreams, lastStreamsAt } = await chrome.storage.local.get(['lastStreams', 'lastStreamsAt']);
  if (!Array.isArray(lastStreams) || lastStreams.length === 0) return;
  // Don't re-evaluate stale data — if the holodex page hasn't refreshed in 2 h
  // the schedule is likely outdated and we'd risk acting on stale info.
  if (lastStreamsAt && (Date.now() - lastStreamsAt) > LAST_STREAMS_TTL_MS) return;
  await handleStreams(lastStreams);
}

// ── Message handler ───────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'API_DATA') {
    // Cache the latest streams (with timestamp) so the alarm tick can reuse them
    chrome.storage.local.set({ lastStreams: msg.streams, lastStreamsAt: Date.now() });
    handleStreams(msg.streams).catch(console.error);
    sendResponse({ ok: true });
    return;
  }
  if (msg.type === 'CLEAR_OPENED_STREAMS') {
    chrome.storage.local.set({ openedStreams: {} }).then(() => sendResponse({ ok: true }));
    return true;
  }
  if (msg.type === 'SETTINGS_UPDATED') {
    sendResponse({ ok: true });
  }
});

// ── Tab close tracking ────────────────────────────────────────────────────────

chrome.tabs.onRemoved.addListener(async (tabId) => {
  const { openedStreams } = await chrome.storage.local.get('openedStreams');
  if (!openedStreams) return;
  let dirty = false;
  let hitRec = null;
  for (const rec of Object.values(openedStreams)) {
    if (rec.tabId === tabId) {
      rec.closeCount = (rec.closeCount ?? 0) + 1;
      delete rec.tabId;
      dirty = true;
      hitRec = rec;
      break;
    }
  }
  if (dirty) await chrome.storage.local.set({ openedStreams });

  // When threshold reached, record channel as blacklist candidate (if not already watched)
  if (hitRec && (hitRec.closeCount ?? 0) >= MAX_MANUAL_CLOSES && hitRec.channelId) {
    const extra = await chrome.storage.local.get(['watchedChannels', 'closedChannels', 'blacklistedChannels']);
    const normWatched = (extra.watchedChannels ?? []).map(ch =>
      (typeof ch === 'string' ? ch : ch.name).toLowerCase());
    const cName    = (hitRec.channelName        || '').toLowerCase();
    const cEngName = (hitRec.channelEnglishName || '').toLowerCase();
    const isWatched = normWatched.some(n =>
      (cName && n === cName) || (cEngName && n === cEngName));
    const blacklisted = extra.blacklistedChannels ?? [];
    if (!isWatched && !blacklisted.some(b => b.id === hitRec.channelId)) {
      const closed = extra.closedChannels ?? {};
      closed[hitRec.channelId] = {
        name:        hitRec.channelName        || '',
        englishName: hitRec.channelEnglishName || '',
        org:         hitRec.channelOrg         || '',
      };
      await chrome.storage.local.set({ closedChannels: closed });
    }
  }
});

// ── Core logic ────────────────────────────────────────────────────────────────

async function handleStreams(streams) {
  if (!Array.isArray(streams) || streams.length === 0) return;

  const data = await chrome.storage.local.get([
    'watchedChannels', 'watchedTopics', 'watchedKeywords', 'openedStreams',
    'preStartMin', 'reopenMin', 'activeTab', 'notificationsEnabled', 'topicKeywordOrg', 'blacklistedChannels',
  ]);

  // Normalize: migrate legacy string[] format to object[]
  const watchedChannels = (data.watchedChannels ?? []).map(ch =>
    typeof ch === 'string' ? { name: ch, checkMentions: false } : ch);
  const watchedTopics    = data.watchedTopics    ?? [];
  const watchedKeywords  = data.watchedKeywords  ?? [];
  if (watchedChannels.length === 0 && watchedTopics.length === 0 && watchedKeywords.length === 0) return;

  const openedStreams = data.openedStreams ?? {};
  const preStartMs   = (data.preStartMin  ?? 3)  * 60 * 1000;
  const reopenMs     = (data.reopenMin    ?? 10) * 60 * 1000;
  const activeTab           = data.activeTab             ?? false;
  const showNotif           = data.notificationsEnabled  ?? true;
  const topicKeywordOrg     = data.topicKeywordOrg       ?? 'Hololive';
  const blacklistedChannels = data.blacklistedChannels   ?? [];

  const now   = Date.now();
  let   dirty = false;

  // Purge entries older than OPENED_STREAM_TTL_MS to prevent unbounded growth
  const purgeBefore = now - OPENED_STREAM_TTL_MS;
  for (const id of Object.keys(openedStreams)) {
    if ((openedStreams[id].openedAt ?? 0) < purgeBefore) {
      delete openedStreams[id];
      dirty = true;
    }
  }

  for (const stream of streams) {
    if (!isWatchedStream(stream, watchedChannels, watchedTopics, watchedKeywords, topicKeywordOrg, blacklistedChannels)) continue;

    const streamId   = stream.id;
    const watchUrl   = `https://holodex.net/watch/${streamId}`;
    const channelId  = stream.channel?.id ?? streamId;

    const startScheduled = stream.start_scheduled
      ? new Date(stream.start_scheduled).getTime() : null;
    const startActual    = stream.start_actual
      ? new Date(stream.start_actual).getTime()    : null;

    if (!evaluateShouldOpen(streamId, now, startScheduled, startActual, openedStreams, preStartMs, reopenMs)) {
      continue;
    }

    // Skip if a tab with this URL is already open (user may have opened it manually)
    if (await isTabOpen(watchUrl)) {
      openedStreams[streamId] = {
        ...(openedStreams[streamId] ?? {}), channelId, openedAt: now,
        channelName: stream.channel?.name || '', channelEnglishName: stream.channel?.english_name || '',
        channelOrg:  stream.channel?.org  || '',
      };
      dirty = true;
      continue;
    }

    try {
      const newTab = await chrome.tabs.create({ url: watchUrl, active: activeTab });
      console.log('[HolodexPlusExtension] Opened tab for:', streamId, stream.title);
      openedStreams[streamId] = {
        ...(openedStreams[streamId] ?? {}), channelId, openedAt: now, tabId: newTab.id,
        channelName: stream.channel?.name || '', channelEnglishName: stream.channel?.english_name || '',
        channelOrg:  stream.channel?.org  || '',
      };
      dirty = true;

      if (showNotif) {
        chrome.notifications.create(`stream_${streamId}`, {
          type:     'basic',
          iconUrl:  stream.channel?.photo || 'icons/icon128.png',
          title:    'HolodexPlusExtension — 直播開始',
          message:  `${displayName(stream.channel)} 的直播已自動開啟`,
        });
      }
    } catch (e) {
      console.error('[HolodexPlusExtension] Failed to open tab:', e);
    }
  }

  if (dirty) {
    await chrome.storage.local.set({ openedStreams, lastCheck: now });
  } else {
    await chrome.storage.local.set({ lastCheck: now });
  }
}

// ── Decision logic ────────────────────────────────────────────────────────────

/**
 * Returns true if a tab should be opened for this stream right now.
 *
 * Never-opened streams:
 *   Open when (start_scheduled - now) ≤ preStartMs  OR  start_actual has passed.
 *
 * Previously-opened streams (tab was closed):
 *   Re-open only if start_actual exists and (now - start_actual) < reopenMs.
 *   If the tab is still open the caller short-circuits before reaching here.
 */
function evaluateShouldOpen(streamId, now, startScheduled, startActual, openedStreams, preStartMs, reopenMs) {
  const record = openedStreams[streamId];

  if (record) {
    if ((record.closeCount ?? 0) >= MAX_MANUAL_CLOSES) return false;
    if (!startActual) return false;
    return (now - startActual) < reopenMs;
  }

  if (startScheduled !== null && (startScheduled - now) <= preStartMs) return true;
  if (startActual    !== null && startActual <= now)                    return true;
  return false;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function isWatchedStream(stream, watchedChannels, watchedTopics, watchedKeywords, topicKeywordOrg, blacklistedChannels) {
  // Match by channel name / english_name / id (each entry is {name, checkMentions})
  if (watchedChannels.length > 0) {
    const ch      = stream.channel;
    const name    = (ch?.name         || '').toLowerCase();
    const engName = (ch?.english_name || '').toLowerCase();
    const chId    = (ch?.id           || '').toLowerCase();
    const matchedEntry = watchedChannels.find((entry) => {
      const wl = entry.name.toLowerCase();
      return name === wl || engName === wl || chId === wl;
    });
    if (matchedEntry) return true;

    // Match by mentions array — only for channels with checkMentions enabled
    if (Array.isArray(stream.mentions)) {
      const mentionEnabled = watchedChannels.filter(e => e.checkMentions);
      if (mentionEnabled.length > 0 && stream.mentions.some((m) => {
        const mn  = (m?.name         || '').toLowerCase();
        const men = (m?.english_name || '').toLowerCase();
        const mid = (m?.id           || '').toLowerCase();
        return mentionEnabled.some((entry) => {
          const wl = entry.name.toLowerCase();
          return mn === wl || men === wl || mid === wl;
        });
      })) return true;
    }
  }
  // Blacklist blocks topic_id and keyword matches (direct channel-name watches above are unaffected)
  const chId = stream.channel?.id || '';
  if (blacklistedChannels.length > 0 && chId && blacklistedChannels.some(b => b.id === chId)) return false;

  // org restriction applies to topic_id and keyword matches (not channel-name matches)
  const orgFilter = (topicKeywordOrg || '').trim().toLowerCase();
  const streamOrg = (stream.channel?.org || '').toLowerCase();
  const orgMatch  = !orgFilter || streamOrg === orgFilter;

  // Match by topic_id (exact)
  if (orgMatch && watchedTopics.length > 0) {
    const topicId = (stream.topic_id || '').toLowerCase();
    if (topicId && watchedTopics.some((t) => t.toLowerCase() === topicId)) return true;
  }
  // Match by title keyword (substring)
  if (orgMatch && watchedKeywords.length > 0) {
    const title = (stream.title || '').toLowerCase();
    if (title && watchedKeywords.some((k) => title.includes(k.toLowerCase()))) return true;
  }
  return false;
}

function displayName(channel) {
  return channel?.english_name || channel?.name || 'Unknown';
}

async function isTabOpen(url) {
  const tabs = await chrome.tabs.query({ url: `${url}*` });
  return tabs.length > 0;
}
