'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  Clock3,
  Edit3,
  FileText,
  Flag,
  Flame,
  Heart,
  ListChecks,
  Loader2,
  MessageCircle,
  Pin,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  University,
  X
} from 'lucide-react';
import { SiteShell } from '@/components/site-shell';
import {
  curatedOfferSamples,
  fetchPublicOffers,
  formatOfferTime,
  getOfferAuthorLabel,
  getOfferAvatar,
  offerResultTypes,
  reportOfferPost,
  type OfferResultType,
  type PublicOffer
} from '@/lib/offers';
import { useUserSessionState } from '@/hooks/use-user-session';

const offerTabs = ['全部', ...offerResultTypes] as const;
const hubTabs = [
  { id: 'offers', label: 'Offer 动态', description: '录取、放弃、候补和官方确认', icon: FileText },
  { id: 'discussions', label: '讨论广场', description: '围绕院校、材料和面试交流', icon: MessageCircle },
  { id: 'decisions', label: 'Offer 选择', description: '多 Offer 对比和投票理由', icon: ListChecks },
  { id: 'waitlist', label: '候补动态', description: '放弃、补录和候补推进', icon: Clock3 }
] as const;

type HubTab = (typeof hubTabs)[number]['id'];

const discussionCategories = ['全部', '选校定位', '材料准备', '套磁导师', '面试经验', 'Offer 选择', '候补动态'] as const;
type DiscussionCategory = (typeof discussionCategories)[number];

type DiscussionPost = {
  id: string;
  category: Exclude<DiscussionCategory, '全部'>;
  title: string;
  school: string;
  major: string;
  author: string;
  time: string;
  replies: number;
  follows: number;
  excerpt: string;
  tags: string[];
  status: string;
};

type DecisionThread = {
  id: string;
  title: string;
  background: string;
  options: Array<{ id: string; label: string; detail: string; votes: number }>;
  comments: string[];
  tags: string[];
};

type WaitlistUpdate = {
  id: string;
  school: string;
  major: string;
  type: OfferResultType;
  status: string;
  source: '本人反馈' | '多人确认' | '官方确认';
  time: string;
  detail: string;
};

type PinnedItem =
  | { kind: 'offer'; id: string }
  | { kind: 'discussion'; id: string }
  | { kind: 'decision'; id: string }
  | { kind: 'waitlist'; id: string };

type PinnedDetail =
  | { kind: 'offer'; offer: PublicOffer }
  | { kind: 'discussion'; post: DiscussionPost }
  | { kind: 'decision'; thread: DecisionThread }
  | { kind: 'waitlist'; update: WaitlistUpdate };

const resultTone: Record<OfferResultType, string> = {
  录取: 'bg-emerald-50 text-brand',
  放弃: 'bg-rose-50 text-rose-600',
  候补: 'bg-amber-50 text-amber-700',
  补录传闻: 'bg-orange-50 text-orange-700',
  官方确认: 'bg-blue-50 text-blue-700'
};

const sourceTone: Record<WaitlistUpdate['source'], string> = {
  本人反馈: 'bg-emerald-50 text-brand',
  多人确认: 'bg-blue-50 text-blue-700',
  官方确认: 'bg-slate-900 text-white'
};

const discussionPosts: DiscussionPost[] = [
  {
    id: 'discussion-zju-cs-interview',
    category: '面试经验',
    title: '浙大计算机夏令营面试，项目会被追问到什么程度？',
    school: '浙江大学',
    major: '计算机科学与技术',
    author: '匿名同学',
    time: '06/28 21:10',
    replies: 18,
    follows: 42,
    excerpt: '我今年准备投计算机方向，简历里有一段深度学习项目，但代码实现主要是跟着课题组模板改的。想请教大家面试老师会不会要求手写公式或者讲清楚每个模块的消融。',
    tags: ['夏令营', '项目复盘', '算法基础'],
    status: '持续讨论'
  },
  {
    id: 'discussion-fudan-econ-choice',
    category: 'Offer 选择',
    title: '复旦经院候补和上财已录取，该怎么排优先级？',
    school: '复旦大学',
    major: '应用经济学',
    author: '鹿友_3021',
    time: '06/28 18:35',
    replies: 24,
    follows: 57,
    excerpt: '本科财经 211，后续想读博。目前上财已经给了明确 offer，复旦经院是候补靠前。纠结要不要继续等，主要担心候补时间和导师匹配。',
    tags: ['候补', '经管', '读博规划'],
    status: '热门'
  },
  {
    id: 'discussion-cas-material',
    category: '材料准备',
    title: '中科院所的科研陈述，应该写成论文式还是项目复盘式？',
    school: '中国科学院大学',
    major: '生物信息学',
    author: '匿名同学',
    time: '06/27 22:40',
    replies: 13,
    follows: 31,
    excerpt: '材料里要求提交科研经历说明。我的项目还没有论文，只有数据清洗和模型复现实验，想知道更适合按问题-方法-结果写，还是按时间线写。',
    tags: ['科研陈述', '中科院', '材料结构'],
    status: '待补充'
  },
  {
    id: 'discussion-sjtu-contact',
    category: '套磁导师',
    title: '导师回复“欢迎报考”之后，还需要继续跟进吗？',
    school: '上海交通大学',
    major: '人工智能',
    author: 'Seekoffer 用户',
    time: '06/27 11:20',
    replies: 16,
    follows: 36,
    excerpt: '导师回复比较简短，只说欢迎报考，没有明确约面试。想知道这种情况下是否需要补发简历更新，还是等学院流程。',
    tags: ['导师联系', '邮件跟进', 'AI方向'],
    status: '已沉淀'
  }
];

