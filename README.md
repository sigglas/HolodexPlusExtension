# HolodexPlus

Edge / Chrome 瀏覽器擴充程式，自動監控 [Holodex](https://holodex.net/) 的直播排程，在開播前自動開啟分頁並嘗試自動播放。

---

## 功能

| 功能 | 說明 |
|---|---|
| 頻道監控 | 設定多個要追蹤的頻道（`channel.name` 或 `channel.english_name`） |
| 自動開啟分頁 | 在排程開播前 **3 分鐘**（可調整）自動開啟 `https://holodex.net/watch/{id}` |
| 防重複開啟 | 同一直播分頁已開啟時（無論手動或自動），不會重複開啟 |
| 自動重開 | 分頁被關閉但距開播時間未超過 **10 分鐘**（可調整）時，下次輪詢自動重開 |
| 自動播放 | 開啟分頁後嘗試自動播放 YouTube 嵌入播放器 |
| 桌面通知 | 開啟分頁時顯示通知（可關閉） |

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
點擊工具列圖示 → 在輸入框輸入頻道名稱（如 `Koseki Bijou`）→ 按「新增」

或點擊「**設定**」進入進階設定頁面批次管理。

### 設定說明
| 設定項 | 預設 | 說明 |
|---|---|---|
| 提前開啟（分鐘） | 3 | 排程開始前幾分鐘自動開啟分頁 |
| 重開視窗時限（分鐘） | 10 | 開播後多少分鐘內若視窗被關閉會自動重開 |
| 自動播放 | 開啟 | 開啟分頁後嘗試自動播放 |
| 前景開啟 | 關閉 | 開啟時是否切換至新分頁 |
| 桌面通知 | 開啟 | 開啟直播時顯示通知 |

---

## 檔案結構

```
HolodexPlus/
├── manifest.json        # 擴充程式設定（Manifest V3）
├── background.js        # Service Worker：輪詢 API、判斷開啟邏輯
├── content.js           # Content Script：自動播放邏輯
├── popup.html / .js     # 工具列彈出視窗
├── options.html / .js   # 進階設定頁面
├── generate_icons.js    # 圖示產生腳本（僅開發用）
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

---

## API 來源

```
GET https://holodex.net/api/v2/live?type=placeholder%2Cstream&include=mentions&org=Hololive
```

每分鐘輪詢一次（MV3 Alarm 最小間隔為 1 分鐘）。

---

## 注意事項

- **自動播放**：現代瀏覽器限制未經互動的自動播放，部分情況無法成功，建議在 Edge/Chrome 的網站設定中允許 `holodex.net` 的自動播放。
- **非 YouTube 直播**（如 Twitch）：`holodex.net/watch/{id}` 仍會開啟，但自動播放邏輯僅針對 YouTube 嵌入。

---

## 相容性

| 瀏覽器 | 支援 |
|---|---|
| Microsoft Edge | ✅ 完整支援 |
| Google Chrome | ✅ 完整相容 |
| Firefox | ❌ 不支援（Manifest V3 差異） |
