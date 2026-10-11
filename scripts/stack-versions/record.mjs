import { closeSync, fsyncSync, linkSync, lstatSync, openSync, unlinkSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { checkStackRecord } from '../../plugins/harness-guard/scripts/check-stack-record.mjs';
export function writeVersionRecord(projectRoot, result, {publish=linkSync}={}) {
  const root=resolve(projectRoot), file=resolve(root,'harness-stack.versions.json');
  const record=Object.fromEntries(['schema','selection','observed','targets','requirements','sources','inputs','issues','status'].map(key=>[key,result[key]]));
  const check=()=>{const validated=checkStackRecord(root,record);if(!validated.valid) throw new Error('Record/input drift or incomplete version evidence; apply refused.');};
  check();
  try { lstatSync(file);throw new Error('Existing version record is preserved.'); } catch(error) { if(error.code !== 'ENOENT') throw error; }
  const temporary=resolve(root,`.harness-stack-${randomUUID()}.tmp`);let descriptor;
  try {
    descriptor=openSync(temporary,'wx',0o600);writeFileSync(descriptor,JSON.stringify(record,null,2)+'\n');fsyncSync(descriptor);closeSync(descriptor);descriptor=undefined;
    check();publish(temporary,file);return file;
  } finally { if(descriptor !== undefined) closeSync(descriptor);try {unlinkSync(temporary);}catch(error){if(error.code !== 'ENOENT') throw error;} }
}
