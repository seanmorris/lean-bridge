/**
 * Bind original Cargo collections to public types, source-free calls and cleanup.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { readTypeSurface, typeSurfaceCells } from "../src/adoption/type-surface.mjs";
import { generateCopiedRustPackage } from "../src/backends/rust/copied-values.mjs";
import { collectionReviewedIr, collectionSignatures } from "./helpers/collection-fixture.mjs";
import { beforeRustStructuredCallables } from "./helpers/rust-structured-callable-source-history.mjs";

const observations = run => Object.fromEntries(["checks", "calls", "rejected", "faultTests", "nativeFaultChecks", "conversionCheckpoints"].map(key => [key, run[key]]));

test("Rust collection evidence binds original crates, exact public types and failure cleanup", async () => {
	const record = JSON.parse(await readFile("docs/evidence/rust-collections-20260922.json"));
	assert.equal(record.schemaVersion, 1); assert.equal(record.wordBits, 64);
	assert.deepEqual(record.profiles, ["rust"]);
	assert.equal(record.hostGlibc, "2.36"); assert.equal(record.packageGlibcFloor, "2.36");
	const sort = values => [...values].sort((a, b) => a.name.localeCompare(b.name));
	assert.deepEqual(sort(record.signatures), sort(collectionSignatures));
	assert.equal(record.reviewedIrSha256, sha256(canonicalJson(collectionReviewedIr())));
	const reports = record.executions.map(({ signaturesSha256, ...run }) => {
		assert.equal(signaturesSha256, sha256(canonicalJson(record.signatures)));
		return { ...run, signatures: record.signatures };
	});
	assert.equal(record.reportSha256, sha256(canonicalJson({ schemaVersion: 1, reports })));
	for(const [path, hash] of Object.entries(record.sourceHashes))
		assert.equal(sha256(beforeRustStructuredCallables(path, await readFile(path, "utf8"), hash)), hash, path);
	assert.deepEqual(record.executions.map(run => run.path), ["ordinary-source", "reviewed-ir"]);
	const negatives = JSON.parse(await readFile("tests/fixtures/collection-consumers/rust-invalid.json"));
	const guide = (await readFile("docs/consume/rust.md", "utf8")).split("### Arrays and records\n")[1].split("\n### ")[0];
	for(const run of record.executions)
	{
		assert.equal(run.profile, "rust"); assert.equal(run.checks, 321191); assert.equal(run.calls, 3274);
		assert.equal(run.rejected, 12); assert.equal(run.primitiveShapes, 19); assert.equal(run.recordTypes, 7);
		assert.equal(run.fixedArrayDepth, 24); assert.equal(run.threadedCalls, 512);
		for(const key of ["offlineInstall", "emptyCargoHome", "linkOnly", "handoffRemovedBeforeExecution", "compilerFreeExecution", "relocatedExecutable", "installedSourcesRemoved", "repeatExecution", "normalExitCleanup", "installedFilesUnchanged", "isolatedFaultCopy", "sourceRemovedBeforeInstallation"])
			assert.equal(run[key], true, key);
		assert.match(run.rustcVersion, /^rustc 1\.90\.0 /); assert.match(run.cargoVersion, /^cargo 1\.90\.0 /);
		for(const key of ["bindingIrSha256", "sourceTreeSha256", "sourceApiSha256", "modelSha256", "receiptSha256", "installedReceiptSha256", "compilerSha256", "cargoSha256", "linkerSha256", "executableSha256", "lockSha256", "dependencyFilesSha256"])
			assert.match(run[key], /^[a-f0-9]{64}$/);
		assert.equal(Object.keys(run.installedFiles).length, 26); assert.equal(Object.keys(run.installedSnapshot).length, 27);
		for(const [path, file] of Object.entries(run.installedFiles)) assert.equal(run.installedSnapshot[path], file.sha256);
		assert.equal(Object.keys(run.nativeLibraries).length, 4);
		for(const [path, file] of Object.entries(run.nativeLibraries)) assert.deepEqual(run.installedFiles[path], file);
		assert.deepEqual(run.nativeLibraries, record.executions.find(other => other.path !== run.path).nativeLibraries);
		assert.equal(run.installedSnapshot["Cargo.lock"], run.dependencies.lockSha256);
		for(const name of ["num-bigint-0.4.6", "sha2-0.10.9"])
			assert.ok(run.dependencies.packages.some(pkg => pkg.directory === name));
		for(const dependency of run.dependencies.packages)
		{
			assert.match(dependency.checksum, /^[a-f0-9]{64}$/); assert.match(dependency.manifestSha256, /^[a-f0-9]{64}$/);
			assert.ok(dependency.files > 0);
		}
		const typed = run.publicTypes;
		assert.equal(typed.checked, true); assert.equal(typed.executed, true);
		assert.equal(typed.consumerSha256, record.sourceHashes["tests/fixtures/collection-consumers/rust.rs"]);
		assert.equal(typed.rejectionSourceSha256, record.sourceHashes["tests/fixtures/collection-consumers/rust-invalid.json"]);
		assert.deepEqual(typed.rejected, negatives.map(({ name, statement, code }) => ({
			name, code, diagnostics: 1
			, sourceSha256: sha256(`use collections_api as api; fn main() { ${statement} }\n`) })));
		assert.equal(run.packages.length, 1); const pkg = run.packages[0];
		assert.equal(pkg.target, "cargo"); assert.equal(pkg.ecosystem, "cargo");
		assert.equal(pkg.name, "collections-api"); assert.equal(pkg.version, "1.0.0");
		assert.equal(pkg.runtimeDelivery, "embedded"); assert.deepEqual(pkg.requires, []);
		assert.equal(pkg.artifacts.length, 1);
		assert.equal(pkg.artifacts[0].path, "archives/collections-api-1.0.0.crate");
		assert.equal(run.faultTests, 5); assert.equal(run.conversionCheckpoints, 112);
		assert.equal(run.nativeFaultChecks, 1546);
		assert.equal(run.faultSourceSha256, record.sourceHashes["tests/fixtures/collection-consumers/rust-faults.rs"]);
		// Compiled layouts can number private copies differently from the source-only fixture.
		assert.match(run.conversionProbeSha256, /^[a-f0-9]{64}$/);
		assert.equal(run.conversionProbeSha256, record.executions.find(other => other.path !== run.path).conversionProbeSha256);
		assert.equal(run.documentation.sourceSha256, sha256(guide.match(/```rust\n([^]*?)\n```/)[1] + "\n"));
		assert.equal(run.documentation.stdout, "[1, 2, 3]\n42\n");
		assert.match(run.documentation.executableSha256, /^[a-f0-9]{64}$/);
		for(const key of ["sourceFreeExecution", "compilerFreeExecution", "normalExitCleanup"]) assert.equal(run.documentation[key], true);
	}
	for(const key of ["archivesIdentical", "nativeLibrariesIdentical", "installedFilesIdentical", "publicObservationsIdentical"])
		assert.equal(record.reproduction[key], true);
	assert.equal(record.reproduction.runs.length, 2);
	for(const previous of record.reproduction.runs)
	{
		const run = record.executions.find(run => run.path === previous.path); assert.ok(run);
		assert.equal(previous.installedFilesSha256, sha256(canonicalJson(run.installedFiles)));
		assert.equal(previous.packagesSha256, sha256(canonicalJson(run.packages)));
		assert.equal(previous.observationsSha256, sha256(canonicalJson(observations(run))));
	}
	const { firstLog, secondLog } = record.reproduction; assert.notEqual(firstLog.sha256, secondLog.sha256);
	for(const log of [firstLog, secondLog])
	{
		assert.equal(log.sha256, sha256(log.text));
		assert.match(log.text, /# tests 1\n# suites 0\n# pass 1\n# fail 0/);
		assert.match(log.text, /# ordinary-source: compiling Rust collections/);
		assert.match(log.text, /# reviewed-ir: compiling Rust collections/);
	}
	assert.doesNotMatch(await readFile("tests/fixtures/collection-consumers/rust.rs", "utf8"), /__runtime|unsafe|extern|serde|serde_json|include!/);
});

test("Rust conversion preflight distinguishes compiler checks from installed Lean calls", async () => {
	const { conversion } = JSON.parse(await readFile("docs/evidence/rust-collections-20260922.json"));
	assert.equal(conversion.compiledLean, false); assert.equal(conversion.installedPackage, false);
	assert.equal(conversion.tests, 4); assert.equal(conversion.primitiveShapes, 19);
	assert.equal(conversion.records, 7); assert.equal(conversion.fixedArrayDepth, 24);
	assert.equal(conversion.allocationErrorCheckpoints, 112); assert.equal(conversion.unwindCheckpoints, 112);
	assert.equal(conversion.publicTypes.checked, true); assert.equal(conversion.publicTypes.executed, false);
	assert.equal(conversion.publicTypes.consumerSha256, sha256(await readFile("tests/fixtures/collection-consumers/rust.rs")));
	assert.equal(conversion.publicTypes.rejected.length, 15);
	assert.equal(conversion.nativeFaultsCompiled, true); assert.equal(conversion.nativeFaultsExecuted, false);
	assert.equal(conversion.nativeFaultsSha256, sha256(await readFile("tests/fixtures/collection-consumers/rust-faults.rs")));
	assert.equal(conversion.fixtureSha256, sha256(await readFile("tests/fixtures/collection-consumers/rust-conversions.rs")));
	const files = generateCopiedRustPackage(collectionReviewedIr(), null, { name: "collections-api", version: "1.0.0" });
	assert.deepEqual(conversion.generatedSourceHashes, Object.fromEntries(Object.entries(files).map(([path, source]) => [path, sha256(source)])));
});

test("Rust collections advance only copied reviewed positions and require original CI artifacts", async () => {
	const { document, ...contracts } = await readTypeSurface();
	const cells = typeSurfaceCells(document, contracts);
	const observed = cells.filter(cell => cell.stages.installedExecution.evidence.includes("rust-collections-installed"));
	assert.equal(observed.length, 22);
	for(const cell of observed)
	{
		assert.equal(cell.profile, "rust"); assert.equal(cell.path, "reviewed-ir");
		assert.ok(["parameter", "result", "field"].includes(cell.position));
		assert.ok(["array", "record"].includes(cell.shape) || cell.position === "field" && document.irFacets.primitive.includes(cell.shape));
		for(const stage of Object.values(cell.stages))
		{ assert.equal(stage.state, "passed"); assert.deepEqual(stage.evidence, ["rust-collections-installed"]); }
	}
	for(const cell of cells.filter(cell => cell.profile === "rust" && ["array", "record"].includes(cell.shape) && cell.position.startsWith("callback-")))
	{
		assert.equal(cell.stages.installedExecution.state, "passed");
		assert.deepEqual(cell.stages.installedExecution.evidence, ["rust-structured-callables-installed"]);
	}
	const workflow = await readFile(".github/workflows/consumer-matrix.yml", "utf8");
	for(const [flag, file, report] of [["COLLECTION", "rust-collections", "rust"], ["CONVERSION", "rust-collection-conversions", "rust-conversions"]])
	{
		assert.ok(workflow.includes(`LEAN_BRIDGE_RUST_${flag}_TEST=1 node --test tests/${file}.test.mjs`));
		assert.ok(workflow.includes(`test -s build/collections/${report}.json`));
		assert.ok(workflow.split("path: |\n").some(block => block.includes(`build/collections/${report}.json`)));
	}
});
