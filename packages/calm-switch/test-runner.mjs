// Simple test runner for calm-switch
import { CalmSwitch, createCalmSwitchModule, calm_switch_module } from './dist/index.js';
import assert from 'assert';

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failed++;
    console.log(`  ✗ ${name}: ${e.message}`);
  }
}

console.log('\nCalmSwitch Tests');
console.log('================\n');

// Constructor
test('constructor creates instance with initial state', () => {
  const c = new CalmSwitch();
  const s = c.getState();
  assert.strictEqual(s.active, false);
  assert.strictEqual(s.interventions, 0);
  assert.strictEqual(s.lastActivatedAt, null);
  assert.strictEqual(s.currentTechnique, null);
  assert.deepStrictEqual(s.transitionLog, []);
});

// init
test('init resolves without error', async () => {
  await new CalmSwitch().init();
});

// activate sets active
test('activate sets active state', () => {
  const c = new CalmSwitch();
  c.setRng(() => 0);
  c.activate('anxious');
  assert.strictEqual(c.isActive(), true);
});

// activate increments
test('activate increments interventions', () => {
  const c = new CalmSwitch();
  c.setRng(() => 0);
  c.activate('angry');
  assert.strictEqual(c.getInterventionCount(), 1);
  c.activate('sad');
  assert.strictEqual(c.getInterventionCount(), 2);
});

// activate sets lastActivatedAt
test('activate sets lastActivatedAt', () => {
  const c = new CalmSwitch();
  c.setRng(() => 0);
  const before = Date.now();
  c.activate('anxious');
  assert.ok(c.getState().lastActivatedAt >= before);
});

// activate selects technique
test('activate selects technique from mapped pool', () => {
  const c = new CalmSwitch();
  c.setRng(() => 0);
  c.activate('angry');
  assert.strictEqual(c.getState().currentTechnique, 'box-breathing');
});

// activate adds log entry
test('activate adds transition log entry', () => {
  const c = new CalmSwitch();
  c.setRng(() => 0);
  c.activate('anxious');
  const log = c.getState().transitionLog;
  assert.strictEqual(log.length, 1);
  assert.strictEqual(log[0].from, 'anxious');
  assert.strictEqual(log[0].to, 'calm');
  assert.strictEqual(log[0].technique, 'grounding-5-4-3-2-1');
});

// selectTechnique
test('selectTechnique returns technique from state pool', () => {
  const c = new CalmSwitch();
  c.setRng(() => 0.5);
  const t = c.selectTechnique('anxious');
  assert.ok(['grounding-5-4-3-2-1', 'tapping', 'vagus-nerve'].includes(t));
});

// selectTechnique fallback
test('selectTechnique falls back to default for unknown state', () => {
  const c = new CalmSwitch();
  c.setRng(() => 0);
  assert.strictEqual(c.selectTechnique('confused'), 'box-breathing');
});

// deactivate
test('deactivate clears active state', () => {
  const c = new CalmSwitch();
  c.setRng(() => 0);
  c.activate('angry');
  assert.strictEqual(c.isActive(), true);
  c.deactivate();
  assert.strictEqual(c.isActive(), false);
  assert.strictEqual(c.getState().currentTechnique, null);
});

// getLastTransition
test('getLastTransition returns most recent entry', () => {
  const c = new CalmSwitch();
  c.setRng(() => 0);
  c.activate('angry');
  c.deactivate();
  c.activate('sad');
  const last = c.getLastTransition();
  assert.strictEqual(last.from, 'sad');
});

// getLastTransition null
test('getLastTransition returns null with empty log', () => {
  assert.strictEqual(new CalmSwitch().getLastTransition(), null);
});

// getTransitionsForState
test('getTransitionsForState filters correctly', () => {
  const c = new CalmSwitch();
  c.setRng(() => 0);
  c.activate('angry');
  c.deactivate();
  c.activate('angry');
  c.deactivate();
  c.activate('sad');
  assert.strictEqual(c.getTransitionsForState('angry').length, 2);
  assert.strictEqual(c.getTransitionsForState('sad').length, 1);
});

// clearLog
test('clearLog empties transition log', () => {
  const c = new CalmSwitch();
  c.setRng(() => 0);
  c.activate('angry');
  c.activate('sad');
  assert.strictEqual(c.getState().transitionLog.length, 2);
  c.clearLog();
  assert.strictEqual(c.getState().transitionLog.length, 0);
});

// clearLog preserves interventions
test('clearLog does not reset interventions', () => {
  const c = new CalmSwitch();
  c.setRng(() => 0);
  c.activate('angry');
  c.activate('sad');
  c.clearLog();
  assert.strictEqual(c.getInterventionCount(), 2);
});

// destroy
test('destroy resets all state', async () => {
  const c = new CalmSwitch();
  c.setRng(() => 0);
  c.activate('angry');
  c.activate('sad');
  await c.destroy();
  assert.strictEqual(c.getState().active, false);
  assert.strictEqual(c.getState().interventions, 0);
  assert.strictEqual(c.getState().transitionLog.length, 0);
});

// setTechniques
test('setTechniques overrides default mappings', () => {
  const c = new CalmSwitch();
  c.setTechniques({ angry: ['scream-into-pillow'], default: ['box-breathing'] });
  c.setRng(() => 0);
  assert.strictEqual(c.selectTechnique('angry'), 'scream-into-pillow');
});

// getTechniquesForState
test('getTechniquesForState returns techniques for a state', () => {
  const c = new CalmSwitch();
  const t = c.getTechniquesForState('angry');
  assert.deepStrictEqual(t, ['box-breathing', 'cold-water-face', 'progressive-relaxation']);
});

// getTechniquesForState default
test('getTechniquesForState returns default for unknown state', () => {
  const c = new CalmSwitch();
  const t = c.getTechniquesForState('confused');
  assert.deepStrictEqual(t, ['box-breathing', 'soft-anchor', 'quiet-moment']);
});

// RNG determinism
test('RNG determinism via setRng', () => {
  const c = new CalmSwitch();
  c.setRng(() => 0.5);
  const t1 = c.selectTechnique('angry');
  const t2 = c.selectTechnique('angry');
  assert.strictEqual(t1, t2);
});

// all states have techniques
test('all default emotion states have techniques', () => {
  const c = new CalmSwitch();
  for (const s of ['angry', 'anxious', 'sad', 'overwhelmed']) {
    assert.ok(c.getTechniquesForState(s).length > 0);
  }
});

// deactivate idempotent
test('deactivate is idempotent', () => {
  const c = new CalmSwitch();
  c.deactivate();
  assert.strictEqual(c.isActive(), false);
  c.deactivate();
  assert.strictEqual(c.isActive(), false);
});

// factory
test('factory creates working instance', () => {
  const c = createCalmSwitchModule();
  c.setRng(() => 0);
  c.activate('angry');
  assert.strictEqual(c.isActive(), true);
});

// metadata
test('module metadata is correct', () => {
  assert.strictEqual(calm_switch_module.id, 'calm-switch');
  assert.strictEqual(calm_switch_module.category, 'emotional');
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
