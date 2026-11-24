/* Owner-agent only. The domain (including its current public call) belongs
   to the shared heap; this header defines no component-local global state. */
#ifndef LEAN_BRIDGE_JS_HOST_ERRORS_H
#define LEAN_BRIDGE_JS_HOST_ERRORS_H
#include <lean/lean.h>
#include <stdlib.h>
#if !defined(__wasm32__) || !defined(__EMSCRIPTEN__) || defined(__EMSCRIPTEN_PTHREADS__)
#error JavaScript exception frames require the owning wasm32 agent
#endif
typedef struct lb_jsh_error_row {
    struct lb_jsh_error_row *next;
    lean_object *identity;
    uint32_t token;
} lb_jsh_error_row;
typedef struct lb_jsh_error_scope {
    struct lb_jsh_error_scope *parent;
    lb_jsh_error_row *rows;
} lb_jsh_error_scope;
typedef struct {
    lb_jsh_error_scope *active;
    void (*discard)(uint32_t);
} lb_jsh_error_domain;
static inline void lb_jsh_errors_enter(lb_jsh_error_domain *d, lb_jsh_error_scope *scope) {
    scope->parent=d->active; scope->rows=NULL; d->active=scope;
}
/* Called while Lean still owns the freshly built IO.Error. Only the exact
   object can authorize recovery of a JS exception, never its text or tag. */
static inline int lb_jsh_errors_remember(lb_jsh_error_domain *d, b_lean_obj_arg error, uint32_t token) {
    if (!d->active || !token || !error || lean_is_scalar(error)) return 0;
    lb_jsh_error_row **p=&d->active->rows;
    while (*p) {
        lb_jsh_error_row *r=*p;
        if (!lean_is_exclusive(r->identity)) { p=&r->next; continue; }
        /* The frame is the sole remaining owner: Lean has already discarded
           this error. Long loops catching exceptions do not retain history. */
        *p=r->next; d->discard(r->token); lean_dec(r->identity); free(r);
    }
    lb_jsh_error_row *r=malloc(sizeof(*r));
    if (!r) return 0; /* caller still owns token */
    lean_inc(error); r->identity=error; r->token=token;
    r->next=d->active->rows; d->active->rows=r;
    return 1;
}
/* Remove the frame before dropping pins. Return ownership of at most one
   token to the caller, which consumes it after Wasm has unwound. */
static inline uint32_t lb_jsh_errors_leave(lb_jsh_error_domain *d, lb_jsh_error_scope *scope, b_lean_obj_arg escaped) {
    if (d->active!=scope) abort();
    d->active=scope->parent;
    uint32_t matched=0;
    while (scope->rows) {
        lb_jsh_error_row *r=scope->rows; scope->rows=r->next;
        if (escaped && r->identity==escaped && !matched) matched=r->token;
        else d->discard(r->token);
        lean_dec(r->identity); free(r);
    }
    return matched;
}
#endif
