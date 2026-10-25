// Lean compiler output
// Module: NominalPrimitiveSubtypes
// Imports: public import Init public meta import Init
#include <lean/lean.h>
#if defined(__clang__)
#pragma clang diagnostic ignored "-Wunused-parameter"
#pragma clang diagnostic ignored "-Wunused-label"
#elif defined(__GNUC__) && !defined(__CLANG__)
#pragma GCC diagnostic ignored "-Wunused-parameter"
#pragma GCC diagnostic ignored "-Wunused-label"
#pragma GCC diagnostic ignored "-Wunused-but-set-variable"
#endif
#ifdef __cplusplus
extern "C" {
#endif
lean_object* lean_byte_array_size(lean_object*);
uint8_t lean_nat_dec_lt(lean_object*, lean_object*);
lean_object* lean_uint32_to_nat(uint32_t);
uint8_t lean_nat_dec_eq(lean_object*, lean_object*);
lean_object* lean_int64_to_int_sint(uint64_t);
lean_object* lean_nat_to_int(lean_object*);
lean_object* lean_int_emod(lean_object*, lean_object*);
uint8_t lean_int_dec_eq(lean_object*, lean_object*);
uint16_t lean_int16_of_nat(lean_object*);
uint8_t lean_float_isfinite(double);
lean_object* lean_int8_to_int(uint8_t);
uint16_t lean_int16_add(uint16_t, uint16_t);
lean_object* lean_int16_to_int(uint16_t);
lean_object* lean_nat_mod(lean_object*, lean_object*);
uint8_t lean_int_dec_lt(lean_object*, lean_object*);
uint8_t lean_float32_isfinite(float);
uint32_t lean_int32_of_nat(lean_object*);
uint32_t lean_int32_add(uint32_t, uint32_t);
lean_object* lean_int32_to_int(uint32_t);
lean_object* lean_uint16_to_nat(uint16_t);
lean_object* lean_uint64_to_nat(uint64_t);
lean_object* lean_uint8_to_nat(uint8_t);
size_t lean_isize_of_nat(lean_object*);
size_t lean_isize_add(size_t, size_t);
lean_object* lean_isize_to_int(size_t);
double lean_float_of_nat(lean_object*);
float lean_float32_of_nat(lean_object*);
uint8_t lean_float32_decLt(float, float);
lean_object* lean_mk_empty_array_with_capacity(lean_object*);
lean_object* lean_array_push(lean_object*, lean_object*);
lean_object* lean_string_length(lean_object*);
lean_object* lean_usize_to_nat(size_t);
double lean_float_negate(double);
size_t lean_usize_add(size_t, size_t);
uint64_t lean_int64_of_nat(lean_object*);
float lean_float32_negate(float);
uint64_t lean_uint64_add(uint64_t, uint64_t);
uint64_t lean_int64_add(uint64_t, uint64_t);
lean_object* lean_int_add(lean_object*, lean_object*);
extern lean_object* l_System_Platform_numBits;
uint32_t lean_uint32_of_nat(lean_object*);
uint8_t lean_int8_of_nat(lean_object*);
uint8_t lean_int8_add(uint8_t, uint8_t);
uint16_t lean_uint16_add(uint16_t, uint16_t);
lean_object* lean_string_append(lean_object*, lean_object*);
uint8_t lean_float_decLt(double, double);
uint8_t lean_uint32_dec_eq(uint32_t, uint32_t);
uint8_t lean_uint8_add(uint8_t, uint8_t);
uint32_t lean_uint32_add(uint32_t, uint32_t);
lean_object* lean_nat_add(lean_object*, lean_object*);
lean_object* lean_byte_array_push(lean_object*, uint8_t);
lean_object* l_Array_append___redArg(lean_object*, lean_object*);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___redArg(lean_object*, lean_object*);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked(lean_object*, lean_object*, lean_object*, lean_object*);
LEAN_EXPORT lean_object* lb_nominal_full_probe_constructor_unitA(lean_object*);
LEAN_EXPORT lean_object* lb_nominal_full_probe_constructor_unitB(lean_object*);
LEAN_EXPORT lean_object* lb_nominal_full_probe_constructor_unitReject(lean_object*);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_boolA_spec__0___redArg(uint8_t);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_boolA_spec__0___redArg___boxed(lean_object*);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_boolA_spec__0(lean_object*, uint8_t);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_boolA_spec__0___boxed(lean_object*, lean_object*);
LEAN_EXPORT lean_object* lb_nominal_full_probe_constructor_boolA(uint8_t);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_boolA___boxed(lean_object*);
static lean_once_cell_t l_NominalPrimitiveSubtypes_boolB___closed__0_once = LEAN_ONCE_CELL_INITIALIZER;
static lean_object* l_NominalPrimitiveSubtypes_boolB___closed__0;
static lean_once_cell_t l_NominalPrimitiveSubtypes_boolB___closed__1_once = LEAN_ONCE_CELL_INITIALIZER;
static lean_object* l_NominalPrimitiveSubtypes_boolB___closed__1;
LEAN_EXPORT lean_object* lb_nominal_full_probe_constructor_boolB(uint8_t);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_boolB___boxed(lean_object*);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_uint8A_spec__0___redArg(uint8_t);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_uint8A_spec__0___redArg___boxed(lean_object*);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_uint8A_spec__0(lean_object*, uint8_t);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_uint8A_spec__0___boxed(lean_object*, lean_object*);
LEAN_EXPORT lean_object* lb_nominal_full_probe_constructor_uint8A(uint8_t);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_uint8A___boxed(lean_object*);
LEAN_EXPORT lean_object* lb_nominal_full_probe_constructor_uint8B(uint8_t);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_uint8B___boxed(lean_object*);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_uint16A_spec__0___redArg(uint16_t);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_uint16A_spec__0___redArg___boxed(lean_object*);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_uint16A_spec__0(lean_object*, uint16_t);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_uint16A_spec__0___boxed(lean_object*, lean_object*);
LEAN_EXPORT lean_object* lb_nominal_full_probe_constructor_uint16A(uint16_t);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_uint16A___boxed(lean_object*);
LEAN_EXPORT lean_object* lb_nominal_full_probe_constructor_uint16B(uint16_t);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_uint16B___boxed(lean_object*);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_uint32A_spec__0___redArg(uint32_t);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_uint32A_spec__0___redArg___boxed(lean_object*);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_uint32A_spec__0(lean_object*, uint32_t);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_uint32A_spec__0___boxed(lean_object*, lean_object*);
LEAN_EXPORT lean_object* lb_nominal_full_probe_constructor_uint32A(uint32_t);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_uint32A___boxed(lean_object*);
LEAN_EXPORT lean_object* lb_nominal_full_probe_constructor_uint32B(uint32_t);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_uint32B___boxed(lean_object*);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_uint64A_spec__0___redArg(uint64_t);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_uint64A_spec__0___redArg___boxed(lean_object*);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_uint64A_spec__0(lean_object*, uint64_t);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_uint64A_spec__0___boxed(lean_object*, lean_object*);
LEAN_EXPORT lean_object* lb_nominal_full_probe_constructor_uint64A(uint64_t);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_uint64A___boxed(lean_object*);
LEAN_EXPORT lean_object* lb_nominal_full_probe_constructor_uint64B(uint64_t);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_uint64B___boxed(lean_object*);
static lean_once_cell_t l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_int8A_spec__0___redArg___closed__0_once = LEAN_ONCE_CELL_INITIALIZER;
static lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_int8A_spec__0___redArg___closed__0;
static lean_once_cell_t l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_int8A_spec__0___redArg___closed__1_once = LEAN_ONCE_CELL_INITIALIZER;
static lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_int8A_spec__0___redArg___closed__1;
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_int8A_spec__0___redArg(uint8_t);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_int8A_spec__0___redArg___boxed(lean_object*);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_int8A_spec__0(lean_object*, uint8_t);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_int8A_spec__0___boxed(lean_object*, lean_object*);
static lean_once_cell_t l_NominalPrimitiveSubtypes_int8A___closed__0_once = LEAN_ONCE_CELL_INITIALIZER;
static lean_object* l_NominalPrimitiveSubtypes_int8A___closed__0;
LEAN_EXPORT lean_object* lb_nominal_full_probe_constructor_int8A(uint8_t);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_int8A___boxed(lean_object*);
static lean_once_cell_t l_NominalPrimitiveSubtypes_int8B___closed__0_once = LEAN_ONCE_CELL_INITIALIZER;
static uint8_t l_NominalPrimitiveSubtypes_int8B___closed__0;
LEAN_EXPORT lean_object* lb_nominal_full_probe_constructor_int8B(uint8_t);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_int8B___boxed(lean_object*);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_int16A_spec__0___redArg(uint16_t);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_int16A_spec__0___redArg___boxed(lean_object*);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_int16A_spec__0(lean_object*, uint16_t);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_int16A_spec__0___boxed(lean_object*, lean_object*);
LEAN_EXPORT lean_object* lb_nominal_full_probe_constructor_int16A(uint16_t);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_int16A___boxed(lean_object*);
static lean_once_cell_t l_NominalPrimitiveSubtypes_int16B___closed__0_once = LEAN_ONCE_CELL_INITIALIZER;
static uint16_t l_NominalPrimitiveSubtypes_int16B___closed__0;
LEAN_EXPORT lean_object* lb_nominal_full_probe_constructor_int16B(uint16_t);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_int16B___boxed(lean_object*);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_int32A_spec__0___redArg(uint32_t);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_int32A_spec__0___redArg___boxed(lean_object*);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_int32A_spec__0(lean_object*, uint32_t);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_int32A_spec__0___boxed(lean_object*, lean_object*);
LEAN_EXPORT lean_object* lb_nominal_full_probe_constructor_int32A(uint32_t);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_int32A___boxed(lean_object*);
static lean_once_cell_t l_NominalPrimitiveSubtypes_int32B___closed__0_once = LEAN_ONCE_CELL_INITIALIZER;
static uint32_t l_NominalPrimitiveSubtypes_int32B___closed__0;
LEAN_EXPORT lean_object* lb_nominal_full_probe_constructor_int32B(uint32_t);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_int32B___boxed(lean_object*);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_int64A_spec__0___redArg(uint64_t);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_int64A_spec__0___redArg___boxed(lean_object*);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_int64A_spec__0(lean_object*, uint64_t);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_int64A_spec__0___boxed(lean_object*, lean_object*);
LEAN_EXPORT lean_object* lb_nominal_full_probe_constructor_int64A(uint64_t);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_int64A___boxed(lean_object*);
static lean_once_cell_t l_NominalPrimitiveSubtypes_int64B___closed__0_once = LEAN_ONCE_CELL_INITIALIZER;
static uint64_t l_NominalPrimitiveSubtypes_int64B___closed__0;
LEAN_EXPORT lean_object* lb_nominal_full_probe_constructor_int64B(uint64_t);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_int64B___boxed(lean_object*);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_natA_spec__0___redArg(lean_object*);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_natA_spec__0(lean_object*, lean_object*);
LEAN_EXPORT lean_object* lb_nominal_full_probe_constructor_natA(lean_object*);
LEAN_EXPORT lean_object* lb_nominal_full_probe_constructor_natB(lean_object*);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_intA_spec__0___redArg(lean_object*);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_intA_spec__0(lean_object*, lean_object*);
LEAN_EXPORT lean_object* lb_nominal_full_probe_constructor_intA(lean_object*);
LEAN_EXPORT lean_object* lb_nominal_full_probe_constructor_intB(lean_object*);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_float32A_spec__0___redArg(float);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_float32A_spec__0___redArg___boxed(lean_object*);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_float32A_spec__0(lean_object*, float);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_float32A_spec__0___boxed(lean_object*, lean_object*);
static lean_once_cell_t l_NominalPrimitiveSubtypes_float32A___closed__0_once = LEAN_ONCE_CELL_INITIALIZER;
static float l_NominalPrimitiveSubtypes_float32A___closed__0;
LEAN_EXPORT lean_object* lb_nominal_full_probe_constructor_float32A(float);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_float32A___boxed(lean_object*);
LEAN_EXPORT lean_object* lb_nominal_full_probe_constructor_float32B(float);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_float32B___boxed(lean_object*);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_float64A_spec__0___redArg(double);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_float64A_spec__0___redArg___boxed(lean_object*);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_float64A_spec__0(lean_object*, double);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_float64A_spec__0___boxed(lean_object*, lean_object*);
static lean_once_cell_t l_NominalPrimitiveSubtypes_float64A___closed__0_once = LEAN_ONCE_CELL_INITIALIZER;
static double l_NominalPrimitiveSubtypes_float64A___closed__0;
LEAN_EXPORT lean_object* lb_nominal_full_probe_constructor_float64A(double);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_float64A___boxed(lean_object*);
LEAN_EXPORT lean_object* lb_nominal_full_probe_constructor_float64B(double);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_float64B___boxed(lean_object*);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_textA_spec__0___redArg(lean_object*);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_textA_spec__0(lean_object*, lean_object*);
LEAN_EXPORT lean_object* lb_nominal_full_probe_constructor_textA(lean_object*);
static const lean_string_object l_NominalPrimitiveSubtypes_textB___closed__0_value = {.m_header = {.m_rc = 0, .m_cs_sz = 0, .m_other = 0, .m_tag = 249}, .m_size = 2, .m_capacity = 2, .m_length = 1, .m_data = "!"};
static const lean_object* l_NominalPrimitiveSubtypes_textB___closed__0 = (const lean_object*)&l_NominalPrimitiveSubtypes_textB___closed__0_value;
LEAN_EXPORT lean_object* lb_nominal_full_probe_constructor_textB(lean_object*);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_bytesA_spec__0___redArg(lean_object*);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_bytesA_spec__0(lean_object*, lean_object*);
LEAN_EXPORT lean_object* lb_nominal_full_probe_constructor_bytesA(lean_object*);
LEAN_EXPORT lean_object* lb_nominal_full_probe_constructor_bytesB(lean_object*);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_charA_spec__0___redArg(uint32_t);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_charA_spec__0___redArg___boxed(lean_object*);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_charA_spec__0(lean_object*, uint32_t);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_charA_spec__0___boxed(lean_object*, lean_object*);
LEAN_EXPORT lean_object* lb_nominal_full_probe_constructor_charA(uint32_t);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_charA___boxed(lean_object*);
static lean_once_cell_t l_NominalPrimitiveSubtypes_charB___closed__0_once = LEAN_ONCE_CELL_INITIALIZER;
static lean_object* l_NominalPrimitiveSubtypes_charB___closed__0;
LEAN_EXPORT lean_object* lb_nominal_full_probe_constructor_charB(uint32_t);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_charB___boxed(lean_object*);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_usizeA_spec__0___redArg(size_t);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_usizeA_spec__0___redArg___boxed(lean_object*);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_usizeA_spec__0(lean_object*, size_t);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_usizeA_spec__0___boxed(lean_object*, lean_object*);
LEAN_EXPORT lean_object* lb_nominal_full_probe_constructor_usizeA(size_t);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_usizeA___boxed(lean_object*);
LEAN_EXPORT lean_object* lb_nominal_full_probe_constructor_usizeB(size_t);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_usizeB___boxed(lean_object*);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_isizeA_spec__0___redArg(size_t);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_isizeA_spec__0___redArg___boxed(lean_object*);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_isizeA_spec__0(lean_object*, size_t);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_isizeA_spec__0___boxed(lean_object*, lean_object*);
LEAN_EXPORT lean_object* lb_nominal_full_probe_constructor_isizeA(size_t);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_isizeA___boxed(lean_object*);
static lean_once_cell_t l_NominalPrimitiveSubtypes_isizeB___closed__0_once = LEAN_ONCE_CELL_INITIALIZER;
static size_t l_NominalPrimitiveSubtypes_isizeB___closed__0;
LEAN_EXPORT lean_object* lb_nominal_full_probe_constructor_isizeB(size_t);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_isizeB___boxed(lean_object*);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_Event_ctorIdx(lean_object*);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_Event_ctorIdx___boxed(lean_object*);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_Event_ctorElim___redArg(lean_object*, lean_object*);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_Event_ctorElim(lean_object*, lean_object*, lean_object*, lean_object*, lean_object*);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_Event_ctorElim___boxed(lean_object*, lean_object*, lean_object*, lean_object*, lean_object*);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_Event_empty_elim___redArg(lean_object*, lean_object*);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_Event_empty_elim(lean_object*, lean_object*, lean_object*, lean_object*);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_Event_box_elim___redArg(lean_object*, lean_object*);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_Event_box_elim(lean_object*, lean_object*, lean_object*, lean_object*);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_Event_choices_elim___redArg(lean_object*, lean_object*);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_Event_choices_elim(lean_object*, lean_object*, lean_object*, lean_object*);
LEAN_EXPORT lean_object* lb_nominal_full_probe_source_echoA(lean_object*);
LEAN_EXPORT lean_object* lb_nominal_full_probe_source_echoB(lean_object*);
LEAN_EXPORT lean_object* lb_nominal_full_probe_source_refuseUnit(lean_object*);
LEAN_EXPORT lean_object* lb_nominal_full_probe_source_combine(lean_object*, lean_object*);
LEAN_EXPORT lean_object* lb_nominal_full_probe_source_echoPair(lean_object*);
LEAN_EXPORT lean_object* lb_nominal_full_probe_source_echoEventA(lean_object*);
LEAN_EXPORT lean_object* lb_nominal_full_probe_source_echoEventB(lean_object*);
LEAN_EXPORT lean_object* lb_nominal_full_probe_source_aliases(lean_object*, lean_object*);
LEAN_EXPORT lean_object* lb_nominal_full_probe_source_produce(lean_object*);
static lean_once_cell_t l_NominalPrimitiveSubtypes_produceGroup___closed__0_once = LEAN_ONCE_CELL_INITIALIZER;
static lean_object* l_NominalPrimitiveSubtypes_produceGroup___closed__0;
LEAN_EXPORT lean_object* lb_nominal_full_probe_source_produceGroup(lean_object*);
LEAN_EXPORT lean_object* lb_nominal_full_probe_source_producePair(lean_object*);
LEAN_EXPORT lean_object* lb_nominal_full_probe_source_produceEvent(lean_object*);
static const lean_array_object l_NominalPrimitiveSubtypes_produceChoices___closed__0_value = {.m_header = {.m_rc = 0, .m_cs_sz = sizeof(lean_array_object) + sizeof(void*)*1, .m_other = 0, .m_tag = 246}, .m_size = 1, .m_capacity = 1, .m_data = {((lean_object*)(((size_t)(0) << 1) | 1))}};
static const lean_object* l_NominalPrimitiveSubtypes_produceChoices___closed__0 = (const lean_object*)&l_NominalPrimitiveSubtypes_produceChoices___closed__0_value;
static const lean_ctor_object l_NominalPrimitiveSubtypes_produceChoices___closed__1_value = {.m_header = {.m_rc = 0, .m_cs_sz = sizeof(lean_ctor_object) + sizeof(void*)*1 + 0, .m_other = 1, .m_tag = 2}, .m_objs = {((lean_object*)&l_NominalPrimitiveSubtypes_produceChoices___closed__0_value)}};
static const lean_object* l_NominalPrimitiveSubtypes_produceChoices___closed__1 = (const lean_object*)&l_NominalPrimitiveSubtypes_produceChoices___closed__1_value;
static lean_once_cell_t l_NominalPrimitiveSubtypes_produceChoices___closed__2_once = LEAN_ONCE_CELL_INITIALIZER;
static lean_object* l_NominalPrimitiveSubtypes_produceChoices___closed__2;
LEAN_EXPORT lean_object* lb_nominal_full_probe_source_produceChoices(lean_object*);
static lean_once_cell_t l_NominalPrimitiveSubtypes_wordBits___closed__0_once = LEAN_ONCE_CELL_INITIALIZER;
static uint32_t l_NominalPrimitiveSubtypes_wordBits___closed__0;
LEAN_EXPORT uint32_t lb_nominal_full_probe_source_wordBits;
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___redArg(lean_object* v_inst_1_, lean_object* v_value_2_){
_start:
{
lean_object* v___x_3_; uint8_t v___x_4_; 
lean_inc(v_value_2_);
v___x_3_ = lean_apply_1(v_inst_1_, v_value_2_);
v___x_4_ = lean_unbox(v___x_3_);
if (v___x_4_ == 0)
{
lean_object* v___x_5_; 
lean_dec(v_value_2_);
v___x_5_ = lean_box(0);
return v___x_5_;
}
else
{
lean_object* v___x_6_; 
v___x_6_ = lean_alloc_ctor(1, 1, 0);
lean_ctor_set(v___x_6_, 0, v_value_2_);
return v___x_6_;
}
}
}
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked(lean_object* v_00_u03b1_7_, lean_object* v_predicate_8_, lean_object* v_inst_9_, lean_object* v_value_10_){
_start:
{
lean_object* v___x_11_; 
v___x_11_ = l_NominalPrimitiveSubtypes_checked___redArg(v_inst_9_, v_value_10_);
return v___x_11_;
}
}
LEAN_EXPORT lean_object* lb_nominal_full_probe_constructor_unitA(lean_object* v_value_12_){
_start:
{
lean_object* v___x_13_; 
v___x_13_ = lean_alloc_ctor(1, 1, 0);
lean_ctor_set(v___x_13_, 0, v_value_12_);
return v___x_13_;
}
}
LEAN_EXPORT lean_object* lb_nominal_full_probe_constructor_unitB(lean_object* v_value_14_){
_start:
{
lean_object* v___x_15_; 
v___x_15_ = lean_alloc_ctor(1, 1, 0);
lean_ctor_set(v___x_15_, 0, v_value_14_);
return v___x_15_;
}
}
LEAN_EXPORT lean_object* lb_nominal_full_probe_constructor_unitReject(lean_object* v_x_16_){
_start:
{
lean_object* v___x_17_; 
v___x_17_ = lean_box(0);
return v___x_17_;
}
}
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_boolA_spec__0___redArg(uint8_t v_value_18_){
_start:
{
if (v_value_18_ == 0)
{
lean_object* v___x_19_; 
v___x_19_ = lean_box(0);
return v___x_19_;
}
else
{
lean_object* v___x_20_; lean_object* v___x_21_; 
v___x_20_ = lean_box(v_value_18_);
v___x_21_ = lean_alloc_ctor(1, 1, 0);
lean_ctor_set(v___x_21_, 0, v___x_20_);
return v___x_21_;
}
}
}
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_boolA_spec__0___redArg___boxed(lean_object* v_value_22_){
_start:
{
uint8_t v_value_boxed_23_; lean_object* v_res_24_; 
v_value_boxed_23_ = lean_unbox(v_value_22_);
v_res_24_ = l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_boolA_spec__0___redArg(v_value_boxed_23_);
return v_res_24_;
}
}
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_boolA_spec__0(lean_object* v_predicate_25_, uint8_t v_value_26_){
_start:
{
lean_object* v___x_27_; 
v___x_27_ = l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_boolA_spec__0___redArg(v_value_26_);
return v___x_27_;
}
}
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_boolA_spec__0___boxed(lean_object* v_predicate_28_, lean_object* v_value_29_){
_start:
{
uint8_t v_value_boxed_30_; lean_object* v_res_31_; 
v_value_boxed_30_ = lean_unbox(v_value_29_);
v_res_31_ = l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_boolA_spec__0(v_predicate_28_, v_value_boxed_30_);
return v_res_31_;
}
}
LEAN_EXPORT lean_object* lb_nominal_full_probe_constructor_boolA(uint8_t v_value_32_){
_start:
{
lean_object* v___x_33_; 
v___x_33_ = l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_boolA_spec__0___redArg(v_value_32_);
return v___x_33_;
}
}
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_boolA___boxed(lean_object* v_value_34_){
_start:
{
uint8_t v_value_boxed_35_; lean_object* v_res_36_; 
v_value_boxed_35_ = lean_unbox(v_value_34_);
v_res_36_ = lb_nominal_full_probe_constructor_boolA(v_value_boxed_35_);
return v_res_36_;
}
}
static lean_object* _init_l_NominalPrimitiveSubtypes_boolB___closed__0(void){
_start:
{
uint8_t v___x_37_; lean_object* v___x_38_; 
v___x_37_ = 1;
v___x_38_ = l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_boolA_spec__0___redArg(v___x_37_);
return v___x_38_;
}
}
static lean_object* _init_l_NominalPrimitiveSubtypes_boolB___closed__1(void){
_start:
{
uint8_t v___x_39_; lean_object* v___x_40_; 
v___x_39_ = 0;
v___x_40_ = l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_boolA_spec__0___redArg(v___x_39_);
return v___x_40_;
}
}
LEAN_EXPORT lean_object* lb_nominal_full_probe_constructor_boolB(uint8_t v_value_41_){
_start:
{
if (v_value_41_ == 0)
{
lean_object* v___x_42_; 
v___x_42_ = lean_obj_once(&l_NominalPrimitiveSubtypes_boolB___closed__0, &l_NominalPrimitiveSubtypes_boolB___closed__0_once, _init_l_NominalPrimitiveSubtypes_boolB___closed__0);
return v___x_42_;
}
else
{
lean_object* v___x_43_; 
v___x_43_ = lean_obj_once(&l_NominalPrimitiveSubtypes_boolB___closed__1, &l_NominalPrimitiveSubtypes_boolB___closed__1_once, _init_l_NominalPrimitiveSubtypes_boolB___closed__1);
return v___x_43_;
}
}
}
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_boolB___boxed(lean_object* v_value_44_){
_start:
{
uint8_t v_value_boxed_45_; lean_object* v_res_46_; 
v_value_boxed_45_ = lean_unbox(v_value_44_);
v_res_46_ = lb_nominal_full_probe_constructor_boolB(v_value_boxed_45_);
return v_res_46_;
}
}
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_uint8A_spec__0___redArg(uint8_t v_value_47_){
_start:
{
lean_object* v___x_48_; lean_object* v___x_49_; lean_object* v___x_50_; lean_object* v___x_51_; uint8_t v___x_52_; 
v___x_48_ = lean_uint8_to_nat(v_value_47_);
v___x_49_ = lean_unsigned_to_nat(2u);
v___x_50_ = lean_nat_mod(v___x_48_, v___x_49_);
v___x_51_ = lean_unsigned_to_nat(0u);
v___x_52_ = lean_nat_dec_eq(v___x_50_, v___x_51_);
lean_dec(v___x_50_);
if (v___x_52_ == 0)
{
lean_object* v___x_53_; 
v___x_53_ = lean_box(0);
return v___x_53_;
}
else
{
lean_object* v___x_54_; lean_object* v___x_55_; 
v___x_54_ = lean_box(v_value_47_);
v___x_55_ = lean_alloc_ctor(1, 1, 0);
lean_ctor_set(v___x_55_, 0, v___x_54_);
return v___x_55_;
}
}
}
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_uint8A_spec__0___redArg___boxed(lean_object* v_value_56_){
_start:
{
uint8_t v_value_boxed_57_; lean_object* v_res_58_; 
v_value_boxed_57_ = lean_unbox(v_value_56_);
v_res_58_ = l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_uint8A_spec__0___redArg(v_value_boxed_57_);
return v_res_58_;
}
}
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_uint8A_spec__0(lean_object* v_predicate_59_, uint8_t v_value_60_){
_start:
{
lean_object* v___x_61_; 
v___x_61_ = l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_uint8A_spec__0___redArg(v_value_60_);
return v___x_61_;
}
}
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_uint8A_spec__0___boxed(lean_object* v_predicate_62_, lean_object* v_value_63_){
_start:
{
uint8_t v_value_boxed_64_; lean_object* v_res_65_; 
v_value_boxed_64_ = lean_unbox(v_value_63_);
v_res_65_ = l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_uint8A_spec__0(v_predicate_62_, v_value_boxed_64_);
return v_res_65_;
}
}
LEAN_EXPORT lean_object* lb_nominal_full_probe_constructor_uint8A(uint8_t v_value_66_){
_start:
{
lean_object* v___x_67_; lean_object* v___x_68_; uint8_t v___x_69_; 
v___x_67_ = lean_uint8_to_nat(v_value_66_);
v___x_68_ = lean_unsigned_to_nat(100u);
v___x_69_ = lean_nat_dec_lt(v___x_67_, v___x_68_);
if (v___x_69_ == 0)
{
lean_object* v___x_70_; 
v___x_70_ = lean_box(0);
return v___x_70_;
}
else
{
lean_object* v___x_71_; 
v___x_71_ = l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_uint8A_spec__0___redArg(v_value_66_);
return v___x_71_;
}
}
}
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_uint8A___boxed(lean_object* v_value_72_){
_start:
{
uint8_t v_value_boxed_73_; lean_object* v_res_74_; 
v_value_boxed_73_ = lean_unbox(v_value_72_);
v_res_74_ = lb_nominal_full_probe_constructor_uint8A(v_value_boxed_73_);
return v_res_74_;
}
}
LEAN_EXPORT lean_object* lb_nominal_full_probe_constructor_uint8B(uint8_t v_value_75_){
_start:
{
uint8_t v___x_76_; uint8_t v___x_77_; lean_object* v___x_78_; 
v___x_76_ = 2;
v___x_77_ = lean_uint8_add(v_value_75_, v___x_76_);
v___x_78_ = l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_uint8A_spec__0___redArg(v___x_77_);
return v___x_78_;
}
}
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_uint8B___boxed(lean_object* v_value_79_){
_start:
{
uint8_t v_value_boxed_80_; lean_object* v_res_81_; 
v_value_boxed_80_ = lean_unbox(v_value_79_);
v_res_81_ = lb_nominal_full_probe_constructor_uint8B(v_value_boxed_80_);
return v_res_81_;
}
}
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_uint16A_spec__0___redArg(uint16_t v_value_82_){
_start:
{
lean_object* v___x_83_; lean_object* v___x_84_; lean_object* v___x_85_; lean_object* v___x_86_; uint8_t v___x_87_; 
v___x_83_ = lean_uint16_to_nat(v_value_82_);
v___x_84_ = lean_unsigned_to_nat(2u);
v___x_85_ = lean_nat_mod(v___x_83_, v___x_84_);
v___x_86_ = lean_unsigned_to_nat(0u);
v___x_87_ = lean_nat_dec_eq(v___x_85_, v___x_86_);
lean_dec(v___x_85_);
if (v___x_87_ == 0)
{
lean_object* v___x_88_; 
v___x_88_ = lean_box(0);
return v___x_88_;
}
else
{
lean_object* v___x_89_; lean_object* v___x_90_; 
v___x_89_ = lean_box(v_value_82_);
v___x_90_ = lean_alloc_ctor(1, 1, 0);
lean_ctor_set(v___x_90_, 0, v___x_89_);
return v___x_90_;
}
}
}
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_uint16A_spec__0___redArg___boxed(lean_object* v_value_91_){
_start:
{
uint16_t v_value_boxed_92_; lean_object* v_res_93_; 
v_value_boxed_92_ = lean_unbox(v_value_91_);
v_res_93_ = l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_uint16A_spec__0___redArg(v_value_boxed_92_);
return v_res_93_;
}
}
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_uint16A_spec__0(lean_object* v_predicate_94_, uint16_t v_value_95_){
_start:
{
lean_object* v___x_96_; 
v___x_96_ = l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_uint16A_spec__0___redArg(v_value_95_);
return v___x_96_;
}
}
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_uint16A_spec__0___boxed(lean_object* v_predicate_97_, lean_object* v_value_98_){
_start:
{
uint16_t v_value_boxed_99_; lean_object* v_res_100_; 
v_value_boxed_99_ = lean_unbox(v_value_98_);
v_res_100_ = l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_uint16A_spec__0(v_predicate_97_, v_value_boxed_99_);
return v_res_100_;
}
}
LEAN_EXPORT lean_object* lb_nominal_full_probe_constructor_uint16A(uint16_t v_value_101_){
_start:
{
lean_object* v___x_102_; lean_object* v___x_103_; uint8_t v___x_104_; 
v___x_102_ = lean_uint16_to_nat(v_value_101_);
v___x_103_ = lean_unsigned_to_nat(100u);
v___x_104_ = lean_nat_dec_lt(v___x_102_, v___x_103_);
if (v___x_104_ == 0)
{
lean_object* v___x_105_; 
v___x_105_ = lean_box(0);
return v___x_105_;
}
else
{
lean_object* v___x_106_; 
v___x_106_ = l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_uint16A_spec__0___redArg(v_value_101_);
return v___x_106_;
}
}
}
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_uint16A___boxed(lean_object* v_value_107_){
_start:
{
uint16_t v_value_boxed_108_; lean_object* v_res_109_; 
v_value_boxed_108_ = lean_unbox(v_value_107_);
v_res_109_ = lb_nominal_full_probe_constructor_uint16A(v_value_boxed_108_);
return v_res_109_;
}
}
LEAN_EXPORT lean_object* lb_nominal_full_probe_constructor_uint16B(uint16_t v_value_110_){
_start:
{
uint16_t v___x_111_; uint16_t v___x_112_; lean_object* v___x_113_; 
v___x_111_ = 2;
v___x_112_ = lean_uint16_add(v_value_110_, v___x_111_);
v___x_113_ = l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_uint16A_spec__0___redArg(v___x_112_);
return v___x_113_;
}
}
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_uint16B___boxed(lean_object* v_value_114_){
_start:
{
uint16_t v_value_boxed_115_; lean_object* v_res_116_; 
v_value_boxed_115_ = lean_unbox(v_value_114_);
v_res_116_ = lb_nominal_full_probe_constructor_uint16B(v_value_boxed_115_);
return v_res_116_;
}
}
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_uint32A_spec__0___redArg(uint32_t v_value_117_){
_start:
{
lean_object* v___x_118_; lean_object* v___x_119_; lean_object* v___x_120_; lean_object* v___x_121_; uint8_t v___x_122_; 
v___x_118_ = lean_uint32_to_nat(v_value_117_);
v___x_119_ = lean_unsigned_to_nat(2u);
v___x_120_ = lean_nat_mod(v___x_118_, v___x_119_);
lean_dec(v___x_118_);
v___x_121_ = lean_unsigned_to_nat(0u);
v___x_122_ = lean_nat_dec_eq(v___x_120_, v___x_121_);
lean_dec(v___x_120_);
if (v___x_122_ == 0)
{
lean_object* v___x_123_; 
v___x_123_ = lean_box(0);
return v___x_123_;
}
else
{
lean_object* v___x_124_; lean_object* v___x_125_; 
v___x_124_ = lean_box_uint32(v_value_117_);
v___x_125_ = lean_alloc_ctor(1, 1, 0);
lean_ctor_set(v___x_125_, 0, v___x_124_);
return v___x_125_;
}
}
}
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_uint32A_spec__0___redArg___boxed(lean_object* v_value_126_){
_start:
{
uint32_t v_value_boxed_127_; lean_object* v_res_128_; 
v_value_boxed_127_ = lean_unbox_uint32(v_value_126_);
lean_dec(v_value_126_);
v_res_128_ = l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_uint32A_spec__0___redArg(v_value_boxed_127_);
return v_res_128_;
}
}
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_uint32A_spec__0(lean_object* v_predicate_129_, uint32_t v_value_130_){
_start:
{
lean_object* v___x_131_; 
v___x_131_ = l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_uint32A_spec__0___redArg(v_value_130_);
return v___x_131_;
}
}
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_uint32A_spec__0___boxed(lean_object* v_predicate_132_, lean_object* v_value_133_){
_start:
{
uint32_t v_value_boxed_134_; lean_object* v_res_135_; 
v_value_boxed_134_ = lean_unbox_uint32(v_value_133_);
lean_dec(v_value_133_);
v_res_135_ = l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_uint32A_spec__0(v_predicate_132_, v_value_boxed_134_);
return v_res_135_;
}
}
LEAN_EXPORT lean_object* lb_nominal_full_probe_constructor_uint32A(uint32_t v_value_136_){
_start:
{
lean_object* v___x_137_; lean_object* v___x_138_; uint8_t v___x_139_; 
v___x_137_ = lean_uint32_to_nat(v_value_136_);
v___x_138_ = lean_unsigned_to_nat(100u);
v___x_139_ = lean_nat_dec_lt(v___x_137_, v___x_138_);
lean_dec(v___x_137_);
if (v___x_139_ == 0)
{
lean_object* v___x_140_; 
v___x_140_ = lean_box(0);
return v___x_140_;
}
else
{
lean_object* v___x_141_; 
v___x_141_ = l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_uint32A_spec__0___redArg(v_value_136_);
return v___x_141_;
}
}
}
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_uint32A___boxed(lean_object* v_value_142_){
_start:
{
uint32_t v_value_boxed_143_; lean_object* v_res_144_; 
v_value_boxed_143_ = lean_unbox_uint32(v_value_142_);
lean_dec(v_value_142_);
v_res_144_ = lb_nominal_full_probe_constructor_uint32A(v_value_boxed_143_);
return v_res_144_;
}
}
LEAN_EXPORT lean_object* lb_nominal_full_probe_constructor_uint32B(uint32_t v_value_145_){
_start:
{
uint32_t v___x_146_; uint32_t v___x_147_; lean_object* v___x_148_; 
v___x_146_ = 2;
v___x_147_ = lean_uint32_add(v_value_145_, v___x_146_);
v___x_148_ = l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_uint32A_spec__0___redArg(v___x_147_);
return v___x_148_;
}
}
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_uint32B___boxed(lean_object* v_value_149_){
_start:
{
uint32_t v_value_boxed_150_; lean_object* v_res_151_; 
v_value_boxed_150_ = lean_unbox_uint32(v_value_149_);
lean_dec(v_value_149_);
v_res_151_ = lb_nominal_full_probe_constructor_uint32B(v_value_boxed_150_);
return v_res_151_;
}
}
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_uint64A_spec__0___redArg(uint64_t v_value_152_){
_start:
{
lean_object* v___x_153_; lean_object* v___x_154_; lean_object* v___x_155_; lean_object* v___x_156_; uint8_t v___x_157_; 
v___x_153_ = lean_uint64_to_nat(v_value_152_);
v___x_154_ = lean_unsigned_to_nat(2u);
v___x_155_ = lean_nat_mod(v___x_153_, v___x_154_);
lean_dec(v___x_153_);
v___x_156_ = lean_unsigned_to_nat(0u);
v___x_157_ = lean_nat_dec_eq(v___x_155_, v___x_156_);
lean_dec(v___x_155_);
if (v___x_157_ == 0)
{
lean_object* v___x_158_; 
v___x_158_ = lean_box(0);
return v___x_158_;
}
else
{
lean_object* v___x_159_; lean_object* v___x_160_; 
v___x_159_ = lean_box_uint64(v_value_152_);
v___x_160_ = lean_alloc_ctor(1, 1, 0);
lean_ctor_set(v___x_160_, 0, v___x_159_);
return v___x_160_;
}
}
}
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_uint64A_spec__0___redArg___boxed(lean_object* v_value_161_){
_start:
{
uint64_t v_value_boxed_162_; lean_object* v_res_163_; 
v_value_boxed_162_ = lean_unbox_uint64(v_value_161_);
lean_dec_ref(v_value_161_);
v_res_163_ = l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_uint64A_spec__0___redArg(v_value_boxed_162_);
return v_res_163_;
}
}
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_uint64A_spec__0(lean_object* v_predicate_164_, uint64_t v_value_165_){
_start:
{
lean_object* v___x_166_; 
v___x_166_ = l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_uint64A_spec__0___redArg(v_value_165_);
return v___x_166_;
}
}
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_uint64A_spec__0___boxed(lean_object* v_predicate_167_, lean_object* v_value_168_){
_start:
{
uint64_t v_value_boxed_169_; lean_object* v_res_170_; 
v_value_boxed_169_ = lean_unbox_uint64(v_value_168_);
lean_dec_ref(v_value_168_);
v_res_170_ = l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_uint64A_spec__0(v_predicate_167_, v_value_boxed_169_);
return v_res_170_;
}
}
LEAN_EXPORT lean_object* lb_nominal_full_probe_constructor_uint64A(uint64_t v_value_171_){
_start:
{
lean_object* v___x_172_; lean_object* v___x_173_; uint8_t v___x_174_; 
v___x_172_ = lean_uint64_to_nat(v_value_171_);
v___x_173_ = lean_unsigned_to_nat(100u);
v___x_174_ = lean_nat_dec_lt(v___x_172_, v___x_173_);
lean_dec(v___x_172_);
if (v___x_174_ == 0)
{
lean_object* v___x_175_; 
v___x_175_ = lean_box(0);
return v___x_175_;
}
else
{
lean_object* v___x_176_; 
v___x_176_ = l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_uint64A_spec__0___redArg(v_value_171_);
return v___x_176_;
}
}
}
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_uint64A___boxed(lean_object* v_value_177_){
_start:
{
uint64_t v_value_boxed_178_; lean_object* v_res_179_; 
v_value_boxed_178_ = lean_unbox_uint64(v_value_177_);
lean_dec_ref(v_value_177_);
v_res_179_ = lb_nominal_full_probe_constructor_uint64A(v_value_boxed_178_);
return v_res_179_;
}
}
LEAN_EXPORT lean_object* lb_nominal_full_probe_constructor_uint64B(uint64_t v_value_180_){
_start:
{
uint64_t v___x_181_; uint64_t v___x_182_; lean_object* v___x_183_; 
v___x_181_ = 2ULL;
v___x_182_ = lean_uint64_add(v_value_180_, v___x_181_);
v___x_183_ = l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_uint64A_spec__0___redArg(v___x_182_);
return v___x_183_;
}
}
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_uint64B___boxed(lean_object* v_value_184_){
_start:
{
uint64_t v_value_boxed_185_; lean_object* v_res_186_; 
v_value_boxed_185_ = lean_unbox_uint64(v_value_184_);
lean_dec_ref(v_value_184_);
v_res_186_ = lb_nominal_full_probe_constructor_uint64B(v_value_boxed_185_);
return v_res_186_;
}
}
static lean_object* _init_l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_int8A_spec__0___redArg___closed__0(void){
_start:
{
lean_object* v___x_187_; lean_object* v___x_188_; 
v___x_187_ = lean_unsigned_to_nat(2u);
v___x_188_ = lean_nat_to_int(v___x_187_);
return v___x_188_;
}
}
static lean_object* _init_l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_int8A_spec__0___redArg___closed__1(void){
_start:
{
lean_object* v___x_189_; lean_object* v___x_190_; 
v___x_189_ = lean_unsigned_to_nat(0u);
v___x_190_ = lean_nat_to_int(v___x_189_);
return v___x_190_;
}
}
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_int8A_spec__0___redArg(uint8_t v_value_191_){
_start:
{
lean_object* v___x_192_; lean_object* v___x_193_; lean_object* v___x_194_; lean_object* v___x_195_; uint8_t v___x_196_; 
v___x_192_ = lean_int8_to_int(v_value_191_);
v___x_193_ = lean_obj_once(&l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_int8A_spec__0___redArg___closed__0, &l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_int8A_spec__0___redArg___closed__0_once, _init_l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_int8A_spec__0___redArg___closed__0);
v___x_194_ = lean_int_emod(v___x_192_, v___x_193_);
v___x_195_ = lean_obj_once(&l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_int8A_spec__0___redArg___closed__1, &l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_int8A_spec__0___redArg___closed__1_once, _init_l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_int8A_spec__0___redArg___closed__1);
v___x_196_ = lean_int_dec_eq(v___x_194_, v___x_195_);
lean_dec(v___x_194_);
if (v___x_196_ == 0)
{
lean_object* v___x_197_; 
v___x_197_ = lean_box(0);
return v___x_197_;
}
else
{
lean_object* v___x_198_; lean_object* v___x_199_; 
v___x_198_ = lean_box(v_value_191_);
v___x_199_ = lean_alloc_ctor(1, 1, 0);
lean_ctor_set(v___x_199_, 0, v___x_198_);
return v___x_199_;
}
}
}
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_int8A_spec__0___redArg___boxed(lean_object* v_value_200_){
_start:
{
uint8_t v_value_boxed_201_; lean_object* v_res_202_; 
v_value_boxed_201_ = lean_unbox(v_value_200_);
v_res_202_ = l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_int8A_spec__0___redArg(v_value_boxed_201_);
return v_res_202_;
}
}
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_int8A_spec__0(lean_object* v_predicate_203_, uint8_t v_value_204_){
_start:
{
lean_object* v___x_205_; 
v___x_205_ = l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_int8A_spec__0___redArg(v_value_204_);
return v___x_205_;
}
}
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_int8A_spec__0___boxed(lean_object* v_predicate_206_, lean_object* v_value_207_){
_start:
{
uint8_t v_value_boxed_208_; lean_object* v_res_209_; 
v_value_boxed_208_ = lean_unbox(v_value_207_);
v_res_209_ = l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_int8A_spec__0(v_predicate_206_, v_value_boxed_208_);
return v_res_209_;
}
}
static lean_object* _init_l_NominalPrimitiveSubtypes_int8A___closed__0(void){
_start:
{
lean_object* v___x_210_; lean_object* v___x_211_; 
v___x_210_ = lean_unsigned_to_nat(100u);
v___x_211_ = lean_nat_to_int(v___x_210_);
return v___x_211_;
}
}
LEAN_EXPORT lean_object* lb_nominal_full_probe_constructor_int8A(uint8_t v_value_212_){
_start:
{
lean_object* v___x_213_; lean_object* v___x_214_; uint8_t v___x_215_; 
v___x_213_ = lean_int8_to_int(v_value_212_);
v___x_214_ = lean_obj_once(&l_NominalPrimitiveSubtypes_int8A___closed__0, &l_NominalPrimitiveSubtypes_int8A___closed__0_once, _init_l_NominalPrimitiveSubtypes_int8A___closed__0);
v___x_215_ = lean_int_dec_lt(v___x_213_, v___x_214_);
if (v___x_215_ == 0)
{
lean_object* v___x_216_; 
v___x_216_ = lean_box(0);
return v___x_216_;
}
else
{
lean_object* v___x_217_; 
v___x_217_ = l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_int8A_spec__0___redArg(v_value_212_);
return v___x_217_;
}
}
}
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_int8A___boxed(lean_object* v_value_218_){
_start:
{
uint8_t v_value_boxed_219_; lean_object* v_res_220_; 
v_value_boxed_219_ = lean_unbox(v_value_218_);
v_res_220_ = lb_nominal_full_probe_constructor_int8A(v_value_boxed_219_);
return v_res_220_;
}
}
static uint8_t _init_l_NominalPrimitiveSubtypes_int8B___closed__0(void){
_start:
{
lean_object* v___x_221_; uint8_t v___x_222_; 
v___x_221_ = lean_unsigned_to_nat(2u);
v___x_222_ = lean_int8_of_nat(v___x_221_);
return v___x_222_;
}
}
LEAN_EXPORT lean_object* lb_nominal_full_probe_constructor_int8B(uint8_t v_value_223_){
_start:
{
uint8_t v___x_224_; uint8_t v___x_225_; lean_object* v___x_226_; 
v___x_224_ = lean_uint8_once(&l_NominalPrimitiveSubtypes_int8B___closed__0, &l_NominalPrimitiveSubtypes_int8B___closed__0_once, _init_l_NominalPrimitiveSubtypes_int8B___closed__0);
v___x_225_ = lean_int8_add(v_value_223_, v___x_224_);
v___x_226_ = l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_int8A_spec__0___redArg(v___x_225_);
return v___x_226_;
}
}
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_int8B___boxed(lean_object* v_value_227_){
_start:
{
uint8_t v_value_boxed_228_; lean_object* v_res_229_; 
v_value_boxed_228_ = lean_unbox(v_value_227_);
v_res_229_ = lb_nominal_full_probe_constructor_int8B(v_value_boxed_228_);
return v_res_229_;
}
}
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_int16A_spec__0___redArg(uint16_t v_value_230_){
_start:
{
lean_object* v___x_231_; lean_object* v___x_232_; lean_object* v___x_233_; lean_object* v___x_234_; uint8_t v___x_235_; 
v___x_231_ = lean_int16_to_int(v_value_230_);
v___x_232_ = lean_obj_once(&l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_int8A_spec__0___redArg___closed__0, &l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_int8A_spec__0___redArg___closed__0_once, _init_l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_int8A_spec__0___redArg___closed__0);
v___x_233_ = lean_int_emod(v___x_231_, v___x_232_);
v___x_234_ = lean_obj_once(&l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_int8A_spec__0___redArg___closed__1, &l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_int8A_spec__0___redArg___closed__1_once, _init_l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_int8A_spec__0___redArg___closed__1);
v___x_235_ = lean_int_dec_eq(v___x_233_, v___x_234_);
lean_dec(v___x_233_);
if (v___x_235_ == 0)
{
lean_object* v___x_236_; 
v___x_236_ = lean_box(0);
return v___x_236_;
}
else
{
lean_object* v___x_237_; lean_object* v___x_238_; 
v___x_237_ = lean_box(v_value_230_);
v___x_238_ = lean_alloc_ctor(1, 1, 0);
lean_ctor_set(v___x_238_, 0, v___x_237_);
return v___x_238_;
}
}
}
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_int16A_spec__0___redArg___boxed(lean_object* v_value_239_){
_start:
{
uint16_t v_value_boxed_240_; lean_object* v_res_241_; 
v_value_boxed_240_ = lean_unbox(v_value_239_);
v_res_241_ = l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_int16A_spec__0___redArg(v_value_boxed_240_);
return v_res_241_;
}
}
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_int16A_spec__0(lean_object* v_predicate_242_, uint16_t v_value_243_){
_start:
{
lean_object* v___x_244_; 
v___x_244_ = l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_int16A_spec__0___redArg(v_value_243_);
return v___x_244_;
}
}
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_int16A_spec__0___boxed(lean_object* v_predicate_245_, lean_object* v_value_246_){
_start:
{
uint16_t v_value_boxed_247_; lean_object* v_res_248_; 
v_value_boxed_247_ = lean_unbox(v_value_246_);
v_res_248_ = l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_int16A_spec__0(v_predicate_245_, v_value_boxed_247_);
return v_res_248_;
}
}
LEAN_EXPORT lean_object* lb_nominal_full_probe_constructor_int16A(uint16_t v_value_249_){
_start:
{
lean_object* v___x_250_; lean_object* v___x_251_; uint8_t v___x_252_; 
v___x_250_ = lean_int16_to_int(v_value_249_);
v___x_251_ = lean_obj_once(&l_NominalPrimitiveSubtypes_int8A___closed__0, &l_NominalPrimitiveSubtypes_int8A___closed__0_once, _init_l_NominalPrimitiveSubtypes_int8A___closed__0);
v___x_252_ = lean_int_dec_lt(v___x_250_, v___x_251_);
if (v___x_252_ == 0)
{
lean_object* v___x_253_; 
v___x_253_ = lean_box(0);
return v___x_253_;
}
else
{
lean_object* v___x_254_; 
v___x_254_ = l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_int16A_spec__0___redArg(v_value_249_);
return v___x_254_;
}
}
}
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_int16A___boxed(lean_object* v_value_255_){
_start:
{
uint16_t v_value_boxed_256_; lean_object* v_res_257_; 
v_value_boxed_256_ = lean_unbox(v_value_255_);
v_res_257_ = lb_nominal_full_probe_constructor_int16A(v_value_boxed_256_);
return v_res_257_;
}
}
static uint16_t _init_l_NominalPrimitiveSubtypes_int16B___closed__0(void){
_start:
{
lean_object* v___x_258_; uint16_t v___x_259_; 
v___x_258_ = lean_unsigned_to_nat(2u);
v___x_259_ = lean_int16_of_nat(v___x_258_);
return v___x_259_;
}
}
LEAN_EXPORT lean_object* lb_nominal_full_probe_constructor_int16B(uint16_t v_value_260_){
_start:
{
uint16_t v___x_261_; uint16_t v___x_262_; lean_object* v___x_263_; 
v___x_261_ = lean_uint16_once(&l_NominalPrimitiveSubtypes_int16B___closed__0, &l_NominalPrimitiveSubtypes_int16B___closed__0_once, _init_l_NominalPrimitiveSubtypes_int16B___closed__0);
v___x_262_ = lean_int16_add(v_value_260_, v___x_261_);
v___x_263_ = l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_int16A_spec__0___redArg(v___x_262_);
return v___x_263_;
}
}
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_int16B___boxed(lean_object* v_value_264_){
_start:
{
uint16_t v_value_boxed_265_; lean_object* v_res_266_; 
v_value_boxed_265_ = lean_unbox(v_value_264_);
v_res_266_ = lb_nominal_full_probe_constructor_int16B(v_value_boxed_265_);
return v_res_266_;
}
}
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_int32A_spec__0___redArg(uint32_t v_value_267_){
_start:
{
lean_object* v___x_268_; lean_object* v___x_269_; lean_object* v___x_270_; lean_object* v___x_271_; uint8_t v___x_272_; 
v___x_268_ = lean_int32_to_int(v_value_267_);
v___x_269_ = lean_obj_once(&l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_int8A_spec__0___redArg___closed__0, &l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_int8A_spec__0___redArg___closed__0_once, _init_l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_int8A_spec__0___redArg___closed__0);
v___x_270_ = lean_int_emod(v___x_268_, v___x_269_);
lean_dec(v___x_268_);
v___x_271_ = lean_obj_once(&l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_int8A_spec__0___redArg___closed__1, &l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_int8A_spec__0___redArg___closed__1_once, _init_l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_int8A_spec__0___redArg___closed__1);
v___x_272_ = lean_int_dec_eq(v___x_270_, v___x_271_);
lean_dec(v___x_270_);
if (v___x_272_ == 0)
{
lean_object* v___x_273_; 
v___x_273_ = lean_box(0);
return v___x_273_;
}
else
{
lean_object* v___x_274_; lean_object* v___x_275_; 
v___x_274_ = lean_box_uint32(v_value_267_);
v___x_275_ = lean_alloc_ctor(1, 1, 0);
lean_ctor_set(v___x_275_, 0, v___x_274_);
return v___x_275_;
}
}
}
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_int32A_spec__0___redArg___boxed(lean_object* v_value_276_){
_start:
{
uint32_t v_value_boxed_277_; lean_object* v_res_278_; 
v_value_boxed_277_ = lean_unbox_uint32(v_value_276_);
lean_dec(v_value_276_);
v_res_278_ = l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_int32A_spec__0___redArg(v_value_boxed_277_);
return v_res_278_;
}
}
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_int32A_spec__0(lean_object* v_predicate_279_, uint32_t v_value_280_){
_start:
{
lean_object* v___x_281_; 
v___x_281_ = l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_int32A_spec__0___redArg(v_value_280_);
return v___x_281_;
}
}
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_int32A_spec__0___boxed(lean_object* v_predicate_282_, lean_object* v_value_283_){
_start:
{
uint32_t v_value_boxed_284_; lean_object* v_res_285_; 
v_value_boxed_284_ = lean_unbox_uint32(v_value_283_);
lean_dec(v_value_283_);
v_res_285_ = l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_int32A_spec__0(v_predicate_282_, v_value_boxed_284_);
return v_res_285_;
}
}
LEAN_EXPORT lean_object* lb_nominal_full_probe_constructor_int32A(uint32_t v_value_286_){
_start:
{
lean_object* v___x_287_; lean_object* v___x_288_; uint8_t v___x_289_; 
v___x_287_ = lean_int32_to_int(v_value_286_);
v___x_288_ = lean_obj_once(&l_NominalPrimitiveSubtypes_int8A___closed__0, &l_NominalPrimitiveSubtypes_int8A___closed__0_once, _init_l_NominalPrimitiveSubtypes_int8A___closed__0);
v___x_289_ = lean_int_dec_lt(v___x_287_, v___x_288_);
lean_dec(v___x_287_);
if (v___x_289_ == 0)
{
lean_object* v___x_290_; 
v___x_290_ = lean_box(0);
return v___x_290_;
}
else
{
lean_object* v___x_291_; 
v___x_291_ = l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_int32A_spec__0___redArg(v_value_286_);
return v___x_291_;
}
}
}
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_int32A___boxed(lean_object* v_value_292_){
_start:
{
uint32_t v_value_boxed_293_; lean_object* v_res_294_; 
v_value_boxed_293_ = lean_unbox_uint32(v_value_292_);
lean_dec(v_value_292_);
v_res_294_ = lb_nominal_full_probe_constructor_int32A(v_value_boxed_293_);
return v_res_294_;
}
}
static uint32_t _init_l_NominalPrimitiveSubtypes_int32B___closed__0(void){
_start:
{
lean_object* v___x_295_; uint32_t v___x_296_; 
v___x_295_ = lean_unsigned_to_nat(2u);
v___x_296_ = lean_int32_of_nat(v___x_295_);
return v___x_296_;
}
}
LEAN_EXPORT lean_object* lb_nominal_full_probe_constructor_int32B(uint32_t v_value_297_){
_start:
{
uint32_t v___x_298_; uint32_t v___x_299_; lean_object* v___x_300_; 
v___x_298_ = lean_uint32_once(&l_NominalPrimitiveSubtypes_int32B___closed__0, &l_NominalPrimitiveSubtypes_int32B___closed__0_once, _init_l_NominalPrimitiveSubtypes_int32B___closed__0);
v___x_299_ = lean_int32_add(v_value_297_, v___x_298_);
v___x_300_ = l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_int32A_spec__0___redArg(v___x_299_);
return v___x_300_;
}
}
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_int32B___boxed(lean_object* v_value_301_){
_start:
{
uint32_t v_value_boxed_302_; lean_object* v_res_303_; 
v_value_boxed_302_ = lean_unbox_uint32(v_value_301_);
lean_dec(v_value_301_);
v_res_303_ = lb_nominal_full_probe_constructor_int32B(v_value_boxed_302_);
return v_res_303_;
}
}
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_int64A_spec__0___redArg(uint64_t v_value_304_){
_start:
{
lean_object* v___x_305_; lean_object* v___x_306_; lean_object* v___x_307_; lean_object* v___x_308_; uint8_t v___x_309_; 
v___x_305_ = lean_int64_to_int_sint(v_value_304_);
v___x_306_ = lean_obj_once(&l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_int8A_spec__0___redArg___closed__0, &l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_int8A_spec__0___redArg___closed__0_once, _init_l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_int8A_spec__0___redArg___closed__0);
v___x_307_ = lean_int_emod(v___x_305_, v___x_306_);
lean_dec(v___x_305_);
v___x_308_ = lean_obj_once(&l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_int8A_spec__0___redArg___closed__1, &l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_int8A_spec__0___redArg___closed__1_once, _init_l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_int8A_spec__0___redArg___closed__1);
v___x_309_ = lean_int_dec_eq(v___x_307_, v___x_308_);
lean_dec(v___x_307_);
if (v___x_309_ == 0)
{
lean_object* v___x_310_; 
v___x_310_ = lean_box(0);
return v___x_310_;
}
else
{
lean_object* v___x_311_; lean_object* v___x_312_; 
v___x_311_ = lean_box_uint64(v_value_304_);
v___x_312_ = lean_alloc_ctor(1, 1, 0);
lean_ctor_set(v___x_312_, 0, v___x_311_);
return v___x_312_;
}
}
}
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_int64A_spec__0___redArg___boxed(lean_object* v_value_313_){
_start:
{
uint64_t v_value_boxed_314_; lean_object* v_res_315_; 
v_value_boxed_314_ = lean_unbox_uint64(v_value_313_);
lean_dec_ref(v_value_313_);
v_res_315_ = l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_int64A_spec__0___redArg(v_value_boxed_314_);
return v_res_315_;
}
}
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_int64A_spec__0(lean_object* v_predicate_316_, uint64_t v_value_317_){
_start:
{
lean_object* v___x_318_; 
v___x_318_ = l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_int64A_spec__0___redArg(v_value_317_);
return v___x_318_;
}
}
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_int64A_spec__0___boxed(lean_object* v_predicate_319_, lean_object* v_value_320_){
_start:
{
uint64_t v_value_boxed_321_; lean_object* v_res_322_; 
v_value_boxed_321_ = lean_unbox_uint64(v_value_320_);
lean_dec_ref(v_value_320_);
v_res_322_ = l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_int64A_spec__0(v_predicate_319_, v_value_boxed_321_);
return v_res_322_;
}
}
LEAN_EXPORT lean_object* lb_nominal_full_probe_constructor_int64A(uint64_t v_value_323_){
_start:
{
lean_object* v___x_324_; lean_object* v___x_325_; uint8_t v___x_326_; 
v___x_324_ = lean_int64_to_int_sint(v_value_323_);
v___x_325_ = lean_obj_once(&l_NominalPrimitiveSubtypes_int8A___closed__0, &l_NominalPrimitiveSubtypes_int8A___closed__0_once, _init_l_NominalPrimitiveSubtypes_int8A___closed__0);
v___x_326_ = lean_int_dec_lt(v___x_324_, v___x_325_);
lean_dec(v___x_324_);
if (v___x_326_ == 0)
{
lean_object* v___x_327_; 
v___x_327_ = lean_box(0);
return v___x_327_;
}
else
{
lean_object* v___x_328_; 
v___x_328_ = l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_int64A_spec__0___redArg(v_value_323_);
return v___x_328_;
}
}
}
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_int64A___boxed(lean_object* v_value_329_){
_start:
{
uint64_t v_value_boxed_330_; lean_object* v_res_331_; 
v_value_boxed_330_ = lean_unbox_uint64(v_value_329_);
lean_dec_ref(v_value_329_);
v_res_331_ = lb_nominal_full_probe_constructor_int64A(v_value_boxed_330_);
return v_res_331_;
}
}
static uint64_t _init_l_NominalPrimitiveSubtypes_int64B___closed__0(void){
_start:
{
lean_object* v___x_332_; uint64_t v___x_333_; 
v___x_332_ = lean_unsigned_to_nat(2u);
v___x_333_ = lean_int64_of_nat(v___x_332_);
return v___x_333_;
}
}
LEAN_EXPORT lean_object* lb_nominal_full_probe_constructor_int64B(uint64_t v_value_334_){
_start:
{
uint64_t v___x_335_; uint64_t v___x_336_; lean_object* v___x_337_; 
v___x_335_ = lean_uint64_once(&l_NominalPrimitiveSubtypes_int64B___closed__0, &l_NominalPrimitiveSubtypes_int64B___closed__0_once, _init_l_NominalPrimitiveSubtypes_int64B___closed__0);
v___x_336_ = lean_int64_add(v_value_334_, v___x_335_);
v___x_337_ = l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_int64A_spec__0___redArg(v___x_336_);
return v___x_337_;
}
}
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_int64B___boxed(lean_object* v_value_338_){
_start:
{
uint64_t v_value_boxed_339_; lean_object* v_res_340_; 
v_value_boxed_339_ = lean_unbox_uint64(v_value_338_);
lean_dec_ref(v_value_338_);
v_res_340_ = lb_nominal_full_probe_constructor_int64B(v_value_boxed_339_);
return v_res_340_;
}
}
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_natA_spec__0___redArg(lean_object* v_value_341_){
_start:
{
lean_object* v___x_342_; lean_object* v___x_343_; lean_object* v___x_344_; uint8_t v___x_345_; 
v___x_342_ = lean_unsigned_to_nat(2u);
v___x_343_ = lean_nat_mod(v_value_341_, v___x_342_);
v___x_344_ = lean_unsigned_to_nat(0u);
v___x_345_ = lean_nat_dec_eq(v___x_343_, v___x_344_);
lean_dec(v___x_343_);
if (v___x_345_ == 0)
{
lean_object* v___x_346_; 
lean_dec(v_value_341_);
v___x_346_ = lean_box(0);
return v___x_346_;
}
else
{
lean_object* v___x_347_; 
v___x_347_ = lean_alloc_ctor(1, 1, 0);
lean_ctor_set(v___x_347_, 0, v_value_341_);
return v___x_347_;
}
}
}
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_natA_spec__0(lean_object* v_predicate_348_, lean_object* v_value_349_){
_start:
{
lean_object* v___x_350_; 
v___x_350_ = l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_natA_spec__0___redArg(v_value_349_);
return v___x_350_;
}
}
LEAN_EXPORT lean_object* lb_nominal_full_probe_constructor_natA(lean_object* v_value_351_){
_start:
{
lean_object* v___x_352_; uint8_t v___x_353_; 
v___x_352_ = lean_unsigned_to_nat(100u);
v___x_353_ = lean_nat_dec_lt(v_value_351_, v___x_352_);
if (v___x_353_ == 0)
{
lean_object* v___x_354_; 
lean_dec(v_value_351_);
v___x_354_ = lean_box(0);
return v___x_354_;
}
else
{
lean_object* v___x_355_; 
v___x_355_ = l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_natA_spec__0___redArg(v_value_351_);
return v___x_355_;
}
}
}
LEAN_EXPORT lean_object* lb_nominal_full_probe_constructor_natB(lean_object* v_value_356_){
_start:
{
lean_object* v___x_357_; lean_object* v___x_358_; lean_object* v___x_359_; 
v___x_357_ = lean_unsigned_to_nat(2u);
v___x_358_ = lean_nat_add(v_value_356_, v___x_357_);
lean_dec(v_value_356_);
v___x_359_ = l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_natA_spec__0___redArg(v___x_358_);
return v___x_359_;
}
}
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_intA_spec__0___redArg(lean_object* v_value_360_){
_start:
{
lean_object* v___x_361_; lean_object* v___x_362_; lean_object* v___x_363_; uint8_t v___x_364_; 
v___x_361_ = lean_obj_once(&l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_int8A_spec__0___redArg___closed__0, &l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_int8A_spec__0___redArg___closed__0_once, _init_l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_int8A_spec__0___redArg___closed__0);
v___x_362_ = lean_int_emod(v_value_360_, v___x_361_);
v___x_363_ = lean_obj_once(&l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_int8A_spec__0___redArg___closed__1, &l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_int8A_spec__0___redArg___closed__1_once, _init_l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_int8A_spec__0___redArg___closed__1);
v___x_364_ = lean_int_dec_eq(v___x_362_, v___x_363_);
lean_dec(v___x_362_);
if (v___x_364_ == 0)
{
lean_object* v___x_365_; 
lean_dec(v_value_360_);
v___x_365_ = lean_box(0);
return v___x_365_;
}
else
{
lean_object* v___x_366_; 
v___x_366_ = lean_alloc_ctor(1, 1, 0);
lean_ctor_set(v___x_366_, 0, v_value_360_);
return v___x_366_;
}
}
}
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_intA_spec__0(lean_object* v_predicate_367_, lean_object* v_value_368_){
_start:
{
lean_object* v___x_369_; 
v___x_369_ = l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_intA_spec__0___redArg(v_value_368_);
return v___x_369_;
}
}
LEAN_EXPORT lean_object* lb_nominal_full_probe_constructor_intA(lean_object* v_value_370_){
_start:
{
lean_object* v___x_371_; uint8_t v___x_372_; 
v___x_371_ = lean_obj_once(&l_NominalPrimitiveSubtypes_int8A___closed__0, &l_NominalPrimitiveSubtypes_int8A___closed__0_once, _init_l_NominalPrimitiveSubtypes_int8A___closed__0);
v___x_372_ = lean_int_dec_lt(v_value_370_, v___x_371_);
if (v___x_372_ == 0)
{
lean_object* v___x_373_; 
lean_dec(v_value_370_);
v___x_373_ = lean_box(0);
return v___x_373_;
}
else
{
lean_object* v___x_374_; 
v___x_374_ = l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_intA_spec__0___redArg(v_value_370_);
return v___x_374_;
}
}
}
LEAN_EXPORT lean_object* lb_nominal_full_probe_constructor_intB(lean_object* v_value_375_){
_start:
{
lean_object* v___x_376_; lean_object* v___x_377_; lean_object* v___x_378_; 
v___x_376_ = lean_obj_once(&l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_int8A_spec__0___redArg___closed__0, &l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_int8A_spec__0___redArg___closed__0_once, _init_l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_int8A_spec__0___redArg___closed__0);
v___x_377_ = lean_int_add(v_value_375_, v___x_376_);
lean_dec(v_value_375_);
v___x_378_ = l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_intA_spec__0___redArg(v___x_377_);
return v___x_378_;
}
}
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_float32A_spec__0___redArg(float v_value_379_){
_start:
{
uint8_t v___x_380_; 
v___x_380_ = lean_float32_isfinite(v_value_379_);
if (v___x_380_ == 0)
{
lean_object* v___x_381_; 
v___x_381_ = lean_box(0);
return v___x_381_;
}
else
{
lean_object* v___x_382_; lean_object* v___x_383_; 
v___x_382_ = lean_box_float32(v_value_379_);
v___x_383_ = lean_alloc_ctor(1, 1, 0);
lean_ctor_set(v___x_383_, 0, v___x_382_);
return v___x_383_;
}
}
}
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_float32A_spec__0___redArg___boxed(lean_object* v_value_384_){
_start:
{
float v_value_boxed_385_; lean_object* v_res_386_; 
v_value_boxed_385_ = lean_unbox_float32(v_value_384_);
lean_dec_ref(v_value_384_);
v_res_386_ = l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_float32A_spec__0___redArg(v_value_boxed_385_);
return v_res_386_;
}
}
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_float32A_spec__0(lean_object* v_predicate_387_, float v_value_388_){
_start:
{
lean_object* v___x_389_; 
v___x_389_ = l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_float32A_spec__0___redArg(v_value_388_);
return v___x_389_;
}
}
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_float32A_spec__0___boxed(lean_object* v_predicate_390_, lean_object* v_value_391_){
_start:
{
float v_value_boxed_392_; lean_object* v_res_393_; 
v_value_boxed_392_ = lean_unbox_float32(v_value_391_);
lean_dec_ref(v_value_391_);
v_res_393_ = l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_float32A_spec__0(v_predicate_390_, v_value_boxed_392_);
return v_res_393_;
}
}
static float _init_l_NominalPrimitiveSubtypes_float32A___closed__0(void){
_start:
{
lean_object* v___x_394_; float v___x_395_; 
v___x_394_ = lean_unsigned_to_nat(10u);
v___x_395_ = lean_float32_of_nat(v___x_394_);
return v___x_395_;
}
}
LEAN_EXPORT lean_object* lb_nominal_full_probe_constructor_float32A(float v_value_396_){
_start:
{
float v___x_397_; uint8_t v___x_398_; 
v___x_397_ = lean_float32_once(&l_NominalPrimitiveSubtypes_float32A___closed__0, &l_NominalPrimitiveSubtypes_float32A___closed__0_once, _init_l_NominalPrimitiveSubtypes_float32A___closed__0);
v___x_398_ = lean_float32_decLt(v_value_396_, v___x_397_);
if (v___x_398_ == 0)
{
lean_object* v___x_399_; 
v___x_399_ = lean_box(0);
return v___x_399_;
}
else
{
lean_object* v___x_400_; 
v___x_400_ = l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_float32A_spec__0___redArg(v_value_396_);
return v___x_400_;
}
}
}
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_float32A___boxed(lean_object* v_value_401_){
_start:
{
float v_value_boxed_402_; lean_object* v_res_403_; 
v_value_boxed_402_ = lean_unbox_float32(v_value_401_);
lean_dec_ref(v_value_401_);
v_res_403_ = lb_nominal_full_probe_constructor_float32A(v_value_boxed_402_);
return v_res_403_;
}
}
LEAN_EXPORT lean_object* lb_nominal_full_probe_constructor_float32B(float v_value_404_){
_start:
{
float v___x_405_; lean_object* v___x_406_; 
v___x_405_ = lean_float32_negate(v_value_404_);
v___x_406_ = l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_float32A_spec__0___redArg(v___x_405_);
return v___x_406_;
}
}
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_float32B___boxed(lean_object* v_value_407_){
_start:
{
float v_value_boxed_408_; lean_object* v_res_409_; 
v_value_boxed_408_ = lean_unbox_float32(v_value_407_);
lean_dec_ref(v_value_407_);
v_res_409_ = lb_nominal_full_probe_constructor_float32B(v_value_boxed_408_);
return v_res_409_;
}
}
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_float64A_spec__0___redArg(double v_value_410_){
_start:
{
uint8_t v___x_411_; 
v___x_411_ = lean_float_isfinite(v_value_410_);
if (v___x_411_ == 0)
{
lean_object* v___x_412_; 
v___x_412_ = lean_box(0);
return v___x_412_;
}
else
{
lean_object* v___x_413_; lean_object* v___x_414_; 
v___x_413_ = lean_box_float(v_value_410_);
v___x_414_ = lean_alloc_ctor(1, 1, 0);
lean_ctor_set(v___x_414_, 0, v___x_413_);
return v___x_414_;
}
}
}
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_float64A_spec__0___redArg___boxed(lean_object* v_value_415_){
_start:
{
double v_value_boxed_416_; lean_object* v_res_417_; 
v_value_boxed_416_ = lean_unbox_float(v_value_415_);
lean_dec_ref(v_value_415_);
v_res_417_ = l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_float64A_spec__0___redArg(v_value_boxed_416_);
return v_res_417_;
}
}
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_float64A_spec__0(lean_object* v_predicate_418_, double v_value_419_){
_start:
{
lean_object* v___x_420_; 
v___x_420_ = l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_float64A_spec__0___redArg(v_value_419_);
return v___x_420_;
}
}
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_float64A_spec__0___boxed(lean_object* v_predicate_421_, lean_object* v_value_422_){
_start:
{
double v_value_boxed_423_; lean_object* v_res_424_; 
v_value_boxed_423_ = lean_unbox_float(v_value_422_);
lean_dec_ref(v_value_422_);
v_res_424_ = l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_float64A_spec__0(v_predicate_421_, v_value_boxed_423_);
return v_res_424_;
}
}
static double _init_l_NominalPrimitiveSubtypes_float64A___closed__0(void){
_start:
{
lean_object* v___x_425_; double v___x_426_; 
v___x_425_ = lean_unsigned_to_nat(10u);
v___x_426_ = lean_float_of_nat(v___x_425_);
return v___x_426_;
}
}
LEAN_EXPORT lean_object* lb_nominal_full_probe_constructor_float64A(double v_value_427_){
_start:
{
double v___x_428_; uint8_t v___x_429_; 
v___x_428_ = lean_float_once(&l_NominalPrimitiveSubtypes_float64A___closed__0, &l_NominalPrimitiveSubtypes_float64A___closed__0_once, _init_l_NominalPrimitiveSubtypes_float64A___closed__0);
v___x_429_ = lean_float_decLt(v_value_427_, v___x_428_);
if (v___x_429_ == 0)
{
lean_object* v___x_430_; 
v___x_430_ = lean_box(0);
return v___x_430_;
}
else
{
lean_object* v___x_431_; 
v___x_431_ = l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_float64A_spec__0___redArg(v_value_427_);
return v___x_431_;
}
}
}
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_float64A___boxed(lean_object* v_value_432_){
_start:
{
double v_value_boxed_433_; lean_object* v_res_434_; 
v_value_boxed_433_ = lean_unbox_float(v_value_432_);
lean_dec_ref(v_value_432_);
v_res_434_ = lb_nominal_full_probe_constructor_float64A(v_value_boxed_433_);
return v_res_434_;
}
}
LEAN_EXPORT lean_object* lb_nominal_full_probe_constructor_float64B(double v_value_435_){
_start:
{
double v___x_436_; lean_object* v___x_437_; 
v___x_436_ = lean_float_negate(v_value_435_);
v___x_437_ = l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_float64A_spec__0___redArg(v___x_436_);
return v___x_437_;
}
}
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_float64B___boxed(lean_object* v_value_438_){
_start:
{
double v_value_boxed_439_; lean_object* v_res_440_; 
v_value_boxed_439_ = lean_unbox_float(v_value_438_);
lean_dec_ref(v_value_438_);
v_res_440_ = lb_nominal_full_probe_constructor_float64B(v_value_boxed_439_);
return v_res_440_;
}
}
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_textA_spec__0___redArg(lean_object* v_value_441_){
_start:
{
lean_object* v___x_442_; lean_object* v___x_443_; uint8_t v___x_444_; 
v___x_442_ = lean_unsigned_to_nat(0u);
v___x_443_ = lean_string_length(v_value_441_);
v___x_444_ = lean_nat_dec_lt(v___x_442_, v___x_443_);
if (v___x_444_ == 0)
{
lean_object* v___x_445_; 
lean_dec_ref(v_value_441_);
v___x_445_ = lean_box(0);
return v___x_445_;
}
else
{
lean_object* v___x_446_; 
v___x_446_ = lean_alloc_ctor(1, 1, 0);
lean_ctor_set(v___x_446_, 0, v_value_441_);
return v___x_446_;
}
}
}
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_textA_spec__0(lean_object* v_predicate_447_, lean_object* v_value_448_){
_start:
{
lean_object* v___x_449_; 
v___x_449_ = l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_textA_spec__0___redArg(v_value_448_);
return v___x_449_;
}
}
LEAN_EXPORT lean_object* lb_nominal_full_probe_constructor_textA(lean_object* v_value_450_){
_start:
{
lean_object* v___x_451_; lean_object* v___x_452_; uint8_t v___x_453_; 
v___x_451_ = lean_string_length(v_value_450_);
v___x_452_ = lean_unsigned_to_nat(8u);
v___x_453_ = lean_nat_dec_lt(v___x_451_, v___x_452_);
if (v___x_453_ == 0)
{
lean_object* v___x_454_; 
lean_dec_ref(v_value_450_);
v___x_454_ = lean_box(0);
return v___x_454_;
}
else
{
lean_object* v___x_455_; 
v___x_455_ = l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_textA_spec__0___redArg(v_value_450_);
return v___x_455_;
}
}
}
LEAN_EXPORT lean_object* lb_nominal_full_probe_constructor_textB(lean_object* v_value_457_){
_start:
{
lean_object* v___x_458_; lean_object* v___x_459_; lean_object* v___x_460_; 
v___x_458_ = ((lean_object*)(l_NominalPrimitiveSubtypes_textB___closed__0));
v___x_459_ = lean_string_append(v_value_457_, v___x_458_);
v___x_460_ = l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_textA_spec__0___redArg(v___x_459_);
return v___x_460_;
}
}
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_bytesA_spec__0___redArg(lean_object* v_value_461_){
_start:
{
lean_object* v___x_462_; lean_object* v___x_463_; uint8_t v___x_464_; 
v___x_462_ = lean_unsigned_to_nat(0u);
v___x_463_ = lean_byte_array_size(v_value_461_);
v___x_464_ = lean_nat_dec_lt(v___x_462_, v___x_463_);
if (v___x_464_ == 0)
{
lean_object* v___x_465_; 
lean_dec_ref(v_value_461_);
v___x_465_ = lean_box(0);
return v___x_465_;
}
else
{
lean_object* v___x_466_; 
v___x_466_ = lean_alloc_ctor(1, 1, 0);
lean_ctor_set(v___x_466_, 0, v_value_461_);
return v___x_466_;
}
}
}
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_bytesA_spec__0(lean_object* v_predicate_467_, lean_object* v_value_468_){
_start:
{
lean_object* v___x_469_; 
v___x_469_ = l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_bytesA_spec__0___redArg(v_value_468_);
return v___x_469_;
}
}
LEAN_EXPORT lean_object* lb_nominal_full_probe_constructor_bytesA(lean_object* v_value_470_){
_start:
{
lean_object* v___x_471_; lean_object* v___x_472_; uint8_t v___x_473_; 
v___x_471_ = lean_byte_array_size(v_value_470_);
v___x_472_ = lean_unsigned_to_nat(8u);
v___x_473_ = lean_nat_dec_lt(v___x_471_, v___x_472_);
if (v___x_473_ == 0)
{
lean_object* v___x_474_; 
lean_dec_ref(v_value_470_);
v___x_474_ = lean_box(0);
return v___x_474_;
}
else
{
lean_object* v___x_475_; 
v___x_475_ = l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_bytesA_spec__0___redArg(v_value_470_);
return v___x_475_;
}
}
}
LEAN_EXPORT lean_object* lb_nominal_full_probe_constructor_bytesB(lean_object* v_value_476_){
_start:
{
uint8_t v___x_477_; lean_object* v___x_478_; lean_object* v___x_479_; 
v___x_477_ = 255;
v___x_478_ = lean_byte_array_push(v_value_476_, v___x_477_);
v___x_479_ = l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_bytesA_spec__0___redArg(v___x_478_);
return v___x_479_;
}
}
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_charA_spec__0___redArg(uint32_t v_value_480_){
_start:
{
lean_object* v___x_481_; lean_object* v___x_482_; uint8_t v___x_483_; 
v___x_481_ = lean_uint32_to_nat(v_value_480_);
v___x_482_ = lean_unsigned_to_nat(0u);
v___x_483_ = lean_nat_dec_eq(v___x_481_, v___x_482_);
lean_dec(v___x_481_);
if (v___x_483_ == 0)
{
lean_object* v___x_484_; lean_object* v___x_485_; 
v___x_484_ = lean_box_uint32(v_value_480_);
v___x_485_ = lean_alloc_ctor(1, 1, 0);
lean_ctor_set(v___x_485_, 0, v___x_484_);
return v___x_485_;
}
else
{
lean_object* v___x_486_; 
v___x_486_ = lean_box(0);
return v___x_486_;
}
}
}
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_charA_spec__0___redArg___boxed(lean_object* v_value_487_){
_start:
{
uint32_t v_value_boxed_488_; lean_object* v_res_489_; 
v_value_boxed_488_ = lean_unbox_uint32(v_value_487_);
lean_dec(v_value_487_);
v_res_489_ = l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_charA_spec__0___redArg(v_value_boxed_488_);
return v_res_489_;
}
}
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_charA_spec__0(lean_object* v_predicate_490_, uint32_t v_value_491_){
_start:
{
lean_object* v___x_492_; 
v___x_492_ = l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_charA_spec__0___redArg(v_value_491_);
return v___x_492_;
}
}
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_charA_spec__0___boxed(lean_object* v_predicate_493_, lean_object* v_value_494_){
_start:
{
uint32_t v_value_boxed_495_; lean_object* v_res_496_; 
v_value_boxed_495_ = lean_unbox_uint32(v_value_494_);
lean_dec(v_value_494_);
v_res_496_ = l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_charA_spec__0(v_predicate_493_, v_value_boxed_495_);
return v_res_496_;
}
}
LEAN_EXPORT lean_object* lb_nominal_full_probe_constructor_charA(uint32_t v_value_497_){
_start:
{
lean_object* v___x_498_; lean_object* v___x_499_; uint8_t v___x_500_; 
v___x_498_ = lean_uint32_to_nat(v_value_497_);
v___x_499_ = lean_unsigned_to_nat(128u);
v___x_500_ = lean_nat_dec_lt(v___x_498_, v___x_499_);
lean_dec(v___x_498_);
if (v___x_500_ == 0)
{
lean_object* v___x_501_; 
v___x_501_ = lean_box(0);
return v___x_501_;
}
else
{
lean_object* v___x_502_; 
v___x_502_ = l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_charA_spec__0___redArg(v_value_497_);
return v___x_502_;
}
}
}
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_charA___boxed(lean_object* v_value_503_){
_start:
{
uint32_t v_value_boxed_504_; lean_object* v_res_505_; 
v_value_boxed_504_ = lean_unbox_uint32(v_value_503_);
lean_dec(v_value_503_);
v_res_505_ = lb_nominal_full_probe_constructor_charA(v_value_boxed_504_);
return v_res_505_;
}
}
static lean_object* _init_l_NominalPrimitiveSubtypes_charB___closed__0(void){
_start:
{
uint32_t v___x_506_; lean_object* v___x_507_; 
v___x_506_ = 98;
v___x_507_ = l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_charA_spec__0___redArg(v___x_506_);
return v___x_507_;
}
}
LEAN_EXPORT lean_object* lb_nominal_full_probe_constructor_charB(uint32_t v_value_508_){
_start:
{
uint32_t v___x_509_; uint8_t v___x_510_; 
v___x_509_ = 97;
v___x_510_ = lean_uint32_dec_eq(v_value_508_, v___x_509_);
if (v___x_510_ == 0)
{
lean_object* v___x_511_; 
v___x_511_ = l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_charA_spec__0___redArg(v_value_508_);
return v___x_511_;
}
else
{
lean_object* v___x_512_; 
v___x_512_ = lean_obj_once(&l_NominalPrimitiveSubtypes_charB___closed__0, &l_NominalPrimitiveSubtypes_charB___closed__0_once, _init_l_NominalPrimitiveSubtypes_charB___closed__0);
return v___x_512_;
}
}
}
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_charB___boxed(lean_object* v_value_513_){
_start:
{
uint32_t v_value_boxed_514_; lean_object* v_res_515_; 
v_value_boxed_514_ = lean_unbox_uint32(v_value_513_);
lean_dec(v_value_513_);
v_res_515_ = lb_nominal_full_probe_constructor_charB(v_value_boxed_514_);
return v_res_515_;
}
}
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_usizeA_spec__0___redArg(size_t v_value_516_){
_start:
{
lean_object* v___x_517_; lean_object* v___x_518_; lean_object* v___x_519_; lean_object* v___x_520_; uint8_t v___x_521_; 
v___x_517_ = lean_usize_to_nat(v_value_516_);
v___x_518_ = lean_unsigned_to_nat(2u);
v___x_519_ = lean_nat_mod(v___x_517_, v___x_518_);
lean_dec(v___x_517_);
v___x_520_ = lean_unsigned_to_nat(0u);
v___x_521_ = lean_nat_dec_eq(v___x_519_, v___x_520_);
lean_dec(v___x_519_);
if (v___x_521_ == 0)
{
lean_object* v___x_522_; 
v___x_522_ = lean_box(0);
return v___x_522_;
}
else
{
lean_object* v___x_523_; lean_object* v___x_524_; 
v___x_523_ = lean_box_usize(v_value_516_);
v___x_524_ = lean_alloc_ctor(1, 1, 0);
lean_ctor_set(v___x_524_, 0, v___x_523_);
return v___x_524_;
}
}
}
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_usizeA_spec__0___redArg___boxed(lean_object* v_value_525_){
_start:
{
size_t v_value_boxed_526_; lean_object* v_res_527_; 
v_value_boxed_526_ = lean_unbox_usize(v_value_525_);
lean_dec(v_value_525_);
v_res_527_ = l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_usizeA_spec__0___redArg(v_value_boxed_526_);
return v_res_527_;
}
}
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_usizeA_spec__0(lean_object* v_predicate_528_, size_t v_value_529_){
_start:
{
lean_object* v___x_530_; 
v___x_530_ = l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_usizeA_spec__0___redArg(v_value_529_);
return v___x_530_;
}
}
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_usizeA_spec__0___boxed(lean_object* v_predicate_531_, lean_object* v_value_532_){
_start:
{
size_t v_value_boxed_533_; lean_object* v_res_534_; 
v_value_boxed_533_ = lean_unbox_usize(v_value_532_);
lean_dec(v_value_532_);
v_res_534_ = l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_usizeA_spec__0(v_predicate_531_, v_value_boxed_533_);
return v_res_534_;
}
}
LEAN_EXPORT lean_object* lb_nominal_full_probe_constructor_usizeA(size_t v_value_535_){
_start:
{
lean_object* v___x_536_; lean_object* v___x_537_; uint8_t v___x_538_; 
v___x_536_ = lean_usize_to_nat(v_value_535_);
v___x_537_ = lean_unsigned_to_nat(100u);
v___x_538_ = lean_nat_dec_lt(v___x_536_, v___x_537_);
lean_dec(v___x_536_);
if (v___x_538_ == 0)
{
lean_object* v___x_539_; 
v___x_539_ = lean_box(0);
return v___x_539_;
}
else
{
lean_object* v___x_540_; 
v___x_540_ = l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_usizeA_spec__0___redArg(v_value_535_);
return v___x_540_;
}
}
}
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_usizeA___boxed(lean_object* v_value_541_){
_start:
{
size_t v_value_boxed_542_; lean_object* v_res_543_; 
v_value_boxed_542_ = lean_unbox_usize(v_value_541_);
lean_dec(v_value_541_);
v_res_543_ = lb_nominal_full_probe_constructor_usizeA(v_value_boxed_542_);
return v_res_543_;
}
}
LEAN_EXPORT lean_object* lb_nominal_full_probe_constructor_usizeB(size_t v_value_544_){
_start:
{
size_t v___x_545_; size_t v___x_546_; lean_object* v___x_547_; 
v___x_545_ = ((size_t)2ULL);
v___x_546_ = lean_usize_add(v_value_544_, v___x_545_);
v___x_547_ = l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_usizeA_spec__0___redArg(v___x_546_);
return v___x_547_;
}
}
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_usizeB___boxed(lean_object* v_value_548_){
_start:
{
size_t v_value_boxed_549_; lean_object* v_res_550_; 
v_value_boxed_549_ = lean_unbox_usize(v_value_548_);
lean_dec(v_value_548_);
v_res_550_ = lb_nominal_full_probe_constructor_usizeB(v_value_boxed_549_);
return v_res_550_;
}
}
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_isizeA_spec__0___redArg(size_t v_value_551_){
_start:
{
lean_object* v___x_552_; lean_object* v___x_553_; lean_object* v___x_554_; lean_object* v___x_555_; uint8_t v___x_556_; 
v___x_552_ = lean_isize_to_int(v_value_551_);
v___x_553_ = lean_obj_once(&l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_int8A_spec__0___redArg___closed__0, &l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_int8A_spec__0___redArg___closed__0_once, _init_l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_int8A_spec__0___redArg___closed__0);
v___x_554_ = lean_int_emod(v___x_552_, v___x_553_);
lean_dec(v___x_552_);
v___x_555_ = lean_obj_once(&l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_int8A_spec__0___redArg___closed__1, &l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_int8A_spec__0___redArg___closed__1_once, _init_l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_int8A_spec__0___redArg___closed__1);
v___x_556_ = lean_int_dec_eq(v___x_554_, v___x_555_);
lean_dec(v___x_554_);
if (v___x_556_ == 0)
{
lean_object* v___x_557_; 
v___x_557_ = lean_box(0);
return v___x_557_;
}
else
{
lean_object* v___x_558_; lean_object* v___x_559_; 
v___x_558_ = lean_box_usize(v_value_551_);
v___x_559_ = lean_alloc_ctor(1, 1, 0);
lean_ctor_set(v___x_559_, 0, v___x_558_);
return v___x_559_;
}
}
}
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_isizeA_spec__0___redArg___boxed(lean_object* v_value_560_){
_start:
{
size_t v_value_boxed_561_; lean_object* v_res_562_; 
v_value_boxed_561_ = lean_unbox_usize(v_value_560_);
lean_dec(v_value_560_);
v_res_562_ = l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_isizeA_spec__0___redArg(v_value_boxed_561_);
return v_res_562_;
}
}
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_isizeA_spec__0(lean_object* v_predicate_563_, size_t v_value_564_){
_start:
{
lean_object* v___x_565_; 
v___x_565_ = l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_isizeA_spec__0___redArg(v_value_564_);
return v___x_565_;
}
}
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_isizeA_spec__0___boxed(lean_object* v_predicate_566_, lean_object* v_value_567_){
_start:
{
size_t v_value_boxed_568_; lean_object* v_res_569_; 
v_value_boxed_568_ = lean_unbox_usize(v_value_567_);
lean_dec(v_value_567_);
v_res_569_ = l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_isizeA_spec__0(v_predicate_566_, v_value_boxed_568_);
return v_res_569_;
}
}
LEAN_EXPORT lean_object* lb_nominal_full_probe_constructor_isizeA(size_t v_value_570_){
_start:
{
lean_object* v___x_571_; lean_object* v___x_572_; uint8_t v___x_573_; 
v___x_571_ = lean_isize_to_int(v_value_570_);
v___x_572_ = lean_obj_once(&l_NominalPrimitiveSubtypes_int8A___closed__0, &l_NominalPrimitiveSubtypes_int8A___closed__0_once, _init_l_NominalPrimitiveSubtypes_int8A___closed__0);
v___x_573_ = lean_int_dec_lt(v___x_571_, v___x_572_);
lean_dec(v___x_571_);
if (v___x_573_ == 0)
{
lean_object* v___x_574_; 
v___x_574_ = lean_box(0);
return v___x_574_;
}
else
{
lean_object* v___x_575_; 
v___x_575_ = l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_isizeA_spec__0___redArg(v_value_570_);
return v___x_575_;
}
}
}
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_isizeA___boxed(lean_object* v_value_576_){
_start:
{
size_t v_value_boxed_577_; lean_object* v_res_578_; 
v_value_boxed_577_ = lean_unbox_usize(v_value_576_);
lean_dec(v_value_576_);
v_res_578_ = lb_nominal_full_probe_constructor_isizeA(v_value_boxed_577_);
return v_res_578_;
}
}
static size_t _init_l_NominalPrimitiveSubtypes_isizeB___closed__0(void){
_start:
{
lean_object* v___x_579_; size_t v___x_580_; 
v___x_579_ = lean_unsigned_to_nat(2u);
v___x_580_ = lean_isize_of_nat(v___x_579_);
return v___x_580_;
}
}
LEAN_EXPORT lean_object* lb_nominal_full_probe_constructor_isizeB(size_t v_value_581_){
_start:
{
size_t v___x_582_; size_t v___x_583_; lean_object* v___x_584_; 
v___x_582_ = lean_usize_once(&l_NominalPrimitiveSubtypes_isizeB___closed__0, &l_NominalPrimitiveSubtypes_isizeB___closed__0_once, _init_l_NominalPrimitiveSubtypes_isizeB___closed__0);
v___x_583_ = lean_isize_add(v_value_581_, v___x_582_);
v___x_584_ = l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_isizeA_spec__0___redArg(v___x_583_);
return v___x_584_;
}
}
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_isizeB___boxed(lean_object* v_value_585_){
_start:
{
size_t v_value_boxed_586_; lean_object* v_res_587_; 
v_value_boxed_586_ = lean_unbox_usize(v_value_585_);
lean_dec(v_value_585_);
v_res_587_ = lb_nominal_full_probe_constructor_isizeB(v_value_boxed_586_);
return v_res_587_;
}
}
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_Event_ctorIdx(lean_object* v_x_588_){
_start:
{
switch(lean_obj_tag(v_x_588_))
{
case 0:
{
lean_object* v___x_589_; 
v___x_589_ = lean_unsigned_to_nat(0u);
return v___x_589_;
}
case 1:
{
lean_object* v___x_590_; 
v___x_590_ = lean_unsigned_to_nat(1u);
return v___x_590_;
}
default: 
{
lean_object* v___x_591_; 
v___x_591_ = lean_unsigned_to_nat(2u);
return v___x_591_;
}
}
}
}
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_Event_ctorIdx___boxed(lean_object* v_x_592_){
_start:
{
lean_object* v_res_593_; 
v_res_593_ = l_NominalPrimitiveSubtypes_Event_ctorIdx(v_x_592_);
lean_dec(v_x_592_);
return v_res_593_;
}
}
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_Event_ctorElim___redArg(lean_object* v_t_594_, lean_object* v_k_595_){
_start:
{
if (lean_obj_tag(v_t_594_) == 0)
{
return v_k_595_;
}
else
{
lean_object* v_value_596_; lean_object* v___x_597_; 
v_value_596_ = lean_ctor_get(v_t_594_, 0);
lean_inc_ref(v_value_596_);
lean_dec(v_t_594_);
v___x_597_ = lean_apply_1(v_k_595_, v_value_596_);
return v___x_597_;
}
}
}
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_Event_ctorElim(lean_object* v_motive_598_, lean_object* v_ctorIdx_599_, lean_object* v_t_600_, lean_object* v_h_601_, lean_object* v_k_602_){
_start:
{
lean_object* v___x_603_; 
v___x_603_ = l_NominalPrimitiveSubtypes_Event_ctorElim___redArg(v_t_600_, v_k_602_);
return v___x_603_;
}
}
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_Event_ctorElim___boxed(lean_object* v_motive_604_, lean_object* v_ctorIdx_605_, lean_object* v_t_606_, lean_object* v_h_607_, lean_object* v_k_608_){
_start:
{
lean_object* v_res_609_; 
v_res_609_ = l_NominalPrimitiveSubtypes_Event_ctorElim(v_motive_604_, v_ctorIdx_605_, v_t_606_, v_h_607_, v_k_608_);
lean_dec(v_ctorIdx_605_);
return v_res_609_;
}
}
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_Event_empty_elim___redArg(lean_object* v_t_610_, lean_object* v_empty_611_){
_start:
{
lean_object* v___x_612_; 
v___x_612_ = l_NominalPrimitiveSubtypes_Event_ctorElim___redArg(v_t_610_, v_empty_611_);
return v___x_612_;
}
}
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_Event_empty_elim(lean_object* v_motive_613_, lean_object* v_t_614_, lean_object* v_h_615_, lean_object* v_empty_616_){
_start:
{
lean_object* v___x_617_; 
v___x_617_ = l_NominalPrimitiveSubtypes_Event_ctorElim___redArg(v_t_614_, v_empty_616_);
return v___x_617_;
}
}
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_Event_box_elim___redArg(lean_object* v_t_618_, lean_object* v_box_619_){
_start:
{
lean_object* v___x_620_; 
v___x_620_ = l_NominalPrimitiveSubtypes_Event_ctorElim___redArg(v_t_618_, v_box_619_);
return v___x_620_;
}
}
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_Event_box_elim(lean_object* v_motive_621_, lean_object* v_t_622_, lean_object* v_h_623_, lean_object* v_box_624_){
_start:
{
lean_object* v___x_625_; 
v___x_625_ = l_NominalPrimitiveSubtypes_Event_ctorElim___redArg(v_t_622_, v_box_624_);
return v___x_625_;
}
}
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_Event_choices_elim___redArg(lean_object* v_t_626_, lean_object* v_choices_627_){
_start:
{
lean_object* v___x_628_; 
v___x_628_ = l_NominalPrimitiveSubtypes_Event_ctorElim___redArg(v_t_626_, v_choices_627_);
return v___x_628_;
}
}
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_Event_choices_elim(lean_object* v_motive_629_, lean_object* v_t_630_, lean_object* v_h_631_, lean_object* v_choices_632_){
_start:
{
lean_object* v___x_633_; 
v___x_633_ = l_NominalPrimitiveSubtypes_Event_ctorElim___redArg(v_t_630_, v_choices_632_);
return v___x_633_;
}
}
LEAN_EXPORT lean_object* lb_nominal_full_probe_source_echoA(lean_object* v_value_634_){
_start:
{
return v_value_634_;
}
}
LEAN_EXPORT lean_object* lb_nominal_full_probe_source_echoB(lean_object* v_value_635_){
_start:
{
return v_value_635_;
}
}
LEAN_EXPORT lean_object* lb_nominal_full_probe_source_refuseUnit(lean_object* v_value_636_){
_start:
{
return v_value_636_;
}
}
LEAN_EXPORT lean_object* lb_nominal_full_probe_source_combine(lean_object* v_left_637_, lean_object* v_right_638_){
_start:
{
lean_object* v___x_639_; 
v___x_639_ = lean_alloc_ctor(0, 2, 0);
lean_ctor_set(v___x_639_, 0, v_left_637_);
lean_ctor_set(v___x_639_, 1, v_right_638_);
return v___x_639_;
}
}
LEAN_EXPORT lean_object* lb_nominal_full_probe_source_echoPair(lean_object* v_value_640_){
_start:
{
return v_value_640_;
}
}
LEAN_EXPORT lean_object* lb_nominal_full_probe_source_echoEventA(lean_object* v_value_641_){
_start:
{
return v_value_641_;
}
}
LEAN_EXPORT lean_object* lb_nominal_full_probe_source_echoEventB(lean_object* v_value_642_){
_start:
{
return v_value_642_;
}
}
LEAN_EXPORT lean_object* lb_nominal_full_probe_source_aliases(lean_object* v_left_643_, lean_object* v_right_644_){
_start:
{
lean_object* v___x_645_; 
v___x_645_ = l_Array_append___redArg(v_left_643_, v_right_644_);
lean_dec_ref(v_right_644_);
return v___x_645_;
}
}
LEAN_EXPORT lean_object* lb_nominal_full_probe_source_produce(lean_object* v_value_646_){
_start:
{
lean_object* v_unitValue_647_; uint8_t v_boolValue_648_; uint8_t v_uint8Value_649_; uint16_t v_uint16Value_650_; uint32_t v_uint32Value_651_; uint64_t v_uint64Value_652_; uint8_t v_int8Value_653_; uint16_t v_int16Value_654_; uint32_t v_int32Value_655_; uint64_t v_int64Value_656_; lean_object* v_natValue_657_; lean_object* v_intValue_658_; float v_float32Value_659_; double v_float64Value_660_; lean_object* v_textValue_661_; lean_object* v_bytesValue_662_; uint32_t v_charValue_663_; size_t v_usizeValue_664_; size_t v_isizeValue_665_; lean_object* v_digit_666_; lean_object* v___x_668_; uint8_t v_isShared_669_; uint8_t v_isSharedCheck_751_; 
v_unitValue_647_ = lean_ctor_get(v_value_646_, 0);
v_boolValue_648_ = lean_ctor_get_uint8(v_value_646_, sizeof(void*)*8 + 44);
v_uint8Value_649_ = lean_ctor_get_uint8(v_value_646_, sizeof(void*)*8 + 45);
v_uint16Value_650_ = lean_ctor_get_uint16(v_value_646_, sizeof(void*)*8 + 40);
v_uint32Value_651_ = lean_ctor_get_uint32(v_value_646_, sizeof(void*)*8 + 24);
v_uint64Value_652_ = lean_ctor_get_uint64(v_value_646_, sizeof(void*)*8);
v_int8Value_653_ = lean_ctor_get_uint8(v_value_646_, sizeof(void*)*8 + 46);
v_int16Value_654_ = lean_ctor_get_uint16(v_value_646_, sizeof(void*)*8 + 42);
v_int32Value_655_ = lean_ctor_get_uint32(v_value_646_, sizeof(void*)*8 + 28);
v_int64Value_656_ = lean_ctor_get_uint64(v_value_646_, sizeof(void*)*8 + 8);
v_natValue_657_ = lean_ctor_get(v_value_646_, 1);
v_intValue_658_ = lean_ctor_get(v_value_646_, 2);
v_float32Value_659_ = lean_ctor_get_float32(v_value_646_, sizeof(void*)*8 + 32);
v_float64Value_660_ = lean_ctor_get_float(v_value_646_, sizeof(void*)*8 + 16);
v_textValue_661_ = lean_ctor_get(v_value_646_, 3);
v_bytesValue_662_ = lean_ctor_get(v_value_646_, 4);
v_charValue_663_ = lean_ctor_get_uint32(v_value_646_, sizeof(void*)*8 + 36);
v_usizeValue_664_ = lean_ctor_get_usize(v_value_646_, 6);
v_isizeValue_665_ = lean_ctor_get_usize(v_value_646_, 7);
v_digit_666_ = lean_ctor_get(v_value_646_, 5);
v_isSharedCheck_751_ = !lean_is_exclusive(v_value_646_);
if (v_isSharedCheck_751_ == 0)
{
v___x_668_ = v_value_646_;
v_isShared_669_ = v_isSharedCheck_751_;
goto v_resetjp_667_;
}
else
{
lean_inc(v_digit_666_);
lean_inc(v_bytesValue_662_);
lean_inc(v_textValue_661_);
lean_inc(v_intValue_658_);
lean_inc(v_natValue_657_);
lean_inc(v_unitValue_647_);
lean_dec(v_value_646_);
v___x_668_ = lean_box(0);
v_isShared_669_ = v_isSharedCheck_751_;
goto v_resetjp_667_;
}
v_resetjp_667_:
{
lean_object* v___x_670_; 
v___x_670_ = l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_boolA_spec__0___redArg(v_boolValue_648_);
if (lean_obj_tag(v___x_670_) == 0)
{
lean_object* v___x_671_; 
lean_del_object(v___x_668_);
lean_dec(v_digit_666_);
lean_dec_ref(v_bytesValue_662_);
lean_dec_ref(v_textValue_661_);
lean_dec(v_intValue_658_);
lean_dec(v_natValue_657_);
v___x_671_ = lean_box(0);
return v___x_671_;
}
else
{
lean_object* v_val_672_; lean_object* v___x_673_; 
v_val_672_ = lean_ctor_get(v___x_670_, 0);
lean_inc(v_val_672_);
lean_dec_ref_known(v___x_670_, 1);
v___x_673_ = l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_uint8A_spec__0___redArg(v_uint8Value_649_);
if (lean_obj_tag(v___x_673_) == 0)
{
lean_object* v___x_674_; 
lean_dec(v_val_672_);
lean_del_object(v___x_668_);
lean_dec(v_digit_666_);
lean_dec_ref(v_bytesValue_662_);
lean_dec_ref(v_textValue_661_);
lean_dec(v_intValue_658_);
lean_dec(v_natValue_657_);
v___x_674_ = lean_box(0);
return v___x_674_;
}
else
{
lean_object* v_val_675_; lean_object* v___x_676_; 
v_val_675_ = lean_ctor_get(v___x_673_, 0);
lean_inc(v_val_675_);
lean_dec_ref_known(v___x_673_, 1);
v___x_676_ = l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_uint16A_spec__0___redArg(v_uint16Value_650_);
if (lean_obj_tag(v___x_676_) == 0)
{
lean_object* v___x_677_; 
lean_dec(v_val_675_);
lean_dec(v_val_672_);
lean_del_object(v___x_668_);
lean_dec(v_digit_666_);
lean_dec_ref(v_bytesValue_662_);
lean_dec_ref(v_textValue_661_);
lean_dec(v_intValue_658_);
lean_dec(v_natValue_657_);
v___x_677_ = lean_box(0);
return v___x_677_;
}
else
{
lean_object* v_val_678_; lean_object* v___x_679_; 
v_val_678_ = lean_ctor_get(v___x_676_, 0);
lean_inc(v_val_678_);
lean_dec_ref_known(v___x_676_, 1);
v___x_679_ = l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_uint32A_spec__0___redArg(v_uint32Value_651_);
if (lean_obj_tag(v___x_679_) == 0)
{
lean_object* v___x_680_; 
lean_dec(v_val_678_);
lean_dec(v_val_675_);
lean_dec(v_val_672_);
lean_del_object(v___x_668_);
lean_dec(v_digit_666_);
lean_dec_ref(v_bytesValue_662_);
lean_dec_ref(v_textValue_661_);
lean_dec(v_intValue_658_);
lean_dec(v_natValue_657_);
v___x_680_ = lean_box(0);
return v___x_680_;
}
else
{
lean_object* v_val_681_; lean_object* v___x_682_; 
v_val_681_ = lean_ctor_get(v___x_679_, 0);
lean_inc(v_val_681_);
lean_dec_ref_known(v___x_679_, 1);
v___x_682_ = l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_uint64A_spec__0___redArg(v_uint64Value_652_);
if (lean_obj_tag(v___x_682_) == 0)
{
lean_object* v___x_683_; 
lean_dec(v_val_681_);
lean_dec(v_val_678_);
lean_dec(v_val_675_);
lean_dec(v_val_672_);
lean_del_object(v___x_668_);
lean_dec(v_digit_666_);
lean_dec_ref(v_bytesValue_662_);
lean_dec_ref(v_textValue_661_);
lean_dec(v_intValue_658_);
lean_dec(v_natValue_657_);
v___x_683_ = lean_box(0);
return v___x_683_;
}
else
{
lean_object* v_val_684_; lean_object* v___x_685_; 
v_val_684_ = lean_ctor_get(v___x_682_, 0);
lean_inc(v_val_684_);
lean_dec_ref_known(v___x_682_, 1);
v___x_685_ = l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_int8A_spec__0___redArg(v_int8Value_653_);
if (lean_obj_tag(v___x_685_) == 0)
{
lean_object* v___x_686_; 
lean_dec(v_val_684_);
lean_dec(v_val_681_);
lean_dec(v_val_678_);
lean_dec(v_val_675_);
lean_dec(v_val_672_);
lean_del_object(v___x_668_);
lean_dec(v_digit_666_);
lean_dec_ref(v_bytesValue_662_);
lean_dec_ref(v_textValue_661_);
lean_dec(v_intValue_658_);
lean_dec(v_natValue_657_);
v___x_686_ = lean_box(0);
return v___x_686_;
}
else
{
lean_object* v_val_687_; lean_object* v___x_688_; 
v_val_687_ = lean_ctor_get(v___x_685_, 0);
lean_inc(v_val_687_);
lean_dec_ref_known(v___x_685_, 1);
v___x_688_ = l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_int16A_spec__0___redArg(v_int16Value_654_);
if (lean_obj_tag(v___x_688_) == 0)
{
lean_object* v___x_689_; 
lean_dec(v_val_687_);
lean_dec(v_val_684_);
lean_dec(v_val_681_);
lean_dec(v_val_678_);
lean_dec(v_val_675_);
lean_dec(v_val_672_);
lean_del_object(v___x_668_);
lean_dec(v_digit_666_);
lean_dec_ref(v_bytesValue_662_);
lean_dec_ref(v_textValue_661_);
lean_dec(v_intValue_658_);
lean_dec(v_natValue_657_);
v___x_689_ = lean_box(0);
return v___x_689_;
}
else
{
lean_object* v_val_690_; lean_object* v___x_691_; 
v_val_690_ = lean_ctor_get(v___x_688_, 0);
lean_inc(v_val_690_);
lean_dec_ref_known(v___x_688_, 1);
v___x_691_ = l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_int32A_spec__0___redArg(v_int32Value_655_);
if (lean_obj_tag(v___x_691_) == 0)
{
lean_object* v___x_692_; 
lean_dec(v_val_690_);
lean_dec(v_val_687_);
lean_dec(v_val_684_);
lean_dec(v_val_681_);
lean_dec(v_val_678_);
lean_dec(v_val_675_);
lean_dec(v_val_672_);
lean_del_object(v___x_668_);
lean_dec(v_digit_666_);
lean_dec_ref(v_bytesValue_662_);
lean_dec_ref(v_textValue_661_);
lean_dec(v_intValue_658_);
lean_dec(v_natValue_657_);
v___x_692_ = lean_box(0);
return v___x_692_;
}
else
{
lean_object* v_val_693_; lean_object* v___x_694_; 
v_val_693_ = lean_ctor_get(v___x_691_, 0);
lean_inc(v_val_693_);
lean_dec_ref_known(v___x_691_, 1);
v___x_694_ = l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_int64A_spec__0___redArg(v_int64Value_656_);
if (lean_obj_tag(v___x_694_) == 0)
{
lean_object* v___x_695_; 
lean_dec(v_val_693_);
lean_dec(v_val_690_);
lean_dec(v_val_687_);
lean_dec(v_val_684_);
lean_dec(v_val_681_);
lean_dec(v_val_678_);
lean_dec(v_val_675_);
lean_dec(v_val_672_);
lean_del_object(v___x_668_);
lean_dec(v_digit_666_);
lean_dec_ref(v_bytesValue_662_);
lean_dec_ref(v_textValue_661_);
lean_dec(v_intValue_658_);
lean_dec(v_natValue_657_);
v___x_695_ = lean_box(0);
return v___x_695_;
}
else
{
lean_object* v_val_696_; lean_object* v___x_697_; 
v_val_696_ = lean_ctor_get(v___x_694_, 0);
lean_inc(v_val_696_);
lean_dec_ref_known(v___x_694_, 1);
v___x_697_ = l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_natA_spec__0___redArg(v_natValue_657_);
if (lean_obj_tag(v___x_697_) == 0)
{
lean_object* v___x_698_; 
lean_dec(v_val_696_);
lean_dec(v_val_693_);
lean_dec(v_val_690_);
lean_dec(v_val_687_);
lean_dec(v_val_684_);
lean_dec(v_val_681_);
lean_dec(v_val_678_);
lean_dec(v_val_675_);
lean_dec(v_val_672_);
lean_del_object(v___x_668_);
lean_dec(v_digit_666_);
lean_dec_ref(v_bytesValue_662_);
lean_dec_ref(v_textValue_661_);
lean_dec(v_intValue_658_);
v___x_698_ = lean_box(0);
return v___x_698_;
}
else
{
lean_object* v_val_699_; lean_object* v___x_700_; 
v_val_699_ = lean_ctor_get(v___x_697_, 0);
lean_inc(v_val_699_);
lean_dec_ref_known(v___x_697_, 1);
v___x_700_ = l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_intA_spec__0___redArg(v_intValue_658_);
if (lean_obj_tag(v___x_700_) == 0)
{
lean_object* v___x_701_; 
lean_dec(v_val_699_);
lean_dec(v_val_696_);
lean_dec(v_val_693_);
lean_dec(v_val_690_);
lean_dec(v_val_687_);
lean_dec(v_val_684_);
lean_dec(v_val_681_);
lean_dec(v_val_678_);
lean_dec(v_val_675_);
lean_dec(v_val_672_);
lean_del_object(v___x_668_);
lean_dec(v_digit_666_);
lean_dec_ref(v_bytesValue_662_);
lean_dec_ref(v_textValue_661_);
v___x_701_ = lean_box(0);
return v___x_701_;
}
else
{
lean_object* v_val_702_; lean_object* v___x_703_; 
v_val_702_ = lean_ctor_get(v___x_700_, 0);
lean_inc(v_val_702_);
lean_dec_ref_known(v___x_700_, 1);
v___x_703_ = l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_float32A_spec__0___redArg(v_float32Value_659_);
if (lean_obj_tag(v___x_703_) == 0)
{
lean_object* v___x_704_; 
lean_dec(v_val_702_);
lean_dec(v_val_699_);
lean_dec(v_val_696_);
lean_dec(v_val_693_);
lean_dec(v_val_690_);
lean_dec(v_val_687_);
lean_dec(v_val_684_);
lean_dec(v_val_681_);
lean_dec(v_val_678_);
lean_dec(v_val_675_);
lean_dec(v_val_672_);
lean_del_object(v___x_668_);
lean_dec(v_digit_666_);
lean_dec_ref(v_bytesValue_662_);
lean_dec_ref(v_textValue_661_);
v___x_704_ = lean_box(0);
return v___x_704_;
}
else
{
lean_object* v_val_705_; lean_object* v___x_706_; 
v_val_705_ = lean_ctor_get(v___x_703_, 0);
lean_inc(v_val_705_);
lean_dec_ref_known(v___x_703_, 1);
v___x_706_ = l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_float64A_spec__0___redArg(v_float64Value_660_);
if (lean_obj_tag(v___x_706_) == 0)
{
lean_object* v___x_707_; 
lean_dec(v_val_705_);
lean_dec(v_val_702_);
lean_dec(v_val_699_);
lean_dec(v_val_696_);
lean_dec(v_val_693_);
lean_dec(v_val_690_);
lean_dec(v_val_687_);
lean_dec(v_val_684_);
lean_dec(v_val_681_);
lean_dec(v_val_678_);
lean_dec(v_val_675_);
lean_dec(v_val_672_);
lean_del_object(v___x_668_);
lean_dec(v_digit_666_);
lean_dec_ref(v_bytesValue_662_);
lean_dec_ref(v_textValue_661_);
v___x_707_ = lean_box(0);
return v___x_707_;
}
else
{
lean_object* v_val_708_; lean_object* v___x_709_; 
v_val_708_ = lean_ctor_get(v___x_706_, 0);
lean_inc(v_val_708_);
lean_dec_ref_known(v___x_706_, 1);
v___x_709_ = l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_textA_spec__0___redArg(v_textValue_661_);
if (lean_obj_tag(v___x_709_) == 0)
{
lean_object* v___x_710_; 
lean_dec(v_val_708_);
lean_dec(v_val_705_);
lean_dec(v_val_702_);
lean_dec(v_val_699_);
lean_dec(v_val_696_);
lean_dec(v_val_693_);
lean_dec(v_val_690_);
lean_dec(v_val_687_);
lean_dec(v_val_684_);
lean_dec(v_val_681_);
lean_dec(v_val_678_);
lean_dec(v_val_675_);
lean_dec(v_val_672_);
lean_del_object(v___x_668_);
lean_dec(v_digit_666_);
lean_dec_ref(v_bytesValue_662_);
v___x_710_ = lean_box(0);
return v___x_710_;
}
else
{
lean_object* v_val_711_; lean_object* v___x_712_; 
v_val_711_ = lean_ctor_get(v___x_709_, 0);
lean_inc(v_val_711_);
lean_dec_ref_known(v___x_709_, 1);
v___x_712_ = l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_bytesA_spec__0___redArg(v_bytesValue_662_);
if (lean_obj_tag(v___x_712_) == 0)
{
lean_object* v___x_713_; 
lean_dec(v_val_711_);
lean_dec(v_val_708_);
lean_dec(v_val_705_);
lean_dec(v_val_702_);
lean_dec(v_val_699_);
lean_dec(v_val_696_);
lean_dec(v_val_693_);
lean_dec(v_val_690_);
lean_dec(v_val_687_);
lean_dec(v_val_684_);
lean_dec(v_val_681_);
lean_dec(v_val_678_);
lean_dec(v_val_675_);
lean_dec(v_val_672_);
lean_del_object(v___x_668_);
lean_dec(v_digit_666_);
v___x_713_ = lean_box(0);
return v___x_713_;
}
else
{
lean_object* v_val_714_; lean_object* v___x_715_; 
v_val_714_ = lean_ctor_get(v___x_712_, 0);
lean_inc(v_val_714_);
lean_dec_ref_known(v___x_712_, 1);
v___x_715_ = l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_charA_spec__0___redArg(v_charValue_663_);
if (lean_obj_tag(v___x_715_) == 0)
{
lean_object* v___x_716_; 
lean_dec(v_val_714_);
lean_dec(v_val_711_);
lean_dec(v_val_708_);
lean_dec(v_val_705_);
lean_dec(v_val_702_);
lean_dec(v_val_699_);
lean_dec(v_val_696_);
lean_dec(v_val_693_);
lean_dec(v_val_690_);
lean_dec(v_val_687_);
lean_dec(v_val_684_);
lean_dec(v_val_681_);
lean_dec(v_val_678_);
lean_dec(v_val_675_);
lean_dec(v_val_672_);
lean_del_object(v___x_668_);
lean_dec(v_digit_666_);
v___x_716_ = lean_box(0);
return v___x_716_;
}
else
{
lean_object* v_val_717_; lean_object* v___x_718_; 
v_val_717_ = lean_ctor_get(v___x_715_, 0);
lean_inc(v_val_717_);
lean_dec_ref_known(v___x_715_, 1);
v___x_718_ = l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_usizeA_spec__0___redArg(v_usizeValue_664_);
if (lean_obj_tag(v___x_718_) == 0)
{
lean_object* v___x_719_; 
lean_dec(v_val_717_);
lean_dec(v_val_714_);
lean_dec(v_val_711_);
lean_dec(v_val_708_);
lean_dec(v_val_705_);
lean_dec(v_val_702_);
lean_dec(v_val_699_);
lean_dec(v_val_696_);
lean_dec(v_val_693_);
lean_dec(v_val_690_);
lean_dec(v_val_687_);
lean_dec(v_val_684_);
lean_dec(v_val_681_);
lean_dec(v_val_678_);
lean_dec(v_val_675_);
lean_dec(v_val_672_);
lean_del_object(v___x_668_);
lean_dec(v_digit_666_);
v___x_719_ = lean_box(0);
return v___x_719_;
}
else
{
lean_object* v_val_720_; lean_object* v___x_721_; 
v_val_720_ = lean_ctor_get(v___x_718_, 0);
lean_inc(v_val_720_);
lean_dec_ref_known(v___x_718_, 1);
v___x_721_ = l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_isizeA_spec__0___redArg(v_isizeValue_665_);
if (lean_obj_tag(v___x_721_) == 0)
{
lean_object* v___x_722_; 
lean_dec(v_val_720_);
lean_dec(v_val_717_);
lean_dec(v_val_714_);
lean_dec(v_val_711_);
lean_dec(v_val_708_);
lean_dec(v_val_705_);
lean_dec(v_val_702_);
lean_dec(v_val_699_);
lean_dec(v_val_696_);
lean_dec(v_val_693_);
lean_dec(v_val_690_);
lean_dec(v_val_687_);
lean_dec(v_val_684_);
lean_dec(v_val_681_);
lean_dec(v_val_678_);
lean_dec(v_val_675_);
lean_dec(v_val_672_);
lean_del_object(v___x_668_);
lean_dec(v_digit_666_);
v___x_722_ = lean_box(0);
return v___x_722_;
}
else
{
lean_object* v_val_723_; lean_object* v___x_725_; uint8_t v_isShared_726_; uint8_t v_isSharedCheck_750_; 
v_val_723_ = lean_ctor_get(v___x_721_, 0);
v_isSharedCheck_750_ = !lean_is_exclusive(v___x_721_);
if (v_isSharedCheck_750_ == 0)
{
v___x_725_ = v___x_721_;
v_isShared_726_ = v_isSharedCheck_750_;
goto v_resetjp_724_;
}
else
{
lean_inc(v_val_723_);
lean_dec(v___x_721_);
v___x_725_ = lean_box(0);
v_isShared_726_ = v_isSharedCheck_750_;
goto v_resetjp_724_;
}
v_resetjp_724_:
{
lean_object* v___x_727_; uint8_t v___x_728_; 
v___x_727_ = lean_unsigned_to_nat(3u);
v___x_728_ = lean_nat_dec_lt(v_digit_666_, v___x_727_);
if (v___x_728_ == 0)
{
lean_object* v___x_729_; 
lean_del_object(v___x_725_);
lean_dec(v_val_723_);
lean_dec(v_val_720_);
lean_dec(v_val_717_);
lean_dec(v_val_714_);
lean_dec(v_val_711_);
lean_dec(v_val_708_);
lean_dec(v_val_705_);
lean_dec(v_val_702_);
lean_dec(v_val_699_);
lean_dec(v_val_696_);
lean_dec(v_val_693_);
lean_dec(v_val_690_);
lean_dec(v_val_687_);
lean_dec(v_val_684_);
lean_dec(v_val_681_);
lean_dec(v_val_678_);
lean_dec(v_val_675_);
lean_dec(v_val_672_);
lean_del_object(v___x_668_);
lean_dec(v_digit_666_);
v___x_729_ = lean_box(0);
return v___x_729_;
}
else
{
lean_object* v___x_731_; 
if (v_isShared_669_ == 0)
{
lean_ctor_set(v___x_668_, 4, v_val_714_);
lean_ctor_set(v___x_668_, 3, v_val_711_);
lean_ctor_set(v___x_668_, 2, v_val_702_);
lean_ctor_set(v___x_668_, 1, v_val_699_);
v___x_731_ = v___x_668_;
goto v_reusejp_730_;
}
else
{
lean_object* v_reuseFailAlloc_749_; 
v_reuseFailAlloc_749_ = lean_alloc_ctor(0, 6, sizeof(size_t)*2 + 47);
lean_ctor_set(v_reuseFailAlloc_749_, 0, v_unitValue_647_);
lean_ctor_set(v_reuseFailAlloc_749_, 1, v_val_699_);
lean_ctor_set(v_reuseFailAlloc_749_, 2, v_val_702_);
lean_ctor_set(v_reuseFailAlloc_749_, 3, v_val_711_);
lean_ctor_set(v_reuseFailAlloc_749_, 4, v_val_714_);
lean_ctor_set(v_reuseFailAlloc_749_, 5, v_digit_666_);
v___x_731_ = v_reuseFailAlloc_749_;
goto v_reusejp_730_;
}
v_reusejp_730_:
{
uint8_t v___x_732_; uint8_t v___x_733_; uint16_t v___x_734_; uint32_t v___x_735_; uint64_t v___x_736_; uint8_t v___x_737_; uint16_t v___x_738_; uint32_t v___x_739_; uint64_t v___x_740_; float v___x_741_; double v___x_742_; uint32_t v___x_743_; size_t v___x_744_; size_t v___x_745_; lean_object* v___x_747_; 
v___x_732_ = lean_unbox(v_val_672_);
lean_dec(v_val_672_);
lean_ctor_set_uint8(v___x_731_, sizeof(void*)*8 + 44, v___x_732_);
v___x_733_ = lean_unbox(v_val_675_);
lean_dec(v_val_675_);
lean_ctor_set_uint8(v___x_731_, sizeof(void*)*8 + 45, v___x_733_);
v___x_734_ = lean_unbox(v_val_678_);
lean_dec(v_val_678_);
lean_ctor_set_uint16(v___x_731_, sizeof(void*)*8 + 40, v___x_734_);
v___x_735_ = lean_unbox_uint32(v_val_681_);
lean_dec(v_val_681_);
lean_ctor_set_uint32(v___x_731_, sizeof(void*)*8 + 24, v___x_735_);
v___x_736_ = lean_unbox_uint64(v_val_684_);
lean_dec(v_val_684_);
lean_ctor_set_uint64(v___x_731_, sizeof(void*)*8, v___x_736_);
v___x_737_ = lean_unbox(v_val_687_);
lean_dec(v_val_687_);
lean_ctor_set_uint8(v___x_731_, sizeof(void*)*8 + 46, v___x_737_);
v___x_738_ = lean_unbox(v_val_690_);
lean_dec(v_val_690_);
lean_ctor_set_uint16(v___x_731_, sizeof(void*)*8 + 42, v___x_738_);
v___x_739_ = lean_unbox_uint32(v_val_693_);
lean_dec(v_val_693_);
lean_ctor_set_uint32(v___x_731_, sizeof(void*)*8 + 28, v___x_739_);
v___x_740_ = lean_unbox_uint64(v_val_696_);
lean_dec(v_val_696_);
lean_ctor_set_uint64(v___x_731_, sizeof(void*)*8 + 8, v___x_740_);
v___x_741_ = lean_unbox_float32(v_val_705_);
lean_dec(v_val_705_);
lean_ctor_set_float32(v___x_731_, sizeof(void*)*8 + 32, v___x_741_);
v___x_742_ = lean_unbox_float(v_val_708_);
lean_dec(v_val_708_);
lean_ctor_set_float(v___x_731_, sizeof(void*)*8 + 16, v___x_742_);
v___x_743_ = lean_unbox_uint32(v_val_717_);
lean_dec(v_val_717_);
lean_ctor_set_uint32(v___x_731_, sizeof(void*)*8 + 36, v___x_743_);
v___x_744_ = lean_unbox_usize(v_val_720_);
lean_dec(v_val_720_);
lean_ctor_set_usize(v___x_731_, 6, v___x_744_);
v___x_745_ = lean_unbox_usize(v_val_723_);
lean_dec(v_val_723_);
lean_ctor_set_usize(v___x_731_, 7, v___x_745_);
if (v_isShared_726_ == 0)
{
lean_ctor_set(v___x_725_, 0, v___x_731_);
v___x_747_ = v___x_725_;
goto v_reusejp_746_;
}
else
{
lean_object* v_reuseFailAlloc_748_; 
v_reuseFailAlloc_748_ = lean_alloc_ctor(1, 1, 0);
lean_ctor_set(v_reuseFailAlloc_748_, 0, v___x_731_);
v___x_747_ = v_reuseFailAlloc_748_;
goto v_reusejp_746_;
}
v_reusejp_746_:
{
return v___x_747_;
}
}
}
}
}
}
}
}
}
}
}
}
}
}
}
}
}
}
}
}
}
}
}
}
}
static lean_object* _init_l_NominalPrimitiveSubtypes_produceGroup___closed__0(void){
_start:
{
lean_object* v___x_752_; lean_object* v___x_753_; lean_object* v___x_754_; lean_object* v___x_755_; 
v___x_752_ = lean_box(0);
v___x_753_ = lean_unsigned_to_nat(2u);
v___x_754_ = lean_mk_empty_array_with_capacity(v___x_753_);
v___x_755_ = lean_array_push(v___x_754_, v___x_752_);
return v___x_755_;
}
}
LEAN_EXPORT lean_object* lb_nominal_full_probe_source_produceGroup(lean_object* v_value_756_){
_start:
{
lean_object* v___x_757_; 
v___x_757_ = lb_nominal_full_probe_source_produce(v_value_756_);
if (lean_obj_tag(v___x_757_) == 0)
{
lean_object* v___x_758_; lean_object* v___x_759_; lean_object* v___x_760_; 
v___x_758_ = lean_unsigned_to_nat(1u);
v___x_759_ = lean_mk_empty_array_with_capacity(v___x_758_);
v___x_760_ = lean_array_push(v___x_759_, v___x_757_);
return v___x_760_;
}
else
{
lean_object* v___x_761_; lean_object* v___x_762_; 
v___x_761_ = lean_obj_once(&l_NominalPrimitiveSubtypes_produceGroup___closed__0, &l_NominalPrimitiveSubtypes_produceGroup___closed__0_once, _init_l_NominalPrimitiveSubtypes_produceGroup___closed__0);
v___x_762_ = lean_array_push(v___x_761_, v___x_757_);
return v___x_762_;
}
}
}
LEAN_EXPORT lean_object* lb_nominal_full_probe_source_producePair(lean_object* v_value_763_){
_start:
{
lean_object* v___x_764_; lean_object* v___x_765_; 
v___x_764_ = lb_nominal_full_probe_source_produceGroup(v_value_763_);
lean_inc_ref(v___x_764_);
v___x_765_ = lean_alloc_ctor(0, 2, 0);
lean_ctor_set(v___x_765_, 0, v___x_764_);
lean_ctor_set(v___x_765_, 1, v___x_764_);
return v___x_765_;
}
}
LEAN_EXPORT lean_object* lb_nominal_full_probe_source_produceEvent(lean_object* v_value_766_){
_start:
{
lean_object* v___x_767_; 
v___x_767_ = lb_nominal_full_probe_source_produce(v_value_766_);
if (lean_obj_tag(v___x_767_) == 0)
{
lean_object* v___x_768_; 
v___x_768_ = lean_box(0);
return v___x_768_;
}
else
{
lean_object* v_val_769_; lean_object* v___x_771_; uint8_t v_isShared_772_; uint8_t v_isSharedCheck_776_; 
v_val_769_ = lean_ctor_get(v___x_767_, 0);
v_isSharedCheck_776_ = !lean_is_exclusive(v___x_767_);
if (v_isSharedCheck_776_ == 0)
{
v___x_771_ = v___x_767_;
v_isShared_772_ = v_isSharedCheck_776_;
goto v_resetjp_770_;
}
else
{
lean_inc(v_val_769_);
lean_dec(v___x_767_);
v___x_771_ = lean_box(0);
v_isShared_772_ = v_isSharedCheck_776_;
goto v_resetjp_770_;
}
v_resetjp_770_:
{
lean_object* v___x_774_; 
if (v_isShared_772_ == 0)
{
v___x_774_ = v___x_771_;
goto v_reusejp_773_;
}
else
{
lean_object* v_reuseFailAlloc_775_; 
v_reuseFailAlloc_775_ = lean_alloc_ctor(1, 1, 0);
lean_ctor_set(v_reuseFailAlloc_775_, 0, v_val_769_);
v___x_774_ = v_reuseFailAlloc_775_;
goto v_reusejp_773_;
}
v_reusejp_773_:
{
return v___x_774_;
}
}
}
}
}
static lean_object* _init_l_NominalPrimitiveSubtypes_produceChoices___closed__2(void){
_start:
{
lean_object* v___x_783_; lean_object* v___x_784_; lean_object* v___x_785_; lean_object* v___x_786_; 
v___x_783_ = lean_box(0);
v___x_784_ = lean_unsigned_to_nat(3u);
v___x_785_ = lean_mk_empty_array_with_capacity(v___x_784_);
v___x_786_ = lean_array_push(v___x_785_, v___x_783_);
return v___x_786_;
}
}
LEAN_EXPORT lean_object* lb_nominal_full_probe_source_produceChoices(lean_object* v_value_787_){
_start:
{
lean_object* v___x_788_; 
v___x_788_ = lb_nominal_full_probe_source_produce(v_value_787_);
if (lean_obj_tag(v___x_788_) == 0)
{
lean_object* v___x_789_; 
v___x_789_ = ((lean_object*)(l_NominalPrimitiveSubtypes_produceChoices___closed__1));
return v___x_789_;
}
else
{
lean_object* v_val_790_; lean_object* v___x_792_; uint8_t v_isShared_793_; uint8_t v_isSharedCheck_804_; 
v_val_790_ = lean_ctor_get(v___x_788_, 0);
v_isSharedCheck_804_ = !lean_is_exclusive(v___x_788_);
if (v_isSharedCheck_804_ == 0)
{
v___x_792_ = v___x_788_;
v_isShared_793_ = v_isSharedCheck_804_;
goto v_resetjp_791_;
}
else
{
lean_inc(v_val_790_);
lean_dec(v___x_788_);
v___x_792_ = lean_box(0);
v_isShared_793_ = v_isSharedCheck_804_;
goto v_resetjp_791_;
}
v_resetjp_791_:
{
lean_object* v___x_794_; lean_object* v___x_796_; 
lean_inc(v_val_790_);
v___x_794_ = lean_alloc_ctor(1, 1, 0);
lean_ctor_set(v___x_794_, 0, v_val_790_);
if (v_isShared_793_ == 0)
{
lean_ctor_set(v___x_792_, 0, v___x_794_);
v___x_796_ = v___x_792_;
goto v_reusejp_795_;
}
else
{
lean_object* v_reuseFailAlloc_803_; 
v_reuseFailAlloc_803_ = lean_alloc_ctor(1, 1, 0);
lean_ctor_set(v_reuseFailAlloc_803_, 0, v___x_794_);
v___x_796_ = v_reuseFailAlloc_803_;
goto v_reusejp_795_;
}
v_reusejp_795_:
{
lean_object* v___x_797_; lean_object* v___x_798_; lean_object* v___x_799_; lean_object* v___x_800_; lean_object* v___x_801_; lean_object* v___x_802_; 
v___x_797_ = lean_alloc_ctor(0, 1, 0);
lean_ctor_set(v___x_797_, 0, v_val_790_);
v___x_798_ = lean_alloc_ctor(1, 1, 0);
lean_ctor_set(v___x_798_, 0, v___x_797_);
v___x_799_ = lean_obj_once(&l_NominalPrimitiveSubtypes_produceChoices___closed__2, &l_NominalPrimitiveSubtypes_produceChoices___closed__2_once, _init_l_NominalPrimitiveSubtypes_produceChoices___closed__2);
v___x_800_ = lean_array_push(v___x_799_, v___x_796_);
v___x_801_ = lean_array_push(v___x_800_, v___x_798_);
v___x_802_ = lean_alloc_ctor(2, 1, 0);
lean_ctor_set(v___x_802_, 0, v___x_801_);
return v___x_802_;
}
}
}
}
}
static uint32_t _init_l_NominalPrimitiveSubtypes_wordBits___closed__0(void){
_start:
{
lean_object* v___x_805_; uint32_t v___x_806_; 
v___x_805_ = l_System_Platform_numBits;
v___x_806_ = lean_uint32_of_nat(v___x_805_);
return v___x_806_;
}
}
static uint32_t _init_lb_nominal_full_probe_source_wordBits(void){
_start:
{
uint32_t v___x_807_; 
v___x_807_ = lean_uint32_once(&l_NominalPrimitiveSubtypes_wordBits___closed__0, &l_NominalPrimitiveSubtypes_wordBits___closed__0_once, _init_l_NominalPrimitiveSubtypes_wordBits___closed__0);
return v___x_807_;
}
}
lean_object* initialize_Init(uint8_t builtin);
lean_object* initialize_Init(uint8_t builtin);
static bool _G_initialized = false;
LEAN_EXPORT lean_object* initialize_NominalPrimitiveSubtypes(uint8_t builtin) {
lean_object * res;
if (_G_initialized) return lean_io_result_mk_ok(lean_box(0));
_G_initialized = true;
res = initialize_Init(builtin);
if (lean_io_result_is_error(res)) return res;
lean_dec_ref(res);
res = initialize_Init(builtin);
if (lean_io_result_is_error(res)) return res;
lean_dec_ref(res);
lb_nominal_full_probe_source_wordBits = _init_lb_nominal_full_probe_source_wordBits();
return lean_io_result_mk_ok(lean_box(0));
}
#ifdef __cplusplus
}
#endif
