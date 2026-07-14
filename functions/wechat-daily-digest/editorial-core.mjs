const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses';
const DEFAULT_EDITORIAL_MODEL = 'gpt-5.4-mini';
const FORBIDDEN_EDITORIAL_LANGUAGE = /重磅|速看|干货|上岸|助力|赋能|今日份|汇总来啦|一文看懂|值得关注|不容错过|别错过|码住|冲刺|宝子|！|!|🔥|🚀/u;

const EDITORIAL_INSTRUCTIONS = `
你是中文教育媒体的责任编辑，负责整理高校推免通知。

你的工作不是写营销文，也不是模仿自媒体口号，而是像一位认真、克制、有判断力的编辑：
1. 只依据输入数据，不补充背景，不推测申请难度，不创造学校、日期、项目或政策。
2. titleHook 用 6 至 16 个汉字概括当天信息特征，不含日期、数量、学校名、标点或英文。
3. lead 用 45 至 85 个汉字说明今天有哪些类型的更新、读者应先看什么；不要罗列学校名或具体日期。
4. selectedNoticeIds 选择 1 至 3 条最值得优先阅读的通知。优先级依次为：三天内截止、信息明确的预推免、夏令营或开放日；只能返回输入中的 id。
5. 禁止使用“重磅、速看、干货、上岸、助力、赋能、今日份、汇总来啦、一文看懂、值得关注、不容错过、别错过、码住、冲刺、宝子”等自媒体词语。
6. 不使用感叹号、emoji、英文小标题或夸张修辞。
7. 输出必须符合给定 JSON Schema。
`.trim();

const EDITORIAL_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    titleHook: {
      type: 'string',
      description: '6至16个汉字的克制标题钩子，不含日期、数量、学校名、标点或英文'
    },
    lead: {
      type: 'string',
      description: '45至85个汉字的编辑导语，只概括信息结构和阅读优先级'
    },
    selectedNoticeIds: {
      type: 'array',
      minItems: 1,
      maxItems: 3,
      items: { type: 'string' },
      description: '从输入通知中选择的1至3个通知id'
    }
  },
  required: ['titleHook', 'lead', 'selectedNoticeIds']
};

export class EditorialValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'EditorialValidationError';
    this.code = 'invalid_editorial_override';
  }
}

function compactText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function deadlineDays(deadlineDate, targetDate) {
  const match = compactText(deadlineDate).match(/20\d{2}-\d{2}-\d{2}/);
  if (!match) return Number.POSITIVE_INFINITY;
  const deadline = Date.parse(`${match[0]}T23:59:59+08:00`);
  const start = Date.parse(`${targetDate}T00:00:00+08:00`);
  return Math.floor((deadline - start) / 86_400_000);
}

function selectFallbackNoticeIds(notices, targetDate) {
  const ranked = [...notices].sort((left, right) => {
    const leftDays = deadlineDays(left.deadlineDate, targetDate);
    const rightDays = deadlineDays(right.deadlineDate, targetDate);
    const leftUrgent = leftDays >= 0 && leftDays <= 3 ? 0 : 1;
    const rightUrgent = rightDays >= 0 && rightDays <= 3 ? 0 : 1;
    if (leftUrgent !== rightUrgent) return leftUrgent - rightUrgent;
    if (leftDays !== rightDays) return leftDays - rightDays;
    return left.id.localeCompare(right.id, 'zh-CN');
  });

  const selected = [];
  const categories = new Set();
  for (const notice of ranked) {
    if (selected.length >= 3) break;
    if (categories.has(notice.category) && ranked.length > 3) continue;
    selected.push(notice.id);
    categories.add(notice.category);
  }
  for (const notice of ranked) {
    if (selected.length >= 3) break;
    if (!selected.includes(notice.id)) selected.push(notice.id);
  }
  return selected;
}

export function buildFallbackEditorial({ notices, targetDate, categoryCounts = {} }) {
  const urgentCount = notices.filter((notice) => {
    const days = deadlineDays(notice.deadlineDate, targetDate);
    return days >= 0 && days <= 3;
  }).length;
  const activeCategories = Object.entries(categoryCounts)
    .filter(([, count]) => Number(count) > 0)
    .map(([category]) => category);

  let titleHook = '今天有哪些新通知';
  if (urgentCount > 0) titleHook = '先看临近截止项目';
  else if (Number(categoryCounts.预推免) > 0) titleHook = '预推免申请陆续开放';
  else if (Number(categoryCounts.夏令营) > 0 || Number(categoryCounts.开放日与宣讲) > 0) {
    titleHook = '夏令营与开放日更新';
  }

  const categoryText = activeCategories.length ? activeCategories.join('、') : '院校通知';
  const lead = urgentCount > 0
    ? `今天整理了 ${notices.length} 条院校通知，其中 ${urgentCount} 条将在三天内截止。建议先核对时间，再按申请阶段浏览，具体要求仍以院校原文为准。`
    : `今天整理了 ${notices.length} 条院校通知，主要涉及${categoryText}。可以先按申请阶段浏览，再打开院校原文核对资格、材料和截止时间。`;

  return {
    source: 'rules',
    model: '',
    responseId: '',
    fallbackReason: '',
    titleHook,
    lead,
    selectedNoticeIds: selectFallbackNoticeIds(notices, targetDate)
  };
}

function extractResponseText(payload) {
  if (typeof payload?.output_text === 'string') return payload.output_text;
  for (const item of Array.isArray(payload?.output) ? payload.output : []) {
    for (const content of Array.isArray(item?.content) ? item.content : []) {
      if (content?.type === 'output_text' && typeof content.text === 'string') return content.text;
    }
  }
  return '';
}

