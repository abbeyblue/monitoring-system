import type { Metadata } from "next";
import "./globals.css";
import { MonitorProvider } from "@/components/monitor-context";
import { AppShell } from "@/components/app-shell";

export const metadata: Metadata = {
  title: "Abbey Blue Monitoring",
  description: "Standalone status dashboard for the Abbey Blue CRM.",
};

const themeScript = `(function(){try{var t=localStorage.getItem('cwm-theme');if(t==='light'||t==='dark')document.documentElement.setAttribute('data-theme',t);}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="font-sans antialiased">
        <MonitorProvider>
          <AppShell>{children}</AppShell>
        </MonitorProvider>
      </body>
    </html>
  );
}
