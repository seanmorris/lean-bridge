/**
 * Owned checked records: a copied checked record inside an owned aggregate,
 * an owned record that itself carries erased proofs, and an owned checked
 * record with a nested checked Subtype field. These controls stay at the
 * source and generator level; installed hosts prove execution separately.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { canonicalizeJsonValue } from "../src/binding-ir/canonical.mjs";
import {
	assertRefinement, callbackDefinitionRefinement, declarationRefinements
} from "../src/abi/refinements.mjs";
import { compileOwnedAggregateModel } from "../src/abi/owned-aggregate-model.mjs";
import { validateOwnedNativeType } from "../src/analyze/native-types.mjs";
import {
	reviewedOwnedSourceSelection, validateReviewedOwnedSource
} from "../src/analyze/reviewed-owned-source.mjs";
import { ownedCCallbacks } from "../src/backends/c/owned-callbacks.mjs";
import { generateOwnedCValues } from "../src/backends/c/owned-values.mjs";
import { generateOwnedNativeBindingAdapters } from "../src/backends/native/owned-value-adapters.mjs";
import { processBuildRunner } from "../src/build/process-runner.mjs";
import { ownedCheckedRecordModule, ownedCheckedRecordReviewedIr, ownedCheckedRecordTrees } from "./helpers/owned-checked-record-fixture.mjs";
import "./helpers/owned-checked-record-callable-source-history-tests.mjs";
import "./helpers/owned-checked-record-foundation-source-history-tests.mjs";

const module = ownedCheckedRecordModule, q = name => `${module}.${name}`;
const erasedKey = "lean-lang.org/erased-proofs", refinementKey = "lean-lang.org/refinements";
const capture = document => {
	const source = canonicalJson(document);
	return { schemaVersion: 1, path: "api.binding-ir.json", source
		, sourceSha256: sha256(source)
		, semanticSha256: sha256(canonicalizeJsonValue(document)) };
};
const unsupported = path => ({ code: "reviewed-ir-build-unsupported", details: { path } });
const declaration = (ir, name) => ir.declarations.find(item => item.name === name);
const type = (ir, name) => ir.types.find(item => item.name === name);

test("reviewed side: full and result-only owned builds admit checked records only with their exact per-site decisions", () => {
	for(const resultOnly of [false, true])
	{
		const ir = ownedCheckedRecordReviewedIr({ resultOnly });
		assert.deepEqual(validateReviewedOwnedSource(capture(ir)), ir);
		assert.ok(compileOwnedAggregateModel(ir));
	}
	const refused = (mutate, path) => {
		const ir = ownedCheckedRecordReviewedIr();
		mutate(ir);
		assert.throws(() => validateReviewedOwnedSource(capture(ir)), unsupported(path));
	};
	const claim = `lean:${q("Claim")}`;
	// The erased-proofs extension belongs to a record definition and names proof fields only.
	refused(ir => { type(ir, "Claim").source.extensions[erasedKey] = { fields: [] }; }, `${claim}.source.extensions.${erasedKey}`);
	refused(ir => { type(ir, "Claim").source.extensions[erasedKey] = { fields: ["bounded", "bounded"] }; }, `${claim}.source.extensions.${erasedKey}`);
	refused(ir => { type(ir, "Claim").source.extensions[erasedKey] = { fields: ["quota"] }; }, `${claim}.source.extensions.${erasedKey}`);
	refused(ir => { type(ir, "Claim").source.extensions[erasedKey] = ["bounded"]; }, `${claim}.source.extensions.${erasedKey}`);
	refused(ir => { type(ir, "Claim").source.extensions[erasedKey] = { fields: ["bounded"], extra: true }; }, `${claim}.source.extensions.${erasedKey}`);
	refused(ir => { type(ir, "Ticket").source.extensions[erasedKey] = { fields: ["p"] }; }, `lean:${q("Ticket")}.source.extensions`);
	refused(ir => { declaration(ir, "echoClaim").source.extensions[erasedKey] = { fields: ["bounded"] }; }, `lean:${q("echoClaim")}.source.extensions`);
	// Every consumed occurrence names its constructor; a produced occurrence names none.
	refused(ir => { declaration(ir, "echoClaim").source.extensions[refinementKey].parameters[0] = null; }, `lean:${q("echoClaim")}.parameters[0]`);
	refused(ir => { declaration(ir, "echoBooking").source.extensions[refinementKey].parameters[0] = null; }, `lean:${q("echoBooking")}.parameters[0]`);
	refused(ir => { declaration(ir, "echoClaims").source.extensions[refinementKey].parameters[0] = null; }, `lean:${q("echoClaims")}.parameters[0]`);
	refused(ir => { declaration(ir, "echoClaim").source.extensions[refinementKey].result = ownedCheckedRecordTrees.claim(q("mkClaim")); }, `lean:${q("echoClaim")}.result`);
	refused(ir => { declaration(ir, "echoClaim").source.extensions[refinementKey].parameters[0] = ownedCheckedRecordTrees.claim(null); }, `lean:${q("echoClaim")}.parameters[0]`);
	refused(ir => { declaration(ir, "echoGrant").source.extensions[refinementKey].parameters[0] = ownedCheckedRecordTrees.grant(q("mkGrant"), null); }, `lean:${q("echoGrant")}.source.extensions.${refinementKey}`);
	// A produced nested result keeps its payload tree; a top-level produced record may be bare.
	refused(ir => { declaration(ir, "echoBooking").source.extensions[refinementKey].result = null; }, `lean:${q("echoBooking")}.result`);
	const bare = ownedCheckedRecordReviewedIr();
	declaration(bare, "echoClaim").source.extensions[refinementKey].result = null;
	assert.deepEqual(validateReviewedOwnedSource(capture(bare)), bare);
});

const ownedCheckedCallbackIr = role => {
	const document = ownedCheckedRecordReviewedIr();
	const claim = { kind: "named", id: `lean:${q("Claim")}` };
	const host = role === "host";
	const refinements = {
		parameters: [ownedCheckedRecordTrees.claim(
			host ? null : q("mkClaim")
		)]
		, result: ownedCheckedRecordTrees.claim(host ? q("mkClaim") : null)
	};
	const signature = { parameters: [claim], result: claim, refinements };
	const name = `Callback${sha256(canonicalJson(signature)).slice(0, 20)}`;
	const failure = { mode: "declared", errors: ["error:native-callback"]
		, unexpected: "poison-runtime" };
	const callable = {
		parameters: [{ name: "arg0", type: claim, ownership: "borrow"
			, lifetime: { scope: "call", anchor: null }, mutability: "immutable"
			, optional: false, default: null }]
		, result: { type: claim, ownership: "lease"
			, lifetime: { scope: "explicit", anchor: null } }
		, effects: ["host-call", "fails"], failure, resultMode: "value"
		, invocation: "many", reentry: "same-agent", selfDisposal: "defer"
	};
	document.types.push({ ...structuredClone(type(document, "Ticket"))
		, id: `bridge:${name}`, name, kind: "callback", representation: "identity"
		, mutability: "immutable", resource: null, aggregate: null, callable
		, source: { producer: "corpusReview", declaration: name
			, extensions: { [refinementKey]: refinements } } });
	document.errors = [{ id: "error:native-callback", name: "NativeCallbackFailure"
		, category: "boundary", payload: null
		, documentation: { summary: "Independent owned checked-record contract."
			, details: "" } }];
	const operation = structuredClone(declaration(document, "claimQuota"));
	operation.id = `lean:${q(host ? "withClaimCallback" : "claimClosure")}`;
	operation.name = host ? "withClaimCallback" : "claimClosure";
	operation.overloadKey = q(operation.name);
	operation.source = { producer: "corpusReview"
		, declaration: q(operation.name), extensions: {} };
	const callback = { kind: "named", id: `bridge:${name}` };
	if(host)
	{
		operation.parameters = [{ name: "arg0", type: callback
			, ownership: "borrow", lifetime: { scope: "call", anchor: null }
			, mutability: "immutable", optional: false, default: null }];
		operation.result = { type: { kind: "primitive", name: "nat" }
			, ownership: "copy", lifetime: null };
		operation.effects = ["fails", "host-call", "reads-resource"];
		operation.failure = failure;
	}
	else
	{
		operation.parameters = [];
		operation.result = { type: callback, ownership: "lease"
			, lifetime: { scope: "explicit", anchor: null } };
		operation.effects = ["allocates"];
		operation.failure = { mode: "none", errors: []
			, unexpected: "poison-runtime" };
	}
	document.declarations = [operation];
	return { document, name, operation, refinements };
};

test("reviewed owned callbacks preserve exact host and closure checked-record directions", () => {
	const identities = new Set();
	for(const role of ["host", "closure"])
	{
		const { document, name, operation, refinements } = ownedCheckedCallbackIr(role);
		identities.add(name);
		assert.deepEqual(validateReviewedOwnedSource(capture(document)), document);
		const definition = document.types.find(item => item.id === `bridge:${name}`);
		assert.deepEqual(callbackDefinitionRefinement(
			definition, document.types, { ownedStructural: true }
		), refinements);
		assert.throws(() => callbackDefinitionRefinement(definition, document.types)
			, /Callback refinement direction is inconsistent/u);
		const contract = reviewedOwnedSourceSelection(
			capture(document)
		).contracts[operation.source.declaration];
		const site = role === "host" ? contract.parameters[0] : contract.result;
		assert.equal(site.ownership, role === "host" ? "borrow" : "lease");
		assert.deepEqual(site.callable.parameters[0].refinement
			, role === "closure" ? {
				kind: "checked-record", name: q("Claim")
				, constructor: q("mkClaim")
				, fields: [{ name: "holder", refinement: null }
					, { name: "quota", refinement: null }]
			} : undefined);
		assert.deepEqual(site.callable.result.refinement
			, role === "host" ? {
				kind: "checked-record", name: q("Claim")
				, constructor: q("mkClaim")
				, fields: [{ name: "holder", refinement: null }
					, { name: "quota", refinement: null }]
			} : undefined);
		const model = compileOwnedAggregateModel(document);
		const callback = model.types.find(item => item.id === `bridge:${name}`);
		assert.equal(callback.callable.direction, role);
		assert.deepEqual(model.refinementModel.sites.map(item => ({
			position: item.position, direction: item.direction
		})), role === "host" ? [
			{ position: { kind: "parameter", index: 0 }, direction: "result" }
			, { position: { kind: "result" }, direction: "input" }
		] : [
			{ position: { kind: "parameter", index: 0 }, direction: "input" }
			, { position: { kind: "result" }, direction: "result" }
		]);
		const generated = generateOwnedNativeBindingAdapters({
			document, sourceIdentity: {}
			, declarations: [{ name: operation.source.declaration, module }]
			, metadataSha256: "b".repeat(64), hostCallbacks: true
		});
		assert.equal(generated.carriers.hostCallbacks[0].direction, role);
		const validatorKey = role === "host"
			? `bridge:${name}\0result\0-1`
			: `bridge:${name}\0parameter\0${0}`;
		assert.deepEqual(Object.keys(generated.carriers.refinementValidators)
			, [validatorKey]);
		assert.match(generated.carriers.leanSource
			, new RegExp(`_root_\\.${module}\\.mkClaim`, "u"));
		const validator = generated.carriers.refinementValidators[validatorKey];
		if(role === "host")
		{
			const values = generateOwnedCValues(document, {
				hostCallbacks: true, publicPrefix: "checked_callback"
			});
			const source = ownedCCallbacks(values, generated.carriers);
			assert.equal(source.match(new RegExp(
				`if \\(!${validator}\\((?:returned|recovery)\\)\\)`, "gu"
			))?.length, 2);
		}
		else
		{
			assert.match(generated.source
				, new RegExp(`if \\(!${validator}\\(child\\)\\)`, "u"));
		}
	}
	assert.equal(identities.size, 2);
});

test("reviewed owned callback carriers elaborate against their proof-carrying Lean values", {
	skip: process.env.LEAN_BRIDGE_ELABORATED_METADATA_TEST !== "1"
	, timeout: 120000
}, async t => {
	const directory = await mkdtemp(join(tmpdir()
		, "lean-bridge-owned-checked-callbacks-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const fixture = resolve(
		"tests/fixtures/onboarding/owned-checked-records/OwnedCheckedRecords.lean"
	);
	await writeFile(join(directory, `${module}.lean`)
		, `${await readFile(fixture, "utf8")}\nnamespace ${module}\n\ndef withClaimCallback (_callback : Claim → Claim) : Nat := 0\n\ndef claimClosure : Claim → Claim := id\n\nend ${module}\n`);
	const leanPrefix = resolve(process.env.LEAN_BRIDGE_LEAN_PREFIX
		?? ".toolchains/elan/toolchains/leanprover--lean4---v4.32.2");
	const lean = join(leanPrefix, "bin/lean");
	const env = { ...process.env, LEAN_PATH: directory
		, PATH: `${join(leanPrefix, "bin")}:${process.env.PATH}` };
	const compile = async args => {
		try
		{ await processBuildRunner.capture({ command: lean, args, cwd: directory, env }); }
		catch(error)
		{ throw new Error(error.details?.stderr || error.details?.stdout || error.message, { cause: error }); }
	};
	await compile(["-o", `${module}.olean`, `${module}.lean`]);
	for(const role of ["host", "closure"])
	{
		const { document, operation } = ownedCheckedCallbackIr(role);
		const generated = generateOwnedNativeBindingAdapters({
			document, sourceIdentity: {}
			, declarations: [{ name: operation.source.declaration, module }]
			, metadataSha256: "b".repeat(64), hostCallbacks: true
		});
		const file = `Generated${role === "host" ? "Host" : "Closure"}.lean`;
		await writeFile(join(directory, file), generated.carriers.leanSource);
		await compile([file]);
	}
});

test("owned checked-record receivers and incomplete callback decisions have located refusals", () => {
	const receiver = ownedCheckedRecordReviewedIr();
	const quota = declaration(receiver, "claimQuota");
	quota.kind = "property"; quota.owner = `lean:${q("Claim")}`;
	const { type: receiverType, ownership, lifetime, mutability } = quota.parameters[0];
	quota.receiver = { type: receiverType, ownership, lifetime, mutability }; quota.parameters = [];
	delete quota.source.extensions[refinementKey];
	assert.throws(() => validateReviewedOwnedSource(capture(receiver)), unsupported(`lean:${q("claimQuota")}.receiver`));
	const callback = ownedCheckedRecordReviewedIr();
	const claim = { kind: "named", id: `lean:${q("Claim")}` };
	const name = `Callback${sha256(canonicalJson({ parameters: [claim], result: claim })).slice(0, 20)}`;
	const failure = { mode: "declared", errors: ["error:native-callback"], unexpected: "poison-runtime" };
	callback.types.push({ ...structuredClone(type(callback, "Ticket"))
		, id: `bridge:${name}`, name, kind: "callback", representation: "identity"
		, mutability: "immutable", resource: null, aggregate: null
		, source: { producer: "corpusReview", declaration: name, extensions: {} }
		, callable: { parameters: [{ name: "arg0", type: claim, ownership: "borrow", lifetime: { scope: "call", anchor: null }, mutability: "immutable", optional: false, default: null }]
			, result: { type: claim, ownership: "lease", lifetime: { scope: "explicit", anchor: null } }
			, effects: ["host-call", "fails"], failure
			, resultMode: "value", invocation: "many"
			, reentry: "same-agent", selfDisposal: "defer" } });
	callback.errors = [{ id: "error:native-callback", name: "NativeCallbackFailure"
		, category: "boundary", payload: null
		, documentation: { summary: "Independent owned checked-record contract.", details: "" } }];
	assert.throws(() => validateReviewedOwnedSource(capture(callback)), unsupported(`bridge:${name}.callable`));
	const wrong = ownedCheckedCallbackIr("host");
	wrong.operation.parameters = [];
	wrong.operation.result = { type: { kind: "named", id: `bridge:${wrong.name}` }
		, ownership: "lease", lifetime: { scope: "explicit", anchor: null } };
	wrong.operation.effects = ["allocates"];
	wrong.operation.failure = { mode: "none", errors: []
		, unexpected: "poison-runtime" };
	assert.throws(() => validateReviewedOwnedSource(capture(wrong.document))
		, unsupported(`${wrong.operation.id}.result.type`));
	const reversed = ownedCheckedCallbackIr("host");
	reversed.refinements.parameters[0] = ownedCheckedRecordTrees.claim(q("mkClaim"));
	reversed.refinements.result = ownedCheckedRecordTrees.claim(null);
	const reversedDefinition = reversed.document.types.find(
		item => item.id === `bridge:${reversed.name}`
	);
	const claimType = { kind: "named", id: `lean:${q("Claim")}` };
	const reversedName = `Callback${sha256(canonicalJson({
		parameters: [claimType], result: claimType, refinements: reversed.refinements
	})).slice(0, 20)}`;
	assert.notEqual(reversedName, reversed.name);
	reversedDefinition.id = `bridge:${reversedName}`;
	reversedDefinition.name = reversedName;
	reversedDefinition.source.declaration = reversedName;
	reversed.operation.parameters[0].type.id = reversedDefinition.id;
	assert.throws(() => validateReviewedOwnedSource(capture(reversed.document))
		, unsupported(`${reversed.operation.id}.parameters[0].type`));
});

test("owned checked-record refinement trees require the explicit ownership-aware boundary", () => {
	const ir = ownedCheckedRecordReviewedIr();
	const claim = { kind: "named", id: `lean:${q("Claim")}` };
	const consumed = ownedCheckedRecordTrees.claim(q("mkClaim")), produced = ownedCheckedRecordTrees.claim(null);
	assert.doesNotThrow(() => assertRefinement(consumed, claim, 0, true, ir.types, false, true));
	assert.doesNotThrow(() => assertRefinement(produced, claim, 0, true, ir.types, true, true));
	// Without the opt-in an owned checked record is refused exactly like an owned plain record.
	assert.throws(() => assertRefinement(consumed, claim, 0, true, ir.types, false, false), /Refinement does not match its transport type/u);
	const echo = declaration(ir, "echoClaim");
	assert.deepEqual(declarationRefinements(echo, echo.source.extensions[refinementKey], ir.types, { ownedStructural: true }), echo.source.extensions[refinementKey]);
	assert.throws(() => declarationRefinements(echo, echo.source.extensions[refinementKey], ir.types), /Refinement does not match its transport type/u);
	for(const moved of [{ parameters: [produced], result: produced }, { parameters: [consumed], result: consumed }])
		assert.throws(() => declarationRefinements(echo, moved, ir.types, { ownedStructural: true }), /Refinement does not match its transport type/u);
	// A copied checked record nested in an owned aggregate uses the copied rule below it.
	const booking = declaration(ir, "echoBooking");
	assert.ok(declarationRefinements(booking, booking.source.extensions[refinementKey], ir.types, { ownedStructural: true }));
});

const policy = { ownership: "lease", disposal: "required", fallback: "queued-finalizer", cycles: "reject" };
const heap = { cType: "lean_object*", box: "lean_box", unbox: "lean_unbox", heap: true };
const nat = { kind: "primitive", name: "nat", lean: "Nat", abi: heap };
const ticket = { kind: "resource", name: q("Ticket"), lean: q("Ticket"), module, abi: heap };
const reference = name => ({ kind: "reference", name: q(name), lean: q(name), abi: heap });
const checked = (name, constructor) => ({ kind: "refinement", base: reference(name), predicate: { kind: "checked-record", constructor }, abi: heap });
const record = (name, fields, erased) => ({ kind: "record"
	, name: q(name), lean: q(name), constructor: `${q(name)}.mk`, abi: heap
	, fields: fields.map(([field, value]) => ({ name: field
		, projection: `${q(name)}.${field}`, type: value }))
	, ...(erased ? { erased } : {}) });
const graph = (root, types) => structuredClone({ kind: "owned-graph", root, types, policy, abi: heap });
const claimRecord = () => record("Claim", [["holder", ticket], ["quota", nat]], ["bounded"]);
const windowRecord = () => record("Window", [["lo", nat], ["hi", nat]], ["ordered"]);
const bookingRecord = window => record("Booking", [["holder", ticket], ["window", window]]);

test("ordinary side: native owned graphs carry erased proof names on their checked record definitions", () => {
	// Full API: a consumed site names the constructor; result-only API: Lean produces it bare.
	const input = graph(checked("Claim", q("mkClaim")), [claimRecord()]), output = graph(reference("Claim"), [claimRecord()]);
	assert.equal(validateOwnedNativeType(input, policy, "parameter"), input);
	assert.equal(validateOwnedNativeType(output, policy, "result"), output);
	const nested = graph(reference("Booking"), [bookingRecord(checked("Window", q("mkWindow"))), windowRecord()]);
	const projected = graph(reference("Booking"), [bookingRecord(reference("Window")), windowRecord()]);
	assert.equal(validateOwnedNativeType(nested, policy, "parameter"), nested);
	assert.equal(validateOwnedNativeType(projected, policy, "result"), projected);
	// A constructor never appears at a produced site, and a checked site needs a direction.
	assert.throws(() => validateOwnedNativeType(input, policy, "result"), /checked records require a structural native parameter constructor/u);
	assert.throws(() => validateOwnedNativeType(input, policy), /checked records require a structural native parameter constructor/u);
	// Erased names are validated exactly as in a copied graph.
	for(const erased of [[], ["bounded", "bounded"], ["quota"], ["1bad"]])
		assert.throws(() => validateOwnedNativeType(graph(checked("Claim", q("mkClaim")), [{ ...claimRecord(), erased }]), policy, "parameter"), /invalid erased proof fields/u);
	// Only records carry erased proofs; every other table entry stays closed.
	const variant = { kind: "variant", name: q("Choice"), lean: q("Choice")
		, abi: heap, erased: ["p"]
		, cases: [{ name: "one", constructor: `${q("Choice")}.one`, fields: [{ name: "ticket", type: ticket }] }] };
	assert.throws(() => validateOwnedNativeType(graph(reference("Choice"), [variant]), policy, "parameter"), /descriptor fields must be closed/u);
});

test("ordinary side: every consumed checked-record occurrence in an owned graph names its constructor", () => {
	const refusal = /checked records require a structural native parameter constructor/u;
	const at = (root, types, site) => validateOwnedNativeType(graph(root, types), policy, site);
	const array = element => ({ kind: "array", element, abi: heap });
	const option = element => ({ kind: "option", element, abi: heap });
	const alias = (name, target) => ({ kind: "alias", name: q(name), lean: q(name), target, abi: heap });
	const branch = (name, fields) => ({ name
		, constructor: `${q("Choice")}.${name}`, fields });
	const choice = value => ({ kind: "variant"
		, name: q("Choice"), lean: q("Choice"), abi: heap
		, cases: [branch("none", [])
			, branch("some", [{ name: "claim", type: value }])] });
	const recursive = child => record("Claim", [["holder", ticket], ["quota", nat]
		, ["children", array(child)]], ["bounded"]);
	// Direct: a bare consumed record would skip its constructor; a bare produced one is valid.
	assert.throws(() => at(reference("Claim"), [claimRecord()], "parameter"), refusal);
	assert.throws(() => at(reference("Claim"), [claimRecord()], undefined), refusal);
	assert.doesNotThrow(() => at(reference("Claim"), [claimRecord()], "result"));
	// Nested in an owned record field.
	assert.throws(() => at(reference("Booking"), [bookingRecord(reference("Window")), windowRecord()], "parameter"), refusal);
	assert.doesNotThrow(() => at(reference("Booking"), [bookingRecord(checked("Window", q("mkWindow"))), windowRecord()], "parameter"));
	assert.doesNotThrow(() => at(reference("Booking"), [bookingRecord(reference("Window")), windowRecord()], "result"));
	// Through a transparent alias.
	assert.throws(() => at(reference("ClaimAlias"), [alias("ClaimAlias", reference("Claim")), claimRecord()], "parameter"), refusal);
	assert.doesNotThrow(() => at(checked("ClaimAlias", q("mkClaim")), [alias("ClaimAlias", reference("Claim")), claimRecord()], "parameter"));
	// Inside structural containers.
	assert.throws(() => at(array(reference("Claim")), [claimRecord()], "parameter"), refusal);
	assert.throws(() => at(option(reference("Claim")), [claimRecord()], "parameter"), refusal);
	assert.doesNotThrow(() => at(array(checked("Claim", q("mkClaim"))), [claimRecord()], "parameter"));
	assert.doesNotThrow(() => at(array(reference("Claim")), [claimRecord()], "result"));
	// In an active variant case.
	assert.throws(() => at(reference("Choice"), [choice(reference("Claim")), claimRecord()], "parameter"), refusal);
	assert.doesNotThrow(() => at(reference("Choice"), [choice(checked("Claim", q("mkClaim"))), claimRecord()], "parameter"));
	// Inside a directional callback the direction bit decides: Lean produces a host
	// callback's arguments bare, and a leased closure's arguments come from the host.
	const callback = (parameters, result) => ({ kind: "callback", parameters, result, abi: heap });
	const bare = graph(reference("Claim"), [claimRecord()]);
	assert.doesNotThrow(() => validateOwnedNativeType(callback([bare], nat), policy, "parameter"));
	assert.throws(() => validateOwnedNativeType(callback([bare], nat), policy, "result"), refusal);
	// A recursive back-edge inherits the constructor selected on the finite path to it.
	assert.doesNotThrow(() => at(checked("Claim", q("mkClaim")), [recursive(reference("Claim"))], "parameter"));
	assert.throws(() => at(reference("Claim"), [recursive(reference("Claim"))], "parameter"), refusal);
	assert.doesNotThrow(() => at(reference("Claim"), [recursive(reference("Claim"))], "result"));
});

const adapters = (name, transferredInputs = false) => {
	const document = ownedCheckedRecordReviewedIr();
	document.declarations = document.declarations.filter(item => item.name === name);
	return generateOwnedNativeBindingAdapters({ document, sourceIdentity: {}
		, declarations: [{ name: q(name), module }], metadataSha256: "a".repeat(64)
		, transferredInputs });
};

/**
 * Build a two-argument export whose earlier argument is a borrowed or transferred owned
 * Booking (with a nested copied checked Window) and whose later argument is an owned
 * checked Claim, so the later constructor can reject after the earlier one converted.
 *
 * @param ownership - Shared ownership of both inputs.
 */
