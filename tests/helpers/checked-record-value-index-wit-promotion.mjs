/**
 * Promote only the four closed top-level WIT/WASI value-index cells that the
 * retained hosted archive authenticates.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { sha256 } from "../../src/capsule/node.mjs";
import {
	checkCheckedRecordValueIndexWitEvidence
	, checkedRecordValueIndexWitEvidence
	, checkedRecordValueIndexWitEvidenceSha256
} from "./checked-record-value-index-wit-evidence.mjs";

export const checkedRecordValueIndexWitPromotionParent
	= "102da2b7ec1382625bc2a7f35a66c8d8515e17a6";
export const checkedRecordValueIndexWitPromotionProfiles
	= Object.freeze(["wit-wasi"]);
export const checkedRecordValueIndexWitPromotionConversion
	= "Closed Bool, String and Nat indices remain authenticated metadata rather than WIT record fields. Generated records expose Nat payloads such as `count`, `size` and every `EmptySized.data` element as exact little-endian `list<u32>` limbs. Full components exercise exact per-site constructors, malformed-Nat host refusal, unchanged rejected values, recovery and proof-free results; standalone result-only components expose the same copied records without checked-input metadata.";
export const checkedRecordValueIndexWitPromotionLimit
	= "Hosted WIT/WASI value-index acceptance covers only the archived top-level copied checked-record parameter and result sites with closed Bool, String and Nat indices. Full components cover parameters and results; standalone result-only components cover results only. Open or opaque indices; Int, Char, fixed-width and platform-width integers, Fin, functions, proofs, instances and other index kinds; checked-record fields, callbacks and owned positions; value-carrying dependent payloads; and zero-payload checked records remain unreviewed here. The run covers source-free installation and relocated replay through Wasmtime 42.0.1 and wasm-tools 1.245.1 on Ubuntu 24.04, Linux x64/glibc 2.39 with a glibc 2.38 package floor. Each component requires its packaged native Lean host and is not a standalone WASI command. Complete component archives, receipts, generated projections, caller binaries, reports, execution records, original workflow records and source closures are retained; external Lean, Nix, C, wasm-tools, Wasmtime and operating-system toolchains remain trusted recorded inputs. Other host targets require separate installed evidence.";
export const checkedRecordValueIndexWitPriorLimit
	= "Checked-record WIT/WASI acceptance covers the established top-level Interval, Sized 3 and Bounded 0 101 forms plus the tested acyclic Packet, Holder and Choice forms through Array, List, Option, Product and Except copied positions. Generic checked records, other index kinds, open dependent or zero-payload records, callbacks and owned positions remain unreviewed. Both author routes and full/result-only APIs reproduce complete WIT component archives from two author roots, remove author roots, install offline, compile one unchanged public C caller, remove its source, and execute it before and after physically relocating each installation. The compiler-free runs use Wasmtime 42.0.1 and wasm-tools 1.245.1 on Linux x64/glibc 2.36 with an explicit 2.36 package floor, 64-bit native machine words and a recorded 20.0 host-load admission ceiling. The component requires its packaged native Lean host and is not a standalone WASI command. The archive retains complete handoff archives, extracted package records, receipts, installed inventories, execution records and both producer and verifier source closures. GCC, wasm-tools and Wasmtime remain trusted toolchain inputs. Hosted glibc 2.38 release-floor acceptance remains assigned to the dedicated workflow. Constructor dispatch and peak memory are unmeasured.";

const command = "bash scripts/run-checked-record-value-index-wit-ci.sh /absolute/cc /absolute/wasm-tools /absolute/wasmtime-capi";
const validators = Object.freeze([
	".github/workflows/checked-record-value-index-wit.yml"
	, "scripts/check-checked-record-value-index-wit-ci.mjs"
	, "scripts/run-checked-record-value-index-wit-ci.sh"
	, "tests/helpers/checked-record-value-index-wit-ci-report.mjs"
	, "tests/helpers/checked-record-value-index-wit-evidence.mjs"
	, "tests/helpers/checked-record-value-index-wit-evidence-tests.mjs"
	, "tests/helpers/checked-record-value-index-wit-handoff.mjs"
	, "tests/helpers/checked-record-value-index-wit-installed-tests.mjs"
	, "tests/helpers/checked-record-value-index-wit-promotion.mjs"
	, "tests/helpers/checked-record-value-index-wit-promotion-tests.mjs"
	, "scripts/promote-checked-record-value-index-wit.mjs"
]);
const pinPaths = Object.freeze([
	"docs/consume/wit-wasi.md", "docs/evidence/README.md"
	, "docs/evidence/checked-record-value-index-wit-promotion-20261020.md"
	, "docs/reference/types.md", "docs/type-surface.v1.json"
	, "scripts/generate-type-docs.mjs", "tests/type-surface.test.mjs"
	, ...validators, "tests/checked-record-value-index-wit.test.mjs"
]);
const routeSourcePath = route => route.replace(/^result-only-/u, "");
const resultOnly = route => route.startsWith("result-only-");
const archivePath
	= "handoff/archives/checkedrecordvalueindices-1.0.0-wit-wasi.tar.gz";

/** Authenticate four exact hosted selections before exposing references. */
export const checkedRecordValueIndexWitPromotionReferences = async () => {
	const checked = await checkCheckedRecordValueIndexWitEvidence();
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
		const retainedArchive = checked.files.find(file => file.path
			=== `${accepted.route}/records/${archivePath}`);
		assert.equal(retainedArchive?.sha256, accepted.archiveSha256);
		const scope = `Hosted GitHub Actions run ${checked.hostedRun.runId} rebuilt this ${mode} ${routeSourcePath(accepted.route)} WIT/WASI component selection on Ubuntu 24.04. Two author roots reproduce the complete component archive, remove author roots, install offline, compile one unchanged public C caller, remove its source, relocate the installation and replay its binary through Wasmtime. ${resultOnly(accepted.route) ? "The standalone result-only API exposes all eight proof-free indexed records without checked-input metadata." : "The full API exercises all eight checked inputs, exact constructor refusals, unchanged rejected values, recovery and all eight proof-free indexed results."} The archive authenticates the original workflow, job, artifact, toolchain log, TAP, reports, package receipt, component archive and exact source identities. ${checkedRecordValueIndexWitPromotionLimit}`;
		return {
			id: `checked-record-value-index-wit-${accepted.route}-hosted-installed`
			, route: accepted.route, mode
			, sourcePath: routeSourcePath(accepted.route)
			, resultOnly: resultOnly(accepted.route)
			, profiles: [...checkedRecordValueIndexWitPromotionProfiles]
			, positions: resultOnly(accepted.route)
				? ["result"] : ["parameter", "result"]
			, revision: checked.producer, consumerRevision: checked.consumer
			, checkerRevision: checked.checker, archiverRevision: checked.archiver
			, hostedRun: checked.hostedRun.runId
			, artifact: checked.hostedRun.artifact.id
			, counts: accepted, command, scope
			, files: [
				{ path: `${checkedRecordValueIndexWitEvidence}/index.json`
					, sha256: checkedRecordValueIndexWitEvidenceSha256 }
				, ...files.map(file => ({
					path: `${checkedRecordValueIndexWitEvidence}/${file.path}`
					, sha256: file.sha256
				}))
			]
			, artifacts: [{ path: archivePath, sha256: accepted.archiveSha256 }]
		};
	});
};

