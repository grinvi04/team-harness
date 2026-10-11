#!/usr/bin/env node

// Compatibility entry point; the experiment owns the implementation.
import { realpathSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { main } from '../experiments/split-packaging/profile-doctor.mjs'
export * from '../experiments/split-packaging/profile-doctor.mjs'

function canonicalPath(file) {
  try {
    return realpathSync(file)
  } catch {
    return null
  }
}

if (process.argv[1] && canonicalPath(process.argv[1]) === canonicalPath(fileURLToPath(import.meta.url))) main()
