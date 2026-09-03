import {
  HashChainEntry,
  createHashChainEntry,
  verifyHashChain,
  DilithiumSignature,
  dilithiumSign,
  dilithiumVerify,
  generateDilithiumKeyPair,
  uuidv4,
} from '../lib/crypto';

export interface EVOLISEvidence {
  id: string;
  entry: HashChainEntry;
  signature: DilithiumSignature;
  module: string;
  action: string;
}

export interface EVOLISStats {
  totalEntries: number;
  verified: boolean;
  firstEntry: number | null;
  lastEntry: number | null;
  modules: string[];
}

const GENESIS_HASH = '0'.repeat(64);

export class EVOLIS {
  private entries: EVOLISEvidence[] = [];
  private publicKey: string = '';
  private privateKey: string = '';

  async initialize(): Promise<void> {
    if (this.publicKey) return;
    const pair = await generateDilithiumKeyPair();
    this.publicKey = pair.publicKey;
    this.privateKey = pair.privateKey;
  }

  async record(module: string, action: string, data: string): Promise<EVOLISEvidence> {
    await this.initialize();
    const index = this.entries.length;
    const previousHash = index === 0 ? GENESIS_HASH : this.entries[index - 1].entry.hash;
    const entry = await createHashChainEntry(index, previousHash, `${module}:${action}:${data}`);
    const message = `${entry.index}:${entry.hash}:${entry.previousHash}`;
    const signature = await dilithiumSign(message, this.privateKey);
    signature.publicKey = this.publicKey;
    const evidence: EVOLISEvidence = {
      id: uuidv4(),
      entry,
      signature,
      module,
      action,
    };
    this.entries.push(evidence);
    return evidence;
  }

  async verify(): Promise<boolean> {
    if (this.entries.length === 0) return true;
    const chain = this.entries.map((e) => e.entry);
    const chainValid = await verifyHashChain(chain);
    if (!chainValid) return false;
    for (const evidence of this.entries) {
      const message = `${evidence.entry.index}:${evidence.entry.hash}:${evidence.entry.previousHash}`;
      const sigValid = await dilithiumVerify(message, evidence.signature, this.publicKey);
      if (!sigValid) return false;
    }
    return true;
  }

  getEntries(): EVOLISEvidence[] {
    return [...this.entries];
  }

  async getStats(): Promise<EVOLISStats> {
    const modules = [...new Set(this.entries.map((e) => e.module))];
    const verified = await this.verify();
    return {
      totalEntries: this.entries.length,
      verified,
      firstEntry: this.entries.length > 0 ? this.entries[0].entry.timestamp : null,
      lastEntry: this.entries.length > 0 ? this.entries[this.entries.length - 1].entry.timestamp : null,
      modules,
    };
  }

  getPublicKey(): string {
    return this.publicKey;
  }

  exportState(): EVOLISEvidence[] {
    return JSON.parse(JSON.stringify(this.entries));
  }

  importState(entries: EVOLISEvidence[]): void {
    this.entries = JSON.parse(JSON.stringify(entries));
  }

  clear(): void {
    this.entries = [];
    this.publicKey = '';
    this.privateKey = '';
  }
}

export const evolis = new EVOLIS();
