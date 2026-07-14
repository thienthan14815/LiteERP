# 卓越應用工程準則

一個應用要稱得上「卓越」,不能只是「功能齊全」,而必須同時達成 4 個目標:

1. 正確解決使用者的問題
2. 運作穩定,發生錯誤時可以復原
3. 易於使用、易於維護、易於擴充
4. 為使用者或企業創造可量測的價值

其中,如果你的第一優先是**穩定性**,整個開發流程就必須圍繞這個方向設計:**從源頭減少錯誤、及早發現錯誤、隔離錯誤、快速復原,並且永遠保有退回安全版本的能力。**

---

## 1. 評估卓越應用的 KPI 體系

### 1.1 產品價值 KPI

應用必須解決一個真實存在的問題,而不是堆疊大量功能。

重要指標:

| KPI | 意義 |
|---|---|
| Task success rate(任務成功率) | 使用者能完成核心工作的比例 |
| Time to value(價值抵達時間) | 從打開應用到獲得第一個價值的時間 |
| Feature adoption(功能採用率) | 實際使用各功能的使用者比例 |
| Retention(留存率) | 使用者是否會回來繼續使用 |
| Churn rate(流失率) | 停止使用的使用者比例 |
| Conversion rate(轉換率) | 完成目標行為的比例 |
| User satisfaction(使用者滿意度) | 使用者的滿意程度 |
| Problem resolution rate(問題解決率) | 應用成功處理問題的比例 |

以「自動建站應用」為例:

- 正確的 KPI **不是**「有產出 HTML」。
- 正確的 KPI 應該是:
  - 網站成功建立的百分比
  - 介面與原稿的相似度百分比
  - 是否存在 responsive 錯誤
  - 能否成功匯入 Bricks Builder
  - 使用者是否需要大量手動修改

**一個功能只有在使用者能完成最終目標時,才算成功。**

### 1.2 穩定性 KPI

以穩定為第一優先時,這是最重要的一組 KPI。

#### 1.2.1 可用性(Availability)

Availability 是系統可正常使用的時間比例。

公式:

```
Availability = Uptime / 總時間
```

參考等級:

| Availability | 每月最大停機時間 |
|---|---|
| 99% | 約 7 小時 18 分 |
| 99.9% | 約 43 分 |
| 99.95% | 約 22 分 |
| 99.99% | 約 4 分 23 秒 |

- 小型內部應用:可設定 99.5–99.9%。
- 商業 SaaS、支付系統、持續服務客戶的應用:應以 99.9% 以上為目標。

可用性目標應以 **SLO(Service Level Objective)** 的形式明確寫下,並搭配**錯誤預算(error budget)**管理:當本期錯誤預算耗盡時,暫停新功能開發、優先修復穩定性。

#### 1.2.2 無崩潰率(Crash-free rate)

使用階段(session)未發生 crash 的比例。

建議目標:

- Crash-free sessions ≥ 99.5%
- Crash-free users ≥ 99.5%

關鍵應用:

- Crash-free sessions ≥ 99.9%

#### 1.2.3 錯誤率(Error rate)

請求或任務失敗的比例。

```
Error rate = 錯誤請求數 / 總請求數
```

常見目標:

- 一般 API:低於 1%
- 關鍵 API:低於 0.1%
- 支付、驗證、資料寫入:越接近 0% 越好

**不能只計算 HTTP 500。** 還必須計入:

- Timeout
- 請求失敗
- 資料錯誤
- 任務卡住
- 第三方服務的錯誤
- 背景 job 失敗
- API 回傳 200 但結果不正確

#### 1.2.4 延遲(Latency)

系統的回應時間。

**不應只看平均值**,必須追蹤:

- P50:50% 的請求快於此值
- P95:95% 的請求快於此值
- P99:99% 的請求快於此值

範例目標:

- P50 < 200 ms
- P95 < 800 ms
- P99 < 2 秒

