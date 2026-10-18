import { appendEvent } from './event.mjs';
let input = '', size = 0;
try {
  for await (const chunk of process.stdin) {
    size += chunk.length;
    if (size > 4096) { process.stdin.destroy(); throw Error('OVERSIZE'); }
    input += chunk.toString('utf8');
  }
  const result = await appendEvent(process.argv[2], JSON.parse(input));
  if (!result.written && !['CAPTURE_OFF', 'DUPLICATE'].includes(result.reasonCode)) process.exitCode = 1;
} catch { process.exitCode = 1; }
