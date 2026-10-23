#!/usr/bin/env node
/**
 * Freeze the successful hosted Fin and checked-record callback PHP-Wasm
 * artifact after independently replaying all four author/profile routes.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
	access, constants, copyFile, mkdir, mkdtemp, readFile, readdir, rm, stat
	, writeFile
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { nativeArtifactPaths } from "../src/build/native-artifacts.mjs";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import {
	callbackRefinementsPhpWasmRecords
	, checkCallbackRefinementsPhpWasmReport
} from "../tests/helpers/callback-refinements-php-wasm-report.mjs";
import {
	callbackRefinementsPhpWasmEvidenceSources
	, callbackRefinementsPhpWasmHostedOriginal
} from "../tests/helpers/callback-refinements-php-wasm-hosted-evidence-sources.mjs";
import {
	dependentCheckedRecordHostedDigest
	, extractDependentCheckedRecordHostedArtifact
	, inspectDependentCheckedRecordHostedArtifact
	, parseDependentCheckedRecordHostedArchiveArgs
	, splitDependentCheckedRecordHostedArtifact
} from "../tests/helpers/dependent-checked-record-hosted-archive.mjs";

const repository = fileURLToPath(new URL("..", import.meta.url));
process.chdir(repository);
const usage = "Usage: archive-callback-refinements-php-wasm-evidence.mjs --artifact-zip /absolute/artifact.zip --run-json /absolute/run.json --job-json /absolute/job.json --artifact-json /absolute/artifact.json";
let selected;
try
{
	selected = parseDependentCheckedRecordHostedArchiveArgs(
		process.argv.slice(2), usage);
}
catch(error)
{
	process.stderr.write(`${error.message}\n`); process.exit(2);
}

const evidence = "docs/evidence/callback-refinements-php-wasm-20261023";
await assert.rejects(access(evidence), { code: "ENOENT" });
const status = execFileSync("git", [
	"-C", repository, "status", "--porcelain=v1", "--untracked-files=all"
	, "--", "."
], { encoding: "utf8" });
assert.equal(status, ""
	, "Archive generation requires a clean tracked and untracked source tree");
const archiveCommit = execFileSync("git", [
	"-C", repository, "rev-parse", "HEAD"
], { encoding: "utf8" }).trim();
assert.match(archiveCommit, /^[a-f0-9]{40}$/u);
const hosted = await inspectDependentCheckedRecordHostedArtifact(selected, {
	workflow: ".github/workflows/callback-refinements-php-wasm.yml"
	, jobName: "Fin and checked-record callbacks in PHP-Wasm"
	, artifactPrefix: "callback-refinements-php-wasm"
});
const revision = hosted.revision, revisions = {
	producer: revision, consumer: revision, checker: revision
	, archiver: archiveCommit
};
const descriptors = new Map();
const putBytes = (path, value) => {
	assert.ok(!descriptors.has(path), path);
	const bytes = Buffer.from(value);
	descriptors.set(path, {
		bytes: bytes.length, sha256: sha256(bytes), value: bytes
	});
};
const putFile = async (path, source) => {
	assert.ok(!descriptors.has(path), path);
	const information = await stat(source);
	assert.ok(information.isFile(), source);
	descriptors.set(path, {
		bytes: information.size
		, sha256: await dependentCheckedRecordHostedDigest(source), source
	});
};

const extracted = await extractDependentCheckedRecordHostedArtifact(
	selected["artifact-zip"]);
const partsRoot = await mkdtemp(join(
	tmpdir(), "lean-bridge-callback-refinements-php-wasm-zip-"));
try
{
	assert.deepEqual((await readdir(extracted.root)).sort(), [
		"host.log", "records", "run.tap", "runtime.log", "verification.json"
	]);
	const tap = await readFile(join(extracted.root, "run.tap"), "utf8");
	assert.match(tap
		, /^ok \d+ - installed callback refinements PHP-Wasm reproduce and relocate every author route$/mu);
	for(const line of ["# fail 0", "# skipped 0"])
		assert.equal(tap.split("\n").filter(item => item === line).length, 1, line);

	const recordsRoot = join(extracted.root, "records");
	assert.deepEqual((await readdir(recordsRoot)).sort()
		, ["checked-record", "fin", "index.json"]);
	const retainedIndexBytes = await readFile(join(recordsRoot, "index.json"));
	const retainedIndex = JSON.parse(retainedIndexBytes);
	assert.equal(retainedIndexBytes.toString(), canonicalJson(retainedIndex));
	assert.deepEqual(Object.keys(retainedIndex).sort(), [
		"kind", "producerCommit", "profiles", "schemaVersion"
	]);
	assert.equal(retainedIndex.schemaVersion, 1);
	assert.equal(retainedIndex.kind
		, "callback-refinements-php-wasm-installed-v1");
	assert.equal(retainedIndex.producerCommit, revision);

	const results = [], profileReceipts = [];
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
		profileReceipts.push({ profile, reports });
	}
	assert.deepEqual(retainedIndex.profiles, profileReceipts);
	const accepted = { schemaVersion: 1, results };
	const verification = await readFile(join(extracted.root, "verification.json"));
	assert.equal(verification.toString(), JSON.stringify(accepted) + "\n"
		, "Hosted verification must exactly match independent route replay");

	for(const path of await nativeArtifactPaths(extracted.root))
		await putFile(`hosted/output/${path}`, join(extracted.root, path));
	for(const [name, item] of Object.entries(hosted.api))
		putBytes(`hosted/api/${name}.json`, item.bytes);
	const parts = await splitDependentCheckedRecordHostedArtifact(
		selected["artifact-zip"], partsRoot);
	for(const part of parts)
		await putFile(`hosted/artifact.zip.parts/${part.name}`, part.path);
	const selectedSources = callbackRefinementsPhpWasmEvidenceSources(revisions);
	for(const source of selectedSources)
		putBytes(`sources/${source.role}/${source.path}`
			, callbackRefinementsPhpWasmHostedOriginal(
				source.revision, source.path));
	const files = [...descriptors].sort(([left], [right]) =>
		left.localeCompare(right)).map(([path, descriptor]) =>
		({ path, bytes: descriptor.bytes, sha256: descriptor.sha256 }));
	const index = {
		schemaVersion: 1
		, kind: "callback-refinements-php-wasm-hosted-installed-v1"
		, producerCommit: revision, consumerCommit: revision
		, checkerCommit: revision, archiveCommit
		, profiles: profileReceipts, accepted
		, hostedRun: {
			...hosted.hostedRun
			, apiRecords: Object.fromEntries(Object.entries(hosted.api).map(
				([name, item]) => [name
					, { bytes: item.bytes.length, sha256: item.sha256 }]))
			, artifact: {
				...hosted.hostedRun.artifact, members: extracted.entries
				, parts: parts.map(({ name, offset, bytes, sha256: digest }) => ({
					path: `hosted/artifact.zip.parts/${name}`
					, offset, bytes, sha256: digest
				}))
			}
		}
		, selectedSources, files
		, limitations: [
			"The fixtures cover copied Fin and proof-erased checked-record values at host callback arguments and replies and at returned Lean closure arguments and results."
			, "Ordinary Lean source and independently reviewed Binding IR each reproduce source-free installed PHP-Wasm packages, install offline and execute after relocation in Node and Chromium."
			, "The retained executions cover mixed and nested copied callback values, first-error behavior, cleanup and recovery; retained or asynchronous callbacks and owned callback values remain separate work."
			, "The original GitHub artifact ZIP, API records, complete workflow output and exact production, consumption, checking and archiving source closures are retained byte-for-byte."
			, "External Lean, PHP, Composer, Chromium, Nix, Emscripten and operating-system distributions remain trusted inputs represented by recorded identities rather than copied toolchains."
			, "This archive establishes hosted PHP-Wasm acceptance only; aggregate support promotion remains a separate inventory change."
		]
	};

	await mkdir(evidence);
	for(const [path, descriptor] of descriptors)
	{
		const target = join(evidence, path);
		await mkdir(dirname(target), { recursive: true });
		if(descriptor.source)
			await copyFile(descriptor.source, target, constants.COPYFILE_FICLONE);
		else await writeFile(target, descriptor.value, { flag: "wx" });
		assert.equal((await stat(target)).size, descriptor.bytes, path);
		assert.equal(await dependentCheckedRecordHostedDigest(target)
			, descriptor.sha256, path);
	}
	const indexBytes = Buffer.from(canonicalJson(index));
	await writeFile(join(evidence, "index.json"), indexBytes, { flag: "wx" });
	const totalBytes = files.reduce((sum, file) => sum + file.bytes
		, indexBytes.length);
	process.stdout.write(canonicalJson({
		destination: evidence, files: files.length + 1
		, bytes: totalBytes, ...revisions, hostedRun: index.hostedRun
		, indexSha256: sha256(indexBytes)
	}));
}
finally
{
	await rm(extracted.root, { recursive: true });
	await rm(partsRoot, { recursive: true });
}
