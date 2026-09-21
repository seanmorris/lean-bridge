/**
 * Ruby copied-alias contracts, installed evidence and source-level documentation.
 *
 * @file
 */
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { readTypeSurface, typeSurfaceCells } from "../src/adoption/type-surface.mjs";
import { compileCopiedRubyModel } from "../src/backends/ruby/copied-model.mjs";
import { generateCopiedRubyPackage } from "../src/backends/ruby/copied-values.mjs";
import { generateRubyBindingPackage } from "../src/backends/ruby/generate.mjs";
import { auditManagedBindingPackage } from "../src/backends/managed/package-audit.mjs";
import { aliasPrimitives, nativeAliasReviewedIr } from "./helpers/native-alias-fixture.mjs";
import { rubyAliasReviewedIr, rubyAliasSignatures } from "./helpers/ruby-alias-fixture.mjs";
import { checkRubyAliasFiles } from "./helpers/ruby-alias-install.mjs";
import { callableReviewedIr } from "./helpers/callable-fixture.mjs";
import { compoundReviewedIr } from "./helpers/compound-source-fixture.mjs";
import { listReviewedIr } from "./helpers/list-fixture.mjs";
import { runCopied } from "./helpers/copied-fixture-install.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";

test("Ruby alias evidence binds both installed source paths to unchanged relocated gems", async () => {
	const record = JSON.parse(await readFile("docs/evidence/ruby-aliases-20260921.json"));
	assert.equal(record.wordBits, 64); assert.equal(record.ruby, "3.3.12");
	assert.deepEqual(record.primitives, aliasPrimitives); assert.deepEqual(record.signatures, rubyAliasSignatures);
	assert.equal(record.reviewedIrSha256, sha256(canonicalJson(rubyAliasReviewedIr())));
	for(const [path, hash] of Object.entries(record.sourceHashes)) assert.equal(sha256(await readFile(path)), hash, path);
	assert.deepEqual(record.executions.map(run => run.path), ["ordinary-source", "reviewed-ir"]);
	for(const run of record.executions)
	{
		assert.equal(run.profile, "ruby"); assert.equal(run.checks, 4509);
		assert.equal(run.consumerSha256, record.sourceHashes["tests/fixtures/alias-consumers/ruby.rb"]);
		assert.equal(run.probeSha256, record.sourceHashes["tests/fixtures/alias-consumers/ruby-faults.rb"]);
		for(const key of ["sourceRemovedBeforeInstallation", "offlineInstall", "compilerFreeExecution", "relocatedInstallation", "producerHandoffRemoved", "publicApiOnly", "repeatExecution", "installedFilesUnchanged", "isolatedInMemoryFaultProbe"]) assert.equal(run[key], true, key);
		for(const key of ["bindingIrSha256", "sourceTreeSha256", "sourceApiSha256", "modelSha256", "receiptSha256", "installedReceiptSha256", "rubySha256", "contractSha256"]) assert.match(run[key], /^[a-f0-9]{64}$/);
		assert.deepEqual(run.faults, { checks: 317, partial_inputs: 64, layouts: 22, conversion_probes: 56 });
		assert.deepEqual(run.nativeLibraries, Object.fromEntries(Object.entries(run.installedFiles).filter(([path]) => path.endsWith(".so")).map(([path, file]) => [path, file.sha256])));
		assert.deepEqual(run.nativeLibraries, record.executions[0].nativeLibraries);
		assert.deepEqual(run.catalog, checkRubyAliasFiles(generateCopiedRubyPackage(rubyAliasReviewedIr())));
		assert.ok(run.installedFiles["lib/lean_bridge/aliases.rb"]);
		assert.equal(run.packages.length, 1); assert.equal(run.packages[0].ecosystem, "rubygems");
	}
});

test("Ruby alias installed evidence promotes exactly six cells and runs in CI", async () => {
	const { document, ...contracts } = await readTypeSurface();
	const cells = typeSurfaceCells(document, contracts).filter(cell => cell.profile === "ruby" && cell.shape === "alias" && ["parameter", "result", "field"].includes(cell.position));
	assert.equal(cells.length, 6);
	for(const cell of cells) for(const stage of Object.values(cell.stages))
	{ assert.equal(stage.state, "passed"); assert.deepEqual(stage.evidence, ["ruby-aliases-installed"]); }
	const workflow = await readFile(".github/workflows/consumer-matrix.yml", "utf8");
	assert.match(workflow, /LEAN_BRIDGE_RUBY_ALIAS_TEST=1 node --test tests\/ruby-aliases.test.mjs/);
	assert.match(workflow, /test -s build\/aliases\/ruby\.json/);
	assert.match(workflow, /path: \|[^]*?build\/aliases\/ruby\.json/);
});

