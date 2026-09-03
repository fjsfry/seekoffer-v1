# 寻鹿桌面端自动更新发布与密钥运维

本文档描述桌面端更新发布端的安全边界。客户端更新器、Tauri 公钥和正式更新地址必须先进入一个手动安装的桥接版本；当前没有更新器的历史安装包不能被远程补上自动更新能力。

## 发布结构

推荐把职责分开：

- 独立 Vercel updater-site 保存按版本不可变的安装包、`.sig`、SHA-256，以及很小的 `latest.json` 通道指针。
- Stable 使用同一独立更新项目的两个静态清单路径互为回退；Beta 是预留架构，当前客户端和发布 Workflow 均未启用。
- 更新项目与主站部署彻底隔离；发布桌面更新不得触发或覆盖网站部署。
- 客户端内置 Tauri 公钥；私钥只存在于受保护的发布环境和离线备份。

建议地址：

```text
Stable primary: https://seekoffer-desktop-updates.vercel.app/stable/latest.json
Stable fallback: https://seekoffer-desktop-updates.vercel.app/latest.json
Beta fallback（预留，未启用）: https://seekoffer-desktop-beta-updates.vercel.app/latest.json
```

当前只部署 Stable 专用 Vercel 项目，不要把 updater-site 部署到主站项目。`stable/latest.json` 与根 `latest.json` 必须来自同一次原子部署并指向同一版本；客户端按上述顺序检查。未来启用 Beta 前，必须增加独立客户端配置覆盖、独立 Vercel 项目和通道一致性测试，避免 Beta 部署删除或污染 Stable 清单。

截至 2026-09-03，`download.seekoffer.com.cn` 已添加到独立 updater-site 项目，
但 Cloudflare 权威 DNS 中的 `download` CNAME 尚未生效，公网 DNS、TLS 和文件回读
门禁均未通过。因此 v0.2.22 的 `src-tauri/tauri.conf.json` runtime endpoints、线上
Stable 清单和已发布产物不得切换或重写；本次代码只增加新域名的受控发行支持。

## 密钥与 Secret

Tauri 更新签名和 Windows Authenticode 是两套不同的签名。

### Tauri 更新签名

生产私钥只允许存在于：

1. GitHub `desktop-stable` Protected Environment Secret；未来启用 Beta 时使用完全独立的 `desktop-beta` Environment。
2. 至少两份离线加密备份。

GitHub Secret 名称：

```text
TAURI_SIGNING_PRIVATE_KEY
TAURI_SIGNING_PRIVATE_KEY_PASSWORD
```

禁止：

- 把私钥或密码写进 Git、`.env`、发行说明、构建清单或 Vercel Environment Variable。
- 在 Workflow 中打印、Base64 回显或上传私钥。
- 删除唯一备份；私钥丢失后，已安装客户端无法验证后续更新。

Workflow 只在“检查 Secret”和最终 `tauri bundle` 两个受控步骤注入私钥；Next.js 静态导出、Rust 编译、Checkout、依赖安装、测试、发布包验证和 Artifact Action 均看不到签名 Secret。最终验证只使用安装包、`.sig` 和客户端内置公钥。

公钥可以提交并嵌入 `tauri.conf.json`。轮换私钥时，必须先用旧私钥发布一个同时信任新公钥的桥接版本，等桥接版本覆盖完成后才能停用旧私钥。

当前本机内部构建使用以下受限文件（只记录路径，不记录内容）：

```text
C:\Users\Administrator\.tauri\seekoffer-updater.key
C:\Users\Administrator\AppData\Local\SeekOffer\release-secrets\updater-password.dpapi
```

`scripts/invoke-desktop-signed-release.ps1` 先在无私钥环境中完成 Next.js 与 Rust 编译，只在最终 NSIS bundle/sign 步骤解密密码并设置签名环境变量，随后立即清理；发布整理阶段只使用公钥验签。DPAPI 文件只能由当前 Windows 用户在当前系统环境中恢复，不能替代灾难恢复备份；在任何公开发布前，必须把加密私钥和密码分别保存到至少两处离线介质或正式密码管理器，并实际演练一次恢复与签名。

### Windows Authenticode

公开 Stable 必须同时配置可信 Authenticode 代码签名。当前没有 Authenticode 时，Tauri `.sig` 仍能保证更新字节未被篡改，但 Windows 仍可能显示未知发布者，因此只能作为内部测试包。

#### 既有链路审计结论

