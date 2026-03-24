import { ReactNode } from "react";
import { AppSidebar } from "./AppSidebar";
import { AppHeader } from "./AppHeader";

export function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      {/* Sidebar — fixed height, no scroll */}
      <AppSidebar />
      {/* Right column — header fixed, content scrolls */}
      <div className="flex flex-col flex-1 min-w-0 h-screen">
        <div className="shrink-0">
          <AppHeader />
        </div>
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
