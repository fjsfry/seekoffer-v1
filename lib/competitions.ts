export type CompetitionLevel = 'A类' | 'B类';
export type CompetitionDeadlineWindow = '近30天' | '暑期' | '秋季' | '长期准备';

export type CompetitionItem = {
  id: string;
  title: string;
  level: CompetitionLevel;
  category: string;
  deadlineWindow: CompetitionDeadlineWindow;
  hot: boolean;
  organizer: string;
  summary: string;
  fitFor: string[];
  preparation: string[];
  nextAction: string;
};

export const competitionItems: CompetitionItem[] = [
  {
    id: 'innovation-entrepreneurship',
    title: '中国国际大学生创新大赛',
    level: 'A类',
    category: '创新创业',
    deadlineWindow: '暑期',
    hot: true,
    organizer: '教育部等部门及地方政府联合主办',
    summary: '适合有科研转化、商业计划、社会实践或产品原型的同学，用项目完整度证明综合能力。',
    fitFor: ['经管金融', '人工智能/计算机', '交叉方向'],
    preparation: ['项目计划书', '路演 PPT', '团队分工'],
    nextAction: '先确认学校校赛报名节点，再整理项目摘要和证明材料。'
  },
  {
    id: 'challenge-cup',
    title: '挑战杯系列竞赛',
    level: 'A类',
    category: '科研创新',
    deadlineWindow: '秋季',
    hot: true,
    organizer: '共青团中央、中国科协、教育部等单位',
    summary: '科研作品、社会调研和创业计划都可沉淀为保研材料，适合强调研究问题和成果产出。',
    fitFor: ['人文社科', '经管金融', '交叉方向'],
    preparation: ['研究报告', '获奖证明', '指导教师意见'],
    nextAction: '把作品摘要、贡献分工和获奖证书整理进简历素材库。'
  },
  {
    id: 'mathematical-modeling',
    title: '全国大学生数学建模竞赛',
    level: 'A类',
    category: '数学建模',
    deadlineWindow: '暑期',
    hot: true,
    organizer: '中国工业与应用数学学会',
    summary: '对理工、经管、数据方向都很友好，能体现建模、编程、论文写作和团队协作能力。',
    fitFor: ['理学基础', '经管金融', '人工智能/计算机'],
    preparation: ['建模训练', '论文模板', '代码复盘'],
    nextAction: '提前固定队友和工具栈，准备 2-3 篇往年题复盘。'
  },
  {
    id: 'acm-icpc',
    title: 'ICPC / CCPC 程序设计竞赛',
    level: 'A类',
    category: '计算机',
    deadlineWindow: '秋季',
    hot: true,
    organizer: '相关竞赛委员会及高校承办',
    summary: '适合计算机、软件、算法方向，用算法能力和训练强度支撑专业匹配。',
    fitFor: ['人工智能/计算机'],
    preparation: ['算法题单', '校队训练', '获奖证明'],
    nextAction: '把最佳奖项、个人贡献和训练时长写成可复用简历条目。'
  },
  {
    id: 'electronic-design',
    title: '全国大学生电子设计竞赛',
    level: 'A类',
    category: '电子信息',
    deadlineWindow: '暑期',
    hot: true,
    organizer: '教育部高等教育司、工业和信息化部人事教育司',
    summary: '适合电子、通信、自动化和控制方向，强调硬件实现、工程调试和系统设计。',
    fitFor: ['电子信息/自动化'],
    preparation: ['电路方案', '实物照片', '测试报告'],
    nextAction: '整理项目指标、负责模块和调试难点，方便面试展开。'
  },
  {
    id: 'smart-car',
    title: '全国大学生智能汽车竞赛',
    level: 'B类',
    category: '电子信息',
    deadlineWindow: '暑期',
    hot: true,
    organizer: '中国自动化学会等机构',
    summary: '适合自动化、控制、电子和机器人方向，能补充工程实践和系统优化经历。',
    fitFor: ['电子信息/自动化', '人工智能/计算机'],
    preparation: ['控制方案', '调参记录', '比赛视频'],
    nextAction: '保留技术文档和演示视频，作为导师沟通附件。'
  },
  {
    id: 'lanqiao',
    title: '蓝桥杯全国软件和信息技术专业人才大赛',
    level: 'B类',
    category: '计算机',
    deadlineWindow: '秋季',
    hot: true,
    organizer: '工业和信息化部人才交流中心等',
    summary: '适合补充编程能力和信息技术基础，对低年级同学尤其适合做背景提升。',
    fitFor: ['人工智能/计算机', '电子信息/自动化'],
    preparation: ['刷题记录', '获奖证书', '代码仓库'],
    nextAction: '用获奖等级和题型能力说明基础编程水平。'
  },
  {
    id: 'energy-saving',
    title: '全国大学生节能减排社会实践与科技竞赛',
    level: 'B类',
    category: '能源环境',
    deadlineWindow: '暑期',
    hot: false,
    organizer: '教育部高等教育司相关指导委员会',
    summary: '适合能源、环境、材料、化工和机械方向，兼具科研、工程和社会价值表达。',
    fitFor: ['材料能源/化工', '交叉方向'],
    preparation: ['技术方案', '实验数据', '社会价值说明'],
    nextAction: '把技术路线、指标对比和应用场景整理成一页项目卡。'
  },
  {
    id: 'life-science',
    title: '全国大学生生命科学竞赛',
    level: 'B类',
    category: '生命医学',
    deadlineWindow: '长期准备',
    hot: false,
    organizer: '相关生命科学竞赛委员会',
    summary: '适合生命科学、医学、药学方向，把实验设计、数据分析和研究表达沉淀成材料。',
    fitFor: ['生命医学'],
    preparation: ['实验记录', '数据图表', '论文初稿'],
    nextAction: '保留实验过程和结果图，面试时用问题、方法、结论三段表达。'
  },
  {
    id: 'english-competition',
    title: '全国大学生英语竞赛',
    level: 'B类',
    category: '语言能力',
    deadlineWindow: '长期准备',
    hot: false,
    organizer: '高等学校大学外语教学研究会等',
    summary: '适合作为英语能力补充证明，尤其适合没有高分六级、雅思或托福的同学。',
    fitFor: ['人文社科', '经管金融', '交叉方向'],
    preparation: ['获奖证书', '英语成绩', '英文展示'],
    nextAction: '与四六级、雅思托福一起放在简历语言能力模块。'
  }
];

export const competitionLevelOptions = ['全部', 'A类', 'B类'] as const;
export const competitionDeadlineOptions = ['全部', '近30天', '暑期', '秋季', '长期准备'] as const;

export function getCompetitionCategories() {
  return ['全部', ...Array.from(new Set(competitionItems.map((item) => item.category)))];
}
