/**
 * Transactional XS calls over private native copied-graph adapters.
 * Package admission and the authenticated loader remain separate.
 *
 * @file
 */
import { generateCopiedPerlGraphConversions } from "./copied-graph-conversions.mjs";

/**
 * Emit public calls against a pre-bound component lifecycle and context guard.
 * The containing translation unit supplies lpg_check_context, lpg_initialize,
 * lpg_ready and lpg_retire. None of these hooks may call arbitrary Perl code.
 *
 * @param ir - Checked copied graph contract.
 * @param moduleName - Validated public Perl namespace.
 */
export const generateCopiedPerlGraphXs = (ir, moduleName) => {
	const model = generateCopiedPerlGraphConversions(ir, moduleName);
	const nodes = new Map(model.types.map(node => [node.id, node]));
	const declarations = [`#include "${model.layout.prefix}-graph.h"`
		, model.source
		, "static void lpg_check_context(pTHX);"
		, "static uint32_t lpg_initialize(void);"
		, "static int lpg_ready(void);"
		, "static void lpg_retire(void);"
		, `static void lpg_status(pTHX_ lpg_scope *scope, uint32_t status) {
  if (!status) return;
  if (status == 4) lpg_invalid(aTHX_ scope, "carrier or result");
  const char *message = status == 1 ? "invalid argument" : status == 2 ? "conversion limit exceeded" :
    status == 3 ? "native allocation failed" : status == 5 ? "shared runtime unavailable" : "unknown status";
  croak("Lean Bridge graph call failed (status=%u): %s", (unsigned)status, message);
}`];
	const xs = [`MODULE = ${moduleName} PACKAGE = ${moduleName}`, "PROTOTYPES: DISABLE", ""];
	for(const root of model.layout.roots)
	{
		const name = model.functions.find(item => item.id === root.bindingId).publicName;
		const result = nodes.get(root.result), parameters = root.parameters.map(id => nodes.get(id));
		if(result.aggregate) declarations.push(`static void lpg_clear_${root.name}(void *value) { ${result.name}_clear(value); }`);
		xs.push(`void
${name}(...)
  PPCODE:
    if (items != ${parameters.length}) croak("${name} expects ${parameters.length} arguments");
    lpg_check_context(aTHX);
    ENTER;
    lpg_scope *scope = lpg_begin(aTHX_ lpg_retire);
    ${parameters.map((_, index) => `SV *argument${index} = lpg_pin(aTHX_ ST(${index}));`).join("\n    ")}
    ${parameters.map((node, index) => `${node.name} *input${index} = lpg_allocate(aTHX_ scope, 1, sizeof(*input${index}));
    lpg_read${node.index}(aTHX_ scope, argument${index}, input${index}, 0, 1);`).join("\n    ")}
    ${result.name} *output = lpg_allocate(aTHX_ scope, 1, sizeof(*output));
    ${result.aggregate ? `scope->output = output; scope->clear = lpg_clear_${root.name};` : ""}
    lpg_check_context(aTHX);
    lpg_status(aTHX_ scope, lpg_initialize());
    lpg_status(aTHX_ scope, ${root.name}_graph(${parameters.map((_, index) => `input${index}, `).join("")}output));
    lpg_status(aTHX_ scope, lpg_ready() ? 0 : 5);
    SV *out = lpg_write${result.index}(aTHX_ scope, output, 0, 1);
    lpg_check_context(aTHX);
    lpg_status(aTHX_ scope, lpg_ready() ? 0 : 5);
    lpg_close(scope);
    LEAVE;
    /* call_method can grow the Perl stack while converting Math::BigInt. */
    SPAGAIN; SP -= items; EXTEND(SP, 1); XPUSHs(out);
`);
	}
	return { ...model, source: declarations.join("\n"), xs: xs.join("\n") };
};
