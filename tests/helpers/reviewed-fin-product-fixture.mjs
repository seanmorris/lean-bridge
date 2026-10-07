/**
 * Independent reviewed API for the FinProducts Lean fixture (VO #1441).
 * Product and Except bounds sit on declarations; the DigitPair alias carries both of its
 * bounds, because an alias of a bare Fin folds into its uses.
 *
 * @file
 */
import { corpusReviewedIr } from "./type-corpus-reviewed-ir.mjs";

/** Describe checked product and Except decisions before Lean extraction. */
export const finProductReviewedIr = () => {
	// corpusReviewedIr supplies the common copied-value envelope. This placeholder
	// becomes the explicitly authored alias definition below, never a runtime record.
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
		, ["absentOnly", [{ option: nats }], "nat", [{ kind: "option", arguments: [pair(fin("0"), null)] }], null]
		, ["okOnly", [{ result: ["nat", "string"] }], "nat", [branches(fin("10"), null)], null]
		, ["errorOnly", [{ result: ["nat", "nat"] }], "nat", [branches(null, fin("5"))], null]
		, ["both", [{ result: ["nat", "nat"] }], "nat", [branches(fin("7"), fin("3"))], null]
		, ["nested", [rows], "nat", [rowBounds], null]
		, ["aliased", [digitPair], digitPair, [null], null]
		, ["produce", ["nat"], { result: ["string", "nat"] }, [null], branches(null, fin("10"))]
		, ["pairUp", ["nat"], nats, [null], pair(fin("10"), null)]];
	const ir = corpusReviewedIr({ id: "finproducts" }, signatures.map(([name, parameters, result]) => ({ name: `FinProducts.${name}`, parameters, result })));
	for(const declaration of ir.declarations)
	{
		// Keep the public argument labels shared with the ordinary-source consumers.
		declaration.parameters.forEach((parameter, position) => { parameter.name = `arg${position}`; });
		const [, , , parameters, result] = signatures.find(([name]) => declaration.id === `lean:FinProducts.${name}`);
		if(result !== null || parameters.some(value => value !== null))
			declaration.source.extensions["lean-lang.org/refinements"] = { parameters, result };
	}
	const alias = ir.types.find(type => type.id === "lean:FinProducts.DigitPair");
	alias.kind = "alias";
	alias.target = { kind: "apply", constructor: "tuple", arguments: [{ kind: "primitive", name: "nat" }, { kind: "primitive", name: "nat" }] };
	alias.source.extensions["lean-lang.org/nominal-refinements"] = { kind: "alias", target: pair(fin("10"), fin("10")) };
	return ir;
};
