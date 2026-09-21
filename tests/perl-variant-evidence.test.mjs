/**
 * Original CPAN archives and independent installed variants across four Perl ABIs.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { readTypeSurface, typeSurfaceCells } from "../src/adoption/type-surface.mjs";
import { cVariantReviewedIr, cVariantSignatures } from "./helpers/c-variant-fixture.mjs";

test("Perl variant evidence binds all constructors and both source paths across four pinned ABIs", async () => {
	const record = JSON.parse(await readFile("docs/evidence/perl-variants-20260921.json"));
	assert.equal(record.schemaVersion, 1); assert.equal(record.wordBits, 64); assert.deepEqual(record.profiles, ["perl"]);
	assert.equal(record.hostGlibc, "2.36"); assert.equal(record.packageGlibcFloor, "2.36");
	const reports = record.executions.map(({ contractSha256, ...run }) => {
		assert.equal(contractSha256, sha256(canonicalJson(record.contract))); return { ...run, contract: record.contract };
	});
	assert.equal(record.reportSha256, sha256(canonicalJson({ schemaVersion: 1, reports })));
	for(const [path, hash] of Object.entries(record.sourceHashes)) assert.equal(sha256(await readFile(path)), hash, path);
	assert.deepEqual(record.signatures, cVariantSignatures()); assert.deepEqual(record.types, cVariantReviewedIr().types);
	assert.equal(record.reviewedIrSha256, sha256(canonicalJson(cVariantReviewedIr())));
	assert.equal(record.types.filter(type => type.kind === "variant").length, 7);
	assert.equal(record.types.flatMap(type => type.cases).length, 18);
	assert.deepEqual(record.perlAbis, ["5.36.3-threaded", "5.36.3-unthreaded", "5.38.2-threaded", "5.38.2-unthreaded"]);
	assert.deepEqual(record.executions.map(run => `${run.path}/${run.perl.slice(1)}-${run.threaded ? "threaded" : "unthreaded"}`), ["ordinary-source", "reviewed-ir"].flatMap(path => record.perlAbis.map(abi => `${path}/${abi}`)));
	for(const run of record.executions)
	{
		assert.equal(run.profile, "perl"); assert.equal(run.checks, 53680); assert.equal(run.calls, 4226); assert.equal(run.rejected, 116);
		assert.deepEqual([...run.primitives].sort(), ["unit", "bool", "uint8", "uint16", "uint32", "uint64", "int8", "int16", "int32", "int64", "nat", "int", "float32", "float64", "string", "bytes", "char", "usize", "isize"].sort());
		assert.equal(run.consumerSha256, record.sourceHashes["tests/fixtures/variant-consumers/perl.pl"]);
		for(const key of ["offlineInstall", "compilerFreeExecution", "sourceRemovedBeforeInstallation", "relocatedInstallation", "producerHandoffRemoved", "publicApiOnly", "repeatExecution", "installedFilesUnchanged", "installedPodChecked", "isolatedCompiledFaultProbe"]) assert.equal(run[key], true, key);
		for(const key of ["bindingIrSha256", "sourceTreeSha256", "sourceApiSha256", "modelSha256", "receiptSha256", "perlSha256", "probeSha256", "probeSourceSha256"]) assert.match(run[key], /^[a-f0-9]{64}$/);
		assert.deepEqual(run.nativeLibraries, Object.fromEntries(Object.entries(run.installedFiles).filter(([path]) => path.endsWith(".so")).map(([path, file]) => [path, file.sha256])));
		assert.equal(Object.keys(run.nativeLibraries).length, 5);
		assert.equal(run.packages.length, 2); assert.ok(run.packages.every(pkg => pkg.ecosystem === "cpan"));
		for(const pkg of run.packages)
		{
			assert.equal(pkg.artifacts.length, 1); assert.match(pkg.artifacts[0].path, /^archives\/.*\.tar\.gz$/);
			assert.match(pkg.artifacts[0].sha256, /^[a-f0-9]{64}$/); assert.ok(pkg.artifacts[0].bytes > 0);
		}
		assert.equal(run.families.length, 7);
		assert.equal(run.faults.conversion_checkpoints, 494); assert.equal(run.faults.active_accessor_checks, 1132);
		assert.equal(run.faults.partial_inputs, 64); assert.equal(run.faults.host_exceptions, 4);
		assert.equal(run.faults.malformed_tags, 7); assert.equal(run.faults.reentrant_fields, 3); assert.equal(run.faults.wrong_accessors, 0);
		assert.deepEqual([...run.faults.constructor_probes].sort(), record.types.filter(type => type.kind === "variant").flatMap(type => type.cases.map(branch => `${type.name}::${branch.name[0].toUpperCase()}${branch.name.slice(1)}`)).sort());
		assert.equal(run.faults.checks, run.faults.conversion_checkpoints + 64 + 4 + 7 + 3);
		const sibling = record.executions.find(other => other.path !== run.path && other.perl === run.perl && other.threaded === run.threaded);
		assert.deepEqual(run.nativeLibraries, sibling.nativeLibraries);
	}
	assert.equal(record.reproduction.executions, 8); assert.equal(record.reproduction.archivesIdentical, true); assert.equal(record.reproduction.installedPayloadsIdentical, true);
	assert.equal(record.reproduction.nativeLibrariesIdentical, true);
	assert.match(record.reproduction.firstReportSha256, /^[a-f0-9]{64}$/);
	assert.equal(record.reproduction.runs.length, 8);
	for(const run of record.reproduction.runs)
	{
		const current = record.executions.find(other => other.path === run.path && other.perl === run.perl && other.threaded === run.threaded);
		assert.ok(current); assert.equal(run.installedPayloadSha256, run.previousInstalledPayloadSha256);
		assert.equal(run.installationMetadataDifferences.length, 3);
		const excluded = run.installationMetadataDifferences.map(file => file.path);
		assert.equal(run.installedPayloadSha256, sha256(canonicalJson(Object.fromEntries(Object.entries(current.installedFiles).filter(([path]) => !excluded.includes(path))))));
		for(const file of run.installationMetadataDifferences)
		{
			assert.match(file.path, /\/(?:perllocal\.pod|auto\/LeanBridge\/(?:Runtime|Variants)\/\.packlist)$/);
			assert.match(file.previousSha256, /^[a-f0-9]{64}$/); assert.notEqual(file.previousSha256, file.sha256);
			assert.equal(file.sha256, current.installedFiles[file.path].sha256);
		}
	}
	const publicSource = await readFile("tests/fixtures/variant-consumers/perl.pl", "utf8");
	assert.doesNotMatch(publicSource, /LeanBridge::Runtime|Variants::_|XSLoader|DynaLoader|lean_ctor_/);
});

test("Perl variants promote exactly six copied cells and require installed CI receipts", async () => {
	const { document, ...contracts } = await readTypeSurface();
	const cells = typeSurfaceCells(document, contracts).filter(cell => cell.stages.installedExecution.evidence.includes("perl-variants-installed"));
	assert.equal(cells.length, 6);
	for(const cell of cells)
	{
		assert.equal(cell.profile, "perl"); assert.equal(cell.shape, "variant"); assert.ok(["parameter", "result", "field"].includes(cell.position));
		for(const stage of Object.values(cell.stages))
		{ assert.equal(stage.state, "passed"); assert.deepEqual(stage.evidence, ["perl-variants-installed"]); }
	}
	const workflow = await readFile(".github/workflows/perl-consumer.yml", "utf8");
	assert.match(workflow, /LEAN_BRIDGE_PERL_VARIANT_TEST=1 node --test tests\/perl-variants\.test\.mjs/);
	assert.match(workflow, /test -s build\/variants\/perl\.json/);
	assert.match(workflow, /path: \|[^]*?build\/variants\/perl\.json/);
});
