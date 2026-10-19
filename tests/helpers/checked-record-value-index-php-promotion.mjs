/**
 * Promote only the four closed top-level native-PHP value-index cells that
 * the retained hosted archive authenticates.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { sha256 } from "../../src/capsule/node.mjs";
import {
	checkCheckedRecordValueIndexPhpEvidence
	, checkedRecordValueIndexPhpEvidence
	, checkedRecordValueIndexPhpEvidenceSha256
} from "./checked-record-value-index-php-evidence.mjs";

export const checkedRecordValueIndexPhpPromotionParent
	= "93896ab11021e1c021e801f6c8ba7ac4ffbdf182";
export const checkedRecordValueIndexPhpPromotionProfiles
	= Object.freeze(["php-native"]);
export const checkedRecordValueIndexPhpPromotionConversion
	= "Closed Bool, String and Nat indices remain authenticated metadata rather than PHP fields. Native PHP uses `Brick\\Math\\BigInteger` for `count`, `size` and every `EmptySized.data` element. Full packages exercise both weak and strict callers, generated constructor-time `ValueError` for negative Nat inputs, unchanged rejected values, recovery and proof-free results; standalone result-only packages expose the same copied records without checked-input metadata.";
export const checkedRecordValueIndexPhpPromotionLimit
	= "Hosted native-PHP value-index acceptance covers only the archived top-level copied checked-record parameter and result sites with closed Bool, String and Nat indices. Full packages cover parameters and results; standalone result-only packages cover results only. Open or opaque indices; Int, Char, fixed-width and platform-width integers, Fin, functions, proofs, instances and other index kinds; checked-record fields, callbacks and owned positions; value-carrying dependent payloads; and zero-payload checked records remain unreviewed here. PHP-Wasm and all other host targets require separate installed evidence. The Ubuntu 24.04 run retains exact PHP, Composer, FFI and glibc identities, but not peak-memory or constructor-dispatch measurements. Complete Composer archives, receipts, reports, controls, original workflow records and source closures are retained; external toolchains remain trusted recorded inputs.";
export const checkedRecordValueIndexPhpNatOnlyLimit
	= "Only closed Nat literal indices. General dependent runtime payloads, other index kinds, zero-payload proofs and open generic records remain required and unpromoted.";

const command = "bash scripts/run-checked-record-value-index-php-ci.sh /usr/bin/php8.3 /usr/bin/composer";
const validators = Object.freeze([
	".github/workflows/checked-record-value-index-php.yml"
	, "scripts/check-checked-record-value-index-php-ci.mjs"
	, "scripts/run-checked-record-value-index-php-ci.sh"
	, "tests/helpers/checked-record-value-index-php-ci-report.mjs"
	, "tests/helpers/checked-record-value-index-php-controls.mjs"
	, "tests/helpers/checked-record-value-index-php-evidence.mjs"
	, "tests/helpers/checked-record-value-index-php-evidence-tests.mjs"
	, "tests/helpers/checked-record-value-index-php-package.mjs"
	, "tests/helpers/checked-record-value-index-php-installed-tests.mjs"
	, "tests/helpers/checked-record-value-index-php-promotion.mjs"
	, "tests/helpers/checked-record-value-index-php-promotion-tests.mjs"
	, "scripts/promote-checked-record-value-index-php.mjs"
]);
const pinPaths = Object.freeze([
	"docs/evidence/README.md"
	, "docs/evidence/checked-record-value-index-php-promotion-20261019.md"
	, "docs/lean/existing-package.md", "docs/lean/export-decisions.md"
	, "docs/php.md", "docs/reference/types.md", "docs/type-surface.v1.json"
	, "scripts/generate-type-docs.mjs"
	, ...validators, "tests/checked-record-value-index-php.test.mjs"
]);
const routeSourcePath = route => route.replace(/^result-only-/u, "");
const resultOnly = route => route.startsWith("result-only-");

/** Authenticate four exact hosted selections before exposing their references. */
export const checkedRecordValueIndexPhpPromotionReferences = async () => {
	const checked = await checkCheckedRecordValueIndexPhpEvidence();
	assert.equal(checked.hostedAcceptance, true);
	assert.equal(checked.supportPromoted, false);
	assert.deepEqual(checked.accepted.map(item => item.route), [
		"ordinary-source", "reviewed-ir", "result-only-ordinary-source"
		, "result-only-reviewed-ir"
	]);
	return checked.accepted.map(accepted => {
		const mode = resultOnly(accepted.route) ? "result-only" : "full";
		const files = checked.files.filter(file => file.path.startsWith(
			`${accepted.route}/`) || file.path.startsWith("hosted/")
			|| file.path.startsWith("sources/"));
		const scope = `Hosted GitHub Actions run ${checked.hostedRun.runId} rebuilt this ${mode} ${routeSourcePath(accepted.route)} native-PHP Composer selection on Ubuntu 24.04. Two author roots reproduce a complete package, remove author and build roots, install offline, relocate the installation and replay unchanged weak and strict callers. ${resultOnly(accepted.route) ? "The standalone result-only API exposes all eight proof-free indexed records without checked-input metadata." : "The full API exercises all eight checked inputs, exact constructor refusals, unchanged rejected values, recovery and all eight proof-free indexed results."} The archive authenticates original workflow, job, artifact, toolchain log, TAP, controls, reports, Composer receipts and exact source identities. ${checkedRecordValueIndexPhpPromotionLimit}`;
		return {
			id: `checked-record-value-index-php-${accepted.route}-hosted-installed`
			, route: accepted.route, mode, sourcePath: routeSourcePath(accepted.route)
			, resultOnly: resultOnly(accepted.route)
			, profiles: [...checkedRecordValueIndexPhpPromotionProfiles]
			, positions: resultOnly(accepted.route) ? ["result"] : ["parameter", "result"]
			, revision: checked.producer, consumerRevision: checked.consumer
			, checkerRevision: checked.checker, archiverRevision: checked.archiver
			, hostedRun: checked.hostedRun.runId, artifact: checked.hostedRun.artifact.id
			, counts: accepted, command, scope
			, files: [
				{ path: `${checkedRecordValueIndexPhpEvidence}/index.json`
					, sha256: checkedRecordValueIndexPhpEvidenceSha256 }
				, ...files.map(file => ({
					path: `${checkedRecordValueIndexPhpEvidence}/${file.path}`
					, sha256: file.sha256
				}))
			]
			, artifacts: [{
				path: `${accepted.route}/records/handoff/archives/example-checkedrecordvalueindices-1.0.0-linux-x86_64.zip`
				, sha256: accepted.archiveSha256
			}]
		};
	});
};

