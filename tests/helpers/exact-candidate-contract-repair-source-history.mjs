/**
 * Preserve the exact-candidate CI contract and checkout repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const exactCandidateContractRepairHistoryPath
	= "docs/evidence/exact-candidate-contract-repair-source-history-20261101.json";
export const exactCandidateContractRepairPredecessor
	= "98be5ee3c4e49a4255e1b6c99f38b8de8f2b199c";
export const exactCandidateContractRepairImplementation
	= "1eb64a578892a42cc934179cede63964bc9dc4f3";
export const exactCandidateContractRepairImplementationPaths = Object.freeze([
	".github/workflows/consumer-matrix.yml"
	, ".github/workflows/perl-consumer.yml"
	, "tests/helpers/checked-record-perl-ci-workflow-tests.mjs"
	, "tests/helpers/checked-record-promotion-tests.mjs"
	, "tests/helpers/ledger-transition-gap-source-history-tests.mjs"
	, "tests/helpers/native-consumer-partition-tests.mjs"
	, "tests/helpers/native-consumer-partition.mjs"
	, "tests/helpers/nominal-subtype-perl-ci-workflow-tests.mjs"
	, "tests/helpers/perl-fin-archive-source-history-tests.mjs"
	, "tests/helpers/perl-fin-xs-audit-source-history-tests.mjs"
	, "tests/helpers/perl-history-checkout-tests.mjs"
	, "tests/helpers/php-wasm-failure-diagnostics-history-tests.mjs"
	, "tests/helpers/php-wasm-recursive-failure-evidence-tests.mjs"
	, "tests/helpers/reviewed-subtype-host-ci-workflow-tests.mjs"
]);
export const exactCandidateContractRepairIntegrationPaths = Object.freeze([
	"tests/checked-javascript-partition-11.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const exactCandidateContractRepairHistoryAdditions = Object.freeze([
	"scripts/update-exact-candidate-contract-repair-source-history.mjs"
	, "tests/helpers/exact-candidate-contract-repair-source-history-tests.mjs"
	, "tests/helpers/exact-candidate-contract-repair-source-history.mjs"
]);

const historyUrl = new URL(
	"../../" + exactCandidateContractRepairHistoryPath, import.meta.url);
let history;
const record = () => history ??= JSON.parse(readFileSync(historyUrl, "utf8"));
export const exactCandidateContractRepairNormalizationPaths
	= Object.freeze([...new Set([
		...(existsSync(historyUrl) ? record().updates.map(update => update.path)
			: exactCandidateContractRepairImplementationPaths)
		, ...(existsSync(historyUrl)
			? record().integrationUpdates.map(update => update.path) : [])
	])].sort());
const allowedPath = path =>
	exactCandidateContractRepairImplementationPaths.includes(path)
	|| exactCandidateContractRepairIntegrationPaths.includes(path);

const markers = Object.freeze({
	".github/workflows/consumer-matrix.yml": [
		/\n {2}perl-consumer:\n {4}name: Perl\n {4}needs: type-surface-authentication\n {4}uses: [.]\/[.]github\/workflows\/perl-consumer[.]yml\n/u
	]
	, ".github/workflows/perl-consumer.yml": [
		/LEAN_BRIDGE_TYPE_SURFACE_EVIDENCE_RECEIPT: \$\{\{ github[.]workspace \}\}\/build\/consumer-type-surface\/receipt[.]json/u
		, /LEAN_BRIDGE_PERL_SPARSE_CHECKOUT: \|/u
	]
	, "tests/helpers/checked-record-perl-ci-workflow-tests.mjs": [
		/normalizeCheckout/u, /needs: type-surface-authentication/u
	]
	, "tests/helpers/checked-record-promotion-tests.mjs": [
		/historicalTypeSurfaceCells\(document, contracts\)/u
	]
	, "tests/helpers/ledger-transition-gap-source-history-tests.mjs": [
		/sourceAtFinHistoryRecordUpdate/u
		, /const milestone = beforeFinRefinementSource/u
	]
	, "tests/helpers/native-consumer-partition-tests.mjs": [
		/current native values require exactly the authenticated type-surface dependency/u
	]
	, "tests/helpers/native-consumer-partition.mjs": [
		/assert[.]match\(job, \/\^ \{4\}needs: type-surface-authentication\$\//u
	]
	, "tests/helpers/nominal-subtype-perl-ci-workflow-tests.mjs": [
		/needs: type-surface-authentication/u
	]
	, "tests/helpers/perl-fin-archive-source-history-tests.mjs": [
		/sourceAtFinHistoryRecordUpdate/u
	]
	, "tests/helpers/perl-fin-xs-audit-source-history-tests.mjs": [
		/sourceAtFinHistoryRecordUpdate/u
	]
	, "tests/helpers/perl-history-checkout-tests.mjs": [
		/all six reusable Perl checkouts are sparse, blobless and bounded/u
		, /assert[.]equal\(mutations, 39\)/u
	]
	, "tests/helpers/php-wasm-failure-diagnostics-history-tests.mjs": [
		/const checkpointSource = await sourceAtHistoryMilestone/u
	]
	, "tests/helpers/php-wasm-recursive-failure-evidence-tests.mjs": [
		/return execFileSync\("git", \["show", `HEAD:\$\{path\}`\]/u
	]
	, "tests/helpers/reviewed-subtype-host-ci-workflow-tests.mjs": [
		/sourceAtHistoryMilestone\(reviewedSubtypeHostCiHistoryPath, path\)/u
	]
});

/**
 * Require the exact repair semantics in every implementation source.
 *
 * @param path - Repository-relative implementation path.
 * @param source - Complete implementation source.
 */
