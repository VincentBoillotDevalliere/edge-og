# 📖 Usage Guide - Edge-OG

Complete documentation for using all templates, parameters, and advanced features in the Edge-OG service.

**🚀 New in CG-4**: Custom Font URL support for advanced typography control with your own font files!

## 🎯 Quick Test URLs

All endpoints use the base URL format: `/og?template={template}&{parameters}`

### Basic Example
```
/og?template=blog&title=My%20Blog%20Post&author=John%20Doe&theme=dark&font=playfair
```

---

## 🎨 Global Parameters (Available for ALL templates)

### `theme` - Visual Theme
Controls the color scheme and overall appearance.

| Value | Background | Text Color | Accent | Card Color | Best For |
|-------|------------|------------|--------|------------|----------|
| `light` *(default)* | White | Dark Gray | Blue | Light Gray | Professional, clean look |
| `dark` | Dark Gray | White | Light Blue | Medium Gray | Modern, tech-focused |
| `blue` | Light Blue | Dark Blue | Blue | Medium Blue | Corporate, trustworthy |
| `green` | Light Green | Dark Green | Green | Medium Green | Nature, eco-friendly |
| `purple` | Light Purple | Dark Purple | Purple | Medium Purple | Creative, artistic |

**Test URLs:**
```
/og?theme=light
/og?theme=dark
/og?theme=blue
/og?theme=green
/og?theme=purple
```

### `font` - Typography
Controls the font family used throughout the template.

| Value | Font Family | Style | Best For |
|-------|-------------|-------|----------|
| `inter` *(default)* | Inter, sans-serif | Modern, readable | General purpose, UI |
| `roboto` | Roboto, sans-serif | Clean, geometric | Tech, apps |
| `playfair` | Playfair Display, serif | Elegant, classic | Editorial, luxury |
| `opensans` | Open Sans, sans-serif | Friendly, humanist | Marketing, casual |

**Test URLs:**
```
/og?font=inter
/og?font=roboto
/og?font=playfair
/og?font=opensans
```

### `fontUrl` - Custom Font URL *(CG-4 Advanced Feature)*
Load custom fonts from external HTTPS URLs for advanced typography control.

| Parameter | Type | Requirements | Description |
|-----------|------|--------------|-------------|
| `fontUrl` | string (URL) | HTTPS only, TTF/OTF/WOFF/WOFF2 | Custom font file URL |

**Requirements:**
- ✅ HTTPS protocol required for security
- ✅ Supported formats: TTF, OTF, WOFF, WOFF2
- ✅ Maximum file size: 5MB
- ✅ Graceful fallback to Inter font on failure

**Test URLs:**
```bash
# Custom font with fallback (will use Inter if font fails to load)
/og?title=Custom%20Typography&fontUrl=https://fonts.example.com/CustomFont.ttf

# Combined with other parameters
/og?template=minimal&title=Brand%20Typography&theme=dark&fontUrl=https://fonts.example.com/BrandFont.woff2

# Error cases (will return 400 error)
/og?fontUrl=http://fonts.example.com/font.ttf          # HTTP not allowed
/og?fontUrl=https://fonts.example.com/document.pdf    # Invalid extension
```

**Security & Performance:**
- Font URLs are validated for security compliance
- Failed font loads don't block image generation
- Custom fonts are loaded with 5MB size limit
- Maintains TTFB ≤ 150ms requirement

---

## 📝 Template-Specific Parameters

### 1. `default` - Basic Template
Minimal template for general use.

| Parameter | Type | Default | Max Length | Description |
|-----------|------|---------|------------|-------------|
| `title` | string | "Welcome to Edge-OG" | 100 chars | Main heading |
| `description` | string | "Generate beautiful..." | 150 chars | Subtitle/description |

**Test URL:**
```
/og?template=default&title=Welcome%20to%20My%20Site&description=The%20best%20place%20for%20amazing%20content
```

### 2. `blog` - Blog Post Template
Optimized for blog articles and content posts.

| Parameter | Type | Default | Max Length | Description |
|-----------|------|---------|------------|-------------|
| `title` | string | "Blog Post" | 80 chars | Article title |
| `description` | string | "Read our latest insights..." | 120 chars | Article summary |
| `author` | string | "Edge-OG" | 30 chars | Author name |

**Test URLs:**
```
/og?template=blog&title=How%20to%20Build%20Amazing%20APIs&author=Jane%20Smith&description=A%20comprehensive%20guide%20to%20API%20development

/og?template=blog&title=The%20Future%20of%20Web%20Development&author=Tech%20Team&theme=dark&font=roboto
```

### 3. `product` - E-commerce Template
Perfect for product showcases and e-commerce.

