/**
 * Break one Python lifetime rule at a time without changing the public fixture.
 *
 * @file
 */
import assert from "node:assert/strict";

/**
 * Select faults that must fail semantic checks after Python accepts the code.
 *
 * @param generated - Checked Python API, conversions and runtime.
 * @param combined - Include host replies and consuming receivers.
 */
export const ownedPythonCallbackMutations = (generated, combined) => {
	const runtime = generated.files[`${generated.packageDir}/_owned.py`];
	const cases = [
		["closure-owner-instead-of-argument", "_native.py", generated.source
			, "anchor = owner2.owner(state)", "anchor = arg0._lease.owner(state)"
			, "LeanBridgeError: Invalid argument"]
		, ["unchecked-whole-owner", "_owned.py", runtime
			, "            storage.lease.require()\n            return storage.value"
			, "            return storage.value", "Expected <class"]
		, ["retained-closure-traceback", "__init__.py", generated.valuesSource
			, "self = arg0 = arg1 = None", "pass"
			, "native-record/python/0: retained traceback leaked"]
		, ...combined ? [
			["escaped-host-frame", "_owned.py", runtime
				, "            self.scope.active = False"
				, "            self.scope.active = True"
				, "escaped callback arguments must expire"]
			, ["missing-whole-host-reply", "_native.py", generated.source
				, "if type(reply) is _R.Value: reply = reply.get()"
				, "pass", "TypeError: Expected Bundle"]
			, ["reply-converted-after-expiration", "_native.py", generated.source
				, "reply_scope = _OwnedScope(state, budget=scope.budget)"
				, "borrowed.close(); reply_scope = _OwnedScope(state, budget=scope.budget)"
				, "LeanBridgeError"]
			, ["retained-host-reply-traceback", "_native.py", generated.source
				, "reply = converted = borrowed_output = incoming = reply_scope = borrowed = None"
				, "pass", "host-whole/python/42: retained traceback leaked"]
		] : []
	];
	return cases.map(([name, path, original, before, after, diagnostic]) => {
		const occurrences = original.split(before).length - 1;
		assert.ok(occurrences > 0, name);
		return { name, path, original, occurrences
			, source: original.replaceAll(before, after), diagnostic };
	});
};
