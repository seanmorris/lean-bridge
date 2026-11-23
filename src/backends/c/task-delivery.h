/* Internal to one compiled component. The public C header never exposes a Lean
   pointer. Only the main thread owns the registry; Lean workers signal eventfd. */
#include <string.h>
#include <sys/syscall.h>
#if LB_SYNC_ONLY
#include <stdlib.h>
#include <unistd.h>
#include "lean_bridge_native_runtime.h"
#else
#include "task-notification.h"
#ifdef LB_RETAINED_TASKS
#include "task-callback-port.h"
#endif

typedef lean_object *(*lb_cursor_op)(lean_object *);
#ifdef LB_PUBLIC_C_CALLBACKS
typedef struct lb_c_owner lb_c_owner;
static void lb_c_detach(lb_c_owner *);
#endif
typedef struct lb_entry {
    struct lb_entry *next;
    uint64_t id;
    unsigned kind;
    lean_object *cursor;
    lb_cursor_op pull, close;
    lb_task_watch watch;
#ifdef LB_PUBLIC_C_CALLBACKS
    lb_c_owner *host;
#endif
#ifdef LB_RETAINED_TASKS
    lb_retained retained;
#endif
} lb_entry;
static lb_entry *lb_entries;
#define LB_OWNER_KIND LB_COMPONENT ".owner"
#endif
static uint64_t lb_domain;

#include "task-owner-policy.h"
static int lb_initialized_here;
static void *lb_init(uint8_t b) {
    lean_object *r = initialize_BridgeCAsync(b); lb_initialized_here = lean_io_result_is_ok(r); return r;
}
static LB(status) lb_prepare(void) {
    if (!lb_context()) return LB(WRONG_CONTEXT);
    if (!lean_bridge_native_component_initialize(LB_COMPONENT, lb_init) || !lb_initialized_here) return LB(UNAVAILABLE);
    if (!lb_domain) {
        lean_bridge_native_snapshot snapshot; lean_bridge_native_snapshot_read(&snapshot);
        lb_domain = snapshot.identity_domain_id;
    }
    return LB(OK);
}
#if !LB_SYNC_ONLY
static LB(status) lb_reserve(unsigned kind, lb_entry **out) {
    lb_entry *e = calloc(1, sizeof *e);
    if (!e) return LB(NO_MEMORY);
    e->kind = kind; e->id = lean_bridge_native_identity_acquire(LB_OWNER_KIND, e);
    if (!e->id) { free(e); return LB(UNAVAILABLE); }
    e->next = lb_entries; lb_entries = e; *out = e; return LB(OK);
}
static LB(status) lb_lookup(uint64_t id, uint64_t domain, unsigned kind, lb_entry **out, int cleanup) {
    if (!lb_context()) return LB(WRONG_CONTEXT);
    if (domain != lb_domain) return LB(CLOSED);
    for (lb_entry *e = lb_entries; e; e = e->next) if (id == e->id && kind == e->kind) {
        if (!cleanup && !lean_bridge_native_component_ready(LB_COMPONENT)) return LB(UNAVAILABLE);
        *out = e; return LB(OK);
    }
    return LB(CLOSED);
}
static void lb_drop(lb_entry *e) {
    lb_entry **slot = &lb_entries;
    while (*slot != e) slot = &(*slot)->next;
    *slot = e->next;
#ifdef LB_RETAINED_TASKS
    lb_retained_clear(&e->retained);
#endif
    lb_watch_close(&e->watch, 1);
    if (e->cursor) {
        /* Retirement allows release, not a fresh application effect. */
        if (lean_bridge_native_component_ready(LB_COMPONENT)) {
            lean_object *io = e->close(e->cursor); lean_dec(io);
        } else lean_dec(e->cursor);
    }
    lean_bridge_native_identity_release(e->id, LB_OWNER_KIND, e);
#ifdef LB_PUBLIC_C_CALLBACKS
    if (e->host) lb_c_detach(e->host);
#endif
    free(e);
}
static LB(status) lb_subscribe(lb_entry *e, lean_object *task) {
    if (!lb_watch_start(&e->watch, task)) return LB(OK);
    lean_io_cancel_core(task);
    return errno == ENOMEM ? LB(NO_MEMORY) : LB(UNAVAILABLE);
}
static LB(status) lb_request(uint64_t id, uint64_t domain, unsigned kind) {
    lb_entry *e; LB(status) s = lb_lookup(id, domain, kind, &e, 0);
    if (s != LB(OK)) return s;
    if (e->watch.source) return LB(BUSY);
    lean_inc(e->cursor); lean_object *io = e->pull(e->cursor);
    s = lean_io_result_is_ok(io) ? lb_subscribe(e, lean_io_result_get_value(io)) : LB(UNAVAILABLE);
    lean_dec(io);
    /* A failed subscription may already have advanced the cursor. No retry. */
    if (s != LB(OK)) lb_drop(e);
    return s;
}
static LB(status) lb_poll(uint64_t id, uint64_t domain, unsigned kind, int *fd) {
    if (!fd) return LB(INVALID);
    lb_entry *e; LB(status) s = lb_lookup(id, domain, kind, &e, 0);
    if (s != LB(OK)) return s;
    if (!e->watch.source) return LB(IDLE);
    if (lb_watch_ready(&e->watch)) { *fd = -1; return LB(OK); }
    *fd = lb_watch_fd(&e->watch); return LB(PENDING);
}
static LB(status) lb_close(uint64_t *id, uint64_t domain, unsigned kind) {
    if (!id) return LB(INVALID);
    lb_entry *e; LB(status) s = lb_lookup(*id, domain, kind, &e, 1);
    if (s == LB(OK)) { *id = 0; lb_drop(e); }
    return s;
}

