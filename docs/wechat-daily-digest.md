# 公众号保研通知日报

SeekOffer 每小时同步公开通知后，由 CloudBase 云函数在每天 21:30（北京时间）整理当天已发布通知，生成封面和公众号图文，并写入“寻鹿Seekoffer”草稿箱。当前账号为个人主体，最后发布动作需要运营者在公众号后台确认。

## 数据流

```text
GitHub Actions 每小时同步
  -> Supabase notices
  -> CloudBase 定时函数 wechat-daily-digest
  -> OpenAI Responses API（标题、导语、优先阅读项）
  -> 微信永久封面素材
  -> 微信草稿箱
  -> Supabase wechat_daily_publications 运行日志
```

`wechat_daily_publications.digest_date` 是唯一键。定时器重复触发时，只有第一个实例能取得当天执行锁，避免生成重复草稿。

## 编辑原则

- GPT 只负责标题钩子、导语和 1–3 条优先阅读项，不生成 HTML。
- 学校、项目、分类、截止时间和原文链接始终来自数据库，由确定性程序渲染。
- GPT 使用严格 JSON Schema；输出不合法、超时或密钥缺失时，自动回退到规则编辑，不影响当天草稿。
- 提示词禁止“重磅、速看、干货、上岸、码住”等自媒体套话，也禁止感叹号、表情符号和英文栏目名。
- 版式采用暖白底、深绿强调、细分隔线和留白，不使用渐变、大面积深色、胶囊标签或卡片堆叠。

## CloudBase 函数环境变量

在 CloudBase 控制台的函数配置中设置，禁止写入代码或 GitHub：

- `SUPABASE_URL`：`https://<PROJECT_REF>.supabase.co`
- `SUPABASE_SERVICE_ROLE_KEY`：Supabase 服务端密钥
- `WECHAT_MP_APP_ID`：公众号 AppID
- `WECHAT_MP_APP_SECRET`：公众号 AppSecret
- `OPENAI_API_KEY`：OpenAI API 密钥；缺失时自动使用规则编辑版

可选：

- `OPENAI_EDITORIAL_MODEL`：默认 `gpt-5.4-mini`
- `OPENAI_EDITORIAL_TIMEOUT_MS`：默认 `25000`
- `SEEKOFFER_SITE_URL`：默认 `https://www.seekoffer.com.cn`
- `WECHAT_DAILY_AUTHOR`：默认 `寻鹿SeekOffer`
- `WECHAT_MP_THUMB_MEDIA_ID`：固定封面永久素材 ID；留空时每天自动生成并上传封面
- `WECHAT_DAILY_MAX_CONTENT_CHARS`：默认 `18000`
- `WECHAT_DAILY_DRY_RUN`：仅联调时设为 `true`，正式运行必须移除或设为 `false`

## 微信侧配置

1. 在公众号后台生成 AppSecret，不要复制到聊天、源码或 GitHub。
2. CloudBase 云函数默认出口 IP 不固定。先给函数启用固定出口 IP，再将该 IP 添加到公众号“设置与开发 → 基本配置 → IP 白名单”。
3. 当前个人主体账号支持新增和更新草稿，但不支持发布接口；每天到草稿箱检查并手动发布。

## 部署与联调

```powershell
# 1. 数据库迁移（当前生产库已执行；新环境才需要）
supabase link --project-ref <PROJECT_REF>
supabase db query --linked --file supabase/migrations/20260713162450_wechat_daily_publications.sql

# 2. 部署函数和定时触发器
tcb login
tcb fn deploy wechat-daily-digest
tcb fn trigger create wechat-daily-digest

# 3. 不调用微信的生产数据预览
tcb fn invoke wechat-daily-digest --params '{"dryRun":true,"targetDate":"2026-07-13"}' --json

# 4. 创建真实草稿（同一天再次执行默认不会重复）
tcb fn invoke wechat-daily-digest --params '{"targetDate":"2026-07-13"}' --json
```

正式联调成功后，Supabase 中应出现 `status = 'drafted'` 的当天记录，公众号草稿箱应出现对应文章。失败时记录为 `failed`，`error_code` 和 `error_message` 用于定位微信错误码。

需要人工重跑同一天时传入 `force: true`。如果当天已有草稿，会原位更新该草稿，不会新增重复项：

```powershell
tcb fn invoke wechat-daily-digest --params '{"targetDate":"2026-07-13","force":true}' --json
```
