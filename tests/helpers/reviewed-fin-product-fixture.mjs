/**
 * Independent reviewed API for the FinProducts Lean fixture (VO #1441).
 * Product and Except bounds sit on declarations; the Digit alias carries its own bound.
 *
 * @file
 */
import { corpusReviewedIr } from "./type-corpus-reviewed-ir.mjs";

/** Describe checked product and Except decisions before Lean extraction. */
export const finProductReviewedIr = () => {
	// corpusReviewedIr supplies the common copied-value envelope. These placeholders
	// become the explicitly authored alias definitions below, never runtime records.
	const digit = { record: "FinProducts.Digit", fields: {} };
	const digitPair = { record: "FinProducts.DigitPair", fields: {} };
	const fin = bound => ({ kind: "fin", bound });
	const pair = (first, second) => ({ kind: "tuple", arguments: [first, second] });
	// Except trees keep the IR order: [ok, error].
	const branches = (ok, error) => ({ kind: "result", arguments: [ok, error] });
	const nats = { tuple: ["nat", "nat"] };
	const rows = { list: { option: { tuple: ["nat", { result: ["nat", "nat"] }] } } };
	const rowBounds = { kind: "list", arguments: [{ kind: "option", arguments: [pair(fin("3"), branches(null, fin("2")))] }] };
	const signatures = [
		["first", [nats], nats, [pair(fin("10"), null)], pair(fin("10"), null)]
		, ["second", [nats], "nat", [pair(null, fin("1"))], null]
		, ["wide", [nats], "nat", [pair(fin("184467440737095516170"), fin("10"))], null]
		, ["never", [{ option: nats }], "nat", [{ kind: "option", arguments: [pair(fin("0"), null)] }], null]
		, ["okOnly", [{ result: ["nat", "string"] }], "nat", [branches(fin("10"), null)], null]
		, ["errorOnly", [{ result: ["nat", "nat"] }], "nat", [branches(null, fin("5"))], null]
		, ["both", [{ result: ["nat", "nat"] }], "nat", [branches(fin("7"), fin("3"))], null]
		, ["nested", [rows], "nat", [rowBounds], null]
		, ["aliased", [digitPair], digitPair, [null], null]
		, ["produce", ["nat"], { result: ["string", "nat"] }, [null], branches(null, fin("10"))]
		, ["pairUp", ["nat"], nats, [null], pair(fin("10"), null)]];
	const ir = corpusReviewedIr({ id: "finproducts" }, [...signatures.map(([name, parameters, result]) => ({ name: `FinProducts.${name}`, parameters, result }))
		, { name: "FinProducts.digitWitness", parameters: [digit], result: "nat" }]);
	// The witness only makes corpusReviewedIr emit the Digit placeholder; it is not exported.
	ir.declarations = ir.declarations.filter(declaration => declaration.id !== "lean:FinProducts.digitWitness");
	for(const declaration of ir.declarations)
	{
		// Keep the public argument labels shared with the ordinary-source consumers.
		declaration.parameters.forEach((parameter, position) => { parameter.name = `arg${position}`; });
		const [, , , parameters, result] = signatures.find(([name]) => declaration.id === `lean:FinProducts.${name}`);
		if(result !== null || parameters.some(value => value !== null))
			declaration.source.extensions["lean-lang.org/refinements"] = { parameters, result };
	}
	const definition = id => ir.types.find(type => type.id === id);
	const named = id => ({ kind: "named", id });
	const pairAlias = definition("lean:FinProducts.DigitPair"), digitAlias = definition("lean:FinProducts.Digit");
	digitAlias.kind = "alias";
	digitAlias.target = { kind: "primitive", name: "nat" };
	digitAlias.source.extensions["lean-lang.org/nominal-refinements"] = { kind: "alias", target: fin("10") };
	pairAlias.kind = "alias";
	pairAlias.target = { kind: "apply", constructor: "tuple", arguments: [named(digitAlias.id), named(digitAlias.id)] };
	return ir;
};
