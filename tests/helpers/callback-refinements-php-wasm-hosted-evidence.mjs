/**
 * Independently authenticate and replay the immutable hosted Fin and
 * checked-record callback PHP-Wasm archive.
 *
 * @file
 */
import assert from "node:assert/strict";
import { open, readFile, realpath, readdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mkdtemp } from "node:fs/promises";
import { nativeArtifactPaths } from "../../src/build/native-artifacts.mjs";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import {
	callbackRefinementsPhpWasmRecords
	, checkCallbackRefinementsPhpWasmReport
} from "./callback-refinements-php-wasm-report.mjs";
import {
	callbackRefinementsPhpWasmEvidenceSources
	, callbackRefinementsPhpWasmHostedOriginal
} from "./callback-refinements-php-wasm-hosted-evidence-sources.mjs";
import {
	dependentCheckedRecordHostedDigest
	, extractDependentCheckedRecordHostedArtifact
	, inspectDependentCheckedRecordHostedArtifact
} from "./dependent-checked-record-hosted-archive.mjs";

export const callbackRefinementsPhpWasmHostedEvidence
	= "docs/evidence/callback-refinements-php-wasm-20261023";
export const callbackRefinementsPhpWasmHostedEvidenceSha256
	= "297895d119c12fd4dde45763fc18271774a62a6de1130de070528145f7a11208";
const producer = "387f1c1897230beb09c05f7eda17faf70a64b415";
const archiver = "b419c5c84ef45c678bdc14bbb42f7115966f7d3a";
const revisions = Object.freeze({
	producer, consumer: producer, checker: producer, archiver
});
const expectedHosted = Object.freeze({
	workflow: ".github/workflows/callback-refinements-php-wasm.yml"
	, jobName: "Fin and checked-record callbacks in PHP-Wasm"
	, artifactPrefix: "callback-refinements-php-wasm"
});

/**
 * Derive the exact retained API-byte receipt from inspected API records.
 *
 * @param api - Inspected GitHub API byte records.
 */
export const callbackRefinementsPhpWasmHostedApiRecords = api =>
	Object.fromEntries(Object.entries(api).map(([name, item]) => [name, {
		bytes: item.bytes.length, sha256: item.sha256
	}]));

/**
 * Bind every hosted-run field to the retained GitHub API bytes.
 *
 * @param index - Retained evidence index.
 * @param hosted - Independently inspected hosted artifact.
 */
export const assertCallbackRefinementsPhpWasmHostedApiBinding
	= (index, hosted) => {
		const { apiRecords, artifact: retainedArtifact, ...retainedRun }
			= index.hostedRun;
		const { members, parts, ...artifact } = retainedArtifact;
		assert.ok(Array.isArray(members));
		assert.ok(Array.isArray(parts) && parts.length > 0);
		assert.deepEqual({ ...retainedRun, artifact }, hosted.hostedRun);
		assert.deepEqual(apiRecords
			, callbackRefinementsPhpWasmHostedApiRecords(hosted.api));
	};

/**
 * Require the retained output tree to equal the authenticated ZIP files.
 *
 * @param index - Retained evidence index.
 * @param paths - Regular files extracted from the original artifact ZIP.
 */
export const assertCallbackRefinementsPhpWasmHostedOutputSet
	= (index, paths) => {
		const retained = index.files.filter(file =>
			file.path.startsWith("hosted/output/"))
			.map(file => file.path.slice("hosted/output/".length)).sort();
		assert.deepEqual(retained, [...paths].sort());
	};

/**
 * Reassemble an exact artifact ZIP from ordered authenticated parts.
 *
 * @param root - Evidence root containing every part.
 * @param parts - Ordered byte ranges from the evidence index.
 * @param target - Fresh output path.
 */
export const reconstructCallbackRefinementsPhpWasmHostedArtifact = async (
	root, parts, target
) => {
	const output = await open(target, "wx");
	try
	{
		let offset = 0;
		for(const part of parts)
		{
			assert.deepEqual(Object.keys(part).sort(), [
				"bytes", "offset", "path", "sha256"
			]);
			assert.equal(part.offset, offset);
			const bytes = await readFile(join(root, part.path));
			assert.equal(bytes.length, part.bytes);
			assert.equal(sha256(bytes), part.sha256);
			await output.write(bytes, 0, bytes.length, offset);
			offset += bytes.length;
		}
		return offset;
	}
	finally
	{ await output.close(); }
};

