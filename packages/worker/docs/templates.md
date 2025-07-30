# Templates Documentation - CG-3 Implementation

This document describes the 10 JSX templates available in Edge-OG for generating Open Graph images.

## Available Templates

### 1. **default** - Default Template
- **Use case**: General purpose, clean and professional
- **Parameters**: `title`, `description`, `theme`, `font`
- **Design**: Centered card layout with logo and text
- **Best for**: General content, landing pages, basic announcements

### 2. **blog** - Blog Post Template
- **Use case**: Blog articles and content posts
- **Parameters**: `title`, `description`, `author`, `theme`, `font`
- **Design**: Author info header with prominent title
- **Best for**: Blog posts, articles, personal content

### 3. **product** - Product Showcase Template
- **Use case**: E-commerce and product presentations
- **Parameters**: `title`, `description`, `price`, `theme`, `font`
- **Design**: Split layout with product info and visual placeholder
- **Best for**: Product launches, e-commerce, SaaS products

### 4. **event** - Event Announcement Template
- **Use case**: Conferences, webinars, and events
- **Parameters**: `title`, `description`, `date`, `location`, `theme`, `font`
- **Design**: Centered layout with event badge and details
- **Best for**: Event promotion, conferences, meetups

### 5. **quote** - Quote/Testimonial Template
- **Use case**: Showcasing testimonials and quotes
- **Parameters**: `title`, `quote`, `author`, `role`, `theme`, `font`
- **Design**: Large quote with attribution
- **Best for**: Testimonials, quotes, customer stories
- **Default font**: `playfair` for elegant typography

### 6. **minimal** - Minimalist Template
- **Use case**: Clean and simple design
- **Parameters**: `title`, `subtitle`, `theme`, `font`
- **Design**: Ultra-clean centered layout
- **Best for**: Elegant presentations, minimal branding

### 7. **news** - News Article Template
- **Use case**: News articles and announcements
- **Parameters**: `title`, `description`, `category`, `date`, `theme`, `font`
- **Design**: News-style layout with category badge
- **Best for**: News articles, press releases, updates
- **Default font**: `roboto` for news readability

### 8. **tech** - Tech/SaaS Template
- **Use case**: Software products and technical content
- **Parameters**: `title`, `description`, `version`, `status`, `theme`, `font`
- **Design**: Modern tech layout with status badges
- **Best for**: Software releases, technical documentation, APIs
- **Default theme**: `dark` for tech aesthetic

### 9. **podcast** - Podcast Template
- **Use case**: Podcast episodes and audio content
- **Parameters**: `title`, `description`, `episode`, `duration`, `theme`, `font`
- **Design**: Split layout with audio visualization
- **Best for**: Podcast episodes, audio content, interviews
- **Default theme**: `purple` and font: `opensans`

### 10. **portfolio** - Portfolio Template
- **Use case**: Creative work and portfolios
- **Parameters**: `title`, `description`, `name`, `role`, `theme`, `font`
- **Design**: Creative layout with grid mockup
- **Best for**: Portfolio showcases, creative work, artist profiles
- **Default font**: `playfair` for creative elegance

### 11. **course** - Course/Education Template
- **Use case**: Online courses and educational content
- **Parameters**: `title`, `description`, `instructor`, `duration`, `level`, `theme`, `font`
- **Design**: Educational layout with module structure
- **Best for**: Online courses, educational content, tutorials
- **Default theme**: `blue` and font: `opensans`

## Usage Examples

### Basic Usage
```typescript
// Default template
const image = await renderOpenGraphImage({
  title: "Welcome to Edge-OG",
  description: "Generate Open Graph images at the edge",
  template: "default"
});

// Blog template with author
const blogImage = await renderOpenGraphImage({
  title: "10 Tips for Better SEO",
  description: "Improve your search rankings with these proven strategies",
  template: "blog",
  author: "Jane Smith"
});
```

### Advanced Usage with All Parameters
```typescript
// Product template
const productImage = await renderOpenGraphImage({
  title: "Amazing SaaS Tool",
  description: "Boost your productivity with our latest features",
  template: "product",
  price: "$29/month",
  theme: "blue",
  font: "inter"
});

// Event template
const eventImage = await renderOpenGraphImage({
  title: "Tech Conference 2025",
  description: "Join industry leaders for cutting-edge insights",
  template: "event",
  date: "March 15, 2025",
  location: "San Francisco",
  theme: "purple"
});
```

## Template-Specific Parameters

| Template | Specific Parameters | Description |
|----------|-------------------|-------------|
| `blog` | `author` | Blog post author name |
| `product` | `price` | Product price display |
| `event` | `date`, `location` | Event date and location |
| `quote` | `quote`, `author`, `role` | Quote text, author, and their role |
| `minimal` | `subtitle` | Subtitle text (uses description if not provided) |
| `news` | `category`, `date` | News category and publication date |
| `tech` | `version`, `status` | Software version and status (Live, Beta, etc.) |
| `podcast` | `episode`, `duration` | Episode number and duration |
| `portfolio` | `name`, `role` | Artist/creator name and role |
| `course` | `instructor`, `duration`, `level` | Course instructor, duration, and difficulty level |

## Common Parameters

All templates support these base parameters:

- `title`: Main headline text (required)
- `description`: Supporting description text
- `theme`: Color scheme (`light`, `dark`, `blue`, `green`, `purple`)
- `font`: Typography (`inter`, `roboto`, `playfair`, `opensans`)

## Performance Guidelines

- Keep titles under 60 characters for optimal display
- Descriptions should be under 100-120 characters
- All text is automatically sanitized for security
- Templates are optimized for 1200×630px Open Graph standard
- CPU budget: Each template renders in <10ms

## Template Selection Guide

| Use Case | Recommended Template | Alternative |
|----------|---------------------|-------------|
| General content | `default` | `minimal` |
| Blog posts | `blog` | `news` |
| Product launches | `product` | `tech` |
| Events | `event` | `news` |
| Testimonials | `quote` | `minimal` |
| Software/SaaS | `tech` | `product` |
| Podcasts | `podcast` | `quote` |
| Creative work | `portfolio` | `minimal` |
| Education | `course` | `blog` |
| News/Press | `news` | `blog` |

## Implementation Notes

- All templates follow the Satori → SVG → PNG pipeline
- Text sanitization prevents XSS and rendering issues
- Fallback values ensure templates always render
- Templates are modular and can be extended
- TypeScript types ensure parameter safety
