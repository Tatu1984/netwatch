import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AppWindow, Globe, TrendingUp, Download, Calendar } from "lucide-react";

export default function ReportsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Reports</h1>
          <p className="text-muted-foreground">
            Generate and view activity reports for your organization
          </p>
        </div>
        <Button>
          <Download className="mr-2 h-4 w-4" />
          Export All
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Link href="/dashboard/reports/applications">
          <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
            <CardHeader>
              <AppWindow className="h-10 w-10 text-primary" />
              <CardTitle className="mt-4">Application Usage</CardTitle>
              <CardDescription>
                Track time spent on different applications across all computers
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="h-4 w-4" />
                Last updated: Today
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/dashboard/reports/websites">
          <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
            <CardHeader>
              <Globe className="h-10 w-10 text-primary" />
              <CardTitle className="mt-4">Website Usage</CardTitle>
              <CardDescription>
                Monitor web browsing activity and categorize visited websites
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="h-4 w-4" />
                Last updated: Today
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/dashboard/reports/productivity">
          <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
            <CardHeader>
              <TrendingUp className="h-10 w-10 text-primary" />
              <CardTitle className="mt-4">Productivity Analytics</CardTitle>
              <CardDescription>
                Analyze productivity trends and team performance metrics
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="h-4 w-4" />
                Last updated: Today
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Quick Stats</CardTitle>
          <CardDescription>Overview of the past 7 days</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="rounded-lg border p-4">
              <p className="text-sm text-muted-foreground">Total Active Time</p>
              <p className="text-2xl font-bold">847h 32m</p>
              <p className="text-xs text-green-500">+12% from last week</p>
            </div>
            <div className="rounded-lg border p-4">
              <p className="text-sm text-muted-foreground">Productive Time</p>
              <p className="text-2xl font-bold">612h 18m</p>
              <p className="text-xs text-green-500">+8% from last week</p>
            </div>
            <div className="rounded-lg border p-4">
              <p className="text-sm text-muted-foreground">Top Application</p>
              <p className="text-2xl font-bold">VS Code</p>
              <p className="text-xs text-muted-foreground">156h total</p>
            </div>
            <div className="rounded-lg border p-4">
              <p className="text-sm text-muted-foreground">Top Website</p>
              <p className="text-2xl font-bold">github.com</p>
              <p className="text-xs text-muted-foreground">89h total</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
