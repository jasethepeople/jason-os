// Simple test runner for soft-phase
import { SoftPhase, createSoftPhaseModule, soft_phase_module } from './dist/index.js';
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

console.log('\nSoftPhase Tests');
console.log('===============\n');

// Constructor
test('constructor creates instance with initial state', () => {
  const p = new SoftPhase();
  assert.strictEqual(p.getPhase(), 'unknown');
  assert.strictEqual(p.getDay(), 0);
  assert.strictEqual(p.getState().emotionalCorrelation, null);
  assert.deepStrictEqual(p.getState().predictions, []);
});

// init
test('init resolves without error', async () => {
  await new SoftPhase().init();
});

// inferPhase menstrual
test('inferPhase returns menstrual for days 1-5', () => {
  const p = new SoftPhase();
  assert.strictEqual(p.inferPhase(1), 'menstrual');
  assert.strictEqual(p.inferPhase(5), 'menstrual');
});

// inferPhase follicular
test('inferPhase returns follicular for days 6-13', () => {
  const p = new SoftPhase();
  assert.strictEqual(p.inferPhase(6), 'follicular');
  assert.strictEqual(p.inferPhase(13), 'follicular');
});

// inferPhase ovulatory
test('inferPhase returns ovulatory for days 14-16', () => {
  const p = new SoftPhase();
  assert.strictEqual(p.inferPhase(14), 'ovulatory');
  assert.strictEqual(p.inferPhase(16), 'ovulatory');
});

// inferPhase luteal
test('inferPhase returns luteal for days 17-28', () => {
  const p = new SoftPhase();
  assert.strictEqual(p.inferPhase(17), 'luteal');
  assert.strictEqual(p.inferPhase(28), 'luteal');
});

// inferPhase unknown
test('inferPhase returns unknown for day 0', () => {
  assert.strictEqual(new SoftPhase().inferPhase(0), 'unknown');
});
test('inferPhase returns unknown for day 29+', () => {
  assert.strictEqual(new SoftPhase().inferPhase(29), 'unknown');
});

// setDay
test('setDay updates day and phase', () => {
  const p = new SoftPhase();
  p.setDay(10);
  assert.strictEqual(p.getDay(), 10);
  assert.strictEqual(p.getPhase(), 'follicular');
});

// correlateEmotion menstrual
test('correlateEmotion sets correlation for menstrual phase', () => {
  const p = new SoftPhase();
  p.setDay(3);
  p.correlateEmotion({ valence: -0.2, stress: 0.5 });
  const s = p.getState();
  assert.strictEqual(s.emotionalCorrelation.valenceDelta, -0.2);
  assert.strictEqual(s.emotionalCorrelation.stressDelta, 0.3);
});

// correlateEmotion follicular
test('correlateEmotion sets correlation for follicular phase', () => {
  const p = new SoftPhase();
  p.setDay(10);
  p.correlateEmotion({ valence: 0.5, stress: 0.1 });
  assert.strictEqual(p.getState().emotionalCorrelation.valenceDelta, 0.15);
  assert.strictEqual(p.getState().emotionalCorrelation.stressDelta, -0.1);
});

// correlateEmotion ovulatory
test('correlateEmotion sets correlation for ovulatory phase', () => {
  const p = new SoftPhase();
  p.setDay(15);
  p.correlateEmotion({ valence: 0.6, stress: 0.1 });
  assert.strictEqual(p.getState().emotionalCorrelation.valenceDelta, 0.2);
  assert.strictEqual(p.getState().emotionalCorrelation.stressDelta, -0.15);
});

// correlateEmotion luteal
test('correlateEmotion sets correlation for luteal phase', () => {
  const p = new SoftPhase();
  p.setDay(20);
  p.correlateEmotion({ valence: 0.1, stress: 0.4 });
  assert.strictEqual(p.getState().emotionalCorrelation.valenceDelta, -0.1);
  assert.strictEqual(p.getState().emotionalCorrelation.stressDelta, 0.2);
});

