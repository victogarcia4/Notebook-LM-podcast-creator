import "dotenv/config";
import { prisma } from "./src/lib/db";

async function main() {
  // Find jobs that are stuck in RUNNING state
  const stuckJobs = await prisma.generationJob.findMany({
    where: { status: "RUNNING" },
    include: { podcast: true },
  });

  console.log(`Found ${stuckJobs.length} stuck job(s) in RUNNING state`);

  for (const job of stuckJobs) {
    console.log(`\nResetting job ${job.id} for podcast: ${job.podcast.title}`);
    console.log(`  Current state: ${job.status} / ${job.stage} / ${job.progress}%`);

    // Reset to QUEUED so worker can pick it up
    await prisma.generationJob.update({
      where: { id: job.id },
      data: {
        status: "QUEUED",
        stage: job.stage, // Keep current stage so worker knows where to resume
        progress: job.progress,
      },
    });

    console.log(`  ✅ Reset to QUEUED (will continue from ${job.stage})`);
  }

  console.log(`\nDone! Worker will pick up these jobs on next poll.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
