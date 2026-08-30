import { VDomPatch, VNode, UiPatchPayload } from "../types.js";
import { IpcChannel } from "../ipc/channel.js";

const FORBIDDEN_DOM_PROPERTIES = new Set([
  "innerhtml",
  "outerhtml",
  "srcdoc",
  "__proto__",
  "prototype",
  "constructor",
]);

export function isSafeDOMProperty(key: string): boolean {
  if (FORBIDDEN_DOM_PROPERTIES.has(key.toLowerCase())) return false;
  if (key.toLowerCase().startsWith("on")) return false;
  return true;
}

export class AppViewDomRenderer {
  public readonly container: any;
  public domTree: VNode | null = null;
  public appliedPatchesCount: number = 0;
  private readonly nodeMap = new Map<string, any>();
  private readonly ipc?: IpcChannel;

  constructor(container?: any, ipc?: IpcChannel) {
    this.container = container || null;
    this.ipc = ipc;

    if (this.ipc) {
      this.ipc.on("UI_PATCH", (frame) => {
        const payload = frame.payload as UiPatchPayload;
        this.applyPatchBatch(payload, frame.seq);
      });
    }
  }

  public applyPatchBatch(payload: UiPatchPayload, seq?: number): void {
    this.executePatches(payload.patches);
  }

  public executePatches(patches: VDomPatch[]): void {
    for (const patch of patches) {
      this.applySinglePatch(patch);
      this.appliedPatchesCount++;
    }
  }

  public applySinglePatch(patch: VDomPatch): void {
    // 1. Update internal VNode tree
    this.applyToVTree(patch);

    // 2. If real/simulated DOM container is provided, update DOM nodes
    if (this.container) {
      switch (patch.type) {
        case "CREATE":
          this.handleDomCreate(patch);
          break;
        case "REMOVE":
          this.handleDomRemove(patch);
          break;
        case "REPLACE":
          this.handleDomReplace(patch);
          break;
        case "UPDATE_PROPS":
          this.handleDomUpdateProps(patch);
          break;
        case "SET_TEXT":
          this.handleDomSetText(patch);
          break;
        case "REORDER":
        case "REORDER_CHILDREN":
          this.handleDomReorderChildren(patch);
          break;
      }
    }
  }

  private applyToVTree(patch: VDomPatch): void {
    if (patch.type === "CREATE" && patch.vnode) {
      if (patch.path.length === 0) {
        this.domTree = JSON.parse(JSON.stringify(patch.vnode));
      } else {
        this.insertVNodeAtPath(
          this.domTree,
          patch.path,
          patch.vnode,
          patch.insertIndex,
        );
      }
    } else if (patch.type === "REMOVE") {
      if (patch.path.length === 0) {
        this.domTree = null;
      } else {
        this.removeVNodeAtPath(this.domTree, patch.path, patch.targetNodeId);
      }
    } else if (patch.type === "REPLACE" && (patch.newVNode || patch.vnode)) {
      const newNode = patch.newVNode || patch.vnode!;
      if (patch.path.length === 0) {
        this.domTree = JSON.parse(JSON.stringify(newNode));
      } else {
        this.replaceVNodeAtPath(this.domTree, patch.path, newNode);
      }
    } else if (patch.type === "SET_TEXT") {
      const target =
        (patch.targetNodeId
          ? this.findVNodeById(this.domTree, patch.targetNodeId)
          : null) || this.findNodeAtPath(this.domTree, patch.path);
      if (target) {
        target.text = patch.text;
      }
    } else if (patch.type === "UPDATE_PROPS") {
      const target =
        (patch.targetNodeId
          ? this.findVNodeById(this.domTree, patch.targetNodeId)
          : null) || this.findNodeAtPath(this.domTree, patch.path);
      if (target) {
        target.props = target.props || {};
        const setProps = patch.set || patch.props || {};
        for (const [k, v] of Object.entries(setProps)) {
          if (!isSafeDOMProperty(k)) continue;
          if (v === null) {
            delete target.props[k];
          } else {
            target.props[k] = v;
          }
        }
        if (patch.remove) {
          for (const key of patch.remove) {
            delete target.props[key];
          }
        }
      }
    } else if (patch.type === "REORDER" || patch.type === "REORDER_CHILDREN") {
      const target =
        (patch.targetNodeId
          ? this.findVNodeById(this.domTree, patch.targetNodeId)
          : null) || this.findNodeAtPath(this.domTree, patch.path);
      if (target && target.children) {
        if (patch.newOrderKeys && patch.newOrderKeys.length > 0) {
          const childMap = new Map<string | number, VNode>();
          for (const child of target.children) {
            const k = child.key !== undefined ? child.key : child.props?.key;
            if (k !== undefined) childMap.set(k, child);
          }
          const reorderedChildren: VNode[] = [];
          for (const key of patch.newOrderKeys) {
            const match = childMap.get(key);
            if (match) {
              reorderedChildren.push(match);
            }
          }
          if (reorderedChildren.length === target.children.length) {
            target.children = reorderedChildren;
          }
        } else if (patch.order && patch.order.length > 0) {
          const reorderedChildren: VNode[] = [];
          for (const oldIdx of patch.order) {
            if (oldIdx >= 0 && oldIdx < target.children.length) {
              reorderedChildren.push(target.children[oldIdx]);
            }
          }
          if (reorderedChildren.length === target.children.length) {
            target.children = reorderedChildren;
          }
        } else if (patch.moves) {
          for (const move of patch.moves) {
            const child = target.children[move.fromIndex];
            if (child) {
              target.children.splice(move.fromIndex, 1);
              target.children.splice(move.toIndex, 0, child);
            }
          }
        }
      }
    }
  }

