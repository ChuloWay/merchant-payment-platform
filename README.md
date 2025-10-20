# 🚀 Payment System with Temporal Workflow Orchestration

A production-ready, event-driven payment processing system built with **NestJS**, **AWS services** (SNS/SQS/Lambda), and **Temporal** workflow orchestration.

## 📊 Architecture Overview

**Type**: HYBRID (Monolithic API + Event-Driven Microservices)

```
┌─────────────────────────────────────────────────────────────┐
│                    CLIENT REQUEST                            │
└──────────────────────┬──────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────────────┐
│           NESTJS API (Monolithic Core)                       │
│  • REST API Endpoints                                        │
│  • Business Logic                                            │
│  • PostgreSQL Database                                       │
└──────────────────────┬──────────────────────────────────────┘
                       ↓ (Publishes Events)
┌─────────────────────────────────────────────────────────────┐
│              SNS TOPIC (payment-events)                      │
│           Fan-out to Multiple Queues                         │
└────────┬──────────┬──────────┬──────────┬───────────────────┘
         ↓          ↓          ↓          ↓
    ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐
    │ Process│ │Webhook │ │Analyti-│ │ Notif. │
    │  Queue │ │ Queue  │ │cs Queue│ │ Queue  │
    └────┬───┘ └───┬────┘ └───┬────┘ └───┬────┘
         ↓         ↓          ↓          ↓
    ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐
    │Payment │ │Webhook │ │ Future │ │ Future │
    │Process │ │ Sender │ │        │ │        │
    │ Lambda │ │ Lambda │ │        │ │        │
    └────┬───┘ └────────┘ └────────┘ └────────┘
         ↓
         └─→ Starts Temporal Workflow
                     ↓
┌─────────────────────────────────────────────────────────────┐
│              TEMPORAL WORKFLOW ENGINE                        │
│                                                              │
│  Server (Docker) ← → Worker (Node.js Process)              │
│                           ↓                                  │
│  PaymentProcessingWorkflow:                                │
│    1. validatePayment                                       │
│    2. updatePaymentStatus (processing)                      │
│    3. processPaymentWithGateway                             │
│    4. updatePaymentStatus (completed)                       │
│    5. sendWebhookNotification                               │
│                                                              │
│  On Failure → compensatePayment (Saga Pattern)             │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│         TEMPORAL UI (http://localhost:8088)                 │
│  Complete observability, audit trail, workflow history      │
└─────────────────────────────────────────────────────────────┘
```

## 🎯 Key Features

- ✅ **Event-Driven Architecture**: SNS/SQS for async communication
- ✅ **Serverless Processing**: AWS Lambda with auto-scaling
- ✅ **Workflow Orchestration**: Temporal for durable execution
- ✅ **Fault Tolerance**: Automatic retries + Saga compensation pattern
- ✅ **Complete Observability**: Temporal UI with full audit trail
- ✅ **Hybrid Design**: Fast development + independent scaling

## 🛠️ Tech Stack

### Core
- **NestJS**: TypeScript framework for the API layer
- **PostgreSQL**: Primary database (port 5433)
- **TypeORM**: Database ORM

### Event-Driven
- **AWS SNS**: Pub/sub messaging for event distribution
- **AWS SQS**: Message queues for reliable delivery
- **AWS Lambda**: Serverless functions (LocalStack)

### Workflow Orchestration
- **Temporal**: Durable workflow engine
- **Temporal UI**: Workflow observability (port 8088)

### Development
- **LocalStack**: Local AWS cloud stack (port 4566)
- **Docker & Docker Compose**: Containerization
- **Redis**: Caching layer (port 6379)

## 🚀 Quick Start

### Prerequisites
- Docker & Docker Compose
- Node.js 18+
- npm or yarn

### 1. Install Dependencies
```bash
npm install
```

### 2. Start Infrastructure
```bash
docker-compose up -d
```

**Services Started:**
- PostgreSQL (port 5433)
- LocalStack (port 4566)
- Temporal Server (port 7233)
- Temporal UI (port 8088)
- Redis (port 6379)

### 3. Set Up Environment
```bash
cp env.local.template .env
```

**Key environment variables** (already configured in `.env`):
```bash
# Feature Flags
ENABLE_SNS_PUBLISHING=true          # ✅ Use SNS for events
ENABLE_SQS_CONSUMER=false           # ✅ Lambda handles SQS (not cron)
ENABLE_TEMPORAL_WORKFLOWS=true      # ✅ Enable Temporal orchestration
ENABLE_LAMBDA_PROCESSING=true       # ✅ Enable Lambda functions

# Temporal
TEMPORAL_ADDRESS=localhost:7233
TEMPORAL_NAMESPACE=default
TEMPORAL_TASK_QUEUE=payment-processing
```

