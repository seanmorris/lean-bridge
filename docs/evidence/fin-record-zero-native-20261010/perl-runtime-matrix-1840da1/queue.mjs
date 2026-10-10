import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const revision = process.argv[2], root = '/app';
assert.match(revision ?? '', /^[a-f0-9]{40}$/);
assert.equal(execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(), revision);
assert.equal(execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], { cwd: root, encoding: 'utf8' }), '');
const output = join(root, 'build', `vo1442-zero-perl-matrix-${revision.slice(0, 7)}-r3`);
mkdirSync(output);
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const selections = ['5.36.3-threaded', '5.36.3-unthreaded', '5.38.2-threaded', '5.38.2-unthreaded'];
const inspect = selection => {
  const command = `/app/.toolchains/perl/${selection}/bin/perl`;
  const args = ['-MConfig', '-MJSON::PP', '-e', 'print JSON::PP->new->canonical->encode({version => "$^V", archname => $Config{archname}, threaded => $Config{usethreads} eq "define" ? JSON::PP::true : JSON::PP::false})'];
  const stdout = execFileSync(command, args, { cwd: root, encoding: 'utf8' });
  const runtime = JSON.parse(stdout);
  assert.equal(runtime.version, 'v' + selection.split('-')[0]);
  assert.equal(runtime.threaded, selection.endsWith('-threaded'));
  assert.equal(runtime.archname, runtime.threaded ? 'x86_64-linux-thread-multi' : 'x86_64-linux');
  return { selection, command, args, stdout, runtime, realpath: realpathSync(command), sha256: sha(readFileSync(command)) };
};
const before = selections.map(inspect);
const save = (name, value) => writeFileSync(join(output, name), JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
save('start.json', { revision, startedAt: new Date().toISOString(), runnerSha256: sha(readFileSync(import.meta.filename)), nativeRunnerSha256: sha(readFileSync(join(root, 'build/run-vo1442-zero-native-v2.mjs'))), runtimes: before });
const records = [];
for (const runtime of before) {
  assert.deepEqual(inspect(runtime.selection), runtime);
  const selection = 'perl' + runtime.selection.replaceAll('.', '') + '-floor236';
  const args = ['build/run-vo1442-zero-native-v2.mjs', revision, selection, 'perl'];
  const startedAt = new Date().toISOString();
  console.log(JSON.stringify({ selection, startedAt, runtime: runtime.runtime }));
  const child = spawn(process.execPath, args, { cwd: root, env: { ...process.env, LEAN_BRIDGE_CORPUS_PERL: runtime.command }, stdio: 'inherit' });
  const result = await new Promise(resolve => {
    child.once('error', error => resolve({ code: null, signal: null, error: error.message }));
    child.once('close', (code, signal) => resolve({ code, signal }));
  });
  const after = inspect(runtime.selection);
  const record = { selection, command: [process.execPath, ...args], startedAt, endedAt: new Date().toISOString(), ...result, runtimeBefore: runtime, runtimeAfter: after };
  save(selection + '.json', record); records.push(record);
  assert.equal(result.code, 0); assert.equal(result.signal, null);
  assert.deepEqual(after, runtime);
}
save('end.json', { revision, endedAt: new Date().toISOString(), records });
console.log(JSON.stringify({ passed: selections, output }));


