/**
 * Promote only the four closed top-level Perl value-index cells that the
 * retained hosted archive authenticates.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { sha256 } from "../../src/capsule/node.mjs";
import {
	checkCheckedRecordValueIndexPerlEvidence
	, checkedRecordValueIndexPerlEvidence
	, checkedRecordValueIndexPerlEvidenceSha256
} from "./checked-record-value-index-perl-evidence.mjs";

export const checkedRecordValueIndexPerlPromotionParent
	= "cb2c4d2dc9c6f9f0788a42719babfc8954eb8a6b";
export const checkedRecordValueIndexPerlPromotionProfiles
	= Object.freeze(["perl"]);
export const checkedRecordValueIndexPerlPromotionConversion
	= "Closed Bool, String and Nat indices remain authenticated metadata rather than Perl fields. Generated blessed records use `Math::BigInt` for `count`, `size` and every `EmptySized.data` element. Full packages exercise exact per-site constructors, negative-Nat host refusal, unchanged rejected values, recovery and proof-free results; standalone result-only packages expose the same copied records without checked-input metadata.";
export const checkedRecordValueIndexPerlPromotionLimit
	= "Hosted Perl value-index acceptance covers only the archived top-level copied checked-record parameter and result sites with closed Bool, String and Nat indices. Full packages cover parameters and results; standalone result-only packages cover results only. Open or opaque indices; Int, Char, fixed-width and platform-width integers, Fin, functions, proofs, instances and other index kinds; checked-record fields, callbacks and owned positions; value-carrying dependent payloads; and zero-payload checked records remain unreviewed here. The run covers Perl 5.36.3 and 5.38.2, each threaded and unthreaded, through prebuilt-only and build-XS offline installations with relocated replay on Ubuntu 24.04, Linux x64/glibc 2.39 and a glibc 2.38 package floor. Complete CPAN component/runtime archives, receipts, reports, original workflow records and source closures are retained; external toolchains remain trusted recorded inputs. Other host targets require separate installed evidence.";
export const checkedRecordValueIndexPerlPriorLimit
	= "Checked-record Perl acceptance covers the established top-level Interval, Sized 3 and Bounded 0 101 forms plus the tested acyclic Packet, Holder and Choice forms through Array, List, Option, Product and Except copied positions. Generic checked records, other index kinds, open dependent or zero-payload records, callbacks and owned positions remain unreviewed. Both author routes and full/result-only APIs reproduce complete CPAN packages from two author roots, remove author sources, install offline in prebuilt-only and build-xs modes, and replay unchanged callers after relocating each installation. The runs cover threaded and unthreaded Perl 5.36.3 and 5.38.2 with Lean 4.32.2 on Linux x64/glibc 2.36, an explicit 2.36 package floor and 64-bit machine words. The archive retains exact records, generated XS and source closure; prepared CPAN archives and installed binaries retain authenticated identities without copied bytes. Hosted glibc 2.38 release-floor acceptance remains assigned to the dedicated workflow.";

const command = "bash scripts/run-checked-record-value-index-perl-ci.sh";
const validators = Object.freeze([
	".github/workflows/checked-record-value-index-perl.yml"
	, "scripts/check-checked-record-value-index-perl-ci.mjs"
	, "scripts/run-checked-record-value-index-perl-ci.sh"
	, "tests/helpers/checked-record-value-index-perl-ci-report.mjs"
	, "tests/helpers/checked-record-value-index-perl-records.mjs"
	, "tests/helpers/checked-record-value-index-perl-evidence.mjs"
	, "tests/helpers/checked-record-value-index-perl-evidence-tests.mjs"
	, "tests/helpers/checked-record-value-index-perl-install.mjs"
	, "tests/helpers/checked-record-value-index-perl-installed-tests.mjs"
	, "tests/helpers/checked-record-value-index-perl-promotion.mjs"
	, "tests/helpers/checked-record-value-index-perl-promotion-tests.mjs"
	, "scripts/promote-checked-record-value-index-perl.mjs"
]);
const pinPaths = Object.freeze([
	"docs/evidence/README.md"
	, "docs/evidence/checked-record-value-index-perl-promotion-20261020.md"
	, "docs/lean/existing-package.md", "docs/lean/export-decisions.md"
	, "docs/consume/perl.md", "docs/reference/types.md"
	, "docs/type-surface.v1.json", "scripts/generate-type-docs.mjs"
	, "src/adoption/test-profiles.mjs"
	, ...validators, "tests/checked-record-value-index-perl.test.mjs"
]);
const routeSourcePath = route => route.replace(/^result-only-/u, "");
const resultOnly = route => route.startsWith("result-only-");

/** Authenticate four exact hosted selections before exposing references. */
export const checkedRecordValueIndexPerlPromotionReferences = async () => {
	const checked = await checkCheckedRecordValueIndexPerlEvidence();
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
		const scope = `Hosted GitHub Actions run ${checked.hostedRun.runId} rebuilt this ${mode} ${routeSourcePath(accepted.route)} Perl CPAN selection on Ubuntu 24.04. Two author roots reproduce complete component and runtime archives, remove author roots, install offline, relocate each installation and replay unchanged callers on Perl 5.36.3 and 5.38.2, threaded and unthreaded, through prebuilt-only and build-XS modes. ${resultOnly(accepted.route) ? "The standalone result-only API exposes all eight proof-free indexed records without checked-input metadata." : "The full API exercises all eight checked inputs, exact constructor refusals, unchanged rejected values, recovery and all eight proof-free indexed results."} The archive authenticates the original workflow, job, artifact, toolchain log, TAP, reports, package receipts and exact source identities. ${checkedRecordValueIndexPerlPromotionLimit}`;
		return {
			id: `checked-record-value-index-perl-${accepted.route}-hosted-installed`
			, route: accepted.route, mode, sourcePath: routeSourcePath(accepted.route)
			, resultOnly: resultOnly(accepted.route)
			, profiles: [...checkedRecordValueIndexPerlPromotionProfiles]
			, positions: resultOnly(accepted.route) ? ["result"] : ["parameter", "result"]
			, revision: checked.producer, consumerRevision: checked.consumer
			, checkerRevision: checked.checker, archiverRevision: checked.archiver
			, hostedRun: checked.hostedRun.runId, artifact: checked.hostedRun.artifact.id
			, counts: accepted, command, scope
			, files: [
				{ path: `${checkedRecordValueIndexPerlEvidence}/index.json`
					, sha256: checkedRecordValueIndexPerlEvidenceSha256 }
				, ...files.map(file => ({
					path: `${checkedRecordValueIndexPerlEvidence}/${file.path}`
					, sha256: file.sha256
				}))
			]
			, artifacts: accepted.handoff.filter(item => item.path.endsWith(".tar.gz"))
				.map(item => ({ path: item.path.slice("handoff/".length), sha256: item.sha256 }))
		};
	});
};

