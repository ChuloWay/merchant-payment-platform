#!/bin/bash

echo "🧪 Quick Payment System Test"
echo "================================"
echo ""

# Get credentials
echo "📋 Getting credentials from database..."
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
      "customerName": "Quick Test User",
      "customerEmail": "test@example.com",
      "description": "Quick test payment"
    }
  }')

echo "$RESPONSE" | jq .

PAYMENT_ID=$(echo $RESPONSE | jq -r '.data.id')
REFERENCE=$(echo $RESPONSE | jq -r '.data.reference')

echo ""
echo "✅ Payment Created!"
echo "   ID: $PAYMENT_ID"
echo "   Reference: $REFERENCE"
echo ""
echo "⏳ Waiting 5 seconds for workflow to complete..."
sleep 5
echo ""
echo "🔍 Checking workflow execution in worker logs..."
tail -50 worker.log | grep -A 2 "$PAYMENT_ID" | head -10
echo ""
echo "🌐 View in Temporal UI: http://localhost:8088"
echo "   1. Select namespace: default"
echo "   2. Look for workflow: payment-$PAYMENT_ID-*"
echo "   3. Click on it to see complete execution timeline"
echo ""
echo "📊 View in Swagger: http://localhost:3001/api/v1/docs"
echo "   Use GET /payments/{reference} with reference: $REFERENCE"
echo ""

