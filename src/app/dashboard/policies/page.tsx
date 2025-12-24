import prisma from "@/lib/prisma";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Globe, AppWindow, Edit, Trash2, Shield } from "lucide-react";

async function getBlockRules() {
  return prisma.blockRule.findMany({
    orderBy: { createdAt: "desc" },
  });
}

export default async function PoliciesPage() {
  const rules = await getBlockRules();

  const websiteRules = rules.filter((r) => r.type === "WEBSITE");
  const appRules = rules.filter((r) => r.type === "APP");

  const getActionBadge = (action: string) => {
    switch (action) {
      case "BLOCK":
        return <Badge variant="destructive">Block</Badge>;
      case "WARN":
        return <Badge className="bg-yellow-500 hover:bg-yellow-600">Warn</Badge>;
      case "LOG":
        return <Badge variant="secondary">Log Only</Badge>;
      default:
        return <Badge variant="outline">{action}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Policies</h1>
          <p className="text-muted-foreground">
            Manage website and application blocking rules
          </p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add Rule
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Rules
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{rules.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active Rules
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-500">
              {rules.filter((r) => r.isActive).length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Blocked Today
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-red-500">23</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="websites">
        <TabsList>
          <TabsTrigger value="websites" className="gap-2">
            <Globe className="h-4 w-4" />
            Website Rules ({websiteRules.length})
          </TabsTrigger>
          <TabsTrigger value="applications" className="gap-2">
            <AppWindow className="h-4 w-4" />
            Application Rules ({appRules.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="websites">
          <Card>
            <CardHeader>
              <CardTitle>Website Blocking Rules</CardTitle>
              <CardDescription>
                Control access to websites across all monitored computers
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Pattern</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Groups</TableHead>
                    <TableHead>Active</TableHead>
                    <TableHead className="w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {websiteRules.map((rule) => (
                    <TableRow key={rule.id}>
                      <TableCell className="font-mono">{rule.pattern}</TableCell>
                      <TableCell>{getActionBadge(rule.action)}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {rule.groupIds || "All Groups"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Switch checked={rule.isActive} />
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon">
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="applications">
          <Card>
            <CardHeader>
              <CardTitle>Application Blocking Rules</CardTitle>
              <CardDescription>
                Control which applications can be used on monitored computers
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Application</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Groups</TableHead>
                    <TableHead>Active</TableHead>
                    <TableHead className="w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {appRules.map((rule) => (
                    <TableRow key={rule.id}>
                      <TableCell className="font-medium">{rule.pattern}</TableCell>
                      <TableCell>{getActionBadge(rule.action)}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {rule.groupIds || "All Groups"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Switch checked={rule.isActive} />
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon">
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <CardTitle>Quick Add Common Rules</CardTitle>
          </div>
          <CardDescription>
            Add commonly blocked websites and applications with one click
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm">Block Social Media</Button>
            <Button variant="outline" size="sm">Block Streaming Sites</Button>
            <Button variant="outline" size="sm">Block Gaming Sites</Button>
            <Button variant="outline" size="sm">Block Adult Content</Button>
            <Button variant="outline" size="sm">Block File Sharing</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
