/* Included privately in generated CPython providers. No handle crosses the public API.
   Python objects are released with the GIL, never by a Lean finalizer/worker. */
#define PY_SSIZE_T_CLEAN
#include <Python.h>
#include <lean/lean.h>
#include <stdint.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>

typedef struct lb_kind lb_kind;
typedef struct lb_value {
    struct lb_value *next;
    lb_kind *kind;
    lean_object *wrapper; /* the registry's single reference */
    PyObject *object, *anchors;
} lb_value;
struct lb_kind {
    lb_kind *next;
    char *name;
    PyObject *type;
    unsigned users;
    int strong;
    lb_value *values;
};
typedef struct {
    PyInterpreterState *interp;
    lean_external_class *cls;
    lb_kind *kinds;
    unsigned sessions;
    unsigned long thread;
    pid_t pid;
} lb_domain;
typedef struct {
    lb_domain *domain;
    unsigned depth;
    lb_kind **kinds;
    size_t count;
} lb_session;
typedef struct { const char *name; int strong; } lb_spec;
static _Thread_local lb_session *lb_current;
typedef struct lb_fault {
    struct lb_fault *next;
    lean_object *error;
    PyObject *type, *value, *trace;
} lb_fault;
typedef struct lb_frame { struct lb_frame *outer; lb_fault *faults; } lb_frame;
static _Thread_local lb_frame *lb_call_frame;
static void lb_frame_close(lb_frame *f) {
    lb_call_frame = f->outer;
    while (f->faults) {
        lb_fault *p = f->faults; f->faults = p->next;
        lean_dec(p->error); Py_XDECREF(p->type); Py_XDECREF(p->value); Py_XDECREF(p->trace); free(p);
    }
}
static int lb_restore_fault(lean_object *error) {
    for (lb_fault *p = lb_call_frame->faults; p; p = p->next) if (p->error == error) {
        PyErr_Restore(Py_XNewRef(p->type), Py_XNewRef(p->value), Py_XNewRef(p->trace)); return 1;
    }
    return 0;
}

static void lb_finalize(void *p) { free(p); }
static void lb_visit(void *p, b_lean_obj_arg f) { (void)p; (void)f; }
static lean_object *lb_fail(const char *s) {
    return lean_io_result_mk_error(lean_mk_io_user_error(lean_mk_string(s)));
}
static lean_object *lb_python_error(void) {
    PyObject *t = NULL, *e = NULL, *tb = NULL;
    PyErr_Fetch(&t, &e, &tb); PyErr_NormalizeException(&t, &e, &tb);
    PyObject *s = e ? PyObject_Str(e) : NULL;
    Py_ssize_t n = 0;
    const char *msg = s ? PyUnicode_AsUTF8AndSize(s, &n) : NULL;
    lean_object *text = msg ? lean_mk_string_from_bytes(msg, n) : lean_mk_string("Python host call failed");
    lean_object *error = lean_mk_io_user_error(text);
    lb_fault *p = (lb_call_frame && t && e) ? malloc(sizeof(*p)) : NULL;
    if (p) {
        lean_inc(error); *p = (lb_fault){ lb_call_frame->faults, error, t, e, tb }; lb_call_frame->faults = p;
    } else { Py_XDECREF(tb); Py_XDECREF(e); Py_XDECREF(t); }
    Py_XDECREF(s); PyErr_Clear();
    return lean_io_result_mk_error(error);
}
static int lb_active(void) {
    return lb_current && lb_current->domain->pid == getpid() && PyGILState_Check()
        && PyThreadState_GetInterpreter(PyThreadState_Get()) == lb_current->domain->interp;
}

/* Unlink and invalidate all selected entries before running any Python destructor.
   A destructor can make another call or return the same object to the registry. */
