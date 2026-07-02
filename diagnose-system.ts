#!/usr/bin/env tsx
/**
 * System Health Diagnostic Script
 * Checks all critical components and reports status
 */
import "dotenv/config";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { existsSync } from "node:fs";
import { prisma } from "./src/lib/db";
import { authStatus } from "./src/lib/notebooklm/client";

const execAsync = promisify(exec);

interface HealthCheck {
  name: string;
  status: "✅ OK" | "⚠️ WARNING" | "❌ FAIL";
  message: string;
  fix?: string;
}

const checks: HealthCheck[] = [];

function check(name: string, status: HealthCheck["status"], message: string, fix?: string) {
  checks.push({ name, status, message, fix });
}

async function diagnose() {
  console.log("🏥 Podcast Creator - System Health Check\n");
  console.log("=" .repeat(60));

  // 1. Environment Variables
  console.log("\n📋 Environment Variables:");
  const requiredVars = [
    "DATABASE_URL",
    "NLM_PATH",
    "STORAGE_DRIVER",
    "S3_ENDPOINT",
    "S3_BUCKET",
    "S3_ACCESS_KEY_ID",
    "S3_SECRET_ACCESS_KEY",
    "S3_PUBLIC_BASE_URL",
    "S3_KEY_PREFIX",
  ];

  for (const v of requiredVars) {
    if (process.env[v]) {
      const value = v.includes("SECRET") || v.includes("PASSWORD")
        ? "***"
        : process.env[v]!.substring(0, 50);
      check(v, "✅ OK", value);
    } else {
      check(v, "❌ FAIL", "Missing", `Add ${v} to .env file`);
    }
  }

  // 2. Database Connection
  console.log("\n💾 Database Connection:");
  try {
    await prisma.$connect();
    const podcastCount = await prisma.podcast.count();
    const jobCount = await prisma.generationJob.count();
    const stuckJobs = await prisma.generationJob.count({ where: { status: "RUNNING" } });

    check("Database", "✅ OK", `Connected (${podcastCount} podcasts, ${jobCount} jobs)`);

    if (stuckJobs > 0) {
      check("Stuck Jobs", "⚠️ WARNING", `${stuckJobs} job(s) stuck in RUNNING state`, "Run: npx tsx reset-stuck-job.ts");
    } else {
      check("Stuck Jobs", "✅ OK", "No stuck jobs");
    }
  } catch (err: any) {
    check("Database", "❌ FAIL", err.message, "Check DATABASE_URL in .env");
  }

  // 3. NotebookLM CLI
  console.log("\n🤖 NotebookLM CLI:");
  const nlmPath = process.env.NLM_PATH;
  if (nlmPath && existsSync(nlmPath)) {
    check("CLI Installed", "✅ OK", nlmPath);

    // Check authentication
    try {
      const authResult = await authStatus();
      if (authResult.valid) {
        check("Authentication", "✅ OK", "Session valid");
      } else {
        check("Authentication", "❌ FAIL", "Session expired or invalid", "Run: notebooklm login");
      }
    } catch (err: any) {
      check("Authentication", "❌ FAIL", err.message, "Run: notebooklm login");
    }
  } else {
    check("CLI Installed", "❌ FAIL", `Not found at: ${nlmPath}`, "Install notebooklm-py");
  }

  // 4. Storage Configuration
  console.log("\n📦 Storage Configuration:");
  const storageDriver = process.env.STORAGE_DRIVER;
  if (storageDriver === "s3") {
    check("Storage Driver", "✅ OK", "S3/R2 configured");

    // Validate S3 config
    const s3Vars = ["S3_ENDPOINT", "S3_BUCKET", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY"];
    const missingS3 = s3Vars.filter(v => !process.env[v]);
    if (missingS3.length > 0) {
      check("S3 Config", "❌ FAIL", `Missing: ${missingS3.join(", ")}`, "Add missing S3_* variables to .env");
    } else {
      check("S3 Config", "✅ OK", "All S3 variables present");
    }
  } else if (storageDriver === "local") {
    check("Storage Driver", "⚠️ WARNING", "Using local storage (won't work in Vercel)", "Set STORAGE_DRIVER=s3 for production");
  } else {
    check("Storage Driver", "❌ FAIL", "Not set", "Set STORAGE_DRIVER=s3 in .env");
  }

  // 5. Worker Status
  console.log("\n⚙️ Worker Status:");
  try {
    // Check if worker process is running (PM2 or manual)
    try {
      const { stdout } = await execAsync("pm2 list --no-color");
      if (stdout.includes("podcast-worker")) {
        const isOnline = stdout.includes("podcast-worker") && stdout.includes("online");
        if (isOnline) {
          check("Worker Service", "✅ OK", "Running via PM2");
        } else {
          check("Worker Service", "⚠️ WARNING", "PM2 process exists but not online", "Run: pm2 restart podcast-worker");
        }
      } else {
        check("Worker Service", "❌ FAIL", "Not installed in PM2", "Run: .\\setup-worker-service.ps1");
      }
    } catch {
      check("Worker Service", "❌ FAIL", "PM2 not installed or worker not configured", "Run: .\\setup-worker-service.ps1");
    }

    // Check WorkerStatus in database
    const workerStatus = await prisma.workerStatus.findFirst({
      orderBy: { lastSeenAt: "desc" },
    });

    if (workerStatus) {
      const lastSeenAgo = Date.now() - new Date(workerStatus.lastSeenAt).getTime();
      const minutesAgo = Math.floor(lastSeenAgo / 60000);

      if (minutesAgo < 2) {
        check("Worker Heartbeat", "✅ OK", `Last seen ${minutesAgo}m ago`);
      } else {
        check("Worker Heartbeat", "⚠️ WARNING", `Last seen ${minutesAgo}m ago (might be offline)`, "Check if worker is running");
      }

      if (workerStatus.authValid) {
        check("Worker Auth", "✅ OK", "NotebookLM session valid");
      } else {
        check("Worker Auth", "❌ FAIL", "NotebookLM session invalid", "Re-login required");
      }
    } else {
      check("Worker Heartbeat", "⚠️ WARNING", "No worker status in database", "Worker hasn't reported yet");
    }
  } catch (err: any) {
    check("Worker Status", "❌ FAIL", err.message);
  }

  // Print Results
  console.log("\n" + "=".repeat(60));
  console.log("\n📊 RESULTS:\n");

  const failures = checks.filter(c => c.status === "❌ FAIL");
  const warnings = checks.filter(c => c.status === "⚠️ WARNING");
  const successes = checks.filter(c => c.status === "✅ OK");

  for (const c of checks) {
    console.log(`${c.status} ${c.name}: ${c.message}`);
    if (c.fix) {
      console.log(`   💡 Fix: ${c.fix}`);
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log(`\n✅ ${successes.length} OK  |  ⚠️ ${warnings.length} WARNINGS  |  ❌ ${failures.length} FAILURES\n`);

  if (failures.length === 0 && warnings.length === 0) {
    console.log("🎉 System is healthy and ready for production!");
  } else if (failures.length === 0) {
    console.log("⚠️  System is functional but has warnings. Review above.");
  } else {
    console.log("❌ System has critical failures. Fix the ❌ items above before using.");
  }

  await prisma.$disconnect();
  process.exit(failures.length > 0 ? 1 : 0);
}

diagnose().catch(console.error);
