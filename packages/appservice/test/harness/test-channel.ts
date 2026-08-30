import { InMemoryMessagePortPair } from '../../src/simulation/in-memory-worker.js';
import { IpcChannel } from '../../src/ipc/channel.js';

export function createTestChannelPair(): {
  appServiceChannel: IpcChannel;
  appViewChannel: IpcChannel;
  pair: InMemoryMessagePortPair;
} {
  const pair = new InMemoryMessagePortPair();
  const appServiceChannel = new IpcChannel('appservice', pair.port1);
  const appViewChannel = new IpcChannel('appview', pair.port2);

  return {
    appServiceChannel,
    appViewChannel,
    pair,
  };
}
