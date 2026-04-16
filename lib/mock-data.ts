export type ProjectType = '夏令营' | '预推免' | '正式推免';

export type PublicProjectStatus =
  | '未开始'
  | '报名中'
  | '即将截止'
  | '已截止'
  | '活动中'
  | '已结束';

export type DeadlineLevel = 'today' | 'within3days' | 'within7days' | 'future' | 'expired';

export type UserProjectStatus =
  | '已收藏'
  | '准备材料中'
  | '已提交'
  | '待考核'
  | '已通过'
  | '未通过'
  | '已放弃';

export type PriorityLevel = '高' | '中' | '低';

export type ResultStatus = '未出结果' | '待确认' | '已通过' | '未通过';

export type MaterialChecklistKey =
  | 'cvReady'
  | 'transcriptReady'
  | 'rankingProofReady'
  | 'recommendationReady'
  | 'personalStatementReady'
  | 'contactSupervisorDone';

export type ChangeLogEntry = {
  date: string;
  field: string;
  change: string;
};

export type HistoryRecord = {
  year: number;
  publishDate: string;
  deadlineDate: string;
  summary: string;
};

export type PublicNoticeProject = {
  id: string;
  schoolName: string;
  departmentName: string;
  projectName: string;
  projectType: ProjectType;
  discipline: string;
  publishDate: string;
  deadlineDate: string;
  eventStartDate: string;
  eventEndDate: string;
  applyLink: string;
  sourceLink: string;
  requirements: string;
  materialsRequired: string[];
  examInterviewInfo: string;
  contactInfo: string;
  remarks: string;
  tags: string[];
  status: PublicProjectStatus;
  year: number;
  deadlineLevel: DeadlineLevel;
  sourceSite: string;
  collectedAt: string;
  updatedAt: string;
  lastCheckedAt: string;
  isVerified: boolean;
  changeLog: ChangeLogEntry[];
  historyRecords: HistoryRecord[];
};

export type UserProjectRecord = {
  userProjectId: string;
  userId: string;
  projectId: string;
  isFavorited: boolean;
  myStatus: UserProjectStatus;
  priorityLevel: PriorityLevel;
  materialsProgress: number;
  cvReady: boolean;
  transcriptReady: boolean;
  rankingProofReady: boolean;
  recommendationReady: boolean;
  personalStatementReady: boolean;
  contactSupervisorDone: boolean;
  submittedAt: string;
  interviewTime: string;
  resultStatus: ResultStatus;
  myNotes: string;
  customReminderEnabled: boolean;
};

export type FieldGuideCategory = '公共项目字段' | '个人申请字段' | '系统字段';

export type FieldGuideItem = {
  key: string;
  label: string;
  category: FieldGuideCategory;
  description: string;
  example: string;
};

export type ApplicationColumnPreset = {
  key: string;
  label: string;
  description: string;
  sample: string;
  required: boolean;
};

export type StatusDefinition = {
  label: string;
  meaning: string;
  nextAction: string;
};

export const projectTypeOptions: Array<'全部类型' | ProjectType> = [
  '全部类型',
  '夏令营',
  '预推免',
  '正式推免'
];

export const publicStatusOptions: Array<'全部状态' | PublicProjectStatus> = [
  '全部状态',
  '未开始',
  '报名中',
  '即将截止',
  '已截止',
  '活动中',
  '已结束'
];

export const userStatusOptions: UserProjectStatus[] = [
  '已收藏',
  '准备材料中',
  '已提交',
  '待考核',
  '已通过',
  '未通过',
  '已放弃'
];

export const priorityOptions: PriorityLevel[] = ['高', '中', '低'];

export const materialChecklistDefinitions: Array<{ key: MaterialChecklistKey; label: string }> = [
  { key: 'cvReady', label: '简历' },
  { key: 'transcriptReady', label: '成绩单' },
  { key: 'rankingProofReady', label: '排名证明' },
  { key: 'recommendationReady', label: '推荐信' },
  { key: 'personalStatementReady', label: '个人陈述' },
  { key: 'contactSupervisorDone', label: '导师联系' }
];

