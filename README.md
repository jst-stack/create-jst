# create-jst

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

## Migrations

Run migrations from a clean Git working tree:

```bash
npx --package=create-jst jst migrate --from 0.3.0 --to 0.4.0 --dry-run
npx --package=create-jst jst migrate --from 0.3.0 --to 0.4.0
```

Migrations reject unsupported paths and customized source shapes before writing. Applied files are restored if the project quality gate fails.
