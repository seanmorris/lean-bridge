/**
 * Promote only the four closed top-level Ruby value-index cells that the
 * retained hosted archive authenticates.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { sha256 } from "../../src/capsule/node.mjs";
import {
	checkCheckedRecordValueIndexRubyEvidence
	, checkedRecordValueIndexRubyEvidence
	, checkedRecordValueIndexRubyEvidenceSha256
} from "./checked-record-value-index-ruby-evidence.mjs";

export const checkedRecordValueIndexRubyPromotionParent
	= "2256f66b1fceef9613936b3b77c8eff429bfab88";
export const checkedRecordValueIndexRubyPromotionProfiles
	= Object.freeze(["ruby"]);
export const checkedRecordValueIndexRubyPromotionConversion
	= "Closed Bool, String and Nat indices remain authenticated metadata rather than Ruby record fields. Generated frozen records use exact Ruby Integer values for `count`, `size` and every `EmptySized.data` element. Full gems exercise exact per-site constructors, negative-Nat host refusal, unchanged rejected values, recovery and proof-free results; standalone result-only gems expose the same copied records without checked-input metadata.";
export const checkedRecordValueIndexRubyPromotionLimit
	= "Hosted Ruby value-index acceptance covers only the archived top-level copied checked-record parameter and result sites with closed Bool, String and Nat indices. Full gems cover parameters and results; standalone result-only gems cover results only. Open or opaque indices; Int, Char, fixed-width and platform-width integers, Fin, functions, proofs, instances and other index kinds; checked-record fields, callbacks and owned positions; value-carrying dependent payloads; and zero-payload checked records remain unreviewed here. The run covers offline installation and relocated replay on MRI 3.3.12 on Ubuntu 24.04, Linux x64/glibc 2.39 with a glibc 2.38 native-gem floor. Complete gems, retained package members, environment inventories, receipts, reports, original workflow records and source closures are retained; external toolchains remain trusted recorded inputs. Other host targets require separate installed evidence.";
export const checkedRecordValueIndexRubyPriorLimit
	= "Checked-record Ruby acceptance covers the established top-level Interval, Sized 3 and Bounded 0 101 forms plus the tested acyclic Packet, Holder and Choice forms through Array, List, Option, Product and Except copied positions. Generic checked records, other index kinds, open dependent or zero-payload records, callbacks and owned positions remain unreviewed. Both author routes and full/result-only APIs reproduce complete native gems from two author roots, remove author roots, install offline, and replay the unchanged caller before and after physically relocating each installation. The runs use MRI 3.3.12 on Linux x64/glibc 2.36 with an explicit 2.36 package floor, 64-bit machine words and a recorded 20.0 host-load admission ceiling. The archive retains complete gems, extracted packages, receipts, installed inventories, execution records and both producer and verifier source closures. RubyGems remains a trusted part of the selected interpreter toolchain. Hosted glibc 2.38 release-floor acceptance remains assigned to the dedicated workflow. Constructor dispatch and peak memory are unmeasured.";

const command = "bash scripts/run-checked-record-value-index-ruby-ci.sh /absolute/ruby3.3 /absolute/gem";
const validators = Object.freeze([
	".github/workflows/checked-record-value-index-ruby.yml"
	, "scripts/check-checked-record-value-index-ruby-ci.mjs"
	, "scripts/run-checked-record-value-index-ruby-ci.sh"
	, "tests/helpers/checked-record-value-index-ruby-ci-report.mjs"
	, "tests/helpers/checked-record-value-index-ruby-evidence.mjs"
	, "tests/helpers/checked-record-value-index-ruby-evidence-tests.mjs"
	, "tests/helpers/checked-record-value-index-ruby-package.mjs"
	, "tests/helpers/checked-record-value-index-ruby-installed-tests.mjs"
	, "tests/helpers/checked-record-value-index-ruby-promotion.mjs"
	, "tests/helpers/checked-record-value-index-ruby-promotion-tests.mjs"
	, "scripts/promote-checked-record-value-index-ruby.mjs"
]);
const pinPaths = Object.freeze([
	"docs/evidence/README.md"
	, "docs/evidence/checked-record-value-index-ruby-promotion-20261020.md"
	, "docs/lean/existing-package.md", "docs/lean/export-decisions.md"
	, "docs/consume/ruby.md", "docs/reference/types.md"
	, "docs/type-surface.v1.json", "scripts/generate-type-docs.mjs"
	, "src/adoption/test-profiles.mjs", "tests/type-surface.test.mjs"
	, ...validators, "tests/checked-record-value-index-ruby.test.mjs"
]);
const routeSourcePath = route => route.replace(/^result-only-/u, "");
const resultOnly = route => route.startsWith("result-only-");
const archivePath = "archives/checkedrecordvalueindices-1.0.0-x86_64-linux.gem";

/** Authenticate four exact hosted selections before exposing references. */
export const checkedRecordValueIndexRubyPromotionReferences = async () => {
	const checked = await checkCheckedRecordValueIndexRubyEvidence();
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
		const scope = `Hosted GitHub Actions run ${checked.hostedRun.runId} rebuilt this ${mode} ${routeSourcePath(accepted.route)} Ruby gem selection on Ubuntu 24.04. Two author roots reproduce the complete native gem, remove author roots, install offline on MRI 3.3.12, relocate the environment and replay the unchanged caller. ${resultOnly(accepted.route) ? "The standalone result-only API exposes all eight proof-free indexed records without checked-input metadata." : "The full API exercises all eight checked inputs, exact constructor refusals, unchanged rejected values, recovery and all eight proof-free indexed results."} The archive authenticates the original workflow, job, artifact, toolchain log, TAP, reports, package receipt, environment inventory and exact source identities. ${checkedRecordValueIndexRubyPromotionLimit}`;
		return {
			id: `checked-record-value-index-ruby-${accepted.route}-hosted-installed`
			, route: accepted.route, mode
			, sourcePath: routeSourcePath(accepted.route)
			, resultOnly: resultOnly(accepted.route)
			, profiles: [...checkedRecordValueIndexRubyPromotionProfiles]
			, positions: resultOnly(accepted.route)
				? ["result"] : ["parameter", "result"]
			, revision: checked.producer, consumerRevision: checked.consumer
			, checkerRevision: checked.checker, archiverRevision: checked.archiver
			, hostedRun: checked.hostedRun.runId
			, artifact: checked.hostedRun.artifact.id
			, counts: accepted, command, scope
			, files: [
				{ path: `${checkedRecordValueIndexRubyEvidence}/index.json`
					, sha256: checkedRecordValueIndexRubyEvidenceSha256 }
				, ...files.map(file => ({
					path: `${checkedRecordValueIndexRubyEvidence}/${file.path}`
					, sha256: file.sha256
				}))
			]
			, artifacts: [{ path: archivePath, sha256: accepted.archiveSha256 }]
		};
	});
};

