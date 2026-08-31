import { describe, expect, it } from 'vitest';
import {
  createDefaultProjectMaterialMeta,
  createMaterialManifest,
  normalizeProjectMaterialMeta
} from '@/lib/desktop-project-meta';
import {
  documentMaterialChecklistDefinitions,
  materialChecklistDefinitions
} from '@/lib/mock-data';
import { calculateMaterialsProgress } from '@/lib/cloudbase-data';

describe('desktop project material metadata', () => {
  it('provides stable defaults for every material', () => {
    const meta = createDefaultProjectMaterialMeta();
    expect(meta.cvReady.requirement).toBe('required');
    expect(meta.transcriptReady.version).toBe('v1');
    expect(documentMaterialChecklistDefinitions).toHaveLength(5);
    expect(materialChecklistDefinitions).toBe(documentMaterialChecklistDefinitions);
    expect('contactSupervisorDone' in meta).toBe(false);
  });

  it('calculates progress from five document files and ignores mentor contact state', () => {
    expect(calculateMaterialsProgress({
      cvReady: true,
      transcriptReady: true,
      rankingProofReady: true,
      recommendationReady: true,
      personalStatementReady: false,
      contactSupervisorDone: true
    })).toBe(80);
    expect(calculateMaterialsProgress({
      cvReady: true,
      transcriptReady: true,
      rankingProofReady: true,
      recommendationReady: true,
      personalStatementReady: true,
      contactSupervisorDone: false
    })).toBe(100);
  });

  it('normalizes unknown or malformed metadata without dropping the ledger', () => {
    const meta = normalizeProjectMaterialMeta({
      cvReady: { requirement: 'bad', version: '', submitted: true },
      transcriptReady: { fileName: 'transcript.pdf', applicable: false }
    });
    expect(meta.cvReady.requirement).toBe('required');
    expect(meta.cvReady.version).toBe('v1');
    expect(meta.cvReady.submitted).toBe(true);
    expect(meta.transcriptReady.fileName).toBe('transcript.pdf');
    expect(meta.transcriptReady.applicable).toBe(false);
    expect(meta.rankingProofReady.requirement).toBe('required');
  });

  it('creates an explicit manifest and states that official submission is still required', () => {
    const meta = createDefaultProjectMaterialMeta();
    meta.transcriptReady = {
      ...meta.transcriptReady,
      applicable: false,
      submitted: true
    };
    const text = createMaterialManifest('夏令营项目', '北京大学', meta);
    expect(text).toContain('北京大学');
    expect(text).toContain('简历');
    expect(text).toContain('成绩单｜必交｜不适用');
    expect(text).not.toContain('导师联系');
    expect(text).toContain('不会替代学校官方报名系统');
  });
});
