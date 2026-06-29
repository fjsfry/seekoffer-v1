import type { ApplicationRow } from './cloudbase-data';
import { majorDirections } from './major-taxonomy';
import { materialChecklistDefinitions, type ProjectType, type PublicNoticeProject } from './mock-data';
import { inferSchoolRange } from './notice-source';
import type { UserProfile } from './user-session';

export type AiProjectTier = '冲刺' | '稳妥' | '保底';
export type AiPriority = 'high' | 'medium' | 'low';

export type AiPositioningInput = {
  undergraduateSchool: string;
  major: string;
  grade: string;
  targetMajor: string;
  targetRegion: string;
  gpa: string;
  rankPercent: string;
  englishLevel: string;
  researchExperience: string;
  paperExperience: string;
  competitionExperience: string;
  preferredProjectTypes: ProjectType[];
  targetSchoolKeywords: string;
  notes: string;
};

export type AiMaterialGap = {
  title: string;
  detail: string;
  priority: AiPriority;
};

export type AiActionItem = {
  title: string;
  detail: string;
  priority: AiPriority;
};

export type AiRecommendedProject = {
  id: string;
  schoolName: string;
  departmentName: string;
  projectName: string;
  projectType: string;
  discipline: string;
  deadlineDate: string;
  daysLeft: number | null;
  score: number;
  tier: AiProjectTier;
  schoolRange: string;
  fitLabel: string;
  reasons: string[];
  alreadyTracked: boolean;
};

export type AiTierPlan = {
  tier: AiProjectTier;
  targetCount: string;
  currentCount: number;
  advice: string;
};

export type AiPositioningReport = {
  generatedAt: string;
  applicantScore: number;
  applicantBand: string;
  readinessScore: number;
  profileCompleteness: number;
  summary: string;
  tierPlan: AiTierPlan[];
  materialGaps: AiMaterialGap[];
  actionItems: AiActionItem[];
  recommendedProjects: AiRecommendedProject[];
  portfolioWarnings: string[];
  stats: {
    publicProjectCount: number;
    trackedProjectCount: number;
    matchedProjectCount: number;
    urgentTrackedCount: number;
  };
};

const defaultProjectTypes: ProjectType[] = ['夏令营', '预推免', '正式推免'];

const topSchoolPattern = /(清华|北京大学|北大|复旦|上海交通|上交|浙江大学|浙大|南京大学|中国科学技术大学|中科大|人民大学|人大)/;
const strongSchoolPattern = /(985|双一流|哈尔滨工业|西安交通|同济|南开|武汉大学|华中科技|东南大学|中山大学|厦门大学|北京航空航天|北航|北京理工|北理)/;
const goodSchoolPattern = /(211|双一流|华东师范|北京邮电|西安电子|南京航空|南京理工|苏州大学|暨南大学|郑州大学|上海大学)/;
const technicalMajorPattern = /(计算机|软件|人工智能|机器学习|数据|网安|电子|通信|自动化|控制|信息|数学|统计|材料|机械|能源|化工|生物|医学|药学|金融|经济|管理|法学|教育|新闻|中文|外语)/g;
const researchInstitutePattern = /(科学院|社科院|协和|实验室|研究院|研究所|医学院|脑科学|类脑)/;
const directionGroups = majorDirections.map((direction) => ({
  label: direction.label,
  keywords: direction.keywords
}));

export function createDefaultAiPositioningInput(profile?: UserProfile | null): AiPositioningInput {
  return {
    undergraduateSchool: profile?.undergraduateSchool || '',
    major: profile?.major || '',
    grade: profile?.grade || '大三',
    targetMajor: profile?.targetMajor || '',
    targetRegion: profile?.targetRegion || '',
    gpa: '',
    rankPercent: '',
    englishLevel: '',
    researchExperience: '',
    paperExperience: '',
    competitionExperience: '',
    preferredProjectTypes: defaultProjectTypes,
    targetSchoolKeywords: '',
    notes: ''
  };
}

