/**
 * Reconstruct exact XS defects and require semantic failures with restored controls.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { assertOwnedPerlCallbackSources } from "./owned-perl-callback-result-runtime-evidence.mjs";
import { ownedPerlCallbackMutations } from "./owned-perl-callback-result-mutants.mjs";
import { assertOwnedPerlReceiverMatrix, ownedPerlReceiverVariant } from "./owned-perl-receiver-evidence.mjs";

const keys = (value, expected) => assert.deepEqual(Object.keys(value).sort(), [...expected].sort());
const compiled = { code: 0, stdout: "", stderr: "" };
const positive = (item, perl) => {
	keys(item, ["execution", "observed"]);
	const abi = ownedPerlReceiverVariant(perl);
	const expected = {
		actualLean: true, installedPackage: false, variant: "combined"
		, checks: 92, phases: { native: 37, host: 21, combined: 32 }
		, managedLive: 0, nativeLive: 0, identities: 0, owners: 0
		, active: 0, cleanupStatus: 0
		, perlVersion: "v" + abi.split("-")[0]
		, threaded: Number(!abi.endsWith("unthreaded"))
	};
	assert.deepEqual(item.observed, expected);
	const stdout = JSON.stringify(JSON.parse(canonicalJson(expected))) + "\n";
	assert.deepEqual(item.execution, { code: 0, signal: null, stdout, stderr: "" });
};

/**
 * Check all compiled defects against freshly reconstructed source and raw output.
 *
 * @param mode - Independently required ordinary or reviewed producer.
 * @param item - Original complete mutant report.
 */
export const assertOwnedPerlCallbackMutants = async (mode, item) => {
	const fields = [
		"schemaVersion", "kind", "mode", "variant", "actualLean", "installedPackage"
		, "scope", "complete", "options", "input", "nativeSourceSha256"
		, "declarationsSha256", "valuesSha256", "xsSha256", "probe", "probeSha256"
		, "observations"
	];
	keys(item, fields);
	assert.equal(item.schemaVersion, 1); assert.equal(item.complete, true);
	assert.equal(item.kind, "owned-perl-callback-result-compiled-mutants");
	assert.equal(item.scope, "direct-runtime-compiled-semantic-negative-controls");
	assert.equal(item.mode, mode); assert.equal(item.variant, "combined");
	assert.equal(item.actualLean, true); assert.equal(item.installedPackage, false);
	const { sources, xs } = await assertOwnedPerlCallbackSources(mode, "combined", item);
	const probe = await readFile("tests/fixtures/structured-types/owned-perl-callback-results.pl", "utf8");
	assert.equal(item.probe, probe); assert.equal(item.probeSha256, sha256(probe));
	const mutations = ownedPerlCallbackMutations(sources.xs, xs);
	assert.equal(mutations.length, 4); assertOwnedPerlReceiverMatrix(item.observations);
	for(const observation of item.observations)
	{
		keys(observation, ["perl", "baselineCompilation", "baseline", "rejectedMutations", "final"]);
		assert.deepEqual(observation.baselineCompilation, compiled);
		positive(observation.baseline, observation.perl); positive(observation.final, observation.perl);
		assert.equal(observation.rejectedMutations.length, mutations.length);
		for(const [index, actual] of observation.rejectedMutations.entries())
		{
			const { source, ...expected } = mutations[index];
			assert.equal(expected.sourceSha256, sha256(source));
			const { compilation, execution, restorationCompilation, restored, ...claim } = actual;
			assert.deepEqual(claim, { ...expected, compiled: true, semanticRejected: true });
			assert.deepEqual(compilation, compiled); assert.deepEqual(restorationCompilation, compiled);
			keys(execution, ["code", "signal", "stdout", "stderr"]);
			assert.equal(execution.code, 255); assert.equal(execution.signal, null);
			assert.equal(execution.stdout, "");
			assert.ok(execution.stderr.endsWith("\n"));
			assert.match(execution.stderr.slice(0, -1), new RegExp(expected.semantic.pattern, "u"));
			assert.doesNotMatch(execution.stderr, /segmentation|core dumped|double free|invalid pointer|unreleased (?:native|Perl) ownership/iu);
			positive(restored, observation.perl);
		}
	}
};
