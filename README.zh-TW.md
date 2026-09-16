<!-- translation-of: README.md sha256:5a444d374c11ea5c -->
<p align="center">
  <img src="assets/logo.svg" width="96" height="96" alt="">
</p>

<h1 align="center">TypeShuttle 打字接駁</h1>

<p align="center">
  <strong>瀏覽器版遠端桌面關閉了剪貼簿同步，照樣能把文字貼進去。</strong><br>
  Chrome、Edge 擴充功能：幫你把文字打進遠端，或把小檔案一個位元組都不差地傳過去。
</p>

<p align="center">
  <a href="README.md">English</a> · 繁體中文
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-Apache--2.0-blue.svg" alt="授權：Apache-2.0"></a>
  <a href="https://github.com/shengwei-peng/typeshuttle/releases"><img src="https://img.shields.io/github/v/release/shengwei-peng/typeshuttle?label=release" alt="最新版本"></a>
  <a href="https://github.com/shengwei-peng/typeshuttle/actions"><img src="https://img.shields.io/github/actions/workflow/status/shengwei-peng/typeshuttle/ci.yml?label=CI" alt="CI 狀態"></a>
</p>

---

## 為什麼用 TypeShuttle

很多瀏覽器版遠端桌面和網頁主控台沒有剪貼簿同步，或是被關掉了。模擬打字的工具通常送的是按鍵代碼，遠端會再依自己的鍵盤配置和輸入法重新解讀。遠端開著注音輸入法時，`Hi 12` 送過去可能變成注音符號。

TypeShuttle 改走遠端用戶端本身的文字輸入管道，換行再用真正的按鍵送出。

| | TypeShuttle | 系統層按鍵工具<br><sub>xdotool、AutoHotkey、AutoKey</sub> | 一般「以按鍵貼上」擴充 |
|---|---|---|---|
| 中文、emoji、符號完整送達，不受遠端輸入法和鍵盤配置影響 | ✅ | ❌ | 視網站而定 |
| 處理各用戶端的輸入怪癖（吞字、換行被移除） | ✅ | ❌ | 很少 |
| 位元組完全一致的檔案傳輸，附 sha256 核對 | ✅ | ❌ | ❌ |
| 一按鍵或點滑鼠就立刻停止 | ✅ | ❌ | 部分支援 |
| 只在你按快捷鍵、而且是已啟用的網站時才讀剪貼簿 | ✅ | — | 部分支援 |
| 不需要在瀏覽器以外安裝任何東西 | ✅ | ❌ | ✅ |

## 功能

- **一個快捷鍵。** 在已啟用的遠端桌面分頁按 <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>V</kbd>（macOS 是 <kbd>Cmd</kbd>+<kbd>Shift</kbd>+<kbd>V</kbd>），就會把剪貼簿內容打進遠端。
- **送文字，不送按鍵代碼。** 中文、日文、emoji、符號都和複製時一模一樣，遠端輸入法開著或關著都沒關係。
- **精確傳輸。** 程式碼、設定檔，或 1 MB 以內的任何檔案，TypeShuttle 會打一段簡短的 bash 指令，在遠端還原成位元組完全相同的檔案並印出 sha256，讓你和本機顯示的值核對。
- **預設就安全。**
  - 等你放開所有按鍵才開始打字，一按鍵或點滑鼠就立刻停止。
  - 多行或較長的內容會先確認。
  - 結尾的換行不會送出，複製來的指令不會自己執行。
- **從中斷處接著送。** 打字被中斷時，還沒送出的內容會留在工具列面板，把游標移回原位後就能送出剩下的部分。
- **工具列面板。** 送出前可以檢查或修改內容。遠端是聊天程式時，行與行之間可以改按 Shift+Enter；Makefile 這類內容可以送真正的 Tab 鍵。
- **最少權限。** 一次只授權一個網站。不要求 `clipboardRead`、不使用 `debugger`、不發出任何網路請求。

## 安裝

目前還沒有上架商店，請從 Release 安裝：

