import { PageSectionTitle } from '@/components/page-section-title';
import { SiteShell } from '@/components/site-shell';
import { applicationColumnPresets, fieldGuideItems, guideTips, statusDefinitions } from '@/lib/mock-data';

const guideExamples = [
  {
    title: '什么时候把项目加入申请表？',
    text: '只要确认这个项目值得持续跟进，就建议立即加入申请表。这样截止提醒、材料清单和待办才会真正开始工作。'
  },
  {
    title: '为什么状态一定要统一？',
    text: '统一状态后，系统才能准确识别你是“已收藏”“准备中”还是“已提交”，并生成真正有用的风险提醒。'
  },
  {
    title: '材料为什么要拆成勾选项？',
    text: '把简历、成绩单、推荐信这些核心材料拆开记录，系统才能明确知道你当前缺什么，而不是把风险淹没在备注里。'
  }
];

export default function GuidePage() {
  return (
    <SiteShell>
      <PageSectionTitle
        eyebrow="Field Guide"
        title="常见问题与填写指导"
        subtitle="把申请表字段、状态口径和填表方法讲清楚，让你的申请管理更规范、更省心。"
      />

      <section className="mb-8 grid gap-4 xl:grid-cols-3">
        {guideTips.map((item) => (
          <div
            key={item}
            className="rounded-[28px] border border-black/5 bg-white p-5 text-sm leading-7 text-slate-600 shadow-sm"
          >
            {item}
          </div>
        ))}
      </section>

      <section className="mb-8 rounded-[30px] border border-black/5 bg-white p-6 shadow-soft">
        <PageSectionTitle
          eyebrow="Columns"
          title="推荐表头"
          subtitle="这些字段能帮你统一记录目标院校、截止时间、材料进度、优先级和备注。"
        />

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {applicationColumnPresets.map((column) => (
            <div key={column.key} className="rounded-[24px] bg-slate-50 px-4 py-4">
              <div className="flex items-center justify-between gap-3">
                <div className="font-semibold text-ink">{column.label}</div>
                {column.required ? (
                  <span className="rounded-full bg-brand px-2.5 py-1 text-xs font-semibold text-white">必填</span>
                ) : (
                  <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-500 shadow-sm">选填</span>
                )}
              </div>
              <div className="mt-3 text-sm leading-6 text-slate-600">{column.description}</div>
              <div className="mt-3 text-xs text-slate-500">示例：{column.sample}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-8 rounded-[30px] border border-black/5 bg-white p-6 shadow-soft">
        <PageSectionTitle
          eyebrow="Status System"
          title="统一状态定义"
          subtitle="统一状态后，提醒、筛选和待办才能真正为你节省时间。"
        />

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {statusDefinitions.map((item) => (
            <div key={item.label} className="rounded-[24px] bg-slate-50 px-4 py-4">
              <div className="font-semibold text-ink">{item.label}</div>
              <div className="mt-3 text-sm leading-6 text-slate-600">{item.meaning}</div>
              <div className="mt-3 rounded-2xl bg-white px-3 py-3 text-sm text-slate-500 shadow-sm">{item.nextAction}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-8 rounded-[30px] border border-black/5 bg-white shadow-soft">
        <div className="grid grid-cols-[0.8fr_0.8fr_1.2fr_1fr] gap-4 border-b border-black/5 bg-slate-50 px-5 py-4 text-sm font-semibold text-slate-500">
          <div>字段</div>
          <div>分类</div>
          <div>说明</div>
          <div>示例</div>
        </div>
        <div className="divide-y divide-black/5">
          {fieldGuideItems.map((field) => (
            <div key={field.key} className="grid grid-cols-[0.8fr_0.8fr_1.2fr_1fr] gap-4 px-5 py-4 text-sm">
              <div className="font-semibold text-ink">{field.label}</div>
              <div className="text-slate-600">{field.category}</div>
              <div className="text-slate-600">{field.description}</div>
              <div className="text-slate-500">{field.example}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        {guideExamples.map((item) => (
          <div key={item.title} className="rounded-[28px] border border-black/5 bg-white px-5 py-5 shadow-sm">
            <div className="font-semibold text-ink">{item.title}</div>
            <div className="mt-3 text-sm leading-7 text-slate-600">{item.text}</div>
          </div>
        ))}
      </section>
    </SiteShell>
  );
}
