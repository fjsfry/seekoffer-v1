# 0.2.26 桌面源码保存

分支：`codex/d1-desktop-migration-20260910`。本次保存 D1/Clerk 原生登录、通知元数据兼容、申请标签恢复、备注保存、工作台字段保护及断网/402 后显式重连。

官方手动安装包和本机 0.2.26 已通过验收。本次只推送源码分支，不重打安装包、不改变 Stable feed、不推送发布标签、不开启付费签名服务，插件保持不公开。

在公开源码前，将独立 acceptance 诊断中的真实测试邮箱替换为本机 `SEEKOFFER_ACCEPTANCE_TEST_EMAIL` 注入。只在单独 acceptance 应用 ID 且传入 `--migration-self-test` 时读取，未提供时拒绝私有账号检查。生产应用 ID 不启用此诊断。没有修改用户凭据、本机资料或原 UUID。

源代码验证包含 TypeScript、针对性重连/字段保护测试、JavaScript 语法检查和 `cargo check --offline --locked`。完整网站/桌面验收说明保存在网页源码分支的 `docs/ops/final-web-desktop-acceptance-20260912.md`。

`vercel.json` 禁止此桌面源码分支触发旧网站部署；现有桌面发布工作流仍要求受保护的 Stable 标签及签名流程，本次不触发。
