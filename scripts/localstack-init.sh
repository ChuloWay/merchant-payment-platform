#!/bin/bash

echo "================================================"
echo "Initializing LocalStack AWS Resources"
echo "================================================"

# Set AWS endpoint
export AWS_ENDPOINT="http://localhost:4566"
export AWS_REGION="us-east-1"

# Wait for LocalStack to be fully ready
echo "Waiting for LocalStack to be ready..."
sleep 5

echo ""
echo "Step 1: Creating SNS Topic..."
aws --endpoint-url=$AWS_ENDPOINT sns create-topic \
    --name payment-events \
    --region $AWS_REGION

TOPIC_ARN=$(aws --endpoint-url=$AWS_ENDPOINT sns list-topics --region $AWS_REGION --query 'Topics[0].TopicArn' --output text)
echo "✓ SNS Topic created: $TOPIC_ARN"

echo ""
echo "Step 2: Creating SQS Queues..."

# Create Dead Letter Queue first
aws --endpoint-url=$AWS_ENDPOINT sqs create-queue \
    --queue-name payment-dlq \
    --region $AWS_REGION
echo "✓ Dead Letter Queue created"

# Create main processing queues
aws --endpoint-url=$AWS_ENDPOINT sqs create-queue \
    --queue-name payment-processing-queue \
    --attributes '{
        "VisibilityTimeout": "300",
        "MessageRetentionPeriod": "1209600",
        "ReceiveMessageWaitTimeSeconds": "20"
    }' \
    --region $AWS_REGION
echo "✓ Payment Processing Queue created"

aws --endpoint-url=$AWS_ENDPOINT sqs create-queue \
    --queue-name payment-webhook-queue \
    --attributes '{
        "VisibilityTimeout": "60",
        "MessageRetentionPeriod": "1209600"
    }' \
    --region $AWS_REGION
echo "✓ Webhook Queue created"

aws --endpoint-url=$AWS_ENDPOINT sqs create-queue \
    --queue-name payment-analytics-queue \
    --attributes '{
        "VisibilityTimeout": "30",
        "MessageRetentionPeriod": "1209600"
    }' \
    --region $AWS_REGION
echo "✓ Analytics Queue created"

aws --endpoint-url=$AWS_ENDPOINT sqs create-queue \
    --queue-name payment-notification-queue \
    --attributes '{
        "VisibilityTimeout": "30",
        "MessageRetentionPeriod": "1209600"
    }' \
    --region $AWS_REGION
echo "✓ Notification Queue created"

echo ""
echo "Step 3: Getting Queue ARNs..."
PROCESSING_QUEUE_ARN=$(aws --endpoint-url=$AWS_ENDPOINT sqs get-queue-attributes \
    --queue-url http://localhost:4566/000000000000/payment-processing-queue \
    --attribute-names QueueArn \
    --region $AWS_REGION \
    --query 'Attributes.QueueArn' --output text)

WEBHOOK_QUEUE_ARN=$(aws --endpoint-url=$AWS_ENDPOINT sqs get-queue-attributes \
    --queue-url http://localhost:4566/000000000000/payment-webhook-queue \
    --attribute-names QueueArn \
    --region $AWS_REGION \
    --query 'Attributes.QueueArn' --output text)

ANALYTICS_QUEUE_ARN=$(aws --endpoint-url=$AWS_ENDPOINT sqs get-queue-attributes \
    --queue-url http://localhost:4566/000000000000/payment-analytics-queue \
    --attribute-names QueueArn \
    --region $AWS_REGION \
    --query 'Attributes.QueueArn' --output text)

NOTIFICATION_QUEUE_ARN=$(aws --endpoint-url=$AWS_ENDPOINT sqs get-queue-attributes \
    --queue-url http://localhost:4566/000000000000/payment-notification-queue \
    --attribute-names QueueArn \
    --region $AWS_REGION \
    --query 'Attributes.QueueArn' --output text)

echo ""
echo "Step 4: Subscribing Queues to SNS Topic..."
aws --endpoint-url=$AWS_ENDPOINT sns subscribe \
    --topic-arn $TOPIC_ARN \
    --protocol sqs \
    --notification-endpoint $PROCESSING_QUEUE_ARN \
    --region $AWS_REGION
echo "✓ Processing Queue subscribed to SNS"

aws --endpoint-url=$AWS_ENDPOINT sns subscribe \
    --topic-arn $TOPIC_ARN \
    --protocol sqs \
    --notification-endpoint $WEBHOOK_QUEUE_ARN \
    --region $AWS_REGION
echo "✓ Webhook Queue subscribed to SNS"

aws --endpoint-url=$AWS_ENDPOINT sns subscribe \
    --topic-arn $TOPIC_ARN \
    --protocol sqs \
    --notification-endpoint $ANALYTICS_QUEUE_ARN \
    --region $AWS_REGION
echo "✓ Analytics Queue subscribed to SNS"

aws --endpoint-url=$AWS_ENDPOINT sns subscribe \
    --topic-arn $TOPIC_ARN \
    --protocol sqs \
    --notification-endpoint $NOTIFICATION_QUEUE_ARN \
    --region $AWS_REGION
echo "✓ Notification Queue subscribed to SNS"

echo ""
echo "================================================"
echo "✓ LocalStack initialization completed!"
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
echo "All queues are subscribed to the SNS topic for fan-out messaging"
echo "================================================"

