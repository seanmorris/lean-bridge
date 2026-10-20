/**
 * Promote only the closed value-index npm/browser cells authenticated by the
 * hosted archive. Nested fields and callback positions remain untouched.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { sha256 } from "../../src/capsule/node.mjs";
import {
	checkCheckedRecordValueIndexBrowserEvidence
	, checkedRecordValueIndexBrowserEvidence
	, checkedRecordValueIndexBrowserEvidenceSha256
	, checkedRecordValueIndexBrowserEvidenceRevisions
} from "./checked-record-value-index-browser-evidence.mjs";

export const checkedRecordValueIndexBrowserPromotionParent
	= "0da7d1d6054a87de82082b4d2afad7bf5e30048e";
export const checkedRecordValueIndexBrowserPromotionProfiles = Object.freeze([
	"node-javascript", "node-typescript", "browser-javascript"
	, "browser-react", "browser-worker"
]);
export const checkedRecordValueIndexBrowserPromotionConversion
	= "Closed Bool, String and Nat indices stay in authenticated type metadata and are not host fields. JavaScript and TypeScript pass proof-free objects: On, Off, EmptyToken, UnicodeToken, ZeroToken and WideToken expose count: bigint; Ab exposes size: bigint; EmptySized exposes data: bigint[]. The full package checks records indexed by both booleans, \"ab\", the empty string, \"λ🌱\", zero and 340282366920938463463374607431768211457 through the exact selected Lean constructors, preserves rejected caller values and recovers on the next valid call. Standalone result-only packages return the same proof-free objects without input-constructor metadata.";
export const checkedRecordValueIndexBrowserPromotionLimit
	= "Hosted npm/browser value-index acceptance covers only the archived top-level copied checked-record parameter and result sites with closed Bool, String and Nat indices. Full packages cover parameters and results; standalone result-only packages cover results only. Open or opaque indices; Int, Char, fixed-width and platform-width integers, Fin, functions, proofs, instances and other index kinds; checked-record fields, callbacks and owned positions; value-carrying dependent payloads; and zero-payload checked records remain unreviewed here. Other host targets require separate installed evidence. The Ubuntu 24.04 run records exact Node and browser versions but not peak memory or constructor-dispatch counts. Complete component/runtime npm archives and original workflow records are retained; external toolchains remain trusted recorded inputs.";
export const checkedRecordValueIndexBrowserNatOnlyLimit
	= "Only closed Nat literal indices. General dependent runtime payloads, other index kinds, zero-payload proofs and open generic records remain required and unpromoted.";

const hostedCommand
	= "bash scripts/run-checked-record-value-index-browser-ci.sh \"$PWD/build/lean-link-spike/lazy\"";
const validators = Object.freeze([
	".github/workflows/checked-record-value-index-browser.yml"
	, "scripts/check-checked-record-value-index-browser-ci.mjs"
	, "scripts/run-checked-record-value-index-browser-ci.sh"
	, "scripts/promote-checked-record-value-index-browser.mjs"
	, "tests/helpers/checked-record-value-index-browser-ci-report.mjs"
	, "tests/helpers/checked-record-value-index-browser-controls.mjs"
	, "tests/helpers/checked-record-value-index-browser-evidence.mjs"
	, "tests/helpers/checked-record-value-index-browser-evidence-tests.mjs"
	, "tests/helpers/checked-record-value-index-browser-report.mjs"
	, "tests/helpers/checked-record-value-index-browser-promotion.mjs"
	, "tests/helpers/checked-record-value-index-browser-promotion-tests.mjs"
]);
const promotionPins = Object.freeze([
	"docs/evidence/README.md"
	, "docs/evidence/checked-record-value-index-browser-promotion-20261019.md"
	, "docs/javascript-typescript.md"
	, "docs/lean/existing-package.md"
	, "docs/lean/export-decisions.md"
	, "docs/reference/types.md"
	, "scripts/generate-type-docs.mjs"
	, "scripts/promote-checked-record-value-index-browser.mjs"
	, "tests/checked-record-value-index-browser.test.mjs"
	, "tests/helpers/checked-record-value-index-browser-promotion.mjs"
	, "tests/helpers/checked-record-value-index-browser-promotion-tests.mjs"
	, "tests/type-surface.test.mjs"
]);

const routeSourcePath = route => route.replace(/^result-only-/u, "");
const routeMode = route => route.startsWith("result-only-")
	? "result-only" : "full";
const replaceHostedBoundary = source => source.replace(
	"No hosted CI execution is inferred."
	, "The hosted value-index archive separately establishes exact GitHub Actions execution."
);

/**
 * Derive four promotion references only after replaying the complete hosted
 * artifact and authenticating every frozen source byte.
 *
 * @param read - Repository-relative evidence reader.
 */