| Parameter | Type | Default | Max Length | Description |
|-----------|------|---------|------------|-------------|
| `title` | string | "Amazing Product" | 60 chars | Product name |
| `description` | string | "Discover our latest..." | 100 chars | Product description |
| `price` | string | "$99" | 20 chars | Product price |

**Test URLs:**
```
/og?template=product&title=Premium%20Headphones&description=Wireless%20noise-canceling%20audio&price=$299

/og?template=product&title=Eco%20Water%20Bottle&price=€45&theme=green&font=opensans
```

### 4. `event` - Event Announcement Template
Ideal for conferences, webinars, and events.

| Parameter | Type | Default | Max Length | Description |
|-----------|------|---------|------------|-------------|
| `title` | string | "Join Our Event" | 70 chars | Event name |
| `description` | string | "Connect, learn, and grow..." | 100 chars | Event description |
| `date` | string | "Coming Soon" | 30 chars | Event date |
| `location` | string | "Online" | 30 chars | Event location |

**Test URLs:**
```
/og?template=event&title=Web%20Dev%20Conference%202025&date=March%2015-17&location=San%20Francisco&theme=blue

/og?template=event&title=AI%20Workshop&description=Learn%20machine%20learning%20fundamentals&date=Next%20Friday&location=Virtual&theme=purple&font=playfair
```

### 5. `quote` - Quote/Testimonial Template
Great for sharing quotes, testimonials, or inspiring content.

| Parameter | Type | Default | Max Length | Description |
|-----------|------|---------|------------|-------------|
| `title` | string | "Inspiring Quote" | 150 chars | The quote text |
| `description` | string | "Words of wisdom..." | 100 chars | Additional context |
| `author` | string | "Anonymous" | 40 chars | Quote author |

**Test URLs:**
```
/og?template=quote&title=The%20only%20way%20to%20do%20great%20work%20is%20to%20love%20what%20you%20do&author=Steve%20Jobs&theme=dark

/og?template=quote&title=Innovation%20distinguishes%20between%20a%20leader%20and%20a%20follower&author=Steve%20Jobs&theme=blue&font=playfair
```

### 6. `minimal` - Minimal Design Template
Clean, minimalist design for modern brands.

| Parameter | Type | Default | Max Length | Description |
|-----------|------|---------|------------|-------------|
| `title` | string | "Simple & Clean" | 80 chars | Main heading |
| `description` | string | "Less is more..." | 120 chars | Subtitle |

**Test URLs:**
```
/og?template=minimal&title=Modern%20Design&description=Clean%20aesthetic%20for%20the%20digital%20age&theme=light&font=inter

/og?template=minimal&title=Simplicity&theme=dark&font=roboto
```

### 7. `news` - News Article Template
Designed for news articles and press releases.

| Parameter | Type | Default | Max Length | Description |
|-----------|------|---------|------------|-------------|
| `title` | string | "Breaking News" | 90 chars | News headline |
| `description` | string | "Latest updates..." | 110 chars | News summary |
| `source` | string | "Edge-OG News" | 30 chars | News source |

**Test URLs:**
```
/og?template=news&title=Revolutionary%20AI%20Technology%20Announced&source=Tech%20Daily&description=Company%20unveils%20breakthrough%20in%20machine%20learning

/og?template=news&title=Climate%20Change%20Summit%20Results&source=Global%20News&theme=green&font=roboto
```

### 8. `tech` - Technology Template
Perfect for tech companies and SaaS products.

| Parameter | Type | Default | Max Length | Description |
|-----------|------|---------|------------|-------------|
| `title` | string | "Tech Innovation" | 70 chars | Product/service name |
| `description` | string | "Cutting-edge technology..." | 110 chars | Tech description |
| `category` | string | "Software" | 25 chars | Technology category |

**Test URLs:**
```
/og?template=tech&title=Cloud%20Platform%20v2.0&description=Scalable%20infrastructure%20for%20modern%20applications&category=DevOps&theme=dark

/og?template=tech&title=AI%20Assistant&category=Machine%20Learning&theme=blue&font=roboto
```

### 9. `podcast` - Podcast Template
Optimized for podcast episodes and audio content.

| Parameter | Type | Default | Max Length | Description |
|-----------|------|---------|------------|-------------|
| `title` | string | "Podcast Episode" | 80 chars | Episode title |
| `description` | string | "Listen to our latest..." | 120 chars | Episode description |
| `host` | string | "Edge-OG Podcast" | 30 chars | Host name |
| `episode` | string | "EP 1" | 15 chars | Episode number |

