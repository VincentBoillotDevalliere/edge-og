# 🎨 Edge-OG

**API-first Open Graph image generation at the edge with Cloudflare Workers**

Generate beautiful 1200×630 PNG Open Graph images in under 150ms with 11 professional templates, 5 themes, 4 fonts, and custom emoji support.

## ✨ Features

- 🚀 **Lightning Fast**: <150ms generation time with global edge distribution
- 🎨 **11 Professional Templates**: Blog, product, event, quote, minimal, news, tech, podcast, portfolio, course, and default
- 🌈 **5 Beautiful Themes**: Light, dark, blue, green, and purple
- 📝 **4 Font Options**: Inter, Roboto, Playfair Display, and Open Sans
- ✨ **Rich Emoji Support**: Custom emojis for engaging visuals
- 🔑 **API Key Management**: Secure authentication with usage quotas
- 📊 **Built-in Analytics**: Usage tracking and monitoring
- 🌍 **Global Edge Caching**: 1-year cache with 90%+ hit ratio
- � **Interactive Homepage**: Built-in API builder and documentation

## 🚀 Quick Start

### Development

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev

# Visit http://localhost:8789 for the interactive homepage
```

### API Usage

```bash
# Basic image generation
curl "http://localhost:8789/og?template=blog&title=My%20Post&author=John%20Doe"

# With custom theme, font, and emoji
curl "http://localhost:8789/og?template=tech&title=Release%20v2.0&category=API&theme=blue&font=roboto&emoji=🚀"

# With API key (production)
curl "https://your-worker.yourname.workers.dev/og?template=product&title=My%20Product&price=$99&api_key=edgeog_..."
```

## 🏗️ Architecture

**Worker-Only Design** - Single deployment, API-first architecture:

- **Cloudflare Workers**: Global edge execution
- **Satori**: High-performance SVG to PNG conversion
- **KV Storage**: Template caching and API key management
- **Built-in Homepage**: Interactive documentation and API builder
## 📖 API Reference

### Generate Image
```
GET /og?template={template}&title={title}&{parameters}
```

**Templates**: `blog`, `product`, `event`, `quote`, `minimal`, `news`, `tech`, `podcast`, `portfolio`, `course`, `default`

**Themes**: `light`, `dark`, `blue`, `green`, `purple`

**Fonts**: `inter`, `roboto`, `playfair`, `opensans`

**Common Parameters**:
- `title` - Main title text
- `description` - Subtitle/description
- `emoji` - Custom emoji (e.g., 🚀)
- `theme` - Color scheme
- `font` - Typography style
- `api_key` - Authentication (production)

### Template-Specific Parameters

**Blog**: `author`, `date`, `readTime`
**Product**: `price`, `oldPrice`, `badge`
**Event**: `date`, `location`, `time`
**Tech**: `category`, `version`
**Quote**: `author`, `role`

### Other Endpoints
- `GET /health` - Service health check
- `POST /dashboard/api-keys` - Create API key
- `GET /dashboard/user/{userId}` - Usage statistics

## 🚀 Deployment

### Prerequisites
1. [Cloudflare account](https://cloudflare.com)
2. [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/)

### Deploy to Cloudflare Workers

```bash
# Build and deploy
pnpm deploy

# Or deploy manually
cd packages/worker
pnpm run deploy
```

### Environment Setup

1. **Create KV Namespaces**:
```bash
wrangler kv:namespace create "TEMPLATES"
wrangler kv:namespace create "USAGE" 
wrangler kv:namespace create "API_KEYS"
```

2. **Update `wrangler.jsonc`** with your KV namespace IDs:
```jsonc
{
  "kv_namespaces": [
    { "binding": "TEMPLATES", "id": "your-templates-id", "preview_id": "your-templates-preview-id" },
    { "binding": "USAGE", "id": "your-usage-id", "preview_id": "your-usage-preview-id" },
    { "binding": "API_KEYS", "id": "your-api-keys-id", "preview_id": "your-api-keys-preview-id" }
  ]
}
```

3. **Deploy**:
```bash
pnpm deploy
```

## 🔧 Configuration

**Environment Variables** (in `wrangler.jsonc`):
- `ENVIRONMENT`: `production` or `development`

**Secrets** (for production):
```bash
# Optional: Set master API key for admin operations
wrangler secret put MASTER_API_KEY
```

## 📊 Performance

- **Generation Time**: <150ms (target)
- **Cache Hit Ratio**: >90%
- **Image Size**: Optimized PNG, typically 50-200KB
- **Global Distribution**: Cloudflare's 200+ edge locations

## 🧪 Testing

```bash
# Run tests
pnpm test

# Test specific template
curl "http://localhost:8789/og?template=tech&title=Test"

# Health check
curl "http://localhost:8789/health"
```

## 📝 Examples

Visit your deployed worker's homepage (`/`) for an interactive API builder with live preview, or try these examples:

- **Blog Post**: `/og?template=blog&title=How%20to%20Build%20APIs&author=Dev%20Team&theme=light`
- **Product Launch**: `/og?template=product&title=New%20Product&price=$99&theme=blue&emoji=🚀`
- **Event Announcement**: `/og?template=event&title=Conference%202024&date=March%2015&location=NYC`
- **Tech Release**: `/og?template=tech&title=API%20v2.0&category=Release&theme=dark&emoji=⚡`

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

## 🙏 Acknowledgments

Built with:
- [Cloudflare Workers](https://workers.cloudflare.com/) - Edge computing platform
- [Satori](https://github.com/vercel/satori) - SVG generation library
- [TypeScript](https://www.typescriptlang.org/) - Type-safe development

---

**🎨 Edge-OG** - Beautiful Open Graph images at the edge, API-first, zero configuration required.
- **Tailwind CSS** - Utility-first CSS framework
- **TypeScript** - Type-safe JavaScript
