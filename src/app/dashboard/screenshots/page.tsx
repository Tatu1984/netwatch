import prisma from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, Download, Calendar, Filter } from "lucide-react";
import Image from "next/image";
import { format } from "date-fns";

async function getScreenshots() {
  return prisma.screenshot.findMany({
    where: {
      imageUrl: { not: null },
    },
    take: 50,
    orderBy: { capturedAt: "desc" },
    include: {
      computer: {
        select: { name: true, hostname: true },
      },
    },
  });
}

async function getComputers() {
  return prisma.computer.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}

export default async function ScreenshotsPage() {
  const [screenshots, computers] = await Promise.all([
    getScreenshots(),
    getComputers(),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Screenshots</h1>
          <p className="text-muted-foreground">
            View captured screenshots from all monitored computers
          </p>
        </div>
        <Button>
          <Download className="mr-2 h-4 w-4" />
          Export Selected
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search screenshots..." className="pl-8" />
            </div>
            <Select defaultValue="all">
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Select computer" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Computers</SelectItem>
                {computers.map((computer) => (
                  <SelectItem key={computer.id} value={computer.id}>
                    {computer.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline">
              <Calendar className="mr-2 h-4 w-4" />
              Date Range
            </Button>
            <Button variant="outline" size="icon">
              <Filter className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {screenshots.map((screenshot) => (
              <Card key={screenshot.id} className="overflow-hidden">
                <div className="relative aspect-video bg-muted">
                  <Image
                    src={screenshot.imageUrl!}
                    alt={`Screenshot from ${screenshot.computer.name}`}
                    fill
                    className="object-cover"
                    unoptimized
                  />
                </div>
                <CardContent className="p-3">
                  <p className="font-medium truncate">{screenshot.computer.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(screenshot.capturedAt), "PPp")}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