export const assertExactCandidateContractRepair = (path, source) => {
	assert.ok(exactCandidateContractRepairImplementationPaths.includes(path), path);
	assert.equal(typeof source, "string");
	for(const marker of markers[path]) assert.match(source, marker, path);
	if(path === ".github/workflows/perl-consumer.yml")
	{
		assert.equal(source.split(
			"Restore the authenticated type-surface receipt").length - 1, 6);
		assert.equal(source.split(
			"sparse-checkout: ${{ env.LEAN_BRIDGE_PERL_SPARSE_CHECKOUT }}"
		).length - 1, 6);
	}
	return true;
};

/**
 * Reverse one authenticated exact-candidate repair transition.
 *
 * @param source - Complete later source.
 * @param update - Authenticated reversible transition.
 */
export const reverseExactCandidateContractRepairUpdate = (source, update) => {
	assert.ok(allowedPath(update.path), update.path);
	assert.equal(sha256(source), update.currentSha256, update.path);
	assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
	let cursor = 0;
	const parts = [];
	for(const edit of update.edits)
	{
		assert.deepEqual(Object.keys(edit).sort(), ["current", "previous", "start"]);
		assert.ok(Number.isSafeInteger(edit.start)
			&& edit.start >= cursor && edit.start <= source.length);
		assert.notEqual(edit.previous, edit.current);
		assert.equal(source.slice(edit.start
			, edit.start + edit.current.length), edit.current, update.path);
		parts.push(source.slice(cursor, edit.start), edit.previous);
		cursor = edit.start + edit.current.length;
	}
	parts.push(source.slice(cursor));
	const previous = parts.join("");
	assert.equal(sha256(previous), update.previousSha256, update.path);
	return previous;
};

/**
 * Remove only the authenticated exact-candidate repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact stopping SHA-256.
 */
export const beforeExactCandidateContractRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !exactCandidateContractRepairNormalizationPaths.includes(path))
		return source;
	let current = source;
	for(const updates of [record().integrationUpdates, record().updates])
	{
		if(expected !== undefined && sha256(current) === expected) return current;
		const digest = sha256(current);
		const update = updates.find(item => item.path === path
			&& item.currentSha256 === digest);
		if(update !== undefined)
			current = reverseExactCandidateContractRepairUpdate(current, update);
	}
	return current;
};
