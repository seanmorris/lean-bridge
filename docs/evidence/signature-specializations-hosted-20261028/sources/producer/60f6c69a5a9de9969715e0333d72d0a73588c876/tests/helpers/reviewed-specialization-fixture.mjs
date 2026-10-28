/**
 * Independent reviewed API choosing finite specializations of the Shop fixture (VO #1220, design B).
 * The application text records what the reviewer expects fresh Lean to print; the compiler
 * never receives it, and reconciliation fails if Lean prints anything else.
 *
 * @file
 */
import { corpusReviewedIr } from "./type-corpus-reviewed-ir.mjs";

const key = "lean-lang.org/specialization";
// The placeholder record becomes the explicitly authored Word alias below.
const word = { record: "Shop.Word", fields: {} };
/** Public name, generic declaration, closed type names, expected application, parameters and result. */
export const shopSpecializations = Object.freeze([
	["Shop.keepWord", "Shop.keep", ["Shop.Word"], "(@_root_.Shop.keep.{0} (@_root_.Shop.Word))", [word], word]
	, ["Shop.keepText", "Shop.keep", ["String"], "(@_root_.Shop.keep.{0} (@_root_.String))", ["string"], "string"]
	, ["Shop.pickWord", "Shop.pick", ["UInt32"], "(@_root_.Shop.pick.{0} (@_root_.UInt32) (@_root_.Shop.instInhabitedUInt32_shop))", ["bool", "uint32"], "uint32"]
	, ["Shop.firstTextWord", "Shop.first", ["String", "UInt32"], "(@_root_.Shop.first.{0, 0} (@_root_.String) (@_root_.UInt32))", ["string", "uint32"], "string"]]);

/** Describe four specializations of three generics beside one ordinary export, before Lean runs. */
export const shopSpecializationReview = () => {
	const signatures = [...shopSpecializations.map(([name, , , , parameters, result]) => ({ name, parameters, result }))
		, { name: "Shop.plain", parameters: [word], result: word }];
	const ir = corpusReviewedIr({ id: "shop" }, signatures);
	for(const declaration of ir.declarations)
	{
		declaration.parameters.forEach((parameter, position) => { parameter.name = `arg${position}`; });
		const decision = shopSpecializations.find(([name]) => declaration.id === `lean:${name}`);
		if(!decision) continue;
		const [name, generic, types, application] = decision;
		declaration.source.declaration = generic;
		declaration.source.extensions[key] = { name, declaration: generic, types, application };
	}
	const alias = ir.types.find(type => type.id === "lean:Shop.Word");
	alias.kind = "alias";
	alias.target = { kind: "primitive", name: "uint32" };
	return ir;
};
