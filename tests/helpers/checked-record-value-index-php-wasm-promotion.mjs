/**
 * Promote only the four closed top-level PHP-Wasm value-index cells that the
 * retained hosted archive authenticates.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { sha256 } from "../../src/capsule/node.mjs";
import {
	checkCheckedRecordValueIndexPhpWasmEvidence
	, checkedRecordValueIndexPhpWasmEvidence
	, checkedRecordValueIndexPhpWasmEvidenceSha256
} from "./checked-record-value-index-php-wasm-evidence.mjs";

export const checkedRecordValueIndexPhpWasmPromotionParent
	= "12646a8ad32b98d6825310677c809f1a7b50f84a";
export const checkedRecordValueIndexPhpWasmPromotionProfiles
	= Object.freeze(["php-wasm"]);
export const checkedRecordValueIndexPhpWasmPromotionConversion
	= "Closed Bool, String and Nat indices remain authenticated metadata rather than PHP fields. PHP-Wasm uses `Brick\\Math\\BigInteger` for `count`, `size` and every `EmptySized.data` element on wasm32. Full packages exercise weak and strict PHP callers in Node and Chromium, exact constructor refusals, unchanged rejected values, recovery and proof-free results; standalone result-only packages expose the same copied records without checked-input metadata.";
export const checkedRecordValueIndexPhpWasmPromotionLimit
	= "Hosted PHP-Wasm value-index acceptance covers only the archived top-level copied checked-record parameter and result sites with closed Bool, String and Nat indices. Full packages cover parameters and results; standalone result-only packages cover results only. Open or opaque indices; Int, Char, fixed-width and platform-width integers, Fin, functions, proofs, instances and other index kinds; checked-record fields, callbacks and owned positions; value-carrying dependent payloads; and zero-payload checked records remain unreviewed here. The run covers weak and strict callers, embedded and Composer arrangements, startup and lazy loading in Node and Chromium on wasm32 PHP 8.4.1. Complete Composer, component and shared-runtime archives, receipts, reports, deployments, execution records, original workflow records and source closures are retained; external Lean, Nix, PHP-Wasm, Emscripten, Node, Chromium and operating-system toolchains remain trusted recorded inputs. Other host targets require separate installed evidence.";
export const checkedRecordValueIndexPhpWasmPriorLimit
	= "Checked-record PHP-Wasm acceptance covers the established top-level Interval, Sized 3 and Bounded 0 101 forms plus the tested acyclic Packet, Holder and Choice forms through Array, List, Option, Product and Except copied positions. Generic checked records, other index kinds, open dependent or zero-payload records, callbacks and owned positions remain unreviewed. Both author routes and full/result-only APIs reproduce complete Composer API, npm component and npm shared-runtime archives from two author roots, remove author and build roots, install offline, physically relocate each installation, and run unchanged weak and strict callers in eight Node and four Chromium contexts. The runs use wasm32 PHP 8.4.1, Node 22.23.2 and Chromium 152.0.7977.75 on Linux x64 with 32-bit machine words and a recorded 20.0 host-load admission ceiling. The archive retains complete packages, receipts, deployment callers, execution records and both producer and verifier source closures. Consumer PHP source remains required at runtime. The prepared PHP-Wasm runtime and browser remain trusted inputs; hosted acceptance remains assigned to the dedicated workflow. Constructor dispatch and peak memory are unmeasured.";

const command = "bash scripts/run-checked-record-value-index-php-wasm-ci.sh";
const validators = Object.freeze([
	".github/workflows/checked-record-value-index-php-wasm.yml"
	, "scripts/check-checked-record-value-index-php-wasm-ci.mjs"
	, "scripts/check-checked-record-value-index-php-wasm-compiler-ci.mjs"
	, "scripts/run-checked-record-value-index-php-wasm-ci.sh"
	, "tests/helpers/checked-record-value-index-php-wasm-ci-report.mjs"
	, "tests/helpers/checked-record-value-index-php-wasm-evidence.mjs"
	, "tests/helpers/checked-record-value-index-php-wasm-evidence-tests.mjs"
	, "tests/helpers/checked-record-value-index-php-wasm-fixture.mjs"
	, "tests/helpers/checked-record-value-index-php-wasm-installed-tests.mjs"
	, "tests/helpers/checked-record-value-index-php-wasm-promotion.mjs"
	, "tests/helpers/checked-record-value-index-php-wasm-promotion-tests.mjs"
	, "scripts/promote-checked-record-value-index-php-wasm.mjs"
]);
const pinPaths = Object.freeze([
	"docs/evidence/README.md"
	, "docs/evidence/checked-record-value-index-php-wasm-promotion-20261020.md"
	, "docs/lean/existing-package.md", "docs/lean/export-decisions.md"
	, "docs/php.md", "docs/reference/types.md", "docs/type-surface.v1.json"
	, "scripts/generate-type-docs.mjs"
	, ...validators, "tests/checked-record-value-index-php-wasm.test.mjs"
	, "tests/type-surface.test.mjs"
]);
const routeSourcePath = route => route.replace(/^result-only-/u, "");
const resultOnly = route => route.startsWith("result-only-");

/** Authenticate four exact hosted selections before exposing their references. */
export const checkedRecordValueIndexPhpWasmPromotionReferences = async () => {
	const checked = await checkCheckedRecordValueIndexPhpWasmEvidence();
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
		const artifacts = checked.files.filter(file => file.path.startsWith(
			`${accepted.route}/records/handoff/packages/php-wasm/archives/`));
		assert.equal(artifacts.length, 3, accepted.route);
		const scope = `Hosted GitHub Actions run ${checked.hostedRun.runId} rebuilt this ${mode} ${routeSourcePath(accepted.route)} PHP-Wasm selection on Ubuntu 24.04. Two author roots reproduce the complete Composer API, npm component and shared-runtime archives, remove author and build roots, install offline, relocate the installation and replay unchanged weak and strict callers in Node and Chromium. ${resultOnly(accepted.route) ? "The standalone result-only API exposes all eight proof-free indexed records without checked-input metadata." : "The full API exercises all eight checked inputs, exact constructor refusals, unchanged rejected values, recovery and all eight proof-free indexed results."} The archive authenticates the original workflow, job, artifact, compiler probes, runtime logs, TAP, reports, receipts, executions and exact source identities. ${checkedRecordValueIndexPhpWasmPromotionLimit}`;
		return {
			id: `checked-record-value-index-php-wasm-${accepted.route}-hosted-installed`
			, route: accepted.route, mode
			, sourcePath: routeSourcePath(accepted.route)
			, resultOnly: resultOnly(accepted.route)
			, profiles: [...checkedRecordValueIndexPhpWasmPromotionProfiles]
			, positions: resultOnly(accepted.route)
				? ["result"] : ["parameter", "result"]
			, revision: checked.producer, consumerRevision: checked.consumer
			, checkerRevision: checked.checker, archiverRevision: checked.archiver
			, hostedRun: checked.hostedRun.runId
			, artifact: checked.hostedRun.artifact.id
			, counts: accepted, command, scope
			, files: [
				{ path: `${checkedRecordValueIndexPhpWasmEvidence}/index.json`
					, sha256: checkedRecordValueIndexPhpWasmEvidenceSha256 }
				, ...files.map(file => ({
					path: `${checkedRecordValueIndexPhpWasmEvidence}/${file.path}`
					, sha256: file.sha256
				}))
			]
			, artifacts: artifacts.map(item => ({
				path: item.path, sha256: item.sha256
			}))
		};
	});
};

