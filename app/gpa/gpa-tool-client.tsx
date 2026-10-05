'use client';

import { useEffect, useMemo, useRef, useState, type ChangeEvent, type ComponentType } from 'react';
import {
  BarChart3,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  Database,
  Download,
  FileUp,
  Gauge,
  Layers3,
  Plus,
  RotateCcw,
  Save,
  Target,
  Trash2,
  Upload
} from 'lucide-react';

type Semester = '1-1' | '1-2' | '2-1' | '2-2' | '3-1' | '3-2' | '4-1' | '4-2';
type CourseType = 'required' | 'core' | 'elective' | 'general' | 'public' | 'other';
type ScoreType = 'percentage' | 'gpa4' | 'gpa5' | 'grade' | 'pass_fail';
type GpaAlgorithm = 'standard4' | 'pku4' | 'zju' | 'wes' | 'weighted';
type Scope = 'all' | 'baoyan' | 'core' | 'required';
type SemesterFilter = 'all' | 'first4' | 'first5' | 'first6' | Semester;
type MaterialStatus = 'todo' | 'doing' | 'done';
type TabKey = 'courses' | 'gpa' | 'materials' | 'goal' | 'backup';

type Course = {
  id: string;
  name: string;
  credit: number;
  score: string;
  scoreType: ScoreType;
  semester: Semester;
  type: CourseType;
  countForGpa: boolean;
};

type BonusItem = {
  id: string;
  category: string;
  name: string;
  level: string;
  score: number;
};

type MaterialTask = {
  id: string;
  title: string;
  category: string;
  status: MaterialStatus;
  deadline: string;
  note: string;
};

type ToolSettings = {
  scope: Scope;
  semester: SemesterFilter;
  compAlgo: GpaAlgorithm;
  academicWeight: number;
  bonusWeight: number;
  bonusCap: string;
  goalAlgo: GpaAlgorithm;
  goalGpa: string;
  goalCredits: string;
};

type GpaResult = {
  algo: GpaAlgorithm;
  gpa: number;
  totalCredits: number;
  totalWeighted: number;
  skippedCredits: number;
};

type PersistedState = {
  version: 1;
  courses: Course[];
  bonusItems: BonusItem[];
  materials: MaterialTask[];
  settings: ToolSettings;
  updatedAt?: string;
};

const STORAGE_KEY = 'seekoffer:gpa-tool:v1';

const SEMESTER_OPTIONS: Array<{ value: Semester; label: string }> = [
  { value: '1-1', label: '大一上' },
  { value: '1-2', label: '大一下' },
  { value: '2-1', label: '大二上' },
  { value: '2-2', label: '大二下' },
  { value: '3-1', label: '大三上' },
  { value: '3-2', label: '大三下' },
  { value: '4-1', label: '大四上' },
  { value: '4-2', label: '大四下' }
];

const SEMESTER_PRESETS: Record<'first4' | 'first5' | 'first6', Semester[]> = {
  first4: ['1-1', '1-2', '2-1', '2-2'],
  first5: ['1-1', '1-2', '2-1', '2-2', '3-1'],
  first6: ['1-1', '1-2', '2-1', '2-2', '3-1', '3-2']
};

const COURSE_TYPE_OPTIONS: Array<{ value: CourseType; label: string }> = [
  { value: 'required', label: '专业必修' },
  { value: 'core', label: '学科基础' },
  { value: 'elective', label: '专业选修' },
  { value: 'general', label: '通识课' },
  { value: 'public', label: '公共必修' },
  { value: 'other', label: '其他' }
];

const SCORE_TYPE_OPTIONS: Array<{ value: ScoreType; label: string }> = [
  { value: 'percentage', label: '百分制' },
  { value: 'gpa4', label: '4.0 绩点' },
  { value: 'gpa5', label: '5.0 绩点' },
  { value: 'grade', label: '等级制' },
  { value: 'pass_fail', label: 'P/F 制' }
];

const ALGORITHM_OPTIONS: Array<{ value: GpaAlgorithm; label: string; scale: string }> = [
  { value: 'standard4', label: '标准 4.0', scale: '满分 4.0' },
  { value: 'pku4', label: '北大 4.0', scale: '满分 4.0' },
  { value: 'zju', label: '浙大算法', scale: '满分 4.0' },
  { value: 'wes', label: 'WES', scale: '满分 4.0' },
  { value: 'weighted', label: '百分制加权', scale: '满分 100' }
];

const DEFAULT_SETTINGS: ToolSettings = {
  scope: 'baoyan',
  semester: 'first5',
  compAlgo: 'weighted',
  academicWeight: 80,
  bonusWeight: 20,
  bonusCap: '',
  goalAlgo: 'standard4',
  goalGpa: '3.70',
  goalCredits: '12'
};

const DEFAULT_MATERIALS: MaterialTask[] = [
  { id: 'resume', title: '申请简历', category: '基础材料', status: 'todo', deadline: '', note: '' },
  { id: 'transcript', title: '成绩单', category: '基础材料', status: 'todo', deadline: '', note: '' },
  { id: 'rank-proof', title: '排名证明', category: '基础材料', status: 'todo', deadline: '', note: '' },
  { id: 'personal-statement', title: '个人陈述', category: '文书材料', status: 'todo', deadline: '', note: '' },
  { id: 'recommendation', title: '推荐信', category: '文书材料', status: 'todo', deadline: '', note: '' },
  { id: 'mentor-email', title: '导师邮件', category: '沟通材料', status: 'todo', deadline: '', note: '' },
  { id: 'deadline-check', title: '项目截止提醒', category: '进度检查', status: 'todo', deadline: '', note: '' }
];

const EMPTY_COURSE: Omit<Course, 'id'> = {
  name: '',
  credit: 3,
  score: '',
  scoreType: 'percentage',
  semester: '1-1',
  type: 'required',
  countForGpa: true
};

