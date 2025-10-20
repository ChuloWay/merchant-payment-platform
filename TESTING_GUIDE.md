# 🧪 Complete Testing Guide

## 🚀 Quick Start - How to Run Everything

### Prerequisites
- Docker & Docker Compose
- Node.js 18+
- PostgreSQL (via Docker)

### Step 1: Start Infrastructure Services

```bash
# Start all Docker services (PostgreSQL, Redis, LocalStack, Temporal)
docker-compose up -d

# Wait 10 seconds for services to be healthy
sleep 10

# Check all services are running
docker-compose ps
```

**Expected output:**
```
NAME                    STATUS
payment_localstack      Up (healthy)
payment_system_db       Up (healthy)
payment_system_redis    Up (healthy)
payment_temporal        Up (healthy)
payment_temporal_ui     Up
```

### Step 2: Initialize AWS Resources (SNS/SQS/Lambda)

```bash
# Run LocalStack setup to create SNS topics, SQS queues
bash scripts/localstack-setup.sh

# Deploy Lambda functions
bash scripts/deploy-lambdas.sh
```

### Step 3: Run Database Migrations & Seeds

```bash
# Run migrations to create tables
npm run migration:run

# Seed database with test merchants and payment methods
npm run seed
```

### Step 4: Start NestJS Application

```bash
# Start in development mode with auto-reload
npm run start:dev
```

**Expected output:**
```
[Nest] LOG [SqsService] SQS client initialized successfully
[Nest] LOG [SnsService] SNS client initialized successfully
[Nest] LOG [TemporalClientService] Temporal client initialized successfully
[Nest] LOG [TemporalClientService] Address: localhost:7233
[Nest] LOG [TemporalClientService] Namespace: default
[Nest] LOG [TemporalClientService] Task Queue: payment-processing
[Nest] LOG [NestApplication] Nest application successfully started
[Nest] LOG [Bootstrap] 🚀 Application is running on: http://localhost:3001/api/v1
[Nest] LOG [Bootstrap] 📚 API Documentation: http://localhost:3001/api/v1/docs
```

### Step 5: Start Temporal Worker

```bash
# Open a new terminal and run:
npm run start:worker
```

**Expected output:**
```
[Nest] LOG [TemporalWorker] Temporal Worker started successfully
[Nest] LOG [TemporalWorker] Task Queue: payment-processing
[Nest] LOG [TemporalWorker] Namespace: default
[INFO] Worker state changed { state: 'RUNNING' }
```

---

## 📚 Access Points

| Service | URL | Description |
|---------|-----|-------------|
| **Swagger API Docs** | http://localhost:3001/api/v1/docs | Interactive API documentation |
| **Health Check** | http://localhost:3001/api/v1/health | Application health status |
| **Temporal UI** | http://localhost:8088 | Workflow execution dashboard |
| **PostgreSQL** | localhost:5433 | Database (user: postgres, password: password) |

---

## 🧪 Complete Testing Flow

### Flow 1: Create Payment with Temporal Workflow

#### Step 1: Get Valid Credentials

```bash
# Get a valid API key and payment method ID from the database
docker exec payment_system_db psql -U postgres -d payment_system -c \
  'SELECT "apiKey", id as merchant_id FROM merchants LIMIT 1;'

docker exec payment_system_db psql -U postgres -d payment_system -c \
  'SELECT id FROM payment_methods LIMIT 1;'
```

**Example output:**
```
apiKey: pk_mg4v15ga_d68ae6bdbce7401595c79a57e27c79b0
merchant_id: e8d7ef77-743d-4d31-bb40-5dda7c6573f1
payment_method_id: 227ff788-66dd-416a-a808-04aa583373ba
```

#### Step 2: Create Payment via API

```bash
curl -X POST http://localhost:3001/api/v1/payments \
  -H "Content-Type: application/json" \
  -H "X-API-Key: pk_mg4v15ga_d68ae6bdbce7401595c79a57e27c79b0" \
  -d '{
    "amount": 50000,
    "currency": "NGN",
    "paymentMethodId": "227ff788-66dd-416a-a808-04aa583373ba",
    "metadata": {
      "orderId": "ORD-'$(date +%s)'",
      "customerId": "CUST-001",
      "customerName": "John Doe",
      "customerEmail": "john@example.com",
      "description": "Test Payment"
    }
  }' | jq .
```

