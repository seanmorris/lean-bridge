/* Main-thread C11 callback ownership. A lease ticket is distinct from the
   callable and from the task that retains it. Never hold a registry entry
   across user code: a callback or destructor can close its own task. */
#include <sys/epoll.h>
#pragma weak lean_bridge_native_retirement_watch
#pragma weak lean_bridge_native_retirement_unwatch
typedef struct lb_c_closure lb_c_closure;
struct lb_c_closure {
    unsigned refs, active, kind;
    int open;
    void *context;
    void (*dispose)(void *);
    LB(status) (*call)(lb_c_closure *, lb_c_owner *);
};
typedef struct lb_c_ticket {
    struct lb_c_ticket *next;
    uint64_t id;
    lb_c_closure *closure;
} lb_c_ticket;
static lb_c_ticket *lb_c_tickets;
#define LB_CALLBACK_KIND LB_COMPONENT ".callback-ticket"
static void lb_c_dispose_context(lb_c_closure *c) {
    void (*dispose)(void *) = c->dispose; void *ctx = c->context;
    c->dispose = NULL; c->context = NULL; if (dispose) dispose(ctx);
}
static void lb_c_release(lb_c_closure *c) {
    if (!--c->refs) { lb_c_dispose_context(c); free(c); }
}
static LB(status) lb_c_ticket_new(lb_c_closure *c, uint64_t out[2]) {
    lb_c_ticket *t = calloc(1, sizeof *t); if (!t) return LB(NO_MEMORY);
    t->id = lean_bridge_native_identity_acquire(LB_CALLBACK_KIND, t);
    if (!t->id) { free(t); return LB(UNAVAILABLE); }
    t->closure = c; c->refs++; t->next = lb_c_tickets; lb_c_tickets = t;
    out[0] = t->id; out[1] = lb_domain; return LB(OK);
}
static lb_c_ticket **lb_c_find(const uint64_t key[2], unsigned kind) {
    if (key[1] == lb_domain && key[0]) for (lb_c_ticket **t = &lb_c_tickets; *t; t = &(*t)->next)
        if ((*t)->id == key[0] && (*t)->closure->kind == kind) return t;
    return NULL;
}
static LB(status) lb_c_clone(const uint64_t key[2], unsigned kind, uint64_t out[2]) {
    if (!lb_context()) return LB(WRONG_CONTEXT);
    if (!out || out[0] || out[1]) return LB(INVALID);
    lb_c_ticket **t = lb_c_find(key, kind); if (!t || !(*t)->closure->open) return LB(CLOSED);
    if (!lean_bridge_native_component_ready(LB_COMPONENT)) return LB(UNAVAILABLE);
    return lb_c_ticket_new((*t)->closure, out);
}
static LB(status) lb_c_remove(uint64_t key[2], unsigned kind, int revoke) {
    if (!lb_context()) return LB(WRONG_CONTEXT);
    if (!key) return LB(INVALID);
    lb_c_ticket **slot = lb_c_find(key, kind); if (!slot) return LB(CLOSED);
    lb_c_ticket *t = *slot; *slot = t->next;
    lb_c_closure *c = t->closure;
    key[0] = key[1] = 0; lean_bridge_native_identity_release(t->id, LB_CALLBACK_KIND, t); free(t);
    if (revoke && c->open) { c->open = 0; if (!c->active) lb_c_dispose_context(c); }
    lb_c_release(c); return LB(OK);
}
static int lb_c_error_empty(const LB(callback_error) *e) {
    return e && !e->code && !e->message.data && !e->message.len && !e->payload && !e->dispose_payload;
}
void LB(callback_error_dispose)(LB(callback_error) *e) {
    if (!e) return;
    LB(callback_error) saved = *e; *e = (LB(callback_error)){0};
    LB(buffer_dispose)(&saved.message); if (saved.dispose_payload) saved.dispose_payload(saved.payload);
}
typedef struct { LB(callback_error) error; LB(status) status; } lb_c_failure;
struct lb_c_owner {
    lb_entry *entry;
    unsigned refs, slots, running, failure_count, capacity;
    size_t message_bytes;
    int pollfd, retirement;
    LB(status) fault;
    lb_c_failure *failures;
    lb_c_closure *callbacks[];
};
static void lb_c_unref(lb_c_owner *o) {
    if (--o->refs) return;
    if (o->pollfd >= 0) close(o->pollfd);
    if (o->retirement >= 0) lean_bridge_native_retirement_unwatch();
    for (unsigned i = 0; i < o->slots; i++) if (o->callbacks[i]) lb_c_release(o->callbacks[i]);
    for (unsigned i = 0; i < o->failure_count; i++) LB(callback_error_dispose)(&o->failures[i].error);
    free(o->failures); free(o);
}
static void lb_c_detach(lb_c_owner *o) { o->entry = NULL; lb_c_unref(o); }
static int lb_c_subscribe_fd(int aggregate, int fd) {
    struct epoll_event event = {.events = EPOLLIN};
    int code; do { code = epoll_ctl(aggregate, EPOLL_CTL_ADD, fd, &event); } while (code < 0 && errno == EINTR);
    return code == 0;
}
static LB(status) lb_c_new(unsigned slots, lb_c_owner **out) {
    LB(status) s = lb_prepare(); if (s != LB(OK)) return s;
    /* Old installed native brokers can still serve callback-free functions.
       Refuse a retained start if retirement cannot wake its poll descriptor. */
    if (!lean_bridge_native_retirement_watch || !lean_bridge_native_retirement_unwatch) return LB(UNAVAILABLE);
    lb_c_owner *o = calloc(1, sizeof *o + slots * sizeof(o->callbacks[0])); if (!o) return LB(NO_MEMORY);
    o->refs = 1; o->slots = slots; o->retirement = -1; o->pollfd = epoll_create1(EPOLL_CLOEXEC);
    if (o->pollfd < 0 || (o->retirement = lean_bridge_native_retirement_watch()) < 0 ||
        !lb_c_subscribe_fd(o->pollfd, o->retirement)) { lb_c_unref(o); return LB(UNAVAILABLE); }
    *out = o; return LB(OK);
}
static LB(status) lb_c_bind(lb_c_owner *o, unsigned slot, const uint64_t key[2], unsigned kind) {
    lb_c_ticket **t = lb_c_find(key, kind); if (!t || !(*t)->closure->open) return LB(CLOSED);
    o->callbacks[slot] = (*t)->closure; (*t)->closure->refs++; return LB(OK);
}
static LB(status) lb_c_attach(lb_c_owner *o, uint64_t id, unsigned kind) {
    lb_entry *e; LB(status) s = lb_lookup(id, lb_domain, kind, &e, 0); if (s != LB(OK)) return s;
    int completion = lb_watch_fd(&e->watch);
    lb_port *p = lean_get_external_data(e->retained.token);
    if (!lb_c_subscribe_fd(o->pollfd, p->fd) || (completion >= 0 && !lb_c_subscribe_fd(o->pollfd, completion))) return LB(UNAVAILABLE);
    o->entry = e; e->host = o; o->refs++; return LB(OK);
}
static LB(status) lb_c_record(lb_c_owner *o, LB(callback_error) *err, LB(status) why) {
    if (o->failure_count == 4096 || err->message.len > LB_MAX_BYTES - o->message_bytes) return LB(LIMIT);
    if (o->capacity == o->failure_count) {
        unsigned n = o->capacity ? o->capacity * 2 : 4;
        lb_c_failure *v = realloc(o->failures, n * sizeof *v); if (!v) return LB(NO_MEMORY);
        o->failures = v; o->capacity = n;
    }
    uint32_t id; LB(status) s = lb_retained_failure(&o->entry->retained, (LB(view)){err->message.data, err->message.len}, &id);
    if (s != LB(OK)) return s;
    if (id != o->failure_count + 1) return LB(UNAVAILABLE);
    o->message_bytes += err->message.len; o->failures[o->failure_count++] = (lb_c_failure){*err, why};
    *err = (LB(callback_error)){0}; return LB(OK);
}
static LB(status) lb_c_invoke(lb_c_owner *o, unsigned slot) {
    if (slot >= o->slots || !o->callbacks[slot]) return LB(UNAVAILABLE);
    lb_c_closure *c = o->callbacks[slot];
    if (!c->open) {
        static const char msg[] = "retained callback is closed";
        LB(callback_error) error = {0}; LB(status) s = lb_copy(&error.message, msg, sizeof(msg)-1);
        if (s == LB(OK)) s = lb_c_record(o, &error, LB(CALLBACK_CLOSED));
        LB(callback_error_dispose)(&error); return s;
    }
    c->active++; LB(status) s = c->call(c, o); c->active--;
    if (!c->open && !c->active) lb_c_dispose_context(c);
    return s;
}
/* Bound work per pump so one producer cannot monopolize a GUI/event loop.
   Native workers signal requests; the main thread alone invokes C code. */