對於 AI 任務、影片處理或網站生成等長時任務,時間可以更長,但應用必須:

- 顯示進度
- 不讓介面凍結
- 允許 retry
- 允許從失敗的步驟繼續
- 保存工作狀態

#### 1.2.5 MTTR(平均復原時間)

Mean Time to Recovery:發生事故後,系統平均需要多久復原。

```
MTTR = 總修復時間 / 事故次數
```

穩定的應用不是永遠不出錯的應用,而是:

- 知道錯誤發生在哪裡
- 快速告警
- 不遺失資料
- 快速復原
- 可以 rollback

務實目標:

- 輕微事故:15–30 分鐘內
- 嚴重事故:1 小時內
- 無法立即修復的錯誤:數分鐘內 rollback

#### 1.2.6 MTBF(平均故障間隔)

Mean Time Between Failures:兩次系統故障之間的平均時間。MTBF 越長,系統越穩定。

#### 1.2.7 資料完整性(Data integrity)

系統不允許:

- 遺失資料
- 重複寫入資料
- 寫入錯誤資料
- 各服務之間的資料不一致
- 顯示狀態與實際狀態不符

應設定的 KPI:

- Data loss rate 目標為 0%
- Duplicate transaction rate 目標趨近 0%
- Backup success rate 目標為 100%
- Restore test success rate 目標為 100%

> 註:0%/100% 是「零容忍目標」——重點不是宣稱永不失敗,而是**任何一次偏離都必須立即觸發告警、調查與修正**,並定期演練 restore 來驗證備份真的可用。

### 1.3 使用者體驗 KPI

技術很好但難以使用的應用,仍然不是卓越的應用。

#### 1.3.1 易用性(Usability)

需要衡量:

- 新使用者是否能理解如何操作
- 是否不需說明文件就能完成任務
- 是否會在介面中迷失
- 是否能分辨「系統處理中」與「系統當掉」
- 發生錯誤時,提示訊息是否能幫助使用者自行修正

參考 KPI:

- Task completion rate ≥ 90%
- Critical task completion rate ≥ 98%
- First-time success rate ≥ 80%

#### 1.3.2 無障礙(Accessibility)

應用應符合以下原則:

- 可以只用鍵盤操作
- 有清楚的 focus state
- 對比度足夠
- 不只用顏色傳達狀態
- 表單有 label
- 圖片有適當的替代描述
- 內容可被 screen reader 朗讀
- 字體不過小
- 行動裝置上的按鈕夠大

#### 1.3.3 響應式(Responsive)

需要在以下環境檢查:

- Desktop、Laptop、Tablet、Mobile
- 小螢幕、超寬螢幕
- 不同瀏覽器

不只檢查「會不會縮放」,還必須檢查:

- 內容是否溢出
- Modal 是否被遮住
- 行動裝置鍵盤是否擋住輸入框
- 按鈕是否夠大
- 資料表格是否有合理的呈現方式

### 1.4 資安 KPI

資安不是最後一關的檢查,它必須貫穿整個開發生命週期。

#### 1.4.1 身分驗證(Authentication)

- 密碼以正確方式雜湊(使用專用演算法:bcrypt、scrypt 或 argon2,**絕不使用**單純的 MD5/SHA)
- 限制登入失敗次數,並對登入端點套用 rate limiting
- 必要時提供 MFA
- Token 有效期限
- Refresh token 受保護、可輪替(rotation)
- 可登出所有裝置
- 不洩漏 session

#### 1.4.2 授權(Authorization)

- Authentication 回答「你是誰」。
- Authorization 回答「你可以做什麼」。

**權限必須在 backend 檢查,不能只在 frontend 隱藏按鈕。**

例如:

- 使用者不能查看其他使用者的資料
- 一般員工不能存取 admin 功能
- 使用者不能靠修改 URL 上的 ID 存取他人資源(IDOR)

#### 1.4.3 資料保護

