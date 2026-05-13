#!/usr/bin/env node

import { execSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

function run(command, { capture = false, quiet = false } = {}) {
  if (capture) {
    return execSync(command, { stdio: ['ignore', 'pipe', 'pipe'] }).toString().trim();
  }

  execSync(command, { stdio: quiet ? ['ignore', 'pipe', 'pipe'] : 'inherit' });
  return '';
}

function loadDotenv(filePath) {
  if (!existsSync(filePath)) return;

  const lines = readFileSync(filePath, 'utf8').split(/\r?\n/g);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex <= 0) continue;

    const name = trimmed.slice(0, separatorIndex).trim();
    let value = trimmed.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!process.env[name]) {
      process.env[name] = value;
    }
  }
}

loadDotenv(path.join(process.cwd(), '.env'));

function requireEnv(name) {
  const value = String(process.env[name] || '').trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const defaultPresetSenderEmailsTec = [
  'sam@theentrepreneurialchronicle.com',
  'clara@theentrepreneurialchronicle.com',
  'sophia@theentrepreneurialchronicle.com',
  'jess@theentrepreneurialchronicle.com',
  'diana@theentrepreneurialchronicle.com',
  'victoria@theentrepreneurialchronicle.com',
  'alina@theentrepreneurialchronicle.com',
  'amelia@theentrepreneurialchronicle.com',
  'grace@theentrepreneurialchronicle.com',
  'eliana@theentrepreneurialchronicle.com',
  'liam@theentrepreneurialchronicle.com',
  'emma@theentrepreneurialchronicle.com',
  'fiona@theentrepreneurialchronicle.com',
  'daniel@theentrepreneurialchronicle.com',
  'lacy@theentrepreneurialchronicle.com',
  'robert@theentrepreneurialchronicle.com',
  'mark@theentrepreneurialchronicle.com',
  'charlie@theentrepreneurialchronicle.com',
  'juan@theentrepreneurialchronicle.com',
  'manuel@theentrepreneurialchronicle.com',
  'antonio@theentrepreneurialchronicle.com',
  'john@theentrepreneurialchronicle.com',
  'lily@theentrepreneurialchronicle.com'
].join(',');

const defaultPresetSenderEmailsTut = [
  'Matt@theunicorntimes.com',
  'Jordan@theunicorntimes.com',
  'Jessica@theunicorntimes.com',
  'ethan@theunicorntimes.com',
  'Lily@theunicorntimes.com',
  'Jasmin@theunicorntimes.com',
  'kevin@theunicorntimes.com',
  'Peter@theunicorntimes.com',
  'Tyler@theunicorntimes.com',
  'Olivia@theunicorntimes.com',
  'Allison@theunicorntimes.com',
  'Carmen@theunicorntimes.com',
  'Isla@theunicorntimes.com',
  'Jasmin@theunicorntimes.com',
  'Jason@theunicorntimes.com',
  'Jessica@theunicorntimes.com',
  'Julia@theunicorntimes.com',
  'Juliana@theunicorntimes.com',
  'Lena@theunicorntimes.com',
  'Lisa@theunicorntimes.com',
  'Lucy@theunicorntimes.com',
  'Martina@theunicorntimes.com',
  'Mary@theunicorntimes.com',
  'Nora@theunicorntimes.com',
  'Valeria@theunicorntimes.com'
].join(',');

function buildTag() {
  const explicit = String(process.env.DEPLOY_TAG || '').trim();
  if (explicit) return explicit;

  const now = new Date();
  const stamp = [
    now.getUTCFullYear(),
    String(now.getUTCMonth() + 1).padStart(2, '0'),
    String(now.getUTCDate()).padStart(2, '0'),
    String(now.getUTCHours()).padStart(2, '0'),
    String(now.getUTCMinutes()).padStart(2, '0'),
    String(now.getUTCSeconds()).padStart(2, '0')
  ].join('');

  let shortSha = 'nogit';
  try {
    shortSha = run('git rev-parse --short HEAD', { capture: true });
  } catch {
    shortSha = 'nogit';
  }

  return `${stamp}-${shortSha}`;
}

function renderTemplate(templatePath, replacements) {
  let rendered = readFileSync(templatePath, 'utf8');

  for (const [token, value] of Object.entries(replacements)) {
    rendered = rendered.split(token).join(value);
  }

  const unresolved = Array.from(rendered.matchAll(/__([A-Z0-9_]+)__/g)).map((m) => m[0]);
  if (unresolved.length) {
    const unique = [...new Set(unresolved)].sort();
    throw new Error(`Unresolved placeholders in ${templatePath}: ${unique.join(', ')}`);
  }

  return rendered;
}

function getTaskImageSet(cluster, service) {
  const taskArns = run(
    `aws ecs list-tasks --cluster "${cluster}" --service-name "${service}" --desired-status RUNNING --query "taskArns" --output json`,
    { capture: true }
  );

  const parsed = JSON.parse(taskArns);
  if (!Array.isArray(parsed) || parsed.length === 0) {
    return [];
  }

  const arnArgs = parsed.map((arn) => `"${arn}"`).join(' ');
  const imagesRaw = run(
    `aws ecs describe-tasks --cluster "${cluster}" --tasks ${arnArgs} --query "tasks[].containers[].image" --output json`,
    { capture: true }
  );

  const images = JSON.parse(imagesRaw);
  return [...new Set(images)];
}

function main() {
  const region = requireEnv('AWS_REGION');
  const accountId = requireEnv('AWS_ACCOUNT_ID');
  const repository = requireEnv('ECR_REPOSITORY');
  const cluster = requireEnv('ECS_CLUSTER');
  const webService = requireEnv('WEB_SERVICE_NAME');
  const workerService = requireEnv('WORKER_SERVICE_NAME');
  const executionRoleArn = requireEnv('ECS_EXECUTION_ROLE_ARN');
  const taskRoleArn = requireEnv('ECS_TASK_ROLE_ARN');
  const cloudWatchGroup = requireEnv('CLOUDWATCH_LOG_GROUP');

  const tag = buildTag();
  const imageUri = `${accountId}.dkr.ecr.${region}.amazonaws.com/${repository}:${tag}`;

  const replacements = {
    __ECR_IMAGE_URI__: imageUri,
    __DEPLOYMENT_VERSION__: tag,
    __AWS_REGION__: region,
    __ECS_EXECUTION_ROLE_ARN__: executionRoleArn,
    __ECS_TASK_ROLE_ARN__: taskRoleArn,
    __CLOUDWATCH_LOG_GROUP__: cloudWatchGroup,
    __SECRET_MONGODB_URI__: requireEnv('SECRET_MONGODB_URI'),
    __SECRET_JWT_SECRET__: requireEnv('SECRET_JWT_SECRET'),
    __SECRET_ADMIN_EMAIL__: requireEnv('SECRET_ADMIN_EMAIL'),
    __SECRET_ADMIN_PASSWORD__: requireEnv('SECRET_ADMIN_PASSWORD'),
    __SECRET_DEFAULT_USER_PASSWORD__: requireEnv('SECRET_DEFAULT_USER_PASSWORD'),
    __SECRET_SMTP_HOST__: requireEnv('SECRET_SMTP_HOST'),
    __SECRET_SMTP_PORT__: requireEnv('SECRET_SMTP_PORT'),
    __SECRET_SMTP_SECURE__: requireEnv('SECRET_SMTP_SECURE'),
    __SECRET_SMTP_USER__: requireEnv('SECRET_SMTP_USER'),
    __SECRET_SMTP_PASS__: requireEnv('SECRET_SMTP_PASS'),
    __SECRET_SMTP_FROM__: requireEnv('SECRET_SMTP_FROM'),
    __SECRET_TENANT_ID__: requireEnv('SECRET_TENANT_ID'),
    __SECRET_CLIENT_ID__: requireEnv('SECRET_CLIENT_ID'),
    __SECRET_CLIENT_SECRET__: requireEnv('SECRET_CLIENT_SECRET'),
    __SECRET_GRAPH_SENDER_EMAIL__: requireEnv('SECRET_GRAPH_SENDER_EMAIL'),
    __SECRET_TUT_TENANT_ID__: requireEnv('SECRET_TUT_TENANT_ID'),
    __SECRET_TUT_CLIENT_ID__: requireEnv('SECRET_TUT_CLIENT_ID'),
    __SECRET_TUT_CLIENT_SECRET__: requireEnv('SECRET_TUT_CLIENT_SECRET'),
    __SECRET_TUT_GRAPH_SENDER_EMAIL__: requireEnv('SECRET_TUT_GRAPH_SENDER_EMAIL'),
    __SECRET_ALLOWED_ORIGINS__: requireEnv('SECRET_ALLOWED_ORIGINS'),
    __PRESET_SENDER_EMAILS_TEC__: process.env.PRESET_SENDER_EMAILS_TEC || defaultPresetSenderEmailsTec,
    __PRESET_SENDER_EMAILS_TUT__: process.env.PRESET_SENDER_EMAILS_TUT || defaultPresetSenderEmailsTut
  };

  const root = process.cwd();
  const webTemplate = path.join(root, 'aws', 'ecs', 'web-task-definition.template.json');
  const workerTemplate = path.join(root, 'aws', 'ecs', 'worker-task-definition.template.json');
  const tempDir = mkdtempSync(path.join(tmpdir(), 'ecs-deploy-'));
  const webRendered = path.join(tempDir, 'web-task-definition.rendered.json');
  const workerRendered = path.join(tempDir, 'worker-task-definition.rendered.json');
  const webRenderedUri = pathToFileURL(webRendered).href;
  const workerRenderedUri = pathToFileURL(workerRendered).href;

  try {
    console.log(`[deploy] Building immutable image: ${imageUri}`);
    run(`docker build --build-arg DEPLOYMENT_VERSION="${tag}" -t "intellimailpilot:${tag}" .`);

    try {
      run(`aws ecr describe-repositories --repository-names "${repository}" --region "${region}"`, { quiet: true });
    } catch {
      run(`aws ecr create-repository --repository-name "${repository}" --region "${region}"`, { quiet: true });
    }

    console.log('[deploy] Logging in to ECR');
    run(`aws ecr get-login-password --region "${region}" | docker login --username AWS --password-stdin "${accountId}.dkr.ecr.${region}.amazonaws.com"`);

    console.log('[deploy] Pushing image');
    run(`docker tag "intellimailpilot:${tag}" "${imageUri}"`);
    run(`docker push "${imageUri}"`);

    console.log('[deploy] Rendering ECS task definitions');
    writeFileSync(webRendered, renderTemplate(webTemplate, replacements));
    writeFileSync(workerRendered, renderTemplate(workerTemplate, replacements));

    console.log('[deploy] Registering task definition revisions');
    const webTaskDefArn = run(
      `aws ecs register-task-definition --cli-input-json "${webRenderedUri}" --query "taskDefinition.taskDefinitionArn" --output text --region "${region}"`,
      { capture: true }
    );
    const workerTaskDefArn = run(
      `aws ecs register-task-definition --cli-input-json "${workerRenderedUri}" --query "taskDefinition.taskDefinitionArn" --output text --region "${region}"`,
      { capture: true }
    );

    console.log('[deploy] Updating ECS services with forced rollout');
    run(
      `aws ecs update-service --cluster "${cluster}" --service "${webService}" --task-definition "${webTaskDefArn}" --force-new-deployment --region "${region}"`,
      { quiet: true }
    );
    run(
      `aws ecs update-service --cluster "${cluster}" --service "${workerService}" --task-definition "${workerTaskDefArn}" --force-new-deployment --region "${region}"`,
      { quiet: true }
    );

    console.log('[deploy] Waiting for ECS services to stabilize');
    run(`aws ecs wait services-stable --cluster "${cluster}" --services "${webService}" "${workerService}" --region "${region}"`);

    const webImages = getTaskImageSet(cluster, webService);
    const workerImages = getTaskImageSet(cluster, workerService);
    const allowed = new Set([imageUri]);

    const webMismatch = webImages.filter((img) => !allowed.has(img));
    const workerMismatch = workerImages.filter((img) => !allowed.has(img));

    if (webMismatch.length || workerMismatch.length) {
      throw new Error(
        `Image mismatch after rollout. Expected only ${imageUri}. Web images: ${webImages.join(', ') || '(none)'}; Worker images: ${workerImages.join(', ') || '(none)'}`
      );
    }

    const cfDistribution = String(process.env.CLOUDFRONT_DISTRIBUTION_ID || '').trim();
    if (cfDistribution) {
      console.log('[deploy] Invalidating CloudFront cache');
      run(
        `aws cloudfront create-invalidation --distribution-id "${cfDistribution}" --paths "/*" --output text`
      );
    }

    console.log(`[deploy] Success. Active immutable image: ${imageUri}`);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

try {
  main();
} catch (error) {
  console.error(`[deploy] Failed: ${error.message}`);
  process.exit(1);
}
