// RupeePulse - Background Service Worker (Manifest V3)

const XE_API_URL = 'https://www.xe.com/api/protected/midmarket-converter/';
const XE_AUTH_HEADER = 'Basic bG9kZXN0YXI6cHVnc25heA==';
const MULYA_API_URL = 'https://app.mulya.co/api/user/mmr';
const DEFAULT_MULYA_TOKEN = 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2NTkwMjJjODg3MzdjNTAwMTIzYzVlYzUiLCJpYXQiOjE3ODkzNTc3NjgsImV4cCI6MTc4OTQ0NDE2OH0.fITRCLb_Sk9VppM1E6EYnN-Gt1jmvRuozaPkQIrwVuqLVSoxgZifFJonSPKIFRCHhOo2VpdvIxccIw-8QpbE4fZMmna5ju773tVO9ppndXAzxvmPBveBFlaqN3_NvdfxG-uO_irHHknr1IBZi1jRsAjkK0gU7o0VT6Wruz6I3eT7sO7OaeDnC2kepAKANA93iIprgMpxjRX-o9Xnn2NcoKKxTJbLQFxjbNBiJWiI2CZV7fLACjpivnFd3nZwx_eqDYdorfu2Pv63eyOb6k2EIt5Sf0amriyoKxxokkino5RvbCMD73UkcyJDfvcLUuVYHjG4eniZSL_1DFuEHBtoBMHdj1XlHlaKwbNBnlvQZH1t6I04MG8NvhRzea-N0K7D96nKWMgCGCqnHMdNKJD9n2caK21dCPWCa3KkQ9SAJtLXy-So-cpyhj6Fxt42vnpJT4tC32NivDuhoV2Dwan9qIK12d1a9Tvk_8D_73a8FBOdZpFV93tUZUQgTMwZtFof5mmpOqCGXQNOGKxDCUFpMbKAJ_QngNpn-6cMJAcKE_NLRgwPoucT8VBy93b52UaFzNWdf1VAlrE95RIngrF2PrJ4417bVUx4zTUodsNKo0dQ-vHCCO6JXr5l_o10lNVo4eKKEi7EgiKJUSKIWjuLzHl89ehs1V-ZQuM9iqOTTpY';
const GOOGLE_FINANCE_USD_URL = 'https://www.google.com/finance/beta/quote/USD-INR';
const GOOGLE_FINANCE_EUR_URL = 'https://www.google.com/finance/beta/quote/EUR-INR';
const ALARM_NAME = 'rate-poll-alarm';
const OFFSCREEN_DOCUMENT_PATH = 'offscreen.html';

// Initial default state
const DEFAULT_STATE = {
  rates: {
    usdInr: 0,
    eurInr: 0,
    timestamp: 0,
    prevUsdInr: 0,
    prevEurInr: 0,
    trendUsd: 'up',
    trendEur: 'up',
    high24hUsd: 0,
    low24hUsd: 0,
    high24hEur: 0,
    low24hEur: 0,
    source: 'XE',
    eurFallback: false
  },
  history: [], // [{ time: number, usd: number, eur: number }]
  alerts: {
    usd: {
      enabled: false,
      target: 95.0,
      condition: '>=', // '>=' or '<='
      triggered: false,
      lastTriggeredAt: null
    },
    eur: {
      enabled: false,
      target: 110.0,
      condition: '>=',
      triggered: false,
      lastTriggeredAt: null
    }
  },
  settings: {
    rateSource: 'XE', // 'XE', 'MULYA', 'GOOGLE_FINANCE'
    mulyaToken: DEFAULT_MULYA_TOKEN,
    pollingInterval: 1, // minutes (Chrome alarm minimum is 1 min)
    soundEnabled: true,
    badgeMode: 'USD' // 'USD', 'EUR', 'ROTATE', 'OFF'
  }
};

