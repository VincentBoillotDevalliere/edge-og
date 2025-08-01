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
        
        /* Account Management Styles */
        .tab-btn {
            background: none;
            border: none;
            padding: 0.75rem 1.5rem;
            cursor: pointer;
            border-bottom: 2px solid transparent;
            transition: all 0.2s;
            font-weight: 500;
        }
        
        .tab-btn:hover {
            background: #f8fafc;
        }
        
        .tab-btn.active {
            border-bottom-color: #3b82f6;
            color: #3b82f6;
        }
        
        .tab-content {
            display: none;
        }
        
        .tab-content.active {
            display: block;
        }
        
        .form-group {
            margin-bottom: 1rem;
        }
        
        .form-group label {
            display: block;
            margin-bottom: 0.5rem;
            font-weight: 500;
            color: #374151;
        }
        
        .form-group input,
        .form-group select {
            width: 100%;
            padding: 0.75rem;
            border: 2px solid #e2e8f0;
            border-radius: 8px;
            font-size: 1rem;
            transition: border-color 0.2s;
        }
        
        .form-group input:focus,
        .form-group select:focus {
            outline: none;
            border-color: #3b82f6;
        }
        
        .card {
            padding: 1.5rem;
            border: 2px solid #e2e8f0;
            border-radius: 12px;
            background: #fafafa;
            margin-bottom: 1rem;
        }
        
        .card h3,
        .card h4 {
            margin-top: 0;
            margin-bottom: 1rem;
        }
        
        .api-key-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 0.75rem;
            background: white;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            margin-bottom: 0.5rem;
        }
        
        .api-key-info {
            flex: 1;
        }
        
        .api-key-actions {
            display: flex;
            gap: 0.5rem;
        }
        
        .btn-small {
            padding: 0.25rem 0.5rem;
            font-size: 0.8rem;
            border: 1px solid #e2e8f0;
            background: white;
            border-radius: 4px;
            cursor: pointer;
            transition: all 0.2s;
        }
        
        .btn-small:hover {
            background: #f8fafc;
        }
        
        .btn-danger {
            color: #dc2626;
            border-color: #dc2626;
        }
        
        .btn-danger:hover {
            background: #fef2f2;
        }
        
        .result { 
            margin-top: 1rem; 
            padding: 1rem; 
            border-radius: 8px; 
            font-family: 'JetBrains Mono', monospace; 
            font-size: 0.9rem; 
            white-space: pre-wrap; 
            word-break: break-all; 
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
            <div class="dev-notice" style="background: linear-gradient(135deg, #ffeaa7, #fdcb6e); padding: 1rem; border-radius: 8px; margin-bottom: 1.5rem; border-left: 4px solid #e17055;">
                <p style="margin: 0; font-size: 0.9rem; color: #2d3436;">
                    <strong>🔧 Development Mode:</strong> In local development, PNG conversion is not available due to WASM restrictions. 
                    Images will automatically fallback to SVG format. Deploy to Cloudflare Workers for full PNG functionality.
                </p>
            </div>
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
                    <div class="code" style="margin: 0.5rem 0; font-size: 0.75rem;">POST /api/keys</div>
                    <p>Create new API keys with custom quotas (worker-only)</p>
                </div>
                <div class="card">
                    <h3>� List API Keys</h3>
                    <div class="code" style="margin: 0.5rem 0; font-size: 0.75rem;">GET /api/keys?userId={email}</div>
                    <p>List user's API keys and usage stats</p>
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

        <!-- API Key Management -->
        <div class="section">
            <h2><span class="emoji">🔑</span> API Key Management</h2>
            <p>Create and manage API keys for production usage with custom quotas and monitoring.</p>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; margin-top: 2rem;">
                <!-- Create API Key -->
                <div>
                    <h3>Create New API Key</h3>
                    <div class="form-group">
                        <label for="keyName">Key Name</label>
                        <input type="text" id="keyName" placeholder="My Project API Key" maxlength="50">
                    </div>
                    <div class="form-group">
                        <label for="userId">User ID (email)</label>
                        <input type="email" id="userId" placeholder="user@example.com">
                    </div>
                    <div class="form-group">
                        <label for="quotaLimit">Monthly Quota</label>
                        <select id="quotaLimit">
                            <option value="1000">1,000 requests/month (Free)</option>
                            <option value="10000">10,000 requests/month (Pro)</option>
                            <option value="100000">100,000 requests/month (Business)</option>
                            <option value="1000000">1,000,000 requests/month (Enterprise)</option>
                        </select>
                    </div>
                    <button class="btn" onclick="createApiKey()" id="createKeyBtn">
                        🔑 Create API Key
                    </button>
                    <div id="createKeyResult" style="margin-top: 1rem; padding: 1rem; border-radius: 8px; display: none;"></div>
                </div>

                <!-- Manage API Keys -->
                <div>
                    <h3>Manage Existing Keys</h3>
                    <div class="form-group">
                        <label for="managementUserId">User ID (email)</label>
                        <input type="email" id="managementUserId" placeholder="user@example.com">
                    </div>
                    <button class="btn-outline btn" onclick="loadApiKeys()">
                        📋 Load My API Keys
                    </button>
                    <div id="apiKeysList" style="margin-top: 1rem;"></div>
                </div>
            </div>

            <div style="margin-top: 2rem; padding: 1.5rem; background: #f8f9fa; border-radius: 10px; border-left: 4px solid #667eea;">
                <h4 style="margin-bottom: 1rem; color: #2d3748;">🔒 Security & Usage</h4>
                <ul style="color: #4a5568; line-height: 1.8;">
                    <li><strong>Keep your API key secure</strong> - Never expose it in client-side code</li>
                    <li><strong>Use environment variables</strong> - Store keys securely in your application</li>
                    <li><strong>Monitor usage</strong> - Track your quota consumption and request patterns</li>
                    <li><strong>Revoke when needed</strong> - Remove unused or compromised keys immediately</li>
                </ul>
            </div>
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

        <!-- Account Management -->
        <div class="section">
            <h2><span class="emoji">👤</span> Account Management</h2>
            <p style="margin-bottom: 2rem; color: #666;">Create an account to get API keys with quota management and usage analytics.</p>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; align-items: start;">
                <div>
                    <div id="auth-tabs" style="display: flex; margin-bottom: 1.5rem; border-bottom: 2px solid #e2e8f0;">
                        <button class="tab-btn active" onclick="showTab('register')">Register</button>
                        <button class="tab-btn" onclick="showTab('login')">Login</button>
                        <button class="tab-btn" onclick="showTab('dashboard')">Dashboard</button>
                    </div>

                    <!-- Registration Form -->
                    <div id="register-tab" class="tab-content active">
                        <h3>Create Account</h3>
                        <div class="form-group">
                            <label for="register-email">Email Address</label>
                            <input type="email" id="register-email" placeholder="your.email@example.com" required>
                        </div>
                        <div class="form-group">
                            <label for="subscription-tier">Subscription Tier</label>
                            <select id="subscription-tier">
                                <option value="free">Free - 1,000 requests/month</option>
                                <option value="starter">Starter - 10,000 requests/month</option>
                                <option value="pro">Pro - 100,000 requests/month</option>
                            </select>
                        </div>
                        <button onclick="registerAccount()" class="btn" style="width: 100%;">Create Account</button>
                        <div id="register-result" class="result" style="display: none;"></div>
                        
                        <div id="verification-section" style="display: none; margin-top: 1.5rem; padding: 1rem; background: #f0f9ff; border-radius: 8px; border: 1px solid #3b82f6;">
                            <h4>📧 Email Verification</h4>
                            <p>We've sent a verification token to your email. Enter it below:</p>
                            <div class="form-group">
                                <input type="text" id="verification-token" placeholder="Enter verification token">
                            </div>
                            <button onclick="verifyEmail()" class="btn" style="width: 100%;">Verify Email</button>
                            <div id="verify-result" class="result" style="display: none;"></div>
                        </div>
                    </div>

                    <!-- Login Form -->
                    <div id="login-tab" class="tab-content">
                        <h3>Account Login</h3>
                        <div class="form-group">
                            <label for="login-account-id">Account ID</label>
                            <input type="text" id="login-account-id" placeholder="Enter your account ID">
                        </div>
                        <button onclick="loadAccount()" class="btn" style="width: 100%;">Load Account</button>
                        <div id="login-result" class="result" style="display: none;"></div>
                    </div>

                    <!-- Dashboard -->
                    <div id="dashboard-tab" class="tab-content">
                        <div id="account-info" style="display: none;">
                            <h3>Account Dashboard</h3>
                            <div class="card" style="margin-bottom: 1rem;">
                                <h4>Account Information</h4>
                                <p><strong>Email:</strong> <span id="account-email">-</span></p>
                                <p><strong>Tier:</strong> <span id="account-tier">-</span></p>
                                <p><strong>Status:</strong> <span id="account-status">-</span></p>
                            </div>
                            
                            <div class="card" style="margin-bottom: 1rem;">
                                <h4>Usage Statistics</h4>
                                <div style="display: flex; justify-content: space-between; align-items: center;">
                                    <div>
                                        <p><strong>Used:</strong> <span id="quota-used">0</span></p>
                                        <p><strong>Limit:</strong> <span id="quota-limit">0</span></p>
                                    </div>
                                    <div style="text-align: right;">
                                        <div class="progress-bar" style="width: 200px; height: 20px; background: #e2e8f0; border-radius: 10px; overflow: hidden;">
                                            <div id="quota-progress" style="height: 100%; background: linear-gradient(135deg, #4ade80, #22c55e); width: 0%; transition: width 0.3s;"></div>
                                        </div>
                                        <p style="font-size: 0.8rem; color: #666; margin-top: 0.5rem;">Next reset: <span id="quota-reset">-</span></p>
                                    </div>
                                </div>
                            </div>

                            <div class="card">
                                <h4>API Key Management</h4>
                                <button onclick="createApiKey()" class="btn" style="margin-bottom: 1rem;">Create New API Key</button>
                                <div id="api-keys-list"></div>
                                <div id="api-key-result" class="result" style="display: none;"></div>
                            </div>
                        </div>
                        
                        <div id="no-account" style="text-align: center; padding: 2rem; color: #666;">
                            <p>Please register or login to view your dashboard.</p>
                        </div>
                    </div>
                </div>

                <div>
                    <div class="card">
                        <h3>📊 Subscription Tiers</h3>
                        <div style="margin: 1rem 0;">
                            <div style="padding: 1rem; border: 2px solid #22c55e; border-radius: 8px; margin-bottom: 1rem; background: #f0fdf4;">
                                <h4 style="color: #22c55e; margin: 0 0 0.5rem 0;">Free Tier</h4>
                                <p style="margin: 0; font-size: 0.9rem;">✅ 1,000 requests/month<br>✅ All 11 templates<br>✅ Basic support</p>
                            </div>
                            <div style="padding: 1rem; border: 2px solid #3b82f6; border-radius: 8px; margin-bottom: 1rem; background: #f0f9ff;">
                                <h4 style="color: #3b82f6; margin: 0 0 0.5rem 0;">Starter Tier</h4>
                                <p style="margin: 0; font-size: 0.9rem;">✅ 10,000 requests/month<br>✅ All templates & themes<br>✅ Priority support</p>
                            </div>
                            <div style="padding: 1rem; border: 2px solid #7c3aed; border-radius: 8px; background: #faf5ff;">
                                <h4 style="color: #7c3aed; margin: 0 0 0.5rem 0;">Pro Tier</h4>
                                <p style="margin: 0; font-size: 0.9rem;">✅ 100,000 requests/month<br>✅ Custom fonts support<br>✅ Dedicated support</p>
                            </div>
                        </div>
                    </div>

                    <div class="card" style="margin-top: 1.5rem;">
                        <h3>🔐 Security Features</h3>
                        <ul style="margin: 0; padding-left: 1.5rem;">
                            <li>Email verification required</li>
                            <li>Secure API key generation</li>
                            <li>Usage quota monitoring</li>
                            <li>Account-based access control</li>
                            <li>Automatic key rotation support</li>
                        </ul>
                    </div>
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

        // API Key Management Functions
        async function createApiKey() {
            const keyName = document.getElementById('keyName').value.trim();
            const userId = document.getElementById('userId').value.trim();
            const quotaLimit = parseInt(document.getElementById('quotaLimit').value);
            const resultDiv = document.getElementById('createKeyResult');
            const createBtn = document.getElementById('createKeyBtn');
            
            if (!keyName || !userId) {
                showResult(resultDiv, 'Please fill in all fields', 'error');
                return;
            }
            
            if (!userId.includes('@')) {
                showResult(resultDiv, 'Please enter a valid email address', 'error');
                return;
            }
            
            createBtn.textContent = '⏳ Creating...';
            createBtn.disabled = true;
            
            try {
                const response = await fetch('${baseUrl}/api/keys', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        name: keyName,
                        userId: userId,
                        quotaLimit: quotaLimit
                    })
                });
                
                const data = await response.json();
                
                if (response.ok) {
                    showResult(resultDiv, 
                        \`✅ API Key Created Successfully!<br><br>
                        <strong>🔑 Your API Key:</strong><br>
                        <code style="background: #2d3748; color: #e2e8f0; padding: 0.5rem; border-radius: 4px; word-break: break-all; display: block; margin: 0.5rem 0;">\${data.key}</code>
                        <br><strong>⚠️ Important:</strong> Copy this key now - it won't be shown again!<br>
                        <strong>📊 Quota:</strong> \${quotaLimit.toLocaleString()} requests/month<br>
                        <button onclick="copyToClipboard('\${data.key}')" class="btn" style="margin-top: 0.5rem; font-size: 0.8rem;">📋 Copy Key</button>\`, 
                        'success'
                    );
                    
                    // Clear the form
                    document.getElementById('keyName').value = '';
                    document.getElementById('userId').value = '';
                } else {
                    showResult(resultDiv, \`❌ Error: \${data.error || 'Failed to create API key'}\`, 'error');
                }
            } catch (error) {
                showResult(resultDiv, \`❌ Network Error: \${error.message}\`, 'error');
            } finally {
                createBtn.textContent = '🔑 Create API Key';
                createBtn.disabled = false;
            }
        }
        
        async function loadApiKeys() {
            const userId = document.getElementById('managementUserId').value.trim();
            const listDiv = document.getElementById('apiKeysList');
            
            if (!userId) {
                showResult(listDiv, 'Please enter your email address', 'error');
                return;
            }
            
            listDiv.innerHTML = '⏳ Loading your API keys...';
            
            try {
                const response = await fetch(\`${baseUrl}/api/keys?userId=\${encodeURIComponent(userId)}\`);
                const data = await response.json();
                
                if (response.ok && data.keys) {
                    if (data.keys.length === 0) {
                        listDiv.innerHTML = '<p style="color: #666; text-align: center; padding: 2rem;">No API keys found for this user.</p>';
                        return;
                    }
                    
                    let keysHtml = '<div style="margin-top: 1rem;">';
                    data.keys.forEach(key => {
                        const usagePercent = key.quotaLimit > 0 ? (key.quotaUsed / key.quotaLimit * 100).toFixed(1) : 0;
                        const statusColor = key.active ? '#22c55e' : '#ef4444';
                        const usageColor = usagePercent > 80 ? '#ef4444' : usagePercent > 60 ? '#f59e0b' : '#22c55e';
                        
                        keysHtml += \`
                        <div style="border: 1px solid #e2e8f0; border-radius: 8px; padding: 1rem; margin-bottom: 1rem; background: white;">
                            <div style="display: flex; justify-content: between; align-items: start; margin-bottom: 0.5rem;">
                                <h4 style="margin: 0; color: #2d3748;">\${key.name}</h4>
                                <span style="background: \${statusColor}; color: white; padding: 0.25rem 0.5rem; border-radius: 12px; font-size: 0.75rem;">
                                    \${key.active ? 'Active' : 'Inactive'}
                                </span>
                            </div>
                            <p style="font-size: 0.85rem; color: #666; margin: 0.25rem 0;">
                                <strong>Key ID:</strong> \${key.id}<br>
                                <strong>Created:</strong> \${new Date(key.createdAt).toLocaleDateString()}<br>
                                <strong>Last Used:</strong> \${key.lastUsedAt ? new Date(key.lastUsedAt).toLocaleDateString() : 'Never'}
                            </p>
                            <div style="margin: 0.5rem 0;">
                                <div style="background: #f1f5f9; border-radius: 4px; padding: 0.5rem; font-size: 0.85rem;">
                                    <strong>Usage:</strong> \${key.quotaUsed.toLocaleString()} / \${key.quotaLimit.toLocaleString()} requests
                                    <div style="background: #e2e8f0; height: 4px; border-radius: 2px; margin-top: 0.25rem;">
                                        <div style="background: \${usageColor}; height: 100%; width: \${Math.min(usagePercent, 100)}%; border-radius: 2px;"></div>
                                    </div>
                                </div>
                            </div>
                            \${key.active ? \`<button onclick="revokeApiKey('\${key.id}', '\${userId}')" class="btn-outline btn" style="font-size: 0.8rem; padding: 0.5rem 1rem;">🗑️ Revoke Key</button>\` : ''}
                        </div>\`;
                    });
                    keysHtml += '</div>';
                    
                    listDiv.innerHTML = keysHtml;
                } else {
                    showResult(listDiv, \`❌ Error: \${data.error || 'Failed to load API keys'}\`, 'error');
                }
            } catch (error) {
                showResult(listDiv, \`❌ Network Error: \${error.message}\`, 'error');
            }
        }
        
        async function revokeApiKey(keyId, userId) {
            if (!confirm('Are you sure you want to revoke this API key? This action cannot be undone.')) {
                return;
            }
            
            try {
                const response = await fetch(\`${baseUrl}/api/keys/\${keyId}?userId=\${encodeURIComponent(userId)}\`, {
                    method: 'DELETE'
                });
                
                const data = await response.json();
                
                if (response.ok) {
                    alert('✅ API key revoked successfully!');
                    // Reload the keys list
                    document.getElementById('managementUserId').value = userId;
                    loadApiKeys();
                } else {
                    alert(\`❌ Error: \${data.error || 'Failed to revoke API key'}\`);
                }
            } catch (error) {
                alert(\`❌ Network Error: \${error.message}\`);
            }
        }
        
        function copyToClipboard(text) {
            navigator.clipboard.writeText(text).then(() => {
                alert('✅ API key copied to clipboard!');
            }).catch(() => {
                alert('❌ Failed to copy to clipboard. Please copy manually.');
            });
        }
        
        // Account Management Functions
        function showTab(tabName) {
            // Hide all tabs
            document.querySelectorAll('.tab-content').forEach(tab => {
                tab.classList.remove('active');
            });
            document.querySelectorAll('.tab-btn').forEach(btn => {
                btn.classList.remove('active');
            });
            
            // Show selected tab
            document.getElementById(tabName + '-tab').classList.add('active');
            event.target.classList.add('active');
            
            // Load account data if switching to dashboard
            if (tabName === 'dashboard') {
                loadAccountDashboard();
            }
        }
        
        async function registerAccount() {
            const email = document.getElementById('register-email').value;
            const tier = document.getElementById('subscription-tier').value;
            const resultDiv = document.getElementById('register-result');
            
            if (!email) {
                showResult(resultDiv, 'Please enter your email address', 'error');
                return;
            }
            
            if (!email.includes('@') || !email.includes('.')) {
                showResult(resultDiv, 'Please enter a valid email address', 'error');
                return;
            }
            
            try {
                const response = await fetch('/accounts/register', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        email: email,
                        subscriptionTier: tier
                    })
                });
                
                const data = await response.json();
                
                if (response.ok) {
                    showResult(resultDiv, 
                        \`✅ Account created successfully!<br><br>
                        <strong>Account ID:</strong> \${data.accountId}<br>
                        <strong>Email:</strong> \${data.email}<br>
                        <strong>Tier:</strong> \${data.subscriptionTier}<br><br>
                        A verification token has been sent to your email.\`, 
                        'success'
                    );
                    
                    // Show verification section
                    document.getElementById('verification-section').style.display = 'block';
                    
                    // Store account ID for verification
                    window.currentAccountId = data.accountId;
                } else {
                    showResult(resultDiv, \`❌ Error: \${data.error || 'Failed to create account'}\`, 'error');
                }
            } catch (error) {
                showResult(resultDiv, \`❌ Network Error: \${error.message}\`, 'error');
            }
        }
        
        async function verifyEmail() {
            const token = document.getElementById('verification-token').value;
            const resultDiv = document.getElementById('verify-result');
            
            if (!token) {
                showResult(resultDiv, 'Please enter the verification token', 'error');
                return;
            }
            
            if (!window.currentAccountId) {
                showResult(resultDiv, 'Please register an account first', 'error');
                return;
            }
            
            try {
                const response = await fetch('/accounts/verify', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        accountId: window.currentAccountId,
                        token: token
                    })
                });
                
                const data = await response.json();
                
                if (response.ok) {
                    showResult(resultDiv, 
                        \`✅ Email verified successfully!<br><br>
                        Your account is now active and ready to use.<br>
                        You can now create API keys in the Dashboard tab.\`, 
                        'success'
                    );
                    
                    // Store account for later use
                    localStorage.setItem('edgeOgAccountId', window.currentAccountId);
                    
                    // Switch to dashboard tab
                    setTimeout(() => {
                        showTab('dashboard');
                    }, 2000);
                } else {
                    showResult(resultDiv, \`❌ Error: \${data.error || 'Failed to verify email'}\`, 'error');
                }
            } catch (error) {
                showResult(resultDiv, \`❌ Network Error: \${error.message}\`, 'error');
            }
        }
        
        async function loadAccount() {
            const accountId = document.getElementById('login-account-id').value;
            const resultDiv = document.getElementById('login-result');
            
            if (!accountId) {
                showResult(resultDiv, 'Please enter your account ID', 'error');
                return;
            }
            
            try {
                const response = await fetch(\`/accounts/\${accountId}\`, {
                    method: 'GET',
                });
                
                const data = await response.json();
                
                if (response.ok) {
                    showResult(resultDiv, 
                        \`✅ Account loaded successfully!<br><br>
                        <strong>Email:</strong> \${data.email}<br>
                        <strong>Tier:</strong> \${data.subscriptionTier}<br>
                        <strong>Status:</strong> \${data.status}\`, 
                        'success'
                    );
                    
                    // Store account for later use
                    localStorage.setItem('edgeOgAccountId', accountId);
                    window.currentAccountId = accountId;
                    
                    // Switch to dashboard tab
                    setTimeout(() => {
                        showTab('dashboard');
                    }, 1500);
                } else {
                    showResult(resultDiv, \`❌ Error: \${data.error || 'Account not found'}\`, 'error');
                }
            } catch (error) {
                showResult(resultDiv, \`❌ Network Error: \${error.message}\`, 'error');
            }
        }
        
        async function loadAccountDashboard() {
            const accountId = window.currentAccountId || localStorage.getItem('edgeOgAccountId');
            
            if (!accountId) {
                document.getElementById('account-info').style.display = 'none';
                document.getElementById('no-account').style.display = 'block';
                return;
            }
            
            try {
                // Load account info
                const accountResponse = await fetch(\`/accounts/\${accountId}\`);
                const accountData = await accountResponse.json();
                
                if (accountResponse.ok) {
                    document.getElementById('account-email').textContent = accountData.email;
                    document.getElementById('account-tier').textContent = accountData.subscriptionTier;
                    document.getElementById('account-status').textContent = accountData.status;
                    
                    // Load quota info
                    const quotaResponse = await fetch(\`/accounts/\${accountId}/quota\`);
                    const quotaData = await quotaResponse.json();
                    
                    if (quotaResponse.ok) {
                        document.getElementById('quota-used').textContent = quotaData.used.toLocaleString();
                        document.getElementById('quota-limit').textContent = quotaData.limit.toLocaleString();
                        
                        const percentage = Math.min((quotaData.used / quotaData.limit) * 100, 100);
                        document.getElementById('quota-progress').style.width = percentage + '%';
                        
                        // Calculate next reset date
                        const resetDate = new Date(quotaData.resetAt);
                        document.getElementById('quota-reset').textContent = resetDate.toLocaleDateString();
                    }
                    
                    // Load API keys
                    await loadApiKeys(accountId);
                    
                    document.getElementById('account-info').style.display = 'block';
                    document.getElementById('no-account').style.display = 'none';
                } else {
                    document.getElementById('account-info').style.display = 'none';
                    document.getElementById('no-account').style.display = 'block';
                }
            } catch (error) {
                console.error('Error loading dashboard:', error);
                document.getElementById('account-info').style.display = 'none';
                document.getElementById('no-account').style.display = 'block';
            }
        }
        
        async function loadApiKeys(accountId) {
            try {
                const response = await fetch(\`/accounts/\${accountId}/keys\`);
                const data = await response.json();
                
                const keysList = document.getElementById('api-keys-list');
                
                if (response.ok && data.keys && data.keys.length > 0) {
                    keysList.innerHTML = data.keys.map(key => \`
                        <div class="api-key-item">
                            <div class="api-key-info">
                                <div><strong>\${key.name}</strong></div>
                                <div style="font-size: 0.8rem; color: #666;">
                                    Created: \${new Date(key.createdAt).toLocaleDateString()}
                                    | Used: \${key.usageCount.toLocaleString()} times
                                </div>
                            </div>
                            <div class="api-key-actions">
                                <button class="btn-small" onclick="copyToClipboard('\${key.keyHash}', this)">Copy</button>
                                <button class="btn-small btn-danger" onclick="revokeApiKey('\${key.id}', '\${accountId}')">Revoke</button>
                            </div>
                        </div>
                    \`).join('');
                } else {
                    keysList.innerHTML = '<p style="color: #666; text-align: center; padding: 1rem;">No API keys found. Create your first key above.</p>';
                }
            } catch (error) {
                console.error('Error loading API keys:', error);
                document.getElementById('api-keys-list').innerHTML = '<p style="color: #ef4444; text-align: center; padding: 1rem;">Error loading API keys</p>';
            }
        }
        
        async function createApiKey() {
            const accountId = window.currentAccountId || localStorage.getItem('edgeOgAccountId');
            const resultDiv = document.getElementById('api-key-result');
            
            if (!accountId) {
                showResult(resultDiv, 'Please login first', 'error');
                return;
            }
            
            const keyName = prompt('Enter a name for your API key:');
            if (!keyName) {
                return;
            }
            
            try {
                const response = await fetch(\`/accounts/\${accountId}/keys\`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        name: keyName
                    })
                });
                
                const data = await response.json();
                
                if (response.ok) {
                    showResult(resultDiv, 
                        \`✅ API Key Created Successfully!<br><br>
                        <strong>🔑 Your API Key:</strong><br>
                        <code style="background: #2d3748; color: #e2e8f0; padding: 0.5rem; border-radius: 4px; word-break: break-all; display: block; margin: 0.5rem 0;">\${data.key}</code>
                        <br><strong>⚠️ Important:</strong> Copy this key now - it won't be shown again!<br>
                        <button onclick="copyToClipboard('\${data.key}')" class="btn" style="margin-top: 0.5rem; font-size: 0.8rem;">📋 Copy Key</button>\`, 
                        'success'
                    );
                    
                    // Reload the keys list
                    setTimeout(() => {
                        loadApiKeys(accountId);
                    }, 2000);
                } else {
                    showResult(resultDiv, \`❌ Error: \${data.error || 'Failed to create API key'}\`, 'error');
                }
            } catch (error) {
                showResult(resultDiv, \`❌ Network Error: \${error.message}\`, 'error');
            }
        }
        
        async function revokeApiKey(keyId, accountId) {
            if (!confirm('Are you sure you want to revoke this API key? This action cannot be undone.')) {
                return;
            }
            
            try {
                const response = await fetch(\`/accounts/\${accountId}/keys/\${keyId}\`, {
                    method: 'DELETE'
                });
                
                if (response.ok) {
                    // Reload the keys list
                    loadApiKeys(accountId);
                } else {
                    const data = await response.json();
                    alert('Error revoking API key: ' + (data.error || 'Unknown error'));
                }
            } catch (error) {
                alert('Network error: ' + error.message);
            }
        }
        
        // Load account on page load if available
        window.addEventListener('load', () => {
            const accountId = localStorage.getItem('edgeOgAccountId');
            if (accountId) {
                window.currentAccountId = accountId;
            }
        });
        
        function showResult(element, message, type) {
            element.style.display = 'block';
            element.style.background = type === 'success' ? '#f0f9ff' : '#fef2f2';
            element.style.border = type === 'success' ? '1px solid #22c55e' : '1px solid #ef4444';
            element.style.color = type === 'success' ? '#166534' : '#dc2626';
            element.innerHTML = message;
        }
    </script>
</body>
</html>`;
}