  public findVNodeById(root: VNode | null, nodeId: string): VNode | null {
    if (!root || !nodeId) return null;
    if (root.nodeId === nodeId || root.props?.id === nodeId) return root;
    if (root.children) {
      for (const child of root.children) {
        const found = this.findVNodeById(child, nodeId);
        if (found) return found;
      }
    }
    return null;
  }

  public findNodeAtPath(root: VNode | null, path: number[]): VNode | null {
    if (!root) return null;
    let curr: VNode = root;
    for (const idx of path) {
      if (!curr.children || !curr.children[idx]) return null;
      curr = curr.children[idx];
    }
    return curr;
  }

  private insertVNodeAtPath(
    root: VNode | null,
    path: number[],
    node: VNode,
    insertIndex?: number,
  ): void {
    if (!root || path.length === 0) return;
    const parentPath = path.slice(0, -1);
    const targetIndex =
      insertIndex !== undefined ? insertIndex : path[path.length - 1];
    const parent = this.findNodeAtPath(root, parentPath);
    if (parent) {
      parent.children = parent.children || [];
      if (targetIndex >= 0 && targetIndex <= parent.children.length) {
        parent.children.splice(
          targetIndex,
          0,
          JSON.parse(JSON.stringify(node)),
        );
      } else {
        parent.children.push(JSON.parse(JSON.stringify(node)));
      }
    }
  }

  private removeVNodeAtPath(
    root: VNode | null,
    path: number[],
    targetNodeId?: string,
  ): void {
    if (!root || path.length === 0) return;
    const parentPath = path.slice(0, -1);
    const targetIndex = path[path.length - 1];
    const parent = this.findNodeAtPath(root, parentPath);
    if (parent && parent.children) {
      if (targetNodeId) {
        const idx = parent.children.findIndex(
          (c) => c.nodeId === targetNodeId || c.props?.id === targetNodeId,
        );
        if (idx >= 0) {
          parent.children.splice(idx, 1);
          return;
        }
      }
      if (targetIndex >= 0 && targetIndex < parent.children.length) {
        parent.children.splice(targetIndex, 1);
      }
    }
  }

  private replaceVNodeAtPath(
    root: VNode | null,
    path: number[],
    node: VNode,
  ): void {
    if (!root || path.length === 0) return;
    const parentPath = path.slice(0, -1);
    const targetIndex = path[path.length - 1];
    const parent = this.findNodeAtPath(root, parentPath);
    if (parent && parent.children) {
      parent.children[targetIndex] = JSON.parse(JSON.stringify(node));
    }
  }

