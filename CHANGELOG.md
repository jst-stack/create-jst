# Changelog

Notable changes to `create-jst` are documented here.

## 0.4.16

- Pin JST `v0.4.14` with guided slice composition and a production dependency audit gate.
- Verify the CLI on its declared Node 22 minimum and on the template's Node 24 runtime.
- Exercise the latest published initializer in scheduled release canaries.

## 0.4.15

- Pin JST `v0.4.13` with portable Windows generators and a container-safe install.
- Keep pnpm trust checks without rejecting deliberately pinned, newly released dependencies.
- Pin JST `v0.4.12` with bounded-context modules, workspace extraction, deterministic npm/pnpm checks, and architecture-policy `0.4.0`.
- Pin the matching showcase architecture contracts.

## 0.4.4

- Pin the production-container-verified `v0.4.3` template release.

## 0.4.3

- Pin the npm 11/12-compatible `v0.4.2` template release.

## 0.4.2

- Execute Windows package-manager shims through the platform shell and emit a lint-clean pnpm workspace policy.

## 0.4.1

- Keep the seven-day pnpm release-age defense while explicitly trusting the ecosystem's own architecture-policy package.
- Make package-manager integration tests portable across POSIX and Windows runners.

## 0.4.0

- Establish the Node 24 runtime, npm/pnpm generated-project canary, cross-platform CI, and provenance-backed npm release workflow.
- Create projects transactionally with signal forwarding, visible child-process output, and package-manager-aware documentation.
- Pin compatible clean and showcase sources and expose explicit `--example showcase` creation.
- Add the versioned, dry-runnable, rollback-safe `jst migrate` command.
