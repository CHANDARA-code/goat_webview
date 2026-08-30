/**
 * @goat/devtools - Virtual FileSystem Service
 * In-memory Virtual Tree manipulation, CRUD, path resolution, and language mapping.
 */

import type { FileNode } from '../types/workspace.ts';

/**
 * Builds a hierarchical FileNode tree from a flat path-to-content map
 */
export function buildFileTreeFromMap(fileMap: Record<string, string>): FileNode[] {
  const rootNodes: FileNode[] = [];

  const sortedPaths = Object.keys(fileMap).sort();

  for (const path of sortedPaths) {
    const parts = path.split('/').filter(Boolean);
    let currentLevel = rootNodes;
    let accumulatedPath = '';

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLast = i === parts.length - 1;
      accumulatedPath = accumulatedPath ? `${accumulatedPath}/${part}` : part;

      let existing = currentLevel.find((node) => node.name === part);

      if (!existing) {
        existing = {
          id: accumulatedPath,
          name: part,
          path: accumulatedPath,
          isDirectory: !isLast,
          content: isLast ? fileMap[path] : undefined,
          children: isLast ? undefined : [],
          isOpen: true,
        };
        currentLevel.push(existing);
      }

      if (!isLast && existing.children) {
        currentLevel = existing.children;
      }
    }
  }

  return sortTree(rootNodes);
}

/**
 * Flattens a FileNode tree back into a path-to-content record map
 */
export function flattenTreeToMap(nodes: FileNode[]): Record<string, string> {
  const map: Record<string, string> = {};

  function traverse(list: FileNode[]) {
    for (const node of list) {
      if (!node.isDirectory && node.content !== undefined) {
        map[node.path] = node.content;
      }
      if (node.children) {
        traverse(node.children);
      }
    }
  }

  traverse(nodes);
  return map;
}

/**
 * Finds a node in the tree by exact path
 */
export function findNodeByPath(nodes: FileNode[], targetPath: string): FileNode | null {
  const normalized = targetPath.replace(/^\/+/, '');

  for (const node of nodes) {
    if (node.path === normalized) {
      return node;
    }
    if (node.isDirectory && node.children) {
      const found = findNodeByPath(node.children, normalized);
      if (found) return found;
    }
  }
  return null;
}

/**
 * Gets content of a file by path
 */
export function getFileContent(nodes: FileNode[], targetPath: string): string | null {
  const node = findNodeByPath(nodes, targetPath);
  return node && !node.isDirectory ? (node.content ?? '') : null;
}

/**
 * Sets file content by path and returns updated tree
 */
export function setFileContent(nodes: FileNode[], targetPath: string, content: string): FileNode[] {
  const normalized = targetPath.replace(/^\/+/, '');

  function updateList(list: FileNode[]): FileNode[] {
    return list.map((node) => {
      if (node.path === normalized && !node.isDirectory) {
        return { ...node, content, isModified: true };
      }
      if (node.isDirectory && node.children) {
        return { ...node, children: updateList(node.children) };
      }
      return node;
    });
  }

  return updateList(nodes);
}

/**
 * Creates a new file at path
 */
export function createFile(nodes: FileNode[], targetPath: string, content = ''): FileNode[] {
  const map = flattenTreeToMap(nodes);
  const normalized = targetPath.replace(/^\/+/, '');
  map[normalized] = content;
  return buildFileTreeFromMap(map);
}

/**
 * Creates a new folder at path
 */
export function createFolder(nodes: FileNode[], targetPath: string): FileNode[] {
  const normalized = targetPath.replace(/^\/+/, '');
  const parts = normalized.split('/').filter(Boolean);

  function ensureFolder(list: FileNode[], accumulated: string, idx: number): FileNode[] {
    if (idx >= parts.length) return list;
    const part = parts[idx];
    const currentPath = accumulated ? `${accumulated}/${part}` : part;

    let found = list.find((n) => n.name === part && n.isDirectory);
    if (!found) {
      found = {
        id: currentPath,
        name: part,
        path: currentPath,
        isDirectory: true,
        children: [],
        isOpen: true,
      };
      list.push(found);
    }

    if (found.children) {
      found.children = ensureFolder(found.children, currentPath, idx + 1);
    }

    return sortTree(list);
  }

  const cloned = JSON.parse(JSON.stringify(nodes));
  return ensureFolder(cloned, '', 0);
}

/**
 * Deletes a file or directory node from tree
 */
export function deleteNode(nodes: FileNode[], targetPath: string): FileNode[] {
  const normalized = targetPath.replace(/^\/+/, '');

  function filterList(list: FileNode[]): FileNode[] {
    return list
      .filter((node) => node.path !== normalized && !node.path.startsWith(`${normalized}/`))
      .map((node) => {
        if (node.isDirectory && node.children) {
          return { ...node, children: filterList(node.children) };
        }
        return node;
      });
  }

  return filterList(nodes);
}

/**
 * Renames a node in tree
 */
export function renameNode(nodes: FileNode[], oldPath: string, newPath: string): FileNode[] {
  const map = flattenTreeToMap(nodes);
  const oldNorm = oldPath.replace(/^\/+/, '');
  const newNorm = newPath.replace(/^\/+/, '');

  const newMap: Record<string, string> = {};
  for (const [key, val] of Object.entries(map)) {
    if (key === oldNorm) {
      newMap[newNorm] = val;
    } else if (key.startsWith(`${oldNorm}/`)) {
      const replaced = key.replace(oldNorm, newNorm);
      newMap[replaced] = val;
    } else {
      newMap[key] = val;
    }
  }

  return buildFileTreeFromMap(newMap);
}

/**
 * Resolves editor language mode from file extension
 */
export function getLanguageFromPath(filePath: string): string {
  const lower = filePath.toLowerCase();
  if (lower.endsWith('.tsx')) return 'typescript';
  if (lower.endsWith('.ts')) return 'typescript';
  if (lower.endsWith('.jsx')) return 'javascript';
  if (lower.endsWith('.js')) return 'javascript';
  if (lower.endsWith('.mjs')) return 'javascript';
  if (lower.endsWith('.json')) return 'json';
  if (lower.endsWith('.html') || lower.endsWith('.htm')) return 'html';
  if (lower.endsWith('.css')) return 'css';
  if (lower.endsWith('.vue')) return 'html';
  if (lower.endsWith('.md')) return 'markdown';
  if (lower.endsWith('.xml') || lower.endsWith('.gpx')) return 'xml';
  return 'plaintext';
}

function sortTree(nodes: FileNode[]): FileNode[] {
  return nodes
    .map((node) => {
      if (node.isDirectory && node.children) {
        return { ...node, children: sortTree(node.children) };
      }
      return node;
    })
    .sort((a, b) => {
      // Folders first, then alphabetical
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;
      return a.name.localeCompare(b.name);
    });
}