export const applicationColumnPresets: ApplicationColumnPreset[] = [
  {
    key: 'school_name',
    label: '学校',
    description: '一眼识别这个项目属于哪所学校，是整张申请表最基础的定位列。',
    sample: '北京大学',
    required: true
  },
  {
    key: 'department_name',
    label: '学院 / 实验室',
    description: '尽量细化到学院、中心或实验室，避免同校多个项目混淆。',
    sample: '生命科学联合中心（北大方面）',
    required: true
  },
  {
    key: 'project_type',
    label: '项目类型',
    description: '统一使用夏令营、预推免、正式推免三种口径。',
    sample: '夏令营',
    required: true
  },
  {
    key: 'deadline_date',
    label: '截止时间',
    description: '必须精确到日期和时分，后续所有提醒和待办都围绕它生成。',
    sample: '2026-04-13 18:00',
    required: true
  },
  {
    key: 'my_status',
    label: '我的状态',
    description: '替代学生自己 Excel 里最混乱的状态列，用统一状态体系保证可跟踪。',
    sample: '准备材料中',
    required: true
  },
  {
    key: 'materials_progress',
    label: '材料完成度',
    description: '系统根据材料清单自动汇总为百分比，用来生成材料待办。',
    sample: '67%',
    required: true
  },
  {
    key: 'priority_level',
    label: '优先级',
    description: '按高、中、低排序，方便在同一周内明确先做哪些项目。',
    sample: '高',
    required: true
  },
  {
    key: 'custom_reminder_enabled',
    label: '提醒开关',
    description: '决定是否对这个项目开启 7 天、3 天、当天提醒。',
    sample: '开启',
    required: true
  },
  {
    key: 'my_notes',
    label: '个人备注',
    description: '记录导师反馈、策略判断、提交结果等个性化信息。',
    sample: '推荐信周一催老师，周二前提交',
    required: false
  }
];

export const statusDefinitions: StatusDefinition[] = [
  {
    label: '已收藏',
    meaning: '这个项目值得跟踪，但你还没开始正式准备材料。',
    nextAction: '先看材料要求，把关键文档列进待办。'
  },
  {
    label: '准备材料中',
    meaning: '已经确认要报，正在补简历、成绩单、推荐信等材料。',
    nextAction: '优先补齐未完成材料，并检查截止时间。'
  },
  {
    label: '已提交',
    meaning: '材料已经提交，后续关注面试、入营和补充材料通知。',
    nextAction: '等待结果，同时留意邮件和官网更新。'
  },
  {
    label: '待考核',
    meaning: '已经进入笔试、面试、入营确认等后续流程。',
    nextAction: '确认时间安排，处理面试和确认事项。'
  },
  {
    label: '已通过',
    meaning: '已经拿到正向结果，可以作为志愿管理的重要备份。',
    nextAction: '及时记录结果和后续确认节点。'
  },
  {
    label: '未通过',
    meaning: '该项目已结束，不再占用当前申请精力。',
    nextAction: '沉淀经验，转向其他更优先项目。'
  },
  {
    label: '已放弃',
    meaning: '主动放弃该项目，用来避免继续占用待办和提醒位。',
    nextAction: '保留记录即可，不再提醒。'
  }
];

export const guideTips = [
  '公共字段由平台统一维护，解决不同学生自己建表时字段命名不一致的问题。',
  '个人字段由学生自己填写，目标是把原本零散的 Excel 在线化，后续提醒和待办才能自动生成。',
  '系统字段展示来源、核验和变更记录，这一层是普通表格做不到、但网站可以持续提供的价值。'
];

