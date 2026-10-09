import type { Metadata } from 'next';
import { SiteShell } from '@/components/site-shell';
import { GpaToolClient } from './gpa-tool-client';

export const metadata: Metadata = {
  title: 'GPA 与材料工具 - Seekoffer',
  description: '面向保研申请的 GPA 换算、课程管理、材料进度和目标反推工具，支持本地记忆和备份恢复。'
};

export default function GpaPage() {
  return (
    <SiteShell>
      <GpaToolClient />
    </SiteShell>
  );
}