/**
 * Promote exactly four PHP-Wasm top-level checked-record observations.
 *
 * @param original - Exact inventory before this promotion.
 * @param references - Four independently authenticated hosted selections.
 */
export const promoteCheckedRecordValueIndexPhpWasm = async (
	original, references
) => {
	assert.deepEqual(references
		, await checkedRecordValueIndexPhpWasmPromotionReferences());
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
			const matches = references.filter(reference =>
				reference.sourcePath === path
				&& reference.positions.includes(position));
			assert.equal(matches.length, position === "result" ? 2 : 1);
			const observations = inventory.observations.filter(item =>
				item.profiles.length === 1 && item.profiles[0] === "php-wasm"
				&& item.shapes.length === 1 && item.shapes[0] === "checked-record"
				&& item.path === path && item.positions.length === 1
				&& item.positions[0] === position);
			assert.equal(observations.length, 1
				, `Missing or overlapping PHP-Wasm cell: ${path}/${position}`);
			const observation = observations[0], ids = matches.map(item => item.id);
			const scope = matches.map(item => item.scope).join(" ");
			observation.scope += " Additional hosted closed-index acceptance: " + scope;
			observation.conversionNotes["checked-record"] += " "
				+ checkedRecordValueIndexPhpWasmPromotionConversion;
			assert.equal(observation.limitations.filter(value =>
				value === checkedRecordValueIndexPhpWasmPriorLimit).length, 1);
			observation.limitations = observation.limitations.filter(value =>
				value !== checkedRecordValueIndexPhpWasmPriorLimit);
			observation.limitations.push(checkedRecordValueIndexPhpWasmPromotionLimit);
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

/** Read the immutable inventory immediately preceding PHP-Wasm promotion. */
export const checkedRecordValueIndexPhpWasmPromotionBaseline = () => JSON.parse(
	execFileSync("git", ["show"
		, `${checkedRecordValueIndexPhpWasmPromotionParent}:docs/type-surface.v1.json`]
	, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 })
);