const decisionThreads: DecisionThread[] = [
  {
    id: 'decision-pku-thu-ai',
    title: '清华自动化直博 vs 北大智能学院硕士，怎么选？',
    background: '本科 985，排名前 6%，有强化学习项目。想长期做科研，但也在意城市和导师资源。',
    options: [
      { id: 'thu', label: '清华自动化直博', detail: '导师方向更稳定，科研路径更明确。', votes: 61 },
      { id: 'pku', label: '北大智能学院硕士', detail: '自由度更高，后续选择空间更大。', votes: 39 }
    ],
    comments: ['如果已经明确读博，导师匹配优先级更高。', '硕士路径更适合还没完全确定研究方向的同学。'],
    tags: ['直博', '人工智能', '科研路线']
  },
  {
    id: 'decision-zju-fudan-cs',
    title: '浙大计算机已录取，复旦软院还要继续等吗？',
    background: '本科 211，专业前 8%，目标是互联网研发或工程型研究。',
    options: [
      { id: 'zju', label: '接受浙大计算机', detail: '学科平台强，确定性高。', votes: 72 },
      { id: 'fudan', label: '继续等复旦软院', detail: '城市和实习机会更贴合。', votes: 28 }
    ],
    comments: ['已有确定 offer 时，不建议为了名校差异承担太长等待风险。', '如果导师已经沟通过，可以把导师方向放到第一权重。'],
    tags: ['计算机', '城市选择', '确定性']
  }
];

const waitlistUpdates: WaitlistUpdate[] = [
  {
    id: 'waitlist-fudan-econ-1',
    school: '复旦大学',
    major: '应用经济学',
    type: '候补',
    status: '候补前排同学收到补材料邮件',
    source: '多人确认',
    time: '06/29 10:20',
    detail: '目前看到 2 位同学反馈收到补充材料提醒，尚未等同于正式补录。'
  },
  {
    id: 'waitlist-nju-business-1',
    school: '南京大学',
    major: '工商管理',
    type: '放弃',
    status: '一位同学已放弃预推免资格',
    source: '本人反馈',
    time: '06/28 19:45',
    detail: '放弃原因是已确认另一所学校导师与方向，后续候补推进以学院通知为准。'
  },
  {
    id: 'waitlist-sjtu-ai-1',
    school: '上海交通大学',
    major: '人工智能',
    type: '官方确认',
    status: '学院提醒候补名单以邮件通知为准',
    source: '官方确认',
    time: '06/27 16:10',
    detail: '建议候补同学保持邮箱、电话畅通，不要只依赖群消息。'
  },
  {
    id: 'waitlist-ucas-bio-1',
    school: '中国科学院大学',
    major: '生物信息学',
    type: '补录传闻',
    status: '有同学反馈导师组仍在确认名额',
    source: '本人反馈',
    time: '06/26 22:05',
    detail: '当前仅适合做观察信号，最终仍需等待学院或导师组正式回复。'
  }
];

