# SeekOffer Desktop v0.2.22 产品与发布 QA

> 日期：2026-09-01。权威基线为 v0.2.21。本文件只记录 v0.2.22 当前源码和本次重新执行的证据，不复用旧版本的测试数量、构建页数或资产哈希。

## 变更范围

本次发行包含：

- `app/desktop-notice-alignment.css` 的通知卡片高度与操作区节奏修复。
- 院校库、通知库与提醒中心共享的公开通知 stale-while-revalidate 缓存。
- 缓存 TTL、失败重试、并发去重、空远端权威性和页面可见性合同。
- 对应的响应式、路由与发行回归测试。
- v0.2.22 版本元数据与发布合同修复。

本次发行明确不包含：

- 当前工作区中的网站后台、Pro / 支付、公众号、CloudBase 运维和浏览器扩展修改。
- 资源中心的其他未提交产品改版。
- QA 截图、构建目录或其他生成物。

## 已完成的 UI 与性能证据

- [x] 目标测试：7 个测试文件、48 项测试通过。
- [x] TypeScript `tsc --noEmit` 通过。
- [x] 通知卡片 960×640 矩阵：100% / 150% / 200% × 浅色 / 深色，共 6 / 6 通过。
- [x] 矩阵中 document、root、card 均无水平溢出，正文与操作区无相交，两个按钮均位于卡片内部。
- [x] 960 浅色、1120 浅色 / 深色补充窗口矩阵：3 / 3 通过。
- [x] 长标题活动通知卡片的操作区顶部间距由约 41.5px 收敛到约 20px。
- [x] 已缓存后的 notices → colleges → notices → colleges 页面切换没有新增公共通知请求。
- [x] 人为增加 2 秒云端延迟时，页面仍先显示可用快照，院校库约 555ms 内可见且没有新增重复请求。
- [x] 公共缓存不包含申请、导师联系人或其他用户私有数据。

证据位置（发布资产不纳入 Git）：

- `artifacts/notice-card-spacing-20260901/final-960-matrix/report.json`
- `artifacts/notice-card-spacing-20260901/runtime-final-active-two-buttons-1440.png`
- `artifacts/cross-page-resize-audit-20260831/notice-spacing-after-20260901/report.json`
- `artifacts/cross-page-resize-audit-20260831/notice-spacing-after-20260901/summary.json`

## 干净源码门禁

- [x] v0.2.22 完整桌面测试套件通过：105 个测试文件、676 项测试通过。
- [x] ESLint 0 error；TypeScript `tsc --noEmit` 通过。
- [x] `git diff --check` 通过。
- [x] 生产依赖审计为 0 个 high、0 个 critical。
- [x] Rust `cargo fmt --check`、`cargo check --locked` 与 `cargo test --locked` 通过；Rust 单元测试 16 / 16 通过。
- [x] 桌面生产构建与静态导出通过：1054 个静态页面，1052 个 HTML、14 个 CSS、72 个 JS。
- [x] 桌面认证导出扫描 126 个静态脚本，未发现服务端高权限密钥。
- [x] 模拟 `desktop-v0.2.22` Tag runner 环境的 3 个发布合同文件、42 项测试通过，不再被继承的 `GITHUB_REF_NAME` 污染 fixture。

## 安装包与更新门禁

- [ ] 由干净 v0.2.22 提交构建 NSIS 安装包。
- [ ] Authenticode 如实为 `NotSigned`，发布页明确提示 Windows 未知发布者风险。
- [ ] Tauri updater Minisign 对新安装包验签通过。
- [ ] 安装包、`.sig`、`latest.json`、`SHA256SUMS.txt`、`build-info.json` 一次生成并哈希闭合。
- [ ] v0.2.21 → v0.2.22 更新清单单调性通过；同版本覆盖被拒绝。
- [ ] GitHub Release 资产逐项下载回读并复核大小、SHA-256 与签名。
- [ ] 候选 updater 的根 / Stable 清单、版本化资产与历史资产全部复核。
- [ ] 生产提升后正式域名重新下载并复核。
- [ ] 正在运行的用户客户端未被发布流程强制终止。

## 发布终止条件

以下任一条件失败即停止生产提升：版本源不一致、工作树非干净、测试或构建失败、Tauri updater 验签失败、清单/哈希不闭合、GitHub 下载回读不一致、候选历史资产丢失或生产域名复核失败。缺少 Authenticode 证书不是被隐藏的通过项，而是本版已公开接受并需向用户展示的发行边界。
