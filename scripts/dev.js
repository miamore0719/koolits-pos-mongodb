import { spawn } from 'node:child_process';

const commands = [
  ['server', 'npm', ['run', 'server']],
  ['client', 'npm', ['run', 'client']]
];

const children = commands.map(([name, command, args]) => {
  const child = spawn(command, args, { stdio: ['inherit', 'pipe', 'pipe'] });
  child.stdout.on('data', (data) => process.stdout.write(`[${name}] ${data}`));
  child.stderr.on('data', (data) => process.stderr.write(`[${name}] ${data}`));
  child.on('exit', (code) => {
    if (code) process.exitCode = code;
  });
  return child;
});

const shutdown = () => {
  for (const child of children) child.kill('SIGTERM');
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