/**
 * Promote exactly four Perl top-level checked-record observations.
 *
 * @param original - Exact inventory before this promotion.
 * @param references - Four independently authenticated hosted selections.
 */
export const promoteCheckedRecordValueIndexPerl = async (original, references) => {
	assert.deepEqual(references, await checkedRecordValueIndexPerlPromotionReferences());
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
				item.profiles.length === 1 && item.profiles[0] === "perl"
				&& item.shapes.length === 1 && item.shapes[0] === "checked-record"
				&& item.path === path && item.positions.length === 1
				&& item.positions[0] === position);
			assert.equal(observations.length, 1
				, `Missing or overlapping Perl cell: ${path}/${position}`);
			const observation = observations[0], ids = matches.map(item => item.id);
			const scope = matches.map(item => item.scope).join(" ");
			observation.scope += " Additional hosted closed-index acceptance: " + scope;
			observation.conversionNotes["checked-record"] += " "
				+ checkedRecordValueIndexPerlPromotionConversion;
			assert.equal(observation.limitations.filter(value =>
				value === checkedRecordValueIndexPerlPriorLimit).length, 1);
			observation.limitations = observation.limitations.filter(value =>
				value !== checkedRecordValueIndexPerlPriorLimit);
			observation.limitations.push(checkedRecordValueIndexPerlPromotionLimit);
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

/** Read the immutable inventory immediately preceding Perl promotion. */
export const checkedRecordValueIndexPerlPromotionBaseline = () => JSON.parse(
	execFileSync("git", ["show", `${checkedRecordValueIndexPerlPromotionParent}:docs/type-surface.v1.json`]
		, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 })
);
