typedef struct { PyObject *(*in)(lean_object *); lean_object *(*out)(PyObject *); } lb_codec;
static const lb_codec *lb_cb_codec(uint32_t slot);
static void lb_cb_destroy(PyObject *cap) {
    lean_object *o = PyCapsule_GetPointer(cap, LB_PORT_NAME);
    if (o) { lb_port *s = lean_get_external_data(o); lb_cb_stop(s); if (s->pid == getpid()) lean_dec(o); }
}
static PyObject *lb_cb_open(PyObject *mod, PyObject *unused) {
    (void)mod; (void)unused; if (!lb_prepare()) return NULL;
    lean_object *o = NULL; int err = lb_cb_new(PyThread_get_thread_ident(), 0, &o);
    if (err == ENOMEM) return PyErr_NoMemory();
    if (err == EBUSY) { PyErr_SetString(PyExc_RuntimeError, "cannot lease callback port"); return NULL; }
    if (err) { errno = err; return PyErr_SetFromErrno(PyExc_OSError); }
    PyObject *cap = PyCapsule_New(o, LB_PORT_NAME, lb_cb_destroy); if (!cap) lean_dec(o);
    return cap;
}
static lean_object *lb_cb_token(PyObject *cap) {
    lean_object *o = PyCapsule_GetPointer(cap, LB_PORT_NAME); if (!o) return NULL;
    lb_port *s = lean_get_external_data(o);
    if (s->pid != getpid() || s->owner != PyThread_get_thread_ident() || s->fd < 0) {
        PyErr_SetString(PyExc_RuntimeError, "closed, foreign-thread or inherited callback port"); return NULL;
    }
    if (!lean_bridge_native_component_ready(LB_COMPONENT)) {
        PyErr_SetString(PyExc_RuntimeError, "Lean callback runtime is no longer available"); return NULL;
    }
    return o;
}
static PyObject *lb_cb_fd(PyObject *mod, PyObject *cap) {
    (void)mod; lean_object *o = lb_cb_token(cap);
    return o ? PyLong_FromLong(((lb_port *)lean_get_external_data(o))->fd) : NULL;
}
static lean_object *lb_cb_start_token(PyObject *cap) {
    lean_object *o = lb_cb_token(cap); if (!o) return NULL;
    lb_port *s = lean_get_external_data(o);
    if (s->started) { PyErr_SetString(PyExc_RuntimeError, "callback port already in use"); return NULL; }
    s->started = 1; return o;
}
static PyObject *lb_cb_close(PyObject *mod, PyObject *cap) {
    (void)mod; lean_object *o = PyCapsule_GetPointer(cap, LB_PORT_NAME); if (!o) return NULL;
    lb_port *s = lean_get_external_data(o);
    if (s->pid == getpid() && s->owner != PyThread_get_thread_ident()) {
        PyErr_SetString(PyExc_RuntimeError, "callback port belongs to another thread"); return NULL;
    }
    lb_cb_stop(s); Py_RETURN_NONE;
}
/* The dictionary is GC-visible. Its private capsule pins the exact IO.Error
   object, so neither equal text nor address reuse can impersonate a callback. */
