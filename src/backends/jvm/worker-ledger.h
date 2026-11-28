/* Private to one compiled component. Global Java references are owned by the
   shared JVM class registry. The task ledger only borrows its Lean wrappers. */
#ifndef LB_JVM_WORKER_LEDGER_H
#define LB_JVM_WORKER_LEDGER_H
#include "host-domain.h"
#include "task-resource-ledger.h"
/* The body is component-owned native code, never an application callback. */
jobject lb_jw_visit(lb_jh_frame *,lb_jhd_session *,lb_jh_body,void *);
int lb_jw_pin(unsigned,const char *,jobject,uint64_t [2]);
jobject lb_jw_object(unsigned,const char *,const uint64_t [2]);
void lb_jw_admit(void);
int lb_jw_create(const char *,lean_object *,uint64_t [2]);
lean_object *lb_jw_borrow(const char *,const uint64_t [2]);
int lb_jw_release(const char *,uint64_t [2]);
#ifndef LB_JVM_WORKER_LEDGER_IMPL
#undef LB_LEASE
#define LB_LEASE(op) lb_jw_##op
#endif
#endif
