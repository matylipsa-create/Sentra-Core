import { moralNode } from '../src/core/MoralNode';
import { evolis } from '../src/core/EVOLIS';

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

  console.log('State generation complete.');
}

main().catch(console.error);