export default function OffersPage() {
  const { session } = useUserSessionState();
  const [keyword, setKeyword] = useState('');
  const [offerTab, setOfferTab] = useState<(typeof offerTabs)[number]>('全部');
  const [hubTab, setHubTab] = useState<HubTab>('offers');
  const [discussionCategory, setDiscussionCategory] = useState<DiscussionCategory>('全部');
  const [offers, setOffers] = useState<PublicOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('正在整理近期公开动态...');
  const [reportingId, setReportingId] = useState<string | null>(null);
  const [followedDiscussionIds, setFollowedDiscussionIds] = useState<string[]>([]);
  const [decisionVotes, setDecisionVotes] = useState<Record<string, string>>({});
  const [pinnedItem, setPinnedItem] = useState<PinnedItem | null>(null);
  const [replyDraft, setReplyDraft] = useState('');
  const [localReplies, setLocalReplies] = useState<Record<string, string[]>>({});

  useEffect(() => {
    void loadOffers();
  }, []);

  async function loadOffers() {
    setLoading(true);
    setMessage('正在更新公开动态...');

    try {
      const data = await fetchPublicOffers();
      setOffers(data);
      setMessage(data.length ? `已更新 ${data.length} 条公开动态。` : '当前展示近期精选投稿，新动态核验通过后会自动更新。');
    } catch {
      setOffers([]);
      setMessage('当前展示近期精选投稿，新动态核验通过后会自动更新。');
    } finally {
      setLoading(false);
    }
  }

  const displayOffers = offers.length ? offers : curatedOfferSamples;

  const filteredOffers = useMemo(() => {
    const query = keyword.trim().toLowerCase();

    return displayOffers.filter((item) => {
      const matchesQuery = query
        ? [item.authorName, item.schoolName, item.major, item.projectType, item.result, item.undergraduateBackground, item.content]
            .join(' ')
            .toLowerCase()
            .includes(query)
        : true;
      const matchesTab = offerTab === '全部' ? true : item.result === offerTab;

      return matchesQuery && matchesTab;
    });
  }, [keyword, displayOffers, offerTab]);

  const filteredDiscussions = useMemo(() => {
    const query = keyword.trim().toLowerCase();

    return discussionPosts.filter((item) => {
      const matchesCategory = discussionCategory === '全部' ? true : item.category === discussionCategory;
      const matchesQuery = query
        ? [item.title, item.school, item.major, item.excerpt, item.tags.join(' '), item.category].join(' ').toLowerCase().includes(query)
        : true;

      return matchesCategory && matchesQuery;
    });
  }, [discussionCategory, keyword]);

  const filteredWaitlistUpdates = useMemo(() => {
    const query = keyword.trim().toLowerCase();
    if (!query) {
      return waitlistUpdates;
    }

    return waitlistUpdates.filter((item) =>
      [item.school, item.major, item.type, item.status, item.detail, item.source].join(' ').toLowerCase().includes(query)
    );
  }, [keyword]);

  const filteredDecisionThreads = useMemo(() => {
    const query = keyword.trim().toLowerCase();
    if (!query) {
      return decisionThreads;
    }

    return decisionThreads.filter((item) =>
      [
        item.title,
        item.background,
        item.tags.join(' '),
        item.options.map((option) => `${option.label} ${option.detail}`).join(' '),
        item.comments.join(' ')
      ]
        .join(' ')
        .toLowerCase()
        .includes(query)
    );
  }, [keyword]);

  const pinnedDetail = useMemo<PinnedDetail | null>(() => {
    if (!pinnedItem) {
      return null;
    }

    if (pinnedItem.kind === 'offer') {
      const offer = displayOffers.find((item) => item.id === pinnedItem.id);
      return offer ? { kind: 'offer', offer } : null;
    }

    if (pinnedItem.kind === 'discussion') {
      const post = discussionPosts.find((item) => item.id === pinnedItem.id);
      return post ? { kind: 'discussion', post } : null;
    }

    if (pinnedItem.kind === 'decision') {
      const thread = decisionThreads.find((item) => item.id === pinnedItem.id);
      return thread ? { kind: 'decision', thread } : null;
    }

    const update = waitlistUpdates.find((item) => item.id === pinnedItem.id);
    return update ? { kind: 'waitlist', update } : null;
  }, [displayOffers, pinnedItem]);

  const hotSchools = useMemo(() => {
    const counter = new Map<string, number>();

    displayOffers.forEach((item) => {
      if (item.schoolName) counter.set(item.schoolName, (counter.get(item.schoolName) || 0) + 1);
    });
    discussionPosts.forEach((item) => counter.set(item.school, (counter.get(item.school) || 0) + 1));
    waitlistUpdates.forEach((item) => counter.set(item.school, (counter.get(item.school) || 0) + 1));

    return Array.from(counter.entries())
      .map(([school, count]) => ({ school, count }))
      .sort((left, right) => right.count - left.count)
      .slice(0, 6);
  }, [displayOffers]);

  const hotKeywords = useMemo(() => {
    const words = new Set<string>();

    displayOffers.slice(0, 20).forEach((item) => {
      if (item.schoolName) words.add(item.schoolName);
      if (item.major) words.add(item.major);
      if (item.projectType) words.add(item.projectType);
    });
    discussionPosts.slice(0, 6).forEach((item) => item.tags.forEach((tag) => words.add(tag)));

    return Array.from(words).slice(0, 10);
  }, [displayOffers]);

  const metrics = useMemo(() => {
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const recentCount = displayOffers.filter((item) => new Date(item.createdAt).getTime() >= weekAgo).length;
    const schoolCount = new Set([...displayOffers.map((item) => item.schoolName), ...discussionPosts.map((item) => item.school)]).size;

    return [
      { label: '公开动态', value: String(displayOffers.length), hint: '录取、放弃、候补', icon: FileText },
      { label: '近 7 天', value: String(recentCount), hint: '新增交流', icon: Flame },
      { label: '社区讨论', value: String(discussionPosts.length), hint: '选校、材料、面试', icon: MessageCircle },
      { label: '覆盖院校', value: String(schoolCount), hint: '按学校聚合', icon: University }
    ];
  }, [displayOffers]);

  async function handleReport(offer: PublicOffer) {
    const reason = window.prompt('请说明举报原因，例如：疑似虚假、泄露隐私、联系方式引流或内容误导。');
    if (!reason) {
      return;
    }

    setReportingId(offer.id);
    setMessage('正在提交举报...');

    try {
      await reportOfferPost(offer.id, reason, session?.userId);
      setMessage('举报已提交，我们会优先核查这条动态。');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '反馈入口暂时不可用，请稍后重试。');
    } finally {
      setReportingId(null);
    }
  }

  function openSchoolDiscussion(school: string) {
    setKeyword(school);
    setDiscussionCategory('全部');
    setHubTab('discussions');
  }

  function toggleFollowDiscussion(id: string) {
    setFollowedDiscussionIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  function voteDecision(threadId: string, optionId: string) {
    setDecisionVotes((current) => ({ ...current, [threadId]: optionId }));
  }

  function openPinnedItem(item: PinnedItem) {
    setPinnedItem(item);
    setReplyDraft('');
    setMessage('已打开详情，可在下方继续补充信息或追问。');
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        document.getElementById('offer-pinned-detail')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
  }

  function submitPinnedReply() {
    if (!pinnedDetail) {
      return;
    }

    const text = replyDraft.trim();
    if (!text) {
      return;
    }

    const key = getPinnedDetailKey(pinnedDetail);
    setLocalReplies((current) => ({ ...current, [key]: [...(current[key] || []), text] }));
    setReplyDraft('');
    setMessage('回复已添加到当前讨论，可继续补充关键背景或追问。');
  }

  return (
    <SiteShell>
      <section className="page-hero grid gap-6 px-6 py-7 lg:grid-cols-[minmax(0,1fr)_520px] lg:items-center lg:px-8">
        <div>
          <h1 className="text-4xl font-semibold tracking-tight text-ink md:text-5xl">Offer 圈</h1>
          <p className="mt-4 max-w-3xl text-base leading-8 text-slate-600">把录取、候补、放弃和申请讨论放在一个低噪音社区里，减少猜测，帮助你判断真实去向。</p>
        </div>
        <div className="mx-auto grid w-full max-w-[520px] grid-cols-1 gap-3 sm:grid-cols-3 lg:mx-0 lg:justify-self-center">
          {metrics.slice(0, 3).map((item) => {
            const Icon = item.icon || TrendingUp;

            return (
              <div key={item.label} className="soft-stat-pill rounded-[28px] px-4 py-4">
                <div className="flex items-center justify-center gap-3 text-center">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-brand/8 text-brand">
                    <Icon className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <div className="whitespace-nowrap text-xs text-slate-500">{item.label}</div>
                    <div className="whitespace-nowrap text-xl font-semibold text-ink">{item.value}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="product-card rounded-[30px] p-5 lg:p-6">
          <div className="flex flex-wrap gap-2 border-b border-slate-100 pb-5">
            {hubTabs.map((item) => {
              const Icon = item.icon;
              const active = hubTab === item.id;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setHubTab(item.id)}
                  className={`inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold transition ${
                    active ? 'bg-brand text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-brand/8 hover:text-brand'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </button>
              );
            })}
          </div>

          <div className="mt-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <Search className="h-4 w-4 text-slate-400" />
              <input
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                placeholder="搜索学校、专业或关键词"
                className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void loadOffers()}
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-2 text-xs font-semibold text-slate-500 ring-1 ring-slate-200 transition hover:text-brand disabled:cursor-not-allowed disabled:opacity-60"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
                刷新动态
              </button>
              {keyword ? (
                <button
                  type="button"
                  onClick={() => setKeyword('')}
                  className="rounded-full bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-500 transition hover:text-brand"
                >
                  清空搜索
                </button>
              ) : null}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {hotKeywords.slice(0, 6).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setKeyword(item)}
                className="rounded-full bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-brand/8 hover:text-brand"
              >
                {item}
              </button>
            ))}
          </div>

          <div className="mt-4 rounded-2xl bg-brand/5 px-4 py-3 text-sm font-medium leading-7 text-slate-600">{message}</div>

          {pinnedDetail ? (
            <PinnedDetail
              detail={pinnedDetail}
              replies={localReplies[getPinnedDetailKey(pinnedDetail)] || []}
              replyDraft={replyDraft}
              decisionVotes={decisionVotes}
              followedIds={followedDiscussionIds}
              reportingId={reportingId}
              onReplyDraftChange={setReplyDraft}
              onSubmitReply={submitPinnedReply}
              onClose={() => setPinnedItem(null)}
              onReport={handleReport}
              onDiscuss={openSchoolDiscussion}
              onFollow={toggleFollowDiscussion}
              onVote={voteDecision}
            />
          ) : (
            <div
              id="offer-pinned-detail"
              className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-dashed border-brand/20 bg-brand/5 px-4 py-3 text-sm text-slate-600"
            >
              <span className="inline-flex items-center gap-2 font-semibold text-brand">
                <Pin className="h-4 w-4" />
                点击动态可展开详情并继续交流。
              </span>
            </div>
          )}

          {hubTab === 'offers' ? (
            <OfferFeed
              offers={filteredOffers}
              loading={loading}
              activeTab={offerTab}
              onTabChange={setOfferTab}
              reportingId={reportingId}
              onReport={handleReport}
              onDiscuss={openSchoolDiscussion}
              onOpen={(offer) => openPinnedItem({ kind: 'offer', id: offer.id })}
            />
          ) : null}

          {hubTab === 'discussions' ? (
            <DiscussionBoard
              posts={filteredDiscussions}
              category={discussionCategory}
              followedIds={followedDiscussionIds}
              onCategoryChange={setDiscussionCategory}
              onFollow={toggleFollowDiscussion}
              onOpen={(post) => openPinnedItem({ kind: 'discussion', id: post.id })}
            />
          ) : null}

          {hubTab === 'decisions' ? (
            <DecisionBoard
              threads={filteredDecisionThreads}
              votes={decisionVotes}
              onVote={voteDecision}
              onOpen={(thread) => openPinnedItem({ kind: 'decision', id: thread.id })}
            />
          ) : null}

          {hubTab === 'waitlist' ? <WaitlistBoard updates={filteredWaitlistUpdates} onOpen={(update) => openPinnedItem({ kind: 'waitlist', id: update.id })} /> : null}
        </div>

        <aside className="grid content-start gap-5">
          <div className="product-card rounded-[22px] p-6">
            <div className="mb-5 flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-ink">热门院校</h2>
              <Link href="/colleges" className="text-sm font-semibold text-slate-500 hover:text-brand">
                更多
              </Link>
            </div>
            <div className="grid gap-4">
              {hotSchools.map((item, index) => (
                <button key={item.school} type="button" onClick={() => setKeyword(item.school)} className="flex items-center justify-between gap-4 text-left text-sm">
                  <span className="flex min-w-0 items-center gap-3">
                    <span className="w-4 text-slate-400">{index + 1}</span>
                    <span className="truncate font-semibold text-slate-700">{item.school}</span>
                  </span>
                  <span className="text-slate-500">{item.count}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="product-card rounded-[22px] p-6">
            <h2 className="text-lg font-semibold text-ink">本周热议</h2>
            <div className="mt-5 grid gap-4">
              {discussionPosts.slice(0, 4).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setHubTab('discussions');
                    setKeyword('');
                    setDiscussionCategory('全部');
                    openPinnedItem({ kind: 'discussion', id: item.id });
                  }}
                  className="rounded-2xl bg-slate-50 px-4 py-3 text-left transition hover:bg-brand/8"
                >
                  <div className="text-xs font-semibold text-brand">{item.category}</div>
                  <div className="mt-1 line-clamp-2 text-sm font-semibold leading-6 text-ink">{item.title}</div>
                  <div className="mt-2 text-xs text-slate-500">{item.replies} 条回复 · {item.follows} 人关注</div>
                </button>
              ))}
            </div>
          </div>

          <div className="product-card rounded-[22px] p-6">
            <h2 className="text-lg font-semibold text-ink">交流守则</h2>
            <div className="mt-5 grid gap-4">
              {[
                ['真实', '优先分享本人经历和可复盘线索。'],
                ['克制', '不公开联系方式和导师私人信息。'],
                ['纠错', '发现误导内容可以直接举报。']
              ].map(([title, text]) => (
                <div key={title} className="flex gap-3">
                  <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand/8 text-brand">
                    <ShieldCheck className="h-4 w-4" />
                  </span>
                  <div>
                    <div className="text-sm font-semibold text-ink">{title}</div>
                    <p className="mt-1 text-sm leading-6 text-slate-500">{text}</p>
                  </div>
                </div>
              ))}
            </div>
            <Link href="/community" className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-brand">
              查看完整社区规范
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </aside>
      </section>
    </SiteShell>
  );
}

function PinnedDetail({
  detail,
  replies,
  replyDraft,
  decisionVotes,
  followedIds,
  reportingId,
  onReplyDraftChange,
  onSubmitReply,
  onClose,
  onReport,
  onDiscuss,
  onFollow,
  onVote
}: {
  detail: PinnedDetail;
  replies: string[];
  replyDraft: string;
  decisionVotes: Record<string, string>;
  followedIds: string[];
  reportingId: string | null;
  onReplyDraftChange: (value: string) => void;
  onSubmitReply: () => void;
  onClose: () => void;
  onReport: (offer: PublicOffer) => void;
  onDiscuss: (school: string) => void;
  onFollow: (id: string) => void;
  onVote: (threadId: string, optionId: string) => void;
}) {
  const title = getPinnedDetailTitle(detail);
  const meta = getPinnedDetailMeta(detail);
  const seededReplies = getPinnedConversation(detail);
  const isDiscussionFollowed = detail.kind === 'discussion' && followedIds.includes(detail.post.id);

  return (
    <section id="offer-pinned-detail" className="mt-5 overflow-hidden rounded-[26px] border border-brand/15 bg-white shadow-soft">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-brand/5 px-5 py-4">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-brand ring-1 ring-brand/10">
            <Pin className="h-3.5 w-3.5" />
            置顶详情
          </div>
          <h2 className="mt-3 text-2xl font-semibold leading-8 text-ink">{title}</h2>
          <p className="mt-1 text-sm leading-6 text-slate-500">{meta}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400 transition hover:border-brand/20 hover:text-brand"
          aria-label="关闭置顶详情"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="grid gap-5 p-5">
        {detail.kind === 'offer' ? (
          <div className="grid gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${resultTone[detail.offer.result]}`}>{detail.offer.result}</span>
              <span className="rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-semibold text-slate-600">{detail.offer.projectType}</span>
              <span className="rounded-lg bg-emerald-50 px-3 py-1.5 text-sm font-semibold text-brand">
                {detail.offer.sourceLabel || '已核验'}
              </span>
            </div>
            <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm leading-7 text-slate-600">
              <span className="font-semibold text-slate-700">本科背景：</span>
              {detail.offer.undergraduateBackground}
            </div>
            <p className="whitespace-pre-wrap text-sm leading-7 text-slate-600">{detail.offer.content}</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => onDiscuss(detail.offer.schoolName)}
                className="inline-flex items-center gap-2 rounded-xl border border-brand/15 px-4 py-2 text-xs font-semibold text-brand transition hover:border-brand/30 hover:bg-brand/5"
              >
                <MessageCircle className="h-4 w-4" />
                看同校讨论
              </button>
              <button
                type="button"
                onClick={() => onReport(detail.offer)}
                disabled={reportingId === detail.offer.id}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-500 transition hover:border-rose-200 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {reportingId === detail.offer.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Flag className="h-4 w-4" />}
                举报纠错
              </button>
            </div>
          </div>
        ) : null}

        {detail.kind === 'discussion' ? (
          <div className="grid gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-brand/8 px-3 py-1.5 text-xs font-semibold text-brand">{detail.post.category}</span>
              <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600">{detail.post.status}</span>
              <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-500">{detail.post.replies} 回复</span>
              <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-500">
                {detail.post.follows + (isDiscussionFollowed ? 1 : 0)} 关注
              </span>
            </div>
            <p className="text-sm leading-7 text-slate-600">{detail.post.excerpt}</p>
            <div className="flex flex-wrap gap-2">
              {detail.post.tags.map((tag) => (
                <span key={tag} className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-500">{tag}</span>
              ))}
            </div>
            <button
              type="button"
              onClick={() => onFollow(detail.post.id)}
              className={`w-fit inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition ${
                isDiscussionFollowed ? 'bg-brand text-white' : 'border border-brand/15 text-brand hover:border-brand/30 hover:bg-brand/5'
              }`}
            >
              <Heart className="h-4 w-4" />
              {isDiscussionFollowed ? '已关注这个讨论' : '关注这个讨论'}
            </button>
          </div>
        ) : null}

        {detail.kind === 'decision' ? (
          <DecisionDetail thread={detail.thread} votes={decisionVotes} onVote={onVote} />
        ) : null}

        {detail.kind === 'waitlist' ? (
          <div className="grid gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full px-3 py-1.5 text-xs font-semibold ${resultTone[detail.update.type]}`}>{detail.update.type}</span>
              <span className={`rounded-full px-3 py-1.5 text-xs font-semibold ${sourceTone[detail.update.source]}`}>{detail.update.source}</span>
              <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-500">{detail.update.time}</span>
            </div>
            <p className="text-sm leading-7 text-slate-600">{detail.update.detail}</p>
            <button
              type="button"
              onClick={() => onDiscuss(detail.update.school)}
              className="w-fit inline-flex items-center gap-2 rounded-xl border border-brand/15 px-4 py-2 text-xs font-semibold text-brand transition hover:border-brand/30 hover:bg-brand/5"
            >
              <MessageCircle className="h-4 w-4" />
              看同校讨论
            </button>
          </div>
        ) : null}

        <div className="rounded-2xl bg-slate-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-ink">交流区</h3>
              <p className="mt-1 text-xs leading-5 text-slate-500">适合补充时间线、导师反馈、材料要求或继续追问。请不要发布个人隐私。</p>
            </div>
            <Link href="/publish" className="inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-xs font-semibold text-brand ring-1 ring-brand/10">
              发布新动态
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="mt-4 grid gap-3">
            {seededReplies.map((item) => (
              <div key={`${item.author}-${item.text}`} className="rounded-2xl bg-white px-4 py-3 ring-1 ring-slate-100">
                <div className="text-xs font-semibold text-brand">{item.author}</div>
                <p className="mt-1 text-sm leading-6 text-slate-600">{item.text}</p>
              </div>
            ))}
            {replies.map((item, index) => (
              <div key={`${item}-${index}`} className="rounded-2xl border border-brand/10 bg-white px-4 py-3">
                <div className="text-xs font-semibold text-brand">我的补充</div>
                <p className="mt-1 text-sm leading-6 text-slate-600">{item}</p>
              </div>
            ))}
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
            <textarea
              value={replyDraft}
              onChange={(event) => onReplyDraftChange(event.target.value)}
              rows={3}
              placeholder="写下补充信息、提问或经验，例如：这个学院材料截止前还会发确认邮件吗？"
              className="min-h-24 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 outline-none transition placeholder:text-slate-400 focus:border-brand/40 focus:ring-4 focus:ring-brand/10"
            />
            <button
              type="button"
              onClick={onSubmitReply}
              disabled={!replyDraft.trim()}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-brand px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-deep disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
            >
              <Send className="h-4 w-4" />
              发布回复
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function DecisionDetail({
  thread,
  votes,
  onVote
}: {
  thread: DecisionThread;
  votes: Record<string, string>;
  onVote: (threadId: string, optionId: string) => void;
}) {
  const votedOption = votes[thread.id];
  const totalVotes = thread.options.reduce((sum, option) => sum + option.votes + (votedOption === option.id ? 1 : 0), 0);

  return (
    <div className="grid gap-4">
      <p className="text-sm leading-7 text-slate-600">{thread.background}</p>
      <div className="grid gap-3">
        {thread.options.map((option) => {
          const selected = votedOption === option.id;
          const votesWithSelection = option.votes + (selected ? 1 : 0);
          const width = `${Math.round((votesWithSelection / Math.max(totalVotes, 1)) * 100)}%`;

          return (
            <button
              key={option.id}
              type="button"
              onClick={() => onVote(thread.id, option.id)}
              className={`relative overflow-hidden rounded-2xl border px-4 py-3 text-left transition ${
                selected ? 'border-brand/30 bg-brand/5' : 'border-slate-100 bg-slate-50 hover:border-brand/20'
              }`}
            >
              <span className="absolute inset-y-0 left-0 bg-brand/10" style={{ width }} />
              <span className="relative flex flex-wrap items-center justify-between gap-3">
                <span>
                  <span className="block text-sm font-semibold text-ink">{option.label}</span>
                  <span className="mt-1 block text-xs leading-5 text-slate-500">{option.detail}</span>
                </span>
                <span className="text-sm font-semibold text-brand">{width}</span>
              </span>
            </button>
          );
        })}
      </div>
      <div className="grid gap-2 rounded-2xl bg-white p-4 ring-1 ring-slate-100">
        {thread.comments.map((comment) => (
          <div key={comment} className="flex gap-2 text-sm leading-6 text-slate-600">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
            <span>{comment}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function getPinnedDetailKey(detail: PinnedDetail) {
  if (detail.kind === 'offer') return `offer:${detail.offer.id}`;
  if (detail.kind === 'discussion') return `discussion:${detail.post.id}`;
  if (detail.kind === 'decision') return `decision:${detail.thread.id}`;
  return `waitlist:${detail.update.id}`;
}

function getPinnedDetailTitle(detail: PinnedDetail) {
  if (detail.kind === 'offer') return `${detail.offer.schoolName} · ${detail.offer.major}`;
  if (detail.kind === 'discussion') return detail.post.title;
  if (detail.kind === 'decision') return detail.thread.title;
  return detail.update.status;
}

function getPinnedDetailMeta(detail: PinnedDetail) {
  if (detail.kind === 'offer') {
    return `${getOfferAuthorLabel(detail.offer)} · ${detail.offer.projectType} · ${formatOfferTime(detail.offer.createdAt)}`;
  }

  if (detail.kind === 'discussion') {
    return `${detail.post.school} · ${detail.post.major} · ${detail.post.author} · ${detail.post.time}`;
  }

  if (detail.kind === 'decision') {
    return `Offer 选择 · ${detail.thread.tags.join(' · ')}`;
  }

  return `${detail.update.school} · ${detail.update.major} · ${detail.update.time}`;
}

function getPinnedConversation(detail: PinnedDetail) {
  if (detail.kind === 'offer') {
    return [
      { author: '同校同学', text: '建议补充学院流程、材料节点和导师沟通情况，后来者会更容易判断这条去向的参考价值。' },
      { author: 'Seekoffer 提醒', text: '录取、候补和放弃信息都可能随学院流程变化，重要决策仍以院校正式通知为准。' }
    ];
  }

  if (detail.kind === 'discussion') {
    return [
      { author: '匿名同学', text: '如果能补充本科背景、目标导师方向和当前材料进度，大家给建议会更具体。' },
      { author: 'Seekoffer 提醒', text: '讨论导师或面试时请尽量描述流程和准备方法，不公开导师私人联系方式。' }
    ];
  }

  if (detail.kind === 'decision') {
    return [
      { author: '同方向同学', text: '建议先把导师匹配、项目确定性、城市机会和读博意愿分别打分，再看哪个选项风险更低。' },
      { author: 'Seekoffer 提醒', text: '多 Offer 选择里，确定性通常比单纯名气更重要，尤其要注意候补等待时间。' }
    ];
  }

  return [
    { author: '候补同学', text: '可以继续补充是否收到邮件、电话或导师组确认，帮助同一批候补同学判断进度。' },
    { author: 'Seekoffer 提醒', text: '候补、补录和放弃信息适合作为观察信号，最终仍需等待学院或导师组正式回复。' }
  ];
}

function OfferFeed({
  offers,
  loading,
  activeTab,
  onTabChange,
  reportingId,
  onReport,
  onDiscuss,
  onOpen
}: {
  offers: PublicOffer[];
  loading: boolean;
  activeTab: (typeof offerTabs)[number];
  onTabChange: (value: (typeof offerTabs)[number]) => void;
  reportingId: string | null;
  onReport: (offer: PublicOffer) => void;
  onDiscuss: (school: string) => void;
  onOpen: (offer: PublicOffer) => void;
}) {
  return (
    <section className="mt-5">
      <div className="flex flex-wrap gap-2">
        {offerTabs.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => onTabChange(item)}
            className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
              activeTab === item ? 'bg-brand text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            {item}
          </button>
        ))}
      </div>

      <div className="mt-5 grid gap-4">
        {loading ? <OfferListSkeleton /> : null}

        {!loading &&
          offers.map((offer) => (
            <OfferCard key={offer.id} offer={offer} reportingId={reportingId} onReport={onReport} onDiscuss={onDiscuss} onOpen={onOpen} />
          ))}

        {!loading && !offers.length ? (
          <div className="rounded-[20px] border border-dashed border-slate-200 px-6 py-12 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand/8 text-brand">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <h2 className="mt-4 text-lg font-semibold text-ink">暂无匹配的 Offer 动态</h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-7 text-slate-500">
              你可以换个关键词，或者发布一条真实动态。通过核验后会展示在这里。
            </p>
            <Link href="/publish" className="mt-5 inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-3 text-sm font-semibold text-white">
              去发布
              <Edit3 className="h-4 w-4" />
            </Link>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function DiscussionBoard({
  posts,
  category,
  followedIds,
  onCategoryChange,
  onFollow,
  onOpen
}: {
  posts: DiscussionPost[];
  category: DiscussionCategory;
  followedIds: string[];
  onCategoryChange: (value: DiscussionCategory) => void;
  onFollow: (id: string) => void;
  onOpen: (post: DiscussionPost) => void;
}) {
  return (
    <section className="mt-5">
      <div className="flex flex-wrap gap-2">
        {discussionCategories.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => onCategoryChange(item)}
            className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
              category === item ? 'bg-brand text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            {item}
          </button>
        ))}
      </div>

      <div className="mt-5 grid gap-4">
        {posts.map((post) => {
          const followed = followedIds.includes(post.id);

          return (
            <article key={post.id} className="rounded-[24px] border border-slate-100 bg-white p-5 transition hover:-translate-y-0.5 hover:border-brand/15 hover:shadow-soft">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-brand/8 px-2.5 py-1 text-xs font-semibold text-brand">{post.category}</span>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">{post.status}</span>
                    <span className="text-xs font-semibold text-slate-400">{post.time}</span>
                  </div>
                  <h3 className="mt-3 text-lg font-semibold leading-7 text-ink">{post.title}</h3>
                  <div className="mt-2 text-sm text-slate-500">{post.school} · {post.major} · {post.author}</div>
                </div>
                <button
                  type="button"
                  onClick={() => onFollow(post.id)}
                  className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition ${
                    followed ? 'bg-brand text-white' : 'border border-slate-200 bg-white text-slate-500 hover:border-brand/20 hover:text-brand'
                  }`}
                >
                  <Heart className="h-4 w-4" />
                  {followed ? '已关注' : '关注'}
                </button>
              </div>
              <p className="mt-4 text-sm leading-7 text-slate-600">{post.excerpt}</p>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap gap-2">
                  {post.tags.map((tag) => (
                    <span key={tag} className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-500">{tag}</span>
                  ))}
                </div>
                <div className="flex items-center gap-4 text-xs font-semibold text-slate-500">
                  <span>{post.replies} 回复</span>
                  <span>{post.follows + (followed ? 1 : 0)} 关注</span>
                  <button type="button" onClick={() => onOpen(post)} className="inline-flex items-center gap-1 text-brand hover:text-brand-deep">
                    打开讨论
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </article>
          );
        })}

        {!posts.length ? (
          <div className="rounded-[20px] border border-dashed border-slate-200 px-6 py-12 text-center">
            <h2 className="text-lg font-semibold text-ink">当前条件下暂无讨论</h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-7 text-slate-500">可以切换分类或清空搜索，再回到同校同专业讨论里找线索。</p>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function DecisionBoard({
  threads,
  votes,
  onVote,
  onOpen
}: {
  threads: DecisionThread[];
  votes: Record<string, string>;
  onVote: (threadId: string, optionId: string) => void;
  onOpen: (thread: DecisionThread) => void;
}) {
  return (
    <section className="mt-5 grid gap-4">
      {threads.map((thread) => {
        const votedOption = votes[thread.id];
        const totalVotes = thread.options.reduce((sum, option) => sum + option.votes + (votedOption === option.id ? 1 : 0), 0);

        return (
          <article key={thread.id} className="rounded-[24px] border border-slate-100 bg-white p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full bg-brand/8 px-3 py-1.5 text-xs font-semibold text-brand">
                  <Sparkles className="h-3.5 w-3.5" />
                  Offer 选择题
                </div>
                <h3 className="mt-3 text-xl font-semibold leading-8 text-ink">{thread.title}</h3>
                <p className="mt-2 text-sm leading-7 text-slate-500">{thread.background}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 px-4 py-3 text-center">
                <div className="text-2xl font-semibold text-ink">{totalVotes}</div>
                <div className="text-xs font-semibold text-slate-400">参与投票</div>
              </div>
            </div>

            <div className="mt-5 grid gap-3">
              {thread.options.map((option) => {
                const selected = votedOption === option.id;
                const votesWithSelection = option.votes + (selected ? 1 : 0);
                const width = `${Math.round((votesWithSelection / Math.max(totalVotes, 1)) * 100)}%`;

                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => onVote(thread.id, option.id)}
                    className={`relative overflow-hidden rounded-2xl border px-4 py-3 text-left transition ${
                      selected ? 'border-brand/30 bg-brand/5' : 'border-slate-100 bg-slate-50 hover:border-brand/20'
                    }`}
                  >
                    <span className="absolute inset-y-0 left-0 bg-brand/10" style={{ width }} />
                    <span className="relative flex flex-wrap items-center justify-between gap-3">
                      <span>
                        <span className="block text-sm font-semibold text-ink">{option.label}</span>
                        <span className="mt-1 block text-xs leading-5 text-slate-500">{option.detail}</span>
                      </span>
                      <span className="text-sm font-semibold text-brand">{width}</span>
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="mt-5 grid gap-2 rounded-2xl bg-white p-4 ring-1 ring-slate-100">
              {thread.comments.map((comment) => (
                <div key={comment} className="flex gap-2 text-sm leading-6 text-slate-600">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
                  <span>{comment}</span>
                </div>
              ))}
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {thread.tags.map((tag) => (
                <span key={tag} className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-500">{tag}</span>
              ))}
            </div>

            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => onOpen(thread)}
                className="inline-flex items-center gap-2 rounded-xl border border-brand/15 px-4 py-2 text-xs font-semibold text-brand transition hover:border-brand/30 hover:bg-brand/5"
              >
                打开选择题
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </article>
        );
      })}

      {!threads.length ? (
        <div className="rounded-[20px] border border-dashed border-slate-200 px-6 py-12 text-center">
          <h2 className="text-lg font-semibold text-ink">暂无匹配的 Offer 选择题</h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-7 text-slate-500">可以换一个院校、专业或方向关键词继续查找。</p>
        </div>
      ) : null}
    </section>
  );
}

function WaitlistBoard({ updates, onOpen }: { updates: WaitlistUpdate[]; onOpen: (update: WaitlistUpdate) => void }) {
  return (
    <section className="mt-5 grid gap-4">
      {updates.map((item) => (
        <article key={item.id} className="rounded-[24px] border border-slate-100 bg-white p-5 transition hover:-translate-y-0.5 hover:border-brand/15 hover:shadow-soft">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-3 py-1.5 text-xs font-semibold ${resultTone[item.type]}`}>{item.type}</span>
                <span className={`rounded-full px-3 py-1.5 text-xs font-semibold ${sourceTone[item.source]}`}>{item.source}</span>
              </div>
              <h3 className="mt-3 text-lg font-semibold leading-7 text-ink">{item.status}</h3>
              <div className="mt-2 text-sm text-slate-500">{item.school} · {item.major}</div>
            </div>
            <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-500">{item.time}</div>
          </div>
          <p className="mt-4 text-sm leading-7 text-slate-600">{item.detail}</p>
          <div className="mt-5 flex justify-end">
            <button
              type="button"
              onClick={() => onOpen(item)}
              className="inline-flex items-center gap-2 rounded-xl border border-brand/15 px-4 py-2 text-xs font-semibold text-brand transition hover:border-brand/30 hover:bg-brand/5"
            >
              打开动态
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </article>
      ))}

      {!updates.length ? (
        <div className="rounded-[20px] border border-dashed border-slate-200 px-6 py-12 text-center">
          <h2 className="text-lg font-semibold text-ink">暂无匹配的候补动态</h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-7 text-slate-500">可以换一个学校或专业关键词查看。</p>
        </div>
      ) : null}
    </section>
  );
}

function OfferCard({
  offer,
  reportingId,
  onReport,
  onDiscuss,
  onOpen
}: {
  offer: PublicOffer;
  reportingId: string | null;
  onReport: (offer: PublicOffer) => void;
  onDiscuss: (school: string) => void;
  onOpen: (offer: PublicOffer) => void;
}) {
  const authorLabel = getOfferAuthorLabel(offer);
  const sourceLabel = offer.sourceLabel || '已核验';

  return (
    <article className="relative overflow-hidden rounded-[24px] border border-slate-100 bg-white p-5 transition hover:-translate-y-0.5 hover:border-brand/15 hover:shadow-soft">
      <div className="flex items-start gap-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-brand text-base font-semibold text-white">
          {getOfferAvatar(authorLabel)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-semibold text-ink">{authorLabel}</span>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-brand">
                  <BadgeCheck className="h-3.5 w-3.5" />
                  {sourceLabel}
                </span>
              </div>
              <div className="mt-1 text-sm text-slate-500">
                {formatOfferTime(offer.createdAt)} · {offer.projectType}
              </div>
            </div>
            <button
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-400 transition hover:border-rose-200 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={reportingId === offer.id}
              onClick={() => onReport(offer)}
              aria-label="举报这条动态"
            >
              {reportingId === offer.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Flag className="h-4 w-4" />}
            </button>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <span className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${resultTone[offer.result]}`}>
              {offer.result}
            </span>
            <h3 className="text-lg font-semibold leading-7 text-ink">{offer.schoolName}</h3>
            <span className="text-sm font-medium text-slate-500">{offer.major}</span>
          </div>

          <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm leading-7 text-slate-600">
            <span className="font-semibold text-slate-700">本科背景：</span>
            {offer.undergraduateBackground}
          </div>

          <p className="mt-4 line-clamp-3 whitespace-pre-wrap text-sm leading-7 text-slate-600">{offer.content}</p>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-4 border-t border-slate-100 pt-4 text-sm text-slate-500">
            <button type="button" onClick={() => onOpen(offer)} className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand hover:text-brand-deep">
              查看详情
              <ArrowRight className="h-4 w-4" />
            </button>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => onOpen(offer)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-4 py-2 text-xs font-semibold text-white transition hover:bg-brand-deep"
              >
                <Pin className="h-4 w-4" />
                置顶
              </button>
              <button
                type="button"
                onClick={() => onDiscuss(offer.schoolName)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-brand transition hover:border-brand/25"
              >
                <MessageCircle className="h-4 w-4" />
                同校讨论
              </button>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

function OfferListSkeleton() {
  return (
    <>
      {[0, 1, 2].map((item) => (
        <div key={item} className="rounded-[24px] border border-slate-100 bg-white p-5">
          <div className="flex gap-4">
            <div className="h-14 w-14 rounded-full bg-slate-100" />
            <div className="flex-1 space-y-4">
              <div className="h-4 w-48 rounded bg-slate-100" />
              <div className="h-8 w-64 rounded bg-slate-100" />
              <div className="h-16 rounded-xl bg-slate-100" />
            </div>
          </div>
        </div>
      ))}
    </>
  );
}