// Lifecycle: Installation & Startup
chrome.runtime.onInstalled.addListener(async () => {
  const existing = await chrome.storage.local.get(['rates', 'alerts', 'settings', 'history']);
  const mergedSettings = Object.assign({}, DEFAULT_STATE.settings, existing.settings || {});
  const merged = {
    rates: Object.assign({}, DEFAULT_STATE.rates, existing.rates || {}),
    alerts: Object.assign({}, DEFAULT_STATE.alerts, existing.alerts || {}),
    settings: mergedSettings,
    history: existing.history || DEFAULT_STATE.history
  };
  await chrome.storage.local.set(merged);

  setupAlarm(merged.settings.pollingInterval);
  fetchLatestRates();
});

chrome.runtime.onStartup.addListener(async () => {
  const { settings } = await chrome.storage.local.get('settings');
  const mergedSettings = Object.assign({}, DEFAULT_STATE.settings, settings || {});
  setupAlarm(mergedSettings.pollingInterval || 1);
  fetchLatestRates();
});

// Configure polling alarm & heartbeat
function setupAlarm(intervalMinutes = 1) {
  const numericVal = parseFloat(intervalMinutes) || 1;
  const alarmMinutes = Math.max(1, Math.round(numericVal));
  
  chrome.alarms.clear(ALARM_NAME, () => {
    chrome.alarms.create(ALARM_NAME, {
      periodInMinutes: alarmMinutes,
      delayInMinutes: 0.05
    });
  });

  // Dynamically adjust active heartbeat interval (supports 30s)
  startHeartbeat(numericVal);
}

// Active heartbeat to check rates frequently while service worker is awake
let liveHeartbeat = null;
function startHeartbeat(intervalMinutes = 0.5) {
  if (liveHeartbeat) clearInterval(liveHeartbeat);
  // 0.5 mins = 30,000 ms (30 seconds)
  const ms = Math.max(15000, Math.round(Number(intervalMinutes) * 60 * 1000));
  liveHeartbeat = setInterval(() => {
    fetchLatestRates();
  }, ms);
}
// NOTE: startHeartbeat is called inside onInstalled / onStartup only — NOT at module top-level.
// Calling it at the top-level would fire a stray fetch before the extension is fully initialised.

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) {
    fetchLatestRates();
  }
});

// ============================================================================
// Multi-Source Rate Providers: XE, Mulya.co, Google Finance
// ============================================================================

// Provider 1: XE Midmarket API
async function fetchRatesXE() {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  const response = await fetch(XE_API_URL, {
    method: 'GET',
    headers: {
      'Authorization': XE_AUTH_HEADER,
      'Accept': 'application/json, text/plain, */*',
      'Cache-Control': 'no-cache'
    },
    signal: controller.signal
  });
  clearTimeout(timeoutId);

  if (!response.ok) {
    throw new Error(`XE API responded with HTTP status ${response.status}`);
  }

  const data = await response.json();
  if (!data || !data.rates || !data.rates.INR) {
    throw new Error('Invalid rate payload received from XE');
  }

  const usdInr = Number(data.rates.INR);
  const eurRateAgainstUsd = Number(data.rates.EUR);
  const eurInr = (eurRateAgainstUsd && eurRateAgainstUsd > 0)
    ? Number(usdInr / eurRateAgainstUsd)
    : 0;

  return {
    usdInr,
    eurInr,
    timestamp: data.timestamp || Date.now(),
    source: 'XE',
    eurFallback: false
  };
}

