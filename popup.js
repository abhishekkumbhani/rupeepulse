// RupeePulse - Live USD/INR & EUR/INR Controller
// Production-Ready, 60fps, Low Memory, Zero Dependencies

// 1. Environment Detection (Chrome Extension vs Standalone Tab Preview)
const isExtensionEnv = typeof chrome !== 'undefined' && 
                       Boolean(chrome.runtime && chrome.runtime.id && chrome.storage && chrome.storage.local);

// Safe Storage Bridge with In-Memory Fast Cache
const appStorage = {
  async get(keys) {
    if (isExtensionEnv) {
      try {
        return await chrome.storage.local.get(keys);
      } catch (err) {
        console.warn('Storage read fallback:', err);
      }
    }
    try {
      const result = {};
      for (let i = 0; i < keys.length; i++) {
        const k = keys[i];
        const item = localStorage.getItem('cp_' + k);
        if (item) result[k] = JSON.parse(item);
      }
      return result;
    } catch (err) {
      return {};
    }
  },

  async set(obj) {
    if (isExtensionEnv) {
      try {
        return await chrome.storage.local.set(obj);
      } catch (err) {
        console.warn('Storage write fallback:', err);
      }
    }
    try {
      const entries = Object.entries(obj);
      for (let i = 0; i < entries.length; i++) {
        localStorage.setItem('cp_' + entries[i][0], JSON.stringify(entries[i][1]));
      }
    } catch (err) {}
  },

  onChanged(callback) {
    if (isExtensionEnv && chrome.storage && chrome.storage.onChanged) {
      chrome.storage.onChanged.addListener(callback);
    }
  }
};

// Safe Runtime Bridge
const appRuntime = {
  sendMessage(msg, callback) {
    if (isExtensionEnv && chrome.runtime && typeof chrome.runtime.sendMessage === 'function') {
      try {
        chrome.runtime.sendMessage(msg, callback);
        return;
      } catch (err) {
        console.warn('Runtime message fallback:', err);
      }
    }

    // Standalone Browser Tab Simulation
    if (msg.type === 'REFRESH_RATES') {
      setTimeout(() => {
        if (callback) {
          callback({
            success: true,
            usdInr: currentRates.usdInr || 95.2805,
            eurInr: currentRates.eurInr || 110.9007,
            simulated: true
          });
        }
      }, 300);
    } else if (msg.type === 'TEST_ALERT') {
      if (currentSettings.soundEnabled) {
        playStandaloneChime();
      }
      alert(`🔔 RupeePulse Alert: ${msg.currency || 'USD'}/INR is ₹${(msg.currency === 'EUR' ? currentRates.eurInr : currentRates.usdInr).toFixed(2)}`);
      if (callback) callback({ success: true });
    } else {
      if (callback) callback({ success: true });
    }
  }
};

// Standalone Audio Chime Synthesizer
let audioCtx = null;
function playStandaloneChime() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    if (!audioCtx) audioCtx = new AudioContext();
    if (audioCtx.state === 'suspended') audioCtx.resume();

    const now = audioCtx.currentTime;
    const notes = [659.25, 830.61, 987.77, 1318.51];
    for (let idx = 0; idx < notes.length; idx++) {
      const startTime = now + (idx * 0.08);
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(notes[idx], startTime);
      gain.gain.setValueAtTime(0.001, startTime);
      gain.gain.linearRampToValueAtTime(0.18, startTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.5);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(startTime);
      osc.stop(startTime + 0.5);
    }
  } catch (err) {
    console.warn('Audio chime fallback error:', err);
  }
}

// Global Application State
let currentRates = {
  usdInr: 95.2805,
  eurInr: 110.9007,
  prevUsdInr: 95.2500,
  prevEurInr: 110.8500,
  high24hUsd: 95.4200,
  low24hUsd: 95.1800,
  high24hEur: 111.1500,
  low24hEur: 110.6500,
  timestamp: Date.now()
};

let currentAlerts = {
  usd: { enabled: false, target: 95.50, condition: '>=', triggered: false },
  eur: { enabled: false, target: 111.00, condition: '>=', triggered: false }
};

const DEFAULT_MULYA_TOKEN = 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2NTkwMjJjODg3MzdjNTAwMTIzYzVlYzUiLCJpYXQiOjE3ODkzNTc3NjgsImV4cCI6MTc4OTQ0NDE2OH0.fITRCLb_Sk9VppM1E6EYnN-Gt1jmvRuozaPkQIrwVuqLVSoxgZifFJonSPKIFRCHhOo2VpdvIxccIw-8QpbE4fZMmna5ju773tVO9ppndXAzxvmPBveBFlaqN3_NvdfxG-uO_irHHknr1IBZi1jRsAjkK0gU7o0VT6Wruz6I3eT7sO7OaeDnC2kepAKANA93iIprgMpxjRX-o9Xnn2NcoKKxTJbLQFxjbNBiJWiI2CZV7fLACjpivnFd3nZwx_eqDYdorfu2Pv63eyOb6k2EIt5Sf0amriyoKxxokkino5RvbCMD73UkcyJDfvcLUuVYHjG4eniZSL_1DFuEHBtoBMHdj1XlHlaKwbNBnlvQZH1t6I04MG8NvhRzea-N0K7D96nKWMgCGCqnHMdNKJD9n2caK21dCPWCa3KkQ9SAJtLXy-So-cpyhj6Fxt42vnpJT4tC32NivDuhoV2Dwan9qIK12d1a9Tvk_8D_73a8FBOdZpFV93tUZUQgTMwZtFof5mmpOqCGXQNOGKxDCUFpMbKAJ_QngNpn-6cMJAcKE_NLRgwPoucT8VBy93b52UaFzNWdf1VAlrE95RIngrF2PrJ4417bVUx4zTUodsNKo0dQ-vHCCO6JXr5l_o10lNVo4eKKEi7EgiKJUSKIWjuLzHl89ehs1V-ZQuM9iqOTTpY';

let currentSettings = {
  theme: 'dark',
  pollingInterval: 1,
  soundEnabled: true,
  badgeMode: 'USD',
  rateSource: 'XE',
  mulyaToken: DEFAULT_MULYA_TOKEN
};

let rateHistory = [];
let activeCurrency = 'usd'; // 'usd' or 'eur'
let activeSubTab = 'trend'; // 'trend' (default), 'converter', or 'stats'

// Chart Timeframe Mapping
const TIMEFRAMES = {
  '5m': 5 * 60 * 1000,
  '10m': 10 * 60 * 1000,
  '30m': 30 * 60 * 1000,
  '1h': 60 * 60 * 1000,
  '2h': 2 * 60 * 60 * 1000,
  '6h': 6 * 60 * 60 * 1000,
  '12h': 12 * 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000
};
let activeTimeframe = '1h';

// Distinct Timeframe Profile Specifications for Realistic Market Dynamics
const TIMEFRAME_CONFIGS = {
  '5m': {
    targetPoints: 16,
    label: '5m',
    spreadRatio: 0.12,
    minSpread: 0.025,
    harmonicFn: (t) => Math.sin(t * Math.PI * 7) * 0.45 + Math.cos(t * Math.PI * 14) * 0.3 + (t - 0.5) * 0.35
  },
  '10m': {
    targetPoints: 20,
    label: '10m',
    spreadRatio: 0.22,
    minSpread: 0.045,
    harmonicFn: (t) => Math.sin(t * Math.PI * 3.8 - 0.7) * 0.6 + Math.sin(t * Math.PI * 9) * 0.22 + (t - 0.4) * 0.4
  },
  '30m': {
    targetPoints: 26,
    label: '30m',
    spreadRatio: 0.36,
    minSpread: 0.075,
    harmonicFn: (t) => Math.cos(t * Math.PI * 3.2 + 0.8) * 0.68 + Math.sin(t * Math.PI * 6.5) * 0.2 + (t - 0.5) * 0.3
  },
  '1h': {
    targetPoints: 32,
    label: '1h',
    spreadRatio: 0.50,
    minSpread: 0.11,
    harmonicFn: (t) => Math.sin(t * Math.PI * 2.4 - 0.8) * 0.72 + Math.sin(t * Math.PI * 5) * 0.18 + (t - 0.5) * 0.5
  },
  '2h': {
    targetPoints: 38,
    label: '2h',
    spreadRatio: 0.65,
    minSpread: 0.14,
    harmonicFn: (t) => Math.sin(t * Math.PI * 2.1 + 0.4) * 0.75 + Math.cos(t * Math.PI * 4.5) * 0.22
  },
  '6h': {
    targetPoints: 48,
    label: '6h',
    spreadRatio: 0.80,
    minSpread: 0.18,
    harmonicFn: (t) => Math.sin(t * Math.PI * 1.6 - 1.1) * 0.8 + Math.sin(t * Math.PI * 3.6) * 0.2
  },
  '12h': {
    targetPoints: 60,
    label: '12h',
    spreadRatio: 0.90,
    minSpread: 0.20,
    harmonicFn: (t) => Math.sin(t * Math.PI * 1.3 - 0.5) * 0.82 + Math.sin(t * Math.PI * 2.8) * 0.18
  },
  '24h': {
    targetPoints: 80,
    label: 'Today',
    spreadRatio: 1.0,
    minSpread: 0.24,
    harmonicFn: (t) => Math.sin(t * Math.PI * 2 - 1.6) * 0.75 + Math.sin(t * Math.PI * 4 + 0.6) * 0.22 + Math.cos(t * Math.PI * 6.5) * 0.1
  }
};

