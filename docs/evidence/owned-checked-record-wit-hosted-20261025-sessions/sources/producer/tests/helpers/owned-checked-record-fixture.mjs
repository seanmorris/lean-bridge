/**
 * Independently stated owned checked-record contracts: a copied checked
 * record inside an owned aggregate, an owned record that itself carries
 * erased proofs, and an owned checked record with a nested checked Subtype
 * field. This contract is not compiler or installed-package evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { ownedSubtypePackageReviewedIr } from "./owned-aggregate-fixture.mjs";

export const ownedCheckedRecordFixture = "tests/fixtures/onboarding/owned-checked-records";
export const ownedCheckedRecordModule = "OwnedCheckedRecords";
const qualified = name => `${ownedCheckedRecordModule}.${name}`;
const named = name => ({ kind: "named", id: `lean:${qualified(name)}` });
const primitive = name => ({ kind: "primitive", name });
const applied = (constructor, ...args) => ({ kind: "apply", constructor, arguments: args });
const documentation = { summary: "Independent owned checked-record contract.", details: "" };
const policy = () => ({ ownership: "lease", disposal: "required", fallback: "queued-finalizer", cycles: "reject" });
const field = (name, type) => ({ name, type, mutability: "immutable", documentation });
const erased = fields => ({ "lean-lang.org/erased-proofs": { fields } });
const source = (declaration, extensions = {}) => ({ producer: "corpusReview", declaration, extensions });
const definition = (name, kind, representation, properties = {}) => ({
	id: named(name).id, name, kind, representation, mutability: "immutable"
	, typeParameters: [], fields: [], target: null, resource: null, callable: null
	, cases: [], host: null
	, aggregate: representation === "owned" && kind !== "alias" ? policy() : null
	, documentation, source: source(qualified(name)), assurance: [], ...properties
});
const nat = primitive("nat");
const leaf = name => ({ name, refinement: null });

/** Per-use trees: a consumed site names the exact constructor, a produced site names none. */
export const ownedCheckedRecordTrees = Object.freeze({
	window: constructor => ({ kind: "checked-record", name: qualified("Window"), constructor, fields: [leaf("lo"), leaf("hi")] })
	, booking: constructor => ({ kind: "record", name: qualified("Booking")
		, fields: [leaf("holder")
			, { name: "window", refinement: ownedCheckedRecordTrees.window(constructor) }] })
	, claim: constructor => ({ kind: "checked-record", name: qualified("Claim")
		, constructor, fields: [leaf("holder"), leaf("quota")] })
	, grant: (constructor, weight) => ({ kind: "checked-record"
		, name: qualified("Grant"), constructor
		, fields: [leaf("holder")
			, { name: "weight", refinement: { kind: "subtype", constructor: weight } }
			, leaf("limit")] })
});

/** The owned and copied definitions behind the Lean fixture of the same name. */
const types = () => {
	const ticket = named("Ticket");
	return [
		definition("Ticket", "resource", "identity", {
			mutability: "read"
			, resource: { kindId: `resource:${qualified("Ticket")}`, disposal: "required"
				, fallback: "queued-finalizer", cycles: "explicit-cut" }
		})
		, definition("Window", "record", "copied", {
			fields: [field("lo", nat), field("hi", nat)]
			, source: source(qualified("Window"), erased(["ordered"]))
		})
		, definition("Booking", "record", "owned", { fields: [field("holder", ticket), field("window", named("Window"))] })
		, definition("Claim", "record", "owned", {
			fields: [field("holder", ticket), field("quota", nat)]
			, source: source(qualified("Claim"), erased(["bounded"]))
		})
		, definition("Grant", "record", "owned", {
			fields: [field("holder", ticket), field("weight", nat), field("limit", nat)]
			, source: source(qualified("Grant"), erased(["within"]))
		})
	];
};

/**
 * Build the reviewed owned contract on the owned Subtype package skeleton.
 *
 * @param options - Optional result-only selection.
 * @param options.resultOnly - Keep only Lean-produced checked records.
 */
export const ownedCheckedRecordReviewedIr = ({ resultOnly = false } = {}) => {
	const ir = ownedSubtypePackageReviewedIr();
	const template = ir.declarations.find(item => item.name === "echoRecord");
	const declarationTypes = types(), definitions = new Map(declarationTypes.map(type => [type.id, type]));
	const copied = ref => ref.kind === "primitive" || (ref.kind === "named"
		? definitions.get(ref.id).representation === "copied" : ref.arguments.every(copied));
	const site = (type, result, ownership) => copied(type) ? { type, ownership: "copy", lifetime: null }
		: { type, ownership: ownership ?? (result ? "lease" : "borrow")
			, lifetime: { scope: result ? "explicit" : "call", anchor: null } };
	const declaration = (name, parameters, result, refinements = null, ownership = undefined) => ({
		...structuredClone(template), id: `lean:${qualified(name)}`, name
		, overloadKey: qualified(name)
		, parameters: parameters.map((type, index) => ({ name: `arg${index}`
			, ...site(type, false, ownership)
			, mutability: "immutable", optional: false, default: null }))
		, result: site(result, true)
		, effects: [...(parameters.some(type => !copied(type)) ? ["reads-resource"] : []), ...(!copied(result) ? ["allocates"] : [])].sort()
		, source: source(qualified(name), refinements ? { "lean-lang.org/refinements": refinements } : {})
	});
	const ticket = named("Ticket"), booking = named("Booking"), claim = named("Claim"), grant = named("Grant");
	const trees = ownedCheckedRecordTrees;
	const full = [
		declaration("newTicket", [nat, primitive("string")], ticket)
		, declaration("serial", [ticket], nat)
		, declaration("echoBooking", [booking], booking, { parameters: [trees.booking(qualified("mkWindow"))], result: trees.booking(null) })
		, declaration("bookingSpan", [booking], nat, { parameters: [trees.booking(qualified("mkWindow"))], result: null })
		, declaration("echoClaim", [claim], claim, { parameters: [trees.claim(qualified("mkClaim"))], result: trees.claim(null) })
		, declaration("claimQuota", [claim], nat, { parameters: [trees.claim(qualified("mkClaim"))], result: null })
		, declaration("transferClaim", [claim], claim, { parameters: [trees.claim(qualified("mkClaim"))], result: trees.claim(null) }, "transfer")
		, declaration("echoGrant", [grant], grant, { parameters: [trees.grant(qualified("mkGrant"), qualified("checkedPositive"))], result: trees.grant(null, null) })
		, declaration("echoClaims", [applied("array", claim)], applied("array", claim)
			, { parameters: [{ kind: "array", arguments: [trees.claim(qualified("mkClaim"))] }], result: { kind: "array", arguments: [trees.claim(null)] } })
		, declaration("claimFor", [ticket], applied("option", claim), { parameters: [null], result: { kind: "option", arguments: [trees.claim(null)] } })
	];
	ir.component = { id: "owned-checked-records@1.0.0", name: "owned-checked-records", version: "1.0.0" };
	ir.types = declarationTypes;
	// A result-only API keeps Lean-produced checked records and the resource they need.
	ir.declarations = resultOnly ? full.filter(item => ["newTicket", "serial", "claimFor"].includes(item.name)) : full;
	if(resultOnly) ir.types = ir.types.filter(type => ["Ticket", "Claim"].includes(type.name));
	assert.ok(ir.declarations.length > 0);
	return ir;
};
