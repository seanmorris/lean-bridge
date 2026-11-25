/* Two compiled Lean closures retain the cursor. A scheduled pull returns a
   Task ticket; an immediate pull converts the element on the owning thread. */
#define LB_STREAM_NAME LB_COMPONENT ".pull-v1"
#define LB_STREAM_KIND "lean-bridge/pull-cursor-v1"
typedef lean_object *(*lb_cursor_op)(lean_object *);
typedef struct lb_cursor {
    lean_object *handle;
    lb_cursor_op next, close;
    PyObject *(*convert)(lean_object *);
    uint64_t lease;
    pid_t pid;
#ifdef LB_IMMEDIATE_CURSOR
    struct lb_cursor *pending;
#endif
} lb_cursor;
static void lb_cursor_drop(lb_cursor *s) {
    lean_object *h = s->handle;
    s->handle = NULL;
    if (!h || s->pid != getpid()) return;
    /* Never execute more user code on a retired runtime. Drop the owned reference. */
    if (lean_bridge_native_component_ready(LB_COMPONENT)) {
        lean_object *io = s->close(h);
        lean_dec(io);
    } else { lean_dec(h); }
    if (s->lease) lean_bridge_native_identity_release(s->lease, LB_STREAM_KIND, s);
}
#ifdef LB_IMMEDIATE_CURSOR
/* Reference-count finalization can happen on a different Python thread.
   Never enter application Lean code there. The GIL serializes the queue;
   owner operations and the interpreter shutdown hook also drain it if
   CPython's bounded pending-call queue is full. */
static lb_cursor *lb_pending_cursors;
static int lb_cursor_scheduled;
static int lb_cursor_drain(void *unused) {
    (void)unused;
    lb_cursor_scheduled=0;
    while (lb_pending_cursors) {
        lb_cursor *p=lb_pending_cursors; lb_pending_cursors=p->pending;
        lb_cursor_drop(p); free(p);
    }
    return 0;
}
static PyObject *lb_cursor_owner(PyObject *self, PyObject *unused) {
    (void)self; (void)unused;
    if (!lb_sync_owner()) return NULL;
    lb_cursor_drain(NULL); Py_RETURN_NONE;
}
#endif
static void lb_cursor_destroy(PyObject *cap) {
    lb_cursor *s = PyCapsule_GetPointer(cap, LB_STREAM_NAME);
#ifdef LB_IMMEDIATE_CURSOR
    if (s && s->handle && s->pid==getpid() && getpid()!=(pid_t)syscall(SYS_gettid)) {
        s->pending=lb_pending_cursors; lb_pending_cursors=s;
        if (!lb_cursor_scheduled && !Py_AddPendingCall(lb_cursor_drain,NULL)) lb_cursor_scheduled=1;
        return;
    }
#endif
    if (s) { lb_cursor_drop(s); free(s); }
}
static PyObject *lb_cursor_new(lean_object *h, lb_cursor_op next, lb_cursor_op close, PyObject *(*convert)(lean_object *)) {
    lean_mark_mt(h); lean_inc(h);
    lb_cursor *s = calloc(1, sizeof(*s));
    if (!s) { lean_object *io = close(h); lean_dec(io); return PyErr_NoMemory(); }
    s->handle = h; s->pid = getpid(); s->convert = convert; s->next = next; s->close = close;
    s->lease = lean_bridge_native_identity_acquire(LB_STREAM_KIND, s);
    if (!s->lease) {
        lb_cursor_drop(s); free(s); PyErr_SetString(PyExc_RuntimeError, "cannot retain Lean cursor"); return NULL;
    }
    PyObject *cap = PyCapsule_New(s, LB_STREAM_NAME, lb_cursor_destroy);
    if (!cap) { lb_cursor_drop(s); free(s); }
    return cap;
}
static PyObject *lb_cursor_next(PyObject *self, PyObject *cap) {
#ifdef LB_IMMEDIATE_CURSOR
    if (!lb_sync_owner()) return NULL;
#endif
    (void)self; lb_cursor *s = PyCapsule_GetPointer(cap, LB_STREAM_NAME);
    if (!s) return NULL;
    if (!s->handle || s->pid != getpid() || !lean_bridge_native_component_ready(LB_COMPONENT)) {
        PyErr_SetString(PyExc_RuntimeError, "closed or inherited Lean cursor"); return NULL;
    }
    lean_inc(s->handle);
    lean_object *io = s->next(s->handle);
    if (!lean_io_result_is_ok(io)) {
        lean_dec(io); PyErr_SetString(PyExc_RuntimeError, "Lean cursor could not start its pull"); return NULL;
    }
#ifdef LB_IMMEDIATE_CURSOR
    PyObject *result = s->convert(lean_io_result_get_value(io));
#else
    PyObject *result = lb_ticket_new(lean_io_result_get_value(io), s->convert);
#endif
    lean_dec(io); return result;
}
static PyObject *lb_cursor_close(PyObject *self, PyObject *cap) {
#ifdef LB_IMMEDIATE_CURSOR
    if (!lb_sync_owner()) return NULL;
#endif
    (void)self; lb_cursor *s = PyCapsule_GetPointer(cap, LB_STREAM_NAME);
    if (!s) return NULL;
    lb_cursor_drop(s); Py_RETURN_NONE;
}
static PyObject *lb_cursor_value(int item, PyObject *value) {
    if (!value) return NULL;
    PyObject *r = Py_BuildValue("(iO)", item, value); Py_DECREF(value); return r;
}
