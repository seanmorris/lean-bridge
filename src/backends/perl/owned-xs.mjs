/**
 * Public Perl calls, scoped host callbacks and independent owned identities.
 *
 * @file
 */
import { generateOwnedPerlConversions } from "./owned-conversions.mjs";

const callbackRuntime = prefix => `
typedef struct {
  lpg_scope *scope;
  SV *error, *replacement;
} lpo_frame;
typedef struct {
  lpo_frame *frame;
  SV *code;
  CV *invoker;
} lpo_callback;
typedef struct {
  lpo_callback *callback;
  const void **arguments;
  void *output;
  ${prefix}_result **owner;
  int returned;
} lpo_invocation;
static lpo_invocation *lpo_active;
static void lpo_frame_end(pTHX_ void *value) {
  lpo_frame *frame = value;
  SvREFCNT_dec(frame->error); SvREFCNT_dec(frame->replacement);
}
static lpo_frame *lpo_begin_frame(pTHX_ lpg_scope *scope) {
  lpo_frame *frame = lpg_allocate(aTHX_ scope, 1, sizeof(*frame));
  SSGROW(4); SAVEDESTRUCTOR_X(lpo_frame_end, frame);
  frame->scope = scope;
  save_scalar(PL_errgv);
  LB_PERL_GRAPH_CHECKPOINT(); frame->replacement = newSVpvs("");
  return frame;
}
static lpo_callback *lpo_new_callback(pTHX_ lpo_frame *frame, SV *code, const char *name) {
  SvGETMAGIC(code);
  if (!SvROK(code) || SvTYPE(SvRV(code)) != SVt_PVCV || SvOBJECT(SvRV(code)))
    croak("Expected an unblessed Perl code reference");
  CV *invoker = get_cv(name, 0);
  if (!invoker) croak("Missing generated owned callback converter");
  lpo_callback *callback = lpg_allocate(aTHX_ frame->scope, 1, sizeof(*callback));
  callback->frame = frame;
  callback->code = lpg_pin(aTHX_ SvRV(code));
  callback->invoker = (CV *)lpg_pin(aTHX_ (SV *)invoker);
  return callback;
}
static uint32_t lpo_invoke(lpo_callback *callback, ${prefix}_session *session,
    const void **arguments, void *output, ${prefix}_result **owner) {
  dTHX; dSP;
  if (!lpo_origin(aTHX) || lpo_state.closed || session != lpo_state.session) return 10;
  lpo_frame *frame = callback->frame;
  if (frame->error) return 10;
  lpo_invocation invocation = { callback, arguments, output, owner, 0 }, *previous = lpo_active;
  lpo_active = &invocation;
  PUSHMARK(SP); PUTBACK;
  int count = call_sv((SV *)callback->invoker, G_VOID | G_EVAL);
  SPAGAIN; SP -= count;
  if (SvROK(ERRSV) || SvTRUE(ERRSV)) {
    frame->error = GvSV(PL_errgv);
    GvSV(PL_errgv) = frame->replacement; frame->replacement = NULL;
  }
  PUTBACK; lpo_active = previous;
  return !frame->error && invocation.returned ? 0 : 10;
}
static void lpo_finish_frame(pTHX_ lpo_frame *frame, uint32_t status) {
  if (frame->error) croak_sv(frame->error);
  lpo_status(aTHX_ status);
}
`;

const callbackClass = name => `package ${name};
sub new {
  CORE::die "${name}->new expects code and recovery\\n"
    unless @_ == 5 && CORE::defined($_[0]) && !CORE::ref($_[0]) && $_[0] eq '${name}';
  CORE::shift; my %fields = @_;
  CORE::die "expected code and recovery fields\\n"
    unless CORE::keys(%fields) == 2 && CORE::exists($fields{code}) && CORE::exists($fields{recovery});
  CORE::die "expected a Perl code reference\\n" unless CORE::ref($fields{code}) eq 'CODE';
  return CORE::bless \\%fields, '${name}';
}
`;

