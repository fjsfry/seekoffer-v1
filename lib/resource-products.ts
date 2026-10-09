export type ResourceProductSeed = {
  slug: string;
  title: string;
  categoryLabel: string;
  badge: string;
  summary: string;
  description: string;
  amountCents: number;
  priceStatus: 'configured' | 'pending';
  features: string[];
  accent: 'emerald' | 'sky' | 'cyan';
  icon: 'resume' | 'statement' | 'recommendation';
  audience: string[];
  includes: string[];
  detailSections: Array<{
    title: string;
    description: string;
    bullets: string[];
  }>;
  steps: Array<{
    label: string;
    title: string;
    description: string;
  }>;
  faq: Array<{
    question: string;
    answer: string;
  }>;
};

export const resourceProductSeeds: ResourceProductSeed[] = [
  {
    slug: 'complete-application-kit',
    title: '寻鹿保研资料包',
    categoryLabel: '申请资料 / 全套资料包',
    badge: '一次购买',
    summary: '把推免申请需要准备的核心资料集中整理，付款后在订单页打开资料包。',
    description: '围绕简历、个人陈述、推荐信、联系导师、英文自我介绍、PPT 和证明材料等申请内容，提供结构化模板、表达提示和提交前检查清单。',
    amountCents: 990,
    priceStatus: 'configured',
    features: ['简历模板', '个人陈述模板', '推荐信模板'],
    accent: 'emerald',
    icon: 'resume',
    audience: ['需要一次性准备核心申请材料', '已有经历但缺少统一表达结构', '希望按清单完成修改和提交前检查'],
    includes: [
      '简历结构与经历表达模板',
      '个人陈述结构、常见问题与修改提示',
      '推荐信沟通与提交检查清单',
      '全套资料的使用说明与提交前自检'
    ],
    detailSections: [
      {
        title: '先把核心资料备齐',
        description: '把申请中最常用的材料集中到同一套资料里，减少重复寻找和遗漏。',
        bullets: ['资料集中管理', '结构入口清晰', '减少重复整理']
      },
      {
        title: '把经历写成申请表达',
        description: '从教育背景、科研经历、竞赛项目到未来规划，按材料用途组织内容。',
        bullets: ['经历有重点', '表达有结构', '材料之间保持一致']
      },
      {
        title: '最后按清单完成提交',
        description: '购买后按照使用流程逐项修改和检查，完成申请前的最后收口。',
        bullets: ['时间线一致', '文件命名统一', '提交节点可核对']
      }
    ],
    steps: [
      { label: '01', title: '整理事实', description: '先把成绩、科研、项目和申请方向集中整理。' },
      { label: '02', title: '套用结构', description: '按不同材料的结构提示完成初稿和修改。' },
      { label: '03', title: '提交检查', description: '根据清单检查内容、格式、节点和提交版本。' }
    ],
    faq: [
      { question: '购买后如何获得资料？', answer: '支付完成后，订单交付页会提供百度网盘入口，购买记录中也会保留这笔订单。' },
      { question: '可以直接套用成稿吗？', answer: '建议把资料包作为结构和修改工具，内容需要替换成你的真实经历与申请方向。' },
      { question: '资料包适合哪些申请阶段？', answer: '适合夏令营、预推免和正式推免等需要准备申请材料的阶段，具体提交要求仍以目标院校通知为准。' }
    ]
  }
];

export function resourceProductSeed(slug: string) {
  return resourceProductSeeds.find(product => product.slug === slug) || resourceProductSeeds[0];
}

export function formatCny(amountCents: number) {
  return `¥${(amountCents / 100).toFixed(2)}`;
}
