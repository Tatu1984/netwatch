"use client";

import { formatDistanceToNow } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AppWindow, Globe, Coffee } from "lucide-react";

interface Activity {
  id: string;
  type: string;
  title: string;
  computerName: string;
  startedAt: Date;
  category: string | null;
}

interface ActivityFeedProps {
  activities: Activity[];
}

export function ActivityFeed({ activities }: ActivityFeedProps) {
  const getIcon = (type: string) => {
    switch (type) {
      case "APP":
        return <AppWindow className="h-4 w-4" />;
      case "WEBSITE":
        return <Globe className="h-4 w-4" />;
      case "IDLE":
        return <Coffee className="h-4 w-4" />;
      default:
        return <AppWindow className="h-4 w-4" />;
    }
  };

  const getCategoryColor = (category: string | null) => {
    switch (category) {
      case "productive":
        return "bg-green-500/10 text-green-500 border-green-500/20";
      case "unproductive":
        return "bg-red-500/10 text-red-500 border-red-500/20";
      default:
        return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20";
    }
  };

  return (
    <ScrollArea className="h-[300px]">
      <div className="space-y-4">
        {activities.map((activity) => (
          <div key={activity.id} className="flex items-start gap-3">
            <div className="mt-1 flex h-8 w-8 items-center justify-center rounded-full bg-muted">
              {getIcon(activity.type)}
            </div>
            <div className="flex-1 space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-medium">{activity.title}</span>
                <Badge
                  variant="outline"
                  className={getCategoryColor(activity.category)}
                >
                  {activity.category || "neutral"}
                </Badge>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>{activity.computerName}</span>
                <span>•</span>
                <span>
                  {formatDistanceToNow(new Date(activity.startedAt), {
                    addSuffix: true,
                  })}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
