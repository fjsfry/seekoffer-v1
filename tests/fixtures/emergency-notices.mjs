export function emergencyNotices(count = 205) {
  return Array.from({ length: count }, (_, i) => ({
    id: 'offline-' + i, schoolName: i % 2 ? '北京大学' : '清华大学', departmentName: '计算机学院',
    projectName: '2026年计算机推免招生通知 ' + i, projectType: '预推免', discipline: '计算机科学与技术',
    publishDate: '2026-09-07', deadlineDate: i % 3 ? '2026-09-20' : '', eventStartDate: '', eventEndDate: '',
    sourceLink: 'https://example.edu.cn/notice/' + i, applyLink: '', requirements: '仅用于离线验收的固定样本。',
    materialsRequired: ['个人陈述'], examInterviewInfo: '', contactInfo: '', remarks: '',
    tags: [i % 2 ? '北京' : '上海', '985'], status: '报名中', year: 2026, deadlineLevel: 'future',
    sourceSite: '离线测试样本', collectedAt: '2026-09-07', updatedAt: '2026-09-07', lastCheckedAt: '',
    isVerified: false, changeLog: [], historyRecords: []
  }));
}
