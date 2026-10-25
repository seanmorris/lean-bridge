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
LEAN_EXPORT lean_object* lb_value_index_full_probe_constructor_mkOn(lean_object*);
LEAN_EXPORT lean_object* lb_value_index_full_probe_constructor_mkOff(lean_object*);
LEAN_EXPORT lean_object* lb_value_index_full_probe_constructor_mkAb(lean_object*);
LEAN_EXPORT lean_object* lb_value_index_full_probe_constructor_mkEmptySized(lean_object*);
LEAN_EXPORT lean_object* lb_value_index_full_probe_constructor_mkZeroToken(lean_object*);
LEAN_EXPORT lean_object* lb_value_index_full_probe_constructor_mkWideToken(lean_object*);
LEAN_EXPORT lean_object* lb_value_index_full_probe_constructor_mkEmptyToken(lean_object*);
LEAN_EXPORT lean_object* lb_value_index_full_probe_constructor_mkUnicodeToken(lean_object*);
LEAN_EXPORT lean_object* lb_value_index_full_probe_source_trueBoolIndex(lean_object*);
LEAN_EXPORT lean_object* lb_value_index_full_probe_source_falseBoolIndex(lean_object*);
LEAN_EXPORT lean_object* lb_value_index_full_probe_source_abStringIndex(lean_object*);
LEAN_EXPORT lean_object* lb_value_index_full_probe_source_emptyStringIndex(lean_object*);
LEAN_EXPORT lean_object* lb_value_index_full_probe_source_unicodeStringIndex(lean_object*);
LEAN_EXPORT lean_object* lb_value_index_full_probe_source_emptySizedIndex(lean_object*);
LEAN_EXPORT lean_object* lb_value_index_full_probe_source_zeroNatIndex(lean_object*);
LEAN_EXPORT lean_object* lb_value_index_full_probe_source_wideNatIndex(lean_object*);
LEAN_EXPORT lean_object* lb_value_index_full_probe_source_produceTrueBool;
LEAN_EXPORT lean_object* lb_value_index_full_probe_source_produceFalseBool;
LEAN_EXPORT lean_object* lb_value_index_full_probe_source_produceAb;
LEAN_EXPORT lean_object* lb_value_index_full_probe_source_produceEmptyString(lean_object*);
LEAN_EXPORT lean_object* lb_value_index_full_probe_source_produceUnicodeString(lean_object*);
static const lean_array_object l_CheckedRecordValueIndices_produceEmptySized___closed__0_value = {.m_header = {.m_rc = 0, .m_cs_sz = sizeof(lean_array_object) + sizeof(void*)*0, .m_other = 0, .m_tag = 246}, .m_size = 0, .m_capacity = 0, .m_data = {}};
static const lean_object* l_CheckedRecordValueIndices_produceEmptySized___closed__0 = (const lean_object*)&l_CheckedRecordValueIndices_produceEmptySized___closed__0_value;
LEAN_EXPORT const lean_object* lb_value_index_full_probe_source_produceEmptySized = (const lean_object*)&l_CheckedRecordValueIndices_produceEmptySized___closed__0_value;
LEAN_EXPORT lean_object* lb_value_index_full_probe_source_produceZeroNat(lean_object*);
LEAN_EXPORT lean_object* lb_value_index_full_probe_source_produceWideNat(lean_object*);
LEAN_EXPORT lean_object* lb_value_index_full_probe_constructor_mkOn(lean_object* v_count_1_){
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
LEAN_EXPORT lean_object* lb_value_index_full_probe_constructor_mkOff(lean_object* v_count_6_){
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
LEAN_EXPORT lean_object* lb_value_index_full_probe_constructor_mkAb(lean_object* v_size_11_){
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
LEAN_EXPORT lean_object* lb_value_index_full_probe_constructor_mkEmptySized(lean_object* v_data_16_){
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
LEAN_EXPORT lean_object* lb_value_index_full_probe_constructor_mkZeroToken(lean_object* v_count_22_){
_start:
{
lean_object* v___x_23_; 
v___x_23_ = lean_alloc_ctor(1, 1, 0);
lean_ctor_set(v___x_23_, 0, v_count_22_);
return v___x_23_;
}
}
LEAN_EXPORT lean_object* lb_value_index_full_probe_constructor_mkWideToken(lean_object* v_count_24_){
_start:
{
lean_object* v___x_25_; 
v___x_25_ = lean_alloc_ctor(1, 1, 0);
lean_ctor_set(v___x_25_, 0, v_count_24_);
return v___x_25_;
}
}
LEAN_EXPORT lean_object* lb_value_index_full_probe_constructor_mkEmptyToken(lean_object* v_count_26_){
_start:
{
lean_object* v___x_27_; 
v___x_27_ = lean_alloc_ctor(1, 1, 0);
lean_ctor_set(v___x_27_, 0, v_count_26_);
return v___x_27_;
}
}
LEAN_EXPORT lean_object* lb_value_index_full_probe_constructor_mkUnicodeToken(lean_object* v_count_28_){
_start:
{
lean_object* v___x_29_; 
v___x_29_ = lean_alloc_ctor(1, 1, 0);
lean_ctor_set(v___x_29_, 0, v_count_28_);
return v___x_29_;
}
}
LEAN_EXPORT lean_object* lb_value_index_full_probe_source_trueBoolIndex(lean_object* v_value_30_){
_start:
{
return v_value_30_;
}
}
LEAN_EXPORT lean_object* lb_value_index_full_probe_source_falseBoolIndex(lean_object* v_value_31_){
_start:
{
return v_value_31_;
}
}
LEAN_EXPORT lean_object* lb_value_index_full_probe_source_abStringIndex(lean_object* v_value_32_){
_start:
{
return v_value_32_;
}
}
LEAN_EXPORT lean_object* lb_value_index_full_probe_source_emptyStringIndex(lean_object* v_value_33_){
_start:
{
return v_value_33_;
}
}
LEAN_EXPORT lean_object* lb_value_index_full_probe_source_unicodeStringIndex(lean_object* v_value_34_){
_start:
{
return v_value_34_;
}
}
LEAN_EXPORT lean_object* lb_value_index_full_probe_source_emptySizedIndex(lean_object* v_value_35_){
_start:
{
lean_object* v___x_36_; 
v___x_36_ = lean_array_get_size(v_value_35_);
lean_dec_ref(v_value_35_);
return v___x_36_;
}
}
LEAN_EXPORT lean_object* lb_value_index_full_probe_source_zeroNatIndex(lean_object* v_value_37_){
_start:
{
return v_value_37_;
}
}
LEAN_EXPORT lean_object* lb_value_index_full_probe_source_wideNatIndex(lean_object* v_value_38_){
_start:
{
return v_value_38_;
}
}
static lean_object* _init_lb_value_index_full_probe_source_produceTrueBool(void){
_start:
{
lean_object* v___x_39_; 
v___x_39_ = lean_unsigned_to_nat(0u);
return v___x_39_;
}
}
static lean_object* _init_lb_value_index_full_probe_source_produceFalseBool(void){
_start:
{
lean_object* v___x_40_; 
v___x_40_ = lean_unsigned_to_nat(1u);
return v___x_40_;
}
}
static lean_object* _init_lb_value_index_full_probe_source_produceAb(void){
_start:
{
lean_object* v___x_41_; 
v___x_41_ = lean_unsigned_to_nat(2u);
return v___x_41_;
}
}
LEAN_EXPORT lean_object* lb_value_index_full_probe_source_produceEmptyString(lean_object* v_count_42_){
_start:
{
return v_count_42_;
}
}
LEAN_EXPORT lean_object* lb_value_index_full_probe_source_produceUnicodeString(lean_object* v_count_43_){
_start:
{
return v_count_43_;
}
}
LEAN_EXPORT lean_object* lb_value_index_full_probe_source_produceZeroNat(lean_object* v_count_47_){
_start:
{
return v_count_47_;
}
}
LEAN_EXPORT lean_object* lb_value_index_full_probe_source_produceWideNat(lean_object* v_count_48_){
_start:
{
return v_count_48_;
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
lb_value_index_full_probe_source_produceTrueBool = _init_lb_value_index_full_probe_source_produceTrueBool();
lean_mark_persistent(lb_value_index_full_probe_source_produceTrueBool);
lb_value_index_full_probe_source_produceFalseBool = _init_lb_value_index_full_probe_source_produceFalseBool();
lean_mark_persistent(lb_value_index_full_probe_source_produceFalseBool);
lb_value_index_full_probe_source_produceAb = _init_lb_value_index_full_probe_source_produceAb();
lean_mark_persistent(lb_value_index_full_probe_source_produceAb);
return lean_io_result_mk_ok(lean_box(0));
}
#ifdef __cplusplus
}
#endif
