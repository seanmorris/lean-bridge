/**
 * Ruby List identity, checked arrays and bounded copied conversions.
 *
 * @file
 */
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { sha256 } from "../src/capsule/node.mjs";
import { compileCopiedRubyModel } from "../src/backends/ruby/copied-model.mjs";
import { generateCopiedRubyPackage } from "../src/backends/ruby/copied-values.mjs";
import { generateRubyBindingPackage } from "../src/backends/ruby/generate.mjs";
import { auditManagedBindingPackage } from "../src/backends/managed/package-audit.mjs";
import { listReviewedIr, listSignatures } from "./helpers/list-fixture.mjs";
import { callableReviewedIr } from "./helpers/callable-fixture.mjs";
import { runCopied } from "./helpers/copied-fixture-install.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";

test("Ruby List evidence binds both source paths to unchanged relocated gems", async () => {
	const record = JSON.parse(await readFile("docs/evidence/ruby-lists-20260921.json"));
	assert.equal(record.wordBits, 64); assert.equal(record.ruby, "3.3.12");
	assert.deepEqual(record.signatures, listSignatures);
	assert.deepEqual(record.executions.map(run => run.path), ["ordinary-source", "reviewed-ir"]);
	for(const [path, hash] of Object.entries(record.sourceHashes)) assert.equal(sha256(await readFile(path)), hash, path);
	for(const run of record.executions)
	{
		assert.equal(run.profile, "ruby"); assert.equal(run.checks, 88446);
		assert.equal(run.consumerSha256, record.sourceHashes["tests/fixtures/list-consumers/ruby.rb"]);
		assert.equal(run.probeSha256, record.sourceHashes["tests/fixtures/list-consumers/ruby-faults.rb"]);
		for(const key of ["sourceRemovedBeforeInstallation", "offlineInstall", "compilerFreeExecution", "relocatedInstallation", "producerHandoffRemoved", "publicApiOnly", "repeatExecution", "installedFilesUnchanged", "isolatedInMemoryFaultProbe"]) assert.equal(run[key], true, key);
		for(const key of ["bindingIrSha256", "sourceTreeSha256", "modelSha256", "receiptSha256", "installedReceiptSha256", "rubySha256"]) assert.match(run[key], /^[a-f0-9]{64}$/);
		assert.deepEqual(run.faults, { checks: 384, conversion_probes: 156, layouts: 9, partial_inputs: 16 });
		assert.deepEqual(run.nativeLibraries, Object.fromEntries(Object.entries(run.installedFiles).filter(([path]) => path.endsWith(".so")).map(([path, file]) => [path, file.sha256])));
		assert.ok(run.installedFiles["lib/lean_bridge/lists.rb"]);
		assert.equal(run.packages.length, 1); assert.equal(run.packages[0].ecosystem, "rubygems");
	}
});

test("Ruby Lists use checked owned arrays with distinct List/Array native identities", () => {
	const ir = listReviewedIr(), model = compileCopiedRubyModel(ir), files = generateCopiedRubyPackage(ir);
	assert.equal(model.surface.functions.length, 27);
	assert.deepEqual(files, generateCopiedRubyPackage(structuredClone(ir)));
	assert.deepEqual(files, generateRubyBindingPackage(ir));
	assert.equal(auditManagedBindingPackage(ir, files, "ruby").publicFiles.length, 1);
	const source = files["lib/lean_bridge/lists.rb"], native = files["lib/lean_bridge/lists/native.rb"];
	assert.match(source, /def reverse_uint32\(arg0\)/); assert.match(source, /def mix\(arg0\)/);
	assert.doesNotMatch(source, /Fiddle|Pointer|dispatch/);
	assert.match(native, /value\.instance_of\?\(::Array\)/);
	assert.match(native, /count > \(16 \* 1024 \* 1024\) \/ 8/);
	assert.match(native, /data.zero\? \|\| data % 4 != 0/);
	assert.match(native, /CLEAR\d+\.call\(output\)/);
	const word = { kind: "primitive", name: "uint32" };
	const list = model.surface.copy({ kind: "apply", constructor: "list", arguments: [word] });
	const array = model.surface.copy({ kind: "apply", constructor: "array", arguments: [word] });
	assert.notEqual(list.name, array.name); assert.equal(list.size, array.size);
	assert.match(files["README.md"], /Lean List inputs, results and record fields use copied Ruby Array values/);
});

test("Ruby Lists reject borrowed identities, compound callbacks and record name collisions", () => {
	for(const position of ["parameter", "result"])
	{
		const ir = callableReviewedIr(), callback = ir.types.find(type => type.kind === "callback");
		const list = { kind: "apply", constructor: "list", arguments: [{ kind: "primitive", name: "uint32" }] };
		if(position === "parameter") callback.callable.parameters[0].type = list;
		else callback.callable.result.type = list;
		assert.throws(() => compileCopiedRubyModel(ir), /callbacks currently require copied primitive/);
	}
	const borrowed = listReviewedIr(); borrowed.declarations[0].parameters[0].ownership = "borrow";
	assert.throws(() => compileCopiedRubyModel(borrowed), /copy ownership/);
	const collision = listReviewedIr(); collision.types[0].name = "Some";
	assert.throws(() => compileCopiedRubyModel(collision), /record name collides/);
});

test("Ruby List output guards use native scalar and compound alignment before allocation", () => {
	const ir = listReviewedIr(), model = compileCopiedRubyModel(ir);
	const native = generateCopiedRubyPackage(ir)["lib/lean_bridge/lists/native.rb"];
	const alignments = {
		unit: 1, bool: 1, uint8: 1, int8: 1, uint16: 2, int16: 2
		, uint32: 4, int32: 4, float32: 4, char: 4
		, uint64: 8, int64: 8, float64: 8, nat: 8, int: 8, string: 8, bytes: 8
	};
	for(const [name, alignment] of Object.entries(alignments))
	{
		const fn = model.surface.functions.find(fn => fn.field === `reverse_${name}`), copy = model.surface.copy(fn.declaration.result.type);
		const body = native.split(`def from${copy.index}(value)`)[1].split("\n      end")[0];
		assert.ok(body.indexOf("count >") < body.indexOf("::Array.new"));
		assert.ok(body.includes(`data % ${alignment} != 0`), name);
	}
	const pairs = model.surface.copies.find(copy => copy.element?.compound === "tuple");
	const body = native.split(`def from${pairs.index}(value)`)[1].split("\n      end")[0];
	assert.ok(body.includes("data % 4 != 0"), "a Bool/Char product aligns to four bytes");
});

const ruby = process.env.LEAN_BRIDGE_RUBY ?? resolve(".toolchains/ruby33/bin/ruby");
test("generated Ruby Lists and independent consumers pass Ruby syntax checks", { skip: !existsSync(ruby) }, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-ruby-list-contract-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	for(const [path, content] of Object.entries(generateCopiedRubyPackage(listReviewedIr())).filter(([path]) => path.endsWith(".rb")))
	{
		await saveLakeFile(root, path, content); await runCopied(ruby, ["-wc", path], root);
	}
	for(const path of ["ruby", "ruby-faults"]) await runCopied(ruby, ["-wc", resolve(`tests/fixtures/list-consumers/${path}.rb`)], root);
});