export function buildAiPositioningReport(
  input: AiPositioningInput,
  publicProjects: PublicNoticeProject[],
  applicationRows: ApplicationRow[]
): AiPositioningReport {
  const applicantScore = inferApplicantScore(input);
  const applicantBand = getApplicantBand(applicantScore);
  const trackedProjectIds = new Set(applicationRows.map((row) => row.project.id));
  const urgentTrackedCount = applicationRows.filter((row) => {
    const daysLeft = getDaysLeft(row.project.deadlineDate);
    return daysLeft !== null && daysLeft >= 0 && daysLeft <= 7;
  }).length;

  const matchedProjects = dedupeRecommendedProjects(
    publicProjects
      .filter((project) => isActiveProject(project))
      .map((project) => scoreProject(project, input, applicantScore, trackedProjectIds))
      .filter((project) => project.score >= 34)
      .sort((left, right) => {
        if (right.score !== left.score) return right.score - left.score;
        return normalizeDaysLeft(left.daysLeft) - normalizeDaysLeft(right.daysLeft);
      })
  );

  const recommendedProjects = pickBalancedRecommendations(matchedProjects, 12);
  const profileCompleteness = getProfileCompleteness(input);
  const readinessScore = getReadinessScore(input, applicationRows, profileCompleteness);
  const materialGaps = buildMaterialGaps(input, applicationRows);
  const tierPlan = buildTierPlan(applicationRows, recommendedProjects, applicantScore);
  const portfolioWarnings = buildPortfolioWarnings(input, applicationRows, recommendedProjects, urgentTrackedCount);
  const actionItems = buildActionItems(input, applicationRows, recommendedProjects, materialGaps);

  return {
    generatedAt: new Date().toISOString(),
    applicantScore,
    applicantBand,
    readinessScore,
    profileCompleteness,
    summary: buildSummary(applicantBand, readinessScore, recommendedProjects, materialGaps, applicationRows.length),
    tierPlan,
    materialGaps,
    actionItems,
    recommendedProjects,
    portfolioWarnings,
    stats: {
      publicProjectCount: publicProjects.length,
      trackedProjectCount: applicationRows.length,
      matchedProjectCount: matchedProjects.length,
      urgentTrackedCount
    }
  };
}

function inferApplicantScore(input: AiPositioningInput) {
  let score = 48;
  const school = input.undergraduateSchool.trim();

  if (topSchoolPattern.test(school)) {
    score += 22;
  } else if (strongSchoolPattern.test(school)) {
    score += 17;
  } else if (goodSchoolPattern.test(school)) {
    score += 11;
  } else if (school) {
    score += 5;
  }

  const gpa = parseNumber(input.gpa);
  if (gpa !== null) {
    if (gpa >= 90 || (gpa > 0 && gpa <= 4.5 && gpa >= 3.8)) score += 12;
    else if (gpa >= 85 || (gpa > 0 && gpa <= 4.5 && gpa >= 3.6)) score += 9;
    else if (gpa >= 80 || (gpa > 0 && gpa <= 4.5 && gpa >= 3.3)) score += 5;
    else score -= 4;
  }

  const rank = parseNumber(input.rankPercent);
  if (rank !== null) {
    if (rank <= 5) score += 12;
    else if (rank <= 10) score += 9;
    else if (rank <= 20) score += 5;
    else score -= 4;
  }

  if (/(六级|CET-6|雅思|托福|IELTS|TOEFL|6级|六级|专四|专八|600|650|7\.|100)/i.test(input.englishLevel)) {
    score += 7;
  } else if (/(四级|CET-4|4级|500|550)/i.test(input.englishLevel)) {
    score += 4;
  } else if (input.englishLevel.trim()) {
    score += 2;
  }

  if (input.researchExperience.trim().length > 20) score += 8;
  else if (input.researchExperience.trim()) score += 4;

  if (input.paperExperience.trim()) score += 6;
  if (input.competitionExperience.trim()) score += 5;
  if (input.targetMajor.trim()) score += 3;

  return clamp(score, 35, 98);
}

function getApplicantBand(score: number) {
  if (score >= 86) return '强冲刺型';
  if (score >= 74) return '稳健竞争型';
  if (score >= 62) return '机会扩展型';
  return '材料补强型';
}

