export {};

/**
 * Template index for CG-3
 * Exports all 10 available templates
 */

export { DefaultTemplate } from './default';
export { BlogTemplate } from './blog';
export { ProductTemplate } from './product';
export { EventTemplate } from './event';
export { QuoteTemplate } from './quote';
export { MinimalTemplate } from './minimal';
export { NewsTemplate } from './news';
export { TechTemplate } from './tech';
export { PodcastTemplate } from './podcast';
export { PortfolioTemplate } from './portfolio';
export { CourseTemplate } from './course';

/**
 * Template registry for CG-3
 * Maps template names to their corresponding functions
 */
export const TEMPLATE_REGISTRY = {
  default: 'DefaultTemplate',
  blog: 'BlogTemplate',
  product: 'ProductTemplate',
  event: 'EventTemplate',
  quote: 'QuoteTemplate',
  minimal: 'MinimalTemplate',
  news: 'NewsTemplate',
  tech: 'TechTemplate',
  podcast: 'PodcastTemplate',
  portfolio: 'PortfolioTemplate',
  course: 'CourseTemplate',
} as const;

export type TemplateType = keyof typeof TEMPLATE_REGISTRY;