// High-Performance DOM Elements Cache Map (Zero Tree-Walking on Frames)
const DOM = {};
// Cached icon NodeLists (avoid querySelectorAll on every theme/sound toggle)
let cachedSunIcons = null;
let cachedMoonIcons = null;
let cachedSoundOnIcons = null;
let cachedSoundOffIcons = null;
// Module-level chart hover coordinates (avoids storing state on DOM nodes)
let chartCoords = null;

function initDOM() {
  const ids = [
    'pillUsd', 'pillEur', 'pillUsdVal', 'pillUsdDelta', 'pillEurVal', 'pillEurDelta',
    'btnThemeToggle', 'settingThemeMode', 'popoverThemeLabel',
    'btnSoundToggle', 'settingSoundEnabled', 'popoverSoundLabel',
    'btnHeaderMenu', 'headerMenuPopover', 'popoverThemeToggle', 'popoverSoundToggle', 'popoverSettingsToggle',
    'settingsDrawer', 'settingRateSource', 'settingMulyaToken', 'btnToggleMulyaToken', 'mulyaTokenGroup', 'mulyaInfoNote',
    'btnSaveSettings', 'saveSettingsFeedback',
    'settingPollingInterval', 'settingBadgeMode', 'btnTestAlert', 'btnSettingsToggle', 'btnCloseSettings',
    'btnCopyRate', 'copyFeedback',
    'headerStatusText', 'footerSourceBadge', 'footerSyncDot', 'footerLinkUsd', 'footerLinkEur', 'statsSourceTag',
    'mainPairLabel', 'mainBaseTag', 'mainChangeBadge', 'mainRateValue', 'inverseRateDisplay',
    'rangeLowVal', 'rangeHighVal', 'rangeMarker',
    'alertBox', 'alertBoxHeader', 'activeAlertToggle', 'activeConditionSelect', 'activeTargetInput', 'btnSaveAlert',
    'activeAlertStatus',
    'targetDeltaReadout', 'targetInputBox', 'alertHeaderBadge',
    'trendCurrencyLabel', 'chartTimeframeSelect', 'chartPointsCount', 'chartMinVal', 'chartMaxVal',
    'chartContainer', 'sparklineSvg', 'sparklineLine', 'sparklineArea', 'chartCrosshair', 'chartHoverDot',
    'chartPulseRing', 'chartCurrentDot', 'chartFooterStatus',
    'trendDefaultHeader', 'trendHoverHeader', 'hoverRateVal', 'hoverTimeVal',
    'convAmount', 'convFromCurrency', 'convToCurrency', 'btnSwapConverter', 'convResultDisplay', 'convRateHint',
    'statsHighVal', 'statsLowVal', 'statsSpreadVal', 'statsVolatilityVal',
    'btnRefresh', 'lastUpdatedText', 'footerNextRun', 'countdownChipText',
    'previewBanner', 'btnDismissBanner',
    'panelTrend', 'panelConverter', 'panelStats'
  ];
  for (let i = 0; i < ids.length; i++) {
    DOM[ids[i]] = document.getElementById(ids[i]);
  }

  // Cache icon NodeLists once — avoids DOM walks on every toggle
  cachedSunIcons = document.querySelectorAll('.icon-theme-sun');
  cachedMoonIcons = document.querySelectorAll('.icon-theme-moon');
  cachedSoundOnIcons = document.querySelectorAll('.icon-sound-on');
  cachedSoundOffIcons = document.querySelectorAll('.icon-sound-off');

  // Cache SVG gradient stop elements to avoid querySelectorAll on every sparkline redraw
  const gradStopEls = document.querySelectorAll('#chartGradient stop');
  DOM.chartGradientStop0 = gradStopEls[0] || null;
  DOM.chartGradientStop1 = gradStopEls[1] || null;
}

// Lifecycle Initialization
let countdownIntervalId = null;

document.addEventListener('DOMContentLoaded', async () => {
  initDOM();
  setupTheme();
  setupSoundToggle();
  setupHeaderMenu();
  setupCurrencySwitcher();
  setupCopyButton();
  setupAlertControls();
  setupSubTabs();
  setupTimeframeSelect();
  setupTrendChartHover();
  setupConverter();
  setupSettingsDrawer();
  setupRefreshButton();
  setupPreviewBanner();

  await loadStateFromStorage();

  // Listen to background storage updates
  appStorage.onChanged((changes, areaName) => {
    if (areaName === 'local') {
      let needsFullRender = false;
      let needsSparklineRender = false;

      if (changes.rates) {
        currentRates = changes.rates.newValue || currentRates;
        needsFullRender = true;
      }
      if (changes.alerts) {
        currentAlerts = changes.alerts.newValue || currentAlerts;
        renderAlertControls();
      }
      if (changes.history) {
        rateHistory = changes.history.newValue || [];
        needsSparklineRender = true;
      }
      if (changes.settings) {
        currentSettings = changes.settings.newValue || currentSettings;
        applyTheme(currentSettings.theme || 'dark');
        renderSettingsUI();
      }

      if (needsFullRender) {
        renderAll();
      } else if (needsSparklineRender) {
        renderSparkline();
      }
    }
  });

  // Request fresh rates
  triggerRefresh(false);

  // Live countdown timer for next automatic refresh
  updateNextRunCountdown();
  if (countdownIntervalId) clearInterval(countdownIntervalId);
  countdownIntervalId = setInterval(updateNextRunCountdown, 1000);

  // Memory cleanup when popup closes
  window.addEventListener('pagehide', () => {
    if (countdownIntervalId) clearInterval(countdownIntervalId);
  });
});

// Setup Standalone Preview Banner
function setupPreviewBanner() {
  const banner = DOM.previewBanner;
  const btnDismiss = DOM.btnDismissBanner;
  if (!isExtensionEnv && banner) {
    banner.classList.remove('hidden');
    if (btnDismiss) {
      btnDismiss.addEventListener('click', () => banner.classList.add('hidden'));
    }
  }
}

// Load State from Storage
async function loadStateFromStorage() {
  const data = await appStorage.get(['rates', 'alerts', 'settings', 'history', 'chartTimeframe']);
  if (data.rates) currentRates = data.rates;
  if (data.alerts) currentAlerts = data.alerts;
  if (data.settings) currentSettings = Object.assign(currentSettings, data.settings);
  if (data.history) rateHistory = data.history;
  if (data.chartTimeframe && TIMEFRAMES[data.chartTimeframe]) {
    activeTimeframe = data.chartTimeframe;
    if (DOM.chartTimeframeSelect) DOM.chartTimeframeSelect.value = activeTimeframe;
  }

  applyTheme(currentSettings.theme || 'dark');
  renderSettingsUI();
  renderAll();
}

// requestAnimationFrame Batched Render Pipeline (Prevents Multiple Frame Redraws)
let renderAllRaf = null;
function renderAll() {
  if (renderAllRaf) return;
  renderAllRaf = requestAnimationFrame(() => {
    renderAllRaf = null;
    executeRenderAll();
  });
}

function executeRenderAll() {
  renderTickerPills();
  renderMainCanvas();
  renderAlertControls();
  updateConverter();
  renderSparkline();
  renderMarketStats();
  renderSourceBranding();
  // renderSettingsUI() intentionally NOT called here — it is called only when settings
  // actually change (via the storage.onChanged handler), preventing needless re-render on
  // every rate update tick.
}

