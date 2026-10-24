/**
 * Promote only the four closed top-level Rust value-index cells authenticated
 * by the retained hosted archive.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { sha256 } from "../../src/capsule/node.mjs";
import {
	checkCheckedRecordValueIndexRustEvidence
	, checkedRecordValueIndexRustEvidence
	, checkedRecordValueIndexRustEvidenceSha256
} from "./checked-record-value-index-rust-evidence.mjs";

export const checkedRecordValueIndexRustPromotionParent
	= "2bcf998d058a38f44fb3ec104a339966b1e329f1";
export const checkedRecordValueIndexRustPromotionProfiles
	= Object.freeze(["rust"]);
export const checkedRecordValueIndexRustPromotionConversion
	= "Closed Bool, String and Nat indices remain authenticated metadata rather than Rust record fields. Generated structs use BigUint for Nat payloads such as `count`, `size` and every `EmptySized.data` element. Full crates exercise exact per-site constructors, unchanged rejected values, recovery and proof-free results; standalone result-only crates expose the same copied records without checked-input metadata.";
export const checkedRecordValueIndexRustPromotionLimit
	= "Hosted Rust value-index acceptance covers only the archived top-level copied checked-record parameter and result sites with closed Bool, String and Nat indices. Full crates cover parameters and results; standalone result-only crates cover results only. Open or opaque indices; Int, Char, fixed-width and platform-width integers, Fin, functions, proofs, instances and other index kinds; checked-record fields, callbacks and owned positions; value-carrying dependent payloads; and zero-payload checked records remain unreviewed here. The run covers offline installation from an authenticated vendored dependency closure, relocated replay and one source-free executable on Ubuntu 24.04, Linux x64/glibc 2.39 with a glibc 2.38 crate floor. Complete crates, dependency archives, receipts, generated sources, caller binaries, reports, execution records, original workflow records and source closures are retained; external Lean, Rust, Cargo, linker and operating-system toolchains remain trusted recorded inputs. Other host targets require separate installed evidence.";
export const checkedRecordValueIndexRustPriorLimit
	= "Checked-record Rust acceptance covers the established top-level Interval, Sized 3 and Bounded 0 101 forms plus the tested acyclic Packet, Holder and Choice forms through Array, List, Option, tuple and Result copied positions. Generic checked records, other index kinds, open dependent or zero-payload records, callbacks and owned positions remain unreviewed. Both author routes and full/result-only APIs reproduce complete Cargo crates from two author roots, remove author roots, install offline from a complete vendored dependency closure, physically relocate each installed tree, and execute again after retaining only the compiled consumer. The runs use Rust and Cargo 1.90.0 on Linux x64/glibc 2.36 with an explicit 2.36 package floor, 64-bit machine words and a recorded 20.0 host-load admission ceiling. The archive retains complete crates, dependency archives, receipts, installed inventories, execution records and producer/verifier source closures. Rust, Cargo, the system linker and glibc remain trusted toolchain inputs. Hosted glibc 2.38 release-floor acceptance remains assigned to the dedicated workflow. Constructor dispatch and peak memory are unmeasured.";

const command = "bash scripts/run-checked-record-value-index-rust-ci.sh /absolute/rustc /absolute/cargo";
const validators = Object.freeze([
	".github/workflows/checked-record-value-index-rust.yml"
	, "scripts/check-checked-record-value-index-rust-ci.mjs"
	, "scripts/run-checked-record-value-index-rust-ci.sh"
	, "tests/helpers/checked-record-value-index-rust-ci-report.mjs"
	, "tests/helpers/checked-record-value-index-rust-evidence.mjs"
	, "tests/helpers/checked-record-value-index-rust-evidence-tests.mjs"
	, "tests/helpers/checked-record-value-index-rust-installed-tests.mjs"
	, "tests/helpers/checked-record-value-index-rust-promotion.mjs"
	, "tests/helpers/checked-record-value-index-rust-promotion-tests.mjs"
	, "scripts/promote-checked-record-value-index-rust.mjs"
]);
const pinPaths = Object.freeze([
	"docs/consume/rust.md", "docs/evidence/README.md"
	, "docs/evidence/checked-record-value-index-rust-promotion-20261020.md"
	, "docs/reference/types.md", "docs/type-surface.v1.json"
	, "scripts/generate-type-docs.mjs", "tests/type-surface.test.mjs"
	, ...validators, "tests/checked-record-value-index-rust.test.mjs"
]);
const routeSourcePath = route => route.replace(/^result-only-/u, "");
const resultOnly = route => route.startsWith("result-only-");
const archivePath = "handoff/archives/checkedrecordvalueindices-1.0.0.crate";

/** Authenticate four exact hosted selections before exposing references. */
export const checkedRecordValueIndexRustPromotionReferences = async () => {
	const checked = await checkCheckedRecordValueIndexRustEvidence();
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
		assert.ok(retainedArchive);
		const scope = `Hosted GitHub Actions run ${checked.hostedRun.runId} rebuilt this ${mode} ${routeSourcePath(accepted.route)} Rust crate selection on Ubuntu 24.04. Two author roots reproduce the complete crate, remove author roots, install offline from its authenticated vendored dependency closure, relocate the installation and replay the unchanged caller before retaining only its executable for a third run. ${resultOnly(accepted.route) ? "The standalone result-only API exposes all eight proof-free indexed records without checked-input metadata." : "The full API exercises all eight checked inputs, exact constructor refusals, unchanged rejected values, recovery and all eight proof-free indexed results."} The archive authenticates the original workflow, job, artifact, toolchain log, TAP, reports, package receipt, crate, dependency closure and exact source identities. ${checkedRecordValueIndexRustPromotionLimit}`;
		return {
			id: `checked-record-value-index-rust-${accepted.route}-hosted-installed`
			, route: accepted.route, mode
			, sourcePath: routeSourcePath(accepted.route)
			, resultOnly: resultOnly(accepted.route)
			, profiles: [...checkedRecordValueIndexRustPromotionProfiles]
			, positions: resultOnly(accepted.route)
				? ["result"] : ["parameter", "result"]
			, revision: checked.producer, consumerRevision: checked.consumer
			, checkerRevision: checked.checker, archiverRevision: checked.archiver
			, hostedRun: checked.hostedRun.runId
			, artifact: checked.hostedRun.artifact.id
			, counts: accepted, command, scope
			, files: [
				{ path: `${checkedRecordValueIndexRustEvidence}/index.json`
					, sha256: checkedRecordValueIndexRustEvidenceSha256 }
				, ...files.map(file => ({
					path: `${checkedRecordValueIndexRustEvidence}/${file.path}`
					, sha256: file.sha256
				}))
			]
			, artifacts: [{ path: archivePath, sha256: retainedArchive.sha256 }]
		};
	});
};

