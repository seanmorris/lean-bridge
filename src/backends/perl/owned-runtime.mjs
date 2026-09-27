/**
 * Perl save-stack transactions and private XS leases over owned C results.
 *
 * @file
 */
import { perlGraphRuntime } from "./copied-graph-runtime.mjs";

/**
 * Keep resource leaves alive independently of temporary aggregate storage.
 * Native result ownership moves only after a complete Perl result is published.
 *
 * @param prefix - Validated public C component prefix.
 */
export const ownedPerlRuntime = prefix => {
	if(typeof prefix !== "string" || !/^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/u.test(prefix))
		throw new TypeError("Invalid owned Perl component prefix");
	return `${perlGraphRuntime}
#include <pthread.h>
#include <unistd.h>
#ifndef LB_PERL_OWNED_MALLOC
#define LB_PERL_OWNED_MALLOC malloc
#endif
#ifndef LB_PERL_OWNED_FREE
#define LB_PERL_OWNED_FREE free
#endif
#ifdef MULTIPLICITY
#define LPO_CONTEXT aTHX
#else
#define LPO_CONTEXT ((PerlInterpreter *)1)
#endif
typedef struct lpo_owner lpo_owner;
struct lpo_owner {
  lpo_owner *previous, *next;
  ${prefix}_result *result;
  size_t references;
  int published, borrowed, valid;
};
typedef struct {
  lpo_owner *owner;
  void *handle;
  size_t type;
  const char *package;
} lpo_wrapper;
static struct {
  ${prefix}_session *session;
  lpo_owner *owners;
  PerlInterpreter *interpreter;
  pthread_t thread;
  pid_t process;
  unsigned active;
  int initialized, closed, cleanup_status;
} lpo_state;
static int lpo_origin(pTHX) {
  return lpo_state.initialized && lpo_state.process == getpid()
    && lpo_state.interpreter == LPO_CONTEXT
    && pthread_equal(lpo_state.thread, pthread_self());
}
static void lpo_context(pTHX) {
  if (!lpo_origin(aTHX))
    croak("Lean ownership requires its initiating process and Perl interpreter thread");
}
static void lpo_status(pTHX_ unsigned status) {
  if (!status) return;
  const char *message = status == 1 ? "invalid argument" : status == 2 ? "conversion limit exceeded"
    : status == 3 ? "allocation failed" : status == 4 ? "resource closed"
    : status == 5 ? "wrong thread" : status == 6 ? "wrong process"
    : status == 7 ? "shared runtime unavailable" : status == 8 ? "invalid call order"
    : status == 9 ? "malformed native result" : status == 10 ? "host callback failed" : "unknown status";
  croak("Lean ownership failed (status=%u): %s", status, message);
}
static void lpo_release_native(pTHX_ lpo_owner *owner) {
  if (!owner->result) return;
  if (!lpo_origin(aTHX)) { owner->result = NULL; return; }
  unsigned status = ${prefix}_result_release(&owner->result);
  if (status && !lpo_state.cleanup_status) lpo_state.cleanup_status = (int)status;
}
static void lpo_hold(pTHX_ lpo_owner *owner) {
  if (!owner || owner->references == SIZE_MAX) croak("Perl ownership reference limit exceeded");
  ++owner->references;
}
static void lpo_release(pTHX_ lpo_owner *owner) {
  if (!owner || !owner->references) return;
  if (--owner->references) return;
  lpo_release_native(aTHX_ owner);
  if (owner->previous) owner->previous->next = owner->next;
  else lpo_state.owners = owner->next;
  if (owner->next) owner->next->previous = owner->previous;
  LB_PERL_OWNED_FREE(owner);
}
static void lpo_end_owner(pTHX_ void *data) {
  lpo_owner *owner = data;
  if (!owner->published || owner->borrowed) {
    owner->valid = 0;
    lpo_release_native(aTHX_ owner);
  }
  lpo_release(aTHX_ owner);
}
static lpo_owner *lpo_begin_owner(pTHX_ int borrowed) {
  lpo_context(aTHX);
  if (lpo_state.closed) croak("Lean ownership session is closed");
  /* No native owner exists until its save-stack cleanup is registered. */
  SSGROW(4);
  LB_PERL_GRAPH_CHECKPOINT();
  lpo_owner *owner = LB_PERL_OWNED_MALLOC(sizeof(*owner));
  if (!owner) croak("Perl ownership allocation failed");
  memset(owner, 0, sizeof(*owner));
  owner->references = 1; owner->borrowed = borrowed; owner->valid = 1;
  SAVEDESTRUCTOR_X(lpo_end_owner, owner);
  owner->next = lpo_state.owners;
  if (owner->next) owner->next->previous = owner;
  lpo_state.owners = owner;
  return owner;
}
static void lpo_publish(pTHX_ lpo_owner *owner) {
  lpo_context(aTHX);
  if (!owner || !owner->valid || owner->borrowed || lpo_state.closed)
    croak("Invalid Perl ownership publication");
  owner->published = 1;
}
static void lpo_wrapper_close(pTHX_ lpo_wrapper *wrapper) {
  lpo_owner *owner = wrapper->owner;
  wrapper->owner = NULL; wrapper->handle = NULL;
  lpo_release(aTHX_ owner);
}
static int lpo_wrapper_free(pTHX_ SV *value, MAGIC *magic) {
  (void)value;
  lpo_wrapper *wrapper = (lpo_wrapper *)magic->mg_ptr;
  magic->mg_ptr = NULL;
  if (wrapper) {
    lpo_wrapper_close(aTHX_ wrapper);
    LB_PERL_OWNED_FREE(wrapper);
  }
  return 0;
}
#ifdef USE_ITHREADS
static int lpo_wrapper_dup(pTHX_ MAGIC *magic, CLONE_PARAMS *params) {
  PERL_UNUSED_CONTEXT; (void)params;
  magic->mg_ptr = NULL;
  return 0;
}
#endif
static MGVTBL lpo_wrapper_magic = {
  .svt_free = lpo_wrapper_free,
#ifdef USE_ITHREADS
  .svt_dup = lpo_wrapper_dup,
#endif
};
static SV *lpo_wrap(pTHX_ lpg_scope *scope, lpo_owner *owner,
    void *handle, size_t type, const char *package) {
  lpo_context(aTHX);
  if (!owner || !owner->valid || !handle || (!owner->borrowed && !owner->result))
    lpg_invalid(aTHX_ scope, "missing resource owner");
  HV *hash = lpg_hash(aTHX_ scope);
  SV *value = lpg_reference(aTHX_ scope, (SV *)hash, package);
  lpg_charge(aTHX_ &scope->storage_bytes, 1, sizeof(lpo_wrapper));
  LB_PERL_GRAPH_CHECKPOINT();
  MAGIC *magic = sv_magicext((SV *)hash, NULL, PERL_MAGIC_ext, &lpo_wrapper_magic, NULL, 0);
#ifdef USE_ITHREADS
  magic->mg_flags |= MGf_DUP;
#endif
  LB_PERL_GRAPH_CHECKPOINT();
  lpo_wrapper *wrapper = LB_PERL_OWNED_MALLOC(sizeof(*wrapper));
  if (!wrapper) croak("Perl ownership allocation failed");
  memset(wrapper, 0, sizeof(*wrapper)); magic->mg_ptr = (char *)wrapper;
  lpo_hold(aTHX_ owner);
  wrapper->owner = owner; wrapper->handle = handle;
  wrapper->type = type; wrapper->package = package;
  return value;
}
static lpo_wrapper *lpo_get(pTHX_ SV *value, size_t type) {
  SvGETMAGIC(value); lpo_context(aTHX);
  if (!SvROK(value) || SvTYPE(SvRV(value)) != SVt_PVHV || !SvOBJECT(SvRV(value)))
    croak("Expected a generated Lean resource or closure");
  MAGIC *magic = mg_findext(SvRV(value), PERL_MAGIC_ext, &lpo_wrapper_magic);
  if (!magic || !magic->mg_ptr) croak("Invalid or foreign Lean identity");
  lpo_wrapper *wrapper = (lpo_wrapper *)magic->mg_ptr;
  HV *stash = SvSTASH(SvRV(value));
  const char *name = stash ? HvNAME(stash) : NULL;
  if (wrapper->type != type || !name || strcmp(name, wrapper->package))
    croak("Wrong Lean identity type");
  return wrapper;
}
static int lpo_closed(lpo_wrapper *wrapper) {
  return lpo_state.closed || !wrapper->handle || !wrapper->owner
    || !wrapper->owner->valid
    || (!wrapper->owner->published && !wrapper->owner->borrowed);
}
static void lpo_unpin(pTHX_ void *data) { lpo_release(aTHX_ data); }
static void *lpo_borrow(pTHX_ SV *value, size_t type) {
  lpo_wrapper *wrapper = lpo_get(aTHX_ value, type);
  if (lpo_closed(wrapper)) croak("Lean identity is closed or its callback borrow has expired");
  /* Explicit close during reentry cannot release an in-flight input owner. */
  SSGROW(4);
  lpo_hold(aTHX_ wrapper->owner);
  SAVEDESTRUCTOR_X(lpo_unpin, wrapper->owner);
  return wrapper->handle;
}
static void lpo_drain(pTHX) {
  if (!lpo_origin(aTHX) || !lpo_state.closed || lpo_state.active) return;
  for (lpo_owner *owner = lpo_state.owners; owner; owner = owner->next) {
    owner->valid = 0; lpo_release_native(aTHX_ owner);
  }
  unsigned status = ${prefix}_session_close(&lpo_state.session);
  if (status && !lpo_state.cleanup_status) lpo_state.cleanup_status = (int)status;
}
static void lpo_shutdown(pTHX_ void *unused) {
  (void)unused;
  if (!lpo_origin(aTHX)) return;
  lpo_state.closed = 1; lpo_drain(aTHX);
}
static void lpo_end_call(pTHX_ void *unused) {
  (void)unused;
  if (lpo_state.active) --lpo_state.active;
  lpo_drain(aTHX);
}
static void lpo_enter_call(pTHX) {
  lpo_context(aTHX);
  if (lpo_state.closed) croak("Lean ownership session is closed");
  if (lpo_state.active == 64) croak("Perl ownership reentry limit exceeded");
  SSGROW(4);
  ++lpo_state.active;
  SAVEDESTRUCTOR_X(lpo_end_call, NULL);
}
static void lpo_boot(pTHX) {
  if (lpo_state.initialized) { lpo_context(aTHX); return; }
  lpo_state.interpreter = LPO_CONTEXT; lpo_state.thread = pthread_self();
  lpo_state.process = getpid(); lpo_state.initialized = 1; lpo_state.closed = 1;
  /* Register shutdown before acquiring a native session. */
  call_atexit(lpo_shutdown, NULL);
  lpo_status(aTHX_ ${prefix}_session_open(&lpo_state.session));
  lpo_state.closed = 0;
}
`;
};
