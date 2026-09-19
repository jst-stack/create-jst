# create-jst

Create a web application from the [JST](https://github.com/jst-stack/jst) template.

```bash
npm create jst@latest my-app
```

The wizard derives application metadata from the project directory, so it only asks about choices that change the generated project: starter demo, package manager, dependency installation, and Git initialization.

```bash
npm create jst@latest my-app -- --yes
npm create jst@latest my-app -- --package-manager pnpm --demo keep
npm create jst@latest my-app -- --dry-run
```

Use `--help` to view non-interactive options. The initializer never overwrites a non-empty directory.
