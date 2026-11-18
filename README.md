# usage-band：Claude 用量條

在 Claude Code 對話框上方常駐顯示你的 Claude 方案用量，不用再點進設定頁看。

```
5小時  41%  1小時12分後重置
每週   25%  偏慢，可以多用　時間已過 53%｜週日 00:00 重置，剩 3天7小時
對話   20%  正常　這個對話的內容量
```

一項一行，百分比上下對齊；視窗變窄時只截掉最右邊的補充說明，不會換行跑版。

- **5 小時額度**：已用百分比與多久後重置。用到 70% 變橘色、90% 變紅色。
- **每週額度**：已用百分比、這週時間已過百分比、重置時間（台灣時間）與剩餘時間。
- **每週進度判斷**：用量落後時間超過 10 個百分點顯示「偏慢，可以多用」，超前超過 10 個百分點顯示「偏快，省著用」，其餘顯示「剛好」。
- **對話內容量**：這個對話佔上限的百分比，提醒什麼時候該換新對話。25% 以下「正常」（綠）、25%～50%「這件做完就換」（橘）、50% 以上「現在就收尾、換新對話」（紅）。
- 數字來自 Claude Code 官方回報的用量，不需要提供任何帳密；每次 Claude 回覆後自動更新。新對話要等第一則回覆後才有數字。

## 需要什麼

- Claude 桌面 app（Code 分頁）或 Claude Code 終端機版。
- Claude Pro 或 Max 訂閱。官方文件只寫明 Pro、Max、Ultra 會提供用量數字；其他方案若沒有數字，用量條會一直顯示「送出第一則訊息後顯示」。

## 安裝

**桌面 app**：在對話框旁按 **+** → **Plugins** → **Add marketplace**，輸入 `pingtao66/claude-usage-band`，再按 **Add plugin** 選 `usage-band`。

**終端機版**：在 Claude Code 的輸入框輸入

```
/plugin install usage-band --marketplace pingtao66/claude-usage-band
```

問「Add marketplace?」時按 `y`，範圍選第一個（user），按 Enter。裝好後新開的對話都會有用量條。

**從 shell 安裝**：

```bash
claude plugin install usage-band --marketplace pingtao66/claude-usage-band
```