/**
 * Promote exactly four Ruby top-level checked-record observations.
 *
 * @param original - Exact inventory before this promotion.
 * @param references - Four independently authenticated hosted selections.
 */
export const promoteCheckedRecordValueIndexRuby = async (
	original, references
) => {
	assert.deepEqual(references
		, await checkedRecordValueIndexRubyPromotionReferences());
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
				item.profiles.length === 1 && item.profiles[0] === "ruby"
				&& item.shapes.length === 1 && item.shapes[0] === "checked-record"
				&& item.path === path && item.positions.length === 1
				&& item.positions[0] === position);
			assert.equal(observations.length, 1
				, `Missing or overlapping Ruby cell: ${path}/${position}`);
			const observation = observations[0], ids = matches.map(item => item.id);
			const scope = matches.map(item => item.scope).join(" ");
			observation.scope += " Additional hosted closed-index acceptance: " + scope;
			observation.conversionNotes["checked-record"] += " "
				+ checkedRecordValueIndexRubyPromotionConversion;
			assert.equal(observation.limitations.filter(value =>
				value === checkedRecordValueIndexRubyPriorLimit).length, 1);
			observation.limitations = observation.limitations.filter(value =>
				value !== checkedRecordValueIndexRubyPriorLimit);
			observation.limitations.push(checkedRecordValueIndexRubyPromotionLimit);
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

/** Read the immutable inventory immediately preceding Ruby promotion. */
export const checkedRecordValueIndexRubyPromotionBaseline = () => JSON.parse(
	execFileSync("git", ["show"
		, `${checkedRecordValueIndexRubyPromotionParent}:docs/type-surface.v1.json`]
	, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 })
);
