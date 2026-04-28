import { CheckCircle2, EyeOff, ShieldCheck, Trash2 } from 'lucide-react';
import { AdminShell } from '@/components/admin-shell';
import {
  AdminButton,
  AdminInput,
  AdminMetricCard,
  AdminPagination,
  AdminPanel,
  AdminSelect,
  AdminStatusBadge
} from '@/components/admin-ui';
import { adminOfferRows, offerMetrics } from '@/lib/admin-data';

const offerIcons = [ShieldCheck, CheckCircle2, EyeOff, Trash2];

export default function AdminOffersPage() {
  return (
    <AdminShell title="Offer池管理">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_280px]">
        <div className="space-y-6">
          <AdminPanel>
            <div className="grid gap-5 p-5">
              <div className="grid gap-4 xl:grid-cols-5">
                <AdminSelect label="学校" options={['全部学校', '清华大学', '北京大学', '上海交通大学', '复旦大学']} />
                <AdminSelect label="专业" options={['全部专业', '计算机', '电子信息', '金融', '人工智能']} />
                <AdminSelect label="结果" options={['全部结果', '录取', '放弃', '候补', '补录传闻']} />
                <AdminSelect label="审核状态" options={['全部状态', '待审核', '已通过', '已隐藏', '已删除']} />
                <AdminInput placeholder="开始日期  至  结束日期" />
              </div>
              <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_120px_120px]">
                <AdminInput placeholder="搜索学校、专业、用户昵称等" />
                <AdminButton>查询</AdminButton>
                <AdminButton tone="secondary">重置</AdminButton>
              </div>
            </div>
          </AdminPanel>

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {offerMetrics.map((metric, index) => (
              <AdminMetricCard key={metric.label} metric={metric} icon={offerIcons[index]} />
            ))}
          </section>

          <AdminPanel title="Offer列表">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1120px] text-left text-sm">
                <thead className="bg-slate-50 text-xs font-semibold text-slate-500">
                  <tr>
                    <th className="px-5 py-3"><input type="checkbox" aria-label="选择全部 Offer" /></th>
                    <th className="px-5 py-3">提交用户</th>
                    <th className="px-5 py-3">申请学校</th>
                    <th className="px-5 py-3">申请专业</th>
                    <th className="px-5 py-3">项目类型</th>
                    <th className="px-5 py-3">录取结果</th>
                    <th className="px-5 py-3">本科背景</th>
                    <th className="px-5 py-3">是否匿名</th>
                    <th className="px-5 py-3">提交时间</th>
                    <th className="px-5 py-3">审核状态</th>
                    <th className="px-5 py-3">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {adminOfferRows.concat(adminOfferRows).slice(0, 10).map((offer, index) => (
                    <tr key={`${offer.id}-${index}`} className="border-t border-slate-100">
                      <td className="px-5 py-4"><input type="checkbox" aria-label={`选择 ${offer.user}`} /></td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-700">
                            {offer.avatar}
                          </div>
                          <span className="font-medium text-slate-900">{offer.user}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-slate-700">{offer.school}</td>
                      <td className="px-5 py-4 text-slate-700">{offer.major}</td>
                      <td className="px-5 py-4">
                        <span className="rounded-md bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-600">{offer.projectType}</span>
                      </td>
                      <td className="px-5 py-4">
                        <span className="rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-600">{offer.result}</span>
                      </td>
                      <td className="px-5 py-4 text-slate-700">{offer.background}</td>
                      <td className="px-5 py-4 text-slate-700">{offer.anonymous ? '是' : '否'}</td>
                      <td className="px-5 py-4 text-slate-600">{offer.submittedAt}</td>
                      <td className="px-5 py-4"><AdminStatusBadge status={offer.status} /></td>
                      <td className="px-5 py-4">
                        <div className="flex gap-3 font-medium">
                          <button className="text-blue-600">查看</button>
                          <button className="text-blue-600">审核</button>
                          <button className="text-blue-600">隐藏</button>
                          <button className="text-rose-600">删除</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <AdminPagination total="1,732" />
          </AdminPanel>
        </div>

        <AdminPanel title="审核提示">
          <div className="space-y-7 p-5 text-sm leading-7 text-slate-600">
            <ReviewTip title="检查隐私信息" body="确认 Offer 内容中是否包含姓名、邮箱、电话、地址、身份证号、学号等个人隐私信息。" />
            <ReviewTip title="检查广告引流" body="确认内容中是否存在引导添加微信、QQ群、外链、二维码等广告引流信息。" />
            <ReviewTip title="检查内容真实性" body="确认 Offer 内容真实有效，无显著夸大或误导性信息，维护社区可信度。" />
          </div>
        </AdminPanel>
      </div>
    </AdminShell>
  );
}

function ReviewTip({ title, body }: { title: string; body: string }) {
  return (
    <div className="relative pl-5">
      <span className="absolute left-0 top-2 h-2 w-2 rounded-full bg-blue-600" />
      <div className="font-semibold text-slate-950">{title}</div>
      <p className="mt-2">{body}</p>
    </div>
  );
}
