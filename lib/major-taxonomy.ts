import type { PublicNoticeProject } from './mock-data';
import {
  getDisplayDiscipline,
  getDisplayNoticeDepartment,
  getDisplayProjectType,
  getDisplaySchoolName,
  getDisplayTags,
  normalizeNoticeTitle
} from './notice-display';

export type MajorDirection = {
  id: string;
  label: string;
  category: string;
  description: string;
  keywords: string[];
  searchHint: string;
  preparationFocus: string[];
};

export const majorDirections: MajorDirection[] = [
  {
    id: 'ai-computer',
    label: '人工智能/计算机',
    category: '工学',
    description: '适合计算机、软件、人工智能、数据、网安等方向，优先看学院、实验室和交叉中心。',
    keywords: ['人工智能', 'AI', '大模型', '机器学习', '深度学习', '算法', '计算机', '软件', '数据', '网安', '信息安全'],
    searchHint: '人工智能',
    preparationFocus: ['项目代码', '科研论文', '竞赛经历']
  },
  {
    id: 'ee-information',
    label: '电子信息/自动化',
    category: '工学',
    description: '覆盖电子、通信、自动化、控制、集成电路、仪器和机器人等工程方向。',
    keywords: ['电子', '信息', '通信', '自动化', '控制', '集成电路', '微电子', '仪器', '机器人', '智能制造'],
    searchHint: '电子信息',
    preparationFocus: ['课程基础', '工程项目', '实验经历']
  },
  {
    id: 'finance-management',
    label: '经管金融',
    category: '经管',
    description: '适合经济、金融、管理、会计、统计、工商管理和公共管理等方向。',
    keywords: ['金融', '经济', '管理', '会计', '统计', '工商', '商业', '市场', '公共管理', '产业经济'],
    searchHint: '金融',
    preparationFocus: ['数理基础', '实习经历', '案例表达']
  },
  {
    id: 'life-medical',
    label: '生命医学',
    category: '生命医学',
    description: '覆盖生命科学、基础医学、临床、药学、公卫、脑科学和健康科学。',
    keywords: ['生命', '生物', '医学', '药学', '临床', '公共卫生', '脑科学', '神经', '护理', '口腔', '健康'],
    searchHint: '生命科学',
    preparationFocus: ['实验技能', '科研训练', '英文阅读']
  },
  {
    id: 'materials-energy',
    label: '材料能源/化工',
    category: '工学',
    description: '适合材料、化学化工、能源、环境、机械、制造、土木和航空等方向。',
    keywords: ['材料', '化工', '能源', '环境', '机械', '制造', '土木', '航空', '物理', '新能源'],
    searchHint: '材料',
    preparationFocus: ['实验结果', '工程实践', '方向匹配']
  },
  {
    id: 'science-foundation',
    label: '理学基础',
    category: '理学',
    description: '面向数学、物理、化学、地球科学、天文、地理等基础学科。',
    keywords: ['数学', '物理', '化学', '地球', '天文', '地理', '理学', '统计学', '应用数学'],
    searchHint: '数学',
    preparationFocus: ['课程排名', '科研潜力', '证明推导']
  },
  {
    id: 'humanities-social',
    label: '人文社科',
    category: '人文社科',
    description: '覆盖法学、教育、新闻传播、中文、外语、历史、哲学、社会学和政治学。',
    keywords: ['法学', '教育', '新闻', '传播', '中文', '外语', '历史', '哲学', '社会', '政治', '马克思'],
    searchHint: '新闻传播',
    preparationFocus: ['论文写作', '阅读积累', '议题意识']
  },
  {
    id: 'interdisciplinary',
    label: '交叉方向',
    category: '交叉其他',
    description: '适合交叉学科、心理、设计、农学、食品、海洋、国家安全等非单一学院方向。',
    keywords: ['交叉', '心理', '设计', '农学', '食品', '海洋', '国家安全', '城市', '数据科学', '可持续'],
    searchHint: '交叉',
    preparationFocus: ['跨学科动机', '方法迁移', '作品材料']
  }
];

export function getMajorDirectionById(id: string | null | undefined) {
  return majorDirections.find((item) => item.id === id) || majorDirections[0];
}

export function getMajorDirectionByText(value: string) {
  const text = normalizeSearchText(value);

  return majorDirections.find((direction) =>
    direction.keywords.some((keyword) => text.includes(normalizeSearchText(keyword)))
  );
}

export function buildMajorNoticeHref(direction: MajorDirection, extraKeyword = '') {
  const params = new URLSearchParams();
  params.set('major', extraKeyword.trim() || direction.searchHint);
  params.set('category', direction.category);
  params.set('status', '报名中');
  params.set('sort', 'deadline');
  params.set('advanced', '1');

  return `/notices?${params.toString()}`;
}

export function scoreNoticeForMajorDirection(
  project: PublicNoticeProject,
  direction: MajorDirection,
  extraKeyword = ''
) {
  const primaryText = buildNoticePrimaryText(project);
  const fullText = `${primaryText} ${project.requirements || ''}`.toLowerCase();
  const matchedTerms = new Set<string>();
  let score = 0;

  for (const keyword of direction.keywords) {
    const normalized = normalizeSearchText(keyword);
    if (primaryText.includes(normalized)) {
      score += 12;
      matchedTerms.add(keyword);
    } else if (fullText.includes(normalized)) {
      score += 5;
      matchedTerms.add(keyword);
    }
  }

  for (const token of tokenizeMajorKeyword(extraKeyword)) {
    if (primaryText.includes(token)) {
      score += 18;
      matchedTerms.add(token);
    } else if (fullText.includes(token)) {
      score += 8;
      matchedTerms.add(token);
    }
  }

  if (getDisplayProjectType(project.projectType) === '夏令营') {
    score += 2;
  }

  return {
    score,
    matchedTerms: Array.from(matchedTerms).slice(0, 4)
  };
}

export function isNoticeMatchedToMajor(project: PublicNoticeProject, direction: MajorDirection, extraKeyword = '') {
  return scoreNoticeForMajorDirection(project, direction, extraKeyword).score > 0;
}

function buildNoticePrimaryText(project: PublicNoticeProject) {
  return [
    getDisplaySchoolName(project.schoolName),
    getDisplayNoticeDepartment(project),
    normalizeNoticeTitle(project.projectName, 160),
    getDisplayProjectType(project.projectType),
    getDisplayDiscipline(project.discipline),
    getDisplayTags(project.tags).join(' ')
  ]
    .join(' ')
    .toLowerCase();
}

function tokenizeMajorKeyword(value: string) {
  return value
    .split(/[\s,，、/|;；]+/)
    .map((item) => normalizeSearchText(item))
    .filter((item) => item.length >= 2);
}

function normalizeSearchText(value: string) {
  return value.trim().toLowerCase();
}
