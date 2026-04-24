export type PortalLink = {
  title: string;
  description: string;
  href: string;
  badge: string;
  external?: boolean;
};

export type ResourceSection = {
  title: string;
  description: string;
  links: PortalLink[];
};

export type OfferFeedItem = {
  id: string;
  author: string;
  avatar: string;
  verified: boolean;
  time: string;
  giveUp: string;
  goTo: string;
  message: string;
  tags: string[];
  likes: number;
  school: string;
  heat: number;
};

export const officialResourceSections: ResourceSection[] = [
  {
    title: '高频学术工具',
    description: '把查论文、做笔记、翻译和整理材料最常用的入口集中起来。',
    links: [
      {
        title: '中国知网',
        description: '中文期刊、学位论文和综述检索的基础入口。',
        href: 'https://www.cnki.net/',
        badge: '论文数据库',
        external: true
      },
      {
        title: '万方数据',
        description: '适合作为中文文献和学位论文检索的补充入口。',
        href: 'https://www.wanfangdata.com.cn/',
        badge: '中文检索',
        external: true
      },
      {
        title: 'Web of Science',
        description: '英文论文检索与引用网络查询的常用平台。',
        href: 'https://www.webofscience.com/',
        badge: '英文检索',
        external: true
      },
      {
        title: 'ResearchGate',
        description: '适合快速查看导师、课题组和研究方向的公开科研动态。',
        href: 'https://www.researchgate.net/',
        badge: '科研画像',
        external: true
      },
      {
        title: 'Overleaf',
        description: '适合简历、论文和学术材料的在线 LaTeX 编辑。',
        href: 'https://www.overleaf.com/',
        badge: '排版写作',
        external: true
      },
      {
        title: 'DeepL',
        description: '翻译英文邮件、摘要和项目说明时更顺手。',
        href: 'https://www.deepl.com/',
        badge: '翻译工具',
        external: true
      }
    ]
  },
  {
    title: '官方入口',
    description: '把保研过程里反复回访的权威网站整理成稳定入口层。',
    links: [
      {
        title: '中国研究生招生信息网',
        description: '查询专业目录、招生政策、推免系统和各院校官方说明。',
        href: 'https://yz.chsi.com.cn/',
        badge: '官方权威',
        external: true
      },
      {
        title: '学信网',
        description: '学历学籍、在线验证报告和身份核验常用入口。',
        href: 'https://www.chsi.com.cn/',
        badge: '官方权威',
        external: true
      },
      {
        title: '教育部',
        description: '查看政策文件、通知公告和高等教育相关信息。',
        href: 'https://www.moe.gov.cn/',
        badge: '政策',
        external: true
      },
      {
        title: '中国科学院',
        description: '研究所动态、科研平台和招生信息的重要官方入口。',
        href: 'https://www.cas.cn/',
        badge: '科研机构',
        external: true
      },
      {
        title: '国家自然科学基金委',
        description: '适合补充导师项目、研究方向与科研背景调研。',
        href: 'https://www.nsfc.gov.cn/',
        badge: '科研项目',
        external: true
      },
      {
        title: '中国学位与研究生教育学会',
        description: '研究生教育改革、行业动态与学位相关信息入口。',
        href: 'https://www.acge.org.cn/',
        badge: '行业协会',
        external: true
      }
    ]
  },
  {
    title: '常用服务',
    description: '把容易在申请期反复打开的服务型网站集中起来，减少来回搜索。',
    links: [
      {
        title: '导师评价网',
        description: '辅助补充导师风格、组内氛围和口碑信息。',
        href: 'https://www.daoshipingjia.net/',
        badge: '导师调研',
        external: true
      },
      {
        title: 'Notion',
        description: '适合整理院校调研、面试题库与个人申请计划。',
        href: 'https://www.notion.so/',
        badge: '效率工具',
        external: true
      },
      {
        title: 'Obsidian',
        description: '适合沉淀导师调研、院校笔记和个人知识库。',
        href: 'https://obsidian.md/',
        badge: '知识管理',
        external: true
      },
      {
        title: 'XMind',
        description: '适合做申请路径梳理、目标院校对比和材料清单。',
        href: 'https://xmind.app/',
        badge: '结构整理',
        external: true
      },
      {
        title: 'Grammarly',
        description: '辅助润色英文邮件、英文简历与套磁材料。',
        href: 'https://www.grammarly.com/',
        badge: '语言润色',
        external: true
      },
      {
        title: '腾讯文档',
        description: '适合和同伴共享面试经验、通知汇总和清单模板。',
        href: 'https://docs.qq.com/',
        badge: '协作工具',
        external: true
      }
    ]
  }
];

export const offerMetrics = [
  { label: '内测演示动态', value: '4', hint: '用于展示信息结构，不代表真实补录' },
  { label: '发布机制', value: '审核中', hint: '正式发布前会接入举报和删除入口' },
  { label: '高热方向', value: '计算机 / 电院 / 电子信息', hint: '仅作为演示标签，真实数据以审核后为准' }
];

export const hotKeywords = ['清华', '上交', '浙大', '计算机', '电院', '预推免'];

export const offerFeedItems: OfferFeedItem[] = [
  {
    id: 'offer-1',
    author: '小鹿同学',
    avatar: '鹿',
    verified: true,
    time: '2 分钟前',
    giveUp: '复旦大学 · 软件工程',
    goTo: '上海交通大学 · 电院',
    message: '老师确认今天还会继续顺延，候补同学注意电话、短信和系统通知。',
    tags: ['985', '上海', '电子信息'],
    likes: 128,
    school: '上海交通大学',
    heat: 96
  },
  {
    id: 'offer-2',
    author: 'AI 冲刺党',
    avatar: 'A',
    verified: true,
    time: '18 分钟前',
    giveUp: '中国科学技术大学 · 自动化',
    goTo: '清华大学 · 电子系',
    message: '我这边已经正式放弃该 offer，老师说今晚前会补录，大家及时查邮件。',
    tags: ['顶尖院校', '自动化', '候补补录'],
    likes: 94,
    school: '清华大学',
    heat: 89
  },
  {
    id: 'offer-3',
    author: '保研打工人',
    avatar: '研',
    verified: false,
    time: '1 小时前',
    giveUp: '武汉大学 · 网安',
    goTo: '浙江大学 · 计算机',
    message: '刚刚电话确认不去，后面应该会继续往下放，祝后面的同学接好运。',
    tags: ['网安', '浙大', '电话确认'],
    likes: 57,
    school: '浙江大学',
    heat: 76
  },
  {
    id: 'offer-4',
    author: '候补观察员',
    avatar: '补',
    verified: true,
    time: '2 小时前',
    giveUp: '同济大学 · 智能科学',
    goTo: '南京大学 · 计算机',
    message: '院里刚刚给我确认了释放，后续大概率会继续联系候补，南京方向同学可以盯一下。',
    tags: ['华五', '计算机', '候补'],
    likes: 61,
    school: '南京大学',
    heat: 72
  }
];
