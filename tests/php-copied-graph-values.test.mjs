/**
 * Compile and exercise finite PHP values without loading a Lean library.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { generateCopiedPhpGraphValues } from "../src/backends/php/copied-graph-values.mjs";
import { bundledBrickMath } from "../src/backends/php/brick-math.mjs";
import { nativeRecursiveReviewedIr } from "./helpers/native-recursive-reviewed.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { runCopied } from "./helpers/copied-fixture-install.mjs";
import { phpLinkedGraphIr, phpDeepGraphIr, phpGraphNamingIr, phpExtraGraphValues, phpShadowFunctions } from "./helpers/php-graph-values-fixture.mjs";
import { assertAdministrativeSourceUpdate } from "./helpers/test-registration-history.mjs";

const additionalFiles = options => ({ ...Object.fromEntries([phpLinkedGraphIr, phpDeepGraphIr, phpGraphNamingIr].flatMap(fixture => {
	const model = generateCopiedPhpGraphValues(fixture(), options);
	return Object.entries(model.files).map(([path, source]) => [`${model.layout.prefix}/${path}`, source]);
})), "names/shadow.php": phpShadowFunctions });

test("PHP recursive declarations retain finite types, strict constructors and independent word widths", () => {
	const ir = nativeRecursiveReviewedIr(), before = structuredClone(ir), generated = generateCopiedPhpGraphValues(ir);
	assert.deepEqual(ir, before); assert.deepEqual(generateCopiedPhpGraphValues(ir), generated);
	const source = generated.files["src/Api.php"];
	assert.match(source, /final readonly class TreeBranch extends Tree/);
	assert.match(source, /public array \$children/); assert.match(source, /@var list<Tree>/);
	assert.match(source, /function __construct\(mixed \$children\)/);
	assert.match(source, /public Some\|null \$marker/);
	assert.doesNotMatch(source, /FFI|Native::|GraphTypes|function bridgeField/);
	assert.ok(generated.functions.some(fn => fn.publicName === "empty_"));
	assert.equal(generated.records.find(record => record.name === "WideNext").fields.length, 256);
	assert.equal(generated.aliases.find(alias => alias.name === "Forest").phpType, "list<Tree>");
	for(const [integerBits, wordBits] of [[32, 32], [32, 64], [64, 32], [64, 64]])
	{
		const model = generateCopiedPhpGraphValues(ir, { integerBits, wordBits });
		const type = name => model.types.find(node => node.ref.kind === "primitive" && node.ref.name === name).publicType;
		assert.equal(type("usize"), wordBits >= integerBits ? "\\Brick\\Math\\BigInteger" : "int");
		assert.equal(type("isize"), wordBits > integerBits ? "\\Brick\\Math\\BigInteger" : "int");
		assert.equal(type("uint32"), integerBits === 32 ? "\\Brick\\Math\\BigInteger" : "int");
	}
	assert.throws(() => generateCopiedPhpGraphValues(ir, { integerBits: 16 }), /width/);
	assert.throws(() => generateCopiedPhpGraphValues(ir, { wordBits: 16 }), /width/);
	assert.throws(() => generateCopiedPhpGraphValues(phpDeepGraphIr(33)), /type nesting or node limit exceeded/);
	for(const name of ["Bytes", "Some", "Internal", "BigInteger"])
	{
		const invalid = phpLinkedGraphIr(); invalid.types[0].name = name;
		assert.throws(() => generateCopiedPhpGraphValues(invalid), /reserved/);
	}
});

test("PHP recursive values execute in weak and strict callers without native loading", {
	skip: process.env.LEAN_BRIDGE_PHP_GRAPH_VALUES_TEST !== "1", timeout: 180_000
}, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-php-graph-values-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const php = process.env.LEAN_BRIDGE_PHP ?? "/usr/bin/php", observations = [];
	const source = (await readFile("tests/fixtures/structured-types/recursive-php-values.php", "utf8")).replace("// EXTRA_VALUES", phpExtraGraphValues);
	for(const [integerBits, wordBits] of [[64, 64], [64, 32], [32, 32], [32, 64]])
	{
		const directory = join(root, `${integerBits}-${wordBits}`), generated = generateCopiedPhpGraphValues(nativeRecursiveReviewedIr(), { integerBits, wordBits });
		const files = { ...generated.files, ...additionalFiles({ integerBits, wordBits }) };
		for(const [path, contents] of Object.entries({ ...files, ...bundledBrickMath() }))
		{
			await saveLakeFile(directory, path, contents);
			if(Object.hasOwn(files, path)) await runCopied(php, ["-n", "-l", path], directory);
		}
		for(const mode of ["weak", "strict"])
		{
			const probe = source.replace("strict_types=0", `strict_types=${mode === "strict" ? 1 : 0}`)
				.replace("INTEGER_BITS = 64", `INTEGER_BITS = ${integerBits}`).replace("WORD_BITS = 64", `WORD_BITS = ${wordBits}`);
			await saveLakeFile(directory, "probe.php", probe);
			const result = await runCopied(php, ["-n", "-d", "memory_limit=128M", "-d", "display_errors=stderr", "probe.php"], directory);
			assert.equal(result.stderr, ""); const observation = JSON.parse(result.stdout);
			assert.ok(observation.checks > 100); assert.ok(observation.rejections > 50); assert.equal(observation.nativeCalls, 0);
			assert.equal(observation.integerBits, integerBits); assert.equal(observation.wordBits, wordBits);
			observations.push({ mode, observation, probeSha256: sha256(probe)
				, sourceHashes: Object.fromEntries(Object.entries(files).map(([path, source]) => [path, sha256(source)])) });
		}
	}
	const version = await runCopied(php, ["-n", "-v"], root);
	await saveLakeFile("build/recursive", "php-values.json", canonicalJson({ schemaVersion: 1
		, compiledLean: false, installedPackage: false
		, phpVersion: version.stdout, phpSha256: sha256(await readFile(php))
		, observations }));
});

test("recursive PHP values run in the actual 32-bit PHP-Wasm interpreter", {
	skip: process.env.LEAN_BRIDGE_PHP_WASM_GRAPH_VALUES_TEST !== "1"
	, timeout: 180_000
}, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-php-wasm-graph-values-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const phpHost = process.env.LEAN_BRIDGE_PHP_WASM_HOST ?? join(process.cwd(), "build/php-wasm-host/node_modules/php-wasm");
	const generated = generateCopiedPhpGraphValues(nativeRecursiveReviewedIr(), { integerBits: 32, wordBits: 32 });
	const generatedFiles = { ...generated.files, ...additionalFiles({ integerBits: 32, wordBits: 32 }) };
	const files = { ...generatedFiles, ...bundledBrickMath() };
	for(const [path, source] of Object.entries(files)) await saveLakeFile(root, path, source);
	const source = (await readFile("tests/fixtures/structured-types/recursive-php-values.php", "utf8"))
		.replace("// EXTRA_VALUES", phpExtraGraphValues)
		.replace("INTEGER_BITS = 64", "INTEGER_BITS = 32").replace("WORD_BITS = 64", "WORD_BITS = 32");
	const observations = [];
	for(const mode of ["weak", "strict"])
	{
		const probe = source.replace("strict_types=0", `strict_types=${mode === "strict" ? 1 : 0}`);
		await saveLakeFile(root, "probe.php", probe);
		const host = `import { readFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { basename } from 'node:path';
import { PhpNode } from ${JSON.stringify(pathToFileURL(join(phpHost, "PhpNode.mjs")).href)};
const binaries = {};
const locateFile = name => {
  const path = fileURLToPath(new URL(name, ${JSON.stringify(pathToFileURL(phpHost + "/").href)}));
  if (path.endsWith('.wasm')) binaries[basename(path)] = createHash('sha256').update(readFileSync(path)).digest('hex');
  return path;
};
const php = new PhpNode({version: '8.4', ini: 'memory_limit=128M', locateFile});
let stdout = '', stderr = '';
php.addEventListener('output', event => { for (const part of event.detail) stdout += part; });
php.addEventListener('error', event => { for (const part of event.detail) stderr += part; });
await php.binary;
const directories = new Set();
for (const path of ${JSON.stringify([...Object.keys(files), "probe.php"])}) {
  let current = ''; const parts = path.split('/'); parts.pop();
  for (const part of parts) { current += '/' + part; if (!directories.has(current)) { await php.mkdir(current); directories.add(current); } }
  await php.writeFile('/' + path, await readFile(path, 'utf8'));
}
const status = await php.run("<?php require '/probe.php';");
if (status || stderr) throw new Error(JSON.stringify({status, stdout, stderr}));
console.log(JSON.stringify({observation: JSON.parse(stdout.trim()), binaries}));
`;
		await saveLakeFile(root, "host.mjs", host);
		const result = await runCopied(process.execPath, ["host.mjs"], root);
		assert.equal(result.stderr, ""); const { observation, binaries } = JSON.parse(result.stdout);
		assert.equal(Object.keys(binaries).length, 1);
		for(const [path, hash] of Object.entries(binaries)) assert.equal(hash, sha256(await readFile(join(phpHost, path))));
		assert.equal(observation.actualPhpBits, 32); assert.equal(observation.integerBits, 32); assert.equal(observation.wordBits, 32);
		assert.ok(observation.checks > 100); assert.ok(observation.rejections > 50); assert.equal(observation.nativeCalls, 0);
		observations.push({ mode, observation, binaries, probeSha256: sha256(probe), hostSha256: sha256(host) });
	}
	await saveLakeFile("build/recursive", "php-wasm-values.json", canonicalJson({ schemaVersion: 1
		, compiledLean: false, installedPackage: false, observations
		, sourceHashes: Object.fromEntries(Object.entries(generatedFiles).map(([path, source]) => [path, sha256(source)]))
		, hostPackageSha256: sha256(await readFile(join(phpHost, "package.json")))
		, runtimeSourceSha256: sha256(await readFile(join(phpHost, "php8.4-node.mjs")))
		, hostSourceSha256: sha256(await readFile(join(phpHost, "PhpNode.mjs"))) }));
});

test("recursive PHP value execution stays required in both interpreter jobs", async () => {
	const workflow = await readFile(".github/workflows/consumer-matrix.yml", "utf8");
	for(const profile of ["PHP", "PHP_WASM"])
		assert.ok(workflow.includes(`          LEAN_BRIDGE_${profile}_GRAPH_VALUES_TEST=1 node --test tests/php-copied-graph-values.test.mjs\n`));
	for(const name of ["php-values", "php-wasm-values"])
	{
		assert.ok(workflow.includes(`          test -s build/recursive/${name}.json\n`));
		assert.ok(workflow.includes(`            build/recursive/${name}.json\n`));
	}
});

const checkReports = reports => {
	assert.deepEqual(Object.keys(reports).sort(), ["native", "wasm"]);
	for(const report of Object.values(reports))
	{ assert.equal(report.schemaVersion, 1); assert.equal(report.compiledLean, false); assert.equal(report.installedPackage, false); }
	assert.deepEqual(reports.native.observations.map(run => [run.observation.integerBits, run.observation.wordBits, run.mode]),
		[[64, 64], [64, 32], [32, 32], [32, 64]].flatMap(([integer, word]) => ["weak", "strict"].map(mode => [integer, word, mode])));
	assert.deepEqual(reports.wasm.observations.map(run => run.mode), ["weak", "strict"]);
	for(const [profile, report] of Object.entries(reports)) for(const run of report.observations)
	{
		const result = run.observation;
		assert.equal(result.actualPhpBits, profile === "native" ? 64 : 32);
		assert.equal(result.checks, result.integerBits === 64 ? 167 : 168);
		assert.equal(result.rejections, result.integerBits === 64 ? 63 : 64);
		assert.equal(result.maximumSpineLinks, 127); assert.equal(result.maximumVisits, 262144);
		assert.equal(result.wideFields, 256); assert.equal(result.nativeCalls, 0);
		assert.match(result.phpVersion, profile === "native" ? /^8\.2\./ : /^8\.4\./);
		assert.match(run.probeSha256, /^[a-f0-9]{64}$/);
		if(profile === "wasm")
		{
			assert.equal(result.integerBits, 32); assert.equal(result.wordBits, 32);
			assert.match(run.hostSha256, /^[a-f0-9]{64}$/);
			assert.equal(Object.keys(run.binaries).length, 1);
			for(const [name, hash] of Object.entries(run.binaries))
			{ assert.match(name, /^[a-f0-9]+\.wasm$/); assert.match(hash, /^[a-f0-9]{64}$/); }
		}
	}
	assert.deepEqual(reports.wasm.observations[0].binaries, reports.wasm.observations[1].binaries);
	for(const key of ["hostPackageSha256", "hostSourceSha256", "runtimeSourceSha256"]) assert.match(reports.wasm[key], /^[a-f0-9]{64}$/);
	assert.match(reports.native.phpSha256, /^[a-f0-9]{64}$/);
};

test("PHP recursive value records bind exact sources and actual 32-bit interpreter checks", async () => {
	const record = JSON.parse(await readFile("docs/evidence/php-recursive-values-20260923.json", "utf8"));
	assert.equal(record.schemaVersion, 1); assert.equal(record.planNode, 1219);
	assert.equal(record.kind, "recursive-php-public-values");
	for(const [path, hash] of Object.entries(record.sourceHashes)) await assertAdministrativeSourceUpdate(path, hash);
	checkReports(record.reports);
	for(const [profile, report] of Object.entries(record.reports))
	{
		assert.equal(record.reportHashes[profile], sha256(canonicalJson(report)));
		assert.equal(sha256(record.logs[profile].text), record.logs[profile].sha256);
		assert.match(record.logs[profile].text, /# pass 1\n# fail 0\n# cancelled 0\n# skipped 0/);
		for(const run of report.observations)
		{
			const options = { integerBits: run.observation.integerBits, wordBits: run.observation.wordBits };
			const generated = { ...generateCopiedPhpGraphValues(nativeRecursiveReviewedIr(), options).files, ...additionalFiles(options) };
			const actual = Object.fromEntries(Object.entries(generated).map(([path, source]) => [path, sha256(source)]));
			assert.deepEqual(profile === "native" ? run.sourceHashes : report.sourceHashes, actual);
			const probe = (await readFile("tests/fixtures/structured-types/recursive-php-values.php", "utf8"))
				.replace("// EXTRA_VALUES", phpExtraGraphValues).replace("strict_types=0", `strict_types=${run.mode === "strict" ? 1 : 0}`)
				.replace("INTEGER_BITS = 64", `INTEGER_BITS = ${options.integerBits}`).replace("WORD_BITS = 64", `WORD_BITS = ${options.wordBits}`);
			assert.equal(run.probeSha256, sha256(probe));
		}
	}
	for(const change of [
		reports => { reports.native.observations.pop(); }
		, reports => { reports.wasm.observations[0].observation.actualPhpBits = 64; }
		, reports => { reports.wasm.observations[0].binaries = {}; }
		, reports => { reports.native.observations[0].observation.rejections--; }
		, reports => { reports.wasm.compiledLean = true; }
	]) { const altered = structuredClone(record.reports); change(altered); assert.throws(() => checkReports(altered)); }
});
