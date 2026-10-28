#!/usr/bin/env node
/**
 * Freeze both successful hosted reviewed Fin Wasm-entry artifacts after
 * independently replaying all original/probe reports.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
	access, constants, copyFile, mkdir, mkdtemp, readFile, readdir, realpath
	, rm, stat, writeFile
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { nativeArtifactPaths } from "../src/build/native-artifacts.mjs";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import {
	checkedRecordValueIndexHostedDigest
	, extractCheckedRecordValueIndexHostedArtifact
	, splitCheckedRecordValueIndexHostedArtifact
} from "../tests/helpers/checked-record-value-index-hosted-archive.mjs";
import {
	assertReviewedFinWasmEntryHostedChecker
	, inspectReviewedFinWasmEntryHostedArtifact
	, parseReviewedFinWasmEntryHostedArchiveArgs
	, reviewedFinWasmEntryHostedEvidenceDirectory
	, reviewedFinWasmEntryHostedInputs
	, reviewedFinWasmEntryHostedModes
	, reviewedFinWasmEntryHostedOriginal
	, reviewedFinWasmEntryHostedSources
} from "../tests/helpers/reviewed-fin-wasm-entry-hosted-archive.mjs";
import {
	checkWasmEntryCiRun, wasmEntryCiReports
} from "../tests/helpers/reviewed-fin-wasm-entry-ci.mjs";
import {
	recountReviewedFinWasmEntryReport
} from "../tests/helpers/reviewed-fin-wasm-entry-producer.mjs";
import {
	expectReviewedFinWasmEntry
} from "../tests/helpers/reviewed-fin-wasm-entry.mjs";

let inputRoot;
try
{
	inputRoot = parseReviewedFinWasmEntryHostedArchiveArgs(
		process.argv.slice(2));
}
catch(error)
{
	process.stderr.write(`${error.message}\n`); process.exit(2);
}
assert.equal(await realpath(inputRoot), inputRoot
	, "Hosted input root must be canonical");
assert.deepEqual((await readdir(inputRoot)).sort(), [
	...reviewedFinWasmEntryHostedModes, "run.json"
].sort());
for(const mode of reviewedFinWasmEntryHostedModes)
	assert.deepEqual((await readdir(join(inputRoot, mode))).sort(), [
		"artifact.json", "artifact.zip", "job.json", "job.log"
	]);
await assert.rejects(access(reviewedFinWasmEntryHostedEvidenceDirectory)
	, { code: "ENOENT" });
assert.doesNotThrow(() => execFileSync(
	"git", ["diff", "--quiet", "HEAD", "--"], { stdio: "ignore" }
), "Archive generation requires a clean tracked source tree");
const archiveCommit = execFileSync("git", ["rev-parse", "HEAD"], {
	encoding: "utf8"
}).trim();
assert.match(archiveCommit, /^[a-f0-9]{40}$/u);

const descriptors = new Map();
const stagingRoot = await mkdtemp(join(
	tmpdir(), "lean-bridge-reviewed-fin-wasm-hosted-staging-"));
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
	const staged = join(stagingRoot, path);
	await mkdir(dirname(staged), { recursive: true });
	await copyFile(source, staged, constants.COPYFILE_FICLONE);
	descriptors.set(path, {
		bytes: information.size
		, sha256: await checkedRecordValueIndexHostedDigest(staged)
		, source: staged
	});
};

let revision, commonRun;
const legs = [];
for(const mode of reviewedFinWasmEntryHostedModes)
{
	const selected = reviewedFinWasmEntryHostedInputs(inputRoot, mode);
	const hosted = await inspectReviewedFinWasmEntryHostedArtifact(
		selected, mode);
	revision ??= hosted.revision;
	assert.equal(hosted.revision, revision, `${mode} revision drift`);
	commonRun ??= hosted.api.run.bytes;
	assert.deepEqual(hosted.api.run.bytes, commonRun, `${mode} run drift`);
	const extracted = await extractCheckedRecordValueIndexHostedArtifact(
		selected["artifact-zip"]);
	const partsRoot = await mkdtemp(join(
		tmpdir(), `lean-bridge-reviewed-fin-wasm-${mode}-zip-`));
	try
	{
		const expected = [
			"run.tap", ...wasmEntryCiReports(mode).map(name => `${name}.json`)
		].sort();
		assert.deepEqual(await nativeArtifactPaths(extracted.root), expected);
		const tap = await readFile(join(extracted.root, "run.tap"), "utf8");
		const reportBytes = Object.fromEntries(await Promise.all(
			wasmEntryCiReports(mode).map(async name => [
				name, await readFile(join(extracted.root, `${name}.json`))
			])
		));
		const accepted = await checkWasmEntryCiRun({
			mode, tap, files: expected
			, reports: Object.fromEntries(Object.entries(reportBytes).map(
				([name, bytes]) => [name, JSON.parse(bytes)]))
			, recount: async (report, reportMode, selection, engines) =>
				recountReviewedFinWasmEntryReport(report
					, await expectReviewedFinWasmEntry(selection, reportMode)
					, { engines: [...engines] })
		});
		for(const path of expected)
			await putFile(`observations/${mode}/${path}`
				, join(extracted.root, path));
		putBytes(`observations/${mode}/independent-verification.json`
			, canonicalJson(accepted));
		await putFile(`hosted/${mode}/job.log`, selected["job-log"]);
		putBytes(`hosted/api/${mode}/job.json`, hosted.api.job.bytes);
		putBytes(`hosted/api/${mode}/artifact.json`
			, hosted.api.artifact.bytes);
		const parts = await splitCheckedRecordValueIndexHostedArtifact(
			selected["artifact-zip"], partsRoot);
		for(const part of parts)
			await putFile(`hosted/${mode}/artifact.zip.parts/${part.name}`
				, part.path);
		legs.push({
			mode, accepted
			, hostedRun: {
				...hosted.hostedRun
				, apiRecords: {
					run: { bytes: hosted.api.run.bytes.length
						, sha256: hosted.api.run.sha256 }
					, job: { bytes: hosted.api.job.bytes.length
						, sha256: hosted.api.job.sha256 }
					, artifact: { bytes: hosted.api.artifact.bytes.length
						, sha256: hosted.api.artifact.sha256 }
				}
				, artifact: {
					...hosted.hostedRun.artifact, members: extracted.entries
					, parts: parts.map(({
						name, offset, bytes, sha256: digest
					}) => ({
						path: `hosted/${mode}/artifact.zip.parts/${name}`
						, offset, bytes, sha256: digest
					}))
				}
			}
		});
	}
	finally
	{
		await rm(extracted.root, { recursive: true });
		await rm(partsRoot, { recursive: true });
	}
}
putBytes("hosted/api/run.json", commonRun);
const revisions = {
	producer: revision, checker: revision, archiver: archiveCommit
};
await assertReviewedFinWasmEntryHostedChecker(revision);
const selectedSources = reviewedFinWasmEntryHostedSources(revisions);
for(const source of selectedSources)
	putBytes(`sources/${source.role}/${source.path}`
		, reviewedFinWasmEntryHostedOriginal(source.revision, source.path));
const files = [...descriptors].sort(([left], [right]) =>
	left.localeCompare(right)).map(([path, descriptor]) => ({
	path, bytes: descriptor.bytes, sha256: descriptor.sha256
	}));
const index = {
	schemaVersion: 1, kind: "reviewed-fin-wasm-entry-hosted-v1"
	, producerCommit: revision, checkerCommit: revision, archiveCommit
	, profiles: [
		"node-javascript", "node-typescript", "browser-javascript"
		, "browser-react", "browser-worker"
	]
	, engines: ["chromium", "firefox", "webkit"]
	, legs, selectedSources, files
	, limitations: [
		"The two hosted legs cover original and instrumented-probe ordinary-source and independently reviewed copied Fin entry positions in Node JavaScript, strict TypeScript, Chromium, Firefox and WebKit pages, React production and StrictMode lifecycles, and dedicated workers."
		, "The promotion scope is limited to the eight previously unreviewed copied-field cells: reviewed Node JavaScript/TypeScript fields and ordinary plus reviewed browser JavaScript/React/worker fields. Existing parameter/result cells retain their earlier evidence."
		, "Each report is independently recounted across 53 Node/browser context, engine and phase observations. The original artifact ZIPs, API identities, complete job logs, reports, TAP and selected exact source snapshots are retained."
		, "The retained selected sources are not a complete transitive source or toolchain closure. External browser, Node, Lean, Nix and operating-system distributions remain trusted recorded inputs."
	]
};

await mkdir(reviewedFinWasmEntryHostedEvidenceDirectory);
for(const [path, descriptor] of descriptors)
{
	const target = join(reviewedFinWasmEntryHostedEvidenceDirectory, path);
	await mkdir(dirname(target), { recursive: true });
	if(descriptor.source) await copyFile(
		descriptor.source, target, constants.COPYFILE_FICLONE);
	else await writeFile(target, descriptor.value, { flag: "wx" });
	assert.equal((await stat(target)).size, descriptor.bytes, path);
	assert.equal(await checkedRecordValueIndexHostedDigest(target)
		, descriptor.sha256, path);
}
const indexBytes = Buffer.from(canonicalJson(index));
await writeFile(join(reviewedFinWasmEntryHostedEvidenceDirectory
	, "index.json"), indexBytes, { flag: "wx" });
await rm(stagingRoot, { recursive: true });
process.stdout.write(canonicalJson({
	destination: reviewedFinWasmEntryHostedEvidenceDirectory
	, files: files.length + 1
	, bytes: files.reduce((sum, file) => sum + file.bytes
		, indexBytes.length)
	, ...revisions
	, legs: legs.map(leg => ({
		mode: leg.mode, artifact: leg.hostedRun.artifact
	}))
	, indexSha256: sha256(indexBytes)
}));
