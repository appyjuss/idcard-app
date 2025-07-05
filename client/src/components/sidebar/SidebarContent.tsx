// src/components/SidebarContent.tsx
import { NavLink } from "react-router-dom";
import { Home, Briefcase, Settings, HelpCircle, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";


// Add a new prop type
interface SidebarContentProps {
  onLinkClick?: () => void; // An optional function that takes no arguments and returns nothing
}

const navLinks = [
    { to: "/", icon: Home, label: "Home" },
    { to: "/jobs", icon: Briefcase, label: "My Jobs" },
    { to: "/settings", icon: Settings, label: "Settings" },
    { to: "/help", icon: HelpCircle, label: "Help" },
];

export function SidebarContent({ onLinkClick }: SidebarContentProps) {
    return (
        <div className="flex flex-col h-full">
            {/* Header/Logo */}
            <div className="flex items-center gap-2 p-4 border-b">
                <Sparkles className="h-6 w-6 text-primary" />
                <h1 className="text-lg font-bold tracking-tight">CardForge</h1>
            </div>

            {/* Main Navigation */}
            <nav className="flex-1 p-4">
                <ul className="space-y-1">
                    {navLinks.map((link) => (
                        <li key={link.label}>
                            <NavLink
                                to={link.to}
                                end={link.to === "/"}
                                onClick={onLinkClick} 
                                className={({ isActive }) =>
                                    cn(
                                        "flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary",
                                        isActive && "bg-muted text-primary font-semibold"
                                    )
                                }
                            >
                                <link.icon className="h-4 w-4" />
                                {link.label}
                            </NavLink>
                        </li>
                    ))}
                </ul>
            </nav>
        </div>
    );
}