const EMPTY_BONUS: Omit<BonusItem, 'id'> = {
  category: '科研论文',
  name: '',
  level: '',
  score: 0
};

const inputClassName =
  'w-full rounded-2xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-ink outline-none transition placeholder:text-slate-400 focus:border-brand/40 focus:ring-4 focus:ring-brand/8';
const compactInputClassName =
  'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-ink outline-none transition placeholder:text-slate-400 focus:border-brand/40 focus:ring-4 focus:ring-brand/8';

function createId(prefix: string) {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function formatNumber(value: number, digits = 2) {
  if (!Number.isFinite(value)) return '--';
  return value.toFixed(digits);
}

function getLabel<T extends string>(options: Array<{ value: T; label: string }>, value: T) {
  return options.find((item) => item.value === value)?.label || value;
}

function toPercentage(score: string | number, scoreType: ScoreType) {
  const numeric = typeof score === 'number' ? score : Number.parseFloat(score);

  if (scoreType === 'pass_fail') return null;
  if (scoreType === 'percentage') return Number.isFinite(numeric) ? clamp(numeric, 0, 100) : null;
  if (scoreType === 'gpa4') {
    if (!Number.isFinite(numeric)) return null;
    if (numeric >= 4) return 95;
    if (numeric >= 3.7) return 87;
    if (numeric >= 3.3) return 83;
    if (numeric >= 3) return 80;
    if (numeric >= 2.7) return 77;
    if (numeric >= 2.3) return 74;
    if (numeric >= 2) return 71;
    if (numeric >= 1.5) return 67;
    if (numeric >= 1) return 63;
    return 50;
  }
  if (scoreType === 'gpa5') {
    if (!Number.isFinite(numeric)) return null;
    if (numeric >= 4.5) return 95;
    if (numeric >= 3.5) return 85;
    if (numeric >= 2.5) return 75;
    if (numeric >= 1.5) return 65;
    return 55;
  }

  const gradeMap: Record<string, number> = {
    'A+': 97,
    A: 95,
    'A-': 90,
    'B+': 87,
    B: 85,
    'B-': 82,
    'C+': 77,
    C: 75,
    'C-': 72,
    'D+': 67,
    D: 65,
    F: 50,
    P: 85,
    PASS: 85,
    合格: 85,
    优: 95,
    良: 85,
    中: 75,
    及格: 65,
    不及格: 50
  };

  return gradeMap[String(score).trim().toUpperCase()] ?? gradeMap[String(score).trim()] ?? null;
}

function scoreByAlgorithm(score: number, algo: GpaAlgorithm) {
  if (algo === 'weighted') return score;
  if (algo === 'standard4') {
    if (score >= 90) return 4;
    if (score >= 80) return 3;
    if (score >= 70) return 2;
    if (score >= 60) return 1;
    return 0;
  }
  if (algo === 'pku4') {
    if (score >= 90) return 4;
    if (score >= 85) return 3.7;
    if (score >= 82) return 3.3;
    if (score >= 78) return 3;
    if (score >= 75) return 2.7;
    if (score >= 72) return 2.3;
    if (score >= 68) return 2;
    if (score >= 64) return 1.5;
    if (score >= 60) return 1;
    return 0;
  }
  if (algo === 'zju') {
    if (score >= 85) return 4;
    if (score >= 75) return 3 + (score - 75) * 0.1;
    if (score >= 65) return 2 + (score - 65) * 0.1;
    if (score >= 60) return 1 + (score - 60) * 0.2;
    return 0;
  }
  if (score >= 90) return 4;
  if (score >= 85) return 3.75;
  if (score >= 80) return 3.5;
  if (score >= 75) return 3;
  if (score >= 70) return 2.5;
  if (score >= 65) return 2;
  if (score >= 60) return 1;
  return 0;
}

function calculateGpa(courseList: Course[], algo: GpaAlgorithm): GpaResult {
  const result: GpaResult = { algo, gpa: 0, totalCredits: 0, totalWeighted: 0, skippedCredits: 0 };

  courseList.forEach((course) => {
    if (!course.countForGpa || course.scoreType === 'pass_fail') {
      result.skippedCredits += course.credit;
      return;
    }

    const percentage = toPercentage(course.score, course.scoreType);
    if (percentage === null) {
      result.skippedCredits += course.credit;
      return;
    }

    const score = scoreByAlgorithm(percentage, algo);
    result.totalCredits += course.credit;
    result.totalWeighted += score * course.credit;
  });

  result.gpa = result.totalCredits > 0 ? result.totalWeighted / result.totalCredits : 0;
  return result;
}

function filterCourses(courses: Course[], settings: ToolSettings) {
  let filtered = courses;

  if (settings.scope === 'baoyan') filtered = filtered.filter((course) => course.countForGpa);
  if (settings.scope === 'core') filtered = filtered.filter((course) => course.type === 'required' || course.type === 'core');
  if (settings.scope === 'required') filtered = filtered.filter((course) => course.type === 'required');

  if (settings.semester !== 'all') {
    const preset = SEMESTER_PRESETS[settings.semester as keyof typeof SEMESTER_PRESETS];
    filtered = preset
      ? filtered.filter((course) => preset.includes(course.semester))
      : filtered.filter((course) => course.semester === settings.semester);
  }

  return filtered;
}

function mergeMaterials(stored: MaterialTask[] | undefined) {
  if (!stored?.length) return DEFAULT_MATERIALS;

  const storedById = new Map(stored.map((item) => [item.id, item]));
  const merged = DEFAULT_MATERIALS.map((item) => ({ ...item, ...storedById.get(item.id) }));
  const extras = stored.filter((item) => !DEFAULT_MATERIALS.some((base) => base.id === item.id));
  return [...merged, ...extras];
}

function parseStoredState(value: string | null): PersistedState | null {
  if (!value) return null;

  try {
    const parsed = JSON.parse(value) as Partial<PersistedState>;
    return {
      version: 1,
      courses: Array.isArray(parsed.courses) ? parsed.courses : [],
      bonusItems: Array.isArray(parsed.bonusItems) ? parsed.bonusItems : [],
      materials: mergeMaterials(parsed.materials),
      settings: { ...DEFAULT_SETTINGS, ...(parsed.settings || {}) },
      updatedAt: parsed.updatedAt
    };
  } catch {
    return null;
  }
}

function statusLabel(status: MaterialStatus) {
  if (status === 'done') return '已完成';
  if (status === 'doing') return '进行中';
  return '待处理';
}

function deadlineMeta(task: MaterialTask) {
  if (task.status === 'done') {
    return { label: '已完成', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
  }
  if (!task.deadline) {
    return { label: '未设截止', className: 'bg-slate-100 text-slate-500 border-slate-200' };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(`${task.deadline}T00:00:00`);
  const diff = Math.ceil((due.getTime() - today.getTime()) / 86400000);

  if (diff < 0) return { label: `逾期 ${Math.abs(diff)} 天`, className: 'bg-rose-50 text-rose-700 border-rose-200' };
  if (diff === 0) return { label: '今天截止', className: 'bg-rose-50 text-rose-700 border-rose-200' };
  if (diff <= 3) return { label: `${diff} 天内`, className: 'bg-amber-50 text-amber-700 border-amber-200' };
  if (diff <= 7) return { label: `${diff} 天内`, className: 'bg-sky-50 text-sky-700 border-sky-200' };
  return { label: `${diff} 天后`, className: 'bg-slate-100 text-slate-600 border-slate-200' };
}

function downloadText(filename: string, content: string, type = 'application/json;charset=utf-8') {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function approximateRequiredScore(requiredGpa: number, algo: GpaAlgorithm) {
  if (algo === 'weighted') return `${formatNumber(requiredGpa, 1)} 分`;
  if (requiredGpa > 4) return '超过满绩，目标不可直接达成';

  const candidates = Array.from({ length: 101 }, (_, score) => score).find((score) => scoreByAlgorithm(score, algo) >= requiredGpa);
  return candidates === undefined ? '低于 60 分即可满足' : `约 ${candidates} 分以上`;
}

export function GpaToolClient() {
  const [activeTab, setActiveTab] = useState<TabKey>('courses');
  const [courses, setCourses] = useState<Course[]>([]);
  const [bonusItems, setBonusItems] = useState<BonusItem[]>([]);
  const [materials, setMaterials] = useState<MaterialTask[]>(DEFAULT_MATERIALS);
  const [settings, setSettings] = useState<ToolSettings>(DEFAULT_SETTINGS);
  const [courseDraft, setCourseDraft] = useState(EMPTY_COURSE);
  const [bonusDraft, setBonusDraft] = useState(EMPTY_BONUS);
  const [message, setMessage] = useState('');
  const [lastSaved, setLastSaved] = useState('');
  const [hydrated, setHydrated] = useState(false);
  const restoreInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active) return;

      const stored = parseStoredState(window.localStorage.getItem(STORAGE_KEY));
      if (stored) {
        setCourses(stored.courses);
        setBonusItems(stored.bonusItems);
        setMaterials(mergeMaterials(stored.materials));
        setSettings(stored.settings);
        setLastSaved(stored.updatedAt || '');
      }
      setHydrated(true);
    });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;

    const updatedAt = new Date().toISOString();
    const payload: PersistedState = {
      version: 1,
      courses,
      bonusItems,
      materials,
      settings,
      updatedAt
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    queueMicrotask(() => setLastSaved(updatedAt));
  }, [bonusItems, courses, hydrated, materials, settings]);

  const filteredCourses = useMemo(() => filterCourses(courses, settings), [courses, settings]);
  const gpaResults = useMemo(
    () => ALGORITHM_OPTIONS.map((option) => calculateGpa(filteredCourses, option.value)),
    [filteredCourses]
  );
  const weightedResult = useMemo(() => calculateGpa(filteredCourses, 'weighted'), [filteredCourses]);
  const selectedAcademicResult = useMemo(
    () => calculateGpa(courses.filter((course) => course.countForGpa), settings.compAlgo),
    [courses, settings.compAlgo]
  );
  const bestFourPoint = useMemo(
    () =>
      gpaResults
        .filter((result) => result.algo !== 'weighted')
        .reduce((best, result) => (result.gpa > best.gpa ? result : best), gpaResults[0]),
    [gpaResults]
  );

  const stats = useMemo(() => {
    const counted = courses.filter((course) => course.countForGpa && course.scoreType !== 'pass_fail');
    const totalCredits = courses.reduce((sum, course) => sum + course.credit, 0);
    const countedCredits = counted.reduce((sum, course) => sum + course.credit, 0);
    const materialDone = materials.filter((task) => task.status === 'done').length;
    const materialProgress = materials.length ? Math.round((materialDone / materials.length) * 100) : 0;
    const urgentMaterials = materials.filter((task) => {
      const meta = deadlineMeta(task);
      return task.status !== 'done' && (meta.label.includes('今天') || meta.label.includes('逾期') || meta.label.includes('3 天内'));
    }).length;

    return {
      totalCourses: courses.length,
      totalCredits,
      countedCredits,
      weightedAverage: weightedResult.gpa,
      materialProgress,
      urgentMaterials
    };
  }, [courses, materials, weightedResult.gpa]);

  const comprehensive = useMemo(() => {
    const academicScore = settings.compAlgo === 'weighted' ? selectedAcademicResult.gpa : selectedAcademicResult.gpa * 25;
    const rawBonus = bonusItems.reduce((sum, item) => sum + item.score, 0);
    const cap = Number.parseFloat(settings.bonusCap);
    const cappedBonus = Number.isFinite(cap) ? Math.min(rawBonus, cap) : rawBonus;
    const finalScore = academicScore * (settings.academicWeight / 100) + cappedBonus * (settings.bonusWeight / 100);

    return { academicScore, rawBonus, cappedBonus, finalScore, capped: Number.isFinite(cap) && rawBonus > cap };
  }, [bonusItems, selectedAcademicResult.gpa, settings]);

  const goalResult = useMemo(() => {
    const targetGpa = Number.parseFloat(settings.goalGpa);
    const futureCredits = Number.parseFloat(settings.goalCredits);
    if (!Number.isFinite(targetGpa) || !Number.isFinite(futureCredits) || futureCredits <= 0) return null;

    const current = calculateGpa(courses.filter((course) => course.countForGpa), settings.goalAlgo);
    const requiredWeighted = targetGpa * (current.totalCredits + futureCredits) - current.totalWeighted;
    const requiredAverage = requiredWeighted / futureCredits;
    return {
      current,
      targetGpa,
      futureCredits,
      requiredAverage,
      requiredScore: approximateRequiredScore(requiredAverage, settings.goalAlgo)
    };
  }, [courses, settings.goalAlgo, settings.goalCredits, settings.goalGpa]);

  function updateSetting<Key extends keyof ToolSettings>(key: Key, value: ToolSettings[Key]) {
    setSettings((current) => ({ ...current, [key]: value }));
  }

  function addCourse() {
    const scoreIsText = courseDraft.scoreType === 'grade' || courseDraft.scoreType === 'pass_fail';
    const scoreValue = Number.parseFloat(courseDraft.score);

    if (!courseDraft.name.trim()) {
      setMessage('请先填写课程名称。');
      return;
    }
    if (!Number.isFinite(courseDraft.credit) || courseDraft.credit <= 0) {
      setMessage('请填写有效学分。');
      return;
    }
    if (!scoreIsText && !Number.isFinite(scoreValue)) {
      setMessage('请填写有效成绩。');
      return;
    }

    setCourses((current) => [
      {
        id: createId('course'),
        ...courseDraft,
        name: courseDraft.name.trim(),
        credit: Number(courseDraft.credit),
        score: courseDraft.score.trim()
      },
      ...current
    ]);
    setCourseDraft((current) => ({ ...EMPTY_COURSE, semester: current.semester, type: current.type }));
    setMessage('课程已加入，并自动保存到本地记忆。');
  }

  function addSampleCourses() {
    const samples: Course[] = [
      { id: createId('course'), name: '高等数学 A', credit: 5, score: '91', scoreType: 'percentage', semester: '1-1', type: 'core', countForGpa: true },
      { id: createId('course'), name: '数据结构', credit: 4, score: '88', scoreType: 'percentage', semester: '2-1', type: 'required', countForGpa: true },
      { id: createId('course'), name: '科研训练', credit: 2, score: 'A', scoreType: 'grade', semester: '3-1', type: 'elective', countForGpa: true }
    ];
    setCourses((current) => [...samples, ...current]);
    setMessage('已填入 3 门示例课程，可直接替换成你的真实成绩。');
  }

  function exportBackup() {
    const payload: PersistedState = {
      version: 1,
      courses,
      bonusItems,
      materials,
      settings,
      updatedAt: new Date().toISOString()
    };
    downloadText(`seekoffer-gpa-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(payload, null, 2));
    setMessage('备份文件已生成。');
  }

  function handleRestore(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const parsed = parseStoredState(String(reader.result || ''));
      if (!parsed) {
        setMessage('备份文件格式不正确。');
        return;
      }

      setCourses(parsed.courses);
      setBonusItems(parsed.bonusItems);
      setMaterials(mergeMaterials(parsed.materials));
      setSettings(parsed.settings);
      setMessage('备份已恢复，并写入本地记忆。');
    };
    reader.readAsText(file, 'utf-8');
    event.target.value = '';
  }

  function resetAll() {
    setCourses([]);
    setBonusItems([]);
    setMaterials(DEFAULT_MATERIALS);
    setSettings(DEFAULT_SETTINGS);
    setMessage('工具数据已清空，本地记忆已同步更新。');
  }

  return (
    <>
      <section className="page-hero grid gap-6 px-6 py-7 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-center lg:px-8">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1.5 text-xs font-semibold text-brand shadow-sm">
            <Save className="h-4 w-4" />
            本地记忆开启
          </div>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-ink md:text-5xl">GPA 与材料工具</h1>
          <p className="mt-4 max-w-3xl text-base leading-8 text-slate-600">
            把保研申请里反复计算和检查的事情集中起来：课程 GPA、加分折算、材料进度和目标反推都保存在当前浏览器。
          </p>
        </div>
        <div className="rounded-[28px] border border-brand/10 bg-white/82 p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-brand/8 text-brand">
              <Database className="h-5 w-5" />
            </span>
            <div>
              <div className="text-sm font-semibold text-ink">自动保存</div>
              <div className="mt-1 text-xs text-slate-500">{lastSaved ? new Date(lastSaved).toLocaleString('zh-CN') : '等待首次输入'}</div>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 text-center text-xs text-slate-500">
            <div className="rounded-2xl bg-slate-50 px-3 py-3">
              <div className="text-lg font-semibold text-ink">{stats.totalCourses}</div>
              课程
            </div>
            <div className="rounded-2xl bg-slate-50 px-3 py-3">
              <div className="text-lg font-semibold text-ink">{stats.materialProgress}%</div>
              材料
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="加权均分" value={stats.weightedAverage ? formatNumber(stats.weightedAverage, 1) : '--'} hint="按当前筛选范围计算" icon={Gauge} tone="brand" />
        <MetricCard label="计入学分" value={formatNumber(stats.countedCredits, 1)} hint={`总学分 ${formatNumber(stats.totalCredits, 1)}`} icon={Layers3} tone="green" />
        <MetricCard label="材料进度" value={`${stats.materialProgress}%`} hint={`${materials.filter((task) => task.status === 'done').length}/${materials.length} 已完成`} icon={ClipboardCheck} tone="blue" />
        <MetricCard label="截止提醒" value={stats.urgentMaterials.toString()} hint="逾期、今天或 3 天内" icon={CalendarClock} tone="orange" />
      </section>

      {message ? (
        <section className="rounded-[28px] border border-brand/15 bg-white/86 px-5 py-4 text-sm text-brand shadow-sm backdrop-blur">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="leading-7">{message}</div>
          </div>
        </section>
      ) : null}

      <section className="surface-card rounded-[34px] p-4 sm:p-5 lg:p-6">
        <div className="no-scrollbar flex gap-2 overflow-x-auto rounded-[26px] bg-slate-100/80 p-1">
          {[
            { key: 'courses', label: '课程', icon: Layers3 },
            { key: 'gpa', label: 'GPA', icon: BarChart3 },
            { key: 'materials', label: '材料', icon: ClipboardCheck },
            { key: 'goal', label: '目标', icon: Target },
            { key: 'backup', label: '备份', icon: Database }
          ].map((item) => {
            const Icon = item.icon;
            const selected = activeTab === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setActiveTab(item.key as TabKey)}
                className={`inline-flex shrink-0 items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-semibold transition ${
                  selected ? 'bg-white text-brand shadow-sm' : 'text-slate-500 hover:bg-white/70 hover:text-brand'
                }`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </button>
            );
          })}
        </div>

        {activeTab === 'courses' ? (
          <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(320px,420px)_minmax(0,1fr)]">
            <div className="rounded-[28px] border border-slate-100 bg-white/90 p-5">
              <SectionTitle icon={Plus} title="添加课程" subtitle="成绩会实时纳入 GPA 计算，并自动保存。" />
              <div className="mt-5 grid gap-4">
                <Field label="课程名称">
                  <input className={inputClassName} value={courseDraft.name} onChange={(event) => setCourseDraft((current) => ({ ...current, name: event.target.value }))} placeholder="如：高等数学 A" />
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="学分">
                    <input
                      className={inputClassName}
                      type="number"
                      min="0"
                      step="0.5"
                      value={courseDraft.credit}
                      onChange={(event) => setCourseDraft((current) => ({ ...current, credit: Number.parseFloat(event.target.value) || 0 }))}
                    />
                  </Field>
                  <Field label="成绩">
                    <input className={inputClassName} value={courseDraft.score} onChange={(event) => setCourseDraft((current) => ({ ...current, score: event.target.value }))} placeholder="90 / A / P" />
                  </Field>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="学期">
                    <select className={inputClassName} value={courseDraft.semester} onChange={(event) => setCourseDraft((current) => ({ ...current, semester: event.target.value as Semester }))}>
                      {SEMESTER_OPTIONS.map((item) => (
                        <option key={item.value} value={item.value}>{item.label}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="课程类型">
                    <select className={inputClassName} value={courseDraft.type} onChange={(event) => setCourseDraft((current) => ({ ...current, type: event.target.value as CourseType }))}>
                      {COURSE_TYPE_OPTIONS.map((item) => (
                        <option key={item.value} value={item.value}>{item.label}</option>
                      ))}
                    </select>
                  </Field>
                </div>
                <Field label="成绩类型">
                  <select className={inputClassName} value={courseDraft.scoreType} onChange={(event) => setCourseDraft((current) => ({ ...current, scoreType: event.target.value as ScoreType, score: '' }))}>
                    {SCORE_TYPE_OPTIONS.map((item) => (
                      <option key={item.value} value={item.value}>{item.label}</option>
                    ))}
                  </select>
                </Field>
                <label className="flex items-center gap-3 rounded-2xl bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-600">
                  <input
                    type="checkbox"
                    checked={courseDraft.countForGpa}
                    onChange={(event) => setCourseDraft((current) => ({ ...current, countForGpa: event.target.checked }))}
                    className="h-4 w-4 accent-brand"
                  />
                  计入保研 GPA
                </label>
                <div className="flex flex-wrap gap-3">
                  <button type="button" onClick={addCourse} className="inline-flex items-center gap-2 rounded-2xl bg-brand px-5 py-3 text-sm font-semibold text-white shadow-float transition hover:-translate-y-0.5 hover:bg-brand-deep">
                    <Plus className="h-4 w-4" />
                    添加课程
                  </button>
                  <button type="button" onClick={addSampleCourses} className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-600 transition hover:border-brand/30 hover:text-brand">
                    <FileUp className="h-4 w-4" />
                    示例数据
                  </button>
                </div>
              </div>
            </div>

            <div className="rounded-[28px] border border-slate-100 bg-white/90 p-5">
              <SectionTitle icon={Layers3} title="课程列表" subtitle="可临时排除不参与保研 GPA 的课程。" />
              <div className="mt-5 overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="text-xs font-semibold text-slate-500">
                    <tr className="border-b border-slate-100">
                      <th className="py-3 pr-3">课程</th>
                      <th className="px-3 py-3">学分</th>
                      <th className="px-3 py-3">成绩</th>
                      <th className="px-3 py-3">学期</th>
                      <th className="px-3 py-3">类型</th>
                      <th className="px-3 py-3">状态</th>
                      <th className="py-3 pl-3 text-right">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {courses.length ? courses.map((course) => (
                      <tr key={course.id} className="align-middle">
                        <td className="py-3 pr-3 font-semibold text-ink">{course.name}</td>
                        <td className="px-3 py-3 text-slate-600">{course.credit}</td>
                        <td className="px-3 py-3 text-slate-600">{course.score} <span className="text-xs text-slate-400">{getLabel(SCORE_TYPE_OPTIONS, course.scoreType)}</span></td>
                        <td className="px-3 py-3 text-slate-600">{getLabel(SEMESTER_OPTIONS, course.semester)}</td>
                        <td className="px-3 py-3 text-slate-600">{getLabel(COURSE_TYPE_OPTIONS, course.type)}</td>
                        <td className="px-3 py-3">
                          <button
                            type="button"
                            onClick={() => setCourses((current) => current.map((item) => item.id === course.id ? { ...item, countForGpa: !item.countForGpa } : item))}
                            className={`rounded-full border px-3 py-1 text-xs font-semibold ${course.countForGpa ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-100 text-slate-500'}`}
                          >
                            {course.countForGpa ? '计入' : '排除'}
                          </button>
                        </td>
                        <td className="py-3 pl-3 text-right">
                          <button
                            type="button"
                            aria-label={`删除 ${course.name}`}
                            onClick={() => setCourses((current) => current.filter((item) => item.id !== course.id))}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={7} className="py-12 text-center text-sm text-slate-500">还没有课程数据。</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : null}

        {activeTab === 'gpa' ? (
          <div className="mt-6 grid gap-6">
            <div className="grid gap-4 rounded-[28px] border border-slate-100 bg-white/90 p-5 lg:grid-cols-2">
              <Field label="计算范围">
                <select className={inputClassName} value={settings.scope} onChange={(event) => updateSetting('scope', event.target.value as Scope)}>
                  <option value="all">全部课程</option>
                  <option value="baoyan">仅计入保研 GPA</option>
                  <option value="core">专业必修 + 学科基础</option>
                  <option value="required">仅专业必修</option>
                </select>
              </Field>
              <Field label="学期范围">
                <select className={inputClassName} value={settings.semester} onChange={(event) => updateSetting('semester', event.target.value as SemesterFilter)}>
                  <option value="all">全部学期</option>
                  <option value="first4">前四学期</option>
                  <option value="first5">前五学期</option>
                  <option value="first6">前六学期</option>
                  {SEMESTER_OPTIONS.map((item) => (
                    <option key={item.value} value={item.value}>{item.label}</option>
                  ))}
                </select>
              </Field>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              {ALGORITHM_OPTIONS.map((option) => {
                const result = gpaResults.find((item) => item.algo === option.value) || calculateGpa([], option.value);
                const isBest = option.value !== 'weighted' && bestFourPoint?.algo === option.value;
                return (
                  <div key={option.value} className={`rounded-[28px] border bg-white/92 p-5 shadow-sm ${isBest ? 'border-emerald-200 ring-4 ring-emerald-50' : 'border-slate-100'}`}>
                    <div className="text-sm font-semibold text-slate-500">{option.label}</div>
                    <div className={`mt-4 text-3xl font-semibold ${option.value === 'weighted' ? 'text-sky-600' : 'text-brand'}`}>
                      {formatNumber(result.gpa, option.value === 'weighted' ? 1 : 3)}
                    </div>
                    <div className="mt-2 text-xs text-slate-500">{option.scale}{isBest ? ' · 当前最高' : ''}</div>
                  </div>
                );
              })}
            </div>

            <div className="rounded-[28px] border border-slate-100 bg-white/90 p-5">
              <SectionTitle icon={BarChart3} title="课程换算明细" subtitle={`当前筛选 ${filteredCourses.length} 门课程。`} />
              <div className="mt-5 overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead className="text-xs font-semibold text-slate-500">
                    <tr className="border-b border-slate-100">
                      <th className="py-3 pr-3">课程</th>
                      <th className="px-3 py-3">百分制</th>
                      <th className="px-3 py-3">标准 4.0</th>
                      <th className="px-3 py-3">北大 4.0</th>
                      <th className="px-3 py-3">浙大</th>
                      <th className="px-3 py-3">WES</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredCourses.filter((course) => course.scoreType !== 'pass_fail').length ? filteredCourses.filter((course) => course.scoreType !== 'pass_fail').map((course) => {
                      const percentage = toPercentage(course.score, course.scoreType);
                      return (
                        <tr key={course.id}>
                          <td className="py-3 pr-3 font-semibold text-ink">{course.name}</td>
                          <td className="px-3 py-3 text-slate-600">{percentage === null ? '--' : formatNumber(percentage, 1)}</td>
                          <td className="px-3 py-3 text-slate-600">{percentage === null ? '--' : formatNumber(scoreByAlgorithm(percentage, 'standard4'), 1)}</td>
                          <td className="px-3 py-3 text-slate-600">{percentage === null ? '--' : formatNumber(scoreByAlgorithm(percentage, 'pku4'), 1)}</td>
                          <td className="px-3 py-3 text-slate-600">{percentage === null ? '--' : formatNumber(scoreByAlgorithm(percentage, 'zju'), 2)}</td>
                          <td className="px-3 py-3 text-slate-600">{percentage === null ? '--' : formatNumber(scoreByAlgorithm(percentage, 'wes'), 2)}</td>
                        </tr>
                      );
                    }) : (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-sm text-slate-500">当前范围内没有可计算课程。</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : null}

        {activeTab === 'materials' ? (
          <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
            <div className="rounded-[28px] border border-slate-100 bg-white/90 p-5">
              <SectionTitle icon={ClipboardCheck} title="材料进度" subtitle="状态、截止时间和备注会一起保存。" />
              <div className="mt-5 grid gap-3">
                {materials.map((task) => {
                  const meta = deadlineMeta(task);
                  return (
                    <div key={task.id} className="grid gap-3 rounded-[24px] bg-slate-50 p-4 lg:grid-cols-[minmax(0,1fr)_150px_150px_minmax(180px,1fr)] lg:items-center">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="font-semibold text-ink">{task.title}</div>
                          <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${meta.className}`}>{meta.label}</span>
                        </div>
                        <div className="mt-1 text-xs text-slate-500">{task.category}</div>
                      </div>
                      <select
                        className={compactInputClassName}
                        value={task.status}
                        onChange={(event) => setMaterials((current) => current.map((item) => item.id === task.id ? { ...item, status: event.target.value as MaterialStatus } : item))}
                      >
                        <option value="todo">待处理</option>
                        <option value="doing">进行中</option>
                        <option value="done">已完成</option>
                      </select>
                      <input
                        className={compactInputClassName}
                        type="date"
                        value={task.deadline}
                        onChange={(event) => setMaterials((current) => current.map((item) => item.id === task.id ? { ...item, deadline: event.target.value } : item))}
                      />
                      <input
                        className={compactInputClassName}
                        value={task.note}
                        onChange={(event) => setMaterials((current) => current.map((item) => item.id === task.id ? { ...item, note: event.target.value } : item))}
                        placeholder="备注"
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-[28px] border border-slate-100 bg-white/90 p-5">
              <SectionTitle icon={CalendarClock} title="截止提醒" subtitle="优先处理逾期和 3 天内事项。" />
              <div className="mt-5 grid gap-3">
                {materials.filter((task) => task.status !== 'done').map((task) => ({ task, meta: deadlineMeta(task) }))
                  .sort((a, b) => (a.task.deadline || '9999').localeCompare(b.task.deadline || '9999'))
                  .slice(0, 5)
                  .map(({ task, meta }) => (
                    <div key={task.id} className="rounded-[22px] bg-slate-50 px-4 py-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-ink">{task.title}</div>
                          <div className="mt-1 text-xs text-slate-500">{statusLabel(task.status)}{task.deadline ? ` · ${task.deadline}` : ''}</div>
                        </div>
                        <span className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold ${meta.className}`}>{meta.label}</span>
                      </div>
                      {task.note ? <div className="mt-3 text-sm leading-6 text-slate-500">{task.note}</div> : null}
                    </div>
                  ))}
              </div>
            </div>
          </div>
        ) : null}

        {activeTab === 'goal' ? (
          <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(320px,420px)_minmax(0,1fr)]">
            <div className="rounded-[28px] border border-slate-100 bg-white/90 p-5">
              <SectionTitle icon={Target} title="目标反推" subtitle="估算后续课程需要达到的平均表现。" />
              <div className="mt-5 grid gap-4">
                <Field label="目标算法">
                  <select className={inputClassName} value={settings.goalAlgo} onChange={(event) => updateSetting('goalAlgo', event.target.value as GpaAlgorithm)}>
                    {ALGORITHM_OPTIONS.map((item) => (
                      <option key={item.value} value={item.value}>{item.label}</option>
                    ))}
                  </select>
                </Field>
                <Field label="目标 GPA / 均分">
                  <input className={inputClassName} value={settings.goalGpa} onChange={(event) => updateSetting('goalGpa', event.target.value)} />
                </Field>
                <Field label="剩余可计学分">
                  <input className={inputClassName} value={settings.goalCredits} onChange={(event) => updateSetting('goalCredits', event.target.value)} />
                </Field>
              </div>
            </div>

            <div className="grid gap-4">
              <div className="rounded-[28px] border border-slate-100 bg-white/90 p-5">
                <SectionTitle icon={Gauge} title="反推结果" subtitle="结果依赖你当前计入保研 GPA 的课程。" />
                {goalResult ? (
                  <div className="mt-5 grid gap-4 md:grid-cols-3">
                    <ResultTile label="当前结果" value={formatNumber(goalResult.current.gpa, settings.goalAlgo === 'weighted' ? 1 : 3)} />
                    <ResultTile label="剩余平均需达到" value={formatNumber(goalResult.requiredAverage, settings.goalAlgo === 'weighted' ? 1 : 3)} />
                    <ResultTile label="折算为百分制" value={goalResult.requiredScore} />
                  </div>
                ) : (
                  <div className="mt-5 rounded-[24px] bg-slate-50 px-5 py-8 text-sm text-slate-500">请填写目标和剩余学分。</div>
                )}
              </div>

              <div className="rounded-[28px] border border-slate-100 bg-white/90 p-5">
                <SectionTitle icon={Plus} title="综合成绩" subtitle="适合粗略模拟学校的综合评价权重。" />
                <div className="mt-5 grid gap-4 lg:grid-cols-4">
                  <Field label="学业权重">
                    <input className={compactInputClassName} type="number" value={settings.academicWeight} onChange={(event) => updateSetting('academicWeight', Number.parseFloat(event.target.value) || 0)} />
                  </Field>
                  <Field label="加分权重">
                    <input className={compactInputClassName} type="number" value={settings.bonusWeight} onChange={(event) => updateSetting('bonusWeight', Number.parseFloat(event.target.value) || 0)} />
                  </Field>
                  <Field label="加分上限">
                    <input className={compactInputClassName} value={settings.bonusCap} onChange={(event) => updateSetting('bonusCap', event.target.value)} placeholder="可选" />
                  </Field>
                  <Field label="学业算法">
                    <select className={compactInputClassName} value={settings.compAlgo} onChange={(event) => updateSetting('compAlgo', event.target.value as GpaAlgorithm)}>
                      {ALGORITHM_OPTIONS.map((item) => (
                        <option key={item.value} value={item.value}>{item.label}</option>
                      ))}
                    </select>
                  </Field>
                </div>
                <div className="mt-5 grid gap-4 md:grid-cols-3">
                  <ResultTile label="学业折算" value={formatNumber(comprehensive.academicScore, 1)} />
                  <ResultTile label={comprehensive.capped ? '加分封顶' : '加分合计'} value={`+${formatNumber(comprehensive.cappedBonus, 1)}`} />
                  <ResultTile label="综合分" value={formatNumber(comprehensive.finalScore, 2)} />
                </div>
                <div className="mt-5 grid gap-3">
                  <div className="grid gap-3 md:grid-cols-[1fr_1fr_120px_auto]">
                    <input className={compactInputClassName} value={bonusDraft.name} onChange={(event) => setBonusDraft((current) => ({ ...current, name: event.target.value }))} placeholder="加分项" />
                    <input className={compactInputClassName} value={bonusDraft.level} onChange={(event) => setBonusDraft((current) => ({ ...current, level: event.target.value }))} placeholder="级别/说明" />
                    <input className={compactInputClassName} type="number" value={bonusDraft.score} onChange={(event) => setBonusDraft((current) => ({ ...current, score: Number.parseFloat(event.target.value) || 0 }))} />
                    <button
                      type="button"
                      onClick={() => {
                        if (!bonusDraft.name.trim()) {
                          setMessage('请先填写加分项名称。');
                          return;
                        }
                        setBonusItems((current) => [{ id: createId('bonus'), ...bonusDraft, name: bonusDraft.name.trim() }, ...current]);
                        setBonusDraft(EMPTY_BONUS);
                        setMessage('加分项已保存。');
                      }}
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white"
                    >
                      <Plus className="h-4 w-4" />
                      添加
                    </button>
                  </div>
                  {bonusItems.map((item) => (
                    <div key={item.id} className="flex items-center justify-between gap-3 rounded-[20px] bg-slate-50 px-4 py-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-ink">{item.name}</div>
                        <div className="truncate text-xs text-slate-500">{item.category}{item.level ? ` · ${item.level}` : ''}</div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-sm font-semibold text-emerald-700">+{item.score}</div>
                        <button
                          type="button"
                          aria-label={`删除 ${item.name}`}
                          onClick={() => setBonusItems((current) => current.filter((entry) => entry.id !== item.id))}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-xl text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {activeTab === 'backup' ? (
          <div className="mt-6 grid gap-6 lg:grid-cols-3">
            <BackupAction icon={Download} title="导出备份" text="下载 JSON 文件，用于跨浏览器迁移或阶段存档。" buttonText="导出 JSON" onClick={exportBackup} />
            <BackupAction
              icon={Upload}
              title="恢复备份"
              text="导入此前导出的 JSON 文件，恢复课程、材料和设置。"
              buttonText="选择文件"
              onClick={() => restoreInputRef.current?.click()}
            />
            <BackupAction icon={RotateCcw} title="清空重置" text="清空当前工具数据，并同步覆盖本地记忆。" buttonText="清空数据" onClick={resetAll} danger />
            <input ref={restoreInputRef} type="file" accept="application/json,.json" className="hidden" onChange={handleRestore} />
          </div>
        ) : null}
      </section>
    </>
  );
}

function MetricCard({
  label,
  value,
  hint,
  icon: Icon,
  tone
}: {
  label: string;
  value: string;
  hint: string;
  icon: ComponentType<{ className?: string }>;
  tone: 'brand' | 'green' | 'blue' | 'orange';
}) {
  const toneClass = {
    brand: 'bg-brand/8 text-brand',
    green: 'bg-emerald-50 text-emerald-700',
    blue: 'bg-sky-50 text-sky-700',
    orange: 'bg-amber-50 text-amber-700'
  }[tone];

  return (
    <div className="soft-stat-pill rounded-[28px] px-5 py-5">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="text-xs font-semibold text-slate-500">{label}</div>
          <div className="mt-2 truncate text-2xl font-semibold text-ink">{value}</div>
          <div className="mt-1 truncate text-xs text-slate-500">{hint}</div>
        </div>
        <span className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${toneClass}`}>
          <Icon className="h-5 w-5" />
        </span>
      </div>
    </div>
  );
}

function SectionTitle({
  icon: Icon,
  title,
  subtitle
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-brand/8 text-brand">
        <Icon className="h-5 w-5" />
      </span>
      <div>
        <h2 className="text-lg font-semibold text-ink">{title}</h2>
        <p className="mt-1 text-sm leading-6 text-slate-500">{subtitle}</p>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-2 text-sm font-semibold text-slate-600">
      <span>{label}</span>
      {children}
    </label>
  );
}

function ResultTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[24px] bg-slate-50 px-5 py-5">
      <div className="text-xs font-semibold text-slate-500">{label}</div>
      <div className="mt-3 text-2xl font-semibold text-brand">{value}</div>
    </div>
  );
}

function BackupAction({
  icon: Icon,
  title,
  text,
  buttonText,
  onClick,
  danger
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  text: string;
  buttonText: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <div className="rounded-[28px] border border-slate-100 bg-white/90 p-5">
      <span className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl ${danger ? 'bg-rose-50 text-rose-600' : 'bg-brand/8 text-brand'}`}>
        <Icon className="h-5 w-5" />
      </span>
      <h2 className="mt-4 text-lg font-semibold text-ink">{title}</h2>
      <p className="mt-2 min-h-[3.5rem] text-sm leading-7 text-slate-500">{text}</p>
      <button
        type="button"
        onClick={onClick}
        className={`mt-4 inline-flex items-center justify-center rounded-2xl px-5 py-3 text-sm font-semibold ${
          danger ? 'bg-rose-50 text-rose-700 hover:bg-rose-100' : 'bg-brand text-white hover:bg-brand-deep'
        }`}
      >
        {buttonText}
      </button>
    </div>
  );
}
