/**
 * Public recursive Ruby APIs and original, offline-installed gems.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { readTypeSurface, typeSurfaceCells } from "../src/adoption/type-surface.mjs";
import { generateCopiedRubyGraphPackage, compileCopiedRubyGraphPackageModel, rubyGraphClearSource } from "../src/backends/ruby/copied-graph-package.mjs";
import { generateCopiedRubyPackage } from "../src/backends/ruby/copied-values.mjs";
import { auditManagedBindingPackage } from "../src/backends/managed/package-audit.mjs";
import { compileNativeGraphProjection } from "../src/build/native-graph-projection.mjs";
import { nativeRecursiveReviewedIr } from "./helpers/native-recursive-reviewed.mjs";
import { nativeRecursiveSource } from "./helpers/native-recursive-transport.mjs";
import { collectionReviewedIr } from "./helpers/collection-fixture.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { assertAdministrativeSourceUpdate } from "./helpers/test-registration-history.mjs";
import { assertRubyGraphRegressions } from "./helpers/native-ruby-graph-regression.mjs";

test("recursive Ruby packages expose named functions and keep native loading private", () => {
	const ir = nativeRecursiveReviewedIr(), before = structuredClone(ir);
	const files = generateCopiedRubyGraphPackage(ir), model = compileCopiedRubyGraphPackageModel(ir);
	assert.deepEqual(ir, before); assert.deepEqual(generateCopiedRubyGraphPackage(ir), files);
	const audit = auditManagedBindingPackage(ir, files, "ruby");
	assert.deepEqual(audit.publicFiles, ["lib/lean_bridge/recursive.rb"]);
	const entry = files[audit.publicFiles[0]], native = files["lib/lean_bridge/recursive/native.rb"];
	assert.match(entry, /def forest\(arg0\)/); assert.match(entry, /def word_max\(arg0\)/);
	assert.match(entry, /def empty\(\)/); assert.match(entry, /# arg0: Forest/);
	assert.doesNotMatch(entry, /Fiddle|Pointer|graph_call|\.pack\(|\.unpack/);
	assert.match(native, /NativeCopiedRuntimeV1.context_error/);
	assert.match(native, /clear: CLEAR, lifecycle: LIFECYCLE/);
	assert.match(native, /recursive_ruby_graph_clear/);
	const shared = "lib/lean_bridge/native_copied_runtime_v1.rb";
	assert.equal(files[shared], generateCopiedRubyPackage(collectionReviewedIr())[shared]);
	assert.match(files[shared], /PID = ::Process.pid/); assert.match(files[shared], /Ractor.current.equal\?\(::Ractor.main\)/);
	assert.deepEqual(JSON.parse(files["binding-manifest.json"]).copiedGraph, { schemaVersion: 1, layoutSha256: model.layoutSha256 });
	assert.deepEqual(JSON.parse(files["binding-manifest.json"]).aliases, model.aliases);
	assert.match(files["README.md"], /262,144 nodes/); assert.match(files["README.md"], /ensure block/);
	const clear = rubyGraphClearSource("recursive");
	assert.ok(clear.indexOf("memset(value") < clear.indexOf("owner.release(owner.pointer)"));
	assert.doesNotMatch(clear, /malloc|Fiddle/);
	assert.throws(() => rubyGraphClearSource("escape;"), /Invalid/);
});

test("recursive Ruby admission validates every selected host and protects library names", () => {
	const ir = nativeRecursiveReviewedIr(), model = compileNativeGraphProjection(ir, ["rubygems"]);
	assert.equal(model.prefix, "recursive");
	assert.equal(compileNativeGraphProjection(ir, ["c", "cpp", "cargo", "pypi", "rubygems"]).layoutSha256, model.layoutSha256);
	for(const host of ["maven", "php-native"])
		assert.equal(compileNativeGraphProjection(ir, ["rubygems", host]).layoutSha256, model.layoutSha256);
	for(const targets of [[], ["rubygems", "rubygems"], ["rubygems", "cpan"], ["rubygems", "wit-wasi"]])
		assert.throws(() => compileNativeGraphProjection(ir, targets), { code: "native-graph-projection-unavailable" });
	for(const id of ["gmp", "leanshared", "lean-bridge-native", "a".repeat(160)])
	{
		const invalid = structuredClone(ir); invalid.component.id = `${id}@1.0.0`; invalid.component.name = id;
		assert.throws(() => compileCopiedRubyGraphPackageModel(invalid), /name|dependency|identifier/);
	}
	const invalid = structuredClone(ir); invalid.types.find(type => type.name === "Scalars").name = "Native";
	assert.throws(() => compileNativeGraphProjection(invalid, ["c", "rubygems"]), /reserved|name|collision/);
});

test("prepared recursive Ruby gems install offline and run without the producer", {
	skip: process.env.LEAN_BRIDGE_RUBY_GRAPH_PACKAGE_TEST !== "1"
	, timeout: 1_800_000
}, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-ruby-graph-installed-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const { checkInstalledRubyGraphs } = await import("./helpers/ruby-graph-packages.mjs");
	const report = await checkInstalledRubyGraphs(root, message => t.diagnostic(message));
	assert.deepEqual(report.observations.map(run => run.reviewed), [false, true]);
	await saveLakeFile("build/recursive", "ruby-packages.json", canonicalJson(report));
});

test("downstream CI requires original installed recursive gems and their report", async () => {
	const workflow = await readFile(".github/workflows/consumer-matrix.yml", "utf8");
	assert.ok(workflow.includes("LEAN_BRIDGE_RUBY_GRAPH_PACKAGE_TEST=1 node --test tests/ruby-graph-package.test.mjs"));
	assert.ok(workflow.includes("test -s build/recursive/ruby-packages.json"));
	assert.ok(workflow.includes("            build/recursive/ruby-packages.json\n"));
});

test("recursive Ruby evidence binds original gems, repeat builds and installed failure cleanup", async () => {
	const record = JSON.parse(await readFile("docs/evidence/ruby-recursive-packages-20260923.json"));
	const digest = value => sha256(canonicalJson(value));
	assert.equal(record.schemaVersion, 1); assert.equal(record.planNode, 1219);
	assert.equal(record.installedPackage, true); assert.equal(record.wordBits, 64);
	assert.equal(record.reportSha256, digest(record.report));
	for(const [path, hash] of Object.entries(record.sourceHashes)) await assertAdministrativeSourceUpdate(path, hash);
	for(const log of [record.log, record.reproduction.log])
	{
		assert.equal(log.sha256, sha256(log.text));
		assert.match(log.text, /# pass 4\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0/);
	}
	assert.notEqual(record.log.sha256, record.reproduction.log.sha256);
	const publisher = (await readFile("docs/publish/rubygems.md", "utf8")).split("## Export recursive values\n")[1].split("\n## ")[0];
	assert.match(publisher, /Lake package named `recursive`/);
	assert.match(publisher, /`targets\.rubygems\.name` to `recursive-api` and `version` to `1\.0\.0`/);
	const lean = publisher.match(/```lean\n([^]*?)\n```/)[1];
	assert.ok(lean.startsWith("namespace Recursive\n")); assert.ok(lean.endsWith("\nend Recursive"));
	const declarations = lean.slice("namespace Recursive\n".length, -"\nend Recursive".length).trim().split("\n\n");
	assert.equal(declarations.length, 2);
	const compiledSource = await nativeRecursiveSource();
	for(const declaration of declarations) assert.ok(compiledSource.includes(`\n${declaration}\n`));
	assert.deepEqual(record.report.observations.map(run => run.reviewed), [false, true]);
	for(const run of record.report.observations)
	{
		assert.equal(run.exports, 18); assert.equal(run.rubyOnly, true);
		assert.equal(run.checkedSourceUnchanged, true); assert.equal(run.deterministicReassembly, true);
		assert.equal(run.rejectsGraphReceiptDrift, 3); assert.equal(run.rejectsRegeneratedSourceDrift, 4);
		assert.equal(run.package.target, "rubygems"); assert.equal(run.package.name, "recursive-api");
		assert.equal(run.package.runtimeDelivery, "embedded"); assert.deepEqual(run.package.requires, []);
		assert.deepEqual(run.peers.map(peer => peer.package.name), ["recursive-peer-api", "graph-names-api"]);
		assert.ok(run.peers.every(peer => peer.package.runtimeIdentity === run.package.runtimeIdentity));
		const old = record.reproduction.runs.find(item => item.reviewed === run.reviewed);
		for(const key of ["package", "peers", "binarySha256", "layoutSha256"]) assert.deepEqual(run[key], old[key], key);
		const installed = run.installed;
		for(const key of ["public", "faults", "composition", "installedPackages"])
			assert.equal(digest(installed[key]), old.installed[`${key}Sha256`], key);
		// The final run also executes the newly documented caller. Existing
		// probes and original archives must still match the first full build.
		const { "documentation.rb": documentedHash, ...originalSources } = installed.sourceHashes;
		assert.equal(digest(originalSources), old.installed.sourceHashesSha256);
		assert.deepEqual(installed.public, { checks: 179, functions: 18, rejected: 65, ruby: "3.3.12", threadedCalls: 256 });
		assert.deepEqual(installed.faults, { asynchronousInterruptions: 2
			, checkpoints: 157
			, checks: 1089
			, exactlyOnceCleanup: true
			, inputFailures: 93
			, outputFailures: 64
			, ownedOutputs: 132 });
		assert.deepEqual(installed.composition.map(item => `${item.order}/${item.mode}`), ["recursive-first/raw", "recursive-first/during", "acyclic-first/raw", "acyclic-first/during"]);
		for(const item of installed.composition)
		{
			assert.equal(item.components, 3); assert.equal(item.handles, 8); assert.equal(item.retirementClears, 1);
			for(const key of ["crossPackageRetirement", "forkRejection", "forkWithLockHeld", "ractorRejection", "retainedValuesUsable"])
				assert.equal(item[key], true, key);
			assert.deepEqual(item.publicNameCollisions, ["GraphScope", "GraphInvalidNative", "next"]);
		}
		for(const key of ["offlineInstall", "compilerFreeExecution", "relocatedInstallation", "authorSourcesRemoved", "handoffRemoved", "gemCacheRemoved", "buildMetadataNotRequired", "rejectsTamperedAssets", "rejectsSymlinkAssets", "rejectsManyToManyThreads", "installedFilesUnchanged"])
			assert.equal(installed[key], true, key);
		assert.equal(installed.installedPackages.length, 3);
		const guide = (await readFile("docs/consume/ruby.md", "utf8")).split("### Recursive values\n")[1].split("\n### ")[0];
		assert.equal(documentedHash, sha256(guide.match(/```ruby\n([^]*?)\n```/)[1] + "\n"));
		assert.deepEqual(installed.documentation, { sourceSha256: documentedHash, stdout: "7\n" });
	}
	assert.equal(new Set(record.report.observations.map(run => run.binarySha256)).size, 1);
	assert.equal(sha256(await readFile(record.regressions.path)), record.regressions.sha256);
	await assertRubyGraphRegressions();
	const { document, ...contracts } = await readTypeSurface(), cells = typeSurfaceCells(document, contracts);
	const installed = cells.filter(cell => cell.stages.installedExecution.evidence.includes("ruby-recursive-installed"));
	assert.equal(installed.length, 6);
	for(const cell of installed)
	{
		assert.equal(cell.profile, "ruby"); assert.equal(cell.shape, "recursive");
		assert.ok(["parameter", "result", "field"].includes(cell.position));
		for(const stage of Object.values(cell.stages)) assert.equal(stage.state, "passed");
	}
	for(const cell of cells.filter(cell => cell.profile === "ruby" && cell.shape === "recursive" && cell.position.startsWith("callback-")))
		assert.notEqual(cell.stages.installedExecution.state, "passed");
});