// Theme Engine (Light / Dark)
function setupTheme() {
  const btnTheme = DOM.btnThemeToggle;
  const selectTheme = DOM.settingThemeMode;

  if (btnTheme) {
    btnTheme.addEventListener('click', () => {
      const nextTheme = (currentSettings.theme === 'light') ? 'dark' : 'light';
      currentSettings.theme = nextTheme;
      applyTheme(nextTheme);
      appStorage.set({ settings: currentSettings });
    });
  }

  if (selectTheme) {
    selectTheme.addEventListener('change', () => {
      currentSettings.theme = selectTheme.value;
      applyTheme(selectTheme.value);
      appStorage.set({ settings: currentSettings });
    });
  }
}

function applyTheme(themeName) {
  document.documentElement.setAttribute('data-theme', themeName);
  // Use cached NodeLists — avoids DOM walks on every toggle
  const sunIcons = cachedSunIcons;
  const moonIcons = cachedMoonIcons;
  const selectTheme = DOM.settingThemeMode;
  const popoverThemeLabel = DOM.popoverThemeLabel;

  const isLight = themeName === 'light';
  if (sunIcons) sunIcons.forEach(i => i.classList.toggle('hidden', isLight));
  if (moonIcons) moonIcons.forEach(i => i.classList.toggle('hidden', !isLight));
  if (selectTheme) selectTheme.value = isLight ? 'light' : 'dark';
  if (popoverThemeLabel) popoverThemeLabel.textContent = isLight ? 'Light' : 'Dark';
}

// Quick Sound Chime Toggle & Indicators
function updateSoundIndicators(enabled) {
  // Use cached NodeLists — avoids DOM walks on every toggle
  const iconsOn = cachedSoundOnIcons;
  const iconsOff = cachedSoundOffIcons;
  const popoverSoundLabel = DOM.popoverSoundLabel;

  if (iconsOn) iconsOn.forEach(i => i.classList.toggle('hidden', !enabled));
  if (iconsOff) iconsOff.forEach(i => i.classList.toggle('hidden', enabled));

  if (popoverSoundLabel) {
    popoverSoundLabel.textContent = enabled ? 'On' : 'Muted';
    popoverSoundLabel.classList.toggle('active', enabled);
  }
}

function setupSoundToggle() {
  const btnSound = DOM.btnSoundToggle;
  const toggleCheckbox = DOM.settingSoundEnabled;

  if (btnSound) {
    btnSound.addEventListener('click', async () => {
      currentSettings.soundEnabled = !currentSettings.soundEnabled;
      if (toggleCheckbox) toggleCheckbox.checked = currentSettings.soundEnabled;
      updateSoundIndicators(currentSettings.soundEnabled);
      await appStorage.set({ settings: currentSettings });
    });
  }

  updateSoundIndicators(currentSettings.soundEnabled !== false);
}

// Header Three-Dots Overflow Menu & Popover
function setupHeaderMenu() {
  const btnMenu = DOM.btnHeaderMenu;
  const popover = DOM.headerMenuPopover;
  const popTheme = DOM.popoverThemeToggle;
  const popSound = DOM.popoverSoundToggle;
  const popSettings = DOM.popoverSettingsToggle;
  const drawer = DOM.settingsDrawer;
  const toggleCheckbox = DOM.settingSoundEnabled;

  if (btnMenu && popover) {
    btnMenu.addEventListener('click', (e) => {
      e.stopPropagation();
      const isHidden = popover.classList.contains('hidden');
      popover.classList.toggle('hidden', !isHidden);
      btnMenu.setAttribute('aria-expanded', String(isHidden));
    });

    // Close on outside click
    document.addEventListener('click', (e) => {
      if (!popover.contains(e.target) && !btnMenu.contains(e.target)) {
        popover.classList.add('hidden');
        btnMenu.setAttribute('aria-expanded', 'false');
      }
    });

    // Close on Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !popover.classList.contains('hidden')) {
        popover.classList.add('hidden');
        btnMenu.setAttribute('aria-expanded', 'false');
      }
    });
  }

  // Popover Theme Toggle
  if (popTheme) {
    popTheme.addEventListener('click', async (e) => {
      e.stopPropagation();
      const nextTheme = (currentSettings.theme === 'light') ? 'dark' : 'light';
      currentSettings.theme = nextTheme;
      applyTheme(nextTheme);
      await appStorage.set({ settings: currentSettings });
    });
  }

  // Popover Sound Toggle
  if (popSound) {
    popSound.addEventListener('click', async (e) => {
      e.stopPropagation();
      currentSettings.soundEnabled = !currentSettings.soundEnabled;
      if (toggleCheckbox) toggleCheckbox.checked = currentSettings.soundEnabled;
      updateSoundIndicators(currentSettings.soundEnabled);
      await appStorage.set({ settings: currentSettings });
    });
  }

  // Popover Open Settings Drawer
  if (popSettings && drawer) {
    popSettings.addEventListener('click', () => {
      if (popover) popover.classList.add('hidden');
      if (btnMenu) btnMenu.setAttribute('aria-expanded', 'false');
      renderSettingsUI();
      drawer.classList.remove('hidden');
    });
  }
}

// Top Currency Switcher (USD vs EUR)
function setupCurrencySwitcher() {
  const pillUsd = DOM.pillUsd;
  const pillEur = DOM.pillEur;

  if (pillUsd) {
    pillUsd.addEventListener('click', () => {
      if (activeCurrency === 'usd') return;
      activeCurrency = 'usd';
      pillUsd.classList.add('active');
      if (pillEur) pillEur.classList.remove('active');
      renderAll();
    });
  }

  if (pillEur) {
    pillEur.addEventListener('click', () => {
      if (activeCurrency === 'eur') return;
      activeCurrency = 'eur';
      pillEur.classList.add('active');
      if (pillUsd) pillUsd.classList.remove('active');
      renderAll();
    });
  }
}

// Render Top Ticker Pills
function renderTickerPills() {
  const usdRate = currentRates.usdInr;
  const eurRate = currentRates.eurInr;

  // USD Pill
  if (DOM.pillUsdVal) DOM.pillUsdVal.textContent = `₹${usdRate.toFixed(2)}`;
  const deltaUsd = currentRates.prevUsdInr > 0 ? ((usdRate - currentRates.prevUsdInr) / currentRates.prevUsdInr) * 100 : 0;
  if (DOM.pillUsdDelta) applyDeltaClass(DOM.pillUsdDelta, deltaUsd);

  // EUR Pill
  if (DOM.pillEurVal) DOM.pillEurVal.textContent = `₹${eurRate.toFixed(2)}`;
  const deltaEur = currentRates.prevEurInr > 0 ? ((eurRate - currentRates.prevEurInr) / currentRates.prevEurInr) * 100 : 0;
  if (DOM.pillEurDelta) applyDeltaClass(DOM.pillEurDelta, deltaEur);
}

function applyDeltaClass(el, delta) {
  el.classList.remove('positive', 'negative', 'neutral');
  if (delta > 0.001) {
    el.classList.add('positive');
    el.textContent = `+${delta.toFixed(2)}%`;
  } else if (delta < -0.001) {
    el.classList.add('negative');
    el.textContent = `${delta.toFixed(2)}%`;
  } else {
    el.classList.add('neutral');
    el.textContent = '0.00%';
  }
}

// One-Click Rate Copy
function setupCopyButton() {
  const btnCopy = DOM.btnCopyRate;
  const tooltip = DOM.copyFeedback;

  if (btnCopy) {
    btnCopy.addEventListener('click', () => {
      const isUsd = activeCurrency === 'usd';
      const rate = isUsd ? currentRates.usdInr : currentRates.eurInr;
      const textToCopy = rate.toFixed(4);

      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(textToCopy).catch(() => {
          fallbackCopyText(textToCopy);
        });
      } else {
        fallbackCopyText(textToCopy);
      }

      if (tooltip) {
        tooltip.classList.remove('hidden');
        setTimeout(() => tooltip.classList.add('hidden'), 1300);
      }
    });
  }
}

function fallbackCopyText(text) {
  const textArea = document.createElement('textarea');
  textArea.value = text;
  textArea.style.position = 'fixed';
  textArea.style.opacity = '0';
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();
  try {
    document.execCommand('copy');
  } catch (err) {}
  document.body.removeChild(textArea);
}

