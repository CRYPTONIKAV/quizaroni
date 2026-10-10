# Changelog

## [0.3.0](https://github.com/yusufaf/quizaroni/compare/api-v0.2.0...api-v0.3.0) (2026-10-10)


### Features

* **api:** public study-set sharing endpoints ([65e7691](https://github.com/yusufaf/quizaroni/commit/65e769185b3ba4368ae691b36a9d9ef5ab0451fb))
* **api:** replace Cognito authorizer with Logto JWKS verify ([fef54d3](https://github.com/yusufaf/quizaroni/commit/fef54d30eee6c34e4b9e33b95abdb6f4788133c8))
* public study-set sharing (public page, per-set meta, sitemap) + perf/import ([7f6b588](https://github.com/yusufaf/quizaroni/commit/7f6b5881f547e990670031524d1cc363c71e9cdd))
* **web:** add AI chat panel phase 2 (issue [#15](https://github.com/yusufaf/quizaroni/issues/15)) ([ec9739b](https://github.com/yusufaf/quizaroni/commit/ec9739be5c3edc1e8e9908a7e06074d9ac55e7b6))
* **web:** AI chat panel phase 2 (issue [#15](https://github.com/yusufaf/quizaroni/issues/15)) ([01f81b3](https://github.com/yusufaf/quizaroni/commit/01f81b352e56d5e9fed3630302718402b59291bb))


### Bug Fixes

* address review findings on Phase 3 Logto migration ([ba82292](https://github.com/yusufaf/quizaroni/commit/ba82292fee8db4ffda8135035931cb737b7ec35d))
* **api:** correct misspelled studyset metadata keys on create ([b739974](https://github.com/yusufaf/quizaroni/commit/b739974f0cbb1d5f3e2063f9ae1226cc593e2fd8))
* **api:** correct misspelled studyset metadata keys on create ([a28e457](https://github.com/yusufaf/quizaroni/commit/a28e4577afda621fe961d8ce8ea01077da91436e))
* **api:** land deployed Logto backend fixes ([#37](https://github.com/yusufaf/quizaroni/issues/37)) ([9d9f556](https://github.com/yusufaf/quizaroni/commit/9d9f556052080d8aea468f9fe6295e9372a75aff))
* **api:** load dotenv before stack import so CORS origins survive deploy ([11824d0](https://github.com/yusufaf/quizaroni/commit/11824d028de8558f2906ae39b60600a4a183a91a))
* **api:** stub test script until api tests exist ([4ebbe13](https://github.com/yusufaf/quizaroni/commit/4ebbe13511ccaab64854bac73a69ea7f766796e5))
* **api:** upgrade aws-cdk CLI to match cloud assembly schema ([14f6de2](https://github.com/yusufaf/quizaroni/commit/14f6de2bf98ea5e5a1715acd817b7ca618e55f0e))
* **deps:** bump pnpm to 10.34.4 (resolves 3 high Dependabot alerts) ([2c3d7df](https://github.com/yusufaf/quizaroni/commit/2c3d7df53f64b5d9d4ca83e971f090582bf156f4))
* **deps:** bump pnpm to 10.34.4 to resolve Dependabot high alerts ([6f0da9a](https://github.com/yusufaf/quizaroni/commit/6f0da9a82ad7cdd86bd580f01ca9f5b0610047d9))
* **deps:** resolve Dependabot alerts (esbuild, pnpm, uuid) ([#11](https://github.com/yusufaf/quizaroni/issues/11)) ([f16aa28](https://github.com/yusufaf/quizaroni/commit/f16aa285fc4f4574423a79fca4e749d76e3f1aec))
* **deps:** resolve js-yaml ([#190](https://github.com/yusufaf/quizaroni/issues/190)) and security vulnerabilities ([55b51fd](https://github.com/yusufaf/quizaroni/commit/55b51fdb32518bcbcbf2a11cfc51f0cb4a5a85f7))
* stop update-studyset 500ing on every save of an existing set ([#41](https://github.com/yusufaf/quizaroni/issues/41)) ([3940773](https://github.com/yusufaf/quizaroni/commit/394077393f5f1cebaa4afcfa2584e952ba68b212))

## [0.2.0](https://github.com/yusufaf/quizaroni/compare/api-v0.1.0...api-v0.2.0) (2026-06-07)


### Features

* port gamification to pnpm monorepo structure (issue [#4](https://github.com/yusufaf/quizaroni/issues/4)) ([49b20cb](https://github.com/yusufaf/quizaroni/commit/49b20cb596f3e799eb2b7019688eb22ce25eaa4e))


### Bug Fixes

* **api:** correct models/user import casing; move pnpm overrides to workspace root ([e9ee992](https://github.com/yusufaf/quizaroni/commit/e9ee9925240e774e40daef8bc0e16bfe1452c1fc))
