/// <reference types="vite/client" />

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}

declare class SpeechRecognition extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

interface Window {
  SpeechRecognition?: typeof SpeechRecognition;
  webkitSpeechRecognition?: typeof SpeechRecognition;
}

interface RequestDeviceOptions {
  filters?: { services: (string | number)[] }[];
  optionalServices?: (string | number)[];
  acceptAllDevices?: boolean;
}

interface BluetoothRemoteGATTCharacteristic {
  writeValue(data: BufferSource): Promise<void>;
  readValue(): Promise<DataView>;
  startNotifications(): Promise<BluetoothRemoteGATTCharacteristic>;
}

interface BluetoothRemoteGATTServer {
  connected: boolean;
  connect(): Promise<BluetoothRemoteGATTServer>;
  disconnect(): void;
  getPrimaryService(uuid: string): Promise<{ getCharacteristic(uuid: string): Promise<BluetoothRemoteGATTCharacteristic> }>;
}

interface BluetoothDevice extends EventTarget {
  id?: string;
  name?: string;
  gatt?: BluetoothRemoteGATTServer;
  addEventListener(type: 'gattserverdisconnected', listener: () => void): void;
}

interface USBDevice {
  vendorId: number;
  productId: number;
  manufacturerName?: string | null;
  productName?: string | null;
  serialNumber?: string | null;
  connected?: boolean;
  open(): Promise<void>;
  close(): Promise<void>;
  configuration?: unknown;
  selectConfiguration(value: number): Promise<void>;
  claimInterface(interfaceNumber: number): Promise<void>;
  releaseInterface(interfaceNumber: number): Promise<void>;
  transferIn(endpointNumber: number, length: number): Promise<{ data: DataView; status: string }>;
  transferOut(endpointNumber: number, data: BufferSource): Promise<{ bytesWritten: number; status: string }>;
}

interface USBConnectionEvent extends Event {
  device: USBDevice;
}

interface USB {
  getDevices(): Promise<USBDevice[]>;
  requestDevice(opts: { filters: Record<string, unknown>[] }): Promise<USBDevice>;
  addEventListener(type: 'connect', listener: (e: USBConnectionEvent) => void): void;
  addEventListener(type: 'disconnect', listener: (e: USBConnectionEvent) => void): void;
}

interface Navigator {
  usb?: USB;
}
