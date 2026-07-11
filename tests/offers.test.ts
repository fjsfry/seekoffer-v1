import { describe, expect, it } from 'vitest';
import { validateOfferSubmitInput } from '../lib/offers';

describe('Offer submission validation', () => {
  it('normalizes a complete submission without changing its meaning', () => {
    const result = validateOfferSubmitInput({
      userId: 'user-1',
      authorName: '  同学 A  ',
      schoolName: '浙江大学',
      major: '计算机科学与技术',
      projectType: '夏令营',
      result: '录取',
      undergraduateBackground: '华东地区 211，专业前 10%',
      content: '  已收到学院邮件确认，面试包含专业问答和项目介绍。  ',
      isAnonymous: true
    });

    expect(result.authorName).toBe('同学 A');
    expect(result.content).toContain('学院邮件确认');
  });

  it('rejects vague posts that do not provide useful context', () => {
    expect(() =>
      validateOfferSubmitInput({
        userId: 'user-1',
        authorName: '同学 A',
        schoolName: '浙江大学',
        major: '计算机',
        projectType: '夏令营',
        result: '录取',
        undergraduateBackground: '211',
        content: '已录取',
        isAnonymous: true
      })
    ).toThrow('至少 12 个字');
  });
});
