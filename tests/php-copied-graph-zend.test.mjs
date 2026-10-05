/**
 * Actual wasm32 PHP/Zend graph conversion with independent C fault producers.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { compileCopiedPhpGraphZendModel, generateCopiedPhpGraphZendAdapter } from "../src/backends/php/copied-graph-zend.mjs";
import { bundledBrickMath } from "../src/backends/php/brick-math.mjs";
import { phpGraphConversionIr } from "./helpers/php-graph-conversion-fixture.mjs";
import { phpGraphZendFixture } from "./helpers/php-graph-zend-fixture.mjs";
import { checkPhpGraphZendLean } from "./helpers/php-graph-zend-lean.mjs";
import { assertPhpGraphZendEvidence } from "./helpers/php-graph-zend-receipt.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { runCopied } from "./helpers/copied-fixture-install.mjs";

test("recursive Zend descriptors preserve wasm32 scalars, cycles and exact PHP classes", () => {
	const ir = phpGraphConversionIr(), before = structuredClone(ir), model = compileCopiedPhpGraphZendModel(ir);
	const files = generateCopiedPhpGraphZendAdapter(ir);
	assert.deepEqual(ir, before); assert.deepEqual(generateCopiedPhpGraphZendAdapter(ir), files);
	assert.equal(model.layout.wordBits, 32); assert.equal(model.types.length, 42);
	assert.deepEqual(model.descriptors.filter(node => !node.inhabited).map(node => node.publicType), ["Never_"]);
	assert.equal(model.types.find(node => node.ref.name === "usize").name, "uint32_t");
	assert.equal(model.types.find(node => node.ref.name === "isize").name, "int32_t");
	const source = files[`extension/${model.stem}.c`];
	assert.match(source, /lg_frame frames\[129\]/); assert.match(source, /zend_catch \{ lg_cleanup/);
	assert.match(source, /offsetof\(recursive_scalars_t, signed_word\)/);
	assert.doesNotMatch(source, /lean_ctor_get|lean_unbox|FFI/);
	const manifest = JSON.parse(files["graph-zend-manifest.json"]);
	assert.equal(manifest.kind, "lean-bridge-graph-zend-source"); assert.equal(manifest.exports.length, 20);
	for(const [path, entry] of Object.entries(manifest.files))
	{ assert.equal(entry.sha256, sha256(files[path])); assert.equal(entry.bytes, Buffer.byteLength(files[path])); }
	assert.ok(!Object.hasOwn(files, "binding-manifest.json"));
});

test("fresh Lean executes through generated recursive PHP-Wasm functions", {
	skip: process.env.LEAN_BRIDGE_PHP_WASM_GRAPH_LEAN_TEST !== "1", timeout: 600000
}, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-php-graph-zend-lean-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const report = await checkPhpGraphZendLean(root, message => t.diagnostic(message));
	assert.equal(report.exports, 18);
	await saveLakeFile("build/recursive", "php-wasm-zend-lean.json", canonicalJson(report));
});

test("recursive PHP-Wasm conversion CI requires both independent and compiled-Lean reports", async () => {
	const workflow = await readFile(".github/workflows/consumer-matrix.yml", "utf8");
	assert.ok(workflow.includes("          LEAN_BRIDGE_PHP_WASM_GRAPH_ZEND_TEST=1 LEAN_BRIDGE_PHP_WASM_GRAPH_LEAN_TEST=1 node --test tests/php-copied-graph-zend.test.mjs\n"));
	for(const report of ["php-wasm-zend", "php-wasm-zend-lean"])
	{
		assert.ok(workflow.includes(`          test -s build/recursive/${report}.json\n`));
		assert.ok(workflow.includes(`            build/recursive/${report}.json\n`));
	}
});

test("recursive Zend evidence binds actual wasm32 conversion without claiming installed packages", async () => {
	const record = JSON.parse(await readFile("docs/evidence/php-wasm-recursive-conversions-20260924.json", "utf8"));
	await assertPhpGraphZendEvidence(record);
	for(const mutate of [
		value => { value.installedPackage = true; }
		, value => { value.reports.isolated.observations.pop(); }
		, value => { value.reports.isolated.bailouts.pop(); }
		, value => { value.reports.isolated.observations[0].observed.inputFailures = 0; }
		, value => { value.reports.lean.observations[0].observed.stats.nativeLive = 1; }
		, value => { value.reports.lean.compiledLean = false; }
		, value => { value.reports.lean.layoutSha256 = "0".repeat(64); }
		, value => { value.reports.lean.observations[0].observed.faults = {}; }
	]) {
		const changed = structuredClone(record); mutate(changed);
		for(const [key, report] of Object.entries(changed.reports)) changed.reportHashes[key] = sha256(canonicalJson(report));
		await assert.rejects(() => assertPhpGraphZendEvidence(changed));
	}
});

test("generated Zend graphs execute on 32-bit PHP with strict validation and failure cleanup", {
	skip: process.env.LEAN_BRIDGE_PHP_WASM_GRAPH_ZEND_TEST !== "1", timeout: 600000
}, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-php-graph-zend-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const ir = phpGraphConversionIr(), model = compileCopiedPhpGraphZendModel(ir), files = generateCopiedPhpGraphZendAdapter(ir);
	const sdk = resolve(process.env.LEAN_BRIDGE_PHP_EMSDK ?? ".toolchains/emsdk-php-wasm");
	const emcc = join(sdk, "upstream/emscripten/emcc"), phpSource = resolve(process.env.LEAN_BRIDGE_PHP_SOURCE ?? "build/php-wasm-sdk/php8.4-src");
	const host = resolve(process.env.LEAN_BRIDGE_PHP_WASM_HOST ?? "build/php-wasm-host/node_modules/php-wasm");
	const env = { ...process.env, EM_CONFIG: join(sdk, ".emscripten"), EMSDK: sdk };
	const wire = files["src/Internal/Wire.php"].replace("private static function checkpoint(): void {}", "private static function checkpoint(): void { global $wireCheckpoints, $wireFail; if (++$wireCheckpoints === ($wireFail ?? 0)) throw new \\Error('PHP conversion fault'); }");
	assert.notEqual(wire, files["src/Internal/Wire.php"]);
	const phpFiles = { ...files, ...bundledBrickMath(), "src/Internal/Wire.php": wire };
	for(const [path, source] of Object.entries(phpFiles)) await saveLakeFile(root, path, source);
	for(const path of Object.keys(files).filter(path => path.endsWith(".php"))) await runCopied("/usr/bin/php", ["-n", "-l", path], root);
	const fixture = phpGraphZendFixture(model), adapter = files[`extension/${model.stem}.c`];
	assert.equal(adapter.split("  PHP_FE_END").length, 2);
	const compiled = fixture.prelude + adapter.replace("  PHP_FE_END", fixture.entries + "  PHP_FE_END");
	await saveLakeFile(root, "probe.c", compiled);
	const includes = [join(root, "include"), phpSource, ...["Zend", "main", "TSRM", "ext"].map(path => join(phpSource, path))];
	const flags = ["-O2", "-g0", "-fPIC", "-fvisibility=hidden"
		, "-fbracket-depth=4096", "-ffp-contract=off", "-Wall", "-Wextra", "-Werror"
		, "-Wno-unused-parameter", "-Wno-unused-function"
		, ...includes.flatMap(path => ["-I", path])];
	t.diagnostic("Compiling the generated Zend walker and independent C output producers");
	await runCopied(emcc, [...flags, "-sSIDE_MODULE=2", "-sEXPORTED_FUNCTIONS=['_get_module']", "-Wl,--no-entry", "probe.c", "-o", "probe.so"], root, env);
	const extra = await readFile("tests/fixtures/structured-types/recursive-php-zend.php", "utf8");
	const base = (await readFile("tests/fixtures/structured-types/recursive-php-values.php", "utf8"))
		.replace("INTEGER_BITS = 64", "INTEGER_BITS = 32").replace("WORD_BITS = 64", "WORD_BITS = 32")
		.replace("// EXTRA_VALUES", extra)
		.replace("'nativeCalls' => 0", "'compiledLean' => false, 'installedPackage' => false, 'stats' => graph_probe_stats(), 'faults' => $faults, 'phpFaults' => $phpFaults, 'inputFailures' => $inputFailures, 'outputFailures' => $outputFailures, 'scenario' => $scenario");
	const scripts = Object.keys(phpFiles).filter(path => path.endsWith(".php"));
	const hostSource = `import {readFile} from 'node:fs/promises';
import {PhpNode} from ${JSON.stringify(pathToFileURL(join(host, "PhpNode.mjs")).href)};
process.setUncaughtExceptionCaptureCallback(error=>{ console.error(error.stack); process.exit(1); });
const php = new PhpNode({version:'8.4',autoTransaction:false,ini:'memory_limit=256M',sharedLibs:[{name:'probe.so',url:new URL(${JSON.stringify(pathToFileURL(join(root, "probe.so")).href)}),ini:true}]});
let stdout='',stderr='';
php.addEventListener('output',event=>{stdout+=event.detail.join('');}); php.addEventListener('error',event=>{stderr+=event.detail.join('');});
await php.binary;
const directories=new Set();
for(const path of ${JSON.stringify([...scripts, "graph-zend-manifest.json", "probe.php"])}) {
  let current=''; const parts=path.split('/'); parts.pop();
  for(const part of parts) { current+='/'+part; if(!directories.has(current)){await php.mkdir(current);directories.add(current);} }
  await php.writeFile('/'+path,await readFile(path,'utf8'));
}
const status=await php.run("<?php require '/probe.php';");
if(status || stderr) throw new Error(JSON.stringify({status,stdout,stderr}));
console.log(stdout);
`;
	await saveLakeFile(root, "host.mjs", hostSource);
	const observations = [];
	for(const mode of ["weak", "strict"]) for(const scenario of [1, 2, 3, 4, 7, 9, 14])
	{
		t.diagnostic(`Executing ${mode} PHP caller, retirement scenario ${scenario}`);
		const probe = base.replace("strict_types=0", `strict_types=${mode === "strict" ? 1 : 0}`).replace("SCENARIO", String(scenario));
		await saveLakeFile(root, "probe.php", probe);
		const result = await runCopied(process.execPath, ["host.mjs"], root, process.env);
		assert.equal(result.stderr, ""); const observed = JSON.parse(result.stdout);
		assert.equal(observed.actualPhpBits, 32); assert.equal(observed.integerBits, 32); assert.equal(observed.wordBits, 32);
		assert.equal(observed.stats.live, 0); assert.equal(observed.stats.owners, 0); assert.equal(observed.stats.retired, 1);
		assert.equal(observed.compiledLean, false); assert.equal(observed.installedPackage, false);
		assert.ok(observed.checks > 250); assert.ok(observed.rejections > 100);
		observations.push({ mode, scenario, observed, probeSha256: sha256(probe) });
	}
	const seed = (await readFile("tests/fixtures/structured-types/recursive-php-values.php", "utf8")).split("$children =")[0]
		.replace("INTEGER_BITS = 64", "INTEGER_BITS = 32").replace("WORD_BITS = 64", "WORD_BITS = 32");
	const bailouts = [];
	for(const scenario of [5, 6])
	{
		const probe = `${seed}\ngraph_probe_reset(${scenario}, 0); echo 'before'; LeanRecursive\\tree($tree); echo 'unreachable';`;
		await saveLakeFile(root, "probe.php", probe);
		const source = hostSource.replace('if(status || stderr) throw new Error(JSON.stringify({status,stdout,stderr}));\nconsole.log(stdout);', `
if(stdout !== 'before' || stderr) throw new Error(JSON.stringify({status,stdout,stderr}));
stdout=''; stderr='';
const recovered = await php.run("<?php $stats=graph_probe_stats(); graph_probe_reset(0,0); require_once '/dependencies/brick-math/autoload.php'; require_once '/src/Api.php'; $copy=LeanRecursive\\\\tree(new LeanRecursive\\\\TreeBranch([])); echo json_encode(['before'=>$stats,'after'=>graph_probe_stats(),'recovered'=>$copy instanceof LeanRecursive\\\\TreeBranch]);");
if(recovered || stderr) throw new Error(JSON.stringify({recovered,stdout,stderr}));
console.log(stdout);`);
		assert.notEqual(source, hostSource); await saveLakeFile(root, "bailout.mjs", source);
		const result = await runCopied(process.execPath, ["bailout.mjs"], root, process.env);
		assert.equal(result.stderr, ""); const observed = JSON.parse(result.stdout);
		assert.equal(observed.before.live, 0); assert.equal(observed.before.owners, 0); assert.equal(observed.before.retired, 0);
		assert.equal(observed.before.clears, 1); assert.equal(observed.recovered, true);
		assert.equal(observed.after.live, 0); assert.equal(observed.after.owners, 0); assert.equal(observed.after.clears, 2);
		bailouts.push({ scenario, observed, probeSha256: sha256(probe), hostSha256: sha256(source) });
	}
	await saveLakeFile("build/recursive", "php-wasm-zend.json", canonicalJson({ schemaVersion: 1
		, compiledLean: false, installedPackage: false, observations, bailouts
		, bindingIr: ir
		, generatedSources: Object.fromEntries(Object.entries(files).map(([path, source]) => [path, sha256(source)]))
		, wireProbeSha256: sha256(wire)
		, fixtureSha256: sha256(compiled), hostSha256: sha256(hostSource)
		, binarySha256: sha256(await readFile(join(root, "probe.so")))
		, compiler: (await runCopied(emcc, ["--version"], root, env)).stdout }));
});
