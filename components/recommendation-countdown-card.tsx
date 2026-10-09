'use client';

import { useEffect, useState } from 'react';
import { CalendarDays, Clock3 } from 'lucide-react';

const RECOMMENDATION_TARGET_TIME = new Date('2026-09-22T00:00:00+08:00').getTime();

type CountdownState = {
  days: string;
  hours: string;
  minutes: string;
  seconds: string;
};

function getRecommendationCountdown(): CountdownState {
  const diff = Math.max(0, RECOMMENDATION_TARGET_TIME - Date.now());
  const totalSeconds = Math.floor(diff / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return {
    days: String(days),
    hours: String(hours).padStart(2, '0'),
    minutes: String(minutes).padStart(2, '0'),
    seconds: String(seconds).padStart(2, '0')
  };
}

export function RecommendationCountdownCard() {
  const [countdown, setCountdown] = useState<CountdownState>(() => getRecommendationCountdown());

  useEffect(() => {
    const timer = window.setInterval(() => {
      setCountdown(getRecommendationCountdown());
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  return (
    <section className="relative overflow-hidden rounded-[30px] border border-brand/10 bg-gradient-to-r from-white via-emerald-50/75 to-white px-5 py-5 shadow-soft lg:px-7">
      <div className="pointer-events-none absolute -right-10 bottom-[-4.5rem] h-36 w-80 rounded-[50%] border-t border-brand/20" />
      <div className="relative z-10 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-4">
          <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand text-white shadow-sm">
            <CalendarDays className="h-6 w-6" />
          </span>
          <div>
            <div className="text-lg font-semibold tracking-tight text-ink">
              距离 2026 年推免系统填报志愿（9.22）还有
            </div>
            <div className="mt-2 flex items-center gap-2 text-sm leading-6 text-slate-500">
              <Clock3 className="h-4 w-4" />
              放在工作台里作为个人节奏提醒，首页会更轻一些。
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <CountdownPill value={countdown.days} label="天" wide />
          <CountdownPill value={countdown.hours} label="时" />
          <CountdownPill value={countdown.minutes} label="分" />
          <CountdownPill value={countdown.seconds} label="秒" />
        </div>
      </div>
    </section>
  );
}

function CountdownPill({ value, label, wide = false }: { value: string; label: string; wide?: boolean }) {
  return (
    <div className="flex items-center gap-1.5">
      <span
        suppressHydrationWarning
        className={`inline-flex h-11 items-center justify-center rounded-xl bg-gradient-to-b from-rose-400 to-rose-500 px-3 text-xl font-bold tabular-nums text-white shadow-[0_12px_24px_rgba(244,63,94,0.22)] ${
          wide ? 'min-w-[72px]' : 'min-w-[54px]'
        }`}
      >
        {value}
      </span>
      <span className="text-xs font-semibold text-ink">{label}</span>
    </div>
  );
}
