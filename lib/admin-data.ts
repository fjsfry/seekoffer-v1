import { baseNoticeProjects } from './notice-source';
import { offerFeedItems } from './portal-data';

export type AdminRole = 'super_admin' | 'content_reviewer' | 'ops_manager' | 'readonly_admin';

export type AdminAccount = {
  email: string;
  password: string;
  name: string;
  role: AdminRole;
};

export type AdminMetric = {
  label: string;
  value: string;
  hint: string;
  tone: 'blue' | 'green' | 'amber' | 'rose' | 'purple' | 'slate';
};

export type TrendPoint = {
  date: string;
  users: number;
  notices: number;
  offers: number;
  applications: number;
};

export type AdminNoticeRow = {
  id: string;
  title: string;
  school: string;
  department: string;
  type: string;
  sourceUrl: string;
  submitter: string;
  submittedAt: string;
  deadline: string;
  status: '待审核' | '已发布' | '已驳回' | '已下架' | '已删除';
  views: number;
  saves: number;
};

export type AdminOfferRow = {
  id: string;
  user: string;
  avatar: string;
  school: string;
  major: string;
  projectType: string;
  result: string;
  background: string;
  anonymous: boolean;
  submittedAt: string;
  status: '待审核' | '已通过' | '已驳回' | '已隐藏' | '已删除';
  reports: number;
};

export type AdminUserRow = {
  id: string;
  nickname: string;
  contact: string;
  registeredAt: string;
  lastActiveAt: string;
  noticeCount: number;
  offerCount: number;
  applicationCount: number;
  status: '正常' | '限制' | '封禁' | '已注销';
};

export type AdminFeedbackRow = {
  id: string;
  type: '反馈' | '举报';
  module: '通知内容' | 'Offer信息' | '系统功能' | '用户行为';
  user: string;
  content: string;
  submittedAt: string;
  status: '待处理' | '处理中' | '已解决' | '已关闭';
  handler: string;
};

export type AdminOperationLog = {
  id: string;
  operator: string;
  action: string;
  module: string;
  target: string;
  ip: string;
  result: '成功' | '失败';
  remark: string;
  createdAt: string;
};

export const adminAccounts: AdminAccount[] = [
  {
    email: 'admin@seekoffer.cn',
    password: 'seekoffer-admin',
    name: 'admin',
    role: 'super_admin'
  },
  {
    email: 'ops@seekoffer.cn',
    password: 'seekoffer-ops',
    name: '运营小鹿',
    role: 'ops_manager'
  }
];

const sortedNotices = [...baseNoticeProjects].sort((left, right) =>
  (right.publishDate || '').localeCompare(left.publishDate || '')
);

const noticeStatusPool: AdminNoticeRow['status'][] = ['待审核', '已发布', '已发布', '已发布', '已驳回', '已下架'];

export const adminNoticeRows: AdminNoticeRow[] = sortedNotices.slice(0, 48).map((item, index) => ({
  id: item.id,
  title: item.projectName,
  school: item.schoolName || '待识别学校',
  department: item.departmentName || '待补充学院',
  type: item.projectType || '其他通知',
  sourceUrl: item.sourceLink || 'https://www.seekoffer.com.cn/notices',
  submitter: index % 5 === 0 ? '用户提交' : index % 3 === 0 ? '运营录入' : '系统同步',
  submittedAt: item.updatedAt?.slice(0, 16).replace('T', ' ') || `${item.publishDate} 10:${String(index).padStart(2, '0')}`,
  deadline: item.deadlineDate || '待确认',
  status: noticeStatusPool[index % noticeStatusPool.length],
  views: 820 + index * 37,
  saves: 18 + index * 3
}));

export const adminOfferRows: AdminOfferRow[] = offerFeedItems.map((item, index) => ({
  id: item.id,
  user: item.author || `用户_${10230 + index}`,
  avatar: item.avatar || String.fromCharCode(65 + index),
  school: item.school || item.goTo.split('·')[0] || '待补充学校',
  major: item.major || item.field || '待补充专业',
  projectType: index % 3 === 0 ? '夏令营' : index % 3 === 1 ? '预推免' : '九推',
  result: item.type,
  background: index % 2 === 0 ? '985' : index % 3 === 0 ? '211' : '双非',
  anonymous: !item.verified,
  submittedAt: `2026-04-${String(27 - index).padStart(2, '0')} ${String(10 + index).padStart(2, '0')}:21`,
  status: index === 0 ? '待审核' : index === 1 ? '已通过' : index === 2 ? '已隐藏' : '已通过',
  reports: index === 0 ? 2 : index === 2 ? 1 : 0
}));