- 全程 HTTPS
- 敏感資料加密
- 不以明文儲存密碼
- 不把 token、密碼、API key 寫入 log
- 不把 secret commit 上 GitHub
- 資料庫做好權限劃分
- 有資料保存與刪除政策

#### 1.4.4 API 保護

- Rate limiting
- Input validation
- Schema validation
- 防 SQL injection
- 防 XSS
- 防 CSRF
- 防惡意檔案上傳
- 限制 request 大小
- Timeout
- 驗證 webhook 簽章
- 重要操作具備 idempotency

### 1.5 可維護性 KPI

一個一開始跑得很好,但「改一個功能壞三個功能」的應用,不算穩定。

需要評估:

- 程式碼是否有清楚的模組劃分
- 是否有測試
- 是否有文件
- 新進開發者能否理解系統
- 能否更換第三方服務
- 能否 rollback
- 是否過度依賴單一人員

可追蹤的指標:

| KPI | 目標 |
|---|---|
| Test coverage | 不可單獨作為指標,聚焦關鍵邏輯 |
| Build success rate | 95–98% 以上 |
| Deployment failure rate | 低於 5% |
| Change failure rate | 越低越好 |
| Mean review time | PR 不長期積壓 |
| Technical debt | 有清單與處理計畫 |
| Documentation coverage | 主要模組皆有文件 |

**Test coverage 90% 不代表軟體品質好。更重要的是:測試有沒有涵蓋真正危險的情境。**

---

## 2. 功能完成的標準(Definition of Done)

一個功能不能因為「code 寫完了」就算完成。

Definition of Done 應包含:

- 有明確的需求
- 有 acceptance criteria
- UI 完整
- Backend 完整
- 有 validation
- 有錯誤處理
- 有 loading state
- 有 empty state
- 有權限控管
- 有 log
- 有 metric
- 有測試
- 有文件
- 已完成 code review
- 已檢查 responsive
- 已檢查資安
- 已在 staging 驗證
- 有 rollback 計畫
- 已由 Product Owner 或負責人驗收

以「上傳檔案」功能為例,不能只測「上傳成功」,還必須測:

- 檔案過大
- 格式錯誤
- 檔案損壞
- 檔名重複
- 傳輸中斷網
- 使用者連按多次上傳
- 上傳成功但寫入資料庫失敗
- 寫入資料庫成功但存檔失敗
- 檔案含有危險內容
- 使用者沒有權限
- 儲存空間已滿
- 儲存服務 timeout

---

## 3. 建立一個應用的完整流程

### 階段 1:定義問題

在選擇技術之前,必須先回答:

- 這個應用是給誰用的?
- 使用者正遇到什麼問題?
- 他們目前如何解決?
- 為什麼現有解法不夠好?
- 應用創造什麼價值?
- 應用中最重要的動作是什麼?
- 如果應用失敗,會發生什麼?
- 哪些資料最重要?
- 應用需要持續運作,還是偶爾使用?

應撰寫 Problem Statement:

```
目標使用者:
現有問題:
原因:
後果:
提議的解法:
期望的價值:
成功的衡量方式:
```

範例:

```
對象:不會寫程式的 Bricks Builder 使用者。

問題:把網站從 URL 複製成 Bricks JSON 非常耗時。

解法:系統自動分析 URL、截圖、HTML、CSS,並產生 Bricks JSON。

KPI:
- 匯入成功率 ≥ 98%
- 視覺相似度 ≥ 90%
- Responsive 錯誤率 < 2%
- Job 失敗率 < 1%
- Job 中斷時不遺失資料
```

### 階段 2:界定範圍

將需求分為三組:

- **Must have**:沒有它,應用就沒有價值。
- **Should have**:重要,但可以之後補上。
- **Nice to have**:有很好,但不應拖慢第一版。

範例:

```
Must have:
- 登入
- 建立 project
- 輸入 URL
- 分析網站
- 產生結果
- 下載或匯出結果
- 保存 job 狀態
- 失敗時可 retry

Should have:
- 版本歷史
- 視覺比對
- 團隊協作
- 詳細錯誤報告

Nice to have:
- Template marketplace
- AI chat assistant
- 自動最佳化
```

**不要在第一版就想做完所有東西。5 個穩定的功能,勝過 30 個常常出錯的功能。**

### 階段 3:建立 User Flow

每個功能都必須有清楚的流程:

- 使用者從哪裡開始?
- 他們輸入什麼?
- 系統驗證什麼?
- 系統處理什麼?
- 成功會怎樣?
- 失敗會怎樣?
- 能不能重試?
- 資料有沒有被保存?

一個好的 flow 必須包含:

- Happy path
- Alternative path
- Error path
- Permission path
- Recovery path

範例:

```
建立 project
→ 輸入 URL
→ 驗證 URL
→ 建立 job
→ 分析
→ 逐步保存
→ 產生結果
→ 驗證結果
→ 顯示 preview
→ Export
```

Error path:

```
網站封鎖 crawler
→ 改用 browser automation
→ 仍失敗,請使用者提供檔案或截圖
→ 保存錯誤狀態
→ 允許從「分析」步驟 retry
```

### 階段 4:撰寫功能需求

每個功能應以 User Story 形式撰寫:

```
身為一個 [使用者類型],
我想要 [執行某動作],
以便 [獲得某價值]。
```

範例:

```
身為一個使用者,
我想要系統保存分析進度,
以便斷網時不必從頭重跑。
```

Acceptance criteria:

```
Given:一個 job 已完成 5 步中的 3 步
When:Server 重啟
Then:Job 從第 4 步繼續
And:不產生重複資料
And:使用者看到正確的狀態
```

**Acceptance criteria 越清楚,測試品質越高。**

### 階段 5:撰寫非功能需求

這是最常被忽略、卻決定穩定性的部分。

需要確定:

**Performance**
- 多少並發使用者?
- 每秒多少 request?
- 最大回應時間?
- 最大檔案大小?
- 一個背景任務最長跑多久?

**Reliability**
- Uptime 目標?
- 需要 high availability 嗎?
- 可以容忍遺失多少資料(RPO)?
- 要在多久內復原(RTO)?

**Security**
- 哪些資料是敏感的?
- 權限如何劃分?
- 需要 audit log 嗎?

**Scalability**
- 預估 6 個月、1 年、3 年的使用者數?
- 有沒有突發流量?
- 哪個元件負載最重?

**Compatibility**
- 支援哪些瀏覽器?
- 哪些作業系統?
- Mobile 還是 desktop?
- 哪個 API version?

### 階段 6:架構設計

**不要因為某個架構「很現代」就選擇它。**

MVP 或小型應用的選擇:

```
Frontend
→ Backend monolith
→ PostgreSQL
→ Redis
→ Object Storage
→ Background Worker
```

這通常是最佳選擇,因為:

- 容易開發
- 容易 debug
- 容易部署
- 成本低
- 故障點少
- 容易備份

應用變大後,可以拆分:

- API Service
- Authentication Service
- Job Service
- Notification Service
- File Service
- AI Processing Service

只有在**真的**具備以下條件時才使用 microservices:

- 有多個獨立團隊
- 各模組負載差異極大
- 需要獨立部署
- 有故障隔離的需求
- Monolith 已明顯造成阻礙

**Microservices 不會自動讓系統更穩定**,反而可能增加:

- 網路故障
- Timeout
- 資料不一致
- 追蹤錯誤的難度
- 營運成本

### 階段 7:資料設計

需要確定:

- 有哪些 entity?
- Entity 之間的關係?
- 哪些資料是必填的?
- 哪些資料可以為 null?
- 哪些資料不允許重複?
- 哪些狀態是合法的?
- 刪除 user 時,關聯資料如何處理?

Job 的 state machine 範例:

```
pending
→ validating
→ queued
→ processing
→ validating_result
→ completed
```

錯誤狀態:

```
failed_retryable
failed_permanent
cancelled
timeout
```

**不要只有 success / failed 兩種狀態**,否則無法知道 job 卡在哪一步、能不能 retry。

每張表應具備:

- Primary key
- Unique constraint
- Foreign key
- Index
- Created time
- Updated time
- Version
- 必要時的 audit 欄位

### 階段 8:API 設計

一個好的 API 需要:

- 清楚的 endpoint 命名
- Request schema
- Response schema
- Validation
- Authentication
- Authorization
- Error code
- Pagination
- Rate limiting
- Versioning
- Idempotency
- Timeout
- Logging

好的錯誤回應範例:

```json
{
  "error": {
    "code": "PROJECT_URL_UNREACHABLE",
    "message": "無法存取所提供的 URL。",
    "retryable": true,
    "request_id": "req_abc123"
  }
}
```

不應該只回傳:

```json
{
  "error": "Something went wrong"
}
```

**`request_id` 對於追查 log 極為重要。**

### 階段 9:容錯設計

這是穩定應用的核心。

**Timeout**

- 所有對外的 request 都必須有 timeout。
- 不允許系統無限等待。

**Retry**

只對「可能恢復」的錯誤 retry:

- Timeout
- 暫時性網路錯誤
- 服務回傳 429(並遵守 `Retry-After` 標頭)
- 服務回傳 502、503

原則:

- 不做無限 retry
- **只 retry 冪等(idempotent)的操作**;寫入類操作必須先具備 idempotency key 才能安全重試
- 使用 exponential backoff **並加上 jitter(隨機抖動)**,避免大量 client 同時重試造成雪崩:

```
1 秒 → 2 秒 → 4 秒 → 8 秒(每段加上隨機 jitter)
```

**Circuit breaker**

如果第三方服務持續故障,暫時停止呼叫它,避免拖垮整個系統。恢復時先進入 **half-open** 狀態,以少量請求試探,成功後才完全恢復。

**Idempotency**

當使用者連按兩次按鈕、或 request 被重送時,系統不得產生兩筆交易。

特別需要 idempotency 的場景:

- 付款
- 建立訂單
- 寄送 email
- 建立 job
- Webhook
- 扣除 credit

**Queue**

重的任務應透過 queue 執行:

- 寄送 email
- 影片處理
- 網站分析
- 呼叫 AI
- 匯出檔案
- 爬取資料

Queue 的好處:

- API 不會被卡住
- 可以 retry
- 可以限制 concurrency
- 可以保存狀態
- 可以追蹤 job
- 把重負載與主要 request 隔離

**Graceful degradation(優雅降級)**

一個模組故障時,應用仍應維持基本運作。

例如:

- Analytics 服務故障,但使用者仍能登入
- Email 系統故障,但訂單仍被保存
- AI 建議故障,但使用者仍可手動編輯內容
- Preview 故障,但原始檔案仍可下載

### 階段 10:開發

一開始就建立程式碼標準:

- Coding convention
- Formatter
- Linter
- Type checking
- Branch strategy
- Pull request
- Code review
- Commit convention
- Secret management
- 環境分離

需要的環境:

- Local
- Development
- Testing
- Staging
- Production

**不允許直接在 production 上做實驗。**

重要規則:

- 不 hard-code secret
- 不 hard-code 環境 URL
- 不用 production 帳號測試
- 不用 production 資料庫做 local 開發
- 不在沒有紀錄的情況下手動修改資料庫
- 所有 migration 都必須有版本

### 階段 11:測試

**Unit test** — 檢驗單一函式或小模組:

- 計價
- Email 驗證
- 狀態轉換
- 權限檢查
- 資料處理

**Integration test** — 檢驗元件之間的協作:

- API 與資料庫
- Worker 與 queue
- App 與 storage
- Backend 與 AI 服務
- Webhook 與資料庫

