/* CPython and the pinned Lean compiler's native representations.
   lb_in_* borrows a Lean argument and returns a new Python reference.
   lb_out_* borrows a Python result and returns an owned, boxed Lean value. */
#include <float.h>
#include <math.h>
static lean_object *lb_type(const char *s) { PyErr_SetString(PyExc_TypeError, s); return NULL; }
static lean_object *lb_range(void) { PyErr_SetString(PyExc_OverflowError, "host integer is outside the declared Lean range"); return NULL; }
/* A cold synchronous call validates every argument before running application
   initializers. In check-only mode these same codecs return immediates only:
   no Lean allocation, no application code and no second set of type rules. */
#define LB_SCALAR_INPUT(NAME) \
static lean_object *lb_convert_##NAME(PyObject *, int); \
static lean_object *lb_out_##NAME(PyObject *v) { return lb_convert_##NAME(v, 1); } \
static lean_object *lb_convert_##NAME(PyObject *v, int materialize)
#define LB_UNSIGNED(NAME, TYPE, MAX, BOX) \
static PyObject *lb_in_##NAME(TYPE n) { return PyLong_FromUnsignedLongLong(n); } \
LB_SCALAR_INPUT(NAME) { \
    if (!PyLong_CheckExact(v)) return lb_type("expected an integer from host member"); \
    unsigned long long n = PyLong_AsUnsignedLongLong(v); \
    if (PyErr_Occurred()) return NULL; \
    if (n > (MAX)) return lb_range(); \
    return materialize ? BOX((TYPE)n) : lean_box(0); }
#define LB_SIGNED(NAME, TYPE, SIGNED, MIN, MAX, BOX) \
static PyObject *lb_in_##NAME(TYPE n) { return PyLong_FromLongLong((SIGNED)n); } \
LB_SCALAR_INPUT(NAME) { \
    if (!PyLong_CheckExact(v)) return lb_type("expected an integer from host member"); \
    long long n = PyLong_AsLongLong(v); \
    if (PyErr_Occurred()) return NULL; \
    if (n < (MIN) || n > (MAX)) return lb_range(); \
    return materialize ? BOX((TYPE)n) : lean_box(0); }
LB_UNSIGNED(uint8, uint8_t, UINT8_MAX, lean_box)
LB_UNSIGNED(uint16, uint16_t, UINT16_MAX, lean_box)
LB_UNSIGNED(uint32, uint32_t, UINT32_MAX, lean_box_uint32)
LB_UNSIGNED(uint64, uint64_t, UINT64_MAX, lean_box_uint64)
LB_UNSIGNED(usize, size_t, SIZE_MAX, lean_box_usize)
LB_SIGNED(int8, uint8_t, int8_t, INT8_MIN, INT8_MAX, lean_box)
LB_SIGNED(int16, uint16_t, int16_t, INT16_MIN, INT16_MAX, lean_box)
LB_SIGNED(int32, uint32_t, int32_t, INT32_MIN, INT32_MAX, lean_box_uint32)
LB_SIGNED(int64, uint64_t, int64_t, INT64_MIN, INT64_MAX, lean_box_uint64)
LB_SIGNED(isize, size_t, intptr_t, INTPTR_MIN, INTPTR_MAX, lean_box_usize)