static LB(status) lb_c_drive(lb_c_owner *o, int *fd) {
    if (o->running) return LB(BUSY);
    o->running = 1;
    LB(status) s = LB(OK);
    for (unsigned i = 0; i < 16; i++) {
        if (o->fault != LB(OK) || !lean_bridge_native_component_ready(LB_COMPONENT) || lb_watch_ready(&o->entry->watch)) break;
        uint32_t slot; s = lb_retained_next(&o->entry->retained, &slot);
        if (s == LB(PENDING)) { s = LB(OK); break; }
        if (s == LB(OK)) s = lb_c_invoke(o, slot);
        if (!o->entry) break;
        if (s != LB(OK)) { o->fault = s; lb_retained_clear(&o->entry->retained); o->entry->retained = (lb_retained){0};
            lb_watch_close(&o->entry->watch, 1); break; }
    }
    o->running = 0;
    if (!o->entry) return LB(CLOSED);
    if (o->fault != LB(OK) || !lean_bridge_native_component_ready(LB_COMPONENT) || lb_watch_ready(&o->entry->watch)) {
        *fd = -1; return LB(OK);
    }
    /* Recheck any stale level-triggered event left after draining requests. */
    struct epoll_event events[3]; int count;
    do { count = epoll_wait(o->pollfd, events, 3, 0); } while (count < 0 && errno == EINTR);
    if (count < 0) return LB(UNAVAILABLE);
    *fd = o->pollfd; return LB(PENDING);
}
static LB(status) lb_c_poll(uint64_t id, uint64_t domain, unsigned kind, int *fd) {
    if (!fd) return LB(INVALID);
    lb_entry *e; LB(status) s = lb_lookup(id, domain, kind, &e, 1);
    if (s != LB(OK)) return s;
    lb_c_owner *o = e->host; o->refs++; s = lb_c_drive(o, fd); lb_c_unref(o); return s;
}
