/**
 * Compile ownership misuse and executable lifetime mutants against real Lean.
 *
 * @file
 */
import assert from "node:assert/strict";
import { sha256 } from "../../src/capsule/node.mjs";
import { ownedDotnetReceiverProject } from "./owned-dotnet-receiver-fixture.mjs";

/**
 * Verify C# rejects incompatible owner types and catches removed runtime guards.
 *
 * @param compiled - Fresh Lean component and generated C# bindings.
 * @param probe - Exact successful baseline C# probe.
 * @param baseline - Successful baseline stdout for the final restoration check.
 * @param hostCallbacks - Include raw/whole host delegate misuse and frame guards.
 */
export const checkOwnedDotnetCallbackResultGuards = async (compiled, probe, baseline, hostCallbacks) => {
	const checkpoint = "internal static void Checkpoint() { }";
	assert.equal(compiled.model.files["Lifetime.cs"].split(checkpoint).length, 2);
	const files = { ...compiled.model.files, "Program.cs": probe, "Invalid.cs": ""
		, "Calls.csproj": ownedDotnetReceiverProject
		, "Lifetime.cs": compiled.model.files["Lifetime.cs"].replace(checkpoint,
			"internal static void Checkpoint() { global::Program.Allocation(); }") };
	const compile = async changes => {
		try
		{ return await compiled.compile({ ...files, ...changes }); }
		catch(error)
		{ throw new Error(`${error.message}: ${JSON.stringify(error.details)}`, { cause: error }); }
	};
	const record = compiled.model.functions.find(fn => fn.name === "callbackRecord");
	const callback = compiled.model.callbacks.find(fn => fn.id === record.parameters[1]);
	const native = callback.publicType, delegate = callback.delegateType;
	const invalid = [
		["raw-anchor", `void Invalid(${native} closure, Bundle value) { closure.Invoke(value); }`, /CS1503/u]
		, ["wrong-whole-owner", `void Invalid(${native} closure, Value<Tree> value) { closure.Invoke(value); }`, /CS1503/u]
		, ["missing-owner-argument", `void Invalid(${native} closure) { closure.Invoke(); }`, /CS7036/u]
		, ["native-is-not-raw-delegate", `void Invalid(${native} closure) { ${delegate} callback = closure.AsCallback; _ = callback; }`, /CS0029/u]
		, ...hostCallbacks ? [
			["host-input-is-raw", `${delegate} Invalid() => (Value<Bundle> value) => value;`, /CS1661|CS1678/u]
			, ["wrong-host-result", `${delegate} Invalid() => value => 42;`, /CS0029|CS1662/u]
			, ["wrong-whole-reply", "CallbackResult<Tree> Invalid(Value<Bundle> value) => value;", /CS0029/u]
			, ["async-host-callback", `${delegate} Invalid() => async value => { await System.Threading.Tasks.Task.Yield(); return value; };`, /CS4010/u]
		] : []
	];
	const rejected = [];
	for(const [name, statement, diagnostic] of invalid)
	{
		const source = `using ${compiled.model.namespace};\ninternal static class Misuse { internal static ${statement} }`;
		await assert.rejects(compile({ "Invalid.cs": source }), diagnostic);
		rejected.push({ name, source, diagnostic: diagnostic.source });
	}
	const mutations = [
		["non-whole-closure-used-as-original-owner", "Calls.cs"
			, "var anchor = arg2.Guard.Require(state).Owner(state);"
			, "var anchor = arg0.Lease.Owner(state);"
			, /LeanBridgeException: Invalid argument/u]
		, ["unchecked-whole-result", "Lifetime.cs"
			, "        Lease.Require();\n        if (global::System.Threading.Volatile.Read(ref closed)"
			, "        if (global::System.Threading.Volatile.Read(ref closed)"
			, /expired callback owner was accepted/u]
	];
	if(hostCallbacks) mutations.push(["escaped-host-frame", "Lifetime.cs"
		, "public void Dispose() { scope.Active = false; }"
		, "public void Dispose() { scope.Active = true; }"
		, /escaped host callback view expires/u]);
	const rejectedMutations = [];
	for(const [name, path, before, after, diagnostic] of mutations)
	{
		const occurrences = files[path].split(before).length - 1;
		assert.ok(occurrences > 0, name);
		const changed = files[path].replaceAll(before, after);
		const execute = await compile({ [path]: changed });
		await assert.rejects(execute(), error => {
			assert.match(error.details?.stderr ?? "", diagnostic, name); return true;
		});
		rejectedMutations.push({ name, compiled: true, semanticRejection: true
			, occurrences
			, sourceSha256: sha256(changed), diagnostic: diagnostic.source });
	}
	const execute = await compile({}), restored = await execute();
	assert.equal(restored.stderr, ""); assert.equal(restored.stdout, baseline);
	return { rejected, rejectedMutations, restored: true };
};
