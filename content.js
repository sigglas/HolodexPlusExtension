// HolodexPlusExtension — content.js
// Runs in the ISOLATED world on all https://holodex.net/* pages.
//
// Responsibilities:
//  1. Relay API data posted by interceptor.js (MAIN world) to the background worker.
//  2. On /watch/* pages, attempt to auto-play the embedded YouTube player.

const MSG_KEY = '__holodexPlusExtensionData';

// ── 1. Relay intercepted API responses to background ─────────────────────────

function onWindowMessage(event) {
  // Only accept messages from the same frame, not from child frames / iframes
  if (event.source !== window) return;
  if (!event.data?.[MSG_KEY]) return;

  const streams = event.data.data;
  if (!Array.isArray(streams)) return;

  // If the extension context has been invalidated (e.g. after a reload),
  // stop listening to avoid repeated uncaught errors.
  if (!chrome.runtime?.id) {
    window.removeEventListener('message', onWindowMessage);
    return;
  }

  try {
    chrome.runtime.sendMessage({ type: 'API_DATA', streams }).catch(() => {
      // Background service worker not yet active — silently ignore
    });
  } catch (_) {
    // Context invalidated between the id-check and the call — remove listener
    window.removeEventListener('message', onWindowMessage);
  }
}

window.addEventListener('message', onWindowMessage);

// ── 2. Auto-play on watch pages ───────────────────────────────────────────────

if (location.pathname.startsWith('/watch/')) {
  chrome.storage.local.get('autoplayEnabled').then(({ autoplayEnabled = true }) => {
    if (autoplayEnabled) waitForPlay();
  });
}

function waitForPlay() {
  let attempts = 0;
  const MAX_ATTEMPTS = 30;  // 30 × 2 s = 60 s max
  const INTERVAL_MS  = 2000;

  const timer = setInterval(() => {
    attempts++;
    if (attempts > MAX_ATTEMPTS) { clearInterval(timer); return; }

    // Strategy 1: inject autoplay=1 into the YouTube embed iframe src
    const iframe = document.querySelector('iframe[src*="youtube.com/embed"]');
    if (iframe) {
      if (!iframe.src.includes('autoplay=1')) {
        try {
          const url = new URL(iframe.src);
          url.searchParams.set('autoplay', '1');
          iframe.src = url.toString();
          console.log('[HolodexPlusExtension] Set autoplay on YouTube iframe.');
        } catch (_) {}
      }
      clearInterval(timer);
      return;
    }

    // Strategy 2: click Holodex's own play/start overlay button
    const playBtn =
      document.querySelector('button[class*="play"]')        ||
      document.querySelector('[data-testid="play-button"]')  ||
      document.querySelector('.play-button')                 ||
      document.querySelector('.stream-container button');

    if (playBtn) {
      playBtn.click();
      console.log('[HolodexPlusExtension] Clicked play button.');
      clearInterval(timer);
    }
  }, INTERVAL_MS);
}
