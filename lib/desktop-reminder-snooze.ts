export type ReminderSnoozePresetId =
  | 'default-delay'
  | 'tonight'
  | 'tomorrow-morning'
  | 'next-monday';

export type ReminderSnoozeOption = {
  id: ReminderSnoozePresetId;
  label: string;
  description: string;
  target: Date;
};

const SHANGHAI_OFFSET_HOURS = 8;

function getShanghaiCalendarParts(source: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    timeZone: 'Asia/Shanghai'
  }).formatToParts(source);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day)
  };
}

function atShanghaiTime(source: Date, dayOffset: number, hours: number) {
  const { year, month, day } = getShanghaiCalendarParts(source);
  return new Date(
    Date.UTC(year, month - 1, day + dayOffset, hours - SHANGHAI_OFFSET_HOURS)
  );
}

function formatDelayLabel(minutes: number) {
  if (minutes === 60) return '1 小时后';
  if (minutes % 60 === 0) return `${minutes / 60} 小时后`;
  return `${minutes} 分钟后`;
}

export function getReminderSnoozeOptions(
  source = new Date(),
  defaultDelayMinutes = 60
): ReminderSnoozeOption[] {
  const defaultDelayTarget = new Date(source.getTime() + defaultDelayMinutes * 60 * 1000);
  let evening = atShanghaiTime(source, 0, 20);
  const eveningIsTomorrow = evening.getTime() <= source.getTime();
  if (eveningIsTomorrow) evening = atShanghaiTime(source, 1, 20);

  const tomorrowMorning = atShanghaiTime(source, 1, 9);
  const { year, month, day } = getShanghaiCalendarParts(source);
  const shanghaiWeekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  const daysUntilNextMonday = ((8 - shanghaiWeekday) % 7) || 7;
  const nextMonday = atShanghaiTime(source, daysUntilNextMonday, 9);

  return [
    {
      id: 'default-delay',
      label: formatDelayLabel(defaultDelayMinutes),
      description: '使用通知设置中的默认时长',
      target: defaultDelayTarget
    },
    {
      id: 'tonight',
      label: eveningIsTomorrow ? '明晚 20:00' : '今晚 20:00',
      description: eveningIsTomorrow ? '今天已过提醒时间' : '今晚集中处理',
      target: evening
    },
    {
      id: 'tomorrow-morning',
      label: '明早 09:00',
      description: '明天开始时提醒',
      target: tomorrowMorning
    },
    {
      id: 'next-monday',
      label: '下周一 09:00',
      description: '下周开始时提醒',
      target: nextMonday
    }
  ];
}
