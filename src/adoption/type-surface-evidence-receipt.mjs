/**
 * Bind one completed type-surface evidence pass to its exact workflow commit.
 *
 * The receipt is an intra-workflow handoff, not retained mathematical evidence.
 * Its producer hashes every cited file before writing it; consumers recheck the
 * complete inventory contract and exact Git revision before trusting that pass.
 *
 * @file
 */
import assert from "node:assert/strict";
import { canonicalJson, sha256 } from "../capsule/node.mjs";

const digestPattern = /^[a-f0-9]{64}$/u;
const commitPattern = /^[a-f0-9]{40}$/u;
const sourcePaths = Object.freeze([
	"docs/type-surface.v1.json"
	, "schema/binding-ir.schema.json"
	, "docs/consumer-support.v1.json"
]);

/**
 * Collapse repeated evidence citations into unique exact path/digest records.
 *
 * @param document - Parsed type-surface inventory.
 */
export const typeSurfaceEvidenceFiles = document => {
	assert.ok(Array.isArray(document?.evidence));
	const files = new Map();
	for(const evidence of document.evidence)
		for(const file of evidence.files)
		{
			assert.equal(typeof file?.path, "string");
			assert.match(file.sha256, digestPattern);
			const previous = files.get(file.path);
			if(previous !== undefined)
				assert.equal(file.sha256, previous
					, `Conflicting evidence digest: ${file.path}`);
			files.set(file.path, file.sha256);
		}
	return Object.freeze([...files].map(([path, sha256]) => ({ path, sha256 }))
		.toSorted((left, right) => left.path.localeCompare(right.path)));
};

/**
 * Collapse repeated evidence citations into one exact path/digest contract.
 *
 * @param document - Parsed type-surface inventory.
 */
export const typeSurfaceEvidenceContract = document => {
	const entries = typeSurfaceEvidenceFiles(document);
	return Object.freeze({
		count: entries.length, sha256: sha256(canonicalJson(entries))
	});
};

/**
 * Construct the handoff only after its caller completes full byte validation.
 *
 * @param input - Exact authenticated inputs.
 * @param input.commit - Workflow Git revision.
 * @param input.document - Validated type-surface inventory.
 * @param input.sourceSha256 - Digests of the three governing JSON documents.
 */
export const createTypeSurfaceEvidenceReceipt = ({
	commit, document, sourceSha256
}) => {
	assert.match(commit, commitPattern);
	assert.deepEqual(Object.keys(sourceSha256).sort(), [...sourcePaths].sort());
	for(const digest of Object.values(sourceSha256)) assert.match(digest, digestPattern);
	return {
		schemaVersion: 1
		, kind: "lean-bridge-type-surface-evidence-v1"
		, commit
		, contractVersion: document.contractVersion
		, sources: Object.fromEntries(sourcePaths.map(path => [path, sourceSha256[path]]))
		, evidence: typeSurfaceEvidenceContract(document)
	};
};

/**
 * Authenticate a receipt against the exact inventory inputs used by a shard.
 *
 * @param receipt - Parsed receipt artifact.
 * @param input - Current exact workflow inputs.
 * @param input.commit - Current Git revision.
 * @param input.document - Current validated inventory.
 * @param input.sourceSha256 - Current governing-document digests.
 */
export const assertTypeSurfaceEvidenceReceipt = (receipt, {
	commit, document, sourceSha256
}) => {
	assert.deepEqual(Object.keys(receipt).sort(), [
		"commit", "contractVersion", "evidence", "kind", "schemaVersion", "sources"
	]);
	assert.equal(receipt.schemaVersion, 1);
	assert.equal(receipt.kind, "lean-bridge-type-surface-evidence-v1");
	assert.equal(receipt.commit, commit);
	assert.equal(receipt.contractVersion, document.contractVersion);
	assert.deepEqual(receipt.sources
		, createTypeSurfaceEvidenceReceipt({
			commit, document, sourceSha256
		}).sources);
	assert.deepEqual(receipt.evidence, typeSurfaceEvidenceContract(document));
	return true;
};

export const typeSurfaceEvidenceSourcePaths = sourcePaths;
