// src/components/MobileHeader.tsx
import { useState } from "react";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { SidebarContent } from "./SidebarContent";
import { ThemeToggle } from "../ThemeToggle";

export function MobileHeader() {
    const [open, setOpen] = useState(false);

    return (
        // This header is visible by default and hidden on large screens (`lg:`)
        <header className="flex lg:hidden items-center justify-between h-14 px-4 border-b bg-background sticky top-0 z-50">
            <Sheet open={open} onOpenChange={setOpen}>
                <SheetTrigger asChild>
                    <Button variant="outline" size="icon">
                        <Menu className="h-6 w-6" />
                        <span className="sr-only">Toggle navigation menu</span>
                    </Button>
                </SheetTrigger>
                <SheetContent side="left" className="p-0 w-72">
                    {/* We reuse the exact same content as the desktop sidebar! */}
                    <SidebarContent onLinkClick={() => setOpen(false)} />
                </SheetContent>
            </Sheet>
            
            <h1 className="text-lg font-bold">CardForge</h1>
            
            {/* You can put a theme toggle or other icons here too */}
            <ThemeToggle />
        </header>
    );
}