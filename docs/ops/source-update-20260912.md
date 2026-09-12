# 2026-09-12 网页/API 与桌面源码更新

本次在已有迁移分支保存源码和验收记录。网站、API、桌面手动下载此前已经发布，本次源码推送不重新部署、不触发生产采集、不推送桌面 Stable 标签，也不发布插件。

| 对象 | 源码分支 | 已验收线上版本 |
| --- | --- | --- |
| 网页/API | `codex/d1-full-migration-20260908` | 网页 `15a1bd72-0c0a-4aef-9a70-75043bd410ef`；API `51db5cb4-19ac-4957-834b-1d44d2bccbef` |
| Windows 桌面 | `codex/d1-desktop-migration-20260910` | 官方手动下载与本机均 0.2.26 |
| GitHub 通知采集 | 现有 `main` | `4d9654ddf5a570403b5e1f3fc774b3c6f78b8057`；已运行的工作流保持原状 |

公开内容包括 D1/Clerk 接口与客户端、申请和工作台保护、通知缓存/采集修复、桌面原生认证与重连、结构转换及合成测试。没有包含私人备份、Auth 哈希、实际用户记录、凭据文件或完整的迁移快照。公开通知部署快照也留作本地受审查输入，避免撤回数据永久进入新的 Git 历史；已有历史采集数据文件本轮不追加更新。

源码中保留的运营扩展（例如注销、退款、公众号记录）尚未全部部署启用。不能直接把源码工作树覆盖到正式 Worker，也不能将源码存在解释为相应业务已上线。API 本次验收使用精确发布包，详细结果见 [最终验收](final-web-desktop-acceptance-20260912.md)。

## 源码与本机专用输入

- `scripts/build-website.mjs` 的 recovery 模式要求单独提供 `data/recovery-public` 的经审查部署输入，并核对来源和 SHA。该目录不纳入版本控制，不能使用原数据库导出代替。
- 普通构建脚本可能调用历史同步入口；离线核验用 `npm run build:emergency:offline`，先阅读脚本。不要在未知环境直接运行部署或同步。
- 公开的 Python 结构转换模块只依赖通用错误类型；读取本机加密档案、真实导入和凭据适配器保留在授权环境，不随公开源码推送。
- 原生诊断仅在独立 acceptance 应用 ID 且带 `--migration-self-test` 时启用。专用测试邮箱改由本机 `SEEKOFFER_ACCEPTANCE_TEST_EMAIL` 注入，缺省时拒绝读取账号；不再在源码中写入真实邮箱。这项诊断源码调整不更换已验收的 0.2.26 安装包。
- 部分浏览器验收脚本需本机 Playwright 和已生成的离线制品；它们不是远程 CI/生产入口。

## 推送与验证范围

已检查 GitHub 自动化仅在 main 的匹配路径、定时任务或明确 dispatch 时采集；桌面发布只响应 desktop-v 标签或明确 dispatch。本次只推送已有的两个源码分支，不推送标签或更新 main。

两个分支在 `vercel.json` 中均明确关闭自身 Git 自动部署。[官方配置说明](https://vercel.com/docs/project-configuration/git-configuration#gitdeploymentenabled)。不改组织权限、DNS、支付回调或套餐。

推送前检查：网页 TypeScript、321 项 Vitest；桌面 TypeScript、针对性恢复测试；Worker TypeScript、10 项结构转换/身份保护测试；Python 13 项转换测试；Rust `cargo check --offline --locked`。真实网站和桌面链路沿用同日最终验收，不将源码推送当作另一轮生产发布。
