/**
 * Execute PHP ownership value declarations without claiming transport support.
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
import { generateOwnedPhpValues } from "../src/backends/php/owned-values.mjs";
import { bundledBrickMath } from "../src/backends/php/brick-math.mjs";
import { ownedCppCompositionReviewedIr } from "./helpers/owned-cpp-composition-fixture.mjs";
import { ownedPythonScalarsReviewedIr } from "./helpers/owned-python-scalars-fixture.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { runCopied } from "./helpers/copied-fixture-install.mjs";

const sources = options => {
	const scalars = ownedPythonScalarsReviewedIr(); scalars.component.id = `example/owned-scalars@${scalars.component.version}`;
	const foreign = ownedCppCompositionReviewedIr(); foreign.component.id = `example/foreign-owned@${foreign.component.version}`;
	return { ...generateOwnedPhpValues(ownedCppCompositionReviewedIr(), options).files
		, ...Object.fromEntries(Object.entries(generateOwnedPhpValues(scalars, options).files).map(([path, text]) => [`scalars/${path}`, text]))
		, ...Object.fromEntries(Object.entries(generateOwnedPhpValues(foreign, options).files).map(([path, text]) => [`foreign/${path}`, text])) };
};

test("owned PHP values retain finite nominal edges, aliases, identities and every scalar width", () => {
	const ir = ownedCppCompositionReviewedIr(), before = structuredClone(ir), values = generateOwnedPhpValues(ir);
	assert.deepEqual(ir, before);
	assert.deepEqual(generateOwnedPhpValues(ir).files, values.files);
	assert.equal(values.namespace, "LeanOwnedAggregates");
	assert.equal(values.types.length, 41); assert.equal(values.functions.length, 31);
	assert.equal(values.types.filter(node => node.identity).length, 8);
	assert.equal(values.types.filter(node => node.kind === "callback").length, 7);
	assert.match(values.source, /final readonly class ChainLink extends Chain/u);
	assert.match(values.source, /final class Ticket extends Internal\\Resource/u);
	assert.match(values.source, /public Some\|null \$next/u);
	assert.match(values.source, /public function __invoke\(mixed \$argument0\)/u);
	assert.doesNotMatch(values.source, /FFI|Native::|class BundleAlias|class TicketRow/u);
	assert.equal(values.aliases.find(alias => alias.name === "BundleAlias").phpType, "Bundle");
	assert.equal(values.aliases.find(alias => alias.name === "TicketRow").phpType, "list<Some<Ticket>|null>");
	assert.equal(values.functions.find(fn => fn.name === "newTicket").publicName, "new_ticket");
	assert.ok(values.source.length < 30000);
	for(const [integerBits, wordBits] of [[32, 32], [32, 64], [64, 32], [64, 64]])
	{
		const model = generateOwnedPhpValues(ownedPythonScalarsReviewedIr(), { integerBits, wordBits });
		const primitive = name => model.types.find(node => node.kind === "primitive" && node.name === name).publicType;
		assert.equal(model.types.filter(node => node.kind === "primitive").length, 19);
		assert.equal(model.records.find(record => record.name === "Scalars").fields.length, 19);
		assert.equal(primitive("nat"), "\\Brick\\Math\\BigInteger");
		assert.equal(primitive("uint64"), "\\Brick\\Math\\BigInteger");
		assert.equal(primitive("usize"), wordBits >= integerBits ? "\\Brick\\Math\\BigInteger" : "int");
		assert.equal(primitive("isize"), wordBits > integerBits ? "\\Brick\\Math\\BigInteger" : "int");
		assert.equal(primitive("uint32"), integerBits === 32 ? "\\Brick\\Math\\BigInteger" : "int");
	}
});

test("owned PHP names reject case-insensitive collisions and invalid fields before code generation", () => {
	for(const name of ["Some", "sOME", "Internal", "Bytes", "BigInteger", "WithRecovery", "a'b", "A\\B"])
	{
		const ir = ownedCppCompositionReviewedIr(); ir.types.find(node => node.name === "Ticket").name = name;
		assert.throws(() => generateOwnedPhpValues(ir));
	}
	for(const name of ["this", "GLOBALS", "_ENV", "a-b", "0a"])
	{
		const ir = ownedCppCompositionReviewedIr(); ir.types.find(node => node.name === "Payload").fields[0].name = name;
		assert.throws(() => generateOwnedPhpValues(ir));
	}
	const collision = ownedCppCompositionReviewedIr(); collision.types.find(node => node.name === "Payload").name = "ticket";
	assert.throws(() => generateOwnedPhpValues(collision));
	const alias = ownedCppCompositionReviewedIr(); alias.types.find(node => node.name === "BundleAlias").name = "Some";
	assert.throws(() => generateOwnedPhpValues(alias));
	assert.throws(() => generateOwnedPhpValues(ownedCppCompositionReviewedIr(), { integerBits: 16 }), /width/u);
	assert.throws(() => generateOwnedPhpValues(ownedCppCompositionReviewedIr(), { wordBits: 16 }), /width/u);
});

test("owned PHP values execute in strict and weak native PHP callers", {
	skip: process.env.LEAN_BRIDGE_OWNED_PHP_VALUES_TEST !== "1", timeout: 180000
}, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-owned-php-values-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const php = process.env.LEAN_BRIDGE_PHP ?? "/usr/bin/php", observations = [];
	const source = await readFile("tests/fixtures/structured-types/owned-php-values.php", "utf8");
	for(const [integerBits, wordBits] of [[64, 64], [64, 32], [32, 32], [32, 64]])
	{
		const directory = join(root, `${integerBits}-${wordBits}`), files = sources({ integerBits, wordBits });
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
			assert.ok(observation.checks >= 150); assert.ok(observation.rejections >= 60);
			assert.equal(observation.compiledLean, false); assert.equal(observation.installedPackage, false);
			assert.equal(observation.integerBits, integerBits); assert.equal(observation.wordBits, wordBits);
			observations.push({ mode, observation, probeSha256: sha256(probe)
				, sourceHashes: Object.fromEntries(Object.entries(files).map(([path, contents]) => [path, sha256(contents)])) });
		}
	}
	await saveLakeFile("build/owned", "php-values.json", canonicalJson({ schemaVersion: 1
		, observations, phpSha256: sha256(await readFile(php))
		, phpVersion: (await runCopied(php, ["-n", "-v"], root)).stdout }));
});

test("owned PHP values execute in the actual 32-bit PHP-Wasm interpreter", {
	skip: process.env.LEAN_BRIDGE_OWNED_PHP_WASM_VALUES_TEST !== "1"
	, timeout: 180000
}, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-owned-php-wasm-values-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const phpHost = process.env.LEAN_BRIDGE_PHP_WASM_HOST ?? join(process.cwd(), "build/php-wasm-host/node_modules/php-wasm");
	const generated = sources({ integerBits: 32, wordBits: 32 }), files = { ...generated, ...bundledBrickMath() };
	for(const [path, source] of Object.entries(files)) await saveLakeFile(root, path, source);
	const source = (await readFile("tests/fixtures/structured-types/owned-php-values.php", "utf8"))
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
		assert.ok(observation.checks >= 150); assert.ok(observation.rejections >= 60);
		assert.equal(observation.compiledLean, false); assert.equal(observation.installedPackage, false);
		observations.push({ mode, observation, binaries, probeSha256: sha256(probe), hostSha256: sha256(host) });
	}
	await saveLakeFile("build/owned", "php-wasm-values.json", canonicalJson({ schemaVersion: 1
		, observations
		, sourceHashes: Object.fromEntries(Object.entries(generated).map(([path, source]) => [path, sha256(source)]))
		, hostPackageSha256: sha256(await readFile(join(phpHost, "package.json"))) }));
});
