import {
  documentMaterialChecklistDefinitions,
  type DocumentMaterialChecklistKey,
  type PublicNoticeProject,
  type UserProjectRecord,
  type UserProjectStatus
} from './mock-data';
import type { DesktopMaterialMeta } from './desktop-project-meta';

export const applicationJourneyStages = [
  '发现',
  '关注',
  '准备材料',
  '已提交',
  '等待通知',
  '面试/复试',
  '结果'
] as const;

export type ApplicationJourneyStage = (typeof applicationJourneyStages)[number];
export type ApplicationActionTab = 'overview' | 'materials' | 'schedule' | 'contacts' | 'activity';
export type ApplicationJourneyState = 'active' | 'completed' | 'stopped';
export type ApplicationJourneyCommand =
  | 'open_notice'
  | 'open_materials'
  | 'open_schedule'
  | 'open_contacts'
  | 'open_activity'
  | 'start_preparation'
  | 'confirm_submission'
  | 'resume_application';

export type ApplicationMaterialMeta = Partial<
  Record<
    DocumentMaterialChecklistKey,
    Pick<DesktopMaterialMeta, 'requirement' | 'applicable'>
  >
>;

export type ApplicationFlowRow = {
  item: Pick<
    UserProjectRecord,
    | 'isFavorited'
    | 'myStatus'
    | 'submittedAt'
    | 'interviewTime'
    | 'resultStatus'
    | 'cvReady'
    | 'transcriptReady'
    | 'rankingProofReady'
    | 'recommendationReady'
    | 'personalStatementReady'
    | 'contactSupervisorDone'
  >;
  project: Pick<PublicNoticeProject, 'deadlineDate'>;
};

export type ApplicationJourney = {
  stageIndex: number;
  stage: ApplicationJourneyStage | '已停止';
  state: ApplicationJourneyState;
  action: string;
  detail: string;
  tab: ApplicationActionTab;
  command: ApplicationJourneyCommand;
  completed: boolean;
};

export type ApplicationJourneyProgress = {
  completedStages: number;
  totalStages: number;
  currentStage: ApplicationJourneyStage | '已停止';
  summary: string;
};

const resultStatuses = new Set<UserProjectStatus>(['已通过', '未通过']);

export function getApplicationJourneyProgress(
  journey: ApplicationJourney
): ApplicationJourneyProgress {
  const totalStages = applicationJourneyStages.length;
  const completedStages = journey.completed
    ? totalStages
    : Math.max(0, Math.min(journey.stageIndex, totalStages));
  const summary = journey.state === 'stopped'
    ? '流程已停止 · 可随时恢复'
    : `已完成 ${completedStages}/${totalStages} · 当前：${journey.stage}`;

  return {
    completedStages,
    totalStages,
    currentStage: journey.stage,
    summary
  };
}

function getMaterialDecision(
  row: ApplicationFlowRow,
  materialMeta?: ApplicationMaterialMeta
) {
  const flags = row.item as unknown as Record<string, boolean>;

  const missingRequired = documentMaterialChecklistDefinitions.find(({ key }) => {
    const meta = materialMeta?.[key];
    const applicable = meta?.applicable !== false;
    const requirement = meta?.requirement ?? 'required';
    return applicable && requirement === 'required' && !flags[key];
  });
  if (missingRequired) {
    return { kind: 'missing' as const, material: missingRequired };
  }

  const unknownRequirement = documentMaterialChecklistDefinitions.find(({ key }) => {
    const meta = materialMeta?.[key];
    return meta?.applicable !== false && meta?.requirement === 'unknown';
  });
  if (unknownRequirement) {
    return { kind: 'unknown' as const, material: unknownRequirement };
  }

  return null;
}

