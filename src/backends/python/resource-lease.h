/* Opaque, non-constructible CPython leases over the verified native ledger.
   Compatible components intern one type per Lean source identity in the main
   interpreter. The GIL protects the registry/queue; only the owner enters Lean. */
#include "task-resource-ledger.h"
#include <sys/syscall.h>
#include <unistd.h>
typedef struct lb_py_slot {
    const char *kind, *component;
    uint64_t handle[2];
    struct lb_py_slot *next;
} lb_py_slot;
typedef struct { PyObject *types; lb_py_slot *pending; pid_t pid; } lb_py_pool;
typedef struct {
    PyObject_HEAD
    PyObject *registry; lb_py_pool *pool; lb_py_slot *slot;
    const char *kind;
} lb_py_resource;

static int lb_owner_thread(void) {
    return getpid() == (pid_t)syscall(SYS_gettid) && lean_bridge_native_process_valid()
        && PyThreadState_GetInterpreter(PyThreadState_Get()) == PyInterpreterState_Main();
}
static void lb_drop_slot(lb_py_slot *s, int release) {
    if (release) LB_LEASE(release)(s->kind, s->handle);
    free(s);
}
static void lb_drain_slots(lb_py_pool *p, int release) {
    while (p->pending) {
        lb_py_slot *s = p->pending; p->pending = s->next; lb_drop_slot(s, release);
    }
}
static void lb_pool_destroy(PyObject *capsule) {
    lb_py_pool *p = PyCapsule_GetPointer(capsule, LB_PY_LEASE_ABI);
    if (p) {
        lb_drain_slots(p, p->pid == getpid() && lb_owner_thread());
        Py_DECREF(p->types); free(p);
    }
}
/* Borrowed reference from the private interpreter dictionary, not sys.modules. */
static PyObject *lb_registry(void) {
    PyInterpreterState *interp = PyThreadState_GetInterpreter(PyThreadState_Get());
    if (interp != PyInterpreterState_Main() || !lean_bridge_native_process_valid()) {
        PyErr_SetString(PyExc_RuntimeError, "Lean resources require the original main interpreter"); return NULL;
    }
    PyObject *dict = PyInterpreterState_GetDict(interp);
    if (!dict) return PyErr_NoMemory();
    PyObject *cap = PyDict_GetItemString(dict, LB_PY_LEASE_ABI);
    if (cap) return cap;
    lb_py_pool *p = calloc(1, sizeof(*p)); if (!p) return PyErr_NoMemory();
    p->pid = getpid(); p->types = PyDict_New();
    if (!p->types) { free(p); return NULL; }
    cap = PyCapsule_New(p, LB_PY_LEASE_ABI, lb_pool_destroy);
    if (!cap) { Py_DECREF(p->types); free(p); return NULL; }
    int ok = PyDict_SetItemString(dict, LB_PY_LEASE_ABI, cap); Py_DECREF(cap);
    return ok == 0 ? cap : NULL;
}
static int lb_resource_owner(lb_py_pool *p) {
    if (!lb_owner_thread() || p->pid != getpid()) {
        PyErr_SetString(PyExc_RuntimeError, "Lean resources require the original process main thread"); return 0;
    }
    lb_drain_slots(p, 1); return 1;
}
static int lb_resource_context(void) {
    PyObject *cap = lb_registry();
    lb_py_pool *p = cap ? PyCapsule_GetPointer(cap, LB_PY_LEASE_ABI) : NULL;
    return p && lb_resource_owner(p);
}
static void lb_resource_destroy(PyObject *self) {
    lb_py_resource *r = (lb_py_resource *)self;
    if (r->slot) {
        if (r->pool->pid != getpid()) lb_drop_slot(r->slot, 0);
        else if (lb_owner_thread()) lb_drop_slot(r->slot, 1);
        else { r->slot->next = r->pool->pending; r->pool->pending = r->slot; }
    }
    Py_XDECREF(r->registry);
    PyTypeObject *type = Py_TYPE(self); type->tp_free(self); Py_DECREF(type);
}
static lean_object *lb_resource_live(lb_py_resource *r) {
    if (!lb_resource_owner(r->pool)) return NULL;
    if (!r->slot) { PyErr_SetString(PyExc_ValueError, "closed Lean resource"); return NULL; }
    if (!lean_bridge_native_component_ready(r->slot->component)) {
        PyErr_SetString(PyExc_RuntimeError, "Lean runtime is no longer available"); return NULL;
    }
    lean_object *v = LB_LEASE(borrow)(r->kind, r->slot->handle);
    if (!v) PyErr_SetString(PyExc_ValueError, "stale or foreign Lean resource");
    return v;
}
static PyObject *lb_resource_issue(PyTypeObject *type, const char *kind, const char *component,
                                   PyObject *cap, lb_py_pool *p, lean_object *v) {
    lb_py_resource *r = (lb_py_resource *)type->tp_alloc(type, 0);
    if (!r) return NULL;
    r->pool = p; r->registry = Py_NewRef(cap); r->kind = kind;
    lb_py_slot *s = calloc(1, sizeof(*s));
    if (!s) { Py_DECREF(r); return PyErr_NoMemory(); }
    int status = LB_LEASE(create)(kind, v, s->handle);
    if (status != LB_LEASE_OK) {
        free(s); Py_DECREF(r);
        if (status == LB_LEASE_MEMORY) return PyErr_NoMemory();
        PyErr_SetString(PyExc_RuntimeError, "could not issue Lean resource lease"); return NULL;
    }
    s->kind = kind; s->component = component; r->slot = s;
    return (PyObject *)r;
}
static PyObject *lb_resource_close(PyObject *self, PyObject *unused) {
    lb_py_resource *r = (lb_py_resource *)self;
    if (!lb_resource_owner(r->pool)) return NULL;
    lb_py_slot *s = r->slot; r->slot = NULL; if (s) lb_drop_slot(s, 1);
    Py_RETURN_NONE;
}
static PyObject *lb_resource_closed(PyObject *self, void *unused) {
    lb_py_resource *r = (lb_py_resource *)self;
    return lb_resource_owner(r->pool) ? PyBool_FromLong(!r->slot) : NULL;
}
static PyObject *lb_resource_kind(PyObject *self, void *unused) {
    return PyUnicode_FromString(((lb_py_resource *)self)->kind);
}
static PyObject *lb_resource_retain(PyObject *self, PyObject *unused) {
    lb_py_resource *r = (lb_py_resource *)self; lean_object *v = lb_resource_live(r);
    return v ? lb_resource_issue(Py_TYPE(self), r->kind, r->slot->component, r->registry, r->pool, v) : NULL;
}
static PyObject *lb_resource_same(PyObject *self, PyObject *other) {
    if (Py_TYPE(other) != Py_TYPE(self)) { PyErr_SetString(PyExc_TypeError, "different nominal Lean resource"); return NULL; }
    lean_object *a = lb_resource_live((lb_py_resource *)self); if (!a) return NULL;
    lean_object *b = lb_resource_live((lb_py_resource *)other); return b ? PyBool_FromLong(a == b) : NULL;
}
static PyObject *lb_resource_enter(PyObject *self, PyObject *unused) {
    return lb_resource_live((lb_py_resource *)self) ? Py_NewRef(self) : NULL;
}
static PyMethodDef lb_resource_methods[] = {
    {"close", lb_resource_close, METH_NOARGS, NULL}, {"retain", lb_resource_retain, METH_NOARGS, NULL},
    {"same_resource", lb_resource_same, METH_O, NULL}, {"__enter__", lb_resource_enter, METH_NOARGS, NULL},
    {"__exit__", lb_resource_close, METH_VARARGS, NULL}, {NULL}
};
static PyGetSetDef lb_resource_props[] = {
    {"closed", lb_resource_closed, NULL, NULL, NULL}, {"_lean_resource_kind", lb_resource_kind, NULL, NULL, NULL}, {NULL}
};
static PyType_Slot lb_resource_slots[] = {
    {Py_tp_dealloc, lb_resource_destroy}, {Py_tp_methods, lb_resource_methods}, {Py_tp_getset, lb_resource_props}, {0, NULL}
};
static int lb_resource_register(PyObject *module, const char *kind, const char *name, const char *qualified) {
    PyObject *cap = lb_registry(); if (!cap) return -1;
    lb_py_pool *p = PyCapsule_GetPointer(cap, LB_PY_LEASE_ABI); if (!p) return -1;
    PyObject *type = PyDict_GetItemString(p->types, kind);
    if (!type) {
        PyType_Spec spec = {qualified, sizeof(lb_py_resource), 0,
            Py_TPFLAGS_DEFAULT | Py_TPFLAGS_IMMUTABLETYPE | Py_TPFLAGS_DISALLOW_INSTANTIATION, lb_resource_slots};
        type = PyType_FromSpec(&spec); if (!type) return -1;
        int result = PyDict_SetItemString(p->types, kind, type); Py_DECREF(type); if (result < 0) return -1;
    }
    return PyModule_AddObjectRef(module, name, type);
}
static lean_object *lb_resource_arg(const char *kind, PyObject *value, int materialize) {
    PyObject *cap = lb_registry(); if (!cap) return NULL;
    lb_py_pool *p = PyCapsule_GetPointer(cap, LB_PY_LEASE_ABI); if (!p) return NULL;
    if ((PyObject *)Py_TYPE(value) != PyDict_GetItemString(p->types, kind)) {
        PyErr_SetString(PyExc_TypeError, "expected the exact Lean resource type"); return NULL;
    }
    lean_object *v = lb_resource_live((lb_py_resource *)value);
    if (!v || !materialize) return v ? lean_box(0) : NULL;
    lean_inc(v); return v;
}
static PyObject *lb_resource_value(const char *kind, lean_object *value) {
    PyObject *cap = lb_registry(); if (!cap) return NULL;
    lb_py_pool *p = PyCapsule_GetPointer(cap, LB_PY_LEASE_ABI);
    if (!p || !lb_resource_owner(p)) return NULL;
    PyObject *type = PyDict_GetItemString(p->types, kind);
    if (!type) { PyErr_SetString(PyExc_RuntimeError, "unregistered Lean resource kind"); return NULL; }
    return lb_resource_issue((PyTypeObject *)type, kind, LB_COMPONENT, cap, p, value);
}
static PyObject *lb_matches_ledger(PyObject *self, PyObject *addr) {
    void *address = PyLong_AsVoidPtr(addr);
    return !address && PyErr_Occurred() ? NULL : PyBool_FromLong(address == (void *)&LB_LEASE(borrow));
}
