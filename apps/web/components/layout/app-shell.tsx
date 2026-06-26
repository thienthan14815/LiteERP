import type { ReactNode } from "react";

// Stub. Will host sidebar nav, top bar, breadcrumbs, etc. in later phases.
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-64 border-r bg-muted/40 p-4 md:block">
        <div className="font-semibold">Refurb Admin</div>
        <p className="mt-2 text-xs text-muted-foreground">
          Navigation will be added in Phase 1.
        </p>
      </aside>
      <main className="flex-1">{children}</main>
    </div>
  );
}