export const noticeProjects: PublicNoticeProject[] = [
  {
    id: 'notice-pku-lsc-2026-summer',
    schoolName: '北京大学',
    departmentName: '生命科学联合中心（北大方面）',
    projectName: '2026 年暑期培训班招生简介',
    projectType: '夏令营',
    discipline: '生命科学',
    publishDate: '2026-03-19',
    deadlineDate: '2026-04-11 23:59',
    eventStartDate: '2026-06-20',
    eventEndDate: '2026-06-24',
    applyLink: 'https://mp.weixin.qq.com/s/c4HLevuAyljhRHrCI-PuzQ?scene=1&click_id=1',
    sourceLink: 'https://www.baoyantongzhi.com/notice/detail/24691',
    requirements:
      '欢迎生命科学、医学、化学、计算机、数学等相关背景本科生报名，要求成绩优秀、学术兴趣明确，并能在暑期全程参与课程与交流活动。',
    materialsRequired: ['简历', '成绩单', '排名证明', '英语成绩证明', '个人陈述'],
    examInterviewInfo: '以材料审核为主，是否安排面试以后续邮件或官网通知为准。',
    contactInfo: '见原文通知页面中的官方联系方式',
    remarks: '原文为微信图文，建议先保存原文链接，再把材料准备拆到自己的申请表里。',
    tags: ['985', '211', '双一流', '生命科学', '材料要求复杂'],
    status: '即将截止',
    year: 2026,
    deadlineLevel: 'today',
    sourceSite: '保研通知网',
    collectedAt: '2026-04-11 10:30',
    updatedAt: '2026-04-11 10:30',
    lastCheckedAt: '2026-04-11 10:30',
    isVerified: true,
    changeLog: [
      { date: '2026-04-10 22:10', field: '初次录入', change: '从保研通知网录入基础项目字段。' },
      { date: '2026-04-11 10:30', field: '材料要求', change: '补充简历、成绩单、排名证明、英语成绩与个人陈述。' }
    ],
    historyRecords: [
      { year: 2025, publishDate: '2025-03-17', deadlineDate: '2025-04-10 23:59', summary: '发布时间相近，截止时间略早。' },
      { year: 2024, publishDate: '2024-03-21', deadlineDate: '2024-04-12 23:59', summary: '往年同样要求生命科学与交叉背景。' }
    ]
  },
  {
    id: 'notice-sjtu-ai-2026-pre',
    schoolName: '上海交通大学',
    departmentName: '人工智能学院',
    projectName: '2026 年预推免报名通知',
    projectType: '预推免',
    discipline: '人工智能',
    publishDate: '2026-04-08',
    deadlineDate: '2026-04-13 18:00',
    eventStartDate: '2026-06-18',
    eventEndDate: '2026-06-20',
    applyLink: 'https://www.baoyantongzhi.com/notice',
    sourceLink: 'https://www.baoyantongzhi.com/notice/detail/24801',
    requirements:
      '面向人工智能、计算机、自动化等方向优秀本科生，建议具备算法、工程项目或科研训练经历。',
    materialsRequired: ['简历', '成绩单', '个人陈述', '项目经历说明', '英语成绩'],
    examInterviewInfo: '往年通常以材料审核加综合面试为主，今年以学院后续通知为准。',
    contactInfo: '建议优先通过学院官网或原文通知确认联系渠道',
    remarks: '适合作为高优先级项目尽快推进，尤其要留意项目经历说明与英语材料。',
    tags: ['985', '上海', '强 com', '需面试'],
    status: '即将截止',
    year: 2026,
    deadlineLevel: 'within3days',
    sourceSite: '保研通知网',
    collectedAt: '2026-04-11 10:30',
    updatedAt: '2026-04-11 10:30',
    lastCheckedAt: '2026-04-11 10:30',
    isVerified: true,
    changeLog: [
      { date: '2026-04-11 09:50', field: '初次录入', change: '补录截止时间和项目类型。' },
      { date: '2026-04-11 10:30', field: '申请条件', change: '补充算法与科研经历要求。' }
    ],
    historyRecords: [
      { year: 2025, publishDate: '2025-04-07', deadlineDate: '2025-04-12 18:00', summary: '去年同样属于 3 天内就要推进的高压项目。' }
    ]
  },
  {
    id: 'notice-zju-cs-2026-summer',
    schoolName: '浙江大学',
    departmentName: '计算机科学与技术学院',
    projectName: '2026 年优秀大学生夏令营通知',
    projectType: '夏令营',
    discipline: '计算机科学与技术',
    publishDate: '2026-04-09',
    deadlineDate: '2026-04-16 23:59',
    eventStartDate: '2026-06-28',
    eventEndDate: '2026-06-30',
    applyLink: 'https://www.baoyantongzhi.com/notice',
    sourceLink: 'https://www.baoyantongzhi.com/notice/detail/24816',
    requirements:
      '欢迎计算机、软件、网络安全等方向优秀学生申请，建议具备项目经历或科研经历。',
    materialsRequired: ['简历', '成绩单', '排名证明', '项目经历说明'],
    examInterviewInfo: '往年常见机试与综合面试，今年需重点关注原文是否有笔试安排。',
    contactInfo: '以学院官方渠道发布为准',
    remarks: '强 com 热门项目，建议尽早确定是否需要额外准备机试。',
    tags: ['985', '杭州', '强 com', '需笔试'],
    status: '报名中',
    year: 2026,
    deadlineLevel: 'within7days',
    sourceSite: '保研通知网',
    collectedAt: '2026-04-11 10:30',
    updatedAt: '2026-04-11 10:30',
    lastCheckedAt: '2026-04-11 10:30',
    isVerified: true,
    changeLog: [{ date: '2026-04-11 10:30', field: '初次录入', change: '录入项目基础字段与笔试提醒。' }],
    historyRecords: [
      { year: 2025, publishDate: '2025-04-11', deadlineDate: '2025-04-18 23:59', summary: '去年发布时间相近，机试安排更早公布。' }
    ]
  },
  {
    id: 'notice-ustc-auto-2026-pre',
    schoolName: '中国科学技术大学',
    departmentName: '自动化系',
    projectName: '2026 年预推免预报名通知',
    projectType: '预推免',
    discipline: '控制科学与工程',
    publishDate: '2026-04-04',
    deadlineDate: '2026-04-14 12:00',
    eventStartDate: '2026-07-03',
    eventEndDate: '2026-07-04',
    applyLink: 'https://www.baoyantongzhi.com/notice',
    sourceLink: 'https://www.baoyantongzhi.com/notice/detail/24766',
    requirements:
      '自动化、机器人、电子信息相关专业优秀学生均可申请，鼓励提前了解导师与研究方向。',
    materialsRequired: ['简历', '成绩单', '排名证明', '导师联系情况说明'],
    examInterviewInfo: '材料审核通过后安排面试，后续事项多通过邮件通知。',
    contactInfo: '以自动化系研究生招生通知为准',
    remarks: '这一类项目适合把“是否联系导师”单独作为待办，不要埋在备注里。',
    tags: ['985', '合肥', '导师联系', '预推免'],
    status: '即将截止',
    year: 2026,
    deadlineLevel: 'within3days',
    sourceSite: '保研通知网',
    collectedAt: '2026-04-11 10:30',
    updatedAt: '2026-04-11 10:30',
    lastCheckedAt: '2026-04-11 10:30',
    isVerified: true,
    changeLog: [{ date: '2026-04-11 10:30', field: '备注', change: '补充导师联系是关键动作。' }],
    historyRecords: [
      { year: 2025, publishDate: '2025-04-02', deadlineDate: '2025-04-13 12:00', summary: '往年同样需要尽快确认导师联系节奏。' }
    ]
  },
  {
    id: 'notice-fudan-econ-2026-formal',
    schoolName: '复旦大学',
    departmentName: '经济学院',
    projectName: '2026 年正式推免预接收通知',
    projectType: '正式推免',
    discipline: '应用经济学',
    publishDate: '2026-04-10',
    deadlineDate: '2026-04-20 17:00',
    eventStartDate: '2026-09-18',
    eventEndDate: '2026-09-21',
    applyLink: 'https://www.baoyantongzhi.com/notice',
    sourceLink: 'https://www.baoyantongzhi.com/notice/detail/24855',
    requirements:
      '欢迎经管相关专业学生申请，要求成绩优秀、英语能力良好，并具备较好的专业基础。',
    materialsRequired: ['简历', '成绩单', '英语成绩', '个人陈述', '获奖证明'],
    examInterviewInfo: '预计以综合面试为主，是否增加笔试以后续通知为准。',
    contactInfo: '建议保存原文链接，后续再核对学院官网',
    remarks: '偏长期跟踪项目，可先入表后分配优先级。',
    tags: ['985', '正式推免', '经管', '英语要求高'],
    status: '报名中',
    year: 2026,
    deadlineLevel: 'future',
    sourceSite: '保研通知网',
    collectedAt: '2026-04-11 10:30',
    updatedAt: '2026-04-11 10:30',
    lastCheckedAt: '2026-04-11 10:30',
    isVerified: false,
    changeLog: [{ date: '2026-04-11 10:30', field: '人工校验', change: '已同步待校验版本。' }],
    historyRecords: [
      { year: 2025, publishDate: '2025-04-08', deadlineDate: '2025-04-21 17:00', summary: '去年正式推免预接收通知节奏基本一致。' }
    ]
  },
  {
    id: 'notice-nju-business-2026-formal',
    schoolName: '南京大学',
    departmentName: '商学院',
    projectName: '2026 年正式推免接收通知',
    projectType: '正式推免',
    discipline: '应用经济学',
    publishDate: '2026-04-07',
    deadlineDate: '2026-04-25 17:00',
    eventStartDate: '2026-09-20',
    eventEndDate: '2026-09-22',
    applyLink: 'https://www.baoyantongzhi.com/notice',
    sourceLink: 'https://www.baoyantongzhi.com/notice/detail/24823',
    requirements:
      '要求具备较好的英语能力和专业基础，欢迎长期规划正式推免的同学提前关注。',
    materialsRequired: ['简历', '成绩单', '英语成绩', '个人陈述'],
    examInterviewInfo: '预计以面试为主，正式安排以后续通知为准。',
    contactInfo: '见原文通知中的学院招生联系方式',
    remarks: '属于相对后周期项目，适合在申请表里做长期跟踪与风险平衡。',
    tags: ['正式推免', '经管', '长期跟踪'],
    status: '报名中',
    year: 2026,
    deadlineLevel: 'future',
    sourceSite: '保研通知网',
    collectedAt: '2026-04-11 10:30',
    updatedAt: '2026-04-11 10:30',
    lastCheckedAt: '2026-04-11 10:30',
    isVerified: false,
    changeLog: [{ date: '2026-04-11 10:30', field: '初次录入', change: '录入正式推免接收通知。' }],
    historyRecords: [
      { year: 2025, publishDate: '2025-04-06', deadlineDate: '2025-04-24 17:00', summary: '往年截止时间同样处于 4 月下旬。' }
    ]
  },
  {
    id: 'notice-whu-cyber-2026-summer',
    schoolName: '武汉大学',
    departmentName: '国家网络安全学院',
    projectName: '2026 年优秀大学生暑期夏令营',
    projectType: '夏令营',
    discipline: '网络空间安全',
    publishDate: '2026-03-30',
    deadlineDate: '2026-04-08 23:59',
    eventStartDate: '2026-05-25',
    eventEndDate: '2026-05-27',
    applyLink: 'https://www.baoyantongzhi.com/notice',
    sourceLink: 'https://www.baoyantongzhi.com/notice/detail/24688',
    requirements:
      '要求网络安全相关背景，欢迎有科研、竞赛或工程经历的学生申请。',
    materialsRequired: ['简历', '成绩单', '竞赛证明', '个人陈述'],
    examInterviewInfo: '项目已截止，可以作为历史节奏和字段拆解参考。',
    contactInfo: '见原文通知',
    remarks: '已截止项目保留在库里，方便学生参考往年发布时间和材料结构。',
    tags: ['网安', '竞赛加分', '已截止'],
    status: '已截止',
    year: 2026,
    deadlineLevel: 'expired',
    sourceSite: '保研通知网',
    collectedAt: '2026-04-11 10:30',
    updatedAt: '2026-04-11 10:30',
    lastCheckedAt: '2026-04-11 10:30',
    isVerified: true,
    changeLog: [{ date: '2026-04-11 10:30', field: '状态', change: '标记为已截止并保留历史参考。' }],
    historyRecords: [
      { year: 2025, publishDate: '2025-03-28', deadlineDate: '2025-04-07 23:59', summary: '往年同样在 4 月上旬截止。' },
      { year: 2024, publishDate: '2024-03-29', deadlineDate: '2024-04-09 23:59', summary: '网安方向持续稳定在 4 月上旬开放。' }
    ]
  }
];