const pairAdapters = ownership => {
	const document = ownedCheckedRecordReviewedIr();
	const claim = declaration(document, "echoClaim"), booking = declaration(document, "echoBooking");
	const pair = structuredClone(claim);
	Object.assign(pair, { id: `lean:${q("pairClaim")}`, name: "pairClaim", overloadKey: q("pairClaim") });
	pair.source.declaration = q("pairClaim");
	pair.parameters = [booking.parameters[0], claim.parameters[0]].map((value, index) => ({
		...structuredClone(value), name: `arg${index}`, ownership
		, lifetime: { scope: "call", anchor: null }
	}));
	pair.result = { type: { kind: "primitive", name: "nat" }, ownership: "copy", lifetime: null };
	pair.effects = ["reads-resource"];
	const trees = [ownedCheckedRecordTrees.booking(q("mkWindow"))
		, ownedCheckedRecordTrees.claim(q("mkClaim"))];
	pair.source.extensions[refinementKey] = { parameters: trees, result: null };
	document.declarations = [pair];
	return generateOwnedNativeBindingAdapters({ document, sourceIdentity: {}
		, declarations: [{ name: q("pairClaim"), module }]
		, metadataSha256: "a".repeat(64)
		, transferredInputs: ownership === "transfer" });
};

test("late failure: a later owned checked-record rejection aborts after an earlier borrowed or transferred conversion", () => {
	for(const ownership of ["borrow", "transfer"])
	{
		const generated = pairAdapters(ownership);
		const [first, second] = Object.values(generated.carriers.refinementValidators);
		assert.ok(first && second && first !== second, ownership);
		const source = generated.source;
		const accepted = source.indexOf(`if (!${first}(child))`);
		const pushed = source.indexOf("arguments = lean_array_push(arguments, child);", accepted);
		const rejection = `if (!${second}(child)) { lean_dec(child); lean_dec(arguments); return ov_abort(&transaction, LB_OWNED_INVALID); }`;
		const rejected = source.indexOf(rejection);
		// The earlier owned argument has converted, passed its own constructor and joined the
		// transaction-owned argument array before the later constructor can reject.
		assert.ok(accepted >= 0 && pushed > accepted && rejected > pushed, ownership);
		// The rejection releases that earlier conversion with the array and aborts the
		// transaction, whose cleanup returns every borrowed or prepared lease.
		assert.equal(source.split(rejection).length, 2, ownership);
		const abort = source.slice(source.indexOf("static inline int ov_abort(ov_transaction *transaction, int status) {"));
		assert.match(abort, /^static inline int ov_abort[^}]+ov_release\(transaction->allocations\); transaction->allocations = NULL;/u, ownership);
		assert.match(abort.slice(0, abort.indexOf("\nstatic inline")), /int cleanup = lb_owned_scope_abort\(&transaction->scope\);/u, ownership);
		const call = source.indexOf("lean_object *returned = ", rejected);
		const commit = source.indexOf("status = ov_commit(&transaction, owner);", rejected);
		assert.ok(call > rejected && commit > call, ownership);
		const handoff = source.indexOf("status = lb_owned_scope_transfer_many", accepted);
		const consumed = source.indexOf("transfer->consumed = 1; transfer->consume(transfer->context);", accepted);
		if(ownership === "transfer")
		{
			// Nothing moves or is consumed until every constructor has accepted.
			assert.ok(source.indexOf("ov_transfers_prepare(&transaction, transfer, 2, batches, &batch_count)") < accepted);
			assert.ok(handoff > rejected && consumed > handoff && call > consumed);
		}
		else assert.ok(handoff < 0 || handoff > commit, "a borrowed call never transfers");
	}
});

