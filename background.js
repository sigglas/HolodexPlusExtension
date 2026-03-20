// HolodexPlus — background.js (Service Worker)
// Receives intercepted API data from content.js and opens watch tabs as needed.
// No direct API calls are made — the extension piggybacks on requests the
// holodex.net page already makes with the user's authenticated session.

// ── Message handler ───────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'API_DATA') {
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

// ── Core logic ────────────────────────────────────────────────────────────────

async function handleStreams(streams) {
  if (!Array.isArray(streams) || streams.length === 0) return;

  const data = await chrome.storage.local.get([
    'watchedChannels', 'watchedTopics', 'watchedKeywords', 'checkMentions', 'openedStreams',
    'preStartMin', 'reopenMin', 'activeTab', 'notificationsEnabled',
  ]);

  const watchedChannels = data.watchedChannels  ?? [];
  const watchedTopics    = data.watchedTopics    ?? [];
  const watchedKeywords  = data.watchedKeywords  ?? [];
  const checkMentions    = data.checkMentions    ?? false;
  if (watchedChannels.length === 0 && watchedTopics.length === 0 && watchedKeywords.length === 0) return;

  const openedStreams = data.openedStreams        ?? {};
  const preStartMs   = (data.preStartMin  ?? 3)  * 60 * 1000;
  const reopenMs     = (data.reopenMin    ?? 10) * 60 * 1000;
  const activeTab    = data.activeTab             ?? false;
  const showNotif    = data.notificationsEnabled  ?? true;

  const now = Date.now();
  let dirty = false;

  for (const stream of streams) {
    if (!isWatchedStream(stream, watchedChannels, watchedTopics, watchedKeywords, checkMentions)) continue;

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
      openedStreams[streamId] = { channelId, openedAt: now };
      dirty = true;
      continue;
    }

    try {
      await chrome.tabs.create({ url: watchUrl, active: activeTab });
      console.log('[HolodexPlus] Opened tab for:', streamId, stream.title);
      openedStreams[streamId] = { channelId, openedAt: now };
      dirty = true;

      if (showNotif) {
        chrome.notifications.create(`stream_${streamId}`, {
          type:     'basic',
          iconUrl:  stream.channel?.photo || 'icons/icon128.png',
          title:    'HolodexPlus — 直播開始',
          message:  `${displayName(stream.channel)} 的直播已自動開啟`,
        });
      }
    } catch (e) {
      console.error('[HolodexPlus] Failed to open tab:', e);
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
    if (!startActual) return false;
    return (now - startActual) < reopenMs;
  }

  if (startScheduled !== null && (startScheduled - now) <= preStartMs) return true;
  if (startActual    !== null && startActual <= now)                    return true;
  return false;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function isWatchedStream(stream, watchedChannels, watchedTopics, watchedKeywords, checkMentions) {
  // Match by channel name / english_name / id
  if (watchedChannels.length > 0) {
    const ch      = stream.channel;
    const name    = (ch?.name         || '').toLowerCase();
    const engName = (ch?.english_name || '').toLowerCase();
    const chId    = (ch?.id           || '').toLowerCase();
    if (watchedChannels.some((w) => {
      const wl = w.toLowerCase();
      return name === wl || engName === wl || chId === wl;
    })) return true;

    // Match by mentions array (if enabled)
    if (checkMentions && Array.isArray(stream.mentions)) {
      if (stream.mentions.some((m) => {
        const mn  = (m?.name         || '').toLowerCase();
        const men = (m?.english_name || '').toLowerCase();
        const mid = (m?.id           || '').toLowerCase();
        return watchedChannels.some((w) => {
          const wl = w.toLowerCase();
          return mn === wl || men === wl || mid === wl;
        });
      })) return true;
    }
  }
  // Match by topic_id (exact)
  if (watchedTopics.length > 0) {
    const topicId = (stream.topic_id || '').toLowerCase();
    if (topicId && watchedTopics.some((t) => t.toLowerCase() === topicId)) return true;
  }
  // Match by title keyword (substring)
  if (watchedKeywords.length > 0) {
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
