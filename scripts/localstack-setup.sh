#!/bin/bash

echo "================================================"
echo "Setting up LocalStack AWS Resources"
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
        "$@"
}

echo ""
echo "Step 1: Creating SNS Topic..."
aws_local sns create-topic --name payment-events
echo "✓ SNS Topic created"

echo ""
echo "Step 2: Creating SQS Queues..."
aws_local sqs create-queue --queue-name payment-dlq
echo "✓ Dead Letter Queue created"

aws_local sqs create-queue \
    --queue-name payment-processing-queue \
    --attributes '{
        "VisibilityTimeout": "300",
        "MessageRetentionPeriod": "1209600",
        "ReceiveMessageWaitTimeSeconds": "20"
    }'
echo "✓ Payment Processing Queue created"

aws_local sqs create-queue \
    --queue-name payment-webhook-queue \
    --attributes '{
        "VisibilityTimeout": "60",
        "MessageRetentionPeriod": "1209600"
    }'
echo "✓ Webhook Queue created"

aws_local sqs create-queue \
    --queue-name payment-analytics-queue \
    --attributes '{
        "VisibilityTimeout": "30",
        "MessageRetentionPeriod": "1209600"
    }'
echo "✓ Analytics Queue created"

aws_local sqs create-queue \
    --queue-name payment-notification-queue \
    --attributes '{
        "VisibilityTimeout": "30",
        "MessageRetentionPeriod": "1209600"
    }'
echo "✓ Notification Queue created"

echo ""
echo "Step 3: Subscribing Queues to SNS Topic..."

# Get Topic ARN
TOPIC_ARN="arn:aws:sns:us-east-1:000000000000:payment-events"

# Subscribe queues to SNS topic
aws_local sns subscribe \
    --topic-arn "$TOPIC_ARN" \
    --protocol sqs \
    --notification-endpoint "arn:aws:sqs:us-east-1:000000000000:payment-processing-queue"
echo "✓ Processing Queue subscribed"

aws_local sns subscribe \
    --topic-arn "$TOPIC_ARN" \
    --protocol sqs \
    --notification-endpoint "arn:aws:sqs:us-east-1:000000000000:payment-webhook-queue"
echo "✓ Webhook Queue subscribed"

aws_local sns subscribe \
    --topic-arn "$TOPIC_ARN" \
    --protocol sqs \
    --notification-endpoint "arn:aws:sqs:us-east-1:000000000000:payment-analytics-queue"
echo "✓ Analytics Queue subscribed"

aws_local sns subscribe \
    --topic-arn "$TOPIC_ARN" \
    --protocol sqs \
    --notification-endpoint "arn:aws:sqs:us-east-1:000000000000:payment-notification-queue"
echo "✓ Notification Queue subscribed"

echo ""
echo "================================================"
echo "✓ LocalStack setup completed successfully!"
echo "================================================"
echo ""
echo "Resources created:"
echo "  - SNS Topic: payment-events"
echo "  - SQS Queues:"
echo "    • payment-processing-queue"
echo "    • payment-webhook-queue"
echo "    • payment-analytics-queue"
echo "    • payment-notification-queue"
echo "    • payment-dlq (Dead Letter Queue)"
echo ""
echo "All queues are subscribed to the SNS topic (fan-out)"
echo "================================================"

