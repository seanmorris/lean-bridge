/* Private per-component CPython ticket. No Python references cross to Lean
   worker threads. Finalization and explicit cancellation share one close. */
#define LB_TICKET_NAME LB_COMPONENT ".task-v1"
typedef struct { lb_task_watch w; PyObject *(*convert)(lean_object *); } lb_py_ticket;
static void lb_ticket_destroy(PyObject *capsule) {
    lb_py_ticket *t = PyCapsule_GetPointer(capsule, LB_TICKET_NAME);
    if (t) { lb_watch_close(&t->w, 1); free(t); }
}
static PyObject *lb_ticket_new(lean_object *source, PyObject *(*convert)(lean_object *)) {
    lb_py_ticket *t = calloc(1, sizeof(*t));
    if (!t) { lean_io_cancel_core(source); return PyErr_NoMemory(); }
    t->convert = convert;
    if (lb_watch_start(&t->w, source)) {
        int err = errno; lean_io_cancel_core(source); free(t);
        errno = err; return PyErr_SetFromErrno(PyExc_OSError);
    }
    PyObject *cap = PyCapsule_New(t, LB_TICKET_NAME, lb_ticket_destroy);
    if (!cap) { lb_watch_close(&t->w, 1); free(t); }
    return cap;
}
static lb_py_ticket *lb_live_ticket(PyObject *cap) {
    lb_py_ticket *t = PyCapsule_GetPointer(cap, LB_TICKET_NAME);
    if (t && (!t->w.source || t->w.pid != getpid())) {
        PyErr_SetString(PyExc_RuntimeError, "closed or inherited Lean task"); return NULL;
    }
    if (t && !lean_bridge_native_component_ready(LB_COMPONENT)) {
        PyErr_SetString(PyExc_RuntimeError, "Lean runtime is no longer available"); return NULL;
    }
    return t;
}
static PyObject *lb_task_ready(PyObject *self, PyObject *cap) {
    (void)self; lb_py_ticket *t = lb_live_ticket(cap);
    return t ? PyBool_FromLong(lb_watch_ready(&t->w)) : NULL;
}
static PyObject *lb_task_descriptor(PyObject *self, PyObject *cap) {
    (void)self; lb_py_ticket *t = lb_live_ticket(cap);
    return t ? PyLong_FromLong(lb_watch_fd(&t->w)) : NULL;
}
static PyObject *lb_task_take(PyObject *self, PyObject *cap) {
    (void)self; lb_py_ticket *t = lb_live_ticket(cap);
    if (!t) return NULL;
    if (!lb_watch_ready(&t->w)) { PyErr_SetString(PyExc_RuntimeError, "Lean task is not finished"); return NULL; }
    PyObject *value = t->convert(lean_task_get(t->w.source));
    lb_watch_close(&t->w, 0);
    return value;
}
static PyObject *lb_task_close(PyObject *self, PyObject *cap) {
    (void)self; lb_py_ticket *t = PyCapsule_GetPointer(cap, LB_TICKET_NAME);
    if (!t) return NULL;
    lb_watch_close(&t->w, 1); Py_RETURN_NONE;
}
