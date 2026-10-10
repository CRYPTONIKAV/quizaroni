# Contributing to Quizaroni

Thanks for your interest in contributing! This is a pnpm monorepo with two
workspaces: `apps/web` (React frontend) and `apps/api` (AWS CDK backend).

## Prerequisites

- Node.js 24.11+ (matches `apps/web/.node-version`) or 22.18+. Node 20.19+ still
  works but is end-of-life.
- pnpm >= 10 (`npm i -g pnpm`)
- For backend work: an AWS account + the AWS CLI configured, and the AWS CDK.

## Setup

```bash
pnpm install                      # installs all workspaces
cp apps/web/.env.example apps/web/.env
cp apps/api/.env.example apps/api/.env   # fill in your values
```

## Common commands

Run from the repo root:

```bash
pnpm dev:web      # start the frontend dev server (port 3000)
pnpm build:web    # production build of the frontend
pnpm build:api    # compile the CDK / Lambda TypeScript
pnpm synth:api    # synthesize the CloudFormation template
pnpm deploy:api   # deploy the backend to AWS
pnpm typecheck    # type-check the frontend
pnpm test         # run tests across workspaces
```

## Commit conventions

This repo uses [Conventional Commits](https://www.conventionalcommits.org/),
enforced by commitlint via a husky `commit-msg` hook. Examples:

```
feat(web): add dark mode toggle
fix(api): correct CORS origin handling
chore(deps): bump aws-cdk-lib
```

Releases are automated with release-please based on these commit messages.

## Picking up an issue

Issues labeled
[`good first issue`](https://github.com/yusufaf/quizaroni/labels/good%20first%20issue)
are scoped for new contributors. For a new feature or a large change, open an
issue to discuss it before writing code.

1. Comment on the issue to claim it, and wait to be assigned before starting.
   This avoids two people opening PRs for the same fix. I aim to reply within
   about a week; if you haven't heard back by then, go ahead and start.
2. Skip issues that already have an assignee or an open PR linked to them.
3. If an issue says it is blocked on another PR, wait for that PR to merge.
4. If you can no longer work on an assigned issue, say so in a comment so it
   can be reassigned. If no PR is opened or updated within two weeks of
   assignment, the issue may be reassigned.

## Translations

The web app supports English and Spanish via `react-i18next`.

- New user-facing strings, including `aria-label`s and tooltip titles, go
  through `t()`. New components should always use `useTranslation`. Some
  older files are still hardcoded (tracked in #49); when editing one of those,
  matching its existing strings is fine unless your issue is to translate it.
- Add every new key to both `apps/web/src/i18n/locales/en/` and
  `apps/web/src/i18n/locales/es/`. If you can't write Spanish, copy the English
  text into the `es` file and say so in your PR.
- A new namespace (a new `.json` file) also needs three edits in
  `apps/web/src/i18n/index.ts`: import both the `en` and `es` files, add both
  under `resources`, and add the name to the `ns` array. Otherwise `t()`
  returns raw keys.

## Pull requests

1. Branch off `main`, and keep each PR focused on one issue.
2. Make your change with tests/docs where relevant.
3. Lint and format only the files you changed, since running these across
   the whole repo rewrites unrelated code:
   ```bash
   # apps/web: lint .ts/.tsx, format .ts/.tsx/.json/.css
   pnpm exec vp lint --fix apps/web/src/path/to/File.tsx ...
   pnpm exec vp fmt apps/web/src/path/to/File.tsx ...

   # apps/api (Prettier, paths relative to apps/api)
   pnpm --filter @quizaroni/api exec prettier --write path/to/file.ts ...
   ```
4. Make sure `pnpm typecheck`, `pnpm test` and `pnpm build` (all workspaces)
   pass. If you touched `apps/api` or `packages/`, also run `pnpm synth:api`.
5. Open a PR with a clear description, and include `Fixes #<issue>` so the
   issue closes when the PR merges. For UI changes, add a screenshot or short
   recording. Leave "Allow edits from maintainers" checked.

Do **not** commit secrets. All credentials go in untracked `.env` files.

## Questions and security issues

Ask questions by opening an issue. Report security vulnerabilities privately as
described in [SECURITY.md](SECURITY.md), not in a public issue.
