import { IpcChannel } from '../ipc/channel.js';
import { UiEventPayload, SerializedTouchEvent } from '../types.js';

export class AppViewEventInterceptor {
  private readonly container: any;
  private readonly ipc: IpcChannel;
  private readonly eventTypes = ['click', 'input', 'change', 'submit', 'touchstart', 'touchend', 'touchmove'];
  private readonly boundHandlers = new Map<string, (e: any) => void>();

  constructor(container: any, ipc: IpcChannel) {
    this.container = container;
    this.ipc = ipc;
    this.attachListeners();
  }

  private attachListeners(): void {
    if (!this.container || typeof this.container.addEventListener !== 'function') {
      return;
    }

    for (const eventType of this.eventTypes) {
      const handler = (event: any) => this.handleEvent(eventType, event);
      this.boundHandlers.set(eventType, handler);
      this.container.addEventListener(eventType, handler, true);
    }
  }

  private handleEvent(eventType: string, event: any): void {
    const target = event.target || {};
    let nodeId: string | undefined;
    const dataset: Record<string, unknown> = {};

    if (typeof target.closest === 'function') {
      const vnodeTarget = target.closest('[data-vnode-id]');
      if (vnodeTarget) {
        nodeId = vnodeTarget.getAttribute('data-vnode-id') || undefined;
        if (vnodeTarget.dataset) {
          for (const [key, value] of Object.entries(vnodeTarget.dataset)) {
            dataset[key] = value;
          }
        }
      }
    }

    let touches: SerializedTouchEvent[] | undefined;
    if (event.touches && Array.isArray(event.touches)) {
      touches = Array.from(event.touches).map((t: any) => ({
        identifier: t.identifier || 0,
        clientX: t.clientX || 0,
        clientY: t.clientY || 0,
        pageX: t.pageX || 0,
        pageY: t.pageY || 0,
      }));
    }

    const payload: UiEventPayload = {
      eventId: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      nodeId: nodeId || target.id || 'root',
      eventType: `on${eventType.charAt(0).toUpperCase() + eventType.slice(1)}`,
      timestamp: Date.now(),
      target: {
        id: target.id,
        dataset,
        value: target.value,
        checked: target.checked,
      },
      data: {
        value: target.value,
        checked: target.checked,
        ...dataset,
      },
      touches,
    };

    this.ipc.send('UI_EVENT', payload);
  }

  public simulateUserEvent(
    eventType: string,
    targetPath: number[] = [],
    data: Record<string, unknown> = {}
  ): void {
    const eventPayload: UiEventPayload = {
      eventId: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      eventType,
      targetPath,
      data,
      timestamp: Date.now(),
    };

    this.ipc.send('UI_EVENT', eventPayload);
  }

  public dispose(): void {
    if (this.container && typeof this.container.removeEventListener === 'function') {
      for (const [eventType, handler] of this.boundHandlers.entries()) {
        this.container.removeEventListener(eventType, handler, true);
      }
    }
    this.boundHandlers.clear();
  }
}
