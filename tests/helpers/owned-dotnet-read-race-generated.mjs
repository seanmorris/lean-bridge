/**
 * Reconstruct hash-selected C# predecessors without changing frozen receipts.
 *
 * @file
 */
import assert from "node:assert/strict";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { ownedDotnetWholeGuard, ownedDotnetWholeValues } from "../../src/backends/dotnet/owned-borrows.mjs";

/**
 * Undo recorded payload-holder and receiver-rooting edits at one complete identity.
 *
 * @param source - Complete generated lifetime or value source.
 * @param expected - Digest recorded before the lifetime repair.
 */
export const beforeOwnedDotnetReadRaceGenerated = (source, expected) => {
	assert.match(expected, /^[a-f0-9]{64}$/u);
	if(sha256(source) === expected) return source;
	let prior = ownedDotnetWholeGuard;
	for(const [current, previous] of [
		["    private sealed class Payload\n    {\n        internal readonly T Value;\n        internal Payload(T value) { Value = value; }\n    }\n    private Payload? payload;", "    private T value;"]
		, ["        Lease = lease;\n        OwnedRuntime.Checkpoint(); payload = new(value);", "        Lease = lease; this.value = value;"]
		, ["        var snapshot = global::System.Threading.Volatile.Read(ref payload);\n", ""]
		, ["        return snapshot!.Value;", "        return value;"]
		, ["        global::System.Threading.Volatile.Write(ref payload, null);", "        value = default!;"]
	]) {
		assert.equal(prior.split(current).length, 2); prior = prior.replace(current, previous);
	}
	let restored = source.replace(ownedDotnetWholeGuard, prior);
	prior = ownedDotnetWholeValues;
	for(const [current, previous] of [
		["    public T Get()\n    {\n        try { return Guard.Get(); }\n        finally { global::System.GC.KeepAlive(this); }\n    }", "    public T Get() => Guard.Get();"]
		, ["    public Value<T> Share()\n    {\n        try { return new(Guard.Lease, Get(), retain); }\n        finally { global::System.GC.KeepAlive(this); }\n    }", "    public Value<T> Share() => new(Guard.Lease, Get(), retain);"]
		, ["    public Value<T> Retain()\n    {\n        try { return retain(Get()); }\n        finally { global::System.GC.KeepAlive(this); }\n    }", "    public Value<T> Retain() => retain(Get());"]
		, ["        try\n        {\n            var value = Get();\n            return other is not null && GraphValues.Equal(value, other.Get());\n        }\n        finally { global::System.GC.KeepAlive(this); global::System.GC.KeepAlive(other); }", "        var value = Get();\n        return other is not null && GraphValues.Equal(value, other.Get());"]
		, ["        try\n        {\n            Get();\n            return other is Value<T> value && Equals(value);\n        }\n        finally { global::System.GC.KeepAlive(this); global::System.GC.KeepAlive(other); }", "        Get();\n        return other is Value<T> value && Equals(value);"]
	]) {
		assert.equal(prior.split(current).length, 2); prior = prior.replace(current, previous);
	}
	restored = restored.replace(ownedDotnetWholeValues, prior);
	return sha256(restored) === expected ? restored : source;
};

/**
 * Restore an authenticated private-call lifetime file without broad rewriting.
 *
 * @param generated - Current private call projection.
 * @param expected - Recorded complete generated-file digests.
 */
export const historicalDotnetReadRaceCalls = (generated, expected) => ({ ...generated
	, files: Object.fromEntries(Object.entries(generated.files).map(([path, source]) => [path
		, ["Lifetime.cs", "Values.cs"].includes(path) ? beforeOwnedDotnetReadRaceGenerated(source, expected[path]) : source])) });

/**
 * Bind the historical lifetime source to its exact package contract and manifest.
 *
 * @param generated - Current source package projection.
 * @param expected - Recorded whole-value runtime and value declaration digests.
 */
export const historicalDotnetReadRacePackage = (generated, expected) => {
	const path = `src/${generated.assembly}/Lifetime.cs`, current = generated.files[path];
	const previous = beforeOwnedDotnetReadRaceGenerated(current, expected.runtimeSha256);
	const valuesSource = beforeOwnedDotnetReadRaceGenerated(generated.valuesSource, expected.valuesSha256);
	if(previous === current && valuesSource === generated.valuesSource) return generated;
	const valuesPath = `src/${generated.assembly}/Values.cs`;
	const valuesFile = generated.files[valuesPath];
	assert.equal(valuesFile.split(generated.valuesSource).length, 2);
	const contract = { ...generated.contract, runtimeSha256: sha256(previous)
		, valuesSha256: sha256(valuesSource) };
	const manifest = JSON.parse(generated.files["binding-manifest.json"]);
	assert.deepEqual(manifest.ownedValues, generated.contract);
	return { ...generated, contract, valuesSource
		, files: { ...generated.files, [path]: previous
			, [valuesPath]: valuesFile.replace(generated.valuesSource, valuesSource)
			, "binding-manifest.json": canonicalJson({ ...manifest, ownedValues: contract }) } };
};
