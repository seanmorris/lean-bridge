/* Component-local ledger membership. The underlying native broker still owns
   the Lean reference and issues the non-reusable token. Only the owner calls
   these entry points. A worker sees neither a token nor this table. */
#ifndef LB_RUBY_WORKER_LEDGER_H
#define LB_RUBY_WORKER_LEDGER_H
#include "task-resource-ledger.h"
void lb_ruby_worker_begin(void);
void lb_ruby_worker_end(void);
int lb_ruby_worker_create(const char *,lean_object *,uint64_t [2]);
lean_object *lb_ruby_worker_borrow(const char *,const uint64_t [2]);
int lb_ruby_worker_release(const char *,uint64_t [2]);
#ifndef LB_RUBY_WORKER_LEDGER_IMPL
#undef LB_LEASE
#define LB_LEASE(op) lb_ruby_worker_##op
#endif
#endif
