/* Private C reference operations used by generated providers, never installed as the client API. */
#ifndef LB_C_HOST_REGISTRY_H
#define LB_C_HOST_REGISTRY_H
#include <stddef.h>
#include <stdint.h>
#ifndef LB_C_REF_PREFIX
#error "Select the runtime-qualified C host reference ABI"
#endif
#define LB_CR_JOIN_(a,b) a##b
#define LB_CR_JOIN(a,b) LB_CR_JOIN_(a,b)
#define LB_CR(n) LB_CR_JOIN(LB_C_REF_PREFIX,n)
#define LB_CR_API __attribute__((visibility("default")))
typedef void (*lb_cr_fn)(void);
typedef void (*lb_cr_dispose)(lb_cr_fn,void *);
typedef struct { uint64_t domain, ticket; } lb_cr_ref;
enum { CR_OK=0, CR_INVALID=1, CR_STALE=2, CR_LIMIT=3, CR_UNAVAILABLE=4 };
/* Ownership transfers to the registry on success only. Re-adopting the same
 * live object yields a new owner, not a second destructor. */
LB_CR_API int LB_CR(adopt)(const char *,void *,lb_cr_fn,lb_cr_dispose,lb_cr_ref *);
LB_CR_API int LB_CR(clone)(const char *,lb_cr_ref,lb_cr_ref *);
LB_CR_API int LB_CR(drop)(const char *,lb_cr_ref *);
LB_CR_API int LB_CR(same)(const char *,lb_cr_ref,lb_cr_ref,int *);
LB_CR_API int LB_CR(get)(const char *,lb_cr_ref,void **);
LB_CR_API int LB_CR(lift)(const char *,uint64_t,lb_cr_ref *);
LB_CR_API int LB_CR(binding)(const char *,void *,lb_cr_fn,lb_cr_dispose,lb_cr_ref *);
LB_CR_API int LB_CR(binding_get)(const char *,lb_cr_ref,void **);
LB_CR_API int LB_CR(binding_drop)(const char *,lb_cr_ref *);
LB_CR_API int LB_CR(refop)(uint64_t,const char *const *,size_t,int,const uint64_t *,size_t,uint64_t *);
#endif
