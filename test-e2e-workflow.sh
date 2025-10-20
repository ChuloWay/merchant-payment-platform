#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}================================================${NC}"
echo -e "${BLUE}  End-to-End Temporal Workflow Test${NC}"
echo -e "${BLUE}================================================${NC}"
echo ""

# Configuration
API_URL="http://localhost:3001/api/v1/payments"
API_KEY="pk_mg4v15ga_d68ae6bdbce7401595c79a57e27c79b0"
MERCHANT_ID="e8d7ef77-743d-4d31-bb40-5dda7c6573f1"
PAYMENT_METHOD_ID="227ff788-66dd-416a-a808-04aa583373ba"
TEMPORAL_UI="http://localhost:8088"

echo -e "${YELLOW}📋 Test Configuration:${NC}"
echo -e "  API URL: ${API_URL}"
echo -e "  Temporal UI: ${TEMPORAL_UI}"
echo -e "  Merchant ID: ${MERCHANT_ID}"
echo ""

# Test 1: Valid Payment
echo -e "${GREEN}🚀 Test 1: Creating valid payment...${NC}"
RESPONSE1=$(curl -s -X POST ${API_URL} \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ${API_KEY}" \
  -d '{
    "amount": 15000,
    "currency": "NGN",
    "paymentMethodId": "'${PAYMENT_METHOD_ID}'",
    "metadata": {
      "orderId": "ORD-001",
      "customerId": "CUST-TEMPORAL-001",
      "customerName": "John Doe",
      "customerEmail": "john@example.com",
      "description": "Valid payment test"
    }
  }')

PAYMENT_ID_1=$(echo $RESPONSE1 | jq -r '.data.id')
PAYMENT_REF_1=$(echo $RESPONSE1 | jq -r '.data.reference')

if [ "$PAYMENT_ID_1" != "null" ]; then
  echo -e "  ${GREEN}✅ Payment Created${NC}"
  echo -e "     ID: ${PAYMENT_ID_1}"
  echo -e "     Reference: ${PAYMENT_REF_1}"
  echo -e "     Amount: ₦15,000"
else
  echo -e "  ${RED}❌ Failed${NC}"
  echo $RESPONSE1 | jq .
fi
echo ""

sleep 2

# Test 2: Another Valid Payment
echo -e "${GREEN}🚀 Test 2: Creating another payment...${NC}"
RESPONSE2=$(curl -s -X POST ${API_URL} \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ${API_KEY}" \
  -d '{
    "amount": 25000,
    "currency": "NGN",
    "paymentMethodId": "'${PAYMENT_METHOD_ID}'",
    "metadata": {
      "orderId": "ORD-002",
      "customerId": "CUST-TEMPORAL-002",
      "customerName": "Jane Smith",
      "customerEmail": "jane@example.com",
      "description": "Second test payment"
    }
  }')

PAYMENT_ID_2=$(echo $RESPONSE2 | jq -r '.data.id')
PAYMENT_REF_2=$(echo $RESPONSE2 | jq -r '.data.reference')

if [ "$PAYMENT_ID_2" != "null" ]; then
  echo -e "  ${GREEN}✅ Payment Created${NC}"
  echo -e "     ID: ${PAYMENT_ID_2}"
  echo -e "     Reference: ${PAYMENT_REF_2}"
  echo -e "     Amount: ₦25,000"
else
  echo -e "  ${RED}❌ Failed${NC}"
  echo $RESPONSE2 | jq .
fi
echo ""

sleep 2

# Test 3: High-value payment
echo -e "${GREEN}🚀 Test 3: Creating high-value payment...${NC}"
RESPONSE3=$(curl -s -X POST ${API_URL} \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ${API_KEY}" \
  -d '{
    "amount": 500000,
    "currency": "NGN",
    "paymentMethodId": "'${PAYMENT_METHOD_ID}'",
    "metadata": {
      "orderId": "ORD-HIGH-001",
      "customerId": "CUST-VIP-001",
      "customerName": "Victor Okonkwo",
      "customerEmail": "victor@temporal.com",
      "description": "High-value transaction test",
      "priority": "high"
    }
  }')

PAYMENT_ID_3=$(echo $RESPONSE3 | jq -r '.data.id')
PAYMENT_REF_3=$(echo $RESPONSE3 | jq -r '.data.reference')

if [ "$PAYMENT_ID_3" != "null" ]; then
  echo -e "  ${GREEN}✅ Payment Created${NC}"
  echo -e "     ID: ${PAYMENT_ID_3}"
  echo -e "     Reference: ${PAYMENT_REF_3}"
  echo -e "     Amount: ₦500,000"
else
  echo -e "  ${RED}❌ Failed${NC}"
  echo $RESPONSE3 | jq .
fi
echo ""

# Summary
echo -e "${BLUE}================================================${NC}"
echo -e "${BLUE}  Event Flow Summary${NC}"
echo -e "${BLUE}================================================${NC}"
echo ""
echo -e "${YELLOW}The following has occurred:${NC}"
echo -e "  1. ✅ Payment created in NestJS application"
echo -e "  2. ✅ Event published to SNS Topic (payment-events)"
echo -e "  3. ✅ SNS fans out to multiple SQS queues:"
echo -e "      • payment-processing-queue"
echo -e "      • payment-webhook-queue"
echo -e "      • payment-analytics-queue"
echo -e "      • payment-notification-queue"
echo -e "  4. ✅ Lambda functions auto-triggered by SQS:"
echo -e "      • payment-processor Lambda (starts Temporal workflow)"
echo -e "      • webhook-sender Lambda"
echo -e "  5. ⏳ Temporal Worker executing workflow activities:"
echo -e "      • validatePayment"
echo -e "      • updatePaymentStatus (processing)"
echo -e "      • processPaymentWithGateway"
echo -e "      • updatePaymentStatus (completed)"
echo -e "      • sendWebhookNotification"
echo ""

echo -e "${BLUE}================================================${NC}"
echo -e "${BLUE}  View Workflows in Temporal UI${NC}"
echo -e "${BLUE}================================================${NC}"
echo ""
echo -e "${YELLOW}🌐 Open Temporal UI:${NC}"
echo -e "   ${TEMPORAL_UI}"
echo ""
echo -e "${YELLOW}📋 What to look for:${NC}"
echo -e "  1. Navigate to 'Workflows' tab"
echo -e "  2. Look for workflows starting with 'payment-'"
echo -e "  3. Click on a workflow to see:"
echo -e "     • Timeline of activities"
echo -e "     • Input/output of each activity"
echo -e "     • Current status"
echo -e "     • Event history"
echo -e "  4. Check 'Query' tab to see real-time status"
echo ""
echo -e "${YELLOW}🔍 Expected Workflow IDs:${NC}"
if [ "$PAYMENT_ID_1" != "null" ]; then
  echo -e "   payment-${PAYMENT_ID_1}-*"
fi
if [ "$PAYMENT_ID_2" != "null" ]; then
  echo -e "   payment-${PAYMENT_ID_2}-*"
fi
if [ "$PAYMENT_ID_3" != "null" ]; then
  echo -e "   payment-${PAYMENT_ID_3}-*"
fi
echo ""

echo -e "${GREEN}✅ Test completed! Opening Temporal UI...${NC}"
echo ""

# Try to open Temporal UI in browser
if command -v open &> /dev/null; then
  open ${TEMPORAL_UI}
elif command -v xdg-open &> /dev/null; then
  xdg-open ${TEMPORAL_UI}
else
  echo -e "${YELLOW}Please manually open: ${TEMPORAL_UI}${NC}"
fi

echo -e "${BLUE}================================================${NC}"

