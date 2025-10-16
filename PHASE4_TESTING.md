# Phase 4: Temporal Workflows - Testing Guide

## Overview
This guide walks through testing the complete end-to-end event-driven payment processing system with Temporal workflow orchestration.

## Architecture Flow

```
Payment API Request
    ↓
NestJS App (publishes to SNS)
    ↓
SNS Topic (payment-events)
    ├→ SQS: payment-processing-queue → Lambda: payment-processor → Temporal Workflow
    ├→ SQS: payment-webhook-queue → Lambda: webhook-sender
    ├→ SQS: payment-analytics-queue (future)
    └→ SQS: payment-notification-queue (future)

Temporal Workflow Execution:
    ↓
Temporal Server
    ↓
Temporal Worker (polls for tasks)
    ↓
Activities (validation, processing, webhooks, compensation)
```

## Prerequisites

### 1. Environment Setup

Copy the environment template and update feature flags:
```bash
cp env.local.template .env
```

Update these values in `.env`:
```bash
PORT=3001                          # Changed from 3000
ENABLE_SNS_PUBLISHING=true         # Use SNS pub/sub
ENABLE_SQS_CONSUMER=false          # Disable old cron consumer
ENABLE_TEMPORAL_WORKFLOWS=true     # Enable workflows
ENABLE_LAMBDA_PROCESSING=true      # Enable Lambda triggers
```

### 2. Services Running

Ensure all Docker services are healthy:
```bash
docker-compose ps
```

Expected services:
- ✅ `payment_postgres` (PostgreSQL on port 5433)
- ✅ `payment-localstack` (LocalStack on port 4566)
- ✅ `payment_temporal` (Temporal server on port 7233)
- ✅ `payment_temporal_ui` (Temporal UI on port 8088)

### 3. LocalStack Resources

Initialize AWS resources in LocalStack:
```bash
bash scripts/localstack-setup.sh
```

Expected output:
- ✅ SNS Topic: `payment-events`
- ✅ SQS Queues: 5 queues + 1 DLQ
- ✅ Subscriptions: All queues subscribed to SNS topic

### 4. Deploy Lambda Functions

Build and deploy Lambdas to LocalStack:
```bash
bash scripts/build-lambdas.sh
bash scripts/deploy-lambdas.sh
```

Expected Lambdas:
- ✅ `payment-processor` (triggered by `payment-processing-queue`)
- ✅ `webhook-sender` (triggered by `payment-webhook-queue`)

## Testing Steps

### Step 1: Start the Temporal Worker

In a **new terminal**, start the Temporal worker:
```bash
cd /Users/victor/Documents/payment-system-assessment
npm run start:worker
```

**Expected Output:**
```
[TemporalWorker] Starting Temporal Worker...
[TemporalWorker] Temporal Worker started successfully
[TemporalWorker] Task Queue: payment-processing
[TemporalWorker] Namespace: default
```

**Keep this terminal running** - the worker must be active to execute workflows.

### Step 2: Start the NestJS Application

In **another terminal**, start the NestJS app (it should already be running from npm run start:dev):
```bash
cd /Users/victor/Documents/payment-system-assessment
npm run start:dev
```

**Expected Output:**
```
[Nest] [SnsService] SNS client initialized successfully
[Nest] [SnsService] Topic ARN: arn:aws:sns:us-east-1:000000000000:payment-events
[Nest] [TemporalClientService] Temporal client initialized successfully
[Nest] [TemporalClientService] Address: localhost:7233
[Nest] Application is running on: http://localhost:3001
```

### Step 3: Initialize a Payment

Create a payment via API:
```bash
curl -X POST http://localhost:3001/api/v1/payments/initialize \
  -H "Content-Type: application/json" \
  -H "X-API-Key: test-merchant-api-key-123" \
  -d '{
    "merchantId": "merchant-1",
    "paymentMethodId": "pm-card-1",
    "amount": 1000,
    "currency": "USD",
    "reference": "ORDER-2024-12345",
    "description": "Test payment for workflow",
    "metadata": {
      "orderId": "12345",
      "customerId": "CUST-001"
    }
  }'
```

### Step 4: Observe the Event Flow

#### 4.1 NestJS App Logs (Terminal 1)
Watch for SNS publication:
```
[PaymentsService] ✓ Event published to SNS: payment.initiated
```

#### 4.2 Lambda Processor Logs
Check LocalStack Lambda logs:
```bash
docker logs payment-localstack 2>&1 | grep -A 10 "PaymentProcessor"
```

Expected:
```
[PaymentProcessor] Received 1 messages from SQS
[PaymentProcessor] 🚀 PAYMENT INITIATED
[PaymentProcessor] ✅ Temporal workflow started
```

#### 4.3 Temporal Worker Logs (Terminal 2)
Watch for workflow execution:
```
[PaymentActivity] Validating payment: <paymentId>
[PaymentActivity] Payment validated successfully
[PaymentActivity] Processing payment with gateway
[PaymentActivity] Payment processed successfully
[PaymentActivity] Updating payment status: completed
[PaymentActivity] Sending webhook for payment
[PaymentActivity] Webhook delivered successfully
```

#### 4.4 Temporal UI
Open http://localhost:8088 in your browser.

