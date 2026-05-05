# AWS ECS Deployment Checklist

## Inputs You Must Fill
- `AWS_REGION`
- `AWS_ACCOUNT_ID`
- `ECR_REPOSITORY`
- `ECS_CLUSTER`
- `WEB_SERVICE_NAME`
- `WORKER_SERVICE_NAME`
- `ALB_TARGET_GROUP`
- `ECS_EXECUTION_ROLE_ARN`
- `ECS_TASK_ROLE_ARN`
- MongoDB and mail-provider secrets in AWS Secrets Manager

## Secrets Manager Keys
- `MONGODB_URI`
- `JWT_SECRET`
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`
- `DEFAULT_USER_PASSWORD`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_SECURE`
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_FROM`
- `TENANT_ID`
- `CLIENT_ID`
- `CLIENT_SECRET`
- `GRAPH_SENDER_EMAIL`
- `ALLOWED_ORIGINS`

## Build + Push Image (Immutable Tag)
```bash
TAG=2026-05-05-001
docker build --build-arg DEPLOYMENT_VERSION=$TAG -t intellimailpilot:$TAG .
docker tag intellimailpilot:$TAG <aws_account_id>.dkr.ecr.<region>.amazonaws.com/<repo>:$TAG
docker push <aws_account_id>.dkr.ecr.<region>.amazonaws.com/<repo>:$TAG
```

## Automated Rollout (Preferred)
```bash
npm run deploy:ecs
```

## Deploy
1. Register web task definition from `web-task-definition.template.json` using the exact immutable image tag.
2. Register worker task definition from `worker-task-definition.template.json` using the exact immutable image tag.
3. Update ECS web service to new revision.
4. Update ECS worker service to new revision.
5. Force new ECS deployment so all old tasks are replaced.
6. Confirm every running task is on the same image tag.
7. Verify `/api/health`.
8. Verify `/api/worker-health`.
9. Run legacy cleanup dry-run, then apply.
10. Start one test campaign.
11. Start two campaigns together.

## Important For Next.js Static Chunks
- Build once in CI/Docker image (`docker build ...`), do **not** run `next build` at container runtime.
- Keep web container command as `npm run start` where `start` only launches `node .next/standalone/server.js`.
- Use immutable image tags per release (avoid reusing `latest` for active deployments).
- After deploy, force new deployment so all running web tasks use the exact same image/build.
- If CloudFront/CDN is used, invalidate `/*` or at minimum `/_next/*` plus all HTML routes.
- Hard refresh browser (or clear site data) after deployment.

## Expected Healthy State
- web service stable
- worker service stable
- `/api/health` returns `healthy`
- `/api/worker-health` returns `healthy`
- `staleRunning = 0`
- queued campaigns drain as worker processes them