// Render Main Canvas for Active Currency
function renderMainCanvas() {
  const isUsd = activeCurrency === 'usd';
  const rate = isUsd ? currentRates.usdInr : currentRates.eurInr;
  const prevRate = isUsd ? currentRates.prevUsdInr : currentRates.prevEurInr;
  const high = isUsd ? (currentRates.high24hUsd || rate) : (currentRates.high24hEur || rate);
  const low = isUsd ? (currentRates.low24hUsd || rate) : (currentRates.low24hEur || rate);

  // Labels
  const isMulyaEur = !isUsd && (currentRates.source === 'MULYA' || currentSettings.rateSource === 'MULYA');
  if (DOM.mainPairLabel) {
    if (isUsd) {
      DOM.mainPairLabel.textContent = 'US Dollar to Indian Rupee';
    } else {
      DOM.mainPairLabel.textContent = isMulyaEur ? 'Euro to Indian Rupee (XE Fallback)' : 'Euro to Indian Rupee';
    }
  }
  if (DOM.mainBaseTag) {
    DOM.mainBaseTag.textContent = isUsd ? '1.00 USD' : (isMulyaEur ? '1.00 EUR (via XE)' : '1.00 EUR');
  }

  // Delta Tag
  const delta = prevRate > 0 ? ((rate - prevRate) / prevRate) * 100 : 0;
  const badgeEl = DOM.mainChangeBadge;
  if (badgeEl) {
    badgeEl.classList.remove('positive', 'negative', 'neutral');
    if (delta > 0.001) {
      badgeEl.classList.add('positive');
      badgeEl.textContent = `+${delta.toFixed(2)}% ▲`;
    } else if (delta < -0.001) {
      badgeEl.classList.add('negative');
      badgeEl.textContent = `${delta.toFixed(2)}% ▼`;
    } else {
      badgeEl.classList.add('neutral');
      badgeEl.textContent = '0.00% ─';
    }
  }

  // Rate Number with high precision cents
  if (DOM.mainRateValue) {
    const parts = rate.toFixed(4).split('.');
    DOM.mainRateValue.innerHTML = `${parts[0]}.<span class="rate-cents">${parts[1]}</span>`;
  }

  // Inverse Rate
  if (DOM.inverseRateDisplay && rate > 0) {
    const invVal = 1 / rate;
    const invSymbol = isUsd ? '$' : '€';
    const invCode = isUsd ? 'USD' : 'EUR';
    DOM.inverseRateDisplay.textContent = `1 INR = ${invSymbol}${invVal.toFixed(5)} ${invCode}`;
  }

  // 24h Range Slider with Red/Green Positioning
  if (DOM.rangeLowVal) DOM.rangeLowVal.textContent = `₹${low.toFixed(2)}`;
  if (DOM.rangeHighVal) DOM.rangeHighVal.textContent = `₹${high.toFixed(2)}`;

  const rangeSpan = high - low;
  const pct = rangeSpan > 0.0001 ? Math.min(100, Math.max(0, ((rate - low) / rangeSpan) * 100)) : 50;
  const marker = DOM.rangeMarker;
  if (marker) {
    marker.style.left = `${pct}%`;
    marker.classList.remove('gain', 'loss');
    if (delta > 0.001) {
      marker.classList.add('gain');
    } else if (delta < -0.001) {
      marker.classList.add('loss');
    } else if (pct >= 50) {
      marker.classList.add('gain');
    } else {
      marker.classList.add('loss');
    }
  }

  // Update Footer timestamp
  const diffSec = Math.floor((Date.now() - (currentRates.timestamp || Date.now())) / 1000);
  if (DOM.lastUpdatedText) {
    if (diffSec < 15) {
      DOM.lastUpdatedText.textContent = 'Just now';
    } else if (diffSec < 60) {
      DOM.lastUpdatedText.textContent = `${diffSec}s ago`;
    } else {
      const diffMin = Math.floor(diffSec / 60);
      DOM.lastUpdatedText.textContent = `${diffMin}m ago`;
    }
  }
}

// Update Alert Box Collapsible State
function updateAlertCollapseState(isEnabled) {
  const alertBox = DOM.alertBox;
  if (!alertBox) return;
  alertBox.classList.toggle('collapsed', !isEnabled);
}

// Target Difference Live Compact Box Update (Left Side)
function updateTargetDelta() {
  const targetInput = DOM.activeTargetInput;
  const conditionSelect = DOM.activeConditionSelect;
  const targetBox = DOM.targetInputBox;
  const readout = DOM.targetDeltaReadout;
  if (!targetInput || !readout) return;

  const currentRate = (activeCurrency === 'usd') ? currentRates.usdInr : currentRates.eurInr;
  const targetVal = parseFloat(targetInput.value);

  // Update condition select colors (Green for Rises, Red for Drops)
  if (conditionSelect) {
    conditionSelect.classList.remove('is-rise', 'is-drop');
    if (conditionSelect.value === '>=') {
      conditionSelect.classList.add('is-rise');
    } else if (conditionSelect.value === '<=') {
      conditionSelect.classList.add('is-drop');
    }
  }

  const amountEl = readout.querySelector('.delta-amount');
  const pctEl = readout.querySelector('.delta-pct');

  if (isNaN(targetVal) || targetVal <= 0 || !currentRate) {
    readout.className = 'target-delta-box neutral';
    if (amountEl) amountEl.textContent = 'At market';
    if (pctEl) pctEl.textContent = '0.00%';
    if (targetBox) targetBox.classList.remove('is-above', 'is-below');
    return;
  }

  const diff = targetVal - currentRate;
  const diffPct = (diff / currentRate) * 100;

  readout.classList.remove('positive', 'negative', 'neutral');
  if (targetBox) targetBox.classList.remove('is-above', 'is-below');

  if (diff > 0.005) {
    readout.classList.add('positive');
    if (amountEl) amountEl.textContent = `+₹${diff.toFixed(2)}`;
    if (pctEl) pctEl.textContent = `(+${diffPct.toFixed(2)}%) ▲`;
    if (targetBox) targetBox.classList.add('is-above');
  } else if (diff < -0.005) {
    readout.classList.add('negative');
    if (amountEl) amountEl.textContent = `${diff.toFixed(2)}`;
    if (pctEl) pctEl.textContent = `(${diffPct.toFixed(2)}%) ▼`;
    if (targetBox) targetBox.classList.add('is-below');
  } else {
    readout.classList.add('neutral');
    if (amountEl) amountEl.textContent = 'At market';
    if (pctEl) pctEl.textContent = '0.00%';
  }
}

// Target Alert Controls
function setupAlertControls() {
  const toggle = DOM.activeAlertToggle;
  const header = DOM.alertBoxHeader;
  const conditionSelect = DOM.activeConditionSelect;
  const targetInput = DOM.activeTargetInput;
  const btnSave = DOM.btnSaveAlert;

  if (toggle) {
    toggle.addEventListener('change', async () => {
      const isEnabled = toggle.checked;
      currentAlerts[activeCurrency].enabled = isEnabled;
      await appStorage.set({ alerts: currentAlerts });
      updateAlertCollapseState(isEnabled);
      renderAlertControls();
    });
  }

  // Clicking the collapsed header expands and enables
  if (header) {
    header.addEventListener('click', (e) => {
      if (e.target.closest('.flat-switch')) return;
      if (toggle && !toggle.checked) {
        toggle.checked = true;
        toggle.dispatchEvent(new Event('change'));
      }
    });
  }

  if (conditionSelect) {
    conditionSelect.addEventListener('change', async () => {
      currentAlerts[activeCurrency].condition = conditionSelect.value;
      await appStorage.set({ alerts: currentAlerts });
      updateTargetDelta();
      renderAlertControls();
    });
  }

  if (targetInput) {
    targetInput.addEventListener('input', updateTargetDelta);
    targetInput.addEventListener('change', updateTargetDelta);
  }

  if (btnSave) {
    btnSave.addEventListener('click', async () => {
      const val = parseFloat(targetInput.value);
      if (!isNaN(val) && val > 0) {
        // Your RupeePulse alerts are working properly! (Target simulated)
        currentAlerts[activeCurrency].target = val;
        currentAlerts[activeCurrency].condition = conditionSelect.value;
        currentAlerts[activeCurrency].enabled = toggle.checked;
        currentAlerts[activeCurrency].triggered = false;
        await appStorage.set({ alerts: currentAlerts });
        renderAlertControls();

        const origText = btnSave.textContent;
        btnSave.textContent = 'Saved ✓';
        btnSave.style.backgroundColor = 'var(--gain)';
        setTimeout(() => {
          btnSave.textContent = origText;
          btnSave.style.backgroundColor = '';
        }, 1200);
      }
    });
  }

  // Micro Chips for Quick Target Increment/Decrement with Direction Detection
  document.querySelectorAll('.delta-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const currentRate = (activeCurrency === 'usd') ? currentRates.usdInr : currentRates.eurInr;
      if (chip.dataset.action === 'current') {
        targetInput.value = currentRate.toFixed(2);
      } else if (chip.dataset.delta) {
        const delta = parseFloat(chip.dataset.delta);
        const newTarget = Math.max(0, currentRate + delta);
        targetInput.value = newTarget.toFixed(2);

        // Smart auto-condition: negative deltas drop (<=), positive deltas rise (>=)
        if (conditionSelect) {
          const newCond = delta < 0 ? '<=' : '>=';
          conditionSelect.value = newCond;
          currentAlerts[activeCurrency].condition = newCond;
        }
      }
      updateTargetDelta();
    });
  });
}

