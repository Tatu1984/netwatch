"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Monitor,
  Laptop,
  BarChart3,
  Image,
  Video,
  Shield,
  Bell,
  Settings,
  Users,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Eye,
  AppWindow,
  Globe,
  TrendingUp,
  Lock,
  Keyboard,
  Flame,
  MousePointer2,
  Clipboard,
  Activity,
  Gamepad2,
  MessageSquare,
  Cpu,
} from "lucide-react";
import { useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useUIStore } from "@/stores/ui";

interface NavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  children?: NavItem[];
}

const navItems: NavItem[] = [
  {
    title: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    title: "Monitoring",
    href: "/dashboard/monitoring",
    icon: Monitor,
  },
  {
    title: "Computers",
    href: "/dashboard/computers",
    icon: Laptop,
  },
  {
    title: "Control",
    href: "/dashboard/control",
    icon: Gamepad2,
    children: [
      {
        title: "Device Control",
        href: "/dashboard/control",
        icon: Lock,
      },
      {
        title: "Remote Desktop",
        href: "/dashboard/remote",
        icon: MousePointer2,
      },
      {
        title: "Processes",
        href: "/dashboard/processes",
        icon: Activity,
      },
      {
        title: "Firewall",
        href: "/dashboard/firewall",
        icon: Flame,
      },
    ],
  },
  {
    title: "Surveillance",
    href: "/dashboard/keylogger",
    icon: Eye,
    children: [
      {
        title: "Keylogger",
        href: "/dashboard/keylogger",
        icon: Keyboard,
      },
      {
        title: "Clipboard",
        href: "/dashboard/clipboard",
        icon: Clipboard,
      },
      {
        title: "Screenshots",
        href: "/dashboard/screenshots",
        icon: Image,
      },
      {
        title: "Recordings",
        href: "/dashboard/recordings",
        icon: Video,
      },
    ],
  },
  {
    title: "Reports",
    href: "/dashboard/reports",
    icon: BarChart3,
    children: [
      {
        title: "Applications",
        href: "/dashboard/reports/applications",
        icon: AppWindow,
      },
      {
        title: "Websites",
        href: "/dashboard/reports/websites",
        icon: Globe,
      },
      {
        title: "Productivity",
        href: "/dashboard/reports/productivity",
        icon: TrendingUp,
      },
      {
        title: "System Info",
        href: "/dashboard/reports/system-info",
        icon: Cpu,
      },
    ],
  },
  {
    title: "Messaging",
    href: "/dashboard/messaging",
    icon: MessageSquare,
  },
  {
    title: "Policies",
    href: "/dashboard/policies",
    icon: Shield,
  },
  {
    title: "Alerts",
    href: "/dashboard/alerts",
    icon: Bell,
  },
  {
    title: "Settings",
    href: "/dashboard/settings",
    icon: Settings,
    children: [
      {
        title: "Users",
        href: "/dashboard/settings/users",
        icon: Users,
      },
    ],
  },
];

function NavItemComponent({ item, level = 0, collapsed = false }: { item: NavItem; level?: number; collapsed?: boolean }) {
  const pathname = usePathname();
  const [isExpanded, setIsExpanded] = useState(
    item.children?.some((child) => pathname.startsWith(child.href)) ?? false
  );

  const isActive = pathname === item.href ||
    (item.children && pathname.startsWith(item.href) && item.href !== "/dashboard");
  const hasChildren = item.children && item.children.length > 0;

  const Icon = item.icon;

  if (collapsed && level === 0) {
    return (
      <Tooltip delayDuration={0}>
        <TooltipTrigger asChild>
          <Link
            href={hasChildren && item.children ? item.children[0].href : item.href}
            className={cn(
              "flex items-center justify-center rounded-lg p-2 transition-colors",
              "hover:bg-accent hover:text-accent-foreground",
              isActive && "bg-accent text-accent-foreground"
            )}
          >
            <Icon className="h-5 w-5" />
          </Link>
        </TooltipTrigger>
        <TooltipContent side="right" className="flex items-center gap-4">
          {item.title}
        </TooltipContent>
      </Tooltip>
    );
  }

  if (hasChildren) {
    return (
      <div>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className={cn(
            "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
            "hover:bg-accent hover:text-accent-foreground",
            isActive && "bg-accent text-accent-foreground"
          )}
          style={{ paddingLeft: `${12 + level * 16}px` }}
        >
          <Icon className="h-4 w-4" />
          <span className="flex-1 text-left">{item.title}</span>
          {isExpanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </button>
        {isExpanded && (
          <div className="mt-1 space-y-1">
            {item.children?.map((child) => (
              <NavItemComponent key={child.href} item={child} level={level + 1} collapsed={collapsed} />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <Link
      href={item.href}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
        "hover:bg-accent hover:text-accent-foreground",
        pathname === item.href && "bg-accent text-accent-foreground"
      )}
      style={{ paddingLeft: `${12 + level * 16}px` }}
    >
      <Icon className="h-4 w-4" />
      <span>{item.title}</span>
    </Link>
  );
}

export function Sidebar() {
  const { sidebarCollapsed, toggleSidebar } = useUIStore();

  return (
    <aside className={cn(
      "fixed inset-y-0 left-0 z-50 flex flex-col border-r bg-sidebar transition-all duration-300",
      sidebarCollapsed ? "w-16" : "w-64"
    )}>
      <div className={cn(
        "flex h-16 items-center border-b",
        sidebarCollapsed ? "justify-center px-2" : "gap-2 px-6"
      )}>
        <Eye className="h-6 w-6 text-primary shrink-0" />
        {!sidebarCollapsed && <span className="text-lg font-bold">NetWatch Pro</span>}
      </div>
      <ScrollArea className={cn("flex-1 py-4", sidebarCollapsed ? "px-2" : "px-3")}>
        <nav className={cn("space-y-1", sidebarCollapsed && "flex flex-col items-center")}>
          {navItems.map((item) => (
            <NavItemComponent key={item.href} item={item} collapsed={sidebarCollapsed} />
          ))}
        </nav>
      </ScrollArea>
      <div className={cn("border-t", sidebarCollapsed ? "p-2" : "p-4")}>
        {!sidebarCollapsed && (
          <div className="flex items-center gap-3 rounded-lg bg-accent/50 px-3 py-2 mb-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <span className="text-sm font-medium">AC</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="truncate text-sm font-medium">Acme Corp</p>
              <p className="truncate text-xs text-muted-foreground">Enterprise Plan</p>
            </div>
          </div>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleSidebar}
          className={cn("w-full", sidebarCollapsed && "p-2")}
        >
          {sidebarCollapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <>
              <ChevronLeft className="h-4 w-4 mr-2" />
              Collapse
            </>
          )}
        </Button>
      </div>
    </aside>
  );
}
