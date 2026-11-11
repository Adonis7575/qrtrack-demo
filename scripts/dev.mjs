// Runs the backend (with --watch) and the Vite dashboard together.
import { spawn } from 'node:child_process';

const procs = [
  { name: 'api', color: 36, args: ['run', 'dev', '--prefix', 'backend'] },
  { name: 'web', color: 35, args: ['run', 'dev', '--prefix', 'frontend'] },
].map(({ name, color, args }) => {
  const child = spawn('npm', args, { shell: true, stdio: ['ignore', 'pipe', 'pipe'] });
  const tag = `\x1b[${color}m[${name}]\x1b[0m `;
  const relay = (stream, out) => stream.on('data', (chunk) => {
    for (const line of chunk.toString().split(/\r?\n/)) if (line.trim()) out.write(tag + line + '\n');
  });
  relay(child.stdout, process.stdout);
  relay(child.stderr, process.stderr);
  child.on('exit', (code) => {
    console.log(`${tag}exited (${code ?? 'signal'})`);
    stopAll();
  });
  return child;
});

let stopping = false;
function stopAll() {
  if (stopping) return;
  stopping = true;
  for (const child of procs) if (child.exitCode === null) child.kill();
  setTimeout(() => process.exit(0), 300);
}

process.on('SIGINT', stopAll);
process.on('SIGTERM', stopAll);
console.log('QRTrack dev: open http://localhost:5173 (Ctrl+C to stop)');
