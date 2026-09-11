<div align="center">

# 💱 RupeePulse

**Live USD/INR & EUR/INR rates · Price Target Alerts · Chrome Extension**

[![Manifest V3](https://img.shields.io/badge/Manifest-V3-blue?logo=googlechrome&logoColor=white)](https://developer.chrome.com/docs/extensions/mv3/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)
[![No Dependencies](https://img.shields.io/badge/dependencies-none-success)](.)

A **production-ready**, zero-dependency Chrome extension that delivers live mid-market exchange rates, interactive sparkline charts, smart price-target alerts, and a full currency converter — all in a premium, minimal fintech popup.

</div>

---

## ✨ Features

| Feature | Details |
|---|---|
| **Live Rates** | USD/INR & EUR/INR sourced from XE mid-market feed, auto-refreshed (default: every 30s–1min) |
| **Interactive Sparkline** | 8 timeframe filters (5m · 10m · 30m · 1h · 2h · 6h · 12h · 24h Today). Live pulse dot at current position. Hover crosshair with exact price + timestamp |
| **Price Target Alerts** | Set ≥ or ≤ targets per currency. Chrome desktop notification + audio chime on breach. Collapsible UI |
| **Currency Converter** | 3-way: USD ⇄ EUR ⇄ INR. Quick preset chips (100 · 500 · 1,000 · 5,000). Live mid-market formula |
| **Market Stats** | 24H High, Low, Spread (₹ & %), and session Volatility (±%) |
| **Toolbar Badge** | Live rate on browser icon with directional red/green color. Supports USD, EUR, rotating, or off |
| **Session Range Gauge** | Visual 24H high-low slider showing current rate position with red/green needle |
| **Premium UI** | Dark & light themes · Plus Jakarta Sans typography · Tabular numerals · Zero neon · Institutional design |
| **One-Click Copy** | Copy exact 4-decimal rate to clipboard with animated confirmation |
| **Inverse Rate** | Live inverse glance (e.g., `1 INR = $0.01050 USD`) in the hero card |

---

## 🚀 Installation

### Option A — Load as Unpacked Extension (Developer Mode)

1. **Download** this repository:
   ```bash
   git clone https://github.com/abhishekkumbhani/rupeepulse.git
   ```

2. Open Chrome and navigate to:
   ```
   chrome://extensions/
   ```

3. Enable **Developer Mode** (toggle in the top-right corner).

4. Click **"Load unpacked"** and select the project folder (the one containing `manifest.json`).

5. The **RupeePulse** icon will appear in your Chrome toolbar. Pin it for quick access.

> **Note:** The extension fetches live rates from `https://www.xe.com`. Internet connection required.

---

## 🗂 Project Structure

```
rupeepulse/
├── manifest.json          # Chrome Extension Manifest V3
├── background.js          # Service worker: polling, alerts, badge, storage
├── popup.html             # Extension popup UI (CSP-protected)
├── popup.css              # Design system: dark/light themes, animations
├── popup.js               # Popup controller: DOM cache, rendering, chart
├── offscreen.html         # Offscreen document host for audio
├── offscreen.js           # Web Audio API chime synthesizer
├── icons/                 # Extension icons (16/32/48/128px)
├── generate_icons.ps1     # PowerShell icon generator
├── package-extension.ps1  # PowerShell build/package script
└── README.md
```

---

## 🏗 Architecture

### Background Service Worker (`background.js`)
- Runs as a **Manifest V3 service worker** (no persistent background page)
- Uses `chrome.alarms` for periodic polling (survives SW idle/termination)
- A secondary `setInterval` heartbeat keeps rates fresh when the SW is awake
- `isFetching` concurrency lock + 8-second `AbortController` prevent overlapping/hung requests
- Rolling 24-hour history capped at **720 points** (~25 KB) to keep `chrome.storage.local` I/O minimal
- Uses `structuredClone()` for fast deep-copies instead of `JSON.parse(JSON.stringify())`
- Single `Date.now()` call cached per processing cycle (avoids 4+ redundant clock queries)

### Popup Controller (`popup.js`)
- All **40+ DOM elements cached once** at startup in an immutable `DOM` map — zero tree traversals in frame callbacks
- `renderAll()` and `renderSparkline()` scheduled via **`requestAnimationFrame` debouncers** — multiple rapid storage events merge into a single 60fps paint frame
- Sparkline `mousemove`/`touchmove` throttled with rAF — locked to display refresh rate
- Icon NodeLists cached once after `initDOM()` — `applyTheme()` and `updateSoundIndicators()` never re-walk the DOM
- SVG gradient stops cached in `DOM` — no `querySelectorAll` on the sparkline hot path
- Chart hover coordinates in a **module-level variable** (not stored on a DOM node)
- `updateNextRunCountdown()` uses a **value-changed guard** — only writes to DOM when the string changes

### Security Model
- **Permissions**: `alarms`, `storage`, `notifications`, `offscreen`, `tabs` — minimal and declared
- **Host permissions**: `https://www.xe.com/*` only
- **CSP**: `script-src 'self'` blocks eval and inline scripts
- **No third-party JS**: Zero npm dependencies, zero CDN-loaded scripts
- **No user data collected**: Only rates and preferences stored locally

---

## ⚙️ Configuration

All settings persist in `chrome.storage.local` and are accessible from **Preferences** (click `•••` in the header):

| Setting | Options | Default |
|---|---|---|
| Appearance | Dark / Light | Dark |
| Update Frequency | 30s · 1min · 3min · 5min · 15min · 30min | 1 min |
| Audio Chime | On / Muted | On |
| Toolbar Badge | USD · EUR · Rotate · Off | USD |

---

## 🔔 Price Target Alerts

1. Enable the **"Price Target Alert"** toggle in the popup.
2. Choose condition: **≥ Rises to or Above** or **≤ Drops to or Below**.
3. Set your target price, or use a quick chip (`-0.25`, `-0.10`, `+0.10`, `+0.25`, `Current`).
4. Click **Save Alert**.
5. When the rate crosses your target, Chrome sends a desktop notification + audio chime.
6. The "View on XE" notification button opens XE.com directly.

> Alerts auto-reset when the rate moves back outside the threshold, so re-entry will trigger again.

---

## 🛡 Security

- **Auth header**: The XE API uses a publicly available read-only Basic Auth token. It grants no write access and is unrelated to any user account.
- **No user data collected**: Nothing is transmitted to any third-party server beyond XE for rate fetching.
- **Responsible disclosure**: Open a [GitHub Issue](../../issues) with the `security` label.

---

## 🔧 Development

### Prerequisites
- A Chromium-based browser with Developer Mode
- Node.js (optional — only for syntax checking)

### Syntax Check
```bash
node -c popup.js
node -c background.js
node -c offscreen.js
```

### Package for Distribution
```powershell
.\package-extension.ps1
# Output: RupeePulse-v1.0.0.zip (~53 KB)
```

---

## 🤝 Contributing

Contributions are welcome!

1. Fork the repository
2. Create a branch: `git checkout -b feature/my-improvement`
3. Make changes (vanilla JS only — no dependencies)
4. Test in Chrome as an unpacked extension
5. Run `node -c popup.js background.js offscreen.js`
6. Open a Pull Request

### Code Style Guidelines
- **Vanilla JS only** — no frameworks, no npm dependencies
- **DOM operations**: Use the `DOM` cache map — never `getElementById` in render loops
- **Render pipeline**: Always schedule UI updates via `requestAnimationFrame`
- **Storage writes**: Batch where possible; avoid writing on every keystroke

---

## 📝 Changelog

### v1.0.0 — Initial Production Release
- Live USD/INR & EUR/INR rates from XE mid-market API
- 8-timeframe interactive sparkline with live pulse dot and hover inspection
- Collapsible price target alert with smart chip controls and directional color coding
- 3-tab architecture: Trend · Converter · Market Stats
- Premium dark/light flat design system (Plus Jakarta Sans, zero neon)
- `requestAnimationFrame` batched render pipeline (60fps, zero layout jank)
- DOM element cache map (40+ nodes, zero recurring tree traversals)
- Rolling 24h history with 720-point cap (< 25KB storage footprint)
- `structuredClone` deep-copy, `AbortController` timeout, `isFetching` concurrency lock
- CSP meta tag, `tabs` permission fix, offscreen sendResponse cleanup

---

## 📄 License

This project is licensed under the **MIT License**.

```
MIT License

Copyright (c) 2026 Abhishek Kumbhani (RupeePulse Contributors)

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

<div align="center">
Built with ❤️ for traders, travelers, and finance enthusiasts.
</div>
