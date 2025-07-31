/**
 * Home page HTML template for Edge-OG
 * Provides documentation, examples, and interactive testing
 */

export function getHomePage(baseUrl: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Edge-OG - Open Graph Image Generator</title>
    <meta name="description" content="Generate beautiful Open Graph images at the edge with 11 professional templates, themes, and fonts.">
    <meta property="og:title" content="Edge-OG - Open Graph Image Generator">
    <meta property="og:description" content="Generate beautiful Open Graph images at the edge with 11 professional templates, themes, and fonts.">
    <meta property="og:image" content="${baseUrl}/og?template=tech&title=Edge-OG&description=Open%20Graph%20images%20at%20the%20edge&category=SaaS&theme=blue&font=inter">
    <meta property="og:url" content="${baseUrl}">
    <meta property="og:type" content="website">
    <meta name="twitter:card" content="summary_large_image">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6; 
            color: #333; 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
        }
        .container { max-width: 1200px; margin: 0 auto; padding: 0 20px; }
        .header { 
            background: rgba(255,255,255,0.95); 
            backdrop-filter: blur(10px);
            padding: 2rem 0; 
            margin-bottom: 3rem;
            border-radius: 0 0 20px 20px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.1);
        }
        .hero { text-align: center; margin-bottom: 3rem; }
        .hero h1 { 
            font-size: 3.5rem; 
            font-weight: 800; 
            margin-bottom: 1rem;
            background: linear-gradient(135deg, #667eea, #764ba2);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }
        .hero p { 
            font-size: 1.25rem; 
            color: #666; 
            max-width: 600px; 
            margin: 0 auto;
        }
        .section { 
            background: rgba(255,255,255,0.95);
            backdrop-filter: blur(10px);
            margin: 2rem 0; 
            padding: 2rem; 
            border-radius: 15px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.1);
        }
        .section h2 { 
            color: #2d3748; 
            margin-bottom: 1.5rem; 
            font-size: 2rem;
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }
        .grid { 
            display: grid; 
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); 
            gap: 1.5rem; 
            margin: 1.5rem 0;
        }
        .card { 
            background: #f8fafc; 
            padding: 1.5rem; 
            border-radius: 10px; 
            border: 1px solid #e2e8f0;
            transition: transform 0.2s, box-shadow 0.2s;
        }
        .card:hover { 
            transform: translateY(-2px); 
            box-shadow: 0 8px 25px rgba(0,0,0,0.1);
        }
        .card h3 { 
            color: #2d3748; 
            margin-bottom: 0.5rem; 
            font-size: 1.25rem;
        }
        .card p { 
            color: #4a5568; 
            font-size: 0.9rem; 
            margin-bottom: 1rem;
        }
        .btn { 
            display: inline-block; 
            background: linear-gradient(135deg, #667eea, #764ba2);
            color: white; 
            padding: 0.75rem 1.5rem; 
            text-decoration: none; 
            border-radius: 8px; 
            font-weight: 500;
            transition: all 0.2s;
            border: none;
            cursor: pointer;
            font-size: 0.9rem;
        }
        .btn:hover { 
            transform: translateY(-1px);
            box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
        }
        .btn-outline { 
            background: transparent; 
            color: #667eea; 
            border: 2px solid #667eea;
        }
        .btn-outline:hover { 
            background: #667eea; 
            color: white;
        }
        .code { 
            background: #2d3748; 
            color: #e2e8f0; 
            padding: 1rem; 
            border-radius: 8px; 
            font-family: 'Monaco', 'Menlo', monospace; 
            font-size: 0.85rem;
            overflow-x: auto;
            margin: 1rem 0;
        }
        .preview { 
            border: 2px solid #e2e8f0; 
            border-radius: 8px; 
            overflow: hidden;
            margin: 1rem 0;
        }
        .preview img { 
            width: 100%; 
            height: auto; 
            display: block;
        }
        .form-group { 
            margin: 1rem 0;
        }
        .form-group label { 
            display: block; 
            margin-bottom: 0.5rem; 
            font-weight: 500; 
            color: #2d3748;
        }
        .form-group select, .form-group input { 
            width: 100%; 
            padding: 0.75rem; 
            border: 1px solid #e2e8f0; 
            border-radius: 6px; 
            font-size: 1rem;
        }
        .quick-test { 
            background: #f0f8ff; 
            border: 2px solid #3182ce; 
            border-radius: 10px; 
            padding: 1.5rem;
            margin: 2rem 0;
        }
        .badge { 
            display: inline-block; 
            background: #e2e8f0; 
            color: #2d3748; 
            padding: 0.25rem 0.75rem; 
            border-radius: 15px; 
            font-size: 0.8rem; 
            margin: 0.25rem;
        }
        .emoji { font-size: 1.5rem; }
        @media (max-width: 768px) {
            .hero h1 { font-size: 2.5rem; }
            .container { padding: 0 15px; }
            .section { padding: 1.5rem; }
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="container">
            <div class="hero">
                <h1><span class="emoji">🎨</span> Edge-OG</h1>
                <p>Generate beautiful Open Graph images at the edge with professional templates, themes, and lightning-fast performance.</p>
            </div>
        </div>
    </div>

    <div class="container">
        <!-- Quick Test Section -->
        <div class="quick-test">
            <h2><span class="emoji">⚡</span> Quick Test</h2>
            <p>Try generating an image right now:</p>
            <div class="code">${baseUrl}/og?template=blog&title=My%20Awesome%20Post&author=John%20Doe&theme=dark&font=playfair</div>
            <a href="${baseUrl}/og?template=blog&title=My%20Awesome%20Post&author=John%20Doe&theme=dark&font=playfair" class="btn" target="_blank">
                Generate Example Image
            </a>
        </div>

        <!-- Features Section -->
        <div class="section">
            <h2><span class="emoji">✨</span> Features</h2>
            <div class="grid">
                <div class="card">
                    <h3>🚀 Lightning Fast</h3>
                    <p>Generate 1200×630 PNG images in under 150ms with global edge distribution.</p>
                </div>
                <div class="card">
                    <h3>🎨 11 Professional Templates</h3>
                    <p>Choose from blog, product, event, quote, minimal, news, tech, podcast, portfolio, course, and default templates.</p>
                </div>
                <div class="card">
                    <h3>🌈 5 Beautiful Themes</h3>
                    <p>Light, dark, blue, green, and purple themes to match your brand.</p>
                </div>
                <div class="card">
                    <h3>📝 4 Font Options</h3>
                    <p>Inter, Roboto, Playfair Display, and Open Sans for perfect typography.</p>
                </div>
                <div class="card">
                    <h3>⚡ Edge Cached</h3>
                    <p>Images are cached globally for 1 year with 99%+ hit ratio.</p>
                </div>
                <div class="card">
                    <h3>🔒 Secure & Validated</h3>
                    <p>All parameters are validated and sanitized for security.</p>
                </div>
            </div>
        </div>

        <!-- Templates Showcase -->
        <div class="section">
            <h2><span class="emoji">🎭</span> Template Showcase</h2>
            <div class="grid">
                <div class="card">
                    <h3>Blog Template</h3>
                    <p>Perfect for articles and blog posts with author information.</p>
                    <div class="preview">
                        <img src="${baseUrl}/og?template=blog&title=How%20to%20Build%20Amazing%20APIs&author=Dev%20Team&theme=light&font=inter" alt="Blog template preview" loading="lazy">
                    </div>
                    <a href="${baseUrl}/og?template=blog&title=How%20to%20Build%20Amazing%20APIs&author=Dev%20Team&theme=light&font=inter" class="btn-outline btn" target="_blank">View Full Size</a>
                </div>
                <div class="card">
                    <h3>Product Template</h3>
                    <p>Ideal for e-commerce and product showcases with pricing.</p>
                    <div class="preview">
                        <img src="${baseUrl}/og?template=product&title=Premium%20Headphones&description=Wireless%20noise-canceling&price=$299&theme=dark&font=roboto" alt="Product template preview" loading="lazy">
                    </div>
                    <a href="${baseUrl}/og?template=product&title=Premium%20Headphones&description=Wireless%20noise-canceling&price=$299&theme=dark&font=roboto" class="btn-outline btn" target="_blank">View Full Size</a>
                </div>
                <div class="card">
                    <h3>Event Template</h3>
                    <p>Great for conferences, webinars, and event announcements.</p>
                    <div class="preview">
                        <img src="${baseUrl}/og?template=event&title=Web%20Dev%20Conference&date=March%2015-17&location=San%20Francisco&theme=blue&font=opensans" alt="Event template preview" loading="lazy">
                    </div>
                    <a href="${baseUrl}/og?template=event&title=Web%20Dev%20Conference&date=March%2015-17&location=San%20Francisco&theme=blue&font=opensans" class="btn-outline btn" target="_blank">View Full Size</a>
                </div>
                <div class="card">
                    <h3>Quote Template</h3>
                    <p>Perfect for inspirational quotes, testimonials, and memorable sayings.</p>
                    <div class="preview">
                        <img src="${baseUrl}/og?template=quote&title=Generate%20beautiful%20Open%20Graph%20images&author=Edge-OG&theme=purple&font=playfair" alt="Quote template preview" loading="lazy">
                    </div>
                    <a href="${baseUrl}/og?template=quote&title=Generate%20beautiful%20Open%20Graph%20images&author=Edge-OG&theme=purple&font=playfair" class="btn-outline btn" target="_blank">View Full Size</a>
                </div>
            </div>
        </div>

        <!-- API Documentation -->
        <div class="section">
            <h2><span class="emoji">📖</span> API Usage</h2>
            <h3>Basic Structure</h3>
            <div class="code">GET ${baseUrl}/og?template={template}&{parameters}</div>
            
            <h3>Global Parameters</h3>
            <div class="grid">
                <div class="card">
                    <h3>theme</h3>
                    <p>Visual color scheme</p>
                    <div class="badge">light</div>
                    <div class="badge">dark</div>
                    <div class="badge">blue</div>
                    <div class="badge">green</div>
                    <div class="badge">purple</div>
                </div>
                <div class="card">
                    <h3>font</h3>
                    <p>Typography style</p>
                    <div class="badge">inter</div>
                    <div class="badge">roboto</div>
                    <div class="badge">playfair</div>
                    <div class="badge">opensans</div>
                </div>
            </div>

            <h3>Template-Specific Parameters</h3>
            <div class="code">
# Blog Template
${baseUrl}/og?template=blog&title=My%20Post&author=John&description=Great%20content

# Product Template  
${baseUrl}/og?template=product&title=My%20Product&price=$99&description=Amazing%20features

# Event Template
${baseUrl}/og?template=event&title=Conference&date=March%2015&location=NYC
            </div>
        </div>

        <!-- Interactive Builder -->
        <div class="section">
            <h2><span class="emoji">🛠️</span> Interactive Builder</h2>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; align-items: start;">
                <div>
                    <div class="form-group">
                        <label for="template">Template</label>
                        <select id="template">
                            <option value="default">Default</option>
                            <option value="blog">Blog</option>
                            <option value="product">Product</option>
                            <option value="event">Event</option>
                            <option value="quote">Quote</option>
                            <option value="minimal">Minimal</option>
                            <option value="news">News</option>
                            <option value="tech">Tech</option>
                            <option value="podcast">Podcast</option>
                            <option value="portfolio">Portfolio</option>
                            <option value="course">Course</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="title">Title</label>
                        <input type="text" id="title" placeholder="Enter your title" value="Welcome to Edge-OG">
                    </div>
                    <div class="form-group">
                        <label for="description">Description</label>
                        <input type="text" id="description" placeholder="Enter description" value="Generate beautiful Open Graph images">
                    </div>
                    <div class="form-group">
                        <label for="theme">Theme</label>
                        <select id="theme">
                            <option value="light">Light</option>
                            <option value="dark">Dark</option>
                            <option value="blue">Blue</option>
                            <option value="green">Green</option>
                            <option value="purple">Purple</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="font">Font</label>
                        <select id="font">
                            <option value="inter">Inter</option>
                            <option value="roboto">Roboto</option>
                            <option value="playfair">Playfair Display</option>
                            <option value="opensans">Open Sans</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="fontUrl">Custom Font URL (optional)</label>
                        <input type="url" id="fontUrl" placeholder="https://fonts.example.com/CustomFont.ttf" style="font-size: 12px;">
                        <small style="color: #666; font-size: 11px;">HTTPS URL to TTF, OTF, WOFF, or WOFF2 file. Overrides font selection above.</small>
                    </div>
                    <button class="btn" onclick="updatePreview()">Generate Preview</button>
                    <button class="btn-outline btn" onclick="copyUrl()">Copy URL</button>
                </div>
                <div>
                    <div class="preview">
                        <img id="preview-image" src="${baseUrl}/og?template=default&title=Welcome%20to%20Edge-OG&description=Generate%20beautiful%20Open%20Graph%20images" alt="Preview" style="width: 100%; height: auto;">
                    </div>
                    <div class="code" id="generated-url">${baseUrl}/og?template=default&title=Welcome%20to%20Edge-OG&description=Generate%20beautiful%20Open%20Graph%20images</div>
                </div>
            </div>
        </div>

        <!-- Examples Section -->
        <div class="section">
            <h2><span class="emoji">💡</span> More Examples</h2>
            <div class="grid">
                <div class="card">
                    <h3>Professional Blog</h3>
                    <div class="code">${baseUrl}/og?template=blog&title=Best%20Practices%20for%20API%20Design&author=Engineering%20Team&theme=light&font=inter</div>
                </div>
                <div class="card">
                    <h3>Dark Product</h3>
                    <div class="code">${baseUrl}/og?template=product&title=Developer%20Tools&price=Free&theme=dark&font=roboto</div>
                </div>
                <div class="card">
                    <h3>Elegant Quote</h3>
                    <div class="code">${baseUrl}/og?template=quote&title=Innovation%20distinguishes%20a%20leader&author=Steve%20Jobs&theme=purple&font=playfair</div>
                </div>
                <div class="card">
                    <h3>Tech Announcement</h3>
                    <div class="code">${baseUrl}/og?template=tech&title=AI%20Platform%20v2.0&category=Machine%20Learning&theme=blue&font=roboto</div>
                </div>
                <div class="card">
                    <h3>Custom Font Example (CG-4)</h3>
                    <div class="code" style="font-size: 0.8rem;">${baseUrl}/og?template=minimal&title=Custom%20Typography&subtitle=Using%20custom%20fonts&fontUrl=https://fonts.googleapis.com/css2?family=Dancing+Script:wght@400;700</div>
                    <small style="color: #666; font-size: 0.75rem;">⚠️ Example URL - actual font loading requires direct font file URL</small>
                </div>
            </div>
        </div>

        <!-- Footer -->
        <div class="section" style="text-align: center; margin-top: 3rem;">
            <h2><span class="emoji">🚀</span> Ready to Get Started?</h2>
            <p>Start generating beautiful Open Graph images for your website today!</p>
            <div style="margin: 2rem 0;">
                <a href="${baseUrl}/og?template=tech&title=Your%20Project&description=Built%20with%20Edge-OG&category=SaaS&theme=blue" class="btn" target="_blank">
                    Generate Your First Image
                </a>
                <a href="https://github.com/VincentBoillotDevalliere/edge-og" class="btn-outline btn" target="_blank">
                    View Documentation
                </a>
            </div>
            <p style="color: #666; font-size: 0.9rem;">
                Built with <span style="color: #e53e3e;">❤️</span> using Cloudflare Workers, Satori, and TypeScript
            </p>
        </div>
    </div>

    <script>
        function updatePreview() {
            const template = document.getElementById('template').value;
            const title = encodeURIComponent(document.getElementById('title').value);
            const description = encodeURIComponent(document.getElementById('description').value);
            const theme = document.getElementById('theme').value;
            const font = document.getElementById('font').value;
            const fontUrl = document.getElementById('fontUrl').value;
            
            let url;
            
            // Handle Quote template differently - use description as the main quote text
            if (template === 'quote') {
                url = \`${baseUrl}/og?template=\${template}&title=\${description}&author=Edge-OG&theme=\${theme}&font=\${font}\`;
            } else {
                url = \`${baseUrl}/og?template=\${template}&title=\${title}&description=\${description}&theme=\${theme}&font=\${font}\`;
            }
            
            // Add fontUrl parameter if provided
            if (fontUrl && fontUrl.trim()) {
                url += \`&fontUrl=\${encodeURIComponent(fontUrl)}\`;
            }
            
            document.getElementById('preview-image').src = url;
            document.getElementById('generated-url').textContent = url;
        }
        
        function copyUrl() {
            const url = document.getElementById('generated-url').textContent;
            navigator.clipboard.writeText(url).then(() => {
                alert('URL copied to clipboard!');
            });
        }
        
        // Update preview when form changes
        document.addEventListener('DOMContentLoaded', function() {
            ['template', 'title', 'description', 'theme', 'font', 'fontUrl'].forEach(id => {
                document.getElementById(id).addEventListener('change', updatePreview);
                document.getElementById(id).addEventListener('input', updatePreview);
            });
        });
    </script>
</body>
</html>`;
}