function scoreProject(
  project: PublicNoticeProject,
  input: AiPositioningInput,
  applicantScore: number,
  trackedProjectIds: Set<string>
): AiRecommendedProject {
  const text = getProjectSearchText(project);
  const primaryText = getProjectPrimaryText(project);
  const majorTokens = tokenize(`${input.targetMajor} ${input.major}`).filter((token) => token.length >= 2);
  const regionTokens = tokenize(input.targetRegion).filter((token) => token.length >= 2);
  const schoolTokens = tokenize(input.targetSchoolKeywords).filter((token) => token.length >= 2);
  const schoolRange = inferSchoolRange(project);
  const selectivity = getProjectSelectivity(schoolRange, project);
  const daysLeft = getDaysLeft(project.deadlineDate);
  const reasons: string[] = [];
  const directionMatch = getDirectionMatch(primaryText, text, input, majorTokens);

  let score = 18;

  if (directionMatch.strength === 'strong') {
    score += 30;
    reasons.push(`方向匹配：${directionMatch.hits.slice(0, 3).join('、')}`);
  } else if (directionMatch.strength === 'related') {
    score += 13;
    reasons.push(`学科大类接近：${directionMatch.label}`);
  } else if (input.targetMajor.trim()) {
    score -= 10;
  }

  if (regionTokens.some((token) => text.includes(token))) {
    score += 10;
    reasons.push('地区偏好匹配');
  }

  const schoolHits = schoolTokens.filter((token) => matchesSchoolToken(token, project, text));
  if (schoolHits.length) {
    score += 12;
    reasons.push('目标院校关键词命中');
  }

  if (!input.preferredProjectTypes.length || input.preferredProjectTypes.includes(project.projectType)) {
    score += 7;
  }

  const selectivityDelta = applicantScore - selectivity;
  const tier = inferProjectTier(selectivityDelta, directionMatch.strength);
  if (tier === '稳妥') score += 18;
  if (tier === '保底') score += 13;
  if (tier === '冲刺') score += 9;

  if (schoolRange === '985' || schoolRange === '双一流') {
    score += 7;
    reasons.push(`${schoolRange} 项目`);
  }

  if (daysLeft !== null) {
    if (daysLeft >= 0 && daysLeft <= 7) {
      score += 11;
      reasons.push('7 天内截止');
    } else if (daysLeft <= 21) {
      score += 8;
      reasons.push('近期可推进');
    } else if (daysLeft <= 45) {
      score += 5;
    }
  }

  if (trackedProjectIds.has(project.id)) {
    score += 6;
    reasons.push('已加入清单');
  }

  if (project.requirements && /(排名|成绩|英语|科研|论文|竞赛)/.test(project.requirements)) {
    score += 4;
  }

  if (!reasons.length) {
    reasons.push('可作为组合补充项目');
  }

  const finalScore = input.targetMajor.trim() && directionMatch.strength === 'weak' ? Math.min(score, 42) : score;

  return {
    id: project.id,
    schoolName: project.schoolName,
    departmentName: project.departmentName,
    projectName: project.projectName,
    projectType: project.projectType,
    discipline: project.discipline,
    deadlineDate: project.deadlineDate,
    daysLeft,
    score: clamp(Math.round(finalScore), 0, 100),
    tier,
    schoolRange,
    fitLabel: getFitLabel(tier, directionMatch.strength),
    reasons: reasons.slice(0, 4),
    alreadyTracked: trackedProjectIds.has(project.id)
  };
}

