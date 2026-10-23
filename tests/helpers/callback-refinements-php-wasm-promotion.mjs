/**
 * Promote the immutable hosted PHP-Wasm callback-refinement archive into the
 * exact Fin and checked-record cells it executes.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { sha256 } from "../../src/capsule/node.mjs";
import {
	callbackRefinementsPhpWasmHostedEvidence
	, callbackRefinementsPhpWasmHostedEvidenceSha256
	, checkCallbackRefinementsPhpWasmHostedEvidence
} from "./callback-refinements-php-wasm-hosted-evidence.mjs";

export const callbackRefinementsPhpWasmPromotionParent
	= "2eaa45f9c753ec4ae6f1ad5e0c91bda13a1ece48";
export const callbackRefinementsPhpWasmEvidenceId
	= "callback-refinements-php-wasm-hosted-installed";
export const callbackRefinementsPhpWasmPromotionPath
	= "docs/evidence/callback-refinements-php-wasm-promotion-20261023.md";
export const callbackRefinementsPhpWasmProfiles = Object.freeze([
	"fin", "checked-record"
]);
export const callbackRefinementsPhpWasmRoutes = Object.freeze([
	"ordinary", "reviewed"
]);
export const callbackRefinementsPhpWasmPositions = Object.freeze([
	"callback-parameter", "callback-result"
]);
export const callbackRefinementsPhpWasmLimit
	= "Hosted acceptance covers the fixture's closed Fin bounds and copied Interval and Weighted records in synchronous callbacks on wasm32 PHP 8.4.1. Retained or asynchronous callbacks, owned callback values, open dependent refinements, recursive refined callbacks, arbitrary predicates, dispatch cost and peak memory remain separate work. External Lean, PHP, Composer, Chromium, Nix, Emscripten and operating-system distributions remain trusted recorded inputs.";

const producer = "387f1c1897230beb09c05f7eda17faf70a64b415";
const hostedRun = Object.freeze({
	run: 39870952379, job: 120144963711, artifact: 12467650836
});
const validators = Object.freeze([
	"scripts/promote-callback-refinements-php-wasm-evidence.mjs"
	, "tests/callback-refinements-php-wasm.test.mjs"
	, "tests/helpers/callback-refinements-php-wasm-hosted-evidence.mjs"
	, "tests/helpers/callback-refinements-php-wasm-promotion-tests.mjs"
	, "tests/helpers/callback-refinements-php-wasm-promotion.mjs"
]);
const routePath = route => route === "ordinary" ? "ordinary-source" : "reviewed-ir";
const checkedMarker = " Additional checked-record callback acceptance:";

const shapes = Object.freeze({
	fin: Object.freeze({
		scope: "Closed Fin values cross every synchronous host-callback and returned-closure direction. Host-produced returned-closure inputs and host callback replies retain exact bounds; Lean-produced host callback arguments and returned-closure results preserve their proof-backed base values."
		, parameter: "Brick\\Math\\BigInteger values at host callback arguments and returned-closure inputs, checked against the declared bound when produced by the host"
		, result: "Brick\\Math\\BigInteger values at host callback replies and returned-closure results, checked against the declared bound when produced by the host"
		, conversion: "Use Brick\\Math\\BigInteger. A host callback whose signature contains Fin uses with_recovery(callback, value); recovery is checked before callback entry and is never successful output. Returned Lean closures reject out-of-bound inputs before their body and remain usable afterward."
	})
	, "checked-record": Object.freeze({
		scope: "Proof-free Interval and Weighted records cross every synchronous host-callback and returned-closure direction. Host-produced values run the constructor selected for that exact occurrence after nested field checks; Lean-produced values project payloads without proofs."
		, parameter: "generated proof-free readonly Interval, Weighted and owned Claim records at host callback arguments and returned-closure inputs, checked by their exact selected constructors when produced by the host"
		, result: "generated proof-free readonly Interval, Weighted and owned Claim records at host callback replies and returned-closure results, checked by their exact selected constructors when produced by the host"
		, conversion: "Use the generated readonly record class. Host callback replies require with_recovery(callback, value); nested fields and the exact selected record constructor validate recovery before callback entry and actual replies after return. Returned Lean closures validate host-produced record inputs before their body. Resource-bearing Claim values additionally retain the live Ticket owner for the synchronous call."
	})
});

/**
 * Require the exact hosted run, archive closure and promotion contract.
 *
 * @param reference - Candidate hosted promotion reference.
 */
