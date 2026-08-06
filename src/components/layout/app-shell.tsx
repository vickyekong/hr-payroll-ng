import { Sidebar } from "@/components/layout/sidebar";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-atmosphere">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <div className="mx-auto max-w-6xl animate-fade-in px-6 py-8 sm:px-8">
          {children}
        </div>
      </main>
    </div>
  );
}
