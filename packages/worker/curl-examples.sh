# Edge-OG API Testing with cURL
# Make sure the development server is running: npx wrangler dev --local

BASE_URL="http://localhost:64539"
USER_ID="your-test-user-id"

# 1. Create an API Key
curl -X POST "$BASE_URL/dashboard/api-keys" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "'$USER_ID'",
    "name": "My Test Key",
    "quotaLimit": 3000
  }'

# 2. List API Keys for a user
curl "$BASE_URL/dashboard/api-keys?userId=$USER_ID"

# 3. Get user quota information
curl "$BASE_URL/dashboard/user/$USER_ID"

# 4. Generate OG image with API key (replace YOUR_API_KEY)
curl "$BASE_URL/og?title=Hello&description=World&api_key=YOUR_API_KEY" \
  --output test-image.png

# 5. Test invalid API key (should return 401)
curl -v "$BASE_URL/og?title=Test&api_key=edgeog_invalid123" 

# 6. Generate OG image without API key (still works for now)
curl "$BASE_URL/og?title=No+Key&description=Public+Access" \
  --output no-key-image.png

# 7. Test different templates and themes
curl "$BASE_URL/og?title=Blog+Post&template=blog&theme=dark&font=playfair&api_key=YOUR_API_KEY" \
  --output blog-image.png

# 8. Health check
curl "$BASE_URL/health"

# 9. Homepage
curl "$BASE_URL/"

# Additional Tests:
# - Test quota limits by making many requests
# - Test parameter validation with invalid values
# - Test CORS with browser requests