function buildMaterialGaps(input: AiPositioningInput, rows: ApplicationRow[]) {
  const gaps: AiMaterialGap[] = [];
  const trackedRows = rows.filter((row) => row.item.myStatus !== '已放弃');

  if (!trackedRows.length) {
    gaps.push({
      title: '材料状态未记录',
      detail: '当前还没有可用于判断材料完成度的申请项目。先把目标项目加入申请清单，并标记简历、成绩单、排名证明等状态后，再细化材料短板。',
      priority: 'medium'
    });

    if (!input.researchExperience.trim()) {
      gaps.push({
        title: '经历信息不足',
        detail: '当前只能看到基础背景，暂时无法判断科研、竞赛或实习经历是否足够支撑目标方向。',
        priority: 'medium'
      });
    }

    if (!input.englishLevel.trim()) {
      gaps.push({
        title: '语言成绩未填写',
        detail: '如果已经有四六级、雅思、托福或英文项目经历，补充后可以更准确判断涉外项目和英文面试风险。',
        priority: 'medium'
      });
    }

    return gaps.slice(0, 8);
  }

  const readiness = {
    cvReady: trackedRows.some((row) => row.item.cvReady),
    transcriptReady: trackedRows.some((row) => row.item.transcriptReady),
    rankingProofReady: trackedRows.some((row) => row.item.rankingProofReady),
    recommendationReady: trackedRows.some((row) => row.item.recommendationReady),
    personalStatementReady: trackedRows.some((row) => row.item.personalStatementReady),
    contactSupervisorDone: trackedRows.some((row) => row.item.contactSupervisorDone)
  };

  for (const item of materialChecklistDefinitions) {
    if (!readiness[item.key]) {
      const priority: AiPriority = item.key === 'cvReady' || item.key === 'transcriptReady' ? 'high' : 'medium';
      gaps.push({
        title: item.label,
        detail: getMaterialGapDetail(item.key),
        priority
      });
    }
  }

  if (!input.researchExperience.trim()) {
    gaps.push({
      title: '科研经历表述',
      detail: '先把课程项目、实验室经历或毕业设计整理成问题、方法、结果三段。',
      priority: 'high'
    });
  }

  if (!input.englishLevel.trim()) {
    gaps.push({
      title: '英语能力证明',
      detail: '补充四六级、雅思、托福或英文项目经历，便于判断涉外项目和英文面试风险。',
      priority: 'medium'
    });
  }

  return gaps.slice(0, 8);
}

function buildTierPlan(rows: ApplicationRow[], recommendations: AiRecommendedProject[], applicantScore: number): AiTierPlan[] {
  const currentCounts = countByTier(rows.map((row) => inferProjectTier(applicantScore - getProjectSelectivity(inferSchoolRange(row.project), row.project))));
  const recommendedCounts = countByTier(recommendations.map((project) => project.tier));

  return [
    {
      tier: '冲刺',
      targetCount: applicantScore >= 82 ? '3-5 个' : '2-3 个',
      currentCount: currentCounts.冲刺,
      advice: recommendedCounts.冲刺 ? `候选池新增 ${recommendedCounts.冲刺} 个冲刺项目` : '先补足材料后再加高竞争项目'
    },
    {
      tier: '稳妥',
      targetCount: '5-8 个',
      currentCount: currentCounts.稳妥,
      advice: recommendedCounts.稳妥 ? `优先推进 ${recommendedCounts.稳妥} 个稳妥项目` : '扩大目标方向或地区后再筛选'
    },
    {
      tier: '保底',
      targetCount: '3-5 个',
      currentCount: currentCounts.保底,
      advice: recommendedCounts.保底 ? `补齐 ${Math.min(recommendedCounts.保底, 5)} 个保底项目` : '当前候选不多，建议放宽地区'
    }
  ];
}

function buildPortfolioWarnings(
  input: AiPositioningInput,
  rows: ApplicationRow[],
  recommendations: AiRecommendedProject[],
  urgentTrackedCount: number
) {
  const warnings: string[] = [];
  const activeRows = rows.filter((row) => row.item.myStatus !== '已放弃');
  const schoolSet = new Set(activeRows.map((row) => row.project.schoolName));

  if (getProfileCompleteness(input) < 60) {
    warnings.push('背景信息不足，当前定位偏保守；补齐成绩、排名和英语后会更准。');
  }

  if (activeRows.length < 6) {
    warnings.push('申请组合偏薄，建议先把目标项目扩展到 10 个左右。');
  }

  if (schoolSet.size > 0 && schoolSet.size <= 2 && activeRows.length >= 4) {
    warnings.push('目标院校过于集中，建议按地区或学科方向增加备选。');
  }

  if (urgentTrackedCount >= 3) {
    warnings.push('7 天内截止项目较多，需要先按材料完整度和匹配度排序。');
  }

  if (!recommendations.length) {
    warnings.push('公开通知中暂未找到强匹配项目，可以放宽目标地区或专业关键词。');
  }

  return warnings;
}

