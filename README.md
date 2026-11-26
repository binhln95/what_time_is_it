# What time is it?

World clock & meeting reminder, built on AWS serverless (mostly always-free services).

```
Browser ──▶ Amplify Hosting (or CloudFront + S3, see WebHosting) ──▶ web (React)
   │
   │  1. Login ──▶ Cognito Hosted UI (OAuth2 code + PKCE) ──▶ ID token (JWT)
   │
   └──HTTPS (Authorization: Bearer <id token>)──▶ API Gateway HTTP API
                               ├─ throttling (rate 10/s, burst 20)
                               ├─ CORS (web domain + localhost:8080)
                               ├─ JWT Authorizer ◀── Cognito User Pool
                               │
                               ├─ GET  /time            (public)  ─▶ Lambda time ─▶ GeoIP layer (DB-IP)
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
│   │   ├── time.ts            #   GET /time (public): by lat/lon, tz or caller IP
│   │   ├── favorites.ts       #   GET/PUT /favorites
│   │   ├── meetings.ts        #   POST/GET /meetings, GET /meetings/{id}
│   │   └── notify.ts          #   SQS consumer -> SNS email
│   └── shared/                # time.ts, validation.ts, meeting.ts (pure, tested), geoip.ts, http.ts, aws.ts
├── tests/                     # node:test + tsx (geoip tests are skipped until `npm run geoip`)
├── scripts/
│   ├── web.mjs                # writes config.js, publishes web/dist (Amplify or S3 + CloudFront)
│   └── fetch-geoip.mjs        # downloads the DB-IP database into layers/geoip/
├── layers/geoip/              # GeoIP database for the Lambda layer - downloaded, gitignored
├── ci/github-oidc.yaml        # one-time stack: GitHub OIDC provider + deploy role
├── .github/workflows/         # ci-cd.yml (CI + deploy), oidc-debug.yml (manual OIDC check)
├── events/event.json          # sample event for local invoke
└── web/                       # frontend: React 19 + Vite + Tailwind 4 + shadcn/ui (radix, Phosphor icons)
    ├── public/config.js       #   runtime config (API URL, Cognito ids) - generated, gitignored
    └── src/
        ├── lib/               #   auth.ts (Cognito PKCE), api.ts, geo.ts, time.ts, types.ts, config.ts
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

`/time` picks the timezone from the first match, and says which in the response field `source`:

| Order | Input | `source` |
|---|---|---|
| 1 | `?lat=&lon=` | `location` |
| 2 | `?tz=` | `tz` |
| 3 | **the caller's IP** - API Gateway passes it as `requestContext.http.sourceIp`, the Lambda looks it up in the DB-IP database (layer) | `ip` (response also has `ip` and `location: {city, region, country}`) |
| 4 | nothing usable (e.g. private IP) | `default` (UTC) |

Coordinates are turned into a timezone offline with
[`@photostructure/tz-lookup`](https://github.com/photostructure/tz-lookup), no external API.

The web app's live clock (`web/src/components/live-clock.tsx`) asks for the location on page load
and calls `/time` with:

1. **GPS allowed** → `?lat=&lon=` (rounded to 2 decimals, ~1 km)
2. **refused / unavailable** → no parameters, so the server locates the caller **by IP**
3. **IP not locatable** (server answers `source: "default"`) → `?tz=<device timezone>`

A badge shows which one was used (From your location / From your IP address / From device settings);
**Use my location** retries GPS.

## GeoIP (IP -> location)

`GET /time` without parameters locates the caller by IP using the free
**[DB-IP IP to City Lite](https://db-ip.com/db/download/ip-to-city-lite)** database
(IP Geolocation by [DB-IP](https://db-ip.com), licensed CC BY 4.0).

- `npm run geoip` downloads this month's file (~130 MB) into `layers/geoip/` (gitignored);
  `npm run deploy` and the CI deploy job run it automatically (CI caches it per month).
- It ships as the Lambda layer `GeoIpLayer`, mounted at `/opt/dbip-city-lite.mmdb`, and is
  loaded into memory on the first IP lookup (~0.2 s once per container), hence `MemorySize: 512`
  for the time function. Lookups then take ~0.1 ms.
- Accuracy is city/country level; VPNs, proxies and some mobile networks report another place.

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

### 1. Connect to AWS (one-time setup)

Link the AWS CLI on your machine to your AWS account, so `sam deploy` knows where to deploy:

```bash
aws configure            # access key of an IAM user, region: ap-southeast-1
aws sts get-caller-identity   # prints your account id -> connected
```

```bash
npm run deploy           # fetch GeoIP db + sam build + sam deploy (dev) + vite build + publish web
npm run deploy:prod      # same for the prod stack
npm run deploy:web       # only rebuild and publish the frontend
npm run geoip            # only download this month's GeoIP database
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
| pull request, push | **Backend**: `npm ci`, typecheck, tests, `sam validate --lint`, `sam build` - **Web**: lint, build |
| push to `main` / manual run | the above, then **Deploy**: fetch GeoIP db (cached per month) + `sam deploy` + `npm run deploy:web` |

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

- Without logging in you see the live clock for where you are (GPS if you allow it, otherwise
  your IP address).
- **Log in** → **Sign up** with your email to try the world clock and meeting reminders.
  Cognito emails you a 6-digit code to confirm the account.

## Cost (free tier)

Lambda, DynamoDB (provisioned 5/5), Cognito, EventBridge Scheduler, SQS, SNS email, CloudFront and
CloudWatch stay inside the always-free limits for a sample project. API Gateway, Amplify Hosting and
S3 are free for 12 months (legacy accounts) or covered by credits, then cost cents at this scale.
Set an AWS Budget alert (e.g. $1) anyway.

- The time function runs with 512 MB (for the GeoIP database): 4x the GB-seconds of 128 MB, still
  far below the 400,000 GB-s free per month - the 1M free requests run out first.
- Each new monthly GeoIP database uploads a ~60 MB layer zip to the SAM artifacts bucket in S3;
  unchanged databases are not re-uploaded. Old zips stay there (a few cents/month) unless you add
  an S3 lifecycle rule.

## Clean up

```bash
npm run destroy          # empties the web bucket (CloudFront hosting only), then sam delete
aws cloudformation delete-stack --stack-name what-time-github-oidc --region ap-southeast-1   # CI role
```