### 4. Run Database Migrations
```bash
npm run migration:run
npm run seed
```

### 5. Set Up AWS Resources (LocalStack)
```bash
bash scripts/localstack-setup.sh
```

**Creates:**
- SNS Topic: `payment-events`
- SQS Queues: `payment-processing-queue`, `payment-webhook-queue`, etc.
- Subscriptions: All queues subscribed to SNS topic

### 6. Deploy Lambda Functions
```bash
bash scripts/build-lambdas.sh
bash scripts/deploy-lambdas.sh
```

**Lambda Functions:**
- `payment-processor`: Processes payments, starts Temporal workflows
- `webhook-sender`: Sends webhooks to merchants

### 7. Start Application
```bash
# Terminal 1: NestJS API
npm run start:dev

# Terminal 2: Temporal Worker
npm run start:worker
```

**Application URLs:**
- API: http://localhost:3001/api/v1
- API Docs: http://localhost:3001/api/v1/docs
- Temporal UI: http://localhost:8088
- Health Check: http://localhost:3001/api/v1/health

## 🧪 Testing

### Get Test Credentials
```bash
# Get merchant and payment method from database
docker exec payment_system_db psql -U postgres -d payment_system -c "SELECT id, \"apiKey\" FROM merchants LIMIT 1;"
docker exec payment_system_db psql -U postgres -d payment_system -c "SELECT id FROM payment_methods LIMIT 1;"
```

### Create a Successful Payment
```bash
curl -X POST http://localhost:3001/api/v1/payments \
  -H "Content-Type: application/json" \
  -H "X-API-Key: pk_mg4v15ga_d68ae6bdbce7401595c79a57e27c79b0" \
  -d '{
    "amount": 100000,
    "currency": "NGN",
    "paymentMethodId": "227ff788-66dd-416a-a808-04aa583373ba",
    "metadata": {
      "orderId": "TEST-001",
      "customerName": "John Doe",
      "customerEmail": "john@test.com",
      "description": "Test payment"
    }
  }'
```

**Expected Response:**
```json
{
  "statusCode": 201,
  "data": {
    "id": "uuid",
    "reference": "PAY-xxx",
    "amount": 100000,
    "status": "pending",
    ...
  }
}
```

### What Happens After Payment Creation:

1. **NestJS saves payment** to PostgreSQL
2. **Publishes event** to SNS Topic (`payment.initiated`)
3. **SNS fans out** to multiple SQS queues
4. **Lambda functions auto-trigger** from SQS messages
5. **payment-processor Lambda** starts Temporal workflow
6. **Temporal Worker executes** activities:
   - `validatePayment` → validates business rules
   - `updatePaymentStatus` → sets to "processing"
   - `processPaymentWithGateway` → calls payment gateway
   - `updatePaymentStatus` → sets to "completed"
   - `sendWebhookNotification` → notifies merchant
7. **Complete audit trail** available in Temporal UI

### View Workflows in Temporal UI

1. Open http://localhost:8088
2. **Important**: Select **"default"** namespace (dropdown at top)
3. Click **"Workflows"** tab
4. Look for workflows starting with `payment-`
5. Click on a workflow to see:
   - Timeline of activities
   - Input/output for each step
   - Current status
   - Complete event history

### Create More Test Payments
```bash
# High-value payment
curl -X POST http://localhost:3001/api/v1/payments \
  -H "Content-Type: application/json" \
  -H "X-API-Key: pk_mg4v15ga_d68ae6bdbce7401595c79a57e27c79b0" \
  -d '{
    "amount": 500000,
    "currency": "NGN",
    "paymentMethodId": "227ff788-66dd-416a-a808-04aa583373ba",
    "metadata": {
      "orderId": "HIGH-VALUE-001",
      "customerName": "Jane Smith",
      "customerEmail": "jane@test.com",
      "priority": "high"
    }
  }'
```

## 📋 Project Structure

```
payment-system-assessment/
├── src/
│   ├── modules/
│   │   ├── payments/          # Payment processing logic
│   │   ├── merchants/         # Merchant management
│   │   ├── payment-methods/   # Payment methods
│   │   ├── webhooks/          # Webhook handling
│   │   └── events/            # SNS/SQS services
│   ├── temporal/
│   │   ├── workflows/         # Temporal workflow definitions
│   │   ├── activities/        # Business logic activities
│   │   ├── temporal-client.service.ts
│   │   └── worker.ts          # Temporal worker
│   ├── database/
│   │   ├── migrations/        # Database migrations
│   │   └── seeds/             # Test data
│   └── config/                # Configuration files
├── lambdas/
│   ├── payment-processor/     # Payment processing Lambda
│   ├── webhook-sender/        # Webhook delivery Lambda
│   └── shared/                # Shared types & utilities
├── scripts/
│   ├── localstack-setup.sh    # AWS resources setup
│   ├── deploy-lambdas.sh      # Lambda deployment
│   └── build-lambdas.sh       # Lambda build script
├── docker-compose.yml         # Infrastructure services
└── .env                       # Environment configuration
```

