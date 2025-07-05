// src/components/Layout.tsx
import { ThemeToggle } from "./ThemeToggle";
import { Toaster } from "@/components/ui/sonner"; // Use the Shadcn version of Sonner

type LayoutProps = {
    children: React.ReactNode;
};

export function Layout({ children }: LayoutProps) {
    return (
        <div className="min-h-screen bg-background font-sans text-foreground antialiased">
            <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                <div className="container flex h-14 max-w-screen-2xl items-center justify-between">
                    <a href="/" className="font-bold tracking-tight">
                        ID Card Pro
                    </a>
                    <ThemeToggle />
                </div>
            </header>
            <main className="container max-w-screen-2xl p-4 md:p-8">
                {children}
            </main>
            <Toaster richColors />
        </div>
    );
}