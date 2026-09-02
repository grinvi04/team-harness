#!/usr/bin/env bash
set -u

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CHECKER="$ROOT/scripts/check-external-pilot-provenance.mjs"
MANIFEST="$ROOT/docs/pilots/external-pilot-provenance.json"
RELEASE_CHECK_SKILL="$ROOT/plugins/harness-guard/skills/release-check/SKILL.md"
PASS=0
FAIL=0

pass() { echo "PASS: $1"; PASS=$((PASS + 1)); }
fail() { echo "FAIL: $1"; FAIL=$((FAIL + 1)); }

if [ ! -f "$CHECKER" ]; then
  fail 'external pilot provenance verifier가 존재'
else
  if node --input-type=module - "$CHECKER" <<'NODE'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const checkerPath = process.argv[2]
const {
  checkExternalPilotProvenanceManifest,
  verifyExternalPilotProvenance
} = await import(pathToFileURL(checkerPath))
assert.equal(typeof checkExternalPilotProvenanceManifest, 'function')
assert.equal(typeof verifyExternalPilotProvenance, 'function')

const root = await mkdtemp(path.join(tmpdir(), 'external-pilot-provenance.'))
const artifactPath = 'docs/pilots/evidence.json'
const artifact = Buffer.from('trusted evidence\n')
const digest = '993fb75a22357394395e50e3960af8aa0e2f1c784a647b002bbc57d5d5b9a98e'
const commit = '1234567890abcdef1234567890abcdef12345678'
const manifestPath = path.join(root, 'manifest.json')

function manifest(overrides = {}) {
  return {
    schemaVersion: 1,
    repository: 'grinvi04/team-harness',
    artifacts: [{ path: artifactPath, commit, sha256: digest }],
    ...overrides
  }
}

function githubFile(content = artifact) {
  return {
    name: 'evidence.json',
    path: artifactPath,
    sha: '0123456789abcdef0123456789abcdef01234567',
    size: content.length,
    url: 'https://api.github.com/repos/grinvi04/team-harness/contents/docs/pilots/evidence.json',
    html_url: 'https://github.com/grinvi04/team-harness/blob/example/docs/pilots/evidence.json',
    git_url: 'https://api.github.com/repos/grinvi04/team-harness/git/blobs/example',
    download_url: 'https://raw.githubusercontent.com/grinvi04/team-harness/example/docs/pilots/evidence.json',
    type: 'file',
    content: content.toString('base64'),
    encoding: 'base64',
    _links: { self: 'self', git: 'git', html: 'html' }
  }
}

function response(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() { return body }
  }
}

async function writeManifest(value) {
  await writeFile(manifestPath, `${JSON.stringify(value)}\n`)
}

async function expectFailure(label, action, pattern) {
  await assert.rejects(action, pattern, label)
}

