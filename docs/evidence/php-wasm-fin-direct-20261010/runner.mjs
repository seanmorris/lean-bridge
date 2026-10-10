import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync, spawn } from 'node:child_process';
import { closeSync, mkdirSync, openSync, readFileSync, statfsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [revision] = process.argv.slice(2), cwd = '/app';
assert.match(revision ?? '', /^[a-f0-9]{40}$/);
const git = args => execFileSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 32000000 });
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const freeMiB = () => { const disk = statfsSync(cwd); return Math.floor(disk.bavail * disk.bsize / 1024 ** 2); };
const clean = () => {
  assert.equal(git(['rev-parse', 'HEAD']).trim(), revision);
  assert.equal(git(['status', '--porcelain', '--untracked-files=no']), '');
};
clean(); assert.ok(freeMiB() >= 2048, 'Need at least 2 GiB before starting');
const output = join(cwd, 'build', 'vo1443-direct-fin-' + revision.slice(0, 7));
mkdirSync(output);
const environment = {
  NO_COLOR: '1', LEAN_NUM_THREADS: '1', OMP_NUM_THREADS: '1', MAKEFLAGS: '-j1',
  LEAN_BRIDGE_LEAN_PREFIX: '/app/.toolchains/elan/toolchains/leanprover--lean4---v4.32.2',
  LEAN_BRIDGE_PHP_SOURCE: '/app/build/php-wasm-sdk/php8.4-src',
  LEAN_BRIDGE_PHP_EMSDK: '/app/.toolchains/emsdk-php-wasm',
  LEAN_BRIDGE_PHP_COPIED_RUNTIME: '/app/build/type-corpus/php-wasm-current-runtime',
  LEAN_BRIDGE_TEST_PHP_COPIED_RUNTIME: '/app/build/type-corpus/php-wasm-current-runtime',
  LEAN_BRIDGE_PHP_WASM_DIRECT_FIN_TEST: '1',
  LEAN_BRIDGE_PHP_WASM_DIRECT_FIN_LEAN_TEST: '1',
  LEAN_BRIDGE_PHP_WASM_DIRECT_FIN_REPORT: join(output, 'ordinary.json'),
  LEAN_BRIDGE_PHP_WASM_DIRECT_FIN_REVIEWED_REPORT: join(output, 'reviewed.json')
};
const base = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('LEAN_BRIDGE_') && key !== 'FORCE_COLOR'));
const paths = git(['ls-files', 'src', 'tests/helpers', 'tests/php-fin.test.mjs', 'tests/fixtures/php-wasm-fin-scalar.php',
  'tests/fixtures/onboarding/native-fin', 'tests/fixtures/onboarding/native-fin-containers',
  'tests/fixtures/fin-container-edges.lean', 'tests/fixtures/fin-container-consumers/php-native.php',
  'tests/fixtures/fin-container-edge-consumers/php-native.php', 'package.json', 'package-lock.json']).trim().split('\n');
