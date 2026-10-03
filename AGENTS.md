# Repository guidance

Before implementation or review work, follow the canonical [JST Stack engineering roadmap](https://github.com/jst-stack/jst/blob/main/docs/ECOSYSTEM_ROADMAP.md). Keep project creation and migrations atomic, expose interactive choices as deterministic flags, support only npm and pnpm, and preserve the generated project's architecture policy. Run `npm test` and `npm pack --dry-run` before delivery.
