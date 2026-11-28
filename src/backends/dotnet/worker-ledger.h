/* Component-private CLR owner calls; never included by an installed C# client. */
#ifndef LB_CLR_WORKER_LEDGER_H
#define LB_CLR_WORKER_LEDGER_H
#include "host-frame.h"
#include "task-resource-ledger.h"
int lb_clr_worker_visit(lb_dn_frame *,int (*)(uint64_t));
lb_dn_frame *lb_clr_worker_frame(void);
int lb_clr_worker_create(const char *,lean_object *,uint64_t [2]);
lean_object *lb_clr_worker_borrow(const char *,const uint64_t [2]);
int lb_clr_worker_release(const char *,uint64_t [2]);
#ifndef LB_CLR_WORKER_LEDGER_IMPL
#undef LB_LEASE
#define LB_LEASE(op) lb_clr_worker_##op
#endif
#endif
