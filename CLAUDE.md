# ScatterPilot — Claude Code Agent Instructions

## Repo Structure
- Frontend: scatterpilot/frontend/ (React + Vite + Tailwind)
- Backend: scatterpilot/functions/ (Python Lambda handlers)
- Shared layer: scatterpilot/layers/common/
- Infrastructure: scatterpilot/infrastructure/template.yaml (AWS SAM)
- CI/CD: .github/workflows/

## Design System
- Primary: sage-500 (#4A6741)
- Background: #FAFBF9
- Font: DM Sans
- All tokens in frontend/tailwind.config.js

## Stack
- Frontend: React, Vite, Tailwind CSS
- Backend: Python 3.12, AWS Lambda, API Gateway, DynamoDB
- Auth: Cognito
- Payments: Stripe Connect (user payments) + Stripe Billing (subscriptions)
- AI: AWS Bedrock (Claude Sonnet)
- Deploy: SAM (backend), S3 + CloudFront (frontend), GitHub Actions

## Branch Strategy
- main: production — only the Tech Lead merges here
- dev/frontend: frontend changes
- dev/backend: backend changes  
- dev/infra: infrastructure changes

## Coordination File
Check ~/Claude-code-evaluation/TASKS.md before starting work.
Update it when you complete a task or need something from another agent.

## Commit Conventions
- feat: new feature
- fix: bug fix
- docs: documentation
- refactor: code restructuring
- Always include scope: feat(frontend): , fix(backend): , etc.

## Rules
- Never push directly to main unless you are the Tech Lead agent
- Always run the build before committing (frontend: npm run build, backend: sam build)
- Read TASKS.md before every work session
- Update TASKS.md after completing work
