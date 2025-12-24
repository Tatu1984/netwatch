import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Eye,
  Monitor,
  Shield,
  BarChart3,
  Clock,
  Users,
  CheckCircle,
  ArrowRight,
} from "lucide-react";

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-2">
            <Eye className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold">NetWatch Pro</span>
          </div>
          <nav className="hidden md:flex items-center gap-6">
            <Link href="#features" className="text-sm font-medium hover:text-primary">
              Features
            </Link>
            <Link href="#pricing" className="text-sm font-medium hover:text-primary">
              Pricing
            </Link>
            <Link href="#testimonials" className="text-sm font-medium hover:text-primary">
              Testimonials
            </Link>
          </nav>
          <div className="flex items-center gap-4">
            <Button variant="ghost" asChild>
              <Link href="/login">Sign In</Link>
            </Button>
            <Button asChild>
              <Link href="/register">Get Started</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <section className="container py-24 md:py-32">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
              Monitor Your Team&apos;s Productivity with{" "}
              <span className="text-primary">Confidence</span>
            </h1>
            <p className="mt-6 text-lg text-muted-foreground">
              NetWatch Pro provides comprehensive employee monitoring, activity tracking,
              and productivity analytics for modern enterprises. Gain insights into
              how your team works and optimize for success.
            </p>
            <div className="mt-10 flex items-center justify-center gap-4">
              <Button size="lg" asChild>
                <Link href="/register">
                  Start Free Trial
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button variant="outline" size="lg" asChild>
                <Link href="/dashboard">View Demo</Link>
              </Button>
            </div>
          </div>
        </section>

        <section id="features" className="container py-24 bg-muted/50">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Everything you need to monitor productivity
            </h2>
            <p className="mt-4 text-muted-foreground">
              Powerful features designed for enterprise-grade employee monitoring
            </p>
          </div>

          <div className="mx-auto mt-16 grid max-w-5xl gap-8 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-lg border bg-card p-6">
              <Monitor className="h-10 w-10 text-primary" />
              <h3 className="mt-4 text-lg font-semibold">Live Screen Monitoring</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                View real-time screens of all connected computers with automatic
                refresh and zoom capabilities.
              </p>
            </div>

            <div className="rounded-lg border bg-card p-6">
              <BarChart3 className="h-10 w-10 text-primary" />
              <h3 className="mt-4 text-lg font-semibold">Activity Reports</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Detailed reports on application usage, website visits, and
                productivity metrics with export options.
              </p>
            </div>

            <div className="rounded-lg border bg-card p-6">
              <Shield className="h-10 w-10 text-primary" />
              <h3 className="mt-4 text-lg font-semibold">Policy Enforcement</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Block or warn users about accessing unauthorized websites and
                applications with customizable rules.
              </p>
            </div>

            <div className="rounded-lg border bg-card p-6">
              <Clock className="h-10 w-10 text-primary" />
              <h3 className="mt-4 text-lg font-semibold">Time Tracking</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Automatic time tracking for applications and websites with idle
                detection and break monitoring.
              </p>
            </div>

            <div className="rounded-lg border bg-card p-6">
              <Users className="h-10 w-10 text-primary" />
              <h3 className="mt-4 text-lg font-semibold">Team Management</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Organize computers into groups, assign policies, and manage user
                access with role-based permissions.
              </p>
            </div>

            <div className="rounded-lg border bg-card p-6">
              <Eye className="h-10 w-10 text-primary" />
              <h3 className="mt-4 text-lg font-semibold">Screenshots & Recording</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Automatic screenshot capture and optional screen recording for
                compliance and audit purposes.
              </p>
            </div>
          </div>
        </section>

        <section id="pricing" className="container py-24">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Simple, transparent pricing
            </h2>
            <p className="mt-4 text-muted-foreground">
              Choose the plan that fits your team size
            </p>
          </div>

          <div className="mx-auto mt-16 grid max-w-5xl gap-8 lg:grid-cols-3">
            <div className="rounded-lg border bg-card p-8">
              <h3 className="text-lg font-semibold">Starter</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                For small teams getting started
              </p>
              <div className="mt-4">
                <span className="text-4xl font-bold">$5</span>
                <span className="text-muted-foreground">/user/month</span>
              </div>
              <ul className="mt-6 space-y-3">
                <li className="flex items-center gap-2 text-sm">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  Up to 10 computers
                </li>
                <li className="flex items-center gap-2 text-sm">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  Basic activity tracking
                </li>
                <li className="flex items-center gap-2 text-sm">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  7-day data retention
                </li>
                <li className="flex items-center gap-2 text-sm">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  Email support
                </li>
              </ul>
              <Button className="mt-8 w-full" variant="outline">
                Get Started
              </Button>
            </div>

            <div className="rounded-lg border-2 border-primary bg-card p-8 relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground">
                Most Popular
              </div>
              <h3 className="text-lg font-semibold">Professional</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                For growing organizations
              </p>
              <div className="mt-4">
                <span className="text-4xl font-bold">$12</span>
                <span className="text-muted-foreground">/user/month</span>
              </div>
              <ul className="mt-6 space-y-3">
                <li className="flex items-center gap-2 text-sm">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  Unlimited computers
                </li>
                <li className="flex items-center gap-2 text-sm">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  Advanced analytics
                </li>
                <li className="flex items-center gap-2 text-sm">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  30-day data retention
                </li>
                <li className="flex items-center gap-2 text-sm">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  Priority support
                </li>
                <li className="flex items-center gap-2 text-sm">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  Screen recording
                </li>
              </ul>
              <Button className="mt-8 w-full">Get Started</Button>
            </div>

            <div className="rounded-lg border bg-card p-8">
              <h3 className="text-lg font-semibold">Enterprise</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                For large organizations
              </p>
              <div className="mt-4">
                <span className="text-4xl font-bold">Custom</span>
              </div>
              <ul className="mt-6 space-y-3">
                <li className="flex items-center gap-2 text-sm">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  Everything in Professional
                </li>
                <li className="flex items-center gap-2 text-sm">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  Custom integrations
                </li>
                <li className="flex items-center gap-2 text-sm">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  90-day data retention
                </li>
                <li className="flex items-center gap-2 text-sm">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  Dedicated support
                </li>
                <li className="flex items-center gap-2 text-sm">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  On-premise deployment
                </li>
              </ul>
              <Button className="mt-8 w-full" variant="outline">
                Contact Sales
              </Button>
            </div>
          </div>
        </section>

        <section id="testimonials" className="container py-24 bg-muted/50">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Trusted by leading companies
            </h2>
          </div>

          <div className="mx-auto mt-16 grid max-w-5xl gap-8 lg:grid-cols-3">
            <div className="rounded-lg border bg-card p-6">
              <p className="text-sm text-muted-foreground">
                &ldquo;NetWatch Pro has transformed how we manage our remote team.
                The productivity insights are invaluable.&rdquo;
              </p>
              <div className="mt-4 flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-sm font-medium">JD</span>
                </div>
                <div>
                  <p className="text-sm font-medium">John Doe</p>
                  <p className="text-xs text-muted-foreground">CTO, TechCorp</p>
                </div>
              </div>
            </div>

            <div className="rounded-lg border bg-card p-6">
              <p className="text-sm text-muted-foreground">
                &ldquo;The policy enforcement features helped us maintain compliance
                across all our departments.&rdquo;
              </p>
              <div className="mt-4 flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-sm font-medium">SM</span>
                </div>
                <div>
                  <p className="text-sm font-medium">Sarah Miller</p>
                  <p className="text-xs text-muted-foreground">HR Director, GlobalInc</p>
                </div>
              </div>
            </div>

            <div className="rounded-lg border bg-card p-6">
              <p className="text-sm text-muted-foreground">
                &ldquo;Easy to deploy, powerful features, and excellent support.
                Exactly what we needed.&rdquo;
              </p>
              <div className="mt-4 flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-sm font-medium">RJ</span>
                </div>
                <div>
                  <p className="text-sm font-medium">Robert Johnson</p>
                  <p className="text-xs text-muted-foreground">IT Manager, StartupXYZ</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="container py-24">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Ready to boost your team&apos;s productivity?
            </h2>
            <p className="mt-4 text-muted-foreground">
              Start your 14-day free trial today. No credit card required.
            </p>
            <div className="mt-10 flex items-center justify-center gap-4">
              <Button size="lg" asChild>
                <Link href="/register">
                  Start Free Trial
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t py-12">
        <div className="container flex flex-col items-center justify-between gap-4 md:flex-row">
          <div className="flex items-center gap-2">
            <Eye className="h-5 w-5 text-primary" />
            <span className="font-bold">NetWatch Pro</span>
          </div>
          <p className="text-sm text-muted-foreground">
            &copy; 2024 Infinititech Partners. All rights reserved.
          </p>
          <div className="flex items-center gap-4">
            <Link href="#" className="text-sm text-muted-foreground hover:text-foreground">
              Privacy
            </Link>
            <Link href="#" className="text-sm text-muted-foreground hover:text-foreground">
              Terms
            </Link>
            <Link href="#" className="text-sm text-muted-foreground hover:text-foreground">
              Contact
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
