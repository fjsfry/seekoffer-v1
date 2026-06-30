'use client';

import { type FormEvent, type ReactNode, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, CheckCircle2, Loader2, PencilLine, ShieldCheck } from 'lucide-react';
import { LoginRequiredCard } from '@/components/login-required-card';
import { PageSectionTitle } from '@/components/page-section-title';
import { SiteShell } from '@/components/site-shell';
import { useUserSessionState } from '@/hooks/use-user-session';
import { offerProjectTypes, offerResultTypes, submitOfferPost, type OfferProjectType, type OfferResultType } from '@/lib/offers';
import { isMemberSession } from '@/lib/user-session';

type OfferFormState = {
  authorName: string;
  schoolName: string;
  major: string;
  projectType: OfferProjectType;
  result: OfferResultType;
  undergraduateBackground: string;
  content: string;
  isAnonymous: boolean;
};

export default function PublishPage() {
  const { ready, loggedIn, session } = useUserSessionState();
  const canPublish = isMemberSession(session) && Boolean(session?.userId);
  const profileNickname = session?.profile.nickname?.trim() || '';
  const defaultAuthorName = profileNickname || (session?.email ? session.email.split('@')[0] : 'Seekoffer用户');
  const [form, setForm] = useState<OfferFormState>({
    authorName: '',
    schoolName: '',
    major: '',
    projectType: '预推免',
    result: '录取',
    undergraduateBackground: '',
    content: '',
    isAnonymous: true
  });
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('提交后会进入后台审核，通过后才会展示到 Offer 圈。');
  const [submitted, setSubmitted] = useState(false);

  function updateForm<K extends keyof OfferFormState>(key: K, value: OfferFormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!session?.userId) {
      setMessage('登录状态已失效，请重新登录后再发布。');
      return;
    }

    setPending(true);
    setSubmitted(false);
    setMessage('正在提交 Offer 动态...');

    try {
      await submitOfferPost({
        userId: session.userId,
        ...form,
        authorName: form.authorName || defaultAuthorName
      });
      setSubmitted(true);
      setMessage('提交成功，已进入后台待审核队列。审核通过后会公开展示在 Offer 圈。');
      setForm((current) => ({
        ...current,
        schoolName: '',
        major: '',
        undergraduateBackground: '',
        content: ''
      }));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '发布失败，请稍后重试。');
    } finally {
      setPending(false);
    }
  }

  if (!ready) {
    return (
      <SiteShell>
        <PageSectionTitle
          eyebrow="Share Offer"
          title="发布 Offer 动态"
          subtitle="真实 Offer 发布会影响候补判断，因此需要登录、审核和后续举报机制。"
        />
        <LoginRequiredCard
          title="发布动态前需要先登录"
          description="为了减少虚假信息，发布 Offer 动态会记录账号状态；你仍然可以选择在前台匿名展示。"
          requiredAuth="member"
          actionLabel="登录后继续"
          intent={{
            type: 'publish-offer',
            returnTo: '/publish',
            reason: 'publish-gate',
            requiredAuth: 'member'
          }}
        />
      </SiteShell>
    );
  }

  if (!loggedIn || !canPublish) {
    return (
      <SiteShell>
        <PageSectionTitle
          eyebrow="Share Offer"
          title="发布 Offer 动态"
          subtitle="分享你的保研去向与释放的 Offer，帮助候补池中的同学更快预判机会变化。"
        />
        <LoginRequiredCard
          title={loggedIn ? '试用态还不能直接发布 Offer' : '发布动态前需要先登录'}
          description={
            loggedIn
              ? '试用模式可以先体验通知库和基础工作台，但发布 Offer 会影响社区可信度，所以需要使用邮箱账号登录后再继续。'
              : '登录后即可发布 Offer 动态。提交内容会先进入后台审核，前台可匿名展示。'
          }
          requiredAuth="member"
          actionLabel={loggedIn ? '使用正式账号登录' : '登录后继续'}
          intent={{
            type: 'publish-offer',
            returnTo: '/publish',
            reason: 'publish-gate',
            requiredAuth: 'member'
          }}
        />
      </SiteShell>
    );
  }

  return (
    <SiteShell>
      <PageSectionTitle
        eyebrow="Share Offer"
        title="发布 Offer 动态"
        subtitle="分享你的保研去向与释放的 Offer，帮助候补池中的同学更快预判机会变化。"
      />

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <form onSubmit={handleSubmit} className="product-card rounded-[30px] p-6 lg:p-8">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-5">
            <div>
              <h2 className="text-xl font-semibold text-ink">提交待审核动态</h2>
              <p className="mt-2 text-sm leading-7 text-slate-500">请只提交你本人确认的信息，避免写入联系方式、导师隐私或可识别他人的内容。</p>
            </div>
            <span className="inline-flex items-center gap-2 rounded-full bg-brand/8 px-3 py-1.5 text-xs font-semibold text-brand">
              <ShieldCheck className="h-4 w-4" />
              审核后公开
            </span>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <Field label="后台核验称呼">
              <input
                value={form.authorName}
                onChange={(event) => updateForm('authorName', event.target.value)}
                maxLength={80}
                className={inputClassName}
                placeholder={defaultAuthorName}
              />
            </Field>
            <Field label="相关院校">
              <input
                value={form.schoolName}
                onChange={(event) => updateForm('schoolName', event.target.value)}
                maxLength={80}
                className={inputClassName}
                placeholder="例如：上海交通大学"
              />
            </Field>
            <Field label="专业或方向">
              <input
                value={form.major}
                onChange={(event) => updateForm('major', event.target.value)}
                maxLength={80}
                className={inputClassName}
                placeholder="例如：电子信息 / 计算机科学与技术"
              />
            </Field>
            <Field label="本科背景">
              <input
                value={form.undergraduateBackground}
                onChange={(event) => updateForm('undergraduateBackground', event.target.value)}
                maxLength={120}
                className={inputClassName}
                placeholder="例如：双非，专业前 3%，有一段科研"
              />
            </Field>
            <Field label="动态类型">
              <select
                value={form.result}
                onChange={(event) => updateForm('result', event.target.value as OfferResultType)}
                className={inputClassName}
              >
                {offerResultTypes.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="项目类型">
              <select
                value={form.projectType}
                onChange={(event) => updateForm('projectType', event.target.value as OfferProjectType)}
                className={inputClassName}
              >
                {offerProjectTypes.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="mt-5">
            <Field label="补充说明">
              <textarea
                value={form.content}
                onChange={(event) => updateForm('content', event.target.value)}
                maxLength={1200}
                rows={7}
                className={`${inputClassName} resize-none leading-7`}
                placeholder="建议写清楚：信息来源、录取/放弃/候补状态、时间节点、是否已电话或邮件确认。不要写手机号、微信号、身份证号、导师私人联系方式。"
              />
            </Field>
            <div className="mt-2 text-right text-xs font-semibold text-slate-400">{form.content.length}/1200</div>
          </div>

          <label className="mt-5 flex items-start gap-3 rounded-2xl bg-slate-50 p-4 text-sm leading-7 text-slate-600">
            <input
              type="checkbox"
              checked={form.isAnonymous}
              onChange={(event) => updateForm('isAnonymous', event.target.checked)}
              className="mt-1 h-4 w-4 rounded border-slate-300 text-brand"
            />
            <span>
              前台匿名展示。后台仍会记录你的账号与核验称呼，用于处理举报和内容追溯。
            </span>
          </label>

          <div className={`mt-5 rounded-2xl px-4 py-3 text-sm leading-7 ${submitted ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-50 text-slate-600'}`}>
            {submitted ? <CheckCircle2 className="mr-2 inline h-4 w-4" /> : null}
            {message}
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={pending}
              className="inline-flex items-center gap-2 rounded-2xl bg-brand px-5 py-3 text-sm font-semibold text-white shadow-float transition hover:-translate-y-0.5 hover:bg-brand-deep disabled:cursor-not-allowed disabled:opacity-70"
            >
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <PencilLine className="h-4 w-4" />}
              提交审核
            </button>
            <Link
              href="/offers"
              className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-brand/25 hover:text-brand"
            >
              返回 Offer 圈
            </Link>
          </div>
        </form>

        <aside className="grid content-start gap-5">
          <section className="product-card rounded-[22px] p-6">
            <h2 className="text-lg font-semibold text-ink">发布前检查</h2>
            <div className="mt-5 grid gap-4">
              {[
                '只提交你本人确认或可靠来源的信息',
                '不要填写联系方式、身份证号和导师私人信息',
                '说明时间节点和确认方式，比单句结论更有价值',
                '审核通过前不会公开展示'
              ].map((item) => (
                <div key={item} className="flex gap-3 text-sm leading-6 text-slate-600">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="product-card rounded-[22px] p-6">
            <h2 className="text-lg font-semibold text-ink">审核流转</h2>
            <div className="mt-5 grid gap-3 text-sm leading-7 text-slate-600">
              <p>1. 提交后写入 Supabase 的 `offer_posts` 表，状态为 pending。</p>
              <p>2. 管理员在后台 Offer 审核工作台中审核、隐藏或删除。</p>
              <p>3. 只有 approved 且未隐藏、未删除的内容会出现在前台。</p>
            </div>
            <Link href="/community" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-brand">
              查看社区规范
              <ArrowRight className="h-4 w-4" />
            </Link>
          </section>
        </aside>
      </section>
    </SiteShell>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-2 text-sm font-semibold text-slate-700">
      <span>{label}</span>
      {children}
    </label>
  );
}

const inputClassName =
  'w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-brand/40 focus:ring-4 focus:ring-brand/10';
