/**
 * Close the proof-erasure type-surface ledger without confusing installed
 * direct proof parameters with proof-only records or proof-valued exports.
 *
 * @file
 */
import assert from "node:assert/strict";
import { directProofErasureProfiles } from "./direct-proof-erasure-fixture.mjs";

export const directProofErasureMatrixProducer
	= "abcbf4ec22f873985d3e7c7341092b2650e0a011";
export const directProofErasureMatrixWorkflow
	= ".github/workflows/consumer-matrix.yml";
export const directProofErasureMatrixRoutes = Object.freeze([
	Object.freeze({ authorPath: "ordinary-source", reportRoute: "ordinary" })
	, Object.freeze({ authorPath: "reviewed-ir", reportRoute: "reviewed" })
]);

export const directProofErasureMatrixLanes = Object.freeze([
	Object.freeze({
		key: "npm", artifactPrefix: "direct-proof-erasure-node-browser"
		, job: "Node and browser npm consumers", checker: "npm"
		, profiles: Object.freeze([
			"node-javascript", "node-typescript", "browser-javascript"
			, "browser-react", "browser-worker"
		])
	})
	, Object.freeze({
		key: "native", artifactPrefix: "direct-proof-erasure-native"
		, job: "Native consumer (c-family)", checker: "native"
		, profiles: Object.freeze(["c", "cpp"])
	})
	, Object.freeze({
		key: "php", artifactPrefix: "direct-proof-erasure-php"
		, job: "PHP-Wasm", checker: "php"
		, profiles: Object.freeze(["php-native", "php-wasm"])
	})
	, ...[
		["perl", "Perl / Perl XS (5.38.2-threaded)"]
		, ["python", "Native consumer (python)"]
		, ["ruby", "Managed consumer (ruby)"]
		, ["rust", "Native consumer (rust)"]
	].map(([profile, job]) => Object.freeze({
		key: `language-${profile}`
		, artifactPrefix: `direct-proof-erasure-language-${profile}`
		, job, checker: "language", profile
		, profiles: Object.freeze([profile])
	}))
	, ...[
		["dotnet", ["dotnet"]]
		, ["jvm", ["java", "kotlin"]]
	].map(([group, profiles]) => Object.freeze({
		key: `managed-${group}`
		, artifactPrefix: `direct-proof-erasure-managed-${group}`
		, job: `Managed consumer (${group})`, checker: "managed", group
		, profiles: Object.freeze(profiles)
	}))
	, Object.freeze({
		key: "wit", artifactPrefix: "direct-proof-erasure-wit"
		, job: "WIT and WASI Component Model", checker: "wit"
		, profiles: Object.freeze(["wit-wasi"])
	})
]);

const profileLanes = new Map();
for(const lane of directProofErasureMatrixLanes)
{
	assert.deepEqual(Object.keys(lane).sort(), [
		"artifactPrefix", "checker", ...lane.group ? ["group"] : []
		, "job", "key", ...lane.profile ? ["profile"] : [], "profiles"
	].sort());
	assert.match(lane.key, /^[a-z0-9]+(?:-[a-z0-9]+)*$/u);
	assert.match(lane.artifactPrefix
		, /^direct-proof-erasure-[a-z0-9]+(?:-[a-z0-9]+)*$/u);
	assert.ok(typeof lane.job === "string" && lane.job.length > 0);
	assert.ok(["language", "managed", "native", "npm", "php", "wit"]
		.includes(lane.checker));
	assert.ok(lane.profiles.length > 0);
	for(const profile of lane.profiles)
	{
		assert.ok(directProofErasureProfiles.includes(profile), profile);
		assert.equal(profileLanes.has(profile), false, profile);
		profileLanes.set(profile, lane);
	}
}
assert.deepEqual([...profileLanes.keys()].sort(), directProofErasureProfiles);

/**
 * Resolve one consumer profile to its unique hosted package lane.
 *
 * @param profile - Closed consumer profile name.
 */
export const directProofErasureMatrixLaneFor = profile => {
	const lane = profileLanes.get(profile);
	assert.ok(lane, `Unknown proof-erasure profile: ${profile}`);
	return lane;
};

const cell = value => {
	assert.equal(typeof value, "string");
	const match = /^([^/]+)\/proof\/(ordinary-source|reviewed-ir)\/(parameter|result|field|callback-parameter|callback-result|signature)$/u.exec(value);
	assert.ok(match, value);
	assert.ok(directProofErasureProfiles.includes(match[1]), value);
	return { profile: match[1], authorPath: match[2], position: match[3] };
};