export const assertCallbackRefinementsPhpWasmPromotionReference = reference => {
	assert.deepEqual(Object.keys(reference).sort(), [
		"artifact", "command", "files", "hostedRun", "id", "job", "kind"
		, "revision", "scope"
	]);
	assert.equal(reference.id, callbackRefinementsPhpWasmEvidenceId);
	assert.equal(reference.kind, "installed");
	assert.equal(reference.revision, producer);
	assert.equal(reference.hostedRun, hostedRun.run);
	assert.equal(reference.job, hostedRun.job);
	assert.equal(reference.artifact, hostedRun.artifact);
	assert.equal(reference.command
		, "node --test tests/helpers/callback-refinements-php-wasm-hosted-evidence-tests.mjs");
	assert.ok(reference.scope.includes(callbackRefinementsPhpWasmLimit));
	assert.equal(reference.files[0].path
		, `${callbackRefinementsPhpWasmHostedEvidence}/index.json`);
	assert.equal(reference.files[0].sha256
		, callbackRefinementsPhpWasmHostedEvidenceSha256);
	assert.equal(reference.files.length, 2354);
	assert.equal(new Set(reference.files.map(file => file.path)).size
		, reference.files.length);
	for(const file of reference.files)
		assert.match(file.sha256, /^[a-f0-9]{64}$/u, file.path);
	assert.deepEqual(reference.files.slice(-validators.length).map(file => file.path)
		, validators);
	assert.deepEqual(reference.artifacts, undefined);
	return reference;
};

/**
 * Replay the archive and derive the exact inventory evidence entry.
 *
 * @param check - Independently replay the retained archive.
 */
export const callbackRefinementsPhpWasmPromotionReference = async (
	check = checkCallbackRefinementsPhpWasmHostedEvidence
) => {
	const checked = await check();
	const { index } = checked;
	assert.deepEqual({
		producer: checked.producer, consumer: checked.consumer
		, checker: checked.checker, archiver: checked.archiver
	}, {
		producer, consumer: producer, checker: producer
		, archiver: "b419c5c84ef45c678bdc14bbb42f7115966f7d3a"
	});
	assert.deepEqual(index.profiles.map(item => item.profile)
		, callbackRefinementsPhpWasmProfiles);
	assert.deepEqual(
		index.profiles.flatMap(item => item.reports.map(report =>
			`${item.profile}/${report.route}`))
		, [
			"fin/ordinary", "fin/reviewed"
			, "checked-record/ordinary", "checked-record/reviewed"
		]
	);
	assert.deepEqual(index.accepted.results.map(item => ({
		profile: item.profile, route: item.route
		, executions: item.executions, checks: item.checks
	})), [
		{ profile: "fin", route: "ordinary", executions: 12, checks: 23 }
		, { profile: "fin", route: "reviewed", executions: 12, checks: 23 }
		, { profile: "checked-record", route: "ordinary", executions: 12, checks: 30 }
		, { profile: "checked-record", route: "reviewed", executions: 12, checks: 30 }
	]);
	assert.equal(index.hostedRun.runId, hostedRun.run);
	assert.equal(index.hostedRun.job.id, hostedRun.job);
	assert.equal(index.hostedRun.artifact.id, hostedRun.artifact);
	const files = [
		{ path: `${callbackRefinementsPhpWasmHostedEvidence}/index.json`
			, sha256: callbackRefinementsPhpWasmHostedEvidenceSha256 }
		, ...index.files.map(file => ({
			path: `${callbackRefinementsPhpWasmHostedEvidence}/${file.path}`
			, sha256: file.sha256
		}))
		, ...await Promise.all(validators.map(async path => ({
			path, sha256: sha256(await readFile(path))
		})))
	];
	const reference = {
		id: callbackRefinementsPhpWasmEvidenceId, kind: "installed"
		, revision: producer, hostedRun: hostedRun.run, job: hostedRun.job
		, artifact: hostedRun.artifact
		, command: "node --test tests/helpers/callback-refinements-php-wasm-hosted-evidence-tests.mjs"
		, scope: `GitHub Actions run ${hostedRun.run}, job ${hostedRun.job}, artifact ${hostedRun.artifact} rebuilt ordinary Lean source and independently reviewed Binding IR into complete Composer API, npm component and npm shared-runtime package sets. Two author roots reproduced each route; source-free packages installed offline, relocated and ran through weak and strict PHP in startup and lazy Node and Chromium contexts. The immutable archive retains and independently replays the original artifact, API responses, workflow output and exact source closures. ${callbackRefinementsPhpWasmLimit}`
		, files
	};
	return assertCallbackRefinementsPhpWasmPromotionReference(reference);
};

