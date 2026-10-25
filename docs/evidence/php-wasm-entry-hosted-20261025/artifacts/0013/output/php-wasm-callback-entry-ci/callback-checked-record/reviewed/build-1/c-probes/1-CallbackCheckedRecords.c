#include <stdio.h>
// Lean compiler output
// Module: CallbackCheckedRecords
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
uint8_t lean_nat_dec_le(lean_object*, lean_object*);
lean_object* lean_nat_sub(lean_object*, lean_object*);
uint8_t lean_nat_dec_lt(lean_object*, lean_object*);
LEAN_EXPORT lean_object* lb_callback_record_probe_constructor_mkInterval(lean_object*, lean_object*);
LEAN_EXPORT lean_object* lb_callback_record_probe_constructor_checkedPositive(lean_object*);
LEAN_EXPORT lean_object* lb_callback_record_probe_constructor_mkWeighted(lean_object*, lean_object*);
static const lean_ctor_object l_CallbackCheckedRecords_callHost___closed__0_value = {.m_header = {.m_rc = 0, .m_cs_sz = sizeof(lean_ctor_object) + sizeof(void*)*2 + 0, .m_other = 2, .m_tag = 0}, .m_objs = {((lean_object*)(((size_t)(1) << 1) | 1)),((lean_object*)(((size_t)(3) << 1) | 1))}};
static const lean_object* l_CallbackCheckedRecords_callHost___closed__0 = (const lean_object*)&l_CallbackCheckedRecords_callHost___closed__0_value;
LEAN_EXPORT lean_object* lb_callback_record_probe_source_callHost(lean_object*);
LEAN_EXPORT lean_object* lb_callback_record_closure_makeClosure(lean_object*);
LEAN_EXPORT lean_object* l_CallbackCheckedRecords_makeClosure___redArg(lean_object*);
LEAN_EXPORT lean_object* lb_callback_record_probe_source_makeClosure(lean_object*, lean_object*);
LEAN_EXPORT lean_object* lb_callback_record_probe_source_callHostMixed(lean_object*);
LEAN_EXPORT lean_object* l_CallbackCheckedRecords_makeMixedClosureProbeBody___redArg(lean_object*);
LEAN_EXPORT lean_object* l_CallbackCheckedRecords_makeMixedClosureProbeBody___redArg___boxed(lean_object*);
LEAN_EXPORT lean_object* lb_callback_record_closure_makeMixedClosure(lean_object*, lean_object*);
LEAN_EXPORT lean_object* l_CallbackCheckedRecords_makeMixedClosure___redArg(lean_object*);
LEAN_EXPORT lean_object* l_CallbackCheckedRecords_makeMixedClosure___redArg___boxed(lean_object*);
LEAN_EXPORT lean_object* lb_callback_record_probe_source_makeMixedClosure(lean_object*, lean_object*, lean_object*);
LEAN_EXPORT lean_object* l_CallbackCheckedRecords_callHostContainer(lean_object*);
LEAN_EXPORT lean_object* l_CallbackCheckedRecords_makeContainerClosure(lean_object*, lean_object*);
LEAN_EXPORT lean_object* l_CallbackCheckedRecords_makeContainerClosure___boxed(lean_object*, lean_object*);
static const lean_ctor_object l_CallbackCheckedRecords_callHostNested___closed__0_value = {.m_header = {.m_rc = 0, .m_cs_sz = sizeof(lean_ctor_object) + sizeof(void*)*2 + 0, .m_other = 2, .m_tag = 0}, .m_objs = {((lean_object*)(((size_t)(1) << 1) | 1)),((lean_object*)(((size_t)(2) << 1) | 1))}};
static const lean_object* l_CallbackCheckedRecords_callHostNested___closed__0 = (const lean_object*)&l_CallbackCheckedRecords_callHostNested___closed__0_value;
LEAN_EXPORT lean_object* lb_callback_record_probe_source_callHostNested(lean_object*);
LEAN_EXPORT lean_object* lb_callback_record_closure_makeNestedClosure(lean_object*);
LEAN_EXPORT lean_object* l_CallbackCheckedRecords_makeNestedClosure___redArg(lean_object*);
LEAN_EXPORT lean_object* lb_callback_record_probe_source_makeNestedClosure(lean_object*, lean_object*);
LEAN_EXPORT lean_object* lb_callback_record_probe_constructor_mkInterval(lean_object* v_lo_1_, lean_object* v_hi_2_){
  fputs("LB_CALLBACK_ENTRY_V1 enter constructor CallbackCheckedRecords.mkInterval\n", stderr);

_start:
{
uint8_t v___x_3_; 
v___x_3_ = lean_nat_dec_le(v_lo_1_, v_hi_2_);
if (v___x_3_ == 0)
{
lean_object* v___x_4_; 
lean_dec(v_hi_2_);
lean_dec(v_lo_1_);
v___x_4_ = lean_box(0);
return v___x_4_;
}
else
{
lean_object* v___x_5_; lean_object* v___x_6_; 
v___x_5_ = lean_alloc_ctor(0, 2, 0);
lean_ctor_set(v___x_5_, 0, v_lo_1_);
lean_ctor_set(v___x_5_, 1, v_hi_2_);
v___x_6_ = lean_alloc_ctor(1, 1, 0);
lean_ctor_set(v___x_6_, 0, v___x_5_);
return v___x_6_;
}
}
}
LEAN_EXPORT lean_object* lb_callback_record_probe_constructor_checkedPositive(lean_object* v_value_7_){
  fputs("LB_CALLBACK_ENTRY_V1 enter constructor CallbackCheckedRecords.checkedPositive\n", stderr);

_start:
{
lean_object* v___x_8_; uint8_t v___x_9_; 
v___x_8_ = lean_unsigned_to_nat(0u);
v___x_9_ = lean_nat_dec_lt(v___x_8_, v_value_7_);
if (v___x_9_ == 0)
{
lean_object* v___x_10_; 
lean_dec(v_value_7_);
v___x_10_ = lean_box(0);
return v___x_10_;
}
else
{
lean_object* v___x_11_; 
v___x_11_ = lean_alloc_ctor(1, 1, 0);
lean_ctor_set(v___x_11_, 0, v_value_7_);
return v___x_11_;
}
}
}
LEAN_EXPORT lean_object* lb_callback_record_probe_constructor_mkWeighted(lean_object* v_weight_12_, lean_object* v_limit_13_){
  fputs("LB_CALLBACK_ENTRY_V1 enter constructor CallbackCheckedRecords.mkWeighted\n", stderr);

_start:
{
uint8_t v___x_14_; 
v___x_14_ = lean_nat_dec_le(v_weight_12_, v_limit_13_);
if (v___x_14_ == 0)
{
lean_object* v___x_15_; 
lean_dec(v_limit_13_);
lean_dec(v_weight_12_);
v___x_15_ = lean_box(0);
return v___x_15_;
}
else
{
lean_object* v___x_16_; lean_object* v___x_17_; 
v___x_16_ = lean_alloc_ctor(0, 2, 0);
lean_ctor_set(v___x_16_, 0, v_weight_12_);
lean_ctor_set(v___x_16_, 1, v_limit_13_);
v___x_17_ = lean_alloc_ctor(1, 1, 0);
lean_ctor_set(v___x_17_, 0, v___x_16_);
return v___x_17_;
}
}
}
LEAN_EXPORT lean_object* lb_callback_record_probe_source_callHost(lean_object* v_callback_21_){
  fputs("LB_CALLBACK_ENTRY_V1 enter source CallbackCheckedRecords.callHost\n", stderr);

_start:
{
lean_object* v___x_22_; lean_object* v_reply_23_; lean_object* v_lo_24_; lean_object* v_hi_25_; lean_object* v___x_26_; 
v___x_22_ = ((lean_object*)(l_CallbackCheckedRecords_callHost___closed__0));
v_reply_23_ = lean_apply_1(v_callback_21_, v___x_22_);
v_lo_24_ = lean_ctor_get(v_reply_23_, 0);
lean_inc(v_lo_24_);
v_hi_25_ = lean_ctor_get(v_reply_23_, 1);
lean_inc(v_hi_25_);
lean_dec_ref(v_reply_23_);
v___x_26_ = lean_nat_sub(v_hi_25_, v_lo_24_);
lean_dec(v_lo_24_);
lean_dec(v_hi_25_);
return v___x_26_;
}
}
LEAN_EXPORT lean_object* lb_callback_record_closure_makeClosure(lean_object* v_value_27_){
  fputs("LB_CALLBACK_ENTRY_V1 enter closure CallbackCheckedRecords.makeClosure:body\n", stderr);

_start:
{
lean_object* v_lo_28_; lean_object* v_hi_29_; lean_object* v___x_30_; 
v_lo_28_ = lean_ctor_get(v_value_27_, 0);
lean_inc(v_lo_28_);
v_hi_29_ = lean_ctor_get(v_value_27_, 1);
lean_inc(v_hi_29_);
lean_dec_ref(v_value_27_);
v___x_30_ = lean_nat_sub(v_hi_29_, v_lo_28_);
lean_dec(v_lo_28_);
lean_dec(v_hi_29_);
return v___x_30_;
}
}
LEAN_EXPORT lean_object* l_CallbackCheckedRecords_makeClosure___redArg(lean_object* v_value_31_){
_start:
{
lean_object* v___x_32_; 
v___x_32_ = lb_callback_record_closure_makeClosure(v_value_31_);
return v___x_32_;
}
}
LEAN_EXPORT lean_object* lb_callback_record_probe_source_makeClosure(lean_object* v___seed_33_, lean_object* v_value_34_){
  fputs("LB_CALLBACK_ENTRY_V1 enter source CallbackCheckedRecords.makeClosure\n", stderr);

_start:
{
lean_object* v___x_35_; 
lean_dec(v___seed_33_);
v___x_35_ = l_CallbackCheckedRecords_makeClosure___redArg(v_value_34_);
return v___x_35_;
}
}
LEAN_EXPORT lean_object* lb_callback_record_probe_source_callHostMixed(lean_object* v_callback_36_){
  fputs("LB_CALLBACK_ENTRY_V1 enter source CallbackCheckedRecords.callHostMixed\n", stderr);

_start:
{
lean_object* v___x_37_; lean_object* v___x_38_; lean_object* v_reply_39_; lean_object* v_lo_40_; lean_object* v_hi_41_; lean_object* v___x_42_; 
v___x_37_ = lean_unsigned_to_nat(7u);
v___x_38_ = ((lean_object*)(l_CallbackCheckedRecords_callHost___closed__0));
v_reply_39_ = lean_apply_2(v_callback_36_, v___x_37_, v___x_38_);
v_lo_40_ = lean_ctor_get(v_reply_39_, 0);
lean_inc(v_lo_40_);
v_hi_41_ = lean_ctor_get(v_reply_39_, 1);
lean_inc(v_hi_41_);
lean_dec_ref(v_reply_39_);
v___x_42_ = lean_nat_sub(v_hi_41_, v_lo_40_);
lean_dec(v_lo_40_);
lean_dec(v_hi_41_);
return v___x_42_;
}
}
LEAN_EXPORT lean_object* l_CallbackCheckedRecords_makeMixedClosureProbeBody___redArg(lean_object* v_value_43_){
_start:
{
lean_inc_ref(v_value_43_);
return v_value_43_;
}
}
LEAN_EXPORT lean_object* l_CallbackCheckedRecords_makeMixedClosureProbeBody___redArg___boxed(lean_object* v_value_44_){
_start:
{
lean_object* v_res_45_; 
v_res_45_ = l_CallbackCheckedRecords_makeMixedClosureProbeBody___redArg(v_value_44_);
lean_dec_ref(v_value_44_);
return v_res_45_;
}
}
LEAN_EXPORT lean_object* lb_callback_record_closure_makeMixedClosure(lean_object* v___marker_46_, lean_object* v_value_47_){
  fputs("LB_CALLBACK_ENTRY_V1 enter closure CallbackCheckedRecords.makeMixedClosure:body\n", stderr);

_start:
{
lean_object* v___x_48_; 
lean_dec(v___marker_46_);
v___x_48_ = l_CallbackCheckedRecords_makeMixedClosureProbeBody___redArg(v_value_47_);
lean_dec_ref(v_value_47_);
return v___x_48_;
}
}
LEAN_EXPORT lean_object* l_CallbackCheckedRecords_makeMixedClosure___redArg(lean_object* v_value_49_){
_start:
{
lean_object* v___x_50_; 
v___x_50_ = l_CallbackCheckedRecords_makeMixedClosureProbeBody___redArg(v_value_49_);
return v___x_50_;
}
}
LEAN_EXPORT lean_object* l_CallbackCheckedRecords_makeMixedClosure___redArg___boxed(lean_object* v_value_51_){
_start:
{
lean_object* v_res_52_; 
v_res_52_ = l_CallbackCheckedRecords_makeMixedClosure___redArg(v_value_51_);
lean_dec_ref(v_value_51_);
return v_res_52_;
}
}
LEAN_EXPORT lean_object* lb_callback_record_probe_source_makeMixedClosure(lean_object* v___seed_53_, lean_object* v___marker_54_, lean_object* v_value_55_){
  fputs("LB_CALLBACK_ENTRY_V1 enter source CallbackCheckedRecords.makeMixedClosure\n", stderr);

_start:
{
lean_object* v___x_56_; 
lean_dec(v___marker_54_);
lean_dec(v___seed_53_);
v___x_56_ = l_CallbackCheckedRecords_makeMixedClosure___redArg(v_value_55_);
lean_dec_ref(v_value_55_);
return v___x_56_;
}
}
LEAN_EXPORT lean_object* l_CallbackCheckedRecords_callHostContainer(lean_object* v_callback_57_){
_start:
{
lean_object* v___x_58_; lean_object* v___x_59_; 
v___x_58_ = lean_box(0);
v___x_59_ = lean_apply_1(v_callback_57_, v___x_58_);
if (lean_obj_tag(v___x_59_) == 0)
{
lean_object* v___x_60_; 
lean_dec_ref_known(v___x_59_, 1);
v___x_60_ = lean_unsigned_to_nat(1u);
return v___x_60_;
}
else
{
lean_object* v_a_61_; 
v_a_61_ = lean_ctor_get(v___x_59_, 0);
lean_inc(v_a_61_);
lean_dec_ref_known(v___x_59_, 1);
if (lean_obj_tag(v_a_61_) == 0)
{
lean_object* v___x_62_; 
v___x_62_ = lean_unsigned_to_nat(0u);
return v___x_62_;
}
else
{
lean_object* v_val_63_; lean_object* v_lo_64_; lean_object* v_hi_65_; lean_object* v___x_66_; 
v_val_63_ = lean_ctor_get(v_a_61_, 0);
lean_inc(v_val_63_);
lean_dec_ref_known(v_a_61_, 1);
v_lo_64_ = lean_ctor_get(v_val_63_, 0);
lean_inc(v_lo_64_);
v_hi_65_ = lean_ctor_get(v_val_63_, 1);
lean_inc(v_hi_65_);
lean_dec(v_val_63_);
v___x_66_ = lean_nat_sub(v_hi_65_, v_lo_64_);
lean_dec(v_lo_64_);
lean_dec(v_hi_65_);
return v___x_66_;
}
}
}
}
LEAN_EXPORT lean_object* l_CallbackCheckedRecords_makeContainerClosure(lean_object* v___seed_67_, lean_object* v___values_68_){
_start:
{
lean_object* v___x_69_; 
v___x_69_ = lean_box(0);
return v___x_69_;
}
}
LEAN_EXPORT lean_object* l_CallbackCheckedRecords_makeContainerClosure___boxed(lean_object* v___seed_70_, lean_object* v___values_71_){
_start:
{
lean_object* v_res_72_; 
v_res_72_ = l_CallbackCheckedRecords_makeContainerClosure(v___seed_70_, v___values_71_);
lean_dec_ref(v___values_71_);
lean_dec(v___seed_70_);
return v_res_72_;
}
}
LEAN_EXPORT lean_object* lb_callback_record_probe_source_callHostNested(lean_object* v_callback_76_){
  fputs("LB_CALLBACK_ENTRY_V1 enter source CallbackCheckedRecords.callHostNested\n", stderr);

_start:
{
lean_object* v___x_77_; lean_object* v_reply_78_; lean_object* v_weight_79_; lean_object* v_limit_80_; lean_object* v___x_81_; 
v___x_77_ = ((lean_object*)(l_CallbackCheckedRecords_callHostNested___closed__0));
v_reply_78_ = lean_apply_1(v_callback_76_, v___x_77_);
v_weight_79_ = lean_ctor_get(v_reply_78_, 0);
lean_inc(v_weight_79_);
v_limit_80_ = lean_ctor_get(v_reply_78_, 1);
lean_inc(v_limit_80_);
lean_dec_ref(v_reply_78_);
v___x_81_ = lean_nat_sub(v_limit_80_, v_weight_79_);
lean_dec(v_weight_79_);
lean_dec(v_limit_80_);
return v___x_81_;
}
}
LEAN_EXPORT lean_object* lb_callback_record_closure_makeNestedClosure(lean_object* v_value_82_){
  fputs("LB_CALLBACK_ENTRY_V1 enter closure CallbackCheckedRecords.makeNestedClosure:body\n", stderr);

_start:
{
lean_object* v_weight_83_; lean_object* v_limit_84_; lean_object* v___x_85_; 
v_weight_83_ = lean_ctor_get(v_value_82_, 0);
lean_inc(v_weight_83_);
v_limit_84_ = lean_ctor_get(v_value_82_, 1);
lean_inc(v_limit_84_);
lean_dec_ref(v_value_82_);
v___x_85_ = lean_nat_sub(v_limit_84_, v_weight_83_);
lean_dec(v_weight_83_);
lean_dec(v_limit_84_);
return v___x_85_;
}
}
LEAN_EXPORT lean_object* l_CallbackCheckedRecords_makeNestedClosure___redArg(lean_object* v_value_86_){
_start:
{
lean_object* v___x_87_; 
v___x_87_ = lb_callback_record_closure_makeNestedClosure(v_value_86_);
return v___x_87_;
}
}
LEAN_EXPORT lean_object* lb_callback_record_probe_source_makeNestedClosure(lean_object* v___seed_88_, lean_object* v_value_89_){
  fputs("LB_CALLBACK_ENTRY_V1 enter source CallbackCheckedRecords.makeNestedClosure\n", stderr);

_start:
{
lean_object* v___x_90_; 
lean_dec(v___seed_88_);
v___x_90_ = l_CallbackCheckedRecords_makeNestedClosure___redArg(v_value_89_);
return v___x_90_;
}
}
lean_object* initialize_Init(uint8_t builtin);
lean_object* initialize_Init(uint8_t builtin);
static bool _G_initialized = false;
LEAN_EXPORT lean_object* initialize_CallbackCheckedRecords(uint8_t builtin) {
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
