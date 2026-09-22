/**
 * Bind installed C/C++ collection evidence to independent shapes and archives.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { readTypeSurface, typeSurfaceCells } from "../src/adoption/type-surface.mjs";
import { collectionReviewedIr, collectionSignatures } from "./helpers/collection-fixture.mjs";
import { nativeCollectionConsumer } from "./helpers/native-collection-consumers.mjs";
import { gmpIdentity } from "../src/backends/c/gmp.mjs";
import { boostIdentity } from "../src/backends/cpp/boost.mjs";

test("C/C++ collection receipts bind both source paths, original archives and failure cleanup", async () => {
	const record = JSON.parse(await readFile("docs/evidence/native-collections-20260921.json"));
	assert.equal(record.schemaVersion, 1); assert.equal(record.wordBits, 64);
	assert.deepEqual(record.profiles, ["c", "cpp"]);
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
	assert.deepEqual(record.executions.map(run => `${run.path}/${run.profile}`), ["ordinary-source/c", "ordinary-source/cpp", "reviewed-ir/c", "reviewed-ir/cpp"]);
	for(const run of record.executions)
	{
		for(const key of ["offlineInstall", "compilerFreeExecution", "relocatedInstallation", "publicApiOnly", "installedFilesUnchanged", "repeatExecution", "sourceRemovedBeforeInstallation", "handoffRemovedBeforeExecution"])
			assert.equal(run[key], true, key);
		for(const key of ["executableSha256", "bindingIrSha256", "sourceTreeSha256", "sourceApiSha256", "modelSha256", "receiptSha256"])
			assert.match(run[key], /^[a-f0-9]{64}$/);
		assert.equal(run.consumerSha256, sha256(await nativeCollectionConsumer(run.profile)));
		assert.equal(run.runs.length, 2); assert.deepEqual(run.runs[0], run.runs[1]);
		const { loadedLibraries, ...counts } = run.runs[0];
		assert.deepEqual(counts, run.profile === "c" ? { checks: 87265, calls: 2752, rejected: 91, allocationFailures: 0 }
			: { checks: 71265, calls: 3244, rejected: 12, allocationFailures: 80 });
		assert.equal(loadedLibraries.length, run.profile === "c" ? 6 : 4);
		for(const { path, ...identity } of loadedLibraries) assert.deepEqual(identity, run.installedFiles[path]);
		assert.deepEqual(Object.keys(run.installedFiles).filter(path => /\.so(?:\.|$)/.test(path)).sort(), loadedLibraries.map(lib => lib.path).sort());
		assert.equal(run.packages.length, 1);
		const pkg = run.packages[0]; assert.equal(pkg.target, run.profile); assert.equal(pkg.runtimeDelivery, "embedded");
		assert.equal(pkg.artifacts.length, 1);
		assert.equal(pkg.artifacts[0].path, `archives/collections-1.0.0-${run.profile}.tar.gz`);
		assert.match(pkg.artifacts[0].sha256, /^[a-f0-9]{64}$/); assert.ok(pkg.artifacts[0].bytes > 0);
		if(run.profile === "c")
		{
			for(const [key, value] of Object.entries(gmpIdentity)) assert.equal(run.dependency[key], value);
			assert.equal(run.dependency.checked, true);
			assert.equal(Object.keys(run.installedFiles).length, 34);
		} else
		{
			for(const [key, value] of Object.entries(boostIdentity)) assert.equal(run.dependency[key], value);
			assert.equal(Object.keys(run.dependency.files).length, 198);
			assert.equal(Object.keys(run.installedFiles).length, 224);
		}
		assert.deepEqual(Object.keys(run.faults).sort(), run.profile === "c" ? ["cFacade", "native"] : ["native"]);
		for(const [name, probe] of Object.entries(run.faults))
		{
			assert.ok(probe.checks > 1000 && probe.allocationFailures > 200 && probe.rejected >= 10);
			assert.equal(probe.checks, name === "native" ? 8630 : 89819);
			assert.equal(probe.allocationFailures, name === "native" ? 2720 : 1296);
			assert.equal(probe.rejected, name === "native" ? 15 : 96);
			assert.equal(probe.realLeanExecution, true);
			assert.equal(probe.trackedLiveAllocationsAfterEveryFailure, 0);
			assert.equal(probe.syntheticScalarInjection, name === "native");
			assert.deepEqual(probe.sanitizers, ["address", "leak", "undefined"]);
			assert.equal(probe.warmedLeakBaseline.unchangedAfterConversions, true);
			assert.equal(probe.warmedLeakBaseline.unchangedAfterRepeatedWarmup, true);
			assert.equal(probe.warmedLeakBaseline.warmupRepetitions, 1000);
			assert.equal(probe.startupLeakBaseline.bytes, 128);
			assert.equal(probe.startupLeakBaseline.allocations, 12);
			assert.equal(probe.warmedLeakBaseline.bytes, 384);
			assert.equal(probe.warmedLeakBaseline.allocations, 20);
			assert.deepEqual(probe.warmedLeakBaseline.setupCalls, ["record_inspect", "array_check_elements"]);
			assert.equal(name === "native" ? probe.malformedNativeScalars : probe.previousPayloadsReleased, 16);
			for(const key of ["adapterSha256", "probeAdapterSha256", "consumerSha256", "executableSha256"])
				assert.match(probe[key], /^[a-f0-9]{64}$/);
		}
		const sibling = record.executions.find(other => other.path === run.path && other.profile !== run.profile);
		assert.deepEqual(run.faults.native, sibling.faults.native);
	}
	const reproduction = record.reproduction;
	for(const key of ["archivesIdentical", "nativeLibrariesIdentical", "installedFilesIdentical", "publicObservationsIdentical"])
		assert.equal(reproduction[key], true);
	assert.match(reproduction.firstReportSha256, /^[a-f0-9]{64}$/);
	assert.equal(reproduction.runs.length, 4);
	for(const previous of reproduction.runs)
	{
		const run = record.executions.find(run => run.profile === previous.profile && run.path === previous.path);
		assert.ok(run);
		assert.equal(previous.installedFilesSha256, sha256(canonicalJson(run.installedFiles)));
		assert.equal(previous.packagesSha256, sha256(canonicalJson(run.packages)));
		assert.equal(previous.publicRunsSha256, sha256(canonicalJson(run.runs)));
		assert.equal(previous.executableSha256, run.executableSha256);
		assert.match(previous.previousExecutableSha256, /^[a-f0-9]{64}$/);
		assert.deepEqual(Object.keys(previous.probes).sort(), Object.keys(run.faults).sort());
		for(const [name, probe] of Object.entries(previous.probes))
		{
			assert.equal(probe.observationsIdentical, true);
			assert.match(probe.previousExecutableSha256, /^[a-f0-9]{64}$/);
			assert.equal(probe.executableSha256, run.faults[name].executableSha256);
			assert.notEqual(probe.previousExecutableSha256, probe.executableSha256);
		}
	}
	for(const profile of ["c", "cpp"])
	{
		const source = await nativeCollectionConsumer(profile);
		assert.doesNotMatch(source, /lean_ctor_|lean_obj_tag|lb_copy_|::detail::|json/i);
	}
});

test("the C/C++ documentation examples retain their executed sources and original archives", async () => {
	const { documentation } = JSON.parse(await readFile("docs/evidence/native-collections-20260921.json"));
	for(const key of ["passed", "sourceRemovedBeforeHostCompilation", "handoffRemovedBeforeExecution"])
		assert.equal(documentation[key], true, key);
	const publisher = (await readFile("docs/publish/c.md", "utf8")).split("## Copied arrays and records\n")[1].split("\n## ")[0];
	const lean = publisher.match(/```lean\n([^]*?)\n```/)[1] + "\n";
	assert.equal(documentation.publisherSha256, sha256(lean));
	assert.deepEqual(documentation.reports.map(report => report.profile), ["c", "cpp"]);
	for(const run of documentation.reports)
	{
		const guide = (await readFile(`docs/consume/${run.profile}.md`, "utf8")).split("### Arrays and records\n")[1].split("\n### ")[0];
		const source = guide.match(new RegExp("```" + run.profile + "\\n([^]*?)\\n```"))[1] + "\n";
		assert.equal(run.sourceSha256, sha256(source));
		assert.equal(run.stdout, run.profile === "c" ? "Seeds: 7, 2\n" : "Seeds: 7, 2\n7\n");
		assert.equal(run.packages.length, 1);
		const pkg = run.packages[0];
		assert.equal(pkg.target, run.profile); assert.equal(pkg.runtimeDelivery, "embedded");
		assert.equal(pkg.artifacts.length, 1);
		assert.equal(pkg.artifacts[0].path, `archives/parcels-1.0.0-${run.profile}.tar.gz`);
		assert.match(pkg.artifacts[0].sha256, /^[a-f0-9]{64}$/); assert.ok(pkg.artifacts[0].bytes > 0);
	}
});

test("C/C++ collection promotion fills only the reviewed copied-value and primitive-field gaps", async () => {
	const { document, ...contracts } = await readTypeSurface();
	const cells = typeSurfaceCells(document, contracts);
	const observed = cells.filter(cell => cell.stages.installedExecution.evidence.includes("native-collections-installed"));
	assert.equal(observed.length, 40);
	for(const cell of observed)
	{
		assert.ok(["c", "cpp"].includes(cell.profile)); assert.equal(cell.path, "reviewed-ir");
		assert.ok(["parameter", "result", "field"].includes(cell.position));
		assert.ok(["array", "record"].includes(cell.shape) || cell.position === "field" && document.irFacets.primitive.includes(cell.shape));
		for(const stage of Object.values(cell.stages))
		{ assert.equal(stage.state, "passed"); assert.deepEqual(stage.evidence, ["native-collections-installed"]); }
	}
	const workflow = await readFile(".github/workflows/consumer-matrix.yml", "utf8");
	assert.match(workflow, /LEAN_BRIDGE_NATIVE_COLLECTION_TEST=1 node --test tests\/native-collections\.test\.mjs/);
	assert.match(workflow, /test -s build\/collections\/native\.json/);
	assert.match(workflow, /path: \|[^]*?build\/collections\/native\.json/);
});
