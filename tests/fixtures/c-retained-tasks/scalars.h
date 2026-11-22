/* Every edge of the chain crosses from an installed Lean task to C and back. */
#include <math.h>
static pthread_t main_thread;
static void same_thread(void) { assert(pthread_equal(main_thread, pthread_self())); }
static int calls;
#define F(n, arg, out) static B(status) scalar_##n(void *ctx, arg v, out r, B(callback_error) *e)
#define ENTER do { (void)e; (void)ctx; same_thread(); calls++; } while (0)
#define STEP(n, arg, out, expected, next) F(n, arg, out *) { ENTER; assert(v == (expected)); *r = (next); return B(OK); }
STEP(0, uint8_t, bool, 0, true)
STEP(1, bool, uint32_t, true, 0x1f3bc)
F(2, uint32_t, B(buffer) *) {
    ENTER; assert(v == 0x1f3bc); return B(buffer_set)(r, (B(view)){(const uint8_t *)"λ\0é", 5});
}
F(3, B(view), B(buffer) *) {
    ENTER; assert(v.len == 5 && !memcmp(v.data, "λ\0é", 5));
    uint8_t bytes[] = {0, 255}; return B(buffer_set)(r, (B(view)){bytes, 2});
}
F(4, B(view), mpz_ptr) {
    ENTER; assert(v.len == 2 && !v.data[0] && v.data[1] == 255);
    mpz_set_ui(r, 23); mpz_setbit(r, 4095); return B(OK);
}
F(5, mpz_srcptr, mpz_ptr) {
    ENTER; assert(mpz_sgn(v) > 0 && mpz_sizeinbase(v, 2) == 4096 && mpz_get_ui(v) == 23);
    mpz_neg(r, v); return B(OK);
}
F(6, mpz_srcptr, uint8_t *) {
    ENTER; assert(mpz_sgn(v) < 0 && mpz_sizeinbase(v, 2) == 4096 && mpz_get_ui(v) == 23);
    *r = UINT8_MAX; return B(OK);
}
STEP(7, uint8_t, uint16_t, UINT8_MAX, UINT16_MAX)
STEP(8, uint16_t, uint32_t, UINT16_MAX, UINT32_MAX)
STEP(9, uint32_t, uint64_t, UINT32_MAX, UINT64_MAX)
STEP(10, uint64_t, size_t, UINT64_MAX, SIZE_MAX)
STEP(11, size_t, int8_t, SIZE_MAX, INT8_MIN)
STEP(12, int8_t, int16_t, INT8_MIN, INT16_MIN)
STEP(13, int16_t, int32_t, INT16_MIN, INT32_MIN)
STEP(14, int32_t, int64_t, INT32_MIN, INT64_MIN)
STEP(15, int64_t, intptr_t, INT64_MIN, INTPTR_MIN)
STEP(16, intptr_t, float, INTPTR_MIN, -0.0f)
F(17, float, double *) { ENTER; assert(v == 0 && signbit(v)); *r = INFINITY; return B(OK); }
F(18, double, uint8_t *) { ENTER; assert(isinf(v) && v > 0); *r = 0; return B(OK); }
#define SHAPES(X) X(0,unit_to_bool) X(1,bool_to_char) X(2,char_to_string) X(3,string_to_bytes) \
    X(4,bytes_to_nat) X(5,nat_to_int) X(6,int_to_uint8) X(7,uint8_to_uint16) X(8,uint16_to_uint32) \
    X(9,uint32_to_uint64) X(10,uint64_to_usize) X(11,usize_to_int8) X(12,int8_to_int16) X(13,int16_to_int32) \
    X(14,int32_to_int64) X(15,int64_to_isize) X(16,isize_to_float32) X(17,float32_to_float64) X(18,float64_to_unit)
static void scalar_tour(void) {
#define MAKE(n, shape) B(callback_##shape) f##n = {0}; assert(B(callback_##shape##_make)(scalar_##n,NULL,NULL,&f##n) == B(OK));
    SHAPES(MAKE)
#undef MAKE
    B(scalar_tour_handle) h = {0}; B(callback_error) e = {0}; uint8_t unit = 1;
    assert(B(scalar_tour_start)(f0,f1,f2,f3,f4,f5,f6,f7,f8,f9,f10,f11,f12,f13,f14,f15,f16,f17,f18,&h) == B(OK));
#define DROP(n, shape) assert(B(callback_##shape##_release)(&f##n) == B(OK));
    SHAPES(DROP)
#undef DROP
    READY(B(scalar_tour_poll), h, B);
    assert(B(scalar_tour_take)(&h, &unit, &e) == B(OK) && !unit && calls == 19);
}
