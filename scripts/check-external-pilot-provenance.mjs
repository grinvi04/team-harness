#!/usr/bin/env node

import { createHash } from 'node:crypto'
import { lstat, readFile, realpath } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const IMMUTABLE_COMMIT = /^[0-9a-f]{40}$/
const SHA256 = /^[0-9a-f]{64}$/
const GITHUB_REPOSITORY = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/
const CONTROL_CHARACTER = /[\u0000-\u001f\u007f-\u009f]/u
const DEFAULT_REQUEST_TIMEOUT_MS = 30_000

function digest(bytes) {
  return createHash('sha256').update(bytes).digest('hex')
}

function validateArtifactPath(value, index) {
  if (typeof value !== 'string' || !value) {
    throw new Error(`artifacts[${index}].path must be a normalized repository-relative path`)
  }
  if (CONTROL_CHARACTER.test(value)) {
    throw new Error(`artifacts[${index}].path must not contain control characters`)
  }
  const normalized = path.posix.normalize(value)
  if (
    value.includes('\\') ||
    path.posix.isAbsolute(value) ||
    normalized !== value ||
    value === '.' ||
    value.startsWith('../')
  ) {
    throw new Error(`artifacts[${index}].path must be a normalized repository-relative path`)
  }
}

function withAbort(promise, signal) {
  return new Promise((resolve, reject) => {
    const abort = () => reject(new Error('request timed out'))
    if (signal.aborted) {
      abort()
      return
    }
    signal.addEventListener('abort', abort, { once: true })
    Promise.resolve(promise).then(
      value => {
        signal.removeEventListener('abort', abort)
        resolve(value)
      },
      error => {
        signal.removeEventListener('abort', abort)
        reject(error)
      }
    )
  })
}

function validateManifest(manifest) {
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    throw new Error('manifest must be a JSON object')
  }
  if (manifest.schemaVersion !== 1) {
    throw new Error('manifest.schemaVersion must be 1')
  }
  if (!GITHUB_REPOSITORY.test(manifest.repository ?? '')) {
    throw new Error('manifest.repository must be a GitHub owner/repository name')
  }
  if (!Array.isArray(manifest.artifacts) || manifest.artifacts.length === 0) {
    throw new Error('manifest.artifacts must be a non-empty array')
  }

  const paths = new Set()
  for (const [index, artifact] of manifest.artifacts.entries()) {
    if (!artifact || typeof artifact !== 'object' || Array.isArray(artifact)) {
      throw new Error(`artifacts[${index}] must be an object`)
    }
    validateArtifactPath(artifact.path, index)
    if (paths.has(artifact.path)) {
      throw new Error(`duplicate artifact path: ${artifact.path}`)
    }
    paths.add(artifact.path)
    if (!IMMUTABLE_COMMIT.test(artifact.commit ?? '')) {
      throw new Error(`artifacts[${index}].commit must be an immutable 40-character commit SHA`)
    }
    if (!SHA256.test(artifact.sha256 ?? '')) {
      throw new Error(`artifacts[${index}].sha256 must be a lowercase SHA-256 digest`)
    }
  }
}

async function readLocalArtifact(repositoryRoot, artifact) {
  let root
  let target
  try {
    root = await realpath(repositoryRoot)
    target = await realpath(path.resolve(root, artifact.path))
  } catch (error) {
    throw new Error(`cannot read local artifact ${artifact.path}: ${error.message}`)
  }

  if (target !== root && !target.startsWith(`${root}${path.sep}`)) {
    throw new Error(`local artifact escapes repository root: ${artifact.path}`)
  }

  try {
    const metadata = await lstat(target)
    if (!metadata.isFile()) {
      throw new Error('not a regular file')
    }
    return await readFile(target)
  } catch (error) {
    throw new Error(`cannot read local artifact ${artifact.path}: ${error.message}`)
  }
}

function githubContentsUrl(repository, artifact) {
  const encodedRepository = repository.split('/').map(encodeURIComponent).join('/')
  const encodedPath = artifact.path.split('/').map(encodeURIComponent).join('/')
  return `https://api.github.com/repos/${encodedRepository}/contents/${encodedPath}?ref=${artifact.commit}`
}

