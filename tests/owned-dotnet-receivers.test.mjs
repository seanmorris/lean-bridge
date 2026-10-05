/**
 * Actual C# properties and receiver methods retain original Lean lifetimes.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { generateOwnedDotnetCalls } from "../src/backends/dotnet/owned-calls.mjs";
import { ownedAggregateReviewedIr } from "./helpers/owned-aggregate-fixture.mjs";
import { ownedRustBorrowReviewedIr } from "./helpers/owned-rust-borrow-fixture.mjs";
import { ownedRustReceiverConfiguration, ownedRustReceiverReviewedIr, ownedRustReceiverSource
	, ownedRustPlainReceiverReviewedIr } from "./helpers/owned-rust-receiver-fixture.mjs";
import { compileOwnedDotnetFixture } from "./helpers/owned-dotnet-native.mjs";
import { instrumentOwnedDotnetReceivers, ownedDotnetReceiverProbe, ownedDotnetReceiverProject } from "./helpers/owned-dotnet-receiver-fixture.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";

const options = { transferredInputs: true, anchoredResults: true, receiverExports: true };

test("C# receivers expose typed owners and actual properties without changing older APIs", () => {
	const ir = ownedRustReceiverReviewedIr(), before = structuredClone(ir);
	assert.throws(() => generateOwnedDotnetCalls(ir, { ...options, receiverExports: false }), /only synchronous function/u);
	const model = generateOwnedDotnetCalls(ir, options);
	assert.deepEqual(ir, before);
	assert.equal(model.functions.length, 27);
	assert.equal(model.functions.filter(fn => fn.receiver === 0).length, 16);
	assert.equal(model.functions.filter(fn => fn.anchor !== undefined).length, 20);
	assert.match(model.files["Values.cs"], /public sealed class TicketValue : Value<Ticket>/u);
	assert.match(model.files["Values.cs"], /public global::System\.Numerics\.BigInteger Serial\n {4}\{\n {8}get/u);
	assert.match(model.files["Values.cs"], /Api\.ChooseTicket\(Get\(\), arg1\)/u);
	assert.match(model.files["Values.cs"], /Api\.TransferTicket\(this\)/u);
	assert.match(model.files["Api.cs"], /public static _V\.TicketValue NewTicket/u);
	for(const name of ["get", "share", "retain", "dispose", "isClosed", "sameIdentity"])
	{
		const invalid = structuredClone(ir); invalid.declarations.find(fn => fn.name === "serial").name = name;
		assert.throws(() => generateOwnedDotnetCalls(invalid, options), /receiver member is reserved/u);
	}
	const shuffled = structuredClone(ir); shuffled.types.reverse();
	assert.deepEqual(generateOwnedDotnetCalls(shuffled, options).files, model.files);
	for(const previous of [ownedAggregateReviewedIr(), ownedRustBorrowReviewedIr()])
		assert.deepEqual(generateOwnedDotnetCalls(previous, options).files, generateOwnedDotnetCalls(previous, { ...options, receiverExports: false }).files);
});

test("C# resource receivers need neither result-anchor nor callback capability", () => {
	for(const consuming of [false, true])
	{
		const model = generateOwnedDotnetCalls(ownedRustPlainReceiverReviewedIr(consuming), {
			receiverExports: true, hostCallbacks: false, transferredInputs: consuming
		});
		assert.equal(model.c.anchoredResults, undefined);
		assert.equal(model.c.copies, undefined);
		assert.doesNotMatch(model.files["Lifetime.cs"] + model.files["Calls.cs"], /result_validate|OwnedCallback\d/u);
		assert.match(model.files["Values.cs"], /public sealed class TicketValue/u);
	}
});

for(const mode of ["ordinary", "reviewed"]) test(`C# receiver members preserve original owners (${mode})`, {
	skip: process.env.LEAN_BRIDGE_OWNED_DOTNET_RECEIVER_TEST !== "1"
	, timeout: 900000
}, async t => {
	const compiled = await compileOwnedDotnetFixture(t, {
		...mode === "ordinary" ? { configuration: await ownedRustReceiverConfiguration() } : { reviewedIr: ownedRustReceiverReviewedIr() }
		, ...options, sourceSuffix: ownedRustReceiverSource
		, evidenceName: `dotnet-receivers-${mode}-inputs.json`
	});
	const source = await ownedDotnetReceiverProbe();
	const files = { ...compiled.model.files, "Program.cs": source
		, "Lifetime.cs": instrumentOwnedDotnetReceivers(compiled.model.files["Lifetime.cs"])
		, "Calls.csproj": ownedDotnetReceiverProject, "Invalid.cs": "" };
	const compile = async overrides => {
		try
		{ return await compiled.compile({ ...files, ...overrides }); }
		catch(error)
		{ throw new Error(`${error.message}: ${JSON.stringify(error.details)}`, { cause: error }); }
	};
	const execute = await compile({}), execution = await execute("receivers");
	assert.equal(execution.stderr, "");
	const observed = JSON.parse(execution.stdout);
	assert.ok(observed.checks > 100); assert.equal(observed.live, 0); assert.equal(observed.identities, 0);
	assert.equal(observed.receiverCollections, 21);
	assert.equal(observed.memberCollections, 9);
	for(const name of ["managedBefore", "managedAfter", "nativeBefore", "nativeAfter"]) assert.ok(observed[name] > 0, name);
	t.diagnostic(JSON.stringify({ mode, phase: "baseline", ...observed }));
	const rejected = [];
	for(const [name, statement, diagnostic] of [
		["wrong-owner", "void Invalid(BundleValue value) { _ = value.Serial; }", /CS1061/u]
		, ["raw-receiver-anchor", "void Invalid(Ticket value) { value.RetainTicket(); }", /CS1061/u]
		, ["raw-parameter-anchor", "void Invalid(TicketValue value) { value.ChooseTicket(value.Get()); }", /CS1503/u]
		, ["read-only-property", "void Invalid(TicketValue value) { value.Serial = 9; }", /CS0200/u]
		, ["property-not-method", "void Invalid(TicketValue value) { value.Serial(); }", /CS1955/u]
	]) {
		await assert.rejects(compile({ "Invalid.cs": `using ${compiled.model.namespace};\ninternal static class Misuse { internal static ${statement} }` }), diagnostic);
		rejected.push(name);
	}
	const mutations = [
		["receiver-used-as-parameter-anchor", "Values.cs", "Api.ChooseTicket(Get(), arg1)", "Api.ChooseTicket(Get(), this)", /method borrows from the selected non-receiver argument/u]
		, ["unchecked-whole-value", "Lifetime.cs", "        Lease.Require();\n        if (global::System.Threading.Volatile.Read(ref closed)", "        if (global::System.Threading.Volatile.Read(ref closed)", /Expected LeanBridgeException/u]
		, ["escaped-callback-frame", "Lifetime.cs", "    public void Dispose() { scope.Active = false; }", "    public void Dispose() { scope.Active = true; }", /exception status|callback borrow is closed/u]
		, ["unrooted-receiver-member", "Values.cs", "try { return Api.Serial(Get()); }\n            finally { global::System.GC.KeepAlive(this); }", "try { return Api.Serial(Get()); }\n            finally { }", /temporary nominal receiver remains rooted/u]
	];
	const rejectedMutations = [];
	for(const [name, path, before, after, diagnostic] of mutations)
	{
		assert.equal(files[path].split(before).length, 2, name);
		const changed = files[path].replace(before, after);
		const mutated = await compile({ [path]: changed });
		await assert.rejects(mutated("receivers"), error => {
			assert.match(error.details?.stderr ?? "", diagnostic, name);
			return true;
		});
		rejectedMutations.push({ name, compiled: true, semanticRejection: true
			, sourceSha256: sha256(changed), diagnostic: diagnostic.source });
	}
	const restore = await compile({}), restored = await restore("receivers");
	assert.equal(restored.stdout, execution.stdout);
	await saveLakeFile("build/owned-dotnet-receivers", `${mode}.json`, canonicalJson({
		mode, actualLean: true, installedPackage: false
		, observed, rejected, rejectedMutations, restored: true
		, input: { metadata: compiled.metadata, sourceIdentity: compiled.sourceIdentity, component: compiled.model.c.native.model.component }
		, generated: Object.fromEntries(Object.entries(compiled.model.files).map(([path, text]) => [path, sha256(text)]))
		, nativeProbeSha256: sha256(compiled.implementation)
		, loaderSha256: sha256(compiled.loader)
		, probeSha256: sha256(source), optimizedProject: ownedDotnetReceiverProject
		, optimizedProjectSha256: sha256(ownedDotnetReceiverProject)
	}));
	t.diagnostic(JSON.stringify({ mode, ...observed }));
});
