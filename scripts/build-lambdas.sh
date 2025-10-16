#!/bin/bash

echo "================================================"
echo "Building Lambda Functions"
echo "================================================"

cd "$(dirname "$0")/.."

echo ""
echo "Step 1: Installing dependencies for payment-processor..."
cd lambdas/payment-processor
npm install --silent
echo "✓ Dependencies installed"

echo ""
echo "Step 2: Building payment-processor..."
npm run build
echo "✓ Built successfully"

echo ""
echo "Step 3: Installing dependencies for webhook-sender..."
cd ../webhook-sender
npm install --silent
echo "✓ Dependencies installed"

echo ""
echo "Step 4: Building webhook-sender..."
npm run build
echo "✓ Built successfully"

cd ../..

echo ""
echo "================================================"
echo "✓ All Lambda functions built successfully!"
echo "================================================"
echo ""
echo "Lambda functions ready for deployment:"
echo "  - lambdas/payment-processor/index.js"
echo "  - lambdas/webhook-sender/index.js"
echo "================================================"

