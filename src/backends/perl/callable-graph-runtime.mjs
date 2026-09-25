/**
 * Retain callback replies and private owned closures across Perl evaluation boundaries.
 *
 * @file
 */
export const perlCallableGraphRuntime = `
typedef struct {
  lpg_scope *scope;
  SV *error;
  SV *replacement;
} lpc_frame;
typedef struct lpc_lease lpc_lease;
typedef struct {
  lpc_frame *frame;
  SV *code;
  CV *invoker;
  lpc_lease *lease;
} lpc_callback;
typedef struct {
  lpc_callback *callback;
  const void **arguments;
  void *output;
  int returned;
} lpc_invocation;
static lpc_invocation *lpc_active;
static void lpc_frame_end(pTHX_ void *value) {
  lpc_frame *frame = value;
  SvREFCNT_dec(frame->error); SvREFCNT_dec(frame->replacement);
}
static lpc_frame *lpc_begin(pTHX_ lpg_scope *scope) {
  lpc_frame *frame = lpg_allocate(aTHX_ scope, 1, sizeof(*frame));
  SSGROW(4); SAVEDESTRUCTOR_X(lpc_frame_end, frame);
  frame->scope = scope;
  /* Preserve aliases to the caller's $@ scalar. Only the localized scalar is
     transferred when a callback fails; normal Perl unwinding restores it. */
  save_scalar(PL_errgv);
  /* Allocate before native entry. Taking an exception from ERRSV later must
     not allocate or run user overloads while native cleanup is pending. */
  LB_PERL_GRAPH_CHECKPOINT(); frame->replacement = newSVpvs("");
  return frame;
}
static uint32_t lpc_invoke(lpc_callback *callback, const void **arguments, void *output) {
  dTHX; dSP;
  lpc_frame *frame = callback->frame;
  if (frame->error) return 6;
  lpc_invocation invocation = { callback, arguments, output, 0 }, *previous = lpc_active;
  lpc_active = &invocation;
  PUSHMARK(SP); PUTBACK;
  /* G_DISCARD frees temporaries after Perl has popped its eval boundary.
     The converter instead frees its temporaries inside that boundary. */
  int count = call_sv((SV *)callback->invoker, G_VOID | G_EVAL);
  SPAGAIN; SP -= count;
  if (SvROK(ERRSV) || SvTRUE(ERRSV)) {
    /* Transfer the global scalar's existing ownership. Exception objects and
       false-looking exceptions retain identity without stringification. */
    frame->error = GvSV(PL_errgv);
    GvSV(PL_errgv) = frame->replacement; frame->replacement = NULL;
  }
  PUTBACK;
  lpc_active = previous;
  return !frame->error && invocation.returned ? 0 : 6;
}
static void lpc_finish(pTHX_ lpc_frame *frame, uint32_t status) {
  if (frame->error) croak_sv(frame->error);
  if (status == 4) lpg_invalid(aTHX_ frame->scope, "carrier or callback result");
  const char *message = status == 1 ? "invalid argument or expired callback borrow" : status == 2 ? "conversion limit exceeded" :
    status == 3 ? "native allocation failed" : status == 5 ? "shared runtime unavailable" : status == 6 ? "host callback failed" : "unknown status";
  if (status) croak("Lean Bridge callable graph failed (status=%u): %s", (unsigned)status, message);
}
struct lpc_lease {
  uint64_t token;
  size_t signature;
  unsigned active;
  int closed, orphan;
  pid_t process;
  void (*dispose)(uint64_t);
};
static void lpc_lease_drop(lpc_lease *lease) {
  if (!lease->active && lease->token) {
    uint64_t token = lease->token; lease->token = 0;
    /* A forked child's finalizer never enters inherited native locks. */
    if (lease->process == getpid()) lease->dispose(token);
  }
}
static int lpc_lease_free(pTHX_ SV *value, MAGIC *magic) {
  PERL_UNUSED_CONTEXT; (void)value;
  lpc_lease *lease = (lpc_lease *)magic->mg_ptr; magic->mg_ptr = NULL;
  if (lease) {
    lease->closed = lease->orphan = 1; lpc_lease_drop(lease);
    if (!lease->active) LB_PERL_GRAPH_FREE(lease);
  }
  return 0;
}
#ifdef USE_ITHREADS
static int lpc_lease_dup(pTHX_ MAGIC *magic, CLONE_PARAMS *params) {
  PERL_UNUSED_CONTEXT; (void)params; magic->mg_ptr = NULL; return 0;
}
#endif
static MGVTBL lpc_lease_magic = {
  .svt_free = lpc_lease_free,
#ifdef USE_ITHREADS
  .svt_dup = lpc_lease_dup,
#endif
};
static lpc_lease *lpc_get_lease(pTHX_ SV *value) {
  lbp_check_interpreter(aTHX);
  if (!SvROK(value)) croak("Expected a generated Lean closure");
  MAGIC *magic = mg_findext(SvRV(value), PERL_MAGIC_ext, &lpc_lease_magic);
  if (!magic || !magic->mg_ptr) croak("Invalid or foreign Lean closure");
  return (lpc_lease *)magic->mg_ptr;
}
static SV *lpc_lease_new(pTHX_ lpg_scope *scope, size_t signature, void (*dispose)(uint64_t), const char *package, lpc_lease **out) {
  HV *hash = lpg_hash(aTHX_ scope);
  SV *value = lpg_reference(aTHX_ scope, (SV *)hash, package);
  LB_PERL_GRAPH_CHECKPOINT();
  MAGIC *magic = sv_magicext((SV *)hash, NULL, PERL_MAGIC_ext, &lpc_lease_magic, NULL, 0);
#ifdef USE_ITHREADS
  magic->mg_flags |= MGf_DUP;
#endif
  lpg_charge(aTHX_ &scope->storage_bytes, 1, sizeof(lpc_lease));
  LB_PERL_GRAPH_CHECKPOINT();
  lpc_lease *lease = LB_PERL_GRAPH_MALLOC(sizeof(*lease));
  if (!lease) croak("Perl closure allocation failed");
  *lease = (lpc_lease){ .signature = signature, .dispose = dispose, .process = getpid() };
  magic->mg_ptr = (char *)lease; *out = lease;
  return value;
}
typedef struct { lpc_lease *lease; } lpc_lease_guard;
static void lpc_guard_end(pTHX_ void *value) {
  PERL_UNUSED_CONTEXT;
  lpc_lease *lease = ((lpc_lease_guard *)value)->lease;
  if (lease) {
    --lease->active;
    if (lease->closed) lpc_lease_drop(lease);
    if (lease->orphan && !lease->active) LB_PERL_GRAPH_FREE(lease);
  }
}
static lpc_lease *lpc_lease_enter(pTHX_ lpg_scope *scope, SV *value, size_t signature) {
  lpc_lease *lease = lpc_get_lease(aTHX_ value);
  if (lease->signature != signature) croak("Wrong Lean closure signature");
  if (lease->closed || !lease->token) croak("Lean closure is closed");
  if (lease->active == 64) croak("Lean closure reentry limit exceeded");
  lpc_lease_guard *guard = lpg_allocate(aTHX_ scope, 1, sizeof(*guard));
  SSGROW(4); SAVEDESTRUCTOR_X(lpc_guard_end, guard);
  guard->lease = lease; ++lease->active;
  return lease;
}
static lpc_callback *lpc_callback_new(pTHX_ lpc_frame *frame, SV *code, size_t signature, const char *converter) {
  SvGETMAGIC(code);
  int closure = !(SvROK(code) && SvTYPE(SvRV(code)) == SVt_PVCV && !SvOBJECT(SvRV(code)));
  lpc_lease *lease = closure ? lpc_lease_enter(aTHX_ frame->scope, code, signature) : NULL;
  CV *invoker = get_cv(converter, 0);
  if (!invoker) croak("Missing generated callback converter");
  lpc_callback *callback = lpg_allocate(aTHX_ frame->scope, 1, sizeof(*callback));
  callback->frame = frame;
  callback->lease = lease;
  callback->code = closure ? NULL : lpg_pin(aTHX_ SvRV(code));
  callback->invoker = (CV *)lpg_pin(aTHX_ (SV *)invoker);
  return callback;
}
`;