export const adminUsers: AdminUserRow[] = [
  ['1000001', 'Alice_zh', '138****1234 / alice@example.com', '2026-04-12 09:15', '2026-04-27 16:30', 18, 7, 25, '正常'],
  ['1000002', '求职小达人', '159****5678 / jobseek@qq.com', '2026-04-13 14:22', '2026-04-27 15:05', 32, 12, 43, '正常'],
  ['1000003', 'Sunny', '186****9012 / sunny_99@163.com', '2026-04-14 11:03', '2026-04-27 12:18', 5, 2, 11, '限制'],
  ['1000004', 'FutureHunter', '137****2468 / future@outlook.com', '2026-04-15 16:47', '2026-04-27 08:50', 41, 15, 60, '正常'],
  ['1000005', '小李同学', '152****1357 / xiaoli@mail.com', '2026-04-16 10:21', '2026-04-26 18:30', 9, 3, 14, '限制'],
  ['1000006', 'Offer收割机', '199****8888 / offering@126.com', '2026-04-17 08:33', '2026-04-26 20:11', 56, 22, 78, '正常'],
  ['1000007', 'Dreamer', '147****3698 / dreamer@gmail.com', '2026-04-18 13:55', '2026-04-26 17:40', 2, 1, 3, '封禁'],
  ['1000008', 'career_go', '181****2460 / career.go@qq.com', '2026-04-19 20:09', '2026-04-27 07:55', 27, 9, 28, '正常']
].map(([id, nickname, contact, registeredAt, lastActiveAt, noticeCount, offerCount, applicationCount, status]) => ({
  id: String(id),
  nickname: String(nickname),
  contact: String(contact),
  registeredAt: String(registeredAt),
  lastActiveAt: String(lastActiveAt),
  noticeCount: Number(noticeCount),
  offerCount: Number(offerCount),
  applicationCount: Number(applicationCount),
  status: status as AdminUserRow['status']
}));

export const adminFeedbackRows: AdminFeedbackRow[] = [
  ['fb-1', '举报', 'Offer信息', '用户_10234', '该 Offer 信息存在虚假内容，需要平台核验。', '2026-04-27 16:21', '待处理', '-'],
  ['fb-2', '反馈', '系统功能', '用户_10086', '希望增加筛选功能，方便按学院和专业查找。', '2026-04-27 15:45', '处理中', 'admin'],
  ['fb-3', '举报', '用户行为', '用户_10321', '该用户发布不当言论，影响社区氛围。', '2026-04-27 14:33', '待处理', '-'],
  ['fb-4', '反馈', '通知内容', '用户_10111', '通知详情页来源链接跳转异常，建议修正。', '2026-04-26 18:16', '已解决', '张三'],
  ['fb-5', '举报', 'Offer信息', '用户_10001', '存在联系方式引流内容。', '2026-04-26 16:02', '已解决', '李四'],
  ['fb-6', '反馈', '系统功能', '用户_10028', '移动端页面加载速度偏慢。', '2026-04-25 14:55', '已关闭', '王五']
].map(([id, type, module, user, content, submittedAt, status, handler]) => ({
  id: String(id),
  type: type as AdminFeedbackRow['type'],
  module: module as AdminFeedbackRow['module'],
  user: String(user),
  content: String(content),
  submittedAt: String(submittedAt),
  status: status as AdminFeedbackRow['status'],
  handler: String(handler)
}));

export const adminOperationLogs: AdminOperationLog[] = [
  ['log-1', 'admin', '审核通知', '通知管理', '通知 #1836', '101.42.120.88', '成功', '通过通知审核', '2026-04-27 16:30:45'],
  ['log-2', 'admin', '删除 Offer', 'Offer池', 'Offer #5678', '101.42.120.88', '成功', '内容违规', '2026-04-27 15:18:22'],
  ['log-3', 'admin', '封禁用户', '用户管理', '用户：张三', '101.42.120.88', '成功', '发布违规内容', '2026-04-27 14:55:03'],
  ['log-4', '运营小李', '修改权限', '角色权限', '角色：运营专员', '120.232.18.76', '成功', '调整菜单权限', '2026-04-27 14:32:17'],
  ['log-5', '运营小周', '处理举报', '反馈举报', '举报 #2391', '120.232.18.76', '成功', '举报成立，已处理', '2026-04-27 13:47:58'],
  ['log-6', '系统', '登录后台', '系统', '-', '101.42.120.88', '失败', '密码错误', '2026-04-27 09:15:48']
].map(([id, operator, action, module, target, ip, result, remark, createdAt]) => ({
  id: String(id),
  operator: String(operator),
  action: String(action),
  module: String(module),
  target: String(target),
  ip: String(ip),
  result: result as AdminOperationLog['result'],
  remark: String(remark),
  createdAt: String(createdAt)
}));

