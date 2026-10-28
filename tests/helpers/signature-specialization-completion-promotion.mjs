/**
 * Bind the exact remaining signature cells to the immutable ten-lane archive.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import {
	signatureSpecializationHostedEvidenceDirectory
	, signatureSpecializationHostedLanes
} from "./signature-specialization-hosted-archive.mjs";

export const signatureSpecializationCompletionEvidenceId
	= "hosted-signature-specializations-installed";
export const signatureSpecializationCompletionPinBaseline
	= "60f6c69a5a9de9969715e0333d72d0a73588c876";
export const signatureSpecializationCompletionIndexPath
	= `${signatureSpecializationHostedEvidenceDirectory}/index.json`;

const cells = (profiles, shapes, path) => profiles.flatMap(profile =>
	shapes.map(shape => `${profile}/${shape}/${path}/signature`));
export const signatureSpecializationNativeProfiles = Object.freeze([
	"python", "ruby", "rust", "dotnet", "java", "kotlin"
	, "php-native", "wit-wasi", "perl"
]);
export const signatureSpecializationBrowserProfiles = Object.freeze([
	"browser-javascript", "browser-react", "browser-worker"
]);
export const signatureSpecializationShapes = Object.freeze([
	"generic", "implicit", "instance"
]);
/** Exact 45-cell completion scope, independent of inventory ordering. */
export const signatureSpecializationCompletionTargetCells = Object.freeze([
	...cells(signatureSpecializationNativeProfiles
		, signatureSpecializationShapes, "reviewed-ir")
	, ...cells(signatureSpecializationBrowserProfiles
		, ["instance"], "ordinary-source")
	, ...cells(signatureSpecializationBrowserProfiles
		, signatureSpecializationShapes, "reviewed-ir")
	, ...cells(["php-wasm"], signatureSpecializationShapes, "ordinary-source")
	, ...cells(["php-wasm"], signatureSpecializationShapes, "reviewed-ir")
]);
assert.equal(signatureSpecializationCompletionTargetCells.length, 45);
assert.equal(new Set(signatureSpecializationCompletionTargetCells).size, 45);

const validators = Object.freeze([
	"scripts/promote-signature-specialization-completion.mjs"
	, "tests/helpers/signature-specialization-completion-promotion.mjs"
	, "tests/helpers/signature-specialization-completion-promotion-tests.mjs"
	, "tests/helpers/signature-specialization-hosted-archive.mjs"
	, "tests/helpers/signature-specialization-hosted-evidence.mjs"
	, "tests/helpers/signature-specialization-hosted-tests.mjs"
	, "tests/signature-specialization-hosted-evidence.test.mjs"
]);

/**
 * Authenticate the archive index before describing its evidence entry.
 */
export const signatureSpecializationCompletionReference = async () => {
	const bytes = await readFile(signatureSpecializationCompletionIndexPath);
	const index = JSON.parse(bytes);
	assert.equal(bytes.toString(), canonicalJson(index));
	assert.equal(index.schemaVersion, 1);
	assert.equal(index.kind, "signature-specializations-hosted-installed-v1");
	assert.match(index.checkerCommit, /^[a-f0-9]{40}$/u);
	assert.match(index.archiveCommit, /^[a-f0-9]{40}$/u);
	assert.deepEqual(Object.keys(index.producerCommits)
		, signatureSpecializationHostedLanes.map(lane => lane.id));
	assert.deepEqual(index.producerCommits, Object.fromEntries(
		signatureSpecializationHostedLanes.map(lane => [
			lane.id, lane.producerCommit
		])
	));
	assert.deepEqual(index.lanes.map(lane => lane.id)
		, signatureSpecializationHostedLanes.map(lane => lane.id));
	assert.equal(new Set(index.lanes.map(
		lane => lane.hostedRun.artifact.sha256)).size, 10);
	const artifacts = index.lanes.flatMap(lane => {
		const artifact = lane.hostedRun.artifact;
		assert.ok(Array.isArray(artifact.parts) && artifact.parts.length > 0
			, lane.id);
		let offset = 0;
		const parts = artifact.parts.map(part => {
			assert.equal(part.offset, offset, part.path);
			assert.ok(Number.isSafeInteger(part.bytes) && part.bytes > 0
				, part.path);
			offset += part.bytes;
			return { path: part.path, sha256: part.sha256 };
		});
		assert.equal(offset, artifact.bytes, lane.id);
		return parts;
	});
	assert.equal(new Set(artifacts.map(item => item.path)).size
		, artifacts.length);
	const files = await Promise.all([
		signatureSpecializationCompletionIndexPath, ...validators
	].map(async path => ({ path, sha256: sha256(await readFile(path)) })));
	return Object.freeze({ index, artifacts, files });
};