function buildActionItems(
  input: AiPositioningInput,
  rows: ApplicationRow[],
  recommendations: AiRecommendedProject[],
  gaps: AiMaterialGap[]
) {
  const actions: AiActionItem[] = [];
  const topProject = recommendations[0];

  if (!input.gpa || !input.rankPercent) {
    actions.push({
      title: '补齐成绩与排名',
      detail: '把 GPA、百分制或专业排名补进定位表，重新生成一次方案。',
      priority: 'high'
    });
  }

  if (topProject) {
    actions.push({
      title: `优先核对 ${topProject.schoolName}`,
      detail: `${topProject.projectType} · ${topProject.daysLeft === null ? '截止时间待确认' : `剩余 ${Math.max(topProject.daysLeft, 0)} 天`}`,
      priority: topProject.daysLeft !== null && topProject.daysLeft <= 7 ? 'high' : 'medium'
    });
  }

  if (rows.length < 8) {
    actions.push({
      title: rows.length ? '扩充申请清单' : '建立申请清单',
      detail: rows.length
        ? '从推荐项目里继续加入候选项目，再按冲刺、稳妥、保底补齐组合。'
        : '先把前 5 个推荐项目加入申请清单，系统才能结合材料状态和截止时间继续判断。',
      priority: 'medium'
    });
  }

  gaps.slice(0, 2).forEach((gap) => {
    actions.push({
      title: `补齐${gap.title}`,
      detail: gap.detail,
      priority: gap.priority
    });
  });

  return actions.slice(0, 3);
}

function buildSummary(
  applicantBand: string,
  readinessScore: number,
  recommendations: AiRecommendedProject[],
  gaps: AiMaterialGap[],
  trackedCount: number
) {
  const top = recommendations[0];
  const counts = countByTier(recommendations.map((project) => project.tier));
  const base = `当前定位为${applicantBand}，申请准备度 ${readinessScore}/100。`;
  const projectPart = top
    ? `建议先核对前 5 个项目，当前候选含冲刺 ${counts.冲刺} 个、稳妥 ${counts.稳妥} 个、保底 ${counts.保底} 个。`
    : '暂未找到强匹配项目，建议先放宽地区或目标方向。';
  const gapPart = gaps.length ? `最需要处理的是${gaps.slice(0, 2).map((item) => item.title).join('、')}。` : '核心材料状态较完整。';
  const tablePart = trackedCount ? `申请清单已有 ${trackedCount} 个项目，可直接纳入排序。` : '申请清单还比较薄，建议先加入候选项目。';

  return `${base}${projectPart}${gapPart}${tablePart}`;
}

function getProfileCompleteness(input: AiPositioningInput) {
  const fields = [
    input.undergraduateSchool,
    input.major,
    input.grade,
    input.targetMajor,
    input.targetRegion,
    input.gpa,
    input.rankPercent,
    input.englishLevel,
    input.researchExperience
  ];
  const filled = fields.filter((field) => field.trim()).length;
  return Math.round((filled / fields.length) * 100);
}

function getReadinessScore(input: AiPositioningInput, rows: ApplicationRow[], profileCompleteness: number) {
  const averageProgress = rows.length
    ? rows.reduce((sum, row) => sum + row.item.materialsProgress, 0) / rows.length
    : 0;
  const portfolioScore = rows.length >= 10 ? 100 : rows.length >= 6 ? 78 : rows.length >= 3 ? 55 : rows.length ? 35 : 15;
  const applicant = inferApplicantScore(input);

  return clamp(Math.round(profileCompleteness * 0.25 + averageProgress * 0.25 + portfolioScore * 0.25 + applicant * 0.25), 0, 100);
}

