/**
 * Documentation Site Validator
 * Verifies markdown documents, frontmatter, sidebar consistency, code blocks, and static artifacts.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

export interface DocFileMetadata {
  relativePath: string;
  absolutePath: string;
  frontmatter: Record<string, string>;
  title: string;
  headings: string[];
  codeBlocks: { lang: string; code: string }[];
  links: string[];
  byteSize: number;
}

export class DocsValidator {
  private docsRoot: string;
  private siteRoot: string;

  constructor(siteRoot: string) {
    this.siteRoot = siteRoot;
    this.docsRoot = path.join(siteRoot, 'docs');
  }

  /**
   * Scans and parses all markdown files in docs/
   */
  public scanDocs(): DocFileMetadata[] {
    const results: DocFileMetadata[] = [];
    if (!fs.existsSync(this.docsRoot)) {
      return results;
    }

    const traverse = (dir: string) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          traverse(fullPath);
        } else if (entry.isFile() && (entry.name.endsWith('.md') || entry.name.endsWith('.mdx'))) {
          results.push(this.parseDocFile(fullPath));
        }
      }
    };

    traverse(this.docsRoot);
    return results;
  }

  /**
   * Parses a single markdown file
   */
  public parseDocFile(filePath: string): DocFileMetadata {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const relativePath = path.relative(this.docsRoot, filePath);
    const stats = fs.statSync(filePath);

    // Parse YAML frontmatter
    const frontmatter: Record<string, string> = {};
    let content = raw;
    if (raw.startsWith('---')) {
      const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
      if (match) {
        const yamlLines = match[1].split('\n');
        for (const line of yamlLines) {
          const idx = line.indexOf(':');
          if (idx !== -1) {
            const key = line.slice(0, idx).trim();
            const val = line.slice(idx + 1).trim().replace(/^['"]|['"]$/g, '');
            frontmatter[key] = val;
          }
        }
        content = match[2];
      }
    }

    // Extract headings
    const headings: string[] = [];
    const headingMatches = content.match(/^#{1,6}\s+(.+)$/gm);
    if (headingMatches) {
      for (const h of headingMatches) {
        headings.push(h.replace(/^#{1,6}\s+/, '').trim());
      }
    }

    // Title resolution
    let title = frontmatter.title || '';
    if (!title && headings.length > 0) {
      title = headings[0];
    }

    // Extract code blocks
    const codeBlocks: { lang: string; code: string }[] = [];
    const codeBlockRegex = /```([a-zA-Z0-9_-]*)\r?\n([\s\S]*?)```/g;
    let blockMatch: RegExpExecArray | null;
    while ((blockMatch = codeBlockRegex.exec(content)) !== null) {
      codeBlocks.push({
        lang: blockMatch[1] || 'text',
        code: blockMatch[2],
      });
    }

    // Extract markdown links
    const links: string[] = [];
    const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
    let linkMatch: RegExpExecArray | null;
    while ((linkMatch = linkRegex.exec(content)) !== null) {
      links.push(linkMatch[2]);
    }

    return {
      relativePath,
      absolutePath: filePath,
      frontmatter,
      title,
      headings,
      codeBlocks,
      links,
      byteSize: stats.size,
    };
  }

  /**
   * Validates Docusaurus configuration
   */
  public validateConfig(): { valid: boolean; errors: string[] } {
    const configPath = path.join(this.siteRoot, 'docusaurus.config.ts');
    const errors: string[] = [];

    if (!fs.existsSync(configPath)) {
      errors.push(`docusaurus.config.ts does not exist at ${configPath}`);
      return { valid: false, errors };
    }

    const content = fs.readFileSync(configPath, 'utf-8');
    if (!content.includes('title:')) errors.push('Missing title in docusaurus config');
    if (!content.includes('preset-classic')) errors.push('Missing classic preset in docusaurus config');
    if (!content.includes('navbar:')) errors.push('Missing navbar config in docusaurus config');
    if (!content.includes('footer:')) errors.push('Missing footer config in docusaurus config');

    return { valid: errors.length === 0, errors };
  }

  /**
   * Validates sidebars.ts configuration
   */
  public validateSidebars(): { valid: boolean; errors: string[]; declaredDocIds: string[] } {
    const sidebarsPath = path.join(this.siteRoot, 'sidebars.ts');
    const errors: string[] = [];
    const declaredDocIds: string[] = [];

    if (!fs.existsSync(sidebarsPath)) {
      errors.push(`sidebars.ts does not exist at ${sidebarsPath}`);
      return { valid: false, errors, declaredDocIds };
    }

    const content = fs.readFileSync(sidebarsPath, 'utf-8');
    // Extract doc ID strings
    const strMatches = content.match(/'([a-zA-Z0-9_\-\/]+)'/g);
    if (strMatches) {
      for (const m of strMatches) {
        const id = m.replace(/'/g, '');
        if (id !== 'category' && id !== 'docSidebar' && id !== 'docsSidebar' && id !== 'autogenerated') {
          declaredDocIds.push(id);
        }
      }
    }

    return { valid: errors.length === 0, errors, declaredDocIds };
  }
}
