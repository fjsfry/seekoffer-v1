import {
  documentMaterialChecklistDefinitions,
  type DocumentMaterialChecklistKey
} from './mock-data';

export type MaterialRequirement = 'required' | 'optional' | 'unknown';

export type DesktopMaterialMeta = {
  requirement: MaterialRequirement;
  fileName: string;
  version: string;
  lastModifiedAt: string;
  applicable: boolean;
  submitted: boolean;
  editableAfterSubmit: boolean;
};

export type DesktopProjectMaterialMeta = Record<DocumentMaterialChecklistKey, DesktopMaterialMeta>;

const PROJECT_META_STORAGE_KEY = 'seekoffer-desktop-project-meta-v1';

const defaultRequirement: Record<DocumentMaterialChecklistKey, MaterialRequirement> = {
  cvReady: 'required',
  transcriptReady: 'required',
  rankingProofReady: 'required',
  recommendationReady: 'required',
  personalStatementReady: 'required'
};

function createDefaultMeta(key: DocumentMaterialChecklistKey): DesktopMaterialMeta {
  return {
    requirement: defaultRequirement[key],
    fileName: '',
    version: 'v1',
    lastModifiedAt: '',
    applicable: true,
    submitted: false,
    editableAfterSubmit: false
  };
}

export function createDefaultProjectMaterialMeta(): DesktopProjectMaterialMeta {
  return Object.fromEntries(
    documentMaterialChecklistDefinitions.map(({ key }) => [key, createDefaultMeta(key)])
  ) as DesktopProjectMaterialMeta;
}

function normalizeMeta(value: unknown, key: DocumentMaterialChecklistKey): DesktopMaterialMeta {
  const base = createDefaultMeta(key);
  if (!value || typeof value !== 'object') return base;

  const record = value as Record<string, unknown>;
  const requirement = record.requirement;
  return {
    requirement:
      requirement === 'required' || requirement === 'optional' || requirement === 'unknown'
        ? requirement
        : base.requirement,
    fileName: String(record.fileName || '').trim().slice(0, 240),
    version: String(record.version || 'v1').trim().slice(0, 40) || 'v1',
    lastModifiedAt: String(record.lastModifiedAt || '').trim().slice(0, 32),
    applicable: record.applicable !== false,
    submitted: record.submitted === true,
    editableAfterSubmit: record.editableAfterSubmit === true
  };
}

export function normalizeProjectMaterialMeta(value: unknown): DesktopProjectMaterialMeta {
  const record = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  return Object.fromEntries(
    documentMaterialChecklistDefinitions.map(({ key }) => [key, normalizeMeta(record[key], key)])
  ) as DesktopProjectMaterialMeta;
}

type StoredProjectMeta = Record<string, DesktopProjectMaterialMeta>;

function storageKey(ownerId: string) {
  return `${PROJECT_META_STORAGE_KEY}:${encodeURIComponent(ownerId.trim() || 'local-device')}`;
}

export function readDesktopProjectMeta(ownerId: string): StoredProjectMeta {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(storageKey(ownerId));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return {};
    return Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>).map(([projectId, meta]) => [
        projectId,
        normalizeProjectMaterialMeta(meta)
      ])
    );
  } catch {
    return {};
  }
}

export function writeDesktopProjectMeta(ownerId: string, value: StoredProjectMeta) {
  if (typeof window === 'undefined') return false;
  try {
    window.localStorage.setItem(storageKey(ownerId), JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function getDesktopProjectMaterialMeta(
  allMeta: StoredProjectMeta,
  projectId: string
) {
  return normalizeProjectMaterialMeta(allMeta[projectId]);
}

export function createMaterialManifest(
  projectName: string,
  schoolName: string,
  meta: DesktopProjectMaterialMeta
) {
  const lines = [
    `寻鹿材料包清单`,
    `项目：${schoolName} · ${projectName}`,
    `生成时间：${new Date().toLocaleString('zh-CN')}`,
    '',
    ...documentMaterialChecklistDefinitions.map(({ key, label }) => {
      const item = meta[key];
      const requirement =
        item.requirement === 'required' ? '必交' : item.requirement === 'optional' ? '可选' : '待确认';
      const status = !item.applicable ? '不适用' : item.submitted ? '已提交' : '待处理';
      return `- ${label}｜${requirement}｜${status}｜${item.fileName || '未关联文件'}｜${item.version}`;
    }),
    '',
    '说明：该清单记录材料元数据，不会替代学校官方报名系统的文件提交。'
  ];
  return lines.join('\n');
}
