export const heroSellingPoints = [
  {
    title: '通知不再四处找',
    description:
      '集中整理夏令营、预推免和招生动态，减少反复搜索、群里蹲消息和信息遗漏。'
  },
  {
    title: '申请进度一目了然',
    description:
      '把院校、截止时间、申请状态和材料准备放到同一套流程里，让复杂申请更清楚。'
  },
  {
    title: '从焦虑刷信息，到从容做决定',
    description:
      '不仅看到新通知，更能知道什么值得关注、什么需要马上处理、下一步该做什么。'
  }
] as const;

export const aboutPrinciples = [
  {
    title: '第一，信息应该被更高效地获取。',
    body: '重要通知不该靠反复刷新网页、四处找群、到处问人。寻鹿希望把分散的院校通知集中整理，让用户第一时间看到真正重要的变化。'
  },
  {
    title: '第二，申请过程应该被更清晰地管理。',
    body: '保研和升学申请不是一次点击，而是一段持续数月的过程。每一所学校的要求、每一个时间节点、每一份材料准备，都值得被有条理地记录下来。'
  },
  {
    title: '第三，产品应该真正服务决策，而不是制造噪音。',
    body: '我们不希望做一个只会不断推送信息的平台，而是希望帮助用户更快判断：哪些机会值得关注，哪些节点需要优先处理，下一步到底该做什么。'
  }
] as const;

export const aboutVisionParagraphs = [
  '我们希望，寻鹿最终能成为保研与升学申请过程中的“个人作战台”。',
  '它既能帮你及时看到外部变化，也能帮你稳稳管理自己的节奏；既能提供信息，也能沉淀经验；既能服务第一次准备申请的人，也能陪伴用户从焦虑混乱走向有序推进。',
  '我们相信，好的产品不只是给用户更多内容，而是帮用户减少不必要的慌乱，提升真正有价值的行动效率。',
  '让每一次申请，都更有准备。',
  '让每一个重要节点，都不再错过。'
] as const;

export const aboutOriginParagraphs = [
  '寻鹿 Seekoffer 诞生于一个很真实的问题：升学申请从来不缺信息，缺的是一个能把信息整理清楚、把节奏管理起来的工具。',
  '我们发现，很多同学在准备夏令营、预推免和正式申请时，都会遇到同样的困扰：通知来源分散、截止日期容易遗漏、材料反复整理、进度难以统一管理。明明付出了很多精力，却仍然常常处在混乱和焦虑之中。',
  '因此，寻鹿想做的不是简单的信息搬运，而是一个真正围绕申请全过程设计的产品。我们希望帮助用户更高效地获取通知，更清晰地管理院校与材料，更及时地把握关键节点，也能在交流与经验分享中，获得更多确定性。',
  '对我们来说，产品的价值不在于堆砌功能，而在于让用户在重要阶段少一点慌乱，多一点准备；少一点重复劳动，多一点有效推进。',
  '寻鹿希望成为用户申请路上的长期工具，而不仅仅是一个临时查信息的网站。'
] as const;

export const footerColumns = [
  {
    title: '产品',
    links: [
      { label: '通知库', href: '/notices' },
      { label: '院校库', href: '/colleges' },
      { label: '资源库', href: '/resources' },
      { label: 'Offer 池', href: '/offers' },
      { label: 'AI 定位', href: '/ai' },
      { label: '工作台', href: '/me' }
    ]
  },
  {
    title: '帮助',
    links: [
      { label: '使用指南', href: '/about' },
      { label: '常见问题', href: '/disclaimer' },
      { label: '意见反馈', href: 'mailto:feedback@seekoffer.com.cn', external: true },
      { label: '更新日志', href: '/about' }
    ]
  },
  {
    title: '关于我们',
    links: [
      { label: '关于寻鹿', href: '/about' },
      { label: '用户协议', href: '/terms' },
      { label: '隐私政策', href: '/privacy' },
      { label: '社区规范', href: '/community' }
    ]
  }
] as const;

export const footerAbout =
  '寻鹿 Seekoffer 致力于把分散的保研信息整理成清晰的申请路径，帮助你更高效地获取通知、更有条理地推进材料与节点。';