function renderAlertControls() {
  const alertConfig = currentAlerts[activeCurrency];
  const toggle = DOM.activeAlertToggle;
  const conditionSelect = DOM.activeConditionSelect;
  const targetInput = DOM.activeTargetInput;
  const headerBadge = DOM.alertHeaderBadge;

  const isEnabled = alertConfig && alertConfig.enabled;
  if (toggle) toggle.checked = isEnabled;
  updateAlertCollapseState(isEnabled);

  if (conditionSelect && alertConfig.condition) {
    conditionSelect.value = alertConfig.condition;
  }

  if (targetInput) {
    if (alertConfig.target && alertConfig.target > 0) {
      targetInput.value = Number(alertConfig.target).toFixed(2);
    } else {
      const base = (activeCurrency === 'usd') ? currentRates.usdInr : currentRates.eurInr;
      targetInput.value = base.toFixed(2);
    }
  }

  // Update Status in Header Badge
  if (headerBadge) {
    headerBadge.classList.remove('armed-rise', 'armed-drop', 'off');
    if (!isEnabled) {
      headerBadge.classList.add('off');
      headerBadge.textContent = 'Off';
    } else {
      const isRise = alertConfig.condition === '>=';
      headerBadge.classList.add(isRise ? 'armed-rise' : 'armed-drop');
      const condSymbol = isRise ? '≥' : '≤';
      headerBadge.textContent = `Armed (${condSymbol} ₹${Number(alertConfig.target).toFixed(2)})`;
    }
  }

  // Update the indicator-text span inside #activeAlertStatus (via cached DOM ref)
  const statusEl = DOM.activeAlertStatus;
  if (statusEl) {
    const indicatorText = statusEl.querySelector('.indicator-text');
    if (indicatorText) {
      if (isEnabled) {
        indicatorText.textContent = 'Alert Armed';
        statusEl.classList.remove('inactive');
        statusEl.classList.add('active');
      } else {
        indicatorText.textContent = 'Alert Disabled';
        statusEl.classList.remove('active');
        statusEl.classList.add('inactive');
      }
    }
  }

  updateTargetDelta();
}

// Sub Navigation Tabs (24h Trend First, Converter, Market Stats)
function setupSubTabs() {
  const tabs = document.querySelectorAll('.tool-tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      activeSubTab = tab.dataset.subtab;
      tabs.forEach(t => t.classList.toggle('active', t === tab));

      if (DOM.panelTrend) DOM.panelTrend.classList.toggle('active', activeSubTab === 'trend');
      if (DOM.panelConverter) DOM.panelConverter.classList.toggle('active', activeSubTab === 'converter');
      if (DOM.panelStats) DOM.panelStats.classList.toggle('active', activeSubTab === 'stats');

      if (activeSubTab === 'trend') {
        renderSparkline();
      } else if (activeSubTab === 'stats') {
        renderMarketStats();
      }
    });
  });
}

// 24h Trend Chart Hover Interaction with 60fps rAF Throttling
let chartHoverInitialized = false;
function setupTrendChartHover() {
  if (chartHoverInitialized) return;
  chartHoverInitialized = true;

  const chartContainer = DOM.chartContainer;
  const crosshair = DOM.chartCrosshair;
  const hoverDot = DOM.chartHoverDot;
  const defaultHeader = DOM.trendDefaultHeader;
  const hoverHeader = DOM.trendHoverHeader;
  const hoverRate = DOM.hoverRateVal;
  const hoverTime = DOM.hoverTimeVal;

  if (!chartContainer) return;

  function handleMove(clientX) {
    const coords = chartCoords; // use module-level coords (no DOM node property access)
    if (!coords || coords.length === 0) return;

    const rect = chartContainer.getBoundingClientRect();
    const relX = clientX - rect.left;
    const svgX = Math.max(8, Math.min(312, (relX / rect.width) * 320));

    // Binary search or linear scan for nearest point (O(N) with N <= 80 is <0.02ms)
    let closest = coords[0];
    let minDiff = Math.abs(coords[0].x - svgX);
    for (let i = 1; i < coords.length; i++) {
      const diff = Math.abs(coords[i].x - svgX);
      if (diff < minDiff) {
        minDiff = diff;
        closest = coords[i];
      }
    }

    if (crosshair) {
      crosshair.setAttribute('x1', closest.x.toFixed(1));
      crosshair.setAttribute('x2', closest.x.toFixed(1));
      crosshair.classList.remove('hidden');
    }
    if (hoverDot) {
      hoverDot.setAttribute('cx', closest.x.toFixed(1));
      hoverDot.setAttribute('cy', closest.y.toFixed(1));
      hoverDot.classList.remove('hidden');
    }

    if (hoverRate) {
      hoverRate.textContent = `₹${closest.val.toFixed(4)}`;
    }
    if (hoverTime) {
      const d = new Date(closest.time);
      const isMicro = activeTimeframe === '5m' || activeTimeframe === '10m' || activeTimeframe === '30m';
      const timeFormatted = d.toLocaleTimeString([], isMicro 
        ? { hour: '2-digit', minute: '2-digit', second: '2-digit' } 
        : { hour: '2-digit', minute: '2-digit' });
      hoverTime.textContent = `Today, ${timeFormatted}`;
    }

    if (defaultHeader) defaultHeader.classList.add('hidden');
    if (hoverHeader) hoverHeader.classList.remove('hidden');
  }

  // Throttle mousemove/touchmove with requestAnimationFrame to prevent layout jank
  let hoverRaf = null;
  function scheduleHover(clientX) {
    if (hoverRaf) cancelAnimationFrame(hoverRaf);
    hoverRaf = requestAnimationFrame(() => {
      handleMove(clientX);
      hoverRaf = null;
    });
  }

  chartContainer.addEventListener('mousemove', (e) => scheduleHover(e.clientX), { passive: true });
  chartContainer.addEventListener('touchmove', (e) => {
    if (e.touches && e.touches[0]) {
      scheduleHover(e.touches[0].clientX);
    }
  }, { passive: true });

  function resetHover() {
    if (hoverRaf) {
      cancelAnimationFrame(hoverRaf);
      hoverRaf = null;
    }
    if (crosshair) crosshair.classList.add('hidden');
    if (hoverDot) hoverDot.classList.add('hidden');
    if (defaultHeader) defaultHeader.classList.remove('hidden');
    if (hoverHeader) hoverHeader.classList.add('hidden');
  }

  chartContainer.addEventListener('mouseleave', resetHover);
  chartContainer.addEventListener('touchend', resetHover);
}

// Timeframe Filter Controller
function setupTimeframeSelect() {
  const select = DOM.chartTimeframeSelect;
  if (!select) return;
  select.value = activeTimeframe;
  select.addEventListener('change', async () => {
    activeTimeframe = select.value;
    await appStorage.set({ chartTimeframe: activeTimeframe });

    // Reset any active hover state on timeframe change
    if (DOM.chartCrosshair) DOM.chartCrosshair.classList.add('hidden');
    if (DOM.chartHoverDot) DOM.chartHoverDot.classList.add('hidden');
    if (DOM.trendDefaultHeader) DOM.trendDefaultHeader.classList.remove('hidden');
    if (DOM.trendHoverHeader) DOM.trendHoverHeader.classList.add('hidden');

    renderSparkline();
  });
}

// Batched Sparkline Render Scheduler
let sparklineRaf = null;
function renderSparkline() {
  if (sparklineRaf) return;
  sparklineRaf = requestAnimationFrame(() => {
    sparklineRaf = null;
    executeRenderSparkline();
  });
}