**End-to-end test** — 檢驗真實使用者流程:

```
註冊 → 登入 → 建立 project → 執行 job → 查看結果 → Export
```

**Contract test** — 確保 service 之間的 API 不會被意外改變。

**Load test** — 檢驗多人同時使用:

- 正常負載
- 尖峰負載
- 突發流量
- 長時間運行
- 超出上限

**Failure test** — 主動破壞各元件:

- 資料庫變慢
- Redis 斷線
- 第三方 API timeout
- Storage 故障
- Worker 重啟
- Queue 滿載
- Server 記憶體耗盡
- 磁碟滿
- 斷網
- Job 執行中進行 deploy

**目標不是證明系統不會出錯,而是證明系統在出錯時反應正確。**

**Security test**

- Permission bypass
- IDOR
- SQL injection
- XSS
- CSRF
- 檔案上傳攻擊
- Brute force
- Token reuse
- Rate limit
- Secret 洩漏

### 階段 12:CI/CD

每次 push,pipeline 應自動執行:

```
Install dependencies
→ Lint
→ Type check
→ Unit test
→ Integration test
→ Security scan
→ Build
→ Deploy staging
→ Smoke test
→ Approve
→ Deploy production
```

Production 部署應具備:

- Rolling deployment
- Blue-green deployment
- Canary deployment
- Health check
- Automatic rollback

**新版本未被驗證前,不應一次部署到整個系統。**

### 階段 13:可觀測性(Observability)

沒有 monitoring 的應用很難穩定。

需要三大類:

**Logs**

Log 必須能回答:

- 誰執行的?
- 什麼時候執行?
- 哪個 request?
- 哪個任務?
- 在哪個模組?
- 什麼錯誤?
- 當時的狀態資料?

**不可以 log**:

- 密碼
- Token
- API key
- 卡片資訊
- 非必要的個人資料

**Metrics**

追蹤:

- Request count
- Error rate
- Latency
- CPU / RAM / Disk
- Queue length
- Job failure
- Database connections
- Cache hit rate
- Active users
- Conversion
- External API failure

**Tracing**

Tracing 用於追蹤一個 request 貫穿多個元件的路徑:

```
Frontend → API → Database → Queue → Worker → AI API → Storage
```

如果一個任務花了 20 秒,tracing 能告訴你那 18 秒慢在哪裡。

### 階段 14:告警(Alerting)

**Alert 不應該為每個小錯誤發送。** 只在需要人為行動時告警:

- Error rate 突然飆升
- P95 latency 超過門檻
- 資料庫連線耗盡
- Queue backlog 過大
- Worker 停止運作
- 磁碟接近滿載
- 備份失敗
- 付款失敗率上升
- 異常的登入失敗
- Uptime 下降

每個 alert 必須附帶:

- 嚴重程度
- 受影響的 service
- 當前 metric
- 門檻值
- Log 或 dashboard 連結
- 處理用的 runbook

### 階段 15:備份與復原

**備份只有在能成功 restore 時才有意義。**

需要定義:

**RPO(Recovery Point Objective)** — 最多能接受遺失多少資料?

- RPO 24 小時:可能遺失 24 小時內的資料
- RPO 5 分鐘:最多遺失 5 分鐘的資料
- RPO 0:不接受任何資料遺失

**RTO(Recovery Time Objective)** — 系統必須在多久內復原?

- RTO 4 小時 / 1 小時 / 15 分鐘

需要具備:

- 資料庫備份
- Object storage 備份
- 設定檔備份
- 妥善備份加密金鑰
- 備份存放在不同地區(參考 3-2-1 原則:3 份副本、2 種媒介、1 份異地)
- **定期演練 restore**
- Disaster recovery 文件

### 階段 16:正式發布

Release 前的 checklist:

- 測試已通過
- Migration 已驗證
- 備份已完成
- Rollback 已準備
- Dashboard 已運作
- Alert 已設定
- Runbook 已就緒
- Feature flag 已準備
- 負責人已確定
- 第三方服務配額已確認
- Security review 已完成
- Changelog 已撰寫

應分階段發布:

```
內部使用者 → 5% → 20% → 50% → 100%
```

**Metric 惡化時,立即暫停或 rollback。**

### 階段 17:上線後營運

需要追蹤:

- 使用者是否照預期 flow 操作
- 哪些功能沒人用
- 錯誤集中在哪裡
- 使用者在哪一步放棄
- 每位使用者的基礎設施成本
- 哪個第三方服務不穩定
- 哪些回饋重複出現

每週或每個 sprint 檢視:

- Reliability
- Performance
- Security
- User behavior
- Business KPI
- Technical debt
- Incident
- Cost

---

## 4. 事故處理流程

發生事故時:

**步驟 1:偵測** — Monitoring 發現,或使用者回報。

**步驟 2:分級** — 例如:

- SEV-1:全系統停擺、資料遺失、大規模付款錯誤
- SEV-2:核心功能受影響
- SEV-3:一部分使用者受影響
- SEV-4:小錯誤,有暫時的替代方案

**步驟 3:止血(降低損害)**

- Rollback
- 用 feature flag 關閉功能
- 切換到備援服務
- 降載
- 暫停 job
- 系統切換為 read-only

**步驟 4:修復** — 找出根因並修正。

**步驟 5:驗證** — 確認:

- Metric 已恢復正常
- 資料是否受影響
- 失敗的 job 是否需要重跑
- 是否需要通知使用者

**步驟 6:Postmortem(事後檢討)**

不要只問「誰做錯了」,必須問:

- 為什麼這個錯誤有可能發生?
- 為什麼測試沒有發現?
- 為什麼 monitoring 沒有及早告警?
- 為什麼錯誤會擴散?
- 為什麼復原這麼慢?
- 系統需要做什麼改變?

---

## 5. 一個完整應用應具備的文件

至少應有:

- README.md
- Product Requirements Document
- Architecture.md
- Database schema
- API documentation
- Environment setup
- Deployment guide
- Testing strategy
- Security checklist
- Monitoring guide
- Incident response runbook
- Backup and restore guide
- Changelog
- Known limitations

AI 或 automation 專案,應再補充:

- Prompt specification
- Model configuration
- Input/output schema
- Fallback strategy
- Evaluation dataset
- Evaluation metrics
- Cost control
- Model version tracking
- Human review rules

---

## 6. AI 應用的特殊考量

**AI 應用不能只用 uptime 來評估。** 需要額外的 KPI:

- Output validity rate(輸出有效率)
- Hallucination rate(幻覺率)
- Schema compliance rate(結構符合率)
- Task completion rate(任務完成率)
- Cost per task(單任務成本)
- Average generation time(平均生成時間)
- Retry rate(重試率)
- Human correction rate(人工修正率)
- Safety violation rate(安全違規率)
- Model fallback rate(模型降級率)

建議的處理管線:

```
Input validation
→ Context preparation
→ Model call
→ Output schema validation
→ Rule-based validation
→ Retry 或 fallback
→ 必要時 human review
→ 保存結果與 model 版本
```

**不要完全信任 AI 的輸出。** 必須具備:

- JSON schema
- Validator
- Rule checker
- 有上限的 retry
- Model fallback
- 預設結果
- 重要任務需人工核可

---

## 7. 現代應用的推薦架構

含 AI、automation 或背景 job 的 web 應用,實務上的架構:

| 層 | 技術 |
|---|---|
| Frontend | Next.js 或 React |
| Backend | FastAPI、NestJS 或 Django |
| Database | PostgreSQL |
| Cache | Redis |
| Queue | Celery、BullMQ 或同等方案 |
| Storage | S3 相容的 object storage |
| Authentication | Managed authentication 或標準化的 auth 模組 |
| Monitoring | Error tracking + metrics + logs + tracing |
| Deployment | Docker + CI/CD |
| Infrastructure | 先用 cloud managed services,真的需要才上 Kubernetes |

