/**
 * Original installed CPAN collection archives, independent callers and cleanup.
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
import { beforePerlStructuredCallables } from "./helpers/perl-structured-callable-source-history.mjs";

test("Perl collection evidence binds all primitives and seven records to both paths on four ABIs", async () => {
	const record = JSON.parse(await readFile("docs/evidence/perl-collections-20260921.json"));
	assert.equal(record.schemaVersion, 1); assert.equal(record.wordBits, 64);
	assert.deepEqual(record.profiles, ["perl"]);
	assert.equal(record.hostGlibc, "2.36"); assert.equal(record.packageGlibcFloor, "2.36");
	const sort = signatures => [...signatures].sort((a, b) => a.name.localeCompare(b.name));
	assert.deepEqual(sort(record.signatures), sort(collectionSignatures));
	assert.equal(record.reviewedIrSha256, sha256(canonicalJson(collectionReviewedIr())));
	const reports = record.executions.map(({ signaturesSha256, ...run }) => {
		assert.equal(signaturesSha256, sha256(canonicalJson(record.signatures))); return { ...run, signatures: record.signatures };
	});
	assert.equal(record.reportSha256, sha256(canonicalJson({ schemaVersion: 1, reports })));
	for(const [path, hash] of Object.entries(record.sourceHashes))
		assert.equal(sha256(beforePerlStructuredCallables(path, await readFile(path, "utf8"))), hash, path);
	assert.deepEqual(record.perlAbis, ["5.36.3-threaded", "5.36.3-unthreaded", "5.38.2-threaded", "5.38.2-unthreaded"]);
	assert.deepEqual(record.executions.map(run => `${run.path}/${run.perl.slice(1)}-${run.threaded ? "threaded" : "unthreaded"}`), ["ordinary-source", "reviewed-ir"].flatMap(path => record.perlAbis.map(abi => `${path}/${abi}`)));
	for(const run of record.executions)
	{
		assert.equal(run.profile, "perl"); assert.equal(run.checks, 239954);
		assert.equal(run.calls, 3008); assert.equal(run.rejected, 132); assert.equal(run.reentrantArrays, 3);
		assert.deepEqual(run.recordTypes, ["Primitives", "Empty", "Single", "Count", "Pair", "Reversed", "Packet"]);
		assert.deepEqual(run.primitives.map(item => item.name), arrayPrimitives.map(([, name]) => name));
		assert.ok(run.primitives.every(item => item.checks > 1000 && item.rejected_cases > 1));
		assert.equal(run.consumerSha256, record.sourceHashes["tests/fixtures/collection-consumers/perl.pl"]);
		for(const key of ["offlineInstall", "compilerFreeExecution", "sourceRemovedBeforeInstallation", "relocatedInstallation", "producerHandoffRemoved", "publicApiOnly", "repeatExecution", "installedFilesUnchanged", "installedPodChecked", "isolatedCompiledFaultProbe"]) assert.equal(run[key], true, key);
		for(const key of ["bindingIrSha256", "sourceTreeSha256", "modelSha256", "receiptSha256", "perlSha256", "probeSha256", "probeSourceSha256"]) assert.match(run[key], /^[a-f0-9]{64}$/);
		assert.deepEqual(run.nativeLibraries, Object.fromEntries(Object.entries(run.installedFiles).filter(([path]) => path.endsWith(".so")).map(([path, file]) => [path, file.sha256])));
		assert.equal(Object.keys(run.nativeLibraries).length, 5);
		assert.equal(run.packages.length, 2); assert.ok(run.packages.every(pkg => pkg.ecosystem === "cpan"));
		for(const pkg of run.packages)
		{
			assert.equal(pkg.artifacts.length, 1); assert.match(pkg.artifacts[0].path, /^archives\/.*\.tar\.gz$/);
			assert.match(pkg.artifacts[0].sha256, /^[a-f0-9]{64}$/); assert.ok(pkg.artifacts[0].bytes > 0);
		}
		assert.deepEqual(run.faults, { checks: 1187, conversion_checkpoints: 1141, host_exceptions: 8, partial_inputs: 32, reentrant_fields: 3, reentrant_outer_arrays: 3 });
		const sibling = record.executions.find(other => other.path !== run.path && other.perl === run.perl && other.threaded === run.threaded);
		assert.deepEqual(run.nativeLibraries, sibling.nativeLibraries);
	}
	for(const key of ["archivesIdentical", "nativeLibrariesIdentical", "installedPayloadsIdentical"]) assert.equal(record.reproduction[key], true);
	assert.match(record.reproduction.firstReportSha256, /^[a-f0-9]{64}$/);
	assert.equal(record.reproduction.runs.length, 8);
	for(const run of record.reproduction.runs)
	{
		const current = record.executions.find(other => other.path === run.path && other.perl === run.perl && other.threaded === run.threaded);
		assert.ok(current); assert.equal(run.installationMetadataDifferences.length, 3);
		const excluded = run.installationMetadataDifferences.map(file => file.path);
		assert.equal(run.installedPayloadSha256, sha256(canonicalJson(Object.fromEntries(Object.entries(current.installedFiles).filter(([path]) => !excluded.includes(path))))));
		for(const file of run.installationMetadataDifferences)
		{
			assert.match(file.path, /\/(?:perllocal\.pod|auto\/LeanBridge\/(?:Runtime|Collections)\/\.packlist)$/);
			assert.match(file.previousSha256, /^[a-f0-9]{64}$/); assert.notEqual(file.previousSha256, file.sha256);
			assert.equal(file.sha256, current.installedFiles[file.path].sha256);
		}
	}
});

test("Perl collection evidence promotes copied cells and missing fields without broadening callbacks", async () => {
	const { document, ...contracts } = await readTypeSurface();
	const cells = typeSurfaceCells(document, contracts);
	const observed = cells.filter(cell => cell.stages.installedExecution.evidence.includes("perl-collections-installed"));
	assert.equal(observed.length, 28);
	for(const cell of observed)
	{
		assert.equal(cell.profile, "perl"); assert.ok(["parameter", "result", "field"].includes(cell.position));
		assert.ok(["array", "record"].includes(cell.shape) || cell.position === "field" && cell.path === "reviewed-ir" && document.irFacets.primitive.includes(cell.shape));
		for(const stage of Object.values(cell.stages))
		{ assert.equal(stage.state, "passed"); assert.deepEqual(stage.evidence, ["perl-collections-installed"]); }
	}
	const callbacks = cells.filter(cell => cell.profile === "perl" && ["array", "record"].includes(cell.shape) && cell.position.startsWith("callback-"));
	for(const cell of callbacks)
	{
		assert.equal(cell.stages.installedExecution.state, "passed");
		assert.deepEqual(cell.stages.installedExecution.evidence, ["perl-structured-callables-installed"]);
	}
	const workflow = await readFile(".github/workflows/perl-consumer.yml", "utf8");
	assert.match(workflow, /LEAN_BRIDGE_PERL_COLLECTION_TEST=1 node --test tests\/perl-collections\.test\.mjs/);
	assert.match(workflow, /test -s build\/collections\/perl\.json/);
	assert.match(workflow, /path: \|[^]*?build\/collections\/perl\.json/);
});
