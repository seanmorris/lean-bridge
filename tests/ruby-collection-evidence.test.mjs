/**
 * Original installed Ruby collection gems, stable copies and failure cleanup.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { readTypeSurface, typeSurfaceCells } from "../src/adoption/type-surface.mjs";
import { collectionReviewedIr, collectionSignatures } from "./helpers/collection-fixture.mjs";
import { arrayPrimitives } from "./helpers/array-fixture.mjs";

test("Ruby collection receipts bind both source paths, original gems and failure cleanup", async () => {
	const record = JSON.parse(await readFile("docs/evidence/ruby-collections-20260922.json"));
	assert.equal(record.schemaVersion, 1); assert.equal(record.wordBits, 64);
	assert.deepEqual(record.profiles, ["ruby"]);
	assert.equal(record.hostGlibc, "2.36"); assert.equal(record.packageGlibcFloor, "2.36");
	const sort = values => [...values].sort((a, b) => a.name.localeCompare(b.name));
	assert.deepEqual(sort(record.signatures), sort(collectionSignatures));
	assert.equal(record.reviewedIrSha256, sha256(canonicalJson(collectionReviewedIr())));
	const reports = record.executions.map(({ signaturesSha256, ...run }) => {
		assert.equal(signaturesSha256, sha256(canonicalJson(record.signatures)));
		return { ...run, signatures: record.signatures };
	});
	assert.equal(record.reportSha256, sha256(canonicalJson({ schemaVersion: 1, reports })));
	for(const [path, hash] of Object.entries(record.sourceHashes)) assert.equal(sha256(await readFile(path)), hash, path);
	assert.deepEqual(record.executions.map(run => run.path), ["ordinary-source", "reviewed-ir"]);
	for(const run of record.executions)
	{
		assert.equal(run.profile, "ruby"); assert.equal(run.checks, 167545);
		assert.equal(run.calls, 3225); assert.equal(run.rejected, 118);
		assert.match(run.ruby, /^ruby 3\.3\.12 .*\[x86_64-linux\]$/);
		assert.deepEqual(run.recordTypes, ["Primitives", "Empty", "Single", "Count", "Pair", "Reversed", "Packet"].map(name => `LeanBridge::Collections::${name}`));
		assert.deepEqual(run.primitives.map(item => item.name), arrayPrimitives.map(([, name]) => name));
		assert.ok(run.primitives.every(item => item.checks > 2900 && item.rejected_cases >= 4));
		assert.equal(run.consumerSha256, record.sourceHashes["tests/fixtures/collection-consumers/ruby.rb"]);
		assert.equal(run.probeSha256, record.sourceHashes["tests/fixtures/collection-consumers/ruby-faults.rb"]);
		for(const key of ["offlineInstall", "compilerFreeExecution", "sourceRemovedBeforeInstallation", "relocatedInstallation", "producerHandoffRemoved", "gemCacheRemoved", "publicApiOnly", "repeatExecution", "installedFilesUnchanged", "isolatedInMemoryFaultProbe"])
			assert.equal(run[key], true, key);
		for(const key of ["bindingIrSha256", "sourceTreeSha256", "sourceApiSha256", "modelSha256", "receiptSha256", "installedReceiptSha256", "rubySha256"])
			assert.match(run[key], /^[a-f0-9]{64}$/);
		assert.equal(Object.keys(run.installedFiles).length, 24);
		assert.deepEqual(run.nativeLibraries, Object.fromEntries(Object.entries(run.installedFiles).filter(([path]) => path.endsWith(".so")).map(([path, file]) => [path, file.sha256])));
		assert.equal(Object.keys(run.nativeLibraries).length, 4);
		assert.equal(run.packages.length, 1);
		const pkg = run.packages[0];
		assert.equal(pkg.target, "rubygems"); assert.equal(pkg.ecosystem, "rubygems");
		assert.equal(pkg.role, "component"); assert.equal(pkg.runtimeDelivery, "embedded");
		assert.equal(pkg.name, "collections-api"); assert.equal(pkg.version, "1.0.0");
		assert.equal(pkg.artifacts.length, 1);
		assert.equal(pkg.artifacts[0].path, "archives/collections-api-1.0.0-x86_64-linux.gem");
		assert.match(pkg.artifacts[0].sha256, /^[a-f0-9]{64}$/); assert.ok(pkg.artifacts[0].bytes > 0);
		assert.deepEqual(run.faults, { checks: 842, constructor_probes: 7, conversion_methods: 178, malformed_values: 8, partial_inputs: 64 });
		assert.deepEqual(run.nativeLibraries, record.executions.find(other => other.path !== run.path).nativeLibraries);
	}
	for(const key of ["archivesIdentical", "nativeLibrariesIdentical", "installedFilesIdentical", "publicObservationsIdentical"])
		assert.equal(record.reproduction[key], true);
	assert.equal(record.reproduction.firstReportSha256, record.reportSha256);
	assert.equal(record.reproduction.runs.length, 2);
	for(const previous of record.reproduction.runs)
	{
		const run = record.executions.find(run => run.path === previous.path);
		assert.ok(run);
		assert.equal(previous.installedFilesSha256, sha256(canonicalJson(run.installedFiles)));
		assert.equal(previous.packagesSha256, sha256(canonicalJson(run.packages)));
		assert.equal(previous.reportSha256, sha256(canonicalJson(reports.find(report => report.path === previous.path))));
	}
	const { firstLog, secondLog } = record.reproduction;
	assert.notEqual(firstLog.sha256, secondLog.sha256);
	for(const log of [firstLog, secondLog])
	{
		assert.equal(log.sha256, sha256(log.text));
		assert.match(log.text, /# tests 1\n# suites 0\n# pass 1\n# fail 0/);
		assert.match(log.text, /# ordinary-source: compiling Ruby collections/);
		assert.match(log.text, /# reviewed-ir: compiling Ruby collections/);
	}
	assert.doesNotMatch(await readFile("tests/fixtures/collection-consumers/ruby.rb", "utf8"), /Fiddle|const_get\(:Native|lean_ctor_|lb_copy_/);
});

test("the Ruby documentation example binds its executed source and installed original gem", async () => {
	const { documentation } = JSON.parse(await readFile("docs/evidence/ruby-collections-20260922.json"));
	for(const key of ["passed", "sourceRemovedBeforeInstallation", "handoffRemovedBeforeExecution", "relocatedInstallation", "compilerFreeExecution", "installedFilesUnchanged"])
		assert.equal(documentation[key], true, key);
	const publisher = (await readFile("docs/publish/rubygems.md", "utf8")).split("## Export arrays and records\n")[1].split("\n## ")[0];
	assert.equal(documentation.publisherSha256, sha256(publisher.match(/```lean\n([^]*?)\n```/)[1] + "\n"));
	const guide = (await readFile("docs/consume/ruby.md", "utf8")).split("### Arrays and records\n")[1].split("\n### ")[0];
	assert.equal(documentation.consumerSha256, sha256(guide.match(/```ruby\n([^]*?)\n```/)[1] + "\n"));
	assert.equal(documentation.stdout, "Seeds: 7, 2\n[2, 7]\n");
	assert.equal(documentation.packages.length, 1);
	const pkg = documentation.packages[0];
	assert.equal(pkg.target, "rubygems"); assert.equal(pkg.runtimeDelivery, "embedded");
	assert.equal(pkg.artifacts.length, 1);
	assert.equal(pkg.artifacts[0].path, "archives/parcels-api-1.0.0-x86_64-linux.gem");
	assert.match(pkg.artifacts[0].sha256, /^[a-f0-9]{64}$/); assert.ok(pkg.artifacts[0].bytes > 0);
	assert.equal(Object.keys(documentation.installedFiles).length, 24);
});

test("Ruby collections fill reviewed copied-value and primitive-field gaps without broadening callbacks", async () => {
	const { document, ...contracts } = await readTypeSurface();
	const cells = typeSurfaceCells(document, contracts);
	const observed = cells.filter(cell => cell.stages.installedExecution.evidence.includes("ruby-collections-installed"));
	assert.equal(observed.length, 22);
	for(const cell of observed)
	{
		assert.equal(cell.profile, "ruby"); assert.equal(cell.path, "reviewed-ir");
		assert.ok(["parameter", "result", "field"].includes(cell.position));
		assert.ok(["array", "record"].includes(cell.shape) || cell.position === "field" && document.irFacets.primitive.includes(cell.shape));
		for(const stage of Object.values(cell.stages))
		{ assert.equal(stage.state, "passed"); assert.deepEqual(stage.evidence, ["ruby-collections-installed"]); }
	}
	for(const cell of cells.filter(cell => cell.profile === "ruby" && ["array", "record"].includes(cell.shape) && cell.position.startsWith("callback-")))
		assert.notEqual(cell.stages.installedExecution.state, "passed");
	const workflow = await readFile(".github/workflows/consumer-matrix.yml", "utf8");
	assert.match(workflow, /LEAN_BRIDGE_RUBY_COLLECTION_TEST=1 node --test tests\/ruby-collections\.test\.mjs tests\/ruby-collection-contract\.test\.mjs/);
	assert.match(workflow, /test -s build\/collections\/ruby\.json/);
	assert.match(workflow, /path: \|[^]*?build\/collections\/ruby\.json/);
});