async function readRemoteArtifact(repository, artifact, fetchImpl, token, requestTimeoutMs) {
  const url = githubContentsUrl(repository, artifact)
  const headers = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'team-harness-external-pilot-provenance',
    'X-GitHub-Api-Version': '2022-11-28'
  }
  if (token) headers.Authorization = `Bearer ${token}`
  const signal = AbortSignal.timeout(requestTimeoutMs)

  let response
  try {
    response = await withAbort(fetchImpl(url, { headers, signal }), signal)
  } catch {
    throw new Error(`GitHub API request failed for ${artifact.path}`)
  }
  if (!response?.ok) {
    throw new Error(`GitHub API returned ${response?.status ?? 'an invalid response'} for ${artifact.path}`)
  }

  let payload
  try {
    payload = await withAbort(response.json(), signal)
  } catch (error) {
    throw new Error(`GitHub API returned invalid JSON for ${artifact.path}: ${error.message}`)
  }
  if (
    !payload ||
    payload.type !== 'file' ||
    payload.path !== artifact.path ||
    payload.encoding !== 'base64' ||
    typeof payload.content !== 'string'
  ) {
    throw new Error(`GitHub API returned an invalid file payload for ${artifact.path}`)
  }

  const encoded = payload.content.replace(/\s/g, '')
  if (encoded.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(encoded)) {
    throw new Error(`GitHub API returned invalid base64 for ${artifact.path}`)
  }
  const bytes = Buffer.from(encoded, 'base64')
  if (!Number.isSafeInteger(payload.size) || payload.size !== bytes.length) {
    throw new Error(`GitHub API returned an invalid size for ${artifact.path}`)
  }
  return bytes
}

async function inspectExternalPilotProvenanceManifest({
  manifestPath,
  repositoryRoot = process.cwd()
}) {
  let manifest
  try {
    manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
  } catch (error) {
    throw new Error(`cannot read provenance manifest: ${error.message}`)
  }
  validateManifest(manifest)

  for (const artifact of manifest.artifacts) {
    const localBytes = await readLocalArtifact(repositoryRoot, artifact)
    if (digest(localBytes) !== artifact.sha256) {
      throw new Error(`local digest mismatch for ${artifact.path}`)
    }
  }

  return {
    manifest,
    summary: {
      repository: manifest.repository,
      artifacts: manifest.artifacts.length,
      verified: manifest.artifacts.length
    }
  }
}

export async function checkExternalPilotProvenanceManifest(options) {
  const { summary } = await inspectExternalPilotProvenanceManifest(options)
  return summary
}

export async function verifyExternalPilotProvenance({
  manifestPath,
  repositoryRoot = process.cwd(),
  fetchImpl = globalThis.fetch,
  token,
  requestTimeoutMs = DEFAULT_REQUEST_TIMEOUT_MS
}) {
  if (typeof fetchImpl !== 'function') {
    throw new Error('GitHub API fetch implementation is unavailable')
  }
  if (!Number.isSafeInteger(requestTimeoutMs) || requestTimeoutMs <= 0) {
    throw new Error('requestTimeoutMs must be a positive integer')
  }

  const { manifest, summary } = await inspectExternalPilotProvenanceManifest({
    manifestPath,
    repositoryRoot
  })

  for (const artifact of manifest.artifacts) {
    const remoteBytes = await readRemoteArtifact(
      manifest.repository,
      artifact,
      fetchImpl,
      token,
      requestTimeoutMs
    )
    if (digest(remoteBytes) !== artifact.sha256) {
      throw new Error(`remote digest mismatch for ${artifact.path} at ${artifact.commit}`)
    }
  }

  return summary
}

function usage() {
  return 'Usage: node scripts/check-external-pilot-provenance.mjs --manifest <path> [--repo-root <path>] [--offline]'
}

function parseArgs(argv) {
  let manifestPath
  let repositoryRoot = process.cwd()
  let offline = false
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument === '--manifest' && argv[index + 1]) {
      manifestPath = argv[index + 1]
      index += 1
    } else if (argument === '--repo-root' && argv[index + 1]) {
      repositoryRoot = argv[index + 1]
      index += 1
    } else if (argument === '--offline') {
      offline = true
    } else if (argument === '--help') {
      return { help: true }
    } else {
      throw new Error(`unknown or incomplete argument: ${argument}`)
    }
  }
  if (!manifestPath) throw new Error('--manifest is required')
  return { manifestPath, repositoryRoot, offline }
}

async function main() {
  try {
    const options = parseArgs(process.argv.slice(2))
    if (options.help) {
      console.log(usage())
      return
    }
    const result = options.offline
      ? await checkExternalPilotProvenanceManifest(options)
      : await verifyExternalPilotProvenance({
          ...options,
          token: process.env.GITHUB_TOKEN || process.env.GH_TOKEN
        })
    const mode = options.offline ? 'local' : 'local and GitHub'
    console.log(`PASS: verified ${result.verified} external pilot artifacts from ${result.repository} (${mode})`)
  } catch (error) {
    console.error(`FAIL: ${error.message}`)
    process.exitCode = 1
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  await main()
}
