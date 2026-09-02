import generatedNoticeProjects from '@/data/baoyantongzhi-notices-2026.json';
import { noticeProjects, type PublicNoticeProject } from '@/lib/mock-data';

const generatedProjects = (generatedNoticeProjects as PublicNoticeProject[]).filter(Boolean);

export const baseNoticeProjects: PublicNoticeProject[] = generatedProjects.length ? generatedProjects : noticeProjects;

export {
  getSchoolRangeMatches,
  inferDisciplineCategory,
  inferSchoolRange,
  matchesSchoolRange,
  type SchoolRangeFilter
} from './notice-taxonomy';
