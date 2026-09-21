/**
 * Alias metadata, wasm32 representations and typed Zend generation contracts.
 *
 * @file
 */
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { sha256 } from "../src/capsule/node.mjs";
import { compileCopiedPhpModel } from "../src/backends/php/copied-model.mjs";
import { generateCopiedPhpZendAdapter } from "../src/backends/php/copied-zend.mjs";
import { phpAliasReadme } from "../src/backends/php/copied-aliases.mjs";
import { nativeAliasReviewedIr } from "./helpers/native-alias-fixture.mjs";
import { phpWasmAliasCatalog, checkPhpWasmAliasFiles } from "./helpers/php-wasm-alias-fixture.mjs";
import { zendAliasFaultIr } from "./helpers/php-wasm-alias-faults.mjs";
import { callableReviewedIr } from "./helpers/callable-fixture.mjs";
import { listReviewedIr } from "./helpers/list-fixture.mjs";
import { runCopied } from "./helpers/copied-fixture-install.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";

test("wasm32 Zend alias metadata retains all 27 independent names and target mappings", () => {
	const ir = nativeAliasReviewedIr(), files = generateCopiedPhpZendAdapter(ir);
	assert.deepEqual(files, generateCopiedPhpZendAdapter(structuredClone(ir)));
	assert.deepEqual(checkPhpWasmAliasFiles(files).aliases, phpWasmAliasCatalog);
	const reordered = structuredClone(ir); reordered.types.reverse();
	assert.deepEqual(checkPhpWasmAliasFiles(generateCopiedPhpZendAdapter(reordered)).aliases, phpWasmAliasCatalog);
	const api = files["src/Api.php"];
	assert.match(api, /@param \\Brick\\Math\\BigInteger \$value0\n \* @lean-bridge-param Count \$value0/);
	assert.match(api, /@lean-bridge-return OtherCount/);
	assert.match(api, /@var list<list<\\Brick\\Math\\BigInteger>>\n {5}\* @lean-bridge-contract Rows/);
	assert.doesNotMatch(api, /\bFFI\b|CData|lean_ctor_|lean_obj_tag/);
	const manifest = JSON.parse(files["copied-zend-manifest.json"]);
	for(const [path, identity] of Object.entries(manifest.files))
	{
		assert.equal(sha256(files[path]), identity.sha256, path);
		assert.equal(Buffer.byteLength(files[path]), identity.bytes, path);
	}
	const readme = phpAliasReadme(compileCopiedPhpModel(ir, { integerBits: 32, lists: true }));
	for(const alias of phpWasmAliasCatalog) assert.ok(readme.includes(`| \`${alias.name}\` |`));
	assert.match(readme, /no PHP wrapper classes or runtime type aliases/);
});

test("alias-free Zend adapters acquire no alias metadata or public declarations", () => {
	for(const ir of [callableReviewedIr(), listReviewedIr()])
	{
		const files = generateCopiedPhpZendAdapter(ir);
		assert.equal(JSON.parse(files["copied-zend-manifest.json"]).aliases, undefined);
		assert.doesNotMatch(files["src/Api.php"], /@lean-bridge-|Copied Lean aliases/);
	}
});

test("wasm32 aliases retain target ownership, cycle and depth admission checks", () => {
	for(const change of [
		ir => { ir.declarations[0].parameters[0].ownership = "borrow"; }
		, ir => { ir.types.find(type => type.name === "Count").representation = "identity"; }
		, ir => { ir.types.find(type => type.name === "Count").mutability = "mutable"; }
		, ir => { ir.types.find(type => type.name === "Count").target = { kind: "named", id: "lean:Aliases.Count" }; }
		, ir => { ir.types.find(type => type.name === "Count").name = "Count\n*/ injected <?php"; }
	]) {
		const ir = nativeAliasReviewedIr(); change(ir);
		assert.throws(() => generateCopiedPhpZendAdapter(ir));
	}
	const ir = nativeAliasReviewedIr(), alias = ir.types.find(type => type.name === "Rows");
	for(let i = 0; i < 33; i++) alias.target = { kind: "apply", constructor: "list", arguments: [alias.target] };
	assert.throws(() => generateCopiedPhpZendAdapter(ir), /depth|deep/i);
});

test("the synthetic alias cleanup probe wraps original sites, nested fields and chains", () => {
	const ir = zendAliasFaultIr(), files = generateCopiedPhpZendAdapter(ir);
	const manifest = JSON.parse(files["copied-zend-manifest.json"]);
	const aliases = ir.types.filter(type => type.kind === "alias");
	assert.equal(manifest.aliases.length, aliases.length); assert.ok(aliases.length > 15);
	assert.ok(aliases.some(alias => alias.target.kind === "named" && aliases.some(other => other.id === alias.target.id)));
	for(const fn of ir.declarations) for(const site of [...fn.parameters, fn.result]) assert.ok(aliases.some(alias => alias.id === site.type.id));
	for(const field of ir.types.find(type => type.kind === "record").fields) assert.ok(aliases.some(alias => alias.id === field.type.id));
	assert.match(files["src/Api.php"], /@lean-bridge-param Copied/);
});

const php = process.env.LEAN_BRIDGE_PHP ?? "/usr/bin/php";
test("PHP-Wasm alias sources compile against the pinned wasm32 Zend headers", { skip: !existsSync(php) }, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-php-wasm-alias-syntax-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const files = generateCopiedPhpZendAdapter(nativeAliasReviewedIr());
	for(const [path, source] of Object.entries(files))
	{
		await saveLakeFile(root, path, source);
		if(path.endsWith(".php")) await runCopied(php, ["-n", "-l", path], root);
	}
	await runCopied(php, ["-n", "-l", resolve("tests/fixtures/alias-consumers/php-wasm.php")], root);
	const emcc = resolve(".toolchains/emsdk-php-wasm/upstream/emscripten/emcc"), sdk = resolve("build/php-wasm-sdk/php8.4-src");
	if(existsSync(emcc) && existsSync(sdk))
	{
		const manifest = JSON.parse(files["copied-zend-manifest.json"]);
		await runCopied(emcc, ["-fsyntax-only", "-Wall", "-Wextra", "-Werror"
			, "-Wno-unused-function", "-Wno-unused-parameter", "-Wno-type-limits"
			, ...[sdk, ...["Zend", "main", "TSRM", "ext"].map(path => join(sdk, path)), join(root, "include")].flatMap(path => ["-I", path])
			, `extension/${manifest.extension}.c`], root, process.env);
	}
});