export function getApplicationJourney(
  row: ApplicationFlowRow,
  materialMeta?: ApplicationMaterialMeta
): ApplicationJourney {
  const { item } = row;
  const hasResult =
    item.resultStatus === '已通过' ||
    item.resultStatus === '未通过' ||
    resultStatuses.has(item.myStatus);
  const hasInterview = Boolean(item.interviewTime);

  if (item.myStatus === '已放弃') {
    return {
      stageIndex: -1,
      stage: '已停止',
      state: 'stopped',
      action: '恢复申请计划',
      detail: '这个项目已停止推进，不再生成材料和截止提醒；需要时可以恢复。',
      tab: 'overview',
      command: 'resume_application',
      completed: false
    };
  }

  if (hasResult) {
    return {
      stageIndex: 6,
      stage: '结果',
      state: 'completed',
      action: '记录申请结果',
      detail: '结果已经产生，保留结果和复盘备注，方便后续查看。',
      tab: 'activity',
      command: 'open_activity',
      completed: true
    };
  }

  if (item.myStatus === '待考核') {
    return hasInterview
      ? {
          stageIndex: 5,
          stage: '面试/复试',
          state: 'active',
          action: '确认面试安排',
          detail: '核对面试时间、地点和需要准备的内容。',
          tab: 'schedule',
          command: 'open_schedule',
          completed: false
        }
      : {
          stageIndex: 4,
          stage: '等待通知',
          state: 'active',
          action: '关注通知更新',
          detail: '申请已经提交，下一步是留意学校和学院的通知。',
          tab: 'activity',
          command: 'open_activity',
          completed: false
        };
  }

  if (item.myStatus === '已提交' || item.submittedAt) {
    return {
      stageIndex: 3,
      stage: '已提交',
      state: 'active',
      action: '核对报名入口',
      detail: '确认提交记录和官方报名页面状态，避免只在本地标记完成。',
      tab: 'overview',
      command: 'open_notice',
      completed: false
    };
  }

  if (item.myStatus === '准备材料中') {
    const materialDecision = getMaterialDecision(row, materialMeta);
    if (materialDecision?.kind === 'missing') {
      return {
        stageIndex: 2,
        stage: '准备材料',
        state: 'active',
        action: `补齐${materialDecision.material.label}`,
        detail: '先处理一项最靠前的未完成材料，完成后再继续下一项。',
        tab: 'materials',
        command: 'open_materials',
        completed: false
      };
    }

    if (materialDecision?.kind === 'unknown') {
      return {
        stageIndex: 2,
        stage: '准备材料',
        state: 'active',
        action: `确认${materialDecision.material.label}是否必交`,
        detail: '先对照官方通知确认材料要求，再决定是否纳入当前项目的必交清单。',
        tab: 'materials',
        command: 'open_materials',
        completed: false
      };
    }

    if (!item.contactSupervisorDone) {
      return {
        stageIndex: 2,
        stage: '准备材料',
        state: 'active',
        action: '更新导师联系状态',
        detail: '确认是否已联系、是否收到回复，以及下一次跟进日期。',
        tab: 'contacts',
        command: 'open_contacts',
        completed: false
      };
    }

    return {
      stageIndex: 2,
      stage: '准备材料',
      state: 'active',
      action: '确认并提交申请',
      detail: '材料已经齐备，核对截止时间和报名入口后确认提交。',
      tab: 'schedule',
      command: 'confirm_submission',
      completed: false
    };
  }

  if (item.isFavorited) {
    return {
      stageIndex: 1,
      stage: '关注',
      state: 'active',
      action: '核对信息并开始准备',
      detail: '把官方截止时间和报名入口核对清楚，再决定是否开始准备材料。',
      tab: 'schedule',
      command: 'start_preparation',
      completed: false
    };
  }

  return {
    stageIndex: 0,
    stage: '发现',
    state: 'active',
    action: '查看项目通知',
    detail: '先确认项目要求、材料清单和官方来源，再加入申请计划。',
    tab: 'overview',
    command: 'open_notice',
    completed: false
  };
}
