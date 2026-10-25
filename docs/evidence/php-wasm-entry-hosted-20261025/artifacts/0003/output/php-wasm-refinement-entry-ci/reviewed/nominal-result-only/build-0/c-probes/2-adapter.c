#include <stdio.h>
// Lean compiler output
// Module: LeanBridgeNative19ad06f04a0c2d39
// Imports: public import Init public meta import Init public import NominalPrimitiveSubtypes
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
size_t lean_isize_of_nat(lean_object*);
extern lean_object* l_ByteArray_empty;
double lean_float_of_nat(lean_object*);
float lean_float32_of_nat(lean_object*);
lean_object* lean_nat_to_int(lean_object*);
uint64_t lean_int64_of_nat(lean_object*);
uint32_t lean_int32_of_nat(lean_object*);
uint16_t lean_int16_of_nat(lean_object*);
uint8_t lean_int8_of_nat(lean_object*);
size_t lean_array_size(lean_object*);
uint8_t lean_usize_dec_lt(size_t, size_t);
lean_object* lean_array_uget(lean_object*, size_t);
lean_object* lean_array_uset(lean_object*, size_t, lean_object*);
size_t lean_usize_add(size_t, size_t);
extern lean_object* l_Int_instInhabited;
lean_object* lean_panic_fn_borrowed(lean_object*, lean_object*);
extern uint32_t lb_nominal_result_only_probe_source_wordBits;
lean_object* l_Int_repr(lean_object*);
lean_object* lean_mk_empty_array_with_capacity(lean_object*);
lean_object* lb_nominal_result_only_probe_source_produceChoices(lean_object*);
lean_object* lb_nominal_result_only_probe_source_produceGroup(lean_object*);
lean_object* lb_nominal_result_only_probe_source_produceEvent(lean_object*);
lean_object* lb_nominal_result_only_probe_source_producePair(lean_object*);
lean_object* lb_nominal_result_only_probe_source_produce(lean_object*);
lean_object* l_Nat_reprFast(lean_object*);
lean_object* lean_string_utf8_byte_size(lean_object*);
lean_object* l_String_Slice_toInt_x3f(lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNative19ad06f04a0c2d39_LbErased_NominalPrimitiveSubtypes_Packet_erase(lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNative19ad06f04a0c2d39_LbErased_NominalPrimitiveSubtypes_Event_ctorIdx(lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNative19ad06f04a0c2d39_LbErased_NominalPrimitiveSubtypes_Event_ctorIdx___boxed(lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNative19ad06f04a0c2d39_LbErased_NominalPrimitiveSubtypes_Event_ctorElim___redArg(lean_object*, lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNative19ad06f04a0c2d39_LbErased_NominalPrimitiveSubtypes_Event_ctorElim(lean_object*, lean_object*, lean_object*, lean_object*, lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNative19ad06f04a0c2d39_LbErased_NominalPrimitiveSubtypes_Event_ctorElim___boxed(lean_object*, lean_object*, lean_object*, lean_object*, lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNative19ad06f04a0c2d39_LbErased_NominalPrimitiveSubtypes_Event_empty_elim___redArg(lean_object*, lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNative19ad06f04a0c2d39_LbErased_NominalPrimitiveSubtypes_Event_empty_elim(lean_object*, lean_object*, lean_object*, lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNative19ad06f04a0c2d39_LbErased_NominalPrimitiveSubtypes_Event_box_elim___redArg(lean_object*, lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNative19ad06f04a0c2d39_LbErased_NominalPrimitiveSubtypes_Event_box_elim(lean_object*, lean_object*, lean_object*, lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNative19ad06f04a0c2d39_LbErased_NominalPrimitiveSubtypes_Event_choices_elim___redArg(lean_object*, lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNative19ad06f04a0c2d39_LbErased_NominalPrimitiveSubtypes_Event_choices_elim(lean_object*, lean_object*, lean_object*, lean_object*);
LEAN_EXPORT lean_object* l___private_Init_Data_Array_Basic_0__Array_mapMUnsafe_map___at___00LeanBridgeNative19ad06f04a0c2d39_LbErased_NominalPrimitiveSubtypes_Event_erase_spec__0(size_t, size_t, lean_object*);
LEAN_EXPORT lean_object* l___private_Init_Data_Array_Basic_0__Array_mapMUnsafe_map___at___00LeanBridgeNative19ad06f04a0c2d39_LbErased_NominalPrimitiveSubtypes_Event_erase_spec__0___boxed(lean_object*, lean_object*, lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNative19ad06f04a0c2d39_LbErased_NominalPrimitiveSubtypes_Event_erase(lean_object*);
LEAN_EXPORT lean_object* l___private_Init_Data_Array_Basic_0__Array_mapMUnsafe_map___at___00__private_Init_Data_Array_Basic_0__Array_mapMUnsafe_map___at___00LeanBridgeNative19ad06f04a0c2d39_LbErased_NominalPrimitiveSubtypes_Pair_erase_spec__0_spec__0(size_t, size_t, lean_object*);
LEAN_EXPORT lean_object* l___private_Init_Data_Array_Basic_0__Array_mapMUnsafe_map___at___00__private_Init_Data_Array_Basic_0__Array_mapMUnsafe_map___at___00LeanBridgeNative19ad06f04a0c2d39_LbErased_NominalPrimitiveSubtypes_Pair_erase_spec__0_spec__0___boxed(lean_object*, lean_object*, lean_object*);
LEAN_EXPORT lean_object* l___private_Init_Data_Array_Basic_0__Array_mapMUnsafe_map___at___00LeanBridgeNative19ad06f04a0c2d39_LbErased_NominalPrimitiveSubtypes_Pair_erase_spec__0(size_t, size_t, lean_object*);
LEAN_EXPORT lean_object* l___private_Init_Data_Array_Basic_0__Array_mapMUnsafe_map___at___00LeanBridgeNative19ad06f04a0c2d39_LbErased_NominalPrimitiveSubtypes_Pair_erase_spec__0___boxed(lean_object*, lean_object*, lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNative19ad06f04a0c2d39_LbErased_NominalPrimitiveSubtypes_Pair_erase(lean_object*);
LEAN_EXPORT lean_object* lb_4d420414dfdb252510c59482(lean_object*);
LEAN_EXPORT lean_object* lb_e791062d392a94a18563a45f(lean_object*);
LEAN_EXPORT lean_object* lb_e721c226f4fcff66a4ffea0f(lean_object*);
LEAN_EXPORT lean_object* lb_2c1c751c1667dd64cd4c3fe3(lean_object*);
LEAN_EXPORT lean_object* lb_a54b47645ca8b931f9ef293a(lean_object*);
LEAN_EXPORT uint32_t lb_2df79ff835926bf7b8864ec6(lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNative19ad06f04a0c2d39_f__lb__2df79ff835926bf7b8864ec6___boxed(lean_object*);
LEAN_EXPORT lean_object* lb_t6ed79f4a8a3bc4358259_make(lean_object*, uint8_t, uint8_t, uint16_t, uint32_t, uint64_t, uint8_t, uint16_t, uint32_t, uint64_t, lean_object*, lean_object*, float, double, lean_object*, lean_object*, uint32_t, size_t, size_t, lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNative19ad06f04a0c2d39_f__lb__t6ed79f4a8a3bc4358259__make___boxed(lean_object**);
LEAN_EXPORT lean_object* lb_t6ed79f4a8a3bc4358259_get0(lean_object*);
LEAN_EXPORT uint8_t lb_t6ed79f4a8a3bc4358259_get1(lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNative19ad06f04a0c2d39_f__lb__t6ed79f4a8a3bc4358259__get1___boxed(lean_object*);
LEAN_EXPORT uint8_t lb_t6ed79f4a8a3bc4358259_get2(lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNative19ad06f04a0c2d39_f__lb__t6ed79f4a8a3bc4358259__get2___boxed(lean_object*);
LEAN_EXPORT uint16_t lb_t6ed79f4a8a3bc4358259_get3(lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNative19ad06f04a0c2d39_f__lb__t6ed79f4a8a3bc4358259__get3___boxed(lean_object*);
LEAN_EXPORT uint32_t lb_t6ed79f4a8a3bc4358259_get4(lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNative19ad06f04a0c2d39_f__lb__t6ed79f4a8a3bc4358259__get4___boxed(lean_object*);
LEAN_EXPORT uint64_t lb_t6ed79f4a8a3bc4358259_get5(lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNative19ad06f04a0c2d39_f__lb__t6ed79f4a8a3bc4358259__get5___boxed(lean_object*);
LEAN_EXPORT uint8_t lb_t6ed79f4a8a3bc4358259_get6(lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNative19ad06f04a0c2d39_f__lb__t6ed79f4a8a3bc4358259__get6___boxed(lean_object*);
LEAN_EXPORT uint16_t lb_t6ed79f4a8a3bc4358259_get7(lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNative19ad06f04a0c2d39_f__lb__t6ed79f4a8a3bc4358259__get7___boxed(lean_object*);
LEAN_EXPORT uint32_t lb_t6ed79f4a8a3bc4358259_get8(lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNative19ad06f04a0c2d39_f__lb__t6ed79f4a8a3bc4358259__get8___boxed(lean_object*);
LEAN_EXPORT uint64_t lb_t6ed79f4a8a3bc4358259_get9(lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNative19ad06f04a0c2d39_f__lb__t6ed79f4a8a3bc4358259__get9___boxed(lean_object*);
LEAN_EXPORT lean_object* lb_t6ed79f4a8a3bc4358259_get10(lean_object*);
LEAN_EXPORT lean_object* lb_t6ed79f4a8a3bc4358259_get11(lean_object*);
LEAN_EXPORT float lb_t6ed79f4a8a3bc4358259_get12(lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNative19ad06f04a0c2d39_f__lb__t6ed79f4a8a3bc4358259__get12___boxed(lean_object*);
LEAN_EXPORT double lb_t6ed79f4a8a3bc4358259_get13(lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNative19ad06f04a0c2d39_f__lb__t6ed79f4a8a3bc4358259__get13___boxed(lean_object*);
LEAN_EXPORT lean_object* lb_t6ed79f4a8a3bc4358259_get14(lean_object*);
LEAN_EXPORT lean_object* lb_t6ed79f4a8a3bc4358259_get15(lean_object*);
LEAN_EXPORT uint32_t lb_t6ed79f4a8a3bc4358259_get16(lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNative19ad06f04a0c2d39_f__lb__t6ed79f4a8a3bc4358259__get16___boxed(lean_object*);
LEAN_EXPORT size_t lb_t6ed79f4a8a3bc4358259_get17(lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNative19ad06f04a0c2d39_f__lb__t6ed79f4a8a3bc4358259__get17___boxed(lean_object*);
LEAN_EXPORT size_t lb_t6ed79f4a8a3bc4358259_get18(lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNative19ad06f04a0c2d39_f__lb__t6ed79f4a8a3bc4358259__get18___boxed(lean_object*);
LEAN_EXPORT lean_object* lb_t6ed79f4a8a3bc4358259_get19(lean_object*);
LEAN_EXPORT lean_object* lb_t980449f277836feadaee_make(lean_object*, uint8_t, uint8_t, uint16_t, uint32_t, uint64_t, uint8_t, uint16_t, uint32_t, uint64_t, lean_object*, lean_object*, float, double, lean_object*, lean_object*, uint32_t, size_t, size_t, lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNative19ad06f04a0c2d39_f__lb__t980449f277836feadaee__make___boxed(lean_object**);
LEAN_EXPORT lean_object* lb_t980449f277836feadaee_get0(lean_object*);
LEAN_EXPORT uint8_t lb_t980449f277836feadaee_get1(lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNative19ad06f04a0c2d39_f__lb__t980449f277836feadaee__get1___boxed(lean_object*);
LEAN_EXPORT uint8_t lb_t980449f277836feadaee_get2(lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNative19ad06f04a0c2d39_f__lb__t980449f277836feadaee__get2___boxed(lean_object*);
LEAN_EXPORT uint16_t lb_t980449f277836feadaee_get3(lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNative19ad06f04a0c2d39_f__lb__t980449f277836feadaee__get3___boxed(lean_object*);
LEAN_EXPORT uint32_t lb_t980449f277836feadaee_get4(lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNative19ad06f04a0c2d39_f__lb__t980449f277836feadaee__get4___boxed(lean_object*);
LEAN_EXPORT uint64_t lb_t980449f277836feadaee_get5(lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNative19ad06f04a0c2d39_f__lb__t980449f277836feadaee__get5___boxed(lean_object*);
LEAN_EXPORT uint8_t lb_t980449f277836feadaee_get6(lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNative19ad06f04a0c2d39_f__lb__t980449f277836feadaee__get6___boxed(lean_object*);
LEAN_EXPORT uint16_t lb_t980449f277836feadaee_get7(lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNative19ad06f04a0c2d39_f__lb__t980449f277836feadaee__get7___boxed(lean_object*);
LEAN_EXPORT uint32_t lb_t980449f277836feadaee_get8(lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNative19ad06f04a0c2d39_f__lb__t980449f277836feadaee__get8___boxed(lean_object*);
LEAN_EXPORT uint64_t lb_t980449f277836feadaee_get9(lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNative19ad06f04a0c2d39_f__lb__t980449f277836feadaee__get9___boxed(lean_object*);
LEAN_EXPORT lean_object* lb_t980449f277836feadaee_get10(lean_object*);
LEAN_EXPORT lean_object* lb_t980449f277836feadaee_get11(lean_object*);
LEAN_EXPORT float lb_t980449f277836feadaee_get12(lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNative19ad06f04a0c2d39_f__lb__t980449f277836feadaee__get12___boxed(lean_object*);
LEAN_EXPORT double lb_t980449f277836feadaee_get13(lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNative19ad06f04a0c2d39_f__lb__t980449f277836feadaee__get13___boxed(lean_object*);
LEAN_EXPORT lean_object* lb_t980449f277836feadaee_get14(lean_object*);
LEAN_EXPORT lean_object* lb_t980449f277836feadaee_get15(lean_object*);
LEAN_EXPORT uint32_t lb_t980449f277836feadaee_get16(lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNative19ad06f04a0c2d39_f__lb__t980449f277836feadaee__get16___boxed(lean_object*);
LEAN_EXPORT size_t lb_t980449f277836feadaee_get17(lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNative19ad06f04a0c2d39_f__lb__t980449f277836feadaee__get17___boxed(lean_object*);
LEAN_EXPORT size_t lb_t980449f277836feadaee_get18(lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNative19ad06f04a0c2d39_f__lb__t980449f277836feadaee__get18___boxed(lean_object*);
LEAN_EXPORT lean_object* lb_t980449f277836feadaee_get19(lean_object*);
LEAN_EXPORT lean_object* lb_td552bec1d6b17ed5222c_none(lean_object*);
LEAN_EXPORT lean_object* lb_td552bec1d6b17ed5222c_some(lean_object*);
LEAN_EXPORT uint8_t lb_td552bec1d6b17ed5222c_has(lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNative19ad06f04a0c2d39_f__lb__td552bec1d6b17ed5222c__has___boxed(lean_object*);
static lean_once_cell_t l_LeanBridgeNative19ad06f04a0c2d39_f__lb__td552bec1d6b17ed5222c__get0___closed__0_once = LEAN_ONCE_CELL_INITIALIZER;
static uint8_t l_LeanBridgeNative19ad06f04a0c2d39_f__lb__td552bec1d6b17ed5222c__get0___closed__0;
static lean_once_cell_t l_LeanBridgeNative19ad06f04a0c2d39_f__lb__td552bec1d6b17ed5222c__get0___closed__1_once = LEAN_ONCE_CELL_INITIALIZER;
static uint16_t l_LeanBridgeNative19ad06f04a0c2d39_f__lb__td552bec1d6b17ed5222c__get0___closed__1;
static lean_once_cell_t l_LeanBridgeNative19ad06f04a0c2d39_f__lb__td552bec1d6b17ed5222c__get0___closed__2_once = LEAN_ONCE_CELL_INITIALIZER;
static uint32_t l_LeanBridgeNative19ad06f04a0c2d39_f__lb__td552bec1d6b17ed5222c__get0___closed__2;
static lean_once_cell_t l_LeanBridgeNative19ad06f04a0c2d39_f__lb__td552bec1d6b17ed5222c__get0___closed__3_once = LEAN_ONCE_CELL_INITIALIZER;
static uint64_t l_LeanBridgeNative19ad06f04a0c2d39_f__lb__td552bec1d6b17ed5222c__get0___closed__3;
static lean_once_cell_t l_LeanBridgeNative19ad06f04a0c2d39_f__lb__td552bec1d6b17ed5222c__get0___closed__4_once = LEAN_ONCE_CELL_INITIALIZER;
static lean_object* l_LeanBridgeNative19ad06f04a0c2d39_f__lb__td552bec1d6b17ed5222c__get0___closed__4;
static lean_once_cell_t l_LeanBridgeNative19ad06f04a0c2d39_f__lb__td552bec1d6b17ed5222c__get0___closed__5_once = LEAN_ONCE_CELL_INITIALIZER;
static float l_LeanBridgeNative19ad06f04a0c2d39_f__lb__td552bec1d6b17ed5222c__get0___closed__5;
static lean_once_cell_t l_LeanBridgeNative19ad06f04a0c2d39_f__lb__td552bec1d6b17ed5222c__get0___closed__6_once = LEAN_ONCE_CELL_INITIALIZER;
static double l_LeanBridgeNative19ad06f04a0c2d39_f__lb__td552bec1d6b17ed5222c__get0___closed__6;
static const lean_string_object l_LeanBridgeNative19ad06f04a0c2d39_f__lb__td552bec1d6b17ed5222c__get0___closed__7_value = {.m_header = {.m_rc = 0, .m_cs_sz = 0, .m_other = 0, .m_tag = 249}, .m_size = 1, .m_capacity = 1, .m_length = 0, .m_data = ""};
static const lean_object* l_LeanBridgeNative19ad06f04a0c2d39_f__lb__td552bec1d6b17ed5222c__get0___closed__7 = (const lean_object*)&l_LeanBridgeNative19ad06f04a0c2d39_f__lb__td552bec1d6b17ed5222c__get0___closed__7_value;
static lean_once_cell_t l_LeanBridgeNative19ad06f04a0c2d39_f__lb__td552bec1d6b17ed5222c__get0___closed__8_once = LEAN_ONCE_CELL_INITIALIZER;
static size_t l_LeanBridgeNative19ad06f04a0c2d39_f__lb__td552bec1d6b17ed5222c__get0___closed__8;
static lean_once_cell_t l_LeanBridgeNative19ad06f04a0c2d39_f__lb__td552bec1d6b17ed5222c__get0___closed__9_once = LEAN_ONCE_CELL_INITIALIZER;
static lean_object* l_LeanBridgeNative19ad06f04a0c2d39_f__lb__td552bec1d6b17ed5222c__get0___closed__9;
LEAN_EXPORT lean_object* lb_td552bec1d6b17ed5222c_get0(lean_object*);
LEAN_EXPORT uint8_t lb_td367e4fc052df6d1c32d_has(lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNative19ad06f04a0c2d39_f__lb__td367e4fc052df6d1c32d__has___boxed(lean_object*);
LEAN_EXPORT lean_object* lb_td367e4fc052df6d1c32d_ok(lean_object*);
LEAN_EXPORT lean_object* lb_td367e4fc052df6d1c32d_get0(lean_object*);
LEAN_EXPORT lean_object* lb_td367e4fc052df6d1c32d_error(lean_object*);
LEAN_EXPORT lean_object* lb_td367e4fc052df6d1c32d_get1(lean_object*);
LEAN_EXPORT lean_object* lb_t5a1383905e3435e418a9_none(lean_object*);
LEAN_EXPORT lean_object* lb_t5a1383905e3435e418a9_some(lean_object*);
LEAN_EXPORT uint8_t lb_t5a1383905e3435e418a9_has(lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNative19ad06f04a0c2d39_f__lb__t5a1383905e3435e418a9__has___boxed(lean_object*);
static lean_once_cell_t l_LeanBridgeNative19ad06f04a0c2d39_f__lb__t5a1383905e3435e418a9__get0___closed__0_once = LEAN_ONCE_CELL_INITIALIZER;
static lean_object* l_LeanBridgeNative19ad06f04a0c2d39_f__lb__t5a1383905e3435e418a9__get0___closed__0;
LEAN_EXPORT lean_object* lb_t5a1383905e3435e418a9_get0(lean_object*);
LEAN_EXPORT uint32_t lb_t466ade0f8f5195fb9b51_tag(lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNative19ad06f04a0c2d39_f__lb__t466ade0f8f5195fb9b51__tag___boxed(lean_object*);
LEAN_EXPORT lean_object* lb_t466ade0f8f5195fb9b51_make0(lean_object*);
LEAN_EXPORT lean_object* lb_t466ade0f8f5195fb9b51_make1(lean_object*);
LEAN_EXPORT lean_object* lb_t466ade0f8f5195fb9b51_get1_0(lean_object*);
LEAN_EXPORT lean_object* lb_t466ade0f8f5195fb9b51_make2(lean_object*);
static const lean_array_object l_LeanBridgeNative19ad06f04a0c2d39_f__lb__t466ade0f8f5195fb9b51__get2__0___closed__0_value = {.m_header = {.m_rc = 0, .m_cs_sz = sizeof(lean_array_object) + sizeof(void*)*0, .m_other = 0, .m_tag = 246}, .m_size = 0, .m_capacity = 0, .m_data = {}};
static const lean_object* l_LeanBridgeNative19ad06f04a0c2d39_f__lb__t466ade0f8f5195fb9b51__get2__0___closed__0 = (const lean_object*)&l_LeanBridgeNative19ad06f04a0c2d39_f__lb__t466ade0f8f5195fb9b51__get2__0___closed__0_value;
LEAN_EXPORT lean_object* lb_t466ade0f8f5195fb9b51_get2_0(lean_object*);
LEAN_EXPORT lean_object* lb_tbb4f1df77db4bc2e5592_make(lean_object*, lean_object*);
LEAN_EXPORT lean_object* lb_tbb4f1df77db4bc2e5592_get0(lean_object*);
LEAN_EXPORT lean_object* lb_tbb4f1df77db4bc2e5592_get1(lean_object*);
LEAN_EXPORT lean_object* lb_native_nat_text(lean_object*);
LEAN_EXPORT lean_object* lb_native_int_text(lean_object*);
LEAN_EXPORT lean_object* l_panic___at___00LeanBridgeNative19ad06f04a0c2d39_f__lb__native__int__parse_spec__0(lean_object*);
static const lean_string_object l_LeanBridgeNative19ad06f04a0c2d39_f__lb__native__int__parse___closed__0_value = {.m_header = {.m_rc = 0, .m_cs_sz = 0, .m_other = 0, .m_tag = 249}, .m_size = 13, .m_capacity = 13, .m_length = 12, .m_data = "Int expected"};
static const lean_object* l_LeanBridgeNative19ad06f04a0c2d39_f__lb__native__int__parse___closed__0 = (const lean_object*)&l_LeanBridgeNative19ad06f04a0c2d39_f__lb__native__int__parse___closed__0_value;
LEAN_EXPORT lean_object* lb_native_int_parse(lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNative19ad06f04a0c2d39_LbErased_NominalPrimitiveSubtypes_Packet_erase(lean_object* v_value_1_){
_start:
{
lean_object* v_unitValue_2_; uint8_t v_boolValue_3_; uint8_t v_uint8Value_4_; uint16_t v_uint16Value_5_; uint32_t v_uint32Value_6_; uint64_t v_uint64Value_7_; uint8_t v_int8Value_8_; uint16_t v_int16Value_9_; uint32_t v_int32Value_10_; uint64_t v_int64Value_11_; lean_object* v_natValue_12_; lean_object* v_intValue_13_; float v_float32Value_14_; double v_float64Value_15_; lean_object* v_textValue_16_; lean_object* v_bytesValue_17_; uint32_t v_charValue_18_; size_t v_usizeValue_19_; size_t v_isizeValue_20_; lean_object* v_digit_21_; lean_object* v___x_23_; uint8_t v_isShared_24_; uint8_t v_isSharedCheck_28_; 
v_unitValue_2_ = lean_ctor_get(v_value_1_, 0);
v_boolValue_3_ = lean_ctor_get_uint8(v_value_1_, sizeof(void*)*8 + 44);
v_uint8Value_4_ = lean_ctor_get_uint8(v_value_1_, sizeof(void*)*8 + 45);
v_uint16Value_5_ = lean_ctor_get_uint16(v_value_1_, sizeof(void*)*8 + 40);
v_uint32Value_6_ = lean_ctor_get_uint32(v_value_1_, sizeof(void*)*8 + 24);
v_uint64Value_7_ = lean_ctor_get_uint64(v_value_1_, sizeof(void*)*8);
v_int8Value_8_ = lean_ctor_get_uint8(v_value_1_, sizeof(void*)*8 + 46);
v_int16Value_9_ = lean_ctor_get_uint16(v_value_1_, sizeof(void*)*8 + 42);
v_int32Value_10_ = lean_ctor_get_uint32(v_value_1_, sizeof(void*)*8 + 28);
v_int64Value_11_ = lean_ctor_get_uint64(v_value_1_, sizeof(void*)*8 + 8);
v_natValue_12_ = lean_ctor_get(v_value_1_, 1);
v_intValue_13_ = lean_ctor_get(v_value_1_, 2);
v_float32Value_14_ = lean_ctor_get_float32(v_value_1_, sizeof(void*)*8 + 32);
v_float64Value_15_ = lean_ctor_get_float(v_value_1_, sizeof(void*)*8 + 16);
v_textValue_16_ = lean_ctor_get(v_value_1_, 3);
v_bytesValue_17_ = lean_ctor_get(v_value_1_, 4);
v_charValue_18_ = lean_ctor_get_uint32(v_value_1_, sizeof(void*)*8 + 36);
v_usizeValue_19_ = lean_ctor_get_usize(v_value_1_, 6);
v_isizeValue_20_ = lean_ctor_get_usize(v_value_1_, 7);
v_digit_21_ = lean_ctor_get(v_value_1_, 5);
v_isSharedCheck_28_ = !lean_is_exclusive(v_value_1_);
if (v_isSharedCheck_28_ == 0)
{
v___x_23_ = v_value_1_;
v_isShared_24_ = v_isSharedCheck_28_;
goto v_resetjp_22_;
}
else
{
lean_inc(v_digit_21_);
lean_inc(v_bytesValue_17_);
lean_inc(v_textValue_16_);
lean_inc(v_intValue_13_);
lean_inc(v_natValue_12_);
lean_inc(v_unitValue_2_);
lean_dec(v_value_1_);
v___x_23_ = lean_box(0);
v_isShared_24_ = v_isSharedCheck_28_;
goto v_resetjp_22_;
}
v_resetjp_22_:
{
lean_object* v___x_26_; 
if (v_isShared_24_ == 0)
{
v___x_26_ = v___x_23_;
goto v_reusejp_25_;
}
else
{
lean_object* v_reuseFailAlloc_27_; 
v_reuseFailAlloc_27_ = lean_alloc_ctor(0, 6, sizeof(size_t)*2 + 47);
lean_ctor_set(v_reuseFailAlloc_27_, 0, v_unitValue_2_);
lean_ctor_set(v_reuseFailAlloc_27_, 1, v_natValue_12_);
lean_ctor_set(v_reuseFailAlloc_27_, 2, v_intValue_13_);
lean_ctor_set(v_reuseFailAlloc_27_, 3, v_textValue_16_);
lean_ctor_set(v_reuseFailAlloc_27_, 4, v_bytesValue_17_);
lean_ctor_set(v_reuseFailAlloc_27_, 5, v_digit_21_);
lean_ctor_set_uint8(v_reuseFailAlloc_27_, sizeof(void*)*8 + 44, v_boolValue_3_);
lean_ctor_set_uint8(v_reuseFailAlloc_27_, sizeof(void*)*8 + 45, v_uint8Value_4_);
lean_ctor_set_uint16(v_reuseFailAlloc_27_, sizeof(void*)*8 + 40, v_uint16Value_5_);
lean_ctor_set_uint32(v_reuseFailAlloc_27_, sizeof(void*)*8 + 24, v_uint32Value_6_);
lean_ctor_set_uint64(v_reuseFailAlloc_27_, sizeof(void*)*8, v_uint64Value_7_);
lean_ctor_set_uint8(v_reuseFailAlloc_27_, sizeof(void*)*8 + 46, v_int8Value_8_);
lean_ctor_set_uint16(v_reuseFailAlloc_27_, sizeof(void*)*8 + 42, v_int16Value_9_);
lean_ctor_set_uint32(v_reuseFailAlloc_27_, sizeof(void*)*8 + 28, v_int32Value_10_);
lean_ctor_set_uint64(v_reuseFailAlloc_27_, sizeof(void*)*8 + 8, v_int64Value_11_);
lean_ctor_set_float32(v_reuseFailAlloc_27_, sizeof(void*)*8 + 32, v_float32Value_14_);
lean_ctor_set_float(v_reuseFailAlloc_27_, sizeof(void*)*8 + 16, v_float64Value_15_);
lean_ctor_set_uint32(v_reuseFailAlloc_27_, sizeof(void*)*8 + 36, v_charValue_18_);
lean_ctor_set_usize(v_reuseFailAlloc_27_, 6, v_usizeValue_19_);
lean_ctor_set_usize(v_reuseFailAlloc_27_, 7, v_isizeValue_20_);
v___x_26_ = v_reuseFailAlloc_27_;
goto v_reusejp_25_;
}
v_reusejp_25_:
{
return v___x_26_;
}
}
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNative19ad06f04a0c2d39_LbErased_NominalPrimitiveSubtypes_Event_ctorIdx(lean_object* v_x_29_){
_start:
{
switch(lean_obj_tag(v_x_29_))
{
case 0:
{
lean_object* v___x_30_; 
v___x_30_ = lean_unsigned_to_nat(0u);
return v___x_30_;
}
case 1:
{
lean_object* v___x_31_; 
v___x_31_ = lean_unsigned_to_nat(1u);
return v___x_31_;
}
default: 
{
lean_object* v___x_32_; 
v___x_32_ = lean_unsigned_to_nat(2u);
return v___x_32_;
}
}
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNative19ad06f04a0c2d39_LbErased_NominalPrimitiveSubtypes_Event_ctorIdx___boxed(lean_object* v_x_33_){
_start:
{
lean_object* v_res_34_; 
v_res_34_ = l_LeanBridgeNative19ad06f04a0c2d39_LbErased_NominalPrimitiveSubtypes_Event_ctorIdx(v_x_33_);
lean_dec(v_x_33_);
return v_res_34_;
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNative19ad06f04a0c2d39_LbErased_NominalPrimitiveSubtypes_Event_ctorElim___redArg(lean_object* v_t_35_, lean_object* v_k_36_){
_start:
{
if (lean_obj_tag(v_t_35_) == 0)
{
return v_k_36_;
}
else
{
lean_object* v_a0_37_; lean_object* v___x_38_; 
v_a0_37_ = lean_ctor_get(v_t_35_, 0);
lean_inc_ref(v_a0_37_);
lean_dec(v_t_35_);
v___x_38_ = lean_apply_1(v_k_36_, v_a0_37_);
return v___x_38_;
}
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNative19ad06f04a0c2d39_LbErased_NominalPrimitiveSubtypes_Event_ctorElim(lean_object* v_motive_39_, lean_object* v_ctorIdx_40_, lean_object* v_t_41_, lean_object* v_h_42_, lean_object* v_k_43_){
_start:
{
lean_object* v___x_44_; 
v___x_44_ = l_LeanBridgeNative19ad06f04a0c2d39_LbErased_NominalPrimitiveSubtypes_Event_ctorElim___redArg(v_t_41_, v_k_43_);
return v___x_44_;
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNative19ad06f04a0c2d39_LbErased_NominalPrimitiveSubtypes_Event_ctorElim___boxed(lean_object* v_motive_45_, lean_object* v_ctorIdx_46_, lean_object* v_t_47_, lean_object* v_h_48_, lean_object* v_k_49_){
_start:
{
lean_object* v_res_50_; 
v_res_50_ = l_LeanBridgeNative19ad06f04a0c2d39_LbErased_NominalPrimitiveSubtypes_Event_ctorElim(v_motive_45_, v_ctorIdx_46_, v_t_47_, v_h_48_, v_k_49_);
lean_dec(v_ctorIdx_46_);
return v_res_50_;
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNative19ad06f04a0c2d39_LbErased_NominalPrimitiveSubtypes_Event_empty_elim___redArg(lean_object* v_t_51_, lean_object* v_empty_52_){
_start:
{
lean_object* v___x_53_; 
v___x_53_ = l_LeanBridgeNative19ad06f04a0c2d39_LbErased_NominalPrimitiveSubtypes_Event_ctorElim___redArg(v_t_51_, v_empty_52_);
return v___x_53_;
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNative19ad06f04a0c2d39_LbErased_NominalPrimitiveSubtypes_Event_empty_elim(lean_object* v_motive_54_, lean_object* v_t_55_, lean_object* v_h_56_, lean_object* v_empty_57_){
_start:
{
lean_object* v___x_58_; 
v___x_58_ = l_LeanBridgeNative19ad06f04a0c2d39_LbErased_NominalPrimitiveSubtypes_Event_ctorElim___redArg(v_t_55_, v_empty_57_);
return v___x_58_;
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNative19ad06f04a0c2d39_LbErased_NominalPrimitiveSubtypes_Event_box_elim___redArg(lean_object* v_t_59_, lean_object* v_box_60_){
_start:
{
lean_object* v___x_61_; 
v___x_61_ = l_LeanBridgeNative19ad06f04a0c2d39_LbErased_NominalPrimitiveSubtypes_Event_ctorElim___redArg(v_t_59_, v_box_60_);
return v___x_61_;
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNative19ad06f04a0c2d39_LbErased_NominalPrimitiveSubtypes_Event_box_elim(lean_object* v_motive_62_, lean_object* v_t_63_, lean_object* v_h_64_, lean_object* v_box_65_){
_start:
{
lean_object* v___x_66_; 
v___x_66_ = l_LeanBridgeNative19ad06f04a0c2d39_LbErased_NominalPrimitiveSubtypes_Event_ctorElim___redArg(v_t_63_, v_box_65_);
return v___x_66_;
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNative19ad06f04a0c2d39_LbErased_NominalPrimitiveSubtypes_Event_choices_elim___redArg(lean_object* v_t_67_, lean_object* v_choices_68_){
_start:
{
lean_object* v___x_69_; 
v___x_69_ = l_LeanBridgeNative19ad06f04a0c2d39_LbErased_NominalPrimitiveSubtypes_Event_ctorElim___redArg(v_t_67_, v_choices_68_);
return v___x_69_;
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNative19ad06f04a0c2d39_LbErased_NominalPrimitiveSubtypes_Event_choices_elim(lean_object* v_motive_70_, lean_object* v_t_71_, lean_object* v_h_72_, lean_object* v_choices_73_){
_start:
{
lean_object* v___x_74_; 
v___x_74_ = l_LeanBridgeNative19ad06f04a0c2d39_LbErased_NominalPrimitiveSubtypes_Event_ctorElim___redArg(v_t_71_, v_choices_73_);
return v___x_74_;
}
}
LEAN_EXPORT lean_object* l___private_Init_Data_Array_Basic_0__Array_mapMUnsafe_map___at___00LeanBridgeNative19ad06f04a0c2d39_LbErased_NominalPrimitiveSubtypes_Event_erase_spec__0(size_t v_sz_75_, size_t v_i_76_, lean_object* v_bs_77_){
_start:
{
uint8_t v___x_78_; 
v___x_78_ = lean_usize_dec_lt(v_i_76_, v_sz_75_);
if (v___x_78_ == 0)
{
return v_bs_77_;
}
else
{
lean_object* v_v_79_; lean_object* v___x_80_; lean_object* v_bs_x27_81_; lean_object* v___y_83_; 
v_v_79_ = lean_array_uget(v_bs_77_, v_i_76_);
v___x_80_ = lean_unsigned_to_nat(0u);
v_bs_x27_81_ = lean_array_uset(v_bs_77_, v_i_76_, v___x_80_);
if (lean_obj_tag(v_v_79_) == 0)
{
lean_object* v___x_88_; 
v___x_88_ = lean_box(0);
v___y_83_ = v___x_88_;
goto v___jp_82_;
}
else
{
lean_object* v_val_89_; lean_object* v___x_91_; uint8_t v_isShared_92_; uint8_t v_isSharedCheck_117_; 
v_val_89_ = lean_ctor_get(v_v_79_, 0);
v_isSharedCheck_117_ = !lean_is_exclusive(v_v_79_);
if (v_isSharedCheck_117_ == 0)
{
v___x_91_ = v_v_79_;
v_isShared_92_ = v_isSharedCheck_117_;
goto v_resetjp_90_;
}
else
{
lean_inc(v_val_89_);
lean_dec(v_v_79_);
v___x_91_ = lean_box(0);
v_isShared_92_ = v_isSharedCheck_117_;
goto v_resetjp_90_;
}
v_resetjp_90_:
{
if (lean_obj_tag(v_val_89_) == 0)
{
lean_object* v_a_93_; lean_object* v___x_95_; uint8_t v_isShared_96_; uint8_t v_isSharedCheck_104_; 
v_a_93_ = lean_ctor_get(v_val_89_, 0);
v_isSharedCheck_104_ = !lean_is_exclusive(v_val_89_);
if (v_isSharedCheck_104_ == 0)
{
v___x_95_ = v_val_89_;
v_isShared_96_ = v_isSharedCheck_104_;
goto v_resetjp_94_;
}
else
{
lean_inc(v_a_93_);
lean_dec(v_val_89_);
v___x_95_ = lean_box(0);
v_isShared_96_ = v_isSharedCheck_104_;
goto v_resetjp_94_;
}
v_resetjp_94_:
{
lean_object* v___x_97_; lean_object* v___x_99_; 
v___x_97_ = l_LeanBridgeNative19ad06f04a0c2d39_LbErased_NominalPrimitiveSubtypes_Packet_erase(v_a_93_);
if (v_isShared_96_ == 0)
{
lean_ctor_set(v___x_95_, 0, v___x_97_);
v___x_99_ = v___x_95_;
goto v_reusejp_98_;
}
else
{
lean_object* v_reuseFailAlloc_103_; 
v_reuseFailAlloc_103_ = lean_alloc_ctor(0, 1, 0);
lean_ctor_set(v_reuseFailAlloc_103_, 0, v___x_97_);
v___x_99_ = v_reuseFailAlloc_103_;
goto v_reusejp_98_;
}
v_reusejp_98_:
{
lean_object* v___x_101_; 
if (v_isShared_92_ == 0)
{
lean_ctor_set(v___x_91_, 0, v___x_99_);
v___x_101_ = v___x_91_;
goto v_reusejp_100_;
}
else
{
lean_object* v_reuseFailAlloc_102_; 
v_reuseFailAlloc_102_ = lean_alloc_ctor(1, 1, 0);
lean_ctor_set(v_reuseFailAlloc_102_, 0, v___x_99_);
v___x_101_ = v_reuseFailAlloc_102_;
goto v_reusejp_100_;
}
v_reusejp_100_:
{
v___y_83_ = v___x_101_;
goto v___jp_82_;
}
}
}
}
else
{
lean_object* v_a_105_; lean_object* v___x_107_; uint8_t v_isShared_108_; uint8_t v_isSharedCheck_116_; 
v_a_105_ = lean_ctor_get(v_val_89_, 0);
v_isSharedCheck_116_ = !lean_is_exclusive(v_val_89_);
if (v_isSharedCheck_116_ == 0)
{
v___x_107_ = v_val_89_;
v_isShared_108_ = v_isSharedCheck_116_;
goto v_resetjp_106_;
}
else
{
lean_inc(v_a_105_);
lean_dec(v_val_89_);
v___x_107_ = lean_box(0);
v_isShared_108_ = v_isSharedCheck_116_;
goto v_resetjp_106_;
}
v_resetjp_106_:
{
lean_object* v___x_109_; lean_object* v___x_111_; 
v___x_109_ = l_LeanBridgeNative19ad06f04a0c2d39_LbErased_NominalPrimitiveSubtypes_Packet_erase(v_a_105_);
if (v_isShared_108_ == 0)
{
lean_ctor_set(v___x_107_, 0, v___x_109_);
v___x_111_ = v___x_107_;
goto v_reusejp_110_;
}
else
{
lean_object* v_reuseFailAlloc_115_; 
v_reuseFailAlloc_115_ = lean_alloc_ctor(1, 1, 0);
lean_ctor_set(v_reuseFailAlloc_115_, 0, v___x_109_);
v___x_111_ = v_reuseFailAlloc_115_;
goto v_reusejp_110_;
}
v_reusejp_110_:
{
lean_object* v___x_113_; 
if (v_isShared_92_ == 0)
{
lean_ctor_set(v___x_91_, 0, v___x_111_);
v___x_113_ = v___x_91_;
goto v_reusejp_112_;
}
else
{
lean_object* v_reuseFailAlloc_114_; 
v_reuseFailAlloc_114_ = lean_alloc_ctor(1, 1, 0);
lean_ctor_set(v_reuseFailAlloc_114_, 0, v___x_111_);
v___x_113_ = v_reuseFailAlloc_114_;
goto v_reusejp_112_;
}
v_reusejp_112_:
{
v___y_83_ = v___x_113_;
goto v___jp_82_;
}
}
}
}
}
}
v___jp_82_:
{
size_t v___x_84_; size_t v___x_85_; lean_object* v___x_86_; 
v___x_84_ = ((size_t)1ULL);
v___x_85_ = lean_usize_add(v_i_76_, v___x_84_);
v___x_86_ = lean_array_uset(v_bs_x27_81_, v_i_76_, v___y_83_);
v_i_76_ = v___x_85_;
v_bs_77_ = v___x_86_;
goto _start;
}
}
}
}
LEAN_EXPORT lean_object* l___private_Init_Data_Array_Basic_0__Array_mapMUnsafe_map___at___00LeanBridgeNative19ad06f04a0c2d39_LbErased_NominalPrimitiveSubtypes_Event_erase_spec__0___boxed(lean_object* v_sz_118_, lean_object* v_i_119_, lean_object* v_bs_120_){
_start:
{
size_t v_sz_boxed_121_; size_t v_i_boxed_122_; lean_object* v_res_123_; 
v_sz_boxed_121_ = lean_unbox_usize(v_sz_118_);
lean_dec(v_sz_118_);
v_i_boxed_122_ = lean_unbox_usize(v_i_119_);
lean_dec(v_i_119_);
v_res_123_ = l___private_Init_Data_Array_Basic_0__Array_mapMUnsafe_map___at___00LeanBridgeNative19ad06f04a0c2d39_LbErased_NominalPrimitiveSubtypes_Event_erase_spec__0(v_sz_boxed_121_, v_i_boxed_122_, v_bs_120_);
return v_res_123_;
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNative19ad06f04a0c2d39_LbErased_NominalPrimitiveSubtypes_Event_erase(lean_object* v_value_124_){
_start:
{
switch(lean_obj_tag(v_value_124_))
{
case 0:
{
lean_object* v___x_125_; 
v___x_125_ = lean_box(0);
return v___x_125_;
}
case 1:
{
lean_object* v_value_126_; lean_object* v___x_128_; uint8_t v_isShared_129_; uint8_t v_isSharedCheck_134_; 
v_value_126_ = lean_ctor_get(v_value_124_, 0);
v_isSharedCheck_134_ = !lean_is_exclusive(v_value_124_);
if (v_isSharedCheck_134_ == 0)
{
v___x_128_ = v_value_124_;
v_isShared_129_ = v_isSharedCheck_134_;
goto v_resetjp_127_;
}
else
{
lean_inc(v_value_126_);
lean_dec(v_value_124_);
v___x_128_ = lean_box(0);
v_isShared_129_ = v_isSharedCheck_134_;
goto v_resetjp_127_;
}
v_resetjp_127_:
{
lean_object* v___x_130_; lean_object* v___x_132_; 
v___x_130_ = l_LeanBridgeNative19ad06f04a0c2d39_LbErased_NominalPrimitiveSubtypes_Packet_erase(v_value_126_);
if (v_isShared_129_ == 0)
{
lean_ctor_set(v___x_128_, 0, v___x_130_);
v___x_132_ = v___x_128_;
goto v_reusejp_131_;
}
else
{
lean_object* v_reuseFailAlloc_133_; 
v_reuseFailAlloc_133_ = lean_alloc_ctor(1, 1, 0);
lean_ctor_set(v_reuseFailAlloc_133_, 0, v___x_130_);
v___x_132_ = v_reuseFailAlloc_133_;
goto v_reusejp_131_;
}
v_reusejp_131_:
{
return v___x_132_;
}
}
}
default: 
{
lean_object* v_values_135_; lean_object* v___x_137_; uint8_t v_isShared_138_; uint8_t v_isSharedCheck_145_; 
v_values_135_ = lean_ctor_get(v_value_124_, 0);
v_isSharedCheck_145_ = !lean_is_exclusive(v_value_124_);
if (v_isSharedCheck_145_ == 0)
{
v___x_137_ = v_value_124_;
v_isShared_138_ = v_isSharedCheck_145_;
goto v_resetjp_136_;
}
else
{
lean_inc(v_values_135_);
lean_dec(v_value_124_);
v___x_137_ = lean_box(0);
v_isShared_138_ = v_isSharedCheck_145_;
goto v_resetjp_136_;
}
v_resetjp_136_:
{
size_t v_sz_139_; size_t v___x_140_; lean_object* v___x_141_; lean_object* v___x_143_; 
v_sz_139_ = lean_array_size(v_values_135_);
v___x_140_ = ((size_t)0ULL);
v___x_141_ = l___private_Init_Data_Array_Basic_0__Array_mapMUnsafe_map___at___00LeanBridgeNative19ad06f04a0c2d39_LbErased_NominalPrimitiveSubtypes_Event_erase_spec__0(v_sz_139_, v___x_140_, v_values_135_);
if (v_isShared_138_ == 0)
{
lean_ctor_set(v___x_137_, 0, v___x_141_);
v___x_143_ = v___x_137_;
goto v_reusejp_142_;
}
else
{
lean_object* v_reuseFailAlloc_144_; 
v_reuseFailAlloc_144_ = lean_alloc_ctor(2, 1, 0);
lean_ctor_set(v_reuseFailAlloc_144_, 0, v___x_141_);
v___x_143_ = v_reuseFailAlloc_144_;
goto v_reusejp_142_;
}
v_reusejp_142_:
{
return v___x_143_;
}
}
}
}
}
}
LEAN_EXPORT lean_object* l___private_Init_Data_Array_Basic_0__Array_mapMUnsafe_map___at___00__private_Init_Data_Array_Basic_0__Array_mapMUnsafe_map___at___00LeanBridgeNative19ad06f04a0c2d39_LbErased_NominalPrimitiveSubtypes_Pair_erase_spec__0_spec__0(size_t v_sz_146_, size_t v_i_147_, lean_object* v_bs_148_){
_start:
{
uint8_t v___x_149_; 
v___x_149_ = lean_usize_dec_lt(v_i_147_, v_sz_146_);
if (v___x_149_ == 0)
{
return v_bs_148_;
}
else
{
lean_object* v_v_150_; lean_object* v___x_151_; lean_object* v_bs_x27_152_; lean_object* v___y_154_; 
v_v_150_ = lean_array_uget(v_bs_148_, v_i_147_);
v___x_151_ = lean_unsigned_to_nat(0u);
v_bs_x27_152_ = lean_array_uset(v_bs_148_, v_i_147_, v___x_151_);
if (lean_obj_tag(v_v_150_) == 0)
{
lean_object* v___x_159_; 
v___x_159_ = lean_box(0);
v___y_154_ = v___x_159_;
goto v___jp_153_;
}
else
{
lean_object* v_val_160_; lean_object* v___x_162_; uint8_t v_isShared_163_; uint8_t v_isSharedCheck_168_; 
v_val_160_ = lean_ctor_get(v_v_150_, 0);
v_isSharedCheck_168_ = !lean_is_exclusive(v_v_150_);
if (v_isSharedCheck_168_ == 0)
{
v___x_162_ = v_v_150_;
v_isShared_163_ = v_isSharedCheck_168_;
goto v_resetjp_161_;
}
else
{
lean_inc(v_val_160_);
lean_dec(v_v_150_);
v___x_162_ = lean_box(0);
v_isShared_163_ = v_isSharedCheck_168_;
goto v_resetjp_161_;
}
v_resetjp_161_:
{
lean_object* v___x_164_; lean_object* v___x_166_; 
v___x_164_ = l_LeanBridgeNative19ad06f04a0c2d39_LbErased_NominalPrimitiveSubtypes_Packet_erase(v_val_160_);
if (v_isShared_163_ == 0)
{
lean_ctor_set(v___x_162_, 0, v___x_164_);
v___x_166_ = v___x_162_;
goto v_reusejp_165_;
}
else
{
lean_object* v_reuseFailAlloc_167_; 
v_reuseFailAlloc_167_ = lean_alloc_ctor(1, 1, 0);
lean_ctor_set(v_reuseFailAlloc_167_, 0, v___x_164_);
v___x_166_ = v_reuseFailAlloc_167_;
goto v_reusejp_165_;
}
v_reusejp_165_:
{
v___y_154_ = v___x_166_;
goto v___jp_153_;
}
}
}
v___jp_153_:
{
size_t v___x_155_; size_t v___x_156_; lean_object* v___x_157_; 
v___x_155_ = ((size_t)1ULL);
v___x_156_ = lean_usize_add(v_i_147_, v___x_155_);
v___x_157_ = lean_array_uset(v_bs_x27_152_, v_i_147_, v___y_154_);
v_i_147_ = v___x_156_;
v_bs_148_ = v___x_157_;
goto _start;
}
}
}
}
LEAN_EXPORT lean_object* l___private_Init_Data_Array_Basic_0__Array_mapMUnsafe_map___at___00__private_Init_Data_Array_Basic_0__Array_mapMUnsafe_map___at___00LeanBridgeNative19ad06f04a0c2d39_LbErased_NominalPrimitiveSubtypes_Pair_erase_spec__0_spec__0___boxed(lean_object* v_sz_169_, lean_object* v_i_170_, lean_object* v_bs_171_){
_start:
{
size_t v_sz_boxed_172_; size_t v_i_boxed_173_; lean_object* v_res_174_; 
v_sz_boxed_172_ = lean_unbox_usize(v_sz_169_);
lean_dec(v_sz_169_);
v_i_boxed_173_ = lean_unbox_usize(v_i_170_);
lean_dec(v_i_170_);
v_res_174_ = l___private_Init_Data_Array_Basic_0__Array_mapMUnsafe_map___at___00__private_Init_Data_Array_Basic_0__Array_mapMUnsafe_map___at___00LeanBridgeNative19ad06f04a0c2d39_LbErased_NominalPrimitiveSubtypes_Pair_erase_spec__0_spec__0(v_sz_boxed_172_, v_i_boxed_173_, v_bs_171_);
return v_res_174_;
}
}
LEAN_EXPORT lean_object* l___private_Init_Data_Array_Basic_0__Array_mapMUnsafe_map___at___00LeanBridgeNative19ad06f04a0c2d39_LbErased_NominalPrimitiveSubtypes_Pair_erase_spec__0(size_t v_sz_175_, size_t v_i_176_, lean_object* v_bs_177_){
_start:
{
uint8_t v___x_178_; 
v___x_178_ = lean_usize_dec_lt(v_i_176_, v_sz_175_);
if (v___x_178_ == 0)
{
return v_bs_177_;
}
else
{
lean_object* v_v_179_; lean_object* v___x_180_; lean_object* v_bs_x27_181_; lean_object* v___y_183_; 
v_v_179_ = lean_array_uget(v_bs_177_, v_i_176_);
v___x_180_ = lean_unsigned_to_nat(0u);
v_bs_x27_181_ = lean_array_uset(v_bs_177_, v_i_176_, v___x_180_);
if (lean_obj_tag(v_v_179_) == 0)
{
lean_object* v___x_188_; 
v___x_188_ = lean_box(0);
v___y_183_ = v___x_188_;
goto v___jp_182_;
}
else
{
lean_object* v_val_189_; lean_object* v___x_191_; uint8_t v_isShared_192_; uint8_t v_isSharedCheck_197_; 
v_val_189_ = lean_ctor_get(v_v_179_, 0);
v_isSharedCheck_197_ = !lean_is_exclusive(v_v_179_);
if (v_isSharedCheck_197_ == 0)
{
v___x_191_ = v_v_179_;
v_isShared_192_ = v_isSharedCheck_197_;
goto v_resetjp_190_;
}
else
{
lean_inc(v_val_189_);
lean_dec(v_v_179_);
v___x_191_ = lean_box(0);
v_isShared_192_ = v_isSharedCheck_197_;
goto v_resetjp_190_;
}
v_resetjp_190_:
{
lean_object* v___x_193_; lean_object* v___x_195_; 
v___x_193_ = l_LeanBridgeNative19ad06f04a0c2d39_LbErased_NominalPrimitiveSubtypes_Packet_erase(v_val_189_);
if (v_isShared_192_ == 0)
{
lean_ctor_set(v___x_191_, 0, v___x_193_);
v___x_195_ = v___x_191_;
goto v_reusejp_194_;
}
else
{
lean_object* v_reuseFailAlloc_196_; 
v_reuseFailAlloc_196_ = lean_alloc_ctor(1, 1, 0);
lean_ctor_set(v_reuseFailAlloc_196_, 0, v___x_193_);
v___x_195_ = v_reuseFailAlloc_196_;
goto v_reusejp_194_;
}
v_reusejp_194_:
{
v___y_183_ = v___x_195_;
goto v___jp_182_;
}
}
}
v___jp_182_:
{
size_t v___x_184_; size_t v___x_185_; lean_object* v___x_186_; lean_object* v___x_187_; 
v___x_184_ = ((size_t)1ULL);
v___x_185_ = lean_usize_add(v_i_176_, v___x_184_);
v___x_186_ = lean_array_uset(v_bs_x27_181_, v_i_176_, v___y_183_);
v___x_187_ = l___private_Init_Data_Array_Basic_0__Array_mapMUnsafe_map___at___00__private_Init_Data_Array_Basic_0__Array_mapMUnsafe_map___at___00LeanBridgeNative19ad06f04a0c2d39_LbErased_NominalPrimitiveSubtypes_Pair_erase_spec__0_spec__0(v_sz_175_, v___x_185_, v___x_186_);
return v___x_187_;
}
}
}
}
LEAN_EXPORT lean_object* l___private_Init_Data_Array_Basic_0__Array_mapMUnsafe_map___at___00LeanBridgeNative19ad06f04a0c2d39_LbErased_NominalPrimitiveSubtypes_Pair_erase_spec__0___boxed(lean_object* v_sz_198_, lean_object* v_i_199_, lean_object* v_bs_200_){
_start:
{
size_t v_sz_boxed_201_; size_t v_i_boxed_202_; lean_object* v_res_203_; 
v_sz_boxed_201_ = lean_unbox_usize(v_sz_198_);
lean_dec(v_sz_198_);
v_i_boxed_202_ = lean_unbox_usize(v_i_199_);
lean_dec(v_i_199_);
v_res_203_ = l___private_Init_Data_Array_Basic_0__Array_mapMUnsafe_map___at___00LeanBridgeNative19ad06f04a0c2d39_LbErased_NominalPrimitiveSubtypes_Pair_erase_spec__0(v_sz_boxed_201_, v_i_boxed_202_, v_bs_200_);
return v_res_203_;
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNative19ad06f04a0c2d39_LbErased_NominalPrimitiveSubtypes_Pair_erase(lean_object* v_value_204_){
_start:
{
lean_object* v_left_205_; lean_object* v_right_206_; lean_object* v___x_208_; uint8_t v_isShared_209_; uint8_t v_isSharedCheck_218_; 
v_left_205_ = lean_ctor_get(v_value_204_, 0);
v_right_206_ = lean_ctor_get(v_value_204_, 1);
v_isSharedCheck_218_ = !lean_is_exclusive(v_value_204_);
if (v_isSharedCheck_218_ == 0)
{
v___x_208_ = v_value_204_;
v_isShared_209_ = v_isSharedCheck_218_;
goto v_resetjp_207_;
}
else
{
lean_inc(v_right_206_);
lean_inc(v_left_205_);
lean_dec(v_value_204_);
v___x_208_ = lean_box(0);
v_isShared_209_ = v_isSharedCheck_218_;
goto v_resetjp_207_;
}
v_resetjp_207_:
{
size_t v_sz_210_; size_t v___x_211_; lean_object* v___x_212_; size_t v_sz_213_; lean_object* v___x_214_; lean_object* v___x_216_; 
v_sz_210_ = lean_array_size(v_left_205_);
v___x_211_ = ((size_t)0ULL);
v___x_212_ = l___private_Init_Data_Array_Basic_0__Array_mapMUnsafe_map___at___00LeanBridgeNative19ad06f04a0c2d39_LbErased_NominalPrimitiveSubtypes_Pair_erase_spec__0(v_sz_210_, v___x_211_, v_left_205_);
v_sz_213_ = lean_array_size(v_right_206_);
v___x_214_ = l___private_Init_Data_Array_Basic_0__Array_mapMUnsafe_map___at___00LeanBridgeNative19ad06f04a0c2d39_LbErased_NominalPrimitiveSubtypes_Pair_erase_spec__0(v_sz_213_, v___x_211_, v_right_206_);
if (v_isShared_209_ == 0)
{
lean_ctor_set(v___x_208_, 1, v___x_214_);
lean_ctor_set(v___x_208_, 0, v___x_212_);
v___x_216_ = v___x_208_;
goto v_reusejp_215_;
}
else
{
lean_object* v_reuseFailAlloc_217_; 
v_reuseFailAlloc_217_ = lean_alloc_ctor(0, 2, 0);
lean_ctor_set(v_reuseFailAlloc_217_, 0, v___x_212_);
lean_ctor_set(v_reuseFailAlloc_217_, 1, v___x_214_);
v___x_216_ = v_reuseFailAlloc_217_;
goto v_reusejp_215_;
}
v_reusejp_215_:
{
return v___x_216_;
}
}
}
}
LEAN_EXPORT lean_object* lb_4d420414dfdb252510c59482(lean_object* v_a0_219_){
  fputs("LB_SUBTYPE_ENTRY_V1 enter adapter NominalPrimitiveSubtypes.produce\n", stderr);

_start:
{
lean_object* v___x_220_; 
v___x_220_ = lb_nominal_result_only_probe_source_produce(v_a0_219_);
if (lean_obj_tag(v___x_220_) == 0)
{
lean_object* v___x_221_; 
v___x_221_ = lean_box(0);
return v___x_221_;
}
else
{
lean_object* v_val_222_; lean_object* v___x_224_; uint8_t v_isShared_225_; uint8_t v_isSharedCheck_230_; 
v_val_222_ = lean_ctor_get(v___x_220_, 0);
v_isSharedCheck_230_ = !lean_is_exclusive(v___x_220_);
if (v_isSharedCheck_230_ == 0)
{
v___x_224_ = v___x_220_;
v_isShared_225_ = v_isSharedCheck_230_;
goto v_resetjp_223_;
}
else
{
lean_inc(v_val_222_);
lean_dec(v___x_220_);
v___x_224_ = lean_box(0);
v_isShared_225_ = v_isSharedCheck_230_;
goto v_resetjp_223_;
}
v_resetjp_223_:
{
lean_object* v___x_226_; lean_object* v___x_228_; 
v___x_226_ = l_LeanBridgeNative19ad06f04a0c2d39_LbErased_NominalPrimitiveSubtypes_Packet_erase(v_val_222_);
if (v_isShared_225_ == 0)
{
lean_ctor_set(v___x_224_, 0, v___x_226_);
v___x_228_ = v___x_224_;
goto v_reusejp_227_;
}
else
{
lean_object* v_reuseFailAlloc_229_; 
v_reuseFailAlloc_229_ = lean_alloc_ctor(1, 1, 0);
lean_ctor_set(v_reuseFailAlloc_229_, 0, v___x_226_);
v___x_228_ = v_reuseFailAlloc_229_;
goto v_reusejp_227_;
}
v_reusejp_227_:
{
return v___x_228_;
}
}
}
}
}
LEAN_EXPORT lean_object* lb_e791062d392a94a18563a45f(lean_object* v_a0_231_){
  fputs("LB_SUBTYPE_ENTRY_V1 enter adapter NominalPrimitiveSubtypes.produceChoices\n", stderr);

_start:
{
lean_object* v___x_232_; lean_object* v___x_233_; 
v___x_232_ = lb_nominal_result_only_probe_source_produceChoices(v_a0_231_);
v___x_233_ = l_LeanBridgeNative19ad06f04a0c2d39_LbErased_NominalPrimitiveSubtypes_Event_erase(v___x_232_);
return v___x_233_;
}
}
LEAN_EXPORT lean_object* lb_e721c226f4fcff66a4ffea0f(lean_object* v_a0_234_){
  fputs("LB_SUBTYPE_ENTRY_V1 enter adapter NominalPrimitiveSubtypes.produceEvent\n", stderr);

_start:
{
lean_object* v___x_235_; lean_object* v___x_236_; 
v___x_235_ = lb_nominal_result_only_probe_source_produceEvent(v_a0_234_);
v___x_236_ = l_LeanBridgeNative19ad06f04a0c2d39_LbErased_NominalPrimitiveSubtypes_Event_erase(v___x_235_);
return v___x_236_;
}
}
LEAN_EXPORT lean_object* lb_2c1c751c1667dd64cd4c3fe3(lean_object* v_a0_237_){
  fputs("LB_SUBTYPE_ENTRY_V1 enter adapter NominalPrimitiveSubtypes.produceGroup\n", stderr);

_start:
{
lean_object* v___x_238_; size_t v_sz_239_; size_t v___x_240_; lean_object* v___x_241_; 
v___x_238_ = lb_nominal_result_only_probe_source_produceGroup(v_a0_237_);
v_sz_239_ = lean_array_size(v___x_238_);
v___x_240_ = ((size_t)0ULL);
v___x_241_ = l___private_Init_Data_Array_Basic_0__Array_mapMUnsafe_map___at___00__private_Init_Data_Array_Basic_0__Array_mapMUnsafe_map___at___00LeanBridgeNative19ad06f04a0c2d39_LbErased_NominalPrimitiveSubtypes_Pair_erase_spec__0_spec__0(v_sz_239_, v___x_240_, v___x_238_);
return v___x_241_;
}
}
LEAN_EXPORT lean_object* lb_a54b47645ca8b931f9ef293a(lean_object* v_a0_242_){
  fputs("LB_SUBTYPE_ENTRY_V1 enter adapter NominalPrimitiveSubtypes.producePair\n", stderr);

_start:
{
lean_object* v___x_243_; lean_object* v___x_244_; 
v___x_243_ = lb_nominal_result_only_probe_source_producePair(v_a0_242_);
v___x_244_ = l_LeanBridgeNative19ad06f04a0c2d39_LbErased_NominalPrimitiveSubtypes_Pair_erase(v___x_243_);
return v___x_244_;
}
}
LEAN_EXPORT uint32_t lb_2df79ff835926bf7b8864ec6(lean_object* v___unit_245_){
  fputs("LB_SUBTYPE_ENTRY_V1 enter adapter NominalPrimitiveSubtypes.wordBits\n", stderr);

_start:
{
uint32_t v___x_246_; 
v___x_246_ = lb_nominal_result_only_probe_source_wordBits;
return v___x_246_;
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNative19ad06f04a0c2d39_f__lb__2df79ff835926bf7b8864ec6___boxed(lean_object* v___unit_247_){
_start:
{
uint32_t v_res_248_; lean_object* v_r_249_; 
v_res_248_ = lb_2df79ff835926bf7b8864ec6(v___unit_247_);
v_r_249_ = lean_box_uint32(v_res_248_);
return v_r_249_;
}
}
LEAN_EXPORT lean_object* lb_t6ed79f4a8a3bc4358259_make(lean_object* v_a0_250_, uint8_t v_a1_251_, uint8_t v_a2_252_, uint16_t v_a3_253_, uint32_t v_a4_254_, uint64_t v_a5_255_, uint8_t v_a6_256_, uint16_t v_a7_257_, uint32_t v_a8_258_, uint64_t v_a9_259_, lean_object* v_a10_260_, lean_object* v_a11_261_, float v_a12_262_, double v_a13_263_, lean_object* v_a14_264_, lean_object* v_a15_265_, uint32_t v_a16_266_, size_t v_a17_267_, size_t v_a18_268_, lean_object* v_a19_269_){
_start:
{
lean_object* v___x_270_; 
v___x_270_ = lean_alloc_ctor(0, 6, sizeof(size_t)*2 + 47);
lean_ctor_set(v___x_270_, 0, v_a0_250_);
lean_ctor_set(v___x_270_, 1, v_a10_260_);
lean_ctor_set(v___x_270_, 2, v_a11_261_);
lean_ctor_set(v___x_270_, 3, v_a14_264_);
lean_ctor_set(v___x_270_, 4, v_a15_265_);
lean_ctor_set(v___x_270_, 5, v_a19_269_);
lean_ctor_set_uint8(v___x_270_, sizeof(void*)*8 + 44, v_a1_251_);
lean_ctor_set_uint8(v___x_270_, sizeof(void*)*8 + 45, v_a2_252_);
lean_ctor_set_uint16(v___x_270_, sizeof(void*)*8 + 40, v_a3_253_);
lean_ctor_set_uint32(v___x_270_, sizeof(void*)*8 + 24, v_a4_254_);
lean_ctor_set_uint64(v___x_270_, sizeof(void*)*8, v_a5_255_);
lean_ctor_set_uint8(v___x_270_, sizeof(void*)*8 + 46, v_a6_256_);
lean_ctor_set_uint16(v___x_270_, sizeof(void*)*8 + 42, v_a7_257_);
lean_ctor_set_uint32(v___x_270_, sizeof(void*)*8 + 28, v_a8_258_);
lean_ctor_set_uint64(v___x_270_, sizeof(void*)*8 + 8, v_a9_259_);
lean_ctor_set_float32(v___x_270_, sizeof(void*)*8 + 32, v_a12_262_);
lean_ctor_set_float(v___x_270_, sizeof(void*)*8 + 16, v_a13_263_);
lean_ctor_set_uint32(v___x_270_, sizeof(void*)*8 + 36, v_a16_266_);
lean_ctor_set_usize(v___x_270_, 6, v_a17_267_);
lean_ctor_set_usize(v___x_270_, 7, v_a18_268_);
return v___x_270_;
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNative19ad06f04a0c2d39_f__lb__t6ed79f4a8a3bc4358259__make___boxed(lean_object** _args){
lean_object* v_a0_271_ = _args[0];
lean_object* v_a1_272_ = _args[1];
lean_object* v_a2_273_ = _args[2];
lean_object* v_a3_274_ = _args[3];
lean_object* v_a4_275_ = _args[4];
lean_object* v_a5_276_ = _args[5];
lean_object* v_a6_277_ = _args[6];
lean_object* v_a7_278_ = _args[7];
lean_object* v_a8_279_ = _args[8];
lean_object* v_a9_280_ = _args[9];
lean_object* v_a10_281_ = _args[10];
lean_object* v_a11_282_ = _args[11];
lean_object* v_a12_283_ = _args[12];
lean_object* v_a13_284_ = _args[13];
lean_object* v_a14_285_ = _args[14];
lean_object* v_a15_286_ = _args[15];
lean_object* v_a16_287_ = _args[16];
lean_object* v_a17_288_ = _args[17];
lean_object* v_a18_289_ = _args[18];
lean_object* v_a19_290_ = _args[19];
_start:
{
uint8_t v_a1_boxed_291_; uint8_t v_a2_boxed_292_; uint16_t v_a3_boxed_293_; uint32_t v_a4_boxed_294_; uint64_t v_a5_boxed_295_; uint8_t v_a6_boxed_296_; uint16_t v_a7_boxed_297_; uint32_t v_a8_boxed_298_; uint64_t v_a9_boxed_299_; float v_a12_boxed_300_; double v_a13_boxed_301_; uint32_t v_a16_boxed_302_; size_t v_a17_boxed_303_; size_t v_a18_boxed_304_; lean_object* v_res_305_; 
v_a1_boxed_291_ = lean_unbox(v_a1_272_);
v_a2_boxed_292_ = lean_unbox(v_a2_273_);
v_a3_boxed_293_ = lean_unbox(v_a3_274_);
v_a4_boxed_294_ = lean_unbox_uint32(v_a4_275_);
lean_dec(v_a4_275_);
v_a5_boxed_295_ = lean_unbox_uint64(v_a5_276_);
lean_dec_ref(v_a5_276_);
v_a6_boxed_296_ = lean_unbox(v_a6_277_);
v_a7_boxed_297_ = lean_unbox(v_a7_278_);
v_a8_boxed_298_ = lean_unbox_uint32(v_a8_279_);
lean_dec(v_a8_279_);
v_a9_boxed_299_ = lean_unbox_uint64(v_a9_280_);
lean_dec_ref(v_a9_280_);
v_a12_boxed_300_ = lean_unbox_float32(v_a12_283_);
lean_dec_ref(v_a12_283_);
v_a13_boxed_301_ = lean_unbox_float(v_a13_284_);
lean_dec_ref(v_a13_284_);
v_a16_boxed_302_ = lean_unbox_uint32(v_a16_287_);
lean_dec(v_a16_287_);
v_a17_boxed_303_ = lean_unbox_usize(v_a17_288_);
lean_dec(v_a17_288_);
v_a18_boxed_304_ = lean_unbox_usize(v_a18_289_);
lean_dec(v_a18_289_);
v_res_305_ = lb_t6ed79f4a8a3bc4358259_make(v_a0_271_, v_a1_boxed_291_, v_a2_boxed_292_, v_a3_boxed_293_, v_a4_boxed_294_, v_a5_boxed_295_, v_a6_boxed_296_, v_a7_boxed_297_, v_a8_boxed_298_, v_a9_boxed_299_, v_a10_281_, v_a11_282_, v_a12_boxed_300_, v_a13_boxed_301_, v_a14_285_, v_a15_286_, v_a16_boxed_302_, v_a17_boxed_303_, v_a18_boxed_304_, v_a19_290_);
return v_res_305_;
}
}
LEAN_EXPORT lean_object* lb_t6ed79f4a8a3bc4358259_get0(lean_object* v_value_306_){
_start:
{
lean_object* v_unitValue_307_; 
v_unitValue_307_ = lean_ctor_get(v_value_306_, 0);
lean_inc(v_unitValue_307_);
lean_dec_ref(v_value_306_);
return v_unitValue_307_;
}
}
LEAN_EXPORT uint8_t lb_t6ed79f4a8a3bc4358259_get1(lean_object* v_value_308_){
_start:
{
uint8_t v_boolValue_309_; 
v_boolValue_309_ = lean_ctor_get_uint8(v_value_308_, sizeof(void*)*8 + 44);
lean_dec_ref(v_value_308_);
return v_boolValue_309_;
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNative19ad06f04a0c2d39_f__lb__t6ed79f4a8a3bc4358259__get1___boxed(lean_object* v_value_310_){
_start:
{
uint8_t v_res_311_; lean_object* v_r_312_; 
v_res_311_ = lb_t6ed79f4a8a3bc4358259_get1(v_value_310_);
v_r_312_ = lean_box(v_res_311_);
return v_r_312_;
}
}
LEAN_EXPORT uint8_t lb_t6ed79f4a8a3bc4358259_get2(lean_object* v_value_313_){
_start:
{
uint8_t v_uint8Value_314_; 
v_uint8Value_314_ = lean_ctor_get_uint8(v_value_313_, sizeof(void*)*8 + 45);
lean_dec_ref(v_value_313_);
return v_uint8Value_314_;
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNative19ad06f04a0c2d39_f__lb__t6ed79f4a8a3bc4358259__get2___boxed(lean_object* v_value_315_){
_start:
{
uint8_t v_res_316_; lean_object* v_r_317_; 
v_res_316_ = lb_t6ed79f4a8a3bc4358259_get2(v_value_315_);
v_r_317_ = lean_box(v_res_316_);
return v_r_317_;
}
}
LEAN_EXPORT uint16_t lb_t6ed79f4a8a3bc4358259_get3(lean_object* v_value_318_){
_start:
{
uint16_t v_uint16Value_319_; 
v_uint16Value_319_ = lean_ctor_get_uint16(v_value_318_, sizeof(void*)*8 + 40);
lean_dec_ref(v_value_318_);
return v_uint16Value_319_;
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNative19ad06f04a0c2d39_f__lb__t6ed79f4a8a3bc4358259__get3___boxed(lean_object* v_value_320_){
_start:
{
uint16_t v_res_321_; lean_object* v_r_322_; 
v_res_321_ = lb_t6ed79f4a8a3bc4358259_get3(v_value_320_);
v_r_322_ = lean_box(v_res_321_);
return v_r_322_;
}
}
LEAN_EXPORT uint32_t lb_t6ed79f4a8a3bc4358259_get4(lean_object* v_value_323_){
_start:
{
uint32_t v_uint32Value_324_; 
v_uint32Value_324_ = lean_ctor_get_uint32(v_value_323_, sizeof(void*)*8 + 24);
lean_dec_ref(v_value_323_);
return v_uint32Value_324_;
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNative19ad06f04a0c2d39_f__lb__t6ed79f4a8a3bc4358259__get4___boxed(lean_object* v_value_325_){
_start:
{
uint32_t v_res_326_; lean_object* v_r_327_; 
v_res_326_ = lb_t6ed79f4a8a3bc4358259_get4(v_value_325_);
v_r_327_ = lean_box_uint32(v_res_326_);
return v_r_327_;
}
}
LEAN_EXPORT uint64_t lb_t6ed79f4a8a3bc4358259_get5(lean_object* v_value_328_){
_start:
{
uint64_t v_uint64Value_329_; 
v_uint64Value_329_ = lean_ctor_get_uint64(v_value_328_, sizeof(void*)*8);
lean_dec_ref(v_value_328_);
return v_uint64Value_329_;
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNative19ad06f04a0c2d39_f__lb__t6ed79f4a8a3bc4358259__get5___boxed(lean_object* v_value_330_){
_start:
{
uint64_t v_res_331_; lean_object* v_r_332_; 
v_res_331_ = lb_t6ed79f4a8a3bc4358259_get5(v_value_330_);
v_r_332_ = lean_box_uint64(v_res_331_);
return v_r_332_;
}
}
LEAN_EXPORT uint8_t lb_t6ed79f4a8a3bc4358259_get6(lean_object* v_value_333_){
_start:
{
uint8_t v_int8Value_334_; 
v_int8Value_334_ = lean_ctor_get_uint8(v_value_333_, sizeof(void*)*8 + 46);
lean_dec_ref(v_value_333_);
return v_int8Value_334_;
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNative19ad06f04a0c2d39_f__lb__t6ed79f4a8a3bc4358259__get6___boxed(lean_object* v_value_335_){
_start:
{
uint8_t v_res_336_; lean_object* v_r_337_; 
v_res_336_ = lb_t6ed79f4a8a3bc4358259_get6(v_value_335_);
v_r_337_ = lean_box(v_res_336_);
return v_r_337_;
}
}
LEAN_EXPORT uint16_t lb_t6ed79f4a8a3bc4358259_get7(lean_object* v_value_338_){
_start:
{
uint16_t v_int16Value_339_; 
v_int16Value_339_ = lean_ctor_get_uint16(v_value_338_, sizeof(void*)*8 + 42);
lean_dec_ref(v_value_338_);
return v_int16Value_339_;
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNative19ad06f04a0c2d39_f__lb__t6ed79f4a8a3bc4358259__get7___boxed(lean_object* v_value_340_){
_start:
{
uint16_t v_res_341_; lean_object* v_r_342_; 
v_res_341_ = lb_t6ed79f4a8a3bc4358259_get7(v_value_340_);
v_r_342_ = lean_box(v_res_341_);
return v_r_342_;
}
}
LEAN_EXPORT uint32_t lb_t6ed79f4a8a3bc4358259_get8(lean_object* v_value_343_){
_start:
{
uint32_t v_int32Value_344_; 
v_int32Value_344_ = lean_ctor_get_uint32(v_value_343_, sizeof(void*)*8 + 28);
lean_dec_ref(v_value_343_);
return v_int32Value_344_;
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNative19ad06f04a0c2d39_f__lb__t6ed79f4a8a3bc4358259__get8___boxed(lean_object* v_value_345_){
_start:
{
uint32_t v_res_346_; lean_object* v_r_347_; 
v_res_346_ = lb_t6ed79f4a8a3bc4358259_get8(v_value_345_);
v_r_347_ = lean_box_uint32(v_res_346_);
return v_r_347_;
}
}
LEAN_EXPORT uint64_t lb_t6ed79f4a8a3bc4358259_get9(lean_object* v_value_348_){
_start:
{
uint64_t v_int64Value_349_; 
v_int64Value_349_ = lean_ctor_get_uint64(v_value_348_, sizeof(void*)*8 + 8);
lean_dec_ref(v_value_348_);
return v_int64Value_349_;
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNative19ad06f04a0c2d39_f__lb__t6ed79f4a8a3bc4358259__get9___boxed(lean_object* v_value_350_){
_start:
{
uint64_t v_res_351_; lean_object* v_r_352_; 
v_res_351_ = lb_t6ed79f4a8a3bc4358259_get9(v_value_350_);
v_r_352_ = lean_box_uint64(v_res_351_);
return v_r_352_;
}
}
LEAN_EXPORT lean_object* lb_t6ed79f4a8a3bc4358259_get10(lean_object* v_value_353_){
_start:
{
lean_object* v_natValue_354_; 
v_natValue_354_ = lean_ctor_get(v_value_353_, 1);
lean_inc(v_natValue_354_);
lean_dec_ref(v_value_353_);
return v_natValue_354_;
}
}
LEAN_EXPORT lean_object* lb_t6ed79f4a8a3bc4358259_get11(lean_object* v_value_355_){
_start:
{
lean_object* v_intValue_356_; 
v_intValue_356_ = lean_ctor_get(v_value_355_, 2);
lean_inc(v_intValue_356_);
lean_dec_ref(v_value_355_);
return v_intValue_356_;
}
}
LEAN_EXPORT float lb_t6ed79f4a8a3bc4358259_get12(lean_object* v_value_357_){
_start:
{
float v_float32Value_358_; 
v_float32Value_358_ = lean_ctor_get_float32(v_value_357_, sizeof(void*)*8 + 32);
lean_dec_ref(v_value_357_);
return v_float32Value_358_;
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNative19ad06f04a0c2d39_f__lb__t6ed79f4a8a3bc4358259__get12___boxed(lean_object* v_value_359_){
_start:
{
float v_res_360_; lean_object* v_r_361_; 
v_res_360_ = lb_t6ed79f4a8a3bc4358259_get12(v_value_359_);
v_r_361_ = lean_box_float32(v_res_360_);
return v_r_361_;
}
}
LEAN_EXPORT double lb_t6ed79f4a8a3bc4358259_get13(lean_object* v_value_362_){
_start:
{
double v_float64Value_363_; 
v_float64Value_363_ = lean_ctor_get_float(v_value_362_, sizeof(void*)*8 + 16);
lean_dec_ref(v_value_362_);
return v_float64Value_363_;
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNative19ad06f04a0c2d39_f__lb__t6ed79f4a8a3bc4358259__get13___boxed(lean_object* v_value_364_){
_start:
{
double v_res_365_; lean_object* v_r_366_; 
v_res_365_ = lb_t6ed79f4a8a3bc4358259_get13(v_value_364_);
v_r_366_ = lean_box_float(v_res_365_);
return v_r_366_;
}
}
LEAN_EXPORT lean_object* lb_t6ed79f4a8a3bc4358259_get14(lean_object* v_value_367_){
_start:
{
lean_object* v_textValue_368_; 
v_textValue_368_ = lean_ctor_get(v_value_367_, 3);
lean_inc_ref(v_textValue_368_);
lean_dec_ref(v_value_367_);
return v_textValue_368_;
}
}
LEAN_EXPORT lean_object* lb_t6ed79f4a8a3bc4358259_get15(lean_object* v_value_369_){
_start:
{
lean_object* v_bytesValue_370_; 
v_bytesValue_370_ = lean_ctor_get(v_value_369_, 4);
lean_inc_ref(v_bytesValue_370_);
lean_dec_ref(v_value_369_);
return v_bytesValue_370_;
}
}
LEAN_EXPORT uint32_t lb_t6ed79f4a8a3bc4358259_get16(lean_object* v_value_371_){
_start:
{
uint32_t v_charValue_372_; 
v_charValue_372_ = lean_ctor_get_uint32(v_value_371_, sizeof(void*)*8 + 36);
lean_dec_ref(v_value_371_);
return v_charValue_372_;
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNative19ad06f04a0c2d39_f__lb__t6ed79f4a8a3bc4358259__get16___boxed(lean_object* v_value_373_){
_start:
{
uint32_t v_res_374_; lean_object* v_r_375_; 
v_res_374_ = lb_t6ed79f4a8a3bc4358259_get16(v_value_373_);
v_r_375_ = lean_box_uint32(v_res_374_);
return v_r_375_;
}
}
LEAN_EXPORT size_t lb_t6ed79f4a8a3bc4358259_get17(lean_object* v_value_376_){
_start:
{
size_t v_usizeValue_377_; 
v_usizeValue_377_ = lean_ctor_get_usize(v_value_376_, 6);
lean_dec_ref(v_value_376_);
return v_usizeValue_377_;
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNative19ad06f04a0c2d39_f__lb__t6ed79f4a8a3bc4358259__get17___boxed(lean_object* v_value_378_){
_start:
{
size_t v_res_379_; lean_object* v_r_380_; 
v_res_379_ = lb_t6ed79f4a8a3bc4358259_get17(v_value_378_);
v_r_380_ = lean_box_usize(v_res_379_);
return v_r_380_;
}
}
LEAN_EXPORT size_t lb_t6ed79f4a8a3bc4358259_get18(lean_object* v_value_381_){
_start:
{
size_t v_isizeValue_382_; 
v_isizeValue_382_ = lean_ctor_get_usize(v_value_381_, 7);
lean_dec_ref(v_value_381_);
return v_isizeValue_382_;
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNative19ad06f04a0c2d39_f__lb__t6ed79f4a8a3bc4358259__get18___boxed(lean_object* v_value_383_){
_start:
{
size_t v_res_384_; lean_object* v_r_385_; 
v_res_384_ = lb_t6ed79f4a8a3bc4358259_get18(v_value_383_);
v_r_385_ = lean_box_usize(v_res_384_);
return v_r_385_;
}
}
LEAN_EXPORT lean_object* lb_t6ed79f4a8a3bc4358259_get19(lean_object* v_value_386_){
_start:
{
lean_object* v_digit_387_; 
v_digit_387_ = lean_ctor_get(v_value_386_, 5);
lean_inc(v_digit_387_);
lean_dec_ref(v_value_386_);
return v_digit_387_;
}
}
LEAN_EXPORT lean_object* lb_t980449f277836feadaee_make(lean_object* v_a0_388_, uint8_t v_a1_389_, uint8_t v_a2_390_, uint16_t v_a3_391_, uint32_t v_a4_392_, uint64_t v_a5_393_, uint8_t v_a6_394_, uint16_t v_a7_395_, uint32_t v_a8_396_, uint64_t v_a9_397_, lean_object* v_a10_398_, lean_object* v_a11_399_, float v_a12_400_, double v_a13_401_, lean_object* v_a14_402_, lean_object* v_a15_403_, uint32_t v_a16_404_, size_t v_a17_405_, size_t v_a18_406_, lean_object* v_a19_407_){
_start:
{
lean_object* v___x_408_; 
v___x_408_ = lean_alloc_ctor(0, 6, sizeof(size_t)*2 + 47);
lean_ctor_set(v___x_408_, 0, v_a0_388_);
lean_ctor_set(v___x_408_, 1, v_a10_398_);
lean_ctor_set(v___x_408_, 2, v_a11_399_);
lean_ctor_set(v___x_408_, 3, v_a14_402_);
lean_ctor_set(v___x_408_, 4, v_a15_403_);
lean_ctor_set(v___x_408_, 5, v_a19_407_);
lean_ctor_set_uint8(v___x_408_, sizeof(void*)*8 + 44, v_a1_389_);
lean_ctor_set_uint8(v___x_408_, sizeof(void*)*8 + 45, v_a2_390_);
lean_ctor_set_uint16(v___x_408_, sizeof(void*)*8 + 40, v_a3_391_);
lean_ctor_set_uint32(v___x_408_, sizeof(void*)*8 + 24, v_a4_392_);
lean_ctor_set_uint64(v___x_408_, sizeof(void*)*8, v_a5_393_);
lean_ctor_set_uint8(v___x_408_, sizeof(void*)*8 + 46, v_a6_394_);
lean_ctor_set_uint16(v___x_408_, sizeof(void*)*8 + 42, v_a7_395_);
lean_ctor_set_uint32(v___x_408_, sizeof(void*)*8 + 28, v_a8_396_);
lean_ctor_set_uint64(v___x_408_, sizeof(void*)*8 + 8, v_a9_397_);
lean_ctor_set_float32(v___x_408_, sizeof(void*)*8 + 32, v_a12_400_);
lean_ctor_set_float(v___x_408_, sizeof(void*)*8 + 16, v_a13_401_);
lean_ctor_set_uint32(v___x_408_, sizeof(void*)*8 + 36, v_a16_404_);
lean_ctor_set_usize(v___x_408_, 6, v_a17_405_);
lean_ctor_set_usize(v___x_408_, 7, v_a18_406_);
return v___x_408_;
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNative19ad06f04a0c2d39_f__lb__t980449f277836feadaee__make___boxed(lean_object** _args){
lean_object* v_a0_409_ = _args[0];
lean_object* v_a1_410_ = _args[1];
lean_object* v_a2_411_ = _args[2];
lean_object* v_a3_412_ = _args[3];
lean_object* v_a4_413_ = _args[4];
lean_object* v_a5_414_ = _args[5];
lean_object* v_a6_415_ = _args[6];
lean_object* v_a7_416_ = _args[7];
lean_object* v_a8_417_ = _args[8];
lean_object* v_a9_418_ = _args[9];
lean_object* v_a10_419_ = _args[10];
lean_object* v_a11_420_ = _args[11];
lean_object* v_a12_421_ = _args[12];
lean_object* v_a13_422_ = _args[13];
lean_object* v_a14_423_ = _args[14];
lean_object* v_a15_424_ = _args[15];
lean_object* v_a16_425_ = _args[16];
lean_object* v_a17_426_ = _args[17];
lean_object* v_a18_427_ = _args[18];
lean_object* v_a19_428_ = _args[19];
_start:
{
uint8_t v_a1_boxed_429_; uint8_t v_a2_boxed_430_; uint16_t v_a3_boxed_431_; uint32_t v_a4_boxed_432_; uint64_t v_a5_boxed_433_; uint8_t v_a6_boxed_434_; uint16_t v_a7_boxed_435_; uint32_t v_a8_boxed_436_; uint64_t v_a9_boxed_437_; float v_a12_boxed_438_; double v_a13_boxed_439_; uint32_t v_a16_boxed_440_; size_t v_a17_boxed_441_; size_t v_a18_boxed_442_; lean_object* v_res_443_; 
v_a1_boxed_429_ = lean_unbox(v_a1_410_);
v_a2_boxed_430_ = lean_unbox(v_a2_411_);
v_a3_boxed_431_ = lean_unbox(v_a3_412_);
v_a4_boxed_432_ = lean_unbox_uint32(v_a4_413_);
lean_dec(v_a4_413_);
v_a5_boxed_433_ = lean_unbox_uint64(v_a5_414_);
lean_dec_ref(v_a5_414_);
v_a6_boxed_434_ = lean_unbox(v_a6_415_);
v_a7_boxed_435_ = lean_unbox(v_a7_416_);
v_a8_boxed_436_ = lean_unbox_uint32(v_a8_417_);
lean_dec(v_a8_417_);
v_a9_boxed_437_ = lean_unbox_uint64(v_a9_418_);
lean_dec_ref(v_a9_418_);
v_a12_boxed_438_ = lean_unbox_float32(v_a12_421_);
lean_dec_ref(v_a12_421_);
v_a13_boxed_439_ = lean_unbox_float(v_a13_422_);
lean_dec_ref(v_a13_422_);
v_a16_boxed_440_ = lean_unbox_uint32(v_a16_425_);
lean_dec(v_a16_425_);
v_a17_boxed_441_ = lean_unbox_usize(v_a17_426_);
lean_dec(v_a17_426_);
v_a18_boxed_442_ = lean_unbox_usize(v_a18_427_);
lean_dec(v_a18_427_);
v_res_443_ = lb_t980449f277836feadaee_make(v_a0_409_, v_a1_boxed_429_, v_a2_boxed_430_, v_a3_boxed_431_, v_a4_boxed_432_, v_a5_boxed_433_, v_a6_boxed_434_, v_a7_boxed_435_, v_a8_boxed_436_, v_a9_boxed_437_, v_a10_419_, v_a11_420_, v_a12_boxed_438_, v_a13_boxed_439_, v_a14_423_, v_a15_424_, v_a16_boxed_440_, v_a17_boxed_441_, v_a18_boxed_442_, v_a19_428_);
return v_res_443_;
}
}
LEAN_EXPORT lean_object* lb_t980449f277836feadaee_get0(lean_object* v_value_444_){
_start:
{
lean_object* v_unitValue_445_; 
v_unitValue_445_ = lean_ctor_get(v_value_444_, 0);
lean_inc(v_unitValue_445_);
lean_dec_ref(v_value_444_);
return v_unitValue_445_;
}
}
LEAN_EXPORT uint8_t lb_t980449f277836feadaee_get1(lean_object* v_value_446_){
_start:
{
uint8_t v_boolValue_447_; 
v_boolValue_447_ = lean_ctor_get_uint8(v_value_446_, sizeof(void*)*8 + 44);
lean_dec_ref(v_value_446_);
return v_boolValue_447_;
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNative19ad06f04a0c2d39_f__lb__t980449f277836feadaee__get1___boxed(lean_object* v_value_448_){
_start:
{
uint8_t v_res_449_; lean_object* v_r_450_; 
v_res_449_ = lb_t980449f277836feadaee_get1(v_value_448_);
v_r_450_ = lean_box(v_res_449_);
return v_r_450_;
}
}
LEAN_EXPORT uint8_t lb_t980449f277836feadaee_get2(lean_object* v_value_451_){
_start:
{
uint8_t v_uint8Value_452_; 
v_uint8Value_452_ = lean_ctor_get_uint8(v_value_451_, sizeof(void*)*8 + 45);
lean_dec_ref(v_value_451_);
return v_uint8Value_452_;
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNative19ad06f04a0c2d39_f__lb__t980449f277836feadaee__get2___boxed(lean_object* v_value_453_){
_start:
{
uint8_t v_res_454_; lean_object* v_r_455_; 
v_res_454_ = lb_t980449f277836feadaee_get2(v_value_453_);
v_r_455_ = lean_box(v_res_454_);
return v_r_455_;
}
}
LEAN_EXPORT uint16_t lb_t980449f277836feadaee_get3(lean_object* v_value_456_){
_start:
{
uint16_t v_uint16Value_457_; 
v_uint16Value_457_ = lean_ctor_get_uint16(v_value_456_, sizeof(void*)*8 + 40);
lean_dec_ref(v_value_456_);
return v_uint16Value_457_;
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNative19ad06f04a0c2d39_f__lb__t980449f277836feadaee__get3___boxed(lean_object* v_value_458_){
_start:
{
uint16_t v_res_459_; lean_object* v_r_460_; 
v_res_459_ = lb_t980449f277836feadaee_get3(v_value_458_);
v_r_460_ = lean_box(v_res_459_);
return v_r_460_;
}
}
LEAN_EXPORT uint32_t lb_t980449f277836feadaee_get4(lean_object* v_value_461_){
_start:
{
uint32_t v_uint32Value_462_; 
v_uint32Value_462_ = lean_ctor_get_uint32(v_value_461_, sizeof(void*)*8 + 24);
lean_dec_ref(v_value_461_);
return v_uint32Value_462_;
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNative19ad06f04a0c2d39_f__lb__t980449f277836feadaee__get4___boxed(lean_object* v_value_463_){
_start:
{
uint32_t v_res_464_; lean_object* v_r_465_; 
v_res_464_ = lb_t980449f277836feadaee_get4(v_value_463_);
v_r_465_ = lean_box_uint32(v_res_464_);
return v_r_465_;
}
}
LEAN_EXPORT uint64_t lb_t980449f277836feadaee_get5(lean_object* v_value_466_){
_start:
{
uint64_t v_uint64Value_467_; 
v_uint64Value_467_ = lean_ctor_get_uint64(v_value_466_, sizeof(void*)*8);
lean_dec_ref(v_value_466_);
return v_uint64Value_467_;
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNative19ad06f04a0c2d39_f__lb__t980449f277836feadaee__get5___boxed(lean_object* v_value_468_){
_start:
{
uint64_t v_res_469_; lean_object* v_r_470_; 
v_res_469_ = lb_t980449f277836feadaee_get5(v_value_468_);
v_r_470_ = lean_box_uint64(v_res_469_);
return v_r_470_;
}
}
LEAN_EXPORT uint8_t lb_t980449f277836feadaee_get6(lean_object* v_value_471_){
_start:
{
uint8_t v_int8Value_472_; 
v_int8Value_472_ = lean_ctor_get_uint8(v_value_471_, sizeof(void*)*8 + 46);
lean_dec_ref(v_value_471_);
return v_int8Value_472_;
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNative19ad06f04a0c2d39_f__lb__t980449f277836feadaee__get6___boxed(lean_object* v_value_473_){
_start:
{
uint8_t v_res_474_; lean_object* v_r_475_; 
v_res_474_ = lb_t980449f277836feadaee_get6(v_value_473_);
v_r_475_ = lean_box(v_res_474_);
return v_r_475_;
}
}
LEAN_EXPORT uint16_t lb_t980449f277836feadaee_get7(lean_object* v_value_476_){
_start:
{
uint16_t v_int16Value_477_; 
v_int16Value_477_ = lean_ctor_get_uint16(v_value_476_, sizeof(void*)*8 + 42);
lean_dec_ref(v_value_476_);
return v_int16Value_477_;
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNative19ad06f04a0c2d39_f__lb__t980449f277836feadaee__get7___boxed(lean_object* v_value_478_){
_start:
{
uint16_t v_res_479_; lean_object* v_r_480_; 
v_res_479_ = lb_t980449f277836feadaee_get7(v_value_478_);
v_r_480_ = lean_box(v_res_479_);
return v_r_480_;
}
}
LEAN_EXPORT uint32_t lb_t980449f277836feadaee_get8(lean_object* v_value_481_){
_start:
{
uint32_t v_int32Value_482_; 
v_int32Value_482_ = lean_ctor_get_uint32(v_value_481_, sizeof(void*)*8 + 28);
lean_dec_ref(v_value_481_);
return v_int32Value_482_;
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNative19ad06f04a0c2d39_f__lb__t980449f277836feadaee__get8___boxed(lean_object* v_value_483_){
_start:
{
uint32_t v_res_484_; lean_object* v_r_485_; 
v_res_484_ = lb_t980449f277836feadaee_get8(v_value_483_);
v_r_485_ = lean_box_uint32(v_res_484_);
return v_r_485_;
}
}
LEAN_EXPORT uint64_t lb_t980449f277836feadaee_get9(lean_object* v_value_486_){
_start:
{
uint64_t v_int64Value_487_; 
v_int64Value_487_ = lean_ctor_get_uint64(v_value_486_, sizeof(void*)*8 + 8);
lean_dec_ref(v_value_486_);
return v_int64Value_487_;
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNative19ad06f04a0c2d39_f__lb__t980449f277836feadaee__get9___boxed(lean_object* v_value_488_){
_start:
{
uint64_t v_res_489_; lean_object* v_r_490_; 
v_res_489_ = lb_t980449f277836feadaee_get9(v_value_488_);
v_r_490_ = lean_box_uint64(v_res_489_);
return v_r_490_;
}
}
LEAN_EXPORT lean_object* lb_t980449f277836feadaee_get10(lean_object* v_value_491_){
_start:
{
lean_object* v_natValue_492_; 
v_natValue_492_ = lean_ctor_get(v_value_491_, 1);
lean_inc(v_natValue_492_);
lean_dec_ref(v_value_491_);
return v_natValue_492_;
}
}
LEAN_EXPORT lean_object* lb_t980449f277836feadaee_get11(lean_object* v_value_493_){
_start:
{
lean_object* v_intValue_494_; 
v_intValue_494_ = lean_ctor_get(v_value_493_, 2);
lean_inc(v_intValue_494_);
lean_dec_ref(v_value_493_);
return v_intValue_494_;
}
}
LEAN_EXPORT float lb_t980449f277836feadaee_get12(lean_object* v_value_495_){
_start:
{
float v_float32Value_496_; 
v_float32Value_496_ = lean_ctor_get_float32(v_value_495_, sizeof(void*)*8 + 32);
lean_dec_ref(v_value_495_);
return v_float32Value_496_;
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNative19ad06f04a0c2d39_f__lb__t980449f277836feadaee__get12___boxed(lean_object* v_value_497_){
_start:
{
float v_res_498_; lean_object* v_r_499_; 
v_res_498_ = lb_t980449f277836feadaee_get12(v_value_497_);
v_r_499_ = lean_box_float32(v_res_498_);
return v_r_499_;
}
}
LEAN_EXPORT double lb_t980449f277836feadaee_get13(lean_object* v_value_500_){
_start:
{
double v_float64Value_501_; 
v_float64Value_501_ = lean_ctor_get_float(v_value_500_, sizeof(void*)*8 + 16);
lean_dec_ref(v_value_500_);
return v_float64Value_501_;
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNative19ad06f04a0c2d39_f__lb__t980449f277836feadaee__get13___boxed(lean_object* v_value_502_){
_start:
{
double v_res_503_; lean_object* v_r_504_; 
v_res_503_ = lb_t980449f277836feadaee_get13(v_value_502_);
v_r_504_ = lean_box_float(v_res_503_);
return v_r_504_;
}
}
LEAN_EXPORT lean_object* lb_t980449f277836feadaee_get14(lean_object* v_value_505_){
_start:
{
lean_object* v_textValue_506_; 
v_textValue_506_ = lean_ctor_get(v_value_505_, 3);
lean_inc_ref(v_textValue_506_);
lean_dec_ref(v_value_505_);
return v_textValue_506_;
}
}
LEAN_EXPORT lean_object* lb_t980449f277836feadaee_get15(lean_object* v_value_507_){
_start:
{
lean_object* v_bytesValue_508_; 
v_bytesValue_508_ = lean_ctor_get(v_value_507_, 4);
lean_inc_ref(v_bytesValue_508_);
lean_dec_ref(v_value_507_);
return v_bytesValue_508_;
}
}
LEAN_EXPORT uint32_t lb_t980449f277836feadaee_get16(lean_object* v_value_509_){
_start:
{
uint32_t v_charValue_510_; 
v_charValue_510_ = lean_ctor_get_uint32(v_value_509_, sizeof(void*)*8 + 36);
lean_dec_ref(v_value_509_);
return v_charValue_510_;
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNative19ad06f04a0c2d39_f__lb__t980449f277836feadaee__get16___boxed(lean_object* v_value_511_){
_start:
{
uint32_t v_res_512_; lean_object* v_r_513_; 
v_res_512_ = lb_t980449f277836feadaee_get16(v_value_511_);
v_r_513_ = lean_box_uint32(v_res_512_);
return v_r_513_;
}
}
LEAN_EXPORT size_t lb_t980449f277836feadaee_get17(lean_object* v_value_514_){
_start:
{
size_t v_usizeValue_515_; 
v_usizeValue_515_ = lean_ctor_get_usize(v_value_514_, 6);
lean_dec_ref(v_value_514_);
return v_usizeValue_515_;
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNative19ad06f04a0c2d39_f__lb__t980449f277836feadaee__get17___boxed(lean_object* v_value_516_){
_start:
{
size_t v_res_517_; lean_object* v_r_518_; 
v_res_517_ = lb_t980449f277836feadaee_get17(v_value_516_);
v_r_518_ = lean_box_usize(v_res_517_);
return v_r_518_;
}
}
LEAN_EXPORT size_t lb_t980449f277836feadaee_get18(lean_object* v_value_519_){
_start:
{
size_t v_isizeValue_520_; 
v_isizeValue_520_ = lean_ctor_get_usize(v_value_519_, 7);
lean_dec_ref(v_value_519_);
return v_isizeValue_520_;
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNative19ad06f04a0c2d39_f__lb__t980449f277836feadaee__get18___boxed(lean_object* v_value_521_){
_start:
{
size_t v_res_522_; lean_object* v_r_523_; 
v_res_522_ = lb_t980449f277836feadaee_get18(v_value_521_);
v_r_523_ = lean_box_usize(v_res_522_);
return v_r_523_;
}
}
LEAN_EXPORT lean_object* lb_t980449f277836feadaee_get19(lean_object* v_value_524_){
_start:
{
lean_object* v_digit_525_; 
v_digit_525_ = lean_ctor_get(v_value_524_, 5);
lean_inc(v_digit_525_);
lean_dec_ref(v_value_524_);
return v_digit_525_;
}
}
LEAN_EXPORT lean_object* lb_td552bec1d6b17ed5222c_none(lean_object* v___unit_526_){
_start:
{
lean_object* v___x_527_; 
v___x_527_ = lean_box(0);
return v___x_527_;
}
}
LEAN_EXPORT lean_object* lb_td552bec1d6b17ed5222c_some(lean_object* v_value_528_){
_start:
{
lean_object* v___x_529_; 
v___x_529_ = lean_alloc_ctor(1, 1, 0);
lean_ctor_set(v___x_529_, 0, v_value_528_);
return v___x_529_;
}
}
LEAN_EXPORT uint8_t lb_td552bec1d6b17ed5222c_has(lean_object* v_value_530_){
_start:
{
if (lean_obj_tag(v_value_530_) == 0)
{
uint8_t v___x_531_; 
v___x_531_ = 0;
return v___x_531_;
}
else
{
uint8_t v___x_532_; 
lean_dec_ref_known(v_value_530_, 1);
v___x_532_ = 1;
return v___x_532_;
}
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNative19ad06f04a0c2d39_f__lb__td552bec1d6b17ed5222c__has___boxed(lean_object* v_value_533_){
_start:
{
uint8_t v_res_534_; lean_object* v_r_535_; 
v_res_534_ = lb_td552bec1d6b17ed5222c_has(v_value_533_);
v_r_535_ = lean_box(v_res_534_);
return v_r_535_;
}
}
static uint8_t _init_l_LeanBridgeNative19ad06f04a0c2d39_f__lb__td552bec1d6b17ed5222c__get0___closed__0(void){
_start:
{
lean_object* v___x_536_; uint8_t v___x_537_; 
v___x_536_ = lean_unsigned_to_nat(0u);
v___x_537_ = lean_int8_of_nat(v___x_536_);
return v___x_537_;
}
}
static uint16_t _init_l_LeanBridgeNative19ad06f04a0c2d39_f__lb__td552bec1d6b17ed5222c__get0___closed__1(void){
_start:
{
lean_object* v___x_538_; uint16_t v___x_539_; 
v___x_538_ = lean_unsigned_to_nat(0u);
v___x_539_ = lean_int16_of_nat(v___x_538_);
return v___x_539_;
}
}
static uint32_t _init_l_LeanBridgeNative19ad06f04a0c2d39_f__lb__td552bec1d6b17ed5222c__get0___closed__2(void){
_start:
{
lean_object* v___x_540_; uint32_t v___x_541_; 
v___x_540_ = lean_unsigned_to_nat(0u);
v___x_541_ = lean_int32_of_nat(v___x_540_);
return v___x_541_;
}
}
static uint64_t _init_l_LeanBridgeNative19ad06f04a0c2d39_f__lb__td552bec1d6b17ed5222c__get0___closed__3(void){
_start:
{
lean_object* v___x_542_; uint64_t v___x_543_; 
v___x_542_ = lean_unsigned_to_nat(0u);
v___x_543_ = lean_int64_of_nat(v___x_542_);
return v___x_543_;
}
}
static lean_object* _init_l_LeanBridgeNative19ad06f04a0c2d39_f__lb__td552bec1d6b17ed5222c__get0___closed__4(void){
_start:
{
lean_object* v___x_544_; lean_object* v___x_545_; 
v___x_544_ = lean_unsigned_to_nat(0u);
v___x_545_ = lean_nat_to_int(v___x_544_);
return v___x_545_;
}
}
static float _init_l_LeanBridgeNative19ad06f04a0c2d39_f__lb__td552bec1d6b17ed5222c__get0___closed__5(void){
_start:
{
lean_object* v___x_546_; float v___x_547_; 
v___x_546_ = lean_unsigned_to_nat(0u);
v___x_547_ = lean_float32_of_nat(v___x_546_);
return v___x_547_;
}
}
static double _init_l_LeanBridgeNative19ad06f04a0c2d39_f__lb__td552bec1d6b17ed5222c__get0___closed__6(void){
_start:
{
lean_object* v___x_548_; double v___x_549_; 
v___x_548_ = lean_unsigned_to_nat(0u);
v___x_549_ = lean_float_of_nat(v___x_548_);
return v___x_549_;
}
}
static size_t _init_l_LeanBridgeNative19ad06f04a0c2d39_f__lb__td552bec1d6b17ed5222c__get0___closed__8(void){
_start:
{
lean_object* v___x_551_; size_t v___x_552_; 
v___x_551_ = lean_unsigned_to_nat(0u);
v___x_552_ = lean_isize_of_nat(v___x_551_);
return v___x_552_;
}
}
static lean_object* _init_l_LeanBridgeNative19ad06f04a0c2d39_f__lb__td552bec1d6b17ed5222c__get0___closed__9(void){
_start:
{
size_t v___x_553_; size_t v___x_554_; lean_object* v___x_555_; lean_object* v___x_556_; double v___x_557_; float v___x_558_; lean_object* v___x_559_; lean_object* v___x_560_; uint64_t v___x_561_; uint32_t v___x_562_; uint16_t v___x_563_; uint8_t v___x_564_; uint64_t v___x_565_; uint32_t v___x_566_; uint16_t v___x_567_; uint8_t v___x_568_; uint8_t v___x_569_; lean_object* v___x_570_; lean_object* v___x_571_; 
v___x_553_ = lean_usize_once(&l_LeanBridgeNative19ad06f04a0c2d39_f__lb__td552bec1d6b17ed5222c__get0___closed__8, &l_LeanBridgeNative19ad06f04a0c2d39_f__lb__td552bec1d6b17ed5222c__get0___closed__8_once, _init_l_LeanBridgeNative19ad06f04a0c2d39_f__lb__td552bec1d6b17ed5222c__get0___closed__8);
v___x_554_ = ((size_t)0ULL);
v___x_555_ = l_ByteArray_empty;
v___x_556_ = ((lean_object*)(l_LeanBridgeNative19ad06f04a0c2d39_f__lb__td552bec1d6b17ed5222c__get0___closed__7));
v___x_557_ = lean_float_once(&l_LeanBridgeNative19ad06f04a0c2d39_f__lb__td552bec1d6b17ed5222c__get0___closed__6, &l_LeanBridgeNative19ad06f04a0c2d39_f__lb__td552bec1d6b17ed5222c__get0___closed__6_once, _init_l_LeanBridgeNative19ad06f04a0c2d39_f__lb__td552bec1d6b17ed5222c__get0___closed__6);
v___x_558_ = lean_float32_once(&l_LeanBridgeNative19ad06f04a0c2d39_f__lb__td552bec1d6b17ed5222c__get0___closed__5, &l_LeanBridgeNative19ad06f04a0c2d39_f__lb__td552bec1d6b17ed5222c__get0___closed__5_once, _init_l_LeanBridgeNative19ad06f04a0c2d39_f__lb__td552bec1d6b17ed5222c__get0___closed__5);
v___x_559_ = lean_obj_once(&l_LeanBridgeNative19ad06f04a0c2d39_f__lb__td552bec1d6b17ed5222c__get0___closed__4, &l_LeanBridgeNative19ad06f04a0c2d39_f__lb__td552bec1d6b17ed5222c__get0___closed__4_once, _init_l_LeanBridgeNative19ad06f04a0c2d39_f__lb__td552bec1d6b17ed5222c__get0___closed__4);
v___x_560_ = lean_unsigned_to_nat(0u);
v___x_561_ = lean_uint64_once(&l_LeanBridgeNative19ad06f04a0c2d39_f__lb__td552bec1d6b17ed5222c__get0___closed__3, &l_LeanBridgeNative19ad06f04a0c2d39_f__lb__td552bec1d6b17ed5222c__get0___closed__3_once, _init_l_LeanBridgeNative19ad06f04a0c2d39_f__lb__td552bec1d6b17ed5222c__get0___closed__3);
v___x_562_ = lean_uint32_once(&l_LeanBridgeNative19ad06f04a0c2d39_f__lb__td552bec1d6b17ed5222c__get0___closed__2, &l_LeanBridgeNative19ad06f04a0c2d39_f__lb__td552bec1d6b17ed5222c__get0___closed__2_once, _init_l_LeanBridgeNative19ad06f04a0c2d39_f__lb__td552bec1d6b17ed5222c__get0___closed__2);
v___x_563_ = lean_uint16_once(&l_LeanBridgeNative19ad06f04a0c2d39_f__lb__td552bec1d6b17ed5222c__get0___closed__1, &l_LeanBridgeNative19ad06f04a0c2d39_f__lb__td552bec1d6b17ed5222c__get0___closed__1_once, _init_l_LeanBridgeNative19ad06f04a0c2d39_f__lb__td552bec1d6b17ed5222c__get0___closed__1);
v___x_564_ = lean_uint8_once(&l_LeanBridgeNative19ad06f04a0c2d39_f__lb__td552bec1d6b17ed5222c__get0___closed__0, &l_LeanBridgeNative19ad06f04a0c2d39_f__lb__td552bec1d6b17ed5222c__get0___closed__0_once, _init_l_LeanBridgeNative19ad06f04a0c2d39_f__lb__td552bec1d6b17ed5222c__get0___closed__0);
v___x_565_ = 0ULL;
v___x_566_ = 0;
v___x_567_ = 0;
v___x_568_ = 0;
v___x_569_ = 0;
v___x_570_ = lean_box(0);
v___x_571_ = lean_alloc_ctor(0, 6, sizeof(size_t)*2 + 47);
lean_ctor_set(v___x_571_, 0, v___x_570_);
lean_ctor_set(v___x_571_, 1, v___x_560_);
lean_ctor_set(v___x_571_, 2, v___x_559_);
lean_ctor_set(v___x_571_, 3, v___x_556_);
lean_ctor_set(v___x_571_, 4, v___x_555_);
lean_ctor_set(v___x_571_, 5, v___x_560_);
lean_ctor_set_uint8(v___x_571_, sizeof(void*)*8 + 44, v___x_569_);
lean_ctor_set_uint8(v___x_571_, sizeof(void*)*8 + 45, v___x_568_);
lean_ctor_set_uint16(v___x_571_, sizeof(void*)*8 + 40, v___x_567_);
lean_ctor_set_uint32(v___x_571_, sizeof(void*)*8 + 24, v___x_566_);
lean_ctor_set_uint64(v___x_571_, sizeof(void*)*8, v___x_565_);
lean_ctor_set_uint8(v___x_571_, sizeof(void*)*8 + 46, v___x_564_);
lean_ctor_set_uint16(v___x_571_, sizeof(void*)*8 + 42, v___x_563_);
lean_ctor_set_uint32(v___x_571_, sizeof(void*)*8 + 28, v___x_562_);
lean_ctor_set_uint64(v___x_571_, sizeof(void*)*8 + 8, v___x_561_);
lean_ctor_set_float32(v___x_571_, sizeof(void*)*8 + 32, v___x_558_);
lean_ctor_set_float(v___x_571_, sizeof(void*)*8 + 16, v___x_557_);
lean_ctor_set_uint32(v___x_571_, sizeof(void*)*8 + 36, v___x_566_);
lean_ctor_set_usize(v___x_571_, 6, v___x_554_);
lean_ctor_set_usize(v___x_571_, 7, v___x_553_);
return v___x_571_;
}
}
LEAN_EXPORT lean_object* lb_td552bec1d6b17ed5222c_get0(lean_object* v_value_572_){
_start:
{
if (lean_obj_tag(v_value_572_) == 0)
{
lean_object* v___x_573_; 
v___x_573_ = lean_obj_once(&l_LeanBridgeNative19ad06f04a0c2d39_f__lb__td552bec1d6b17ed5222c__get0___closed__9, &l_LeanBridgeNative19ad06f04a0c2d39_f__lb__td552bec1d6b17ed5222c__get0___closed__9_once, _init_l_LeanBridgeNative19ad06f04a0c2d39_f__lb__td552bec1d6b17ed5222c__get0___closed__9);
return v___x_573_;
}
else
{
lean_object* v_val_574_; 
v_val_574_ = lean_ctor_get(v_value_572_, 0);
lean_inc(v_val_574_);
lean_dec_ref_known(v_value_572_, 1);
return v_val_574_;
}
}
}
LEAN_EXPORT uint8_t lb_td367e4fc052df6d1c32d_has(lean_object* v_value_575_){
_start:
{
if (lean_obj_tag(v_value_575_) == 0)
{
uint8_t v___x_576_; 
lean_dec_ref_known(v_value_575_, 1);
v___x_576_ = 0;
return v___x_576_;
}
else
{
uint8_t v___x_577_; 
lean_dec_ref_known(v_value_575_, 1);
v___x_577_ = 1;
return v___x_577_;
}
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNative19ad06f04a0c2d39_f__lb__td367e4fc052df6d1c32d__has___boxed(lean_object* v_value_578_){
_start:
{
uint8_t v_res_579_; lean_object* v_r_580_; 
v_res_579_ = lb_td367e4fc052df6d1c32d_has(v_value_578_);
v_r_580_ = lean_box(v_res_579_);
return v_r_580_;
}
}
LEAN_EXPORT lean_object* lb_td367e4fc052df6d1c32d_ok(lean_object* v_value_581_){
_start:
{
lean_object* v___x_582_; 
v___x_582_ = lean_alloc_ctor(1, 1, 0);
lean_ctor_set(v___x_582_, 0, v_value_581_);
return v___x_582_;
}
}
LEAN_EXPORT lean_object* lb_td367e4fc052df6d1c32d_get0(lean_object* v_value_583_){
_start:
{
if (lean_obj_tag(v_value_583_) == 1)
{
lean_object* v_a_584_; 
v_a_584_ = lean_ctor_get(v_value_583_, 0);
lean_inc(v_a_584_);
lean_dec_ref_known(v_value_583_, 1);
return v_a_584_;
}
else
{
lean_object* v___x_585_; 
lean_dec_ref(v_value_583_);
v___x_585_ = lean_obj_once(&l_LeanBridgeNative19ad06f04a0c2d39_f__lb__td552bec1d6b17ed5222c__get0___closed__9, &l_LeanBridgeNative19ad06f04a0c2d39_f__lb__td552bec1d6b17ed5222c__get0___closed__9_once, _init_l_LeanBridgeNative19ad06f04a0c2d39_f__lb__td552bec1d6b17ed5222c__get0___closed__9);
return v___x_585_;
}
}
}
LEAN_EXPORT lean_object* lb_td367e4fc052df6d1c32d_error(lean_object* v_value_586_){
_start:
{
lean_object* v___x_587_; 
v___x_587_ = lean_alloc_ctor(0, 1, 0);
lean_ctor_set(v___x_587_, 0, v_value_586_);
return v___x_587_;
}
}
LEAN_EXPORT lean_object* lb_td367e4fc052df6d1c32d_get1(lean_object* v_value_588_){
_start:
{
if (lean_obj_tag(v_value_588_) == 0)
{
lean_object* v_a_589_; 
v_a_589_ = lean_ctor_get(v_value_588_, 0);
lean_inc(v_a_589_);
lean_dec_ref_known(v_value_588_, 1);
return v_a_589_;
}
else
{
lean_object* v___x_590_; 
lean_dec_ref(v_value_588_);
v___x_590_ = lean_obj_once(&l_LeanBridgeNative19ad06f04a0c2d39_f__lb__td552bec1d6b17ed5222c__get0___closed__9, &l_LeanBridgeNative19ad06f04a0c2d39_f__lb__td552bec1d6b17ed5222c__get0___closed__9_once, _init_l_LeanBridgeNative19ad06f04a0c2d39_f__lb__td552bec1d6b17ed5222c__get0___closed__9);
return v___x_590_;
}
}
}
LEAN_EXPORT lean_object* lb_t5a1383905e3435e418a9_none(lean_object* v___unit_591_){
_start:
{
lean_object* v___x_592_; 
v___x_592_ = lean_box(0);
return v___x_592_;
}
}
LEAN_EXPORT lean_object* lb_t5a1383905e3435e418a9_some(lean_object* v_value_593_){
_start:
{
lean_object* v___x_594_; 
v___x_594_ = lean_alloc_ctor(1, 1, 0);
lean_ctor_set(v___x_594_, 0, v_value_593_);
return v___x_594_;
}
}
LEAN_EXPORT uint8_t lb_t5a1383905e3435e418a9_has(lean_object* v_value_595_){
_start:
{
if (lean_obj_tag(v_value_595_) == 0)
{
uint8_t v___x_596_; 
v___x_596_ = 0;
return v___x_596_;
}
else
{
uint8_t v___x_597_; 
lean_dec_ref_known(v_value_595_, 1);
v___x_597_ = 1;
return v___x_597_;
}
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNative19ad06f04a0c2d39_f__lb__t5a1383905e3435e418a9__has___boxed(lean_object* v_value_598_){
_start:
{
uint8_t v_res_599_; lean_object* v_r_600_; 
v_res_599_ = lb_t5a1383905e3435e418a9_has(v_value_598_);
v_r_600_ = lean_box(v_res_599_);
return v_r_600_;
}
}
static lean_object* _init_l_LeanBridgeNative19ad06f04a0c2d39_f__lb__t5a1383905e3435e418a9__get0___closed__0(void){
_start:
{
lean_object* v___x_601_; lean_object* v___x_602_; 
v___x_601_ = lean_obj_once(&l_LeanBridgeNative19ad06f04a0c2d39_f__lb__td552bec1d6b17ed5222c__get0___closed__9, &l_LeanBridgeNative19ad06f04a0c2d39_f__lb__td552bec1d6b17ed5222c__get0___closed__9_once, _init_l_LeanBridgeNative19ad06f04a0c2d39_f__lb__td552bec1d6b17ed5222c__get0___closed__9);
v___x_602_ = lean_alloc_ctor(1, 1, 0);
lean_ctor_set(v___x_602_, 0, v___x_601_);
return v___x_602_;
}
}
LEAN_EXPORT lean_object* lb_t5a1383905e3435e418a9_get0(lean_object* v_value_603_){
_start:
{
if (lean_obj_tag(v_value_603_) == 0)
{
lean_object* v___x_604_; 
v___x_604_ = lean_obj_once(&l_LeanBridgeNative19ad06f04a0c2d39_f__lb__t5a1383905e3435e418a9__get0___closed__0, &l_LeanBridgeNative19ad06f04a0c2d39_f__lb__t5a1383905e3435e418a9__get0___closed__0_once, _init_l_LeanBridgeNative19ad06f04a0c2d39_f__lb__t5a1383905e3435e418a9__get0___closed__0);
return v___x_604_;
}
else
{
lean_object* v_val_605_; 
v_val_605_ = lean_ctor_get(v_value_603_, 0);
lean_inc(v_val_605_);
lean_dec_ref_known(v_value_603_, 1);
return v_val_605_;
}
}
}
LEAN_EXPORT uint32_t lb_t466ade0f8f5195fb9b51_tag(lean_object* v_value_606_){
_start:
{
switch(lean_obj_tag(v_value_606_))
{
case 0:
{
uint32_t v___x_607_; 
v___x_607_ = 0;
return v___x_607_;
}
case 1:
{
uint32_t v___x_608_; 
lean_dec_ref_known(v_value_606_, 1);
v___x_608_ = 1;
return v___x_608_;
}
default: 
{
uint32_t v___x_609_; 
lean_dec_ref_known(v_value_606_, 1);
v___x_609_ = 2;
return v___x_609_;
}
}
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNative19ad06f04a0c2d39_f__lb__t466ade0f8f5195fb9b51__tag___boxed(lean_object* v_value_610_){
_start:
{
uint32_t v_res_611_; lean_object* v_r_612_; 
v_res_611_ = lb_t466ade0f8f5195fb9b51_tag(v_value_610_);
v_r_612_ = lean_box_uint32(v_res_611_);
return v_r_612_;
}
}
LEAN_EXPORT lean_object* lb_t466ade0f8f5195fb9b51_make0(lean_object* v___unit_613_){
_start:
{
lean_object* v___x_614_; 
v___x_614_ = lean_box(0);
return v___x_614_;
}
}
LEAN_EXPORT lean_object* lb_t466ade0f8f5195fb9b51_make1(lean_object* v_a0_615_){
_start:
{
lean_object* v___x_616_; 
v___x_616_ = lean_alloc_ctor(1, 1, 0);
lean_ctor_set(v___x_616_, 0, v_a0_615_);
return v___x_616_;
}
}
LEAN_EXPORT lean_object* lb_t466ade0f8f5195fb9b51_get1_0(lean_object* v_value_617_){
_start:
{
if (lean_obj_tag(v_value_617_) == 1)
{
lean_object* v_a0_618_; 
v_a0_618_ = lean_ctor_get(v_value_617_, 0);
lean_inc_ref(v_a0_618_);
lean_dec_ref_known(v_value_617_, 1);
return v_a0_618_;
}
else
{
lean_object* v___x_619_; 
lean_dec(v_value_617_);
v___x_619_ = lean_obj_once(&l_LeanBridgeNative19ad06f04a0c2d39_f__lb__td552bec1d6b17ed5222c__get0___closed__9, &l_LeanBridgeNative19ad06f04a0c2d39_f__lb__td552bec1d6b17ed5222c__get0___closed__9_once, _init_l_LeanBridgeNative19ad06f04a0c2d39_f__lb__td552bec1d6b17ed5222c__get0___closed__9);
return v___x_619_;
}
}
}
LEAN_EXPORT lean_object* lb_t466ade0f8f5195fb9b51_make2(lean_object* v_a0_620_){
_start:
{
lean_object* v___x_621_; 
v___x_621_ = lean_alloc_ctor(2, 1, 0);
lean_ctor_set(v___x_621_, 0, v_a0_620_);
return v___x_621_;
}
}
LEAN_EXPORT lean_object* lb_t466ade0f8f5195fb9b51_get2_0(lean_object* v_value_624_){
_start:
{
if (lean_obj_tag(v_value_624_) == 2)
{
lean_object* v_a0_625_; 
v_a0_625_ = lean_ctor_get(v_value_624_, 0);
lean_inc_ref(v_a0_625_);
lean_dec_ref_known(v_value_624_, 1);
return v_a0_625_;
}
else
{
lean_object* v___x_626_; 
lean_dec(v_value_624_);
v___x_626_ = ((lean_object*)(l_LeanBridgeNative19ad06f04a0c2d39_f__lb__t466ade0f8f5195fb9b51__get2__0___closed__0));
return v___x_626_;
}
}
}
LEAN_EXPORT lean_object* lb_tbb4f1df77db4bc2e5592_make(lean_object* v_a0_627_, lean_object* v_a1_628_){
_start:
{
lean_object* v___x_629_; 
v___x_629_ = lean_alloc_ctor(0, 2, 0);
lean_ctor_set(v___x_629_, 0, v_a0_627_);
lean_ctor_set(v___x_629_, 1, v_a1_628_);
return v___x_629_;
}
}
LEAN_EXPORT lean_object* lb_tbb4f1df77db4bc2e5592_get0(lean_object* v_value_630_){
_start:
{
lean_object* v_left_631_; 
v_left_631_ = lean_ctor_get(v_value_630_, 0);
lean_inc_ref(v_left_631_);
lean_dec_ref(v_value_630_);
return v_left_631_;
}
}
LEAN_EXPORT lean_object* lb_tbb4f1df77db4bc2e5592_get1(lean_object* v_value_632_){
_start:
{
lean_object* v_right_633_; 
v_right_633_ = lean_ctor_get(v_value_632_, 1);
lean_inc_ref(v_right_633_);
lean_dec_ref(v_value_632_);
return v_right_633_;
}
}
LEAN_EXPORT lean_object* lb_native_nat_text(lean_object* v_value_634_){
_start:
{
lean_object* v___x_635_; 
v___x_635_ = l_Nat_reprFast(v_value_634_);
return v___x_635_;
}
}
LEAN_EXPORT lean_object* lb_native_int_text(lean_object* v_value_636_){
_start:
{
lean_object* v___x_637_; 
v___x_637_ = l_Int_repr(v_value_636_);
lean_dec(v_value_636_);
return v___x_637_;
}
}
LEAN_EXPORT lean_object* l_panic___at___00LeanBridgeNative19ad06f04a0c2d39_f__lb__native__int__parse_spec__0(lean_object* v_msg_638_){
_start:
{
lean_object* v___x_639_; lean_object* v___x_640_; 
v___x_639_ = l_Int_instInhabited;
v___x_640_ = lean_panic_fn_borrowed(v___x_639_, v_msg_638_);
return v___x_640_;
}
}
LEAN_EXPORT lean_object* lb_native_int_parse(lean_object* v_value_642_){
_start:
{
lean_object* v___x_643_; lean_object* v___x_644_; lean_object* v___x_645_; lean_object* v___x_646_; 
v___x_643_ = lean_unsigned_to_nat(0u);
v___x_644_ = lean_string_utf8_byte_size(v_value_642_);
v___x_645_ = lean_alloc_ctor(0, 3, 0);
lean_ctor_set(v___x_645_, 0, v_value_642_);
lean_ctor_set(v___x_645_, 1, v___x_643_);
lean_ctor_set(v___x_645_, 2, v___x_644_);
v___x_646_ = l_String_Slice_toInt_x3f(v___x_645_);
if (lean_obj_tag(v___x_646_) == 0)
{
lean_object* v___x_647_; lean_object* v___x_648_; 
v___x_647_ = ((lean_object*)(l_LeanBridgeNative19ad06f04a0c2d39_f__lb__native__int__parse___closed__0));
v___x_648_ = l_panic___at___00LeanBridgeNative19ad06f04a0c2d39_f__lb__native__int__parse_spec__0(v___x_647_);
return v___x_648_;
}
else
{
lean_object* v_val_649_; 
v_val_649_ = lean_ctor_get(v___x_646_, 0);
lean_inc(v_val_649_);
lean_dec_ref_known(v___x_646_, 1);
return v_val_649_;
}
}
}
lean_object* initialize_Init(uint8_t builtin);
lean_object* initialize_Init(uint8_t builtin);
lean_object* initialize_NominalPrimitiveSubtypes(uint8_t builtin);
static bool _G_initialized = false;
LEAN_EXPORT lean_object* initialize_LeanBridgeNative19ad06f04a0c2d39(uint8_t builtin) {
lean_object * res;
if (_G_initialized) return lean_io_result_mk_ok(lean_box(0));
_G_initialized = true;
res = initialize_Init(builtin);
if (lean_io_result_is_error(res)) return res;
lean_dec_ref(res);
res = initialize_Init(builtin);
if (lean_io_result_is_error(res)) return res;
lean_dec_ref(res);
res = initialize_NominalPrimitiveSubtypes(builtin);
if (lean_io_result_is_error(res)) return res;
lean_dec_ref(res);
return lean_io_result_mk_ok(lean_box(0));
}
#ifdef __cplusplus
}
#endif

#include "component.h"
