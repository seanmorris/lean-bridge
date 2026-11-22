/* Python owns the event-loop reader, the callables and the exception dictionary.
   Workers see only a Lean external token, boxed values and IO promises. Never
   resolve a promise, call host code, or run a destructor under the queue lock. */
#define LB_PORT_NAME LB_COMPONENT ".callback-port-v1"
#define LB_PORT_KIND "lean-bridge/python-callback-port-v1"
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
typedef struct { PyObject *(*in)(lean_object *); lean_object *(*out)(PyObject *); } lb_codec;
static const lb_codec *lb_cb_codec(uint32_t slot);
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
lean_object *lb_py_cb_track(b_lean_obj_arg token, b_lean_obj_arg task) {
    lb_port *s = lean_get_external_data(token); lean_mark_mt(task); lean_inc(task);
    pthread_mutex_lock(&s->lock);
    int stopped = s->fd < 0;
    if (!stopped) s->inner = task;
    pthread_mutex_unlock(&s->lock);
    if (stopped) { lean_io_cancel_core(task); lean_dec(task); }
    return lean_io_result_mk_ok(lean_box(0));
}
lean_object *lb_py_cb_request(b_lean_obj_arg token, uint32_t slot, lean_obj_arg v, lean_obj_arg reply) {
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
        if (!q) return lean_io_result_mk_ok(lean_box(0));
        free(q);
    }
    lean_dec(v); lb_cb_reject(reply, why); return lean_io_result_mk_ok(lean_box(0));
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
static void lb_cb_destroy(PyObject *cap) {
    lean_object *o = PyCapsule_GetPointer(cap, LB_PORT_NAME);
    if (o) { lb_port *s = lean_get_external_data(o); lb_cb_stop(s); if (s->pid == getpid()) lean_dec(o); }
}
static PyObject *lb_cb_open(PyObject *mod, PyObject *unused) {
    (void)mod; (void)unused; if (!lb_prepare()) return NULL;
    lb_port *s = calloc(1, sizeof(*s)); if (!s) return PyErr_NoMemory();
    s->pid = getpid(); s->owner = PyThread_get_thread_ident();
    s->fd = eventfd(0, EFD_NONBLOCK | EFD_CLOEXEC);
    if (s->fd < 0) { free(s); return PyErr_SetFromErrno(PyExc_OSError); }
    int err = pthread_mutex_init(&s->lock, NULL);
    if (err) { close(s->fd); free(s); errno = err; return PyErr_SetFromErrno(PyExc_OSError); }
    s->lease = lean_bridge_native_identity_acquire(LB_PORT_KIND, s);
    if (!s->lease) { pthread_mutex_destroy(&s->lock); close(s->fd); free(s); PyErr_SetString(PyExc_RuntimeError, "cannot lease callback port"); return NULL; }
    pthread_once(&lb_port_once, lb_cb_register);
    lean_object *o = lean_alloc_external(lb_port_class, s); lean_mark_mt(o);
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
        pthread_mutex_lock(&s->lock);
        lb_req *q = s->head;
        if (q) { s->head = q->next; if (!s->head) s->tail = NULL; s->count--; }
        pthread_mutex_unlock(&s->lock);
        if (!q) break;
        PyObject *key = PyLong_FromUnsignedLong(q->slot);
        PyObject *f = key ? PyDict_GetItemWithError(callbacks, key) : NULL;
        const lb_codec *codec = lb_cb_codec(q->slot);
        if (!f || !codec) { if (!PyErr_Occurred()) PyErr_SetString(PyExc_RuntimeError, "unknown retained callback"); }
        PyObject *arg = f && codec ? codec->in(q->arg) : NULL;
        PyObject *value = arg ? PyObject_CallOneArg(f, arg) : NULL;
        lean_object *v = value ? codec->out(value) : NULL;
        int ok = v != NULL;
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
