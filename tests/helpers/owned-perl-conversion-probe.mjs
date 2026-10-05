/**
 * Private real-C entrypoints for exercising owned Perl value conversions.
 *
 * @file
 */
/**
 * Render private calls without admitting installed CPAN packages or callbacks.
 *
 * @param model - Generated Perl converters and authenticated C declarations.
 */
export const ownedPerlConversionProbe = model => {
	const nodes = new Map(model.types.map(node => [node.id, node]));
	const render = (name, fn) => {
		const inputs = fn.parameters.map(id => nodes.get(id)), result = nodes.get(fn.result);
		return `void
${name}(...)
  PPCODE:
    if (items != ${inputs.length}) croak("wrong probe arity");
    ENTER;
    lpo_enter_call(aTHX);
    lpg_scope *scope = lpg_begin(aTHX_ NULL);
    lpo_owner *owner = lpo_begin_owner(aTHX_ 0);
    ${inputs.map((_, index) => `SV *arg${index} = lpg_pin(aTHX_ ST(${index}));`).join("\n    ")}
    ${inputs.map((node, index) => `${node.cName} input${index} = {0}; lpo_read${node.index}(aTHX_ scope, arg${index}, &input${index}, 0, 1);`).join("\n    ")}
    if (lpo_state.closed) croak("Lean ownership session is closed");
    ${result.cName} returned = {0};
    lpo_status(aTHX_ ${fn.cName}(lpo_state.session, ${inputs.map((node, index) => `${node.leaf ? "" : "&"}input${index}`).join(", ")}, &returned, &owner->result));
    SV *out = lpo_write${result.index}(aTHX_ scope, owner, &returned, 0, 1);
    lpo_publish(aTHX_ owner);
    LEAVE;
    SPAGAIN; SP = PL_stack_base + ax - 1; EXTEND(SP, 1); XPUSHs(out);
`;
	};
	const functions = model.functions.filter(fn => fn.parameters.every((_, index) => !model.c.hostArgument(fn, index)));
	const copies = model.c.copies.filter(fn => nodes.get(fn.result).name);
	return `
MODULE = ${model.moduleName} PACKAGE = ${model.moduleName}
PROTOTYPES: DISABLE

${functions.map(fn => render("converted_" + fn.publicName, fn)).join("\n")}
${copies.map(fn => render("copy_" + nodes.get(fn.result).name, fn)).join("\n")}
`;
};
