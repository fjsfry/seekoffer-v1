# 保研闪填账号绑定受控切换

状态：2026-10-22 本地准备完成，未推送、部署或执行生产 SQL。填写授权默认维护中。

## 已核实的线上基线

- Cloudflare 账户 `9268f8c5fedc0f340356dcf729402a32`，Worker `seekoffer-api-isolated-preview`，环境 `production`；名称虽然带 preview，真实生产域名是 `migration.seekoffer.com.cn`。
- D1 `CORE` 指向 `531486a7-f140-488e-8759-f77d885124f3`。线上 100% 版本 `8c611f67-0403-428c-8ceb-09a9e18b30c7`，创建于 2026-10-10。
- 通过安装的 Wrangler `init --from-dash --no-delegate-c3` 下载当前模块。Wrangler 映射器明确忽略 secret_text，未读取或导出密钥；没有部署操作。
- 从 `541c02e2845a63035b6c113f4a25268eaddc67d6` 加回已在线上的资源下载 CORS 修复后，生产 dry-run 模块与下载模块逐字节一致：440435 bytes，SHA-256 `e98133b4c84965da018151fedee474f159b322b073cd0cf8e37f971d64ceff67`。下载前后的线上版本一致。
- 不能仅凭 Git dirty 判断修改未上线。该 CORS 修复确实已部署，本分支基线提交保留它，并补其访问检查/二进制头回归。
- 公开 health=200、OIDC discovery=200 且支持 S256、主站=200、无令牌 profile=401。这些只证明服务及鉴权入口可达，不是真实账号验收。
- 远端没有 `bound_grant` 列、0016 的两个索引和两个触发器；没有标准 `d1_migrations`，只有既有数据导入控制表。不能使用全量 migration apply。

## 本次范围和验证

仅包含账号绑定授权、独立维护门、0016、相关测试及生产说明；不修改价格、支付、退款、账户权益写开关，不发布这个工作树里的旧版整站。

生产检查通过：TypeScript；绑定 38 项（含真实本地 workerd/D1）、配额 37 项、支付 22 项、商业资源 10 项，共 107 项。生产 dry-run 通过。日志在本分支 `artifacts/v116-production-predeploy.log` 和 `artifacts/v116-production-dry-run.log`。这些是本地验证，不是生产验收。

0016 SHA-256：`ee11913a58e262eddc0b6157a23edd751580b23be02479506ac428234d2a4da5`。

`FILL_SESSION_WRITES_ENABLED=false` 只暂停 prepare/consume，返回 `FILL_AUTHORIZATION_MAINTENANCE`。缺少开关也保持关闭。权益和订单读取可继续；本地建档、填写、撤销不依赖此线上授权通道。旧公开 consume 保持拒绝，不能为旧客户端放宽。

## 切换顺序

1. 提交并推送审阅过的干净生产分支，保存源 hash、bundle hash、安装包 SHA 和匹配主站发布版本。重新只读确认线上仍为上述版本、数据库/schema 前置条件未变；若变更，停止并重新对齐。
2. 重新获取 D1 Time Travel bookmark 作为事故恢复参考。它涉及整个共享数据库，不能代替常规回滚，更不能自动恢复覆盖期间新增业务数据。
3. 以 `FILL_SESSION_WRITES_ENABLED=false` 将本分支新 Worker 100% 部署。核对最新版本、production/CORE/public vars；health 应包含 `fillSessionWritesEnabled:false`。旧公开 consume 应拒绝；主站资料/权益读取不能退化。
4. 只执行审核过的 0016 文件。先核对本地 SHA 与缺列前置条件，执行后核对列、两个唯一索引和两个触发器的完整定义。保存执行回执与新 schema hash，不伪造旧 migration ledger。
5. 完成当前主站和 canonical 插件的协调发布；稳定扩展 ID 必须对应 Clerk 精确回调。对新旧/同错账号、Pro、退出重登、一次性消费进行真实验收。
6. 只有 schema、两端版本、OAuth 回调及真实验收匹配时，才在新版本配置中明确将填写开关设为 `true`；重新确认 100% 版本及健康状态。保存实际场景报告，不能用此次准备报告替代。

根目录命令（仅列出，本文没有执行生产写入）：

```powershell
npm run predeploy:production --prefix workers/seekoffer-api
npm run build:production:dry-run --prefix workers/seekoffer-api
node workers/seekoffer-api/node_modules/wrangler/bin/wrangler.js d1 time-travel info CORE --config workers/seekoffer-api/wrangler.production.jsonc --json
npm run deploy:production --prefix workers/seekoffer-api
node workers/seekoffer-api/node_modules/wrangler/bin/wrangler.js d1 execute CORE --remote --config workers/seekoffer-api/wrangler.production.jsonc --file migrations/d1/snapshot/0016_bound_fill_grants.sql --json
```

执行0016前必须确认新维护版本已实际接管100%流量。迁移会禁止旧 Worker 轮换既有 token，以及旧在途请求消费 NULL 绑定；不能单独提前应用后继续运行旧入口。

## 异常停止与恢复

- 发现版本/数据库/迁移 SHA 不匹配、HTTP鉴权退化、schema部分存在、其他业务失败：保持填写关闭，停止后续迁移或开放；保留脱敏诊断。
- 迁移前新 Worker 仍能维护运行，因为它在访问 bound_grant 之前拦截 prepare/consume。迁移后可继续关闭并修复；不删除新列/历史记录，不撤掉绑定约束制造通过。
- 如果已开放后发现问题，发布同一新协议且填写关闭的维护版本，再定位处理。禁止回退到旧公开 token-only 消费实现。
- 只有确认广泛数据损坏且已评估恢复点之后的账号/报名/支付影响时，才考虑共享 D1 整库 Time Travel；不把它当本补丁的一键撤销。

当前仍需真实 OAuth 回调、同/错账号、云恢复及商用/隐私材料验收；本报告不作可以收费发布的结论。