1. 從 [Releases](https://github.com/shengwei-peng/typeshuttle/releases) 下載 `typeshuttle-<版本>.zip`。
2. 解壓縮到之後不會刪除或移動的資料夾。資料夾被移動或刪除，擴充功能就會失效。
3. 開啟 `chrome://extensions`（Chrome）或 `edge://extensions`（Edge），打開「**開發人員模式**」。
4. 按「**載入未封裝項目**」，選擇有 `manifest.json` 的那個資料夾。

想從原始碼建置的話，執行 `npm ci && npm run build`，再載入 `dist/extension`。

> [!NOTE]
> 擴充功能的介面目前只有繁體中文。

## 快速上手

1. 用瀏覽器開啟遠端桌面。點工具列的 TypeShuttle 圖示，按「**在此網站啟用**」，瀏覽器詢問時選擇允許。每個網站只要做一次。
2. 在本機複製文字，點一下遠端要輸入的位置，按 <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>V</kbd>。
3. 多行或較長的內容會先顯示預覽。按 <kbd>Enter</kbd> 送出、<kbd>Esc</kbd> 取消，或按 <kbd>P</kbd> 改用精確傳輸。
4. 打字結束前，請不要碰鍵盤和滑鼠。

> [!WARNING]
> 遠端游標在終端機時，多行內容的每一行打完就會立刻執行。要在終端機建立檔案，請用精確傳輸。

工具列面板、精確傳輸、設定、編輯器注意事項與疑難排解，請看[使用指南](docs/user-guide.zh-TW.md)。

## 隱私與權限

TypeShuttle 不發出任何網路請求，也不保留歷史紀錄。你送出的內容只會打進遠端，不會送到其他地方。

| 權限 | 用途 |
|---|---|
| `storage` | 儲存設定。打字中斷後剩下的內容只暫存在工作階段記憶體，關閉分頁或瀏覽器時清除。 |
| `scripting` | 在你啟用的網站上執行 TypeShuttle。 |
| `activeTab` | 開啟面板時讀取目前分頁的網址，判斷能不能在這個網站啟用。 |
| 網站存取權（選用） | 你選擇啟用某個網站時才請求，一次一個網站。可以在設定頁收回。 |

詳細說明見 [PRIVACY.md](docs/PRIVACY.md)（英文）。

## 常見問題

**會在背景讀取我的剪貼簿嗎？**
不會。只有在已啟用的網站按下快捷鍵時，瀏覽器才會把剪貼簿文字交給 TypeShuttle。

**可以把遠端的內容複製回本機嗎？**
不行。TypeShuttle 只能從本機送到遠端。

**為什麼不用 xdotool 或 AutoHotkey？**
它們送的是按鍵代碼，會被遠端的輸入法和鍵盤配置改掉，也無法處理用戶端特有的問題，例如按鍵之後下一段文字被吞掉。

**我的工作環境可以用嗎？**
TypeShuttle 打的是你本來就能手動輸入的內容，不會更改任何遠端桌面設定。送進遠端的內容請遵守所屬單位的規範。瀏覽器如果受單位管理，安裝擴充功能可能需要管理員核准。

## 文件

- [使用指南](docs/user-guide.zh-TW.md)（[English](docs/user-guide.md)）：工具列面板、精確傳輸、設定、疑難排解
- [Clients](docs/clients.md)（英文）：各用戶端的行為與已知問題
- [Architecture](docs/ARCHITECTURE.md)（英文）：運作方式與設計決策
- [Testing](docs/testing.md)（英文）：自動化測試與手動檢查清單

## 參與貢獻

歡迎回報錯誤、回報用戶端相容性，或送出 pull request。開始前請先閱讀 [CONTRIBUTING.md](.github/CONTRIBUTING.md)（英文）。資安問題請依 [SECURITY.md](.github/SECURITY.md) 私下回報。

## 授權

[Apache License 2.0](LICENSE)

所有產品名稱與商標皆屬於各自的所有者。TypeShuttle 是獨立專案，與任何遠端桌面廠商沒有關聯，也未獲得其背書或贊助。提到產品名稱僅為說明相容性。
