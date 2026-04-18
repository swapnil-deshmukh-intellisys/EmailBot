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

## Build + Push Image
```bash
docker build -t intellimailpilot:latest .
docker tag intellimailpilot:latest <aws_account_id>.dkr.ecr.<region>.amazonaws.com/<repo>:latest
docker push <aws_account_id>.dkr.ecr.<region>.amazonaws.com/<repo>:latest
```

## Deploy
1. Register web task definition from `web-task-definition.template.json`
2. Register worker task definition from `worker-task-definition.template.json`
3. Update ECS web service to new revision
4. Update ECS worker service to new revision
5. Verify `/api/health`
6. Verify `/api/worker-health`
7. Run legacy cleanup dry-run, then apply
8. Start one test campaign
9. Start two campaigns together

## Expected Healthy State
- web service stable
- worker service stable
- `/api/health` returns `healthy`
- `/api/worker-health` returns `healthy`
- `staleRunning = 0`
- queued campaigns drain as worker processes them
