import { describe, it, expect } from 'vitest';
import { getThemeColors, getFontFamily, sanitizeText, getTemplateEmoji } from '../src/templates/utils';

describe('Template Utilities (CG-3)', () => {
	describe('getThemeColors', () => {
		it('returns correct colors for light theme', () => {
			const colors = getThemeColors('light');
			expect(colors.backgroundColor).toBe('#ffffff');
			expect(colors.textColor).toBe('#1a1a1a');
			expect(colors.accentColor).toBe('#2563eb');
		});

		it('returns correct colors for dark theme', () => {
			const colors = getThemeColors('dark');
			expect(colors.backgroundColor).toBe('#1a1a1a');
			expect(colors.textColor).toBe('#ffffff');
			expect(colors.accentColor).toBe('#3b82f6');
		});

		it('falls back to light theme for invalid theme', () => {
			// @ts-expect-error - testing invalid input
			const colors = getThemeColors('invalid');
			expect(colors.backgroundColor).toBe('#ffffff');
		});
	});

	describe('getFontFamily', () => {
		it('returns correct font families', () => {
			expect(getFontFamily('inter')).toBe('Inter, sans-serif');
			expect(getFontFamily('roboto')).toBe('Roboto, sans-serif');
			expect(getFontFamily('playfair')).toBe('Playfair Display, serif');
			expect(getFontFamily('opensans')).toBe('Open Sans, sans-serif');
		});

		it('falls back to inter for invalid font', () => {
			// @ts-expect-error - testing invalid input
			const font = getFontFamily('invalid');
			expect(font).toBe('Inter, sans-serif');
		});

		// CG-4: Test custom font URL support
		it('returns custom font family from URL', () => {
			const customUrl = 'https://fonts.example.com/MyCustomFont.ttf';
			const font = getFontFamily('inter', customUrl);
			expect(font).toBe('MyCustomFont, sans-serif');
		});

		it('falls back to selected font for invalid custom URL', () => {
			const invalidUrl = 'not-a-url';
			const font = getFontFamily('roboto', invalidUrl);
			expect(font).toBe('Roboto, sans-serif');
		});
	});

	describe('sanitizeText', () => {
		it('sanitizes text correctly', () => {
			expect(sanitizeText('Hello World')).toBe('Hello World');
			expect(sanitizeText('Hello<script>alert("xss")</script>')).toBe('Hello script alert( xss ) script');
			// CG-5: Updated to preserve special characters and accents for more attractive templates
			expect(sanitizeText('Café')).toBe('Café');
		});

		it('preserves emojis and special characters (CG-5)', () => {
			// CG-5: Verify that emojis and special characters are preserved
			expect(sanitizeText('Hello 🌟 World')).toBe('Hello 🌟 World');
			expect(sanitizeText('Product 🚀 Launch')).toBe('Product 🚀 Launch');
			expect(sanitizeText('Event 🎯 2024')).toBe('Event 🎯 2024');
			expect(sanitizeText('Café & Restaurant')).toBe('Café & Restaurant');
		});

		it('handles empty input', () => {
			expect(sanitizeText('')).toBe('');
			expect(sanitizeText(null as any)).toBe('');
			expect(sanitizeText(undefined as any)).toBe('');
		});

		it('normalizes whitespace', () => {
			expect(sanitizeText('  Multiple   spaces  ')).toBe('Multiple spaces');
		});
	});
});

describe('Template Registry (CG-3)', () => {
	it('exports all required templates', async () => {
		const templates = await import('../src/templates/index');
		
		expect(templates.DefaultTemplate).toBeDefined();
		expect(templates.BlogTemplate).toBeDefined();
		expect(templates.ProductTemplate).toBeDefined();
		expect(templates.EventTemplate).toBeDefined();
		expect(templates.QuoteTemplate).toBeDefined();
		expect(templates.MinimalTemplate).toBeDefined();
		expect(templates.NewsTemplate).toBeDefined();
		expect(templates.TechTemplate).toBeDefined();
		expect(templates.PodcastTemplate).toBeDefined();
		expect(templates.PortfolioTemplate).toBeDefined();
		expect(templates.CourseTemplate).toBeDefined();
	});

	it('has correct template registry', async () => {
		const { TEMPLATE_REGISTRY } = await import('../src/templates/index');
		
		const expectedTemplates = [
			'default', 'blog', 'product', 'event', 'quote', 
			'minimal', 'news', 'tech', 'podcast', 'portfolio', 'course'
		];
		
		for (const template of expectedTemplates) {
			expect(TEMPLATE_REGISTRY[template as keyof typeof TEMPLATE_REGISTRY]).toBeDefined();
		}
	});
});

describe('Template Generation (CG-3)', () => {
	it('generates JSX structures for all templates', async () => {
		const {
			DefaultTemplate,
			BlogTemplate,
			ProductTemplate,
			EventTemplate,
			QuoteTemplate,
			MinimalTemplate,
			NewsTemplate,
			TechTemplate,
			PodcastTemplate,
			PortfolioTemplate,
			CourseTemplate,
		} = await import('../src/templates/index');

		// Test that templates return JSX-like structures
		const defaultResult = DefaultTemplate({ title: 'Test' });
		expect(defaultResult.type).toBe('div');
		expect(defaultResult.props).toBeDefined();
		expect(defaultResult.props.style).toBeDefined();

		const blogResult = BlogTemplate({ title: 'Blog Test', author: 'Test Author' });
		expect(blogResult.type).toBe('div');
		expect(blogResult.props.children).toBeDefined();

		// Test template-specific parameters
		const productResult = ProductTemplate({ title: 'Product', price: '$99' });
		expect(productResult.type).toBe('div');

		const eventResult = EventTemplate({ 
			title: 'Event', 
			date: '2025-08-01', 
			location: 'Online' 
		});
		expect(eventResult.type).toBe('div');
	});

	describe('getTemplateEmoji (CG-5)', () => {
		it('returns appropriate emojis for each template type', () => {
			expect(getTemplateEmoji('blog')).toEqual({ icon: '📝', accent: '✨' });
			expect(getTemplateEmoji('product')).toEqual({ icon: '🚀', accent: '💫' });
			expect(getTemplateEmoji('event')).toEqual({ icon: '🎯', accent: '📅' });
			expect(getTemplateEmoji('quote')).toEqual({ icon: '💬', accent: '⭐' });
			expect(getTemplateEmoji('minimal')).toEqual({ icon: '✨', accent: '◦' });
			expect(getTemplateEmoji('news')).toEqual({ icon: '📰', accent: '🔥' });
			expect(getTemplateEmoji('tech')).toEqual({ icon: '⚡', accent: '🔧' });
			expect(getTemplateEmoji('podcast')).toEqual({ icon: '🎧', accent: '🎙️' });
			expect(getTemplateEmoji('portfolio')).toEqual({ icon: '🎨', accent: '✨' });
			expect(getTemplateEmoji('course')).toEqual({ icon: '📚', accent: '🎓' });
			expect(getTemplateEmoji('default')).toEqual({ icon: '🌟', accent: '✨' });
		});

		it('falls back to default emoji for unknown template types', () => {
			expect(getTemplateEmoji('unknown')).toEqual({ icon: '🌟', accent: '✨' });
			expect(getTemplateEmoji('')).toEqual({ icon: '🌟', accent: '✨' });
		});
	});
});
