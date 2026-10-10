import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync, spawn } from 'node:child_process';
import { closeSync, mkdirSync, openSync, readFileSync, statfsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [revision, selection, profileText] = process.argv.slice(2);
assert.match(revision ?? '', /^[a-f0-9]{40}$/);
assert.match(selection ?? '', /^[a-z0-9-]+$/);
const profiles = profileText.split(',').sort(), cwd = '/app';
const git = args => execFileSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const freeMiB = () => { const disk = statfsSync(cwd); return Math.floor(disk.bavail * disk.bsize / 1024 ** 2); };
const clean = () => {
  assert.equal(git(['rev-parse', 'HEAD']).trim(), revision);
  assert.equal(git(['status', '--porcelain', '--untracked-files=no']), '');
};
clean(); assert.ok(freeMiB() >= 2048, 'Need 2 GiB free before starting a producer');
const { finRecordZeroChecks, finRecordZeroRefinements, finRecordZeroTargets } = await import('../tests/helpers/fin-record-zero-fixture.mjs');
assert.equal(new Set(profiles).size, profiles.length);
for (const profile of profiles) assert.ok(Object.hasOwn(finRecordZeroTargets, profile));
const output = join(cwd, 'build', `vo1442-zero-${selection}-${revision.slice(0, 7)}`);
mkdirSync(output);
const environment = {
  NO_COLOR: '1', LEAN_NUM_THREADS: '1', OMP_NUM_THREADS: '1', MAKEFLAGS: '-j1',
  LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR: '2.36',
  ...(profiles.includes('perl') ? { LEAN_BRIDGE_PERL_TEST_GLIBC_FLOOR: '2.36' } : {}),
  LEAN_BRIDGE_LEAN_PREFIX: '/app/.toolchains/elan/toolchains/leanprover--lean4---v4.32.2',
  LEAN_BRIDGE_FIN_RECORD_ZERO_PROFILES: profiles.join(','),
  LEAN_BRIDGE_REVIEWED_FIN_RECORD_ZERO_PROFILES: profiles.join(','),
  LEAN_BRIDGE_FIN_RECORD_ZERO_REPORT: join(output, 'ordinary.json'),
  LEAN_BRIDGE_REVIEWED_FIN_RECORD_ZERO_REPORT: join(output, 'reviewed.json'),
  ...Object.fromEntries(['LEAN_BRIDGE_PYTHON', 'LEAN_BRIDGE_CORPUS_PERL'].filter(key => process.env[key]).map(key => [key, process.env[key]]))
};
const base = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('LEAN_BRIDGE_') && key !== 'FORCE_COLOR'));
const paths = git(['ls-files', 'src', 'tests/helpers', 'tests/fixtures/fin-record-zero-consumers', 'tests/fixtures/onboarding/native-fin-record-zero', 'package.json', 'package-lock.json']).trim().split('\n');
const sources = Object.fromEntries(paths.map(path => [path, sha(readFileSync(join(cwd, path)))]));
const args = ['-c', '3', process.execPath, '--test', '--test-concurrency=1', '--test-reporter=tap', '--test-name-pattern=^(installed native packages check empty Fin 0|independently reviewed native packages check empty Fin 0|changed zero-bound record collections)', 'tests/helpers/fin-record-zero-tests.mjs'];
const save = (name, value) => writeFileSync(join(output, name), JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
const startedAt = new Date().toISOString(), log = openSync(join(output, 'run.tap'), 'wx');
const child = spawn('/usr/bin/taskset', args, { cwd, env: { ...base, ...environment }, detached: true, stdio: ['ignore', log, log] });
save('start.json', { revision, tree: git(['rev-parse', 'HEAD^{tree}']).trim(), selection, profiles, sources, environment, command: ['/usr/bin/taskset', ...args], node: process.version,
  glibc: execFileSync('/usr/bin/getconf', ['GNU_LIBC_VERSION'], { encoding: 'utf8' }).trim(),
  runnerSha256: sha(readFileSync(import.meta.filename)), startedAt, pid: child.pid, pgid: child.pid, freeMiB: freeMiB(), stopFloorMiB: 768,
  scope: 'Local installed Fin 0 nominal collection supplement. No hosted, dispatch measurement, or whole #1442 closure claim.' });
console.log(JSON.stringify({ output, pid: child.pid, startedAt }));
let minimumFreeMiB = freeMiB(), stoppedForDisk = false, escalation;
const signal = name => { try { process.kill(-child.pid, name); } catch (error) { if (error.code !== 'ESRCH') throw error; } };
const monitor = setInterval(() => {
  minimumFreeMiB = Math.min(minimumFreeMiB, freeMiB());
  if (minimumFreeMiB < 768 && !stoppedForDisk) {
    stoppedForDisk = true; signal('SIGTERM'); escalation = setTimeout(() => signal('SIGKILL'), 10000);
  }
}, 5000);
const result = await new Promise(resolve => {
  child.once('error', error => resolve({ code: null, signal: null, error: error.message }));
  child.once('close', (code, signal) => resolve({ code, signal }));
});
clearInterval(monitor); clearTimeout(escalation); closeSync(log);
save('end.json', { ...result, stoppedForDisk, minimumFreeMiB, endedAt: new Date().toISOString(), tapSha256: sha(readFileSync(join(output, 'run.tap'))) });
console.log(JSON.stringify({ selection, ...result, stoppedForDisk, minimumFreeMiB }));
clean(); assert.equal(stoppedForDisk, false); assert.equal(result.code, 0);
const extensions = { c: 'c', cpp: 'cpp', python: 'py', rust: 'rs', ruby: 'rb', dotnet: 'cs', java: 'java', kotlin: 'kt', 'php-native': 'php', 'wit-wasi': 'c', perl: 'pl' };
const receipts = {};
for (const [file, route] of [['ordinary.json', 'ordinary-source'], ['reviewed.json', 'reviewed-ir']]) {
  const bytes = readFileSync(join(output, file)), report = JSON.parse(bytes);
  assert.equal(report.schemaVersion, 1); assert.equal(report.reproducible, true);
  assert.deepEqual(report.reports.map(row => row.profile), profiles);
  for (const row of report.reports) {
    assert.equal(row.checks, finRecordZeroChecks); assert.equal(row.path, route);
    for (const flag of ['sourceRemovedBeforeInstallation', 'offlineInstall', 'compilerFreePath']) assert.equal(row[flag], true);
    assert.deepEqual(row.refinements, finRecordZeroRefinements);
    assert.equal(row.consumerSha256, sources[`tests/fixtures/fin-record-zero-consumers/${row.profile}.${extensions[row.profile]}`]);
    for (const key of ['bindingIrSha256', 'sourceTreeSha256', 'modelSha256', 'receiptSha256']) assert.match(row[key], /^[a-f0-9]{64}$/);
  }
  receipts[file] = sha(bytes);
}
save('verified.json', { revision, profiles, checksPerConsumer: finRecordZeroChecks, receipts, verifiedAt: new Date().toISOString() });
console.log(JSON.stringify({ verified: true, receipts }));