/**
 * Reduce an authenticated reference to the inventory's evidence schema.
 *
 * @param reference - Authenticated hosted evidence reference.
 */
export const callbackRefinementsPhpWasmInventoryEvidence = reference => ({
	id: reference.id, kind: reference.kind, revision: reference.revision
	, command: reference.command, scope: reference.scope
	, files: reference.files
	, artifacts: [{
		path: `${callbackRefinementsPhpWasmHostedEvidence}/hosted/artifact.zip.parts/0000.part`
		, sha256: "b1d01c52d53de1bcb1ed65ae6ca357928357fd059ef7f8ccfd33d8b07aa8d970"
	}]
});

const splitResourceObservation = (observation, route) => {
	assert.deepEqual(observation.shapes, ["resource", "checked-record"]);
	assert.ok(observation.scope.includes(checkedMarker));
	const checkedScope = observation.scope.slice(
		observation.scope.indexOf(checkedMarker) + checkedMarker.length
	).trim();
	observation.scope = observation.scope.slice(0
		, observation.scope.indexOf(checkedMarker));
	const checkedHostTypes = structuredClone(observation.hostTypes["checked-record"]);
	const checkedConversion = observation.conversionNotes["checked-record"];
	observation.shapes = ["resource"];
	observation.hostTypes = { resource: observation.hostTypes.resource };
	observation.conversionNotes = { resource: observation.conversionNotes.resource };
	assert.equal(observation.limitations.length, 4);
	observation.limitations = observation.limitations.slice(0, 3);
	let checkedNote;
	for(const stage of Object.values(observation.stages))
	{
		assert.ok(stage.note.includes(checkedMarker));
		const suffix = stage.note.slice(stage.note.indexOf(checkedMarker)
			+ checkedMarker.length).trim();
		if(checkedNote === undefined) checkedNote = suffix;
		else assert.equal(suffix, checkedNote);
		stage.note = stage.note.slice(0, stage.note.indexOf(checkedMarker));
		const checkedEvidence = stage.evidence.filter(id =>
			id.startsWith("owned-checked-record-php-wasm-"));
		assert.deepEqual(checkedEvidence, [
			`owned-checked-record-php-wasm-${routePath(route)}-full-installed`
		]);
		stage.evidence = stage.evidence.filter(id => !checkedEvidence.includes(id));
	}
	return { checkedScope, checkedHostTypes, checkedConversion, checkedNote };
};

/**
 * Promote four Fin and four checked-record cells without overlapping resources.
 *
 * @param original - Current support inventory.
 * @param reference - Authenticated hosted evidence reference.
 */
