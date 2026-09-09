import { MonitorProvider } from "@/components/monitor-context";
import { AppShell } from "@/components/app-shell";

// Chrome and the 30s /api/status poll live here, not in the root layout, so
// they only run for the monitoring pages.
export default function CrmLayout({ children }: { children: React.ReactNode }) {
  return (
    <MonitorProvider>
      <AppShell>{children}</AppShell>
    </MonitorProvider>
  );
}
