/* Private ABI between generated MRI extensions and their shared Lean host domain. */
#ifndef LB_RUBY_HOST_DOMAIN_H
#define LB_RUBY_HOST_DOMAIN_H
#include <ruby.h>
#include <lean/lean.h>
#include <stddef.h>
typedef struct lb_rh_session lb_rh_session;
typedef struct lb_rh_fault lb_rh_fault;
typedef struct { lb_rh_fault *faults; lb_rh_session *session; } lb_rh_frame;
typedef struct { const char *id; int strong; } lb_rh_spec;
void lb_rh_owner(void);
lb_rh_session *lb_rh_bind(const lb_rh_spec *, size_t, int, const VALUE *);
void lb_rh_unbind(lb_rh_session **);
void lb_rh_enter(lb_rh_session *, lb_rh_frame *);
void lb_rh_leave(lb_rh_frame *);
VALUE lb_rh_type(lb_rh_session *, unsigned);
VALUE lb_rh_object(lb_rh_session *, unsigned, lean_object *);
lean_object *lb_rh_wrap(lb_rh_session *, unsigned, VALUE, VALUE anchor);
lean_object *lb_rh_admit(lean_object *wrapper);
lean_object *lb_rh_fault_result(lb_rh_frame *, int state);
VALUE lb_rh_original(lb_rh_frame *, lean_object *error);
size_t lb_rh_live(void);
#endif
