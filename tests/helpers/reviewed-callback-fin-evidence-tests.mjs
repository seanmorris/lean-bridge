/**
 * Authenticate original reviewed callback evidence and refuse altered reports, inputs and execution logs.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import { assertReviewedCallbackFinExecution, assertReviewedCallbackFinReport, reviewedCallbackFinEvidenceDirectory, reviewedCallbackFinEvidenceFiles, reviewedCallbackFinEvidenceRevision, reviewedCallbackFinEvidenceSourcePaths, reviewedCallbackFinNativeCallers, reviewedCallbackFinNpmCallers, reviewedCallbackFinNpmFixture, reviewedCallbackFinReportIdentities } from "./reviewed-callback-fin-evidence.mjs";

const receipt = async () => {
	const bytes = await readFile(`${reviewedCallbackFinEvidenceDirectory}/receipt.json`);
	assert.equal(sha256(bytes), "da4f34b51996f6b818998d41cf06e4c381b7faf93da6ef7e86027b79cb64eeba");
	return JSON.parse(bytes);
};
const readOriginal = async reference => {
	const bytes = await readFile(reference.path);
	assert.equal(bytes.length, reference.bytes);
	assert.equal(sha256(bytes), reference.sha256, reference.path);
	return bytes;
};
const readSourceFor = record => async path => {
	const pinned = record.sourceFiles.find(item => item.path === path);
	assert.ok(pinned, path);
	const source = beforeFinRefinementSource(path, await readFile(path, "utf8"), pinned.sha256);
	assert.equal(sha256(source), pinned.sha256, path);
	return source;
};
const selection = async id => {
	const record = await receipt(), run = record.runs.find(item => item.id === id);
	return { record, run, report: JSON.parse(await readOriginal(run.report)), readSource: readSourceFor(record) };
};

test("reviewed callback evidence authenticates three reports, original execution logs and producer inputs", async () => {
	const record = await receipt(), readSource = readSourceFor(record);
	assert.equal(record.schemaVersion, 1); assert.deepEqual(record.planNodes, [1445]);
	assert.equal(record.execution, "local"); assert.equal(record.revision, reviewedCallbackFinEvidenceRevision);
	assert.deepEqual(record.sourceFiles.map(item => item.path), reviewedCallbackFinEvidenceSourcePaths);
	for(const item of record.sourceFiles) await readSource(item.path);
	assert.deepEqual(record.runs.map(item => item.id), ["c-cpp", "npm-r1", "npm-r2"]);
	assert.equal(record.artifacts.length, 5);
	for(const [name, pinned] of Object.entries(reviewedCallbackFinEvidenceFiles))
	{
		const artifact = record.artifacts.find(item => item.path === `${reviewedCallbackFinEvidenceDirectory}/${name}`);
		assert.equal(artifact.originalPath, pinned.original); assert.equal(artifact.sha256, pinned.sha256);
		await readOriginal(artifact);
	}
	for(const run of record.runs)
	{
		assert.deepEqual(run.report, record.artifacts.find(item => item.path === `${reviewedCallbackFinEvidenceDirectory}/${run.id}.json`));
		await assertReviewedCallbackFinReport(JSON.parse(await readOriginal(run.report)), run, readSource);
	}
	assert.deepEqual(record.reconstructed.nativeCallers, await reviewedCallbackFinNativeCallers(readSource));
	const { scope, ...npmCallers } = record.reconstructed.npmCallers;
	assert.match(scope, /original npm reports do not record caller hashes/u);
	assert.deepEqual(npmCallers, reviewedCallbackFinNpmCallers());
	assert.deepEqual(record.reconstructed.npmInputTrees, { r1: await reviewedCallbackFinNpmFixture(false, readSource), r2: await reviewedCallbackFinNpmFixture(true, readSource) });
	assert.equal(record.scope.sourcePath, "reviewed-source");
	assert.deepEqual(record.scope.hosts, ["c", "cpp", "node-javascript", "node-typescript"]);
	assert.deepEqual(record.scope.checkedBounds, ["3", "5", "10"]);
	assert.deepEqual([record.scope.nativeHostProducedRefinedReplies, record.scope.npmHostProducedRefinedReplies], [false, "R2 only"]);
	assert.deepEqual([record.scope.hostedCi, record.scope.binaryArchivesRetained, record.scope.dispatch], [false, false, "not measured"]);
	assert.match(record.scope.typescript, /not an independent TypeScript runtime/u);
	assert.deepEqual(record.producerEnvironment.nativeGlibcFloor, { override: "2.36", declaredMinimum: "2.36", measuredHostGlibc: "not measured" });
	assert.equal(record.producerEnvironment.node, "v22.23.3");
	assert.equal(record.producerEnvironment.toolchainDeclaration.value, (await readSource(record.producerEnvironment.toolchainDeclaration.path)).trim());
	assert.match(record.sourceIdentityScope, /not a complete dependency closure/u);
	assert.match(record.sourceIdentityScope, /No native input-tree reconstruction is claimed/u);
	const original = async suffix => (await readOriginal(record.artifacts.find(item => item.path.endsWith(suffix)))).toString();
	assertReviewedCallbackFinExecution(await original(".tap"), await original(".queue"));
});

test("reviewed callback report validation rejects changed native coverage, callers and package identities", async () => {
	const { run, report, readSource } = await selection("c-cpp");
	const mutations = [
		["fewer C checks", value => { value.reports[0].checks--; }]
		, ["fewer C++ checks", value => { value.reports[1].checks--; }]
		, ["missing C++", value => { value.reports.pop(); }]
		, ["different caller", value => { value.reports[0].consumerSha256 = "f".repeat(64); }]
		, ["different model", value => { value.reports[0].modelSha256 = "f".repeat(64); }]
		, ["different receipt", value => { value.reports[0].receiptSha256 = "f".repeat(64); }]
		, ["different archive", value => { value.archives[Object.keys(value.archives)[0]] = "f".repeat(64); }]
		, ["ordinary route", value => { value.reports[0].path = "ordinary-source"; }]
		, ["R2 native claim", value => { value.reports[1].review = "R2"; }]
		, ["changed review", value => { value.reports[0].reviewedBindingIrSha256 = "f".repeat(64); }]
		, ["invented dispatch", value => { value.reports[0].dispatch = { source: 0 }; }]
		, ["online install", value => { value.reports[0].offlineInstall = false; }]
		, ["compiler on path", value => { value.reports[0].compilerFreePath = false; }]
		, ["source still present", value => { value.reports[1].sourceRemovedBeforeInstallation = false; }]
		, ["not reproducible", value => { value.reproducible = false; }]
		, ["unknown claim", value => { value.hostedCi = true; }]
	];
	for(const [label, mutate] of mutations)
	{
		const changed = structuredClone(report); mutate(changed);
		await assert.rejects(() => assertReviewedCallbackFinReport(changed, run, readSource), assert.AssertionError, label);
	}
});

test("reviewed callback npm evidence keeps both review directions, exact receipts and strict declarations", async () => {
	for(const id of ["npm-r1", "npm-r2"])
	{
		const { run, report, readSource } = await selection(id);
		const mutations = [
			["fewer checks", value => { value.observed.checks--; }]
			, ["fewer rejections", value => { value.observed.rejections--; }]
			, ["wrong review", value => { value.review = value.review === "R1" ? "R2" : "R1"; }]
			, ["wrong review identity", value => { value.reviewedBindingIrSha256 = "f".repeat(64); }]
			, ["wrong package archive", value => { value.receipt.package.sha256 = "f".repeat(64); }]
			, ["wrong runtime archive", value => { value.receipt.runtime.sha256 = "f".repeat(64); }]
			, ["receipt hash", value => { value.receiptSha256 = "f".repeat(64); }]
			, ["not strict", value => { value.typescript.strict = false; }]
			, ["skipped declarations", value => { value.typescript.skipLibCheck = true; }]
			, ["source still present", value => { value.sourceRemovedBeforeInstallation = false; }]
			, ["invented dispatch", value => { value.dispatch = "measured"; }]
			, ["not reproducible", value => { value.reproducible = false; }]
			, ["browser claim", value => { value.profile = "browser"; }]
		];
		for(const [label, mutate] of mutations)
		{
			const changed = structuredClone(report); mutate(changed);
			await assert.rejects(() => assertReviewedCallbackFinReport(changed, run, readSource), assert.AssertionError, `${id}: ${label}`);
		}
		// Even a self-consistently rehashed receipt cannot substitute another analyzed fixture.
		const changed = structuredClone(report); changed.receipt.source.treeSha256 = "f".repeat(64);
		changed.receiptSha256 = sha256(canonicalJson(changed.receipt));
		await assert.rejects(() => assertReviewedCallbackFinReport(changed, { ...run, identities: reviewedCallbackFinReportIdentities(id, changed) }, readSource), assert.AssertionError);
		await assert.rejects(() => assertReviewedCallbackFinReport(report, run, async path => (await readSource(path)) + (path.endsWith(".lean") ? "\n-- altered fixture\n" : "")), assert.AssertionError);
	}
});

test("reviewed callback execution validation refuses incomplete, reordered or failed selections", async () => {
	const record = await receipt();
	const tap = (await readOriginal(record.artifacts.find(item => item.path.endsWith(".tap")))).toString();
	const queue = (await readOriginal(record.artifacts.find(item => item.path.endsWith(".queue")))).toString();
	const mutations = [
		["changed count", tap.replace("# tests 1", "# tests 2"), queue]
		, ["skipped test", tap.replace("# skipped 0", "# skipped 1"), queue]
		, ["duplicate counter", tap.replace("# pass 1", "# pass 1\n# pass 0"), queue]
		, ["failed TAP", tap.replace("ok 1 -", "not ok 1 -"), queue]
		, ["failed exit", tap.replace("exit=0", "exit=1"), queue]
		, ["duplicate exit", tap.replace("exit=0", "exit=0\nexit=1"), queue]
		, ["wrong selection", tap.replace("# step c-cpp", "# step npm-r1"), queue]
		, ["wrong producer", tap, queue.replace(reviewedCallbackFinEvidenceRevision, "f".repeat(40))]
		, ["failed queue", tap, queue.replace("exit=0", "exit=1")]
		, ["wrong floor", tap, queue.replace("GLIBC_FLOOR=2.36", "GLIBC_FLOOR=2.38")]
		, ["different queue pattern", tap, queue.replace("pattern=^independently reviewed C and C", "pattern=^other selection")]
		, ["different selected report", tap, queue.replace("REPORT=/app/build/vo1445-reviewed-callback-fin-c-cpp-f9cda04.json", "REPORT=/app/build/other.json")]
		, ["swapped npm report paths", tap, queue.replaceAll("npm-r1-f9cda04.json", "temporary-report-path").replaceAll("npm-r2-f9cda04.json", "npm-r1-f9cda04.json").replaceAll("temporary-report-path", "npm-r2-f9cda04.json")]
		, ["duplicated queue step", tap, queue.replace(/^start c-cpp .+$/mu, line => `${line}\n${line}`)]
		, ["reordered queue", tap, queue.split("\n").map(line => line.startsWith("start npm-r1 ") ? line.replace("start npm-r1 ", "start npm-r2 ") : line.startsWith("start npm-r2 ") ? line.replace("start npm-r2 ", "start npm-r1 ") : line).join("\n")]
	];
	for(const [label, changedTap, changedQueue] of mutations)
		assert.throws(() => assertReviewedCallbackFinExecution(changedTap, changedQueue), assert.AssertionError, label);
});
