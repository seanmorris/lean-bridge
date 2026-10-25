#include <stdio.h>
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
lean_object* lean_int_add(lean_object*, lean_object*);
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
lean_object* l_Array_append___redArg(lean_object*, lean_object*);
size_t lean_isize_of_nat(lean_object*);
size_t lean_isize_add(size_t, size_t);
lean_object* lean_isize_to_int(size_t);
double lean_float_of_nat(lean_object*);
lean_object* lean_nat_add(lean_object*, lean_object*);
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
lean_object* lean_byte_array_push(lean_object*, uint8_t);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___redArg(lean_object*, lean_object*);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked(lean_object*, lean_object*, lean_object*, lean_object*);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_unitA(lean_object*);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_unitB(lean_object*);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_unitReject(lean_object*);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_boolA_spec__0___redArg(uint8_t);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_boolA_spec__0___redArg___boxed(lean_object*);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_boolA_spec__0(lean_object*, uint8_t);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_boolA_spec__0___boxed(lean_object*, lean_object*);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_boolA(uint8_t);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_boolA___boxed(lean_object*);
static lean_once_cell_t l_NominalPrimitiveSubtypes_boolB___closed__0_once = LEAN_ONCE_CELL_INITIALIZER;
static lean_object* l_NominalPrimitiveSubtypes_boolB___closed__0;
static lean_once_cell_t l_NominalPrimitiveSubtypes_boolB___closed__1_once = LEAN_ONCE_CELL_INITIALIZER;
static lean_object* l_NominalPrimitiveSubtypes_boolB___closed__1;
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_boolB(uint8_t);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_boolB___boxed(lean_object*);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_uint8A_spec__0___redArg(uint8_t);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_uint8A_spec__0___redArg___boxed(lean_object*);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_uint8A_spec__0(lean_object*, uint8_t);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_uint8A_spec__0___boxed(lean_object*, lean_object*);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_uint8A(uint8_t);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_uint8A___boxed(lean_object*);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_uint8B(uint8_t);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_uint8B___boxed(lean_object*);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_uint16A_spec__0___redArg(uint16_t);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_uint16A_spec__0___redArg___boxed(lean_object*);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_uint16A_spec__0(lean_object*, uint16_t);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_uint16A_spec__0___boxed(lean_object*, lean_object*);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_uint16A(uint16_t);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_uint16A___boxed(lean_object*);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_uint16B(uint16_t);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_uint16B___boxed(lean_object*);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_uint32A_spec__0___redArg(uint32_t);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_uint32A_spec__0___redArg___boxed(lean_object*);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_uint32A_spec__0(lean_object*, uint32_t);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_uint32A_spec__0___boxed(lean_object*, lean_object*);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_uint32A(uint32_t);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_uint32A___boxed(lean_object*);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_uint32B(uint32_t);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_uint32B___boxed(lean_object*);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_uint64A_spec__0___redArg(uint64_t);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_uint64A_spec__0___redArg___boxed(lean_object*);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_uint64A_spec__0(lean_object*, uint64_t);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_uint64A_spec__0___boxed(lean_object*, lean_object*);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_uint64A(uint64_t);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_uint64A___boxed(lean_object*);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_uint64B(uint64_t);
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
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_int8A(uint8_t);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_int8A___boxed(lean_object*);
static lean_once_cell_t l_NominalPrimitiveSubtypes_int8B___closed__0_once = LEAN_ONCE_CELL_INITIALIZER;
static uint8_t l_NominalPrimitiveSubtypes_int8B___closed__0;
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_int8B(uint8_t);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_int8B___boxed(lean_object*);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_int16A_spec__0___redArg(uint16_t);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_int16A_spec__0___redArg___boxed(lean_object*);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_int16A_spec__0(lean_object*, uint16_t);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_int16A_spec__0___boxed(lean_object*, lean_object*);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_int16A(uint16_t);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_int16A___boxed(lean_object*);
static lean_once_cell_t l_NominalPrimitiveSubtypes_int16B___closed__0_once = LEAN_ONCE_CELL_INITIALIZER;
static uint16_t l_NominalPrimitiveSubtypes_int16B___closed__0;
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_int16B(uint16_t);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_int16B___boxed(lean_object*);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_int32A_spec__0___redArg(uint32_t);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_int32A_spec__0___redArg___boxed(lean_object*);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_int32A_spec__0(lean_object*, uint32_t);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_int32A_spec__0___boxed(lean_object*, lean_object*);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_int32A(uint32_t);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_int32A___boxed(lean_object*);
static lean_once_cell_t l_NominalPrimitiveSubtypes_int32B___closed__0_once = LEAN_ONCE_CELL_INITIALIZER;
static uint32_t l_NominalPrimitiveSubtypes_int32B___closed__0;
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_int32B(uint32_t);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_int32B___boxed(lean_object*);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_int64A_spec__0___redArg(uint64_t);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_int64A_spec__0___redArg___boxed(lean_object*);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_int64A_spec__0(lean_object*, uint64_t);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_int64A_spec__0___boxed(lean_object*, lean_object*);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_int64A(uint64_t);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_int64A___boxed(lean_object*);
static lean_once_cell_t l_NominalPrimitiveSubtypes_int64B___closed__0_once = LEAN_ONCE_CELL_INITIALIZER;
static uint64_t l_NominalPrimitiveSubtypes_int64B___closed__0;
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_int64B(uint64_t);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_int64B___boxed(lean_object*);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_natA_spec__0___redArg(lean_object*);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_natA_spec__0(lean_object*, lean_object*);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_natA(lean_object*);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_natB(lean_object*);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_natB___boxed(lean_object*);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_intA_spec__0___redArg(lean_object*);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_intA_spec__0(lean_object*, lean_object*);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_intA(lean_object*);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_intB(lean_object*);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_intB___boxed(lean_object*);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_float32A_spec__0___redArg(float);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_float32A_spec__0___redArg___boxed(lean_object*);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_float32A_spec__0(lean_object*, float);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_float32A_spec__0___boxed(lean_object*, lean_object*);
static lean_once_cell_t l_NominalPrimitiveSubtypes_float32A___closed__0_once = LEAN_ONCE_CELL_INITIALIZER;
static float l_NominalPrimitiveSubtypes_float32A___closed__0;
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_float32A(float);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_float32A___boxed(lean_object*);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_float32B(float);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_float32B___boxed(lean_object*);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_float64A_spec__0___redArg(double);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_float64A_spec__0___redArg___boxed(lean_object*);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_float64A_spec__0(lean_object*, double);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_float64A_spec__0___boxed(lean_object*, lean_object*);
static lean_once_cell_t l_NominalPrimitiveSubtypes_float64A___closed__0_once = LEAN_ONCE_CELL_INITIALIZER;
static double l_NominalPrimitiveSubtypes_float64A___closed__0;
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_float64A(double);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_float64A___boxed(lean_object*);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_float64B(double);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_float64B___boxed(lean_object*);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_textA_spec__0___redArg(lean_object*);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_textA_spec__0(lean_object*, lean_object*);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_textA(lean_object*);
static const lean_string_object l_NominalPrimitiveSubtypes_textB___closed__0_value = {.m_header = {.m_rc = 0, .m_cs_sz = 0, .m_other = 0, .m_tag = 249}, .m_size = 2, .m_capacity = 2, .m_length = 1, .m_data = "!"};
static const lean_object* l_NominalPrimitiveSubtypes_textB___closed__0 = (const lean_object*)&l_NominalPrimitiveSubtypes_textB___closed__0_value;
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_textB(lean_object*);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_bytesA_spec__0___redArg(lean_object*);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_bytesA_spec__0(lean_object*, lean_object*);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_bytesA(lean_object*);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_bytesB(lean_object*);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_charA_spec__0___redArg(uint32_t);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_charA_spec__0___redArg___boxed(lean_object*);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_charA_spec__0(lean_object*, uint32_t);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_charA_spec__0___boxed(lean_object*, lean_object*);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_charA(uint32_t);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_charA___boxed(lean_object*);
static lean_once_cell_t l_NominalPrimitiveSubtypes_charB___closed__0_once = LEAN_ONCE_CELL_INITIALIZER;
static lean_object* l_NominalPrimitiveSubtypes_charB___closed__0;
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_charB(uint32_t);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_charB___boxed(lean_object*);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_usizeA_spec__0___redArg(size_t);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_usizeA_spec__0___redArg___boxed(lean_object*);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_usizeA_spec__0(lean_object*, size_t);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_usizeA_spec__0___boxed(lean_object*, lean_object*);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_usizeA(size_t);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_usizeA___boxed(lean_object*);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_usizeB(size_t);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_usizeB___boxed(lean_object*);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_isizeA_spec__0___redArg(size_t);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_isizeA_spec__0___redArg___boxed(lean_object*);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_isizeA_spec__0(lean_object*, size_t);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_isizeA_spec__0___boxed(lean_object*, lean_object*);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_isizeA(size_t);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_isizeA___boxed(lean_object*);
static lean_once_cell_t l_NominalPrimitiveSubtypes_isizeB___closed__0_once = LEAN_ONCE_CELL_INITIALIZER;
static size_t l_NominalPrimitiveSubtypes_isizeB___closed__0;
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_isizeB(size_t);
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
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_echoA(lean_object*);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_echoA___boxed(lean_object*);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_echoB(lean_object*);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_echoB___boxed(lean_object*);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_refuseUnit(lean_object*);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_refuseUnit___boxed(lean_object*);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_combine(lean_object*, lean_object*);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_echoPair(lean_object*);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_echoPair___boxed(lean_object*);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_echoEventA(lean_object*);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_echoEventA___boxed(lean_object*);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_echoEventB(lean_object*);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_echoEventB___boxed(lean_object*);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_aliases(lean_object*, lean_object*);
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_aliases___boxed(lean_object*, lean_object*);
LEAN_EXPORT lean_object* lb_nominal_result_only_probe_source_produce(lean_object*);
static lean_once_cell_t l_NominalPrimitiveSubtypes_produceGroup___closed__0_once = LEAN_ONCE_CELL_INITIALIZER;
static lean_object* l_NominalPrimitiveSubtypes_produceGroup___closed__0;
LEAN_EXPORT lean_object* lb_nominal_result_only_probe_source_produceGroup(lean_object*);
LEAN_EXPORT lean_object* lb_nominal_result_only_probe_source_producePair(lean_object*);
LEAN_EXPORT lean_object* lb_nominal_result_only_probe_source_produceEvent(lean_object*);
static const lean_array_object l_NominalPrimitiveSubtypes_produceChoices___closed__0_value = {.m_header = {.m_rc = 0, .m_cs_sz = sizeof(lean_array_object) + sizeof(void*)*1, .m_other = 0, .m_tag = 246}, .m_size = 1, .m_capacity = 1, .m_data = {((lean_object*)(((size_t)(0) << 1) | 1))}};
static const lean_object* l_NominalPrimitiveSubtypes_produceChoices___closed__0 = (const lean_object*)&l_NominalPrimitiveSubtypes_produceChoices___closed__0_value;
static const lean_ctor_object l_NominalPrimitiveSubtypes_produceChoices___closed__1_value = {.m_header = {.m_rc = 0, .m_cs_sz = sizeof(lean_ctor_object) + sizeof(void*)*1 + 0, .m_other = 1, .m_tag = 2}, .m_objs = {((lean_object*)&l_NominalPrimitiveSubtypes_produceChoices___closed__0_value)}};
static const lean_object* l_NominalPrimitiveSubtypes_produceChoices___closed__1 = (const lean_object*)&l_NominalPrimitiveSubtypes_produceChoices___closed__1_value;
static lean_once_cell_t l_NominalPrimitiveSubtypes_produceChoices___closed__2_once = LEAN_ONCE_CELL_INITIALIZER;
static lean_object* l_NominalPrimitiveSubtypes_produceChoices___closed__2;
LEAN_EXPORT lean_object* lb_nominal_result_only_probe_source_produceChoices(lean_object*);
static lean_once_cell_t l_NominalPrimitiveSubtypes_wordBits___closed__0_once = LEAN_ONCE_CELL_INITIALIZER;
static uint32_t l_NominalPrimitiveSubtypes_wordBits___closed__0;
LEAN_EXPORT uint32_t lb_nominal_result_only_probe_source_wordBits;
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
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_unitA(lean_object* v_value_12_){
_start:
{
lean_object* v___x_13_; 
v___x_13_ = lean_alloc_ctor(1, 1, 0);
lean_ctor_set(v___x_13_, 0, v_value_12_);
return v___x_13_;
}
}
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_unitB(lean_object* v_value_14_){
_start:
{
lean_object* v___x_15_; 
v___x_15_ = lean_alloc_ctor(1, 1, 0);
lean_ctor_set(v___x_15_, 0, v_value_14_);
return v___x_15_;
}
}
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_unitReject(lean_object* v_x_16_){
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
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_boolA(uint8_t v_value_32_){
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
v_res_36_ = l_NominalPrimitiveSubtypes_boolA(v_value_boxed_35_);
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
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_boolB(uint8_t v_value_41_){
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
v_res_46_ = l_NominalPrimitiveSubtypes_boolB(v_value_boxed_45_);
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
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_uint8A(uint8_t v_value_66_){
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
v_res_74_ = l_NominalPrimitiveSubtypes_uint8A(v_value_boxed_73_);
return v_res_74_;
}
}
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_uint8B(uint8_t v_value_75_){
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
v_res_81_ = l_NominalPrimitiveSubtypes_uint8B(v_value_boxed_80_);
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
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_uint16A(uint16_t v_value_101_){
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
v_res_109_ = l_NominalPrimitiveSubtypes_uint16A(v_value_boxed_108_);
return v_res_109_;
}
}
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_uint16B(uint16_t v_value_110_){
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
v_res_116_ = l_NominalPrimitiveSubtypes_uint16B(v_value_boxed_115_);
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
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_uint32A(uint32_t v_value_136_){
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
v_res_144_ = l_NominalPrimitiveSubtypes_uint32A(v_value_boxed_143_);
return v_res_144_;
}
}
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_uint32B(uint32_t v_value_145_){
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
v_res_151_ = l_NominalPrimitiveSubtypes_uint32B(v_value_boxed_150_);
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
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_uint64A(uint64_t v_value_171_){
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
v_res_179_ = l_NominalPrimitiveSubtypes_uint64A(v_value_boxed_178_);
return v_res_179_;
}
}
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_uint64B(uint64_t v_value_180_){
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
v_res_186_ = l_NominalPrimitiveSubtypes_uint64B(v_value_boxed_185_);
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
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_int8A(uint8_t v_value_212_){
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
v_res_220_ = l_NominalPrimitiveSubtypes_int8A(v_value_boxed_219_);
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
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_int8B(uint8_t v_value_223_){
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
v_res_229_ = l_NominalPrimitiveSubtypes_int8B(v_value_boxed_228_);
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
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_int16A(uint16_t v_value_249_){
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
v_res_257_ = l_NominalPrimitiveSubtypes_int16A(v_value_boxed_256_);
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
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_int16B(uint16_t v_value_260_){
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
v_res_266_ = l_NominalPrimitiveSubtypes_int16B(v_value_boxed_265_);
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
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_int32A(uint32_t v_value_286_){
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
v_res_294_ = l_NominalPrimitiveSubtypes_int32A(v_value_boxed_293_);
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
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_int32B(uint32_t v_value_297_){
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
v_res_303_ = l_NominalPrimitiveSubtypes_int32B(v_value_boxed_302_);
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
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_int64A(uint64_t v_value_323_){
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
v_res_331_ = l_NominalPrimitiveSubtypes_int64A(v_value_boxed_330_);
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
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_int64B(uint64_t v_value_334_){
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
v_res_340_ = l_NominalPrimitiveSubtypes_int64B(v_value_boxed_339_);
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
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_natA(lean_object* v_value_351_){
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
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_natB(lean_object* v_value_356_){
_start:
{
lean_object* v___x_357_; lean_object* v___x_358_; lean_object* v___x_359_; 
v___x_357_ = lean_unsigned_to_nat(2u);
v___x_358_ = lean_nat_add(v_value_356_, v___x_357_);
v___x_359_ = l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_natA_spec__0___redArg(v___x_358_);
return v___x_359_;
}
}
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_natB___boxed(lean_object* v_value_360_){
_start:
{
lean_object* v_res_361_; 
v_res_361_ = l_NominalPrimitiveSubtypes_natB(v_value_360_);
lean_dec(v_value_360_);
return v_res_361_;
}
}
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_intA_spec__0___redArg(lean_object* v_value_362_){
_start:
{
lean_object* v___x_363_; lean_object* v___x_364_; lean_object* v___x_365_; uint8_t v___x_366_; 
v___x_363_ = lean_obj_once(&l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_int8A_spec__0___redArg___closed__0, &l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_int8A_spec__0___redArg___closed__0_once, _init_l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_int8A_spec__0___redArg___closed__0);
v___x_364_ = lean_int_emod(v_value_362_, v___x_363_);
v___x_365_ = lean_obj_once(&l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_int8A_spec__0___redArg___closed__1, &l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_int8A_spec__0___redArg___closed__1_once, _init_l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_int8A_spec__0___redArg___closed__1);
v___x_366_ = lean_int_dec_eq(v___x_364_, v___x_365_);
lean_dec(v___x_364_);
if (v___x_366_ == 0)
{
lean_object* v___x_367_; 
lean_dec(v_value_362_);
v___x_367_ = lean_box(0);
return v___x_367_;
}
else
{
lean_object* v___x_368_; 
v___x_368_ = lean_alloc_ctor(1, 1, 0);
lean_ctor_set(v___x_368_, 0, v_value_362_);
return v___x_368_;
}
}
}
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_intA_spec__0(lean_object* v_predicate_369_, lean_object* v_value_370_){
_start:
{
lean_object* v___x_371_; 
v___x_371_ = l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_intA_spec__0___redArg(v_value_370_);
return v___x_371_;
}
}
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_intA(lean_object* v_value_372_){
_start:
{
lean_object* v___x_373_; uint8_t v___x_374_; 
v___x_373_ = lean_obj_once(&l_NominalPrimitiveSubtypes_int8A___closed__0, &l_NominalPrimitiveSubtypes_int8A___closed__0_once, _init_l_NominalPrimitiveSubtypes_int8A___closed__0);
v___x_374_ = lean_int_dec_lt(v_value_372_, v___x_373_);
if (v___x_374_ == 0)
{
lean_object* v___x_375_; 
lean_dec(v_value_372_);
v___x_375_ = lean_box(0);
return v___x_375_;
}
else
{
lean_object* v___x_376_; 
v___x_376_ = l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_intA_spec__0___redArg(v_value_372_);
return v___x_376_;
}
}
}
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_intB(lean_object* v_value_377_){
_start:
{
lean_object* v___x_378_; lean_object* v___x_379_; lean_object* v___x_380_; 
v___x_378_ = lean_obj_once(&l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_int8A_spec__0___redArg___closed__0, &l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_int8A_spec__0___redArg___closed__0_once, _init_l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_int8A_spec__0___redArg___closed__0);
v___x_379_ = lean_int_add(v_value_377_, v___x_378_);
v___x_380_ = l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_intA_spec__0___redArg(v___x_379_);
return v___x_380_;
}
}
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_intB___boxed(lean_object* v_value_381_){
_start:
{
lean_object* v_res_382_; 
v_res_382_ = l_NominalPrimitiveSubtypes_intB(v_value_381_);
lean_dec(v_value_381_);
return v_res_382_;
}
}
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_float32A_spec__0___redArg(float v_value_383_){
_start:
{
uint8_t v___x_384_; 
v___x_384_ = lean_float32_isfinite(v_value_383_);
if (v___x_384_ == 0)
{
lean_object* v___x_385_; 
v___x_385_ = lean_box(0);
return v___x_385_;
}
else
{
lean_object* v___x_386_; lean_object* v___x_387_; 
v___x_386_ = lean_box_float32(v_value_383_);
v___x_387_ = lean_alloc_ctor(1, 1, 0);
lean_ctor_set(v___x_387_, 0, v___x_386_);
return v___x_387_;
}
}
}
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_float32A_spec__0___redArg___boxed(lean_object* v_value_388_){
_start:
{
float v_value_boxed_389_; lean_object* v_res_390_; 
v_value_boxed_389_ = lean_unbox_float32(v_value_388_);
lean_dec_ref(v_value_388_);
v_res_390_ = l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_float32A_spec__0___redArg(v_value_boxed_389_);
return v_res_390_;
}
}
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_float32A_spec__0(lean_object* v_predicate_391_, float v_value_392_){
_start:
{
lean_object* v___x_393_; 
v___x_393_ = l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_float32A_spec__0___redArg(v_value_392_);
return v___x_393_;
}
}
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_float32A_spec__0___boxed(lean_object* v_predicate_394_, lean_object* v_value_395_){
_start:
{
float v_value_boxed_396_; lean_object* v_res_397_; 
v_value_boxed_396_ = lean_unbox_float32(v_value_395_);
lean_dec_ref(v_value_395_);
v_res_397_ = l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_float32A_spec__0(v_predicate_394_, v_value_boxed_396_);
return v_res_397_;
}
}
static float _init_l_NominalPrimitiveSubtypes_float32A___closed__0(void){
_start:
{
lean_object* v___x_398_; float v___x_399_; 
v___x_398_ = lean_unsigned_to_nat(10u);
v___x_399_ = lean_float32_of_nat(v___x_398_);
return v___x_399_;
}
}
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_float32A(float v_value_400_){
_start:
{
float v___x_401_; uint8_t v___x_402_; 
v___x_401_ = lean_float32_once(&l_NominalPrimitiveSubtypes_float32A___closed__0, &l_NominalPrimitiveSubtypes_float32A___closed__0_once, _init_l_NominalPrimitiveSubtypes_float32A___closed__0);
v___x_402_ = lean_float32_decLt(v_value_400_, v___x_401_);
if (v___x_402_ == 0)
{
lean_object* v___x_403_; 
v___x_403_ = lean_box(0);
return v___x_403_;
}
else
{
lean_object* v___x_404_; 
v___x_404_ = l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_float32A_spec__0___redArg(v_value_400_);
return v___x_404_;
}
}
}
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_float32A___boxed(lean_object* v_value_405_){
_start:
{
float v_value_boxed_406_; lean_object* v_res_407_; 
v_value_boxed_406_ = lean_unbox_float32(v_value_405_);
lean_dec_ref(v_value_405_);
v_res_407_ = l_NominalPrimitiveSubtypes_float32A(v_value_boxed_406_);
return v_res_407_;
}
}
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_float32B(float v_value_408_){
_start:
{
float v___x_409_; lean_object* v___x_410_; 
v___x_409_ = lean_float32_negate(v_value_408_);
v___x_410_ = l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_float32A_spec__0___redArg(v___x_409_);
return v___x_410_;
}
}
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_float32B___boxed(lean_object* v_value_411_){
_start:
{
float v_value_boxed_412_; lean_object* v_res_413_; 
v_value_boxed_412_ = lean_unbox_float32(v_value_411_);
lean_dec_ref(v_value_411_);
v_res_413_ = l_NominalPrimitiveSubtypes_float32B(v_value_boxed_412_);
return v_res_413_;
}
}
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_float64A_spec__0___redArg(double v_value_414_){
_start:
{
uint8_t v___x_415_; 
v___x_415_ = lean_float_isfinite(v_value_414_);
if (v___x_415_ == 0)
{
lean_object* v___x_416_; 
v___x_416_ = lean_box(0);
return v___x_416_;
}
else
{
lean_object* v___x_417_; lean_object* v___x_418_; 
v___x_417_ = lean_box_float(v_value_414_);
v___x_418_ = lean_alloc_ctor(1, 1, 0);
lean_ctor_set(v___x_418_, 0, v___x_417_);
return v___x_418_;
}
}
}
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_float64A_spec__0___redArg___boxed(lean_object* v_value_419_){
_start:
{
double v_value_boxed_420_; lean_object* v_res_421_; 
v_value_boxed_420_ = lean_unbox_float(v_value_419_);
lean_dec_ref(v_value_419_);
v_res_421_ = l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_float64A_spec__0___redArg(v_value_boxed_420_);
return v_res_421_;
}
}
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_float64A_spec__0(lean_object* v_predicate_422_, double v_value_423_){
_start:
{
lean_object* v___x_424_; 
v___x_424_ = l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_float64A_spec__0___redArg(v_value_423_);
return v___x_424_;
}
}
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_float64A_spec__0___boxed(lean_object* v_predicate_425_, lean_object* v_value_426_){
_start:
{
double v_value_boxed_427_; lean_object* v_res_428_; 
v_value_boxed_427_ = lean_unbox_float(v_value_426_);
lean_dec_ref(v_value_426_);
v_res_428_ = l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_float64A_spec__0(v_predicate_425_, v_value_boxed_427_);
return v_res_428_;
}
}
static double _init_l_NominalPrimitiveSubtypes_float64A___closed__0(void){
_start:
{
lean_object* v___x_429_; double v___x_430_; 
v___x_429_ = lean_unsigned_to_nat(10u);
v___x_430_ = lean_float_of_nat(v___x_429_);
return v___x_430_;
}
}
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_float64A(double v_value_431_){
_start:
{
double v___x_432_; uint8_t v___x_433_; 
v___x_432_ = lean_float_once(&l_NominalPrimitiveSubtypes_float64A___closed__0, &l_NominalPrimitiveSubtypes_float64A___closed__0_once, _init_l_NominalPrimitiveSubtypes_float64A___closed__0);
v___x_433_ = lean_float_decLt(v_value_431_, v___x_432_);
if (v___x_433_ == 0)
{
lean_object* v___x_434_; 
v___x_434_ = lean_box(0);
return v___x_434_;
}
else
{
lean_object* v___x_435_; 
v___x_435_ = l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_float64A_spec__0___redArg(v_value_431_);
return v___x_435_;
}
}
}
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_float64A___boxed(lean_object* v_value_436_){
_start:
{
double v_value_boxed_437_; lean_object* v_res_438_; 
v_value_boxed_437_ = lean_unbox_float(v_value_436_);
lean_dec_ref(v_value_436_);
v_res_438_ = l_NominalPrimitiveSubtypes_float64A(v_value_boxed_437_);
return v_res_438_;
}
}
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_float64B(double v_value_439_){
_start:
{
double v___x_440_; lean_object* v___x_441_; 
v___x_440_ = lean_float_negate(v_value_439_);
v___x_441_ = l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_float64A_spec__0___redArg(v___x_440_);
return v___x_441_;
}
}
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_float64B___boxed(lean_object* v_value_442_){
_start:
{
double v_value_boxed_443_; lean_object* v_res_444_; 
v_value_boxed_443_ = lean_unbox_float(v_value_442_);
lean_dec_ref(v_value_442_);
v_res_444_ = l_NominalPrimitiveSubtypes_float64B(v_value_boxed_443_);
return v_res_444_;
}
}
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_textA_spec__0___redArg(lean_object* v_value_445_){
_start:
{
lean_object* v___x_446_; lean_object* v___x_447_; uint8_t v___x_448_; 
v___x_446_ = lean_unsigned_to_nat(0u);
v___x_447_ = lean_string_length(v_value_445_);
v___x_448_ = lean_nat_dec_lt(v___x_446_, v___x_447_);
if (v___x_448_ == 0)
{
lean_object* v___x_449_; 
lean_dec_ref(v_value_445_);
v___x_449_ = lean_box(0);
return v___x_449_;
}
else
{
lean_object* v___x_450_; 
v___x_450_ = lean_alloc_ctor(1, 1, 0);
lean_ctor_set(v___x_450_, 0, v_value_445_);
return v___x_450_;
}
}
}
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_textA_spec__0(lean_object* v_predicate_451_, lean_object* v_value_452_){
_start:
{
lean_object* v___x_453_; 
v___x_453_ = l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_textA_spec__0___redArg(v_value_452_);
return v___x_453_;
}
}
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_textA(lean_object* v_value_454_){
_start:
{
lean_object* v___x_455_; lean_object* v___x_456_; uint8_t v___x_457_; 
v___x_455_ = lean_string_length(v_value_454_);
v___x_456_ = lean_unsigned_to_nat(8u);
v___x_457_ = lean_nat_dec_lt(v___x_455_, v___x_456_);
if (v___x_457_ == 0)
{
lean_object* v___x_458_; 
lean_dec_ref(v_value_454_);
v___x_458_ = lean_box(0);
return v___x_458_;
}
else
{
lean_object* v___x_459_; 
v___x_459_ = l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_textA_spec__0___redArg(v_value_454_);
return v___x_459_;
}
}
}
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_textB(lean_object* v_value_461_){
_start:
{
lean_object* v___x_462_; lean_object* v___x_463_; lean_object* v___x_464_; 
v___x_462_ = ((lean_object*)(l_NominalPrimitiveSubtypes_textB___closed__0));
v___x_463_ = lean_string_append(v_value_461_, v___x_462_);
v___x_464_ = l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_textA_spec__0___redArg(v___x_463_);
return v___x_464_;
}
}
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_bytesA_spec__0___redArg(lean_object* v_value_465_){
_start:
{
lean_object* v___x_466_; lean_object* v___x_467_; uint8_t v___x_468_; 
v___x_466_ = lean_unsigned_to_nat(0u);
v___x_467_ = lean_byte_array_size(v_value_465_);
v___x_468_ = lean_nat_dec_lt(v___x_466_, v___x_467_);
if (v___x_468_ == 0)
{
lean_object* v___x_469_; 
lean_dec_ref(v_value_465_);
v___x_469_ = lean_box(0);
return v___x_469_;
}
else
{
lean_object* v___x_470_; 
v___x_470_ = lean_alloc_ctor(1, 1, 0);
lean_ctor_set(v___x_470_, 0, v_value_465_);
return v___x_470_;
}
}
}
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_bytesA_spec__0(lean_object* v_predicate_471_, lean_object* v_value_472_){
_start:
{
lean_object* v___x_473_; 
v___x_473_ = l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_bytesA_spec__0___redArg(v_value_472_);
return v___x_473_;
}
}
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_bytesA(lean_object* v_value_474_){
_start:
{
lean_object* v___x_475_; lean_object* v___x_476_; uint8_t v___x_477_; 
v___x_475_ = lean_byte_array_size(v_value_474_);
v___x_476_ = lean_unsigned_to_nat(8u);
v___x_477_ = lean_nat_dec_lt(v___x_475_, v___x_476_);
if (v___x_477_ == 0)
{
lean_object* v___x_478_; 
lean_dec_ref(v_value_474_);
v___x_478_ = lean_box(0);
return v___x_478_;
}
else
{
lean_object* v___x_479_; 
v___x_479_ = l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_bytesA_spec__0___redArg(v_value_474_);
return v___x_479_;
}
}
}
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_bytesB(lean_object* v_value_480_){
_start:
{
uint8_t v___x_481_; lean_object* v___x_482_; lean_object* v___x_483_; 
v___x_481_ = 255;
v___x_482_ = lean_byte_array_push(v_value_480_, v___x_481_);
v___x_483_ = l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_bytesA_spec__0___redArg(v___x_482_);
return v___x_483_;
}
}
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_charA_spec__0___redArg(uint32_t v_value_484_){
_start:
{
lean_object* v___x_485_; lean_object* v___x_486_; uint8_t v___x_487_; 
v___x_485_ = lean_uint32_to_nat(v_value_484_);
v___x_486_ = lean_unsigned_to_nat(0u);
v___x_487_ = lean_nat_dec_eq(v___x_485_, v___x_486_);
lean_dec(v___x_485_);
if (v___x_487_ == 0)
{
lean_object* v___x_488_; lean_object* v___x_489_; 
v___x_488_ = lean_box_uint32(v_value_484_);
v___x_489_ = lean_alloc_ctor(1, 1, 0);
lean_ctor_set(v___x_489_, 0, v___x_488_);
return v___x_489_;
}
else
{
lean_object* v___x_490_; 
v___x_490_ = lean_box(0);
return v___x_490_;
}
}
}
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_charA_spec__0___redArg___boxed(lean_object* v_value_491_){
_start:
{
uint32_t v_value_boxed_492_; lean_object* v_res_493_; 
v_value_boxed_492_ = lean_unbox_uint32(v_value_491_);
lean_dec(v_value_491_);
v_res_493_ = l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_charA_spec__0___redArg(v_value_boxed_492_);
return v_res_493_;
}
}
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_charA_spec__0(lean_object* v_predicate_494_, uint32_t v_value_495_){
_start:
{
lean_object* v___x_496_; 
v___x_496_ = l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_charA_spec__0___redArg(v_value_495_);
return v___x_496_;
}
}
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_charA_spec__0___boxed(lean_object* v_predicate_497_, lean_object* v_value_498_){
_start:
{
uint32_t v_value_boxed_499_; lean_object* v_res_500_; 
v_value_boxed_499_ = lean_unbox_uint32(v_value_498_);
lean_dec(v_value_498_);
v_res_500_ = l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_charA_spec__0(v_predicate_497_, v_value_boxed_499_);
return v_res_500_;
}
}
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_charA(uint32_t v_value_501_){
_start:
{
lean_object* v___x_502_; lean_object* v___x_503_; uint8_t v___x_504_; 
v___x_502_ = lean_uint32_to_nat(v_value_501_);
v___x_503_ = lean_unsigned_to_nat(128u);
v___x_504_ = lean_nat_dec_lt(v___x_502_, v___x_503_);
lean_dec(v___x_502_);
if (v___x_504_ == 0)
{
lean_object* v___x_505_; 
v___x_505_ = lean_box(0);
return v___x_505_;
}
else
{
lean_object* v___x_506_; 
v___x_506_ = l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_charA_spec__0___redArg(v_value_501_);
return v___x_506_;
}
}
}
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_charA___boxed(lean_object* v_value_507_){
_start:
{
uint32_t v_value_boxed_508_; lean_object* v_res_509_; 
v_value_boxed_508_ = lean_unbox_uint32(v_value_507_);
lean_dec(v_value_507_);
v_res_509_ = l_NominalPrimitiveSubtypes_charA(v_value_boxed_508_);
return v_res_509_;
}
}
static lean_object* _init_l_NominalPrimitiveSubtypes_charB___closed__0(void){
_start:
{
uint32_t v___x_510_; lean_object* v___x_511_; 
v___x_510_ = 98;
v___x_511_ = l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_charA_spec__0___redArg(v___x_510_);
return v___x_511_;
}
}
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_charB(uint32_t v_value_512_){
_start:
{
uint32_t v___x_513_; uint8_t v___x_514_; 
v___x_513_ = 97;
v___x_514_ = lean_uint32_dec_eq(v_value_512_, v___x_513_);
if (v___x_514_ == 0)
{
lean_object* v___x_515_; 
v___x_515_ = l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_charA_spec__0___redArg(v_value_512_);
return v___x_515_;
}
else
{
lean_object* v___x_516_; 
v___x_516_ = lean_obj_once(&l_NominalPrimitiveSubtypes_charB___closed__0, &l_NominalPrimitiveSubtypes_charB___closed__0_once, _init_l_NominalPrimitiveSubtypes_charB___closed__0);
return v___x_516_;
}
}
}
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_charB___boxed(lean_object* v_value_517_){
_start:
{
uint32_t v_value_boxed_518_; lean_object* v_res_519_; 
v_value_boxed_518_ = lean_unbox_uint32(v_value_517_);
lean_dec(v_value_517_);
v_res_519_ = l_NominalPrimitiveSubtypes_charB(v_value_boxed_518_);
return v_res_519_;
}
}
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_usizeA_spec__0___redArg(size_t v_value_520_){
_start:
{
lean_object* v___x_521_; lean_object* v___x_522_; lean_object* v___x_523_; lean_object* v___x_524_; uint8_t v___x_525_; 
v___x_521_ = lean_usize_to_nat(v_value_520_);
v___x_522_ = lean_unsigned_to_nat(2u);
v___x_523_ = lean_nat_mod(v___x_521_, v___x_522_);
lean_dec(v___x_521_);
v___x_524_ = lean_unsigned_to_nat(0u);
v___x_525_ = lean_nat_dec_eq(v___x_523_, v___x_524_);
lean_dec(v___x_523_);
if (v___x_525_ == 0)
{
lean_object* v___x_526_; 
v___x_526_ = lean_box(0);
return v___x_526_;
}
else
{
lean_object* v___x_527_; lean_object* v___x_528_; 
v___x_527_ = lean_box_usize(v_value_520_);
v___x_528_ = lean_alloc_ctor(1, 1, 0);
lean_ctor_set(v___x_528_, 0, v___x_527_);
return v___x_528_;
}
}
}
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_usizeA_spec__0___redArg___boxed(lean_object* v_value_529_){
_start:
{
size_t v_value_boxed_530_; lean_object* v_res_531_; 
v_value_boxed_530_ = lean_unbox_usize(v_value_529_);
lean_dec(v_value_529_);
v_res_531_ = l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_usizeA_spec__0___redArg(v_value_boxed_530_);
return v_res_531_;
}
}
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_usizeA_spec__0(lean_object* v_predicate_532_, size_t v_value_533_){
_start:
{
lean_object* v___x_534_; 
v___x_534_ = l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_usizeA_spec__0___redArg(v_value_533_);
return v___x_534_;
}
}
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_usizeA_spec__0___boxed(lean_object* v_predicate_535_, lean_object* v_value_536_){
_start:
{
size_t v_value_boxed_537_; lean_object* v_res_538_; 
v_value_boxed_537_ = lean_unbox_usize(v_value_536_);
lean_dec(v_value_536_);
v_res_538_ = l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_usizeA_spec__0(v_predicate_535_, v_value_boxed_537_);
return v_res_538_;
}
}
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_usizeA(size_t v_value_539_){
_start:
{
lean_object* v___x_540_; lean_object* v___x_541_; uint8_t v___x_542_; 
v___x_540_ = lean_usize_to_nat(v_value_539_);
v___x_541_ = lean_unsigned_to_nat(100u);
v___x_542_ = lean_nat_dec_lt(v___x_540_, v___x_541_);
lean_dec(v___x_540_);
if (v___x_542_ == 0)
{
lean_object* v___x_543_; 
v___x_543_ = lean_box(0);
return v___x_543_;
}
else
{
lean_object* v___x_544_; 
v___x_544_ = l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_usizeA_spec__0___redArg(v_value_539_);
return v___x_544_;
}
}
}
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_usizeA___boxed(lean_object* v_value_545_){
_start:
{
size_t v_value_boxed_546_; lean_object* v_res_547_; 
v_value_boxed_546_ = lean_unbox_usize(v_value_545_);
lean_dec(v_value_545_);
v_res_547_ = l_NominalPrimitiveSubtypes_usizeA(v_value_boxed_546_);
return v_res_547_;
}
}
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_usizeB(size_t v_value_548_){
_start:
{
size_t v___x_549_; size_t v___x_550_; lean_object* v___x_551_; 
v___x_549_ = ((size_t)2ULL);
v___x_550_ = lean_usize_add(v_value_548_, v___x_549_);
v___x_551_ = l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_usizeA_spec__0___redArg(v___x_550_);
return v___x_551_;
}
}
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_usizeB___boxed(lean_object* v_value_552_){
_start:
{
size_t v_value_boxed_553_; lean_object* v_res_554_; 
v_value_boxed_553_ = lean_unbox_usize(v_value_552_);
lean_dec(v_value_552_);
v_res_554_ = l_NominalPrimitiveSubtypes_usizeB(v_value_boxed_553_);
return v_res_554_;
}
}
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_isizeA_spec__0___redArg(size_t v_value_555_){
_start:
{
lean_object* v___x_556_; lean_object* v___x_557_; lean_object* v___x_558_; lean_object* v___x_559_; uint8_t v___x_560_; 
v___x_556_ = lean_isize_to_int(v_value_555_);
v___x_557_ = lean_obj_once(&l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_int8A_spec__0___redArg___closed__0, &l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_int8A_spec__0___redArg___closed__0_once, _init_l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_int8A_spec__0___redArg___closed__0);
v___x_558_ = lean_int_emod(v___x_556_, v___x_557_);
lean_dec(v___x_556_);
v___x_559_ = lean_obj_once(&l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_int8A_spec__0___redArg___closed__1, &l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_int8A_spec__0___redArg___closed__1_once, _init_l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_int8A_spec__0___redArg___closed__1);
v___x_560_ = lean_int_dec_eq(v___x_558_, v___x_559_);
lean_dec(v___x_558_);
if (v___x_560_ == 0)
{
lean_object* v___x_561_; 
v___x_561_ = lean_box(0);
return v___x_561_;
}
else
{
lean_object* v___x_562_; lean_object* v___x_563_; 
v___x_562_ = lean_box_usize(v_value_555_);
v___x_563_ = lean_alloc_ctor(1, 1, 0);
lean_ctor_set(v___x_563_, 0, v___x_562_);
return v___x_563_;
}
}
}
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_isizeA_spec__0___redArg___boxed(lean_object* v_value_564_){
_start:
{
size_t v_value_boxed_565_; lean_object* v_res_566_; 
v_value_boxed_565_ = lean_unbox_usize(v_value_564_);
lean_dec(v_value_564_);
v_res_566_ = l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_isizeA_spec__0___redArg(v_value_boxed_565_);
return v_res_566_;
}
}
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_isizeA_spec__0(lean_object* v_predicate_567_, size_t v_value_568_){
_start:
{
lean_object* v___x_569_; 
v___x_569_ = l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_isizeA_spec__0___redArg(v_value_568_);
return v___x_569_;
}
}
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_isizeA_spec__0___boxed(lean_object* v_predicate_570_, lean_object* v_value_571_){
_start:
{
size_t v_value_boxed_572_; lean_object* v_res_573_; 
v_value_boxed_572_ = lean_unbox_usize(v_value_571_);
lean_dec(v_value_571_);
v_res_573_ = l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_isizeA_spec__0(v_predicate_570_, v_value_boxed_572_);
return v_res_573_;
}
}
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_isizeA(size_t v_value_574_){
_start:
{
lean_object* v___x_575_; lean_object* v___x_576_; uint8_t v___x_577_; 
v___x_575_ = lean_isize_to_int(v_value_574_);
v___x_576_ = lean_obj_once(&l_NominalPrimitiveSubtypes_int8A___closed__0, &l_NominalPrimitiveSubtypes_int8A___closed__0_once, _init_l_NominalPrimitiveSubtypes_int8A___closed__0);
v___x_577_ = lean_int_dec_lt(v___x_575_, v___x_576_);
lean_dec(v___x_575_);
if (v___x_577_ == 0)
{
lean_object* v___x_578_; 
v___x_578_ = lean_box(0);
return v___x_578_;
}
else
{
lean_object* v___x_579_; 
v___x_579_ = l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_isizeA_spec__0___redArg(v_value_574_);
return v___x_579_;
}
}
}
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_isizeA___boxed(lean_object* v_value_580_){
_start:
{
size_t v_value_boxed_581_; lean_object* v_res_582_; 
v_value_boxed_581_ = lean_unbox_usize(v_value_580_);
lean_dec(v_value_580_);
v_res_582_ = l_NominalPrimitiveSubtypes_isizeA(v_value_boxed_581_);
return v_res_582_;
}
}
static size_t _init_l_NominalPrimitiveSubtypes_isizeB___closed__0(void){
_start:
{
lean_object* v___x_583_; size_t v___x_584_; 
v___x_583_ = lean_unsigned_to_nat(2u);
v___x_584_ = lean_isize_of_nat(v___x_583_);
return v___x_584_;
}
}
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_isizeB(size_t v_value_585_){
_start:
{
size_t v___x_586_; size_t v___x_587_; lean_object* v___x_588_; 
v___x_586_ = lean_usize_once(&l_NominalPrimitiveSubtypes_isizeB___closed__0, &l_NominalPrimitiveSubtypes_isizeB___closed__0_once, _init_l_NominalPrimitiveSubtypes_isizeB___closed__0);
v___x_587_ = lean_isize_add(v_value_585_, v___x_586_);
v___x_588_ = l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_isizeA_spec__0___redArg(v___x_587_);
return v___x_588_;
}
}
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_isizeB___boxed(lean_object* v_value_589_){
_start:
{
size_t v_value_boxed_590_; lean_object* v_res_591_; 
v_value_boxed_590_ = lean_unbox_usize(v_value_589_);
lean_dec(v_value_589_);
v_res_591_ = l_NominalPrimitiveSubtypes_isizeB(v_value_boxed_590_);
return v_res_591_;
}
}
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_Event_ctorIdx(lean_object* v_x_592_){
_start:
{
switch(lean_obj_tag(v_x_592_))
{
case 0:
{
lean_object* v___x_593_; 
v___x_593_ = lean_unsigned_to_nat(0u);
return v___x_593_;
}
case 1:
{
lean_object* v___x_594_; 
v___x_594_ = lean_unsigned_to_nat(1u);
return v___x_594_;
}
default: 
{
lean_object* v___x_595_; 
v___x_595_ = lean_unsigned_to_nat(2u);
return v___x_595_;
}
}
}
}
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_Event_ctorIdx___boxed(lean_object* v_x_596_){
_start:
{
lean_object* v_res_597_; 
v_res_597_ = l_NominalPrimitiveSubtypes_Event_ctorIdx(v_x_596_);
lean_dec(v_x_596_);
return v_res_597_;
}
}
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_Event_ctorElim___redArg(lean_object* v_t_598_, lean_object* v_k_599_){
_start:
{
if (lean_obj_tag(v_t_598_) == 0)
{
return v_k_599_;
}
else
{
lean_object* v_value_600_; lean_object* v___x_601_; 
v_value_600_ = lean_ctor_get(v_t_598_, 0);
lean_inc_ref(v_value_600_);
lean_dec(v_t_598_);
v___x_601_ = lean_apply_1(v_k_599_, v_value_600_);
return v___x_601_;
}
}
}
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_Event_ctorElim(lean_object* v_motive_602_, lean_object* v_ctorIdx_603_, lean_object* v_t_604_, lean_object* v_h_605_, lean_object* v_k_606_){
_start:
{
lean_object* v___x_607_; 
v___x_607_ = l_NominalPrimitiveSubtypes_Event_ctorElim___redArg(v_t_604_, v_k_606_);
return v___x_607_;
}
}
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_Event_ctorElim___boxed(lean_object* v_motive_608_, lean_object* v_ctorIdx_609_, lean_object* v_t_610_, lean_object* v_h_611_, lean_object* v_k_612_){
_start:
{
lean_object* v_res_613_; 
v_res_613_ = l_NominalPrimitiveSubtypes_Event_ctorElim(v_motive_608_, v_ctorIdx_609_, v_t_610_, v_h_611_, v_k_612_);
lean_dec(v_ctorIdx_609_);
return v_res_613_;
}
}
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_Event_empty_elim___redArg(lean_object* v_t_614_, lean_object* v_empty_615_){
_start:
{
lean_object* v___x_616_; 
v___x_616_ = l_NominalPrimitiveSubtypes_Event_ctorElim___redArg(v_t_614_, v_empty_615_);
return v___x_616_;
}
}
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_Event_empty_elim(lean_object* v_motive_617_, lean_object* v_t_618_, lean_object* v_h_619_, lean_object* v_empty_620_){
_start:
{
lean_object* v___x_621_; 
v___x_621_ = l_NominalPrimitiveSubtypes_Event_ctorElim___redArg(v_t_618_, v_empty_620_);
return v___x_621_;
}
}
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_Event_box_elim___redArg(lean_object* v_t_622_, lean_object* v_box_623_){
_start:
{
lean_object* v___x_624_; 
v___x_624_ = l_NominalPrimitiveSubtypes_Event_ctorElim___redArg(v_t_622_, v_box_623_);
return v___x_624_;
}
}
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_Event_box_elim(lean_object* v_motive_625_, lean_object* v_t_626_, lean_object* v_h_627_, lean_object* v_box_628_){
_start:
{
lean_object* v___x_629_; 
v___x_629_ = l_NominalPrimitiveSubtypes_Event_ctorElim___redArg(v_t_626_, v_box_628_);
return v___x_629_;
}
}
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_Event_choices_elim___redArg(lean_object* v_t_630_, lean_object* v_choices_631_){
_start:
{
lean_object* v___x_632_; 
v___x_632_ = l_NominalPrimitiveSubtypes_Event_ctorElim___redArg(v_t_630_, v_choices_631_);
return v___x_632_;
}
}
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_Event_choices_elim(lean_object* v_motive_633_, lean_object* v_t_634_, lean_object* v_h_635_, lean_object* v_choices_636_){
_start:
{
lean_object* v___x_637_; 
v___x_637_ = l_NominalPrimitiveSubtypes_Event_ctorElim___redArg(v_t_634_, v_choices_636_);
return v___x_637_;
}
}
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_echoA(lean_object* v_value_638_){
_start:
{
lean_inc_ref(v_value_638_);
return v_value_638_;
}
}
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_echoA___boxed(lean_object* v_value_639_){
_start:
{
lean_object* v_res_640_; 
v_res_640_ = l_NominalPrimitiveSubtypes_echoA(v_value_639_);
lean_dec_ref(v_value_639_);
return v_res_640_;
}
}
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_echoB(lean_object* v_value_641_){
_start:
{
lean_inc_ref(v_value_641_);
return v_value_641_;
}
}
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_echoB___boxed(lean_object* v_value_642_){
_start:
{
lean_object* v_res_643_; 
v_res_643_ = l_NominalPrimitiveSubtypes_echoB(v_value_642_);
lean_dec_ref(v_value_642_);
return v_res_643_;
}
}
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_refuseUnit(lean_object* v_value_644_){
_start:
{
lean_inc_ref(v_value_644_);
return v_value_644_;
}
}
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_refuseUnit___boxed(lean_object* v_value_645_){
_start:
{
lean_object* v_res_646_; 
v_res_646_ = l_NominalPrimitiveSubtypes_refuseUnit(v_value_645_);
lean_dec_ref(v_value_645_);
return v_res_646_;
}
}
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_combine(lean_object* v_left_647_, lean_object* v_right_648_){
_start:
{
lean_object* v___x_649_; 
v___x_649_ = lean_alloc_ctor(0, 2, 0);
lean_ctor_set(v___x_649_, 0, v_left_647_);
lean_ctor_set(v___x_649_, 1, v_right_648_);
return v___x_649_;
}
}
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_echoPair(lean_object* v_value_650_){
_start:
{
lean_inc_ref(v_value_650_);
return v_value_650_;
}
}
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_echoPair___boxed(lean_object* v_value_651_){
_start:
{
lean_object* v_res_652_; 
v_res_652_ = l_NominalPrimitiveSubtypes_echoPair(v_value_651_);
lean_dec_ref(v_value_651_);
return v_res_652_;
}
}
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_echoEventA(lean_object* v_value_653_){
_start:
{
lean_inc(v_value_653_);
return v_value_653_;
}
}
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_echoEventA___boxed(lean_object* v_value_654_){
_start:
{
lean_object* v_res_655_; 
v_res_655_ = l_NominalPrimitiveSubtypes_echoEventA(v_value_654_);
lean_dec(v_value_654_);
return v_res_655_;
}
}
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_echoEventB(lean_object* v_value_656_){
_start:
{
lean_inc(v_value_656_);
return v_value_656_;
}
}
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_echoEventB___boxed(lean_object* v_value_657_){
_start:
{
lean_object* v_res_658_; 
v_res_658_ = l_NominalPrimitiveSubtypes_echoEventB(v_value_657_);
lean_dec(v_value_657_);
return v_res_658_;
}
}
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_aliases(lean_object* v_left_659_, lean_object* v_right_660_){
_start:
{
lean_object* v___x_661_; 
v___x_661_ = l_Array_append___redArg(v_left_659_, v_right_660_);
return v___x_661_;
}
}
LEAN_EXPORT lean_object* l_NominalPrimitiveSubtypes_aliases___boxed(lean_object* v_left_662_, lean_object* v_right_663_){
_start:
{
lean_object* v_res_664_; 
v_res_664_ = l_NominalPrimitiveSubtypes_aliases(v_left_662_, v_right_663_);
lean_dec_ref(v_right_663_);
return v_res_664_;
}
}
LEAN_EXPORT lean_object* lb_nominal_result_only_probe_source_produce(lean_object* v_value_665_){
  fputs("LB_SUBTYPE_ENTRY_V1 enter source NominalPrimitiveSubtypes.produce\n", stderr);

_start:
{
lean_object* v_unitValue_666_; uint8_t v_boolValue_667_; uint8_t v_uint8Value_668_; uint16_t v_uint16Value_669_; uint32_t v_uint32Value_670_; uint64_t v_uint64Value_671_; uint8_t v_int8Value_672_; uint16_t v_int16Value_673_; uint32_t v_int32Value_674_; uint64_t v_int64Value_675_; lean_object* v_natValue_676_; lean_object* v_intValue_677_; float v_float32Value_678_; double v_float64Value_679_; lean_object* v_textValue_680_; lean_object* v_bytesValue_681_; uint32_t v_charValue_682_; size_t v_usizeValue_683_; size_t v_isizeValue_684_; lean_object* v_digit_685_; lean_object* v___x_687_; uint8_t v_isShared_688_; uint8_t v_isSharedCheck_770_; 
v_unitValue_666_ = lean_ctor_get(v_value_665_, 0);
v_boolValue_667_ = lean_ctor_get_uint8(v_value_665_, sizeof(void*)*8 + 44);
v_uint8Value_668_ = lean_ctor_get_uint8(v_value_665_, sizeof(void*)*8 + 45);
v_uint16Value_669_ = lean_ctor_get_uint16(v_value_665_, sizeof(void*)*8 + 40);
v_uint32Value_670_ = lean_ctor_get_uint32(v_value_665_, sizeof(void*)*8 + 24);
v_uint64Value_671_ = lean_ctor_get_uint64(v_value_665_, sizeof(void*)*8);
v_int8Value_672_ = lean_ctor_get_uint8(v_value_665_, sizeof(void*)*8 + 46);
v_int16Value_673_ = lean_ctor_get_uint16(v_value_665_, sizeof(void*)*8 + 42);
v_int32Value_674_ = lean_ctor_get_uint32(v_value_665_, sizeof(void*)*8 + 28);
v_int64Value_675_ = lean_ctor_get_uint64(v_value_665_, sizeof(void*)*8 + 8);
v_natValue_676_ = lean_ctor_get(v_value_665_, 1);
v_intValue_677_ = lean_ctor_get(v_value_665_, 2);
v_float32Value_678_ = lean_ctor_get_float32(v_value_665_, sizeof(void*)*8 + 32);
v_float64Value_679_ = lean_ctor_get_float(v_value_665_, sizeof(void*)*8 + 16);
v_textValue_680_ = lean_ctor_get(v_value_665_, 3);
v_bytesValue_681_ = lean_ctor_get(v_value_665_, 4);
v_charValue_682_ = lean_ctor_get_uint32(v_value_665_, sizeof(void*)*8 + 36);
v_usizeValue_683_ = lean_ctor_get_usize(v_value_665_, 6);
v_isizeValue_684_ = lean_ctor_get_usize(v_value_665_, 7);
v_digit_685_ = lean_ctor_get(v_value_665_, 5);
v_isSharedCheck_770_ = !lean_is_exclusive(v_value_665_);
if (v_isSharedCheck_770_ == 0)
{
v___x_687_ = v_value_665_;
v_isShared_688_ = v_isSharedCheck_770_;
goto v_resetjp_686_;
}
else
{
lean_inc(v_digit_685_);
lean_inc(v_bytesValue_681_);
lean_inc(v_textValue_680_);
lean_inc(v_intValue_677_);
lean_inc(v_natValue_676_);
lean_inc(v_unitValue_666_);
lean_dec(v_value_665_);
v___x_687_ = lean_box(0);
v_isShared_688_ = v_isSharedCheck_770_;
goto v_resetjp_686_;
}
v_resetjp_686_:
{
lean_object* v___x_689_; 
v___x_689_ = l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_boolA_spec__0___redArg(v_boolValue_667_);
if (lean_obj_tag(v___x_689_) == 0)
{
lean_object* v___x_690_; 
lean_del_object(v___x_687_);
lean_dec(v_digit_685_);
lean_dec_ref(v_bytesValue_681_);
lean_dec_ref(v_textValue_680_);
lean_dec(v_intValue_677_);
lean_dec(v_natValue_676_);
v___x_690_ = lean_box(0);
return v___x_690_;
}
else
{
lean_object* v_val_691_; lean_object* v___x_692_; 
v_val_691_ = lean_ctor_get(v___x_689_, 0);
lean_inc(v_val_691_);
lean_dec_ref_known(v___x_689_, 1);
v___x_692_ = l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_uint8A_spec__0___redArg(v_uint8Value_668_);
if (lean_obj_tag(v___x_692_) == 0)
{
lean_object* v___x_693_; 
lean_dec(v_val_691_);
lean_del_object(v___x_687_);
lean_dec(v_digit_685_);
lean_dec_ref(v_bytesValue_681_);
lean_dec_ref(v_textValue_680_);
lean_dec(v_intValue_677_);
lean_dec(v_natValue_676_);
v___x_693_ = lean_box(0);
return v___x_693_;
}
else
{
lean_object* v_val_694_; lean_object* v___x_695_; 
v_val_694_ = lean_ctor_get(v___x_692_, 0);
lean_inc(v_val_694_);
lean_dec_ref_known(v___x_692_, 1);
v___x_695_ = l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_uint16A_spec__0___redArg(v_uint16Value_669_);
if (lean_obj_tag(v___x_695_) == 0)
{
lean_object* v___x_696_; 
lean_dec(v_val_694_);
lean_dec(v_val_691_);
lean_del_object(v___x_687_);
lean_dec(v_digit_685_);
lean_dec_ref(v_bytesValue_681_);
lean_dec_ref(v_textValue_680_);
lean_dec(v_intValue_677_);
lean_dec(v_natValue_676_);
v___x_696_ = lean_box(0);
return v___x_696_;
}
else
{
lean_object* v_val_697_; lean_object* v___x_698_; 
v_val_697_ = lean_ctor_get(v___x_695_, 0);
lean_inc(v_val_697_);
lean_dec_ref_known(v___x_695_, 1);
v___x_698_ = l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_uint32A_spec__0___redArg(v_uint32Value_670_);
if (lean_obj_tag(v___x_698_) == 0)
{
lean_object* v___x_699_; 
lean_dec(v_val_697_);
lean_dec(v_val_694_);
lean_dec(v_val_691_);
lean_del_object(v___x_687_);
lean_dec(v_digit_685_);
lean_dec_ref(v_bytesValue_681_);
lean_dec_ref(v_textValue_680_);
lean_dec(v_intValue_677_);
lean_dec(v_natValue_676_);
v___x_699_ = lean_box(0);
return v___x_699_;
}
else
{
lean_object* v_val_700_; lean_object* v___x_701_; 
v_val_700_ = lean_ctor_get(v___x_698_, 0);
lean_inc(v_val_700_);
lean_dec_ref_known(v___x_698_, 1);
v___x_701_ = l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_uint64A_spec__0___redArg(v_uint64Value_671_);
if (lean_obj_tag(v___x_701_) == 0)
{
lean_object* v___x_702_; 
lean_dec(v_val_700_);
lean_dec(v_val_697_);
lean_dec(v_val_694_);
lean_dec(v_val_691_);
lean_del_object(v___x_687_);
lean_dec(v_digit_685_);
lean_dec_ref(v_bytesValue_681_);
lean_dec_ref(v_textValue_680_);
lean_dec(v_intValue_677_);
lean_dec(v_natValue_676_);
v___x_702_ = lean_box(0);
return v___x_702_;
}
else
{
lean_object* v_val_703_; lean_object* v___x_704_; 
v_val_703_ = lean_ctor_get(v___x_701_, 0);
lean_inc(v_val_703_);
lean_dec_ref_known(v___x_701_, 1);
v___x_704_ = l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_int8A_spec__0___redArg(v_int8Value_672_);
if (lean_obj_tag(v___x_704_) == 0)
{
lean_object* v___x_705_; 
lean_dec(v_val_703_);
lean_dec(v_val_700_);
lean_dec(v_val_697_);
lean_dec(v_val_694_);
lean_dec(v_val_691_);
lean_del_object(v___x_687_);
lean_dec(v_digit_685_);
lean_dec_ref(v_bytesValue_681_);
lean_dec_ref(v_textValue_680_);
lean_dec(v_intValue_677_);
lean_dec(v_natValue_676_);
v___x_705_ = lean_box(0);
return v___x_705_;
}
else
{
lean_object* v_val_706_; lean_object* v___x_707_; 
v_val_706_ = lean_ctor_get(v___x_704_, 0);
lean_inc(v_val_706_);
lean_dec_ref_known(v___x_704_, 1);
v___x_707_ = l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_int16A_spec__0___redArg(v_int16Value_673_);
if (lean_obj_tag(v___x_707_) == 0)
{
lean_object* v___x_708_; 
lean_dec(v_val_706_);
lean_dec(v_val_703_);
lean_dec(v_val_700_);
lean_dec(v_val_697_);
lean_dec(v_val_694_);
lean_dec(v_val_691_);
lean_del_object(v___x_687_);
lean_dec(v_digit_685_);
lean_dec_ref(v_bytesValue_681_);
lean_dec_ref(v_textValue_680_);
lean_dec(v_intValue_677_);
lean_dec(v_natValue_676_);
v___x_708_ = lean_box(0);
return v___x_708_;
}
else
{
lean_object* v_val_709_; lean_object* v___x_710_; 
v_val_709_ = lean_ctor_get(v___x_707_, 0);
lean_inc(v_val_709_);
lean_dec_ref_known(v___x_707_, 1);
v___x_710_ = l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_int32A_spec__0___redArg(v_int32Value_674_);
if (lean_obj_tag(v___x_710_) == 0)
{
lean_object* v___x_711_; 
lean_dec(v_val_709_);
lean_dec(v_val_706_);
lean_dec(v_val_703_);
lean_dec(v_val_700_);
lean_dec(v_val_697_);
lean_dec(v_val_694_);
lean_dec(v_val_691_);
lean_del_object(v___x_687_);
lean_dec(v_digit_685_);
lean_dec_ref(v_bytesValue_681_);
lean_dec_ref(v_textValue_680_);
lean_dec(v_intValue_677_);
lean_dec(v_natValue_676_);
v___x_711_ = lean_box(0);
return v___x_711_;
}
else
{
lean_object* v_val_712_; lean_object* v___x_713_; 
v_val_712_ = lean_ctor_get(v___x_710_, 0);
lean_inc(v_val_712_);
lean_dec_ref_known(v___x_710_, 1);
v___x_713_ = l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_int64A_spec__0___redArg(v_int64Value_675_);
if (lean_obj_tag(v___x_713_) == 0)
{
lean_object* v___x_714_; 
lean_dec(v_val_712_);
lean_dec(v_val_709_);
lean_dec(v_val_706_);
lean_dec(v_val_703_);
lean_dec(v_val_700_);
lean_dec(v_val_697_);
lean_dec(v_val_694_);
lean_dec(v_val_691_);
lean_del_object(v___x_687_);
lean_dec(v_digit_685_);
lean_dec_ref(v_bytesValue_681_);
lean_dec_ref(v_textValue_680_);
lean_dec(v_intValue_677_);
lean_dec(v_natValue_676_);
v___x_714_ = lean_box(0);
return v___x_714_;
}
else
{
lean_object* v_val_715_; lean_object* v___x_716_; 
v_val_715_ = lean_ctor_get(v___x_713_, 0);
lean_inc(v_val_715_);
lean_dec_ref_known(v___x_713_, 1);
v___x_716_ = l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_natA_spec__0___redArg(v_natValue_676_);
if (lean_obj_tag(v___x_716_) == 0)
{
lean_object* v___x_717_; 
lean_dec(v_val_715_);
lean_dec(v_val_712_);
lean_dec(v_val_709_);
lean_dec(v_val_706_);
lean_dec(v_val_703_);
lean_dec(v_val_700_);
lean_dec(v_val_697_);
lean_dec(v_val_694_);
lean_dec(v_val_691_);
lean_del_object(v___x_687_);
lean_dec(v_digit_685_);
lean_dec_ref(v_bytesValue_681_);
lean_dec_ref(v_textValue_680_);
lean_dec(v_intValue_677_);
v___x_717_ = lean_box(0);
return v___x_717_;
}
else
{
lean_object* v_val_718_; lean_object* v___x_719_; 
v_val_718_ = lean_ctor_get(v___x_716_, 0);
lean_inc(v_val_718_);
lean_dec_ref_known(v___x_716_, 1);
v___x_719_ = l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_intA_spec__0___redArg(v_intValue_677_);
if (lean_obj_tag(v___x_719_) == 0)
{
lean_object* v___x_720_; 
lean_dec(v_val_718_);
lean_dec(v_val_715_);
lean_dec(v_val_712_);
lean_dec(v_val_709_);
lean_dec(v_val_706_);
lean_dec(v_val_703_);
lean_dec(v_val_700_);
lean_dec(v_val_697_);
lean_dec(v_val_694_);
lean_dec(v_val_691_);
lean_del_object(v___x_687_);
lean_dec(v_digit_685_);
lean_dec_ref(v_bytesValue_681_);
lean_dec_ref(v_textValue_680_);
v___x_720_ = lean_box(0);
return v___x_720_;
}
else
{
lean_object* v_val_721_; lean_object* v___x_722_; 
v_val_721_ = lean_ctor_get(v___x_719_, 0);
lean_inc(v_val_721_);
lean_dec_ref_known(v___x_719_, 1);
v___x_722_ = l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_float32A_spec__0___redArg(v_float32Value_678_);
if (lean_obj_tag(v___x_722_) == 0)
{
lean_object* v___x_723_; 
lean_dec(v_val_721_);
lean_dec(v_val_718_);
lean_dec(v_val_715_);
lean_dec(v_val_712_);
lean_dec(v_val_709_);
lean_dec(v_val_706_);
lean_dec(v_val_703_);
lean_dec(v_val_700_);
lean_dec(v_val_697_);
lean_dec(v_val_694_);
lean_dec(v_val_691_);
lean_del_object(v___x_687_);
lean_dec(v_digit_685_);
lean_dec_ref(v_bytesValue_681_);
lean_dec_ref(v_textValue_680_);
v___x_723_ = lean_box(0);
return v___x_723_;
}
else
{
lean_object* v_val_724_; lean_object* v___x_725_; 
v_val_724_ = lean_ctor_get(v___x_722_, 0);
lean_inc(v_val_724_);
lean_dec_ref_known(v___x_722_, 1);
v___x_725_ = l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_float64A_spec__0___redArg(v_float64Value_679_);
if (lean_obj_tag(v___x_725_) == 0)
{
lean_object* v___x_726_; 
lean_dec(v_val_724_);
lean_dec(v_val_721_);
lean_dec(v_val_718_);
lean_dec(v_val_715_);
lean_dec(v_val_712_);
lean_dec(v_val_709_);
lean_dec(v_val_706_);
lean_dec(v_val_703_);
lean_dec(v_val_700_);
lean_dec(v_val_697_);
lean_dec(v_val_694_);
lean_dec(v_val_691_);
lean_del_object(v___x_687_);
lean_dec(v_digit_685_);
lean_dec_ref(v_bytesValue_681_);
lean_dec_ref(v_textValue_680_);
v___x_726_ = lean_box(0);
return v___x_726_;
}
else
{
lean_object* v_val_727_; lean_object* v___x_728_; 
v_val_727_ = lean_ctor_get(v___x_725_, 0);
lean_inc(v_val_727_);
lean_dec_ref_known(v___x_725_, 1);
v___x_728_ = l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_textA_spec__0___redArg(v_textValue_680_);
if (lean_obj_tag(v___x_728_) == 0)
{
lean_object* v___x_729_; 
lean_dec(v_val_727_);
lean_dec(v_val_724_);
lean_dec(v_val_721_);
lean_dec(v_val_718_);
lean_dec(v_val_715_);
lean_dec(v_val_712_);
lean_dec(v_val_709_);
lean_dec(v_val_706_);
lean_dec(v_val_703_);
lean_dec(v_val_700_);
lean_dec(v_val_697_);
lean_dec(v_val_694_);
lean_dec(v_val_691_);
lean_del_object(v___x_687_);
lean_dec(v_digit_685_);
lean_dec_ref(v_bytesValue_681_);
v___x_729_ = lean_box(0);
return v___x_729_;
}
else
{
lean_object* v_val_730_; lean_object* v___x_731_; 
v_val_730_ = lean_ctor_get(v___x_728_, 0);
lean_inc(v_val_730_);
lean_dec_ref_known(v___x_728_, 1);
v___x_731_ = l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_bytesA_spec__0___redArg(v_bytesValue_681_);
if (lean_obj_tag(v___x_731_) == 0)
{
lean_object* v___x_732_; 
lean_dec(v_val_730_);
lean_dec(v_val_727_);
lean_dec(v_val_724_);
lean_dec(v_val_721_);
lean_dec(v_val_718_);
lean_dec(v_val_715_);
lean_dec(v_val_712_);
lean_dec(v_val_709_);
lean_dec(v_val_706_);
lean_dec(v_val_703_);
lean_dec(v_val_700_);
lean_dec(v_val_697_);
lean_dec(v_val_694_);
lean_dec(v_val_691_);
lean_del_object(v___x_687_);
lean_dec(v_digit_685_);
v___x_732_ = lean_box(0);
return v___x_732_;
}
else
{
lean_object* v_val_733_; lean_object* v___x_734_; 
v_val_733_ = lean_ctor_get(v___x_731_, 0);
lean_inc(v_val_733_);
lean_dec_ref_known(v___x_731_, 1);
v___x_734_ = l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_charA_spec__0___redArg(v_charValue_682_);
if (lean_obj_tag(v___x_734_) == 0)
{
lean_object* v___x_735_; 
lean_dec(v_val_733_);
lean_dec(v_val_730_);
lean_dec(v_val_727_);
lean_dec(v_val_724_);
lean_dec(v_val_721_);
lean_dec(v_val_718_);
lean_dec(v_val_715_);
lean_dec(v_val_712_);
lean_dec(v_val_709_);
lean_dec(v_val_706_);
lean_dec(v_val_703_);
lean_dec(v_val_700_);
lean_dec(v_val_697_);
lean_dec(v_val_694_);
lean_dec(v_val_691_);
lean_del_object(v___x_687_);
lean_dec(v_digit_685_);
v___x_735_ = lean_box(0);
return v___x_735_;
}
else
{
lean_object* v_val_736_; lean_object* v___x_737_; 
v_val_736_ = lean_ctor_get(v___x_734_, 0);
lean_inc(v_val_736_);
lean_dec_ref_known(v___x_734_, 1);
v___x_737_ = l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_usizeA_spec__0___redArg(v_usizeValue_683_);
if (lean_obj_tag(v___x_737_) == 0)
{
lean_object* v___x_738_; 
lean_dec(v_val_736_);
lean_dec(v_val_733_);
lean_dec(v_val_730_);
lean_dec(v_val_727_);
lean_dec(v_val_724_);
lean_dec(v_val_721_);
lean_dec(v_val_718_);
lean_dec(v_val_715_);
lean_dec(v_val_712_);
lean_dec(v_val_709_);
lean_dec(v_val_706_);
lean_dec(v_val_703_);
lean_dec(v_val_700_);
lean_dec(v_val_697_);
lean_dec(v_val_694_);
lean_dec(v_val_691_);
lean_del_object(v___x_687_);
lean_dec(v_digit_685_);
v___x_738_ = lean_box(0);
return v___x_738_;
}
else
{
lean_object* v_val_739_; lean_object* v___x_740_; 
v_val_739_ = lean_ctor_get(v___x_737_, 0);
lean_inc(v_val_739_);
lean_dec_ref_known(v___x_737_, 1);
v___x_740_ = l_NominalPrimitiveSubtypes_checked___at___00NominalPrimitiveSubtypes_isizeA_spec__0___redArg(v_isizeValue_684_);
if (lean_obj_tag(v___x_740_) == 0)
{
lean_object* v___x_741_; 
lean_dec(v_val_739_);
lean_dec(v_val_736_);
lean_dec(v_val_733_);
lean_dec(v_val_730_);
lean_dec(v_val_727_);
lean_dec(v_val_724_);
lean_dec(v_val_721_);
lean_dec(v_val_718_);
lean_dec(v_val_715_);
lean_dec(v_val_712_);
lean_dec(v_val_709_);
lean_dec(v_val_706_);
lean_dec(v_val_703_);
lean_dec(v_val_700_);
lean_dec(v_val_697_);
lean_dec(v_val_694_);
lean_dec(v_val_691_);
lean_del_object(v___x_687_);
lean_dec(v_digit_685_);
v___x_741_ = lean_box(0);
return v___x_741_;
}
else
{
lean_object* v_val_742_; lean_object* v___x_744_; uint8_t v_isShared_745_; uint8_t v_isSharedCheck_769_; 
v_val_742_ = lean_ctor_get(v___x_740_, 0);
v_isSharedCheck_769_ = !lean_is_exclusive(v___x_740_);
if (v_isSharedCheck_769_ == 0)
{
v___x_744_ = v___x_740_;
v_isShared_745_ = v_isSharedCheck_769_;
goto v_resetjp_743_;
}
else
{
lean_inc(v_val_742_);
lean_dec(v___x_740_);
v___x_744_ = lean_box(0);
v_isShared_745_ = v_isSharedCheck_769_;
goto v_resetjp_743_;
}
v_resetjp_743_:
{
lean_object* v___x_746_; uint8_t v___x_747_; 
v___x_746_ = lean_unsigned_to_nat(3u);
v___x_747_ = lean_nat_dec_lt(v_digit_685_, v___x_746_);
if (v___x_747_ == 0)
{
lean_object* v___x_748_; 
lean_del_object(v___x_744_);
lean_dec(v_val_742_);
lean_dec(v_val_739_);
lean_dec(v_val_736_);
lean_dec(v_val_733_);
lean_dec(v_val_730_);
lean_dec(v_val_727_);
lean_dec(v_val_724_);
lean_dec(v_val_721_);
lean_dec(v_val_718_);
lean_dec(v_val_715_);
lean_dec(v_val_712_);
lean_dec(v_val_709_);
lean_dec(v_val_706_);
lean_dec(v_val_703_);
lean_dec(v_val_700_);
lean_dec(v_val_697_);
lean_dec(v_val_694_);
lean_dec(v_val_691_);
lean_del_object(v___x_687_);
lean_dec(v_digit_685_);
v___x_748_ = lean_box(0);
return v___x_748_;
}
else
{
lean_object* v___x_750_; 
if (v_isShared_688_ == 0)
{
lean_ctor_set(v___x_687_, 4, v_val_733_);
lean_ctor_set(v___x_687_, 3, v_val_730_);
lean_ctor_set(v___x_687_, 2, v_val_721_);
lean_ctor_set(v___x_687_, 1, v_val_718_);
v___x_750_ = v___x_687_;
goto v_reusejp_749_;
}
else
{
lean_object* v_reuseFailAlloc_768_; 
v_reuseFailAlloc_768_ = lean_alloc_ctor(0, 6, sizeof(size_t)*2 + 47);
lean_ctor_set(v_reuseFailAlloc_768_, 0, v_unitValue_666_);
lean_ctor_set(v_reuseFailAlloc_768_, 1, v_val_718_);
lean_ctor_set(v_reuseFailAlloc_768_, 2, v_val_721_);
lean_ctor_set(v_reuseFailAlloc_768_, 3, v_val_730_);
lean_ctor_set(v_reuseFailAlloc_768_, 4, v_val_733_);
lean_ctor_set(v_reuseFailAlloc_768_, 5, v_digit_685_);
v___x_750_ = v_reuseFailAlloc_768_;
goto v_reusejp_749_;
}
v_reusejp_749_:
{
uint8_t v___x_751_; uint8_t v___x_752_; uint16_t v___x_753_; uint32_t v___x_754_; uint64_t v___x_755_; uint8_t v___x_756_; uint16_t v___x_757_; uint32_t v___x_758_; uint64_t v___x_759_; float v___x_760_; double v___x_761_; uint32_t v___x_762_; size_t v___x_763_; size_t v___x_764_; lean_object* v___x_766_; 
v___x_751_ = lean_unbox(v_val_691_);
lean_dec(v_val_691_);
lean_ctor_set_uint8(v___x_750_, sizeof(void*)*8 + 44, v___x_751_);
v___x_752_ = lean_unbox(v_val_694_);
lean_dec(v_val_694_);
lean_ctor_set_uint8(v___x_750_, sizeof(void*)*8 + 45, v___x_752_);
v___x_753_ = lean_unbox(v_val_697_);
lean_dec(v_val_697_);
lean_ctor_set_uint16(v___x_750_, sizeof(void*)*8 + 40, v___x_753_);
v___x_754_ = lean_unbox_uint32(v_val_700_);
lean_dec(v_val_700_);
lean_ctor_set_uint32(v___x_750_, sizeof(void*)*8 + 24, v___x_754_);
v___x_755_ = lean_unbox_uint64(v_val_703_);
lean_dec(v_val_703_);
lean_ctor_set_uint64(v___x_750_, sizeof(void*)*8, v___x_755_);
v___x_756_ = lean_unbox(v_val_706_);
lean_dec(v_val_706_);
lean_ctor_set_uint8(v___x_750_, sizeof(void*)*8 + 46, v___x_756_);
v___x_757_ = lean_unbox(v_val_709_);
lean_dec(v_val_709_);
lean_ctor_set_uint16(v___x_750_, sizeof(void*)*8 + 42, v___x_757_);
v___x_758_ = lean_unbox_uint32(v_val_712_);
lean_dec(v_val_712_);
lean_ctor_set_uint32(v___x_750_, sizeof(void*)*8 + 28, v___x_758_);
v___x_759_ = lean_unbox_uint64(v_val_715_);
lean_dec(v_val_715_);
lean_ctor_set_uint64(v___x_750_, sizeof(void*)*8 + 8, v___x_759_);
v___x_760_ = lean_unbox_float32(v_val_724_);
lean_dec(v_val_724_);
lean_ctor_set_float32(v___x_750_, sizeof(void*)*8 + 32, v___x_760_);
v___x_761_ = lean_unbox_float(v_val_727_);
lean_dec(v_val_727_);
lean_ctor_set_float(v___x_750_, sizeof(void*)*8 + 16, v___x_761_);
v___x_762_ = lean_unbox_uint32(v_val_736_);
lean_dec(v_val_736_);
lean_ctor_set_uint32(v___x_750_, sizeof(void*)*8 + 36, v___x_762_);
v___x_763_ = lean_unbox_usize(v_val_739_);
lean_dec(v_val_739_);
lean_ctor_set_usize(v___x_750_, 6, v___x_763_);
v___x_764_ = lean_unbox_usize(v_val_742_);
lean_dec(v_val_742_);
lean_ctor_set_usize(v___x_750_, 7, v___x_764_);
if (v_isShared_745_ == 0)
{
lean_ctor_set(v___x_744_, 0, v___x_750_);
v___x_766_ = v___x_744_;
goto v_reusejp_765_;
}
else
{
lean_object* v_reuseFailAlloc_767_; 
v_reuseFailAlloc_767_ = lean_alloc_ctor(1, 1, 0);
lean_ctor_set(v_reuseFailAlloc_767_, 0, v___x_750_);
v___x_766_ = v_reuseFailAlloc_767_;
goto v_reusejp_765_;
}
v_reusejp_765_:
{
return v___x_766_;
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
lean_object* v___x_771_; lean_object* v___x_772_; lean_object* v___x_773_; lean_object* v___x_774_; 
v___x_771_ = lean_box(0);
v___x_772_ = lean_unsigned_to_nat(2u);
v___x_773_ = lean_mk_empty_array_with_capacity(v___x_772_);
v___x_774_ = lean_array_push(v___x_773_, v___x_771_);
return v___x_774_;
}
}
LEAN_EXPORT lean_object* lb_nominal_result_only_probe_source_produceGroup(lean_object* v_value_775_){
  fputs("LB_SUBTYPE_ENTRY_V1 enter source NominalPrimitiveSubtypes.produceGroup\n", stderr);

_start:
{
lean_object* v___x_776_; 
v___x_776_ = lb_nominal_result_only_probe_source_produce(v_value_775_);
if (lean_obj_tag(v___x_776_) == 0)
{
lean_object* v___x_777_; lean_object* v___x_778_; lean_object* v___x_779_; 
v___x_777_ = lean_unsigned_to_nat(1u);
v___x_778_ = lean_mk_empty_array_with_capacity(v___x_777_);
v___x_779_ = lean_array_push(v___x_778_, v___x_776_);
return v___x_779_;
}
else
{
lean_object* v___x_780_; lean_object* v___x_781_; 
v___x_780_ = lean_obj_once(&l_NominalPrimitiveSubtypes_produceGroup___closed__0, &l_NominalPrimitiveSubtypes_produceGroup___closed__0_once, _init_l_NominalPrimitiveSubtypes_produceGroup___closed__0);
v___x_781_ = lean_array_push(v___x_780_, v___x_776_);
return v___x_781_;
}
}
}
LEAN_EXPORT lean_object* lb_nominal_result_only_probe_source_producePair(lean_object* v_value_782_){
  fputs("LB_SUBTYPE_ENTRY_V1 enter source NominalPrimitiveSubtypes.producePair\n", stderr);

_start:
{
lean_object* v___x_783_; lean_object* v___x_784_; 
v___x_783_ = lb_nominal_result_only_probe_source_produceGroup(v_value_782_);
lean_inc_ref(v___x_783_);
v___x_784_ = lean_alloc_ctor(0, 2, 0);
lean_ctor_set(v___x_784_, 0, v___x_783_);
lean_ctor_set(v___x_784_, 1, v___x_783_);
return v___x_784_;
}
}
LEAN_EXPORT lean_object* lb_nominal_result_only_probe_source_produceEvent(lean_object* v_value_785_){
  fputs("LB_SUBTYPE_ENTRY_V1 enter source NominalPrimitiveSubtypes.produceEvent\n", stderr);

_start:
{
lean_object* v___x_786_; 
v___x_786_ = lb_nominal_result_only_probe_source_produce(v_value_785_);
if (lean_obj_tag(v___x_786_) == 0)
{
lean_object* v___x_787_; 
v___x_787_ = lean_box(0);
return v___x_787_;
}
else
{
lean_object* v_val_788_; lean_object* v___x_790_; uint8_t v_isShared_791_; uint8_t v_isSharedCheck_795_; 
v_val_788_ = lean_ctor_get(v___x_786_, 0);
v_isSharedCheck_795_ = !lean_is_exclusive(v___x_786_);
if (v_isSharedCheck_795_ == 0)
{
v___x_790_ = v___x_786_;
v_isShared_791_ = v_isSharedCheck_795_;
goto v_resetjp_789_;
}
else
{
lean_inc(v_val_788_);
lean_dec(v___x_786_);
v___x_790_ = lean_box(0);
v_isShared_791_ = v_isSharedCheck_795_;
goto v_resetjp_789_;
}
v_resetjp_789_:
{
lean_object* v___x_793_; 
if (v_isShared_791_ == 0)
{
v___x_793_ = v___x_790_;
goto v_reusejp_792_;
}
else
{
lean_object* v_reuseFailAlloc_794_; 
v_reuseFailAlloc_794_ = lean_alloc_ctor(1, 1, 0);
lean_ctor_set(v_reuseFailAlloc_794_, 0, v_val_788_);
v___x_793_ = v_reuseFailAlloc_794_;
goto v_reusejp_792_;
}
v_reusejp_792_:
{
return v___x_793_;
}
}
}
}
}
static lean_object* _init_l_NominalPrimitiveSubtypes_produceChoices___closed__2(void){
_start:
{
lean_object* v___x_802_; lean_object* v___x_803_; lean_object* v___x_804_; lean_object* v___x_805_; 
v___x_802_ = lean_box(0);
v___x_803_ = lean_unsigned_to_nat(3u);
v___x_804_ = lean_mk_empty_array_with_capacity(v___x_803_);
v___x_805_ = lean_array_push(v___x_804_, v___x_802_);
return v___x_805_;
}
}
LEAN_EXPORT lean_object* lb_nominal_result_only_probe_source_produceChoices(lean_object* v_value_806_){
  fputs("LB_SUBTYPE_ENTRY_V1 enter source NominalPrimitiveSubtypes.produceChoices\n", stderr);

_start:
{
lean_object* v___x_807_; 
v___x_807_ = lb_nominal_result_only_probe_source_produce(v_value_806_);
if (lean_obj_tag(v___x_807_) == 0)
{
lean_object* v___x_808_; 
v___x_808_ = ((lean_object*)(l_NominalPrimitiveSubtypes_produceChoices___closed__1));
return v___x_808_;
}
else
{
lean_object* v_val_809_; lean_object* v___x_811_; uint8_t v_isShared_812_; uint8_t v_isSharedCheck_823_; 
v_val_809_ = lean_ctor_get(v___x_807_, 0);
v_isSharedCheck_823_ = !lean_is_exclusive(v___x_807_);
if (v_isSharedCheck_823_ == 0)
{
v___x_811_ = v___x_807_;
v_isShared_812_ = v_isSharedCheck_823_;
goto v_resetjp_810_;
}
else
{
lean_inc(v_val_809_);
lean_dec(v___x_807_);
v___x_811_ = lean_box(0);
v_isShared_812_ = v_isSharedCheck_823_;
goto v_resetjp_810_;
}
v_resetjp_810_:
{
lean_object* v___x_813_; lean_object* v___x_815_; 
lean_inc(v_val_809_);
v___x_813_ = lean_alloc_ctor(1, 1, 0);
lean_ctor_set(v___x_813_, 0, v_val_809_);
if (v_isShared_812_ == 0)
{
lean_ctor_set(v___x_811_, 0, v___x_813_);
v___x_815_ = v___x_811_;
goto v_reusejp_814_;
}
else
{
lean_object* v_reuseFailAlloc_822_; 
v_reuseFailAlloc_822_ = lean_alloc_ctor(1, 1, 0);
lean_ctor_set(v_reuseFailAlloc_822_, 0, v___x_813_);
v___x_815_ = v_reuseFailAlloc_822_;
goto v_reusejp_814_;
}
v_reusejp_814_:
{
lean_object* v___x_816_; lean_object* v___x_817_; lean_object* v___x_818_; lean_object* v___x_819_; lean_object* v___x_820_; lean_object* v___x_821_; 
v___x_816_ = lean_alloc_ctor(0, 1, 0);
lean_ctor_set(v___x_816_, 0, v_val_809_);
v___x_817_ = lean_alloc_ctor(1, 1, 0);
lean_ctor_set(v___x_817_, 0, v___x_816_);
v___x_818_ = lean_obj_once(&l_NominalPrimitiveSubtypes_produceChoices___closed__2, &l_NominalPrimitiveSubtypes_produceChoices___closed__2_once, _init_l_NominalPrimitiveSubtypes_produceChoices___closed__2);
v___x_819_ = lean_array_push(v___x_818_, v___x_815_);
v___x_820_ = lean_array_push(v___x_819_, v___x_817_);
v___x_821_ = lean_alloc_ctor(2, 1, 0);
lean_ctor_set(v___x_821_, 0, v___x_820_);
return v___x_821_;
}
}
}
}
}
static uint32_t _init_l_NominalPrimitiveSubtypes_wordBits___closed__0(void){
_start:
{
lean_object* v___x_824_; uint32_t v___x_825_; 
v___x_824_ = l_System_Platform_numBits;
v___x_825_ = lean_uint32_of_nat(v___x_824_);
return v___x_825_;
}
}
static uint32_t _init_lb_nominal_result_only_probe_source_wordBits(void){
_start:
{
uint32_t v___x_826_; 
v___x_826_ = lean_uint32_once(&l_NominalPrimitiveSubtypes_wordBits___closed__0, &l_NominalPrimitiveSubtypes_wordBits___closed__0_once, _init_l_NominalPrimitiveSubtypes_wordBits___closed__0);
return v___x_826_;
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
lb_nominal_result_only_probe_source_wordBits = _init_lb_nominal_result_only_probe_source_wordBits();
return lean_io_result_mk_ok(lean_box(0));
}
#ifdef __cplusplus
}
#endif
