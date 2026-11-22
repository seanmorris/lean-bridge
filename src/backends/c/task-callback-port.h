/* Native owner side shared by the C, C++ and Rust task adapters. No host
   callable runs on a Lean worker. */
#define LB_PORT_KIND LB_COMPONENT ".callback-port-v1"
#define LB_CB_REQUEST lb_c_cb_request
#define LB_CB_TRACK lb_c_cb_track
#include "task-callback-queue.h"

typedef struct {
    lean_object *token;
    lb_req *active;
    lean_object **pins;
    uint32_t count, capacity;
} lb_retained;
static void lb_retained_clear(lb_retained *r) {
    if (!r->token) return;
    lb_cb_stop(lean_get_external_data(r->token));
    if (r->active) {
        lean_dec(r->active->arg);
        lb_cb_reject(r->active->promise, "retained callback has expired");
        free(r->active);
    }
    for (uint32_t i = 0; i < r->count; i++) lean_dec(r->pins[i]);
    free(r->pins); lean_dec(r->token);
}
static LB(status) lb_retained_next(lb_retained *r, uint32_t *slot) {
    if (!r->token || !slot) return LB(INVALID);
    if (r->active) return LB(BUSY);
    lb_port *p = lean_get_external_data(r->token);
    uint64_t token; ssize_t n;
    do { n = read(p->fd, &token, sizeof(token)); } while (n < 0 && errno == EINTR);
    if (n < 0 && errno == EAGAIN) return LB(PENDING);
    if (n != sizeof(token) || !(r->active = lb_cb_pop(p))) return LB(UNAVAILABLE);
    *slot = r->active->slot; return LB(OK);
}
static void lb_retained_reply(lb_retained *r, int ok, lean_object *v) {
    lb_req *q = r->active; r->active = NULL;
    lean_dec(q->arg); lb_cb_reply(q->promise, ok, v); free(q);
}
/* Pin the exact IO.Error until this invocation closes. An equal message, a
   caught error or an error belonging to another invocation is not a match. */
static int lb_utf8(LB(view));
static LB(status) lb_retained_failure(lb_retained *r, LB(view) msg, uint32_t *id) {
    if (!r->active || !id || (msg.len && !msg.data)) return LB(INVALID);
    if (msg.len > LB_MAX_BYTES || r->count == 4096) return LB(LIMIT);
    if (!lb_utf8(msg)) return LB(INVALID);
    if (r->count == r->capacity) {
        uint32_t cap = r->capacity ? r->capacity * 2 : 8;
        lean_object **p = realloc(r->pins, (size_t)cap * sizeof(*p));
        if (!p) return LB(NO_MEMORY);
        r->pins = p; r->capacity = cap;
    }
    lean_object *e = lean_mk_io_user_error(lean_mk_string_from_bytes(msg.len ? (const char *)msg.data : "", msg.len));
    lean_mark_mt(e); lean_inc(e); r->pins[r->count++] = e; *id = r->count;
    lb_retained_reply(r, 0, e); return LB(OK);
}
static uint32_t lb_retained_origin(const lb_retained *r, lean_object *v) {
    for (uint32_t i = 0; i < r->count; i++) if (r->pins[i] == v) return i + 1;
    return 0;
}
