/**
 * Preserve the exact hosted WIT dependent checked-record archive and verifier.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const dependentCheckedRecordWitArchiveHistoryPath
	= "docs/evidence/dependent-checked-record-wit-archive-source-history-20261023.json";
export const dependentCheckedRecordWitArchivePredecessor
	= "0cb1ddd2c0154444c209af32e0c2181f6e6c49f8";
export const dependentCheckedRecordWitArchiveCommit
	= "57a88dd93005bbd8de2097c4aa6d49fc1bf9679a";
export const dependentCheckedRecordWitArchiveCompletionPredecessor
	= "1a1cc8a63f8bf1440fd5c0f7ce246e65ad64bd13";
export const dependentCheckedRecordWitArchiveCompletionCommit
	= "7760fc947d882d256146b4ac5b52368570be80e2";
export const dependentCheckedRecordWitArchiveVerifierPredecessor
	= "502d8aa47cdc06e4ad00555bfb85ab19055f0d74";
export const dependentCheckedRecordWitArchiveImplementation
	= "1a1cc8a63f8bf1440fd5c0f7ce246e65ad64bd13";
export const dependentCheckedRecordWitArchiveRoot
	= "docs/evidence/dependent-checked-record-wit-20261021";
export const dependentCheckedRecordWitArchiveIndexSha256
	= "dad34a2e2961fb9008d02e9abe96d5bd0543f47ed2b72405ac8c345a455a109a";
export const dependentCheckedRecordWitArchiveIndexedFileCount = 1205;
export const dependentCheckedRecordWitArchiveInitialFileCount = 1205;
export const dependentCheckedRecordWitArchiveFileCount = 1206;
export const dependentCheckedRecordWitArchiveCompletedPaths = Object.freeze([
	"docs/evidence/dependent-checked-record-wit-20261021/hosted/logs/toolchain.log"
]);
export const dependentCheckedRecordWitArchiveFoundationAddedPaths
	= Object.freeze([
		"tests/helpers/dependent-checked-record-wit-evidence-tests.mjs"
		, "tests/helpers/dependent-checked-record-wit-evidence.mjs"
	]);
export const dependentCheckedRecordWitArchiveImplementationPaths
	= Object.freeze([
		"tests/helpers/zero-payload-checked-record-hosted-evidence.mjs"
		, "tests/native-subtype.test.mjs"
	]);
export const dependentCheckedRecordWitArchiveIntegrationPaths
	= Object.freeze([
		"tests/helpers/fin-refinement-source-history.mjs"
		, "tests/native-subtype.test.mjs"
	]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	dependentCheckedRecordWitArchiveHistoryPath, "utf8"));
const reverse = (source, update, paths) => {
	assert.ok(paths.includes(update.path), update.path);
	assert.equal(sha256(source), update.currentSha256, update.path);
	assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
	let cursor = 0;
	const parts = [];
	for(const edit of update.edits)
	{
		assert.deepEqual(Object.keys(edit).sort()
			, ["current", "previous", "start"]);
		assert.ok(Number.isSafeInteger(edit.start)
			&& edit.start >= cursor && edit.start <= source.length);
		assert.equal(typeof edit.previous, "string");
		assert.equal(typeof edit.current, "string");
		assert.notEqual(edit.previous, edit.current);
		assert.equal(source.slice(edit.start
			, edit.start + edit.current.length), edit.current);
		parts.push(source.slice(cursor, edit.start), edit.previous);
		cursor = edit.start + edit.current.length;
	}
	parts.push(source.slice(cursor));
	const previous = parts.join("");
	assert.equal(sha256(previous), update.previousSha256, update.path);
	return previous;
};

/**
 * Reverse one exact WIT verifier implementation transition.
 *
 * @param source - Complete current source text.
 * @param update - Exact verifier transition record.
 */
export const reverseDependentCheckedRecordWitArchiveImplementation = (
	source, update
) => reverse(source, update
	, dependentCheckedRecordWitArchiveImplementationPaths);

/**
 * Reverse one exact WIT archive-history integration transition.
 *
 * @param source - Complete current source text.
 * @param update - Exact history-integration transition record.
 */
export const reverseDependentCheckedRecordWitArchiveIntegration = (
	source, update
) => reverse(source, update
	, dependentCheckedRecordWitArchiveIntegrationPaths);

/**
 * Remove this exact WIT archive verifier and its history integration.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact stopping SHA-256.
 */
export const beforeDependentCheckedRecordWitArchiveSource = (
	path, source, expected
) => {
	if(typeof source !== "string") return source;
	const selected = [
		...dependentCheckedRecordWitArchiveIntegrationPaths
		, ...dependentCheckedRecordWitArchiveImplementationPaths
	];
	if(!selected.includes(path)) return source;
	let digest = sha256(source);
	if(digest === expected) return source;
	const integration = record().integrationUpdates.find(item =>
		item.path === path && item.currentSha256 === digest);
	if(integration)
	{
		source = reverseDependentCheckedRecordWitArchiveIntegration(
			source, integration);
		digest = sha256(source);
		if(digest === expected) return source;
	}
	const implementation = record().implementationUpdates.find(item =>
		item.path === path && item.currentSha256 === digest);
	return implementation
		? reverseDependentCheckedRecordWitArchiveImplementation(
			source, implementation)
		: source;
};
