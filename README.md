# octoscript

GitHub Actions shell powered by Deno + Octokit.

## Setup

```yaml
- uses: sw2m/octoscript/action@main
```

## Usage

```yaml
defaults:
  run:
    shell: octoscript {0}

steps:
  - run: |
      const { owner, repo } = context.repo;
      const { data } = await github.rest.repos.get({ owner, repo });
      console.log(data.full_name);
```

## Injected globals

| Global | Source |
|---|---|
| `github` / `octokit` | Octokit client (authenticated via `$GITHUB_TOKEN`) |
| `context` | `@actions/github` context |
| `core` | `@actions/core` |
| `exec` | `@actions/exec` |
| `glob` | `@actions/glob` |
| `io` | `@actions/io` |
| `require` | Node `createRequire` |
| `Mustache` | `npm:mustache@^4` |
| `template(path, data)` | Load `.mustache` file + render |
| `git` | `npm:simple-git@^3` instance |
| `inputs` | Action inputs via `INPUT_*` env vars |
| `shared` | Cross-step directory kv (`$GITHUB_SHARED_DIR`) |
| `output` | Step outputs via `$GITHUB_OUTPUT` (heredoc multiline) |

## Requirements

- `GITHUB_TOKEN` must be in the step's env (set at job level: `env: GITHUB_TOKEN: ${{ github.token }}`)
- Deno (installed by the setup action)