const replay = async (outputRoot, revision) => {
	assert.deepEqual((await readdir(outputRoot)).sort(), [
		"host.log", "records", "run.tap", "runtime.log", "verification.json"
	]);
	const tap = await readFile(join(outputRoot, "run.tap"), "utf8");
	assert.match(tap
		, /^ok \d+ - installed callback refinements PHP-Wasm reproduce and relocate every author route$/mu);
	for(const line of ["# fail 0", "# skipped 0"])
		assert.equal(tap.split("\n").filter(item => item === line).length, 1, line);
	const recordsRoot = join(outputRoot, "records");
	assert.deepEqual((await readdir(recordsRoot)).sort()
		, ["checked-record", "fin", "index.json"]);
	const recordIndexBytes = await readFile(join(recordsRoot, "index.json"));
	const recordIndex = JSON.parse(recordIndexBytes);
	assert.equal(recordIndexBytes.toString(), canonicalJson(recordIndex));
	assert.deepEqual(Object.keys(recordIndex).sort(), [
		"kind", "producerCommit", "profiles", "schemaVersion"
	]);
	assert.equal(recordIndex.schemaVersion, 1);
	assert.equal(recordIndex.kind, "callback-refinements-php-wasm-installed-v1");
	assert.equal(recordIndex.producerCommit, revision);
	const results = [], profiles = [];
	for(const profile of ["fin", "checked-record"])
	{
		const profileRoot = join(recordsRoot, profile);
		const profilePaths = [
			"ordinary", "request-composer.json", "request-embedded.json"
			, "reviewed", "strict.php", "weak.php"
		];
		if(profile === "checked-record")
			profilePaths.push("reviewed.binding-ir.json");
		assert.deepEqual((await readdir(profileRoot)).sort()
			, profilePaths.sort());
		const reports = []; let reviewedBindingIr;
		for(const route of ["ordinary", "reviewed"])
		{
			const routeRoot = join(profileRoot, route);
			const read = path => readFile(join(routeRoot, path));
			const result = await checkCallbackRefinementsPhpWasmReport(read, {
				profile, route, producerCommit: revision
			});
			results.push(result);
			const reportBytes = await read("report.json");
			const report = JSON.parse(reportBytes);
			const handoff = [
				"handoff/package-set-receipt.json"
				, "handoff/package-set-receipt.json.sha256"
				, ...report.receipt.packages.flatMap(pkg => pkg.artifacts.map(
					item => `handoff/${item.path}`))
			];
			assert.deepEqual(await nativeArtifactPaths(routeRoot), [
				...callbackRefinementsPhpWasmRecords(profile, route), ...handoff
			].sort(), `${profile}/${route} record closure`);
			for(const name of [
				"weak.php", "strict.php", "request-embedded.json"
				, "request-composer.json"
			]) assert.deepEqual(await readFile(join(profileRoot, name))
				, await read(`deployment/${name}`), `${profile}/${route}/${name}`);
			const reviewed = await read("reviewed.binding-ir.json");
			if(reviewedBindingIr === undefined) reviewedBindingIr = reviewed;
			else assert.deepEqual(reviewed, reviewedBindingIr
				, `${profile}/${route}/reviewed.binding-ir.json`);
			reports.push({
				route, reportSha256: sha256(reportBytes)
				, bindingIrSha256: report.phpWasm.component.bindingIrSha256
				, executions: report.phpWasm.executions.length
			});
		}
		if(profile === "checked-record")
		{
			const retainedReviewed = await readFile(join(
				profileRoot, "reviewed.binding-ir.json"));
			assert.deepEqual(retainedReviewed, reviewedBindingIr
				, `${profile}/reviewed.binding-ir.json`);
		}
		profiles.push({ profile, reports });
	}
	assert.deepEqual(recordIndex.profiles, profiles);
	const accepted = { schemaVersion: 1, results };
	assert.equal(await readFile(join(outputRoot, "verification.json"), "utf8")
		, JSON.stringify(accepted) + "\n");
	return { profiles, accepted };
};

let cached;

/**
 * Validate every retained byte, rebuild the original ZIP and replay all four
 * callback-refinement routes from the retained workflow output.
 */