export const sampleUserProjects: UserProjectRecord[] = [
  {
    userProjectId: 'user-demo-pku',
    userId: 'demo-user',
    projectId: 'notice-pku-lsc-2026-summer',
    isFavorited: true,
    myStatus: '准备材料中',
    priorityLevel: '高',
    materialsProgress: 67,
    cvReady: true,
    transcriptReady: true,
    rankingProofReady: true,
    recommendationReady: false,
    personalStatementReady: true,
    contactSupervisorDone: false,
    submittedAt: '',
    interviewTime: '',
    resultStatus: '未出结果',
    myNotes: '今天优先补推荐信，并确认原文里是否需要额外英语证明。',
    customReminderEnabled: true
  },
  {
    userProjectId: 'user-demo-sjtu',
    userId: 'demo-user',
    projectId: 'notice-sjtu-ai-2026-pre',
    isFavorited: true,
    myStatus: '已收藏',
    priorityLevel: '高',
    materialsProgress: 33,
    cvReady: true,
    transcriptReady: false,
    rankingProofReady: false,
    recommendationReady: false,
    personalStatementReady: true,
    contactSupervisorDone: false,
    submittedAt: '',
    interviewTime: '',
    resultStatus: '未出结果',
    myNotes: '还差成绩单、排名证明和推荐信，48 小时内必须推进。',
    customReminderEnabled: true
  },
  {
    userProjectId: 'user-demo-zju',
    userId: 'demo-user',
    projectId: 'notice-zju-cs-2026-summer',
    isFavorited: true,
    myStatus: '已提交',
    priorityLevel: '中',
    materialsProgress: 100,
    cvReady: true,
    transcriptReady: true,
    rankingProofReady: true,
    recommendationReady: true,
    personalStatementReady: true,
    contactSupervisorDone: true,
    submittedAt: '2026-04-10 20:30',
    interviewTime: '2026-04-20 09:00',
    resultStatus: '待确认',
    myNotes: '已提交，等面试安排进一步确认。',
    customReminderEnabled: true
  },
  {
    userProjectId: 'user-demo-ustc',
    userId: 'demo-user',
    projectId: 'notice-ustc-auto-2026-pre',
    isFavorited: true,
    myStatus: '准备材料中',
    priorityLevel: '高',
    materialsProgress: 50,
    cvReady: true,
    transcriptReady: true,
    rankingProofReady: false,
    recommendationReady: false,
    personalStatementReady: true,
    contactSupervisorDone: false,
    submittedAt: '',
    interviewTime: '',
    resultStatus: '未出结果',
    myNotes: '导师联系还没做，建议今晚先发第一封邮件。',
    customReminderEnabled: true
  }
];

