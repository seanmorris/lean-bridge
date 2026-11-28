/** @file Call-scoped Perl record inputs use the alternate C layout, never the leased output layout. */

/**
 * Convert one export argument inside its own call frame.
 *
 * @param model - Checked Perl binding model.
 * @param fn - Export or private helper.
 * @param node - Value node at the parameter site.
 * @param index - Parameter index.
 */
export const perlInputArgument = (model, fn, node, index) => {
	const slot = fn.hostRecordSlots?.find(s => s.index === index);
	if(slot) return `${slot.inputType} input${index} = lpo_record${node.index}(aTHX_ frame, argument${index});`;
	if(model.c.hostArgument?.(fn, index)) return `${node.cName}_host input${index} = lpo_host${node.index}(aTHX_ frame, argument${index});`;
	return `${node.cName} input${index} = {0}; lpo_read${node.index}(aTHX_ scope, argument${index}, &input${index}, 0, 1);`;
};

/**
 * Pin all fields before creating any callable descriptors. Borrowed code and
 * recovery storage belong to the enclosing call; genuine leases are not wrapped.
 *
 * @param node - Nominal record with a selected input view.
 * @param nodes - Native types and ordinary converters.
 */
export const perlInputRecord = (node, nodes) => {
	const view=node.hostInput;
	const writes=node.fields.map((f,i) => {
		const child=nodes.get(f.type), target="out."+f.name;
		if(view.fields.includes(f.name)) return `if (input) ${target} = lpo_host${child.index}(aTHX_ frame, slots[${i}]);
  else lpo_read${child.index}(aTHX_ scope, slots[${i}], &${target}.closure, 1, 0);`;
		if(f.pointer) return `{ ${child.cName} *field = lpg_allocate(aTHX_ scope, 1, sizeof(*field)); ${target} = field; lpo_read${child.index}(aTHX_ scope, slots[${i}], field, 1, 1); }`;
		return `lpo_read${child.index}(aTHX_ scope, slots[${i}], &${target}, 1, 0);`;
	});
	return `static ${view.inputType} lpo_record${node.index}(pTHX_ lpo_frame *frame, SV *value) {
  SvGETMAGIC(value);
  lpg_scope *scope = frame->scope;
  ${view.inputType} out = {0};
  lpg_enter(aTHX_ scope, SvROK(value) ? SvRV(value) : NULL, ${node.index}, 0, sizeof(out), 0);
  int input = lpg_branch(value, "${view.publicType}");
  static const char *const fields[] = {${node.fields.map(f => JSON.stringify(f.publicName)).join(", ")}};
  SV **slots = lpg_fields(aTHX_ scope, value, input ? "${view.publicType}" : "${node.publicType}", fields, ${node.fields.length});
  ${writes.join("\n  ")}
  return out;
}
`;
};
