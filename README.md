# HolodexPlus

Edge / Chrome 瀏覽器擴充程式，自動監控 [Holodex](https://holodex.net/) 的直播排程，在開播前自動開啟分頁並嘗試自動播放。

---

## 功能

| 功能 | 說明 |
|---|---|
| 頻道監控 | 設定多個要追蹤的頻道（`channel.name` 或 `channel.english_name`），每個頻道可個別設定選項 |
| 標籤監控 | 透過 `topic_id`（如 `minecraft`、`monhun`）偵測所有符合標籤的直播 |
| 標題關鍵字監控 | 標題包含指定關鍵字（不分大小寫）的直播也會被觸發 |
| mentions 偵測 | 每頻道可獨立開啟：若其他直播的 `mentions` 陣列包含監控頻道，也自動開啟 |
| 自動開啟分頁 | 在排程開播前 **3 分鐘**（可調整）自動開啟 `https://holodex.net/watch/{id}` |
| 防重複開啟 | 同一直播分頁已開啟時（無論手動或自動），不會重複開啟 |
| 自動重開 | 分頁被關閉但距開播時間未超過 **10 分鐘**（可調整）時自動重開 |
| 備援計時器 | 即使 Holodex 頁面未重新發送 API 請求，每分鐘仍會用上次快取資料重新判斷時間規則 |
| 自動播放 | 開啟分頁後嘗試自動播放 YouTube 嵌入播放器 |
| 桌面通知 | 開啟分頁時顯示通知（可關閉） |
| 資料過期清理 | 開啟記錄 6 小時後自動清除；快取資料超過 2 小時後備援計時器不再使用 |

---

## 安裝（開發者模式側載）

1. 打開 Edge，網址列輸入 `edge://extensions/`
2. 開啟右上角「**開發人員模式**」
3. 點擊「**載入解壓縮的擴充功能**」，選擇本專案資料夾
4. 擴充程式即會出現在工具列

> **Chrome** 同樣支援：打開 `chrome://extensions/`，步驟相同。

---

## 使用方式

### 新增監控頻道
點擊工具列圖示 → 在「已監控頻道」輸入框輸入頻道名稱（如 `Koseki Bijou`）→ 按「新增」

每個頻道條目右側有 **⚙** 按鈕，可展開個別選項：
- **偵測 mentions**：若其他直播的 mentions 包含此頻道，也同樣觸發開啟

### 設定說明
| 設定項 | 預設 | 說明 |
|---|---|---|
| 提前開啟（分鐘） | 3 | 排程開始前幾分鐘自動開啟分頁 |
| 重開視窗時限（分鐘） | 10 | 開播後多少分鐘內若視窗被關閉會自動重開 |
| 自動播放 | 開啟 | 開啟分頁後嘗試自動播放 |
| 前景開啟 | 關閉 | 開啟時是否切換至新分頁 |
| 桌面通知 | 開啟 | 開啟直播時顯示通知 |

---

## 觸發條件（OR 關係）

以下任一條件符合即會觸發開啟：

1. **頻道名稱** — `channel.name` 或 `channel.english_name` 完全相符（不分大小寫）
2. **mentions**（需個別啟用） — `stream.mentions[]` 中包含監控頻道
3. **topic_id** — `stream.topic_id` 完全相符（不分大小寫）
4. **標題關鍵字** — `stream.title` 包含關鍵字（不分大小寫，子字串比對）

---

## 檔案結構

```
HolodexPlus/
├── manifest.json        # 擴充程式設定（Manifest V3）
├── background.js        # Service Worker：攔截資料處理、計時器、開啟邏輯
├── interceptor.js       # MAIN world 注入：攔截頁面的 fetch / XHR
├── content.js           # ISOLATED world：橋接訊息 + 自動播放
├── popup.html / .js     # 工具列彈出視窗
├── options.html / .js   # 進階設定頁面
├── generate_icons.js    # 圖示產生腳本（僅開發用）
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

---

## 運作原理

本擴充程式**不主動呼叫 API**，而是攔截 Holodex 頁面本身發出的請求：

```
holodex.net 頁面發出 fetch('/api/v2/live?...')
    ↓
interceptor.js（MAIN world）攔截回應，postMessage 給 content.js
    ↓
content.js（ISOLATED world）轉送給 background service worker
    ↓
background.js 判斷是否需要開啟新分頁
    ↓
每分鐘 alarm 也會用上次快取資料重新執行一次判斷
```

---

## 注意事項

- **需要 Holodex 頁面開啟**：攔截機制依賴網站本身發送請求。若未開啟 `holodex.net`，備援計時器仍會每分鐘使用最後一次快取資料（2 小時內有效）重新判斷。
- **自動播放**：現代瀏覽器限制未經互動的自動播放，部分情況無法成功，建議在 Edge/Chrome 的網站設定中允許 `holodex.net` 的自動播放。
- **非 YouTube 直播**（如 Twitch）：`holodex.net/watch/{id}` 仍會開啟，但自動播放邏輯僅針對 YouTube 嵌入。

---

## 相容性

| 瀏覽器 | 支援 |
|---|---|
| Microsoft Edge | ✅ 完整支援 |
| Google Chrome | ✅ 完整相容 |
| Firefox | ❌ 不支援（Manifest V3 / `world: "MAIN"` 差異） |
