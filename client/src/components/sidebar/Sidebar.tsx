// src/components/Sidebar.tsx
import { SidebarContent } from "./SidebarContent";

export function Sidebar() {
    return (
        // This 'aside' is hidden by default and becomes a flex container on large screens
        <aside className="hidden lg:flex flex-col border-r bg-background">
            <SidebarContent />
        </aside>
    );
}