typedef struct { lean_object *value; pid_t pid; } lb_error_pin;
static void lb_cb_unpin(PyObject *cap) {
    lb_error_pin *p = PyCapsule_GetPointer(cap, LB_PORT_NAME ".error");
    if (p) { if (p->pid == getpid()) lean_dec(p->value); free(p); }
}
static lean_object *lb_cb_fault(PyObject *faults) {
    PyObject *t = NULL, *e = NULL, *tb = NULL;
    PyErr_Fetch(&t, &e, &tb); PyErr_NormalizeException(&t, &e, &tb);
    if (e && tb && PyException_SetTraceback(e, tb) < 0) PyErr_Clear();
    PyObject *str = e ? PyObject_Str(e) : NULL; Py_ssize_t n = 0;
    const char *msg = str ? PyUnicode_AsUTF8AndSize(str, &n) : NULL;
    lean_object *v = lean_mk_io_user_error(msg ? lean_mk_string_from_bytes(msg, n) : lean_mk_string("Python callback failed"));
    Py_XDECREF(str); PyErr_Clear(); lean_mark_mt(v);
    lb_error_pin *pin = malloc(sizeof(*pin));
    PyObject *cap = NULL, *key = NULL, *record = NULL;
    if (pin && e) {
        *pin = (lb_error_pin){v, getpid()}; lean_inc(v);
        cap = PyCapsule_New(pin, LB_PORT_NAME ".error", lb_cb_unpin);
        if (!cap) { lean_dec(v); free(pin); }
        if (cap) key = PyLong_FromVoidPtr(v);
        if (key) record = PyTuple_Pack(2, e, cap);
        if (record && PyDict_SetItem(faults, key, record) < 0) Py_CLEAR(record);
    } else { free(pin); PyErr_NoMemory(); }
    Py_XDECREF(record); Py_XDECREF(key); Py_XDECREF(cap);
    Py_XDECREF(tb); Py_XDECREF(e); Py_XDECREF(t); return v;
}
static PyObject *lb_cb_drain(PyObject *mod, PyObject *args) {
    (void)mod; PyObject *cap, *callbacks, *faults;
    if (!PyArg_ParseTuple(args, "OO!O!", &cap, &PyDict_Type, &callbacks, &PyDict_Type, &faults)) return NULL;
    lean_object *o = lb_cb_token(cap); if (!o) return NULL; lb_port *s = lean_get_external_data(o);
    uint64_t count; while (read(s->fd, &count, sizeof(count)) < 0 && errno == EINTR) {}
    /* Bounded batches leave loop time for cancellation and other ready tasks. */
    for (unsigned i = 0; i < 16; i++) {
        /* A callback in the preceding batch slot can itself retire the runtime. */
        if (!lean_bridge_native_component_ready(LB_COMPONENT)) {
            PyErr_SetString(PyExc_RuntimeError, "Lean callback runtime is no longer available"); return NULL;
        }
        lb_req *q = lb_cb_pop(s);
        if (!q) break;
        PyObject *key = PyLong_FromUnsignedLong(q->slot);
        PyObject *f = key ? PyDict_GetItemWithError(callbacks, key) : NULL;
        const lb_codec *codec = lb_cb_codec(q->slot);
        if (!f || !codec) { if (!PyErr_Occurred()) PyErr_SetString(PyExc_RuntimeError, "unknown retained callback"); }
        PyObject *arg = f && codec ? codec->in(q->arg) : NULL;
        PyObject *value = arg ? PyObject_CallOneArg(f, arg) : NULL;
        lean_object *v = value ? codec->out(value) : NULL;
        int ok = v != NULL;
#ifdef LB_SCOPED_CALLBACKS
        /* Only a thrown application Exception belongs to the declared Lean IO
           channel. Codec failures and BaseException interrupt this operation,
           even when the producer catches IO.Error and returns a fallback. */
        if (!ok && (!arg || value || !PyErr_ExceptionMatches(PyExc_Exception))) {
            v = lean_mk_io_user_error(lean_mk_string("Python callback boundary failed"));
        } else
#endif
        if (!ok && PyDict_Size(faults) >= 4096) {
            PyErr_SetString(PyExc_RuntimeError, "retained callback exception budget exceeded");
            v = lean_mk_io_user_error(lean_mk_string("retained callback exception budget exceeded"));
        } else if (!ok) v = lb_cb_fault(faults);
        Py_XDECREF(value); Py_XDECREF(arg); Py_XDECREF(key);
        lean_dec(q->arg); lb_cb_reply(q->promise, ok, v); free(q);
        if (PyErr_Occurred()) return NULL;
    }
    pthread_mutex_lock(&s->lock); if (s->head && s->fd >= 0) lb_cb_signal(s->fd); pthread_mutex_unlock(&s->lock);
    Py_RETURN_NONE;
}
