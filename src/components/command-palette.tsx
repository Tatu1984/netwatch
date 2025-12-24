"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Monitor,
  LayoutDashboard,
  Users,
  FolderOpen,
  Camera,
  Video,
  Shield,
  Bell,
  Settings,
  BarChart3,
  Globe,
  AppWindow,
  Search,
  Plus,
  LogOut,
} from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { useUIStore } from "@/stores/ui";
import { signOut } from "next-auth/react";

interface CommandItem {
  id: string;
  label: string;
  icon: React.ElementType;
  shortcut?: string;
  action: () => void;
}

export function CommandPalette() {
  const router = useRouter();
  const { commandPaletteOpen, setCommandPaletteOpen, openModal } = useUIStore();

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setCommandPaletteOpen(!commandPaletteOpen);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [commandPaletteOpen, setCommandPaletteOpen]);

  const navigate = (path: string) => {
    router.push(path);
    setCommandPaletteOpen(false);
  };

  const handleAction = (action: () => void) => {
    action();
    setCommandPaletteOpen(false);
  };

  const navigationItems: CommandItem[] = [
    {
      id: "dashboard",
      label: "Dashboard",
      icon: LayoutDashboard,
      shortcut: "⌘D",
      action: () => navigate("/dashboard"),
    },
    {
      id: "monitoring",
      label: "Live Monitoring",
      icon: Monitor,
      shortcut: "⌘M",
      action: () => navigate("/dashboard/monitoring"),
    },
    {
      id: "computers",
      label: "Computers",
      icon: Monitor,
      shortcut: "⌘C",
      action: () => navigate("/dashboard/computers"),
    },
    {
      id: "screenshots",
      label: "Screenshots",
      icon: Camera,
      action: () => navigate("/dashboard/screenshots"),
    },
    {
      id: "recordings",
      label: "Recordings",
      icon: Video,
      action: () => navigate("/dashboard/recordings"),
    },
    {
      id: "policies",
      label: "Policies",
      icon: Shield,
      action: () => navigate("/dashboard/policies"),
    },
    {
      id: "alerts",
      label: "Alerts",
      icon: Bell,
      action: () => navigate("/dashboard/alerts"),
    },
  ];

  const reportItems: CommandItem[] = [
    {
      id: "applications",
      label: "Applications Report",
      icon: AppWindow,
      action: () => navigate("/dashboard/reports/applications"),
    },
    {
      id: "websites",
      label: "Websites Report",
      icon: Globe,
      action: () => navigate("/dashboard/reports/websites"),
    },
    {
      id: "productivity",
      label: "Productivity Report",
      icon: BarChart3,
      action: () => navigate("/dashboard/reports/productivity"),
    },
  ];

  const settingsItems: CommandItem[] = [
    {
      id: "settings",
      label: "Settings",
      icon: Settings,
      action: () => navigate("/dashboard/settings"),
    },
    {
      id: "users",
      label: "User Management",
      icon: Users,
      action: () => navigate("/dashboard/settings/users"),
    },
    {
      id: "groups",
      label: "Computer Groups",
      icon: FolderOpen,
      action: () => navigate("/dashboard/computers"),
    },
  ];

  const actionItems: CommandItem[] = [
    {
      id: "add-computer",
      label: "Add Computer",
      icon: Plus,
      action: () => openModal("add-computer"),
    },
    {
      id: "add-group",
      label: "Create Group",
      icon: Plus,
      action: () => openModal("add-group"),
    },
    {
      id: "add-policy",
      label: "Add Policy",
      icon: Plus,
      action: () => openModal("add-policy"),
    },
    {
      id: "logout",
      label: "Log Out",
      icon: LogOut,
      action: () => signOut({ callbackUrl: "/login" }),
    },
  ];

  return (
    <CommandDialog open={commandPaletteOpen} onOpenChange={setCommandPaletteOpen}>
      <CommandInput placeholder="Type a command or search..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Navigation">
          {navigationItems.map((item) => (
            <CommandItem
              key={item.id}
              onSelect={() => handleAction(item.action)}
            >
              <item.icon className="mr-2 h-4 w-4" />
              <span>{item.label}</span>
              {item.shortcut && (
                <CommandShortcut>{item.shortcut}</CommandShortcut>
              )}
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Reports">
          {reportItems.map((item) => (
            <CommandItem
              key={item.id}
              onSelect={() => handleAction(item.action)}
            >
              <item.icon className="mr-2 h-4 w-4" />
              <span>{item.label}</span>
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Settings">
          {settingsItems.map((item) => (
            <CommandItem
              key={item.id}
              onSelect={() => handleAction(item.action)}
            >
              <item.icon className="mr-2 h-4 w-4" />
              <span>{item.label}</span>
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Actions">
          {actionItems.map((item) => (
            <CommandItem
              key={item.id}
              onSelect={() => handleAction(item.action)}
            >
              <item.icon className="mr-2 h-4 w-4" />
              <span>{item.label}</span>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