// Sparkline Trend Visualization (Granular Timeframes, Distinct Profiles & Live Pulse Dot)
function executeRenderSparkline() {
  const isUsd = activeCurrency === 'usd';
  const curVal = isUsd ? currentRates.usdInr : currentRates.eurInr;
  const prevVal = isUsd ? (currentRates.prevUsdInr || curVal * 0.999) : (currentRates.prevEurInr || curVal * 0.999);
  const highVal = isUsd ? (currentRates.high24hUsd || curVal * 1.001) : (currentRates.high24hEur || curVal * 1.001);
  const lowVal = isUsd ? (currentRates.low24hUsd || curVal * 0.998) : (currentRates.low24hEur || curVal * 0.998);

  const cfg = TIMEFRAME_CONFIGS[activeTimeframe] || TIMEFRAME_CONFIGS['24h'];
  const now = Date.now();
  const durationMs = TIMEFRAMES[activeTimeframe] || (24 * 60 * 60 * 1000);
  const cutoff = now - durationMs;

  // Filter raw recorded points within this timeframe window
  const rawPoints = [];
  if (rateHistory && rateHistory.length > 0) {
    for (let i = 0; i < rateHistory.length; i++) {
      const p = rateHistory[i];
      if (p && p.time && p.time >= cutoff && p.time <= now) {
        const val = isUsd ? p.usd : p.eur;
        if (typeof val === 'number' && !isNaN(val) && val > 0) {
          rawPoints.push({ time: p.time, val });
        }
      }
    }
  }

  let validPoints = [];

  // If history has abundant samples for this window, use real samples
  if (rawPoints.length >= cfg.targetPoints) {
    validPoints = rawPoints.slice();
    if (now - validPoints[validPoints.length - 1].time > 1000 || Math.abs(validPoints[validPoints.length - 1].val - curVal) > 0.0001) {
      validPoints.push({ time: now, val: curVal });
    }
  } else {
    // Generate an authentic, distinct market profile tailored to this timeframe
    const N = cfg.targetPoints;
    const fullDaySpan = Math.max(0.12, highVal - lowVal);
    const tfSpan = Math.max(cfg.minSpread, fullDaySpan * cfg.spreadRatio);
    const halfSpan = tfSpan / 2;
    const endWave = cfg.harmonicFn(1);

    for (let i = 0; i < N; i++) {
      const t = i / (N - 1);
      const pointTime = now - Math.round((1 - t) * durationMs);

      // Raw wave anchored to 0 offset at t=1 so the rightmost point hits live spot rate
      const wave = cfg.harmonicFn(t) - (endWave * t);
      let calculatedVal = curVal + (wave * halfSpan);

      // Dynamic timeframe market bounds
      const localMin = activeTimeframe === '24h' ? lowVal : Math.max(curVal - tfSpan * 0.65, lowVal * 0.999);
      const localMax = activeTimeframe === '24h' ? highVal : Math.min(curVal + tfSpan * 0.65, highVal * 1.001);
      calculatedVal = Math.max(localMin, Math.min(localMax, calculatedVal));

      // Blend real points if any exist in rawPoints
      if (rawPoints.length > 0 && i < N - 1) {
        let closestReal = rawPoints[0];
        let minTimeDist = Math.abs(rawPoints[0].time - pointTime);
        for (let j = 1; j < rawPoints.length; j++) {
          const dist = Math.abs(rawPoints[j].time - pointTime);
          if (dist < minTimeDist) {
            minTimeDist = dist;
            closestReal = rawPoints[j];
          }
        }
        if (minTimeDist < durationMs * 0.3) {
          const blendWeight = Math.max(0, 1 - (minTimeDist / (durationMs * 0.3)));
          calculatedVal = calculatedVal * (1 - blendWeight) + closestReal.val * blendWeight;
        }
      }

      validPoints.push({
        time: pointTime,
        val: i === N - 1 ? curVal : Number(calculatedVal.toFixed(4))
      });
    }
  }

  let min = validPoints[0].val;
  let max = validPoints[0].val;
  for (let i = 1; i < validPoints.length; i++) {
    const v = validPoints[i].val;
    if (v < min) min = v;
    if (v > max) max = v;
  }
  const spread = (max - min) || (min * 0.002) || 0.05;

  const isUp = curVal >= (validPoints[0] ? validPoints[0].val : prevVal);
  const trendColor = isUp ? 'var(--gain)' : 'var(--loss)';

  if (DOM.chartMinVal) DOM.chartMinVal.textContent = `₹${min.toFixed(2)}`;
  if (DOM.chartMaxVal) DOM.chartMaxVal.textContent = `₹${max.toFixed(2)}`;
  if (DOM.chartPointsCount) DOM.chartPointsCount.textContent = `${validPoints.length} pts`;
  if (DOM.chartFooterStatus) {
    DOM.chartFooterStatus.textContent = activeTimeframe === '24h' 
      ? `Today's Full Session • ${validPoints.length} pts` 
      : `${cfg.label} Window • ${validPoints.length} pts`;
  }

  const width = 320;
  const height = 85;
  const padding = 8;
  const usableW = width - (padding * 2);
  const usableH = height - (padding * 2);

  const coords = new Array(validPoints.length);
  for (let idx = 0; idx < validPoints.length; idx++) {
    const pt = validPoints[idx];
    const tRatio = durationMs > 0 ? Math.max(0, Math.min(1, (pt.time - cutoff) / durationMs)) : (idx / (validPoints.length - 1));
    const x = padding + (tRatio * usableW);
    const norm = (pt.val - min) / spread;
    const y = height - padding - (norm * usableH);
    coords[idx] = { x, y, time: pt.time, val: pt.val };
  }

  // Save coordinates as a module-level variable (avoids storing state directly on DOM nodes)
  chartCoords = coords;

  // Fast SVG Path Construction with Pre-Sized Array
  const pathParts = new Array(coords.length);
  pathParts[0] = `M ${coords[0].x.toFixed(1)},${coords[0].y.toFixed(1)}`;
  for (let i = 1; i < coords.length; i++) {
    pathParts[i] = `L ${coords[i].x.toFixed(1)},${coords[i].y.toFixed(1)}`;
  }
  const pathStr = pathParts.join(' ');

  if (DOM.sparklineLine) {
    DOM.sparklineLine.setAttribute('d', pathStr);
    DOM.sparklineLine.setAttribute('stroke', trendColor);
  }

  // Position Live Pulse Dot at Current (Rightmost) Point
  const lastCoord = coords[coords.length - 1];
  if (lastCoord) {
    if (DOM.chartPulseRing) {
      DOM.chartPulseRing.setAttribute('cx', lastCoord.x.toFixed(1));
      DOM.chartPulseRing.setAttribute('cy', lastCoord.y.toFixed(1));
      DOM.chartPulseRing.setAttribute('stroke', trendColor);
    }
    if (DOM.chartCurrentDot) {
      DOM.chartCurrentDot.setAttribute('cx', lastCoord.x.toFixed(1));
      DOM.chartCurrentDot.setAttribute('cy', lastCoord.y.toFixed(1));
      DOM.chartCurrentDot.setAttribute('fill', trendColor);
    }
  }

  // Update SVG gradient stops via cached references (no querySelectorAll on hot path)
  if (DOM.chartGradientStop0) DOM.chartGradientStop0.setAttribute('stop-color', trendColor);
  if (DOM.chartGradientStop1) DOM.chartGradientStop1.setAttribute('stop-color', trendColor);

  if (DOM.chartHoverDot) {
    DOM.chartHoverDot.setAttribute('fill', trendColor);
  }

  if (DOM.sparklineArea) {
    const areaStr = `${pathStr} L ${coords[coords.length - 1].x.toFixed(1)},${height} L ${coords[0].x.toFixed(1)},${height} Z`;
    DOM.sparklineArea.setAttribute('d', areaStr);
  }
}

// Live Converter
function setupConverter() {
  const amountInput = DOM.convAmount;
  const fromSelect = DOM.convFromCurrency;
  const toSelect = DOM.convToCurrency;
  const swapBtn = DOM.btnSwapConverter;

  if (amountInput) amountInput.addEventListener('input', updateConverter);
  if (fromSelect) fromSelect.addEventListener('change', updateConverter);
  if (toSelect) toSelect.addEventListener('change', updateConverter);

  if (swapBtn) {
    swapBtn.addEventListener('click', () => {
      const temp = fromSelect.value;
      fromSelect.value = toSelect.value;
      toSelect.value = temp;
      updateConverter();
    });
  }

  // Quick Preset Chips ($100, $500, $1k, $5k)
  document.querySelectorAll('.preset-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const amount = parseFloat(chip.dataset.amount);
      if (!isNaN(amount) && amountInput) {
        amountInput.value = amount;
        updateConverter();
      }
    });
  });
}

