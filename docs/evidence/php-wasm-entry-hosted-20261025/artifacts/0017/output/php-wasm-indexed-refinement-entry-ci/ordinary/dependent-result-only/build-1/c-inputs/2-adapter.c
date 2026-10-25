// Lean compiler output
// Module: LeanBridgeNativeca8ca903379eb247
// Imports: public import Init public meta import Init public import DependentRecords
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
extern lean_object* l_Int_instInhabited;
lean_object* lean_panic_fn_borrowed(lean_object*, lean_object*);
lean_object* lb_dependent_result_only_probe_source_dependentResult(lean_object*);
lean_object* l_Int_repr(lean_object*);
lean_object* l_Nat_reprFast(lean_object*);
lean_object* lean_string_utf8_byte_size(lean_object*);
lean_object* l_String_Slice_toInt_x3f(lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNativeca8ca903379eb247_LbErased_DependentRecords_Dependent_erase(lean_object*);
LEAN_EXPORT lean_object* lb_e59e187300c993f56dccdfb9(lean_object*);
LEAN_EXPORT lean_object* lb_t9c7fb003d50bbc5bd05d_make(lean_object*, lean_object*);
LEAN_EXPORT lean_object* lb_t9c7fb003d50bbc5bd05d_get0(lean_object*);
LEAN_EXPORT lean_object* lb_t9c7fb003d50bbc5bd05d_get1(lean_object*);
LEAN_EXPORT lean_object* lb_native_nat_text(lean_object*);
LEAN_EXPORT lean_object* lb_native_int_text(lean_object*);
LEAN_EXPORT lean_object* l_panic___at___00LeanBridgeNativeca8ca903379eb247_f__lb__native__int__parse_spec__0(lean_object*);
static const lean_string_object l_LeanBridgeNativeca8ca903379eb247_f__lb__native__int__parse___closed__0_value = {.m_header = {.m_rc = 0, .m_cs_sz = 0, .m_other = 0, .m_tag = 249}, .m_size = 13, .m_capacity = 13, .m_length = 12, .m_data = "Int expected"};
static const lean_object* l_LeanBridgeNativeca8ca903379eb247_f__lb__native__int__parse___closed__0 = (const lean_object*)&l_LeanBridgeNativeca8ca903379eb247_f__lb__native__int__parse___closed__0_value;
LEAN_EXPORT lean_object* lb_native_int_parse(lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNativeca8ca903379eb247_LbErased_DependentRecords_Dependent_erase(lean_object* v_value_1_){
_start:
{
lean_object* v_bound_2_; lean_object* v_below_3_; lean_object* v___x_5_; uint8_t v_isShared_6_; uint8_t v_isSharedCheck_10_; 
v_bound_2_ = lean_ctor_get(v_value_1_, 0);
v_below_3_ = lean_ctor_get(v_value_1_, 1);
v_isSharedCheck_10_ = !lean_is_exclusive(v_value_1_);
if (v_isSharedCheck_10_ == 0)
{
v___x_5_ = v_value_1_;
v_isShared_6_ = v_isSharedCheck_10_;
goto v_resetjp_4_;
}
else
{
lean_inc(v_below_3_);
lean_inc(v_bound_2_);
lean_dec(v_value_1_);
v___x_5_ = lean_box(0);
v_isShared_6_ = v_isSharedCheck_10_;
goto v_resetjp_4_;
}
v_resetjp_4_:
{
lean_object* v___x_8_; 
if (v_isShared_6_ == 0)
{
v___x_8_ = v___x_5_;
goto v_reusejp_7_;
}
else
{
lean_object* v_reuseFailAlloc_9_; 
v_reuseFailAlloc_9_ = lean_alloc_ctor(0, 2, 0);
lean_ctor_set(v_reuseFailAlloc_9_, 0, v_bound_2_);
lean_ctor_set(v_reuseFailAlloc_9_, 1, v_below_3_);
v___x_8_ = v_reuseFailAlloc_9_;
goto v_reusejp_7_;
}
v_reusejp_7_:
{
return v___x_8_;
}
}
}
}
LEAN_EXPORT lean_object* lb_e59e187300c993f56dccdfb9(lean_object* v_a0_11_){
_start:
{
lean_object* v___x_12_; lean_object* v___x_13_; 
v___x_12_ = lb_dependent_result_only_probe_source_dependentResult(v_a0_11_);
v___x_13_ = l_LeanBridgeNativeca8ca903379eb247_LbErased_DependentRecords_Dependent_erase(v___x_12_);
return v___x_13_;
}
}
LEAN_EXPORT lean_object* lb_t9c7fb003d50bbc5bd05d_make(lean_object* v_a0_14_, lean_object* v_a1_15_){
_start:
{
lean_object* v___x_16_; 
v___x_16_ = lean_alloc_ctor(0, 2, 0);
lean_ctor_set(v___x_16_, 0, v_a0_14_);
lean_ctor_set(v___x_16_, 1, v_a1_15_);
return v___x_16_;
}
}
LEAN_EXPORT lean_object* lb_t9c7fb003d50bbc5bd05d_get0(lean_object* v_value_17_){
_start:
{
lean_object* v_bound_18_; 
v_bound_18_ = lean_ctor_get(v_value_17_, 0);
lean_inc(v_bound_18_);
lean_dec_ref(v_value_17_);
return v_bound_18_;
}
}
LEAN_EXPORT lean_object* lb_t9c7fb003d50bbc5bd05d_get1(lean_object* v_value_19_){
_start:
{
lean_object* v_below_20_; 
v_below_20_ = lean_ctor_get(v_value_19_, 1);
lean_inc(v_below_20_);
lean_dec_ref(v_value_19_);
return v_below_20_;
}
}
LEAN_EXPORT lean_object* lb_native_nat_text(lean_object* v_value_21_){
_start:
{
lean_object* v___x_22_; 
v___x_22_ = l_Nat_reprFast(v_value_21_);
return v___x_22_;
}
}
LEAN_EXPORT lean_object* lb_native_int_text(lean_object* v_value_23_){
_start:
{
lean_object* v___x_24_; 
v___x_24_ = l_Int_repr(v_value_23_);
lean_dec(v_value_23_);
return v___x_24_;
}
}
LEAN_EXPORT lean_object* l_panic___at___00LeanBridgeNativeca8ca903379eb247_f__lb__native__int__parse_spec__0(lean_object* v_msg_25_){
_start:
{
lean_object* v___x_26_; lean_object* v___x_27_; 
v___x_26_ = l_Int_instInhabited;
v___x_27_ = lean_panic_fn_borrowed(v___x_26_, v_msg_25_);
return v___x_27_;
}
}
LEAN_EXPORT lean_object* lb_native_int_parse(lean_object* v_value_29_){
_start:
{
lean_object* v___x_30_; lean_object* v___x_31_; lean_object* v___x_32_; lean_object* v___x_33_; 
v___x_30_ = lean_unsigned_to_nat(0u);
v___x_31_ = lean_string_utf8_byte_size(v_value_29_);
v___x_32_ = lean_alloc_ctor(0, 3, 0);
lean_ctor_set(v___x_32_, 0, v_value_29_);
lean_ctor_set(v___x_32_, 1, v___x_30_);
lean_ctor_set(v___x_32_, 2, v___x_31_);
v___x_33_ = l_String_Slice_toInt_x3f(v___x_32_);
if (lean_obj_tag(v___x_33_) == 0)
{
lean_object* v___x_34_; lean_object* v___x_35_; 
v___x_34_ = ((lean_object*)(l_LeanBridgeNativeca8ca903379eb247_f__lb__native__int__parse___closed__0));
v___x_35_ = l_panic___at___00LeanBridgeNativeca8ca903379eb247_f__lb__native__int__parse_spec__0(v___x_34_);
return v___x_35_;
}
else
{
lean_object* v_val_36_; 
v_val_36_ = lean_ctor_get(v___x_33_, 0);
lean_inc(v_val_36_);
lean_dec_ref_known(v___x_33_, 1);
return v_val_36_;
}
}
}
lean_object* initialize_Init(uint8_t builtin);
lean_object* initialize_Init(uint8_t builtin);
lean_object* initialize_DependentRecords(uint8_t builtin);
static bool _G_initialized = false;
LEAN_EXPORT lean_object* initialize_LeanBridgeNativeca8ca903379eb247(uint8_t builtin) {
lean_object * res;
if (_G_initialized) return lean_io_result_mk_ok(lean_box(0));
_G_initialized = true;
res = initialize_Init(builtin);
if (lean_io_result_is_error(res)) return res;
lean_dec_ref(res);
res = initialize_Init(builtin);
if (lean_io_result_is_error(res)) return res;
lean_dec_ref(res);
res = initialize_DependentRecords(builtin);
if (lean_io_result_is_error(res)) return res;
lean_dec_ref(res);
return lean_io_result_mk_ok(lean_box(0));
}
#ifdef __cplusplus
}
#endif

#include "component.h"