  private handleDomCreate(patch: VDomPatch): void {
    if (!patch.vnode) return;
    let parentNode: any = null;
    if (patch.path.length === 0) {
      parentNode = this.container;
    } else if (patch.targetNodeId && this.nodeMap.has(patch.targetNodeId)) {
      parentNode = this.nodeMap.get(patch.targetNodeId);
    } else {
      parentNode = this.resolveDomParent(patch.path.slice(0, -1));
    }
    if (!parentNode) return;

    const newDomNode = this.createRealDomNode(patch.vnode);
    const insertIndex =
      patch.insertIndex !== undefined
        ? patch.insertIndex
        : patch.path.length > 0
          ? patch.path[patch.path.length - 1]
          : undefined;

    if (
      insertIndex !== undefined &&
      parentNode.childNodes &&
      insertIndex < parentNode.childNodes.length
    ) {
      parentNode.insertBefore(newDomNode, parentNode.childNodes[insertIndex]);
    } else if (typeof parentNode.appendChild === "function") {
      parentNode.appendChild(newDomNode);
    }
  }

  private handleDomRemove(patch: VDomPatch): void {
    const targetNode =
      (patch.targetNodeId ? this.nodeMap.get(patch.targetNodeId) : null) ||
      (patch.path.length > 0 ? this.resolveDomParent(patch.path) : null);
    if (targetNode && targetNode.parentNode) {
      targetNode.parentNode.removeChild(targetNode);
      if (patch.targetNodeId) this.nodeMap.delete(patch.targetNodeId);
    } else if (patch.path.length > 0) {
      const parentNode = this.resolveDomParent(patch.path.slice(0, -1));
      const childIndex = patch.path[patch.path.length - 1];
      if (
        parentNode &&
        parentNode.childNodes &&
        parentNode.childNodes[childIndex]
      ) {
        parentNode.removeChild(parentNode.childNodes[childIndex]);
      }
    }
  }

  private handleDomReplace(patch: VDomPatch): void {
    const newNode = patch.newVNode || patch.vnode;
    if (!newNode) return;

    const targetNode = patch.targetNodeId
      ? this.nodeMap.get(patch.targetNodeId)
      : null;
    const newDomNode = this.createRealDomNode(newNode);

    if (targetNode && targetNode.parentNode) {
      targetNode.parentNode.replaceChild(newDomNode, targetNode);
      if (patch.targetNodeId) this.nodeMap.delete(patch.targetNodeId);
    } else if (patch.path.length > 0) {
      const parentNode = this.resolveDomParent(patch.path.slice(0, -1));
      const childIndex = patch.path[patch.path.length - 1];
      if (
        parentNode &&
        parentNode.childNodes &&
        parentNode.childNodes[childIndex]
      ) {
        parentNode.replaceChild(newDomNode, parentNode.childNodes[childIndex]);
      }
    }
  }

  private handleDomUpdateProps(patch: VDomPatch): void {
    const targetNode =
      (patch.targetNodeId ? this.nodeMap.get(patch.targetNodeId) : null) ||
      this.resolveDomParent(patch.path);
    if (!targetNode) return;

    const setProps = patch.set || patch.props || {};
    for (const [key, value] of Object.entries(setProps)) {
      if (key === "key") continue;
      if (!isSafeDOMProperty(key)) continue;
      if (key === "id") {
        targetNode.id = String(value);
        if (typeof targetNode.setAttribute === "function")
          targetNode.setAttribute("id", String(value));
      } else if (key === "class" || key === "className") {
        targetNode.className = String(value);
        if (typeof targetNode.setAttribute === "function")
          targetNode.setAttribute("class", String(value));
      } else if (key === "style") {
        if (typeof value === "string") {
          if (targetNode.style && typeof targetNode.style === "object")
            targetNode.style.cssText = value;
        } else if (
          typeof value === "object" &&
          value !== null &&
          targetNode.style
        ) {
          Object.assign(targetNode.style, value);
        }
      } else if (
        key.startsWith("data-") &&
        typeof targetNode.setAttribute === "function"
      ) {
        targetNode.setAttribute(key, String(value));
      } else if (key in targetNode) {
        targetNode[key] = value;
      } else if (typeof targetNode.setAttribute === "function") {
        targetNode.setAttribute(key, String(value));
      }
    }

    if (patch.remove) {
      for (const key of patch.remove) {
        if (typeof targetNode.removeAttribute === "function") {
          targetNode.removeAttribute(key);
        }
      }
    }
  }

  private handleDomSetText(patch: VDomPatch): void {
    const targetNode =
      (patch.targetNodeId ? this.nodeMap.get(patch.targetNodeId) : null) ||
      this.resolveDomParent(patch.path);
    if (targetNode) {
      if ("nodeValue" in targetNode) {
        targetNode.nodeValue = patch.text || "";
      }
      if ("textContent" in targetNode) {
        targetNode.textContent = patch.text || "";
      }
    }
  }

