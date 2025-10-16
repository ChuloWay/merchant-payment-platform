# Merchant Payment System

A comprehensive payment processing system built with NestJS, featuring merchant management, payment processing, webhook handling, and event-driven architecture with AWS SQS.

## 🚀 Features

- **Merchant Management**: Registration, API key generation, and management
- **Payment Processing**: Initialize, track, and process payments with multiple payment methods
- **Webhook System**: Secure webhook handling with HMAC signature validation
- **Event-Driven Architecture**: AWS SQS integration for asynchronous payment events
- **Comprehensive Testing**: 224 unit tests + 74 E2E tests with 100% pass rate
- **Interactive Documentation**: Full Swagger/OpenAPI documentation with live testing
- **Security**: API key authentication, input validation, and secure webhook processing
- **Database**: PostgreSQL with TypeORM, migrations, and proper indexing

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Merchants     │    │    Payments     │    │  Payment Methods│
│   Module        │    │    Module       │    │     Module      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌─────────────────┐
                    │   Webhooks      │
                    │   Module        │
                    └─────────────────┘
                                 │
                    ┌─────────────────┐
                    │   Events        │
                    │   Module        │
                    │   (SQS)         │
                    └─────────────────┘
```

## 🛠️ Tech Stack

- **Framework**: NestJS (Node.js)
- **Database**: PostgreSQL with TypeORM
- **Queue**: AWS SQS (Standard Queue)
- **Authentication**: API Key-based
- **Validation**: Class-validator with DTOs
- **Testing**: Jest with Supertest
- **Documentation**: Comprehensive Swagger/OpenAPI with interactive UI
- **Logging**: Winston
- **Security**: Helmet, CORS, HMAC validation

## 📋 Prerequisites

- Node.js 18+
- PostgreSQL 13+
- AWS Account (for SQS)
- Docker (optional)

## 🚀 Quick Start

### 1. Clone and Install

```bash
git clone https://github.com/ChuloWay/merchant-payment-platform.git
cd merchant-payment-platform
npm install
```

### 2. Environment Setup

Copy the example environment file and configure:

```bash
cp env.example .env
```

Update `.env` with your configuration:

```env
# Database
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=password
DB_DATABASE=payment_system

# AWS SQS
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
SQS_QUEUE_URL=your_queue_url

# Application
PORT=3000
API_PREFIX=api/v1
WEBHOOK_SECRET=your_webhook_secret
```

### 3. Database Setup

```bash
# Run migrations
npm run migration:run

# (Optional) Seed sample data
npm run seed
```

### 4. Start the Application

```bash
# Development
npm run start:dev

# Production
npm run build
npm run start:prod
```

The API will be available at `http://localhost:3000/api/v1`

> **💡 Pro Tip**: Visit `http://localhost:3000/api/v1/docs` to explore the interactive Swagger documentation and test endpoints directly in your browser!

## 📚 API Documentation

### 🔍 **Interactive Swagger Documentation**

The API includes comprehensive, interactive documentation powered by Swagger/OpenAPI:

- **📖 Swagger UI**: `http://localhost:3000/api/v1/docs` - Interactive API explorer
- **🔧 OpenAPI JSON**: `http://localhost:3000/api/v1/docs-json` - Machine-readable API spec
- **❤️ Health Check**: `http://localhost:3000/api/v1/health` - Service health status

### ✨ **Documentation Features**

- **Complete API Coverage**: All 9 endpoints fully documented
- **Request/Response Examples**: Real-world examples for Nigerian market
- **Authentication Guide**: API key setup and usage
- **Interactive Testing**: Try endpoints directly from the browser
- **Schema Validation**: Detailed DTOs with validation rules
- **Error Responses**: Comprehensive error code documentation

## 🔑 API Usage

### 1. Create a Merchant

```bash
curl -X POST http://localhost:3000/api/v1/merchants \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Lagos Tech Solutions Ltd",
    "email": "contact@lagostech.com.ng",
    "webhookUrl": "https://api.lagostech.com.ng/webhooks/payments"
  }'
```

### 2. Add Payment Method

```bash
curl -X POST http://localhost:3000/api/v1/payment-methods \
  -H "Content-Type: application/json" \
  -H "X-API-Key: pk_your_api_key_here" \
  -d '{
    "type": "card",
    "lastFour": "1234",
    "metadata": {
      "cardNumber": "4111111111111111",
      "expiryMonth": "12",
      "expiryYear": "2025",
      "cvv": "123",
      "cardholderName": "John Doe"
    }
  }'
```

### 3. Initialize Payment

```bash
curl -X POST http://localhost:3000/api/v1/payments \
  -H "Content-Type: application/json" \
  -H "X-API-Key: pk_your_api_key_here" \
  -d '{
    "amount": 2500000,
    "currency": "NGN",
    "paymentMethodId": "payment_method_uuid",
    "metadata": {
      "customerId": "CUST-123",
      "orderId": "ORDER-456"
    }
  }'
```