Navigate to:
- **Workflows** → You should see `payment-<paymentId>-<timestamp>`
- Click on the workflow to see:
  - Timeline of activities
  - Input/output of each activity
  - Current status
  - Event history

### Step 5: Query Workflow Status

Query the running workflow (replace `WORKFLOW_ID` with actual ID from logs):
```bash
# This would be done via Temporal CLI or API
# For now, use the Temporal UI at http://localhost:8088
```

### Step 6: Test Failure Scenarios

#### 6.1 Invalid Payment (Should Trigger Compensation)
```bash
curl -X POST http://localhost:3001/api/v1/payments/initialize \
  -H "Content-Type: application/json" \
  -H "X-API-Key: test-merchant-api-key-123" \
  -d '{
    "merchantId": "merchant-1",
    "paymentMethodId": "pm-card-1",
    "amount": -100,
    "currency": "USD",
    "reference": "ORDER-INVALID",
    "description": "Invalid amount test"
  }'
```

**Expected in Temporal Worker:**
```
[PaymentActivity] Validating payment
[PaymentActivity] Payment amount must be greater than zero
[PaymentActivity] Compensating payment - Reason: Payment amount must be greater than zero
[PaymentActivity] Payment status updated: failed
```

## Verification Checklist

### ✅ SNS → SQS Fan-out
- [ ] Payment event published to SNS topic
- [ ] Multiple SQS queues receive the message
- [ ] Each Lambda triggered by its respective queue

### ✅ Lambda Processing
- [ ] `payment-processor` Lambda invoked automatically
- [ ] Lambda logs show successful message processing
- [ ] Lambda starts Temporal workflow

### ✅ Temporal Workflow Execution
- [ ] Workflow appears in Temporal UI
- [ ] All activities execute in correct order:
  1. validatePayment
  2. updatePaymentStatus (processing)
  3. processPaymentWithGateway
  4. updatePaymentStatus (completed)
  5. sendWebhookNotification
- [ ] Workflow shows "Completed" status

### ✅ Fault Tolerance
- [ ] Invalid payments trigger compensation
- [ ] Failed activities retry automatically (check Temporal UI)
- [ ] Workflow maintains state through retries

### ✅ Observability
- [ ] Logs show correlation IDs
- [ ] Temporal UI displays complete workflow history
- [ ] Can query workflow status in real-time

## Troubleshooting

### Temporal Worker Not Connecting
```bash
# Check Temporal server health
docker logs payment_temporal

# Ensure worker has correct TEMPORAL_ADDRESS
echo $TEMPORAL_ADDRESS  # Should be localhost:7233
```

### Lambda Not Triggering
```bash
# Check event source mappings
docker run --rm \
  --add-host=host.docker.internal:host-gateway \
  -e AWS_ACCESS_KEY_ID=test \
  -e AWS_SECRET_ACCESS_KEY=test \
  amazon/aws-cli \
  --endpoint-url=http://host.docker.internal:4566 \
  lambda list-event-source-mappings
```

### SNS Messages Not Reaching SQS
```bash
# Check SNS subscriptions
docker run --rm \
  --add-host=host.docker.internal:host-gateway \
  -e AWS_ACCESS_KEY_ID=test \
  -e AWS_SECRET_ACCESS_KEY=test \
  amazon/aws-cli \
  --endpoint-url=http://host.docker.internal:4566 \
  sns list-subscriptions
```

### Workflow Not Starting
- Ensure `ENABLE_TEMPORAL_WORKFLOWS=true` in `.env`
- Verify Temporal client logs on NestJS startup
- Check Lambda logs for "Temporal workflow started" message

## Advanced Testing

### Test Concurrent Workflows
```bash
# Run multiple payments simultaneously
for i in {1..5}; do
  curl -X POST http://localhost:3001/api/v1/payments/initialize \
    -H "Content-Type: application/json" \
    -H "X-API-Key: test-merchant-api-key-123" \
    -d "{
      \"merchantId\": \"merchant-1\",
      \"paymentMethodId\": \"pm-card-1\",
      \"amount\": $((100 + i * 10)),
      \"currency\": \"USD\",
      \"reference\": \"ORDER-$i\",
      \"description\": \"Concurrent test $i\"
    }" &
done
wait
```

Check Temporal UI for 5 concurrent workflows.

### Test Workflow Signals (Future)
```bash
# Cancel a running workflow (requires implementation)
# temporal workflow signal --workflow-id <WORKFLOW_ID> --name cancelPayment
```

## Success Criteria

Phase 4 is complete when:
1. ✅ Payment request → SNS → SQS → Lambda → Temporal workflow (full flow works)
2. ✅ Temporal Worker executes all activities successfully
3. ✅ Invalid payments trigger compensation logic
4. ✅ Workflow state visible in Temporal UI
5. ✅ No errors in any service logs
6. ✅ Old SQS consumer disabled (no "QueueDoesNotExist" errors)

## Next Steps

Potential enhancements:
- Integrate real payment gateway in activities
- Add database persistence in activities
- Implement webhook retry with exponential backoff
- Add Temporal workflow versioning
- Set up Temporal Cloud for production
- Add monitoring with Prometheus/Grafana
- Implement saga compensation for complex scenarios

