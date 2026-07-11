'use client';

import { type FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  BadgeCheck,
  Bell,
  BellOff,
  CheckCircle2,
  Flag,
  HeartHandshake,
  Loader2,
  MessageCircle,
  PencilLine,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  X
} from 'lucide-react';
import { SiteShell } from '@/components/site-shell';
import { useUserSessionState } from '@/hooks/use-user-session';
import { openAuthModal, writeAuthIntent } from '@/lib/auth-intent';
import {
  fetchFollowedOfferPostIds,
  fetchOfferComments,
  fetchPublicCommunityPosts,
  formatOfferTime,
  getOfferAuthorLabel,
  getOfferAvatar,
  offerDiscussionCategories,
  offerResultTypes,
  reportOfferPost,
  submitOfferComment,
  submitOfferDiscussion,
  toggleOfferPostFollow,
  type OfferComment,
  type OfferDiscussionCategory,
  type OfferResultType,
  type PublicOffer
} from '@/lib/offers';

type FeedTab = 'offers' | 'discussions';

const resultTone: Record<OfferResultType, string> = {
  录取: 'bg-emerald-50 text-emerald-700',
  放弃: 'bg-rose-50 text-rose-700',
  候补: 'bg-amber-50 text-amber-700',
  补录传闻: 'bg-orange-50 text-orange-700',
  官方确认: 'bg-blue-50 text-blue-700'
};

const emptyDiscussionForm = {
  title: '',
  schoolName: '',
  major: '',
  category: '选校定位' as OfferDiscussionCategory,
  content: '',
  isAnonymous: true
};

function openMemberLogin() {
  const intent = {
    type: 'open-workspace' as const,
    returnTo: '/offers',
    reason: 'offer-community-action',
    requiredAuth: 'member' as const
  };
  writeAuthIntent(intent);
  openAuthModal(intent);
}

