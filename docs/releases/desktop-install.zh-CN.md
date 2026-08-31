# 寻鹿 SeekOffer 桌面版安装说明

## 系统要求

- Windows 10 或 Windows 11，x64 架构
- 可连接互联网，用于读取寻鹿在线数据与完成账号登录
- Microsoft Edge WebView2 Runtime

现代 Windows 10/11 通常已经包含 WebView2。若系统缺少该组件，安装程序会按 Tauri 的默认策略联网获取 WebView2 bootstrapper。

## 安装步骤

1. 核对安装包旁的 `SHA256SUMS.txt`。
2. 双击发布目录中名称以 `Windows-x64-Setup.exe` 结尾的安装包。
3. 按安装向导完成安装。
4. 启动“寻鹿 SeekOffer”，应用会直接显示登录页；使用与网站相同的正式账号登录后方可进入。

## 校验安装包

在 PowerShell 中进入发布目录后运行：

```powershell
Get-FileHash -Algorithm SHA256 -LiteralPath '.\SeekOffer-Desktop-v*-Windows-x64-Setup.exe'
```

输出应与 `SHA256SUMS.txt` 完全一致。

## 未签名提示

当前为内部测试包，尚未配置 Windows Authenticode 代码签名。Windows SmartScreen 可能显示“未知发布者”。仅应在文件来源可信且 SHA-256 校验一致时继续安装。

## 升级与卸载

- v0.2.5 及更早版本需要手动安装一次 v0.2.6 或更高桥接版；这些历史版本没有更新器，无法远程补上该能力。
- 安装桥接版后，可在“设置 → 关于 → 软件更新”手动检查，也可保留默认的后台定时检查。发现新版后由用户确认下载，下载完成后再选择“重启并更新”。
- 自动更新失败不会影响当前版本继续使用；可重新检查，或从可信发布目录下载更高版本覆盖安装。禁止用低版本覆盖高版本。
- 可在 Windows“设置 → 应用 → 已安装的应用”中卸载。
- Windows 横幅只在寻鹿运行期间请求显示，应用完全退出后不会继续定时提醒。
- 正式对外发布前仍需完成 Authenticode 组织代码签名、更新签名密钥离线备份，以及覆盖安装、自动更新、卸载残留、Windows 横幅、开机启动与真实账号同步专项回归。
