/**
 * Independent reviewed API choosing every finite specialization of the native-specializations
 * fixture (VO #1220, design B). Applications record what the reviewer expects fresh Lean to print;
 * they never reach the compiler, which must print exactly these to reconcile.
 *
 * @file
 */
import { corpusReviewedIr } from "./type-corpus-reviewed-ir.mjs";

const key = "lean-lang.org/specialization";
// Placeholder records become the explicitly authored Word and Words aliases below.
const word = { record: "Specialized.Word", fields: {} }, words = { record: "Specialized.Words", fields: {} };
const at = (generic, universes, ...args) => `(@_root_.Specialized.${generic}.{${universes}} ${args.join(" ")})`;
/** Public name, generic declaration, closed type names, expected application, parameters and result. */
export const reviewedNativeSpecializations = Object.freeze([
	["echoWord", "echo", ["Specialized.Word"], at("echo", "0", "(@_root_.Specialized.Word)"), [word], word]
	, ["echoText", "echo", ["String"], at("echo", "0", "(@_root_.String)"), ["string"], "string"]
	, ["echoNat", "echo", ["Nat"], at("echo", "0", "(@_root_.Nat)"), ["nat"], "nat"]
	, ["echoWords", "echo", ["Specialized.Words"], at("echo", "0", "(@_root_.Specialized.Words)"), [words], words]
	, ["chooseWord", "choose", ["UInt32"], at("choose", "0", "(@_root_.UInt32)", "(@_root_.Specialized.instInhabitedUInt32_specialized)"), ["bool", "uint32"], "uint32"]
	, ["chooseText", "choose", ["String"], at("choose", "0", "(@_root_.String)", "(@_root_.String.instInhabited)"), ["bool", "string"], "string"]
	, ["chooseWords", "choose", ["Specialized.Words"], at("choose", "0", "(@_root_.Specialized.Words)", "((@_root_.Array.instInhabited.{0} (@_root_.Specialized.Word)))"), ["bool", words], words]
	, ["firstTextWord", "first", ["String", "UInt32"], at("first", "0, 0", "(@_root_.String)", "(@_root_.UInt32)"), ["string", "uint32"], "string"]
	, ["doubleWord", "duplicate", ["UInt32"], at("duplicate", "0", "(@_root_.UInt32)", "(@_root_.instAddUInt32)"), ["uint32"], "uint32"]
	, ["doubleNat", "duplicate", ["Nat"], at("duplicate", "0", "(@_root_.Nat)", "(@_root_.instAddNat)"), ["nat"], "nat"]]
	.map(([name, generic, types, application, parameters, result]) => [`Specialized.${name}`, `Specialized.${generic}`, types, application, parameters, result]));

/** Describe ten specializations of four generics beside one ordinary export, before Lean runs. */
export const reviewedNativeSpecializationIr = () => {
	const signatures = [...reviewedNativeSpecializations.map(([name, , , , parameters, result]) => ({ name, parameters, result }))
		, { name: "Specialized.plain", parameters: [word], result: word }];
	const ir = corpusReviewedIr({ id: "specialized" }, signatures);
	for(const declaration of ir.declarations)
	{
		declaration.parameters.forEach((parameter, position) => { parameter.name = `arg${position}`; });
		const decision = reviewedNativeSpecializations.find(([name]) => declaration.id === `lean:${name}`);
		if(!decision) continue;
		const [name, generic, types, application] = decision;
		declaration.source.declaration = generic;
		declaration.source.extensions[key] = { name, declaration: generic, types, application };
	}
	const targets = [["lean:Specialized.Word", { kind: "primitive", name: "uint32" }]
		, ["lean:Specialized.Words", { kind: "apply", constructor: "array", arguments: [{ kind: "named", id: "lean:Specialized.Word" }] }]];
	for(const [id, target] of targets)
	{
		const alias = ir.types.find(type => type.id === id);
		Object.assign(alias, { kind: "alias", target });
	}
	return ir;
};