此前的 Stable Workflow **没有真正执行 Authenticode 签名**：仓库既没有
`bundle.windows.certificateThumbprint`，也没有 `bundle.windows.signCommand`；
Workflow 只在 `desktop:package` 阶段设置
`SEEKOFFER_REQUIRE_VALID_AUTHENTICODE=true` 并读取最终安装包状态。因此它是一个
有效的“拒绝未签名包”门禁，但不是一条能产出可信发布者签名包的发布链路；在
GitHub Hosted Runner 上没有其他外部签名注入时，Stable 会稳定停在
`Authenticode: NotSigned`。

当前实现增加了可配置的 Tauri `signCommand`。Tauri 在写入 NSIS bundle 类型后
签署主程序，并在生成过程中签署 NSIS 插件、卸载器和最终安装器；每次签名都必须
同时通过以下条件：

- 使用 SHA-256 文件摘要和 SHA-256 RFC 3161 时间戳。
- `signtool verify /pa /all /v` 返回成功。
- PowerShell `Get-AuthenticodeSignature` 返回 `Valid`。
- 实际签名证书指纹与 Protected Environment 中配置的预期指纹完全一致。
- 存在时间戳证书，避免证书到期后丢失签名有效性。

Workflow 先在**无签名凭据的独立编译 Job**完成前端与 Rust 编译，并用内容哈希
清单绑定主程序、静态前端和精确 Tag；随后由全新的 Windows Runner 下载并复核
这份无签名载荷。签名 Runner 使用 `npm ci --ignore-scripts`，只从 Windows SDK
固定目录选择由 Microsoft 签名且验证为 `Valid` 的 x64 SignTool，之后才解码
PFX。临时目录与审计文件均使用随机名称和独占创建，PFX ACL 仅允许当前 Runner
账户读取。签名审计记录规范绝对路径与 SHA-256；Workflow 会直接重新验证 patched
`seekoffer-desktop.exe` 和最终 `*-setup.exe` 的文件哈希、证书指纹、状态和时间戳，
缺少或重复任意记录都会在打包前失败。完成后整个临时签名目录都会被删除。

打包后的产物还会送到第三个全新 Windows Runner，重新执行 `SHA256SUMS`、清单、
Tauri Minisign、主程序和安装器 Authenticode 验收。发布 Job 只有在该下载后复核
通过后才能创建 GitHub Release。

`desktop-stable` Protected Environment 需要人工配置：

Secret：

```text
WINDOWS_CERTIFICATE             # 可信代码签名 PFX 的 Base64 内容
WINDOWS_CERTIFICATE_PASSWORD    # PFX 导出密码
```

非 Secret 的 Environment Variable：

```text
WINDOWS_CERTIFICATE_THUMBPRINT  # 40 位 SHA-1 证书指纹，仅用于身份钉扎
WINDOWS_TIMESTAMP_URL           # 证书提供商给出的 RFC 3161 时间戳地址
NEXT_PUBLIC_SUPABASE_URL         # 桌面登录使用的公开项目 URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY # 推荐的公开 publishable key
NEXT_PUBLIC_SUPABASE_ANON_KEY    # 仅兼容旧项目；与 publishable key 至少配置一项
```

准备脚本会在写入磁盘前验证 Base64，使用临时密钥加载方式确认 PFX 包含私钥、
包含 Code Signing EKU（`1.3.6.1.5.5.7.3.3`）、匹配预期指纹，并且距离到期至少
14 天。不得使用自签名证书满足 Stable 门禁。

这只是一个**受保护 PFX + SignTool 的可配置执行路径**，不替代证书采购。自
2023 年以来，很多公开信任 OV/EV 证书要求硬件或云端保护私钥，证书提供商未必
允许导出 PFX。若最终选择 Azure Artifact Signing、SignPath 或硬件服务，必须
由产品负责人先完成供应商、费用、主体认证和密钥托管决策，再把
`signCommand` 切换到对应的官方客户端；当前代码不会自动创建 Azure 资源、
申请付费服务或回退到自签名证书。

## 版本、Tag 与通道

版本必须在以下四处一致：

- `package.json`
- `src-tauri/tauri.conf.json`
- `src-tauri/Cargo.toml`
- `src-tauri/Cargo.lock` 中的桌面包

Tag 必须精确为：

```text
desktop-v<version>
```

示例：

```text
Stable: desktop-v0.2.7
Beta（未来）: desktop-v0.3.0-beta.1
```

Workflow 会在接触任何签名凭据前验证 `refs/tags/<tag>` 真实存在，将 annotated 或
lightweight Tag 解析成唯一 40 位 Commit SHA，并以 detached HEAD 检出该 SHA；后续
compile、sign、fresh verify 与 publish verifier 全部只按这个 SHA Checkout，不按同名
branch 或未经验证的字符串 Checkout。

