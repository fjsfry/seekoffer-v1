export type ProductImage = { src: string; alt: string; width: number; height: number; thumbnail?: string };
const asset = '/resources/application-kit/';
export const kitMainImages: ProductImage[] = [
  ['main-01', '保研资料包 · 内容总览'],
  ['main-02', '七大模块 · 资料清单'],
  ['main-03', '模板特点 · 申请场景'],
  ['main-04', '适用人群 · 使用指南'],
  ['main-05', '电子资料 · 格式与交付']
].map(([name, alt]) => ({ src: asset + name + '.webp', thumbnail: asset + name + '-thumb.webp', alt, width: 1254, height: 1254 }));

export const kitDetailImages: (ProductImage & { id: string; label: string })[] = [
  { id: 'kit-overview', label: '全套资料总览', alt: '保研资料包介绍：七大模块、模板数量与电子版交付说明', src: asset + 'detail-01.webp', width: 941, height: 1672 },
  { id: 'kit-writing', label: '文书与邮件模板', alt: '个人陈述四套、导师邮件四套、推荐信五套与英文介绍样张', src: asset + 'detail-02.webp', width: 916, height: 1717 },
  { id: 'kit-resume', label: '简历与 PPT', alt: '五套简历及四套 PPT 的版式、类型与使用场景', src: asset + 'detail-03.webp', width: 971, height: 1619 },
  { id: 'kit-documents', label: '英文与证明材料', alt: '英文介绍、推荐信及在读和成绩排名证明材料展示', src: asset + 'detail-04.webp', width: 1024, height: 1536 },
  { id: 'kit-guide', label: '使用与购买指南', alt: '资料包适用人群、下载和编辑步骤、购买须知及服务介绍', src: asset + 'detail-05.webp', width: 977, height: 1610 }
];

export const kitModules = [
  { name: '个人陈述', count: 4, unit: '套', format: 'Word', description: '学术基础 / 科研经历 / 竞赛成果 / 成长故事' },
  { name: '简历模板', count: 5, unit: '套', format: 'Word', description: '学术 / 科研 / 项目 / 综合 / 竞赛' },
  { name: '联系导师', count: 4, unit: '套', format: 'Word', description: '研究兴趣匹配 / 优势展示 / 培养意向 / 明确报考' },
  { name: '推荐信', count: 5, unit: '套', format: 'Word', description: '课程表现 / 科研潜力 / 实践能力 / 通用 / 综合评价' },
  { name: '英文介绍', count: 3, unit: '份', format: 'Word', description: '通用版 / 1 分钟版 / 3 分钟版' },
  { name: 'PPT 模板', count: 4, unit: '套', format: 'PPT', description: '通用 / 项目 / 科研 / 综合' },
  { name: '证明材料', count: 2, unit: '份', format: 'Word', description: '在读证明 / 成绩排名证明' }
];