export const adminTrendPoints: TrendPoint[] = [
  { date: '04-21', users: 452, notices: 1230, offers: 82, applications: 520 },
  { date: '04-22', users: 512, notices: 1410, offers: 87, applications: 580 },
  { date: '04-23', users: 478, notices: 1180, offers: 76, applications: 540 },
  { date: '04-24', users: 623, notices: 1650, offers: 102, applications: 720 },
  { date: '04-25', users: 589, notices: 1590, offers: 96, applications: 690 },
  { date: '04-26', users: 714, notices: 1800, offers: 112, applications: 810 },
  { date: '04-27', users: 676, notices: 1720, offers: 105, applications: 770 }
];

export const dashboardMetrics: AdminMetric[] = [
  { label: '总用户数', value: '12,846', hint: '累计注册账号', tone: 'blue' },
  { label: '待审核通知', value: String(adminNoticeRows.filter((item) => item.status === '待审核').length), hint: '需要人工确认', tone: 'amber' },
  { label: '待审核 Offer', value: String(adminOfferRows.filter((item) => item.status === '待审核').length), hint: '优先排查隐私与真实性', tone: 'purple' },
  { label: '待处理举报', value: String(adminFeedbackRows.filter((item) => item.status === '待处理').length), hint: '内容与账号风险', tone: 'rose' },
  { label: '今日新增用户', value: '126', hint: '较昨日 +14%', tone: 'green' },
  { label: '申请记录总数', value: '54,219', hint: '只做统计，不进入个人内容', tone: 'blue' }
];

export const noticeMetrics: AdminMetric[] = [
  { label: '待审核', value: String(adminNoticeRows.filter((item) => item.status === '待审核').length), hint: '提交后未发布', tone: 'amber' },
  { label: '已发布', value: String(adminNoticeRows.filter((item) => item.status === '已发布').length), hint: '前台可见', tone: 'green' },
  { label: '已驳回', value: String(adminNoticeRows.filter((item) => item.status === '已驳回').length), hint: '不符合规范', tone: 'rose' },
  { label: '已删除', value: String(adminNoticeRows.filter((item) => item.status === '已删除').length), hint: '逻辑删除', tone: 'slate' }
];

export const offerMetrics: AdminMetric[] = [
  { label: '待审核', value: String(adminOfferRows.filter((item) => item.status === '待审核').length), hint: '新提交动态', tone: 'purple' },
  { label: '已通过', value: String(adminOfferRows.filter((item) => item.status === '已通过').length), hint: '前台可见', tone: 'green' },
  { label: '已隐藏', value: String(adminOfferRows.filter((item) => item.status === '已隐藏').length), hint: '软下架', tone: 'amber' },
  { label: '已删除', value: String(adminOfferRows.filter((item) => item.status === '已删除').length), hint: '逻辑删除', tone: 'rose' }
];

export const userMetrics: AdminMetric[] = [
  { label: '总用户数', value: '12,846', hint: '累计注册用户', tone: 'blue' },
  { label: '今日新增', value: '126', hint: '新增账号', tone: 'green' },
  { label: '正常用户', value: '12,430', hint: '可正常使用', tone: 'blue' },
  { label: '封禁用户', value: String(adminUsers.filter((item) => item.status === '封禁').length), hint: '风险账号', tone: 'rose' }
];

export const feedbackMetrics: AdminMetric[] = [
  { label: '待处理', value: String(adminFeedbackRows.filter((item) => item.status === '待处理').length), hint: '需要运营处理', tone: 'rose' },
  { label: '处理中', value: String(adminFeedbackRows.filter((item) => item.status === '处理中').length), hint: '已有处理人', tone: 'amber' },
  { label: '已解决', value: String(adminFeedbackRows.filter((item) => item.status === '已解决').length), hint: '用户问题已闭环', tone: 'green' },
  { label: '已关闭', value: String(adminFeedbackRows.filter((item) => item.status === '已关闭').length), hint: '无需继续处理', tone: 'slate' }
];

export const logMetrics: AdminMetric[] = [
  { label: '今日操作', value: '128', hint: '后台关键动作', tone: 'blue' },
  { label: '删除操作', value: '12', hint: '需重点留痕', tone: 'rose' },
  { label: '封禁操作', value: '3', hint: '账号风险处置', tone: 'amber' },
  { label: '异常登录', value: '1', hint: '安全提醒', tone: 'purple' }
];
