import { LegacyWorkbenchRedirect } from '@/components/legacy-workbench-redirect';

export default function ApplicationsPage() {
  return <LegacyWorkbenchRedirect target="/me?view=applications" label="申请清单" />;
}