/**
 * Reconcile the exact retained audit with direct installed package evidence.
 * Field and callback cells keep their immutable retained bindings. Direct
 * parameter and public-signature cells require the new package matrix. A
 * proof-valued result remains an explicit compiler refusal, never a fake
 * zero-payload runtime result.
 *
 * @param audit - Proof-erasure-retained-evidence-audit-v1 document.
 */
export const closeDirectProofErasureMatrix = audit => {
	assert.equal(audit.schemaVersion, 1);
	assert.equal(audit.kind, "proof-erasure-retained-evidence-audit-v1");
	assert.deepEqual(audit.counts, {
		cells: 204, exactBindings: 102, residual: 102
		, adjacentRecordCandidatesRejected: 68, directSignaturesUnobserved: 34
	});
	assert.equal(audit.bindings.length, 102);
	assert.equal(audit.residual.length, 102);
	const dispositions = audit.bindings.map(binding => {
		const parsed = cell(binding.cell);
		assert.ok(["field", "callback-parameter", "callback-result"]
			.includes(parsed.position), binding.cell);
		return Object.freeze({
			cell: binding.cell, disposition: "retained-installed"
			, evidence: binding.evidence, basis: binding.basis
			, retained: binding.retained
		});
	});
	for(const residual of audit.residual)
	{
		const parsed = cell(residual.cell);
		assert.ok(["parameter", "result", "signature"]
			.includes(parsed.position), residual.cell);
		if(parsed.position === "result")
		{
			dispositions.push(Object.freeze({
				cell: residual.cell, disposition: "explicit-refusal"
				, reason: "proof-valued-export-has-no-runtime-api"
				, control: Object.freeze({
					path: "tests/elaborated-metadata.test.mjs"
					, name: "fresh Lean erases a closed proof binder and refuses conditional or proof-result APIs"
					, diagnostic: "proof-only"
				})
			}));
			continue;
		}
		const lane = directProofErasureMatrixLaneFor(parsed.profile);
		const route = directProofErasureMatrixRoutes.find(item =>
			item.authorPath === parsed.authorPath);
		assert.ok(route);
		dispositions.push(Object.freeze({
			cell: residual.cell, disposition: "direct-installed"
			, behavior: parsed.position === "parameter"
				? "closed-proof-parameters-erased" : "proof-free-public-signature"
			, lane: lane.key, artifactPrefix: lane.artifactPrefix, job: lane.job
			, route: route.reportRoute
		}));
	}
	dispositions.sort((left, right) => left.cell.localeCompare(right.cell));
	assert.equal(dispositions.length, 204);
	assert.equal(new Set(dispositions.map(item => item.cell)).size, 204);
	const counts = Object.freeze({
		cells: dispositions.length
		, retainedInstalled: dispositions.filter(item =>
			item.disposition === "retained-installed").length
		, directInstalled: dispositions.filter(item =>
			item.disposition === "direct-installed").length
		, explicitRefusals: dispositions.filter(item =>
			item.disposition === "explicit-refusal").length
	});
	assert.deepEqual(counts, {
		cells: 204, retainedInstalled: 102
		, directInstalled: 68, explicitRefusals: 34
	});
	return Object.freeze({ counts, dispositions: Object.freeze(dispositions) });
};

/**
 * Require one authenticated ordinary and reviewed result for every hosted lane.
 *
 * @param results - Normalized lane/route checker results.
 * @param producerCommit - Exact package producer revision.
 */
export const validateDirectProofErasureMatrixResults = (
	results, producerCommit = directProofErasureMatrixProducer
) => {
	assert.match(producerCommit, /^[a-f0-9]{40}$/u);
	assert.ok(Array.isArray(results));
	const expected = directProofErasureMatrixLanes.flatMap(lane =>
		directProofErasureMatrixRoutes.map(route =>
			`${lane.key}/${route.reportRoute}`)).sort();
	assert.deepEqual(results.map(result => `${result.lane}/${result.route}`).sort()
		, expected);
	const profiles = [];
	for(const result of results)
	{
		const lane = directProofErasureMatrixLanes.find(item =>
			item.key === result.lane);
		assert.ok(lane);
		assert.ok(directProofErasureMatrixRoutes.some(item =>
			item.reportRoute === result.route));
		assert.equal(result.producerCommit, producerCommit);
		assert.deepEqual([...result.profiles].sort(), [...lane.profiles].sort());
		profiles.push(...result.profiles.map(profile =>
			`${profile}/${result.route}`));
	}
	assert.equal(results.length, 20);
	assert.equal(new Set(profiles).size, 34);
	return Object.freeze({ lanes: 10, routes: 2, profiles: 17, cells: 34 });
};
