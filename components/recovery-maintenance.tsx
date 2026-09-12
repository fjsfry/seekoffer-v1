import Link from 'next/link';
import {SiteShell} from './site-shell';
export function RecoveryMaintenance({title,description}:{title:string;description?:string}){
 return <SiteShell><section className="surface-card rounded-[32px] p-8"><h1 className="text-3xl font-semibold text-ink">{title}暂时维护</h1><p className="mt-4 leading-8 text-slate-600">{description||'这项服务正在恢复中。现有记录已保留，维护期间不会创建新订单或模拟保存成功。'}</p><div className="mt-6 flex gap-4"><Link className="text-brand" href="/notices">浏览通知</Link><Link className="text-brand" href="/me">打开申请工作台</Link></div></section></SiteShell>;
}
