#!/bin/bash

# Deployment script for Family Voice Bridge
# Usage: ./deploy.sh

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Family Voice Bridge Deployment${NC}"
echo ""

# Check if deploy-config.json exists
if [ ! -f "deploy-config.json" ]; then
    echo -e "${RED}❌ Error: deploy-config.json not found${NC}"
    echo "Please create deploy-config.json with your deployment settings."
    exit 1
fi

# Check if API key is set
if [ -z "$AI_BUILDER_TOKEN" ]; then
    echo -e "${YELLOW}⚠️  AI_BUILDER_TOKEN not set in environment${NC}"
    echo "Please set it: export AI_BUILDER_TOKEN=your_token_here"
    exit 1
fi

API_URL="${STUDENT_PORTAL_URL:-https://api.ai-builders.com/backend}"
SERVICE_NAME=$(grep -o '"service_name": "[^"]*"' deploy-config.json | cut -d'"' -f4)

echo "📋 Deployment Configuration:"
echo "   API URL: $API_URL"
echo "   Service Name: $SERVICE_NAME"
echo ""

# Trigger deployment
echo "🔄 Triggering deployment..."
RESPONSE=$(curl -s -X POST "$API_URL/v1/deployments" \
  -H "Authorization: Bearer $AI_BUILDER_TOKEN" \
  -H "Content-Type: application/json" \
  -d @deploy-config.json)

# Check if deployment was queued
if echo "$RESPONSE" | grep -q "queued\|deploying"; then
    echo -e "${GREEN}✅ Deployment queued successfully!${NC}"
    echo ""
    echo "⏳ Waiting for deployment to complete (this may take 5-10 minutes)..."
    echo "   You can check status manually with:"
    echo "   curl -X GET \"$API_URL/v1/deployments/$SERVICE_NAME\" \\"
    echo "     -H \"Authorization: Bearer \$AI_BUILDER_TOKEN\""
    echo ""
    
    # Poll for status
    MAX_ATTEMPTS=60
    ATTEMPT=0
    
    while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
        sleep 10
        ATTEMPT=$((ATTEMPT + 1))
        
        STATUS_RESPONSE=$(curl -s -X GET "$API_URL/v1/deployments/$SERVICE_NAME" \
          -H "Authorization: Bearer $AI_BUILDER_TOKEN")
        
        STATUS=$(echo "$STATUS_RESPONSE" | grep -o '"status": "[^"]*"' | cut -d'"' -f4)
        PUBLIC_URL=$(echo "$STATUS_RESPONSE" | grep -o '"public_url": "[^"]*"' | cut -d'"' -f4)
        
        echo "[$ATTEMPT/$MAX_ATTEMPTS] Status: $STATUS"
        
        if [ "$STATUS" = "HEALTHY" ]; then
            echo ""
            echo -e "${GREEN}🎉 Deployment successful!${NC}"
            if [ ! -z "$PUBLIC_URL" ]; then
                echo -e "${GREEN}🌐 Your app is live at: $PUBLIC_URL${NC}"
            fi
            exit 0
        elif [ "$STATUS" = "ERROR" ] || [ "$STATUS" = "UNHEALTHY" ]; then
            echo ""
            echo -e "${RED}❌ Deployment failed with status: $STATUS${NC}"
            echo "Response: $STATUS_RESPONSE"
            exit 1
        fi
    done
    
    echo ""
    echo -e "${YELLOW}⏱️  Timeout waiting for deployment${NC}"
    echo "Check status manually or try again later."
else
    echo -e "${RED}❌ Deployment failed${NC}"
    echo "Response: $RESPONSE"
    exit 1
fi