// correlateEmotion unknown
test('correlateEmotion with unknown phase returns zero deltas', () => {
  const p = new SoftPhase();
  p.setDay(29);
  p.correlateEmotion({ valence: 0, stress: 0 });
  assert.strictEqual(p.getState().emotionalCorrelation.valenceDelta, 0);
  assert.strictEqual(p.getState().emotionalCorrelation.stressDelta, 0);
});

// getPhaseCorrelation
test('getPhaseCorrelation returns correlation without changing state', () => {
  const p = new SoftPhase();
  const c = p.getPhaseCorrelation('menstrual');
  assert.strictEqual(c.valenceDelta, -0.2);
  assert.strictEqual(c.stressDelta, 0.3);
  assert.strictEqual(p.getState().phase, 'unknown');
});

// predict count
test('predict generates correct number of predictions', () => {
  const p = new SoftPhase();
  p.setDay(1);
  p.predict(28);
  assert.strictEqual(p.getState().predictions.length, 28);
});

// predict cycling
test('predict cycles through phases correctly', () => {
  const p = new SoftPhase();
  p.setDay(4);
  p.predict(5);
  const preds = p.getState().predictions;
  assert.strictEqual(preds[0].predictedPhase, 'menstrual');
  assert.strictEqual(preds[1].predictedPhase, 'follicular');
});

// getPhase
test('getPhase returns current phase', () => {
  const p = new SoftPhase();
  assert.strictEqual(p.getPhase(), 'unknown');
  p.setDay(10);
  assert.strictEqual(p.getPhase(), 'follicular');
});

// getDay
test('getDay returns current day', () => {
  const p = new SoftPhase();
  assert.strictEqual(p.getDay(), 0);
  p.setDay(15);
  assert.strictEqual(p.getDay(), 15);
});

// reset
test('reset clears all state', () => {
  const p = new SoftPhase();
  p.setDay(10);
  p.correlateEmotion({ valence: 0.5, stress: 0.2 });
  p.predict(7);
  p.reset();
  assert.strictEqual(p.getPhase(), 'unknown');
  assert.strictEqual(p.getDay(), 0);
  assert.strictEqual(p.getState().emotionalCorrelation, null);
  assert.strictEqual(p.getState().predictions.length, 0);
});

// destroy
test('destroy resets all state', async () => {
  const p = new SoftPhase();
  p.setDay(10);
  p.correlateEmotion({ valence: 0.5, stress: 0.2 });
  p.predict(7);
  await p.destroy();
  assert.strictEqual(p.getPhase(), 'unknown');
  assert.strictEqual(p.getDay(), 0);
});

// all phase correlations
test('all phase correlations have expected values', () => {
  const p = new SoftPhase();
  assert.deepStrictEqual(p.getPhaseCorrelation('menstrual'), { valenceDelta: -0.2, stressDelta: 0.3 });
  assert.deepStrictEqual(p.getPhaseCorrelation('follicular'), { valenceDelta: 0.15, stressDelta: -0.1 });
  assert.deepStrictEqual(p.getPhaseCorrelation('ovulatory'), { valenceDelta: 0.2, stressDelta: -0.15 });
  assert.deepStrictEqual(p.getPhaseCorrelation('luteal'), { valenceDelta: -0.1, stressDelta: 0.2 });
  assert.deepStrictEqual(p.getPhaseCorrelation('unknown'), { valenceDelta: 0, stressDelta: 0 });
});

// factory
test('factory creates working instance', () => {
  const p = createSoftPhaseModule();
  p.setDay(10);
  assert.strictEqual(p.getPhase(), 'follicular');
});

// metadata
test('module metadata is correct', () => {
  assert.strictEqual(soft_phase_module.id, 'soft-phase');
  assert.strictEqual(soft_phase_module.category, 'emotional');
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
