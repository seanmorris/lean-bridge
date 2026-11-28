/* Internal ABI of the optional, content-addressed resource DSO. No Lean
   pointer or dispatch function is part of the installed application header. */
#ifndef LB_TASK_RESOURCE_LEDGER_H
#define LB_TASK_RESOURCE_LEDGER_H
#include <lean/lean.h>
#include <stdint.h>
#define LB_JOIN_RAW(a,b) a##b
#define LB_JOIN(a,b) LB_JOIN_RAW(a,b)
#define LB_LEASE(op) LB_JOIN(LB_LEASE_PREFIX,op)
enum { LB_LEASE_OK, LB_LEASE_CLOSED, LB_LEASE_UNAVAILABLE, LB_LEASE_MEMORY };
int LB_LEASE(create)(const char *kind, lean_object *value, uint64_t out[2]);
lean_object *LB_LEASE(borrow)(const char *kind, const uint64_t handle[2]);
int LB_LEASE(release)(const char *kind, uint64_t handle[2]);
#endif