export const fieldGuideItems: FieldGuideItem[] = [
  {
    key: 'school_name',
    label: '学校名称',
    category: '公共项目字段',
    description: '项目所属学校，是所有筛选与统计的第一层维度。',
    example: '北京大学'
  },
  {
    key: 'department_name',
    label: '学院 / 系 / 实验室',
    category: '公共项目字段',
    description: '尽量定位到学院、中心或实验室层级，避免同校不同项目混淆。',
    example: '生命科学联合中心（北大方面）'
  },
  {
    key: 'project_type',
    label: '项目类型',
    category: '公共项目字段',
    description: '统一使用夏令营、预推免、正式推免三类口径。',
    example: '预推免'
  },
  {
    key: 'discipline',
    label: '学科方向',
    category: '公共项目字段',
    description: '用于快速筛掉不相关项目，也方便后续做方向聚合。',
    example: '人工智能'
  },
  {
    key: 'deadline_date',
    label: '截止时间',
    category: '公共项目字段',
    description: '建议精确到日和时分，这样网站才能做 7 天、3 天、当天提醒。',
    example: '2026-04-13 18:00'
  },
  {
    key: 'materials_required',
    label: '材料要求',
    category: '公共项目字段',
    description: '把原通知里的材料要求拆成列表，便于学生逐项勾选完成。',
    example: '简历、成绩单、推荐信、个人陈述'
  },
  {
    key: 'apply_link',
    label: '原文链接',
    category: '公共项目字段',
    description: '无论网站怎么结构化，最终都要保留原始官方入口，避免信息失真。',
    example: 'https://mp.weixin.qq.com/...'
  },
  {
    key: 'my_status',
    label: '我的状态',
    category: '个人申请字段',
    description: '记录你当前对这个项目的推进阶段，替代原来 Excel 里的手填状态列。',
    example: '准备材料中'
  },
  {
    key: 'priority_level',
    label: '优先级',
    category: '个人申请字段',
    description: '用高、中、低表达当周处理顺序，避免所有项目一起堆着看。',
    example: '高'
  },
  {
    key: 'materials_progress',
    label: '材料完成度',
    category: '个人申请字段',
    description: '系统根据材料勾选自动汇总为百分比，方便生成待办。',
    example: '67%'
  },
  {
    key: 'recommendation_ready',
    label: '推荐信是否完成',
    category: '个人申请字段',
    description: '推荐信往往最容易拖延，拆成单独字段后提醒会更准确。',
    example: 'false'
  },
  {
    key: 'contact_supervisor_done',
    label: '是否联系导师',
    category: '个人申请字段',
    description: '对于强调导师联系的项目，单独做成字段比塞进备注更有用。',
    example: 'true'
  },
  {
    key: 'my_notes',
    label: '个人备注',
    category: '个人申请字段',
    description: '记录导师反馈、提交感受、面试安排和个人判断。',
    example: '周二前催老师出推荐信'
  },
  {
    key: 'is_verified',
    label: '是否人工校验',
    category: '系统字段',
    description: '告诉学生这条通知是否已经经过人工复核。',
    example: 'true'
  },
  {
    key: 'last_checked_at',
    label: '最近核验时间',
    category: '系统字段',
    description: '显示平台最近一次复查这条通知的时间。',
    example: '2026-04-11 10:30'
  },
  {
    key: 'change_log',
    label: '变更记录',
    category: '系统字段',
    description: '记录截止时间、材料要求、活动时间等变化，方便学生判断是否需要补操作。',
    example: '补充科研经历说明字段'
  }
];

export const allSchoolOptions = ['全部学校', ...Array.from(new Set(noticeProjects.map((item) => item.schoolName)))];

export const allDisciplineOptions = ['全部方向', ...Array.from(new Set(noticeProjects.map((item) => item.discipline)))];

export const allTagOptions = ['全部标签', ...Array.from(new Set(noticeProjects.flatMap((item) => item.tags)))];