function getProjectSearchText(project: PublicNoticeProject) {
  return [
    project.schoolName,
    project.departmentName,
    project.projectName,
    project.projectType,
    project.discipline,
    project.requirements,
    project.materialsRequired.join(' '),
    project.tags.join(' ')
  ]
    .join(' ')
    .toLowerCase();
}

function getProjectPrimaryText(project: PublicNoticeProject) {
  return [
    project.schoolName,
    project.departmentName,
    project.projectName,
    project.projectType,
    project.discipline,
    project.tags.join(' ')
  ]
    .join(' ')
    .toLowerCase();
}

type DirectionStrength = 'strong' | 'related' | 'weak';

function getDirectionMatch(
  primaryText: string,
  text: string,
  input: AiPositioningInput,
  majorTokens: string[]
): { strength: DirectionStrength; hits: string[]; label: string } {
  const exactHits = majorTokens.filter((token) => primaryText.includes(token));
  if (exactHits.length) {
    return {
      strength: 'strong',
      hits: exactHits,
      label: exactHits.slice(0, 2).join('、')
    };
  }

  const targetText = `${input.targetMajor} ${input.major}`.toLowerCase();
  const targetGroups = directionGroups.filter((group) =>
    group.keywords.some((keyword) => targetText.includes(keyword.toLowerCase()))
  );
  const projectGroups = directionGroups.filter((group) =>
    group.keywords.some((keyword) => primaryText.includes(keyword.toLowerCase()))
  );
  const relatedGroup = targetGroups.find((group) => projectGroups.includes(group));

  if (relatedGroup) {
    return {
      strength: 'related',
      hits: relatedGroup.keywords,
      label: relatedGroup.label
    };
  }

  const fullTextHits = majorTokens.filter((token) => text.includes(token));
  if (fullTextHits.length && !projectGroups.length) {
    return {
      strength: 'related',
      hits: fullTextHits,
      label: fullTextHits.slice(0, 2).join('、')
    };
  }

  const broadHits = (targetText.match(technicalMajorPattern) || []).filter((token) => text.includes(token.toLowerCase()));
  if (broadHits.length && !projectGroups.length) {
    return {
      strength: 'related',
      hits: broadHits,
      label: broadHits.slice(0, 2).join('、')
    };
  }

  return {
    strength: 'weak',
    hits: [],
    label: '方向待核对'
  };
}

function dedupeRecommendedProjects(projects: AiRecommendedProject[]) {
  const seen = new Map<string, AiRecommendedProject>();

  for (const project of projects) {
    const key = getProjectDedupeKey(project);
    const current = seen.get(key);
    if (!current || project.score > current.score || normalizeDaysLeft(project.daysLeft) < normalizeDaysLeft(current.daysLeft)) {
      seen.set(key, project);
    }
  }

  return Array.from(seen.values()).sort((left, right) => {
    if (right.score !== left.score) return right.score - left.score;
    return normalizeDaysLeft(left.daysLeft) - normalizeDaysLeft(right.daysLeft);
  });
}

function getProjectDedupeKey(project: AiRecommendedProject) {
  return [
    project.schoolName,
    project.departmentName,
    project.projectType,
    project.deadlineDate
  ]
    .join('|')
    .replace(/\s+/g, '')
    .toLowerCase();
}

function pickBalancedRecommendations(projects: AiRecommendedProject[], limit: number) {
  const tierLimits: Record<AiProjectTier, number> = { 冲刺: 4, 稳妥: 5, 保底: 3 };
  const selected: AiRecommendedProject[] = [];
  const selectedIds = new Set<string>();

  (['冲刺', '稳妥', '保底'] satisfies AiProjectTier[]).forEach((tier) => {
    projects
      .filter((project) => project.tier === tier)
      .slice(0, tierLimits[tier])
      .forEach((project) => {
        if (!selectedIds.has(project.id) && selected.length < limit) {
          selected.push(project);
          selectedIds.add(project.id);
        }
      });
  });

  for (const project of projects) {
    if (selected.length >= limit) {
      break;
    }
    if (!selectedIds.has(project.id)) {
      selected.push(project);
      selectedIds.add(project.id);
    }
  }

  return selected.sort((left, right) => {
    if (right.score !== left.score) return right.score - left.score;
    return normalizeDaysLeft(left.daysLeft) - normalizeDaysLeft(right.daysLeft);
  });
}