export const checkCallbackRefinementsPhpWasmHostedEvidence = async () => {
	if(cached) return cached;
	const root = await realpath(callbackRefinementsPhpWasmHostedEvidence);
	const indexBytes = await readFile(join(root, "index.json"));
	assert.equal(sha256(indexBytes)
		, callbackRefinementsPhpWasmHostedEvidenceSha256);
	const index = JSON.parse(indexBytes);
	assert.equal(indexBytes.toString(), canonicalJson(index));
	assert.deepEqual(Object.keys(index).sort(), [
		"accepted", "archiveCommit", "checkerCommit", "consumerCommit"
		, "files", "hostedRun", "kind", "limitations", "producerCommit"
		, "profiles", "schemaVersion", "selectedSources"
	]);
	assert.equal(index.schemaVersion, 1);
	assert.equal(index.kind
		, "callback-refinements-php-wasm-hosted-installed-v1");
	assert.deepEqual({
		producer: index.producerCommit, consumer: index.consumerCommit
		, checker: index.checkerCommit, archiver: index.archiveCommit
	}, revisions);
	assert.equal(index.limitations.length, 6);
	assert.deepEqual(index.files, [...index.files].sort((left, right) =>
		left.path.localeCompare(right.path)));
	assert.equal(new Set(index.files.map(file => file.path)).size
		, index.files.length);
	for(const file of index.files)
	{
		assert.deepEqual(Object.keys(file).sort(), ["bytes", "path", "sha256"]);
		assert.ok(Number.isSafeInteger(file.bytes) && file.bytes >= 0);
		assert.match(file.sha256, /^[a-f0-9]{64}$/u);
	}
	const expectedPaths = ["index.json", ...index.files.map(file => file.path)]
		.sort();
	assert.deepEqual(await nativeArtifactPaths(root), expectedPaths);
	for(const file of index.files)
	{
		const path = join(root, file.path), information = await stat(path);
		assert.equal(information.size, file.bytes, file.path);
		assert.equal(await dependentCheckedRecordHostedDigest(path)
			, file.sha256, file.path);
	}
	const sources = callbackRefinementsPhpWasmEvidenceSources(revisions);
	assert.deepEqual(index.selectedSources, sources);
	for(const source of sources)
	{
		const retainedSource = await readFile(join(
			root, `sources/${source.role}/${source.path}`));
		assert.deepEqual(retainedSource
			, callbackRefinementsPhpWasmHostedOriginal(
				source.revision, source.path)
			, `${source.role}/${source.path}`);
	}

	const temporary = await mkdtemp(join(
		tmpdir(), "lean-bridge-callback-refinements-evidence-"));
	let extracted;
	try
	{
		const zip = join(temporary, "artifact.zip");
		const bytes = await reconstructCallbackRefinementsPhpWasmHostedArtifact(
			root, index.hostedRun.artifact.parts, zip);
		assert.equal(bytes, index.hostedRun.artifact.bytes);
		assert.equal(await dependentCheckedRecordHostedDigest(zip)
			, index.hostedRun.artifact.sha256);
		const api = name => join(root, `hosted/api/${name}.json`);
		const hosted = await inspectDependentCheckedRecordHostedArtifact({
			"artifact-zip": zip, "run-json": api("run")
			, "job-json": api("job"), "artifact-json": api("artifact")
		}, expectedHosted);
		assert.equal(hosted.revision, producer);
		assertCallbackRefinementsPhpWasmHostedApiBinding(index, hosted);
		extracted = await extractDependentCheckedRecordHostedArtifact(zip);
		assert.deepEqual(extracted.entries, index.hostedRun.artifact.members);
		const extractedPaths = await nativeArtifactPaths(extracted.root);
		assertCallbackRefinementsPhpWasmHostedOutputSet(index, extractedPaths);
		for(const path of extractedPaths)
			assert.deepEqual(await readFile(join(extracted.root, path))
				, await readFile(join(root, "hosted/output", path)), path);
		const replayed = await replay(join(root, "hosted/output"), producer);
		assert.deepEqual(index.profiles, replayed.profiles);
		assert.deepEqual(index.accepted, replayed.accepted);
	}
	finally
	{
		if(extracted) await rm(extracted.root, { recursive: true });
		await rm(temporary, { recursive: true });
	}
	cached = Object.freeze({ index, ...revisions });
	return cached;
};
