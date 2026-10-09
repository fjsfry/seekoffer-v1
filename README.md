# seekoffer-web

把当前微信小程序旁路迁移成一个独立运行的 Next.js 网站 Demo。

## 启动

```bash
npm install
npm run dev
```

然后打开：

```text
http://localhost:3000
```

## 当前完成

- 首页鸽子池
- 保研日历
- AI 预测
- 我的
- 发布页占位
- 统一网站视觉壳层
- CloudBase Web SDK 接入骨架
- `offers` / `calendar_notices` 真数据优先，mock 兜底

## CloudBase 配置

1. 复制 `.env.example` 为 `.env.local`
2. 检查环境 ID 和地域是否正确
3. 在 CloudBase 控制台把 `localhost:3000` 或 `127.0.0.1:3000` 加入安全域名

## 下一步建议

- 接 CloudBase Web SDK
- 真实 offers / calendar_notices 读取
- 微信扫码登录
- 个人中心真实资料与收藏