  private getNodeKey(node: any): string | number | undefined {
    if (!node) return undefined;
    if (node.key !== undefined) return node.key;
    if (node.props && node.props.key !== undefined) return node.props.key;
    if (node.__vnode_key !== undefined) return node.__vnode_key;
    if (typeof node.getAttribute === "function") {
      const dataKey = node.getAttribute("data-key") || node.getAttribute("key");
      if (dataKey !== null && dataKey !== undefined) return dataKey;
    }
    return undefined;
  }

  private handleDomReorderChildren(patch: VDomPatch): void {
    const parentNode =
      (patch.targetNodeId ? this.nodeMap.get(patch.targetNodeId) : null) ||
      this.resolveDomParent(patch.path);
    if (!parentNode || !parentNode.childNodes) return;

    if (patch.newOrderKeys && patch.newOrderKeys.length > 0) {
      for (let i = 0; i < patch.newOrderKeys.length; i++) {
        const targetKey = patch.newOrderKeys[i];
        let targetChild: any = null;
        for (let j = 0; j < parentNode.childNodes.length; j++) {
          const child = parentNode.childNodes[j];
          const k = this.getNodeKey(child);
          if (
            k === targetKey ||
            (k !== undefined && String(k) === String(targetKey))
          ) {
            targetChild = child;
            break;
          }
        }

        if (targetChild) {
          const currentChildAtIndex = parentNode.childNodes[i];
          if (currentChildAtIndex !== targetChild) {
            if (i < parentNode.childNodes.length) {
              parentNode.insertBefore(targetChild, parentNode.childNodes[i]);
            } else {
              parentNode.appendChild(targetChild);
            }
          }
        }
      }
    } else if (patch.moves) {
      for (const move of patch.moves) {
        let child: any = null;
        if (move.key !== undefined) {
          for (let j = 0; j < parentNode.childNodes.length; j++) {
            const c = parentNode.childNodes[j];
            const k = this.getNodeKey(c);
            if (
              k === move.key ||
              (k !== undefined && String(k) === String(move.key))
            ) {
              child = c;
              break;
            }
          }
        }
        if (!child && move.fromIndex < parentNode.childNodes.length) {
          child = parentNode.childNodes[move.fromIndex];
        }
        if (child) {
          if (move.toIndex < parentNode.childNodes.length) {
            parentNode.insertBefore(child, parentNode.childNodes[move.toIndex]);
          } else {
            parentNode.appendChild(child);
          }
        }
      }
    }
  }