/**
 * Promote exactly four native-PHP top-level checked-record observations.
 *
 * @param original - Exact inventory before this promotion.
 * @param references - Four independently authenticated hosted selections.
 */
export const promoteCheckedRecordValueIndexPhp = async (original, references) => {
	assert.deepEqual(references, await checkedRecordValueIndexPhpPromotionReferences());
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
	for(const path of ["ordinary-source", "reviewed-ir"])
		for(const position of ["parameter", "result"])
		{
			const matches = references.filter(reference => reference.sourcePath === path
				&& reference.positions.includes(position));
			assert.equal(matches.length, position === "result" ? 2 : 1);
			const observations = inventory.observations.filter(item =>
				item.profiles.length === 1 && item.profiles[0] === "php-native"
				&& item.shapes.length === 1 && item.shapes[0] === "checked-record"
				&& item.path === path && item.positions.length === 1
				&& item.positions[0] === position);
			assert.equal(observations.length, 1, `Missing or overlapping PHP cell: ${path}/${position}`);
			const observation = observations[0], ids = matches.map(item => item.id);
			const scope = matches.map(item => item.scope).join(" ");
			observation.scope += " Additional hosted closed-index acceptance: " + scope;
			observation.conversionNotes["checked-record"] += " "
				+ checkedRecordValueIndexPhpPromotionConversion;
			observation.limitations = observation.limitations.filter(value =>
				value !== checkedRecordValueIndexPhpNatOnlyLimit);
			observation.limitations.push(checkedRecordValueIndexPhpPromotionLimit);
			for(const stage of Object.values(observation.stages))
			{
				assert.equal(stage.state, "passed"); stage.evidence.push(...ids);
				assert.equal(new Set(stage.evidence).size, stage.evidence.length);
				stage.note += " Additional hosted closed-index acceptance: " + scope;
			}
		}
	const pins = new Map(await Promise.all(pinPaths.map(async path => [
		path, sha256(await readFile(path))
	])));
	for(const evidence of inventory.evidence) for(const file of evidence.files)
		if(pins.has(file.path)) file.sha256 = pins.get(file.path);
	return inventory;
};

/** Read the immutable inventory immediately preceding PHP promotion. */
export const checkedRecordValueIndexPhpPromotionBaseline = () => JSON.parse(
	execFileSync("git", ["show", `${checkedRecordValueIndexPhpPromotionParent}:docs/type-surface.v1.json`]
		, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 })
);
