import type {PublicNoticeProject} from '../../../lib/mock-data';
import {mapNoticeRowToProject,toNoticeListItem} from '../../../lib/notice-record';
import {shouldShowInMainNoticeFlow} from '../../../lib/notice-quality';
import {getDisplaySchoolName,getDisplayNoticeDepartment,getDisplayDiscipline,normalizeNoticeTitle} from '../../../lib/notice-display';
import {getNoticeKindBucket,getNoticeTypeBucket,getNoticeRegion} from '../../../lib/notice-analytics';
import {inferSchoolRange,inferDisciplineCategory} from '../../../lib/notice-taxonomy';
import {getNoticeCardTags} from '../../../lib/notice-query';
import {getDeadlineTimestamp,getDeadlineLevelFromDate,getPublicStatusForDeadlineLevel} from '../../../lib/deadline-display';

export function createNoticeProjection(row:Record<string,unknown>,sourceRank:number,schoolRank:number){
  const project=mapNoticeRowToProject(row);
  if(!project||!shouldShowInMainNoticeFlow(project))return null;
  return projectApprovedNotice(project,sourceRank,schoolRank,String(row.status||''));
}
// Caller must already have validated the public approval/visibility provenance.
// Used for verified public snapshots; raw database rows use createNoticeProjection.
export function projectApprovedNotice(project:PublicNoticeProject,sourceRank:number,schoolRank:number,rawStatus:string=project.status){
  const school=getDisplaySchoolName(project.schoolName),department=getDisplayNoticeDepartment(project),title=normalizeNoticeTitle(project.projectName,160);
  const discipline=getDisplayDiscipline(project.discipline),tags=getNoticeCardTags(project).join(' ');
  const deadline=getDeadlineTimestamp(project.deadlineDate);
  return {v:1,summary:toNoticeListItem(project),rawStatus,
    primary:[school,department,title].join(' ').toLowerCase(),secondary:[discipline,tags].join(' ').toLowerCase(),
    schoolText:[school,department].join(' ').toLowerCase(),major:[discipline,department,title,tags].join(' ').toLowerCase(),
    region:getNoticeRegion(project),category:inferDisciplineCategory(project.discipline),discipline,range:inferSchoolRange(project),
    type:getNoticeTypeBucket(project),kind:getNoticeKindBucket(project),deadlineMs:deadline===Number.MAX_SAFE_INTEGER?null:deadline,
    publishDate:project.publishDate,updatedSort:project.updatedAt||project.collectedAt||project.publishDate,
    schoolName:project.schoolName,year:project.year,sourceRank,schoolRank};
}
export type NoticeProjection=NonNullable<ReturnType<typeof createNoticeProjection>>;
export function liveSummary(p:NoticeProjection,now=Date.now()){
  const level=getDeadlineLevelFromDate(p.summary.deadlineDate,now);
  return {...p.summary,deadlineLevel:level,status:level==='future'?(p.rawStatus||getPublicStatusForDeadlineLevel(level)):getPublicStatusForDeadlineLevel(level)};
}