Stable 发布还会在准备阶段和创建 Draft Release 前两次读取线上
`/stable/latest.json`，要求候选 SemVer 严格大于当前线上版本。无法读取、格式无效、
相等或降级都会 fail-closed。Stable Workflow 固定使用不可变 GitHub Release 资产
URL；可选 CDN `DESKTOP_UPDATE_ASSET_BASE_URL` 仅保留给受控本地装配，不是公开
Workflow 输入。

当前自动发布 Workflow 只接受不带预发布段的 Stable 版本。清单工具保留 Beta SemVer 校验能力，但在客户端 endpoint 和独立发布环境完成前不得启用。不要发布降级更新；紧急回退应从正常代码恢复后发布更高补丁版本。

## 本地打包守卫

`scripts/package-desktop-release.mjs` 会：

1. 检查四处版本一致。
2. 要求 NSIS 安装包存在。
3. 要求同名 `.sig` 存在且非空。
4. 拒绝比安装包更旧的 `.sig`。
5. 使用 `tauri.conf.json` 内嵌公钥，对最终 NSIS EXE 与 `.sig` 做真实 Minisign 验签；实现与 `tauri-plugin-updater 2.10.1` 一致，并且不读取私钥。
6. 拒绝比安装包更新的源文件，包括 `tauri.release.conf.json` 和发布验签器本身。
7. 验证 Tag 与版本。
8. 生成并重新读取验证 `latest.json`。
9. 确认清单中的签名是 `.sig` 内容而不是 URL。
10. 扫描输出文本，拒绝私钥或 Secret 值进入发布文件。
11. 输出安装包、签名和清单的 SHA-256，并在内部构建信息中记录 `signatureCryptographicallyVerified: true`。

验签器位于 `src-tauri/examples/verify_updater_signature.rs`。发布脚本通过 `cargo run --locked` 调用它；任何 Base64、Minisign 格式、公钥 ID、安装包字节或签名不匹配都会立即终止打包。这个门禁不能用“文件存在”“SHA-256 已生成”替代，因为只有公钥验签才能证明该安装包确实由受信任的更新密钥签发。

CI 额外设置以下守卫：

```text
SEEKOFFER_REQUIRE_RELEASE_TAG=true
SEEKOFFER_REQUIRE_CLEAN_SOURCE=true
SEEKOFFER_REQUIRE_PUBLIC_REPOSITORY=true
SEEKOFFER_REPOSITORY_VISIBILITY=public
SEEKOFFER_REQUIRE_VALID_AUTHENTICODE=true # Stable 强制
SEEKOFFER_RELEASE_CHANNEL=stable
SEEKOFFER_RELEASE_TAG=desktop-v<version>
```

CI 必须从干净 Tag 构建。Stable 对精确 Tag、公开仓库、干净源码、Authenticode
`Valid`、钉扎证书指纹和可信时间戳的要求由通道本身强制，不能被环境变量关闭。
本地脚本只允许生成 `internal-test`，明确拒绝任何 Stable 命名产物。

## 资产地址覆盖

默认清单指向不可变 GitHub Release：

```text
https://github.com/fjsfry/seekoffer-v1/releases/download/desktop-v<version>/<installer>
```

`DESKTOP_UPDATE_ASSET_BASE_URL` 只允许以下三个精确基址：

```text
https://github.com/fjsfry/seekoffer-v1/releases/download/
https://download.seekoffer.com.cn/artifacts/
https://seekoffer-desktop-updates.vercel.app/artifacts/
```

若要让独立 Vercel updater-site 的原域名同时托管版本化安装包，构建前设置：

```powershell
$env:DESKTOP_UPDATE_ASSET_BASE_URL = 'https://seekoffer-desktop-updates.vercel.app/artifacts/'
```

新自定义域名通过下述切换门禁后，下一版候选才可以改为：

```powershell
$env:DESKTOP_UPDATE_ASSET_BASE_URL = 'https://download.seekoffer.com.cn/artifacts/'
```

脚本对环境变量执行原始字符串精确白名单校验，并拒绝任意其他 HTTPS 主机、用户名或
密码、显式端口、查询参数、片段、错误路径以及缺少结尾 `/` 的近似值；默认 GitHub
地址也固定为当前 `fjsfry/seekoffer-v1` 仓库。校验通过后脚本才会追加：

```text
desktop-v<version>/<installer>
```

