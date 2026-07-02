// Simple wrapper to run the TypeScript worker with tsx
const { spawn } = require('child_process');
const path = require('path');

const worker = spawn('npx', ['tsx', 'src/workers/worker.ts'], {
  cwd: __dirname,
  stdio: 'inherit',
  shell: true
});

worker.on('exit', (code) => {
  console.log(`Worker exited with code ${code}`);
  process.exit(code);
});

// Forward signals
process.on('SIGINT', () => worker.kill('SIGINT'));
process.on('SIGTERM', () => worker.kill('SIGTERM'));