**Test URLs:**
```
/og?template=podcast&title=The%20Future%20of%20Development&host=Tech%20Talk&episode=Episode%2042&description=Discussing%20trends%20in%20software%20development

/og?template=podcast&title=Startup%20Stories&host=Business%20Cast&episode=S2E10&theme=purple&font=opensans
```

### 10. `portfolio` - Portfolio Template
Showcase creative work and professional projects.

| Parameter | Type | Default | Max Length | Description |
|-----------|------|---------|------------|-------------|
| `title` | string | "My Portfolio" | 60 chars | Project/portfolio name |
| `description` | string | "Showcasing my work..." | 100 chars | Project description |
| `role` | string | "Designer" | 25 chars | Professional role |

**Test URLs:**
```
/og?template=portfolio&title=Web%20Design%20Portfolio&role=UI/UX%20Designer&description=Creative%20digital%20experiences%20and%20interfaces&theme=purple

/og?template=portfolio&title=Photography%20Collection&role=Photographer&theme=dark&font=playfair
```

### 11. `course` - Educational Course Template
Perfect for online courses and educational content.

| Parameter | Type | Default | Max Length | Description |
|-----------|------|---------|------------|-------------|
| `title` | string | "Learn Something New" | 70 chars | Course title |
| `description` | string | "Master new skills..." | 110 chars | Course description |
| `instructor` | string | "Expert Teacher" | 30 chars | Instructor name |
| `level` | string | "Beginner" | 20 chars | Course difficulty |

**Test URLs:**
```
/og?template=course&title=JavaScript%20Fundamentals&instructor=John%20Smith&level=Beginner&description=Learn%20the%20basics%20of%20web%20development

/og?template=course&title=Advanced%20React%20Patterns&instructor=React%20Masters&level=Advanced&theme=blue&font=roboto
```

---

## 🧪 Testing Combinations

### Popular Combinations
```bash
# Professional blog post
/og?template=blog&title=Best%20Practices%20for%20API%20Design&author=Engineering%20Team&theme=light&font=inter

# Dark tech product
/og?template=product&title=Developer%20Tools&price=Free&theme=dark&font=roboto

# Elegant event invitation
/og?template=event&title=Design%20Conference&date=April%2020&location=NYC&theme=purple&font=playfair

# Minimalist portfolio
/og?template=minimal&title=Creative%20Portfolio&theme=light&font=inter

# News with green theme
/og?template=news&title=Environmental%20Breakthrough&source=Eco%20News&theme=green&font=opensans

# Custom font examples (CG-4)
/og?template=quote&title=Brand%20Typography&author=Design%20Team&fontUrl=https://fonts.example.com/BrandFont.ttf&theme=dark

/og?template=minimal&title=Custom%20Design&subtitle=Using%20brand%20fonts&fontUrl=https://fonts.example.com/CustomFont.woff2
```

### Theme Testing Matrix
Test each template with different themes:
```bash
# Blog template across all themes
/og?template=blog&title=Test%20Post&theme=light
/og?template=blog&title=Test%20Post&theme=dark
/og?template=blog&title=Test%20Post&theme=blue
/og?template=blog&title=Test%20Post&theme=green
/og?template=blog&title=Test%20Post&theme=purple
```

### Font Testing Matrix
Test each template with different fonts:
```bash
# Product template across all fonts
/og?template=product&title=Test%20Product&font=inter
/og?template=product&title=Test%20Product&font=roboto
/og?template=product&title=Test%20Product&font=playfair
/og?template=product&title=Test%20Product&font=opensans
```

### Custom Font URL Testing (CG-4)
Test custom font URL functionality:
```bash
# Valid custom font URL (will fallback to Inter if font doesn't exist)
/og?template=default&title=Custom%20Font%20Test&fontUrl=https://fonts.example.com/CustomFont.ttf

# Different font formats
/og?template=minimal&title=TTF%20Font&fontUrl=https://fonts.example.com/CustomFont.ttf
/og?template=minimal&title=OTF%20Font&fontUrl=https://fonts.example.com/CustomFont.otf
/og?template=minimal&title=WOFF%20Font&fontUrl=https://fonts.example.com/CustomFont.woff
/og?template=minimal&title=WOFF2%20Font&fontUrl=https://fonts.example.com/CustomFont.woff2

# Error testing (should return 400 Bad Request)
/og?fontUrl=http://fonts.example.com/font.ttf          # HTTP not allowed
/og?fontUrl=https://fonts.example.com/document.pdf    # Invalid extension
/og?fontUrl=not-a-valid-url                           # Invalid URL format

# Combined with other parameters
/og?template=blog&title=Brand%20Post&author=Designer&theme=purple&fontUrl=https://fonts.example.com/BrandFont.woff2
```

---

## 🔧 Parameter Validation & Limits

