#!/bin/bash

# Test script for Edge-OG API Key Management (AQ-1)
# Usage: ./test-api.sh

BASE_URL="http://localhost:64539"
USER_ID="test-user-$(date +%s)"

echo "🚀 Testing Edge-OG API Key Management"
echo "======================================"
echo "Base URL: $BASE_URL"
echo "Test User ID: $USER_ID"
echo ""

# Test 1: Create API Key
echo "1️⃣  Creating API Key..."
CREATE_RESPONSE=$(curl -s -X POST "$BASE_URL/dashboard/api-keys" \
  -H "Content-Type: application/json" \
  -d "{\"userId\":\"$USER_ID\",\"name\":\"Test Key\",\"quotaLimit\":2000}")

echo "Response: $CREATE_RESPONSE"
echo ""

# Extract API key from response
API_KEY=$(echo $CREATE_RESPONSE | grep -o '"key":"[^"]*"' | cut -d'"' -f4)
KEY_ID=$(echo $CREATE_RESPONSE | grep -o '"id":"[^"]*"' | cut -d'"' -f4)

if [ -z "$API_KEY" ]; then
  echo "❌ Failed to create API key"
  exit 1
fi

echo "✅ API Key created: $API_KEY"
echo "✅ Key ID: $KEY_ID"
echo ""

# Test 2: List API Keys
echo "2️⃣  Listing API Keys for user..."
LIST_RESPONSE=$(curl -s "$BASE_URL/dashboard/api-keys?userId=$USER_ID")
echo "Response: $LIST_RESPONSE"
echo ""

# Test 3: Get User Quota Info
echo "3️⃣  Getting user quota information..."
QUOTA_RESPONSE=$(curl -s "$BASE_URL/dashboard/user/$USER_ID")
echo "Response: $QUOTA_RESPONSE"
echo ""

# Test 4: Generate OG Image with API Key (should work)
echo "4️⃣  Testing OG Image generation with API key..."
OG_RESPONSE=$(curl -s -w "HTTP_STATUS:%{http_code}" "$BASE_URL/og?title=Test&description=API+Key+Test&api_key=$API_KEY")
HTTP_STATUS=$(echo $OG_RESPONSE | tr -d '\n' | sed -e 's/.*HTTP_STATUS://')
echo "HTTP Status: $HTTP_STATUS"

if [ "$HTTP_STATUS" = "200" ]; then
  echo "✅ OG Image generated successfully with API key"
else
  echo "❌ Failed to generate OG image (Status: $HTTP_STATUS)"
fi
echo ""

# Test 5: Generate OG Image without API Key (should still work for now)
echo "5️⃣  Testing OG Image generation without API key..."
OG_NO_KEY_RESPONSE=$(curl -s -w "HTTP_STATUS:%{http_code}" "$BASE_URL/og?title=Test&description=No+Key")
HTTP_STATUS_NO_KEY=$(echo $OG_NO_KEY_RESPONSE | tr -d '\n' | sed -e 's/.*HTTP_STATUS://')
echo "HTTP Status: $HTTP_STATUS_NO_KEY"

if [ "$HTTP_STATUS_NO_KEY" = "200" ]; then
  echo "✅ OG Image generated successfully without API key"
else
  echo "❌ Failed to generate OG image without key (Status: $HTTP_STATUS_NO_KEY)"
fi
echo ""

# Test 6: Test with invalid API key
echo "6️⃣  Testing with invalid API key..."
INVALID_RESPONSE=$(curl -s -w "HTTP_STATUS:%{http_code}" "$BASE_URL/og?title=Test&description=Invalid+Key&api_key=edgeog_invalid123")
HTTP_STATUS_INVALID=$(echo $INVALID_RESPONSE | tr -d '\n' | sed -e 's/.*HTTP_STATUS://')
echo "HTTP Status: $HTTP_STATUS_INVALID"

if [ "$HTTP_STATUS_INVALID" = "401" ]; then
  echo "✅ Invalid API key properly rejected"
else
  echo "❌ Invalid API key should return 401 (got: $HTTP_STATUS_INVALID)"
fi
echo ""

echo "🎉 API Key Management Testing Complete!"
echo "========================================"
