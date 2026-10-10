# Repository guidance

Before implementation or review work, follow the public [JST architecture contract](https://github.com/jst-stack/jst/blob/main/skills/frontend-architecture/SKILL.md) and organization [governance](https://github.com/jst-stack/.github/blob/main/GOVERNANCE.md). Keep project creation and migrations atomic, expose interactive choices as deterministic flags, support only npm and pnpm, and preserve the generated project's architecture policy. Run `npm test` and `npm pack --dry-run` before delivery.
