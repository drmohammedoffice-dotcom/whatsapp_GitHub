import { AppShell } from '@/components/layout/app-shell';
import { ClinicCalendarCenter } from '@/components/appointments/clinic-calendar-center';
import { PageHeader } from '@/components/shared/page-header';

export default function GoogleCalendarSettingsPage() {
  return (
    <AppShell>
      <PageHeader
        title="Clinic AI & Calendar Center"
        description="مركز متكامل لإعداد العيادة، Google Calendar، معرفة الذكاء الاصطناعي، الملفات والتسجيلات الصوتية."
      />
      <ClinicCalendarCenter />
    </AppShell>
  );
}
