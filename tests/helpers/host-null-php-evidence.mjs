/**
 * Authenticate and independently replay retained PHP HostNull evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { assertHostNullPhpReport } from "./host-null-php-report.mjs";
import {
	hostNullPhpHostedEvidenceSources, hostNullPhpHostedOriginal
} from "./host-null-php-hosted-evidence-sources.mjs";
import { hostNullPhpHostedPolicy } from "./host-null-php-hosted-policy.mjs";
import {
	extractCheckedRecordValueIndexHostedArtifact as extractArtifact
	, inspectCheckedRecordValueIndexHostedArtifact as inspectArtifact
} from "./checked-record-value-index-hosted-archive.mjs";

export const hostNullPhpEvidencePins = Object.freeze({
	"php-native": Object.freeze({
		index: "PENDING_HOST_NULL_PHP_NATIVE_INDEX"
		, producer: "PENDING_HOST_NULL_PHP_NATIVE_PRODUCER"
		, archive: "PENDING_HOST_NULL_PHP_ARCHIVE_COMMIT"
	})
	, "php-wasm": Object.freeze({
		index: "PENDING_HOST_NULL_PHP_WASM_INDEX"
		, producer: "PENDING_HOST_NULL_PHP_WASM_PRODUCER"
		, archive: "PENDING_HOST_NULL_PHP_ARCHIVE_COMMIT"
	})
});

const exactKeys = (value, keys, label) => assert.deepEqual(
	Object.keys(value).sort(), [...keys].sort(), label);
const safePath = path => typeof path === "string"
	&& /^[A-Za-z0-9_@.+/-]+$/u.test(path) && !path.startsWith("/")
	&& path.split("/").every(part => part && part !== "." && part !== "..");
const json = (bytes, label) => {
	const value = JSON.parse(bytes);
	assert.equal(bytes.toString(), canonicalJson(value), label); return value;
};
const caches = new Map();

/**
 * Verify every retained byte, reconstruct the Actions ZIP and replay packages.
 *
 * @param profile - Native PHP or PHP-Wasm evidence profile.
 * @param read - Repository-relative evidence byte reader.
 */
