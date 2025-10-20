#!/bin/bash

echo "================================================"
echo "Deploying Lambda Functions to LocalStack"
echo "================================================"

# Helper function to run AWS CLI in Docker
aws_local() {
    docker run --rm \
        --add-host=host.docker.internal:host-gateway \
        -v "$(pwd)/lambdas:/lambdas" \
        -e AWS_ACCESS_KEY_ID=test \
        -e AWS_SECRET_ACCESS_KEY=test \
        -e AWS_DEFAULT_REGION=us-east-1 \
        amazon/aws-cli \
        --endpoint-url=http://host.docker.internal:4566 \
        "$@" 2>/dev/null
}

cd "$(dirname "$0")/.."

echo ""
echo "Step 1: Creating IAM role for Lambda..."
aws_local iam create-role \
    --role-name lambda-execution-role \
    --assume-role-policy-document '{
      "Version": "2012-10-17",
      "Statement": [{
        "Effect": "Allow",
        "Principal": {"Service": "lambda.amazonaws.com"},
        "Action": "sts:AssumeRole"
      }]
    }' > /dev/null 2>&1

echo "✓ IAM role created"

echo ""
echo "Step 2: Creating payment-processor Lambda function..."

# Create zip file
cd lambdas/payment-processor
zip -q -r function.zip index.js ../shared
cd ../..

# Create Lambda function
aws_local lambda create-function \
    --function-name payment-processor \
    --runtime nodejs18.x \
    --handler index.handler \
    --role arn:aws:iam::000000000000:role/lambda-execution-role \
    --zip-file fileb:///lambdas/payment-processor/function.zip \
    --timeout 300 \
    --memory-size 512 \
    --environment 'Variables={ENABLE_TEMPORAL_WORKFLOWS=true,TEMPORAL_ADDRESS=host.docker.internal:7233,TEMPORAL_NAMESPACE=default,TEMPORAL_TASK_QUEUE=payment-processing}'

echo "✓ payment-processor Lambda created"

echo ""
echo "Step 3: Creating webhook-sender Lambda function..."

# Create zip file
cd lambdas/webhook-sender
zip -q -r function.zip index.js ../shared
cd ../..

# Create Lambda function
aws_local lambda create-function \
    --function-name webhook-sender \
    --runtime nodejs18.x \
    --handler index.handler \
    --role arn:aws:iam::000000000000:role/lambda-execution-role \
    --zip-file fileb:///lambdas/webhook-sender/function.zip \
    --timeout 60 \
    --memory-size 256

echo "✓ webhook-sender Lambda created"

echo ""
echo "Step 4: Creating event source mappings (SQS → Lambda triggers)..."

# Connect payment-processing-queue to payment-processor Lambda
aws_local lambda create-event-source-mapping \
    --function-name payment-processor \
    --event-source-arn arn:aws:sqs:us-east-1:000000000000:payment-processing-queue \
    --batch-size 10 \
    --enabled

echo "✓ payment-processing-queue → payment-processor"

# Connect payment-webhook-queue to webhook-sender Lambda
aws_local lambda create-event-source-mapping \
    --function-name webhook-sender \
    --event-source-arn arn:aws:sqs:us-east-1:000000000000:payment-webhook-queue \
    --batch-size 10 \
    --enabled

echo "✓ payment-webhook-queue → webhook-sender"

echo ""
echo "================================================"
echo "✓ Lambda deployment completed!"
echo "================================================"
echo ""
echo "Deployed functions:"
echo "  - payment-processor (triggered by payment-processing-queue)"
echo "  - webhook-sender (triggered by payment-webhook-queue)"
echo ""
echo "Test by creating a payment via API!"
echo "The Lambda functions will automatically process SQS messages."
echo "================================================"

