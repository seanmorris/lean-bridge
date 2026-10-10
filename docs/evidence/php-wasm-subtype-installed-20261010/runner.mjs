import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync, spawn } from 'node:child_process';
import { closeSync, mkdirSync, openSync, readFileSync, statfsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const [revision] = process.argv.slice(2), cwd = '/app/build/worktrees/fin-container-edge-file-closure-vo1454';
assert.match(revision ?? '', /^[a-f0-9]{40}$/);
const git = args => execFileSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 32000000 });
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const freeMiB = () => { const disk = statfsSync(cwd); return Math.floor(disk.bavail * disk.bsize / 1024 ** 2); };
const clean = () => {
  assert.equal(git(['rev-parse', 'HEAD']).trim(), revision);
  assert.equal(git(['status', '--porcelain', '--untracked-files=no']), '');
};
clean(); assert.ok(freeMiB() >= 2048, 'Need at least 2 GiB before starting');
const output = join('/app/build', 'vo1443-subtype-r2-' + revision.slice(0, 7));
mkdirSync(output);
const environment = {
  NO_COLOR: '1', LEAN_NUM_THREADS: '1', OMP_NUM_THREADS: '1', MAKEFLAGS: '-j1',
  LEAN_BRIDGE_LEAN_PREFIX: '/app/.toolchains/elan/toolchains/leanprover--lean4---v4.32.2',
  LEAN_BRIDGE_PHP_SOURCE: '/app/build/php-wasm-sdk/php8.4-src',
  LEAN_BRIDGE_PHP_EMSDK: '/app/.toolchains/emsdk-php-wasm',
  LEAN_BRIDGE_PHP_COPIED_RUNTIME: '/app/build/type-corpus/php-wasm-current-runtime',
  LEAN_BRIDGE_TEST_PHP_COPIED_RUNTIME: '/app/build/type-corpus/php-wasm-current-runtime',
  LEAN_BRIDGE_PHP_WASM_HOST: '/app/build/php-wasm-host/node_modules/php-wasm',
  LEAN_BRIDGE_PHP_WASM_SUBTYPE_TEST: '1',
  LEAN_BRIDGE_PHP_WASM_SUBTYPE_REPORT: join(output, 'ordinary.json'),
  LEAN_BRIDGE_PHP_WASM_SUBTYPE_REVIEWED_REPORT: join(output, 'reviewed.json')
};
const hostManifest = JSON.parse(readFileSync(join(environment.LEAN_BRIDGE_PHP_WASM_HOST, 'package.json')));
assert.equal(hostManifest.name, 'php-wasm'); assert.equal(hostManifest.version, '0.1.0');
assert.deepEqual(hostManifest.dependencies ?? {}, {});
const base = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('LEAN_BRIDGE_') && key !== 'FORCE_COLOR'));
const paths = git(['ls-files', 'src', 'tests/helpers',
  'tests/fixtures/onboarding/native-subtype', 'tests/fixtures/subtype-consumers/php-native.php',
  'package.json', 'package-lock.json']).trim().split('\n');
const sources = Object.fromEntries(paths.map(path => [path, hash(readFileSync(join(cwd, path)))]));
const runtime = readFileSync(join(environment.LEAN_BRIDGE_PHP_COPIED_RUNTIME, 'runtime.json'));
writeFileSync(join(output, 'runtime.json'), runtime, { flag: 'wx' });
const save = (name, value) => writeFileSync(join(output, name), JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
const args = ['-c', '3', process.execPath, '--test', '--test-concurrency=1', '--test-reporter=tap',
  '--test-name-pattern=^(ordinary|reviewed) installed PHP-Wasm Subtypes',
  'tests/helpers/php-wasm-subtype-tests.mjs'];
const log = openSync(join(output, 'run.tap'), 'wx'), startedAt = new Date().toISOString();
const child = spawn('/usr/bin/taskset', args, { cwd, env: { ...base, ...environment }, detached: true, stdio: ['ignore', log, log] });
save('start.json', { revision, tree: git(['rev-parse', 'HEAD^{tree}']).trim(), sources, environment,
  command: ['/usr/bin/taskset', ...args], node: process.version, runtimeSha256: hash(runtime),
  runnerSha256: hash(readFileSync(import.meta.filename)), startedAt, pid: child.pid, pgid: child.pid,
  freeMiB: freeMiB(), stopFloorMiB: 768,
  scope: 'Local top-level primitive Subtype PHP-Wasm, ordinary/reviewed source-free installed Node/Chromium modes. Separate source-admission checks are archived. No constructor/source/adapter dispatch, hosted CI or whole #1443 closure claim.' });
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
const { phpWasmSubtypeRefinements } = await import(pathToFileURL(join(cwd, 'tests/helpers/php-wasm-subtype-fixture.mjs')));
const { phpWasmExecutionTuples } = await import(pathToFileURL(join(cwd, 'tests/helpers/php-wasm-fin-fixtures.mjs')));
const receipts = {};
for(const [name, route] of [['ordinary.json','ordinary-source'],['reviewed.json','reviewed-source']]) {
  const bytes=readFileSync(join(output,name)), report=JSON.parse(bytes);
  assert.equal(report.schemaVersion,1); assert.equal(report.fixture,'subtypes');
  assert.equal(report.path,route); assert.equal(report.profile,'php-wasm');
  assert.equal(report.dispatch,'not measured'); assert.equal(report.constructorDispatch,'not measured');
  assert.equal(report.reproducible,true); assert.equal(report.sourceRemovedBeforeInstallation,true);
  assert.deepEqual(report.refinements,phpWasmSubtypeRefinements);
  for(const flag of ['compilerFreeExecution','emptyCaches','lockedInstall','offlineInstall','publicApiOnly','relocated','repeatExecution','unchangedDeployment'])
    assert.equal(report.phpWasm[flag],true,flag);
  assert.deepEqual(report.phpWasm.executions.map(e=>[e.realm,e.arrangement,e.loading,e.mode].join('/')).sort(),phpWasmExecutionTuples);
  for(const e of report.phpWasm.executions) {
    assert.equal(e.observation.word_bits,32); assert.equal(e.observation.checks,2024);
  }
  for(const key of ['bindingIrSha256','modelSha256','receiptSha256'])assert.match(report[key],/^[a-f0-9]{64}$/);
  receipts[name]=hash(bytes);
}
save('verified.json',{revision,receipts,executionTuples:24,checksPerExecution:2024,dispatch:'not measured',verifiedAt:new Date().toISOString()});
console.log(JSON.stringify({verified:true,receipts}));
