# Edge-OG: API-First Architecture Decision

## Current State
- Worker API: Core image generation
- Dashboard: Separate Next.js app for management

## Proposed: Simplified API-First Approach

### Keep in Worker (Enhanced Homepage)
```
GET /                    # Enhanced homepage with:
                        # - Interactive image builder
                        # - API documentation  
                        # - Template showcase
                        # - Quick testing interface

GET /dashboard/keys     # Simple API key creation (returns JSON)
POST /dashboard/keys    # Create new API key
GET /dashboard/usage    # Usage stats (JSON)
GET /og                 # Image generation (core feature)
GET /health            # Health check
```

### Benefits
✅ Single deployment (worker only)
✅ No CORS issues
✅ Simpler maintenance
✅ True API-first approach
✅ Still provides visual interface
✅ Easier for developers to understand

### What We'd Lose
❌ Rich React interface
❌ Complex dashboard features
❌ Separate authentication system

## Implementation Strategy

1. **Enhanced Worker Homepage**: Rich HTML/JS interface in the worker
2. **API Key Management**: Simple endpoints that return JSON
3. **Testing Interface**: Built into the homepage
4. **Documentation**: Integrated into the worker response

## Decision Points

**For API-First (Worker Only):**
- Simpler architecture
- Easier deployment
- Better for developer audience
- Lower maintenance

**For Dashboard (Current Approach):**
- Better UX for non-technical users
- More complex features possible
- Modern React interface
- Separate concerns
