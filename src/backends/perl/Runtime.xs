#include "runtime.h"
#include <stdlib.h>
#include <string.h>

_Static_assert(sizeof(void *) == 8 && sizeof(IV) == 8 && sizeof(UV) == 8,
  "Lean Bridge requires a 64-bit Perl ABI");
static PerlInterpreter *lbp_interpreter;
static pthread_t lbp_thread;
static pid_t lbp_pid;
static lbp_invocation *lbp_active_callback;
static uint64_t lbp_live_wrappers;
static uint64_t lbp_live_scopes;
static uint64_t lbp_live_callbacks;

struct lbp_scope {
  lean_object **objects;
  size_t count, capacity, bytes;
  lbp_callback **callbacks;
  size_t callback_count;
  SV *error;
};
typedef struct lbp_handle {
  lean_object *object;
  char *kind;
  uint64_t token;
  PerlInterpreter *interpreter;
} lbp_handle;

void lbp_check_interpreter(pTHX) {
  if (lbp_interpreter != LBP_CONTEXT || lbp_pid != getpid() || !pthread_equal(lbp_thread, pthread_self()))
    croak("Lean Bridge requires its initiating process and Perl interpreter thread; cross-interpreter calls are unsupported");
}
lbp_scope *lbp_begin(pTHX) {
  lbp_check_interpreter(aTHX);
  lbp_scope *scope;
  Newxz(scope, 1, lbp_scope);
  ++lbp_live_scopes;
  return scope;
}
void lbp_budget(lbp_scope *scope, size_t bytes) {
  if (bytes > 16 * 1024 * 1024 || scope->bytes > 16 * 1024 * 1024 - bytes)
    croak("native copied values exceed the 16 MiB per-call limit");
  scope->bytes += bytes;
}
lean_object *lbp_keep(lbp_scope *scope, lean_object *value) {
  if (lean_is_scalar(value)) return value;
  if (scope->count == scope->capacity) {
    size_t next = scope->capacity ? scope->capacity * 2 : 32;
    if (next > 4 * 1024 * 1024) { lean_dec(value); croak("native ownership budget exceeded"); }
    /* libc allocation lets us release value before reporting an allocation failure. */
    void *grown = realloc(scope->objects, next * sizeof(lean_object *));
    if (!grown) { lean_dec(value); croak("native ownership allocation failed"); }
    scope->objects = grown; scope->capacity = next;
  }
  scope->objects[scope->count++] = value;
  return value;
}
void lbp_end(pTHX_ void *data) {
  lbp_scope *scope = data;
  for (size_t i = 0; i < scope->callback_count; ++i) {
    lbp_callback *cb = scope->callbacks[i];
    lb_native_callback_release(cb->token);
    SvREFCNT_dec(cb->code); SvREFCNT_dec((SV *)cb->invoker); Safefree(cb);
    --lbp_live_callbacks;
  }
  for (size_t i = scope->count; i > 0; --i) lean_dec(scope->objects[i - 1]);
  free(scope->objects); Safefree(scope->callbacks); SvREFCNT_dec(scope->error);
  Safefree(scope); --lbp_live_scopes;
}
void lbp_finish(pTHX_ lbp_scope *scope) {
  int expired = lb_native_callback_take_error();
  if (scope->error) croak_sv(scope->error);
  for (size_t i = 0; i < scope->callback_count; ++i)
    if (lb_native_callback_wrong_thread(scope->callbacks[i]->token)) croak("host callback attempted to run on a different thread");
  if (expired) croak("host callback has expired; retaining host callbacks is unsupported");
}