### 4. Process Webhook

```bash
curl -X POST http://localhost:3000/api/v1/webhooks/payment-gateway \
  -H "Content-Type: application/json" \
  -H "X-Signature: sha256=your_hmac_signature" \
  -d '{
    "reference": "PAY-123456789",
    "status": "completed",
    "gatewayReference": "paystack_ref_123456",
    "metadata": {
      "processor": "paystack"
    }
  }'
```

## 🔧 Webhook Mocking & Testing

### Understanding Webhook Signatures

In production, payment gateways (Paystack, Flutterwave) automatically generate and send webhooks with HMAC-SHA256 signatures. For testing and demos, you need to manually simulate this process.

### How Webhook Signatures Work

1. **Payment Gateway** processes payment and generates signature using shared secret
2. **Gateway** sends webhook with signature in `X-Webhook-Signature` header
3. **Your System** validates signature using the same secret
4. **If Valid**: Process webhook and update payment status

### Mocking Webhooks for Testing

#### Step 1: Create a Payment
```bash
curl -X POST http://localhost:3000/api/v1/payments \
  -H "Content-Type: application/json" \
  -H "X-API-Key: pk_your_api_key_here" \
  -d '{
    "amount": 50000,
    "currency": "NGN",
    "paymentMethodId": "payment_method_uuid",
    "metadata": {
      "orderId": "ORDER-123"
    }
  }'

# Response includes payment reference
{
  "data": {
    "reference": "PAY-MG4V5M0I-91729641",
    "status": "pending"
  }
}
```

#### Step 2: Generate Correct Signature
```bash
# Generate signature for your specific payload
node -e "
const crypto = require('crypto');
const payload = JSON.stringify({
  'reference': 'PAY-MG514QDK-7C233A6C',
  'status': 'completed',
  'gatewayReference': null
});
const signature = crypto.createHmac('sha256', 'test-webhook-secret').update(payload).digest('hex');
console.log('Use this signature: sha256=' + signature);
"
```

#### Step 3: Send Webhook with Signature
```bash
curl -X POST http://localhost:3000/api/v1/webhooks/payment-gateway \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Signature: sha256=generated_signature_here" \
  -d '{
    "reference": "PAY-MG4V5M0I-91729641",
    "status": "completed",
    "gatewayReference": "paystack_ref_123456"
  }'
```

### Using Swagger UI for Webhook Testing

1. **Open Swagger UI**: `http://localhost:3000/api/v1/docs`
2. **Navigate to**: Webhooks → `POST /webhooks/payment-gateway`
3. **Headers**:
   - `x-webhook-signature`: Use the generated signature from Step 2
4. **Request Body**:
```json
{
  "reference": "PAY-MG4V5M0I-91729641",
  "status": "completed",
  "gatewayReference": "paystack_ref_123456"
}
```

### Webhook Testing Scenarios

#### Payment Completion
```bash
curl -X POST http://localhost:3000/api/v1/webhooks/payment-gateway \
  -H "Content-Type: application/json" \
  -d '{
    "reference": "PAY-MG4V5M0I-91729641",
    "status": "completed",
    "gatewayReference": "paystack_ref_123456"
  }'
```

#### Payment Failure
```bash
curl -X POST http://localhost:3000/api/v1/webhooks/payment-gateway \
  -H "Content-Type: application/json" \
  -d '{
    "reference": "PAY-MG4V5M0I-91729641",
    "status": "failed",
    "failureReason": "Insufficient funds"
  }'
```

#### Payment Cancellation
```bash
curl -X POST http://localhost:3000/api/v1/webhooks/payment-gateway \
  -H "Content-Type: application/json" \
  -d '{
    "reference": "PAY-MG4V5M0I-91729641",
    "status": "cancelled"
  }'
```

#### Payment Refund
```bash
curl -X POST http://localhost:3000/api/v1/webhooks/payment-gateway \
  -H "Content-Type: application/json" \
  -d '{
    "reference": "PAY-MG4V5M0I-91729641",
    "status": "refunded",
    "gatewayReference": "refund_ref_123"
  }'
```

### Signature Generation Details

#### Why Each Webhook Needs Its Own Signature
- **HMAC-SHA256** is deterministic but sensitive to input
- **Any difference** in payload (spaces, field order) = different signature
- **Each webhook** has unique payload = unique signature

#### Signature Generation Process
```javascript
const crypto = require('crypto');
const webhookSecret = 'test-webhook-secret'; // From .env
const payload = JSON.stringify(webhookData); // Exact payload format
const signature = crypto
  .createHmac('sha256', webhookSecret)
  .update(payload)
  .digest('hex');
```

