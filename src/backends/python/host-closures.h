/* Private to one generated extension. The binding owns the Lean references;
   a capsule is only the ticket for a particular entry signature. Python may
   GC the ticket on another thread. Only its binding owner calls lean_dec. */
typedef struct lb_py_closure {
    struct lb_py_closure *next, **prev;
    lb_session *owner;
    lean_object *fn;
    size_t signature;
    int abandoned;
} lb_py_closure;
static _Thread_local lb_py_closure *lb_closures;
static _Thread_local int lb_closures_closing;
/* Accessed with the GIL, including by a ticket abandoned by another thread. */
static size_t lb_abandoned;

static void lb_closure_detach(lb_py_closure *v) {
    *v->prev = v->next;
    if (v->next) v->next->prev = v->prev;
    lean_object *fn = v->fn;
    v->fn = NULL; v->owner = NULL; v->prev = NULL; v->next = NULL;
    lean_dec(fn);
}
static void lb_closures_collect(int all) {
    if (!all && !lb_abandoned) return;
    lb_py_closure *v = lb_closures;
    while (v) {
        lb_py_closure *next = v->next;
        if (v->abandoned || all) {
            lb_closure_detach(v);
            if (v->abandoned) { lb_abandoned--; free(v); }
        }
        v = next;
    }
}
static void lb_closure_gc(PyObject *cap) {
    lb_py_closure *v = PyCapsule_GetPointer(cap, LB_COMPONENT ".closure-v1");
    if (!v) return;
    if (!v->fn) { free(v); return; }
    if (lb_active() && v->owner == lb_current) {
        PyObject *et = NULL, *ev = NULL, *tb = NULL;
        PyErr_Fetch(&et, &ev, &tb);
        lb_current->depth++;
        lb_closure_detach(v); free(v);
        lb_sweep(); lb_current->depth--;
        PyErr_Restore(et, ev, tb);
    } else { v->abandoned = 1; lb_abandoned++; }
}
static PyObject *lb_closure_new(size_t signature, lean_object *fn) {
    if (!lb_active() || lb_closures_closing) {
        PyErr_SetString(PyExc_RuntimeError, "Lean callable needs an open host binding"); return NULL;
    }
    lb_py_closure *v = calloc(1, sizeof(*v));
    if (!v) return PyErr_NoMemory();
    PyObject *cap = PyCapsule_New(v, LB_COMPONENT ".closure-v1", lb_closure_gc);
    if (!cap) { free(v); return NULL; }
    lean_inc(fn);
    *v = (lb_py_closure){ .next=lb_closures, .prev=&lb_closures, .fn=fn, .owner=lb_current, .signature=signature };
    if (lb_closures) lb_closures->prev = &v->next;
    lb_closures = v;
    return cap;
}
static lb_py_closure *lb_closure_ticket(PyObject *cap) {
    if (!PyCapsule_IsValid(cap, LB_COMPONENT ".closure-v1") || PyCapsule_GetDestructor(cap) != lb_closure_gc) {
        PyErr_SetString(PyExc_TypeError, "foreign Lean callable"); return NULL;
    }
    return PyCapsule_GetPointer(cap, LB_COMPONENT ".closure-v1");
}
static lean_object *lb_closure_borrow(size_t signature, PyObject *cap) {
    lb_py_closure *v = lb_closure_ticket(cap);
    if (!v) return NULL;
    if (!v->fn || !lb_active() || v->owner != lb_current || lb_closures_closing) {
        PyErr_SetString(PyExc_RuntimeError, "stale or foreign Lean callable binding"); return NULL;
    }
    if (v->signature != signature) { PyErr_SetString(PyExc_TypeError, "wrong Lean callable signature"); return NULL; }
    /* Self-close revokes future calls. This invocation has its own Lean ref. */
    lean_inc(v->fn); return v->fn;
}
static PyObject *lb_closure_closed(PyObject *mod, PyObject *cap) {
    (void)mod;
    lb_py_closure *v = lb_closure_ticket(cap);
    return v ? PyBool_FromLong(v->fn == NULL) : NULL;
}
static PyObject *lb_closure_close(PyObject *mod, PyObject *cap) {
    (void)mod;
    lb_py_closure *v = lb_closure_ticket(cap);
    if (!v) return NULL;
    if (v->fn) {
        if (!lb_active() || v->owner != lb_current) {
            PyErr_SetString(PyExc_RuntimeError, "cannot close a Lean callable from another owner"); return NULL;
        }
        lb_current->depth++;
        lb_closure_detach(v); lb_sweep();
        lb_current->depth--;
    }
    Py_RETURN_NONE;
}