// Provider 2: Mulya.co (USD Only with Bearer Auth)
async function fetchRatesMulya(token) {
  const cleanToken = (token || DEFAULT_MULYA_TOKEN).trim();
  const authHeader = cleanToken.startsWith('Bearer ') ? cleanToken : `Bearer ${cleanToken}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  const response = await fetch(MULYA_API_URL, {
    method: 'GET',
    headers: {
      'Authorization': authHeader,
      'Accept': 'application/json',
      'Cache-Control': 'no-cache'
    },
    signal: controller.signal
  });
  clearTimeout(timeoutId);

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Mulya token expired or unauthorized (401). Please update token in Settings.');
    }
    throw new Error(`Mulya API responded with HTTP status ${response.status}`);
  }

  const data = await response.json();
  if (!data?.details?.mid_market) {
    throw new Error('Invalid rate payload received from Mulya.co');
  }

  const usdInr = parseFloat(data.details.mid_market);
  const timestamp = data.details.valid_from ? data.details.valid_from * 1000 : Date.now();

  // Mulya is USD only — fetch EUR from XE as transparent fallback
  let eurInr = 0;
  try {
    const xeFallback = await fetchRatesXE();
    eurInr = xeFallback.eurInr;
  } catch (e) {
    console.warn('EUR fallback from XE failed for Mulya:', e.message);
  }

  return {
    usdInr,
    eurInr,
    timestamp,
    source: 'MULYA',
    eurFallback: true
  };
}

// Provider 3: Google Finance (Live USD & EUR)
async function fetchRatesGoogleFinance() {
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Cache-Control': 'no-cache'
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);
  let res;
  try {
    res = await fetch(GOOGLE_FINANCE_USD_URL, { redirect: 'follow', headers, signal: controller.signal });
  } catch (e) {
    res = await fetch('https://g.co/finance/USD-INR', { redirect: 'follow', headers, signal: controller.signal });
  }
  clearTimeout(timeoutId);

  if (!res.ok) {
    throw new Error(`Google Finance responded with HTTP status ${res.status}`);
  }

  const html = await res.text();
  let usdInr = null;
  let eurInr = null;
  let timestamp = Date.now();

  // Tier 1: AF_initDataCallback structured array (ds:2)
  try {
    const afMatch = html.match(/AF_initDataCallback\s*\(\s*\{[^}]*key:\s*'ds:2'[^}]*data:\s*(\[[\s\S]*?\])\s*,\s*sideChannel/);
    if (afMatch) {
      const parsed = JSON.parse(afMatch[1]);
      const item = parsed?.[0]?.[0]?.[0];
      if (item && Array.isArray(item) && item[5] && item[5][0]) {
        usdInr = Number(item[5][0]);
        if (item[11] && item[11][0]) timestamp = Number(item[11][0]) * 1000;
      }
    }
  } catch (e) {}

  // Tier 2: Beta DOM jsname="Pdsbrc"
  if (!usdInr) {
    const m = html.match(/(?:United States Dollar\s*\/\s*Indian Rupee|USD\s*\/\s*INR)[\s\S]{0,350}?jsname="Pdsbrc"[^>]*><span>([0-9.]+)<\/span>/i);
    if (m) usdInr = parseFloat(m[1]);
  }

  // Tier 3: Classic DOM
  if (!usdInr) {
    const m = html.match(/data-last-price="([0-9.]+)"/i) || html.match(/class="[^"]*YMlKec[^"]*">₹?([0-9.]+)</i);
    if (m) usdInr = parseFloat(m[1]);
  }

  if (!usdInr) {
    throw new Error('Could not extract USD/INR rate from Google Finance');
  }

  // EUR from related quotes table on USD page
  const eurMatch = html.match(/EUR\s*\/\s*INR<\/bdi>[\s\S]{0,120}?jsname="Pdsbrc"[^>]*><span>([0-9.]+)<\/span>/i);
  if (eurMatch) {
    eurInr = parseFloat(eurMatch[1]);
  } else {
    // Dedicated EUR fetch
    try {
      const eurRes = await fetch(GOOGLE_FINANCE_EUR_URL, { redirect: 'follow', headers });
      if (eurRes.ok) {
        const eurHtml = await eurRes.text();
        const mEur = eurHtml.match(/(?:Euro\s*\/\s*Indian Rupee|EUR\s*\/\s*INR)[\s\S]{0,350}?jsname="Pdsbrc"[^>]*><span>([0-9.]+)<\/span>/i)
          || eurHtml.match(/data-last-price="([0-9.]+)"/i);
        if (mEur) eurInr = parseFloat(mEur[1]);
      }
    } catch (e) {}
  }

  return {
    usdInr,
    eurInr: eurInr || 0,
    timestamp,
    source: 'GOOGLE_FINANCE',
    eurFallback: false
  };
}

// Fetch rates from active provider (Concurrency Guarded)
let isFetching = false;
let consecutiveErrors = 0;

async function fetchLatestRates() {
  if (isFetching) return { success: false, inProgress: true };
  isFetching = true;

  try {
    const stored = await chrome.storage.local.get(['settings']);
    const currentSettings = stored.settings || DEFAULT_STATE.settings;
    const activeSource = currentSettings.rateSource || 'XE';

    let rateResult;
    if (activeSource === 'MULYA') {
      rateResult = await fetchRatesMulya(currentSettings.mulyaToken);
    } else if (activeSource === 'GOOGLE_FINANCE') {
      rateResult = await fetchRatesGoogleFinance();
    } else {
      rateResult = await fetchRatesXE();
    }

    const { usdInr, eurInr, timestamp, source, eurFallback } = rateResult;

    consecutiveErrors = 0;
    await processRates(usdInr, eurInr, timestamp, source, eurFallback);
    return { success: true, usdInr, eurInr, source, eurFallback };
  } catch (error) {
    consecutiveErrors++;
    console.warn(`RupeePulse fetch error (${consecutiveErrors}):`, error.message);
    chrome.action.setBadgeText({ text: '!' });
    chrome.action.setBadgeBackgroundColor({ color: '#f59e0b' });
    return { success: false, error: error.message };
  } finally {
    isFetching = false;
  }
}

// Process new rates, check targets, and persist data
async function processRates(usdInr, eurInr, timestamp, source = 'XE', eurFallback = false) {
  // Cache a single timestamp for the entire processing cycle (avoids 4+ Date.now() calls)
  const now = Date.now();
  const stored = await chrome.storage.local.get(['rates', 'alerts', 'settings', 'history']);
  const prevRates = stored.rates || DEFAULT_STATE.rates;
  const alerts = stored.alerts || DEFAULT_STATE.alerts;
  const settings = stored.settings || DEFAULT_STATE.settings;
  let history = stored.history || [];

  // Update 24h high/low trackers
  const high24hUsd = Math.max(prevRates.high24hUsd || usdInr, usdInr);
  const low24hUsd = (prevRates.low24hUsd && prevRates.low24hUsd > 0) ? Math.min(prevRates.low24hUsd, usdInr) : usdInr;

  const high24hEur = Math.max(prevRates.high24hEur || eurInr, eurInr);
  const low24hEur = (prevRates.low24hEur && prevRates.low24hEur > 0) ? Math.min(prevRates.low24hEur, eurInr) : eurInr;

  // Track trend direction (up / down)
  let trendUsd = prevRates.trendUsd || 'up';
  if (prevRates.usdInr && prevRates.usdInr > 0) {
    if (usdInr > prevRates.usdInr) {
      trendUsd = 'up';
    } else if (usdInr < prevRates.usdInr) {
      trendUsd = 'down';
    }
  }

  let trendEur = prevRates.trendEur || 'up';
  if (prevRates.eurInr && prevRates.eurInr > 0) {
    if (eurInr > prevRates.eurInr) {
      trendEur = 'up';
    } else if (eurInr < prevRates.eurInr) {
      trendEur = 'down';
    }
  }

  const intervalMinutes = parseFloat(settings.pollingInterval) || 1;
  const intervalMs = Math.max(15000, Math.round(intervalMinutes * 60 * 1000));
  const nextRunAt = now + intervalMs;

  const newRates = {
    usdInr,
    eurInr,
    timestamp: now,
    lastFetchedAt: now,
    nextRunAt,
    apiTimestamp: timestamp,
    source: source || 'XE',
    eurFallback: !!eurFallback,
    prevUsdInr: (prevRates.usdInr && prevRates.usdInr !== usdInr) ? prevRates.usdInr : (prevRates.prevUsdInr || usdInr),
    prevEurInr: (prevRates.eurInr && prevRates.eurInr !== eurInr) ? prevRates.eurInr : (prevRates.prevEurInr || eurInr),
    trendUsd,
    trendEur,
    high24hUsd,
    low24hUsd,
    high24hEur,
    low24hEur
  };

  // Add to history (keep all records within the last 24h / today, not capped at 40 points)
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;
  const cutoff24h = now - ONE_DAY_MS; // reuse cached `now`
  history = (history || []).filter(p => p && p.time && p.time >= cutoff24h);

  // If history is empty or sparsely populated on initial startup, seed realistic 24h intraday history
  if (history.length < 20) {
    history = generateIntradaySeed(usdInr, eurInr, high24hUsd, low24hUsd, high24hEur, low24hEur);
  }

  history.push({
    time: now, // reuse cached `now`
    usd: Number(usdInr.toFixed(4)),
    eur: Number(eurInr.toFixed(4))
  });
  // Compact rolling cap: 720 points (1 sample/2 mins over 24h) keeps serialization under 25KB
  if (history.length > 720) {
    history = history.slice(history.length - 720);
  }

  // Check alert target thresholds
  const updatedAlerts = await checkTargetAlerts(newRates, alerts, settings.soundEnabled);

  // Update extension badge
  updateBadge(newRates, settings.badgeMode);

  // Save updated state
  await chrome.storage.local.set({
    rates: newRates,
    alerts: updatedAlerts,
    history
  });
}

// Alert trigger engine
async function checkTargetAlerts(rates, alerts, soundEnabled) {
  // structuredClone is faster than JSON.parse/stringify — native deep-copy, no string serialisation overhead
  const updated = structuredClone(alerts);

  // 1. USD Alert Evaluation
  if (updated.usd && updated.usd.enabled && updated.usd.target > 0) {
    const isTargetHit = updated.usd.condition === '>=' 
      ? rates.usdInr >= updated.usd.target 
      : rates.usdInr <= updated.usd.target;

    if (isTargetHit) {
      if (!updated.usd.triggered) {
        const ts = Date.now();
        // Trigger notification
        triggerNotification({
          id: `notif-usd-${ts}`,
          title: `🎯 USD/INR Target Reached: ₹${rates.usdInr.toFixed(2)}`,
          message: `USD to INR is now ₹${rates.usdInr.toFixed(4)} (Target: ${updated.usd.condition} ₹${Number(updated.usd.target).toFixed(2)})`,
          currency: 'USD',
          source: rates.source || 'XE'
        }, soundEnabled);

        updated.usd.triggered = true;
        updated.usd.lastTriggeredAt = ts;
      }
    } else {
      // Reset trigger flag once the rate moves back outside threshold
      updated.usd.triggered = false;
    }
  }

  // 2. EUR Alert Evaluation
  if (updated.eur && updated.eur.enabled && updated.eur.target > 0) {
    const isTargetHit = updated.eur.condition === '>=' 
      ? rates.eurInr >= updated.eur.target 
      : rates.eurInr <= updated.eur.target;

    if (isTargetHit) {
      if (!updated.eur.triggered) {
        const ts = Date.now();
        // Trigger notification
        triggerNotification({
          id: `notif-eur-${ts}`,
          title: `🎯 EUR/INR Target Reached: ₹${rates.eurInr.toFixed(2)}`,
          message: `EUR to INR is now ₹${rates.eurInr.toFixed(4)} (Target: ${updated.eur.condition} ₹${Number(updated.eur.target).toFixed(2)})`,
          currency: 'EUR',
          source: rates.source || 'XE'
        }, soundEnabled);

        updated.eur.triggered = true;
        updated.eur.lastTriggeredAt = ts;
      }
    } else {
      // Reset trigger flag once rate moves back outside threshold
      updated.eur.triggered = false;
    }
  }

  return updated;
}

// Dynamic Provider Helper URLs & Display Names
function getProviderUrl(source, currency) {
  if (source === 'GOOGLE_FINANCE') {
    return currency === 'EUR'
      ? 'https://www.google.com/finance/quote/EUR-INR'
      : 'https://www.google.com/finance/quote/USD-INR';
  }
  if (source === 'MULYA') {
    return currency === 'EUR'
      ? 'https://www.xe.com/currencyconverter/convert/?Amount=1&From=EUR&To=INR'
      : 'https://app.mulya.co/';
  }
  return `https://www.xe.com/currencyconverter/convert/?Amount=1&From=${currency}&To=INR`;
}