### Text Length Limits
- All text parameters are automatically truncated to prevent overflow
- Special characters are sanitized for Satori compatibility
- Empty parameters fall back to sensible defaults

### URL Encoding
Remember to URL-encode special characters:
- Space: `%20`
- Ampersand: `%26`
- Question mark: `%3F`
- Hash: `%23`

### Error Handling
Invalid parameters will use defaults:
- Unknown themes → `light`
- Unknown fonts → `inter`  
- Unknown templates → `default`

**CG-4 Custom Font URL Errors:**
- HTTP URLs → 400 "Custom font URL must use HTTPS"
- Invalid extensions → 400 "Custom font URL must point to a TTF, OTF, WOFF, or WOFF2 file"
- Malformed URLs → 400 "Invalid fontUrl parameter. Must be a valid HTTPS URL"
- Font load failures → Graceful fallback to Inter font (200 OK)

---

## 📊 Performance Notes

- **Image Size**: All templates generate 1200×630 PNG images
- **Target TTFB**: ≤ 150ms (CG-1 requirement)
- **Caching**: Images are cached for optimal performance
- **Font Loading**: Fonts are loaded dynamically via Satori
- **Custom Fonts (CG-4)**: External font loading with 5MB limit and graceful fallback

---

## 🚀 Quick Start Testing

1. **Basic Test**: `/og?template=default`
2. **With Parameters**: `/og?template=blog&title=Test&author=Me`
3. **Full Customization**: `/og?template=product&title=My%20Product&price=$50&theme=blue&font=playfair`
4. **Custom Font (CG-4)**: `/og?template=minimal&title=Brand%20Typography&fontUrl=https://fonts.example.com/CustomFont.ttf`

For any issues or questions, check the main documentation or test logs for detailed error messages.

---

## 🛠️ Admin: Reset Monthly Quota (AQ-3.4)

Admins can reset an API key's monthly usage counter to unblock quota‑limited keys.

Option A — via Wrangler CLI (recommended):

1. Compute the usage key for the current (or target) month: `usage:{KID}:{YYYYMM}`
2. Run this command to reset the count to zero:

	 wrangler kv:key put --binding=USAGE usage:{KID}:{YYYYMM} 0

Notes:
- Replace {KID} with the API key ID and {YYYYMM} with the year+month (e.g., 202508)
- This uses the `USAGE` KV binding configured in `wrangler.toml`
- Works in any environment where the binding resolves (dev, staging, prod)

Option B — programmatically (internal tooling/tests):
- Use `resetMonthlyQuota(env, kid)` from `packages/worker/src/kv/usage.ts`
- Helpers available:
	- `getUsageKeyForMonth(kid, date?)`
	- `getMonthlyUsage(env, kid, date?)`
	- `setMonthlyUsage(env, kid, count, date?)`

Security reminder:
- Only privileged operators should perform resets
- All requests remain authenticated and quota‑checked as usual after reset

Option C — via REST API (secure, programmatic):

Use the built-in admin endpoint to reset monthly usage.

- Method: POST
- Path: /admin/usage/reset
- Auth: X-Admin-Secret header must match the ADMIN_SECRET environment variable
- Content-Type: application/json
- Body:
	{
		"kid": "<API_KEY_ID>",
		"yyyymm": "<YYYYMM>" // optional; defaults to current month in UTC
	}

Successful response (200):
	{
		"success": true,
		"kid": "<API_KEY_ID>",
		"yyyymm": "<YYYYMM>",
		"usage": 0
	}

Errors:
- 400 Bad Request: invalid kid, malformed yyyymm
- 401 Unauthorized: missing/invalid X-Admin-Secret
- 415 Unsupported Media Type: missing or wrong Content-Type

Example (curl):
	curl -X POST "$BASE_URL/admin/usage/reset" \
		-H "X-Admin-Secret: $ADMIN_SECRET" \
		-H "Content-Type: application/json" \
		--data '{"kid":"abc123","yyyymm":"202508"}'

Configuring ADMIN_SECRET:
- Set a strong, random value as a Cloudflare Worker secret so it isn't committed to code.
- Local/dev: you can use a .dev.vars file (auto-loaded by wrangler dev) with ADMIN_SECRET=... for convenience.
- Production/staging: store as a secret via your deployment pipeline or Wrangler:

	# optional examples
	# Set secret interactively (per environment)
	wrangler secret put ADMIN_SECRET

	# Or set a local dev value (do not commit)
	echo "ADMIN_SECRET=your-strong-secret" >> .dev.vars

Rotation guidance:
- Rotate ADMIN_SECRET periodically and after any suspected exposure.
- After rotation, clients automating resets must update the X-Admin-Secret header.
