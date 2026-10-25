#include <stdio.h>
// Lean compiler output
// Module: RecursiveSubtypes
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
lean_object* lean_nat_add(lean_object*, lean_object*);
uint8_t lean_nat_dec_lt(lean_object*, lean_object*);
lean_object* lean_array_get_size(lean_object*);
LEAN_EXPORT lean_object* l_RecursiveSubtypes_positive(lean_object*);
LEAN_EXPORT lean_object* l_RecursiveSubtypes_positive___boxed(lean_object*);
LEAN_EXPORT lean_object* lb_recursive_subtype_probe_constructor_plusOne(lean_object*);
LEAN_EXPORT lean_object* lb_recursive_subtype_probe_constructor_plusTwo(lean_object*);
LEAN_EXPORT lean_object* l_RecursiveSubtypes_Chain_ctorIdx(lean_object*);
LEAN_EXPORT lean_object* l_RecursiveSubtypes_Chain_ctorIdx___boxed(lean_object*);
LEAN_EXPORT lean_object* l_RecursiveSubtypes_Chain_ctorElim___redArg(lean_object*, lean_object*);
LEAN_EXPORT lean_object* l_RecursiveSubtypes_Chain_ctorElim(lean_object*, lean_object*, lean_object*, lean_object*, lean_object*);
LEAN_EXPORT lean_object* l_RecursiveSubtypes_Chain_ctorElim___boxed(lean_object*, lean_object*, lean_object*, lean_object*, lean_object*);
LEAN_EXPORT lean_object* l_RecursiveSubtypes_Chain_empty_elim___redArg(lean_object*, lean_object*);
LEAN_EXPORT lean_object* l_RecursiveSubtypes_Chain_empty_elim(lean_object*, lean_object*, lean_object*, lean_object*);
LEAN_EXPORT lean_object* l_RecursiveSubtypes_Chain_node_elim___redArg(lean_object*, lean_object*);
LEAN_EXPORT lean_object* l_RecursiveSubtypes_Chain_node_elim(lean_object*, lean_object*, lean_object*, lean_object*);
LEAN_EXPORT lean_object* l_RecursiveSubtypes_firstBody(lean_object*);
LEAN_EXPORT lean_object* l_RecursiveSubtypes_firstBody___boxed(lean_object*);
LEAN_EXPORT lean_object* lb_recursive_subtype_probe_source_first(lean_object*);
LEAN_EXPORT lean_object* l_RecursiveSubtypes_secondBody(lean_object*);
LEAN_EXPORT lean_object* l_RecursiveSubtypes_secondBody___boxed(lean_object*);
LEAN_EXPORT lean_object* lb_recursive_subtype_probe_source_second(lean_object*);
LEAN_EXPORT lean_object* lb_recursive_subtype_probe_source_echo(lean_object*);
LEAN_EXPORT lean_object* lb_recursive_subtype_probe_source_groups(lean_object*);
LEAN_EXPORT lean_object* lb_recursive_subtype_probe_source_echoGroups(lean_object*);
LEAN_EXPORT lean_object* lb_recursive_subtype_probe_source_produce(lean_object*);
LEAN_EXPORT lean_object* l_RecursiveSubtypes_positive(lean_object* v_value_1_){
_start:
{
lean_object* v___x_2_; lean_object* v___x_3_; 
v___x_2_ = lean_unsigned_to_nat(1u);
v___x_3_ = lean_nat_add(v_value_1_, v___x_2_);
return v___x_3_;
}
}
LEAN_EXPORT lean_object* l_RecursiveSubtypes_positive___boxed(lean_object* v_value_4_){
_start:
{
lean_object* v_res_5_; 
v_res_5_ = l_RecursiveSubtypes_positive(v_value_4_);
lean_dec(v_value_4_);
return v_res_5_;
}
}
LEAN_EXPORT lean_object* lb_recursive_subtype_probe_constructor_plusOne(lean_object* v_value_6_){
  fputs("LB_SUBTYPE_ENTRY_V1 enter constructor RecursiveSubtypes.plusOne\n", stderr);

_start:
{
lean_object* v___x_7_; uint8_t v___x_8_; 
v___x_7_ = lean_unsigned_to_nat(100u);
v___x_8_ = lean_nat_dec_lt(v_value_6_, v___x_7_);
if (v___x_8_ == 0)
{
lean_object* v___x_9_; 
lean_dec(v_value_6_);
v___x_9_ = lean_box(0);
return v___x_9_;
}
else
{
lean_object* v___x_10_; lean_object* v___x_11_; 
v___x_10_ = l_RecursiveSubtypes_positive(v_value_6_);
lean_dec(v_value_6_);
v___x_11_ = lean_alloc_ctor(1, 1, 0);
lean_ctor_set(v___x_11_, 0, v___x_10_);
return v___x_11_;
}
}
}
LEAN_EXPORT lean_object* lb_recursive_subtype_probe_constructor_plusTwo(lean_object* v_value_12_){
  fputs("LB_SUBTYPE_ENTRY_V1 enter constructor RecursiveSubtypes.plusTwo\n", stderr);

_start:
{
lean_object* v___x_13_; uint8_t v___x_14_; 
v___x_13_ = lean_unsigned_to_nat(90u);
v___x_14_ = lean_nat_dec_lt(v_value_12_, v___x_13_);
if (v___x_14_ == 0)
{
lean_object* v___x_15_; 
lean_dec(v_value_12_);
v___x_15_ = lean_box(0);
return v___x_15_;
}
else
{
lean_object* v___x_16_; lean_object* v___x_17_; lean_object* v___x_18_; lean_object* v___x_19_; 
v___x_16_ = lean_unsigned_to_nat(1u);
v___x_17_ = lean_nat_add(v_value_12_, v___x_16_);
lean_dec(v_value_12_);
v___x_18_ = l_RecursiveSubtypes_positive(v___x_17_);
lean_dec(v___x_17_);
v___x_19_ = lean_alloc_ctor(1, 1, 0);
lean_ctor_set(v___x_19_, 0, v___x_18_);
return v___x_19_;
}
}
}
LEAN_EXPORT lean_object* l_RecursiveSubtypes_Chain_ctorIdx(lean_object* v_x_20_){
_start:
{
if (lean_obj_tag(v_x_20_) == 0)
{
lean_object* v___x_21_; 
v___x_21_ = lean_unsigned_to_nat(0u);
return v___x_21_;
}
else
{
lean_object* v___x_22_; 
v___x_22_ = lean_unsigned_to_nat(1u);
return v___x_22_;
}
}
}
LEAN_EXPORT lean_object* l_RecursiveSubtypes_Chain_ctorIdx___boxed(lean_object* v_x_23_){
_start:
{
lean_object* v_res_24_; 
v_res_24_ = l_RecursiveSubtypes_Chain_ctorIdx(v_x_23_);
lean_dec(v_x_23_);
return v_res_24_;
}
}
LEAN_EXPORT lean_object* l_RecursiveSubtypes_Chain_ctorElim___redArg(lean_object* v_t_25_, lean_object* v_k_26_){
_start:
{
if (lean_obj_tag(v_t_25_) == 0)
{
return v_k_26_;
}
else
{
lean_object* v_value_27_; lean_object* v_digit_28_; lean_object* v_tail_29_; lean_object* v___x_30_; 
v_value_27_ = lean_ctor_get(v_t_25_, 0);
lean_inc(v_value_27_);
v_digit_28_ = lean_ctor_get(v_t_25_, 1);
lean_inc(v_digit_28_);
v_tail_29_ = lean_ctor_get(v_t_25_, 2);
lean_inc(v_tail_29_);
lean_dec_ref_known(v_t_25_, 3);
v___x_30_ = lean_apply_3(v_k_26_, v_value_27_, v_digit_28_, v_tail_29_);
return v___x_30_;
}
}
}
LEAN_EXPORT lean_object* l_RecursiveSubtypes_Chain_ctorElim(lean_object* v_motive_31_, lean_object* v_ctorIdx_32_, lean_object* v_t_33_, lean_object* v_h_34_, lean_object* v_k_35_){
_start:
{
lean_object* v___x_36_; 
v___x_36_ = l_RecursiveSubtypes_Chain_ctorElim___redArg(v_t_33_, v_k_35_);
return v___x_36_;
}
}
LEAN_EXPORT lean_object* l_RecursiveSubtypes_Chain_ctorElim___boxed(lean_object* v_motive_37_, lean_object* v_ctorIdx_38_, lean_object* v_t_39_, lean_object* v_h_40_, lean_object* v_k_41_){
_start:
{
lean_object* v_res_42_; 
v_res_42_ = l_RecursiveSubtypes_Chain_ctorElim(v_motive_37_, v_ctorIdx_38_, v_t_39_, v_h_40_, v_k_41_);
lean_dec(v_ctorIdx_38_);
return v_res_42_;
}
}
LEAN_EXPORT lean_object* l_RecursiveSubtypes_Chain_empty_elim___redArg(lean_object* v_t_43_, lean_object* v_empty_44_){
_start:
{
lean_object* v___x_45_; 
v___x_45_ = l_RecursiveSubtypes_Chain_ctorElim___redArg(v_t_43_, v_empty_44_);
return v___x_45_;
}
}
LEAN_EXPORT lean_object* l_RecursiveSubtypes_Chain_empty_elim(lean_object* v_motive_46_, lean_object* v_t_47_, lean_object* v_h_48_, lean_object* v_empty_49_){
_start:
{
lean_object* v___x_50_; 
v___x_50_ = l_RecursiveSubtypes_Chain_ctorElim___redArg(v_t_47_, v_empty_49_);
return v___x_50_;
}
}
LEAN_EXPORT lean_object* l_RecursiveSubtypes_Chain_node_elim___redArg(lean_object* v_t_51_, lean_object* v_node_52_){
_start:
{
lean_object* v___x_53_; 
v___x_53_ = l_RecursiveSubtypes_Chain_ctorElim___redArg(v_t_51_, v_node_52_);
return v___x_53_;
}
}
LEAN_EXPORT lean_object* l_RecursiveSubtypes_Chain_node_elim(lean_object* v_motive_54_, lean_object* v_t_55_, lean_object* v_h_56_, lean_object* v_node_57_){
_start:
{
lean_object* v___x_58_; 
v___x_58_ = l_RecursiveSubtypes_Chain_ctorElim___redArg(v_t_55_, v_node_57_);
return v___x_58_;
}
}
LEAN_EXPORT lean_object* l_RecursiveSubtypes_firstBody(lean_object* v_x_59_){
_start:
{
if (lean_obj_tag(v_x_59_) == 0)
{
lean_object* v___x_60_; 
v___x_60_ = lean_unsigned_to_nat(0u);
return v___x_60_;
}
else
{
lean_object* v_value_61_; 
v_value_61_ = lean_ctor_get(v_x_59_, 0);
lean_inc(v_value_61_);
return v_value_61_;
}
}
}
LEAN_EXPORT lean_object* l_RecursiveSubtypes_firstBody___boxed(lean_object* v_x_62_){
_start:
{
lean_object* v_res_63_; 
v_res_63_ = l_RecursiveSubtypes_firstBody(v_x_62_);
lean_dec(v_x_62_);
return v_res_63_;
}
}
LEAN_EXPORT lean_object* lb_recursive_subtype_probe_source_first(lean_object* v_value_64_){
  fputs("LB_SUBTYPE_ENTRY_V1 enter source RecursiveSubtypes.first\n", stderr);

_start:
{
lean_object* v___x_65_; 
v___x_65_ = l_RecursiveSubtypes_firstBody(v_value_64_);
lean_dec(v_value_64_);
return v___x_65_;
}
}
LEAN_EXPORT lean_object* l_RecursiveSubtypes_secondBody(lean_object* v_x_66_){
_start:
{
if (lean_obj_tag(v_x_66_) == 0)
{
lean_object* v___x_67_; 
v___x_67_ = lean_unsigned_to_nat(0u);
return v___x_67_;
}
else
{
lean_object* v_value_68_; 
v_value_68_ = lean_ctor_get(v_x_66_, 0);
lean_inc(v_value_68_);
return v_value_68_;
}
}
}
LEAN_EXPORT lean_object* l_RecursiveSubtypes_secondBody___boxed(lean_object* v_x_69_){
_start:
{
lean_object* v_res_70_; 
v_res_70_ = l_RecursiveSubtypes_secondBody(v_x_69_);
lean_dec(v_x_69_);
return v_res_70_;
}
}
LEAN_EXPORT lean_object* lb_recursive_subtype_probe_source_second(lean_object* v_value_71_){
  fputs("LB_SUBTYPE_ENTRY_V1 enter source RecursiveSubtypes.second\n", stderr);

_start:
{
lean_object* v___x_72_; 
v___x_72_ = l_RecursiveSubtypes_secondBody(v_value_71_);
lean_dec(v_value_71_);
return v___x_72_;
}
}
LEAN_EXPORT lean_object* lb_recursive_subtype_probe_source_echo(lean_object* v_value_73_){
  fputs("LB_SUBTYPE_ENTRY_V1 enter source RecursiveSubtypes.echo\n", stderr);

_start:
{
return v_value_73_;
}
}
LEAN_EXPORT lean_object* lb_recursive_subtype_probe_source_groups(lean_object* v_values_74_){
  fputs("LB_SUBTYPE_ENTRY_V1 enter source RecursiveSubtypes.groups\n", stderr);

_start:
{
lean_object* v___x_75_; 
v___x_75_ = lean_array_get_size(v_values_74_);
lean_dec_ref(v_values_74_);
return v___x_75_;
}
}
LEAN_EXPORT lean_object* lb_recursive_subtype_probe_source_echoGroups(lean_object* v_values_76_){
  fputs("LB_SUBTYPE_ENTRY_V1 enter source RecursiveSubtypes.echoGroups\n", stderr);

_start:
{
return v_values_76_;
}
}
LEAN_EXPORT lean_object* lb_recursive_subtype_probe_source_produce(lean_object* v_value_77_){
  fputs("LB_SUBTYPE_ENTRY_V1 enter source RecursiveSubtypes.produce\n", stderr);

_start:
{
lean_object* v___x_78_; lean_object* v___x_79_; lean_object* v___x_80_; lean_object* v___x_81_; lean_object* v___x_82_; lean_object* v___x_83_; lean_object* v___x_84_; lean_object* v___x_85_; 
v___x_78_ = l_RecursiveSubtypes_positive(v_value_77_);
v___x_79_ = lean_unsigned_to_nat(2u);
v___x_80_ = lean_unsigned_to_nat(1u);
v___x_81_ = lean_nat_add(v_value_77_, v___x_80_);
lean_dec(v_value_77_);
v___x_82_ = l_RecursiveSubtypes_positive(v___x_81_);
lean_dec(v___x_81_);
v___x_83_ = lean_box(0);
v___x_84_ = lean_alloc_ctor(1, 3, 0);
lean_ctor_set(v___x_84_, 0, v___x_82_);
lean_ctor_set(v___x_84_, 1, v___x_80_);
lean_ctor_set(v___x_84_, 2, v___x_83_);
v___x_85_ = lean_alloc_ctor(1, 3, 0);
lean_ctor_set(v___x_85_, 0, v___x_78_);
lean_ctor_set(v___x_85_, 1, v___x_79_);
lean_ctor_set(v___x_85_, 2, v___x_84_);
return v___x_85_;
}
}
lean_object* initialize_Init(uint8_t builtin);
lean_object* initialize_Init(uint8_t builtin);
static bool _G_initialized = false;
LEAN_EXPORT lean_object* initialize_RecursiveSubtypes(uint8_t builtin) {
lean_object * res;
if (_G_initialized) return lean_io_result_mk_ok(lean_box(0));
_G_initialized = true;
res = initialize_Init(builtin);
if (lean_io_result_is_error(res)) return res;
lean_dec_ref(res);
res = initialize_Init(builtin);
if (lean_io_result_is_error(res)) return res;
lean_dec_ref(res);
return lean_io_result_mk_ok(lean_box(0));
}
#ifdef __cplusplus
}
#endif
