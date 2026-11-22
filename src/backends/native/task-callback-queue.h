/* Lean workers enqueue boxed inputs and promises, never host values. Use the
   owner thread for dispatch, and never call out or resolve under the mutex. */
typedef struct lb_req {
    struct lb_req *next;
    lean_object *arg, *promise;
    uint32_t slot;
} lb_req;
typedef struct {
    pthread_mutex_t lock;
    lb_req *head, *tail;
    size_t count;
    int fd;
    pid_t pid;
    unsigned long owner;
    uint64_t lease;
    int started;
    lean_object *inner;
} lb_port;
extern lean_object *lean_io_promise_resolve(lean_object *, lean_object *);
static void lb_cb_reply(lean_object *p, int ok, lean_object *v) {
    lean_object *e = lean_alloc_ctor(ok ? 1 : 0, 1, 0); lean_ctor_set(e, 0, v);
    lean_mark_mt(e); lean_dec(lean_io_promise_resolve(e, p)); lean_dec(p);
}
static void lb_cb_reject(lean_object *p, const char *reason) {
    lb_cb_reply(p, 0, lean_mk_io_user_error(lean_mk_string(reason)));
}
static void lb_cb_signal(int fd) {
    uint64_t one = 1;
    while (write(fd, &one, sizeof(one)) < 0 && errno == EINTR) {}
}
/* Even a factory that ignores cancellation and hands back a task late must
   cancel that inner task. The linearization point is the queue mutex. */
lean_object *LB_CB_TRACK(b_lean_obj_arg token, b_lean_obj_arg task) {
    lb_port *s = lean_get_external_data(token); lean_mark_mt(task); lean_inc(task);
    pthread_mutex_lock(&s->lock);
    int stopped = s->fd < 0;
    if (!stopped) s->inner = task;
    pthread_mutex_unlock(&s->lock);
    if (stopped) { lean_io_cancel_core(task); lean_dec(task); }
    return lean_box(0); /* BaseIO Unit returns Unit directly. */
}
lean_object *LB_CB_REQUEST(b_lean_obj_arg token, uint32_t slot, lean_obj_arg v, lean_obj_arg reply) {
    lb_port *s = lean_get_external_data(token); lb_req *q = malloc(sizeof(*q));
    const char *why = "retained callback request could not be allocated";
    if (q) {
        *q = (lb_req){NULL, v, reply, slot}; lean_mark_mt(v); lean_mark_mt(reply);
        pthread_mutex_lock(&s->lock);
        if (s->fd < 0) why = "retained callback has expired";
        else if (s->count >= 256) why = "retained callback queue is full";
        else {
            if (s->tail) s->tail->next = q; else s->head = q;
            s->tail = q; s->count++; lb_cb_signal(s->fd); q = NULL;
        }
        pthread_mutex_unlock(&s->lock);
        if (!q) return lean_box(0);
        free(q);
    }
    lean_dec(v); lb_cb_reject(reply, why); return lean_box(0);
}
static void lb_cb_stop(lb_port *s) {
    if (s->pid != getpid()) {
        /* No other pre-fork thread or Lean allocator survives in the child. */
        if (s->fd >= 0) { close(s->fd); s->fd = -1; }
        return;
    }
    pthread_mutex_lock(&s->lock);
    if (s->fd >= 0) { close(s->fd); s->fd = -1; }
    lb_req *q = s->head; s->head = s->tail = NULL; s->count = 0;
    uint64_t lease = s->lease; s->lease = 0;
    lean_object *t = s->inner; s->inner = NULL;
    pthread_mutex_unlock(&s->lock);
    if (t) { if (lean_io_get_task_state_core(t) != LEAN_TASK_STATE_FINISHED) lean_io_cancel_core(t); lean_dec(t); }
    while (q) {
        lb_req *next = q->next; lean_dec(q->arg);
        lb_cb_reject(q->promise, "retained callback has expired"); free(q); q = next;
    }
    if (lease) lean_bridge_native_identity_release(lease, LB_PORT_KIND, s);
}
static void lb_cb_finalize(void *v) {
    lb_port *s = v; lb_cb_stop(s);
    if (s->pid != getpid()) return;
    pthread_mutex_destroy(&s->lock); free(s);
}
static void lb_cb_visit(void *v, b_lean_obj_arg f) { (void)v; (void)f; }
static lean_external_class *lb_port_class;
static pthread_once_t lb_port_once = PTHREAD_ONCE_INIT;
static void lb_cb_register(void) { lb_port_class = lean_register_external_class(lb_cb_finalize, lb_cb_visit); }
static int lb_cb_new(unsigned long owner, int flags, lean_object **out) {
    lb_port *s = calloc(1, sizeof(*s)); if (!s) return ENOMEM;
    s->pid = getpid(); s->owner = owner;
    s->fd = eventfd(0, flags | EFD_NONBLOCK | EFD_CLOEXEC);
    if (s->fd < 0) { int e = errno; free(s); return e; }
    int err = pthread_mutex_init(&s->lock, NULL);
    if (err) { close(s->fd); free(s); return err; }
    s->lease = lean_bridge_native_identity_acquire(LB_PORT_KIND, s);
    if (!s->lease) { pthread_mutex_destroy(&s->lock); close(s->fd); free(s); return EBUSY; }
    pthread_once(&lb_port_once, lb_cb_register);
    *out = lean_alloc_external(lb_port_class, s); lean_mark_mt(*out);
    return 0;
}
static lb_req *lb_cb_pop(lb_port *s) {
    pthread_mutex_lock(&s->lock);
    lb_req *q = s->head;
    if (q) { s->head = q->next; if (!s->head) s->tail = NULL; s->count--; }
    pthread_mutex_unlock(&s->lock); return q;
}
