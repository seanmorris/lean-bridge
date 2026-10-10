/**
 * Typed calls for synchronous copied arrays, with shared bounded conversion.
 *
 * @file
 */
import { assertComponentCopiedAbi, componentArrayShape } from "../abi/component-copied.mjs";

const object = type => type.kind === "apply" || ["unit", "nat", "int", "string", "bytes"].includes(type.name);
const cType = type => object(type) ? "lean_object *" : ["usize", "isize"].includes(type.name) ? "size_t"
	: type.name === "bool" ? "uint8_t" : type.name === "char" ? "uint32_t"
		: type.name === "float32" ? "float" : type.name === "float64" ? "double" : `${type.name.replace(/^int/, "uint")}_t`;
const suffix = type => ["uint32", "int32", "char"].includes(type.name) ? "_uint32"
	: ["uint64", "int64"].includes(type.name) ? "_uint64" : ["usize", "isize"].includes(type.name) ? "_usize"
		: type.name === "float32" ? "_float32" : type.name === "float64" ? "_float" : "";
const shape = type => { const { kind, depth } = componentArrayShape(type); return `${kind}, ${depth}`; };

/**
 * Generate typed C entry points. Every input validates before Lean allocation.
 *
 * @param abi - Closed copied-array private descriptor.
 * @param exports - Compiler-owned source exports carrying checked refinement metadata.
 */
export const generateComponentCopiedAdapters = (abi, exports = []) => {
	assertComponentCopiedAbi(abi);
	const lines = ['#include "component_scalar.h"', '_Static_assert(sizeof(size_t) == 4, "copied arrays require wasm32 Lean");', ""];
	for(const item of abi.exports)
	{
		const source = exports.find(value => value.bindingId === item.bindingId);
		const refinements = source?.refinements?.parameters ?? item.parameters.map(() => null);
		const rejectionCleanup = item.parameters.flatMap((type, index) => object(type) ? [`lean_dec(a${index});`] : []).join(" ");
		lines.push(`extern ${cType(item.result)} ${item.symbol}_lean(${item.parameters.length ? item.parameters.map(cType).join(", ") : "lean_object *"});`
			, ...refinements.flatMap((refinement, index) => refinement
				? [`extern uint8_t ${item.symbol}_refinement_${index}(${cType(item.parameters[index])});`] : [])
			, `LEAN_EXPORT uint32_t ${item.symbol}(bridge_scalar_frame *frame) {`
			, `  uint32_t status = bridge_copied_frame_validate(frame, ${item.parameters.length});`
			, "  if (status) return status;", "  if (bridge_copied_abi() != 1) return 6;"
			, "  uint32_t budget = 16u * 1024u * 1024u;");
		for(const [index, type] of item.parameters.entries())
			lines.push(`  if ((status = bridge_copied_validate(&frame->args[${index}], ${shape(type)}, &budget))) return status;`);
		for(const [index, type] of item.parameters.entries())
		{
			lines.push(`  lean_object *boxed${index} = bridge_copied_decode(&frame->args[${index}], ${shape(type)});`);
			lines.push(`  ${cType(type)} a${index} = ${object(type) ? `boxed${index}` : `(${cType(type)})lean_unbox${suffix(type)}(boxed${index})`};`);
			if(!object(type)) lines.push(`  lean_dec(boxed${index});`);
		}
		for(const [index, refinement] of refinements.entries()) if(refinement)
		{
			if(object(item.parameters[index])) lines.push(`  lean_inc(a${index});`);
			lines.push(`  if (!${item.symbol}_refinement_${index}(a${index})) { ${rejectionCleanup} return 5; }`);
		}
		lines.push(`  ${cType(item.result)} result = ${item.symbol}_lean(${item.parameters.length ? item.parameters.map((_, index) => `a${index}`).join(", ") : "lean_box(0)"});`
			, `  return bridge_copied_encode(&frame->result, ${shape(item.result)}, ${object(item.result) ? "result" : `lean_box${suffix(item.result)}(result)`}, &budget);`
			, "}", "");
	}
	return lines.join("\n");
};
