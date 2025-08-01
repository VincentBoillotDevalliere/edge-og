export {};

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
    <meta name="description" content="Generate beautiful Open Graph images at the edge with 11 professional templates, themes, and fonts. API-first with real-time testing!">
    <meta property="og:title" content="Edge-OG - Open Graph Image Generator">
    <meta property="og:description" content="Generate beautiful Open Graph images at the edge with 11 professional templates, themes, and fonts. API-first with real-time testing!">
    <meta property="og:image" content="${baseUrl}/og?template=tech&title=Edge-OG&description=Open%20Graph%20images%20at%20the%20edge&category=API&theme=blue&font=inter&emoji=🎨">
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
            margin-bottom: 2rem;
        }
        .api-first-badge {
            display: inline-block;
            background: linear-gradient(135deg, #4ade80, #22c55e);
            color: white;
            padding: 0.75rem 1.5rem;
            border-radius: 25px;
            font-weight: 600;
            margin: 1rem 0.5rem;
            box-shadow: 0 4px 20px rgba(34, 197, 94, 0.3);
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
            word-break: break-all;
            max-width: 100%;
        }
        .preview { 
            border: 2px solid #e2e8f0; 
            border-radius: 8px; 
            overflow: hidden;
            margin: 1rem 0;
            width: 100%;
            aspect-ratio: 1200/630;
            position: relative;
        }
        .preview img { 
            width: 100%; 
            height: 100%; 
            object-fit: cover;
            display: block;
            transition: opacity 0.3s ease;
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
        .emoji-picker:hover { 
            background: #667eea !important; 
            color: white;
            border-color: #667eea !important;
            transform: scale(1.1);
            box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);
        }
        .emoji-picker:active {
            transform: scale(0.95);
        }
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
            <h2><span class="emoji">⚡</span> Quick API Test</h2>
            <p>Try generating an image right now with our API:</p>
            <div class="code">${baseUrl}/og?template=blog&title=My%20Awesome%20Post&author=John%20Doe&theme=dark&font=playfair&emoji=🚀</div>
            <a href="${baseUrl}/og?template=blog&title=My%20Awesome%20Post&author=John%20Doe&theme=dark&font=playfair&emoji=🚀" class="btn" target="_blank">
                Generate Example Image
            </a>
        </div>

        <!-- Features Section -->
        <div class="section">
            <h2><span class="emoji">✨</span> API Features</h2>
            <div class="grid">
                <div class="card">
                    <h3>🚀 Lightning Fast</h3>
                    <p>Generate 1200×630 PNG images in under 150ms with global edge distribution.</p>
                </div>
                <div class="card">
                    <h3>🎨 11 Professional Templates</h3>
                    <p>Blog, product, event, quote, minimal, news, tech, podcast, portfolio, course, and default templates.</p>
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
                    <h3>✨ Rich Emoji Support</h3>
                    <p>🎨 Custom emojis to make your images more engaging and increase click-through rates.</p>
                </div>
                <div class="card">
                    <h3>🔑 API Key Management</h3>
                    <p>Secure authentication with usage quotas and real-time monitoring.</p>
                </div>
            </div>
        </div>

        <!-- Interactive Builder -->
        <div class="section">
            <h2><span class="emoji">🛠️</span> Interactive API Builder</h2>
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
                        <input type="text" id="description" placeholder="Enter description" value="API-first Open Graph images">
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
                        <label for="emoji">🎨 Custom Emoji (optional)</label>
                        <input type="text" id="emoji" placeholder="🚀" maxlength="10" style="font-size: 18px; text-align: center;">
                        <div style="margin-top: 12px; display: flex; flex-wrap: wrap; gap: 6px;">
                            <span class="emoji-picker" onclick="setEmoji('🚀')" style="cursor: pointer; padding: 6px 8px; background: white; border-radius: 4px; border: 1px solid #e2e8f0; font-size: 18px; transition: all 0.2s;" title="Rocket">🚀</span>
                            <span class="emoji-picker" onclick="setEmoji('✨')" style="cursor: pointer; padding: 6px 8px; background: white; border-radius: 4px; border: 1px solid #e2e8f0; font-size: 18px; transition: all 0.2s;" title="Sparkles">✨</span>
                            <span class="emoji-picker" onclick="setEmoji('🎯')" style="cursor: pointer; padding: 6px 8px; background: white; border-radius: 4px; border: 1px solid #e2e8f0; font-size: 18px; transition: all 0.2s;" title="Target">🎯</span>
                            <span class="emoji-picker" onclick="setEmoji('💡')" style="cursor: pointer; padding: 6px 8px; background: white; border-radius: 4px; border: 1px solid #e2e8f0; font-size: 18px; transition: all 0.2s;" title="Bulb">💡</span>
                            <span class="emoji-picker" onclick="setEmoji('🔥')" style="cursor: pointer; padding: 6px 8px; background: white; border-radius: 4px; border: 1px solid #e2e8f0; font-size: 18px; transition: all 0.2s;" title="Fire">🔥</span>
                            <span class="emoji-picker" onclick="setEmoji('⚡')" style="cursor: pointer; padding: 6px 8px; background: white; border-radius: 4px; border: 1px solid #e2e8f0; font-size: 18px; transition: all 0.2s;" title="Lightning">⚡</span>
                            <span class="emoji-picker" onclick="setEmoji('🎨')" style="cursor: pointer; padding: 6px 8px; background: white; border-radius: 4px; border: 1px solid #e2e8f0; font-size: 18px; transition: all 0.2s;" title="Art">🎨</span>
                            <span class="emoji-picker" onclick="setEmoji('💎')" style="cursor: pointer; padding: 6px 8px; background: white; border-radius: 4px; border: 1px solid #e2e8f0; font-size: 18px; transition: all 0.2s;" title="Diamond">💎</span>
                        </div>
                    </div>
                    <button class="btn" onclick="updatePreview()">Update Preview</button>
                    <button class="btn-outline btn" onclick="copyUrl()">Copy API Call</button>
                </div>
                <div style="min-width: 0;">
                    <div class="preview">
                        <img id="preview-image" src="${baseUrl}/og?template=default&title=Welcome%20to%20Edge-OG&description=API-first%20Open%20Graph%20images" alt="Preview">
                    </div>
                    <div style="margin-top: 1rem;">
                        <h4 style="margin-bottom: 0.5rem; font-size: 0.9rem; color: #2d3748;">Generated API Call:</h4>
                        <div class="code" id="generated-url" style="font-size: 0.75rem; line-height: 1.4; max-height: 120px; overflow-y: auto;">${baseUrl}/og?template=default&title=Welcome%20to%20Edge-OG&description=API-first%20Open%20Graph%20images</div>
                    </div>
                </div>
            </div>
        </div>

        <!-- API Documentation -->
        <div class="section">
            <h2><span class="emoji">📖</span> API Documentation</h2>
            
            <h3>Basic Usage</h3>
            <div class="code">GET ${baseUrl}/og?template={template}&title={title}&{parameters}</div>
            
            <h3>API Endpoints</h3>
            <div class="grid">
                <div class="card">
                    <h3>🖼️ Generate Image</h3>
                    <div class="code" style="margin: 0.5rem 0; font-size: 0.75rem;">GET /og?template=blog&title=Hello</div>
                    <p>Core endpoint for generating Open Graph images</p>
                </div>
                <div class="card">
                    <h3>🔑 Create API Key</h3>
                    <div class="code" style="margin: 0.5rem 0; font-size: 0.75rem;">POST /dashboard/api-keys</div>
                    <p>Create new API keys with custom quotas</p>
                </div>
                <div class="card">
                    <h3>📊 Usage Stats</h3>
                    <div class="code" style="margin: 0.5rem 0; font-size: 0.75rem;">GET /dashboard/user/{userId}</div>
                    <p>Monitor usage quotas and analytics</p>
                </div>
                <div class="card">
                    <h3>🔍 Health Check</h3>
                    <div class="code" style="margin: 0.5rem 0; font-size: 0.75rem;">GET /health</div>
                    <p>Service status and version info</p>
                </div>
            </div>

            <h3>Parameters</h3>
            <div class="grid">
                <div class="card">
                    <h3>template</h3>
                    <p>Choose from 11 professional templates</p>
                    <div class="badge">blog</div>
                    <div class="badge">product</div>
                    <div class="badge">event</div>
                    <div class="badge">quote</div>
                    <div class="badge">minimal</div>
                    <div class="badge">news</div>
                    <div class="badge">tech</div>
                    <div class="badge">podcast</div>
                    <div class="badge">portfolio</div>
                    <div class="badge">course</div>
                    <div class="badge">default</div>
                </div>
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
                <div class="card">
                    <h3>emoji</h3>
                    <p>🎨 Custom emoji for visual appeal</p>
                    <div class="badge">🚀</div>
                    <div class="badge">✨</div>
                    <div class="badge">🎯</div>
                    <div class="badge">💡</div>
                    <div class="badge">🔥</div>
                    <div class="badge">⚡</div>
                </div>
            </div>

            <h3>Examples</h3>
            <div class="code"># Blog post with custom emoji
${baseUrl}/og?template=blog&title=My%20Post&author=John&emoji=🚀&theme=dark

# Product showcase  
${baseUrl}/og?template=product&title=My%20Product&price=$99&theme=blue

# Event announcement
${baseUrl}/og?template=event&title=Conference&date=March%2015&location=NYC

# With API key authentication
${baseUrl}/og?template=tech&title=Release&api_key=edgeog_...</div>
        </div>

        <!-- Template Showcase -->
        <div class="section">
            <h2><span class="emoji">🎭</span> Template Showcase</h2>
            <div class="grid">
                <div class="card">
                    <h3>Blog Template</h3>
                    <div class="preview">
                        <img src="${baseUrl}/og?template=blog&title=How%20to%20Build%20Amazing%20APIs&author=Dev%20Team&theme=light&font=inter" alt="Blog template" loading="lazy">
                    </div>
                    <a href="${baseUrl}/og?template=blog&title=How%20to%20Build%20Amazing%20APIs&author=Dev%20Team&theme=light&font=inter" class="btn-outline btn" target="_blank">View API Call</a>
                </div>
                <div class="card">
                    <h3>Tech Template</h3>
                    <div class="preview">
                        <img src="${baseUrl}/og?template=tech&title=API%20v2.0%20Released&category=Development&theme=blue&font=roboto&emoji=🚀" alt="Tech template" loading="lazy">
                    </div>
                    <a href="${baseUrl}/og?template=tech&title=API%20v2.0%20Released&category=Development&theme=blue&font=roboto&emoji=🚀" class="btn-outline btn" target="_blank">View API Call</a>
                </div>
            </div>
        </div>

        <!-- Footer -->
        <div class="section" style="text-align: center; margin-top: 3rem;">
            <h2><span class="emoji">🚀</span> Ready to Integrate?</h2>
            <p>Start using the Edge-OG API in your applications today!</p>
            <div style="margin: 2rem 0;">
                <a href="${baseUrl}/og?template=tech&title=Your%20Project&description=Built%20with%20Edge-OG&category=API&theme=blue&emoji=🎯" class="btn" target="_blank">
                    Test API Call
                </a>
                <a href="https://github.com/VincentBoillotDevalliere/edge-og" class="btn-outline btn" target="_blank">
                    View on GitHub
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
            const emoji = document.getElementById('emoji').value;
            
            let url = \`${baseUrl}/og?template=\${template}&title=\${title}&description=\${description}&theme=\${theme}&font=\${font}\`;
            
            if (emoji && emoji.trim()) {
                url += \`&emoji=\${encodeURIComponent(emoji)}\`;
            }
            
            document.getElementById('preview-image').src = url;
            document.getElementById('generated-url').textContent = url;
        }
        
        function copyUrl() {
            const url = document.getElementById('generated-url').textContent;
            navigator.clipboard.writeText(url).then(() => {
                alert('API call copied to clipboard! 📋');
            });
        }
        
        function setEmoji(emoji) {
            document.getElementById('emoji').value = emoji;
            updatePreview();
        }
        
        // Auto-update preview when form changes
        document.addEventListener('DOMContentLoaded', function() {
            ['template', 'title', 'description', 'theme', 'font', 'emoji'].forEach(id => {
                const element = document.getElementById(id);
                if (element) {
                    element.addEventListener('change', updatePreview);
                    element.addEventListener('input', updatePreview);
                }
            });
        });
    </script>
</body>
</html>`;
}