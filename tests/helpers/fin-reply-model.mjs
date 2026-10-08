/**
 * A compiler-shaped model of the FinReplies fixture (VO #1453), with its nominal types under a chosen
 * module path, for checking the installed consumers against generated public headers without Lean.
 *
 * @file
 */
import { createNativeModel } from "../../src/build/native-model.mjs";
import { finCallback, finCallbackBound, finCallbackCompilerInput, finCallbackNat } from "./fin-callback-model.mjs";

const heap = { cType: "lean_object*", box: "lean_box", unbox: "lean_unbox", heap: true };
const nat = finCallbackNat, fin = finCallbackBound;
const option = element => ({ kind: "option", element, abi: heap });
const array = element => ({ kind: "array", element, abi: heap });
const list = element => ({ kind: "list", element, abi: heap });
const text = { kind: "primitive", name: "string", lean: "String", abi: heap };
const host = type => [finCallback([nat], type), nat];

/**
 * Build the checked native model of every FinReplies export.
 *
 * @param module - Lean module path of the nominal reply types.
 */
export const finReplyCompilerModel = module => {
	const named = name => ({ name: `${module}.${name}`, lean: `${module}.${name}` });
	const field = name => ([member, type]) => ({ name: member, projection: `${module}.${name}.${member}`, type });
	const record = (name, fields) => ({ kind: "record", ...named(name), constructor: `${module}.${name}.mk`, fields: fields.map(field(name)), abi: heap });
	const label = { name: "label", constructor: `${module}.Trailing.label`, fields: [{ name: "text", type: text }] };
	const digit = { name: "digit", constructor: `${module}.Trailing.digit`, fields: [{ name: "value", type: fin("10") }] };
	const trailing = { kind: "variant", ...named("Trailing"), abi: heap, cases: [label, digit] };
	const signatures = {
		maybe: host(option(fin("5")))
		, digits: host(array(fin("3")))
		, none0: host(option(fin("0")))
		, wide: host(option(fin("184467440737095516170")))
		, failure: host({ kind: "result", arguments: [nat, fin("7")], abi: heap })
		, late: host(trailing)
		, maybeTile: host(option(record("Tile", [["digit", fin("5")], ["count", nat]])))
		, twice: host(option(fin("5")))
		, plain: [nat, nat]
		, aliased: host({ kind: "alias", ...named("MaybeDigit"), target: option(fin("5")), abi: heap })
		, empty0: host(list(fin("0")))
		, nested: host(option(array(fin("3"))))
		, product: host({ kind: "tuple", arguments: [option(fin("5")), nat], abi: heap })
		, slotted: host(record("Slot", [["digit", option(fin("5"))], ["count", nat]]))
		, success: host({ kind: "result", arguments: [array(fin("3")), nat], abi: heap })
		, listed: host(list(fin("3")))
	};
	const input = finCallbackCompilerInput(signatures);
	// twice takes a second, unchecked host callback.
	const twice = input.metadata.modules[0].declarations.find(item => item.identity === "Sample.twice");
	twice.projection.parameters.push({ name: "second", type: finCallback([nat], nat) });
	twice.parameters.push({ ...twice.parameters[0], name: "second" });
	input.component = { id: "finreplies@1.0.0", name: "finreplies", version: "1.0.0" };
	return createNativeModel(input, { refinements: true, callbackRefinements: true });
};
