export type DesktopReminderChangeEntry = {
  field: string;
  change: string;
  date: string;
};

export type DesktopChangeReminderCopy = {
  fieldLabel: string;
  detail: string;
};

const internalChangeFieldPattern =
  /duplicate[_\s-]*merge|dedup|de[_\s-]*duplicate|crawl|crawler|scrap|spider|import|ingest|normaliz|standardiz|parse|extract|sync|migration|backfill|upsert|manual[_\s-]*verify|source[_\s-]*(?:site|status)|collected[_\s-]*at|updated[_\s-]*at|checked[_\s-]*at|初次录入|首次录入|抓取|爬虫|采集|导入|去重|归一化|标准化|清洗|解析|抽取|同步|迁移|回填|复核|校验|整理状态|信息来源/i;
const internalChangeDetailPattern =
  /合并重复(?:通知|记录)|重复通知|去重完成|抓取任务|爬虫任务|采集任务|导入批次|归一化处理|标准化字段|数据清洗|解析完成|抽取完成|同步完成|迁移完成|回填完成|完成复核|完成校验/i;

export function getChangeReminderCopy(
  field: string,
  change: string
): DesktopChangeReminderCopy | null {
  const normalizedField = field.trim().toLowerCase();
  const normalizedChange = change.trim().toLowerCase();

  // Data-pipeline events must be rejected before any user-facing classification.
  if (
    !normalizedField ||
    internalChangeFieldPattern.test(normalizedField) ||
    internalChangeDetailPattern.test(normalizedChange)
  ) {
    return null;
  }

  const actionableText = `${normalizedField} ${normalizedChange}`;
  const isExplicitStatusField =
    /^(?:status|state|project[_\s-]*status|application[_\s-]*status|项目状态|申请状态|报名状态|状态)$/.test(
      normalizedField
    );

  // A known field name is more reliable than words appearing inside its new value.
  if (isExplicitStatusField) {
    return {
      fieldLabel: '申请状态',
      detail: '项目状态已更新，请确认下一步安排。'
    };
  }

  if (/deadline|截止(?:时间|日期|节点)?|提交时间|报名时间/.test(actionableText)) {
    return {
      fieldLabel: '截止时间',
      detail: '截止时间已更新，请重新确认提交节点。'
    };
  }

  if (/material|document|attachment|required[_\s-]*file|材料|附件|文件清单/.test(actionableText)) {
    return {
      fieldLabel: '材料要求',
      detail: '申请材料要求已更新，请检查清单与文件版本。'
    };
  }

  if (/requirement|eligibility|condition|申请条件|报名条件|申请要求|报名要求|招生对象|申请资格/.test(actionableText)) {
    return {
      fieldLabel: '申请条件',
      detail: '申请条件已更新，请确认是否满足最新要求。'
    };
  }

  if (/apply[_\s-]*(?:link|url)|application[_\s-]*(?:link|url)|报名入口|申请入口|报名链接|申请链接/.test(actionableText)) {
    return {
      fieldLabel: '报名入口',
      detail: '报名入口已更新，请使用最新链接继续申请。'
    };
  }

  if (/event[_\s-]*(?:start|end|date)|interview|exam|assessment|活动时间|考核安排|面试安排|笔试安排|宣讲时间/.test(actionableText)) {
    return {
      fieldLabel: '项目安排',
      detail: '项目安排已更新，请确认新的时间与要求。'
    };
  }

  const hasExplicitStatusContext =
    /(?:project|application)[_\s-]*status|项目状态|申请状态|报名状态/.test(actionableText);

  if (hasExplicitStatusContext) {
    return {
      fieldLabel: '申请状态',
      detail: '项目状态已更新，请确认下一步安排。'
    };
  }

  return null;
}

export function getLatestActionableChange<T extends DesktopReminderChangeEntry>(
  changeLog: readonly T[]
) {
  return changeLog
    .map((entry) => {
      const copy = getChangeReminderCopy(entry.field, entry.change);
      return copy ? { entry, copy } : null;
    })
    .filter((item): item is { entry: T; copy: DesktopChangeReminderCopy } => item !== null)
    .sort((left, right) => Date.parse(right.entry.date) - Date.parse(left.entry.date))[0];
}
