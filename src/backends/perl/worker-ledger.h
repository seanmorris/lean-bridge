/* Private to one CPAN component and its XS. No SV or Perl interpreter
   pointer crosses this interface. The worker itself holds only Lean refs. */
#ifndef LBP_WORKER_LEDGER_H
#define LBP_WORKER_LEDGER_H
#include "task-resource-ledger.h"
#ifndef LBP_WORKER_PREFIX
#error "A scoped Perl worker component prefix is required"
#endif
#define LBP_WORKER(op) LB_JOIN(LBP_WORKER_PREFIX,op)
int LBP_WORKER(begin)(void);
int LBP_WORKER(end)(void);
int LBP_WORKER(create)(const char *,lean_object *,uint64_t [2]);
lean_object *LBP_WORKER(borrow)(const char *,const uint64_t [2]);
int LBP_WORKER(release)(const char *,uint64_t [2]);
#ifndef LBP_WORKER_BROKER_IMPL
#undef LB_LEASE
#define LB_LEASE(op) LBP_WORKER(op)
#endif
#endif