不要把临时鉴权 Token 放进 URL，也不要为了临时 CDN 或测试服务器扩大白名单。

### 自定义下载域名切换门禁

Cloudflare 权威 DNS 必须先把 `download` CNAME 配置为 Vercel 为 updater 项目返回的
项目唯一目标，并等待权威查询生效。2026-09-03 的 Vercel 配置返回目标为：

```text
e9293d71b3afe5a3.vercel-dns-017.com.
```

只有以下检查全部通过，下一版桌面发行才允许把自定义域名作为首选资产基址，并在新的
客户端版本中把自定义 Stable 清单作为 runtime primary：

1. `download.seekoffer.com.cn` 的权威 CNAME 与 Vercel 当前项目配置一致。
2. Vercel 域名状态不再是 `misconfigured`，HTTPS 证书已签发且主机名校验通过。
3. 自定义域名下的 `stable/latest.json`、版本化安装包和 `.sig` 均返回 `200`。
4. 清单版本、URL 和签名通过 `desktop-update-manifest.mjs verify`。
5. 安装包、签名与 `SHA256SUMS.txt` 的大小和 SHA-256 与发布候选逐字节一致。
6. 原 `seekoffer-desktop-updates.vercel.app` 清单和历史版本化资产继续可访问。

完成切换时必须保留原 Vercel endpoint 作为 legacy fallback，保证 v0.2.22 和更早安装
客户端仍能检查更新。不得回写 v0.2.22 的 runtime endpoints、生产清单、Tag 或产物。

## 隔离 updater-site 目录

成功打包后会生成：

```text
releases/seekoffer-desktop/v<version>-<channel>/updater-site/
├─ latest.json                    # 仅 Stable 生成，作为生产回退清单
├─ stable/latest.json             # Stable
├─ internal-test/latest.json      # Internal-test；不会写入根清单
├─ vercel.json
└─ artifacts/
   └─ desktop-v<version>/
      ├─ SeekOffer-Desktop-v<version>-Windows-x64-Setup.exe
      ├─ SeekOffer-Desktop-v<version>-Windows-x64-Setup.exe.sig
      └─ SHA256SUMS.txt
```

缓存规则：

- `latest.json` 与 `:channel/latest.json`：`no-store, max-age=0`
- 带版本 Tag 的 `artifacts/**`：`public, max-age=31536000, immutable`
- 全部响应增加 `X-Content-Type-Options: nosniff` 和允许读取清单的 CORS 响应头。

自动发布 Workflow **不会部署 Vercel**。这避免主站项目、错误账号或脏工作区被意外覆盖。运维人员必须先验证公开 GitHub Release，再从隔离目录部署到专用 updater-site 项目。

## GitHub Actions 发布顺序

`.github/workflows/desktop-release.yml` 只允许 `desktop-v*` Tag 或手动指定已有 Tag。

工作流使用的 `actions/checkout`、`actions/setup-node`、Artifact Actions 和 Rust Toolchain Action 均固定到审核过的完整 Commit SHA，升级时必须先核对上游 Tag 与提交，再显式修改 SHA。

严格顺序：

```text
干净源码与版本校验
→ 无私钥的独立 Job 完成 Next.js 与 Rust 编译并生成内容哈希清单
→ 全新签名 Runner 下载并复核无签名载荷
→ 从 Protected Environment 准备并校验随机、最小 ACL 的临时 PFX
→ 仅在最终 NSIS bundle 步骤注入 Tauri 私钥和 PFX 密码
→ Tauri signCommand 签署 patched 主程序、卸载器和最终 NSIS 安装器
→ 以规范路径和 SHA-256 绑定审计记录，并直接复核证书指纹和 RFC 3161 时间戳
→ 立即删除整个临时签名目录
→ 用客户端内置公钥验证最终 EXE 与 .sig
→ 本地 latest.json 校验
→ 第三个全新 Windows Runner 重新下载并复核哈希、Minisign 与 Authenticode
→ 创建隐藏 Draft Release
→ 上传安装包、.sig、SHA256SUMS、说明
→ 最后上传 latest.json
→ 校验 Draft 资产齐全
→ 公开 Release
→ 人工验证
→ 最后部署 updater-site / 提升通道清单
```

同一个 Tag 已存在时 Workflow 直接失败，不能使用 `--clobber` 覆盖已公开资产。

## 组装完整 updater-site 候选

单次 Stable 构建只包含当前版本资产，不能直接覆盖生产 updater-site，否则会删除历史不可变安装包与回滚锚点。公开 GitHub Release 并下载、验签 Stable Workflow 产物后，必须以已经验证的生产目录为基线组装一个全新目录：

