const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

// Exercise the actual TypeScript modules without a browser or new test dependencies.
function loadModule(file, globals = {}, mocks = {}, useMocks = false) {
  const source = fs.readFileSync(path.join(__dirname, '../src', file), 'utf8')
    .replaceAll("import.meta.env.VITE_USE_MOCKS", JSON.stringify(String(useMocks)));
  const js = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const exports = {};
  vm.runInNewContext(js, {
    exports,
    require: (name) => {
      assert.ok(name in mocks, `Unexpected dependency ${name}`);
      return mocks[name];
    },
    console,
    ...globals,
  });
  return exports;
}

test('certificate urgency boundaries and pending status remain distinct', () => {
  const { expiryTone, toneForStatus } = loadModule('lib/status.ts');
  for (const days of [-2, 0, 7]) assert.equal(expiryTone(days), 'danger');
  for (const days of [8, 30]) assert.equal(expiryTone(days), 'warning');
  assert.equal(expiryTone(31), 'success');
  assert.equal(expiryTone(null), 'neutral');
  assert.equal(toneForStatus('pending'), 'neutral');
  assert.equal(toneForStatus('failed'), 'danger');
  assert.equal(toneForStatus('unknown'), 'neutral');
});

test('HTTP clipboard fallback removes temporary node and restores focus even on failure', async () => {
  let removed = 0;
  let restored = 0;
  class Element { focus() { restored++; } }
  const document = {
    activeElement: new Element(),
    createElement: () => ({ style: {}, setAttribute() {}, focus() {}, select() {}, setSelectionRange() {} }),
    body: { appendChild() {}, removeChild() { removed++; } },
    execCommand: () => { throw new Error('copy denied'); },
  };
  const { copyText } = loadModule('lib/clipboard.ts', {
    document, navigator: {}, window: { isSecureContext: false }, HTMLElement: Element,
  });
  await assert.rejects(copyText('fingerprint'), /copy denied/);
  assert.equal(removed, 1);
  assert.equal(restored, 1);
});

test('secure clipboard uses async API instead of DOM fallback', async () => {
  let copied;
  const { copyText } = loadModule('lib/clipboard.ts', {
    navigator: { clipboard: { writeText: async (text) => { copied = text; } } },
    window: { isSecureContext: true },
  });
  await copyText('certificate fingerprint');
  assert.equal(copied, 'certificate fingerprint');
});

test('event stream cannot reconnect after close, including queued retry callbacks', () => {
  const instances = [];
  const retries = [];
  class EventSource {
    constructor(url) { this.url = url; instances.push(this); }
    close() { this.closed = true; }
  }
  const { createEventStream } = loadModule('lib/sse.ts', {
    EventSource,
    localStorage: { getItem: () => 'token+with/special=' },
    setTimeout: (fn) => { retries.push(fn); return retries.length; },
    clearTimeout() {},
  }, { './api': { API_BASE_URL: '/api' } });
  const stream = createEventStream();
  assert.ok(instances[0].url.endsWith('token=token%2Bwith%2Fspecial%3D'));
  const lateError = instances[0].onerror;
  instances[0].onerror();
  assert.equal(retries.length, 1);
  stream.close();
  retries[0]();
  lateError();
  assert.equal(instances.length, 1);
  assert.equal(retries.length, 1);
});

test('mock event subscriptions are removed and cannot attach after unmount', async () => {
  const subscribers = [];
  const { createEventStream } = loadModule('lib/sse.ts', {}, {
    './api': { API_BASE_URL: '/api' },
    './mock': { eventStreamSubscribers: subscribers },
  }, true);
  const earlyClosed = createEventStream();
  earlyClosed.close();
  await new Promise(setImmediate);
  assert.equal(subscribers.length, 0);
  const stream = createEventStream();
  await new Promise(setImmediate);
  assert.equal(subscribers.length, 1);
  stream.close();
  assert.equal(subscribers.length, 0);
});