#### Common Signature Issues
- **Wrong payload format**: Pretty JSON vs minified JSON
- **Missing fields**: Payload must match exactly
- **Wrong secret**: Must use same secret as system expects

### Production vs Testing

#### In Production (Automatic)
- ✅ Payment gateways generate signatures automatically
- ✅ Gateways send webhooks automatically
- ✅ Your system validates automatically
- ✅ Everything is automated

#### For Testing (Manual)
- 🔧 You generate signatures manually
- 🔧 You send webhooks manually
- 🔧 You simulate gateway behavior
- 🔧 Perfect for demos and testing

### Environment Configuration

```env
# Webhook secret for signature validation
WEBHOOK_SECRET=test-webhook-secret

# For production, use your actual gateway webhook secret
# WEBHOOK_SECRET=sk_test_your_actual_webhook_secret_here
```

### Troubleshooting Webhook Issues

#### "Invalid webhook signature" Error
1. **Check payload format**: Must be exact JSON.stringify() format
2. **Verify secret**: Must match WEBHOOK_SECRET in .env
3. **Generate correct signature**: Use the exact payload that will be sent

#### Debug Signature Validation
Add debug logs to see what's happening:
```typescript
console.log('Received signature:', signature);
console.log('Expected signature:', expectedSignature);
console.log('Payload:', JSON.stringify(payload));
```

#### Skip Signature Validation (Testing Only)
For testing, you can send webhooks without signatures - the system will process them but log a warning.

## 🧪 Testing

### Run All Tests

```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Test coverage
npm run test:cov
```

### Test Results

- **Unit Tests**: 224 tests covering all service methods and security scenarios
- **E2E Tests**: 74 tests covering complete payment flows and integrations
- **Coverage**: Comprehensive coverage of business logic and edge cases

## 🏗️ Project Structure

```
src/
├── common/                 # Shared utilities
│   ├── filters/           # Global exception handling
│   ├── guards/            # Authentication guards
│   ├── health/            # Health check endpoints
│   └── interceptors/      # Logging and correlation ID
├── config/                # Configuration modules
├── database/              # Database setup and migrations
└── modules/               # Feature modules
    ├── merchants/         # Merchant management
    ├── payments/          # Payment processing
    ├── payment-methods/   # Payment method management
    ├── webhooks/          # Webhook handling
    └── events/            # SQS event processing
```

## 🔒 Security Features

- **API Key Authentication**: Secure merchant authentication
- **HMAC Webhook Validation**: Tamper-proof webhook processing
- **Input Validation**: Comprehensive DTO validation
- **SQL Injection Protection**: TypeORM parameterized queries
- **CORS Configuration**: Controlled cross-origin access
- **Helmet Security**: HTTP security headers

## 📊 Event-Driven Architecture

### SQS Queue Design

**Queue Type**: Standard Queue (not FIFO)

**Rationale**: 
- Payment status updates don't require strict ordering
- Better scalability for event-driven systems
- Consumer is designed to be idempotent, handling duplicates safely

**Note**: If the requirement was to process money movements in exact order (e.g., debit/credit ledger updates), then a FIFO queue would be more appropriate.

### Event Flow

1. Payment initialized → `payment.initialized` event
2. Payment status updated → `payment.status.changed` event
3. Events published to SQS for asynchronous processing
4. Consumers process events and update related systems

### Dead Letter Queue

**Current Status**: Disabled for this assessment

**Production Note**: In a production setup, I would configure a Dead-Letter Queue to capture failed payment events for later analysis and retry mechanisms.

## 🐳 Docker Support

```bash
# Build and run with Docker Compose
docker-compose up --build

# Run database only
docker-compose up postgres
```

## 📈 Monitoring & Observability

- **Structured Logging**: Winston with correlation IDs
- **Health Checks**: Database and service health monitoring
- **Request Tracing**: Correlation ID tracking across services
- **Error Handling**: Global exception filter with detailed error responses

## 🔧 Development

### Available Scripts

```bash
npm run start:dev      # Development server with hot reload
npm run build          # Build for production
npm run lint           # Run ESLint
npm run format         # Format code with Prettier
npm run migration:run  # Run database migrations
npm run migration:generate  # Generate new migration
```

### Code Quality

- **ESLint**: Code linting and style enforcement
- **Prettier**: Code formatting
- **TypeScript**: Strict type checking
- **Jest**: Comprehensive testing framework

## 🚀 Production Considerations

1. **Environment Variables**: Secure configuration management
2. **Database**: Connection pooling and read replicas
3. **Queue**: Dead letter queues and retry policies
4. **Monitoring**: Application performance monitoring
5. **Security**: Rate limiting and API key rotation
6. **Scaling**: Horizontal scaling with load balancers

## 📝 License

This project is for assessment purposes only.

---

**Built with ❤️ using NestJS, TypeScript, and AWS SQS**