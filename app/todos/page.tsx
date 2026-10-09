import { LegacyWorkbenchRedirect } from '@/components/legacy-workbench-redirect';

export default function TodosPage() {
  return <LegacyWorkbenchRedirect target="/me?view=schedule" label="我的日程" />;
}
