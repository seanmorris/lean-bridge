/**
 * Typed C adapters for the scalar ABI; allocation helpers live in the shared runtime.
 *
 * @file
 */
import { assertComponentSignature, componentScalarTypes } from "../abi/component-scalars.mjs";

const objectType = type => new Set(["unit", "nat", "int", "string", "bytes"]).has(type);
const cType = type => objectType(type) ? "lean_object *"
	: type === "char" ? "uint32_t"
		: type === "bool" ? "uint8_t"
			: type === "float32" ? "float"
				: type === "float64" ? "double"
					: `${type.replace(/^int/, "uint")}_t`;

/**
 * Generates direct typed calls to Lean's exported, owned-argument wrappers.
 *
 * @param abi - Validated private scalar ABI containing one typed export per declaration.
 */
export const generateComponentScalarAdapters = abi => {
	const lines = ['#include "component_scalar.h"', "#include <string.h>", ""];
	for(const item of abi.exports)
	{
		assertComponentSignature(item);
		const types = item.parameters.map(type => type.name);
		const result = item.result.name;
		const arguments_ = types.map((type, index) => `a${index}`);
		lines.push(`extern ${cType(result)} ${item.symbol}_lean(${types.length ? types.map(cType).join(", ") : "lean_object *"});`);
		lines.push(`LEAN_EXPORT uint32_t ${item.symbol}(bridge_scalar_frame *frame) {`);
		lines.push(`  uint32_t status = bridge_scalar_frame_validate(frame, ${types.length});`, "  if (status) return status;");
		for(const [index, type] of types.entries()) lines.push(`  if ((status = bridge_scalar_slot_validate(&frame->args[${index}], ${componentScalarTypes.indexOf(type)}))) return status;`);
		for(const [index, type] of types.entries())
		{
			const source = `frame->args[${index}]`;
			if(objectType(type)) lines.push(`  ${cType(type)} a${index} = bridge_scalar_decode_object(&${source});`);
			else if(type.startsWith("float")) lines.push(`  ${cType(type)} a${index}; memcpy(&a${index}, &${source}.bits, sizeof(a${index}));`);
			else lines.push(`  ${cType(type)} a${index} = (${cType(type)})${source}.bits;`);
		}
		lines.push(`  ${cType(result)} result = ${item.symbol}_lean(${types.length ? arguments_.join(", ") : "lean_box(0)"});`);
		if(objectType(result)) lines.push(`  return bridge_scalar_encode_object(&frame->result, ${componentScalarTypes.indexOf(result)}, result);`);
		else
		{
			lines.push(`  frame->result.kind = ${componentScalarTypes.indexOf(result)};`);
			if(result.startsWith("float")) lines.push("  memcpy(&frame->result.bits, &result, sizeof(result));");
			else lines.push(`  frame->result.bits = ${result.startsWith("int") ? `(uint64_t)(int64_t)(${result}_t)` : "(uint64_t)"}result;`);
			if(result === "char") lines.push("  if (result > 0x10ffff || (result >= 0xd800 && result <= 0xdfff)) return 6;");
			lines.push("  return 0;");
		}
		lines.push("}", "");
	}
	return `${lines.join("\n")}\n`;
};
