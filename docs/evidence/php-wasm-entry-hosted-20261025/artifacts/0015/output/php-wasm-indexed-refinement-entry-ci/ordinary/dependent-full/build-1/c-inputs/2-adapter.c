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
lean_object* lb_dependent_full_probe_constructor_mkDependent(lean_object*, lean_object*);
lean_object* lb_dependent_full_probe_source_dependentRoundtrip(lean_object*);
extern lean_object* l_Int_instInhabited;
lean_object* lean_panic_fn_borrowed(lean_object*, lean_object*);
lean_object* lb_dependent_full_probe_source_dependentResult(lean_object*);
lean_object* l_Int_repr(lean_object*);
lean_object* lb_dependent_full_probe_source_dependentTotal(lean_object*);
lean_object* l_Nat_reprFast(lean_object*);
lean_object* lean_string_utf8_byte_size(lean_object*);
lean_object* l_String_Slice_toInt_x3f(lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNativeca8ca903379eb247_LbErased_DependentRecords_Dependent_erase(lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNativeca8ca903379eb247_LbErased_DependentRecords_Dependent_via__de910be546383ee2(lean_object*);
LEAN_EXPORT lean_object* lb_e59e187300c993f56dccdfb9(lean_object*);
LEAN_EXPORT lean_object* lb_5c4342be8d065a841e1981ff(lean_object*);
LEAN_EXPORT uint8_t lb_5c4342be8d065a841e1981ff_refinement_0(lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNativeca8ca903379eb247_f__lb__5c4342be8d065a841e1981ff__refinement__0___boxed(lean_object*);
LEAN_EXPORT lean_object* lb_6742bb14f123c11405a71a1d(lean_object*);
LEAN_EXPORT uint8_t lb_6742bb14f123c11405a71a1d_refinement_0(lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNativeca8ca903379eb247_f__lb__6742bb14f123c11405a71a1d__refinement__0___boxed(lean_object*);
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
LEAN_EXPORT lean_object* l_LeanBridgeNativeca8ca903379eb247_LbErased_DependentRecords_Dependent_via__de910be546383ee2(lean_object* v_value_11_){
_start:
{
lean_object* v_bound_12_; lean_object* v_below_13_; lean_object* v___x_14_; 
v_bound_12_ = lean_ctor_get(v_value_11_, 0);
lean_inc(v_bound_12_);
v_below_13_ = lean_ctor_get(v_value_11_, 1);
lean_inc(v_below_13_);
lean_dec_ref(v_value_11_);
v___x_14_ = lb_dependent_full_probe_constructor_mkDependent(v_bound_12_, v_below_13_);
return v___x_14_;
}
}
LEAN_EXPORT lean_object* lb_e59e187300c993f56dccdfb9(lean_object* v_a0_15_){
_start:
{
lean_object* v___x_16_; lean_object* v___x_17_; 
v___x_16_ = lb_dependent_full_probe_source_dependentResult(v_a0_15_);
v___x_17_ = l_LeanBridgeNativeca8ca903379eb247_LbErased_DependentRecords_Dependent_erase(v___x_16_);
return v___x_17_;
}
}
LEAN_EXPORT lean_object* lb_5c4342be8d065a841e1981ff(lean_object* v_a0_18_){
_start:
{
lean_object* v___x_19_; 
v___x_19_ = l_LeanBridgeNativeca8ca903379eb247_LbErased_DependentRecords_Dependent_via__de910be546383ee2(v_a0_18_);
if (lean_obj_tag(v___x_19_) == 0)
{
lean_object* v___x_20_; 
v___x_20_ = lean_box(0);
return v___x_20_;
}
else
{
lean_object* v_val_21_; lean_object* v___x_23_; uint8_t v_isShared_24_; uint8_t v_isSharedCheck_30_; 
v_val_21_ = lean_ctor_get(v___x_19_, 0);
v_isSharedCheck_30_ = !lean_is_exclusive(v___x_19_);
if (v_isSharedCheck_30_ == 0)
{
v___x_23_ = v___x_19_;
v_isShared_24_ = v_isSharedCheck_30_;
goto v_resetjp_22_;
}
else
{
lean_inc(v_val_21_);
lean_dec(v___x_19_);
v___x_23_ = lean_box(0);
v_isShared_24_ = v_isSharedCheck_30_;
goto v_resetjp_22_;
}
v_resetjp_22_:
{
lean_object* v___x_25_; lean_object* v___x_26_; lean_object* v___x_28_; 
v___x_25_ = lb_dependent_full_probe_source_dependentRoundtrip(v_val_21_);
v___x_26_ = l_LeanBridgeNativeca8ca903379eb247_LbErased_DependentRecords_Dependent_erase(v___x_25_);
if (v_isShared_24_ == 0)
{
lean_ctor_set(v___x_23_, 0, v___x_26_);
v___x_28_ = v___x_23_;
goto v_reusejp_27_;
}
else
{
lean_object* v_reuseFailAlloc_29_; 
v_reuseFailAlloc_29_ = lean_alloc_ctor(1, 1, 0);
lean_ctor_set(v_reuseFailAlloc_29_, 0, v___x_26_);
v___x_28_ = v_reuseFailAlloc_29_;
goto v_reusejp_27_;
}
v_reusejp_27_:
{
return v___x_28_;
}
}
}
}
}
LEAN_EXPORT uint8_t lb_5c4342be8d065a841e1981ff_refinement_0(lean_object* v_value_31_){
_start:
{
lean_object* v___x_32_; 
v___x_32_ = l_LeanBridgeNativeca8ca903379eb247_LbErased_DependentRecords_Dependent_via__de910be546383ee2(v_value_31_);
if (lean_obj_tag(v___x_32_) == 0)
{
uint8_t v___x_33_; 
v___x_33_ = 0;
return v___x_33_;
}
else
{
uint8_t v___x_34_; 
lean_dec_ref_known(v___x_32_, 1);
v___x_34_ = 1;
return v___x_34_;
}
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNativeca8ca903379eb247_f__lb__5c4342be8d065a841e1981ff__refinement__0___boxed(lean_object* v_value_35_){
_start:
{
uint8_t v_res_36_; lean_object* v_r_37_; 
v_res_36_ = lb_5c4342be8d065a841e1981ff_refinement_0(v_value_35_);
v_r_37_ = lean_box(v_res_36_);
return v_r_37_;
}
}
LEAN_EXPORT lean_object* lb_6742bb14f123c11405a71a1d(lean_object* v_a0_38_){
_start:
{
lean_object* v___x_39_; 
v___x_39_ = l_LeanBridgeNativeca8ca903379eb247_LbErased_DependentRecords_Dependent_via__de910be546383ee2(v_a0_38_);
if (lean_obj_tag(v___x_39_) == 0)
{
lean_object* v___x_40_; 
v___x_40_ = lean_box(0);
return v___x_40_;
}
else
{
lean_object* v_val_41_; lean_object* v___x_43_; uint8_t v_isShared_44_; uint8_t v_isSharedCheck_49_; 
v_val_41_ = lean_ctor_get(v___x_39_, 0);
v_isSharedCheck_49_ = !lean_is_exclusive(v___x_39_);
if (v_isSharedCheck_49_ == 0)
{
v___x_43_ = v___x_39_;
v_isShared_44_ = v_isSharedCheck_49_;
goto v_resetjp_42_;
}
else
{
lean_inc(v_val_41_);
lean_dec(v___x_39_);
v___x_43_ = lean_box(0);
v_isShared_44_ = v_isSharedCheck_49_;
goto v_resetjp_42_;
}
v_resetjp_42_:
{
lean_object* v___x_45_; lean_object* v___x_47_; 
v___x_45_ = lb_dependent_full_probe_source_dependentTotal(v_val_41_);
if (v_isShared_44_ == 0)
{
lean_ctor_set(v___x_43_, 0, v___x_45_);
v___x_47_ = v___x_43_;
goto v_reusejp_46_;
}
else
{
lean_object* v_reuseFailAlloc_48_; 
v_reuseFailAlloc_48_ = lean_alloc_ctor(1, 1, 0);
lean_ctor_set(v_reuseFailAlloc_48_, 0, v___x_45_);
v___x_47_ = v_reuseFailAlloc_48_;
goto v_reusejp_46_;
}
v_reusejp_46_:
{
return v___x_47_;
}
}
}
}
}
LEAN_EXPORT uint8_t lb_6742bb14f123c11405a71a1d_refinement_0(lean_object* v_value_50_){
_start:
{
lean_object* v___x_51_; 
v___x_51_ = l_LeanBridgeNativeca8ca903379eb247_LbErased_DependentRecords_Dependent_via__de910be546383ee2(v_value_50_);
if (lean_obj_tag(v___x_51_) == 0)
{
uint8_t v___x_52_; 
v___x_52_ = 0;
return v___x_52_;
}
else
{
uint8_t v___x_53_; 
lean_dec_ref_known(v___x_51_, 1);
v___x_53_ = 1;
return v___x_53_;
}
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNativeca8ca903379eb247_f__lb__6742bb14f123c11405a71a1d__refinement__0___boxed(lean_object* v_value_54_){
_start:
{
uint8_t v_res_55_; lean_object* v_r_56_; 
v_res_55_ = lb_6742bb14f123c11405a71a1d_refinement_0(v_value_54_);
v_r_56_ = lean_box(v_res_55_);
return v_r_56_;
}
}
LEAN_EXPORT lean_object* lb_t9c7fb003d50bbc5bd05d_make(lean_object* v_a0_57_, lean_object* v_a1_58_){
_start:
{
lean_object* v___x_59_; 
v___x_59_ = lean_alloc_ctor(0, 2, 0);
lean_ctor_set(v___x_59_, 0, v_a0_57_);
lean_ctor_set(v___x_59_, 1, v_a1_58_);
return v___x_59_;
}
}
LEAN_EXPORT lean_object* lb_t9c7fb003d50bbc5bd05d_get0(lean_object* v_value_60_){
_start:
{
lean_object* v_bound_61_; 
v_bound_61_ = lean_ctor_get(v_value_60_, 0);
lean_inc(v_bound_61_);
lean_dec_ref(v_value_60_);
return v_bound_61_;
}
}
LEAN_EXPORT lean_object* lb_t9c7fb003d50bbc5bd05d_get1(lean_object* v_value_62_){
_start:
{
lean_object* v_below_63_; 
v_below_63_ = lean_ctor_get(v_value_62_, 1);
lean_inc(v_below_63_);
lean_dec_ref(v_value_62_);
return v_below_63_;
}
}
LEAN_EXPORT lean_object* lb_native_nat_text(lean_object* v_value_64_){
_start:
{
lean_object* v___x_65_; 
v___x_65_ = l_Nat_reprFast(v_value_64_);
return v___x_65_;
}
}
LEAN_EXPORT lean_object* lb_native_int_text(lean_object* v_value_66_){
_start:
{
lean_object* v___x_67_; 
v___x_67_ = l_Int_repr(v_value_66_);
lean_dec(v_value_66_);
return v___x_67_;
}
}
LEAN_EXPORT lean_object* l_panic___at___00LeanBridgeNativeca8ca903379eb247_f__lb__native__int__parse_spec__0(lean_object* v_msg_68_){
_start:
{
lean_object* v___x_69_; lean_object* v___x_70_; 
v___x_69_ = l_Int_instInhabited;
v___x_70_ = lean_panic_fn_borrowed(v___x_69_, v_msg_68_);
return v___x_70_;
}
}
LEAN_EXPORT lean_object* lb_native_int_parse(lean_object* v_value_72_){
_start:
{
lean_object* v___x_73_; lean_object* v___x_74_; lean_object* v___x_75_; lean_object* v___x_76_; 
v___x_73_ = lean_unsigned_to_nat(0u);
v___x_74_ = lean_string_utf8_byte_size(v_value_72_);
v___x_75_ = lean_alloc_ctor(0, 3, 0);
lean_ctor_set(v___x_75_, 0, v_value_72_);
lean_ctor_set(v___x_75_, 1, v___x_73_);
lean_ctor_set(v___x_75_, 2, v___x_74_);
v___x_76_ = l_String_Slice_toInt_x3f(v___x_75_);
if (lean_obj_tag(v___x_76_) == 0)
{
lean_object* v___x_77_; lean_object* v___x_78_; 
v___x_77_ = ((lean_object*)(l_LeanBridgeNativeca8ca903379eb247_f__lb__native__int__parse___closed__0));
v___x_78_ = l_panic___at___00LeanBridgeNativeca8ca903379eb247_f__lb__native__int__parse_spec__0(v___x_77_);
return v___x_78_;
}
else
{
lean_object* v_val_79_; 
v_val_79_ = lean_ctor_get(v___x_76_, 0);
lean_inc(v_val_79_);
lean_dec_ref_known(v___x_76_, 1);
return v_val_79_;
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
