'use client';

import {
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  MessageCircle,
  Search,
  X
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  GuideTopicContent,
  SupportDrawer,
  commonQuestions,
  featuredGuideIds,
  guideNavigation,
  type GuideNavItem,
  type GuideSectionId
} from './desktop-guide';

export default function DesktopHelpCenter() {
  const [activeSection, setActiveSection] = useState<GuideSectionId | null>(null);
  const [query, setQuery] = useState('');
  const [supportOpen, setSupportOpen] = useState(false);
  const [helpfulState, setHelpfulState] = useState<'helpful' | 'unresolved' | null>(null);
  const [openQuestion, setOpenQuestion] = useState<string | null>(null);
  const articleRef = useRef<HTMLElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const syncSectionFromHash = (focusArticle: boolean) => {
      const hash = window.location.hash.slice(1);
      const item = guideNavigation.find((entry) => entry.id === hash);

      if (!item) {
        setActiveSection(null);
        return;
      }

      setActiveSection(item.id);
      if (focusArticle) {
        window.requestAnimationFrame(() => articleRef.current?.focus({ preventScroll: true }));
      }
    };

    syncSectionFromHash(Boolean(window.location.hash));
    const handleHashChange = () => syncSectionFromHash(true);
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  useEffect(() => {
    const focusHelpSearch = (event: KeyboardEvent) => {
      const editable =
        event.target instanceof HTMLElement &&
        Boolean(event.target.closest('input,textarea,select,[contenteditable="true"]'));
      const findShortcut = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'f';
      const slashShortcut = event.key === '/' && !event.ctrlKey && !event.metaKey && !event.altKey;
      if ((!findShortcut && !slashShortcut) || (slashShortcut && editable)) return;

      event.preventDefault();
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    };

    window.addEventListener('keydown', focusHelpSearch);
    return () => window.removeEventListener('keydown', focusHelpSearch);
  }, []);

  const normalizedQuery = query.trim().toLocaleLowerCase('zh-CN');
  const matchingTopics = useMemo(() => {
    if (!normalizedQuery) return guideNavigation;
    return guideNavigation.filter((item) =>
      [item.label, item.title, item.description, item.keywords]
        .join(' ')
        .toLocaleLowerCase('zh-CN')
        .includes(normalizedQuery)
    );
  }, [normalizedQuery]);
  const matchingQuestions = useMemo(() => {
    if (!normalizedQuery) return [];
    return commonQuestions.filter((item) =>
      `${item.question} ${item.answer}`.toLocaleLowerCase('zh-CN').includes(normalizedQuery)
    );
  }, [normalizedQuery]);
  const featuredItems = featuredGuideIds
    .map((id) => guideNavigation.find((item) => item.id === id))
    .filter((item): item is GuideNavItem => Boolean(item));
  const activeItem = activeSection
    ? guideNavigation.find((item) => item.id === activeSection) ?? null
    : null;
  const relatedItems = activeItem
    ? guideNavigation.filter((item) => item.id !== activeItem.id).slice(0, 3)
    : [];

  const activateSection = (
    id: GuideSectionId,
    options: { focus?: boolean; question?: string | null } = {}
  ) => {
    setActiveSection(id);
    setHelpfulState(null);
    setOpenQuestion(options.question ?? null);
    window.history.replaceState(window.history.state, '', `#${id}`);
    if (options.focus !== false) {
      window.requestAnimationFrame(() => articleRef.current?.focus({ preventScroll: true }));
    }
  };

  const returnToHelpHome = () => {
    setActiveSection(null);
    setHelpfulState(null);
    setOpenQuestion(null);
    window.history.replaceState(
      window.history.state,
      '',
      `${window.location.pathname}${window.location.search}`
    );
    window.requestAnimationFrame(() => {
      document.getElementById('desktop-guide-search-input')?.focus({ preventScroll: true });
    });
  };

  const clearArticleForSearch = (nextQuery: string) => {
    setQuery(nextQuery);
    if (!activeSection) return;
    setActiveSection(null);
    setOpenQuestion(null);
    window.history.replaceState(
      window.history.state,
      '',
      `${window.location.pathname}${window.location.search}`
    );
  };

  const clearHelpSearch = () => {
    clearArticleForSearch('');
    window.requestAnimationFrame(() => searchInputRef.current?.focus({ preventScroll: true }));
  };

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="desktop-route-content desktop-core-page desktop-core-page--scroll desktop-guide-page desktop-guide-center desktop-help-center outline-none"
      aria-labelledby="desktop-guide-title"
    >
      <header className="desktop-core-page-header desktop-page-header desktop-page-header--directory desktop-guide-hero desktop-help-hero">
        <div className="desktop-guide-hero-topline">
          <div className="desktop-page-header-copy desktop-guide-hero-copy">
            <div className="desktop-page-header-title-row">
              <h1 id="desktop-guide-title" className="desktop-page-header-title">帮助与反馈</h1>
            </div>
            <p className="desktop-page-header-subtitle">查找使用方法、排查常见问题，或联系我们获得帮助。</p>
          </div>
          <button type="button" className="desktop-page-header-primary desktop-guide-support-trigger" onClick={() => setSupportOpen(true)}>
            <MessageCircle aria-hidden="true" />联系支持
          </button>
        </div>
      </header>

      <section className="desktop-help-search-toolbar" aria-label="搜索帮助">
        <div className="desktop-guide-hero-search" role="search">
          <Search aria-hidden="true" />
          <input
            ref={searchInputRef}
            id="desktop-guide-search-input"
            type="text"
            role="searchbox"
            aria-label="搜索帮助"
            aria-keyshortcuts="Control+F"
            inputMode="search"
            value={query}
            autoComplete="off"
            placeholder="搜索功能、问题或关键词，例如：隐藏截止项目"
            onChange={(event) => clearArticleForSearch(event.target.value)}
          />
          {query ? (
            <button type="button" aria-label="清空帮助搜索" onClick={clearHelpSearch}>
              <X aria-hidden="true" />
            </button>
          ) : (
            <kbd>Ctrl F</kbd>
          )}
        </div>
      </section>

      {activeItem ? (
        <article
          ref={articleRef}
          id={`desktop-guide-article-${activeItem.id}`}
          className="desktop-guide-article"
          aria-labelledby="desktop-guide-article-title"
          tabIndex={-1}
        >
          <div className="desktop-guide-article-topbar">
            <button type="button" onClick={returnToHelpHome}>
              <ArrowLeft aria-hidden="true" />返回帮助中心
            </button>
            <span>帮助与反馈&nbsp; / &nbsp;{activeItem.label}</span>
          </div>
          <header className="desktop-guide-article-header">
            <h2 id="desktop-guide-article-title">{activeItem.label}</h2>
            <p>{activeItem.description}</p>
          </header>
          <div className="desktop-guide-article-body">
            <GuideTopicContent sectionId={activeItem.id} openQuestion={openQuestion} />
          </div>
          <footer className="desktop-guide-article-footer">
            <div className="desktop-guide-helpful-prompt">
              <div>
                <strong>这篇内容是否解决了你的问题？</strong>
                <span role="status" aria-live="polite">
                  {helpfulState === 'helpful'
                    ? '感谢你的反馈。'
                    : helpfulState === 'unresolved'
                      ? '我们来继续帮你排查。'
                      : '你的选择会帮助我们改进帮助内容。'}
                </span>
              </div>
              <div>
                <button type="button" onClick={() => setHelpfulState('helpful')}>有帮助</button>
                <button type="button" onClick={() => {
                  setHelpfulState('unresolved');
                  setSupportOpen(true);
                }}>仍未解决</button>
              </div>
            </div>
            <div className="desktop-guide-related">
              <h3>相关帮助</h3>
              <div>
                {relatedItems.map((item) => (
                  <button key={item.id} type="button" onClick={() => activateSection(item.id)}>
                    <span>{item.label}</span><ArrowRight aria-hidden="true" />
                  </button>
                ))}
              </div>
            </div>
          </footer>
        </article>
      ) : (
        <div className="desktop-guide-home">
          {!normalizedQuery ? (
            <section className="desktop-guide-home-section desktop-guide-featured" aria-labelledby="desktop-guide-featured-title">
              <div className="desktop-guide-section-heading">
                <div><h2 id="desktop-guide-featured-title">常用帮助</h2><p>从最常见的使用任务开始。</p></div>
              </div>
              <div className="desktop-guide-featured-grid">
                {featuredItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button key={item.id} type="button" onClick={() => activateSection(item.id)}>
                      <span aria-hidden="true"><Icon /></span>
                      <div><strong>{item.label}</strong><p>{item.description}</p></div>
                      <ArrowRight aria-hidden="true" />
                    </button>
                  );
                })}
              </div>
            </section>
          ) : null}

          <section className="desktop-guide-home-section desktop-guide-directory" aria-labelledby="desktop-guide-directory-title">
            <div className="desktop-guide-section-heading">
              <div>
                <h2 id="desktop-guide-directory-title">{normalizedQuery ? '搜索结果' : '浏览帮助主题'}</h2>
                <p>{normalizedQuery ? `找到 ${matchingTopics.length + matchingQuestions.length} 条相关内容。` : '按任务选择内容，一次只阅读一个答案。'}</p>
              </div>
            </div>

            {matchingTopics.length > 0 ? (
              <div className="desktop-guide-directory-list">
                {matchingTopics.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button key={item.id} type="button" onClick={() => activateSection(item.id)}>
                      <span aria-hidden="true"><Icon /></span>
                      <div><strong>{item.label}</strong><p>{item.description}</p></div>
                      <ArrowRight aria-hidden="true" />
                    </button>
                  );
                })}
              </div>
            ) : null}

            {matchingQuestions.length > 0 ? (
              <div className="desktop-guide-question-results" aria-label="相关问题">
                {matchingQuestions.map((item) => (
                  <button
                    key={item.question}
                    type="button"
                    onClick={() => activateSection('common-questions', { question: item.question })}
                  >
                    <span>{item.question}</span><ArrowRight aria-hidden="true" />
                  </button>
                ))}
              </div>
            ) : null}

            {matchingTopics.length === 0 && matchingQuestions.length === 0 ? (
              <div className="desktop-guide-home-empty" role="status">
                <Search aria-hidden="true" />
                <strong>没有找到相关答案</strong>
                <p>尝试更换关键词，或联系支持继续排查。</p>
                <div><button type="button" onClick={() => setQuery('')}>清除搜索</button><button type="button" onClick={() => setSupportOpen(true)}>联系支持</button></div>
              </div>
            ) : null}
          </section>

          {!normalizedQuery ? (
            <section className="desktop-guide-home-section desktop-guide-home-faq" aria-labelledby="desktop-guide-home-faq-title">
              <div className="desktop-guide-section-heading">
                <div><h2 id="desktop-guide-home-faq-title">高频问题</h2><p>申请、材料、提醒和软件更新的常见疑问。</p></div>
                <button type="button" onClick={() => activateSection('common-questions')}>查看全部<ArrowRight aria-hidden="true" /></button>
              </div>
              <div className="desktop-guide-home-faq-list">
                {commonQuestions.slice(0, 5).map((item) => (
                  <details key={item.question}><summary>{item.question}<ChevronDown aria-hidden="true" /></summary><p>{item.answer}</p></details>
                ))}
              </div>
            </section>
          ) : null}

          {!normalizedQuery ? (
            <section className="desktop-guide-support-cta">
              <span aria-hidden="true"><MessageCircle /></span>
              <div><h2>仍然没有解决？</h2><p>先查看与问题相关的帮助，仍需要时再生成可复制的反馈内容。</p></div>
              <button type="button" onClick={() => setSupportOpen(true)}>联系支持<ArrowRight aria-hidden="true" /></button>
            </section>
          ) : null}
        </div>
      )}

      {supportOpen ? (
        <SupportDrawer
          onClose={() => setSupportOpen(false)}
          onOpenTopic={(id) => {
            setSupportOpen(false);
            activateSection(id);
          }}
        />
      ) : null}
    </main>
  );
}