**Expected Response:**
```json
{
  "statusCode": 201,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "reference": "PAY-MGZ0VNLB-A3AD3D73",
    "amount": 50000,
    "currency": "NGN",
    "status": "pending",
    "merchantId": "e8d7ef77-743d-4d31-bb40-5dda7c6573f1",
    "paymentMethodId": "227ff788-66dd-416a-a808-04aa583373ba",
    "createdAt": "2025-10-20T10:58:40.656Z"
  },
  "message": "Payment initialized successfully"
}
```

#### Step 3: Verify Complete Flow

1. **Check NestJS Logs:**
   ```bash
   tail -f app.log | grep "Temporal workflow"
   ```
   Expected: `✓ Temporal workflow started: payment-{id}`

2. **Check Temporal Worker Logs:**
   ```bash
   tail -f worker.log | grep "PaymentActivity"
   ```
   Expected:
   ```
   [PaymentActivity] Validating payment: {id}
   [PaymentActivity] Payment validated successfully: {id}
   [PaymentActivity] Processing payment with gateway: {id}
   [PaymentActivity] Payment processed successfully: {id} -> txn_...
   [PaymentActivity] Webhook delivered successfully: {id}
   ```

3. **Check Temporal UI:**
   - Open: http://localhost:8088
   - Select namespace: **default** (top-left dropdown)
   - You should see your workflow: `payment-{id}-{uuid}`
   - Click on it to see complete execution timeline

---

## 🌐 Using Swagger UI (Recommended)

### Step 1: Open Swagger
Open browser: **http://localhost:3001/api/v1/docs**

### Step 2: Authenticate
1. Click **"Authorize"** button (top-right with lock icon)
2. Enter API Key: `pk_mg4v15ga_d68ae6bdbce7401595c79a57e27c79b0`
3. Click **"Authorize"** then **"Close"**

### Step 3: Test Endpoints

#### 1. Health Check
- Expand **GET /health**
- Click **"Try it out"**
- Click **"Execute"**
- Should return: `{ "status": "ok" }`

#### 2. Get Merchants
- Expand **GET /merchants**
- Click **"Try it out"**
- Click **"Execute"**
- View available merchants

#### 3. Create Payment (Main Flow)
- Expand **POST /payments**
- Click **"Try it out"**
- Modify the JSON payload:

```json
{
  "amount": 75000,
  "currency": "NGN",
  "paymentMethodId": "227ff788-66dd-416a-a808-04aa583373ba",
  "metadata": {
    "orderId": "ORD-SWAGGER-001",
    "customerId": "CUST-SWAGGER",
    "customerName": "Swagger Test User",
    "customerEmail": "swagger@test.com",
    "description": "Payment created via Swagger UI"
  }
}
```

- Click **"Execute"**
- Copy the `reference` from the response

#### 4. Get Payment Details
- Expand **GET /payments/{reference}**
- Click **"Try it out"**
- Paste the reference (e.g., `PAY-MGZ0VNLB-A3AD3D73`)
- Click **"Execute"**
- View payment details and status

---

## 📊 Understanding the Flow

When you create a payment, here's what happens:

```
1. API Request
   └─→ PaymentsController.create()

2. PaymentsService.initializePayment()
   ├─→ Save payment to PostgreSQL
   ├─→ Publish event to SNS (for analytics, notifications)
   └─→ Start Temporal Workflow ✨

3. Temporal Worker Executes Activities:
   ├─→ validatePayment()          [validates payment data]
   ├─→ updatePaymentStatus()       [sets status to "processing"]
   ├─→ processPaymentWithGateway() [calls payment gateway]
   ├─→ updatePaymentStatus()       [sets status to "completed"]
   └─→ sendWebhookNotification()   [sends webhook to merchant]

4. Result:
   └─→ Payment processed successfully with audit trail in Temporal UI
```

---

## 🔍 Monitoring & Debugging

### View All Payments in Database
```bash
docker exec payment_system_db psql -U postgres -d payment_system -c \
  'SELECT reference, amount, status, "createdAt" FROM payments ORDER BY "createdAt" DESC LIMIT 10;'
```

### View NestJS Logs
```bash
tail -f app.log
```

### View Temporal Worker Logs
```bash
tail -f worker.log
```

