/**
 * @goat/devtools - Project Templates Catalog
 */

import { REACT_TEMPLATE } from './reactTemplate.ts';
import { VUE_TEMPLATE } from './vueTemplate.ts';
import { VANILLA_TEMPLATE } from './vanillaTemplate.ts';
import type { ProjectTemplate } from '../../types/workspace.ts';

export const TEMPLATES: ProjectTemplate[] = [
  REACT_TEMPLATE,
  VUE_TEMPLATE,
  VANILLA_TEMPLATE,
];

export function getTemplateById(id: string): ProjectTemplate | undefined {
  return TEMPLATES.find((t) => t.id === id);
}

export function getDefaultTemplate(): ProjectTemplate {
  return REACT_TEMPLATE;
}

export { REACT_TEMPLATE, VUE_TEMPLATE, VANILLA_TEMPLATE };
