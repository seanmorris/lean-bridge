/**
 * Installed original gems, independent constructor checks and scoped fault probes.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { readTypeSurface, typeSurfaceCells } from "../src/adoption/type-surface.mjs";
import { rubyVariantReviewedIr, rubyVariantSignatures } from "./helpers/ruby-variant-fixture.mjs";
import { assertRubyVariantSourceHash } from "./helpers/ruby-source-history.mjs";

test("Ruby variant evidence binds original gems to both source paths and independent probes", async () => {
	const record = JSON.parse(await readFile("docs/evidence/ruby-variants-20260921.json"));
	assert.equal(record.schemaVersion, 1); assert.equal(record.wordBits, 64); assert.deepEqual(record.profiles, ["ruby"]);
	assert.equal(record.reportSha256, sha256(canonicalJson({ schemaVersion: 1, reports: record.executions })));
	for(const [path, hash] of Object.entries(record.sourceHashes)) assertRubyVariantSourceHash(path, await readFile(path), hash);
	assert.deepEqual(record.signatures, rubyVariantSignatures); assert.deepEqual(record.types, rubyVariantReviewedIr().types);
	assert.equal(record.reviewedIrSha256, sha256(canonicalJson(rubyVariantReviewedIr())));
	assert.equal(record.types.filter(type => type.kind === "variant").length, 7);
	assert.equal(record.types.flatMap(type => type.cases).length, 18);
	assert.deepEqual(record.executions.map(run => run.path), ["ordinary-source", "reviewed-ir"]);
	for(const run of record.executions)
	{
		assert.equal(run.profile, "ruby"); assert.equal(run.checks, 35904); assert.equal(run.calls, 4410); assert.equal(run.rejected, 81);
		assert.match(run.ruby, /^ruby 3\.3\.12 /);
		assert.equal(run.consumerSha256, record.sourceHashes["tests/fixtures/variant-consumers/ruby.rb"]);
		assert.equal(run.probeSha256, record.sourceHashes["tests/fixtures/variant-consumers/ruby-faults.rb"]);
		for(const key of ["offlineInstall", "compilerFreeExecution", "sourceRemovedBeforeInstallation", "relocatedInstallation", "gemCacheRemoved", "producerHandoffRemoved", "publicApiOnly", "repeatExecution", "installedFilesUnchanged", "isolatedInMemoryFaultProbe"]) assert.equal(run[key], true, key);
		for(const key of ["bindingIrSha256", "sourceTreeSha256", "sourceApiSha256", "modelSha256", "receiptSha256", "installedReceiptSha256", "rubySha256"]) assert.match(run[key], /^[a-f0-9]{64}$/);
		assert.equal(Object.keys(run.installedFiles).length, 24);
		assert.ok(run.installedFiles["lib/lean_bridge/variants.rb"]);
		assert.ok(run.installedFiles["lib/lean_bridge/variants/native.rb"]);
		assert.equal(Object.keys(run.nativeLibraries).length, 4);
		for(const [path, hash] of Object.entries(run.nativeLibraries)) assert.equal(run.installedFiles[path].sha256, hash);
		assert.equal(run.packages.length, 1); const pkg = run.packages[0];
		assert.equal(pkg.target, "rubygems"); assert.equal(pkg.name, "variants-api"); assert.equal(pkg.version, "1.0.0");
		assert.equal(pkg.runtimeDelivery, "embedded"); assert.deepEqual(pkg.requires, []); assert.equal(pkg.artifacts.length, 1);
		assert.equal(pkg.artifacts[0].path, "archives/variants-api-1.0.0-x86_64-linux.gem");
		assert.match(pkg.artifacts[0].sha256, /^[a-f0-9]{64}$/); assert.ok(pkg.artifacts[0].bytes > 0);
		assert.deepEqual(run.faults, { checks: 315, constructor_probes: 22, conversion_methods: 66, inactive_cases: 6, layouts: 13, malformed_tags: 7, partial_inputs: 64 });
		const native = run.nativeFaults;
		assert.equal(native.checks, 1182); assert.equal(native.allocationFailures, 242); assert.equal(native.rejected, 70); assert.equal(native.malformedNativeTags, 1);
		assert.equal(native.syntheticTagInjection, true); assert.equal(native.realLeanExecution, true);
		assert.equal(native.consumerSha256, record.sourceHashes["tests/fixtures/variant-consumers/native-probe.c"]);
		assert.deepEqual(native.sanitizers, ["address", "leak", "undefined"]);
		assert.equal(native.startupLeakBaseline.unchangedAfterConversions, true);
		assert.equal(native.startupLeakBaseline.bytes, 128); assert.equal(native.startupLeakBaseline.allocations, 12);
	}
	assert.deepEqual(record.executions[0].nativeLibraries, record.executions[1].nativeLibraries);
	assert.equal(record.reproduction.paths, 2); assert.equal(record.reproduction.archivesIdentical, true); assert.equal(record.reproduction.installedFilesIdentical, true);
	assert.match(record.reproduction.firstReportSha256, /^[a-f0-9]{64}$/);
	const source = await readFile("tests/fixtures/variant-consumers/ruby.rb", "utf8");
	assert.doesNotMatch(source, /Fiddle|const_get\(:Native|lean_obj_tag|lean_ctor_get/);
});

test("Ruby variants promote only six copied cells and require installed CI receipts", async () => {
	const { document, ...contracts } = await readTypeSurface();
	const cells = typeSurfaceCells(document, contracts).filter(cell => cell.stages.installedExecution.evidence.includes("ruby-variants-installed"));
	assert.equal(cells.length, 6);
	for(const cell of cells)
	{
		assert.equal(cell.profile, "ruby"); assert.equal(cell.shape, "variant"); assert.ok(["parameter", "result", "field"].includes(cell.position));
		for(const stage of Object.values(cell.stages))
		{ assert.equal(stage.state, "passed"); assert.deepEqual(stage.evidence, ["ruby-variants-installed"]); }
	}
	const workflow = await readFile(".github/workflows/consumer-matrix.yml", "utf8");
	assert.match(workflow, /LEAN_BRIDGE_RUBY_VARIANT_TEST=1 node --test tests\/ruby-variants\.test\.mjs/);
	assert.match(workflow, /test -s build\/variants\/ruby\.json/);
	assert.match(workflow, /path: \|[^]*?build\/variants\/ruby\.json/);
});
