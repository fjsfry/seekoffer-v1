import generatedNoticeProjects from '@/data/baoyantongzhi-notices-2026.json';
import { noticeProjects, type PublicNoticeProject } from '@/lib/mock-data';

const generatedProjects = (generatedNoticeProjects as PublicNoticeProject[]).filter(Boolean);

export const baseNoticeProjects: PublicNoticeProject[] = generatedProjects.length ? generatedProjects : noticeProjects;

export type SchoolRangeFilter = '全部' | '985' | '211' | '双一流' | '其他';

const C9_SCHOOLS = [
  '北京大学',
  '清华大学',
  '复旦大学',
  '上海交通大学',
  '南京大学',
  '浙江大学',
  '中国科学技术大学',
  '哈尔滨工业大学',
  '西安交通大学'
];

const KNOWN_985_SCHOOLS = [
  ...C9_SCHOOLS,
  '中国人民大学',
  '北京航空航天大学',
  '北京理工大学',
  '北京师范大学',
  '中国农业大学',
  '中央民族大学',
  '南开大学',
  '天津大学',
  '大连理工大学',
  '东北大学',
  '吉林大学',
  '同济大学',
  '华东师范大学',
  '东南大学',
  '厦门大学',
  '山东大学',
  '中国海洋大学',
  '武汉大学',
  '华中科技大学',
  '湖南大学',
  '中南大学',
  '中山大学',
  '华南理工大学',
  '四川大学',
  '电子科技大学',
  '重庆大学',
  '西北工业大学',
  '兰州大学',
  '国防科技大学'
];

function getSchoolRangeText(project: Pick<PublicNoticeProject, 'schoolName' | 'tags'>) {
  return [project.schoolName, ...(project.tags || [])].join(' ');
}

export function getSchoolRangeMatches(project: Pick<PublicNoticeProject, 'schoolName' | 'tags'>) {
  const text = getSchoolRangeText(project);
  const schoolName = project.schoolName || '';
  const ranges = new Set<Exclude<SchoolRangeFilter, '全部' | '其他'>>();

  if (/985|985工程/.test(text) || KNOWN_985_SCHOOLS.some((name) => schoolName.includes(name))) {
    ranges.add('985');
  }

  if (/211|211工程/.test(text) || ranges.has('985')) {
    ranges.add('211');
  }

  if (/双一流|一流大学|一流学科/.test(text) || ranges.has('985') || ranges.has('211')) {
    ranges.add('双一流');
  }

  return ranges;
}

export function matchesSchoolRange(project: Pick<PublicNoticeProject, 'schoolName' | 'tags'>, range: SchoolRangeFilter) {
  if (range === '全部') return true;
  const ranges = getSchoolRangeMatches(project);
  if (range === '其他') return ranges.size === 0;
  return ranges.has(range);
}

export function inferSchoolRange(project: Pick<PublicNoticeProject, 'schoolName' | 'tags'>) {
  const ranges = getSchoolRangeMatches(project);
  if (ranges.has('985')) return '985';
  if (ranges.has('211')) return '211';
  if (ranges.has('双一流')) return '双一流';
  return '其他';
}

export function inferDisciplineCategory(discipline: string) {
  const value = discipline || '';

  if (/(生命|生物|医学|药学|公共卫生|护理|口腔|健康)/.test(value)) return '生命医学';
  if (/(经济|金融|管理|工商|会计|统计|经管|市场)/.test(value)) return '经管';
  if (/(法学|政治|社会|教育|中文|历史|哲学|新闻|外语|国际关系|马克思)/.test(value)) return '人文社科';
  if (/(数学|物理|化学|地理|地球|天文|理学)/.test(value)) return '理学';
  if (/(计算机|人工智能|软件|网安|电子|信息|通信|自动化|控制|机械|材料|化工|工程|建筑|土木|能源|航空|仪器)/.test(value)) {
    return '工学';
  }

  return '交叉其他';
}
