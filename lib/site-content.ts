import { QQ_GROUP_URL } from './contact';

export const heroSellingPoints = [
  {
    title: '通知不再四处找',
    description: '集中整理夏令营、预推免和正式推免信息，减少反复搜索、群里蹲消息和错过关键节点。'
  },
  {
    title: '申请进度一目了然',
    description: '把目标院校、截止时间、申请状态和材料准备放进同一个工作台，让复杂申请更清楚。'
  },
  {
    title: '从焦虑刷信息，到从容做决策',
    description: '不只看到新通知，也能判断哪些项目值得关注、哪些节点需要马上处理、下一步该做什么。'
  }
] as const;

export const aboutPrinciples = [
  {
    title: '信息要被整理成能行动的结构',
    body: '寻鹿不会只堆通知标题，而是把学校、学院、项目类型、截止时间、材料清单和报名入口拆成清晰字段，让用户打开页面就能判断下一步。'
  },
  {
    title: '申请过程要被持续管理',
    body: '保研不是一次点击，而是持续数月的推进。每个目标项目的材料、状态、备注、导师联系和日程，都应该被有条理地记录下来。'
  },
  {
    title: '社区讨论要服务真实判断',
    body: 'Offer 圈和经验内容不追求热闹，而是帮助用户理解录取、候补、放弃和申请策略，减少无效焦虑。'
  }
] as const;

export const aboutVisionParagraphs = [
  '我们希望寻鹿成为保研申请过程中的个人工作台。',
  '它既能帮你及时看到外部变化，也能帮你稳定管理自己的节奏；既能提供信息，也能沉淀经验；既服务第一次准备申请的同学，也服务已经进入投递、面试和确认阶段的用户。',
  '好的产品不只是给用户更多内容，而是减少不必要的慌乱，提升真正有价值的行动效率。',
  '让每一次申请都更有准备，让每一个重要节点都不再错过。'
] as const;

export const aboutOriginParagraphs = [
  '寻鹿 Seekoffer 诞生于一个真实问题：保研申请从来不缺信息，缺的是一个能把信息整理清楚、把节奏管理起来的工具。',
  '很多同学在准备夏令营、预推免和正式推免时，都遇到类似困扰：通知分散、截止时间容易遗漏、材料重复整理、进度难以统一管理。明明付出了很多精力，却依然常常处在混乱和焦虑之中。',
  '因此，寻鹿想做的不是简单的信息搬运，而是一个围绕申请全流程设计的产品。我们希望帮助用户更高效地获取通知，更清楚地管理院校与材料，更及时地把握关键节点，也能在交流与经验分享中获得更多确定性。',
  '对我们来说，产品价值不在于堆功能，而在于让用户在重要阶段少一点慌乱，多一点准备；少一点重复劳动，多一点有效推进。'
] as const;

export const footerColumns = [
  {
    title: '产品',
    links: [
      { label: '通知库', href: '/notices' },
      { label: '院校库', href: '/colleges' },
      { label: '资源库', href: '/resources' },
      { label: 'Offer 圈', href: '/offers' },
      { label: '竞赛库', href: '/competitions' },
      { label: '工作台', href: '/me' }
    ]
  },
  {
    title: '帮助',
    links: [
      { label: '知识/经验中心', href: '/knowledge' },
      { label: '保研咨询', href: '/consulting' },
      { label: '使用指南', href: '/guide' },
      { label: '常见问题', href: '/faq' },
      { label: '加入 QQ 群', href: QQ_GROUP_URL, external: true }
    ]
  },
  {
    title: '关于我们',
    links: [
      { label: '关于寻鹿', href: '/about' },
      { label: '数据说明', href: '/data-quality' },
      { label: '社区规范', href: '/community' }
    ]
  }
] as const;

export const footerAbout =
  '寻鹿 Seekoffer 致力于把分散的保研信息整理成清晰的申请路径，帮助你更高效地获取通知，更有条理地推进材料与节点。';
