// Lean compiler output
// Module: CheckedRecordValueIndices
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
lean_object* lean_array_get_size(lean_object*);
uint8_t lean_nat_dec_eq(lean_object*, lean_object*);
lean_object* lean_mk_empty_array_with_capacity(lean_object*);
LEAN_EXPORT lean_object* lb_value_index_result_only_probe_constructor_mkOn(lean_object*);
LEAN_EXPORT lean_object* lb_value_index_result_only_probe_constructor_mkOff(lean_object*);
LEAN_EXPORT lean_object* lb_value_index_result_only_probe_constructor_mkAb(lean_object*);
LEAN_EXPORT lean_object* lb_value_index_result_only_probe_constructor_mkEmptySized(lean_object*);
LEAN_EXPORT lean_object* lb_value_index_result_only_probe_constructor_mkZeroToken(lean_object*);
LEAN_EXPORT lean_object* lb_value_index_result_only_probe_constructor_mkWideToken(lean_object*);
LEAN_EXPORT lean_object* lb_value_index_result_only_probe_constructor_mkEmptyToken(lean_object*);
LEAN_EXPORT lean_object* lb_value_index_result_only_probe_constructor_mkUnicodeToken(lean_object*);
LEAN_EXPORT lean_object* l_CheckedRecordValueIndices_trueBoolIndex(lean_object*);
LEAN_EXPORT lean_object* l_CheckedRecordValueIndices_trueBoolIndex___boxed(lean_object*);
LEAN_EXPORT lean_object* l_CheckedRecordValueIndices_falseBoolIndex(lean_object*);
LEAN_EXPORT lean_object* l_CheckedRecordValueIndices_falseBoolIndex___boxed(lean_object*);
LEAN_EXPORT lean_object* l_CheckedRecordValueIndices_abStringIndex(lean_object*);
LEAN_EXPORT lean_object* l_CheckedRecordValueIndices_abStringIndex___boxed(lean_object*);
LEAN_EXPORT lean_object* l_CheckedRecordValueIndices_emptyStringIndex(lean_object*);
LEAN_EXPORT lean_object* l_CheckedRecordValueIndices_emptyStringIndex___boxed(lean_object*);
LEAN_EXPORT lean_object* l_CheckedRecordValueIndices_unicodeStringIndex(lean_object*);
LEAN_EXPORT lean_object* l_CheckedRecordValueIndices_unicodeStringIndex___boxed(lean_object*);
LEAN_EXPORT lean_object* l_CheckedRecordValueIndices_emptySizedIndex(lean_object*);
LEAN_EXPORT lean_object* l_CheckedRecordValueIndices_emptySizedIndex___boxed(lean_object*);
LEAN_EXPORT lean_object* l_CheckedRecordValueIndices_zeroNatIndex(lean_object*);
LEAN_EXPORT lean_object* l_CheckedRecordValueIndices_zeroNatIndex___boxed(lean_object*);
LEAN_EXPORT lean_object* l_CheckedRecordValueIndices_wideNatIndex(lean_object*);
LEAN_EXPORT lean_object* l_CheckedRecordValueIndices_wideNatIndex___boxed(lean_object*);
LEAN_EXPORT lean_object* lb_value_index_result_only_probe_source_produceTrueBool;
LEAN_EXPORT lean_object* lb_value_index_result_only_probe_source_produceFalseBool;
LEAN_EXPORT lean_object* lb_value_index_result_only_probe_source_produceAb;
LEAN_EXPORT lean_object* lb_value_index_result_only_probe_source_produceEmptyString(lean_object*);
LEAN_EXPORT lean_object* lb_value_index_result_only_probe_source_produceUnicodeString(lean_object*);
static const lean_array_object l_CheckedRecordValueIndices_produceEmptySized___closed__0_value = {.m_header = {.m_rc = 0, .m_cs_sz = sizeof(lean_array_object) + sizeof(void*)*0, .m_other = 0, .m_tag = 246}, .m_size = 0, .m_capacity = 0, .m_data = {}};
static const lean_object* l_CheckedRecordValueIndices_produceEmptySized___closed__0 = (const lean_object*)&l_CheckedRecordValueIndices_produceEmptySized___closed__0_value;
LEAN_EXPORT const lean_object* lb_value_index_result_only_probe_source_produceEmptySized = (const lean_object*)&l_CheckedRecordValueIndices_produceEmptySized___closed__0_value;
LEAN_EXPORT lean_object* lb_value_index_result_only_probe_source_produceZeroNat(lean_object*);
LEAN_EXPORT lean_object* lb_value_index_result_only_probe_source_produceWideNat(lean_object*);
LEAN_EXPORT lean_object* lb_value_index_result_only_probe_constructor_mkOn(lean_object* v_count_1_){
_start:
{
lean_object* v___x_2_; uint8_t v___x_3_; 
v___x_2_ = lean_unsigned_to_nat(0u);
v___x_3_ = lean_nat_dec_eq(v_count_1_, v___x_2_);
if (v___x_3_ == 0)
{
lean_object* v___x_4_; 
lean_dec(v_count_1_);
v___x_4_ = lean_box(0);
return v___x_4_;
}
else
{
lean_object* v___x_5_; 
v___x_5_ = lean_alloc_ctor(1, 1, 0);
lean_ctor_set(v___x_5_, 0, v_count_1_);
return v___x_5_;
}
}
}
LEAN_EXPORT lean_object* lb_value_index_result_only_probe_constructor_mkOff(lean_object* v_count_6_){
_start:
{
lean_object* v___x_7_; uint8_t v___x_8_; 
v___x_7_ = lean_unsigned_to_nat(0u);
v___x_8_ = lean_nat_dec_eq(v_count_6_, v___x_7_);
if (v___x_8_ == 0)
{
lean_object* v___x_9_; 
v___x_9_ = lean_alloc_ctor(1, 1, 0);
lean_ctor_set(v___x_9_, 0, v_count_6_);
return v___x_9_;
}
else
{
lean_object* v___x_10_; 
lean_dec(v_count_6_);
v___x_10_ = lean_box(0);
return v___x_10_;
}
}
}
LEAN_EXPORT lean_object* lb_value_index_result_only_probe_constructor_mkAb(lean_object* v_size_11_){
_start:
{
lean_object* v___x_12_; uint8_t v___x_13_; 
v___x_12_ = lean_unsigned_to_nat(2u);
v___x_13_ = lean_nat_dec_eq(v___x_12_, v_size_11_);
if (v___x_13_ == 0)
{
lean_object* v___x_14_; 
lean_dec(v_size_11_);
v___x_14_ = lean_box(0);
return v___x_14_;
}
else
{
lean_object* v___x_15_; 
v___x_15_ = lean_alloc_ctor(1, 1, 0);
lean_ctor_set(v___x_15_, 0, v_size_11_);
return v___x_15_;
}
}
}
LEAN_EXPORT lean_object* lb_value_index_result_only_probe_constructor_mkEmptySized(lean_object* v_data_16_){
_start:
{
lean_object* v___x_17_; lean_object* v___x_18_; uint8_t v___x_19_; 
v___x_17_ = lean_array_get_size(v_data_16_);
v___x_18_ = lean_unsigned_to_nat(0u);
v___x_19_ = lean_nat_dec_eq(v___x_17_, v___x_18_);
if (v___x_19_ == 0)
{
lean_object* v___x_20_; 
lean_dec_ref(v_data_16_);
v___x_20_ = lean_box(0);
return v___x_20_;
}
else
{
lean_object* v___x_21_; 
v___x_21_ = lean_alloc_ctor(1, 1, 0);
lean_ctor_set(v___x_21_, 0, v_data_16_);
return v___x_21_;
}
}
}
LEAN_EXPORT lean_object* lb_value_index_result_only_probe_constructor_mkZeroToken(lean_object* v_count_22_){
_start:
{
lean_object* v___x_23_; 
v___x_23_ = lean_alloc_ctor(1, 1, 0);
lean_ctor_set(v___x_23_, 0, v_count_22_);
return v___x_23_;
}
}
LEAN_EXPORT lean_object* lb_value_index_result_only_probe_constructor_mkWideToken(lean_object* v_count_24_){
_start:
{
lean_object* v___x_25_; 
v___x_25_ = lean_alloc_ctor(1, 1, 0);
lean_ctor_set(v___x_25_, 0, v_count_24_);
return v___x_25_;
}
}
LEAN_EXPORT lean_object* lb_value_index_result_only_probe_constructor_mkEmptyToken(lean_object* v_count_26_){
_start:
{
lean_object* v___x_27_; 
v___x_27_ = lean_alloc_ctor(1, 1, 0);
lean_ctor_set(v___x_27_, 0, v_count_26_);
return v___x_27_;
}
}
LEAN_EXPORT lean_object* lb_value_index_result_only_probe_constructor_mkUnicodeToken(lean_object* v_count_28_){
_start:
{
lean_object* v___x_29_; 
v___x_29_ = lean_alloc_ctor(1, 1, 0);
lean_ctor_set(v___x_29_, 0, v_count_28_);
return v___x_29_;
}
}
LEAN_EXPORT lean_object* l_CheckedRecordValueIndices_trueBoolIndex(lean_object* v_value_30_){
_start:
{
lean_inc(v_value_30_);
return v_value_30_;
}
}
LEAN_EXPORT lean_object* l_CheckedRecordValueIndices_trueBoolIndex___boxed(lean_object* v_value_31_){
_start:
{
lean_object* v_res_32_; 
v_res_32_ = l_CheckedRecordValueIndices_trueBoolIndex(v_value_31_);
lean_dec(v_value_31_);
return v_res_32_;
}
}
LEAN_EXPORT lean_object* l_CheckedRecordValueIndices_falseBoolIndex(lean_object* v_value_33_){
_start:
{
lean_inc(v_value_33_);
return v_value_33_;
}
}
LEAN_EXPORT lean_object* l_CheckedRecordValueIndices_falseBoolIndex___boxed(lean_object* v_value_34_){
_start:
{
lean_object* v_res_35_; 
v_res_35_ = l_CheckedRecordValueIndices_falseBoolIndex(v_value_34_);
lean_dec(v_value_34_);
return v_res_35_;
}
}
LEAN_EXPORT lean_object* l_CheckedRecordValueIndices_abStringIndex(lean_object* v_value_36_){
_start:
{
lean_inc(v_value_36_);
return v_value_36_;
}
}
LEAN_EXPORT lean_object* l_CheckedRecordValueIndices_abStringIndex___boxed(lean_object* v_value_37_){
_start:
{
lean_object* v_res_38_; 
v_res_38_ = l_CheckedRecordValueIndices_abStringIndex(v_value_37_);
lean_dec(v_value_37_);
return v_res_38_;
}
}
LEAN_EXPORT lean_object* l_CheckedRecordValueIndices_emptyStringIndex(lean_object* v_value_39_){
_start:
{
lean_inc(v_value_39_);
return v_value_39_;
}
}
LEAN_EXPORT lean_object* l_CheckedRecordValueIndices_emptyStringIndex___boxed(lean_object* v_value_40_){
_start:
{
lean_object* v_res_41_; 
v_res_41_ = l_CheckedRecordValueIndices_emptyStringIndex(v_value_40_);
lean_dec(v_value_40_);
return v_res_41_;
}
}
LEAN_EXPORT lean_object* l_CheckedRecordValueIndices_unicodeStringIndex(lean_object* v_value_42_){
_start:
{
lean_inc(v_value_42_);
return v_value_42_;
}
}
LEAN_EXPORT lean_object* l_CheckedRecordValueIndices_unicodeStringIndex___boxed(lean_object* v_value_43_){
_start:
{
lean_object* v_res_44_; 
v_res_44_ = l_CheckedRecordValueIndices_unicodeStringIndex(v_value_43_);
lean_dec(v_value_43_);
return v_res_44_;
}
}
LEAN_EXPORT lean_object* l_CheckedRecordValueIndices_emptySizedIndex(lean_object* v_value_45_){
_start:
{
lean_object* v___x_46_; 
v___x_46_ = lean_array_get_size(v_value_45_);
return v___x_46_;
}
}
LEAN_EXPORT lean_object* l_CheckedRecordValueIndices_emptySizedIndex___boxed(lean_object* v_value_47_){
_start:
{
lean_object* v_res_48_; 
v_res_48_ = l_CheckedRecordValueIndices_emptySizedIndex(v_value_47_);
lean_dec_ref(v_value_47_);
return v_res_48_;
}
}
LEAN_EXPORT lean_object* l_CheckedRecordValueIndices_zeroNatIndex(lean_object* v_value_49_){
_start:
{
lean_inc(v_value_49_);
return v_value_49_;
}
}
LEAN_EXPORT lean_object* l_CheckedRecordValueIndices_zeroNatIndex___boxed(lean_object* v_value_50_){
_start:
{
lean_object* v_res_51_; 
v_res_51_ = l_CheckedRecordValueIndices_zeroNatIndex(v_value_50_);
lean_dec(v_value_50_);
return v_res_51_;
}
}
LEAN_EXPORT lean_object* l_CheckedRecordValueIndices_wideNatIndex(lean_object* v_value_52_){
_start:
{
lean_inc(v_value_52_);
return v_value_52_;
}
}
LEAN_EXPORT lean_object* l_CheckedRecordValueIndices_wideNatIndex___boxed(lean_object* v_value_53_){
_start:
{
lean_object* v_res_54_; 
v_res_54_ = l_CheckedRecordValueIndices_wideNatIndex(v_value_53_);
lean_dec(v_value_53_);
return v_res_54_;
}
}
static lean_object* _init_lb_value_index_result_only_probe_source_produceTrueBool(void){
_start:
{
lean_object* v___x_55_; 
v___x_55_ = lean_unsigned_to_nat(0u);
return v___x_55_;
}
}
static lean_object* _init_lb_value_index_result_only_probe_source_produceFalseBool(void){
_start:
{
lean_object* v___x_56_; 
v___x_56_ = lean_unsigned_to_nat(1u);
return v___x_56_;
}
}
static lean_object* _init_lb_value_index_result_only_probe_source_produceAb(void){
_start:
{
lean_object* v___x_57_; 
v___x_57_ = lean_unsigned_to_nat(2u);
return v___x_57_;
}
}
LEAN_EXPORT lean_object* lb_value_index_result_only_probe_source_produceEmptyString(lean_object* v_count_58_){
_start:
{
return v_count_58_;
}
}
LEAN_EXPORT lean_object* lb_value_index_result_only_probe_source_produceUnicodeString(lean_object* v_count_59_){
_start:
{
return v_count_59_;
}
}
LEAN_EXPORT lean_object* lb_value_index_result_only_probe_source_produceZeroNat(lean_object* v_count_63_){
_start:
{
return v_count_63_;
}
}
LEAN_EXPORT lean_object* lb_value_index_result_only_probe_source_produceWideNat(lean_object* v_count_64_){
_start:
{
return v_count_64_;
}
}
lean_object* initialize_Init(uint8_t builtin);
lean_object* initialize_Init(uint8_t builtin);
static bool _G_initialized = false;
LEAN_EXPORT lean_object* initialize_CheckedRecordValueIndices(uint8_t builtin) {
lean_object * res;
if (_G_initialized) return lean_io_result_mk_ok(lean_box(0));
_G_initialized = true;
res = initialize_Init(builtin);
if (lean_io_result_is_error(res)) return res;
lean_dec_ref(res);
res = initialize_Init(builtin);
if (lean_io_result_is_error(res)) return res;
lean_dec_ref(res);
lb_value_index_result_only_probe_source_produceTrueBool = _init_lb_value_index_result_only_probe_source_produceTrueBool();
lean_mark_persistent(lb_value_index_result_only_probe_source_produceTrueBool);
lb_value_index_result_only_probe_source_produceFalseBool = _init_lb_value_index_result_only_probe_source_produceFalseBool();
lean_mark_persistent(lb_value_index_result_only_probe_source_produceFalseBool);
lb_value_index_result_only_probe_source_produceAb = _init_lb_value_index_result_only_probe_source_produceAb();
lean_mark_persistent(lb_value_index_result_only_probe_source_produceAb);
return lean_io_result_mk_ok(lean_box(0));
}
#ifdef __cplusplus
}
#endif
