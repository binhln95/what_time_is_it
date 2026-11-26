# What time is it?

World clock & meeting reminder, built on AWS serverless (mostly always-free services).

```
Browser ──▶ CloudFront ──▶ S3 (web tĩnh)
   │
   │  1. Login ──▶ Cognito Hosted UI (OAuth2 code + PKCE) ──▶ ID token (JWT)
   │
   └──HTTPS (Authorization: Bearer <id token>)──▶ API Gateway HTTP API
                               ├─ throttling (rate 10/s, burst 20)
                               ├─ CORS (CloudFront domain + localhost:8080)
                               ├─ JWT Authorizer ◀── Cognito User Pool
                               │
                               ├─ GET  /time            (public)  ─▶ Lambda time
                               ├─ GET  /favorites       (JWT)     ─▶ Lambda favorites ─▶ DynamoDB
                               ├─ PUT  /favorites       (JWT)     ─▶ Lambda favorites
                               ├─ POST /meetings        (JWT)     ─▶ Lambda meetings ─▶ DynamoDB + Scheduler
                               ├─ GET  /meetings        (JWT)     ─▶ Lambda meetings
                               └─ GET  /meetings/{id}   (JWT)     ─▶ Lambda meetings
                                                                        │
                                  EventBridge Scheduler ─▶ SQS (+DLQ) ─▶ Lambda notify ─▶ SNS ─▶ Email
```

## Structure

```
what_time/
├── template.yaml              # SAM: all AWS resources
├── samconfig.toml             # deploy config: default = dev (stack what-time), prod (stack what-time-prod)
├── src/
│   ├── functions/             # one file per Lambda
│   │   ├── time.ts            #   GET /time (public)
│   │   ├── favorites.ts       #   GET/PUT /favorites
│   │   ├── meetings.ts        #   POST/GET /meetings, GET /meetings/{id}
│   │   └── notify.ts          #   SQS consumer -> SNS email
│   └── shared/                # time.ts, validation.ts, meeting.ts (pure, tested), http.ts, aws.ts
├── tests/                     # node:test + tsx
├── scripts/web.mjs            # writes config.js, uploads web/dist to S3, invalidates CloudFront
├── events/event.json          # sample event for local invoke
└── web/                       # frontend: React 19 + Vite + Tailwind 4 + shadcn/ui (radix, Phosphor icons)
    ├── public/config.js       #   runtime config (API URL, Cognito ids) - generated, gitignored
    └── src/
        ├── lib/               #   auth.ts (Cognito PKCE), api.ts, time.ts, types.ts, config.ts
        ├── hooks/             #   use-now, use-session
        └── components/        #   live-clock, world-clock, meetings, meeting-form, ... + ui/ (shadcn)
```

The web app reads its config at runtime from `/config.js` (not baked into the build), so one build
works for dev and prod stacks.

## DynamoDB (single table, PK/SK)

| PK | SK | Data |
|---|---|---|
| `USER#<sub>` | `FAVORITES` | `timezones: string[]` |
| `USER#<sub>` | `SUBSCRIPTION` | email subscribed to the SNS topic |
| `USER#<sub>` | `MEETING#<uuid>` | meeting; `ttl` deletes it 7 days after start |

## How a reminder works

1. `POST /meetings` validates the input, converts the local start time to UTC, and creates a
   one-time **EventBridge Scheduler** schedule `at(<local time>)` with `ScheduleExpressionTimezone`
   set to the meeting timezone (`ActionAfterCompletion: DELETE`).
2. The first time a user creates a meeting, their email is subscribed to the **SNS** topic with a
   filter policy `{"email": ["<their email>"]}`. AWS sends a confirmation email that must be clicked.
3. At reminder time Scheduler sends the payload to **SQS**; the `notify` Lambda publishes it to SNS
   with message attribute `email`, so only that subscriber gets it. After 3 failures the message goes
   to the **DLQ**.

## API

All routes except `/time` need `Authorization: Bearer <Cognito ID token>`.

```bash
GET  /time?lat=1.29&lon=103.85   # time at a location -> Asia/Singapore, +08:00
GET  /time?tz=Asia/Ho_Chi_Minh   # time in a timezone
GET  /favorites
PUT  /favorites      {"timezones": ["Asia/Tokyo", "Europe/London"]}
POST /meetings       {"title": "Sprint review", "start": "2026-12-01T10:00", "timezone": "Asia/Ho_Chi_Minh",
                      "durationMinutes": 30, "remindBeforeMinutes": 15,
                      "participants": [{"name": "Aiko", "timezone": "Asia/Tokyo"}]}
GET  /meetings
GET  /meetings/{id}  # includes start/end in every participant's timezone
```