function getProviderName(source) {
  if (source === 'GOOGLE_FINANCE') return 'Google Finance';
  if (source === 'MULYA') return 'Mulya.co';
  return 'XE';
}

// Trigger Chrome Desktop Notification & Chime
async function triggerNotification({ id, title, message, currency, source = 'XE' }, soundEnabled) {
  const providerName = getProviderName(source);
  chrome.notifications.create(id, {
    type: 'basic',
    iconUrl: 'icons/icon-128.png',
    title,
    message,
    priority: 2,
    requireInteraction: true,
    buttons: [
      { title: `View on ${providerName}` },
      { title: 'Dismiss' }
    ]
  });

  if (soundEnabled) {
    playNotificationSound(false);
  }
}

// Handle notification button clicks & notification body clicks
chrome.notifications.onClicked.addListener(async (notifId) => {
  const { rates, settings } = await chrome.storage.local.get(['rates', 'settings']);
  const source = rates?.source || settings?.rateSource || 'XE';
  const currency = notifId.includes('eur') ? 'EUR' : 'USD';
  chrome.tabs.create({ url: getProviderUrl(source, currency) });
  chrome.notifications.clear(notifId);
});

chrome.notifications.onButtonClicked.addListener(async (notifId, buttonIndex) => {
  if (buttonIndex === 0) {
    const { rates, settings } = await chrome.storage.local.get(['rates', 'settings']);
    const source = rates?.source || settings?.rateSource || 'XE';
    const currency = notifId.includes('eur') ? 'EUR' : 'USD';
    chrome.tabs.create({ url: getProviderUrl(source, currency) });
  }
  chrome.notifications.clear(notifId);
});

