import { redirect } from 'next/navigation';
import {
  buildLegacyNoticeDetailRedirect,
  type LegacyNoticeDetailSearchParams
} from '@/lib/notice-links';

export default async function NoticeDetailCompatibilityPage({
  searchParams
}: {
  searchParams: Promise<LegacyNoticeDetailSearchParams>;
}) {
  redirect(buildLegacyNoticeDetailRedirect(await searchParams));
}