static PyObject *lb_in_unit(lean_object *v) { (void)v; return Py_NewRef(Py_None); }
LB_SCALAR_INPUT(unit) { (void)materialize; return v == Py_None ? lean_box(0) : lb_type("expected None from host member"); }
static PyObject *lb_in_bool(uint8_t v) { return PyBool_FromLong(v); }
LB_SCALAR_INPUT(bool) { return PyBool_Check(v) ? lean_box(materialize && v == Py_True) : lb_type("expected bool from host member"); }
static PyObject *lb_in_char(uint32_t v) { return PyUnicode_FromOrdinal(v); }
LB_SCALAR_INPUT(char) {
    if (!PyUnicode_Check(v) || PyUnicode_GET_LENGTH(v) != 1) return lb_type("expected a single Unicode scalar");
    Py_UCS4 c = PyUnicode_ReadChar(v, 0);
    return c >= 0xd800 && c <= 0xdfff ? lb_type("surrogates are not Lean characters") : materialize ? lean_box_uint32(c) : lean_box(0);
}
static PyObject *lb_in_string(lean_object *v) { return PyUnicode_DecodeUTF8(lean_string_cstr(v), lean_string_size(v)-1, "strict"); }
LB_SCALAR_INPUT(string) {
    if (!PyUnicode_Check(v)) return lb_type("expected str from host member");
    Py_ssize_t n; const char *s = PyUnicode_AsUTF8AndSize(v, &n);
    return s ? (materialize ? lean_mk_string_from_bytes(s, n) : lean_box(0)) : NULL;
}
static PyObject *lb_in_bytes(lean_object *v) { return PyBytes_FromStringAndSize((const char *)lean_sarray_cptr(v), lean_sarray_size(v)); }
LB_SCALAR_INPUT(bytes) {
    if (!PyBytes_Check(v)) return lb_type("expected bytes from host member");
    if (!materialize) return lean_box(0);
    size_t n = PyBytes_GET_SIZE(v); lean_object *r = lean_alloc_sarray(1, n, n);
    memcpy(lean_sarray_cptr(r), PyBytes_AS_STRING(v), n); return r;
}
static PyObject *lb_in_float32(float v) { return PyFloat_FromDouble(v); }
static PyObject *lb_in_float64(double v) { return PyFloat_FromDouble(v); }
LB_SCALAR_INPUT(float32) {
    if (!PyFloat_Check(v)) return lb_type("expected float from host member");
    double d = PyFloat_AS_DOUBLE(v); float f = (float)d;
    if (isfinite(d) && !isfinite(f)) { PyErr_SetString(PyExc_OverflowError, "host float exceeds Float32"); return NULL; }
    return materialize ? lean_box_float32(f) : lean_box(0);
}
LB_SCALAR_INPUT(float64) { return !PyFloat_Check(v) ? lb_type("expected float from host member") : materialize ? lean_box_float(PyFloat_AS_DOUBLE(v)) : lean_box(0); }

/* Hex avoids Python's decimal conversion limit. Chunking never converts a
   host or Lean integer through floating point or a fixed-width intermediary. */
static PyObject *lb_in_nat(lean_object *n) {
    if (lean_is_scalar(n)) return PyLong_FromUnsignedLongLong(lean_unbox(n));
    lean_object *bits = lean_nat_log2(n);
    if (!lean_is_scalar(bits)) { lean_dec(bits); return PyErr_NoMemory(); }
    size_t width = lean_unbox(bits)/4 + 1;
    char *buf = PyMem_Malloc(width + 1);
    if (!buf) return PyErr_NoMemory();
    buf[width] = 0; lean_inc(n);
    for (size_t end = width; end;) {
        size_t digits = end < 15 ? end : 15;
        uint64_t part = lean_uint64_of_nat(n);
        for (size_t j = 0; j < digits; j++, part >>= 4) buf[--end] = "0123456789abcdef"[part & 15];
        lean_object *next = lean_nat_shiftr(n, lean_box(60)); lean_dec(n); n = next;
    }
    lean_dec(n); PyObject *r = PyLong_FromString(buf, NULL, 16); PyMem_Free(buf); return r;
}
static PyObject *lb_in_int(lean_object *n) {
    int negative = lean_int_lt(n, lean_box(0)); lean_object *mag = lean_nat_abs(n);
    PyObject *r = lb_in_nat(mag); lean_dec(mag);
    if (!negative || !r) return r;
    PyObject *s = PyNumber_Negative(r); Py_DECREF(r); return s;
}
static lean_object *lb_out_integer(PyObject *v, int is_signed, int materialize) {
    if (!PyLong_CheckExact(v)) return lb_type("expected an integer from host member");
    PyObject *text = PyNumber_ToBase(v, 16); if (!text) return NULL;
    const char *s = PyUnicode_AsUTF8(text); if (!s) { Py_DECREF(text); return NULL; }
    int negative = *s == '-'; s += negative + 2;
    if (negative && !is_signed) { Py_DECREF(text); return lb_range(); }
    if (!materialize) { Py_DECREF(text); return lean_box(0); }
    lean_object *r = lean_box(0);
    while (*s) {
        unsigned bits = 0; uint64_t chunk = 0;
        while (*s && bits < 60) { unsigned c = *s++; chunk = (chunk << 4) | (c <= '9' ? c-'0' : c-'a'+10); bits += 4; }
        lean_object *shift = lean_nat_shiftl(r, lean_box(bits)), *low = lean_uint64_to_nat(chunk);
        lean_dec(r); r = lean_nat_lor(shift, low); lean_dec(shift); lean_dec(low);
    }
    Py_DECREF(text); if (!is_signed) return r;
    r = lean_nat_to_int(r); if (!negative) return r;
    lean_object *neg = lean_int_neg(r); lean_dec(r); return neg;
}
LB_SCALAR_INPUT(nat) { return lb_out_integer(v, 0, materialize); }
LB_SCALAR_INPUT(int) { return lb_out_integer(v, 1, materialize); }
#undef LB_SCALAR_INPUT