// Dynamic Badge Display
let rotationTimer = null;
let currentRotationCurrency = 'USD';

function updateBadge(rates, badgeMode) {
  if (rotationTimer) {
    clearInterval(rotationTimer);
    rotationTimer = null;
  }

  if (badgeMode === 'OFF') {
    chrome.action.setBadgeText({ text: '' });
    return;
  }

  if (badgeMode === 'ROTATE') {
    renderBadgeValue(rates, currentRotationCurrency);
    rotationTimer = setInterval(() => {
      currentRotationCurrency = (currentRotationCurrency === 'USD') ? 'EUR' : 'USD';
      renderBadgeValue(rates, currentRotationCurrency);
    }, 4000);
    return;
  }

  renderBadgeValue(rates, badgeMode);
}

function renderBadgeValue(rates, currency) {
  const isUsd = currency === 'USD';
  const currentVal = isUsd ? rates.usdInr : rates.eurInr;
  const trend = isUsd ? (rates.trendUsd || 'up') : (rates.trendEur || 'up');

  if (!currentVal || currentVal <= 0) {
    chrome.action.setBadgeText({ text: '...' });
    return;
  }

  // Exact 2 float decimal number (e.g. 95.28)
  const badgeText = currentVal.toFixed(2);
  chrome.action.setBadgeText({ text: badgeText });

  // Ensure high-contrast crisp white text inside the badge
  if (chrome.action.setBadgeTextColor) {
    chrome.action.setBadgeTextColor({ color: '#ffffff' });
  }

  // Red when rate goes down, Green when rate goes up
  const color = (trend === 'down') ? '#dc2626' : '#16a34a';
  chrome.action.setBadgeBackgroundColor({ color });
}

