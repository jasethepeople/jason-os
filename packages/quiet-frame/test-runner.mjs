// Simple test runner for quiet-frame
import { QuietFrame, createQuietFrameModule, quiet_frame_module } from './dist/index.js';
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

console.log('\nQuietFrame Tests');
console.log('================\n');

// Constructor
test('constructor creates instance with initial state', () => {
  const f = new QuietFrame();
  const s = f.getState();
  assert.strictEqual(s.softened, false);
  assert.strictEqual(s.originalText, null);
  assert.strictEqual(s.softenedText, null);
  assert.strictEqual(s.softensApplied, 0);
});

// init
test('init resolves without error', async () => {
  const f = new QuietFrame();
  await f.init();
});

// soften basic
test('soften replaces "you must"', () => {
  const f = new QuietFrame();
  const r = f.soften('you must complete this task');
  assert.strictEqual(r, 'you might consider complete this task');
  assert.strictEqual(f.wasSoftened(), true);
});

// soften multiple
test('soften handles multiple replacements', () => {
  const f = new QuietFrame();
  const r = f.soften('you must always fail because you are stupid');
  assert.strictEqual(r, 'you might consider often did not succeed yet because you are challenging');
  assert.strictEqual(f.getSoftensApplied(), 4);
});

// case insensitive
test('soften is case-insensitive', () => {
  const f = new QuietFrame();
  const r = f.soften('YOU MUST ALWAYS FAIL');
  assert.strictEqual(r, 'you might consider often did not succeed yet');
});

// tracks original
test('soften tracks original text', () => {
  const f = new QuietFrame();
  f.soften('you must do this');
  assert.strictEqual(f.restore(), 'you must do this');
});

// no match
test('soften handles text with no matches', () => {
  const f = new QuietFrame();
  const text = 'The quick brown fox jumps over the lazy dog';
  const r = f.soften(text);
  assert.strictEqual(r, text);
  assert.strictEqual(f.wasSoftened(), false);
  assert.strictEqual(f.getSoftensApplied(), 0);
});

// all patterns
test('soften handles all default patterns', () => {
  const f = new QuietFrame();
  const harsh = 'you must, you have to, always, never, should, need to, fail, stupid, hate, disaster';
  f.soften(harsh);
  assert.strictEqual(f.getSoftensApplied(), 10);
});

// getState returns copy
test('getState returns independent copy', () => {
  const f = new QuietFrame();
  f.soften('you must run');
  const s1 = f.getState();
  f.soften('you should try');
  const s2 = f.getState();
  assert.strictEqual(s1.softensApplied, 1);
  assert.strictEqual(s2.softensApplied, 2);
});

// softenWithPatterns
test('softenWithPatterns uses custom replacements', () => {
  const f = new QuietFrame();
  const r = f.softenWithPatterns('this is a bad problem', [[/\bbad\b/gi, 'learning moment'], [/\bproblem\b/gi, 'opportunity']]);
  assert.strictEqual(r, 'this is a learning moment opportunity');
});

// reset
test('reset clears all state', () => {
  const f = new QuietFrame();
  f.soften('you must always fail');
  f.reset();
  const s = f.getState();
  assert.strictEqual(s.softened, false);
  assert.strictEqual(s.originalText, null);
  assert.strictEqual(s.softensApplied, 0);
});

// destroy
test('destroy resets state', async () => {
  const f = new QuietFrame();
  f.soften('you must go');
  await f.destroy();
  assert.strictEqual(f.getState().softensApplied, 0);
});

// factory
test('factory creates working instance', () => {
  const f = createQuietFrameModule();
  const r = f.soften('you must try');
  assert.strictEqual(r, 'you might consider try');
});

// metadata
test('module metadata is correct', () => {
  assert.strictEqual(quiet_frame_module.id, 'quiet-frame');
  assert.strictEqual(quiet_frame_module.name, 'QuietFrame');
  assert.strictEqual(quiet_frame_module.category, 'emotional');
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
