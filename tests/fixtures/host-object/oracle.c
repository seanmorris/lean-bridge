/* Independently authored native provider for the Lean import ABI. The Python
   application owns the actual objects, properties, exceptions and identity.
   This synchronous test provider is not a distributable language adapter. */
#define PY_SSIZE_T_CLEAN
#include <Python.h>
#include <lean/lean.h>
#include <assert.h>

static lean_external_class *box_class;
static PyObject *py_box;
static void drop_box(void *object) { Py_DECREF((PyObject *)object); }
static void visit_box(void *unused, b_lean_obj_arg visitor) { (void)unused; (void)visitor; }
static PyObject *object(b_lean_obj_arg value) {
    assert(lean_is_external(value) && lean_get_external_class(value) == box_class);
    return lean_get_external_data(value);
}
static lean_obj_res error(void) {
    PyObject *type = NULL, *value = NULL, *trace = NULL;
    PyErr_Fetch(&type, &value, &trace);
    PyErr_NormalizeException(&type, &value, &trace);
    PyObject *message = value ? PyObject_Str(value) : NULL;
    const char *s = message ? PyUnicode_AsUTF8(message) : NULL;
    lean_object *msg = lean_mk_string(s ? s : "Python host object call failed");
    Py_XDECREF(message); Py_XDECREF(type); Py_XDECREF(value); Py_XDECREF(trace); PyErr_Clear();
    return lean_io_result_mk_error(lean_mk_io_user_error(msg));
}
static lean_obj_res u32(PyObject *answer) {
    if (!answer) return error();
    unsigned long value = PyLong_AsUnsignedLong(answer); Py_DECREF(answer);
    if (PyErr_Occurred()) return error();
    assert(value <= UINT32_MAX);
    return lean_io_result_mk_ok(lean_box_uint32((uint32_t)value));
}
lean_obj_res lean_bridge_host_python_box_box(uint32_t value) {
    if (!Py_IsInitialized()) Py_Initialize();
    if (!py_box) {
        PyObject *module = PyImport_ImportModule("host_app");
        if (!module) return error();
        py_box = PyObject_GetAttrString(module, "Box"); Py_DECREF(module);
        if (!py_box) return error();
        box_class = lean_register_external_class(drop_box, visit_box);
    }
    PyObject *instance = PyObject_CallFunction(py_box, "I", value);
    return instance ? lean_io_result_mk_ok(lean_alloc_external(box_class, instance)) : error();
}
lean_obj_res lean_bridge_host_python_box_read(b_lean_obj_arg self) {
    return u32(PyObject_CallMethod(object(self), "read", NULL));
}
lean_obj_res lean_bridge_host_python_box_identity(b_lean_obj_arg self) {
    PyObject *alias = PyObject_CallMethod(object(self), "identity", NULL);
    if (!alias) return error();
    assert(alias == object(self)); Py_DECREF(alias); lean_inc(self);
    return lean_io_result_mk_ok(self);
}
lean_obj_res lean_bridge_host_python_box_get_level(b_lean_obj_arg self) {
    return u32(PyObject_GetAttrString(object(self), "level"));
}
lean_obj_res lean_bridge_host_python_box_set_level(b_lean_obj_arg self, uint32_t value) {
    PyObject *number = PyLong_FromUnsignedLong(value);
    if (!number) return error();
    int result = PyObject_SetAttrString(object(self), "level", number); Py_DECREF(number);
    return result == 0 ? lean_io_result_mk_ok(lean_box(0)) : error();
}
lean_obj_res lean_bridge_host_python_box_scale(b_lean_obj_arg self, float x) {
    PyObject *number = PyObject_CallMethod(object(self), "scale", "d", (double)x);
    if (!number) return error();
    double result = PyFloat_AsDouble(number); Py_DECREF(number);
    return PyErr_Occurred() ? error() : lean_io_result_mk_ok(lean_box_float32((float)result));
}
lean_obj_res lean_bridge_host_python_box_same_as(b_lean_obj_arg self, b_lean_obj_arg other) {
    PyObject *equal = PyObject_CallMethod(object(self), "same_as", "O", object(other));
    if (!equal) return error();
    assert(PyBool_Check(equal)); int result = equal == Py_True; Py_DECREF(equal);
    return lean_io_result_mk_ok(lean_box(result));
}
lean_obj_res lean_bridge_host_python_box_finish(lean_obj_arg self) {
    PyObject *answer = PyObject_CallMethod(object(self), "finish", NULL);
    lean_dec(self); /* This receiver is transferred, not borrowed. */
    return u32(answer);
}
lean_obj_res lean_bridge_host_python_box_live(void) {
    return u32(PyObject_CallMethod(py_box, "live", NULL));
}