/**
 * Emit all declared functions and closure methods over the owned C ABI.
 * Installation, native library authentication and CPAN admission are separate.
 *
 * @param ir - Compiler-authenticated explicit ownership contract.
 * @param moduleName - Validated public CPAN namespace.
 */
export const generateOwnedPerlXs = (ir, moduleName) => {
	const model = generateOwnedPerlConversions(ir, moduleName), p = model.c.prefix;
	const nodes = new Map(model.types.map(node => [node.id, node]));
	const declarations = [model.source, callbackRuntime(p)];
	const xs = [`MODULE = ${moduleName} PACKAGE = ${moduleName}
PROTOTYPES: DISABLE

BOOT:
    lpo_boot(aTHX);
`];
	const hostClass = moduleName + "::Runtime::Callback";
	const hostClasses = model.c.callbacks.length ? [callbackClass(hostClass)] : [];
	for(const callback of model.c.callbacks)
	{
		const node = nodes.get(callback.id), result = nodes.get(callback.result);
		const parameters = callback.parameters.slice(1).map(id => nodes.get(id));
		const invoker = "_owned_callback_" + node.index;
		const copy = [...model.c.copies, ...model.c.retains].find(fn => fn.result === result.id);
		declarations.push(`static ${p}_status lpo_callback${node.index}(void *context, ${p}_session *session,
    ${parameters.map((param, index) => `${param.cName}${param.leaf ? "" : " const *"} a${index}`).concat([`${result.cName} *out`, `${p}_result **owner`]).join(", ")}) {
  const void *arguments[] = { ${parameters.length ? parameters.map((param, index) => `${param.leaf ? "&" : ""}a${index}`).join(", ") : "NULL"} };
  return lpo_invoke(context, session, arguments, out, owner);
}
static ${node.cName}_host lpo_host${node.index}(pTHX_ lpo_frame *frame, SV *value) {
  SvGETMAGIC(value); lpo_context(aTHX);
  ${node.cName}_host descriptor = {0};
  SV *code = value;
  if (lpg_branch(value, "${hostClass}")) {
    static const char *const fields[] = {"code", "recovery"};
    SV **slots = lpg_fields(aTHX_ frame->scope, value, "${hostClass}", fields, 2);
    code = slots[0];
    ${result.cName} *recovery = lpg_allocate(aTHX_ frame->scope, 1, sizeof(*recovery));
    lpo_read${result.index}(aTHX_ frame->scope, slots[1], recovery, 0, 1);
    descriptor.recovery = recovery;
  } else if (!(SvROK(code) && SvTYPE(SvRV(code)) == SVt_PVCV && !SvOBJECT(SvRV(code)))) {
    descriptor.closure = (${node.cName})lpo_borrow(aTHX_ value, ${node.index});
    return descriptor;
  }
  if (${node.cName.toUpperCase()}_REQUIRES_RECOVERY && !descriptor.recovery)
    croak("This callback requires a typed recovery value; use ${hostClass}->new");
  descriptor.context = lpo_new_callback(aTHX_ frame, code, "${moduleName}::${invoker}");
  descriptor.call = lpo_callback${node.index};
  return descriptor;
}
`);
		xs.push(`void
${invoker}(...)
  PPCODE:
    lpo_context(aTHX);
    if (!lpo_active || lpo_active->callback->invoker != cv)
      croak("Owned callback converter requires its active native invocation");
    lpo_invocation *invocation = lpo_active;
    ENTER; SAVETMPS;
    lpo_enter_call(aTHX);
    lpg_scope *scope = lpg_begin(aTHX_ NULL);
    lpo_owner *borrow = lpo_begin_owner(aTHX_ 1);
    lpo_owner *reply = lpo_begin_owner(aTHX_ 0);
    ${parameters.map((param, index) => `SV *argument${index} = lpo_write${param.index}(aTHX_ scope, borrow, invocation->arguments[${index}], 0, 1);`).join("\n    ")}
    SPAGAIN; PUSHMARK(SP); EXTEND(SP, ${parameters.length});
    ${parameters.map((_, index) => `PUSHs(argument${index});`).join(" ")} PUTBACK;
    int count = call_sv(invocation->callback->code, G_SCALAR);
    SPAGAIN;
    if (count != 1) { SP -= count; PUTBACK; croak("Host callback must return one value"); }
    SV *returned = POPs; PUTBACK; lpg_pin(aTHX_ returned);
    lpo_context(aTHX);
    if (lpo_state.closed) croak("Lean ownership session is closed");
    ${result.cName} input = {0};
    lpo_read${result.index}(aTHX_ scope, returned, &input, 0, 1);
    /* Copy before Perl temporaries and borrowed argument owners unwind.
       The native caller releases this reply owner on success and failure. */
    lpo_status(aTHX_ ${copy.cName}(lpo_state.session, ${result.leaf ? "" : "&"}input, invocation->output, &reply->result));
    *invocation->owner = reply->result; reply->result = NULL;
    FREETMPS; LEAVE;
    invocation->returned = 1;
    XSRETURN_EMPTY;
`);
	}
	const render = (name, fn) => {
		const inputs = fn.parameters.map(id => nodes.get(id)), result = nodes.get(fn.result);
		return `void
${name}(...)
  PPCODE:
    if (items != ${inputs.length}) croak("${name} expects ${inputs.length} arguments");
    ENTER;
    lpo_enter_call(aTHX);
    lpg_scope *scope = lpg_begin(aTHX_ NULL);
    lpo_frame *frame = lpo_begin_frame(aTHX_ scope);
    lpo_owner *owner = lpo_begin_owner(aTHX_ 0);
    ${inputs.map((_, index) => `SV *argument${index} = lpg_pin(aTHX_ ST(${index}));`).join("\n    ")}
    ${inputs.map((node, index) => model.c.hostArgument(fn, index)
		? `${node.cName}_host input${index} = lpo_host${node.index}(aTHX_ frame, argument${index});`
		: `${node.cName} input${index} = {0}; lpo_read${node.index}(aTHX_ scope, argument${index}, &input${index}, 0, 1);`).join("\n    ")}
    lpo_context(aTHX);
    if (lpo_state.closed) croak("Lean ownership session is closed");
    ${result.cName} returned = {0};
    uint32_t status = ${fn.cName}(lpo_state.session, ${inputs.map((node, index) => `${model.c.hostArgument(fn, index) || !node.leaf ? "&" : ""}input${index}`).concat(["&returned", "&owner->result"]).join(", ")});
    lpo_finish_frame(aTHX_ frame, status);
    SV *out = lpo_write${result.index}(aTHX_ scope, owner, &returned, 0, 1);
    lpo_publish(aTHX_ owner);
    LEAVE;
    SPAGAIN; SP = PL_stack_base + ax - 1; EXTEND(SP, 1); XPUSHs(out);
`;
	};
	for(const fn of model.functions) xs.push(render(fn.publicName, fn));
	for(const node of model.types.filter(node => node.identity))
	{
		xs.push(`MODULE = ${moduleName} PACKAGE = ${node.publicType}

void
close(value)
    SV *value
  PPCODE:
    lpo_wrapper_close(aTHX_ lpo_get(aTHX_ value, ${node.index}));

int
closed(value)
    SV *value
  CODE:
    RETVAL = lpo_closed(lpo_get(aTHX_ value, ${node.index}));
  OUTPUT:
    RETVAL
`, render("retain", model.c.retains.find(fn => fn.id === node.id)));
		if(node.kind === "callback") xs.push(render("call", model.c.callbacks.find(fn => fn.id === node.id)));
	}
	xs.push(`MODULE = ${moduleName} PACKAGE = ${moduleName}::Runtime

void
shutdown()
  PPCODE:
    lpo_context(aTHX);
    lpo_shutdown(aTHX_ NULL);
`);
	return { ...model, declarations: declarations.join("\n"), xs: xs.join("\n")
		, valuesSource: model.valuesSource + "\n" + hostClasses.join("\n") + "\n1;\n" };
};
