# Payment System Assessment

High-performance payment processing system for Nigerian market with AWS SQS integration.

## 🚀 Features

- **Nigerian Market Focus**: NGN currency, local business examples
- **Event-Driven Architecture**: AWS SQS integration for payment events
- **ACID Compliance**: Database transactions and proper error handling
- **Type Safety**: Strict TypeScript with comprehensive validation
- **Security**: API key authentication and input validation
- **Observability**: Structured logging and correlation tracking
- **Documentation**: Comprehensive Swagger/OpenAPI documentation

## 🏗️ Architecture

```
┌─────────────────┐     ┌──────────────┐     ┌─────────────┐
│   API Gateway   │────▶│   NestJS     │────▶│ PostgreSQL  │
│  (Auth + Rate)  │     │  Monolith    │     │   (ACID)    │
└─────────────────┘     └───────┬──────┘     └─────────────┘
                                │
                                ▼
                        ┌───────────────┐
                        │   AWS SQS     │
                        │ payment-events│
                        └───────┬───────┘
                                │
                                ▼
                        ┌───────────────┐
                        │ Event Consumer│
                        │  (Background) │
                        └───────────────┘
```

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL 15+
- Docker & Docker Compose (optional)

### 1. Install Dependencies

```bash
npm install
```

### 2. Setup Environment

```bash
cp .env.example .env
# Update .env with your configuration
```

### 3. Setup Database

```bash
# Using Docker Compose
docker-compose up -d postgres

# Or setup PostgreSQL manually
createdb payment_system
```

### 4. Run Migrations

```bash
npm run migration:run
```

### 5. Seed Database (Optional)

```bash
npm run seed
```

### 6. Start Development Server

```bash
npm run start:dev
```

### 7. Access API Documentation

```
http://localhost:3000/api/docs
```

## 📚 API Endpoints

### Merchants
- `POST /api/v1/merchants` - Create merchant
- `GET /api/v1/merchants` - List merchants
- `GET /api/v1/merchants/:id` - Get merchant

### Payment Methods
- `POST /api/v1/payment-methods` - Create payment method
- `GET /api/v1/payment-methods` - List payment methods
- `GET /api/v1/payment-methods/:id` - Get payment method
- `DELETE /api/v1/payment-methods/:id` - Deactivate payment method

### Payments
- `POST /api/v1/payments` - Initialize payment
- `GET /api/v1/payments/:id` - Get payment by ID
- `GET /api/v1/payments/reference/:reference` - Get payment by reference
- `GET /api/v1/payments` - List merchant payments

### Webhooks
- `POST /api/v1/webhooks/payment-gateway` - Payment gateway webhook

## 🔐 Authentication

All payment-related endpoints require API key authentication:

```bash
curl -H "X-API-Key: your_api_key" \
     -H "Content-Type: application/json" \
     http://localhost:3000/api/v1/payments
```

## 🧪 Testing

```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Test coverage
npm run test:cov
```

## 🐳 Docker

```bash
# Build and run with Docker Compose
docker-compose up --build

# Run database only
docker-compose up postgres redis
```

## 📊 Database Schema

### Merchants
- `id` (UUID, Primary Key)
- `name` (VARCHAR)
- `email` (VARCHAR, Unique)
- `apiKey` (VARCHAR, Unique)
- `webhookUrl` (VARCHAR)
- `isActive` (BOOLEAN)

### Payment Methods
- `id` (UUID, Primary Key)
- `type` (ENUM: card, bank_transfer, wallet, ussd, bank_account)
- `provider` (VARCHAR)
- `lastFour` (VARCHAR)
- `bankCode` (VARCHAR)
- `bankName` (VARCHAR)
- `merchantId` (UUID, Foreign Key)
- `isActive` (BOOLEAN)
- `metadata` (JSONB)

### Payments
- `id` (UUID, Primary Key)
- `reference` (VARCHAR, Unique)
- `amount` (DECIMAL)
- `currency` (VARCHAR, Default: NGN)
- `status` (ENUM: pending, processing, completed, failed, cancelled, refunded)
- `merchantId` (UUID, Foreign Key)
- `paymentMethodId` (UUID, Foreign Key)
- `gatewayReference` (VARCHAR)
- `failureReason` (VARCHAR)
- `metadata` (JSONB)
- `initiatedAt` (TIMESTAMP)
- `completedAt` (TIMESTAMP)

## 🔄 Event Flow

1. **Payment Initialization**
   - Client calls `POST /api/v1/payments`
   - Payment created with `pending` status
   - `payment-initiated` event published to SQS

2. **Payment Processing**
   - External payment gateway processes payment
   - Gateway sends webhook to `POST /api/v1/webhooks/payment-gateway`
   - Payment status updated
   - `payment-completed` event published to SQS

3. **Event Consumption**
   - SQS consumer processes events every 10 seconds
   - Events logged for audit and monitoring

## 🛠️ Development

### Project Structure

```
src/
├── modules/
│   ├── merchants/           # Merchant domain
│   ├── payments/            # Payment domain  
│   ├── payment-methods/     # Payment method domain
│   ├── webhooks/            # Webhook handling
│   └── events/              # Event processing
├── common/
│   ├── decorators/          # Custom decorators
│   ├── filters/             # Exception filters
│   ├── guards/              # Auth guards
│   ├── interceptors/        # Logging, transformation
│   └── pipes/               # Validation pipes
├── config/                  # Configuration
├── database/                # Migrations, seeds
└── main.ts
```

### Key Technologies

- **NestJS** - Progressive Node.js framework
- **TypeORM** - TypeScript ORM
- **PostgreSQL** - ACID-compliant database
- **AWS SQS** - Message queuing service
- **Swagger/OpenAPI** - API documentation
- **Winston** - Structured logging
- **Jest** - Testing framework

## 📝 License

MIT License