function matchesSchoolToken(token: string, project: PublicNoticeProject, text: string) {
  const school = project.schoolName.toLowerCase();
  const normalizedToken = token.toLowerCase();

  if (normalizedToken === '北大') return school.includes('北京大学');
  if (normalizedToken === '上交') return school.includes('上海交通');
  if (normalizedToken === '浙大') return school.includes('浙江大学');
  if (normalizedToken === '中科大') return school.includes('中国科学技术大学');
  if (normalizedToken === '人大') return school.includes('人民大学');
  if (normalizedToken === '北航') return school.includes('北京航空航天');
  if (normalizedToken === '北理') return school.includes('北京理工');

  return text.includes(normalizedToken);
}

function tokenize(value: string) {
  return value
    .split(/[\s,，、/|;；]+/)
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function parseNumber(value: string) {
  const match = value.match(/\d+(?:\.\d+)?/);
  if (!match) {
    return null;
  }
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

function isActiveProject(project: PublicNoticeProject) {
  const daysLeft = getDaysLeft(project.deadlineDate);
  return daysLeft === null || daysLeft >= 0;
}

function getDaysLeft(deadlineDate: string) {
  if (!deadlineDate.trim()) {
    return null;
  }

  const timestamp = new Date(`${deadlineDate.replace(' ', 'T')}:00+08:00`).getTime();
  if (Number.isNaN(timestamp)) {
    return null;
  }

  return Math.ceil((timestamp - Date.now()) / (1000 * 60 * 60 * 24));
}

function normalizeDaysLeft(daysLeft: number | null) {
  return daysLeft === null ? Number.MAX_SAFE_INTEGER : Math.max(daysLeft, 0);
}

function getProjectSelectivity(schoolRange: string, project?: PublicNoticeProject) {
  const schoolText = `${project?.schoolName || ''} ${project?.departmentName || ''}`;
  if (topSchoolPattern.test(schoolText)) return 94;
  if (strongSchoolPattern.test(schoolText)) return 89;
  if (researchInstitutePattern.test(schoolText)) return 80;
  if (schoolRange === '985') return 86;
  if (schoolRange === '211') return 77;
  if (schoolRange === '双一流') return 73;
  return 64;
}

function inferProjectTier(delta: number, directionStrength: DirectionStrength = 'strong'): AiProjectTier {
  const challengeThreshold = directionStrength === 'weak' ? 4 : -6;
  const safetyThreshold = directionStrength === 'strong' ? 24 : 26;

  if (delta > safetyThreshold) return '保底';
  if (delta >= challengeThreshold) return '稳妥';
  return '冲刺';
}

function getFitLabel(tier: AiProjectTier, directionStrength: DirectionStrength) {
  if (directionStrength === 'strong') return `强匹配${tier}`;
  if (directionStrength === 'related') return `相关${tier}`;
  return `待核对${tier}`;
}

function countByTier(tiers: AiProjectTier[]) {
  return tiers.reduce(
    (result, tier) => {
      result[tier] += 1;
      return result;
    },
    { 冲刺: 0, 稳妥: 0, 保底: 0 } satisfies Record<AiProjectTier, number>
  );
}

function getMaterialGapDetail(key: string) {
  if (key === 'cvReady') return '先整理一版 1 页中文简历，突出排名、科研、竞赛和项目产出。';
  if (key === 'transcriptReady') return '准备教务盖章成绩单，并确认是否需要英文版。';
  if (key === 'rankingProofReady') return '联系学院开具排名证明，优先覆盖百分比和专业总人数。';
  if (key === 'recommendationReady') return '提前确定推荐老师，准备推荐信要点和提交方式。';
  if (key === 'personalStatementReady') return '准备可复用的个人陈述主线，再按院校方向微调。';
  return '列出潜在导师和研究方向，优先联系强匹配项目。';
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