const sources = Object.fromEntries(paths.map(path => [path, hash(readFileSync(join(cwd, path)))]));
const runtime = readFileSync(join(environment.LEAN_BRIDGE_PHP_COPIED_RUNTIME, 'runtime.json'));
writeFileSync(join(output, 'runtime.json'), runtime, { flag: 'wx' });
const save = (name, value) => writeFileSync(join(output, name), JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
const args = ['-c', '3', process.execPath, '--test', '--test-concurrency=1', '--test-reporter=tap',
  '--test-name-pattern=^(ordinary installed PHP-Wasm direct Fin|reviewed installed PHP-Wasm direct Fin|fresh PHP-Wasm direct Fin reviews)',
  'tests/helpers/php-wasm-fin-direct-tests.mjs'];
const log = openSync(join(output, 'run.tap'), 'wx'), startedAt = new Date().toISOString();
const child = spawn('/usr/bin/taskset', args, { cwd, env: { ...base, ...environment }, detached: true, stdio: ['ignore', log, log] });
save('start.json', { revision, tree: git(['rev-parse', 'HEAD^{tree}']).trim(), sources, environment,
  command: ['/usr/bin/taskset', ...args], node: process.version, runtimeSha256: hash(runtime),
  runnerSha256: hash(readFileSync(import.meta.filename)), startedAt, pid: child.pid, pgid: child.pid,
  freeMiB: freeMiB(), stopFloorMiB: 768,
  scope: 'Local direct scalar/container PHP-Wasm, ordinary/reviewed installed Node/Chromium modes, plus fresh Lean review refusals. No Subtype, dispatch, hosted CI or whole #1443 closure claim.' });
console.log(JSON.stringify({ output, pid: child.pid, startedAt }));
let minimumFreeMiB = freeMiB(), stoppedForDisk = false, escalation;
const signal = name => { try { process.kill(-child.pid, name); } catch(error) { if(error.code !== 'ESRCH') throw error; } };
const monitor = setInterval(() => {
  minimumFreeMiB = Math.min(minimumFreeMiB, freeMiB());
  if(minimumFreeMiB < 768 && !stoppedForDisk) {
    stoppedForDisk = true; signal('SIGTERM'); escalation = setTimeout(() => signal('SIGKILL'), 10000);
  }
}, 5000);
const result = await new Promise(resolve => {
  child.once('error', error => resolve({ code: null, signal: null, error: error.message }));
  child.once('close', (code, signal) => resolve({ code, signal }));
});
clearInterval(monitor); clearTimeout(escalation); closeSync(log);
save('end.json', { ...result, stoppedForDisk, minimumFreeMiB, endedAt: new Date().toISOString(),
  tapSha256: hash(readFileSync(join(output, 'run.tap'))),
  runtimeSha256: hash(readFileSync(join(environment.LEAN_BRIDGE_PHP_COPIED_RUNTIME, 'runtime.json'))) });
console.log(JSON.stringify({ ...result, stoppedForDisk, minimumFreeMiB }));
clean(); assert.equal(stoppedForDisk, false); assert.equal(result.code, 0);
assert.equal(hash(runtime), hash(readFileSync(join(environment.LEAN_BRIDGE_PHP_COPIED_RUNTIME, 'runtime.json'))));
const { phpWasmScalarFinRefinements } = await import('../tests/helpers/php-wasm-fin-direct-fixtures.mjs');
const { finContainerEdgeRefinements } = await import('../tests/helpers/fin-container-edges.mjs');
const { phpWasmExecutionTuples } = await import('../tests/helpers/php-wasm-fin-fixtures.mjs');
const receipts = {};
for(const [name, route] of [['ordinary.json', 'ordinary-source'], ['reviewed.json', 'reviewed-source']]) {
  const bytes = readFileSync(join(output, name)), report = JSON.parse(bytes);
  assert.equal(report.schemaVersion, 1);
  assert.deepEqual(report.reports.map(row => row.fixture), ['scalar', 'containers']);
  for(const row of report.reports) {
    assert.equal(row.path, route); assert.equal(row.dispatch, 'not measured');
    assert.equal(row.profile, 'php-wasm');
    assert.equal(row.reproducible, true); assert.equal(row.sourceRemovedBeforeInstallation, true);
    assert.deepEqual(row.refinements, row.fixture === 'scalar' ? phpWasmScalarFinRefinements : finContainerEdgeRefinements);
    for(const flag of ['compilerFreeExecution', 'emptyCaches', 'lockedInstall', 'offlineInstall', 'publicApiOnly', 'relocated', 'repeatExecution', 'unchangedDeployment'])
      assert.equal(row.phpWasm[flag], true, flag);
    assert.deepEqual(row.phpWasm.executions.map(e => `${e.realm}/${e.arrangement}/${e.loading}/${e.mode}`).sort(), phpWasmExecutionTuples);
    for(const e of row.phpWasm.executions) {
      assert.equal(e.observation.word_bits, 32); assert.equal(e.observation.checks, row.fixture === 'scalar' ? 2028 : 14089);
    }
    for(const key of ['bindingIrSha256', 'modelSha256', 'receiptSha256']) assert.match(row[key], /^[a-f0-9]{64}$/);
  }
  receipts[name] = hash(bytes);
}
save('verified.json', { revision, receipts, executionTuples: 48,
  checksPerExecution: { scalar: 2028, containers: 14089 }, verifiedAt: new Date().toISOString() });
console.log(JSON.stringify({ verified: true, receipts }));