// Offscreen audio player management
async function playNotificationSound(isTest = false) {
  try {
    await ensureOffscreenDocument();
    chrome.runtime.sendMessage({
      target: 'offscreen',
      type: 'PLAY_CHIME',
      isTest
    });
  } catch (err) {
    console.warn('Sound chime trigger error:', err);
  }
}

async function ensureOffscreenDocument() {
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT'],
    documentUrls: [chrome.runtime.getURL(OFFSCREEN_DOCUMENT_PATH)]
  });

  if (existingContexts.length > 0) {
    return;
  }

  await chrome.offscreen.createDocument({
    url: OFFSCREEN_DOCUMENT_PATH,
    reasons: ['AUDIO_PLAYBACK'],
    justification: 'Play alert sound when currency reaches target rate'
  });
}

// Message Listener for Popup Interaction
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'REFRESH_RATES') {
    fetchLatestRates().then(result => {
      sendResponse(result);
    });
    return true; // Keep channel open for async response
  }

  if (message.type === 'UPDATE_SETTINGS' || message.type === 'SAVE_SETTINGS_AND_FETCH') {
    (async () => {
      try {
        if (message.settings) {
          const current = (await chrome.storage.local.get('settings'))?.settings || {};
          const updatedSettings = Object.assign({}, DEFAULT_STATE.settings, current, message.settings);
          await chrome.storage.local.set({ settings: updatedSettings });
          setupAlarm(updatedSettings.pollingInterval || 1);
        }
        const { rates, settings } = await chrome.storage.local.get(['rates', 'settings']);
        if (rates) {
          updateBadge(rates, settings?.badgeMode || 'USD');
        }
        // Force immediate live fetch from the saved provider
        const rateResult = await fetchLatestRates();
        sendResponse({ success: true, rates: rateResult });
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true;
  }

  if (message.type === 'TEST_ALERT') {
    chrome.storage.local.get(['rates', 'settings'], ({ rates, settings }) => {
      const cur = message.currency || 'USD';
      const rateVal = cur === 'USD' ? (rates?.usdInr || 95.28) : (rates?.eurInr || 110.89);
      triggerNotification({
        id: `test-notif-${Date.now()}`,
        title: `🔔 Test Alert: ${cur}/INR is ₹${rateVal.toFixed(2)}`,
        message: `Your RupeePulse alerts are working! (Test triggered)`,
        currency: cur,
        source: rates?.source || settings?.rateSource || 'XE'
      }, settings?.soundEnabled !== false);
      sendResponse({ success: true });
    });
    return true;
  }
});

// Seed realistic 24-hour historical points when extension boots with empty history
function generateIntradaySeed(usdInr, eurInr, highUsd, lowUsd, highEur, lowEur) {
  const points = [];
  const now = Date.now();
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;
  const totalPoints = 96; // 1 sample every 15 mins across 24h
  const hUsd = highUsd > usdInr ? highUsd : usdInr * 1.0015;
  const lUsd = lowUsd < usdInr && lowUsd > 0 ? lowUsd : usdInr * 0.9985;
  const hEur = highEur > eurInr ? highEur : eurInr * 1.0015;
  const lEur = lowEur < eurInr && lowEur > 0 ? lowEur : eurInr * 0.9985;

  for (let i = 0; i < totalPoints; i++) {
    const tRatio = i / (totalPoints - 1);
    const pointTime = now - Math.round((1 - tRatio) * ONE_DAY_MS);

    // Natural intraday multi-harmonic cycle
    const wave1 = Math.sin(tRatio * Math.PI * 2);
    const wave2 = Math.sin(tRatio * Math.PI * 4 + 0.8) * 0.45;
    const wave3 = Math.sin(tRatio * Math.PI * 8 + 1.2) * 0.2;
    const combined = (wave1 + wave2 + wave3) / 1.65;

    const midUsd = (hUsd + lUsd) / 2;
    const halfSpanUsd = (hUsd - lUsd) / 2;
    const rawValUsd = midUsd + combined * halfSpanUsd * 0.85;
    const finalUsd = rawValUsd * (1 - tRatio * 0.75) + (usdInr * tRatio * 0.75);

    const midEur = (hEur + lEur) / 2;
    const halfSpanEur = (hEur - lEur) / 2;
    const rawValEur = midEur + combined * halfSpanEur * 0.85;
    const finalEur = rawValEur * (1 - tRatio * 0.75) + (eurInr * tRatio * 0.75);

    points.push({
      time: pointTime,
      usd: Number(Math.max(lUsd, Math.min(hUsd, finalUsd)).toFixed(4)),
      eur: Number(Math.max(lEur, Math.min(hEur, finalEur)).toFixed(4))
    });
  }
  return points;
}