export const checkedRecordValueIndexBrowserPromotionReferences = async (
	read = readFile
) => {
	const checked = await checkCheckedRecordValueIndexBrowserEvidence(read);
	const revisions = checkedRecordValueIndexBrowserEvidenceRevisions();
	assert.equal(checked.hostedAcceptance, true);
	assert.equal(checked.supportPromoted, false);
	assert.deepEqual(Object.fromEntries(Object.keys(revisions).map(key => [
		key, checked[key]
	])), revisions);
	const references = [];
	for(const route of checked.routes)
	{
		const mode = routeMode(route.route);
		const resultOnly = mode === "result-only";
		const selected = checked.files.filter(file =>
			file.path.startsWith(`${route.route}/`)
			|| file.path.startsWith("sources/")
			|| file.path.startsWith("hosted/"));
		const browserList = Object.entries(checked.browserVersions)
			.map(([name, version]) => `${name} ${version}`).join(", ");
		const scope = `Hosted GitHub Actions run ${checked.hostedRun.runId} at ${revisions.producer} rebuilt all four npm/browser selections on Ubuntu 24.04. This ${mode} ${routeSourcePath(route.route)} selection reproduces complete component and shared-runtime npm archives from two author roots, removes author sources, installs offline, relocates the installed tree and replays unchanged Node JavaScript and strict TypeScript callers. ${browserList} execute page, React production/StrictMode and dedicated-worker consumers for ${route.browserExecutions} browser executions and ${route.lifecycleObservations} lifecycle observations. ${resultOnly ? "The standalone result-only API exposes all eight proof-free indexed results without checked-input metadata." : "The full API exercises all eight checked inputs, exact constructor failures, unchanged rejected values, recovery and all eight proof-free indexed results."} The archive authenticates the original workflow, job, artifact, TAP, controls, reports, package receipts and exact source identities. ${checkedRecordValueIndexBrowserPromotionLimit}`;
		references.push({
			id: `checked-record-value-index-browser-${route.route}-hosted-installed`
			, route: route.route, mode, resultOnly
			, sourcePath: routeSourcePath(route.route)
			, profiles: [...checkedRecordValueIndexBrowserPromotionProfiles]
			, positions: resultOnly ? ["result"] : ["parameter", "result"]
			, revision: revisions.producer
			, npmCheckerRevision: revisions.npmChecker
			, consumerRevision: revisions.consumer
			, checkerRevision: revisions.checker
			, archiverRevision: revisions.archiver
			, hostedRun: checked.hostedRun.runId
			, artifact: checked.hostedRun.artifact.id
			, command: hostedCommand, counts: route, scope
			, files: [
				{
					path: `${checkedRecordValueIndexBrowserEvidence}/index.json`
					, sha256: checkedRecordValueIndexBrowserEvidenceSha256
				}
				, ...selected.map(file => ({
					path: `${checkedRecordValueIndexBrowserEvidence}/${file.path}`
					, sha256: file.sha256
				}))
			]
			, artifacts: [route.receipt.package, route.receipt.runtime].map(item => ({
				path: item.archive, sha256: item.sha256
			}))
		});
	}
	return references;
};

/**
 * Supplement exactly twenty top-level copied cells without changing fields,
 * callbacks or any prior evidence.
 *
 * @param original - Exact inventory before hosted value-index promotion.
 * @param references - Four independently authenticated hosted selections.
 */
export const promoteCheckedRecordValueIndexBrowsers = async (
	original, references
) => {
	assert.deepEqual(references
		, await checkedRecordValueIndexBrowserPromotionReferences());
	const inventory = structuredClone(original);
	const sources = await Promise.all(validators.map(async path => ({
		path, sha256: sha256(await readFile(path))
	})));
	for(const reference of references)
	{
		assert.ok(!inventory.evidence.some(item => item.id === reference.id)
			, "Already promoted: " + reference.id);
		inventory.evidence.push({
			id: reference.id, kind: "installed", revision: reference.revision
			, command: reference.command, scope: reference.scope
			, files: [...sources, ...reference.files]
			, artifacts: reference.artifacts.map(item => ({
				...item, path: `${reference.id}/${item.path}`
			}))
		});
	}
	for(const profile of checkedRecordValueIndexBrowserPromotionProfiles)
		for(const sourcePath of ["ordinary-source", "reviewed-ir"])
			for(const position of ["parameter", "result"])
			{
				const matches = references.filter(item =>
					item.sourcePath === sourcePath
					&& item.positions.includes(position));
				assert.equal(matches.length, position === "result" ? 2 : 1);
				const observations = inventory.observations.filter(item =>
					item.profiles.includes(profile) && item.path === sourcePath
					&& item.shapes.includes("checked-record")
					&& item.positions.includes(position));
				assert.equal(observations.length, 1
					, `Missing or overlapping value-index cell: ${profile}/${sourcePath}/${position}`);
				const observation = observations[0];
				assert.deepEqual(observation.profiles, [profile]);
				assert.deepEqual(observation.shapes, ["checked-record"]);
				assert.deepEqual(observation.positions, [position]);
				const ids = matches.map(item => item.id);
				const scope = matches.map(item => item.scope).join(" ");
				observation.scope = replaceHostedBoundary(observation.scope)
					+ " Additional hosted closed-index acceptance: " + scope;
				observation.conversionNotes["checked-record"]
					= replaceHostedBoundary(
						observation.conversionNotes["checked-record"])
					+ " " + checkedRecordValueIndexBrowserPromotionConversion;
				observation.limitations = observation.limitations
					.filter(value => value
						!== checkedRecordValueIndexBrowserNatOnlyLimit)
					.map(replaceHostedBoundary)
					.filter((value, index, values) =>
						values.indexOf(value) === index);
				observation.limitations.push(
					checkedRecordValueIndexBrowserPromotionLimit);
				for(const stage of Object.values(observation.stages))
				{
					assert.equal(stage.state, "passed");
					stage.evidence.push(...ids);
					assert.equal(new Set(stage.evidence).size
						, stage.evidence.length);
					stage.note = replaceHostedBoundary(stage.note)
						+ " Additional hosted closed-index acceptance: " + scope;
				}
			}
	const pins = new Map(await Promise.all(promotionPins.map(async path => [
		path, sha256(await readFile(path))
	])));
	for(const entry of inventory.evidence) for(const file of entry.files)
		if(pins.has(file.path)) file.sha256 = pins.get(file.path);
	return inventory;
};

/** Read the immutable inventory that immediately precedes this promotion. */
export const checkedRecordValueIndexBrowserPromotionBaseline = () =>
	JSON.parse(execFileSync("git", ["show"
		, `${checkedRecordValueIndexBrowserPromotionParent}:docs/type-surface.v1.json`]
	, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }));
