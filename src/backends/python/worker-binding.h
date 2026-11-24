/* Per-component, interpreter-owned generation. The shared nominal table can
   survive an unbind through a peer component; delivery ownership must not. */
static _Thread_local PyObject *lb_worker_cookie;
typedef struct {
    PyObject *binding;
    PyCapsule_Destructor release;
} lb_worker_tag;

static int lb_worker_active(void) {
    if (lb_worker_cookie && lb_active()) return 1;
    PyErr_SetString(PyExc_RuntimeError, "Python worker requires its active host binding"); return 0;
}
static void lb_worker_drop(PyObject *cap) {
    lb_worker_tag *tag = PyCapsule_GetContext(cap);
    if (!tag) return;
    tag->release(cap);
    Py_DECREF(tag->binding); free(tag);
}
/* Same ownership rule as PyCapsule_New: the caller still owns the payload
   on failure. Its original destructor runs exactly once on success. */
static PyObject *lb_worker_cap(void *payload, const char *name, PyCapsule_Destructor release) {
    if (!lb_worker_active()) return NULL;
    lb_worker_tag *tag = malloc(sizeof(*tag)); if (!tag) return PyErr_NoMemory();
    *tag = (lb_worker_tag){Py_NewRef(lb_worker_cookie), release};
    PyObject *cap = PyCapsule_New(payload, name, NULL);
    if (!cap || PyCapsule_SetContext(cap, tag) < 0 || PyCapsule_SetDestructor(cap, lb_worker_drop) < 0) {
        Py_XDECREF(cap); Py_DECREF(tag->binding); free(tag); return NULL;
    }
    return cap;
}
static int lb_worker_matches(PyObject *cap) {
    if (!lb_worker_active()) return 0;
    if (PyCapsule_CheckExact(cap) && PyCapsule_GetDestructor(cap) == lb_worker_drop) {
        lb_worker_tag *tag = PyCapsule_GetContext(cap);
        if (tag && tag->binding == lb_worker_cookie) return 1;
    }
    PyErr_SetString(PyExc_RuntimeError, "stale or foreign Python worker binding"); return 0;
}
/* Keep the current class table alive through every Python callback, including
   __del__ during conversion. Sweep with the GIL and restore the original error. */
static PyObject *lb_worker_dispatch(PyCFunction fn, PyObject *mod, PyObject *args, PyObject *cap) {
    if (cap ? !lb_worker_matches(cap) : !lb_worker_active()) return NULL;
    lb_current->depth++;
    PyObject *v = fn(mod,args), *et = NULL, *ev = NULL, *tb = NULL;
    if (!v) PyErr_Fetch(&et,&ev,&tb);
    lb_sweep(); lb_current->depth--;
    if (!v) PyErr_Restore(et,ev,tb);
    return v;
}
