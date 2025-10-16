#!/bin/bash

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

clear
echo -e "${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║        Payment System - Real-Time Monitoring                  ║${NC}"
echo -e "${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
echo ""

# Check Docker Services
echo -e "${YELLOW}📦 Docker Services:${NC}"
docker-compose ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null | grep -E "payment|temporal" | while read line; do
  if echo "$line" | grep -q "Up"; then
    echo -e "  ${GREEN}✅${NC} $line"
  else
    echo -e "  ${RED}❌${NC} $line"
  fi
done
echo ""

# Check NestJS App
echo -e "${YELLOW}🚀 NestJS Application:${NC}"
if curl -s http://localhost:3001/api/v1/health > /dev/null 2>&1; then
  echo -e "  ${GREEN}✅ Running${NC} on http://localhost:3001"
  echo -e "     API: http://localhost:3001/api/v1"
else
  echo -e "  ${RED}❌ Not running${NC}"
fi
echo ""

# Check Temporal Worker
echo -e "${YELLOW}⚙️  Temporal Worker:${NC}"
if ps aux | grep -q "[t]emporal.*worker"; then
  WORKER_PID=$(ps aux | grep "[t]emporal.*worker" | awk '{print $2}')
  echo -e "  ${GREEN}✅ Running${NC} (PID: $WORKER_PID)"
else
  echo -e "  ${RED}❌ Not running${NC}"
  echo -e "     Start with: npm run start:worker"
fi
echo ""

# Check Temporal UI
echo -e "${YELLOW}🌐 Temporal UI:${NC}"
if curl -s http://localhost:8088 > /dev/null 2>&1; then
  echo -e "  ${GREEN}✅ Available${NC} at http://localhost:8088"
else
  echo -e "  ${RED}❌ Not available${NC}"
fi
echo ""

# Check LocalStack Resources
echo -e "${YELLOW}☁️  AWS LocalStack Resources:${NC}"
echo -n "  SNS Topics: "
TOPICS=$(docker run --rm --add-host=host.docker.internal:host-gateway \
  -e AWS_ACCESS_KEY_ID=test -e AWS_SECRET_ACCESS_KEY=test amazon/aws-cli \
  --endpoint-url=http://host.docker.internal:4566 sns list-topics --output text 2>/dev/null | wc -l)
if [ "$TOPICS" -gt 0 ]; then
  echo -e "${GREEN}$TOPICS${NC}"
else
  echo -e "${RED}0${NC} (Run: bash scripts/localstack-setup.sh)"
fi

echo -n "  SQS Queues: "
QUEUES=$(docker run --rm --add-host=host.docker.internal:host-gateway \
  -e AWS_ACCESS_KEY_ID=test -e AWS_SECRET_ACCESS_KEY=test amazon/aws-cli \
  --endpoint-url=http://host.docker.internal:4566 sqs list-queues --output text 2>/dev/null | wc -l)
if [ "$QUEUES" -gt 0 ]; then
  echo -e "${GREEN}$QUEUES${NC}"
else
  echo -e "${RED}0${NC} (Run: bash scripts/localstack-setup.sh)"
fi

echo -n "  Lambda Functions: "
LAMBDAS=$(docker run --rm --add-host=host.docker.internal:host-gateway \
  -e AWS_ACCESS_KEY_ID=test -e AWS_SECRET_ACCESS_KEY=test amazon/aws-cli \
  --endpoint-url=http://host.docker.internal:4566 lambda list-functions --output text 2>/dev/null | wc -l)
if [ "$LAMBDAS" -gt 0 ]; then
  echo -e "${GREEN}$LAMBDAS${NC}"
else
  echo -e "${RED}0${NC} (Run: bash scripts/deploy-lambdas.sh)"
fi
echo ""

# Recent Payments
echo -e "${YELLOW}💳 Recent Payments (Last 5):${NC}"
docker exec payment_system_db psql -U postgres -d payment_system -t -c \
  "SELECT id, reference, amount, status, \"createdAt\" FROM payments ORDER BY \"createdAt\" DESC LIMIT 5;" 2>/dev/null | \
  while read line; do
    if [ ! -z "$line" ]; then
      echo "  $line"
    fi
  done
echo ""

# System Architecture
echo -e "${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Current Architecture: HYBRID (Monolith + Event-Driven)       ║${NC}"
echo -e "${BLUE}╠════════════════════════════════════════════════════════════════╣${NC}"
echo -e "${BLUE}║                                                                ║${NC}"
echo -e "${BLUE}║  Client Request                                                ║${NC}"
echo -e "${BLUE}║       ↓                                                        ║${NC}"
echo -e "${BLUE}║  NestJS API (Monolith)                                         ║${NC}"
echo -e "${BLUE}║       ↓                                                        ║${NC}"
echo -e "${BLUE}║  SNS Topic (payment-events)                                    ║${NC}"
echo -e "${BLUE}║       ├→ SQS → Lambda (payment-processor) → Temporal Workflow  ║${NC}"
echo -e "${BLUE}║       ├→ SQS → Lambda (webhook-sender)                         ║${NC}"
echo -e "${BLUE}║       ├→ SQS → (analytics - future)                            ║${NC}"
echo -e "${BLUE}║       └→ SQS → (notifications - future)                        ║${NC}"
echo -e "${BLUE}║                                                                ║${NC}"
echo -e "${BLUE}║  Temporal Worker (executes workflows & activities)            ║${NC}"
echo -e "${BLUE}║                                                                ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Quick Actions
echo -e "${YELLOW}🔧 Quick Actions:${NC}"
echo ""
echo -e "  ${GREEN}Test Payment:${NC}"
echo -e "    bash test-e2e-workflow.sh"
echo ""
echo -e "  ${GREEN}View Workflows:${NC}"
echo -e "    open http://localhost:8088"
echo ""
echo -e "  ${GREEN}Restart NestJS:${NC}"
echo -e "    npm run start:dev"
echo ""
echo -e "  ${GREEN}Start Temporal Worker:${NC}"
echo -e "    npm run start:worker"
echo ""
echo -e "  ${GREEN}View Logs:${NC}"
echo -e "    docker-compose logs -f"
echo ""

echo -e "${BLUE}════════════════════════════════════════════════════════════════${NC}"