try {
  await mkdir(path.join(root, 'docs/pilots'), { recursive: true })
  await writeFile(path.join(root, artifactPath), artifact)
  await writeManifest(manifest())

  assert.deepEqual(
    await checkExternalPilotProvenanceManifest({ manifestPath, repositoryRoot: root }),
    {
      repository: 'grinvi04/team-harness',
      artifacts: 1,
      verified: 1
    }
  )

  const seenUrls = []
  const result = await verifyExternalPilotProvenance({
    manifestPath,
    repositoryRoot: root,
    fetchImpl: async url => {
      seenUrls.push(url)
      return response(200, githubFile())
    }
  })
  assert.deepEqual(result, {
    repository: 'grinvi04/team-harness',
    artifacts: 1,
    verified: 1
  })
  assert.deepEqual(seenUrls, [
    `https://api.github.com/repos/grinvi04/team-harness/contents/docs/pilots/evidence.json?ref=${commit}`
  ])

  await writeManifest(manifest({
    artifacts: [{ path: artifactPath, commit: 'develop', sha256: digest }]
  }))
  await expectFailure(
    'mutable ref must fail before GitHub access',
    () => verifyExternalPilotProvenance({
      manifestPath,
      repositoryRoot: root,
      fetchImpl: async () => { throw new Error('fetch must not run') }
    }),
    /immutable 40-character commit SHA/
  )

  await writeManifest(manifest())
  await writeFile(path.join(root, artifactPath), 'mutated local evidence\n')
  await expectFailure(
    'mutated local artifact must fail',
    () => verifyExternalPilotProvenance({
      manifestPath,
      repositoryRoot: root,
      fetchImpl: async () => response(200, githubFile())
    }),
    /local digest mismatch/
  )

  await writeFile(path.join(root, artifactPath), artifact)
  await writeManifest(manifest({
    artifacts: [{ path: 'docs/pilots/evidence.json\nFAKE-PASS', commit, sha256: digest }]
  }))
  await expectFailure(
    'control characters in paths must fail before logging or access',
    () => verifyExternalPilotProvenance({
      manifestPath,
      repositoryRoot: root,
      fetchImpl: async () => { throw new Error('fetch must not run') }
    }),
    /control characters/
  )

  await writeManifest(manifest())
  await expectFailure(
    'mutated remote artifact must fail',
    () => verifyExternalPilotProvenance({
      manifestPath,
      repositoryRoot: root,
      fetchImpl: async () => response(200, githubFile(Buffer.from('mutated remote evidence\n')))
    }),
    /remote digest mismatch/
  )

  await rm(path.join(root, artifactPath))
  await expectFailure(
    'missing original must fail',
    () => verifyExternalPilotProvenance({
      manifestPath,
      repositoryRoot: root,
      fetchImpl: async () => response(200, githubFile())
    }),
    /cannot read local artifact/
  )

  await writeFile(path.join(root, artifactPath), artifact)
  await expectFailure(
    'GitHub permission or rate failure must fail closed',
    () => verifyExternalPilotProvenance({
      manifestPath,
      repositoryRoot: root,
      fetchImpl: async () => response(403, { message: 'rate limited' })
    }),
    /GitHub API returned 403/
  )

  await expectFailure(
    'network failure must fail closed',
    () => verifyExternalPilotProvenance({
      manifestPath,
      repositoryRoot: root,
      fetchImpl: async () => { throw new Error('network unavailable') }
    }),
    /GitHub API request failed/
  )

  let tokenError
  try {
    await verifyExternalPilotProvenance({
      manifestPath,
      repositoryRoot: root,
      fetchImpl: globalThis.fetch,
      token: 'REVIEW_TOKEN_SENTINEL\nSECOND'
    })
  } catch (error) {
    tokenError = error
  }
  assert.ok(tokenError, 'malformed token must fail')
  assert.doesNotMatch(tokenError.message, /REVIEW_TOKEN_SENTINEL|Bearer/)

  const timeoutFailure = Promise.race([
    verifyExternalPilotProvenance({
      manifestPath,
      repositoryRoot: root,
      requestTimeoutMs: 10,
      fetchImpl: async (_url, options) => new Promise((_resolve, reject) => {
        options.signal?.addEventListener(
          'abort',
          () => reject(new Error('request aborted')),
          { once: true }
        )
      })
    }),
    new Promise((_resolve, reject) => {
      setTimeout(() => reject(new Error('verifier remained pending')), 100)
    })
  ])
  await expectFailure(
    'network request timeout must fail closed',
    () => timeoutFailure,
    /GitHub API request failed/
  )

  await writeManifest(manifest({
    artifacts: [{ path: '../outside.json', commit, sha256: digest }]
  }))
  await expectFailure(
    'path traversal must fail before local read or GitHub access',
    () => verifyExternalPilotProvenance({
      manifestPath,
      repositoryRoot: root,
      fetchImpl: async () => { throw new Error('fetch must not run') }
    }),
    /repository-relative path/
  )
} finally {
  await rm(root, { recursive: true, force: true })
}
NODE
  then
    pass 'immutable ref·local/remote digest·missing original·API failure 계약'
  else
    fail 'immutable ref·local/remote digest·missing original·API failure 계약'
  fi
fi

if node "$CHECKER" --manifest "$MANIFEST" --repo-root "$ROOT" --offline >/dev/null 2>&1; then
  pass 'checked-in manifest schema와 로컬 원본 digest 계약'
else
  fail 'checked-in manifest schema와 로컬 원본 digest 계약'
fi

if grep -Fxq \
  'node scripts/check-external-pilot-provenance.mjs --manifest docs/pilots/external-pilot-provenance.json' \
  "$RELEASE_CHECK_SKILL" \
  && grep -Eq 'provenance.*실패.*(NO-GO|중단)|실패.*provenance.*(NO-GO|중단)' \
    "$RELEASE_CHECK_SKILL"; then
  pass '공식 release-check가 live provenance 실패를 차단'
else
  fail '공식 release-check가 live provenance 실패를 차단'
fi

echo
echo "결과: PASS=$PASS FAIL=$FAIL"
[ "$FAIL" -eq 0 ]
