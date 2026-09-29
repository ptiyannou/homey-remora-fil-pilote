'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { RemoraClient, normalizeHost, parseState } = require('../lib/remora-client');
const Board = require('../lib/board');
const Module = require('node:module');
const originalLoad = Module._load;
Module._load = function (name, ...args) {
  if (name === 'homey') return { Driver: class {}, Device: class {}, App: class {} };
  return originalLoad.call(this, name, ...args);
};
const Driver = require('../drivers/radiator/driver');
const Device = require('../drivers/radiator/device');
const App = require('../app');
Module._load = originalLoad;
const state = () => Object.fromEntries(Array.from({ length: 7 }, (_, i) => [`fp${i + 1}`, 'H']));
async function fixture(t) {
  const f = { state: state(), requests: [], chip: '0xABCDEF', response: 0, behavior: 'normal' };
  const server = http.createServer((req, res) => {
    f.requests.push(req.url);
    if (f.behavior === 'timeout') return;
    if (f.behavior === 'html') return res.end('<html>Not Remora</html>');
    if (f.behavior === 'http') { res.statusCode = 503; return res.end('{}'); }
    if (f.behavior === 'redirect') { res.statusCode = 302; res.setHeader('Location', '/reset'); return res.end(); }
    if (f.behavior === 'large') return res.end('x'.repeat(70000));
    const url = new URL(req.url, 'http://localhost');
    let result;
    if (url.pathname === '/system.json') result = [
      { na: 'Chip ID', va: f.chip }, { na: 'Version Logiciel', va: '1.4.0' }, { na: 'Version Matériel', va: 'V1.2 avec MCP23017' },
    ];
    else if (url.pathname === '/fp') result = f.state;
    else {
      const cmd = url.searchParams.get('setfp');
      const all = url.searchParams.get('fp');
      if (f.behavior !== 'ignore-write') {
        if (cmd && f.state[`fp${cmd[0]}`] !== 'D') f.state[`fp${cmd[0]}`] = cmd[1];
        if (all) for (let i = 1; i <= 7; i++) if (f.state[`fp${i}`] !== 'D') f.state[`fp${i}`] = all[i - 1];
      }
      result = { response: f.response };
    }
    res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(result));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => { server.closeAllConnections(); return new Promise(resolve => server.close(resolve)); });
  f.host = `127.0.0.1:${server.address().port}`; f.client = new RemoraClient(f.host, { timeout: 100 });
  return f;
}
function homey() {
  const settings = new Map();
  return { app: { error() {} }, settings: { get: k => settings.get(k), set: (k, v) => settings.set(k, v) }, setTimeout, clearTimeout };
}
function device(board, zone = 1) {
  const d = { getData: () => ({ zone }), async applyState(s) { this.state = s; this.available = true; }, async setUnavailable(message) { this.available = false; this.message = message; } };
  board.devices.add(d); return d;
}
test('host parsing rejects paths, query commands, credentials and HTTPS', () => {
  assert.equal(normalizeHost(' http://Remora.local:8080/ '), 'remora.local:8080');
  for (const input of ['', 'remora/fp', 'remora?setfp=1C', 'https://remora', 'http://user:pass@remora', 'remora/#hash']) assert.throws(() => normalizeHost(input));
});
test('live-shaped JSON identifies seven zones; D is a status, not a command', async t => {
  const f = await fixture(t); const info = await f.client.probe();
  assert.equal(info.chip, '0xabcdef'); assert.equal(info.hardware, 'V1.2 avec MCP23017'); assert.equal(Object.keys(info.state).length, 7);
  assert.deepEqual(parseState({ ...state(), fp3: 'D' })[3], { mode: 'frost', shedding: true, code: 'D' });
  assert.throws(() => parseState({ fp1: 'H' })); assert.throws(() => parseState({ ...state(), fp1: '1' }));
});
test('all four commands use exact firmware query strings; bulk affects seven outputs', async t => {
  const f = await fixture(t);
  for (const [mode, code] of [['off', 'A'], ['eco', 'E'], ['comfort', 'C'], ['frost', 'H']]) {
    assert.equal(await f.client.write(2, mode), 0); assert.equal(f.requests.at(-1), `/?setfp=2${code}`);
  }
  await f.client.write(0, 'eco'); assert.equal(f.requests.at(-1), '/?fp=EEEEEEE');
  assert.equal((await f.client.getState())[7].mode, 'eco');
  const before = f.requests.length;
  await assert.rejects(f.client.write(1, 'D')); await assert.rejects(f.client.write(8, 'eco'));
  assert.equal(f.requests.length, before);
});
test('HTTP errors, redirects, invalid JSON, excessive responses and hangs fail explicitly', async t => {
  const f = await fixture(t);
  for (const behavior of ['http', 'redirect', 'html', 'large', 'timeout']) {
    f.behavior = behavior; await assert.rejects(f.client.getState());
  }
  assert.ok(!f.requests.includes('/reset'));
});
test('board serializes concurrent commands and publishes confirmed state to all devices', async t => {
  const f = await fixture(t), b = new Board(homey(), '0xabcdef', f.host, f.client);
  const d1 = device(b), d2 = device(b, 2);
  await Promise.all([b.command(1, 'comfort'), b.command(2, 'eco'), b.command(1, 'off')]);
  assert.equal(d1.state.mode, 'off'); assert.equal(d2.state.mode, 'eco');
  assert.deepEqual(f.requests, ['/system.json', '/?setfp=1C', '/fp', '/system.json', '/?setfp=2E', '/fp', '/system.json', '/?setfp=1A', '/fp']);
});
test('accepted but unapplied command is not reported as success', async t => {
  const f = await fixture(t), b = new Board(homey(), '0xabcdef', f.host, f.client), d = device(b);
  f.behavior = 'ignore-write'; await assert.rejects(b.command(1, 'comfort'), /non confirmée/);
  assert.equal(d.state.mode, 'frost'); assert.equal(d.available, true);
});
test('load shedding and partial bulk writes are surfaced without false success', async t => {
  const f = await fixture(t), b = new Board(homey(), '0xabcdef', f.host, f.client);
  f.state.fp2 = 'D'; f.response = -1;
  const d = device(b, 2);
  await assert.rejects(b.command(0, 'eco'), /Délestage/);
  assert.equal(d.state.shedding, true); assert.equal(f.state.fp1, 'E'); assert.equal(f.state.fp2, 'D');
});
test('offline board recovers; identity mismatch blocks writes even after a successful read', async t => {
  const f = await fixture(t), b = new Board(homey(), '0xabcdef', f.host, f.client), d = device(b);
  await b.refresh(); f.behavior = 'http'; await assert.rejects(b.refresh()); assert.equal(d.available, false);
  f.behavior = 'normal'; await b.refresh(); assert.equal(d.available, true);
  f.chip = '0x123456'; const before = f.requests.length;
  await assert.rejects(b.command(1, 'comfort'), /autre Remora/);
  assert.deepEqual(f.requests.slice(before), ['/system.json']);
});
test('pairing validates board, exposes seven stable IDs and filters already paired zones', async t => {
  const f = await fixture(t), d = new Driver(); d.homey = homey(); d.getDevices = () => [];
  await d.onInit(); const handlers = {}; await d.onPair({ setHandler: (name, cb) => { handlers[name] = cb; } });
  await assert.rejects(handlers.list_devices()); await handlers.connect({ host: f.host });
  const listed = await handlers.list_devices(); assert.equal(listed.length, 7);
  assert.equal(listed[0].data.id, '0xabcdef:fp1'); assert.equal(listed[6].data.zone, 7);
  d.getDevices = () => [{ getData: () => listed[0].data }]; assert.equal((await handlers.list_devices()).length, 6);
  f.behavior = 'html'; await assert.rejects(handlers.connect({ host: f.host })); await assert.rejects(handlers.list_devices());
});
test('repair updates shared board address, persists it and rejects another physical board', async t => {
  const f = await fixture(t), f2 = await fixture(t), dr = new Driver(); dr.homey = homey(); await dr.onInit();
  const d = { getData: () => ({ chip: '0xabcdef', zone: 1 }), getStoreValue: () => f.host, async applyState() {} };
  d.board = dr.attach(d); const handlers = {}; await dr.onRepair({ setHandler: (name, cb) => { handlers[name] = cb; } }, d);
  await handlers.connect({ host: f2.host }); assert.equal(d.board.client.host, f2.host);
  assert.equal(dr.homey.settings.get('remora_hosts')['0xabcdef'], f2.host);
  f.chip = '0x123456'; await assert.rejects(handlers.connect({ host: f.host }), /autre Remora/);
  assert.equal(d.board.client.host, f2.host);
  dr.detach(d); dr.detach(d); assert.equal(dr.boards.size, 0);
});
test('one polling loop per board and cleanup stops scheduling', async () => {
  let scheduled = 0, cleared = 0, reads = 0;
  const h = homey(); h.setTimeout = () => { scheduled++; return 1; }; h.clearTimeout = () => { cleared++; };
  const b = new Board(h, '0xabcdef', 'localhost', { identify: async () => ({ chip: '0xabcdef' }), getState: async () => { reads++; return parseState(state()); } });
  b.start(); b.start(); await b.tail; await new Promise(resolve => setImmediate(resolve));
  assert.equal(reads, 1); assert.equal(scheduled, 1); b.close(); assert.equal(cleared, 1);
  await assert.rejects(b.refresh(), /fermée/);
});
test('device reports confirmed modes and shedding; trigger excludes initial sync', async () => {
  const d = new Device(), values = {}, triggers = [];
  d.homey = { flow: { getDeviceTriggerCard: () => ({ trigger: async (_, tokens) => { triggers.push(tokens); } }) } };
  d.getCapabilityValue = k => values[k]; d.setCapabilityValue = async (k, v) => { values[k] = v; };
  d.setWarning = async () => { d.warning = true; }; d.unsetWarning = async () => { d.warning = false; }; d.setAvailable = async () => {};
  await d.applyState({ mode: 'frost', shedding: false }); assert.equal(triggers.length, 0);
  await d.applyState({ mode: 'eco', shedding: false }); assert.equal(triggers[0].mode, 'Eco');
  await d.applyState({ mode: 'frost', shedding: true }); assert.equal(values.alarm_load_shedding, true); assert.equal(d.warning, true);
});
test('Flow actions dispatch single/bulk commands and conditions reject unavailable data', async () => {
  const app = new App(), actions = {}, conditions = {}, calls = [];
  app.log = () => {}; app.homey = { flow: { getActionCard: id => ({ registerRunListener: cb => { actions[id] = cb; } }), getConditionCard: id => ({ registerRunListener: cb => { conditions[id] = cb; } }) } };
  await app.onInit(); const d = { setMode: async m => calls.push(['one', m]), setAllModes: async m => calls.push(['all', m]), getAvailable: () => true, getCapabilityValue: () => 'eco' };
  await actions.set_mode({ device: d, mode: 'eco' }); await actions.set_board_mode({ device: d, mode: 'frost' });
  assert.deepEqual(calls, [['one', 'eco'], ['all', 'frost']]); assert.equal(conditions.is_mode({ device: d, mode: 'eco' }), true);
  d.getAvailable = () => false; assert.throws(() => conditions.is_mode({ device: d, mode: 'eco' }));
});
test('custom pairing and repair views navigate only after backend validation', async () => {
  const fs = require('node:fs'), vm = require('node:vm');
  const html = fs.readFileSync(require.resolve('../drivers/radiator/pair/connect.html'), 'utf8');
  for (const repair of [false, true]) {
    const elements = Object.fromEntries(['host', 'submit', 'status', 'connect-form'].map(id => [id, { value: '', addEventListener(_, cb) { this.submit = cb; } }]));
    const navigation = [];
    const Homey = { setTitle() {}, emit: async event => event === 'get_context' ? { repair, host: 'remora.local' } : { chip: '0xabcdef' }, showView: async id => navigation.push(id), done: async () => navigation.push('done') };
    vm.runInNewContext(html.match(/<script>([\s\S]*?)<\/script>/)[1], { Homey, document: { getElementById: id => elements[id] } });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(elements.host.value, 'remora.local');
    await elements['connect-form'].submit({ preventDefault() {} });
    assert.deepEqual(navigation, [repair ? 'done' : 'list_devices']);
    navigation.length = 0;
    Homey.emit = async () => { throw new Error('Injoignable'); };
    await elements['connect-form'].submit({ preventDefault() {} });
    assert.equal(navigation.length, 0); assert.equal(elements.status.textContent, 'Injoignable'); assert.equal(elements.submit.disabled, false);
  }
});
