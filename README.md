\# ReachInbox Email Scheduler



A production-oriented email scheduling platform built with React/Next.js,

Node.js, Express, PostgreSQL, Redis, BullMQ and Elasticsearch.



\## Features



\- Google OAuth authentication

\- Campaign management

\- CSV lead upload

\- Duplicate lead prevention

\- Delayed email scheduling

\- BullMQ + Redis background workers

\- PostgreSQL persistence

\- Ethereal SMTP email delivery

\- Retry and exponential backoff

\- Idempotent email processing

\- Global minimum send delay

\- Hourly email rate limiting

\- Slack rate-limit notifications

\- Elasticsearch email search

\- Bull Board queue monitoring

\- Startup job reconciliation

\- Docker-based infrastructure



\## Architecture



Frontend

→ Express API

→ PostgreSQL



Scheduled emails

→ BullMQ

→ Redis

→ Email Worker

→ Ethereal SMTP



Search

→ Elasticsearch



Rate limit

→ Redis



Notifications

→ Slack



\## Tech Stack



\### Frontend

\- React / Next.js

\- Tailwind CSS



\### Backend

\- Node.js

\- TypeScript

\- Express



\### Infrastructure

\- PostgreSQL

\- Redis

\- BullMQ

\- Elasticsearch

\- Docker



\## Running Locally



\### Infrastructure



```bash

docker compose up -d

