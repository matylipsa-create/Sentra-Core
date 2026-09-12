/**
 * LoraCrypto — AES-128, HMAC-SHA256 y NONCE anti-replay usando crypto.subtle.
 *
 * Espejo TypeScript de firmware/lora_crypto.cpp.
 * Rotacion de claves cada 24h o 10000 paquetes.
 */

import { HMAC_SIZE } from './LoraProtocol';

const AES_KEY_SIZE = 16;
const KEY_ROTATION_MS = 86_400_000;
const KEY_ROTATION_PKTS = 10_000;
const MAX_NONCE_WINDOW = 256;

export class LoraCrypto {
  private aesKey: CryptoKey | null = null;
  private hmacKey: CryptoKey | null = null;
  private rawAesKey: Uint8Array = new Uint8Array(AES_KEY_SIZE);
  private rawHmacKey: Uint8Array = new Uint8Array(AES_KEY_SIZE);
  private keyTimestamp = 0;
  private packetCount = 0;
  private seenNonces: Set<string> = new Set();

  async init(): Promise<void> {
    if (this.aesKey) return;
    await this.generateKeys();
  }

  private async generateKeys(): Promise<void> {
    this.rawAesKey = crypto.getRandomValues(new Uint8Array(AES_KEY_SIZE));
    this.rawHmacKey = crypto.getRandomValues(new Uint8Array(AES_KEY_SIZE));

    this.aesKey = await crypto.subtle.importKey(
      'raw',
      this.rawAesKey.buffer as ArrayBuffer,
      { name: 'AES-CTR' },
      false,
      ['encrypt', 'decrypt'],
    );

    this.hmacKey = await crypto.subtle.importKey(
      'raw',
      this.rawHmacKey.buffer as ArrayBuffer,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign', 'verify'],
    );

    this.keyTimestamp = Date.now();
    this.packetCount = 0;
  }

  needsKeyRotation(): boolean {
    if (!this.aesKey) return true;
    if (Date.now() - this.keyTimestamp > KEY_ROTATION_MS) return true;
    if (this.packetCount >= KEY_ROTATION_PKTS) return true;
    return false;
  }

  async rotateKeys(): Promise<void> {
    await this.generateKeys();
  }

  async encryptPayload(payload: Uint8Array, nonce: Uint8Array): Promise<Uint8Array> {
    if (!this.aesKey) await this.init();
    const counter = new Uint8Array(16);
    counter.set(nonce.subarray(0, Math.min(nonce.length, 8)));
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-CTR', counter: counter.buffer as ArrayBuffer },
      this.aesKey!,
      payload.buffer as ArrayBuffer,
    );
    return new Uint8Array(encrypted);
  }

  async decryptPayload(encrypted: Uint8Array, nonce: Uint8Array): Promise<Uint8Array> {
    if (!this.aesKey) await this.init();
    const counter = new Uint8Array(16);
    counter.set(nonce.subarray(0, Math.min(nonce.length, 8)));
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-CTR', counter: counter.buffer as ArrayBuffer },
      this.aesKey!,
      encrypted.buffer as ArrayBuffer,
    );
    return new Uint8Array(decrypted);
  }

  async calculateHmac(data: Uint8Array): Promise<Uint8Array> {
    if (!this.hmacKey) await this.init();
    const sig = await crypto.subtle.sign('HMAC', this.hmacKey!, data.buffer as ArrayBuffer);
    return new Uint8Array(sig).subarray(0, HMAC_SIZE);
  }

  async verifyHmac(data: Uint8Array, receivedHmac: Uint8Array): Promise<boolean> {
    const computed = await this.calculateHmac(data);
    if (computed.length !== receivedHmac.length) return false;
    let diff = 0;
    for (let i = 0; i < computed.length; i++) {
      diff |= computed[i] ^ receivedHmac[i];
    }
    return diff === 0;
  }

  async computePacketHmac(packetData: Uint8Array): Promise<Uint8Array> {
    return this.calculateHmac(packetData.subarray(0, packetData.length - HMAC_SIZE));
  }

  async verifyPacketHmac(packetData: Uint8Array, receivedHmac: Uint8Array): Promise<boolean> {
    return this.verifyHmac(
      packetData.subarray(0, packetData.length - HMAC_SIZE),
      receivedHmac,
    );
  }

  isNonceFresh(nonce: Uint8Array): boolean {
    const key = Array.from(nonce).map((b) => b.toString(16).padStart(2, '0')).join('');
    if (this.seenNonces.has(key)) return false;
    this.seenNonces.add(key);
    if (this.seenNonces.size > MAX_NONCE_WINDOW) {
      const first = this.seenNonces.values().next().value;
      if (first !== undefined) this.seenNonces.delete(first);
    }
    return true;
  }

  incrementPacketCount(): void {
    this.packetCount++;
  }

  getPacketCount(): number {
    return this.packetCount;
  }
}

export const loraCrypto = new LoraCrypto();
