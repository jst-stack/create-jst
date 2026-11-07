# create-jst

[![npm](https://img.shields.io/npm/v/create-jst?style=flat-square)](https://www.npmjs.com/package/create-jst)
[![CI](https://img.shields.io/github/actions/workflow/status/jst-stack/create-jst/ci.yml?branch=main&style=flat-square&label=CI)](https://github.com/jst-stack/create-jst/actions/workflows/ci.yml)
[![OpenSSF Scorecard](https://api.scorecard.dev/projects/github.com/jst-stack/create-jst/badge)](https://scorecard.dev/viewer/?uri=github.com/jst-stack/create-jst)

Create a web application from the [JST](https://github.com/jst-stack/jst) template.

```bash
npm create jst@latest my-app
```

The wizard derives application metadata from the project directory, so it only asks about choices that change generated output: package manager, CSS or SCSS Modules, dependency installation, and Git initialization. Creation happens in a temporary sibling directory; failures and signals clean it up before the final atomic rename.

```bash
npm create jst@latest my-app -- --yes
npm create jst@latest my-app -- --package-manager pnpm
npm create jst@latest my-app -- --dry-run
npm create jst@latest my-app -- --example showcase
```

Use `--help` to view deterministic flags for automation. The initializer never overwrites a non-empty directory and released versions resolve immutable template/showcase revisions.

From a generated JST project, install the global MCP server and register it with Pi:

```bash
npx --yes create-jst@latest mcp setup --dry-run
npx --yes create-jst@latest mcp setup
```

The setup command only installs after validating the current directory as a JST project. MCP reads the project's declared dependencies on each task start, so it can guide agents to preserve the selected stack rather than restoring demo libraries.

## Node.js

create-jst runs on Node.js `>=22.14.0`; CI verifies 22.14.0 and 24.15.0 on Linux, macOS, and Windows.

Generated projects require Node.js `>=24.15.0 <25`, the range the JST template supports. When dependencies would be installed, create-jst verifies that range before it changes anything and stops with an actionable message instead of producing a project the running Node.js cannot build:

```
✕ The generated JST project requires Node.js >=24.15.0 <25; this process runs Node.js 22.14.0. Install a Node.js version in that range and run create-jst again.
```

`--no-install` keeps scaffolding available on any Node.js the generator runs on; the generated project still requires `>=24.15.0 <25`. `--template <owner/repo[#ref]>` skips the pinned-source check, and the cloned template's own `engines.node` is validated before configuration.

## Migrations

Run migrations from a clean Git working tree:

```bash
npx --package=create-jst jst migrate --from 0.3.0 --to 0.4.0 --dry-run
npx --package=create-jst jst migrate --from 0.3.0 --to 0.4.0
```

Migrations reject unsupported paths and customized source shapes before writing. Applied files are restored if the project quality gate fails.

## Contributing and support

Use [JST Discussions](https://github.com/jst-stack/jst/discussions) for usage questions. Report reproducible CLI defects through this repository's issue form. Contributions follow the organization [contribution guide](https://github.com/jst-stack/.github/blob/main/CONTRIBUTING.md) and [governance](https://github.com/jst-stack/.github/blob/main/GOVERNANCE.md).
