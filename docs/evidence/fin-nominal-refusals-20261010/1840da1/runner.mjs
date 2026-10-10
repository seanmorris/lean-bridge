import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cp, mkdtemp, readFile, rm, statfs, writeFile, access, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { buildCanonicalProject } from '../src/build/canonical-build.mjs';
import { canonicalJson, sha256 } from '../src/capsule/node.mjs';

const revision = '1840da12d270045b1340b16e98a2a8085f002337';
const output = '/app/build/vo1442-nominal-refusals-1840da1';
const git = args => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
const environment = { ...process.env, LEAN_BRIDGE_LEAN_PREFIX: '/app/.toolchains/elan/toolchains/leanprover--lean4---v4.32.2', LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR: '2.36', LEAN_NUM_THREADS: '1', OMP_NUM_THREADS: '1', MAKEFLAGS: '-j1' };
const selections = [
  { label: 'generic', name: 'genericSite', source: 'structure Holder (α : Type) where\n  digit : Fin 5\n  value : α\nabbrev NatHolder := Holder Nat\ndef genericSite (value : NatHolder) : Nat := value.digit.val', pattern: /Fin refinements are not implemented.*generic record instantiations/ },
  { label: 'recursive', name: 'recursiveSite', source: 'inductive Tree where\n  | leaf (digit : Fin 5)\n  | branch (children : List Tree)\ndef recursiveSite (value : Tree) : Nat := match value with\n  | .leaf digit => digit.val\n  | .branch children => children.length', pattern: /Fin refinements cannot share a component with copied graph exports/ },
  { label: 'callback-record', name: 'callbackRecordSite', source: 'structure CallbackRecord where\n  digit : Fin 5\n  callback : Nat → Nat\ndef callbackRecordSite (value : CallbackRecord) : Nat := value.callback value.digit.val', pattern: /callback.*copied|copied.*callback|callback.*retention/ }
];
test('original nominal refusal boundaries survive compiled plain-field admission', { timeout: 900000 }, async t => {
  assert.equal(git(['rev-parse', 'HEAD']).trim(), revision);
  assert.equal(git(['status', '--porcelain', '--untracked-files=no']), '');
  const disk = await statfs('/app'); assert.ok(disk.bavail * disk.bsize >= 2048 * 1024 ** 2);
  await mkdir(output);
  const sources = Object.fromEntries(await Promise.all(git(['ls-files', 'src']).trim().split('\n').map(async path => [path, sha256(await readFile(path))])));
  await writeFile(join(output, 'start.json'), JSON.stringify({ revision, tree: git(['rev-parse', 'HEAD^{tree}']).trim(), startedAt: new Date().toISOString(), runnerSha256: sha256(await readFile(import.meta.filename)), sources }, null, 2) + '\n', { flag: 'wx' });
  for (const item of selections) await t.test(item.label, async () => {
    const directory = await mkdtemp(join(tmpdir(), 'lean-bridge-fin-nominal-refusal-'));
    t.after(() => rm(directory, { recursive: true, force: true }));
    const projectRoot = join(directory, 'project'), outputRoot = join(directory, 'release');
    await cp('tests/fixtures/onboarding/native-fin', projectRoot, { recursive: true });
    const source = 'namespace NativeFin\n' + item.source + '\nend NativeFin\n';
    const config = { schemaVersion: 1, modules: ['NativeFin'], exports: ['NativeFin.' + item.name], targets: { c: { name: 'finrefusal', version: '1.0.0' } } };
    await writeFile(join(projectRoot, 'NativeFin.lean'), source);
    await writeFile(join(projectRoot, 'lean-bridge.exports.json'), canonicalJson(config));
    await writeFile(join(output, item.label + '.lean'), source, { flag: 'wx' });
    let failure;
    try { await buildCanonicalProject({ projectRoot, outputRoot, targets: ['c'], environment }); }
    catch (error) { failure = { code: error.code, message: error.message, details: error.details }; }
    const outputExists = await access(outputRoot).then(() => true, error => { if (error.code !== 'ENOENT') throw error; return false; });
    await writeFile(join(output, item.label + '.json'), JSON.stringify({ label: item.label, declaration: 'NativeFin.' + item.name, sourceSha256: sha256(source), config, failure, outputExists }, null, 2) + '\n', { flag: 'wx' });
    assert.ok(failure, 'unsupported record must fail');
    assert.ok(['native-elaboration-unsupported', 'native-refinements-unsupported'].includes(failure.code), JSON.stringify(failure));
    assert.match(JSON.stringify(failure), new RegExp('NativeFin\\.' + item.name));
    assert.match(JSON.stringify(failure), item.pattern);
    assert.equal(outputExists, false);
  });
  assert.equal(git(['rev-parse', 'HEAD']).trim(), revision);
  assert.equal(git(['status', '--porcelain', '--untracked-files=no']), '');
});
