/* Private XS ABI of LeanBridge::Runtime; not an application handle API. */
#ifndef LB_PERL_HOST_DOMAIN_H
#define LB_PERL_HOST_DOMAIN_H
#include "runtime.h"
typedef struct lbp_host_session lbp_host_session;
typedef struct { const char *key; int strong; } lbp_host_spec;
void lbp_host_bind(pTHX_ lbp_host_session **slot, const lbp_host_spec *, size_t, const char *const *);
void lbp_host_unbind(pTHX_ lbp_host_session **slot);
/* Enter inside an XS ENTER/SAVETMPS scope. Scope unwind releases the borrow. */
void lbp_host_enter(pTHX_ lbp_host_session *);
/* wrap returns a new Lean ref, initially provisional. Admit strong pins only
   after complete input conversion, or after validating a member return. */
lean_object *lbp_host_wrap(pTHX_ lbp_host_session *, unsigned, SV *, SV *anchor);
void lbp_host_admit(pTHX_ lbp_host_session *, unsigned, b_lean_obj_arg);
SV *lbp_host_object(pTHX_ lbp_host_session *, unsigned, b_lean_obj_arg);
size_t lbp_host_live(pTHX);
#endif