## 🔍 Monitoring & Debugging

### Check Application Logs
```bash
# NestJS API logs
tail -f app.log | grep -E "(SNS|Event published)"

# Temporal Worker logs
tail -f worker.log | grep -E "(PaymentActivity|workflow)"
```

### Check Service Health
```bash
# Application health
curl http://localhost:3001/api/v1/health

# Docker services
docker-compose ps

# Temporal server
docker exec payment_temporal tctl workflow list --open
```

### Check Queue Status
```bash
docker run --rm \
  --add-host=host.docker.internal:host-gateway \
  -e AWS_ACCESS_KEY_ID=test \
  -e AWS_SECRET_ACCESS_KEY=test \
  -e AWS_DEFAULT_REGION=us-east-1 \
  amazon/aws-cli \
  --endpoint-url=http://host.docker.internal:4566 \
  sqs get-queue-attributes \
  --queue-url http://localhost:4566/000000000000/payment-processing-queue \
  --attribute-names ApproximateNumberOfMessages
```

### View Recent Payments
```bash
docker exec payment_system_db psql -U postgres -d payment_system \
  -c "SELECT id, reference, amount, status, \"createdAt\" FROM payments ORDER BY \"createdAt\" DESC LIMIT 5;"
```

## 🏗️ Architecture Decisions

### Why Hybrid Architecture?

**Monolithic Core**:
- ✅ Fast development for related features
- ✅ Simple deployment
- ✅ Shared database transactions
- ✅ Easy to understand and maintain

**Event-Driven Microservices**:
- ✅ Independent scaling (Lambda auto-scales)
- ✅ Fault isolation
- ✅ Async processing
- ✅ Easy to add new consumers

### Why Temporal?

- ✅ **Durable Execution**: Workflows survive crashes
- ✅ **Built-in Retries**: Automatic exponential backoff
- ✅ **Saga Pattern**: Compensation logic for distributed transactions
- ✅ **Observability**: Complete audit trail and UI
- ✅ **Versioning**: Deploy new versions without breaking running workflows
- ✅ **Time Travel**: Replay workflows for debugging

### Why SNS + SQS?

- ✅ **Fan-out Pattern**: One event, multiple consumers
- ✅ **Decoupling**: Publishers don't know about subscribers
- ✅ **Reliability**: At-least-once delivery
- ✅ **Buffering**: Handles traffic spikes
- ✅ **Dead Letter Queues**: Handle poison messages

## 🚧 Development

### Adding a New Event Consumer

1. **Create new SQS queue** in `scripts/localstack-setup.sh`
2. **Subscribe queue** to SNS topic
3. **Create Lambda function** in `lambdas/`
4. **Deploy Lambda** and create event source mapping

### Adding a New Workflow Activity

1. **Define activity function** in `src/temporal/activities/`
2. **Import in workflow** (`src/temporal/workflows/`)
3. **Use in workflow** with retry policies
4. **Restart Temporal worker**

### Running Tests
```bash
# Unit tests
npm test

# E2E tests
npm run test:e2e

# Coverage
npm run test:cov
```

## 🔐 Security Notes

- API keys stored securely in database (hashed in production)
- CORS configured for allowed origins
- Rate limiting enabled (100 requests/minute)
- Input validation on all endpoints
- SQL injection protection via TypeORM
- XSS protection via Helmet middleware

## 📈 Production Considerations

### Database
- Use managed PostgreSQL (AWS RDS, Azure Database)
- Enable connection pooling
- Set up read replicas for scaling
- Regular backups and point-in-time recovery

### AWS Services
- Replace LocalStack with real AWS services
- Use AWS Lambda in production
- Configure CloudWatch for logging
- Set up SNS/SQS with proper IAM roles

### Temporal
- Use Temporal Cloud (managed service)
- Or self-host with high availability
- Set up proper namespace isolation
- Configure workflow versioning strategy

### Monitoring
- Integrate with Prometheus/Grafana
- Set up alerts for failed workflows
- Monitor queue depths
- Track payment success rates

## 🤝 Contributing

This project demonstrates a production-ready architecture for:
- Payment processing systems
- Event-driven microservices
- Workflow orchestration
- AWS services integration
- Temporal workflows

## 📄 License

[Your License Here]

## 🙏 Acknowledgments

Built with:
- NestJS
- Temporal
- AWS Services (SNS/SQS/Lambda)
- PostgreSQL
- Docker

---

**Made with ❤️ for scalable, fault-tolerant payment processing**
