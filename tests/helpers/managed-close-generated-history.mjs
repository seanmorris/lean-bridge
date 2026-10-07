/**
 * Select exact Python/Ruby generated predecessors without rewriting receipts.
 *
 * @file
 */
import assert from "node:assert/strict";
import { canonicalJson } from "../../src/capsule/node.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { ownedPythonAnchoredValues } from "../../src/backends/python/owned-borrows.mjs";
import { ownedRubyAnchoredValues } from "../../src/backends/ruby/owned-borrows.mjs";

const restore = (source, edits) => {
	for(const [current, previous] of edits)
	{
		assert.equal(source.split(current).length, 2);
		source = source.replace(current, previous);
	}
	return source;
};
const python = restore(ownedPythonAnchoredValues, [
	["    def is_closed(self):\n        storage = None\n        try:\n            storage = self._storage\n            return storage is None or storage.lease.closed\n        finally:\n            storage = None", "    def is_closed(self):\n        return self._storage is None or self._storage.lease.closed"]
	, ["    def retain(self):\n        storage = None\n        try:\n            storage = self._storage\n            if storage is None:\n                raise LeanBridgeError(4)\n            storage.lease.require()\n            value = storage.value\n            return storage.copy(value, _whole=True)", "    def retain(self):\n        storage = None\n        try:\n            value = self.get()\n            storage = self._storage\n            return storage.copy(value, _whole=True)"]
	, ["    def __copy__(self):\n        storage = None\n        try:\n            storage = self._storage\n            if storage is None:\n                raise LeanBridgeError(4)\n            storage.lease.require()\n            _owned_checkpoint()\n            result = object.__new__(type(self))\n            result._storage = storage\n            return result\n        finally:\n            storage = None", "    def __copy__(self):\n        self.get()\n        _owned_checkpoint()\n        result = object.__new__(type(self))\n        result._storage = self._storage\n        return result"]
]);
const ruby = restore(ownedRubyAnchoredValues, [
	["    def checked_payload\n      guard = @guard\n      payload = guard&.payload\n      raise Error, 4 unless guard && !guard.released?\n      guard.lease.require_open\n      payload\n    end\n    private :checked_payload\n    def get; checked_payload[0]; end", "    def get\n      raise Error, 4 unless @guard && !@guard.released?\n      @guard.lease.require_open\n      @guard.payload[0]\n    end"]
	, ["    def retain\n      payload = checked_payload\n      payload[1].call(payload[0], whole: true)", "    def retain\n      value = get\n      @guard.payload[1].call(value, whole: true)"]
	, ["        payload = guard&.payload\n", ""]
	, ["        install(guard.lease, payload)", "        install(guard.lease, guard.payload)"]
]);

/**
 * Restore only a complete generated source matching the recorded old hash.
 *
 * @param source - Current generated runtime, optionally in its package wrapper.
 * @param expected - Recorded complete predecessor digest.
 */
export const beforeManagedCloseGenerated = (source, expected) => {
	assert.match(expected, /^[a-f0-9]{64}$/u);
	if(sha256(source) === expected) return source;
	const prior = source.replace(ownedPythonAnchoredValues, python).replace(ownedRubyAnchoredValues, ruby);
	return sha256(prior) === expected ? prior : source;
};

const withRuntime = (generated, path, current, previous) => {
	if(previous === current) return generated;
	assert.equal(generated.files[path].split(current).length, 2);
	const contract = { ...generated.contract, runtimeSha256: sha256(previous) };
	const manifest = JSON.parse(generated.files["binding-manifest.json"]);
	assert.deepEqual(manifest.contract, generated.contract);
	return { ...generated, contract
		, files: { ...generated.files
			, [path]: generated.files[path].replace(current, previous)
			, "binding-manifest.json": canonicalJson({ ...manifest, contract }) } };
};

/**
 * Preserve Python runtime bytes, package contract and embedded manifest together.
 *
 * @param generated - Current generated Python package.
 * @param expected - Recorded runtime contract.
 */
export const historicalManagedClosePythonPackage = (generated, expected) => {
	const path = `${generated.packageDir}/_owned.py`, current = generated.files[path];
	return withRuntime(generated, path, current, beforeManagedCloseGenerated(current, expected.runtimeSha256));
};

/**
 * Preserve Ruby's wrapped runtime and its unwrapped contract digest together.
 *
 * @param generated - Current generated Ruby package.
 * @param expected - Recorded runtime contract.
 */
export const historicalManagedCloseRubyPackage = (generated, expected) => {
	const path = `lib/${generated.requirePath}/owned.rb`;
	const prefix = `module LeanBridge\n  module ${generated.componentName}\n`;
	const suffix = "\n  end\nend\n", source = generated.files[path];
	assert.ok(source.startsWith(prefix) && source.endsWith(suffix));
	const current = source.slice(prefix.length, -suffix.length);
	return withRuntime(generated, path, current, beforeManagedCloseGenerated(current, expected.runtimeSha256));
};