```powershell
npm run desktop:updater:compose -- `
  --base <已验证的生产 updater-site> `
  --candidate <本次 Stable Workflow updater-site> `
  --output <全新的 promotion-candidate 目录> `
  --version <version>
```

组装器会 fail closed：

- Internal-test 只有 `internal-test/latest.json`，缺少根清单和 Stable 清单，因此不能被提升。
- 候选版本必须严格高于生产 Stable；同版本不得重打或覆盖。
- 根 `latest.json` 与 `stable/latest.json` 必须逐字节一致。
- 安装包和 `.sig` 必须与 `SHA256SUMS.txt` 一致，清单签名必须与 `.sig` 一致。
- 清单 URL 必须绑定当前 `desktop-v<version>` 不可变路径。
- 候选与生产的缓存/CORS 策略必须一致。
- 输出目录必须是全新目录；组装器不覆盖旧候选。
- 生产历史文件逐文件 SHA-256 保持不变，新版本资产逐文件 SHA-256 与 Workflow 候选一致。

组装完成后，先把输出目录部署到 Preview，完成下载回读、Minisign、Authenticode、历史资产和清单复核；只有 Preview 全部通过，才允许 Promote 到生产。

## Vercel 手动部署门禁

部署前必须确认：

- 当前 CLI 账号和 team/project 正确。
- 目标是独立 updater-site 项目，不是寻鹿主站项目。
- `latest.json` 的 URL、版本、签名与当前 GitHub Release 一致。
- 安装包和 `.sig` 的 SHA-256 与 `SHA256SUMS.txt` 一致。
- Stable 目录和版本化资产完整；当前不得出现未启用的 Beta 清单。
- 旧 endpoint 仍返回旧的完整有效清单。
- 若候选使用 `download.seekoffer.com.cn`，自定义域名切换门禁已全部通过，并且原
  `seekoffer-desktop-updates.vercel.app` endpoint 仍保留为 legacy fallback。

部署只允许把完整 `updater-site` 目录作为根目录。不要只上传 `latest.json`，也不要从仓库根目录运行会影响主站的部署命令。

部署后验证：

```powershell
curl.exe -I https://<updater-project>/stable/latest.json
curl.exe https://<updater-project>/stable/latest.json
node scripts/desktop-update-manifest.mjs verify .\downloaded-latest.json `
  --version <version> `
  --signature-file <installer.sig>

cargo run --quiet --locked --manifest-path src-tauri/Cargo.toml `
  --example verify_updater_signature -- `
  <installer.exe> <installer.exe.sig> <tauri.conf.json 中的 updater.pubkey>
```

只有 endpoint 返回 `200`、内容通过验证、版本化安装包可下载后，才能把通道视为已提升。

## v0.2.6 → v0.2.7 真实回归

建议使用专用测试通道和测试机：

1. 生成正式保管的测试/生产更新签名密钥，并把公钥嵌入 v0.2.6。
2. 构建、签名、手动安装 v0.2.6。
3. 发布 v0.2.6 自身清单，确认客户端比较相同版本时显示“已是最新版”。
4. 从干净 `desktop-v0.2.7` Tag 运行 Workflow。
5. 验证 Draft Release 中 `.exe`、`.sig`、SHA-256、`latest.json`。
6. 公开 v0.2.7 Release。
7. 最后部署 v0.2.7 updater-site。
8. 在已安装 v0.2.6 的真实 Windows 环境检查更新。
9. 验证下载进度、签名校验、安装退出、重新启动、版本号和登录数据保留。
10. 验证 v0.2.7 再次检查时不重复安装。
11. 暂时恢复 v0.2.6 清单，确认 v0.2.7 不会降级；然后恢复 v0.2.7 清单。

没有完成这次真实跨版本安装回归前，只能说“更新器代码和发布链路已配置”，不能对外宣称“自动更新已上线”。

## 故障与回滚

- 构建失败：不创建 Release，不更新 endpoint。
- Draft 上传失败：保留隐藏 Draft 供排查，客户端不可见。
- Release 已公开但 endpoint 未更新：用户继续使用旧清单，安全但不会收到新版本。
- 新版有问题：立即停止提升或恢复旧清单以阻止尚未更新的用户；已更新用户必须通过更高版本修复。
- 签名验证失败：禁止安装，不允许忽略或改用 HTTP。
- 私钥疑似泄漏：停止所有发布；使用旧可信密钥发布公钥轮换桥接版后再切换密钥。
