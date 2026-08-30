/**
 * @goat/devtools - BleNfcSimulator Component
 * Virtual BLE peripheral scanner/discovery, GATT services & characteristics CRUD,
 * NDEF tag payload generator & tap trigger.
 */

import React, { useState } from 'react';
import { useDevToolsStore } from '../../store/index.ts';
import {
  Bluetooth,
  Radio,
  Plus,
  Trash2,
  Layers,
  Smartphone,
  Zap,
  Link,
  FileText,
  CheckCircle2,
  RefreshCw,
  Edit2,
  Save,
} from 'lucide-react';
import type { BlePeripheral } from '../../types/index.ts';

export const BleNfcSimulator: React.FC = () => {
  const {
    blePeripherals = [],
    addBlePeripheral,
    removeBlePeripheral,
    updateBlePeripheral,
    setBleConnected,
    nfcTag = { id: '04:8A:2B:6F:4C:80', techList: ['android.nfc.tech.Ndef', 'android.nfc.tech.NfcA'], ndefMessage: 'https://goat.dev/app/demo' },
    setNfcTag,
    addNfcRecord,
  } = useDevToolsStore();

  const [activeTab, setActiveTab] = useState<'ble' | 'nfc'>('ble');

  // BLE State
  const [isScanning, setIsScanning] = useState(false);
  const [newName, setNewName] = useState('');
  const [newRssi, setNewRssi] = useState('-65');
  const [newServiceUuid, setNewServiceUuid] = useState('180D');
  const [editingCharUuid, setEditingCharUuid] = useState<string | null>(null);
  const [editingCharValue, setEditingCharValue] = useState('');

  // NFC State
  const [tagType, setTagType] = useState<'uri' | 'text' | 'mime'>('uri');
  const [tagPayload, setTagPayload] = useState('https://goat.dev/app/demo');
  const [tagId, setTagId] = useState(nfcTag.id || '04:8A:2B:6F:4C:80');
  const [tapSuccess, setTapSuccess] = useState(false);

  // BLE Handlers
  const handleAddPeripheral = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    const serviceUuid = newServiceUuid.trim() || '180D';
    const peripheral: BlePeripheral = {
      id: `ble-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: newName.trim(),
      rssi: Number(newRssi) || -65,
      serviceUuids: [serviceUuid],
      services: [
        {
          uuid: serviceUuid,
          characteristics: [
            { uuid: '2A37', value: '48 52 4D 00', properties: ['read', 'notify'] },
            { uuid: '2A38', value: '01', properties: ['read'] },
          ],
        },
      ],
      isConnected: false,
    };

    addBlePeripheral(peripheral);
    setNewName('');
  };

  const handleUpdateChar = (devId: string, charUuid: string, newVal: string) => {
    const dev = blePeripherals.find((p) => p.id === devId);
    if (!dev || !dev.services) return;

    const updatedServices = dev.services.map((svc: any) => ({
      ...svc,
      characteristics: svc.characteristics?.map((ch: any) =>
        ch.uuid === charUuid ? { ...ch, value: newVal } : ch
      ),
    }));

    updateBlePeripheral(devId, { services: updatedServices });
    setEditingCharUuid(null);
  };

  // NFC Handlers
  const handleGenerateUid = () => {
    const randomHex = () => Math.floor(Math.random() * 256).toString(16).padStart(2, '0').toUpperCase();
    const newUid = `${randomHex()}:${randomHex()}:${randomHex()}:${randomHex()}:${randomHex()}:${randomHex()}:${randomHex()}`;
    setTagId(newUid);
    setNfcTag({ id: newUid, techList: nfcTag.techList, ndefMessage: tagPayload });
  };

  const handleSimulateTap = () => {
    const tag = {
      id: tagId,
      techList: ['android.nfc.tech.Ndef', 'android.nfc.tech.NfcA'],
      ndefMessage: tagPayload,
    };
    setNfcTag(tag);
    if (typeof addNfcRecord === 'function') {
      addNfcRecord({
        id: tagId,
        type: tagType,
        payload: tagPayload,
        timestamp: Date.now(),
      });
    }

    setTapSuccess(true);
    setTimeout(() => setTapSuccess(false), 2000);
  };

  return (
    <div className="p-4 space-y-4 text-xs select-none" data-testid="ble-nfc-simulator">
      {/* Sub-Nav Switcher */}
      <div className="grid grid-cols-2 gap-1.5 p-1 bg-neutral-900 rounded-lg border border-neutral-800">
        <button
          onClick={() => setActiveTab('ble')}
          className={`py-1.5 rounded-md font-bold text-xs flex items-center justify-center gap-1.5 transition-colors ${
            activeTab === 'ble'
              ? 'bg-blue-600 text-white shadow'
              : 'text-neutral-400 hover:text-neutral-200'
          }`}
        >
          <Bluetooth className="w-3.5 h-3.5" />
          <span>BLE Simulator ({blePeripherals.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('nfc')}
          className={`py-1.5 rounded-md font-bold text-xs flex items-center justify-center gap-1.5 transition-colors ${
            activeTab === 'nfc'
              ? 'bg-purple-600 text-white shadow'
              : 'text-neutral-400 hover:text-neutral-200'
          }`}
        >
          <Smartphone className="w-3.5 h-3.5" />
          <span>NFC Tag Generator</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* 1. BLE SIMULATOR VIEW                                                     */}
      {/* ========================================================================= */}
      {activeTab === 'ble' && (
        <div className="space-y-4" data-testid="ble-section">
          {/* Header & Scan Button */}
          <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
            <div className="flex items-center gap-2">
              <Bluetooth className="w-4 h-4 text-blue-400" />
              <h3 className="font-bold text-neutral-200 uppercase tracking-wider text-[11px]">
                Virtual BLE Peripherals
              </h3>
            </div>
            <button
              onClick={() => setIsScanning(!isScanning)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold transition-colors ${
                isScanning
                  ? 'bg-blue-600 text-white animate-pulse'
                  : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-300'
              }`}
            >
              <Radio className="w-3 h-3" />
              <span>{isScanning ? 'Scanning...' : 'Start Scan'}</span>
            </button>
          </div>

          {/* Add Virtual Peripheral Form */}
          <form onSubmit={handleAddPeripheral} className="space-y-2 bg-neutral-900/60 p-3 rounded-lg border border-neutral-800">
            <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1">
              Spawn Virtual BLE Device
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2">
                <label className="text-[10px] text-neutral-500 font-mono">Device Name</label>
                <input
                  type="text"
                  placeholder="e.g. Heart Rate Monitor"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full bg-neutral-800 text-neutral-200 px-2 py-1 rounded border border-neutral-700 font-mono text-xs focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="text-[10px] text-neutral-500 font-mono">RSSI (dBm)</label>
                <input
                  type="number"
                  value={newRssi}
                  onChange={(e) => setNewRssi(e.target.value)}
                  className="w-full bg-neutral-800 text-neutral-200 px-2 py-1 rounded border border-neutral-700 font-mono text-xs focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
            <div>
              <label className="text-[10px] text-neutral-500 font-mono">Primary Service UUID</label>
              <input
                type="text"
                placeholder="e.g. 180D (Heart Rate) or 180F (Battery)"
                value={newServiceUuid}
                onChange={(e) => setNewServiceUuid(e.target.value)}
                className="w-full bg-neutral-800 text-neutral-200 px-2 py-1 rounded border border-neutral-700 font-mono text-xs focus:outline-none focus:border-blue-500"
              />
            </div>
            <button
              type="submit"
              className="w-full py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded text-xs transition-colors flex items-center justify-center gap-1 mt-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Virtual Peripheral</span>
            </button>
          </form>

          {/* Discovered Peripherals List */}
          <div className="space-y-2">
            <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
              Discovered Peripherals ({blePeripherals.length})
            </div>

            {blePeripherals.length === 0 ? (
              <div className="p-4 rounded-lg bg-neutral-900/40 border border-dashed border-neutral-800 text-center text-neutral-500">
                No virtual BLE peripherals created. Add one above.
              </div>
            ) : (
              <div className="space-y-2">
                {blePeripherals.map((dev) => (
                  <div
                    key={dev.id}
                    className="p-3 bg-neutral-900/80 rounded-lg border border-neutral-800 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-bold text-neutral-200 text-[11px] flex items-center gap-1.5">
                          <span>{dev.name}</span>
                          {dev.isConnected && (
                            <span className="px-1.5 py-0.2 bg-emerald-950/60 border border-emerald-800/60 rounded text-[9px] text-emerald-400 font-mono font-normal">
                              Connected
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-neutral-400 font-mono">
                          RSSI: {dev.rssi} dBm | ID: {dev.id.slice(-8)}
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setBleConnected(dev.id, !dev.isConnected)}
                          className={`px-2.5 py-1 rounded text-[10px] font-bold transition-colors ${
                            dev.isConnected
                              ? 'bg-rose-950 text-rose-300 border border-rose-800 hover:bg-rose-900'
                              : 'bg-blue-600 text-white hover:bg-blue-500'
                          }`}
                        >
                          {dev.isConnected ? 'Disconnect' : 'Connect'}
                        </button>
                        <button
                          onClick={() => removeBlePeripheral(dev.id)}
                          className="p-1 hover:bg-neutral-800 rounded text-neutral-400 hover:text-rose-400 transition-colors"
                          title="Remove device"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* GATT Characteristics Viewer / Editor */}
                    {dev.services && dev.services.length > 0 && (
                      <div className="pt-2 border-t border-neutral-800/80 space-y-1.5 font-mono text-[10px]">
                        <div className="text-neutral-500 font-sans font-semibold text-[9px] uppercase tracking-wider">
                          GATT Services & Characteristics
                        </div>
                        {dev.services.map((svc: any) => (
                          <div key={svc.uuid} className="bg-black/40 p-2 rounded border border-neutral-800 space-y-1">
                            <div className="text-blue-400 font-bold">SVC: {svc.uuid}</div>
                            {svc.characteristics?.map((ch: any) => (
                              <div key={ch.uuid} className="flex items-center justify-between text-neutral-300 pl-2">
                                <span>CHR {ch.uuid}:</span>
                                {editingCharUuid === `${dev.id}:${ch.uuid}` ? (
                                  <div className="flex items-center gap-1">
                                    <input
                                      type="text"
                                      value={editingCharValue}
                                      onChange={(e) => setEditingCharValue(e.target.value)}
                                      className="bg-neutral-800 text-neutral-100 px-1 py-0.5 rounded text-[10px] w-24 border border-blue-500"
                                    />
                                    <button
                                      onClick={() => handleUpdateChar(dev.id, ch.uuid, editingCharValue)}
                                      className="p-0.5 text-emerald-400 hover:text-emerald-300"
                                    >
                                      <Save className="w-3 h-3" />
                                    </button>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1">
                                    <span className="text-emerald-400 font-bold">{ch.value}</span>
                                    <button
                                      onClick={() => {
                                        setEditingCharUuid(`${dev.id}:${ch.uuid}`);
                                        setEditingCharValue(ch.value);
                                      }}
                                      className="p-0.5 text-neutral-500 hover:text-neutral-300"
                                    >
                                      <Edit2 className="w-3 h-3" />
                                    </button>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. NFC TAG GENERATOR & TAP SIMULATOR VIEW                                  */}
      {/* ========================================================================= */}
      {activeTab === 'nfc' && (
        <div className="space-y-4" data-testid="nfc-section">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
            <div className="flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-purple-400" />
              <h3 className="font-bold text-neutral-200 uppercase tracking-wider text-[11px]">
                NFC Tag Generator & Simulator
              </h3>
            </div>
            <button
              onClick={handleGenerateUid}
              className="flex items-center gap-1 text-[10px] text-neutral-400 hover:text-white transition-colors"
              title="Regenerate random UID"
            >
              <RefreshCw className="w-3 h-3" />
              <span>New UID</span>
            </button>
          </div>

          {/* Tag UID Configuration */}
          <div className="space-y-2 bg-neutral-900/60 p-3 rounded-lg border border-neutral-800">
            <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
              Simulated NFC Chip ID (UID)
            </div>
            <div className="font-mono text-xs text-purple-300 font-bold bg-black/60 px-2 py-1.5 rounded border border-neutral-800 flex justify-between items-center">
              <span>{tagId}</span>
              <span className="text-[9px] text-neutral-500 font-normal">ISO 14443-A</span>
            </div>
          </div>

          {/* NDEF Record Type Selector */}
          <div className="space-y-2">
            <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
              NDEF Record Payload Type
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              <button
                onClick={() => {
                  setTagType('uri');
                  setTagPayload('https://goat.dev/app/demo');
                }}
                className={`py-1.5 px-2 rounded font-medium border text-[11px] flex items-center justify-center gap-1 transition-colors ${
                  tagType === 'uri'
                    ? 'bg-purple-600/30 border-purple-500 text-purple-300'
                    : 'bg-neutral-900 border-neutral-800 text-neutral-300 hover:bg-neutral-800'
                }`}
              >
                <Link className="w-3 h-3" />
                <span>URI / URL</span>
              </button>
              <button
                onClick={() => {
                  setTagType('text');
                  setTagPayload('Goat Mini-App Auth Pass: 893421');
                }}
                className={`py-1.5 px-2 rounded font-medium border text-[11px] flex items-center justify-center gap-1 transition-colors ${
                  tagType === 'text'
                    ? 'bg-purple-600/30 border-purple-500 text-purple-300'
                    : 'bg-neutral-900 border-neutral-800 text-neutral-300 hover:bg-neutral-800'
                }`}
              >
                <FileText className="w-3 h-3" />
                <span>Text (UTF-8)</span>
              </button>
              <button
                onClick={() => {
                  setTagType('mime');
                  setTagPayload('application/json:{"event":"PAYMENT_TAP","amount":25.00}');
                }}
                className={`py-1.5 px-2 rounded font-medium border text-[11px] flex items-center justify-center gap-1 transition-colors ${
                  tagType === 'mime'
                    ? 'bg-purple-600/30 border-purple-500 text-purple-300'
                    : 'bg-neutral-900 border-neutral-800 text-neutral-300 hover:bg-neutral-800'
                }`}
              >
                <span>MIME Media</span>
              </button>
            </div>

            {/* Payload Input */}
            <div>
              <label className="text-[10px] text-neutral-500 font-mono">NDEF Payload Value</label>
              <input
                type="text"
                value={tagPayload}
                onChange={(e) => setTagPayload(e.target.value)}
                className="w-full bg-neutral-800 text-neutral-200 px-2 py-1.5 rounded border border-neutral-700 font-mono text-xs focus:outline-none focus:border-purple-500"
              />
            </div>
          </div>

          {/* Simulate NFC Tap Trigger Button */}
          <div className="pt-2">
            <button
              onClick={handleSimulateTap}
              className={`w-full py-2.5 rounded-lg font-bold text-xs shadow-lg flex items-center justify-center gap-2 transition-all ${
                tapSuccess
                  ? 'bg-emerald-600 text-white animate-bounce'
                  : 'bg-purple-600 hover:bg-purple-500 text-white active:scale-98'
              }`}
            >
              {tapSuccess ? (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>NFC Tag Tapped! (Dispatched to Mini-App)</span>
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4" />
                  <span>⚡ Trigger Virtual NFC Tag Tap</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
