# Initializer benchmarks

`npm run benchmark` measures deterministic no-install project creation and blocks regressions over the stored baseline by 20% plus a 100 ms runner noise floor. The generated-project CI matrix separately measures the real npm and pnpm installation path because registry/network variance makes it unsuitable for a strict local threshold.
