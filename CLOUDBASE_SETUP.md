# CloudBase 配置说明

## 当前环境

- 环境名称：`cloudbase`
- 环境 ID：`cloudbase-4gonuep215f23af4`
- 区域：`ap-shanghai`
- 前端目录：`E:\earn money\小程序\推免星\seekoffer-web`

## 当前线上地址

- 静态托管地址：[https://cloudbase-4gonuep215f23af4-1416959201.tcloudbaseapp.com](https://cloudbase-4gonuep215f23af4-1416959201.tcloudbaseapp.com)

## 本地代码已完成的配置

这些文件已经指向当前 CloudBase 环境：

- [`.env.local`](E:/earn money/小程序/推免星/seekoffer-web/.env.local)
- [`.env.example`](E:/earn money/小程序/推免星/seekoffer-web/.env.example)
- [`cloudbaserc.json`](E:/earn money/小程序/推免星/seekoffer-web/cloudbaserc.json)
- [`lib/cloudbase-env.ts`](E:/earn money/小程序/推免星/seekoffer-web/lib/cloudbase-env.ts)

## 控制台需要保持的配置

### 1. Web 安全来源

在 CloudBase 控制台添加：

- `localhost:3200`
- `127.0.0.1:3200`
- `localhost:3000`
- `127.0.0.1:3000`

### 2. 身份认证

确认已开启：

- `匿名登录`

### 3. 数据库集合

确认存在：

- `web_user_workspace`

建议权限先设置为：

- 仅登录用户可读写

## 本地启动

```powershell
cd "E:\earn money\小程序\推免星\seekoffer-web"
npm run dev -- --port 3200
```

浏览器打开：

- [http://127.0.0.1:3200](http://127.0.0.1:3200)

## 发布到 CloudBase

### 一键构建静态托管目录

```powershell
cd "E:\earn money\小程序\推免星\seekoffer-web"
npm run build:hosting
```

执行后会生成：

- [hosting-dist](E:/earn money/小程序/推免星/seekoffer-web/hosting-dist)

### 一键发布到 CloudBase

```powershell
cd "E:\earn money\小程序\推免星\seekoffer-web"
npm run deploy:cloudbase
```

## 说明

- 当前网站已成功部署到 CloudBase 静态托管。
- 这条部署链路适合目前的前端门户站点。
- 如果后续要把 Next.js 服务端能力完整托管到 CloudRun，需要先在环境里开通云托管资源。

## 参考文档

- [CloudBase Web 应用快速开始](https://docs.cloudbase.net/quick-start/web/introduce)
- [CloudBase CLI 静态托管](https://docs.cloudbase.net/cli-v1/hosting)