export default function OffersPage() {
  const { ready, isMember, session } = useUserSessionState();
  const [posts, setPosts] = useState<PublicOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [activeTab, setActiveTab] = useState<FeedTab>('offers');
  const [keyword, setKeyword] = useState('');
  const [resultFilter, setResultFilter] = useState<'全部' | OfferResultType>('全部');
  const [discussionFilter, setDiscussionFilter] = useState<'全部' | OfferDiscussionCategory>('全部');
  const [selectedPost, setSelectedPost] = useState<PublicOffer | null>(null);
  const [comments, setComments] = useState<OfferComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [followedIds, setFollowedIds] = useState<string[]>([]);
  const [actionMessage, setActionMessage] = useState('');
  const [replyText, setReplyText] = useState('');
  const [replyPending, setReplyPending] = useState(false);
  const [followPending, setFollowPending] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportPending, setReportPending] = useState(false);
  const [discussionOpen, setDiscussionOpen] = useState(false);
  const [discussionPending, setDiscussionPending] = useState(false);
  const [discussionMessage, setDiscussionMessage] = useState('');
  const [discussionForm, setDiscussionForm] = useState(emptyDiscussionForm);

  const memberUserId = isMember && session?.userId ? session.userId : '';
  const defaultAuthorName =
    session?.profile.nickname?.trim() || (session?.email ? session.email.split('@')[0] : '寻鹿用户');

  async function loadPosts() {
    setLoading(true);
    setLoadError('');
    try {
      setPosts(await fetchPublicCommunityPosts());
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Offer 圈暂时无法加载，请稍后重试。');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadPosts();
  }, []);

  useEffect(() => {
    if (!memberUserId) {
      setFollowedIds([]);
      return;
    }
    void fetchFollowedOfferPostIds(memberUserId).then(setFollowedIds);
  }, [memberUserId]);

  useEffect(() => {
    if (!selectedPost) {
      setComments([]);
      setActionMessage('');
      setReplyText('');
      setReportOpen(false);
      return;
    }

    let active = true;
    setCommentsLoading(true);
    void fetchOfferComments(selectedPost.id)
      .then((items) => {
        if (active) setComments(items);
      })
      .catch((error) => {
        if (active) setActionMessage(error instanceof Error ? error.message : '回复加载失败。');
      })
      .finally(() => {
        if (active) setCommentsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [selectedPost]);

  const offerPosts = useMemo(() => posts.filter((post) => post.contentType === 'offer'), [posts]);
  const discussionPosts = useMemo(() => posts.filter((post) => post.contentType === 'discussion'), [posts]);
  const recentCount = useMemo(() => {
    const threshold = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return posts.filter((post) => new Date(post.createdAt).getTime() >= threshold).length;
  }, [posts]);
  const schoolCount = useMemo(
    () => new Set(posts.map((post) => post.schoolName).filter((school) => school && school !== '通用讨论')).size,
    [posts]
  );

  const filteredPosts = useMemo(() => {
    const source = activeTab === 'offers' ? offerPosts : discussionPosts;
    const normalizedKeyword = keyword.trim().toLowerCase();
    return source.filter((post) => {
      if (activeTab === 'offers' && resultFilter !== '全部' && post.result !== resultFilter) return false;
      if (activeTab === 'discussions' && discussionFilter !== '全部' && post.category !== discussionFilter) return false;
      if (!normalizedKeyword) return true;
      return [post.title, post.schoolName, post.major, post.content, post.category, post.projectType, post.result]
        .join(' ')
        .toLowerCase()
        .includes(normalizedKeyword);
    });
  }, [activeTab, discussionFilter, discussionPosts, keyword, offerPosts, resultFilter]);

  function openDiscussionComposer() {
    if (!ready || !memberUserId) {
      openMemberLogin();
      return;
    }
    setDiscussionMessage('');
    setDiscussionOpen(true);
  }

  async function handleDiscussionSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!memberUserId) {
      openMemberLogin();
      return;
    }

    setDiscussionPending(true);
    setDiscussionMessage('正在提交讨论...');
    try {
      await submitOfferDiscussion({
        userId: memberUserId,
        authorName: defaultAuthorName,
        ...discussionForm
      });
      setDiscussionForm(emptyDiscussionForm);
      setDiscussionMessage('提交成功。内容核验通过后会出现在讨论广场。');
    } catch (error) {
      setDiscussionMessage(error instanceof Error ? error.message : '讨论提交失败，请稍后重试。');
    } finally {
      setDiscussionPending(false);
    }
  }

  async function handleReplySubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedPost) return;
    if (!memberUserId) {
      openMemberLogin();
      return;
    }

    setReplyPending(true);
    setActionMessage('正在发布回复...');
    try {
      await submitOfferComment({
        postId: selectedPost.id,
        userId: memberUserId,
        authorName: defaultAuthorName,
        content: replyText,
        isAnonymous: true
      });
      setReplyText('');
      setComments(await fetchOfferComments(selectedPost.id));
      setPosts((current) =>
        current.map((post) => (post.id === selectedPost.id ? { ...post, commentsCount: post.commentsCount + 1 } : post))
      );
      setSelectedPost((current) => (current ? { ...current, commentsCount: current.commentsCount + 1 } : current));
      setActionMessage('回复已发布。');
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : '回复失败，请稍后重试。');
    } finally {
      setReplyPending(false);
    }
  }

  async function handleFollow() {
    if (!selectedPost) return;
    if (!memberUserId) {
      openMemberLogin();
      return;
    }

    const followed = followedIds.includes(selectedPost.id);
    setFollowPending(true);
    try {
      const nextFollowed = await toggleOfferPostFollow(selectedPost.id, memberUserId, followed);
      setFollowedIds((current) =>
        nextFollowed ? Array.from(new Set([...current, selectedPost.id])) : current.filter((id) => id !== selectedPost.id)
      );
      const delta = nextFollowed ? 1 : -1;
      setPosts((current) =>
        current.map((post) =>
          post.id === selectedPost.id ? { ...post, followsCount: Math.max(0, post.followsCount + delta) } : post
        )
      );
      setSelectedPost((current) =>
        current ? { ...current, followsCount: Math.max(0, current.followsCount + delta) } : current
      );
      setActionMessage(nextFollowed ? '已加入关注，可随时返回查看讨论进展。' : '已取消关注。');
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : '关注状态保存失败。');
    } finally {
      setFollowPending(false);
    }
  }

  async function handleReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedPost) return;
    setReportPending(true);
    try {
      await reportOfferPost(selectedPost.id, reportReason, session?.userId);
      setReportReason('');
      setReportOpen(false);
      setActionMessage('反馈已提交，运营人员会核查处理。');
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : '反馈提交失败。');
    } finally {
      setReportPending(false);
    }
  }

  return (
    <SiteShell>
      <section className="overflow-hidden rounded-[28px] border border-white/80 bg-white/90 px-6 py-7 shadow-soft sm:px-8 lg:px-10">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 text-sm font-semibold text-brand">
              <HeartHandshake className="h-4 w-4" />
              真实申请交流
            </div>
            <h1 className="mt-3 text-3xl font-black tracking-normal text-ink sm:text-4xl">Offer 圈</h1>
            <p className="mt-3 text-sm leading-7 text-slate-600 sm:text-base">
              分享录取、放弃与候补进展，也可以围绕选校、材料和面试发起讨论。用户投稿与官方整理会明确区分。
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <Metric label="公开动态" value={loading ? '—' : String(offerPosts.length)} />
            <Metric label="近 7 天更新" value={loading ? '—' : String(recentCount)} />
            <Metric label="覆盖院校" value={loading ? '—' : String(schoolCount)} />
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_280px]">
        <div className="min-w-0 space-y-5">
          <div className="rounded-[24px] border border-white/80 bg-white/95 p-4 shadow-soft sm:p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="inline-flex rounded-xl bg-slate-100 p-1" role="tablist" aria-label="Offer 圈内容类型">
                <TabButton
                  active={activeTab === 'offers'}
                  label={`Offer 动态 ${offerPosts.length}`}
                  onClick={() => setActiveTab('offers')}
                />
                <TabButton
                  active={activeTab === 'discussions'}
                  label={`讨论广场 ${discussionPosts.length}`}
                  onClick={() => setActiveTab('discussions')}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={openDiscussionComposer}
                  className="inline-flex h-11 items-center gap-2 rounded-xl bg-brand px-4 text-sm font-semibold text-white transition hover:bg-brand-deep"
                >
                  <PencilLine className="h-4 w-4" />
                  发起讨论
                </button>
                <Link
                  href="/publish"
                  className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-brand transition hover:border-brand/30 hover:bg-brand/5"
                >
                  发布 Offer
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>

            <div className="mt-4 flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
              <Search className="h-4 w-4 text-slate-400" />
              <input
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                placeholder="搜索学校、专业或讨论关键词"
                className="min-w-0 flex-1 bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400"
              />
              {keyword ? (
                <button type="button" onClick={() => setKeyword('')} className="text-slate-400 hover:text-brand" aria-label="清空搜索">
                  <X className="h-4 w-4" />
                </button>
              ) : null}
            </div>

            <div className="mt-4 flex gap-2 overflow-x-auto pb-1" aria-label="内容筛选">
              {activeTab === 'offers'
                ? (['全部', ...offerResultTypes] as const).map((item) => (
                    <FilterButton key={item} active={resultFilter === item} onClick={() => setResultFilter(item)}>
                      {item}
                    </FilterButton>
                  ))
                : (['全部', ...offerDiscussionCategories] as const).map((item) => (
                    <FilterButton key={item} active={discussionFilter === item} onClick={() => setDiscussionFilter(item)}>
                      {item}
                    </FilterButton>
                  ))}
            </div>
          </div>

          {loading ? (
            <FeedSkeleton />
          ) : loadError ? (
            <StatePanel
              icon={RefreshCw}
              title="暂时无法加载 Offer 圈"
              description={loadError}
              action={<button onClick={() => void loadPosts()} className="font-semibold text-brand">重新加载</button>}
            />
          ) : filteredPosts.length === 0 ? (
            <StatePanel
              icon={MessageCircle}
              title={activeTab === 'offers' ? '暂时没有已核验的 Offer 动态' : '当前筛选下没有讨论'}
              description={
                activeTab === 'offers'
                  ? '我们不会用示例内容伪装真实投稿。你可以发布自己的进展，核验后会公开展示。'
                  : '换一个分类或关键词，也可以发起第一个真实问题。'
              }
              action={
                activeTab === 'offers' ? (
                  <Link href="/publish" className="font-semibold text-brand">发布真实动态</Link>
                ) : (
                  <button onClick={openDiscussionComposer} className="font-semibold text-brand">发起讨论</button>
                )
              }
            />
          ) : (
            <div className="space-y-3">
              {filteredPosts.map((post) => (
                <FeedCard key={post.id} post={post} onOpen={() => setSelectedPost(post)} />
              ))}
            </div>
          )}
        </div>

        <aside className="space-y-4 xl:sticky xl:top-24 xl:self-start">
          <div className="rounded-[20px] border border-white/80 bg-white/95 p-5 shadow-soft">
            <div className="flex items-center gap-2 font-bold text-ink">
              <ShieldCheck className="h-5 w-5 text-brand" />
              社区准则
            </div>
            <ul className="mt-4 space-y-4 text-sm leading-6 text-slate-600">
              <li><strong className="text-slate-900">说明信息性质</strong><br />区分本人反馈、官方信息和未确认消息。</li>
              <li><strong className="text-slate-900">保护个人隐私</strong><br />不要发布手机号、身份证和未脱敏材料。</li>
              <li><strong className="text-slate-900">保持可纠错</strong><br />发现失实或过期内容，可直接提交反馈。</li>
            </ul>
          </div>
          <div className="rounded-[20px] border border-brand/10 bg-brand px-5 py-5 text-white shadow-soft">
            <Sparkles className="h-5 w-5" />
            <h2 className="mt-3 font-bold">先说明背景，再提出问题</h2>
            <p className="mt-2 text-sm leading-6 text-white/75">学校层次、排名区间、目标方向和当前进度越清楚，越容易获得有效回复。</p>
          </div>
        </aside>
      </section>

      {selectedPost ? (
        <PostDialog
          post={selectedPost}
          comments={comments}
          commentsLoading={commentsLoading}
          followed={followedIds.includes(selectedPost.id)}
          followPending={followPending}
          memberUserId={memberUserId}
          replyText={replyText}
          replyPending={replyPending}
          actionMessage={actionMessage}
          reportOpen={reportOpen}
          reportReason={reportReason}
          reportPending={reportPending}
          onClose={() => setSelectedPost(null)}
          onFollow={() => void handleFollow()}
          onReplyText={setReplyText}
          onReply={handleReplySubmit}
          onLogin={openMemberLogin}
          onReportOpen={() => setReportOpen((current) => !current)}
          onReportReason={setReportReason}
          onReport={handleReport}
        />
      ) : null}

      {discussionOpen ? (
        <DiscussionDialog
          form={discussionForm}
          pending={discussionPending}
          message={discussionMessage}
          onChange={(patch) => setDiscussionForm((current) => ({ ...current, ...patch }))}
          onClose={() => setDiscussionOpen(false)}
          onSubmit={handleDiscussionSubmit}
        />
      ) : null}
    </SiteShell>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-[88px] rounded-2xl border border-slate-200 bg-white px-3 py-3 text-center sm:min-w-[112px] sm:px-4">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-1 text-xl font-black text-ink sm:text-2xl">{value}</div>
    </div>
  );
}

function TabButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`h-10 rounded-lg px-4 text-sm font-semibold transition ${active ? 'bg-white text-brand shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
    >
      {label}
    </button>
  );
}

function FilterButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`h-9 shrink-0 rounded-lg px-3 text-sm font-semibold transition ${active ? 'bg-brand text-white' : 'bg-slate-100 text-slate-600 hover:bg-brand/10 hover:text-brand'}`}
    >
      {children}
    </button>
  );
}

function FeedCard({ post, onOpen }: { post: PublicOffer; onOpen: () => void }) {
  const author = getOfferAuthorLabel(post);
  return (
    <article className="rounded-[20px] border border-white/80 bg-white/95 p-5 shadow-soft transition hover:-translate-y-0.5 hover:shadow-card sm:p-6">
      <button type="button" onClick={onOpen} className="w-full text-left" aria-label={`打开${post.title || `${post.schoolName} ${post.result}`}详情`}>
        <div className="flex gap-4">
          <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full font-black ${post.isOfficial ? 'bg-brand text-white' : 'bg-brand/10 text-brand'}`}>
            {getOfferAvatar(author)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span className="font-semibold text-slate-900">{author}</span>
              {post.isOfficial ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-brand/10 px-2 py-1 font-semibold text-brand"><BadgeCheck className="h-3 w-3" />官方整理</span>
              ) : (
                <span className="rounded-full bg-slate-100 px-2 py-1">用户投稿</span>
              )}
              <span>{formatOfferTime(post.createdAt)}</span>
            </div>

            {post.contentType === 'discussion' ? (
              <>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">{post.category}</span>
                  <span className="text-xs text-slate-500">{post.schoolName} · {post.major}</span>
                </div>
                <h2 className="mt-3 text-lg font-bold leading-7 text-ink sm:text-xl">{post.title}</h2>
              </>
            ) : (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${resultTone[post.result]}`}>{post.result}</span>
                <h2 className="text-lg font-bold text-ink">{post.schoolName}</h2>
                <span className="text-sm text-slate-500">{post.major} · {post.projectType}</span>
              </div>
            )}

            {post.undergraduateBackground ? (
              <div className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600">本科背景：{post.undergraduateBackground}</div>
            ) : null}
            <p className="mt-3 line-clamp-3 text-sm leading-7 text-slate-600">{post.content}</p>
            <div className="mt-4 flex items-center gap-5 text-xs font-medium text-slate-500">
              <span className="inline-flex items-center gap-1.5"><MessageCircle className="h-4 w-4" />{post.commentsCount} 条回复</span>
              <span className="inline-flex items-center gap-1.5"><Bell className="h-4 w-4" />{post.followsCount} 人关注</span>
              <span className="ml-auto inline-flex items-center gap-1 font-semibold text-brand">查看交流 <ArrowRight className="h-4 w-4" /></span>
            </div>
          </div>
        </div>
      </button>
    </article>
  );
}

function StatePanel({ icon: Icon, title, description, action }: { icon: typeof MessageCircle; title: string; description: string; action: React.ReactNode }) {
  return (
    <div className="rounded-[20px] border border-dashed border-slate-200 bg-white/90 px-6 py-16 text-center shadow-soft">
      <Icon className="mx-auto h-8 w-8 text-brand" />
      <h2 className="mt-4 text-lg font-bold text-ink">{title}</h2>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-7 text-slate-500">{description}</p>
      <div className="mt-4">{action}</div>
    </div>
  );
}

function FeedSkeleton() {
  return (
    <div className="space-y-3" aria-label="正在加载 Offer 圈">
      {[0, 1, 2].map((item) => (
        <div key={item} className="h-48 animate-pulse rounded-[20px] border border-white/80 bg-white/80 shadow-soft" />
      ))}
    </div>
  );
}

type PostDialogProps = {
  post: PublicOffer;
  comments: OfferComment[];
  commentsLoading: boolean;
  followed: boolean;
  followPending: boolean;
  memberUserId: string;
  replyText: string;
  replyPending: boolean;
  actionMessage: string;
  reportOpen: boolean;
  reportReason: string;
  reportPending: boolean;
  onClose: () => void;
  onFollow: () => void;
  onReplyText: (value: string) => void;
  onReply: (event: FormEvent<HTMLFormElement>) => void;
  onLogin: () => void;
  onReportOpen: () => void;
  onReportReason: (value: string) => void;
  onReport: (event: FormEvent<HTMLFormElement>) => void;
};

function PostDialog(props: PostDialogProps) {
  const { post } = props;
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-950/40 p-0 backdrop-blur-sm sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-labelledby="offer-dialog-title">
      <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-t-[24px] bg-white shadow-2xl sm:rounded-[24px]">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white/95 px-5 py-4 backdrop-blur sm:px-7">
          <div>
            <div className="text-xs font-semibold text-brand">{post.contentType === 'discussion' ? post.category : `${post.result} · ${post.projectType}`}</div>
            <h2 id="offer-dialog-title" className="mt-1 line-clamp-1 font-bold text-ink">{post.title || `${post.schoolName} ${post.major}`}</h2>
          </div>
          <button type="button" onClick={props.onClose} className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200" aria-label="关闭详情">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-6 px-5 py-6 sm:px-7">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
              <span className="font-semibold text-slate-900">{getOfferAuthorLabel(post)}</span>
              <span>{post.isOfficial ? '官方整理' : '用户投稿'}</span>
              <span>{formatOfferTime(post.createdAt)}</span>
            </div>
            {post.undergraduateBackground ? <div className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">本科背景：{post.undergraduateBackground}</div> : null}
            <p className="mt-4 whitespace-pre-wrap text-[15px] leading-8 text-slate-700">{post.content}</p>
          </div>

          <div className="flex flex-wrap gap-2 border-y border-slate-100 py-4">
            <button type="button" onClick={props.onFollow} disabled={props.followPending} className={`inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold ${props.followed ? 'bg-brand text-white' : 'bg-slate-100 text-slate-700'}`}>
              {props.followPending ? <Loader2 className="h-4 w-4 animate-spin" /> : props.followed ? <BellOff className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
              {props.followed ? '取消关注' : '关注讨论'}
            </button>
            <button type="button" onClick={props.onReportOpen} className="inline-flex h-10 items-center gap-2 rounded-xl bg-slate-100 px-4 text-sm font-semibold text-slate-600 hover:bg-rose-50 hover:text-rose-600">
              <Flag className="h-4 w-4" />反馈问题
            </button>
          </div>

          {props.reportOpen ? (
            <form onSubmit={props.onReport} className="rounded-xl border border-rose-100 bg-rose-50/60 p-4">
              <label className="text-sm font-semibold text-slate-800" htmlFor="offer-report-reason">请说明需要核查的问题</label>
              <textarea id="offer-report-reason" value={props.reportReason} onChange={(event) => props.onReportReason(event.target.value)} rows={3} className="mt-2 w-full rounded-xl border border-rose-100 bg-white px-3 py-2 text-sm outline-none focus:border-rose-300" placeholder="例如：内容已经过期、描述与官方通知不一致" />
              <button disabled={props.reportPending} className="mt-2 inline-flex h-9 items-center gap-2 rounded-lg bg-rose-600 px-3 text-sm font-semibold text-white disabled:opacity-60">
                {props.reportPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Flag className="h-4 w-4" />}提交反馈
              </button>
            </form>
          ) : null}

          <div>
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-ink">交流回复</h3>
              <span className="text-xs text-slate-500">{props.comments.length} 条</span>
            </div>
            {props.commentsLoading ? (
              <div className="mt-4 flex items-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" />正在加载回复</div>
            ) : props.comments.length ? (
              <div className="mt-4 space-y-3">
                {props.comments.map((comment) => (
                  <div key={comment.id} className="rounded-xl bg-slate-50 px-4 py-3">
                    <div className="flex items-center justify-between text-xs text-slate-500"><span className="font-semibold text-slate-700">{comment.isAnonymous ? '匿名同学' : comment.authorName}</span><span>{formatOfferTime(comment.createdAt)}</span></div>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-slate-700">{comment.content}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-4 rounded-xl bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">还没有回复，欢迎补充真实信息或给出建议。</div>
            )}
          </div>

          {props.memberUserId ? (
            <form onSubmit={props.onReply} className="rounded-xl border border-slate-200 p-3">
              <textarea value={props.replyText} onChange={(event) => props.onReplyText(event.target.value)} rows={3} className="w-full resize-none bg-transparent text-sm leading-6 outline-none placeholder:text-slate-400" placeholder="友善交流，避免发布个人敏感信息" />
              <div className="mt-2 flex items-center justify-between gap-3 border-t border-slate-100 pt-3">
                <span className="text-xs text-slate-400">回复将匿名展示</span>
                <button disabled={props.replyPending || !props.replyText.trim()} className="inline-flex h-9 items-center gap-2 rounded-lg bg-brand px-3 text-sm font-semibold text-white disabled:opacity-50">
                  {props.replyPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}发布回复
                </button>
              </div>
            </form>
          ) : (
            <button type="button" onClick={props.onLogin} className="w-full rounded-xl bg-brand/5 px-4 py-4 text-sm font-semibold text-brand">登录后参与交流</button>
          )}

          {props.actionMessage ? <div className="text-sm font-medium text-brand" role="status">{props.actionMessage}</div> : null}
        </div>
      </div>
    </div>
  );
}

type DiscussionForm = typeof emptyDiscussionForm;

function DiscussionDialog({ form, pending, message, onChange, onClose, onSubmit }: {
  form: DiscussionForm;
  pending: boolean;
  message: string;
  onChange: (patch: Partial<DiscussionForm>) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-slate-950/40 p-0 backdrop-blur-sm sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-labelledby="discussion-dialog-title">
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-[24px] bg-white shadow-2xl sm:rounded-[24px]">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 sm:px-7">
          <div><div className="text-xs font-semibold text-brand">讨论广场</div><h2 id="discussion-dialog-title" className="mt-1 text-lg font-bold text-ink">发起一个清晰的问题</h2></div>
          <button type="button" onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-500" aria-label="关闭发布讨论"><X className="h-5 w-5" /></button>
        </div>
        <form onSubmit={onSubmit} className="space-y-4 px-5 py-6 sm:px-7">
          <label className="block text-sm font-semibold text-slate-700">标题<input value={form.title} onChange={(event) => onChange({ title: event.target.value })} maxLength={120} className="mt-2 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-brand" placeholder="例如：计算机方向夏令营如何安排投递梯度？" /></label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-semibold text-slate-700">相关院校<input value={form.schoolName} onChange={(event) => onChange({ schoolName: event.target.value })} maxLength={80} className="mt-2 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-brand" placeholder="通用问题可填“通用讨论”" /></label>
            <label className="block text-sm font-semibold text-slate-700">专业方向<input value={form.major} onChange={(event) => onChange({ major: event.target.value })} maxLength={80} className="mt-2 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-brand" placeholder="例如 计算机科学" /></label>
          </div>
          <label className="block text-sm font-semibold text-slate-700">讨论分类<select value={form.category} onChange={(event) => onChange({ category: event.target.value as OfferDiscussionCategory })} className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-brand">{offerDiscussionCategories.map((category) => <option key={category}>{category}</option>)}</select></label>
          <label className="block text-sm font-semibold text-slate-700">问题背景<textarea value={form.content} onChange={(event) => onChange({ content: event.target.value })} maxLength={1200} rows={6} className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm leading-7 outline-none focus:border-brand" placeholder="说明你的本科背景、当前进度、已经确认的信息和最需要讨论的问题。" /></label>
          <label className="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={form.isAnonymous} onChange={(event) => onChange({ isAnonymous: event.target.checked })} className="h-4 w-4 rounded border-slate-300 text-brand" />公开展示时匿名</label>
          <div className="rounded-xl bg-slate-50 px-4 py-3 text-xs leading-6 text-slate-500"><ShieldCheck className="mr-1 inline h-4 w-4 text-brand" />提交后先核验再公开。请勿上传手机号、身份证、邮箱或未脱敏材料。</div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-brand" role="status">{message}</div>
            <button disabled={pending} className="inline-flex h-11 items-center gap-2 rounded-xl bg-brand px-5 text-sm font-semibold text-white disabled:opacity-60">{pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}提交审核</button>
          </div>
        </form>
      </div>
    </div>
  );
}
