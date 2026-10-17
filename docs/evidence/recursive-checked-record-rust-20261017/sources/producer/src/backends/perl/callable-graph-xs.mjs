/**
 * Generate synchronous Perl callback trampolines and scoped native invocation.
 *
 * @file
 */
import { compileCallablePerlGraphPackageModel } from "./callable-graph-model.mjs";
import { perlCallableGraphRuntime } from "./callable-graph-runtime.mjs";

/**
 * Emit Perl converters that preserve replies until native copying completes.
 *
 * @param ir - Compiler-checked copied and synchronous callable contract.
 * @param moduleName - Selected CPAN module namespace.
 */
export const generateCallablePerlGraphXs = (ir, moduleName) => {
	const model = compileCallablePerlGraphPackageModel(ir, moduleName);
	const callbacks = [...model.callbacks.values()];
	const declarations = [`#include "${model.layout.prefix}-graph.h"`, model.source
		, "static void lpg_retire(void);", "static int lpg_ready(void);"
		, perlCallableGraphRuntime];
	const xs = [`MODULE = ${moduleName} PACKAGE = ${moduleName}`, "PROTOTYPES: DISABLE", ""];
	for(const callback of callbacks)
	{
		declarations.push(`static uint32_t lpc_callback_${callback.index}(void *context, ${callback.parameters.map((node, index) => `const ${node.name} *a${index}`).join(", ")}, ${callback.result.name} *out) {
  lpc_callback *callback = context;
  if (callback->frame->error) return 6;
  if (callback->lease) return ${callback.call}(callback->lease->token, ${callback.parameters.map((_, index) => `a${index}`).join(", ")}, out);
  const void *arguments[] = { ${callback.parameters.map((_, index) => `a${index}`).join(", ")} };
  return lpc_invoke(context, arguments, out);
}`);
		xs.push(`void
_callback_${callback.key}(...)
  PPCODE:
    lbp_check_interpreter(aTHX);
    if (!lpc_active || lpc_active->callback->invoker != cv) croak("Callback converter requires its active native invocation");
    lpc_invocation *invocation = lpc_active;
    lpg_scope *scope = invocation->callback->frame->scope;
    ENTER; SAVETMPS;
    if (!lpg_ready()) croak("Shared Lean runtime is unavailable");
    ${callback.parameters.map((node, index) => `SV *argument${index} = lpg_write${node.index}(aTHX_ scope, invocation->arguments[${index}], 0, 1);`).join("\n    ")}
    SPAGAIN; PUSHMARK(SP); EXTEND(SP, ${callback.parameters.length});
    ${callback.parameters.map((_, index) => `PUSHs(argument${index});`).join(" ")} PUTBACK;
    int count = call_sv(invocation->callback->code, G_SCALAR);
    SPAGAIN;
    if (count != 1) { SP -= count; PUTBACK; croak("Host callback must return one value"); }
    SV *returned = POPs; PUTBACK; lpg_pin(aTHX_ returned);
    lbp_check_interpreter(aTHX);
    if (!lpg_ready()) croak("Shared Lean runtime is unavailable");
    /* Allocate replies in the initiating scope. The native caller copies them
       only after this converter and its eval have returned. */
    lpg_read${callback.result.index}(aTHX_ scope, returned, invocation->output, 0, 1);
    FREETMPS; LEAVE;
    invocation->returned = 1;
    XSRETURN_EMPTY;
`);
	}
	for(const node of model.types.filter(node => node.aggregate)) declarations.push(`static void lpc_clear${node.index}(void *value) { ${node.name}_clear(value); }`);
	const render = (name, parameters, result, native, lease = null) => {
		const offset = lease ? 1 : 0, count = parameters.length + offset;
		const callback = result.callback, node = result.node;
		return `void
${name}(...)
  PPCODE:
    if (items != ${count}) croak("${name} expects ${count} arguments");
    lbp_check_interpreter(aTHX);
    ENTER;
    lpg_scope *scope = lpg_begin(aTHX_ lpg_retire);
    lpc_frame *frame = lpc_begin(aTHX_ scope);
    ${Array.from({ length: count }, (_, index) => `SV *argument${index} = lpg_pin(aTHX_ ST(${index}));`).join("\n    ")}
    ${lease ? `lpc_lease *self = lpc_lease_enter(aTHX_ scope, argument0, ${lease.index});` : ""}
    ${parameters.map((parameter, index) => parameter.callback
		? `${model.layout.prefix}_callback_${parameter.callback.key} input${index} = {lpc_callback_${parameter.callback.index}, lpc_callback_new(aTHX_ frame, argument${index + offset}, ${parameter.callback.index}, "${moduleName}::_callback_${parameter.callback.key}")};`
		: `${parameter.node.name} *input${index} = lpg_allocate(aTHX_ scope, 1, sizeof(*input${index}));
    lpg_read${parameter.node.index}(aTHX_ scope, argument${index + offset}, input${index}, 0, 1);`).join("\n    ")}
    ${callback ? `lpc_lease *created;
    SV *out = lpc_lease_new(aTHX_ scope, ${callback.index}, ${callback.dispose}, "${callback.publicType}", &created);` : `${node.name} *output = lpg_allocate(aTHX_ scope, 1, sizeof(*output));
    ${node.aggregate ? `scope->output = output; scope->clear = lpc_clear${node.index};` : ""}`}
    lbp_check_interpreter(aTHX);
    uint32_t status = ${native}(${[...lease ? ["self->token"] : [], ...parameters.map((parameter, index) => `${parameter.callback ? "&" : ""}input${index}`), callback ? "&created->token" : "output"].join(", ")});
    lpc_finish(aTHX_ frame, status);
    if (!lpg_ready()) croak("Shared Lean runtime is unavailable");
    ${callback ? "" : `SV *out = lpg_write${node.index}(aTHX_ scope, output, 0, 1);`}
    lbp_check_interpreter(aTHX);
    if (!lpg_ready()) croak("Shared Lean runtime is unavailable");
    /* Guards and errors refer to scope storage, so LEAVE must run them before
       lpg_end frees that storage. */
    LEAVE;
    SPAGAIN; SP -= items; EXTEND(SP, 1); XPUSHs(out);
`;
	};
	for(const fn of model.functions) xs.push(render(fn.publicName, fn.parameters, fn.result, fn.native));
	for(const callback of callbacks) xs.push(`MODULE = ${moduleName} PACKAGE = ${callback.publicType}`
		, render("call", callback.parameters.map(node => ({ node })), { node: callback.result }, callback.call, callback));
	xs.push(`MODULE = ${moduleName} PACKAGE = ${moduleName}::LeanClosure

void
close(value)
    SV *value
  PPCODE:
    lpc_lease *lease = lpc_get_lease(aTHX_ value);
    lease->closed = 1; lpc_lease_drop(lease);
    XSRETURN_EMPTY;

void
closed(value)
    SV *value
  PPCODE:
    XPUSHs(boolSV(lpc_get_lease(aTHX_ value)->closed));
`);
	const valuesSource = `${model.valuesSource}
package ${moduleName}::LeanClosure;
sub new { CORE::die "Use a generated Lean closure factory\\n" }
sub CLONE_SKIP { 1 }
sub STORABLE_freeze { CORE::die "Lean closures cannot be serialized\\n" }
sub STORABLE_thaw { CORE::die "Lean closures cannot be deserialized\\n" }
${callbacks.map(callback => `package ${callback.publicType};
our @ISA = ('${moduleName}::LeanClosure');
sub CLONE_SKIP { 1 }
`).join("\n")}
1;
`;
	return { ...model, source: declarations.join("\n"), xs: xs.join("\n"), valuesSource };
};
