/* Private per-component CPython ticket. No Python references cross to Lean
   worker threads. Finalization and explicit cancellation share one close. */
#define LB_TICKET_NAME LB_COMPONENT ".task-v1"
#include <sys/epoll.h>
typedef struct { lb_task_watch w; PyObject *(*convert)(lean_object *); int gate; } lb_py_ticket;
static void lb_ticket_unwatch(lb_py_ticket *t) {
    if (t->gate < 0) return;
    close(t->gate); t->gate = -1;
    if (t->w.pid == getpid()) lean_bridge_native_retirement_unwatch();
}
static void lb_ticket_destroy(PyObject *capsule) {
    lb_py_ticket *t = PyCapsule_GetPointer(capsule, LB_TICKET_NAME);
    if (t) { lb_ticket_unwatch(t); lb_watch_close(&t->w, 1); free(t); }
}
static PyObject *lb_ticket_new(lean_object *source, PyObject *(*convert)(lean_object *)) {
    lb_py_ticket *t = calloc(1, sizeof(*t));
    if (!t) { lean_io_cancel_core(source); return PyErr_NoMemory(); }
    t->convert = convert; t->gate = -1;
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
    if (!t) return NULL;
    if (t->gate < 0) {
        /* asyncio keeps only one reader per fd. Each pending wait gets its own
           pollable gate so simultaneous waiters (also in other components)
           can observe the SAME level-triggered retirement fd without replacing
           each other's callbacks. Neither read nor close the broker's fd. */
        int source = lb_watch_fd(&t->w), retired = lean_bridge_native_retirement_watch();
        if (retired < 0) { PyErr_SetString(PyExc_RuntimeError, "Lean runtime is no longer available"); return NULL; }
        int gate = epoll_create1(EPOLL_CLOEXEC);
        struct epoll_event event = {.events = EPOLLIN};
        if (gate < 0 || epoll_ctl(gate, EPOLL_CTL_ADD, source, &event) < 0 ||
            epoll_ctl(gate, EPOLL_CTL_ADD, retired, &event) < 0) {
            int err = errno;
            if (gate >= 0) close(gate);
            lean_bridge_native_retirement_unwatch(); errno = err;
            return PyErr_SetFromErrno(PyExc_OSError);
        }
        t->gate = gate;
    }
    return PyLong_FromLong(t->gate);
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
    /* The Python owner unregisters its reader before releasing this fd. */
    lb_ticket_unwatch(t); lb_watch_close(&t->w, 1); Py_RETURN_NONE;
}