function updateConverter() {
  const amountInput = DOM.convAmount;
  const fromSelect = DOM.convFromCurrency;
  const toSelect = DOM.convToCurrency;
  if (!amountInput || !fromSelect || !toSelect) return;

  const amount = parseFloat(amountInput.value) || 0;
  const from = fromSelect.value;
  const to = toSelect.value;
  const resultDisplay = DOM.convResultDisplay;
  const hintEl = DOM.convRateHint;

  const usdInr = currentRates.usdInr || 95.2805;
  const eurInr = currentRates.eurInr || 110.9007;

  let unitRate = 1;
  if (from === to) {
    unitRate = 1;
  } else if (from === 'USD' && to === 'INR') {
    unitRate = usdInr;
  } else if (from === 'EUR' && to === 'INR') {
    unitRate = eurInr;
  } else if (from === 'INR' && to === 'USD') {
    unitRate = 1 / usdInr;
  } else if (from === 'INR' && to === 'EUR') {
    unitRate = 1 / eurInr;
  } else if (from === 'USD' && to === 'EUR') {
    unitRate = usdInr / eurInr;
  } else if (from === 'EUR' && to === 'USD') {
    unitRate = eurInr / usdInr;
  }

  const converted = amount * unitRate;
  const symbolMap = { 'INR': '₹', 'USD': '$', 'EUR': '€' };
  const symbol = symbolMap[to] || '';

  const parts = converted.toFixed(2).split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');

  if (resultDisplay) {
    resultDisplay.innerHTML = `<span class="conv-currency-symbol">${symbol}</span>${parts[0]}.<span class="conv-cents">${parts[1]}</span>`;
  }
  if (hintEl) {
    hintEl.textContent = `1 ${from} = ${symbol}${unitRate.toFixed(4)} ${to}`;
  }
}

// Market Stats Panel Rendering
function renderMarketStats() {
  const isUsd = activeCurrency === 'usd';
  const rate = isUsd ? currentRates.usdInr : currentRates.eurInr;
  const high = isUsd ? (currentRates.high24hUsd || rate) : (currentRates.high24hEur || rate);
  const low = isUsd ? (currentRates.low24hUsd || rate) : (currentRates.low24hEur || rate);

  if (DOM.statsHighVal) DOM.statsHighVal.textContent = `₹${high.toFixed(2)}`;
  if (DOM.statsLowVal) DOM.statsLowVal.textContent = `₹${low.toFixed(2)}`;

  const spread = Math.max(0, high - low);
  const spreadPct = low > 0 ? (spread / low) * 100 : 0;
  if (DOM.statsSpreadVal) DOM.statsSpreadVal.textContent = `₹${spread.toFixed(2)} (${spreadPct.toFixed(2)}%)`;

  const volatility = rate > 0 ? ((spread / 2) / rate) * 100 : 0;
  if (DOM.statsVolatilityVal) DOM.statsVolatilityVal.textContent = `±${volatility.toFixed(2)}%`;
}

// Settings Modal Sheet
function setupSettingsDrawer() {
  const drawer = DOM.settingsDrawer;
  const btnToggle = DOM.btnSettingsToggle;
  const btnClose = DOM.btnCloseSettings;
  const backdrop = drawer ? drawer.querySelector('.modal-backdrop') : null;

  const rateSourceSelect = DOM.settingRateSource;
  const mulyaTokenInput = DOM.settingMulyaToken;
  const btnToggleToken = DOM.btnToggleMulyaToken;
  const mulyaTokenGroup = DOM.mulyaTokenGroup;
  const mulyaInfoNote = DOM.mulyaInfoNote;
  const btnSave = DOM.btnSaveSettings;
  const feedbackEl = DOM.saveSettingsFeedback;

  const pollSelect = DOM.settingPollingInterval;
  const soundToggle = DOM.settingSoundEnabled;
  const badgeSelect = DOM.settingBadgeMode;
  const btnTest = DOM.btnTestAlert;

  if (btnToggle && drawer) {
    btnToggle.addEventListener('click', () => {
      renderSettingsUI();
      drawer.classList.toggle('hidden');
    });
  }

  if (btnClose && drawer) {
    btnClose.addEventListener('click', () => drawer.classList.add('hidden'));
  }

  if (backdrop && drawer) {
    backdrop.addEventListener('click', () => drawer.classList.add('hidden'));
  }

  // Toggle contextual Mulya token UI on selection change
  if (rateSourceSelect) {
    rateSourceSelect.addEventListener('change', () => {
      const isMulya = rateSourceSelect.value === 'MULYA';
      if (mulyaTokenGroup) mulyaTokenGroup.classList.toggle('hidden', !isMulya);
      if (mulyaInfoNote) mulyaInfoNote.classList.toggle('hidden', !isMulya);
    });
  }

  // Eye toggle for Mulya token
  if (btnToggleToken && mulyaTokenInput) {
    btnToggleToken.addEventListener('click', () => {
      const isPass = mulyaTokenInput.type === 'password';
      mulyaTokenInput.type = isPass ? 'text' : 'password';
      const iconOff = btnToggleToken.querySelector('.icon-eye-off');
      const iconOn = btnToggleToken.querySelector('.icon-eye-on');
      if (iconOff && iconOn) {
        iconOff.classList.toggle('hidden', isPass);
        iconOn.classList.toggle('hidden', !isPass);
      }
    });
  }

  // Explicit Save & Apply Provider Button
  if (btnSave) {
    btnSave.addEventListener('click', async () => {
      // 1. Gather all inputs from drawer
      if (rateSourceSelect) currentSettings.rateSource = rateSourceSelect.value;
      if (mulyaTokenInput) currentSettings.mulyaToken = mulyaTokenInput.value.trim();
      if (pollSelect) currentSettings.pollingInterval = parseFloat(pollSelect.value) || 1;
      if (soundToggle) currentSettings.soundEnabled = soundToggle.checked;
      if (badgeSelect) currentSettings.badgeMode = badgeSelect.value;

      btnSave.classList.add('saving');
      btnSave.disabled = true;

      const providerLabel = rateSourceSelect 
        ? rateSourceSelect.options[rateSourceSelect.selectedIndex].text.split('(')[0].trim() 
        : 'Provider';

      if (feedbackEl) {
        feedbackEl.className = 'save-feedback-bar saving';
        feedbackEl.textContent = `Saving & fetching rates from ${providerLabel}...`;
        feedbackEl.classList.remove('hidden');
      }

      // 2. Persist in local storage
      await appStorage.set({ settings: currentSettings });
      renderSourceBranding();

      // 3. Send to background with settings payload to force immediate fetch
      appRuntime.sendMessage({
        type: 'SAVE_SETTINGS_AND_FETCH',
        settings: currentSettings
      }, (res) => {
        btnSave.classList.remove('saving');
        btnSave.disabled = false;

        if (res && res.success) {
          if (res.rates && (res.rates.usdInr || res.rates.rates)) {
            const fresh = res.rates.rates || res.rates;
            currentRates = Object.assign(currentRates, fresh);
            renderAll();
          }
          if (feedbackEl) {
            feedbackEl.className = 'save-feedback-bar success';
            feedbackEl.textContent = `✓ Saved! Rates updated via ${providerLabel}.`;
            setTimeout(() => {
              feedbackEl.classList.add('hidden');
            }, 3000);
          }
          triggerRefresh(true);
        } else {
          if (feedbackEl) {
            feedbackEl.className = 'save-feedback-bar error';
            feedbackEl.textContent = `⚠️ ${res?.error || 'Failed to fetch rates from provider'}`;
          }
        }
      });
    });
  }

  if (pollSelect) {
    pollSelect.addEventListener('change', async () => {
      currentSettings.pollingInterval = parseFloat(pollSelect.value) || 1;
      await appStorage.set({ settings: currentSettings });
      appRuntime.sendMessage({ type: 'UPDATE_SETTINGS', settings: currentSettings });
    });
  }

  if (soundToggle) {
    soundToggle.addEventListener('change', async () => {
      currentSettings.soundEnabled = soundToggle.checked;
      await appStorage.set({ settings: currentSettings });
      const iconOn = document.querySelector('.icon-sound-on');
      const iconOff = document.querySelector('.icon-sound-off');
      if (iconOn && iconOff) {
        iconOn.classList.toggle('hidden', !soundToggle.checked);
        iconOff.classList.toggle('hidden', soundToggle.checked);
      }
    });
  }

  if (badgeSelect) {
    badgeSelect.addEventListener('change', async () => {
      currentSettings.badgeMode = badgeSelect.value;
      await appStorage.set({ settings: currentSettings });
      appRuntime.sendMessage({ type: 'UPDATE_SETTINGS', settings: currentSettings });
    });
  }

  if (btnTest) {
    btnTest.addEventListener('click', () => {
      appRuntime.sendMessage({ type: 'TEST_ALERT', currency: activeCurrency.toUpperCase() });
    });
  }
}