test("Ruby aliases keep target values and original names at every API site", () => {
	const ir = rubyAliasReviewedIr(), files = generateCopiedRubyPackage(ir);
	assert.deepEqual(files, generateCopiedRubyPackage(structuredClone(ir)));
	assert.deepEqual(files, generateRubyBindingPackage(ir));
	assert.equal(auditManagedBindingPackage(ir, files, "ruby").publicFiles.length, 1);
	assert.equal(checkRubyAliasFiles(files).aliases.length, 27);
	assert.match(files["README.md"], /Nat rejects negative Integer/);
	assert.match(files["README.md"], /do not create Ruby constants, wrapper classes or RBS declarations/);
	const native = files["lib/lean_bridge/aliases/native.rb"];
	assert.match(native, /Nat cannot be negative/); assert.match(native, /Expected UNIT/);
	assert.match(native, /CLEAR\d+\.call\(output\)/);
	const model = compileCopiedRubyModel(ir), count = { kind: "named", id: "lean:Aliases.Count" };
	const list = model.surface.copy({ kind: "apply", constructor: "list", arguments: [count] });
	const array = model.surface.copy({ kind: "apply", constructor: "array", arguments: [list.ref] });
	assert.notEqual(list.name, array.name); assert.equal(list.size, array.size);
});

test("Ruby alias documentation names do not hide or falsely report public FFI declarations", () => {
	for(const name of ["Pointer", "Fiddle", "Closure", "dlopen"])
	{
		const ir = rubyAliasReviewedIr(); ir.types.find(type => type.name === "ANat").name = name;
		const files = generateCopiedRubyPackage(ir), entry = "lib/lean_bridge/aliases.rb";
		assert.ok(files[entry].includes(`# ${name} = nat;`));
		auditManagedBindingPackage(ir, files, "ruby");
		assert.throws(() => auditManagedBindingPackage(ir, { ...files, [entry]: `${files[entry]}\n::Fiddle.dlopen(nil)\n` }, "ruby"), { code: "private-ffi-public" });
		assert.throws(() => auditManagedBindingPackage(ir, { ...files, [entry]: `${files[entry]}\n# comment\r::Fiddle.dlopen(nil)\n` }, "ruby"), { code: "private-ffi-public" });
	}
});

test("Ruby alias admission still rejects ownership changes, cycles and source injection", () => {
	assert.throws(() => compileCopiedRubyModel(nativeAliasReviewedIr()), /function name collides: inspect/);
	const cycle = rubyAliasReviewedIr(); cycle.types.find(type => type.name === "Count").target = { kind: "named", id: "lean:Aliases.Count" };
	assert.throws(() => compileCopiedRubyModel(cycle), /cycle|recursive|alias/i);
	const borrowed = rubyAliasReviewedIr(); borrowed.declarations[0].parameters[0].ownership = "borrow";
	assert.throws(() => compileCopiedRubyModel(borrowed), /copy ownership/);
	const injection = rubyAliasReviewedIr(); injection.types.find(type => type.name === "Count").name = "Count\nraise 'bad'";
	assert.throws(() => compileCopiedRubyModel(injection));
	const mutable = rubyAliasReviewedIr(); mutable.types.find(type => type.name === "Count").mutability = "mutable";
	assert.throws(() => compileCopiedRubyModel(mutable), /immutable|mutab/);
});

test("alias-free Ruby packages do not acquire an alias catalog", () => {
	for(const ir of [callableReviewedIr(), listReviewedIr()])
	{
		const files = generateCopiedRubyPackage(ir);
		assert.equal(JSON.parse(files["binding-manifest.json"]).aliases, undefined);
		assert.doesNotMatch(files["README.md"], /Copied Lean aliases/);
		for(const [name, source] of Object.entries(files).filter(([name]) => name.endsWith(".rb"))) assert.doesNotMatch(source, /# Returns:|# Copied Lean aliases/, name);
	}
	const compound = generateCopiedRubyPackage(compoundReviewedIr());
	assert.deepEqual(JSON.parse(compound["binding-manifest.json"]).aliases.map(alias => alias.name), ["Deep"]);
});

const ruby = process.env.LEAN_BRIDGE_RUBY ?? resolve(".toolchains/ruby33/bin/ruby");
test("generated Ruby alias bindings and independent consumers pass syntax checks", { skip: !existsSync(ruby) }, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-ruby-alias-contract-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	for(const [path, content] of Object.entries(generateCopiedRubyPackage(rubyAliasReviewedIr())).filter(([path]) => path.endsWith(".rb")))
	{
		await saveLakeFile(root, path, content); await runCopied(ruby, ["-wc", path], root);
	}
	for(const path of ["ruby", "ruby-faults"]) await runCopied(ruby, ["-wc", resolve(`tests/fixtures/alias-consumers/${path}.rb`)], root);
});
