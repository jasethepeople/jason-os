// Simple test runner for ghost-span
import { GhostSpan, createGhostSpanModule, ghost_span_module } from './dist/index.js';
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

console.log('\nGhostSpan Tests');
console.log('===============\n');

// Constructor
test('constructor creates instance with initial state', () => {
  const g = new GhostSpan();
  const s = g.getState();
  assert.strictEqual(s.active, false);
  assert.deepStrictEqual(s.schedule, []);
  assert.strictEqual(s.currentSlot, null);
  assert.strictEqual(s.adjustmentsMade, 0);
});

// init
test('init resolves without error', async () => {
  const g = new GhostSpan();
  await g.init();
});

// generateSchedule
test('generateSchedule creates schedule from emotion history', () => {
  const g = new GhostSpan();
  g.generateSchedule([
    { hour: 9, valence: 0.5, arousal: 0.6 },
    { hour: 14, valence: 0.3, arousal: 0.4 },
  ]);
  const s = g.getState();
  assert.strictEqual(s.active, true);
  assert.strictEqual(s.schedule.length, 2);
});

// computeFocusScore peaks at moderate
test('computeFocusScore peaks at moderate valence and arousal', () => {
  const g = new GhostSpan();
  const score = g.computeFocusScore(0.3, 0.5);
  assert.ok(score > 0.8);
});

// computeFocusScore low at extreme valence
test('computeFocusScore is low at extreme valence', () => {
  const g = new GhostSpan();
  assert.ok(g.computeFocusScore(-1.0, 0.5) < 0.3);
});

// computeFocusScore clamped
test('computeFocusScore is clamped to [0, 1]', () => {
  const g = new GhostSpan();
  assert.strictEqual(g.computeFocusScore(-1, 0), 0);
  assert.ok(g.computeFocusScore(0.3, 0.5) <= 1);
});

// suggestTaskType creative
test('suggestTaskType returns creative for high valence + high arousal', () => {
  const g = new GhostSpan();
  assert.strictEqual(g.suggestTaskType(0.5, 0.7), 'creative');
});

// suggestTaskType deep-work
test('suggestTaskType returns deep-work for moderate valence + low arousal', () => {
  const g = new GhostSpan();
  assert.strictEqual(g.suggestTaskType(0.3, 0.3), 'deep-work');
});

// suggestTaskType admin
test('suggestTaskType returns admin for negative valence', () => {
  const g = new GhostSpan();
  assert.strictEqual(g.suggestTaskType(-0.1, 0.5), 'admin');
});

// suggestTaskType routine
test('suggestTaskType returns routine as default', () => {
  const g = new GhostSpan();
  assert.strictEqual(g.suggestTaskType(0.1, 0.5), 'routine');
});

// getCurrentSlot
test('getCurrentSlot returns matching slot', () => {
  const g = new GhostSpan();
  g.generateSchedule([{ hour: 9, valence: 0.5, arousal: 0.6 }]);
  const slot = g.getCurrentSlot(9);
  assert.notStrictEqual(slot, null);
  assert.strictEqual(slot.hour, 9);
});

// getCurrentSlot null
test('getCurrentSlot returns null for unknown hour', () => {
  const g = new GhostSpan();
  g.generateSchedule([{ hour: 9, valence: 0.5, arousal: 0.6 }]);
  assert.strictEqual(g.getCurrentSlot(99), null);
});

// getBestSlot
test('getBestSlot returns highest focus slot', () => {
  const g = new GhostSpan();
  g.generateSchedule([
    { hour: 9, valence: -0.9, arousal: 0.1 },
    { hour: 10, valence: 0.3, arousal: 0.5 },
  ]);
  const best = g.getBestSlot();
  assert.strictEqual(best.hour, 10);
});

// getBestSlot null
test('getBestSlot returns null with no schedule', () => {
  const g = new GhostSpan();
  assert.strictEqual(g.getBestSlot(), null);
});

// getSlotsByTaskType
test('getSlotsByTaskType filters correctly', () => {
  const g = new GhostSpan();
  g.generateSchedule([
    { hour: 9, valence: 0.5, arousal: 0.7 },
    { hour: 10, valence: 0.3, arousal: 0.3 },
    { hour: 11, valence: 0.5, arousal: 0.7 },
  ]);
  const creative = g.getSlotsByTaskType('creative');
  assert.strictEqual(creative.length, 2);
});

// getAverageFocusScore
test('getAverageFocusScore computes average', () => {
  const g = new GhostSpan();
  g.generateSchedule([
    { hour: 9, valence: 0.3, arousal: 0.5 },
    { hour: 10, valence: -0.9, arousal: 0.1 },
  ]);
  const avg = g.getAverageFocusScore();
  assert.ok(avg > 0 && avg < 1);
});

// getAverageFocusScore 0
test('getAverageFocusScore returns 0 with no schedule', () => {
  const g = new GhostSpan();
  assert.strictEqual(g.getAverageFocusScore(), 0);
});

// adjustSlot
test('adjustSlot modifies existing slot', () => {
  const g = new GhostSpan();
  g.generateSchedule([{ hour: 9, valence: 0.5, arousal: 0.6 }]);
  g.adjustSlot(9, { optimalFocus: 0.99, taskType: 'deep-work' });
  assert.strictEqual(g.getState().adjustmentsMade, 1);
  const slot = g.getState().schedule.find(s => s.hour === 9);
  assert.strictEqual(slot.optimalFocus, 0.99);
  assert.strictEqual(slot.taskType, 'deep-work');
});

// isActive
test('isActive returns false before generateSchedule', () => {
  assert.strictEqual(new GhostSpan().isActive(), false);
});
test('isActive returns true after generateSchedule', () => {
  const g = new GhostSpan();
  g.generateSchedule([{ hour: 9, valence: 0.5, arousal: 0.6 }]);
  assert.strictEqual(g.isActive(), true);
});

// clearSchedule
test('clearSchedule resets schedule', () => {
  const g = new GhostSpan();
  g.generateSchedule([{ hour: 9, valence: 0.5, arousal: 0.6 }]);
  g.clearSchedule();
  assert.strictEqual(g.getState().active, false);
  assert.strictEqual(g.getState().schedule.length, 0);
});

// destroy
test('destroy resets all state', async () => {
  const g = new GhostSpan();
  g.generateSchedule([{ hour: 9, valence: 0.5, arousal: 0.6 }]);
  await g.destroy();
  assert.strictEqual(g.getState().active, false);
  assert.strictEqual(g.getState().schedule.length, 0);
});

// factory
test('factory creates working instance', () => {
  const g = createGhostSpanModule();
  g.generateSchedule([{ hour: 9, valence: 0.5, arousal: 0.6 }]);
  assert.strictEqual(g.isActive(), true);
});

// metadata
test('module metadata is correct', () => {
  assert.strictEqual(ghost_span_module.id, 'ghost-span');
  assert.strictEqual(ghost_span_module.category, 'productivity');
});

// 24h schedule
test('generateSchedule with 24-hour data', () => {
  const g = new GhostSpan();
  const history = Array.from({ length: 24 }, (_, i) => ({
    hour: i, valence: Math.sin(i / 24 * Math.PI * 2) * 0.5,
    arousal: 0.3 + Math.cos(i / 24 * Math.PI * 2) * 0.2,
  }));
  g.generateSchedule(history);
  assert.strictEqual(g.getState().schedule.length, 24);
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