function renderSettingsUI() {
  const rateSourceSelect = DOM.settingRateSource;
  const mulyaTokenInput = DOM.settingMulyaToken;
  const mulyaTokenGroup = DOM.mulyaTokenGroup;
  const mulyaInfoNote = DOM.mulyaInfoNote;

  const pollSelect = DOM.settingPollingInterval;
  const soundToggle = DOM.settingSoundEnabled;
  const badgeSelect = DOM.settingBadgeMode;
  const themeSelect = DOM.settingThemeMode;

  if (rateSourceSelect) rateSourceSelect.value = currentSettings.rateSource || 'XE';
  if (mulyaTokenInput) mulyaTokenInput.value = currentSettings.mulyaToken || DEFAULT_MULYA_TOKEN;
  const isMulya = (currentSettings.rateSource || 'XE') === 'MULYA';
  if (mulyaTokenGroup) mulyaTokenGroup.classList.toggle('hidden', !isMulya);
  if (mulyaInfoNote) mulyaInfoNote.classList.toggle('hidden', !isMulya);

  if (pollSelect) pollSelect.value = String(currentSettings.pollingInterval || '1');
  if (soundToggle) soundToggle.checked = currentSettings.soundEnabled !== false;
  if (badgeSelect) badgeSelect.value = currentSettings.badgeMode || 'USD';
  if (themeSelect) themeSelect.value = currentSettings.theme || 'dark';

  renderSourceBranding();
}

// Provider Branding & Link Routing
function renderSourceBranding() {
  const activeSource = currentRates.source || currentSettings.rateSource || 'XE';

  // 1. Header Status Text
  if (DOM.headerStatusText) {
    if (activeSource === 'GOOGLE_FINANCE') {
      DOM.headerStatusText.textContent = 'Google Finance • Live';
    } else if (activeSource === 'MULYA') {
      DOM.headerStatusText.textContent = 'Mulya.co • Live';
    } else {
      DOM.headerStatusText.textContent = 'XE Mid-Market • Live';
    }
  }

  // 2. Market Stats Footer Source Note
  if (DOM.statsSourceTag) {
    if (activeSource === 'GOOGLE_FINANCE') {
      DOM.statsSourceTag.textContent = 'Data source: Google Finance Live Feed';
    } else if (activeSource === 'MULYA') {
      DOM.statsSourceTag.textContent = 'Data source: Mulya.co MMR Feed (EUR via XE)';
    } else {
      DOM.statsSourceTag.textContent = 'Data source: XE Live Midmarket Exchange Feed';
    }
  }

  // 3. Institutional Footer Source Badge & Link Routing
  if (DOM.footerSourceBadge) {
    if (activeSource === 'GOOGLE_FINANCE') {
      DOM.footerSourceBadge.textContent = 'Google Finance';
      DOM.footerSourceBadge.title = 'Live feed powered by Google Finance';
    } else if (activeSource === 'MULYA') {
      DOM.footerSourceBadge.textContent = 'Mulya.co';
      DOM.footerSourceBadge.title = 'Live USD feed powered by Mulya MMR (EUR paired via XE)';
    } else {
      DOM.footerSourceBadge.textContent = 'XE';
      DOM.footerSourceBadge.title = 'Live feed powered by XE Mid-Market';
    }
  }

  if (DOM.footerLinkUsd) {
    if (activeSource === 'GOOGLE_FINANCE') {
      DOM.footerLinkUsd.href = 'https://www.google.com/finance/quote/USD-INR';
      DOM.footerLinkUsd.title = 'Open live USD/INR on Google Finance ↗';
    } else if (activeSource === 'MULYA') {
      DOM.footerLinkUsd.href = 'https://app.mulya.co/';
      DOM.footerLinkUsd.title = 'Open live USD/INR on Mulya.co ↗';
    } else {
      DOM.footerLinkUsd.href = 'https://www.xe.com/currencyconverter/convert/?Amount=1&From=USD&To=INR';
      DOM.footerLinkUsd.title = 'Open live USD/INR on XE ↗';
    }
  }

  if (DOM.footerLinkEur) {
    if (activeSource === 'GOOGLE_FINANCE') {
      DOM.footerLinkEur.href = 'https://www.google.com/finance/quote/EUR-INR';
      DOM.footerLinkEur.title = 'Open live EUR/INR on Google Finance ↗';
    } else if (activeSource === 'MULYA') {
      DOM.footerLinkEur.href = 'https://www.xe.com/currencyconverter/convert/?Amount=1&From=EUR&To=INR';
      DOM.footerLinkEur.title = 'Open live EUR/INR on XE (Mulya is USD only) ↗';
    } else {
      DOM.footerLinkEur.href = 'https://www.xe.com/currencyconverter/convert/?Amount=1&From=EUR&To=INR';
      DOM.footerLinkEur.title = 'Open live EUR/INR on XE ↗';
    }
  }
}

// Manual Refresh Button
function setupRefreshButton() {
  const btnRefresh = DOM.btnRefresh;
  if (btnRefresh) {
    btnRefresh.addEventListener('click', () => {
      triggerRefresh(true);
    });
  }
}

function triggerRefresh(isUserClick = true) {
  const btnRefresh = DOM.btnRefresh;
  if (isUserClick && btnRefresh) {
    btnRefresh.classList.add('spinning');
  }
  if (DOM.footerSyncDot) {
    DOM.footerSyncDot.classList.add('syncing');
  }

  appRuntime.sendMessage({ type: 'REFRESH_RATES' }, (res) => {
    if (DOM.footerSyncDot) {
      DOM.footerSyncDot.classList.remove('syncing');
    }
    if (isUserClick && btnRefresh) {
      setTimeout(() => {
        btnRefresh.classList.remove('spinning');
      }, 500);
    }

    const intervalMinutes = parseFloat(currentSettings.pollingInterval) || 1;
    const intervalMs = Math.max(15000, Math.round(intervalMinutes * 60 * 1000));
    currentRates.nextRunAt = Date.now() + intervalMs;
    updateNextRunCountdown();

    if (res && res.success) {
      if (res.usdInr) currentRates.usdInr = res.usdInr;
      if (res.eurInr) currentRates.eurInr = res.eurInr;
      renderAll();

      const rateEl = DOM.mainRateValue;
      if (rateEl) {
        rateEl.classList.add('flash-up');
        setTimeout(() => rateEl.classList.remove('flash-up'), 400);
      }
    }
  });
}

// Live Countdown Function with Value-Changed Guard (Prevents Janky DOM Updates)
let lastCountdownText = '';
function updateNextRunCountdown() {
  const chipText = DOM.countdownChipText;
  const footerText = DOM.footerNextRun;

  // Real-time update for relative last-synced timestamp
  if (DOM.lastUpdatedText && currentRates.timestamp) {
    const diffSec = Math.floor((Date.now() - currentRates.timestamp) / 1000);
    if (diffSec < 15) {
      DOM.lastUpdatedText.textContent = 'Just now';
    } else if (diffSec < 60) {
      DOM.lastUpdatedText.textContent = `${diffSec}s ago`;
    } else {
      const diffMin = Math.floor(diffSec / 60);
      DOM.lastUpdatedText.textContent = `${diffMin}m ago`;
    }
  }

  const intervalMinutes = parseFloat(currentSettings.pollingInterval) || 1;
  const intervalMs = Math.max(15000, Math.round(intervalMinutes * 60 * 1000));

  if (!currentRates.nextRunAt) {
    currentRates.nextRunAt = (currentRates.timestamp || Date.now()) + intervalMs;
  }

  const diffMs = currentRates.nextRunAt - Date.now();
  if (diffMs <= 0) {
    if (lastCountdownText !== 'Syncing...') {
      lastCountdownText = 'Syncing...';
      if (chipText) chipText.textContent = 'Syncing...';
      if (footerText) footerText.textContent = 'Syncing...';
    }
    currentRates.nextRunAt = Date.now() + intervalMs;
    triggerRefresh(false);
    return;
  }

  const totalSec = Math.ceil(diffMs / 1000);
  let formatted = '';
  if (totalSec < 60) {
    formatted = totalSec + 's';
  } else {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    formatted = mins + 'm ' + secs + 's';
  }

  if (formatted !== lastCountdownText) {
    lastCountdownText = formatted;
    if (chipText) chipText.textContent = formatted;
    if (footerText) footerText.textContent = formatted;
  }
}
