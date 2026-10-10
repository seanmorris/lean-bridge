/**
 * Enforce every calculated owned Ruby layout at the native compilation boundary.
 *
 * @file
 */

/**
 * Reject any compiler layout that differs from Fiddle's generated pointer codec.
 *
 * @param model - Calculated public C layouts and callback descriptors.
 */
export const ownedRubyAbiHeader = model => {
	const checks = [], equal = (expression, expected) => checks.push(`_Static_assert(${expression} == ${expected}, ${JSON.stringify(expression)});`);
	equal("sizeof(void *)", 8); equal("sizeof(size_t)", 8); equal("sizeof(bool)", 1);
	for(const node of model.types)
	{
		equal(`sizeof(${node.cName})`, node.size); equal(`_Alignof(${node.cName})`, node.alignment);
		if(!node.aggregate) continue;
		if(node.element || node.kind === "primitive")
		{ equal(`offsetof(${node.cName}, data)`, node.dataOffset); equal(`offsetof(${node.cName}, length)`, node.lengthOffset); }
		if(node.kind === "variant")
		{ equal(`offsetof(${node.cName}, kind)`, node.kindOffset); equal(`offsetof(${node.cName}, cases)`, node.payloadOffset); }
		if(node.kind === "option") equal(`offsetof(${node.cName}, has_value)`, node.flagOffset);
		if(node.kind === "result") equal(`offsetof(${node.cName}, is_ok)`, node.flagOffset);
		for(const field of node.fields) equal(`offsetof(${node.cName}, ${field.name})`, field.offset);
		for(const branch of node.cases) for(const field of branch.fields)
			equal(`offsetof(${node.cName}, cases.${branch.name}.${field.name})`, node.payloadOffset + field.offset);
	}
	for(const node of model.callbackLayouts)
	{
		equal(`sizeof(${node.name})`, node.size); equal(`_Alignof(${node.name})`, node.alignment);
		for(const field of node.fields) equal(`offsetof(${node.name}, ${field.name})`, field.offset);
	}
	for(const [name, offset] of [["_mp_alloc", model.mpz.allocated], ["_mp_size", model.mpz.length], ["_mp_d", model.mpz.data]])
		equal(`offsetof(__mpz_struct, ${name})`, offset);
	equal("sizeof(__mpz_struct)", model.mpz.size); equal("_Alignof(__mpz_struct)", model.mpz.alignment);
	equal("GMP_NAIL_BITS", 0); equal("sizeof(mp_limb_t)", 8);
	equal(`sizeof(${model.c.prefix}_status)`, 4);
	return `#pragma once\n#include "${model.c.prefix}.h"\n#include <stddef.h>\n${checks.join("\n")}\n`;
};
