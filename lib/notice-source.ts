import generatedNoticeProjects from '@/data/baoyantongzhi-notices-2026.json';
import { noticeProjects, type PublicNoticeProject } from '@/lib/mock-data';

const generatedProjects = (generatedNoticeProjects as PublicNoticeProject[]).filter(Boolean);

export const baseNoticeProjects: PublicNoticeProject[] = generatedProjects.length ? generatedProjects : noticeProjects;

export function inferSchoolRange(project: Pick<PublicNoticeProject, 'tags'>) {
  const tags = project.tags || [];
  if (tags.includes('985')) return '985';
  if (tags.includes('211')) return '211';
  if (tags.includes('双一流')) return '双一流';
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