test("owned checked-record adapters construct before transfer and erase produced records", () => {
	const transfer = adapters("transferClaim", true);
	const [validator] = Object.values(transfer.carriers.refinementValidators);
	const preflight = transfer.source.indexOf(`if (!${validator}(child))`);
	const handoff = transfer.source.lastIndexOf("status = lb_owned_scope_transfer_many");
	assert.ok(preflight >= 0 && handoff > preflight, "the record constructor runs before any lease moves");
	for(const [name, constructor] of [["echoClaim", "mkClaim"], ["transferClaim", "mkClaim"], ["echoBooking", "mkWindow"], ["echoGrant", "mkGrant"], ["echoClaims", "mkClaim"]])
	{
		const lean = (name === "transferClaim" ? transfer : adapters(name)).carriers.leanSource;
		assert.match(lean, new RegExp(`_root_\\.${module}\\.${constructor} `, "u"), name);
		assert.doesNotMatch(lean, /sorry|unsafeCast|axiom/u);
	}
	// The owned mirror keeps the resource itself, so the lease identity survives erasure.
	const claim = adapters("echoClaim").carriers.leanSource;
	assert.match(claim, new RegExp(`structure LbOwnedErased\\.${module}\\.Claim where\\n {2}«holder» : _root_\\.${module}\\.Ticket\\n {2}«quota» : _root_\\.Nat\\n`, "u"));
	assert.doesNotMatch(claim, /«bounded»/u);
	// A nested checked Subtype field runs before the record constructor and erases to its base.
	const grant = adapters("echoGrant").carriers.leanSource;
	assert.ok(grant.indexOf(`_root_.${module}.checkedPositive`) < grant.indexOf(`_root_.${module}.mkGrant`));
	assert.match(grant, /_root_\.Subtype\.val \(\(_sourceResult\)\.«weight»\)/u);
	// A result-only export validates nothing; Lean already holds every proof.
	assert.deepEqual(Object.values(adapters("claimFor").carriers.refinementValidators ?? {}), []);
	assert.doesNotMatch(adapters("claimFor").carriers.leanSource, new RegExp(`_root_\\.${module}\\.mkClaim `, "u"));
});
