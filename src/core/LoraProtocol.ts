/**
 * LoraProtocol — Espejo TypeScript del protocolo P2P LoRa (SX1262).
 *
 * ÚNICA fuente de verdad para: packEvent(), verifyPacket(), calculateCrc16().
 * Layer0Bridge.ts consume estas funciones para traducir binario ↔ TS.
 */

export const PROTOCOL_VERSION = 1;
export const MAX_PACKET_SIZE = 74;
export const PAYLOAD_SIZE = 40;
export const HMAC_SIZE = 16;
export const NONCE_SIZE = 8;
export const CRC_SIZE = 2;

export enum LoraPacketType {
  DETECTION = 0x01,
  ALERT = 0x02,
  VETO = 0x03,
  HASH_CHAIN = 0x04,
  HEARTBEAT = 0x05,
  MESH_ROUTE = 0x06,
}

export interface LoraPacket {
  version: number;
  type: number;
  nodeId: number;
  timestamp: number;
  payload: Uint8Array;
  crc16: number;
  nonce: Uint8Array;
  hmac: Uint8Array;
}

export interface LoraEvent {
  type: LoraPacketType;
  nodeId: number;
  payload: Uint8Array;
}

/**
 * CRC16-CCITT con polinomio 0xA001 (espejo del firmware C++).
 */
export function calculateCrc16(data: Uint8Array): number {
  let crc = 0xffff;
  for (let i = 0; i < data.length; i++) {
    crc ^= data[i];
    for (let j = 0; j < 8; j++) {
      if (crc & 0x0001) {
        crc = (crc >> 1) ^ 0xa001;
      } else {
        crc >>= 1;
      }
    }
  }
  return crc;
}

/**
 * Empaqueta un evento en un LoraPacket de 74 bytes.
 * El nonce y hmac se dejan en cero; LoraCrypto.ts los completa.
 */
export function packEvent(
  type: LoraPacketType,
  nodeId: number,
  payloadRaw: Uint8Array,
): LoraPacket {
  const payload = new Uint8Array(PAYLOAD_SIZE);
  const copyLen = Math.min(payloadRaw.length, PAYLOAD_SIZE);
  payload.set(payloadRaw.subarray(0, copyLen));

  const timestamp = Date.now();

  // CRC sobre version + type + nodeId + timestamp + payload (48 bytes)
  const crcInput = new Uint8Array(48);
  crcInput[0] = PROTOCOL_VERSION;
  crcInput[1] = type;
  const dv = new DataView(crcInput.buffer);
  dv.setUint16(2, nodeId, true);
  dv.setUint32(4, timestamp, true);
  crcInput.set(payload, 8);

  const crc16 = calculateCrc16(crcInput);

  return {
    version: PROTOCOL_VERSION,
    type,
    nodeId,
    timestamp,
    payload,
    crc16,
    nonce: new Uint8Array(NONCE_SIZE),
    hmac: new Uint8Array(HMAC_SIZE),
  };
}

/**
 * Verifica la integridad de un paquete recibido (version + CRC16).
 */
export function verifyPacket(pkt: LoraPacket): boolean {
  if (pkt.version !== PROTOCOL_VERSION) return false;

  const crcInput = new Uint8Array(48);
  crcInput[0] = pkt.version;
  crcInput[1] = pkt.type;
  const dv = new DataView(crcInput.buffer);
  dv.setUint16(2, pkt.nodeId, true);
  dv.setUint32(4, pkt.timestamp, true);
  crcInput.set(pkt.payload, 8);

  return calculateCrc16(crcInput) === pkt.crc16;
}

/**
 * Serializa un LoraPacket a un buffer plano de 74 bytes.
 */
export function serializePacket(pkt: LoraPacket): Uint8Array {
  const buf = new Uint8Array(MAX_PACKET_SIZE);
  const dv = new DataView(buf.buffer);
  buf[0] = pkt.version;
  buf[1] = pkt.type;
  dv.setUint16(2, pkt.nodeId, true);
  dv.setUint32(4, pkt.timestamp, true);
  buf.set(pkt.payload, 8);
  dv.setUint16(48, pkt.crc16, true);
  buf.set(pkt.nonce, 50);
  buf.set(pkt.hmac, 58);
  return buf;
}

/**
 * Deserializa un buffer plano de 74 bytes a un LoraPacket.
 */
export function deserializePacket(data: Uint8Array): LoraPacket {
  const dv = new DataView(data.buffer, data.byteOffset, data.byteLength);
  return {
    version: data[0],
    type: data[1],
    nodeId: dv.getUint16(2, true),
    timestamp: dv.getUint32(4, true),
    payload: data.subarray(8, 48),
    crc16: dv.getUint16(48, true),
    nonce: data.subarray(50, 58),
    hmac: data.subarray(58, 74),
  };
}

/**
 * Genera un NONCE unico de 8 bytes combinando timestamp + contador.
 */
let nonceCounter = 0;
export function generateNonce(): Uint8Array {
  const nonce = new Uint8Array(NONCE_SIZE);
  const dv = new DataView(nonce.buffer);
  dv.setUint32(0, Date.now() & 0xffffffff, true);
  nonceCounter = (nonceCounter + 1) & 0xffffffff;
  dv.setUint32(4, nonceCounter, true);
  return nonce;
}
