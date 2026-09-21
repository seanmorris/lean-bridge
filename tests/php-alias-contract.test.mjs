/**
 * Transparent PHP alias contracts, source documentation and target admission.
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
import { generateCopiedPhpPackage } from "../src/backends/php/copied-values.mjs";
import { generatePhpBindingPackage } from "../src/backends/php/generate.mjs";
import { auditPhpPackage } from "../src/backends/php/package-audit.mjs";
import { generateCopiedPhpZendAdapter } from "../src/backends/php/copied-zend.mjs";
import { phpCopiedAliases } from "../src/backends/php/copied-aliases.mjs";
import { nativeAliasReviewedIr } from "./helpers/native-alias-fixture.mjs";
import { checkPhpAliasFiles, phpAliasCatalog } from "./helpers/php-alias-fixture.mjs";
import { callableReviewedIr } from "./helpers/callable-fixture.mjs";
import { listReviewedIr } from "./helpers/list-fixture.mjs";
import { runCopied } from "./helpers/copied-fixture-install.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";

test("PHP aliases retain all 27 independent contracts at public API sites", () => {
	const ir = nativeAliasReviewedIr(), files = generateCopiedPhpPackage(ir);
	assert.deepEqual(files, generateCopiedPhpPackage(structuredClone(ir)));
	assert.deepEqual(files, generatePhpBindingPackage(ir));
	assert.deepEqual(checkPhpAliasFiles(files).aliases, phpAliasCatalog);
	const reordered = structuredClone(ir); reordered.types.reverse();
	assert.deepEqual(checkPhpAliasFiles(generateCopiedPhpPackage(reordered)).aliases, phpAliasCatalog);
	assert.match(files["src/Api.php"], /@param int \$value0\n \* @lean-bridge-param Count \$value0/);
	assert.match(files["src/Api.php"], /@return int\n \* @lean-bridge-return OtherCount/);
	assert.match(files["src/Api.php"], /@var list<list<int>>\n {5}\* @lean-bridge-contract Rows/);
	assert.doesNotMatch(files["src/Api.php"], /\bFFI\b|CData|lean_ctor_/);
	assert.match(files["README.md"], /no PHP wrapper classes or runtime type aliases/);
	const manifest = JSON.parse(files["binding-manifest.json"]);
	for(const [path, hash] of Object.entries(manifest.filesSha256)) assert.equal(sha256(files[path]), hash, path);
});

test("PHP alias catalogs respect the transport integer width", () => {
	const ir = nativeAliasReviewedIr();
	assert.deepEqual(phpCopiedAliases(compileCopiedPhpModel(ir, { lists: true })), phpAliasCatalog);
	const expected = { AU32: "\\Brick\\Math\\BigInteger"
		, AI64: "\\Brick\\Math\\BigInteger"
		, Count: "\\Brick\\Math\\BigInteger", OtherCount: "\\Brick\\Math\\BigInteger"
		, Rows: "list<list<\\Brick\\Math\\BigInteger>>"
		, Outcome: "Ok<array{\\Brick\\Math\\BigInteger, Bytes}>|Err<string>" };
	const wasm = phpCopiedAliases(compileCopiedPhpModel(ir, { integerBits: 32, lists: true }));
	assert.deepEqual(wasm, phpAliasCatalog.map(alias => ({ ...alias, phpType: expected[alias.name] ?? alias.phpType })));
	const zend = generateCopiedPhpZendAdapter(ir)["src/Api.php"];
	assert.match(zend, /Count = AU32; PHP: \\Brick\\Math\\BigInteger/);
	assert.match(zend, /@lean-bridge-param Count \$value0/);
});

test("PHP audits bind alias metadata and distinguish documentation from declarations", () => {
	const ir = nativeAliasReviewedIr(), files = generatePhpBindingPackage(ir);
	for(const change of [
		manifest => { delete manifest.aliases; }
		, manifest => { manifest.aliases[0].name = "Renamed"; }
		, manifest => { manifest.aliases[0].target = { kind: "primitive", name: "uint32" }; }
		, manifest => { manifest.aliases[0].phpType = "int"; }
	]) {
		const manifest = JSON.parse(files["binding-manifest.json"]); change(manifest);
		assert.throws(() => auditPhpPackage(ir, { ...files, "binding-manifest.json": JSON.stringify(manifest) }), { code: "copied-surface-drift" });
	}
	for(const name of ["Pointer", "Handle", "WebAssembly", "ccall"])
	{
		const named = nativeAliasReviewedIr(); named.types.find(type => type.name === "ANat").name = name;
		const rendered = generatePhpBindingPackage(named);
		assert.ok(rendered["src/Api.php"].includes(` * ${name} = nat;`));
		assert.throws(() => auditPhpPackage(named, { ...rendered, "src/Api.php": rendered["src/Api.php"] + "\nfunction pointer() {}\n" }), { code: "copied-surface-drift" });
	}
	assert.throws(() => generatePhpBindingPackage(ir, { integerBits: 32 }), { code: "unsupported-copied-php-profile" });
});

test("transparent PHP aliases leave target converters unchanged", () => {
	const ir = nativeAliasReviewedIr();
	const target = ref => ref.kind === "named" && ir.types.find(type => type.id === ref.id).kind === "alias"
		? target(ir.types.find(type => type.id === ref.id).target)
		: ref.kind === "apply" ? { ...ref, arguments: ref.arguments.map(target) } : ref;
	const plain = structuredClone(ir);
	plain.types = plain.types.filter(type => type.kind !== "alias");
	for(const type of plain.types) for(const field of type.fields) field.type = target(field.type);
	for(const fn of plain.declarations) for(const site of [...fn.parameters, fn.result]) site.type = target(site.type);
	const files = generateCopiedPhpPackage(ir), raw = generateCopiedPhpPackage(plain);
	assert.equal(files["src/Internal/Native.php"], raw["src/Internal/Native.php"]);
	assert.equal(files["src/Internal/Runtime.php"], raw["src/Internal/Runtime.php"]);
});

test("PHP alias admission keeps ownership, identity, recursion and depth boundaries", () => {
	for(const change of [
		ir => { ir.declarations[0].parameters[0].ownership = "borrow"; }
		, ir => { ir.types.find(type => type.name === "Count").mutability = "mutable"; }
		, ir => { ir.types.find(type => type.name === "Count").representation = "identity"; }
		, ir => { ir.types.find(type => type.name === "Count").target = { kind: "named", id: "lean:Aliases.Count" }; }
		, ir => { ir.types.find(type => type.name === "Count").name = "Count\n*/ throw new Error(); /*"; }
	]) {
		const ir = nativeAliasReviewedIr(); change(ir);
		assert.throws(() => compileCopiedPhpModel(ir, { lists: true }));
	}
	const ir = nativeAliasReviewedIr(), alias = ir.types.find(type => type.name === "Rows");
	for(let i = 0; i < 33; i++) alias.target = { kind: "apply", constructor: "list", arguments: [alias.target] };
	assert.throws(() => compileCopiedPhpModel(ir, { lists: true }), /depth|deep/i);
});

test("alias-free PHP packages acquire no alias metadata or documentation", () => {
	for(const ir of [callableReviewedIr(), listReviewedIr()])
	{
		const files = generateCopiedPhpPackage(ir);
		assert.equal(JSON.parse(files["binding-manifest.json"]).aliases, undefined);
		assert.doesNotMatch(files["README.md"], /Copied Lean aliases/);
		assert.doesNotMatch(files["src/Api.php"], /@lean-bridge-|Copied Lean aliases/);
	}
});

const php = process.env.LEAN_BRIDGE_PHP ?? "/usr/bin/php";
test("generated PHP alias bindings and independent consumers pass syntax checks", { skip: !existsSync(php) }, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-php-alias-contract-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	for(const [path, source] of Object.entries(generateCopiedPhpPackage(nativeAliasReviewedIr())).filter(([path]) => path.endsWith(".php")))
	{
		await saveLakeFile(root, path, source); await runCopied(php, ["-n", "-l", path], root);
	}
	for(const name of ["php", "php-faults"]) await runCopied(php, ["-n", "-l", resolve(`tests/fixtures/alias-consumers/${name}.php`)], root);
});