### View SNS/SQS Messages
```bash
# Check SNS topics
docker run --rm \
  --add-host=host.docker.internal:host-gateway \
  -e AWS_ACCESS_KEY_ID=test \
  -e AWS_SECRET_ACCESS_KEY=test \
  -e AWS_DEFAULT_REGION=us-east-1 \
  amazon/aws-cli \
  --endpoint-url=http://host.docker.internal:4566 \
  sns list-topics

# Check SQS queue attributes
docker run --rm \
  --add-host=host.docker.internal:host-gateway \
  -e AWS_ACCESS_KEY_ID=test \
  -e AWS_SECRET_ACCESS_KEY=test \
  -e AWS_DEFAULT_REGION=us-east-1 \
  amazon/aws-cli \
  --endpoint-url=http://host.docker.internal:4566 \
  sqs get-queue-attributes \
  --queue-url http://localhost:4566/000000000000/payment-processing-queue \
  --attribute-names All
```

### View Temporal Workflows
```bash
# List recent workflows
docker exec payment_temporal tctl workflow list --namespace default
```

---

## 🧹 Cleanup

### Stop All Services
```bash
# Stop NestJS app (Ctrl+C in the terminal)
# Stop Temporal worker (Ctrl+C in the terminal)

# Stop Docker services
docker-compose down

# Remove volumes (if you want to start fresh)
docker-compose down -v
```

---

## 🎯 Quick Test Script

Save this as `quick-test.sh`:

```bash
#!/bin/bash

echo "🧪 Quick Payment System Test"
echo "================================"

# Get credentials
API_KEY=$(docker exec payment_system_db psql -U postgres -d payment_system -t -c 'SELECT "apiKey" FROM merchants LIMIT 1;' | xargs)
PAYMENT_METHOD=$(docker exec payment_system_db psql -U postgres -d payment_system -t -c 'SELECT id FROM payment_methods LIMIT 1;' | xargs)

echo "✓ API Key: $API_KEY"
echo "✓ Payment Method: $PAYMENT_METHOD"
echo ""

# Create payment
echo "🚀 Creating payment..."
RESPONSE=$(curl -s -X POST http://localhost:3001/api/v1/payments \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $API_KEY" \
  -d '{
    "amount": 100000,
    "currency": "NGN",
    "paymentMethodId": "'"$PAYMENT_METHOD"'",
    "metadata": {
      "orderId": "ORD-QUICK-'$(date +%s)'",
      "customerId": "CUST-TEST",
      "customerName": "Quick Test",
      "customerEmail": "test@example.com",
      "description": "Quick test payment"
    }
  }')

PAYMENT_ID=$(echo $RESPONSE | jq -r '.data.id')
REFERENCE=$(echo $RESPONSE | jq -r '.data.reference')

echo "✅ Payment Created!"
echo "   ID: $PAYMENT_ID"
echo "   Reference: $REFERENCE"
echo ""
echo "🌐 Check Temporal UI: http://localhost:8088"
echo "   Select namespace: default"
echo "   Look for workflow: payment-$PAYMENT_ID-*"
```

Make it executable and run:
```bash
chmod +x quick-test.sh
./quick-test.sh
```

---

## 🎓 Tips

1. **Always check Temporal UI** - It's the best way to see what's happening in your workflows
2. **Use Swagger for testing** - Much easier than curl commands
3. **Monitor both logs** - Watch both `app.log` and `worker.log` to see the complete flow
4. **Database is your source of truth** - Check payment status in PostgreSQL if unsure
5. **SNS publishes to multiple queues** - The event goes to both processing and webhook queues

---

## ❓ Troubleshooting

### Payment created but workflow not starting
- Check: `tail -f app.log | grep "Temporal"`
- Ensure: `ENABLE_TEMPORAL_WORKFLOWS=true` in `.env`
- Verify: Temporal Worker is running

### Worker not executing activities
- Check: Worker logs `tail -f worker.log`
- Verify: Worker is connected to Temporal server
- Ensure: Task queue name matches (`payment-processing`)

### Can't see workflow in Temporal UI
- Ensure: You selected the correct namespace (**default**)
- Refresh: The UI page
- Check: Worker logs for any errors

---

## 🎉 You're Ready!

Start testing and watch your payments flow through the system with full observability in Temporal UI! 🚀

