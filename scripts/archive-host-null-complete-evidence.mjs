#!/usr/bin/env node
/**
 * Freeze and independently replay the complete same-run HostNull matrix.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
	access, constants, copyFile, mkdir, mkdtemp, rm, stat, writeFile
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import {
	checkedRecordValueIndexHostedDigest as digestFile
	, extractCheckedRecordValueIndexHostedArtifact as extractArtifact
	, splitCheckedRecordValueIndexHostedArtifact as splitArtifact
} from "../tests/helpers/checked-record-value-index-hosted-archive.mjs";
import {
	hostNullCompleteCells, hostNullCompleteHostedInputs
	, hostNullCompleteHostedLanes, hostNullCompleteHostedOriginal
	, hostNullCompleteHostedSourcePath, hostNullCompleteHostedSources
	, inspectHostNullCompleteHostedArtifacts
	, parseHostNullCompleteHostedArchiveArgs
	, verifyHostNullCompleteExtractedLane
} from "../tests/helpers/host-null-complete-hosted-archive.mjs";

let inputRoot;
try
{ inputRoot = parseHostNullCompleteHostedArchiveArgs(process.argv.slice(2)); }
catch(error)
{ process.stderr.write(`${error.message}\n`); process.exit(2); }

const evidence = "docs/evidence/host-null-complete-20261029";
await assert.rejects(access(evidence), { code: "ENOENT" });
assert.doesNotThrow(() => execFileSync(
	"git", ["diff", "--quiet", "HEAD", "--"], { stdio: "ignore" }
), "Archive generation requires a clean tracked source tree");
const archiveCommit = execFileSync("git", ["rev-parse", "HEAD"], {
	encoding: "utf8"
}).trim();
assert.match(archiveCommit, /^[a-f0-9]{40}$/u);
const selected = await inspectHostNullCompleteHostedArtifacts(inputRoot);
assert.equal(execFileSync("git", [
	"merge-base", "--is-ancestor", selected.producerCommit, archiveCommit
]).length, 0, "Hosted producer must be an ancestor of the archiver");

const descriptors = new Map();
const retainBytes = async (path, value) => {
	assert.ok(!descriptors.has(path), path);
	const bytes = Buffer.from(value), target = join(evidence, path);
	await mkdir(dirname(target), { recursive: true });
	await writeFile(target, bytes, { flag: "wx" });
	descriptors.set(path, { path, bytes: bytes.length, sha256: sha256(bytes) });
};
const retainFile = async (path, source) => {
	assert.ok(!descriptors.has(path), path);
	const information = await stat(source);
	assert.ok(information.isFile() && information.size > 0, source);
	const target = join(evidence, path);
	await mkdir(dirname(target), { recursive: true });
	await copyFile(source, target, constants.COPYFILE_FICLONE);
	const digest = await digestFile(target);
	assert.equal((await stat(target)).size, information.size, path);
	assert.equal(await digestFile(source), digest, path);
	descriptors.set(path, {
		path, bytes: information.size, sha256: digest
	});
};

let complete = false;
await mkdir(evidence);
try
{
	const captures = [];
	for(const selectedLane of hostNullCompleteHostedLanes)
	{
		const inputs = hostNullCompleteHostedInputs(inputRoot, selectedLane);
		const extracted = await extractArtifact(inputs["artifact-zip"]);
		const partsRoot = await mkdtemp(join(
			tmpdir(), `lean-host-null-${selectedLane.id}-zip-`
		));
		try
		{
			const accepted = await verifyHostNullCompleteExtractedLane(
				selectedLane, extracted.root, selected.producerCommit
			);
			for(const path of extracted.entries.filter(path => !path.endsWith("/")))
				await retainFile(`artifacts/${selectedLane.id}/${path}`
					, join(extracted.root, path));
			for(const name of ["run", "job", "artifact"])
				await retainFile(`hosted/${selectedLane.id}/api/${name}.json`
					, inputs[`${name}-json`]);
			const parts = await splitArtifact(inputs["artifact-zip"], partsRoot);
			for(const part of parts)
				await retainFile(
					`hosted/${selectedLane.id}/artifact.zip.parts/${part.name}`
					, part.path
				);
			const hosted = selected.captures.find(item =>
				item.lane === selectedLane.id);
			assert.ok(hosted);
			captures.push(Object.freeze({
				lane: selectedLane.id, profiles: selectedLane.profiles
				, hostedRun: {
					...hosted.hostedRun
					, artifact: {
						...hosted.hostedRun.artifact
						, members: extracted.entries
						, parts: parts.map(part => ({
							path: `hosted/${selectedLane.id}/artifact.zip.parts/${part.name}`
							, offset: part.offset, bytes: part.bytes
							, sha256: part.sha256
						}))
					}
				}
				, accepted
			}));
		}
		finally
		{
			await rm(extracted.root, { recursive: true });
			await rm(partsRoot, { recursive: true });
		}
	}
	const revisions = {
		producer: selected.producerCommit
		, checker: archiveCommit, archiver: archiveCommit
	};
	const selectedSources = hostNullCompleteHostedSources(revisions);
	for(const source of selectedSources)
		await retainBytes(hostNullCompleteHostedSourcePath(source)
			, hostNullCompleteHostedOriginal(source.revision, source.path));
	const files = [...descriptors.values()].sort((left, right) =>
		left.path.localeCompare(right.path));
	assert.equal(new Set(captures.flatMap(capture => capture.accepted.cells)
		.map(cell => `${cell.route}:${cell.profile}:${cell.position}`)).size, 170);
	const index = {
		schemaVersion: 1, kind: "host-null-complete-installed-v1"
		, producerCommit: selected.producerCommit
		, checkerCommit: archiveCommit, archiveCommit
		, runId: selected.runId, captures, cells: hostNullCompleteCells
		, selectedSources, files
		, limitations: [
			"Only the explicit compiler-authenticated HostNull wrapper maps to host null; Option, omitted/default input, Unit, erased proof and unsupported data remain distinct."
			, "The receipt covers seventeen profiles, ordinary and independently reviewed routes, and parameter, result, field, callback-parameter and callback-result positions."
			, "Every cell is backed by source-free installed execution and an exact retained package receipt from one producer revision and workflow run."
			, "Original artifact ZIP bytes, GitHub API records, package handoffs, reports and producer/checker/archiver sources are retained and independently replayed."
			, "External language runtimes, browsers, compilers, Nix and operating-system distributions remain trusted recorded inputs rather than copied toolchains."
			, "This archive records hosted acceptance but does not itself promote the type-surface support table."
		]
	};
	const indexBytes = Buffer.from(canonicalJson(index));
	await writeFile(join(evidence, "index.json"), indexBytes, { flag: "wx" });
	complete = true;
	process.stdout.write(canonicalJson({
		destination: evidence, producerCommit: selected.producerCommit
		, archiveCommit, runId: selected.runId, captures: captures.length
		, cells: hostNullCompleteCells.length, files: files.length + 1
		, bytes: files.reduce((sum, file) => sum + file.bytes, indexBytes.length)
		, indexSha256: sha256(indexBytes)
	}));
}
finally
{
	if(!complete) await rm(evidence, { recursive: true });
}
