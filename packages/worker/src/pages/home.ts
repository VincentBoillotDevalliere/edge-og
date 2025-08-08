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
            word-break: break-all; /* Break long URLs */
            max-width: 100%; /* Ensure it doesn't overflow container */
        }
        .preview { 
            border: 2px solid #e2e8f0; 
            border-radius: 8px; 
            overflow: hidden;
            margin: 1rem 0;
            width: 100%;
            aspect-ratio: 1200/630; /* Maintain consistent 1200x630 aspect ratio */
            position: relative;
        }
        .preview img { 
            width: 100%; 
            height: 100%; 
            object-fit: cover; /* Ensures image fills container while maintaining aspect ratio */
            display: block;
            transition: opacity 0.3s ease; /* Smooth transition when image changes */
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
        <!-- Magic-Link Signup Section -->
        <div class="section">
            <h2><span class="emoji">🔐</span> Create Account (Magic-Link)</h2>
            <p>Test the AQ-1.1 magic-link account creation feature:</p>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; align-items: start; margin-top: 1.5rem;">
                <div>
                    <div class="form-group">
                        <label for="signup-email">Email Address</label>
                        <input type="email" id="signup-email" placeholder="your.email@example.com" required>
                    </div>
                    <button class="btn" onclick="requestMagicLink()" style="width: 100%; margin-top: 1rem;">
                        Send Magic Link ✨
                    </button>
                    <div id="signup-result" style="margin-top: 1rem; padding: 1rem; border-radius: 8px; display: none;"></div>
                </div>
                <div>
                    <h4>What this does:</h4>
                    <ul style="list-style-type: none; padding: 0; margin-top: 1rem;">
                        <li style="margin: 0.5rem 0; padding: 0.5rem; background: rgba(255,255,255,0.1); border-radius: 6px;">
                            <strong>1.</strong> Creates account with UUID in KV storage
                        </li>
                        <li style="margin: 0.5rem 0; padding: 0.5rem; background: rgba(255,255,255,0.1); border-radius: 6px;">
                            <strong>2.</strong> Hashes email with SHA-256 + pepper
                        </li>
                        <li style="margin: 0.5rem 0; padding: 0.5rem; background: rgba(255,255,255,0.1); border-radius: 6px;">
                            <strong>3.</strong> Sends magic-link via MailChannels
                        </li>
                        <li style="margin: 0.5rem 0; padding: 0.5rem; background: rgba(255,255,255,0.1); border-radius: 6px;">
                            <strong>4.</strong> Rate limiting: 5 req/IP/5min
                        </li>
                    </ul>
                </div>
            </div>
        </div>

        <!-- Quick Test Section -->
        <div class="quick-test">
            <h2><span class="emoji">⚡</span> Quick Test</h2>
            <p>Try generating an image right now with custom emoji:</p>
            <div class="code">${baseUrl}/og?template=blog&title=My%20Awesome%20Post&author=John%20Doe&theme=dark&font=playfair&emoji=🚀</div>
            <a href="${baseUrl}/og?template=blog&title=My%20Awesome%20Post&author=John%20Doe&theme=dark&font=playfair&emoji=🚀" class="btn" target="_blank">
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
                    <h3>✨ Rich Emoji Support</h3>
                    <p>🎨 Make your images stand out! Each template comes with beautiful default emojis, or customize with your own. Perfect for adding personality and increasing engagement - studies show emojis can boost click-through rates by up to 25%!</p>
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
                <div class="card">
                    <h3>emoji</h3>
                    <p>🎨 Custom emoji to enhance visual appeal</p>
                    <div class="badge">🚀</div>
                    <div class="badge">✨</div>
                    <div class="badge">🎯</div>
                    <div class="badge">💡</div>
                    <div class="badge">🔥</div>
                    <div class="badge">⚡</div>
                    <div class="badge">🎨</div>
                    <div class="badge">💎</div>
                    <div style="margin-top: 8px; font-size: 0.8rem; color: #666;">Each template has smart default emojis, but you can use any emoji to match your content theme! Studies show emojis increase engagement.</div>
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

# Using Custom Emojis (works with any template)
${baseUrl}/og?template=tech&title=New%20Release&description=Version%202.0&emoji=🚀
${baseUrl}/og?template=blog&title=Success%20Story&author=Jane&emoji=🎉
${baseUrl}/og?template=product&title=Premium%20Plan&price=$99&emoji=💎
${baseUrl}/og?template=event&title=Workshop&date=Next%20Friday&emoji=🎯

# Emoji Best Practices
# 🚀 Launch announcements    🎉 Celebrations & achievements
# 💡 Tips & educational      🔥 Trending & hot content  
# ⚡ Fast & performance      🎨 Creative & design
# 💎 Premium & exclusive     🏆 Awards & recognition
# 📚 Learning & courses      🎯 Goals & targeting
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
                        <label for="emoji">🎨 Custom Emoji (optional)</label>
                        <input type="text" id="emoji" placeholder="🚀" maxlength="10" style="font-size: 18px; text-align: center;">
                        <small style="color: #666; font-size: 11px;">✨ <strong>Make your images more attractive!</strong> Each template has default emojis, but you can add your own to match your brand or content.</small>
                        <div style="margin-top: 12px; padding: 10px; background: #f8fafc; border-radius: 6px; border-left: 3px solid #667eea;">
                            <div style="font-size: 14px; margin-bottom: 8px;">
                                <span style="color: #667eea; font-weight: 600;">✨ Popular choices:</span>
                            </div>
                            <div style="display: flex; flex-wrap: wrap; gap: 6px;">
                                <span class="emoji-picker" onclick="setEmoji('🚀')" style="cursor: pointer; padding: 6px 8px; background: white; border-radius: 4px; border: 1px solid #e2e8f0; font-size: 18px; transition: all 0.2s;" title="Rocket - Perfect for launches!">🚀</span>
                                <span class="emoji-picker" onclick="setEmoji('✨')" style="cursor: pointer; padding: 6px 8px; background: white; border-radius: 4px; border: 1px solid #e2e8f0; font-size: 18px; transition: all 0.2s;" title="Sparkles - Great for announcements">✨</span>
                                <span class="emoji-picker" onclick="setEmoji('🎯')" style="cursor: pointer; padding: 6px 8px; background: white; border-radius: 4px; border: 1px solid #e2e8f0; font-size: 18px; transition: all 0.2s;" title="Target - Ideal for goals">🎯</span>
                                <span class="emoji-picker" onclick="setEmoji('💡')" style="cursor: pointer; padding: 6px 8px; background: white; border-radius: 4px; border: 1px solid #e2e8f0; font-size: 18px; transition: all 0.2s;" title="Light bulb - For ideas & tips">💡</span>
                                <span class="emoji-picker" onclick="setEmoji('🔥')" style="cursor: pointer; padding: 6px 8px; background: white; border-radius: 4px; border: 1px solid #e2e8f0; font-size: 18px; transition: all 0.2s;" title="Fire - Hot content!">🔥</span>
                                <span class="emoji-picker" onclick="setEmoji('⚡')" style="cursor: pointer; padding: 6px 8px; background: white; border-radius: 4px; border: 1px solid #e2e8f0; font-size: 18px; transition: all 0.2s;" title="Lightning - Fast & powerful">⚡</span>
                                <span class="emoji-picker" onclick="setEmoji('🎨')" style="cursor: pointer; padding: 6px 8px; background: white; border-radius: 4px; border: 1px solid #e2e8f0; font-size: 18px; transition: all 0.2s;" title="Art palette - Creative content">🎨</span>
                                <span class="emoji-picker" onclick="setEmoji('💎')" style="cursor: pointer; padding: 6px 8px; background: white; border-radius: 4px; border: 1px solid #e2e8f0; font-size: 18px; transition: all 0.2s;" title="Diamond - Premium content">💎</span>
                                <span class="emoji-picker" onclick="setEmoji('🌟')" style="cursor: pointer; padding: 6px 8px; background: white; border-radius: 4px; border: 1px solid #e2e8f0; font-size: 18px; transition: all 0.2s;" title="Star - Featured content">🌟</span>
                                <span class="emoji-picker" onclick="setEmoji('🎉')" style="cursor: pointer; padding: 6px 8px; background: white; border-radius: 4px; border: 1px solid #e2e8f0; font-size: 18px; transition: all 0.2s;" title="Party - Celebrations">🎉</span>
                                <span class="emoji-picker" onclick="setEmoji('💪')" style="cursor: pointer; padding: 6px 8px; background: white; border-radius: 4px; border: 1px solid #e2e8f0; font-size: 18px; transition: all 0.2s;" title="Muscle - Strength & power">💪</span>
                                <span class="emoji-picker" onclick="setEmoji('🏆')" style="cursor: pointer; padding: 6px 8px; background: white; border-radius: 4px; border: 1px solid #e2e8f0; font-size: 18px; transition: all 0.2s;" title="Trophy - Achievements">🏆</span>
                            </div>
                            <div style="margin-top: 8px; font-size: 12px; color: #64748b;">
                                💡 <strong>Pro tip:</strong> Try using emojis that relate to your content theme - 📚 for education, 💻 for tech, 🎵 for music, etc.
                            </div>
                        </div>
                    </div>
                    <div class="form-group">
                        <label for="fontUrl">Custom Font URL (optional)</label>
                        <input type="url" id="fontUrl" placeholder="https://fonts.example.com/CustomFont.ttf" style="font-size: 12px;">
                        <small style="color: #666; font-size: 11px;">HTTPS URL to TTF, OTF, WOFF, or WOFF2 file. Overrides font selection above.</small>
                    </div>
                    <div class="form-group">
                        <label for="version">Cache Version (optional)</label>
                        <input type="text" id="version" placeholder="v1.0.0 or build-123" style="font-size: 12px;">
                        <small style="color: #666; font-size: 11px;">Adds v= query param to test cache invalidation behavior.</small>
                    </div>
                    <button class="btn" onclick="updatePreview()">Generate Preview</button>
                    <button class="btn-outline btn" onclick="copyUrl()">Copy URL</button>
                    <button class="btn-outline btn" style="margin-left: 8px;" onclick="testHeaders()">Test Headers</button>
                </div>
                <div style="min-width: 0; overflow: hidden;"> <!-- Prevent overflow from this column -->
                    <div class="preview">
                        <img id="preview-image" src="${baseUrl}/og?template=default&title=Welcome%20to%20Edge-OG&description=Generate%20beautiful%20Open%20Graph%20images" alt="Preview" style="width: 100%; height: 100%; object-fit: cover;">
                    </div>
                    <div style="margin-top: 1rem;">
                        <h4 style="margin-bottom: 0.5rem; font-size: 0.9rem; color: #2d3748;">Generated URL:</h4>
                        <div class="code" id="generated-url" style="font-size: 0.75rem; line-height: 1.4; max-height: 120px; overflow-y: auto;">${baseUrl}/og?template=default&title=Welcome%20to%20Edge-OG&description=Generate%20beautiful%20Open%20Graph%20images</div>
                        <div id="headers-result" style="display:none; margin-top: 0.75rem; padding: 0.75rem; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; font-family: monospace; font-size: 12px; color: #334155;"></div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Emoji Tips Section -->
        <div class="section" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border-radius: 12px; margin: 2rem 0;">
            <h2 style="color: white;"><span style="font-size: 1.5em;">🎨</span> Emoji Usage Tips</h2>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1.5rem;">
                <div style="background: rgba(255,255,255,0.1); padding: 1.5rem; border-radius: 8px; backdrop-filter: blur(10px);">
                    <h3 style="color: #ffd700; margin-bottom: 1rem;">🚀 Content Categories</h3>
                    <div style="font-size: 0.9rem; line-height: 1.6;">
                        <div><strong>🚀 Tech/Launch:</strong> 🚀⚡💻🔧⚙️🌐</div>
                        <div><strong>📚 Education:</strong> 📚🎓💡📖✏️🧠</div>
                        <div><strong>🎨 Creative:</strong> 🎨🎭🎪🌈✨🎬</div>
                        <div><strong>💼 Business:</strong> 💼📊💰🏆📈💎</div>
                        <div><strong>🎉 Events:</strong> 🎉🎯🎪🎊🏅🔥</div>
                    </div>
                </div>
                <div style="background: rgba(255,255,255,0.1); padding: 1.5rem; border-radius: 8px; backdrop-filter: blur(10px);">
                    <h3 style="color: #ffd700; margin-bottom: 1rem;">💡 Pro Tips</h3>
                    <div style="font-size: 0.9rem; line-height: 1.6;">
                        • <strong>Match your brand:</strong> Use emojis that align with your content theme<br>
                        • <strong>Less is more:</strong> One impactful emoji is better than many<br>
                        • <strong>Test variations:</strong> Different emojis can change engagement significantly<br>
                        • <strong>Consider context:</strong> Professional vs. casual audience<br>
                        • <strong>Stay relevant:</strong> Trending emojis can boost visibility
                    </div>
                </div>
                <div style="background: rgba(255,255,255,0.1); padding: 1.5rem; border-radius: 8px; backdrop-filter: blur(10px);">
                    <h3 style="color: #ffd700; margin-bottom: 1rem;">📊 Engagement Boost</h3>
                    <div style="font-size: 0.9rem; line-height: 1.6;">
                        <div style="margin-bottom: 0.5rem;"><strong>Studies show emojis can:</strong></div>
                        • Increase click-through rates by 25%<br>
                        • Improve social media engagement by 48%<br>
                        • Make content appear more friendly and approachable<br>
                        • Help content stand out in crowded feeds<br>
                        • Convey emotion and personality quickly
                    </div>
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

        <!-- Operations & Health -->
        <div class="section">
            <h2><span class="emoji">🩺</span> Ops & Health</h2>
            <div class="grid">
                <div class="card">
                    <h3>Health Check</h3>
                    <p>Ping the service health endpoint and view JSON response.</p>
                    <button class="btn" onclick="checkHealth()">Check Health</button>
                    <pre id="health-json" class="code" style="display:none; white-space: pre-wrap;"></pre>
                </div>
                <div class="card">
                    <h3>Dashboard</h3>
                    <p>Authenticated area to manage your API keys.</p>
                    <a class="btn-outline btn" href="${baseUrl}/dashboard">Open Dashboard</a>
                </div>
            </div>
        </div>

        <!-- Auth Tools & API Keys (works after magic-link login) -->
        <div class="section">
            <h2><span class="emoji">🔑</span> Auth Tools & API Keys</h2>
            <div class="grid">
                <div class="card">
                    <h3>Complete Login via Magic Link</h3>
                    <p>In development, the magic link URL is printed in logs. Paste it here to complete login.</p>
                    <input type="url" id="magicLinkUrl" placeholder="Paste magic link URL here" style="width: 100%; padding: 10px; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 12px;">
                    <button class="btn" style="margin-top: 10px;" onclick="completeLogin()">Open Magic Link</button>
                </div>
                <div class="card">
                    <h3>My API Keys</h3>
                    <p>Requires active session. Lists and lets you revoke keys.</p>
                    <div style="display:flex; gap: 8px; margin-bottom: 8px;">
                        <button class="btn" onclick="listAPIKeys()">List Keys</button>
                        <a class="btn-outline btn" href="${baseUrl}/dashboard/api-keys" target="_blank">Raw JSON</a>
                    </div>
                    <div id="api-keys-list" style="max-height: 220px; overflow: auto;"></div>
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
            const emoji = document.getElementById('emoji').value;
            const version = document.getElementById('version') ? document.getElementById('version').value : '';
            
            let url;
            
            // Handle Quote template differently - use description as the main quote text
            if (template === 'quote') {
                url = \`${baseUrl}/og?template=\${template}&title=\${description}&author=Edge-OG&theme=\${theme}&font=\${font}\`;
            } else {
                url = \`${baseUrl}/og?template=\${template}&title=\${title}&description=\${description}&theme=\${theme}&font=\${font}\`;
            }
            
            // Add emoji parameter if provided
            if (emoji && emoji.trim()) {
                url += \`&emoji=\${encodeURIComponent(emoji)}\`;
            }
            
            // Add fontUrl parameter if provided
            if (fontUrl && fontUrl.trim()) {
                url += \`&fontUrl=\${encodeURIComponent(fontUrl)}\`;
            }

            // Add version parameter if provided (for cache invalidation testing)
            if (version && version.trim()) {
                url += \`&v=\${encodeURIComponent(version)}\`;
            }
            
            // Add loading state and smooth transition
            const previewImg = document.getElementById('preview-image');
            previewImg.style.opacity = '0.7';
            
            // Create a new image to preload
            const newImg = new Image();
            newImg.onload = function() {
                previewImg.src = url;
                previewImg.style.opacity = '1';
            };
            newImg.src = url;
            
            document.getElementById('generated-url').textContent = url;
        }
        
        function copyUrl() {
            const url = document.getElementById('generated-url').textContent;
            navigator.clipboard.writeText(url).then(() => {
                alert('URL copied to clipboard! 📋');
            });
        }

    async function testHeaders() {
            const url = document.getElementById('generated-url').textContent.trim();
            const out = document.getElementById('headers-result');
            out.style.display = 'block';
            out.textContent = 'Fetching headers...';
            try {
                // Use GET to ensure we hit our worker, avoid opaque HEAD issues
                const res = await fetch(url, { method: 'GET', cache: 'no-store' });
                const cc = res.headers.get('Cache-Control');
                const etag = res.headers.get('ETag');
                const age = res.headers.get('Age');
                const vary = res.headers.get('Vary');
                // Build output safely without nested template strings
                const lines = [
                    'Status: ' + res.status,
                    'Cache-Control: ' + (cc || 'n/a'),
                    'ETag: ' + (etag || 'n/a'),
                    'Age: ' + (age || 'n/a'),
                    'Vary: ' + (vary || 'n/a')
                ];
                out.textContent = lines.join('\n');
            } catch (e) {
                out.textContent = 'Error fetching headers: ' + (e && e.message ? e.message : e);
            }
        }
        
        function setEmoji(emoji) {
            document.getElementById('emoji').value = emoji;
            updatePreview();
        }
        
        // Magic-link signup function
        async function requestMagicLink() {
            const email = document.getElementById('signup-email').value;
            const resultDiv = document.getElementById('signup-result');
            
            // Basic email validation
            if (!email || !email.includes('@')) {
                resultDiv.style.display = 'block';
                resultDiv.style.background = '#fee2e2';
                resultDiv.style.color = '#dc2626';
                resultDiv.innerHTML = '❌ Please enter a valid email address';
                return;
            }
            
            // Show loading state
            resultDiv.style.display = 'block';
            resultDiv.style.background = '#fef3c7';
            resultDiv.style.color = '#d97706';
            resultDiv.innerHTML = '⏳ Sending magic link...';
            
            try {
                const response = await fetch('${baseUrl}/auth/request-link', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ email })
                });
                
                const data = await response.json();
                
                if (response.ok) {
                    // Success
                    resultDiv.style.background = '#d1fae5';
                    resultDiv.style.color = '#065f46';
                    resultDiv.innerHTML = '✅ ' + data.message + '<br><small>Check your email for the magic link!</small>';
                } else {
                    // Error
                    resultDiv.style.background = '#fee2e2';
                    resultDiv.style.color = '#dc2626';
                    resultDiv.innerHTML = '❌ ' + (data.error || 'Failed to send magic link');
                }
            } catch (error) {
                // Network error
                resultDiv.style.background = '#fee2e2';
                resultDiv.style.color = '#dc2626';
                resultDiv.innerHTML = '❌ Network error. Please try again.';
            }
        }

        async function checkHealth() {
            const el = document.getElementById('health-json');
            el.style.display = 'block';
            el.textContent = 'Checking...';
            try {
                const res = await fetch('${baseUrl}/health');
                const json = await res.json();
                el.textContent = JSON.stringify(json, null, 2);
            } catch (e) {
                el.textContent = 'Failed to fetch health: ' + (e && e.message ? e.message : e);
            }
        }

        function completeLogin() {
            const url = document.getElementById('magicLinkUrl').value.trim();
            if (!url) return alert('Paste the magic link URL first.');
            // Navigate to the magic link so the cookie can be set by the redirect flow
            window.location.href = url;
        }

        async function listAPIKeys() {
            const container = document.getElementById('api-keys-list');
            container.innerHTML = 'Loading...';
            try {
                const res = await fetch('${baseUrl}/dashboard/api-keys');
                const data = await res.json();
                if (!res.ok) {
                    container.innerHTML = '<div style="color:#b91c1c;">Error: ' + (data.error || res.status) + '</div>';
                    return;
                }
                if (!data.api_keys || data.api_keys.length === 0) {
                    container.innerHTML = '<em>No API keys yet.</em>';
                    return;
                }
                container.innerHTML = '';
                data.api_keys.forEach((k: any) => {
                    const row = document.createElement('div');
                    row.style.cssText = 'display:flex; align-items:center; justify-content:space-between; padding:8px; border:1px solid #e2e8f0; border-radius:6px; margin:6px 0; background:#fff;';
                    const info = document.createElement('div');
                    info.innerHTML = '<strong>' + k.name + '</strong><br><small>prefix: ' + k.prefix + ' • created: ' + k.created + ' • revoked: ' + (k.revoked ? 'yes' : 'no') + '</small>';
                    const actions = document.createElement('div');
                    const btn = document.createElement('button');
                    btn.className = 'btn-outline btn';
                    btn.textContent = 'Revoke';
                    btn.disabled = !!k.revoked;
                    btn.onclick = async () => {
                        await revokeAPIKey(k.id);
                        listAPIKeys();
                    };
                    actions.appendChild(btn);
                    row.appendChild(info);
                    row.appendChild(actions);
                    container.appendChild(row);
                });
            } catch (e) {
                container.innerHTML = 'Failed to list keys: ' + (e && e.message ? e.message : e);
            }
        }

        async function revokeAPIKey(id) {
            if (!id) return;
            const sure = confirm('Revoke this API key? This cannot be undone.');
            if (!sure) return;
            try {
                const res = await fetch('${baseUrl}/dashboard/api-keys/' + encodeURIComponent(id), { method: 'DELETE' });
                const data = await res.json();
                if (!res.ok) alert('Error: ' + (data.error || res.status));
            } catch (e) {
                alert('Failed to revoke key: ' + (e && e.message ? e.message : e));
            }
        }
        
        // Update preview when form changes
        document.addEventListener('DOMContentLoaded', function() {
            ['template', 'title', 'description', 'theme', 'font', 'fontUrl', 'emoji', 'version'].forEach(id => {
                document.getElementById(id).addEventListener('change', updatePreview);
                document.getElementById(id).addEventListener('input', updatePreview);
            });
        });
    </script>
</body>
</html>`;
}
