/* Component-private synchronous reverse-call ABI. No managed reference or
   native pointer is part of the consumer API. Calls stay on the Lean owner. */
#ifndef LB_DOTNET_HOST_FRAME_H
#define LB_DOTNET_HOST_FRAME_H
#include <lean/lean.h>
#include <stddef.h>
#include <stdint.h>
typedef int (*lb_dn_dispatch)(uint64_t call, int32_t slot, const uint64_t *args,
                              size_t arity, uint64_t *out, uint32_t *fault);
typedef struct lb_dn_frame {
    struct lb_dn_frame *parent;
    struct lb_dn_fault *faults;
    lb_dn_dispatch dispatch;
    uint64_t call;
    int fatal;
    void (*retire)(void);
} lb_dn_frame;
enum { LB_DN_OK=0, LB_DN_ERROR=1, LB_DN_FATAL=2, LB_DN_WRONG_THREAD=9 };
int lb_dn_enter(lb_dn_frame *, uint64_t, lb_dn_dispatch, void (*retire)(void));
void lb_dn_leave(lb_dn_frame *);
/* NULL = success (three result words); otherwise returns an owned Lean IO error. */
lean_object *lb_dn_member(int32_t, const uint64_t *, size_t, uint64_t *);
uint32_t lb_dn_original(lb_dn_frame *, b_lean_obj_arg);
#endif
