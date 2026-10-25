#include <stdio.h>
// Lean compiler output
// Module: RecursiveCheckedRecords
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
lean_object* lean_array_get_size(lean_object*);
uint8_t lean_nat_dec_lt(lean_object*, lean_object*);
uint8_t lean_nat_dec_le(lean_object*, lean_object*);
LEAN_EXPORT lean_object* lb_recursive_checked_record_probe_constructor_plusOne(lean_object*);
LEAN_EXPORT lean_object* lb_recursive_checked_record_probe_constructor_plusTwo(lean_object*);
LEAN_EXPORT lean_object* lb_recursive_checked_record_probe_constructor_mkPacket(lean_object*, lean_object*, lean_object*);
LEAN_EXPORT lean_object* l_RecursiveCheckedRecords_normalizePacket___redArg(lean_object*, lean_object*);
LEAN_EXPORT lean_object* lb_recursive_checked_record_probe_constructor_normalizePacket(lean_object*, lean_object*, lean_object*);
LEAN_EXPORT lean_object* lb_recursive_checked_record_probe_source_first(lean_object*);
LEAN_EXPORT lean_object* lb_recursive_checked_record_probe_source_second(lean_object*);
LEAN_EXPORT lean_object* lb_recursive_checked_record_probe_source_echo(lean_object*);
LEAN_EXPORT lean_object* lb_recursive_checked_record_probe_source_groups(lean_object*);
LEAN_EXPORT lean_object* lb_recursive_checked_record_probe_source_echoGroups(lean_object*);
LEAN_EXPORT lean_object* l_RecursiveCheckedRecords_positive(lean_object*);
LEAN_EXPORT lean_object* l_RecursiveCheckedRecords_positive___boxed(lean_object*);
LEAN_EXPORT lean_object* lb_recursive_checked_record_probe_source_produce(lean_object*);
LEAN_EXPORT lean_object* lb_recursive_checked_record_probe_constructor_plusOne(lean_object* v_value_1_){
  fputs("LB_SUBTYPE_ENTRY_V1 enter constructor RecursiveCheckedRecords.plusOne\n", stderr);

_start:
{
lean_object* v___x_2_; uint8_t v___x_3_; 
v___x_2_ = lean_unsigned_to_nat(100u);
v___x_3_ = lean_nat_dec_lt(v_value_1_, v___x_2_);
if (v___x_3_ == 0)
{
lean_object* v___x_4_; 
lean_dec(v_value_1_);
v___x_4_ = lean_box(0);
return v___x_4_;
}
else
{
lean_object* v___x_5_; lean_object* v___x_6_; lean_object* v___x_7_; 
v___x_5_ = lean_unsigned_to_nat(1u);
v___x_6_ = lean_nat_add(v_value_1_, v___x_5_);
lean_dec(v_value_1_);
v___x_7_ = lean_alloc_ctor(1, 1, 0);
lean_ctor_set(v___x_7_, 0, v___x_6_);
return v___x_7_;
}
}
}
LEAN_EXPORT lean_object* lb_recursive_checked_record_probe_constructor_plusTwo(lean_object* v_value_8_){
  fputs("LB_SUBTYPE_ENTRY_V1 enter constructor RecursiveCheckedRecords.plusTwo\n", stderr);

_start:
{
lean_object* v___x_9_; uint8_t v___x_10_; 
v___x_9_ = lean_unsigned_to_nat(90u);
v___x_10_ = lean_nat_dec_lt(v_value_8_, v___x_9_);
if (v___x_10_ == 0)
{
lean_object* v___x_11_; 
lean_dec(v_value_8_);
v___x_11_ = lean_box(0);
return v___x_11_;
}
else
{
lean_object* v___x_12_; lean_object* v___x_13_; lean_object* v___x_14_; 
v___x_12_ = lean_unsigned_to_nat(2u);
v___x_13_ = lean_nat_add(v_value_8_, v___x_12_);
lean_dec(v_value_8_);
v___x_14_ = lean_alloc_ctor(1, 1, 0);
lean_ctor_set(v___x_14_, 0, v___x_13_);
return v___x_14_;
}
}
}
LEAN_EXPORT lean_object* lb_recursive_checked_record_probe_constructor_mkPacket(lean_object* v_value_15_, lean_object* v_digit_16_, lean_object* v_tail_17_){
  fputs("LB_SUBTYPE_ENTRY_V1 enter constructor RecursiveCheckedRecords.mkPacket\n", stderr);

_start:
{
uint8_t v___x_18_; 
v___x_18_ = lean_nat_dec_le(v_digit_16_, v_value_15_);
if (v___x_18_ == 0)
{
lean_object* v___x_19_; 
lean_dec(v_tail_17_);
lean_dec(v_digit_16_);
lean_dec(v_value_15_);
v___x_19_ = lean_box(0);
return v___x_19_;
}
else
{
lean_object* v___x_20_; lean_object* v___x_21_; 
v___x_20_ = lean_alloc_ctor(0, 3, 0);
lean_ctor_set(v___x_20_, 0, v_value_15_);
lean_ctor_set(v___x_20_, 1, v_digit_16_);
lean_ctor_set(v___x_20_, 2, v_tail_17_);
v___x_21_ = lean_alloc_ctor(1, 1, 0);
lean_ctor_set(v___x_21_, 0, v___x_20_);
return v___x_21_;
}
}
}
LEAN_EXPORT lean_object* l_RecursiveCheckedRecords_normalizePacket___redArg(lean_object* v_digit_22_, lean_object* v_tail_23_){
_start:
{
lean_object* v___x_24_; lean_object* v_normalized_25_; lean_object* v___x_26_; lean_object* v___x_27_; 
v___x_24_ = lean_unsigned_to_nat(1u);
v_normalized_25_ = lean_nat_add(v_digit_22_, v___x_24_);
v___x_26_ = lean_alloc_ctor(0, 3, 0);
lean_ctor_set(v___x_26_, 0, v_normalized_25_);
lean_ctor_set(v___x_26_, 1, v_digit_22_);
lean_ctor_set(v___x_26_, 2, v_tail_23_);
v___x_27_ = lean_alloc_ctor(1, 1, 0);
lean_ctor_set(v___x_27_, 0, v___x_26_);
return v___x_27_;
}
}
LEAN_EXPORT lean_object* lb_recursive_checked_record_probe_constructor_normalizePacket(lean_object* v_value_28_, lean_object* v_digit_29_, lean_object* v_tail_30_){
  fputs("LB_SUBTYPE_ENTRY_V1 enter constructor RecursiveCheckedRecords.normalizePacket\n", stderr);

_start:
{
lean_object* v___x_31_; 
lean_dec(v_value_28_);
v___x_31_ = l_RecursiveCheckedRecords_normalizePacket___redArg(v_digit_29_, v_tail_30_);
return v___x_31_;
}
}
LEAN_EXPORT lean_object* lb_recursive_checked_record_probe_source_first(lean_object* v_value_32_){
  fputs("LB_SUBTYPE_ENTRY_V1 enter source RecursiveCheckedRecords.first\n", stderr);

_start:
{
lean_object* v_value_33_; 
v_value_33_ = lean_ctor_get(v_value_32_, 0);
lean_inc(v_value_33_);
lean_dec_ref(v_value_32_);
return v_value_33_;
}
}
LEAN_EXPORT lean_object* lb_recursive_checked_record_probe_source_second(lean_object* v_value_34_){
  fputs("LB_SUBTYPE_ENTRY_V1 enter source RecursiveCheckedRecords.second\n", stderr);

_start:
{
lean_object* v_value_35_; 
v_value_35_ = lean_ctor_get(v_value_34_, 0);
lean_inc(v_value_35_);
lean_dec_ref(v_value_34_);
return v_value_35_;
}
}
LEAN_EXPORT lean_object* lb_recursive_checked_record_probe_source_echo(lean_object* v_value_36_){
  fputs("LB_SUBTYPE_ENTRY_V1 enter source RecursiveCheckedRecords.echo\n", stderr);

_start:
{
return v_value_36_;
}
}
LEAN_EXPORT lean_object* lb_recursive_checked_record_probe_source_groups(lean_object* v_values_37_){
  fputs("LB_SUBTYPE_ENTRY_V1 enter source RecursiveCheckedRecords.groups\n", stderr);

_start:
{
lean_object* v___x_38_; 
v___x_38_ = lean_array_get_size(v_values_37_);
lean_dec_ref(v_values_37_);
return v___x_38_;
}
}
LEAN_EXPORT lean_object* lb_recursive_checked_record_probe_source_echoGroups(lean_object* v_values_39_){
  fputs("LB_SUBTYPE_ENTRY_V1 enter source RecursiveCheckedRecords.echoGroups\n", stderr);

_start:
{
return v_values_39_;
}
}
LEAN_EXPORT lean_object* l_RecursiveCheckedRecords_positive(lean_object* v_value_40_){
_start:
{
lean_object* v___x_41_; lean_object* v___x_42_; 
v___x_41_ = lean_unsigned_to_nat(1u);
v___x_42_ = lean_nat_add(v_value_40_, v___x_41_);
return v___x_42_;
}
}
LEAN_EXPORT lean_object* l_RecursiveCheckedRecords_positive___boxed(lean_object* v_value_43_){
_start:
{
lean_object* v_res_44_; 
v_res_44_ = l_RecursiveCheckedRecords_positive(v_value_43_);
lean_dec(v_value_43_);
return v_res_44_;
}
}
LEAN_EXPORT lean_object* lb_recursive_checked_record_probe_source_produce(lean_object* v_value_45_){
  fputs("LB_SUBTYPE_ENTRY_V1 enter source RecursiveCheckedRecords.produce\n", stderr);

_start:
{
lean_object* v___x_46_; lean_object* v___x_47_; lean_object* v___x_48_; lean_object* v___x_49_; lean_object* v___x_50_; lean_object* v___x_51_; lean_object* v___x_52_; lean_object* v___x_53_; lean_object* v___x_54_; 
v___x_46_ = l_RecursiveCheckedRecords_positive(v_value_45_);
v___x_47_ = lean_unsigned_to_nat(1u);
v___x_48_ = lean_nat_add(v_value_45_, v___x_47_);
lean_dec(v_value_45_);
v___x_49_ = l_RecursiveCheckedRecords_positive(v___x_48_);
lean_dec(v___x_48_);
v___x_50_ = lean_unsigned_to_nat(2u);
v___x_51_ = lean_box(0);
v___x_52_ = lean_alloc_ctor(0, 3, 0);
lean_ctor_set(v___x_52_, 0, v___x_49_);
lean_ctor_set(v___x_52_, 1, v___x_50_);
lean_ctor_set(v___x_52_, 2, v___x_51_);
v___x_53_ = lean_alloc_ctor(1, 1, 0);
lean_ctor_set(v___x_53_, 0, v___x_52_);
v___x_54_ = lean_alloc_ctor(0, 3, 0);
lean_ctor_set(v___x_54_, 0, v___x_46_);
lean_ctor_set(v___x_54_, 1, v___x_47_);
lean_ctor_set(v___x_54_, 2, v___x_53_);
return v___x_54_;
}
}
lean_object* initialize_Init(uint8_t builtin);
lean_object* initialize_Init(uint8_t builtin);
static bool _G_initialized = false;
LEAN_EXPORT lean_object* initialize_RecursiveCheckedRecords(uint8_t builtin) {
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