  public createRealDomNode(vnode: VNode): any {
    if (typeof document === "undefined") {
      const syntheticNode: any = {
        nodeType: vnode.type === "TEXT" || vnode.tag === "#text" ? 3 : 1,
        nodeName: (vnode.tag || "DIV").toUpperCase(),
        tag: vnode.tag || "div",
        id: vnode.props?.id ? String(vnode.props.id) : "",
        className:
          vnode.props?.class || vnode.props?.className
            ? String(vnode.props.class || vnode.props.className)
            : "",
        nodeValue: vnode.text || null,
        textContent: vnode.text || "",
        key: vnode.key !== undefined ? vnode.key : vnode.props?.key,
        props: { ...vnode.props },
        childNodes: [],
        parentNode: null,
        style: { cssText: "" },
        appendChild(child: any) {
          if (
            child.parentNode &&
            typeof child.parentNode.removeChild === "function"
          ) {
            child.parentNode.removeChild(child);
          } else {
            const existingIdx = this.childNodes.indexOf(child);
            if (existingIdx >= 0) this.childNodes.splice(existingIdx, 1);
          }
          child.parentNode = this;
          this.childNodes.push(child);
          return child;
        },
        removeChild(child: any) {
          const idx = this.childNodes.indexOf(child);
          if (idx >= 0) this.childNodes.splice(idx, 1);
          child.parentNode = null;
          return child;
        },
        replaceChild(newChild: any, oldChild: any) {
          if (newChild === oldChild) return newChild;
          if (
            newChild.parentNode &&
            typeof newChild.parentNode.removeChild === "function"
          ) {
            newChild.parentNode.removeChild(newChild);
          } else {
            const existingIdx = this.childNodes.indexOf(newChild);
            if (existingIdx >= 0) this.childNodes.splice(existingIdx, 1);
          }
          const idx = this.childNodes.indexOf(oldChild);
          if (idx >= 0) {
            newChild.parentNode = this;
            this.childNodes[idx] = newChild;
            oldChild.parentNode = null;
          }
          return newChild;
        },
        insertBefore(newChild: any, refChild: any) {
          if (newChild === refChild) return newChild;
          if (
            newChild.parentNode &&
            typeof newChild.parentNode.removeChild === "function"
          ) {
            newChild.parentNode.removeChild(newChild);
          } else {
            const existingIdx = this.childNodes.indexOf(newChild);
            if (existingIdx >= 0) this.childNodes.splice(existingIdx, 1);
          }
          newChild.parentNode = this;
          if (!refChild) {
            this.childNodes.push(newChild);
            return newChild;
          }
          const idx = this.childNodes.indexOf(refChild);
          if (idx >= 0) this.childNodes.splice(idx, 0, newChild);
          else this.childNodes.push(newChild);
          return newChild;
        },
        setAttribute(k: string, v: string) {
          this.props[k] = v;
          if (k === "id") this.id = v;
          if (k === "class" || k === "className") this.className = v;
          if (k === "key" || k === "data-key") this.key = v;
        },
        removeAttribute(k: string) {
          delete this.props[k];
          if (k === "id") this.id = "";
          if (k === "class" || k === "className") this.className = "";
          if (k === "key" || k === "data-key") this.key = undefined;
        },
        getAttribute(k: string) {
          if (k === "id") return this.id || null;
          if (k === "class" || k === "className") return this.className || null;
          if (k === "key")
            return this.key !== undefined ? String(this.key) : null;
          if (k === "data-key")
            return this.key !== undefined
              ? String(this.key)
              : (this.props?.["data-key"] ?? null);
          return this.props?.[k] !== undefined ? String(this.props[k]) : null;
        },
      };

      if (vnode.props) {
        for (const [k, v] of Object.entries(vnode.props)) {
          if (k === "key") continue;
          if (k === "id") syntheticNode.id = String(v);
          if (k === "class" || k === "className")
            syntheticNode.className = String(v);
        }
      }

      if (vnode.children) {
        for (const c of vnode.children) {
          syntheticNode.appendChild(this.createRealDomNode(c));
        }
      }
      if (vnode.nodeId) {
        this.nodeMap.set(vnode.nodeId, syntheticNode);
      }
      return syntheticNode;
    }

    if (vnode.type === "TEXT" || vnode.tag === "#text") {
      const textNode = document.createTextNode(vnode.text || "");
      if (vnode.nodeId) this.nodeMap.set(vnode.nodeId, textNode);
      return textNode;
    }

    const element = document.createElement(vnode.tag || "div");
    if (vnode.nodeId) {
      element.setAttribute("data-vnode-id", vnode.nodeId);
      this.nodeMap.set(vnode.nodeId, element);
    }
    if (vnode.key !== undefined) {
      (element as any).key = vnode.key;
      (element as any).__vnode_key = vnode.key;
      element.setAttribute("data-key", String(vnode.key));
    }

    if (vnode.props) {
      for (const [key, value] of Object.entries(vnode.props)) {
        if (key === "key") continue;
        if (!isSafeDOMProperty(key)) continue;
        if (key === "id") {
          element.id = String(value);
        } else if (key === "class" || key === "className") {
          element.className = String(value);
        } else if (key === "style") {
          if (typeof value === "string") element.style.cssText = value;
          else if (typeof value === "object" && value !== null)
            Object.assign(element.style, value);
        } else if (key.startsWith("data-")) {
          element.setAttribute(key, String(value));
        } else if (key in element) {
          (element as any)[key] = value;
        } else {
          element.setAttribute(key, String(value));
        }
      }
    }

    if (vnode.children) {
      for (const child of vnode.children) {
        element.appendChild(this.createRealDomNode(child));
      }
    }

    return element;
  }

  public resolveDomParent(path: number[]): any {
    if (!this.container) return null;
    let current: any =
      this.container.childNodes && this.container.childNodes.length > 0
        ? this.container.childNodes[0]
        : this.container;
    for (const index of path) {
      if (current && current.childNodes && current.childNodes[index]) {
        current = current.childNodes[index];
      }
    }
    return current;
  }
}

export const AppViewRenderer = AppViewDomRenderer;
