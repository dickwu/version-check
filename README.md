# Version Check

Check dependency versions for npm, Cargo, Go modules, and Composer, and update them with one click via CodeLens or quick fixes.

## Supported Files

- `package.json` (npm)
- `Cargo.toml` (Rust/Cargo)
- `go.mod` (Go modules)
- `composer.json` (PHP/Composer)

## Features

- Shows latest version inline via CodeLens
- One-click update to latest or choose from available versions
- Batch update all outdated dependencies in a section
- Local caching to reduce registry requests
- Ignores prerelease versions by default

## Commands

| Command | Description |
|---------|-------------|
| `Version Check: Update Dependency` | Update a single dependency |
| `Version Check: Update All in Section` | Update all outdated dependencies in a section |
| `Version Check: Refresh` | Clear cache and re-fetch all versions |
| `Version Check: Clear Cache` | Clear cached version data without re-fetching |

## Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `versionCheck.cacheTtlSeconds` | `300` | Cache TTL for registry responses in seconds |
| `versionCheck.providers.npm` | `true` | Enable npm (package.json) version checks |
| `versionCheck.providers.cargo` | `true` | Enable Cargo (Cargo.toml) version checks |
| `versionCheck.providers.go` | `true` | Enable Go (go.mod) version checks |
| `versionCheck.providers.composer` | `true` | Enable Composer (composer.json) version checks |
| `versionCheck.ignorePrereleasePatterns` | `["alpha", "beta", ...]` | Prerelease patterns to ignore when checking latest version |

## Caching

Version lookups are cached locally to reduce API calls to package registries. The cache:

- Respects the `cacheTtlSeconds` setting (default 5 minutes)
- Caches both successful lookups and "not found" results
- Can be cleared manually via `Version Check: Clear Cache` command
- Is automatically cleared when using `Version Check: Refresh`
