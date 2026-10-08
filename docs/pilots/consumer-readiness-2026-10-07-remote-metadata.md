```json
{
  "github": {
    "checkedAt": "2026-10-07T01:36:18.886321+00:00",
    "records": [
      {
        "repo": "erp",
        "kind": "policy",
        "cmd": [
          "gh",
          "api",
          "-H",
          "X-GitHub-Api-Version: 2026-03-10",
          "repos/grinvi04/erp/actions/policies?has_parents=true&per_page=100"
        ],
        "exit": 0,
        "path": "/tmp/harness-remote-conditions-20261007/erp-policy.json",
        "sha256": "00daed3d9cccc99e8d2509f634ccb581741c67a9bc74d78b519ba39475f708ed"
      },
      {
        "repo": "erp",
        "kind": "permissions",
        "cmd": [
          "gh",
          "api",
          "-H",
          "X-GitHub-Api-Version: 2026-03-10",
          "repos/grinvi04/erp/actions/permissions/workflow"
        ],
        "exit": 0,
        "path": "/tmp/harness-remote-conditions-20261007/erp-permissions.json",
        "sha256": "f6e178fc1e56cf43900da383f85398b61de9ae61c6b8433116c1856605745924"
      },
      {
        "repo": "siku",
        "kind": "policy",
        "cmd": [
          "gh",
          "api",
          "-H",
          "X-GitHub-Api-Version: 2026-03-10",
          "repos/grinvi04/siku/actions/policies?has_parents=true&per_page=100"
        ],
        "exit": 0,
        "path": "/tmp/harness-remote-conditions-20261007/siku-policy.json",
        "sha256": "00daed3d9cccc99e8d2509f634ccb581741c67a9bc74d78b519ba39475f708ed"
      },
      {
        "repo": "siku",
        "kind": "permissions",
        "cmd": [
          "gh",
          "api",
          "-H",
          "X-GitHub-Api-Version: 2026-03-10",
          "repos/grinvi04/siku/actions/permissions/workflow"
        ],
        "exit": 0,
        "path": "/tmp/harness-remote-conditions-20261007/siku-permissions.json",
        "sha256": "f6e178fc1e56cf43900da383f85398b61de9ae61c6b8433116c1856605745924"
      },
      {
        "repo": "webhook-service",
        "kind": "policy",
        "cmd": [
          "gh",
          "api",
          "-H",
          "X-GitHub-Api-Version: 2026-03-10",
          "repos/grinvi04/webhook-service/actions/policies?has_parents=true&per_page=100"
        ],
        "exit": 0,
        "path": "/tmp/harness-remote-conditions-20261007/webhook-service-policy.json",
        "sha256": "00daed3d9cccc99e8d2509f634ccb581741c67a9bc74d78b519ba39475f708ed"
      },
      {
        "repo": "webhook-service",
        "kind": "permissions",
        "cmd": [
          "gh",
          "api",
          "-H",
          "X-GitHub-Api-Version: 2026-03-10",
          "repos/grinvi04/webhook-service/actions/permissions/workflow"
        ],
        "exit": 0,
        "path": "/tmp/harness-remote-conditions-20261007/webhook-service-permissions.json",
        "sha256": "f6e178fc1e56cf43900da383f85398b61de9ae61c6b8433116c1856605745924"
      },
      {
        "repo": "drivertree",
        "kind": "policy",
        "cmd": [
          "gh",
          "api",
          "-H",
          "X-GitHub-Api-Version: 2026-03-10",
          "repos/grinvi04/drivertree/actions/policies?has_parents=true&per_page=100"
        ],
        "exit": 0,
        "path": "/tmp/harness-remote-conditions-20261007/drivertree-policy.json",
        "sha256": "00daed3d9cccc99e8d2509f634ccb581741c67a9bc74d78b519ba39475f708ed"
      },
      {
        "repo": "drivertree",
        "kind": "permissions",
        "cmd": [
          "gh",
          "api",
          "-H",
          "X-GitHub-Api-Version: 2026-03-10",
          "repos/grinvi04/drivertree/actions/permissions/workflow"
        ],
        "exit": 0,
        "path": "/tmp/harness-remote-conditions-20261007/drivertree-permissions.json",
        "sha256": "f6e178fc1e56cf43900da383f85398b61de9ae61c6b8433116c1856605745924"
      }
    ]
  },
  "railway": {
    "records": [
      {
        "path": "/tmp/harness-remote-conditions-20261007/railway-staging-selected.json",
        "sha256": "c05f4ad34757ba65f5b5a535626c82f2dba1a6df0ef9f36e078b129c3078c30a"
      },
      {
        "path": "/tmp/harness-remote-conditions-20261007/railway-production-selected.json",
        "sha256": "b7d9d085d09e965367602a6b37086cfbe2af65815298af95a8bdeaeb868526bf"
      }
    ],
    "staging": {
      "command": [
        "railway",
        "status",
        "--project",
        "eec41ebc-5bd4-4c65-bcce-f3d6d08081b5",
        "--environment",
        "staging",
        "--json"
      ],
      "exit": 0,
      "environment": "staging",
      "serviceName": "drivertree",
      "source": null,
      "latestDeployment": {
        "createdAt": "2026-06-08T12:58:50.419Z",
        "id": "4be810cc-b140-4042-8683-8bf23d641b48",
        "status": "FAILED"
      },
      "selectedDeploymentMeta": {
        "branch": "develop",
        "commitHash": "2f1bfb8a82b8ffa2c22cc3fdf79808800150e868",
        "commitMessage": "Merge pull request #15 from grinvi04/docs/claude-md-wording-align\n\ndocs(claude): .claude/ 규칙 문구 통일",
        "repo": "grinvi04/drivertree"
      },
      "activeDeploymentCount": 0,
      "scope": "metadata allowlist only; variables/logs not queried"
    },
    "production": {
      "command": [
        "railway",
        "status",
        "--project",
        "eec41ebc-5bd4-4c65-bcce-f3d6d08081b5",
        "--environment",
        "production",
        "--json"
      ],
      "exit": 0,
      "environment": "production",
      "serviceName": "drivertree",
      "source": {
        "image": null,
        "repo": "grinvi04/drivertree"
      },
      "latestDeployment": {
        "createdAt": "2026-06-08T07:05:52.504Z",
        "id": "d3fbaf98-f6f2-4f93-872f-3c84e07f6f1e",
        "status": "FAILED"
      },
      "selectedDeploymentMeta": {
        "branch": "main",
        "commitHash": "1198c4ec189653ae0c56afc79a3dd9d70f702932",
        "commitMessage": "Merge pull request #13 from grinvi04/release/v1.5.5\n\nrelease: v1.5.5",
        "repo": "grinvi04/drivertree"
      },
      "activeDeploymentCount": 0,
      "scope": "metadata allowlist only; variables/logs not queried"
    }
  },
  "vercel": {
    "command": "vercel whoami --non-interactive",
    "exit": 1,
    "result": "specified token is not valid",
    "boundary": "no login, token reading, retry or configuration change"
  },
  "classification": "read-only settings and metadata, not deployment execution"
}
```
