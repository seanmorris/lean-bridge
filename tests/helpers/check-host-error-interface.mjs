/** @file Check the error declaration and payload ownership behind the native client tests. */
import assert from "node:assert/strict";

/**
 * Require a named, immediate EIO failure with an independently leased host object.
 *
 * @param api - Compiled binding IR from the installed Workshop or its peer.
 */
export const checkHostErrorInterface = api => {
	const fail = api.declarations.find(d => d.id === "lean:Workshop.failWith");
	const payload = {kind: "named", id: "host:meter.Box"};
	assert.equal(fail.source.extensions["lean-lang.org/effect"], "EIO");
	assert.deepEqual(fail.failure, {mode: "declared", errors: ["error:EIO.Workshop.failWith"], unexpected: "poison-runtime"});
	assert.deepEqual(fail.source.extensions["lean-bridge.dev/error-payload-site"], {type: payload, ownership: "lease", lifetime: {anchor: null, scope: "explicit"}});
	assert.deepEqual(api.errors.find(e => e.id === fail.failure.errors[0]).payload, payload);
};
