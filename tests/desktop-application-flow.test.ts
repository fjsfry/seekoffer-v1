import { describe, expect, it } from 'vitest';
import {
  getApplicationJourney,
  getApplicationJourneyProgress
} from '@/lib/desktop-application-flow';

function row(overrides: Record<string, unknown> = {}) {
  return {
    item: {
      isFavorited: true,
      myStatus: '准备材料中',
      submittedAt: '',
      interviewTime: '',
      resultStatus: '未出结果',
      cvReady: false,
      transcriptReady: true,
      rankingProofReady: true,
      recommendationReady: true,
      personalStatementReady: true,
      contactSupervisorDone: true,
      ...overrides
    },
    project: { deadlineDate: '2026-08-20 18:00' }
  } as never;
}

describe('desktop application journey', () => {
  it('prioritizes the first incomplete material as the next action', () => {
    const journey = getApplicationJourney(row());
    expect(journey.stage).toBe('准备材料');
    expect(journey.action).toBe('补齐简历');
    expect(journey.tab).toBe('materials');
    expect(journey.command).toBe('open_materials');
  });

  it('does not let optional or inapplicable files block the next step', () => {
    const journey = getApplicationJourney(row({
      cvReady: false,
      contactSupervisorDone: false
    }), {
      cvReady: { requirement: 'optional', applicable: true },
      transcriptReady: { requirement: 'required', applicable: false }
    });

    expect(journey.action).toBe('更新导师联系状态');
    expect(journey.command).toBe('open_contacts');
  });

  it('asks the user to confirm an unknown requirement after known required blockers are clear', () => {
    const journey = getApplicationJourney(row({
      cvReady: true,
      transcriptReady: true,
      contactSupervisorDone: true
    }), {
      transcriptReady: { requirement: 'unknown', applicable: true }
    });

    expect(journey.action).toBe('确认成绩单是否必交');
    expect(journey.tab).toBe('materials');
  });

  it('finishes known required blockers before asking about an unknown requirement', () => {
    const journey = getApplicationJourney(row({
      cvReady: false,
      transcriptReady: false
    }), {
      cvReady: { requirement: 'unknown', applicable: true },
      transcriptReady: { requirement: 'required', applicable: true }
    });

    expect(journey.action).toBe('补齐成绩单');
  });

  it('moves submitted projects into waiting notification until an interview time exists', () => {
    expect(getApplicationJourney(row({ myStatus: '已提交', submittedAt: '2026-08-01 10:00' })).stage).toBe('已提交');
    expect(getApplicationJourney(row({ myStatus: '待考核' })).stage).toBe('等待通知');
    expect(getApplicationJourney(row({ myStatus: '待考核', interviewTime: '2026-08-18 09:00' })).stage).toBe('面试/复试');
  });

  it('routes a project with complete required materials to mentor follow-up', () => {
    const journey = getApplicationJourney(row({
      cvReady: true,
      transcriptReady: true,
      rankingProofReady: true,
      recommendationReady: true,
      personalStatementReady: true,
      contactSupervisorDone: false
    }));
    expect(journey.action).toBe('更新导师联系状态');
    expect(journey.tab).toBe('contacts');
  });

  it('turns a followed project into a real start-preparation action', () => {
    const journey = getApplicationJourney(row({
      myStatus: '已收藏',
      cvReady: false,
      contactSupervisorDone: false
    }));
    expect(journey.action).toBe('核对信息并开始准备');
    expect(journey.command).toBe('start_preparation');
    expect(journey.tab).toBe('schedule');
  });

  it('offers a submission confirmation after files and mentor follow-up are ready', () => {
    const journey = getApplicationJourney(row({
      cvReady: true,
      transcriptReady: true,
      rankingProofReady: true,
      recommendationReady: true,
      personalStatementReady: true,
      contactSupervisorDone: true
    }));
    expect(journey.action).toBe('确认并提交申请');
    expect(journey.command).toBe('confirm_submission');
  });

  it('uses result as the terminal stage', () => {
    const journey = getApplicationJourney(row({ myStatus: '已通过', resultStatus: '已通过' }));
    expect(journey.stage).toBe('结果');
    expect(journey.state).toBe('completed');
    expect(journey.completed).toBe(true);
  });

  it('does not treat a pending result confirmation as a final result', () => {
    const journey = getApplicationJourney(row({ resultStatus: '待确认' }));
    expect(journey.stage).toBe('准备材料');
    expect(journey.state).toBe('active');
  });

  it('puts abandoned applications into a stopped state with a recoverable action', () => {
    const journey = getApplicationJourney(row({ myStatus: '已放弃', resultStatus: '待确认' }));
    expect(journey.stage).toBe('已停止');
    expect(journey.stageIndex).toBe(-1);
    expect(journey.state).toBe('stopped');
    expect(journey.command).toBe('resume_application');
    expect(journey.completed).toBe(false);
  });

  it('summarizes progress without treating the current stage as completed', () => {
    const journey = getApplicationJourney(row({
      myStatus: '准备材料中',
      cvReady: false
    }));

    expect(getApplicationJourneyProgress(journey)).toEqual({
      completedStages: 2,
      totalStages: 7,
      currentStage: '准备材料',
      summary: '已完成 2/7 · 当前：准备材料'
    });
  });

  it('reports completed and stopped journeys without inventing progress', () => {
    const completed = getApplicationJourney(row({ myStatus: '已通过', resultStatus: '已通过' }));
    const stopped = getApplicationJourney(row({ myStatus: '已放弃' }));

    expect(getApplicationJourneyProgress(completed).summary).toBe('已完成 7/7 · 当前：结果');
    expect(getApplicationJourneyProgress(stopped)).toEqual({
      completedStages: 0,
      totalStages: 7,
      currentStage: '已停止',
      summary: '流程已停止 · 可随时恢复'
    });
  });
});
