#!/usr/bin/env node
// Web helper, driven by the CloudFormation stack outputs (needs the AWS CLI).
//
//   node scripts/web.mjs config [stack]   write web/public/config.js for `npm run web` (Vite dev server)
//   node scripts/web.mjs deploy [stack]   write web/dist/config.js and publish web/dist to the stack's
//                                         hosting (WebHosting parameter):
//                                           cloudfront -> S3 sync + CloudFront invalidation
//                                           amplify    -> zip + Amplify manual deployment
//                                           none       -> only writes web/public/config.js
//                                         (run `npm --prefix web run build` first)
//   node scripts/web.mjs empty  [stack]   empty the web bucket (needed before `sam delete`)
//
// stack defaults to "what-time"; region from AWS_REGION or ap-southeast-1.

import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const [command = 'deploy', stack = 'what-time'] = process.argv.slice(2);
const region = process.env.AWS_REGION ?? 'ap-southeast-1';
const publicDir = fileURLToPath(new URL('../web/public/', import.meta.url));
const distDir = fileURLToPath(new URL('../web/dist/', import.meta.url));

const aws = (...args) =>
  execFileSync('aws', [...args, '--region', region], { stdio: ['ignore', 'pipe', 'inherit'] }).toString();
const awsJson = (...args) => JSON.parse(aws(...args, '--output', 'json'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function stackOutputs() {
  const outputs = awsJson('cloudformation', 'describe-stacks', '--stack-name', stack, '--query', 'Stacks[0].Outputs');
  return Object.fromEntries(outputs.map((o) => [o.OutputKey, o.OutputValue]));
}

function writeConfig(out, dir) {
  const config = {
    apiUrl: out.ApiUrl,
    userPoolId: out.UserPoolId,
    userPoolClientId: out.UserPoolClientId,
  };
  writeFileSync(`${dir}config.js`, `window.APP_CONFIG = ${JSON.stringify(config, null, 2)};\n`);
  console.log(`Wrote ${dir}config.js for stack ${stack}`);
}

function requireDist() {
  if (!existsSync(`${distDir}index.html`)) {
    console.error('web/dist is missing - run `npm --prefix web run build` first.');
    process.exit(1);
  }
}

async function deployAmplify(out) {
  const appId = out.AmplifyAppId;
  const branch = out.AmplifyBranch;

  // Amplify manual deploy: zip the build output (index.html at the zip root) ...
  const tmp = mkdtempSync(join(tmpdir(), 'what-time-web-'));
  const zip = join(tmp, 'web.zip');
  execFileSync('zip', ['-qr', zip, '.'], { cwd: distDir });

  // ... ask Amplify for an upload URL, PUT the zip there, then start the deployment.
  const job = awsJson('amplify', 'create-deployment', '--app-id', appId, '--branch-name', branch);
  const res = await fetch(job.zipUploadUrl, { method: 'PUT', body: readFileSync(zip) });
  rmSync(tmp, { recursive: true, force: true });
  if (!res.ok) throw new Error(`Zip upload failed: HTTP ${res.status}`);
  aws('amplify', 'start-deployment', '--app-id', appId, '--branch-name', branch, '--job-id', job.jobId);

  process.stdout.write(`Amplify job ${job.jobId} `);
  for (;;) {
    const status = awsJson('amplify', 'get-job', '--app-id', appId, '--branch-name', branch, '--job-id', job.jobId,
      '--query', 'job.summary.status');
    if (status === 'SUCCEED') break;
    if (['FAILED', 'CANCELLED'].includes(status)) throw new Error(`Amplify deployment ${status}`);
    process.stdout.write('.');
    await sleep(3000);
  }
  console.log(' done');
}

const out = stackOutputs();

switch (command) {
  case 'config':
    writeConfig(out, publicDir);
    break;

  case 'deploy':
    if (out.AmplifyAppId) {
      requireDist();
      writeConfig(out, distDir);
      await deployAmplify(out);
    } else if (out.WebBucketName) {
      requireDist();
      writeConfig(out, distDir);
      aws('s3', 'sync', distDir, `s3://${out.WebBucketName}`, '--delete');
      aws('cloudfront', 'create-invalidation', '--distribution-id', out.WebDistributionId, '--paths', '/*');
    } else {
      // WebHosting=none: set up local dev instead.
      writeConfig(out, publicDir);
      console.log('No web hosting in this stack (WebHosting=none). Run the app locally: npm run web');
      break;
    }
    console.log(`Web deployed: ${out.WebUrl}`);
    break;

  case 'empty':
    if (!out.WebBucketName) break; // only the CloudFront variant has a bucket
    aws('s3', 'rm', `s3://${out.WebBucketName}`, '--recursive');
    console.log(`Emptied s3://${out.WebBucketName}`);
    break;

  default:
    console.error(`Unknown command "${command}". Use config | deploy | empty.`);
    process.exit(1);
}