function validateEditorial(candidate, fallback, notices) {
  const titleHook = compactText(candidate?.titleHook);
  const lead = compactText(candidate?.lead);
  const validIds = new Set(notices.map((notice) => notice.id));
  const selectedNoticeIds = Array.from(new Set(
    (Array.isArray(candidate?.selectedNoticeIds) ? candidate.selectedNoticeIds : [])
      .map(compactText)
      .filter((id) => validIds.has(id))
  )).slice(0, 3);

  const titleIsValid = titleHook.length >= 4
    && titleHook.length <= 18
    && !/[\dA-Za-z，。；：、｜|/\\]/u.test(titleHook)
    && !FORBIDDEN_EDITORIAL_LANGUAGE.test(titleHook);
  const leadIsValid = lead.length >= 30
    && lead.length <= 110
    && !FORBIDDEN_EDITORIAL_LANGUAGE.test(lead);

  return {
    titleHook: titleIsValid ? titleHook : fallback.titleHook,
    lead: leadIsValid ? lead : fallback.lead,
    selectedNoticeIds: selectedNoticeIds.length ? selectedNoticeIds : fallback.selectedNoticeIds
  };
}

export function createProvidedEditorial({ candidate, notices, targetDate, categoryCounts = {} }) {
  const fallback = buildFallbackEditorial({ notices, targetDate, categoryCounts });
  const allowedKeys = new Set(['titleHook', 'lead', 'selectedNoticeIds']);
  const candidateKeys = candidate && typeof candidate === 'object' && !Array.isArray(candidate)
    ? Object.keys(candidate)
    : [];
  const inputIds = Array.isArray(candidate?.selectedNoticeIds)
    ? candidate.selectedNoticeIds.map(compactText)
    : [];
  const validated = validateEditorial(candidate, fallback, notices);
  const titleHook = compactText(candidate?.titleHook);
  const lead = compactText(candidate?.lead);
  const exactIds = inputIds.length >= 1
    && inputIds.length <= 3
    && inputIds.every((id, index) => id && inputIds.indexOf(id) === index)
    && inputIds.every((id, index) => validated.selectedNoticeIds[index] === id)
    && validated.selectedNoticeIds.length === inputIds.length;
  const exactShape = candidateKeys.length === 3
    && candidateKeys.every((key) => allowedKeys.has(key))
    && typeof candidate.titleHook === 'string'
    && typeof candidate.lead === 'string'
    && Array.isArray(candidate.selectedNoticeIds)
    && candidate.selectedNoticeIds.every((id) => typeof id === 'string');

  if (!exactShape || validated.titleHook !== titleHook || validated.lead !== lead || !exactIds) {
    throw new EditorialValidationError(
      'Codex editorial input must contain a restrained titleHook, lead, and 1-3 valid selectedNoticeIds'
    );
  }

  return {
    source: 'codex',
    model: 'chatgpt-plus-scheduled',
    responseId: '',
    fallbackReason: '',
    ...validated
  };
}

export function buildEditorialBrief({ notices, targetDate, categoryCounts = {} }) {
  return {
    targetDate,
    noticeCount: notices.length,
    categoryCounts,
    notices: notices.map((notice) => ({
      id: notice.id,
      school: notice.schoolName,
      department: notice.departmentName,
      project: notice.projectName,
      category: notice.category,
      deadline: notice.deadlineDate,
      daysUntilDeadline: deadlineDays(notice.deadlineDate, targetDate)
    }))
  };
}

function buildEditorialInput(notices, targetDate, categoryCounts) {
  return JSON.stringify(buildEditorialBrief({ notices, targetDate, categoryCounts }));
}

export async function createEditorialPlan({ notices, targetDate, categoryCounts, fetchImpl, env = {} }) {
  const fallback = buildFallbackEditorial({ notices, targetDate, categoryCounts });
  const apiKey = compactText(env.OPENAI_API_KEY);
  if (!apiKey || notices.length === 0) return fallback;

  const model = compactText(env.OPENAI_EDITORIAL_MODEL) || DEFAULT_EDITORIAL_MODEL;
  const timeoutMs = Math.max(5_000, Math.min(60_000, Number(env.OPENAI_EDITORIAL_TIMEOUT_MS) || 25_000));

  try {
    const response = await fetchImpl(OPENAI_RESPONSES_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        reasoning: { effort: 'none' },
        instructions: EDITORIAL_INSTRUCTIONS,
        input: buildEditorialInput(notices, targetDate, categoryCounts),
        max_output_tokens: 600,
        text: {
          format: {
            type: 'json_schema',
            name: 'wechat_editorial_plan',
            strict: true,
            schema: EDITORIAL_SCHEMA
          }
        }
      }),
      signal: AbortSignal.timeout(timeoutMs)
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      return { ...fallback, fallbackReason: `openai_http_${response.status}`, model };
    }

    const outputText = extractResponseText(payload);
    const candidate = outputText ? JSON.parse(outputText) : null;
    const validated = validateEditorial(candidate, fallback, notices);
    return {
      source: 'openai',
      model,
      responseId: compactText(payload?.id),
      fallbackReason: '',
      ...validated
    };
  } catch (error) {
    const reason = error?.name === 'TimeoutError' ? 'openai_timeout' : 'openai_invalid_response';
    return { ...fallback, fallbackReason: reason, model };
  }
}
