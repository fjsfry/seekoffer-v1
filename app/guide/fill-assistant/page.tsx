import Link from 'next/link';
import { SiteShell } from '@/components/site-shell';
import { PageHead, SupportNote } from '@/components/pro/billing-ui';
import s from '@/components/pro/pro.module.css';
export default function FillAssistantGuide() {
  return <SiteShell><div className={s.page}><PageHead title="填报助手指南" subtitle="了解浏览器支持范围与网站连接状态。" /><div className={s.notice} role="status">网站账号与填报助手的连接尚未开放。现有 1.0.0 安装包需要更新，暂不作为网站 Pro 的已交付功能。</div>
    <div className={s.grid2}><section className={s.card}><h2>浏览器安装说明</h2><ol className={s.steps}><li><h3>选择桌面浏览器</h3><p>扩展面向 Chrome 与 Edge。手机浏览器暂不支持这一安装方式。</p></li><li><h3>等待兼容版本</h3><p>目前没有可用于当前网站账号的安装包入口。已安装 1.0.0 的用户请保留原有资料，等待更新指引。</p></li><li><h3>兼容版本开放后的安装方法</h3><p>使用官方发布入口下载。若提供 ZIP 版本，先解压，再在 Chrome 或 Edge 的扩展管理页加载解压目录；不要直接加载 ZIP。</p></li><li><h3>从工作台开始</h3><p>网站连接开放后，按工作台入口选择资料，核对后传入助手。当前可继续整理申请项目和材料。</p><Link className={s.secondary} href="/me/">打开工作台 →</Link></li></ol></section><aside className={s.card}><h2>使用与计量</h2><p className={s.muted}>“资料传入助手”与“最终填写报名网页”是不同步骤。识别与预览不计传入次数，同一次传入的重试不重复计次。</p><p className={s.muted}>填写需要你核对和确认，提交申请始终由你自己完成。请以连接开放后的使用说明为准。</p><div className={s.notice}>当前未进行助手连接检测，不能据此判断你是否安装了扩展。</div><Link className={s.quiet} href="/me/membership/">查看账户额度 →</Link><SupportNote /></aside></div></div></SiteShell>;
}
