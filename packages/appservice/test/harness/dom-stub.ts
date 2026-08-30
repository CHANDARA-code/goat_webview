export class DomNodeStub {
  public nodeType: number;
  public nodeName: string;
  public childNodes: DomNodeStub[] = [];
  public parentNode: DomNodeStub | null = null;
  public nodeValue: string | null = null;
  public textContent: string = '';
  public className: string = '';
  public style: Record<string, string> & { cssText: string } = { cssText: '' };
  public dataset: Record<string, string> = {};
  public id: string = '';
  public key?: string | number;
  public attributes = new Map<string, string>();
  private eventListeners = new Map<string, Array<(e: any) => void>>();

  constructor(nodeName: string, nodeType: number = 1) {
    this.nodeName = nodeName.toUpperCase();
    this.nodeType = nodeType;
  }

  public appendChild(child: DomNodeStub): DomNodeStub {
    if (child.parentNode && typeof child.parentNode.removeChild === 'function') {
      child.parentNode.removeChild(child);
    } else {
      const existingIdx = this.childNodes.indexOf(child);
      if (existingIdx >= 0) this.childNodes.splice(existingIdx, 1);
    }
    child.parentNode = this;
    this.childNodes.push(child);
    return child;
  }

  public removeChild(child: DomNodeStub): DomNodeStub {
    const index = this.childNodes.indexOf(child);
    if (index >= 0) {
      this.childNodes.splice(index, 1);
      child.parentNode = null;
    }
    return child;
  }

  public replaceChild(newChild: DomNodeStub, oldChild: DomNodeStub): DomNodeStub {
    if (newChild === oldChild) return newChild;
    if (newChild.parentNode && typeof newChild.parentNode.removeChild === 'function') {
      newChild.parentNode.removeChild(newChild);
    } else {
      const existingIdx = this.childNodes.indexOf(newChild);
      if (existingIdx >= 0) this.childNodes.splice(existingIdx, 1);
    }
    const index = this.childNodes.indexOf(oldChild);
    if (index >= 0) {
      newChild.parentNode = this;
      this.childNodes[index] = newChild;
      oldChild.parentNode = null;
    }
    return newChild;
  }

  public insertBefore(newChild: DomNodeStub, refChild: DomNodeStub | null): DomNodeStub {
    if (newChild === refChild) return newChild;
    if (newChild.parentNode && typeof newChild.parentNode.removeChild === 'function') {
      newChild.parentNode.removeChild(newChild);
    } else {
      const existingIdx = this.childNodes.indexOf(newChild);
      if (existingIdx >= 0) {
        this.childNodes.splice(existingIdx, 1);
      }
    }
    newChild.parentNode = this;
    if (!refChild) {
      this.childNodes.push(newChild);
      return newChild;
    }
    const index = this.childNodes.indexOf(refChild);
    if (index >= 0) {
      this.childNodes.splice(index, 0, newChild);
    } else {
      this.childNodes.push(newChild);
    }
    return newChild;
  }

  public setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
    if (name === 'id') this.id = value;
    if (name === 'class') this.className = value;
    if (name === 'key' || name === 'data-key') this.key = value;
    if (name.startsWith('data-')) {
      const key = name.slice(5);
      this.dataset[key] = value;
    }
  }

  public removeAttribute(name: string): void {
    this.attributes.delete(name);
    if (name === 'id') this.id = '';
    if (name === 'class') this.className = '';
    if (name === 'key' || name === 'data-key') this.key = undefined;
    if (name.startsWith('data-')) {
      const key = name.slice(5);
      delete this.dataset[key];
    }
  }

  public getAttribute(name: string): string | null {
    if (name === 'key') return this.key !== undefined ? String(this.key) : (this.attributes.get('key') || null);
    if (name === 'data-key') return this.key !== undefined ? String(this.key) : (this.attributes.get('data-key') || null);
    return this.attributes.get(name) || null;
  }

  public addEventListener(type: string, listener: (e: any) => void): void {
    if (!this.eventListeners.has(type)) {
      this.eventListeners.set(type, []);
    }
    this.eventListeners.get(type)!.push(listener);
  }

  public removeEventListener(type: string, listener: (e: any) => void): void {
    const list = this.eventListeners.get(type);
    if (list) {
      const idx = list.indexOf(listener);
      if (idx >= 0) list.splice(idx, 1);
    }
  }

  public dispatchEvent(event: { type: string; [k: string]: any }): boolean {
    const list = this.eventListeners.get(event.type);
    if (list) {
      for (const listener of list) {
        listener({ ...event, target: this });
      }
    }
    return true;
  }

  public closest(selector: string): DomNodeStub | null {
    if (selector.startsWith('[data-vnode-id]')) {
      if (this.attributes.has('data-vnode-id')) return this;
      return this.parentNode ? this.parentNode.closest(selector) : null;
    }
    return null;
  }
}
