# Merchant Payment System

A comprehensive payment processing system built with NestJS, featuring merchant management, payment processing, webhook handling, and event-driven architecture with AWS SQS.

## 🚀 Features

- **Merchant Management**: Registration, API key generation, and management
- **Payment Processing**: Initialize, track, and process payments with multiple payment methods
- **Webhook System**: Secure webhook handling with HMAC signature validation
- **Event-Driven Architecture**: AWS SQS integration for asynchronous payment events
- **Comprehensive Testing**: 224 unit tests + 74 E2E tests with 100% pass rate
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
- **Documentation**: Swagger/OpenAPI
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

## 📚 API Documentation

Once the application is running, visit:
- **Swagger UI**: `http://localhost:3000/api/v1/docs`
- **Health Check**: `http://localhost:3000/api/v1/health`

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