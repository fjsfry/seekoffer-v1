'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { readAnalyticsPreference, writeAnalyticsPreference, type AnalyticsPreference } from '@/lib/privacy-preference';

export function AnalyticsPreferenceControl() {
  const [preference, setPreference] = useState<AnalyticsPreference>('unknown');

  useEffect(() => {
    setPreference(readAnalyticsPreference());
  }, []);

  function choose(value: 'accepted' | 'declined') {
    writeAnalyticsPreference(value);
    setPreference(value);
  }

  return (
    <div className="rounded-[24px] border border-slate-100 bg-slate-50 px-5 py-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="font-semibold text-ink">匿名访问统计设置</div>
          <p className="mt-1 text-sm leading-7 text-slate-500">当前状态：{preference === 'accepted' ? '已同意' : preference === 'declined' ? '已拒绝' : '尚未选择'}</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => choose('declined')} className={`h-10 rounded-xl px-3 text-sm font-semibold ${preference === 'declined' ? 'bg-slate-800 text-white' : 'border border-slate-200 bg-white text-slate-600'}`}>关闭统计</button>
          <button type="button" onClick={() => choose('accepted')} className={`inline-flex h-10 items-center gap-2 rounded-xl px-3 text-sm font-semibold ${preference === 'accepted' ? 'bg-brand text-white' : 'border border-brand/20 bg-white text-brand'}`}>
            {preference === 'accepted' ? <CheckCircle2 className="h-4 w-4" /> : null}允许统计
          </button>
        </div>
      </div>
    </div>
  );
}
