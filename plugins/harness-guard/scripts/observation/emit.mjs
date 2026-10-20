import { appendEvent } from './event.mjs';
import { requestWriter } from './writer.mjs';
let input = '', size = 0;
try {
  for await (const chunk of process.stdin) {
    size += chunk.length;
    if (size > 4096) { process.stdin.destroy(); throw Error('OVERSIZE'); }
    input += chunk.toString('utf8');
  }
  const event = JSON.parse(input);
  const result = await requestWriter(process.argv[2], event, 'append', { event }) ?? await appendEvent(process.argv[2], event);
  if (!result.written && !['CAPTURE_OFF', 'DUPLICATE'].includes(result.reasonCode)) process.exitCode = 1;
} catch { process.exitCode = 1; }