/**
 * Promote exactly four Rust top-level checked-record observations.
 *
 * @param original - Exact inventory before this promotion.
 * @param references - Four independently authenticated hosted selections.
 * @param [read] - Source bytes for validators and pins; defaults to the
 * live checkout.
 */
export const promoteCheckedRecordValueIndexRust = async (
	original, references, read = path => readFile(path)
) => {
	assert.deepEqual(references
		, await checkedRecordValueIndexRustPromotionReferences());
	const inventory = structuredClone(original);
	const sources = await Promise.all(validators.map(async path => ({
		path, sha256: sha256(await read(path))
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
				item.profiles.length === 1 && item.profiles[0] === "rust"
					&& item.shapes.length === 1 && item.shapes[0] === "checked-record"
					&& item.path === path && item.positions.length === 1
					&& item.positions[0] === position);
			assert.equal(observations.length, 1
				, `Missing or overlapping Rust cell: ${path}/${position}`);
			const observation = observations[0], ids = matches.map(item => item.id);
			const scope = matches.map(item => item.scope).join(" ");
			observation.scope += " Additional hosted closed-index acceptance: " + scope;
			observation.conversionNotes["checked-record"] += " "
				+ checkedRecordValueIndexRustPromotionConversion;
			assert.equal(observation.limitations.filter(value =>
				value === checkedRecordValueIndexRustPriorLimit).length, 1);
			observation.limitations = observation.limitations.filter(value =>
				value !== checkedRecordValueIndexRustPriorLimit);
			observation.limitations.push(checkedRecordValueIndexRustPromotionLimit);
			for(const stage of Object.values(observation.stages))
			{
				assert.equal(stage.state, "passed"); stage.evidence.push(...ids);
				assert.equal(new Set(stage.evidence).size, stage.evidence.length);
				stage.note += " Additional hosted closed-index acceptance: " + scope;
			}
		}
	const pins = new Map(await Promise.all(pinPaths.map(async path => [
		path, sha256(await read(path))
	])));
	for(const evidence of inventory.evidence) for(const file of evidence.files)
		if(pins.has(file.path)) file.sha256 = pins.get(file.path);
	return inventory;
};

/** Read the immutable inventory immediately preceding Rust promotion. */
export const checkedRecordValueIndexRustPromotionBaseline = () => JSON.parse(
	execFileSync("git", ["show"
		, `${checkedRecordValueIndexRustPromotionParent}:docs/type-surface.v1.json`]
	, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 })
);