static void lb_clean(lb_kind *k, int all) {
    if (!all && k->strong) return;
    lb_value *dead = NULL, **slot = &k->values;
    while (*slot) {
        lb_value *v = *slot;
        /* A value kept in an IO.Ref can become multi-thread marked even in a
           synchronous program. -1 is its last atomic reference, not a leak. */
        int refs = atomic_load_explicit(lean_get_rc_mt_addr(v->wrapper), memory_order_acquire);
        if (all || refs == -1 || refs == 1) {
            *slot = v->next; v->kind = NULL; v->next = dead; dead = v;
        } else slot = &v->next;
    }
    while (dead) {
        lb_value *v = dead; dead = v->next;
        Py_CLEAR(v->object); Py_CLEAR(v->anchors); lean_dec(v->wrapper);
    }
}
static void lb_sweep(void) {
    for (size_t i = 0; i < lb_current->count; i++) lb_clean(lb_current->kinds[i], 0);
}
static void lb_destroy_domain(PyObject *cap) {
    lb_domain *d = PyCapsule_GetPointer(cap, "lean-bridge.python-host.v1");
    if (!d || d->pid != getpid() || d->sessions) return;
    free(d);
}
static lb_domain *lb_get_domain(const char *runtime) {
    PyInterpreterState *interp = PyThreadState_GetInterpreter(PyThreadState_Get());
    PyObject *dict = PyInterpreterState_GetDict(interp);
    if (!dict) { PyErr_SetString(PyExc_RuntimeError, "Python interpreter has no state dictionary"); return NULL; }
    char key[160];
    PyOS_snprintf(key, sizeof(key), "lean-bridge.python-host.v1.%s.%p", runtime, (void *)&lean_register_external_class);
    PyObject *cap = PyDict_GetItemString(dict, key);
    if (cap) {
        lb_domain *d = PyCapsule_GetPointer(cap, "lean-bridge.python-host.v1");
        if (d && d->pid != getpid()) { PyErr_SetString(PyExc_RuntimeError, "inherited Lean host runtime"); return NULL; }
        return d;
    }
    lb_domain *d = calloc(1, sizeof(*d));
    if (!d) { PyErr_NoMemory(); return NULL; }
    d->interp = interp; d->pid = getpid();
    d->cls = lean_register_external_class(lb_finalize, lb_visit);
    cap = PyCapsule_New(d, "lean-bridge.python-host.v1", lb_destroy_domain);
    if (!cap) { free(d); return NULL; }
    int ok = PyDict_SetItemString(dict, key, cap); Py_DECREF(cap);
    return ok == 0 ? d : NULL;
}
static void lb_release_kind(lb_domain *d, lb_kind *k) {
    if (--k->users) return;
    lb_kind **slot = &d->kinds;
    while (*slot != k) slot = &(*slot)->next;
    *slot = k->next;
    lb_clean(k, 1); Py_DECREF(k->type); free(k->name); free(k);
}
static int lb_bind(const lb_spec *specs, size_t count, PyObject *types, const char *runtime) {
    if (lb_current) { PyErr_SetString(PyExc_RuntimeError, "component already has a host binding"); return -1; }
    if (!PyTuple_Check(types) || PyTuple_GET_SIZE(types) != (Py_ssize_t)count) {
        PyErr_SetString(PyExc_TypeError, "wrong number of host classes"); return -1;
    }
    lb_domain *d = lb_get_domain(runtime);
    if (!d) return -1;
    unsigned long thread = PyThread_get_thread_ident();
    if (d->thread && d->thread != thread) {
        PyErr_SetString(PyExc_RuntimeError, "Lean host binding belongs to another thread"); return -1;
    }
    lb_session *s = calloc(1, sizeof(*s));
    if (!s || !(s->kinds = calloc(count, sizeof(lb_kind *)))) { free(s); PyErr_NoMemory(); return -1; }
    s->domain = d;
    for (size_t i = 0; i < count; i++) {
        PyObject *type = PyTuple_GET_ITEM(types, i);
        if (!PyType_Check(type)) { PyErr_SetString(PyExc_TypeError, "bind_hosts requires a Python class"); goto bad; }
        lb_kind *k = d->kinds;
        while (k && strcmp(k->name, specs[i].name)) k = k->next;
        if (k && (k->type != type || k->strong != specs[i].strong)) {
            PyErr_SetString(PyExc_TypeError, "incompatible binding for the same nominal host kind"); goto bad;
        }
        if (!k) {
            k = calloc(1, sizeof(*k));
            if (!k || !(k->name = strdup(specs[i].name))) { free(k); PyErr_NoMemory(); goto bad; }
            k->type = Py_NewRef(type); k->strong = specs[i].strong; k->next = d->kinds; d->kinds = k;
        }
        k->users++; s->kinds[s->count++] = k;
    }
    d->sessions++; d->thread = thread; lb_current = s; return 0;
bad:
    while (s->count) lb_release_kind(d, s->kinds[--s->count]);
    free(s->kinds); free(s); return -1;
}
static int lb_unbind(void) {
    if (!lb_active() || lb_current->depth) {
        PyErr_SetString(PyExc_RuntimeError, "cannot close an inactive, foreign or executing host binding"); return -1;
    }
    lb_session *s = lb_current; lb_current = NULL;
    for (size_t i = 0; i < s->count; i++) lb_release_kind(s->domain, s->kinds[i]);
    s->domain->sessions--; free(s->kinds); free(s); return 0;
}
static PyObject *lb_host_arg(size_t i, lean_object *wrapper) {
    if (!lean_is_scalar(wrapper) && lean_is_external(wrapper)
        && lean_get_external_class(wrapper) == lb_current->domain->cls) {
        lb_value *v = lean_get_external_data(wrapper);
        if (v->kind == lb_current->kinds[i] && v->object) return Py_NewRef(v->object);
    }
    PyErr_SetString(PyExc_TypeError, "wrong, stale or foreign host object"); return NULL;
}
static lean_object *lb_host_result(size_t i, PyObject *object, PyObject *anchor) {
    lb_kind *k = lb_current->kinds[i];
    if (!PyType_IsSubtype(Py_TYPE(object), (PyTypeObject *)k->type)) {
        PyErr_SetString(PyExc_TypeError, "host member returned the wrong nominal type"); return NULL;
    }
    lb_value *v = k->values;
    while (v && v->object != object) v = v->next;
    if (!v) {
        v = calloc(1, sizeof(*v));
        if (!v) { PyErr_NoMemory(); return NULL; }
        v->object = Py_NewRef(object); v->kind = k;
        v->wrapper = lean_alloc_external(lb_current->domain->cls, v); v->next = k->values; k->values = v;
    }
    if (anchor && anchor != object) {
        if (!v->anchors && !(v->anchors = PyList_New(0))) return NULL;
        Py_ssize_t j = 0;
        while (j < PyList_GET_SIZE(v->anchors) && PyList_GET_ITEM(v->anchors, j) != anchor) j++;
        if (j == PyList_GET_SIZE(v->anchors) && PyList_Append(v->anchors, anchor)) return NULL;
    }
    lean_inc(v->wrapper); return v->wrapper;
}