static HV *lbp_wrappers(pTHX) {
  SV **entry = hv_fetch(PL_modglobal, "LeanBridge/native-v1/wrappers", 29, 1);
  if (!SvROK(*entry)) sv_setrv_noinc(*entry, (SV *)newHV());
  return (HV *)SvRV(*entry);
}
static void lbp_handle_close(pTHX_ lbp_handle *handle) {
  if (!handle->object) return;
  /* A fork copies Perl wrappers, not a usable Lean runtime. Automatic child
     cleanup must never enter inherited broker locks or touch Lean refcounts. */
  if (lbp_pid != getpid()) {
    handle->object = NULL;
    --lbp_live_wrappers;
    return;
  }
  if (handle->interpreter != LBP_CONTEXT) croak("wrong Perl interpreter for Lean resource");
  char key[32]; int size = snprintf(key, sizeof(key), "%" PRIu64, handle->token);
  hv_delete(lbp_wrappers(aTHX), key, size, G_DISCARD);
  lean_bridge_native_identity_release(handle->token, handle->kind, handle->object);
  lean_dec(handle->object); handle->object = NULL;
  --lbp_live_wrappers;
}
static int lbp_handle_free(pTHX_ SV *sv, MAGIC *magic) {
  (void)sv;
  lbp_handle *handle = (lbp_handle *)magic->mg_ptr;
  if (handle) {
    lbp_handle_close(aTHX_ handle); Safefree(handle->kind); Safefree(handle);
    magic->mg_ptr = NULL;
  }
  return 0;
}
static MGVTBL lbp_handle_magic = { .svt_free = lbp_handle_free };
static lbp_handle *lbp_get_handle(pTHX_ SV *value) {
  lbp_check_interpreter(aTHX);
  if (!SvROK(value)) croak("expected a generated Lean resource object");
  MAGIC *magic = mg_findext(SvRV(value), PERL_MAGIC_ext, &lbp_handle_magic);
  if (!magic || !magic->mg_ptr) croak("invalid or foreign Lean resource object");
  lbp_handle *handle = (lbp_handle *)magic->mg_ptr;
  if (handle->interpreter != LBP_CONTEXT) croak("wrong Perl interpreter for Lean resource");
  return handle;
}
SV *lbp_resource(pTHX_ lean_object *object, const char *kind, const char *package) {
  lbp_check_interpreter(aTHX);
  uint64_t token = lean_bridge_native_identity_acquire(kind, object);
  if (!token) croak("native resource identity capacity exceeded");
  char key[32]; int size = snprintf(key, sizeof(key), "%" PRIu64, token);
  HV *wrappers = lbp_wrappers(aTHX);
  SV **known = hv_fetch(wrappers, key, size, 0);
  if (known && SvROK(*known)) {
    lean_bridge_native_identity_release(token, kind, object);
    return lbp_mortal(newSVsv(*known));
  }
  lbp_handle *handle; Newxz(handle, 1, lbp_handle);
  handle->kind = savepv(kind); handle->object = object; handle->token = token; handle->interpreter = LBP_CONTEXT;
  lean_inc(object);
  SV *rv = lbp_mortal(newRV_noinc((SV *)newHV()));
  sv_magicext(SvRV(rv), NULL, PERL_MAGIC_ext, &lbp_handle_magic, (char *)handle, 0);
  sv_bless(rv, gv_stashpv(package, GV_ADD));
  SV *weak = newSVsv(rv); sv_rvweaken(weak); hv_store(wrappers, key, size, weak, 0);
  ++lbp_live_wrappers;
  return rv;
}
lean_object *lbp_borrow(pTHX_ lbp_scope *scope, SV *value, const char *kind) {
  lbp_handle *handle = lbp_get_handle(aTHX_ value);
  if (strcmp(handle->kind, kind)) croak("wrong Lean resource type");
  if (!handle->object) croak("Lean resource is closed");
  lean_inc(handle->object);
  return lbp_keep(scope, handle->object);
}