`/time` picks the timezone from `lat`/`lon` first (looked up offline in the Lambda with
[`@photostructure/tz-lookup`](https://github.com/photostructure/tz-lookup), no external API),
then `tz`, else UTC; the response field `source` says which (`location` | `tz` | `default`).
The web app sends the position only if the user already granted location access or clicks
**Use my location**, rounded to 2 decimals (~1 km).

## Prerequisites

- Node.js 22+ (then `npm install` and `npm run web:install`)
- AWS CLI, configured: `brew install awscli`, then `aws configure` (or `aws sso login`)
- AWS SAM CLI: `brew install aws-sam-cli`
- Docker (only for `sam local`)

## Run

```bash
npm test                 # unit tests
npm run typecheck        # tsc --noEmit
npm run validate         # sam validate --lint
npm run invoke           # invoke TimeFunction locally with events/event.json (Docker)
```

Use the npm scripts rather than plain `sam build`: they put the local esbuild on `PATH`.

## Deploy

```bash
npm run deploy           # sam build + sam deploy (dev) + vite build + upload web/dist to S3/CloudFront
npm run deploy:prod      # same for the prod stack
npm run deploy:web       # only rebuild and upload the frontend
```

First deploy creates everything; open the `WebUrl` output, click **Log in**, sign up with your email.

### Web hosting (`WebHosting` parameter in `samconfig.toml`)

| Value | Hosting | Notes |
|---|---|---|
| `cloudfront` | S3 + CloudFront (OAC) | New AWS accounts are blocked ("Your account must be verified before you can add new CloudFront resources") until AWS Support verifies them |
| `amplify` *(current)* | AWS Amplify Hosting, `https://main.<appId>.amplifyapp.com` | Manual zip deploy by `scripts/web.mjs`, no Git connection |
| `none` | local only | `npm run deploy` just writes `web/public/config.js`; run `npm run web` |

The chosen URL is added to the Cognito callback URLs and the API CORS origins automatically
(`http://localhost:8080` is always allowed for local dev).

## Frontend dev

Runs the Vite dev server against the **deployed** API and Cognito (port 8080 is whitelisted in
CORS and the Cognito callback URLs):

```bash
npm run web:config       # writes web/public/config.js from the stack outputs
npm run web              # http://localhost:8080
```

Add more shadcn components with `cd web && npx shadcn@latest add <component>`.

## CI/CD (GitHub Actions)

[.github/workflows/ci-cd.yml](.github/workflows/ci-cd.yml):

| Trigger | Jobs |
|---|---|
| pull request, push | **backend**: `npm ci`, typecheck, tests, `sam validate --lint`, `sam build` - **web**: lint, build |
| push to `main` / manual run | the above, then **deploy**: `sam deploy` + `npm run deploy:web` |

AWS access uses **OIDC** - no access keys stored in GitHub. One-time setup:

```bash
aws cloudformation deploy --stack-name what-time-github-oidc \
  --template-file ci/github-oidc.yaml --capabilities CAPABILITY_IAM --region ap-southeast-1
```

Then add the `DeployRoleArn` output as repository **variable** `AWS_ROLE_ARN`
(Settings -> Secrets and variables -> Actions -> Variables). The role can only be assumed by
workflow runs on `main` of this repo. Until the variable exists the deploy job is skipped.

## Live demo

**[main.dwkknfpc3n8id.amplifyapp.com](https://main.dwkknfpc3n8id.amplifyapp.com/)**: the web app,
deployed from `main` by the CI/CD workflow (hosted on AWS Amplify).

- Without logging in you see the live clock for your timezone.
- **Log in** → **Sign up** with your email to try the world clock and meeting reminders.
  Cognito emails you a 6-digit code to confirm the account.

## Cost (free tier)

Lambda, DynamoDB (provisioned 5/5), Cognito, EventBridge Scheduler, SQS, SNS email, CloudFront and
CloudWatch stay inside the always-free limits for a sample project. API Gateway and S3 are free for
12 months (legacy accounts) or covered by credits, then cost cents at this scale. Set an AWS Budget
alert (e.g. $1) anyway.

## Clean up

```bash
npm run destroy          # empties the web bucket, then sam delete
```
