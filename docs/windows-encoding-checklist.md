# Windows 中文亂碼處理流程

本專案在 Windows / PowerShell 環境下，中文常會在終端輸出中顯示成亂碼，但檔案本身仍可能是正常 UTF-8。遇到中文亂碼時，先照這份流程判斷，不要直接把中文改成 Unicode escape，也不要反覆重寫整份檔案。

## 判斷原則

1. 先分清楚「終端顯示亂碼」與「檔案內容真的壞掉」。
2. 若瀏覽器、Node UTF-8 讀檔、Git diff 其中任一能正常顯示中文，通常是 PowerShell code page 或工具輸出顯示問題。
3. 只有在 TypeScript / JavaScript 原始碼無法編譯，或 UTF-8 讀檔確認內容已壞掉時，才進行內容修復。
4. 不要為了終端顯示亂碼，把正常中文文案改成 Unicode escape。Unicode escape 只作為最後手段，用於必須避開特定工具寫檔編碼破壞的短字串。

## 固定檢查流程

### 1. 用 Node 以 UTF-8 讀檔確認內容

```powershell
node -e "const fs=require('fs'); const s=fs.readFileSync('apps/web/src/app/review/review-client.tsx','utf8'); const i=s.indexOf('待修正發票'); console.log(JSON.stringify(s.slice(i, i+300)));"
```

判斷：

- JSON 輸出中中文正常：檔案是正常 UTF-8，問題多半只是 PowerShell 顯示。
- JSON 輸出中中文也已亂碼：檔案內容可能已被錯誤編碼寫壞，需要從 Git diff 或備份修正。

### 2. 用 Git diff 檢查實際變更

```powershell
git diff -- apps/web/src/app/review/review-client.tsx
```

判斷：

- diff 內容正常：不要改編碼，只繼續功能驗證。
- diff 內容出現不合理亂碼：回頭檢查寫檔工具或替換字串來源。

### 3. 用 TypeScript / 測試確認是否影響程式

```powershell
cd "C:\Users\AA018507\Documents\Codex\記帳軟體\accounting-automation-github\apps\web"
npm run typecheck
npm test
```

判斷：

- typecheck/test 通過：中文顯示問題不影響程式。
- typecheck/test 失敗：依錯誤行號檢查是否字串未閉合、引號被破壞、或插入了字面上的 `` `n``。

## 寫檔規則

### 優先做法

使用 .NET UTF-8 no BOM 寫回：

```powershell
[System.IO.File]::WriteAllText($path, $text, [System.Text.UTF8Encoding]::new($false))
```

### 避免做法

- 不要用會受 PowerShell 目前 code page 影響的輸出重導向來寫中文檔案。
- 不要用 `Get-Content` 的終端顯示結果判定檔案中文是否壞掉。
- 不要在沒有 Node UTF-8 驗證前，把正常中文改成 Unicode escape。

## 何時可以用 Unicode escape

只有同時符合以下條件才使用：

1. 該字串很短，且位於 JS/TS 原始碼內。
2. 寫檔工具或 patch 工具會破壞中文，但 escape 後可保證編譯與瀏覽器顯示正確。
3. 已確認沒有更乾淨的 UTF-8 寫檔方式。

使用後仍需跑：

```powershell
npm run typecheck
npm test
```

## 常見誤判

- `Get-Content` 顯示亂碼，不等於檔案壞掉。
- PowerShell 終端顯示亂碼，不等於瀏覽器會顯示亂碼。
- Next build 在本機出現 `spawn EPERM` 是已知 Windows/Codex 環境問題；若前面已顯示 compiled successfully，且 `npm run typecheck` 通過，不應把它當作中文編碼問題。

## 建議結論格式

處理中文亂碼時，回報應使用這種口徑：

- 已用 Node UTF-8 讀檔確認檔案內中文正常。
- 終端亂碼屬於 PowerShell 顯示問題，不需要改成 Unicode escape。
- 已用 `npm run typecheck` / `npm test` 驗證程式未受影響。