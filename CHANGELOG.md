# Changelog

Notable changes to `create-jst` are documented here.

## Unreleased

## 0.4.1

- Keep the seven-day pnpm release-age defense while explicitly trusting the ecosystem's own architecture-policy package.
- Make package-manager integration tests portable across POSIX and Windows runners.

## 0.4.0

- Establish the Node 24 runtime, npm/pnpm generated-project canary, cross-platform CI, and provenance-backed npm release workflow.
- Create projects transactionally with signal forwarding, visible child-process output, and package-manager-aware documentation.
- Pin compatible clean and showcase sources and expose explicit `--example showcase` creation.
- Add the versioned, dry-runnable, rollback-safe `jst migrate` command.
