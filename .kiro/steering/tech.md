---
inclusion: always
---
# Tech conventions
TypeScript (strict, no `any`), pnpm workspaces, Vitest, fast-check, Playwright with axe. Engine in `engine/` (pure, no DOM, no network, errors as Result values), shared React UI in `ui/`, apps in `apps/echo-care/` and `apps/echo-cover/`. English default: on-device speech through an adapter interface; a deterministic rules extractor is the default; any model call goes only through a capped proxy. Anchors are segment-level (3 to 8 s). Property-based tests PB1 to PB11 are written before the code they cover. The engine never imports from `ui/` or `apps/`; code is never copied between apps. Do not add `.kiro` to `.gitignore`. Work one build-guide step at a time (docs/BUILD-GUIDE.md) and commit `S<number>: <title>`.
