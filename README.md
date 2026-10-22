<p align="center">
  <img src="./logo.png" width="128" alt="Quizaroni Logo" style="border-radius: 20%" />
</p>

# Quizaroni

Turn any topic into flashcards you'll actually enjoy studying, with five study
modes, real spaced repetition, offline access, and public sharing. Free.

**Try it: [quizaroni.yusufaf.dev](https://quizaroni.yusufaf.dev)**

![Quizaroni landing page](./apps/web/public/og-image.png)

## Development

A React frontend backed by a fully serverless AWS backend, in a
**pnpm monorepo**:

| Workspace  | Path        | Stack                                                        |
| ---------- | ----------- | ----------------------------------------------------------- |
| Frontend   | `apps/web`  | React 18 · TypeScript · Vite · Material UI · AWS Amplify     |
| Backend    | `apps/api`  | AWS CDK · Lambda · API Gateway (HTTP) · DynamoDB · S3 · SES  |

### Architecture

```
 React (Amplify/Cognito auth)
        │  HTTPS, Bearer token
        ▼
 API Gateway (HTTP API) ── Lambda authorizer (verifies Cognito JWT)
        │
        ▼
 Lambda handlers ──► DynamoDB (study sets, users)
                 ──► S3 (file uploads, profile pictures)
                 ──► SES (feedback / notifications)
```

Everything in `apps/api` is defined as infrastructure-as-code with the AWS CDK
and deployed as a single CloudFormation stack.

### Quick start

```bash
pnpm install

# Frontend
cp apps/web/.env.example apps/web/.env
pnpm dev:web                       # http://localhost:3000

# Backend (requires AWS credentials + CDK bootstrap)
cp apps/api/.env.example apps/api/.env   # fill in account, region, Cognito IDs
pnpm build:api
pnpm synth:api                     # validate the CloudFormation template
pnpm deploy:api                    # deploy to your AWS account
```

### Configuration

No account-specific identifiers or secrets are committed. Supply your own via
the untracked `.env` files:

- `apps/api/.env` — AWS account/region, Cognito pool IDs, allowed CORS origins,
  optional Google OAuth credentials. See `apps/api/.env.example`.
- `apps/web/.env` — API base URL. See `apps/web/.env.example`.

### Repo scripts

Run from the root:

| Command           | Description                              |
| ----------------- | ---------------------------------------- |
| `pnpm dev:web`    | Start the frontend dev server            |
| `pnpm build`      | Build all workspaces                     |
| `pnpm typecheck`  | Type-check the frontend                  |
| `pnpm synth:api`  | Synthesize the CDK CloudFormation output |
| `pnpm deploy:api` | Deploy the backend to AWS                |
| `pnpm test`       | Run tests across workspaces              |

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md). Commits follow
[Conventional Commits](https://www.conventionalcommits.org/); releases are
automated with release-please.

## Security

Found a vulnerability or a committed secret? See [SECURITY.md](./SECURITY.md).

## License

[MIT](./LICENSE) © 2026 Yusuf Afzal
