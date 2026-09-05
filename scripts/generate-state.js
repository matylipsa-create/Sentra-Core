import { moralNode } from '../src/core/MoralNode';
import { evolis } from '../src/core/EVOLIS';
import { bioSoftware } from '../src/core/BioSoftwareInterface';

async function main() {
  console.log('=== Sentra Core State Generator ===\n');

  console.log('MoralNode Rules:');
  for (const rule of moralNode.getAllRules()) {
    console.log(`  ${rule.rule}: ${rule.description}`);
  }
  console.log();

  const testCommands = ['describir escena', 'navegar al norte', 'registrar evidencia'];
  for (const cmd of testCommands) {
    const eval_ = moralNode.evaluate(cmd);
    console.log(`Command: "${cmd}" -> allowed=${eval_.allowed}`);
  }
  console.log();

  await evolis.initialize();
  await evolis.record('vision', 'detection', 'person:0.95,car:0.82');
  await evolis.record('seguridad', 'alert', 'motion_detected');
  await evolis.record('evidencia', 'export', 'hash_chain_verified');

  const verified = await evolis.verify();
  const stats = evolis.getStats();
  console.log('EVOLIS Stats:');
  console.log(`  Entries: ${stats.totalEntries}`);
  console.log(`  Verified: ${verified}`);
  console.log(`  Modules: ${stats.modules.join(', ')}`);
  console.log();

  console.log('BioSoftware Protocols:');
  bioSoftware.setEnabled(true);
  for (const p of bioSoftware.getProtocols()) {
    console.log(`  ${p.label}: ${p.description} (${Math.round(p.defaultDuration / 60)} min)`);
  }
  const session = bioSoftware.startSession('cardiac_coherence');
  if (session) {
    bioSoftware.tick(120000);
    const reframe = bioSoftware.getReframe();
    console.log(`  Session started: ${session.protocol}`);
    console.log(`  Reframe: ${reframe}`);
    bioSoftware.stopSession();
  }
  const bioStats = bioSoftware.getStats();
  console.log(`  Total sessions: ${bioStats.totalSessions}`);
  console.log(`  Avg coherence: ${Math.round(bioStats.avgCoherence * 100)}%`);
  console.log();

  console.log('State generation complete.');
}

main().catch(console.error);
