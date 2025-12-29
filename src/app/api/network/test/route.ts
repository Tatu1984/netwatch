import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { exec } from "child_process";
import { promisify } from "util";
import * as os from "os";
import * as net from "net";

const execAsync = promisify(exec);

interface ConnectivityTest {
  name: string;
  status: "success" | "failed" | "warning";
  message: string;
  details?: string;
}

interface TestResult {
  ip: string;
  hostname: string | null;
  overallStatus: "ready" | "partial" | "unreachable";
  tests: ConnectivityTest[];
  timestamp: string;
}

// Ping test
async function testPing(ip: string): Promise<ConnectivityTest> {
  const platform = os.platform();
  const pingCmd = platform === "win32"
    ? `ping -n 3 -w 1000 ${ip}`
    : `ping -c 3 -W 1 ${ip}`;

  try {
    const start = Date.now();
    const { stdout } = await execAsync(pingCmd, { timeout: 5000 });
    const elapsed = Date.now() - start;

    // Parse packet loss
    const lossMatch = stdout.match(/(\d+)%\s*(packet\s*)?loss/i);
    const loss = lossMatch ? parseInt(lossMatch[1]) : 0;

    // Parse average time
    const timeMatch = stdout.match(/Average\s*=\s*(\d+)ms|avg.*?(\d+\.?\d*)/i);
    const avgTime = timeMatch ? parseFloat(timeMatch[1] || timeMatch[2]) : elapsed / 3;

    if (loss === 0) {
      return {
        name: "ICMP Ping",
        status: "success",
        message: `Host responding (${avgTime.toFixed(0)}ms avg)`,
        details: `0% packet loss`,
      };
    } else if (loss < 100) {
      return {
        name: "ICMP Ping",
        status: "warning",
        message: `Intermittent connectivity`,
        details: `${loss}% packet loss`,
      };
    }
    return {
      name: "ICMP Ping",
      status: "failed",
      message: "Host not responding",
      details: "100% packet loss",
    };
  } catch {
    return {
      name: "ICMP Ping",
      status: "failed",
      message: "Host unreachable",
      details: "Ping timed out",
    };
  }
}

// Port check
async function testPort(ip: string, port: number, serviceName: string): Promise<ConnectivityTest> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    const timeout = 3000;

    socket.setTimeout(timeout);

    socket.on("connect", () => {
      socket.destroy();
      resolve({
        name: `${serviceName} (Port ${port})`,
        status: "success",
        message: `Port ${port} is open`,
        details: `${serviceName} service accessible`,
      });
    });

    socket.on("timeout", () => {
      socket.destroy();
      resolve({
        name: `${serviceName} (Port ${port})`,
        status: "failed",
        message: `Port ${port} timeout`,
        details: "Connection timed out",
      });
    });

    socket.on("error", (err) => {
      socket.destroy();
      resolve({
        name: `${serviceName} (Port ${port})`,
        status: "failed",
        message: `Port ${port} closed`,
        details: err.message,
      });
    });

    socket.connect(port, ip);
  });
}

// Try to get hostname
async function resolveHostname(ip: string): Promise<string | null> {
  try {
    const { stdout } = await execAsync(
      os.platform() === "win32"
        ? `nslookup ${ip}`
        : `host ${ip}`,
      { timeout: 5000 }
    );

    if (os.platform() === "win32") {
      const match = stdout.match(/Name:\s+(\S+)/);
      return match ? match[1] : null;
    } else {
      const match = stdout.match(/pointer\s+(.+)\./);
      return match ? match[1] : null;
    }
  } catch {
    return null;
  }
}

// Check if WMI/WinRM is accessible (Windows)
async function testWinRM(ip: string): Promise<ConnectivityTest> {
  return testPort(ip, 5985, "WinRM HTTP");
}

// Check if SSH is accessible (Linux/Mac)
async function testSSH(ip: string): Promise<ConnectivityTest> {
  return testPort(ip, 22, "SSH");
}

// Check if RDP is accessible (Windows)
async function testRDP(ip: string): Promise<ConnectivityTest> {
  return testPort(ip, 3389, "RDP");
}

// Check if SMB/File Sharing is accessible
async function testSMB(ip: string): Promise<ConnectivityTest> {
  return testPort(ip, 445, "SMB/File Sharing");
}

// Check if NetWatch Agent port is accessible
async function testAgentPort(ip: string): Promise<ConnectivityTest> {
  // The agent typically listens on these ports for commands
  const result = await testPort(ip, 4001, "NetWatch Agent");

  if (result.status === "failed") {
    return {
      name: "NetWatch Agent",
      status: "warning",
      message: "Agent not detected",
      details: "Install NetWatch Agent on this computer for full monitoring",
    };
  }
  return result;
}

// POST /api/network/test - Test connectivity to a specific IP
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.user.role === "VIEWER") {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    const body = await req.json();
    const { ip, osType } = body;

    if (!ip) {
      return NextResponse.json({ error: "IP address is required" }, { status: 400 });
    }

    // Validate IP format
    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (!ipRegex.test(ip)) {
      return NextResponse.json({ error: "Invalid IP address format" }, { status: 400 });
    }

    // Run tests in parallel
    const hostname = await resolveHostname(ip);

    const tests: ConnectivityTest[] = [];

    // Always run ping test
    tests.push(await testPing(ip));

    // Run OS-specific tests
    if (osType === "windows") {
      const [rdp, smb, winrm] = await Promise.all([
        testRDP(ip),
        testSMB(ip),
        testWinRM(ip),
      ]);
      tests.push(rdp, smb, winrm);
    } else if (osType === "linux" || osType === "macos") {
      const ssh = await testSSH(ip);
      tests.push(ssh);
    } else {
      // Unknown OS - test common ports
      const [ssh, rdp, smb] = await Promise.all([
        testSSH(ip),
        testRDP(ip),
        testSMB(ip),
      ]);
      tests.push(ssh, rdp, smb);
    }

    // Always check for NetWatch agent
    tests.push(await testAgentPort(ip));

    // Determine overall status
    const successCount = tests.filter((t) => t.status === "success").length;
    const failedCount = tests.filter((t) => t.status === "failed").length;

    let overallStatus: "ready" | "partial" | "unreachable";
    if (tests[0].status === "failed") {
      // Ping failed
      overallStatus = "unreachable";
    } else if (successCount >= tests.length / 2) {
      overallStatus = "ready";
    } else {
      overallStatus = "partial";
    }

    const result: TestResult = {
      ip,
      hostname,
      overallStatus,
      tests,
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error("[Connectivity Test] Error:", error);
    return NextResponse.json(
      { error: "Connectivity test failed" },
      { status: 500 }
    );
  }
}
