#!/bin/bash

echo "================================================"
echo "Testing SNS → SQS Fan-out Pattern"
echo "================================================"

# Helper function to run AWS CLI in Docker
aws_local() {
    docker run --rm \
        --add-host=host.docker.internal:host-gateway \
        -e AWS_ACCESS_KEY_ID=test \
        -e AWS_SECRET_ACCESS_KEY=test \
        -e AWS_DEFAULT_REGION=us-east-1 \
        amazon/aws-cli \
        --endpoint-url=http://host.docker.internal:4566 \
        "$@" 2>/dev/null
}

echo ""
echo "Step 1: Checking all 4 SQS queues..."
echo "-----------------------------------"

QUEUES=(
    "payment-processing-queue"
    "payment-webhook-queue"
    "payment-analytics-queue"
    "payment-notification-queue"
)

for queue in "${QUEUES[@]}"; do
    echo -n "Checking $queue: "
    COUNT=$(aws_local sqs get-queue-attributes \
        --queue-url "http://localhost:4566/000000000000/$queue" \
        --attribute-names ApproximateNumberOfMessages \
        --query 'Attributes.ApproximateNumberOfMessages' \
        --output text)
    echo "$COUNT messages"
done

echo ""
echo "Step 2: Reading one message from processing queue..."
echo "---------------------------------------------------"

MESSAGE=$(aws_local sqs receive-message \
    --queue-url "http://localhost:4566/000000000000/payment-processing-queue" \
    --max-number-of-messages 1 \
    --wait-time-seconds 5)

if [ -z "$MESSAGE" ] || [ "$MESSAGE" == "" ]; then
    echo "❌ No messages found in queue"
    echo ""
    echo "This is expected if no payments have been created yet."
    echo "To test:"
    echo "1. Make sure your NestJS app is running"
    echo "2. Create a payment via API"
    echo "3. Run this script again"
else
    echo "✓ Message received!"
    echo ""
    echo "Message Body:"
    echo "$MESSAGE" | python3 -m json.tool 2>/dev/null || echo "$MESSAGE"
fi

echo ""
echo "Step 3: Checking webhook queue..."
echo "---------------------------------------------------"

MESSAGE=$(aws_local sqs receive-message \
    --queue-url "http://localhost:4566/000000000000/payment-webhook-queue" \
    --max-number-of-messages 1 \
    --wait-time-seconds 5)

if [ -z "$MESSAGE" ] || [ "$MESSAGE" == "" ]; then
    echo "❌ No messages in webhook queue"
else
    echo "✓ Webhook queue also received the message!"
fi

echo ""
echo "================================================"
echo "Fan-out Test Summary"
echo "================================================"
echo ""
echo "If all queues show the same message count, the"
echo "fan-out pattern is working correctly!"
echo ""
echo "Expected behavior:"
echo "  1 event published to SNS"
echo "     ↓"
echo "  4 copies sent to 4 different SQS queues"
echo ""
echo "================================================"

