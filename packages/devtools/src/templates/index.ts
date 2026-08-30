/**
 * @goat/devtools - Project Templates Catalog
 */

import { REACT_TEMPLATE } from './reactTemplate.ts';
import { VUE_TEMPLATE } from './vueTemplate.ts';
import { VANILLA_TEMPLATE } from './vanillaTemplate.ts';
import type { ProjectTemplate } from '../types/ide.ts';

export const TEMPLATES: ProjectTemplate[] = [
  VANILLA_TEMPLATE,
  REACT_TEMPLATE,
  VUE_TEMPLATE,
];

export function getTemplateById(id: string): ProjectTemplate | undefined {
  return TEMPLATES.find((t) => t.id === id || t.id.startsWith(id));
}

export function getDefaultTemplate(): ProjectTemplate {
  return VANILLA_TEMPLATE;
}

export { REACT_TEMPLATE, VUE_TEMPLATE, VANILLA_TEMPLATE };