uint64_t lbp_callback_new(pTHX_ lbp_scope *scope, SV *code, CV *invoker, void (*invoke)(void)) {
  if (!SvROK(code) || SvTYPE(SvRV(code)) != SVt_PVCV) croak("expected a CODE reference");
  if (!invoker) croak("missing generated callback converter");
  Renew(scope->callbacks, scope->callback_count + 1, lbp_callback *);
  lbp_callback *cb; Newxz(cb, 1, lbp_callback);
  cb->code = SvREFCNT_inc(code); cb->invoker = (CV *)SvREFCNT_inc((SV *)invoker); cb->scope = scope;
  scope->callbacks[scope->callback_count++] = cb;
  ++lbp_live_callbacks;
  cb->token = lb_native_callback_register(invoke, cb);
  if (!cb->token) croak("native callback capacity exceeded");
  return cb->token;
}
lbp_invocation *lbp_callback_current(pTHX) {
  lbp_check_interpreter(aTHX);
  if (!lbp_active_callback) croak("callback converter may only run during a native callback");
  return lbp_active_callback;
}
int lbp_callback_invoke(lbp_callback *callback, void *frame) {
  dTHX; dSP;
  lbp_invocation invocation = { callback, frame }, *previous = lbp_active_callback;
  if (callback->scope->error) return 0;
  lbp_active_callback = &invocation;
  ENTER; SAVETMPS;
  PUSHMARK(SP); PUTBACK;
  call_sv((SV *)callback->invoker, G_DISCARD | G_EVAL);
  SPAGAIN;
  if (SvROK(ERRSV) || SvTRUE(ERRSV)) callback->scope->error = newSVsv(ERRSV);
  PUTBACK; FREETMPS; LEAVE;
  lbp_active_callback = previous;
  return callback->scope->error == NULL;
}
SV *lbp_bigint_text(pTHX_ SV *value, int natural) {
  dSP;
  if (!SvROK(value) || !sv_derived_from(value, "Math::BigInt")) croak("expected Math::BigInt");
  PUSHMARK(SP); XPUSHs(value); PUTBACK;
  int count = call_method("bstr", G_SCALAR);
  SPAGAIN;
  if (count != 1) croak("Math::BigInt did not return one decimal value");
  SV *text = lbp_mortal(newSVsv(POPs)); PUTBACK;
  STRLEN length; const char *p = SvPV(text, length); size_t i = 0;
  if (!length) croak("invalid Math::BigInt");
  if (p[0] == '-') { if (natural) croak("Nat cannot be negative"); i = 1; }
  if (i == length) croak("invalid Math::BigInt");
  for (; i < length; ++i) if (p[i] < '0' || p[i] > '9') croak("Math::BigInt must be finite and integral");
  return text;
}
SV *lbp_bigint_from_text(pTHX_ const char *text, size_t length) {
  dSP;
  PUSHMARK(SP); XPUSHs(lbp_mortal(newSVpvs("Math::BigInt"))); XPUSHs(lbp_mortal(newSVpvn(text, length))); PUTBACK;
  int count = call_method("new", G_SCALAR);
  SPAGAIN;
  if (count != 1) croak("Math::BigInt construction failed");
  SV *result = lbp_mortal(newSVsv(POPs)); PUTBACK;
  return result;
}

MODULE = LeanBridge::Runtime    PACKAGE = LeanBridge::Runtime
PROTOTYPES: DISABLE

void
_check_context()
  PPCODE:
    lbp_check_interpreter(aTHX);
    XSRETURN_EMPTY;

void
_snapshot(...)
  PPCODE:
    lbp_check_interpreter(aTHX);
    lean_bridge_native_snapshot snapshot;
    lean_bridge_native_snapshot_read(&snapshot);
    HV *out = newHV();
    hv_stores(out, "live_wrappers", newSVuv(lbp_live_wrappers));
    hv_stores(out, "live_scopes", newSVuv(lbp_live_scopes));
    hv_stores(out, "live_callbacks", newSVuv(lbp_live_callbacks));
    hv_stores(out, "live_identities", newSVuv(snapshot.live_identities));
    hv_stores(out, "runtime_init_runs", newSVuv(snapshot.runtime_init_runs));
    XPUSHs(sv_2mortal(newRV_noinc((SV *)out)));

MODULE = LeanBridge::Runtime    PACKAGE = LeanBridge::Runtime::Resource

void
close(value)
    SV *value
  PPCODE:
    lbp_handle_close(aTHX_ lbp_get_handle(aTHX_ value));
    XSRETURN_EMPTY;

void
closed(value)
    SV *value
  PPCODE:
    XPUSHs(boolSV(lbp_get_handle(aTHX_ value)->object == NULL));

BOOT:
  if (lbp_interpreter) lbp_check_interpreter(aTHX);
  lbp_interpreter = LBP_CONTEXT;
  lbp_thread = pthread_self();
  lbp_pid = getpid();
