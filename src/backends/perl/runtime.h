#ifndef LEAN_BRIDGE_PERL_RUNTIME_H
#define LEAN_BRIDGE_PERL_RUNTIME_H
#include "EXTERN.h"
#include "perl.h"
#include "XSUB.h"
#include <lean/lean.h>
#include "lean_bridge_native_runtime.h"
#include <pthread.h>
#include <inttypes.h>
#ifdef MULTIPLICITY
#define LBP_CONTEXT aTHX
#else
#define LBP_CONTEXT ((PerlInterpreter *)1)
#endif

/* Private native-library-v1 API. Never a public Perl pointer/handle API. */
typedef struct lbp_scope lbp_scope;
typedef struct lbp_callback {
  SV *code;
  CV *invoker;
  lbp_scope *scope;
  uint64_t token;
} lbp_callback;
typedef struct lbp_invocation { lbp_callback *callback; void *frame; } lbp_invocation;

void lbp_check_interpreter(pTHX);
lbp_scope *lbp_begin(pTHX);
void lbp_end(pTHX_ void *scope);
lean_object *lbp_keep(lbp_scope *scope, lean_object *value);
void lbp_budget(lbp_scope *scope, size_t bytes);
void lbp_finish(pTHX_ lbp_scope *scope);
SV *lbp_resource(pTHX_ lean_object *object, const char *kind, const char *package);
lean_object *lbp_borrow(pTHX_ lbp_scope *scope, SV *value, const char *kind);
uint64_t lbp_callback_new(pTHX_ lbp_scope *scope, SV *code, CV *invoker, void (*invoke)(void));
int lbp_callback_invoke(lbp_callback *callback, void *frame);
lbp_invocation *lbp_callback_current(pTHX);
SV *lbp_bigint_text(pTHX_ SV *value, int natural);
SV *lbp_bigint_from_text(pTHX_ const char *text, size_t length);

static inline SV *lbp_mortal(SV *value) { dTHX; return sv_2mortal(value); }
static inline void lbp_plain(pTHX_ SV *value) {
  SvGETMAGIC(value);
  if (SvROK(value)) croak("expected a scalar value");
}
static inline uint64_t lbp_unsigned(pTHX_ SV *value, uint64_t maximum) {
  lbp_plain(aTHX_ value);
  if (!SvIOK(value) || (!SvIsUV(value) && SvIV(value) < 0) || SvUV(value) > maximum)
    croak("unsigned integer is out of range or not an exact integer scalar");
  return (uint64_t)SvUV(value);
}
static inline int64_t lbp_signed(pTHX_ SV *value, int64_t minimum, int64_t maximum) {
  lbp_plain(aTHX_ value);
  if (!SvIOK(value) || (SvIsUV(value) && SvUV(value) > (uint64_t)maximum) ||
      (!SvIsUV(value) && (SvIV(value) < minimum || SvIV(value) > maximum)))
    croak("signed integer is out of range or not an exact integer scalar");
  return (int64_t)SvIV(value);
}
static inline SV *lbp_field(pTHX_ HV *value, const char *field, I32 length) {
  SV **entry = hv_fetch(value, field, length, 0);
  if (!entry) croak("missing record field %s", field);
  return sv_2mortal(SvREFCNT_inc(*entry));
}
#define LBP_ENTER() ENTER; SAVETMPS; lbp_scope *scope = lbp_begin(aTHX); SAVEDESTRUCTOR_X(lbp_end, scope)
#define LBP_LEAVE() FREETMPS; LEAVE
#endif
