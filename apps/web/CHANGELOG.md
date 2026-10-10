# Changelog

## [0.4.0](https://github.com/yusufaf/quizaroni/compare/web-v0.3.0...web-v0.4.0) (2026-10-10)


### Features

* **a11y:** flashcards study shortcuts ([adc8251](https://github.com/yusufaf/quizaroni/commit/adc8251bab3f1d131143b458697c884b302fbc95))
* **a11y:** global key listener and dispatch ([6233d3c](https://github.com/yusufaf/quizaroni/commit/6233d3c5b287be1ec11500af0f393c261c2ffcf9))
* **a11y:** keyboard shortcuts and help modal ([#5](https://github.com/yusufaf/quizaroni/issues/5)) ([2db6f87](https://github.com/yusufaf/quizaroni/commit/2db6f87cadb953ba9287805ddb50a2574138ad63))
* **a11y:** matching study shortcuts ([9cd5d59](https://github.com/yusufaf/quizaroni/commit/9cd5d59999879c303d1a7944d29470da99bac4a2))
* **a11y:** mount shortcut layer in app ([74f824e](https://github.com/yusufaf/quizaroni/commit/74f824e84220df9eecf82b66ab22f727ec54cd71))
* **a11y:** multiple choice study shortcuts ([7eb75a0](https://github.com/yusufaf/quizaroni/commit/7eb75a0e8f6d22f92bdc88a959fff3f1c4918df5))
* **a11y:** nav shortcuts and search tag ([2c1a256](https://github.com/yusufaf/quizaroni/commit/2c1a256ef8a959f71d565fb3204402562481a6b9))
* **a11y:** shortcut help modal and strings ([8d88353](https://github.com/yusufaf/quizaroni/commit/8d8835331fd0452d4eb9df7cdd44fd143e4eaca4))
* **a11y:** shortcut registry provider ([463846b](https://github.com/yusufaf/quizaroni/commit/463846bc39f46059ea411e6b3d3241b0e07ffcaf))
* **a11y:** shortcut types and input guards ([d08218f](https://github.com/yusufaf/quizaroni/commit/d08218f93941266329eaa88ca87fdd1996046875))
* **a11y:** type-write study shortcuts ([e2099e4](https://github.com/yusufaf/quizaroni/commit/e2099e46e8add2ea83b9a8417ff92ac271bc0719))
* **a11y:** useShortcuts registration hook ([b67bf10](https://github.com/yusufaf/quizaroni/commit/b67bf101aead85ebea348d0f494dd45c62be8045))
* add self-hosted Umami analytics ([#56](https://github.com/yusufaf/quizaroni/issues/56)) ([d55467d](https://github.com/yusufaf/quizaroni/commit/d55467d9b5c20a8560738b7d075b6319b3da77e3))
* public study-set sharing (public page, per-set meta, sitemap) + perf/import ([7f6b588](https://github.com/yusufaf/quizaroni/commit/7f6b5881f547e990670031524d1cc363c71e9cdd))
* **study:** add back-to-set button on caught-up screen ([1b5f811](https://github.com/yusufaf/quizaroni/commit/1b5f811595a40327e45f5575f8f625690d463965))
* **web:** add AI chat panel phase 2 (issue [#15](https://github.com/yusufaf/quizaroni/issues/15)) ([ec9739b](https://github.com/yusufaf/quizaroni/commit/ec9739be5c3edc1e8e9908a7e06074d9ac55e7b6))
* **web:** AI chat panel phase 2 (issue [#15](https://github.com/yusufaf/quizaroni/issues/15)) ([01f81b3](https://github.com/yusufaf/quizaroni/commit/01f81b352e56d5e9fed3630302718402b59291bb))
* **web:** env-var the API Gateway URL for prod deploy ([#38](https://github.com/yusufaf/quizaroni/issues/38)) ([a52d2c9](https://github.com/yusufaf/quizaroni/commit/a52d2c9ec8688ccac718f7b0580bd8d7498602e4))
* **web:** import Anki .apkg decks and Markdown notes ([#35](https://github.com/yusufaf/quizaroni/issues/35)) ([1ec3ba6](https://github.com/yusufaf/quizaroni/commit/1ec3ba65a4426c31dcbdfb4c5c8fde45e685d6bb))
* **web:** installable PWA via vite-plugin-pwa ([#54](https://github.com/yusufaf/quizaroni/issues/54)) ([da4dafd](https://github.com/yusufaf/quizaroni/commit/da4dafd5965bbbee9deb3746ed4b7e4b9b973b5e))
* **web:** mobile bottom navigation bar with safe-area insets ([#33](https://github.com/yusufaf/quizaroni/issues/33)) ([8e0f106](https://github.com/yusufaf/quizaroni/commit/8e0f10654d8df324ad02fb677610360a223d195e))
* **web:** preview table before committing an import ([#44](https://github.com/yusufaf/quizaroni/issues/44)) ([88e8f81](https://github.com/yusufaf/quizaroni/commit/88e8f81ab02b560d4ad825762e11370e60a9a3a5))
* **web:** public share page, per-set meta, perf splitting, Quizlet/Anki import ([89690cb](https://github.com/yusufaf/quizaroni/commit/89690cb254116e5289e50b477899ceddb93284c1))
* **web:** replace Amplify/Cognito auth with Logto ([762b8cb](https://github.com/yusufaf/quizaroni/commit/762b8cb237b145ed72069b9a65a8c2accccff86a))
* **web:** swipe gestures for flashcards study mode ([#34](https://github.com/yusufaf/quizaroni/issues/34)) ([1f1f763](https://github.com/yusufaf/quizaroni/commit/1f1f763cf6ec39d152d69d748f57169f698ecafb))
* **web:** tactile haptic feedback for study interactions ([#52](https://github.com/yusufaf/quizaroni/issues/52)) ([5431f44](https://github.com/yusufaf/quizaroni/commit/5431f44a49dae7b329f182c73b654fbffd227051))


### Bug Fixes

* address review findings on Phase 3 Logto migration ([ba82292](https://github.com/yusufaf/quizaroni/commit/ba82292fee8db4ffda8135035931cb737b7ec35d))
* **deps:** bump pnpm to 10.34.4 (resolves 3 high Dependabot alerts) ([2c3d7df](https://github.com/yusufaf/quizaroni/commit/2c3d7df53f64b5d9d4ca83e971f090582bf156f4))
* **deps:** bump pnpm to 10.34.4 to resolve Dependabot high alerts ([6f0da9a](https://github.com/yusufaf/quizaroni/commit/6f0da9a82ad7cdd86bd580f01ca9f5b0610047d9))
* **deps:** patch dompurify, js-yaml, vite-plus alerts ([5aa323a](https://github.com/yusufaf/quizaroni/commit/5aa323a70fc61ffb490c9c0044953a65ab328088))
* **deps:** resolve 7 Dependabot alerts ([5083d22](https://github.com/yusufaf/quizaroni/commit/5083d228c14ee8507dc0f24d5634cd59ea3930e9))
* **deps:** resolve js-yaml ([#190](https://github.com/yusufaf/quizaroni/issues/190)) and security vulnerabilities ([55b51fd](https://github.com/yusufaf/quizaroni/commit/55b51fdb32518bcbcbf2a11cfc51f0cb4a5a85f7))
* **i18n:** use _one/_other plural keys for categoriesAssigned ([2dedf58](https://github.com/yusufaf/quizaroni/commit/2dedf583f034ff9eac6330b4bc56c559c826a017))
* **security:** resolve dependabot advisories for react-router and postcss ([d444ef8](https://github.com/yusufaf/quizaroni/commit/d444ef88de69a47a1498978ca9df6ffbcd8477da))
* stop update-studyset 500ing on every save of an existing set ([#41](https://github.com/yusufaf/quizaroni/issues/41)) ([3940773](https://github.com/yusufaf/quizaroni/commit/394077393f5f1cebaa4afcfa2584e952ba68b212))
* **web:** check response.ok before parsing API responses ([#43](https://github.com/yusufaf/quizaroni/issues/43)) ([f336003](https://github.com/yusufaf/quizaroni/commit/f33600367460d3be2272a5d26ff76585d063ef28))
* **web:** clear all 67 type errors and gate CI on typecheck ([36b2c0b](https://github.com/yusufaf/quizaroni/commit/36b2c0b0f04b4e5e0c558d8fd340e32aa455c65d))
* **web:** clear all 67 type errors and gate CI on typecheck ([29c7099](https://github.com/yusufaf/quizaroni/commit/29c709951bc514f3623dfcc2a9c478d8a947ac33))
* **web:** don't fetch get-studyset with an empty id on /create ([#40](https://github.com/yusufaf/quizaroni/issues/40)) ([cbbe795](https://github.com/yusufaf/quizaroni/commit/cbbe795f442c952fd8b9c70896372c4a73309c27))
* **web:** no-cards removal, pnpm scripts, download refactor + a11y docs ([49bc8fd](https://github.com/yusufaf/quizaroni/commit/49bc8fdaca49cd47dabf55a212d3e59fb8398977))
* **web:** remove no-cards warning icon ([b301e5e](https://github.com/yusufaf/quizaroni/commit/b301e5e62e2e999acf0c2c8cc4c339d131145ec3))
* **web:** responsive layouts for view/home/edit and flashcards crash ([76b60be](https://github.com/yusufaf/quizaroni/commit/76b60bedee4d1ab930512e9c83f21e11ac19523e))
* **web:** stop Create/Edit white-screen from unauthenticated first fetch ([#39](https://github.com/yusufaf/quizaroni/issues/39)) ([560e097](https://github.com/yusufaf/quizaroni/commit/560e097b8e17013455bafb2bfa4efe7b5f815532))
* **web:** UI responsiveness across studyset pages + flashcards crash ([46c6145](https://github.com/yusufaf/quizaroni/commit/46c6145a2616d9aa25ed97a6e1bf954e75752ea2))
* **web:** wrap action buttons to prevent overflow past divider ([84ccd95](https://github.com/yusufaf/quizaroni/commit/84ccd95dcc9eb7a2e644f05522a75e0963d28262))

## [0.3.0](https://github.com/yusufaf/quizaroni/compare/web-v0.2.0...web-v0.3.0) (2026-06-07)


### Features

* Add drag-and-drop uploads and improve UX across study set workflows ([d3e97c6](https://github.com/yusufaf/quizaroni/commit/d3e97c664ac687762a74db879c0d643af29761b4))
* Add image gallery with lightbox, time format settings, and theme polish ([9bb39cd](https://github.com/yusufaf/quizaroni/commit/9bb39cd3c500236903228bc0cac601d31f08acdb))
* Add internationalization (i18n) with English and Spanish support ([fca2775](https://github.com/yusufaf/quizaroni/commit/fca27756424f099001c37c8a5c6cea035e40ca65))
* Add local-first data layer with Dexie.js and PWA support ([a9ffaa3](https://github.com/yusufaf/quizaroni/commit/a9ffaa375d5a09b1f291bb4899acbcc725f54b89))
* Add notes download, card index toggle, and improve label management UX ([65d6814](https://github.com/yusufaf/quizaroni/commit/65d6814dfe2e7578e6a948d06ffe948f2e33cec2))
* Add notes search, study set table search, and advanced card management ([801307b](https://github.com/yusufaf/quizaroni/commit/801307bf92ec338fee6a952cc4f3918d10c7159e))
* add upload icon to Choose JSON File button ([79b9a73](https://github.com/yusufaf/quizaroni/commit/79b9a73c2850a0b749a6a668dc4c7bc0ac29e11c))
* Add user-customizable font size scaling for accessibility ([9fbd3e7](https://github.com/yusufaf/quizaroni/commit/9fbd3e73835e0a2d9ef1d3fb4c8bf52e7e3261bc))
* implement multi-label support in frontend UI ([99114ef](https://github.com/yusufaf/quizaroni/commit/99114ef22ec5124c660c9dc817255ebc2a482e29))
* port gamification to pnpm monorepo structure (issue [#4](https://github.com/yusufaf/quizaroni/issues/4)) ([49b20cb](https://github.com/yusufaf/quizaroni/commit/49b20cb596f3e799eb2b7019688eb22ce25eaa4e))
* **srs:** wire up spaced repetition in apps/web ([#7](https://github.com/yusufaf/quizaroni/issues/7)) ([37d12f2](https://github.com/yusufaf/quizaroni/commit/37d12f2dd81b618352f85c35dd043d8af526abd0))
* **tts:** add voice selection and apply across TTS playback ([80c51ee](https://github.com/yusufaf/quizaroni/commit/80c51ee29d55f384b900b5b5b92de3230b84d507))
* **web:** real favicon/PWA icon set from new logo ([4520d11](https://github.com/yusufaf/quizaroni/commit/4520d1157c2fc6627b30df59a9a6ef2a00764dcb))
* **web:** show logo image in navbar ([02e6dce](https://github.com/yusufaf/quizaroni/commit/02e6dceacaf53096322fc65d1f15b2cf407afabb))


### Bug Fixes

* add safety check for undefined labels in HomeStudySetCard ([15e5a42](https://github.com/yusufaf/quizaroni/commit/15e5a42598a59b5c4e0ef50841b77626cc3efd05))
* **api:** correct models/user import casing; move pnpm overrides to workspace root ([e9ee992](https://github.com/yusufaf/quizaroni/commit/e9ee9925240e774e40daef8bc0e16bfe1452c1fc))
* **deps:** add missing dexie dependency to fix production build ([276f75a](https://github.com/yusufaf/quizaroni/commit/276f75ab3cc6cf8d439744842b67324e1acdaf4d))
* **hooks:** scope pre-commit lint/fmt to handleable file types ([b68bbf5](https://github.com/yusufaf/quizaroni/commit/b68bbf573e8db4a8115fc40dc19c4440412b70bb))
* **vite:** dedupe react to resolve duplicate-copy hook errors ([de5a892](https://github.com/yusufaf/quizaroni/commit/de5a892a02e956c8326fa3c19462a54906b96866))
* **web:** bump SW cache to v2 + no-cache sw/manifest headers ([e2d2c07](https://github.com/yusufaf/quizaroni/commit/e2d2c07c035b70e7b57d1770f1d92ebbb15491ef))
* **web:** repair emotion prebundle + IPv6 HMR in dev ([ca4f670](https://github.com/yusufaf/quizaroni/commit/ca4f670986e22bda4444ff023af0d5fb82ec2373))
* **web:** run vp staged from package dir in pre-commit hook ([03a8f7a](https://github.com/yusufaf/quizaroni/commit/03a8f7a87c0822c2df8fc89e9e4b2c14bc20f3e5))