**MVP 方案:**

- Next.js
- FastAPI 或 NestJS
- PostgreSQL
- Redis
- 一個 worker
- Docker
- Managed cloud

優點:快、易維護、元件少、容易找開發者、初期擴充性足夠。

**長期方案:**

- 獨立的 Frontend
- API service
- Worker service
- PostgreSQL managed
- Redis managed
- Message queue
- Object storage
- Centralized logging
- Tracing
- Auto scaling
- Multi-environment CI/CD

**不需要從第一天就蓋長期系統,但資料與模組的設計要夠乾淨,讓日後拆得出來。**

---

## 8. 稱得上「穩定」之前的最低標準

應用只有在至少達到以下標準時,才能稱為穩定:

**產品**

- 核心功能能解決問題
- 主要流程清楚
- 有量測使用者行為
- 有 acceptance criteria

**技術**

- 沒有未處理的嚴重錯誤
- 有 timeout、retry 與 error handling
- Frontend 與 backend 都有 validation
- 重任務走 queue
- 重要資料有 transaction
- 容易重送的操作有 idempotency
- 有 database migration
- 有 staging
- 有 rollback

**測試**

- 關鍵邏輯有 unit test
- 有 integration test
- 主要流程有 end-to-end test
- 有 load test
- 有 failure test
- 有 security test

**營運**

- 有 log
- 有 metric
- 有 alert
- 有 dashboard
- 有 backup
- 已實際演練 restore
- 有 incident process
- 有明確的負責人

**資安**

- 有 authentication
- 有 authorization
- 不洩漏 secret
- 有 input validation
- 有 rate limiting
- 必要時有 audit log

---

## 9. 建議的實施路線圖

**階段 A:Discovery** — 產出:

- Problem statement
- User persona
- User journey
- KPI
- MVP 範圍
- 風險清單

**階段 B:Product design** — 產出:

- User flow
- Wireframe
- Prototype
- Acceptance criteria
- Edge cases

**階段 C:Technical design** — 產出:

- Architecture
- Database schema
- API specification
- Security model
- Reliability strategy
- Deployment plan

**階段 D:Development** — 產出:

- Frontend
- Backend
- Database
- Worker
- Tests
- Documentation

**階段 E:Verification** — 產出:

- Functional test
- Load test
- Security test
- Failure test
- User acceptance test

**階段 F:Release** — 產出:

- Staging approval
- Backup
- Rollback plan
- Monitoring
- Canary release
- Production release

**階段 G:Operation** — 產出:

- KPI dashboard
- Incident review
- User feedback
- Optimization backlog
- Technical debt plan

---

## 10. 最重要的原則

要打造卓越且穩定的應用,請遵守以下原則:

1. 先確定做對問題,再確定用對技術。
2. 減少元件數量,就是減少故障點。
3. 所有對外操作都必須有 timeout。
4. 所有重要任務都必須能安全地 retry。
5. 不可以在沒有 fallback 的情況下依賴 AI 或第三方服務。
6. 所有重要資料都必須有備份,並驗證 restore。
7. 每一次 release 都必須可以 rollback。
8. 每一個錯誤都必須有 log、metric 與 request ID。
9. P95 與 P99 很慢的時候,不要只看平均值。
10. 沒驗證過 error path 的功能,不能稱為完成。
11. 不要過早為擴充做最佳化,但也不要寫出無法維護的程式碼。
12. **穩定性是流程的結果,不是一個獨立的功能。**

總體公式:

```
卓越的應用
=
做對問題
× 易於使用
× 穩定
× 安全
× 可維護
× 可量測
× 可復原
```

**只要其中一項趨近於 0,應用的整體品質就會急遽下降。**
