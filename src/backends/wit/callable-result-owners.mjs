/**
 * Share a converted callback arena among the owned buffers of inline C values.
 *
 * @file
 */

/**
 * Whether a copied value owns storage through its fields rather than itself.
 *
 * @param copy - Resolved C value layout.
 */
export const inlineCallableResult = copy => copy.aggregate && !copy.element && !["string", "bytes", "nat", "int"].includes(copy.scalarName);

/**
 * Attach one reference to each outermost owned buffer of a validated result.
 * Arrays retain the whole arena; their nested views stay borrowed. Records,
 * tuples and active branches distribute references among their inline fields.
 * A scalar-only result takes no reference and releases its arena immediately.
 * These temporary native results remain on the session's creating thread.
 *
 * @param surface - Checked acyclic C surface, in dependency order.
 */
export const renderCallableResultOwners = surface => {
	const lines = [`typedef struct { lb_result result; size_t references; } lb_shared_result;
static inline void lb_shared_result_release(void *data) {
  lb_shared_result *owner = data;
  if (--owner->references == 0) lb_result_release(&owner->result);
}`];
	for(const copy of surface.copies.filter(copy => copy.aggregate))
	{
		const body = ["  (void)value; (void)owner;"], attach = (child, expression) => {
			if(child.aggregate) body.push(`  lb_result_attach_${child.index}(${expression}, owner);`);
		};
		if(!inlineCallableResult(copy))
			body.push("  ++owner->references; value->owner = owner; value->release = lb_shared_result_release;");
		else if(copy.variant)
		{
			body.push("  switch (value->kind) {");
			copy.cases.forEach((branch, index) => {
				body.push(`  case ${index}:`);
				for(const field of branch.fields) attach(field.type, `&value->cases.${branch.name}.${field.name}`);
				body.push("    break;");
			});
			body.push("  default: break;", "  }");
		} else for(const field of copy.fields)
		{
			const flag = { option: "has_value", result: "is_ok" }[copy.compound];
			if(flag) body.push(`  if (${field.name === "error" ? "!" : ""}value->${flag}) {`);
			attach(field.type, `&value->${field.name}`);
			if(flag) body.push("  }");
		}
		lines.push(`static inline void lb_result_attach_${copy.index}(${copy.name} *value, lb_shared_result *owner) {`, ...body, "}");
	}
	return lines.join("\n");
};