/**
 * Promote exactly four WIT/WASI top-level checked-record observations.
 *
 * @param original - Exact inventory before this promotion.
 * @param references - Four independently authenticated hosted selections.
 */
export const promoteCheckedRecordValueIndexWit = async (
	original, references
) => {
	assert.deepEqual(references
		, await checkedRecordValueIndexWitPromotionReferences());
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
				item.profiles.length === 1 && item.profiles[0] === "wit-wasi"
					&& item.shapes.length === 1 && item.shapes[0] === "checked-record"
					&& item.path === path && item.positions.length === 1
					&& item.positions[0] === position);
			assert.equal(observations.length, 1
				, `Missing or overlapping WIT/WASI cell: ${path}/${position}`);
			const observation = observations[0], ids = matches.map(item => item.id);
			const scope = matches.map(item => item.scope).join(" ");
			observation.scope += " Additional hosted closed-index acceptance: " + scope;
			observation.conversionNotes["checked-record"] += " "
				+ checkedRecordValueIndexWitPromotionConversion;
			assert.equal(observation.limitations.filter(value =>
				value === checkedRecordValueIndexWitPriorLimit).length, 1);
			observation.limitations = observation.limitations.filter(value =>
				value !== checkedRecordValueIndexWitPriorLimit);
			observation.limitations.push(checkedRecordValueIndexWitPromotionLimit);
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

/** Read the immutable inventory immediately preceding WIT/WASI promotion. */
export const checkedRecordValueIndexWitPromotionBaseline = () => JSON.parse(
	execFileSync("git", ["show"
		, `${checkedRecordValueIndexWitPromotionParent}:docs/type-surface.v1.json`]
	, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 })
);