#endif
static LB(status) lb_copy(LB(buffer) *out, const void *bytes, size_t n) {
    if (n > LB_MAX_BYTES) return LB(LIMIT);
    uint8_t *p = n ? malloc(n) : NULL;
    if (n && !p) return LB(NO_MEMORY);
    if (n) memcpy(p, bytes, n);
    *out = (LB(buffer)){p, n}; return LB(OK);
}
void LB(buffer_dispose)(LB(buffer) *b) { if (b) { free(b->data); *b = (LB(buffer)){0}; } }
static LB(status) lb_string(LB(buffer) *out, lean_object *v) {
    return lb_copy(out, lean_string_cstr(v), lean_string_size(v) - 1);
}
static LB(status) lb_bytes(LB(buffer) *out, lean_object *v) {
    return lb_copy(out, lean_sarray_cptr(v), lean_sarray_size(v));
}
static lean_object *lb_input_bytes(LB(view) v) {
    lean_object *a = lean_alloc_sarray(1, v.len, v.len);
    if (v.len) memcpy(lean_sarray_cptr(a), v.data, v.len);
    return a;
}
static int lb_utf8(LB(view) v) {
    size_t i = 0;
    while (i < v.len) {
        unsigned a = v.data[i++]; if (a < 128) continue;
        unsigned n = a < 224 ? 1 : a < 240 ? 2 : 3;
        if (a < 194 || a > 244 || n > v.len-i) return 0;
        unsigned b = v.data[i];
        if ((a == 224 && b < 160) || (a == 237 && b >= 160)
            || (a == 240 && b < 144) || (a == 244 && b >= 144)) return 0;
        while (n--) if ((v.data[i++] & 192) != 128) return 0;
    }
    return 1;
}
static LB(status) lb_io_failure(lean_object *io, LB(buffer) *message) {
    if (!message) return LB(IO_ERROR);
    lean_object *err = lean_io_result_get_error(io); lean_inc(err);
    lean_object *text = lb_c_error_text(err);
    LB(status) s = lb_string(message, text); lean_dec(text);
    return s == LB(OK) ? LB(IO_ERROR) : s;
}
