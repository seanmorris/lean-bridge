/* The handle contains two compiled Lean closures capturing the real cursor.
   Only the event-loop thread pulls; completed elements use the normal Task ticket. */
#define LB_STREAM_NAME LB_COMPONENT ".pull-v1"
#define LB_STREAM_KIND "lean-bridge/pull-cursor-v1"
typedef lean_object *(*lb_cursor_op)(lean_object *);
typedef struct {
    lean_object *handle;
    lb_cursor_op next, close;
    PyObject *(*convert)(lean_object *);
    uint64_t lease;
    pid_t pid;
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
static void lb_cursor_destroy(PyObject *cap) {
    lb_cursor *s = PyCapsule_GetPointer(cap, LB_STREAM_NAME);
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
    PyObject *ticket = lb_ticket_new(lean_io_result_get_value(io), s->convert);
    lean_dec(io); return ticket;
}
static PyObject *lb_cursor_close(PyObject *self, PyObject *cap) {
    (void)self; lb_cursor *s = PyCapsule_GetPointer(cap, LB_STREAM_NAME);
    if (!s) return NULL;
    lb_cursor_drop(s); Py_RETURN_NONE;
}
static PyObject *lb_cursor_value(int item, PyObject *value) {
    if (!value) return NULL;
    PyObject *r = Py_BuildValue("(iO)", item, value); Py_DECREF(value); return r;
}
