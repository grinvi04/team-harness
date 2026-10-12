#!/usr/bin/env node
import { realpathSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { runStackRecordCLI } from '../plugins/harness-guard/scripts/check-stack-record.mjs';
export { checkStackRecord } from '../plugins/harness-guard/scripts/check-stack-record.mjs';
if(process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  try { process.exitCode=runStackRecordCLI(process.argv.slice(2)); } catch { console.error('Stack record could not be verified; re-run the version checker.');process.exitCode=1; }
}
