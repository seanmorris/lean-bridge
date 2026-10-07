/**
 * Independent reviewed API for the existing FinContainers Lean fixture.
 * Alias constraints remain on the alias; declarations constrain structural sites.
 *
 * @file
 */
import { corpusReviewedIr } from "./type-corpus-reviewed-ir.mjs";

/** Describe checked container and alias decisions before Lean extraction. */
export const finContainerReviewedIr = () => {
	// corpusReviewedIr supplies the common copied-value envelope. This placeholder
	// becomes the explicitly authored alias definition below, never a runtime record.
	const digits = { record: "FinContainers.Digits", fields: {} };
	const fin = bound => ({ kind: "fin", bound });
	const inside = (kind, child) => ({ kind, arguments: [child] });
	const signatures = [
		["mirrorAll", [digits], digits, [null], null]
		, ["countNone", [{ array: "nat" }], "nat", [inside("array", fin("0"))], null]
		, ["sumHuge", [{ list: "nat" }], "nat", [inside("list", fin("1180591620717411303424"))], null]
		, ["orDefault", [{ option: "nat" }], "nat", [inside("option", fin("1"))], null]
		, ["present", [{ array: { option: "nat" } }], digits, [inside("array", inside("option", fin("10")))], null]
		, ["flatten", [{ list: digits }], { option: { list: "nat" } }, [null], inside("option", inside("list", fin("10")))]
		, ["label", [{ array: "string" }, { array: "nat" }], "string", [null, inside("array", fin("4"))], null]
		, ["wrapAll", [{ array: "nat" }], { array: "nat" }, [null], inside("array", fin("7"))]];
	const ir = corpusReviewedIr({ id: "fincontainers" }, signatures.map(([name, parameters, result]) => ({ name: `FinContainers.${name}`, parameters, result })));
	for(const [index, declaration] of ir.declarations.entries())
	{
		// Keep the public argument labels shared with the ordinary-source consumers.
		// A review can rename parameters, and those names appear in host diagnostics.
		declaration.parameters.forEach((parameter, position) => { parameter.name = `arg${position}`; });
		const [, , , parameters, result] = signatures[index];
		if(result !== null || parameters.some(value => value !== null))
			declaration.source.extensions["lean-lang.org/refinements"] = { parameters, result };
	}
	const alias = ir.types[0];
	alias.kind = "alias";
	alias.target = { kind: "apply", constructor: "array", arguments: [{ kind: "primitive", name: "nat" }] };
	alias.source.extensions["lean-lang.org/nominal-refinements"] = { kind: "alias", target: inside("array", fin("10")) };
	return ir;
};