export const checkHostNullPhpEvidence = async (
	profile, read = readFile
) => {
	if(read === readFile && caches.has(profile)) return caches.get(profile);
	const checking = (async () => {
		const policy = hostNullPhpHostedPolicy(profile);
		const pins = hostNullPhpEvidencePins[profile];
		const indexPath = `${policy.evidence}/index.json`;
		const indexBytes = Buffer.from(await read(indexPath));
		assert.equal(sha256(indexBytes), pins.index, "index.json");
		const index = json(indexBytes, "index.json"), files = new Map();
		exactKeys(index, [
			"accepted", "archiveCommit", "checkerCommit", "consumerCommit"
			, "files", "hostedRun", "kind", "limitations", "producerCommit"
			, "profile", "schemaVersion", "selectedSources"
		], "index keys");
		assert.equal(index.schemaVersion, 1); assert.equal(index.kind, policy.kind);
		assert.equal(index.profile, profile);
		assert.equal(index.producerCommit, pins.producer);
		assert.equal(index.consumerCommit, pins.producer);
		assert.equal(index.checkerCommit, pins.archive);
		assert.equal(index.archiveCommit, pins.archive);
		assert.deepEqual(index.limitations, policy.limitations);
		let previous = "";
		for(const descriptor of index.files)
		{
			exactKeys(descriptor, ["bytes", "path", "sha256"], "file");
			assert.ok(safePath(descriptor.path) && !files.has(descriptor.path));
			assert.ok(previous === ""
				|| previous.localeCompare(descriptor.path) < 0);
			previous = descriptor.path;
			const bytes = Buffer.from(await read(
				`${policy.evidence}/${descriptor.path}`));
			assert.equal(bytes.length, descriptor.bytes, descriptor.path);
			assert.equal(sha256(bytes), descriptor.sha256, descriptor.path);
			files.set(descriptor.path, bytes);
		}
		const get = path => {
			const bytes = files.get(path); assert.ok(Buffer.isBuffer(bytes), path);
			return bytes;
		};
		const revisions = {
			producer: pins.producer, consumer: pins.producer
			, checker: pins.archive, archiver: pins.archive
		};
		const selectedSources = hostNullPhpHostedEvidenceSources(
			profile, revisions);
		assert.deepEqual(index.selectedSources, selectedSources);
		const expectedPaths = [];
		for(const source of selectedSources)
		{
			const path = `sources/${source.role}/${source.path}`;
			expectedPaths.push(path);
			assert.deepEqual(get(path), hostNullPhpHostedOriginal(
				source.revision, source.path), path);
		}
		const reportPath = `artifact/${policy.reportPath}`;
		const report = json(get(reportPath), policy.reportPath);
		expectedPaths.push(reportPath);

		exactKeys(index.hostedRun, [
			"apiRecords", "artifact", "conclusions", "createdAt", "event"
			, "job", "repository", "runAttempt", "runId", "updatedAt", "url"
			, "workflow"
		], "hosted run");
		const api = {};
		const apiRecords = {};
		for(const name of ["artifact", "job", "run"])
		{
			const path = `hosted/api/${name}.json`, bytes = get(path);
			expectedPaths.push(path); api[name] = bytes;
			apiRecords[name] = {
				bytes: bytes.length, sha256: sha256(bytes)
			};
			assert.deepEqual(index.hostedRun.apiRecords[name]
				, apiRecords[name]);
		}
		let offset = 0; const parts = [];
		for(const part of index.hostedRun.artifact.parts)
		{
			assert.equal(part.offset, offset); const bytes = get(part.path);
			assert.equal(bytes.length, part.bytes);
			assert.equal(sha256(bytes), part.sha256);
			parts.push(bytes); expectedPaths.push(part.path); offset += bytes.length;
		}
		const artifact = Buffer.concat(parts);
		assert.equal(artifact.length, index.hostedRun.artifact.bytes);
		assert.equal(sha256(artifact), index.hostedRun.artifact.sha256);
		const root = await mkdtemp(join(tmpdir(), "lean-host-null-php-evidence-"));
		let extracted;
		try
		{
			const selected = {
				"artifact-zip": join(root, "artifact.zip")
				, "artifact-json": join(root, "artifact.json")
				, "job-json": join(root, "job.json")
				, "run-json": join(root, "run.json")
			};
			await writeFile(selected["artifact-zip"], artifact, { flag: "wx" });
			for(const name of ["artifact", "job", "run"])
				await writeFile(selected[`${name}-json`]
					, api[name], { flag: "wx" });
			const inspected = await inspectArtifact(selected, {
				workflow: ".github/workflows/consumer-matrix.yml"
				, jobName: policy.jobName
				, artifactPrefix: policy.artifactPrefix
				, conclusions: index.hostedRun.conclusions
			});
			assert.equal(inspected.revision, pins.producer);
			extracted = await extractArtifact(selected["artifact-zip"]);
			assert.deepEqual(extracted.entries
				, index.hostedRun.artifact.members);
			assert.deepEqual(index.hostedRun, {
				...inspected.hostedRun, apiRecords
				, artifact: {
					...inspected.hostedRun.artifact
					, members: extracted.entries
					, parts: index.hostedRun.artifact.parts
				}
			});
			for(const path of extracted.entries.filter(path => !path.endsWith("/")))
			{
				const evidencePath = `artifact/${path}`;
				if(!expectedPaths.includes(evidencePath))
					expectedPaths.push(evidencePath);
				assert.deepEqual(await readFile(join(extracted.root, path))
					, get(evidencePath), path);
			}
			const accepted = await assertHostNullPhpReport(report, profile
				, join(extracted.root, policy.packagesPath));
			assert.deepEqual(index.accepted, accepted);
		}
		finally
		{
			if(extracted) await rm(extracted.root, { recursive: true });
			await rm(root, { recursive: true });
		}
		assert.deepEqual([...files.keys()].sort(), expectedPaths.sort());
		return Object.freeze({
			profile, producer: pins.producer, consumer: pins.producer
			, checker: pins.archive, archiver: pins.archive
			, accepted: index.accepted, files: index.files
			, hostedRun: index.hostedRun, limitations: index.limitations
			, hostedAcceptance: true, supportPromoted: false
		});
	})();
	if(read === readFile) caches.set(profile, checking);
	return checking;
};
