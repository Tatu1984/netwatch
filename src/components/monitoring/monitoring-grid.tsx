"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Maximize2, MoreVertical, Camera, Video, Power } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface Computer {
  id: string;
  name: string;
  hostname: string;
  status: string;
  osType: string;
  lastSeen: Date | null;
  groupName: string;
  groupColor: string;
  imageUrl: string;
}

interface MonitoringGridProps {
  computers: Computer[];
}

export function MonitoringGrid({ computers }: MonitoringGridProps) {
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setRefreshKey((prev) => prev + 1);
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {computers.map((computer) => (
        <Card
          key={computer.id}
          className={`overflow-hidden transition-all hover:shadow-lg ${
            computer.status === "OFFLINE" ? "opacity-60" : ""
          }`}
        >
          <div className="relative aspect-video bg-muted">
            {computer.status === "ONLINE" ? (
              <Image
                src={`${computer.imageUrl}?v=${refreshKey}`}
                alt={`${computer.name} screen`}
                fill
                className="object-cover"
                unoptimized
              />
            ) : (
              <div className="flex h-full items-center justify-center">
                <div className="text-center">
                  <Power className="mx-auto h-8 w-8 text-muted-foreground" />
                  <p className="mt-2 text-sm text-muted-foreground">Offline</p>
                </div>
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
            <div className="absolute bottom-2 left-2 right-2 flex items-end justify-between">
              <div>
                <Badge
                  variant="secondary"
                  className="mb-1"
                  style={{ backgroundColor: computer.groupColor, color: "white" }}
                >
                  {computer.groupName}
                </Badge>
                <p className="text-sm font-medium text-white">{computer.name}</p>
              </div>
              <Badge
                variant={computer.status === "ONLINE" ? "default" : "secondary"}
                className={
                  computer.status === "ONLINE"
                    ? "bg-green-500 hover:bg-green-600"
                    : ""
                }
              >
                {computer.status}
              </Badge>
            </div>
            {computer.status === "ONLINE" && (
              <Link
                href={`/dashboard/monitoring/${computer.id}`}
                className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors hover:bg-black/30"
              >
                <Maximize2 className="h-8 w-8 text-white opacity-0 transition-opacity hover:opacity-100" />
              </Link>
            )}
          </div>
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <p className="truncate text-xs text-muted-foreground">
                  {computer.hostname}
                </p>
                {computer.lastSeen && (
                  <p className="text-xs text-muted-foreground">
                    Last seen{" "}
                    {formatDistanceToNow(new Date(computer.lastSeen), {
                      addSuffix: true,
                    })}
                  </p>
                )}
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem asChild>
                    <Link href={`/dashboard/monitoring/${computer.id}`}>
                      <Maximize2 className="mr-2 h-4 w-4" />
                      Full Screen
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <Camera className="mr-2 h-4 w-4" />
                    Take Screenshot
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <Video className="mr-2 h-4 w-4" />
                    Start Recording
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href={`/dashboard/computers/${computer.id}`}>
                      View Details
                    </Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
