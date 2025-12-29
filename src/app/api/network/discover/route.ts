import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { exec } from "child_process";
import { promisify } from "util";
import * as os from "os";

const execAsync = promisify(exec);

interface DiscoveredDevice {
  ip: string;
  hostname: string | null;
  mac: string | null;
  status: "online" | "offline";
  responseTime: number | null;
}

// Get local network interface info
function getLocalNetworkInfo(): { ip: string; subnet: string } | null {
  const interfaces = os.networkInterfaces();

  for (const [, addrs] of Object.entries(interfaces)) {
    if (!addrs) continue;
    for (const addr of addrs) {
      if (addr.family === "IPv4" && !addr.internal) {
        // Calculate subnet from netmask
        const ipParts = addr.address.split(".").map(Number);
        const maskParts = addr.netmask.split(".").map(Number);
        const networkParts = ipParts.map((ip, i) => ip & maskParts[i]);
        return {
          ip: addr.address,
          subnet: networkParts.slice(0, 3).join("."),
        };
      }
    }
  }
  return null;
}

// Ping a single IP
async function pingIP(ip: string): Promise<{ online: boolean; responseTime: number | null }> {
  const platform = os.platform();
  const pingCmd = platform === "win32"
    ? `ping -n 1 -w 1000 ${ip}`
    : `ping -c 1 -W 1 ${ip}`;

  try {
    const start = Date.now();
    await execAsync(pingCmd, { timeout: 2000 });
    return { online: true, responseTime: Date.now() - start };
  } catch {
    return { online: false, responseTime: null };
  }
}

// Try to get hostname from IP
async function getHostname(ip: string): Promise<string | null> {
  const platform = os.platform();

  try {
    if (platform === "win32") {
      const { stdout } = await execAsync(`nbtstat -A ${ip}`, { timeout: 3000 });
      const match = stdout.match(/<00>\s+UNIQUE\s+.*\n\s*(\S+)/);
      return match ? match[1] : null;
    } else {
      // Try DNS reverse lookup
      const { stdout } = await execAsync(`host ${ip}`, { timeout: 3000 });
      const match = stdout.match(/pointer\s+(.+)\./);
      return match ? match[1] : null;
    }
  } catch {
    return null;
  }
}

// Get MAC address from ARP table
async function getMacAddress(ip: string): Promise<string | null> {
  const platform = os.platform();

  try {
    if (platform === "win32") {
      const { stdout } = await execAsync(`arp -a ${ip}`, { timeout: 2000 });
      const match = stdout.match(/([0-9a-fA-F]{2}[:-]){5}[0-9a-fA-F]{2}/);
      return match ? match[0].toUpperCase().replace(/-/g, ":") : null;
    } else {
      const { stdout } = await execAsync(`arp -n ${ip}`, { timeout: 2000 });
      const match = stdout.match(/([0-9a-fA-F]{2}:){5}[0-9a-fA-F]{2}/);
      return match ? match[0].toUpperCase() : null;
    }
  } catch {
    return null;
  }
}

// POST /api/network/discover - Discover devices on the network
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
    const { subnet, startIp, endIp } = body;

    let networkSubnet = subnet;
    let start = startIp || 1;
    let end = endIp || 254;

    // If no subnet provided, detect local network
    if (!networkSubnet) {
      const localNetwork = getLocalNetworkInfo();
      if (!localNetwork) {
        return NextResponse.json(
          { error: "Could not detect local network" },
          { status: 400 }
        );
      }
      networkSubnet = localNetwork.subnet;
    }

    // Limit range to prevent abuse
    if (end - start > 50) {
      end = start + 50;
    }

    const discoveredDevices: DiscoveredDevice[] = [];
    const scanPromises: Promise<void>[] = [];

    // Scan IPs in parallel (batches of 10)
    for (let i = start; i <= end; i++) {
      const ip = `${networkSubnet}.${i}`;

      scanPromises.push(
        (async () => {
          const pingResult = await pingIP(ip);

          if (pingResult.online) {
            const [hostname, mac] = await Promise.all([
              getHostname(ip),
              getMacAddress(ip),
            ]);

            discoveredDevices.push({
              ip,
              hostname,
              mac,
              status: "online",
              responseTime: pingResult.responseTime,
            });
          }
        })()
      );

      // Process in batches of 10 to avoid overwhelming the system
      if (scanPromises.length >= 10) {
        await Promise.all(scanPromises);
        scanPromises.length = 0;
      }
    }

    // Wait for remaining scans
    if (scanPromises.length > 0) {
      await Promise.all(scanPromises);
    }

    // Sort by IP
    discoveredDevices.sort((a, b) => {
      const aNum = parseInt(a.ip.split(".")[3]);
      const bNum = parseInt(b.ip.split(".")[3]);
      return aNum - bNum;
    });

    return NextResponse.json({
      subnet: networkSubnet,
      scanned: { start, end },
      devices: discoveredDevices,
      count: discoveredDevices.length,
    });
  } catch (error) {
    console.error("[Network Discovery] Error:", error);
    return NextResponse.json(
      { error: "Network discovery failed" },
      { status: 500 }
    );
  }
}

// GET /api/network/discover - Get local network info
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const localNetwork = getLocalNetworkInfo();

    if (!localNetwork) {
      return NextResponse.json(
        { error: "Could not detect local network" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      localIp: localNetwork.ip,
      subnet: localNetwork.subnet,
      suggestedRange: { start: 1, end: 254 },
    });
  } catch (error) {
    console.error("[Network Info] Error:", error);
    return NextResponse.json(
      { error: "Failed to get network info" },
      { status: 500 }
    );
  }
}
