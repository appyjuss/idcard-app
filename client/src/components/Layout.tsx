// src/components/Layout.tsx
import { Toaster } from "@/components/ui/sonner";
import { Sidebar } from "./sidebar/Sidebar";
import { MobileHeader } from "./sidebar/MobileHeader";
import { JobStatusPoller } from "@/features/jobs/components/JobStatusPoller";

type LayoutProps = {
    children: React.ReactNode;
};

export function Layout({ children }: LayoutProps) {
    return (
        // The main grid for desktop. On mobile, it's just a single column.
        <div className="grid min-h-screen w-full lg:grid-cols-[280px_1fr]">
            {/* Desktop-only sidebar */}
            <Sidebar />

            {/* This div contains the header and main content */}
            <div className="flex flex-col">
                {/* Mobile-only header */}
                <MobileHeader />

                {/* Main content area */}
                <main className="flex-1 p-4 md:p-6 lg:p-8 bg-muted/40 overflow-auto">
                    {children}
                </main>
            </div>

            {/* Global components */}
            <Toaster richColors position="top-right" />
            <JobStatusPoller />
        </div>
    );
}