export const promoteCallbackRefinementsPhpWasm = (original, reference) => {
	assertCallbackRefinementsPhpWasmPromotionReference(reference);
	const inventory = structuredClone(original);
	assert.ok(!inventory.evidence.some(item => item.id === reference.id)
		, `Already promoted: ${reference.id}`);
	inventory.evidence.push(callbackRefinementsPhpWasmInventoryEvidence(reference));
	for(const route of callbackRefinementsPhpWasmRoutes)
	{
		const path = routePath(route);
		const label = route === "ordinary" ? "ordinary Lean source"
			: "independently reviewed Binding IR";
		const resource = inventory.observations.find(item =>
			item.id === `php-wasm-owned-callback-results-${path}`);
		assert.ok(resource, `${path} resource/checked-record observation`);
		const prior = splitResourceObservation(resource, route);
		for(const profile of callbackRefinementsPhpWasmProfiles)
		{
			const shape = shapes[profile];
			const priorEvidence = profile === "checked-record"
				? [`owned-checked-record-php-wasm-${path}-full-installed`] : [];
			const stage = note => ({
				state: "passed", evidence: [...priorEvidence, reference.id], note
			});
			const observation = {
				id: `callback-${profile}-php-wasm-${route}`
				, profiles: ["php-wasm"], shapes: [profile]
				, positions: [...callbackRefinementsPhpWasmPositions], path
				, scope: `${profile === "checked-record" ? `${prior.checkedScope} ` : ""}${shape.scope} The ${label} route reproduces, installs offline and relocates the complete Composer API, npm component and npm shared runtime before installed Node and Chromium execution.`
				, hostTypes: { [profile]: {
					"callback-parameter": profile === "checked-record"
						? `${prior.checkedHostTypes["callback-parameter"]}; ${shape.parameter}`
						: shape.parameter
					, "callback-result": profile === "checked-record"
						? `${prior.checkedHostTypes["callback-result"]}; ${shape.result}`
						: shape.result
				} }
				, conversionNotes: { [profile]: profile === "checked-record"
					? `${prior.checkedConversion} ${shape.conversion}` : shape.conversion }
				, stages: {
					analysis: stage(`${profile === "checked-record" ? `${prior.checkedNote} ` : ""}Fresh ${label} analysis retains every bound, selected constructor and callable direction.`)
					, generation: stage("Generated Lean, C and Zend adapters preserve host-versus-closure direction, first-error behavior and exact typed recovery.")
					, compilation: stage("The pinned Lean and Emscripten toolchains compile the checked wasm32 callback boundary.")
					, packaging: stage("Two independent author roots reproduce the complete source-free package set before offline installation and physical relocation.")
					, installedExecution: stage("Weak and strict public PHP callers pass in startup and lazy Node and Chromium hosts, including rejection, cleanup and later-call recovery.")
				}
				, limitations: [callbackRefinementsPhpWasmLimit]
			};
			assert.ok(!inventory.observations.some(item =>
				item.id === observation.id));
			inventory.observations.push(observation);
		}
	}
	return inventory;
};

/**
 * Render the human-readable boundary for the exact hosted promotion.
 *
 * @param reference - Authenticated hosted evidence reference.
 */
export const renderCallbackRefinementsPhpWasmPromotion = reference => {
	assertCallbackRefinementsPhpWasmPromotionReference(reference);
	return `# PHP-Wasm callback refinements\n\nThe immutable [hosted archive](callback-refinements-php-wasm-20261023/index.json) independently replays GitHub Actions run ${reference.hostedRun}, job ${reference.job}, artifact ${reference.artifact}. Ordinary Lean source and independently reviewed Binding IR each produced installed PHP-Wasm packages for copied Fin and checked-record callbacks.\n\n| Shape | Author route | Callback positions | Installed executions | Checks per execution |\n| --- | --- | --- | ---: | ---: |\n| Fin | ordinary source | parameter, result | 12 | 23 |\n| Fin | reviewed IR | parameter, result | 12 | 23 |\n| Checked record | ordinary source | parameter, result | 12 | 30 |\n| Checked record | reviewed IR | parameter, result | 12 | 30 |\n\nThe inventory promotes eight exact cells. Host-produced values are checked by the selected Lean constructor at callback replies and returned-closure inputs. Lean-produced values cross callback arguments and returned-closure results without proof fields. Exact typed recovery is validated before callback entry and is never successful output.\n\n${callbackRefinementsPhpWasmLimit}\n`;
};
