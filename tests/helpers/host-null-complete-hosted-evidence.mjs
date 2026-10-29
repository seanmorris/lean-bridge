/**
 * Authenticate and independently replay the complete hosted HostNull archive.
 *
 * @file
 */
import assert from "node:assert/strict";
import {
	mkdir, mkdtemp, open, readFile, rm, writeFile
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import {
	checkedRecordValueIndexHostedDigest as digestFile
	, extractCheckedRecordValueIndexHostedArtifact as extractArtifact
} from "./checked-record-value-index-hosted-archive.mjs";
import {
	hostNullCompleteCells, hostNullCompleteHostedInputs
	, hostNullCompleteHostedLanes, hostNullCompleteHostedOriginal
	, hostNullCompleteHostedSourcePath, hostNullCompleteHostedSources
	, inspectHostNullCompleteHostedArtifacts
	, verifyHostNullCompleteExtractedLane
} from "./host-null-complete-hosted-archive.mjs";

export const hostNullCompleteHostedEvidence
	= "docs/evidence/host-null-complete-20261029";
export const hostNullCompleteHostedEvidencePins = Object.freeze({
	index: "PENDING_HOST_NULL_COMPLETE_INDEX"
	, producer: "PENDING_HOST_NULL_COMPLETE_PRODUCER"
	, archive: "PENDING_HOST_NULL_COMPLETE_ARCHIVE"
	, runId: 0
});

const exactKeys = (value, keys, label) => assert.deepEqual(
	Object.keys(value).sort(), [...keys].sort(), label
);
const safePath = path => typeof path === "string" && path.length > 0
	&& !/[\0\r\n]/u.test(path) && !path.startsWith("/")
	&& path.split("/").every(part => part && part !== "." && part !== ".."
		&& (/^[A-Za-z0-9_$@.+-]+$/u.test(part)
			|| part === "[Content_Types].xml"));
const json = (bytes, label) => {
	const value = JSON.parse(bytes);
	assert.equal(bytes.toString(), canonicalJson(value), label);
	return value;
};
let cached;

/**
 * Verify every retained byte, reconstruct all original Actions ZIPs, replay
 * every package receipt and prove the exact 170-cell union.
 *
 * @param read - Repository-relative evidence byte reader.
 */
export const checkHostNullCompleteHostedEvidence = async (
	read = readFile
) => {
	if(read === readFile && cached) return cached;
	const checking = (async () => {
		const pins = hostNullCompleteHostedEvidencePins;
		assert.match(pins.index, /^[a-f0-9]{64}$/u);
		assert.match(pins.producer, /^[a-f0-9]{40}$/u);
		assert.match(pins.archive, /^[a-f0-9]{40}$/u);
		assert.ok(Number.isSafeInteger(pins.runId) && pins.runId > 0);
		const indexPath = `${hostNullCompleteHostedEvidence}/index.json`;
		const indexBytes = Buffer.from(await read(indexPath));
		assert.equal(sha256(indexBytes), pins.index, "index.json");
		const index = json(indexBytes, "index.json"), files = new Map();
		exactKeys(index, [
			"archiveCommit", "captures", "cells", "checkerCommit", "files"
			, "kind", "limitations", "producerCommit", "runId"
			, "schemaVersion", "selectedSources"
		], "index keys");
		assert.equal(index.schemaVersion, 1);
		assert.equal(index.kind, "host-null-complete-installed-v1");
		assert.equal(index.producerCommit, pins.producer);
		assert.equal(index.checkerCommit, pins.archive);
		assert.equal(index.archiveCommit, pins.archive);
		assert.equal(index.runId, pins.runId);
		assert.deepEqual(index.cells, hostNullCompleteCells);
		assert.equal(index.cells.length, 170);
		assert.equal(index.limitations.length, 6);
		let previous = "";
		for(const descriptor of index.files)
		{
			exactKeys(descriptor, ["bytes", "path", "sha256"], "file");
			assert.ok(safePath(descriptor.path) && !files.has(descriptor.path));
			assert.ok(previous === ""
				|| previous.localeCompare(descriptor.path) < 0);
			previous = descriptor.path;
			assert.ok(Number.isSafeInteger(descriptor.bytes)
				&& descriptor.bytes > 0);
			assert.match(descriptor.sha256, /^[a-f0-9]{64}$/u);
			const bytes = Buffer.from(await read(
				`${hostNullCompleteHostedEvidence}/${descriptor.path}`
			));
			assert.equal(bytes.length, descriptor.bytes, descriptor.path);
			assert.equal(sha256(bytes), descriptor.sha256, descriptor.path);
			files.set(descriptor.path, bytes);
		}
		const get = path => {
			const bytes = files.get(path);
			assert.ok(Buffer.isBuffer(bytes), path); return bytes;
		};
		const revisions = {
			producer: pins.producer, checker: pins.archive, archiver: pins.archive
		};
		const selectedSources = hostNullCompleteHostedSources(revisions);
		assert.deepEqual(index.selectedSources, selectedSources);
		const expectedPaths = [];
		for(const source of selectedSources)
		{
			const path = hostNullCompleteHostedSourcePath(source);
			expectedPaths.push(path);
			assert.deepEqual(get(path), hostNullCompleteHostedOriginal(
				source.revision, source.path), path);
		}
		assert.deepEqual(index.captures.map(item => item.lane)
			, hostNullCompleteHostedLanes.map(item => item.id));
		const flattened = index.captures.flatMap(capture =>
			capture.accepted.cells);
		assert.deepEqual(flattened.map(({ lane, receiptSha256, ...cell }) => {
			assert.equal(lane.length > 0, true);
			assert.match(receiptSha256, /^[a-f0-9]{64}$/u);
			return cell;
		}), hostNullCompleteCells);

		const root = await mkdtemp(join(tmpdir(), "lean-host-null-complete-evidence-"));
		try
		{
			for(const capture of index.captures)
			{
				const selectedLane = hostNullCompleteHostedLanes.find(
					item => item.id === capture.lane
				);
				assert.ok(selectedLane);
				assert.deepEqual(capture.profiles, selectedLane.profiles);
				const inputs = hostNullCompleteHostedInputs(root, selectedLane);
				await mkdir(join(root, selectedLane.id));
				for(const name of ["run", "job", "artifact"])
				{
					const path = `hosted/${selectedLane.id}/api/${name}.json`;
					expectedPaths.push(path);
					await writeFile(inputs[`${name}-json`], get(path), { flag: "wx" });
				}
				let offset = 0;
				const output = await open(inputs["artifact-zip"], "wx");
				try
				{
					for(const part of capture.hostedRun.artifact.parts)
					{
						exactKeys(part, [
							"bytes", "offset", "path", "sha256"
						], "artifact part");
						assert.equal(part.offset, offset);
						const bytes = get(part.path);
						expectedPaths.push(part.path);
						assert.equal(bytes.length, part.bytes);
						assert.equal(sha256(bytes), part.sha256);
						let written = 0;
						while(written < bytes.length)
						{
							const result = await output.write(bytes, written
								, bytes.length - written, offset + written);
							assert.ok(result.bytesWritten > 0);
							written += result.bytesWritten;
						}
						offset += bytes.length;
					}
				}
				finally
				{ await output.close(); }
				assert.equal(offset, capture.hostedRun.artifact.bytes);
				assert.equal(await digestFile(inputs["artifact-zip"])
					, capture.hostedRun.artifact.sha256);
			}
			const selected = await inspectHostNullCompleteHostedArtifacts(
				root, pins.producer
			);
			assert.equal(selected.runId, pins.runId);
			for(const capture of index.captures)
			{
				const selectedLane = hostNullCompleteHostedLanes.find(
					item => item.id === capture.lane
				);
				const selectedCapture = selected.captures.find(
					item => item.lane === capture.lane
				);
				assert.ok(selectedCapture);
				assert.deepEqual(capture.hostedRun, {
					...selectedCapture.hostedRun
					, artifact: {
						...selectedCapture.hostedRun.artifact
						, members: capture.hostedRun.artifact.members
						, parts: capture.hostedRun.artifact.parts
					}
				});
				const inputs = hostNullCompleteHostedInputs(root, selectedLane);
				const extracted = await extractArtifact(inputs["artifact-zip"]);
				try
				{
					assert.deepEqual(extracted.entries
						, capture.hostedRun.artifact.members);
					const artifactFiles = extracted.entries.filter(
						item => !item.endsWith("/"));
					for(const path of artifactFiles)
					{
						const evidencePath = `artifacts/${selectedLane.id}/${path}`;
						expectedPaths.push(evidencePath);
						assert.deepEqual(await readFile(join(extracted.root, path))
							, get(evidencePath), evidencePath);
					}
					const accepted = await verifyHostNullCompleteExtractedLane(
						selectedLane, extracted.root, pins.producer
					);
					assert.deepEqual(accepted, capture.accepted);
				}
				finally
				{ await rm(extracted.root, { recursive: true }); }
			}
		}
		finally
		{ await rm(root, { recursive: true }); }
		assert.deepEqual([...files.keys()].sort(), expectedPaths.sort());
		return Object.freeze({
			producerCommit: pins.producer, archiveCommit: pins.archive
			, runId: pins.runId, captures: index.captures
			, cells: index.cells, files: index.files
			, hostedAcceptance: true, supportPromoted: false
		});
	})();
	if(read === readFile) cached = checking;
	return checking;
};
