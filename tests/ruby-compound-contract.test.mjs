/**
 * Ruby branch semantics, independently checked C layouts and generated syntax.
 *
 * @file
 */
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { compileCopiedRubyModel } from "../src/backends/ruby/copied-model.mjs";
import { generateCopiedRubyPackage } from "../src/backends/ruby/copied-values.mjs";
import { generateRubyBindingPackage } from "../src/backends/ruby/generate.mjs";
import { auditManagedBindingPackage } from "../src/backends/managed/package-audit.mjs";
import { compoundReviewedIr, compoundSignatures } from "./helpers/compound-fixture.mjs";
import { assertCompoundSourceHash } from "./helpers/compound-source-history.mjs";
import { callableReviewedIr } from "./helpers/callable-fixture.mjs";
import { runCopied } from "./helpers/copied-fixture-install.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";

test("Ruby compounds preserve presence, distinct branches and binary products", () => {
	const ir = compoundReviewedIr(), model = compileCopiedRubyModel(ir), files = generateCopiedRubyPackage(ir);
	assert.equal(model.surface.functions.length, 64);
	assert.deepEqual(files, generateCopiedRubyPackage(structuredClone(ir)));
	assert.deepEqual(files, generateRubyBindingPackage(ir));
	assert.equal(auditManagedBindingPackage(ir, files, "ruby").publicFiles.length, 1);
	const source = files["lib/lean_bridge/compounds.rb"], native = files["lib/lean_bridge/compounds/native.rb"];
	for(const name of ["Some", "Ok", "Err"]) assert.ok(source.includes(`${name} = ::Data.define(:value)`));
	assert.match(source, /def next\(arg0\)/); assert.doesNotMatch(source, /Fiddle|Pointer|dispatch/);
	const copy = field => model.surface.copy(model.surface.functions.find(fn => fn.field === field).declaration.result.type);
	for(const [field, size, offsets] of [["option_unit", 2, [1]], ["option_uint64", 16, [8]], ["option_string", 40, [8]], ["result_string", 72, [8, 40]], ["tuple_string", 64, [0, 32]]])
	{
		assert.equal(copy(field).size, size, field); assert.deepEqual(copy(field).fields.map(field => field.offset), offsets);
	}
	assert.match(native, /Invalid native Option flag/); assert.match(native, /Invalid native Except flag/);
	assert.match(native, /exact\?\(value, ::Array\)/); assert.match(native, /unless ARRAY_LENGTH\.bind_call\(value\) == 2/);
	assert.match(native, /payload = data_payload\(value\)/);
	const simple = generateCopiedRubyPackage(callableReviewedIr());
	assert.doesNotMatch(simple["lib/lean_bridge/callables.rb"], /::Data\.define/);
});

for(const name of ["Some", "Ok", "Err"]) test(`Ruby compound ${name} cannot collide with a record or component`, () => {
	const ir = compoundReviewedIr(); ir.types.find(type => type.kind === "record").name = name;
	assert.throws(() => compileCopiedRubyModel(ir), /record name collides/);
	const component = compoundReviewedIr(); component.component.id = `${name.toLowerCase()}@1.0.0`; component.component.name = name.toLowerCase();
	assert.throws(() => compileCopiedRubyModel(component), /component name collides/);
});

test("Ruby compounds admit copied callbacks but reject borrowed identity and keyword fields", () => {
	const ir = callableReviewedIr();
	ir.types[0].callable.result.type = { kind: "apply", constructor: "option", arguments: [{ kind: "primitive", name: "unit" }] };
	const model = compileCopiedRubyModel(ir);
	assert.equal(model.surface.copy(ir.types[0].callable.result.type).compound, "option");
	const borrowed = compoundReviewedIr(); borrowed.declarations[0].parameters[0].ownership = "borrow";
	assert.throws(() => compileCopiedRubyModel(borrowed), /copy ownership/);
	const field = compoundReviewedIr(); field.types.find(type => type.kind === "record").fields[0].name = "next";
	assert.throws(() => compileCopiedRubyModel(field), /record field name collides/);
});

const ruby = process.env.LEAN_BRIDGE_RUBY ?? resolve(".toolchains/ruby33/bin/ruby");
test("Ruby compound evidence binds both source paths to unchanged relocated gems", async () => {
	const record = JSON.parse(await readFile("docs/evidence/ruby-compounds-20260920.json"));
	assert.equal(record.wordBits, 64); assert.equal(record.ruby, "3.3.12");
	assert.deepEqual(record.signatures, compoundSignatures);
	assert.deepEqual(record.executions.map(run => run.path), ["ordinary-source", "reviewed-ir"]);
	for(const [path, hash] of Object.entries(record.sourceHashes)) assertCompoundSourceHash(path, await readFile(path), hash);
	for(const run of record.executions)
	{
		assert.equal(run.profile, "ruby"); assert.equal(run.checks, 38664);
		assert.equal(run.consumerSha256, record.sourceHashes["tests/fixtures/compound-consumers/ruby.rb"]);
		assert.equal(run.probeSha256, record.sourceHashes["tests/fixtures/compound-consumers/ruby-faults.rb"]);
		for(const key of ["sourceRemovedBeforeInstallation", "offlineInstall", "compilerFreeExecution", "relocatedInstallation", "producerHandoffRemoved", "publicApiOnly", "repeatExecution", "installedFilesUnchanged", "isolatedInMemoryFaultProbe"]) assert.equal(run[key], true, key);
		for(const key of ["bindingIrSha256", "sourceTreeSha256", "modelSha256", "receiptSha256", "installedReceiptSha256", "rubySha256"]) assert.match(run[key], /^[a-f0-9]{64}$/);
		assert.deepEqual(run.faults, { checks: 199, conversion_probes: 250, flags: 9, partial_inputs: 16 });
		assert.deepEqual(run.nativeLibraries, Object.fromEntries(Object.entries(run.installedFiles).filter(([path]) => path.endsWith(".so")).map(([path, file]) => [path, file.sha256])));
		assert.ok(run.installedFiles["lib/lean_bridge/compounds.rb"]);
		assert.equal(run.packages.length, 1); assert.equal(run.packages[0].ecosystem, "rubygems");
	}
});

test("generated Ruby compounds and independent consumers pass Ruby syntax checks", { skip: !existsSync(ruby) }, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-ruby-compound-contract-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	for(const [path, content] of Object.entries(generateCopiedRubyPackage(compoundReviewedIr())).filter(([path]) => path.endsWith(".rb")))
	{
		await saveLakeFile(root, path, content); await runCopied(ruby, ["-wc", path], root);
	}
	for(const path of ["ruby", "ruby-faults"]) await runCopied(ruby, ["-wc", resolve(`tests/fixtures/compound-consumers/${path}.rb`)], root);
});
