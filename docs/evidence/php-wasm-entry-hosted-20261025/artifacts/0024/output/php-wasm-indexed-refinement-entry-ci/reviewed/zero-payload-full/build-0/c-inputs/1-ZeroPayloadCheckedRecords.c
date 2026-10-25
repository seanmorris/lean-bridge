// Lean compiler output
// Module: ZeroPayloadCheckedRecords
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
lean_object* l_List_replicateTR___redArg(lean_object*, lean_object*);
lean_object* lean_array_mk(lean_object*);
LEAN_EXPORT lean_object* l_ZeroPayloadCheckedRecords_Marker_toCtorIdx(lean_object*);
LEAN_EXPORT lean_object* l_ZeroPayloadCheckedRecords_Mark_ctorIdx(lean_object*);
LEAN_EXPORT lean_object* l_ZeroPayloadCheckedRecords_Mark_ctorIdx___boxed(lean_object*);
LEAN_EXPORT lean_object* l_ZeroPayloadCheckedRecords_Mark_ctorElim___redArg(lean_object*, lean_object*);
LEAN_EXPORT lean_object* l_ZeroPayloadCheckedRecords_Mark_ctorElim(lean_object*, lean_object*, lean_object*, lean_object*, lean_object*);
LEAN_EXPORT lean_object* l_ZeroPayloadCheckedRecords_Mark_ctorElim___boxed(lean_object*, lean_object*, lean_object*, lean_object*, lean_object*);
LEAN_EXPORT lean_object* l_ZeroPayloadCheckedRecords_Mark_blank_elim___redArg(lean_object*, lean_object*);
LEAN_EXPORT lean_object* l_ZeroPayloadCheckedRecords_Mark_blank_elim(lean_object*, lean_object*, lean_object*, lean_object*);
LEAN_EXPORT lean_object* l_ZeroPayloadCheckedRecords_Mark_marked_elim___redArg(lean_object*, lean_object*);
LEAN_EXPORT lean_object* l_ZeroPayloadCheckedRecords_Mark_marked_elim(lean_object*, lean_object*, lean_object*, lean_object*);
static const lean_ctor_object l_ZeroPayloadCheckedRecords_mkWitness___closed__0_value = {.m_header = {.m_rc = 0, .m_cs_sz = sizeof(lean_ctor_object) + sizeof(void*)*1 + 0, .m_other = 1, .m_tag = 1}, .m_objs = {((lean_object*)(((size_t)(0) << 1) | 1))}};
static const lean_object* l_ZeroPayloadCheckedRecords_mkWitness___closed__0 = (const lean_object*)&l_ZeroPayloadCheckedRecords_mkWitness___closed__0_value;
LEAN_EXPORT const lean_object* lb_zero_payload_full_probe_constructor_mkWitness = (const lean_object*)&l_ZeroPayloadCheckedRecords_mkWitness___closed__0_value;
LEAN_EXPORT lean_object* lb_zero_payload_full_probe_constructor_mkToken(lean_object*);
LEAN_EXPORT lean_object* lb_zero_payload_full_probe_constructor_mkAbsent;
LEAN_EXPORT lean_object* lb_zero_payload_full_probe_source_witnessCount(lean_object*);
LEAN_EXPORT lean_object* lb_zero_payload_full_probe_source_absentCount(lean_object*);
LEAN_EXPORT lean_object* lb_zero_payload_full_probe_source_tokenTag(lean_object*);
LEAN_EXPORT lean_object* lb_zero_payload_full_probe_source_produceWitness;
LEAN_EXPORT lean_object* lb_zero_payload_full_probe_source_produceToken;
LEAN_EXPORT lean_object* lb_zero_payload_full_probe_source_witnesses(lean_object*);
LEAN_EXPORT lean_object* lb_zero_payload_full_probe_source_maybeWitness(uint8_t);
LEAN_EXPORT lean_object* l_ZeroPayloadCheckedRecords_maybeWitness___boxed(lean_object*);
LEAN_EXPORT lean_object* lb_zero_payload_full_probe_source_markerCount(lean_object*);
LEAN_EXPORT lean_object* lb_zero_payload_full_probe_source_produceMarker;
LEAN_EXPORT lean_object* lb_zero_payload_full_probe_source_markCount(lean_object*);
static const lean_ctor_object l_ZeroPayloadCheckedRecords_produceMark___closed__0_value = {.m_header = {.m_rc = 0, .m_cs_sz = sizeof(lean_ctor_object) + sizeof(void*)*1 + 0, .m_other = 1, .m_tag = 1}, .m_objs = {((lean_object*)(((size_t)(0) << 1) | 1))}};
static const lean_object* l_ZeroPayloadCheckedRecords_produceMark___closed__0 = (const lean_object*)&l_ZeroPayloadCheckedRecords_produceMark___closed__0_value;
LEAN_EXPORT lean_object* lb_zero_payload_full_probe_source_produceMark(uint8_t);
LEAN_EXPORT lean_object* l_ZeroPayloadCheckedRecords_produceMark___boxed(lean_object*);
LEAN_EXPORT lean_object* l_ZeroPayloadCheckedRecords_Marker_toCtorIdx(lean_object* v_x_1_){
_start:
{
lean_object* v___x_2_; 
v___x_2_ = lean_unsigned_to_nat(0u);
return v___x_2_;
}
}
LEAN_EXPORT lean_object* l_ZeroPayloadCheckedRecords_Mark_ctorIdx(lean_object* v_x_3_){
_start:
{
if (lean_obj_tag(v_x_3_) == 0)
{
lean_object* v___x_4_; 
v___x_4_ = lean_unsigned_to_nat(0u);
return v___x_4_;
}
else
{
lean_object* v___x_5_; 
v___x_5_ = lean_unsigned_to_nat(1u);
return v___x_5_;
}
}
}
LEAN_EXPORT lean_object* l_ZeroPayloadCheckedRecords_Mark_ctorIdx___boxed(lean_object* v_x_6_){
_start:
{
lean_object* v_res_7_; 
v_res_7_ = l_ZeroPayloadCheckedRecords_Mark_ctorIdx(v_x_6_);
lean_dec(v_x_6_);
return v_res_7_;
}
}
LEAN_EXPORT lean_object* l_ZeroPayloadCheckedRecords_Mark_ctorElim___redArg(lean_object* v_t_8_, lean_object* v_k_9_){
_start:
{
if (lean_obj_tag(v_t_8_) == 0)
{
return v_k_9_;
}
else
{
lean_object* v_witness_10_; lean_object* v___x_11_; 
v_witness_10_ = lean_ctor_get(v_t_8_, 0);
lean_inc(v_witness_10_);
lean_dec_ref_known(v_t_8_, 1);
v___x_11_ = lean_apply_1(v_k_9_, v_witness_10_);
return v___x_11_;
}
}
}
LEAN_EXPORT lean_object* l_ZeroPayloadCheckedRecords_Mark_ctorElim(lean_object* v_motive_12_, lean_object* v_ctorIdx_13_, lean_object* v_t_14_, lean_object* v_h_15_, lean_object* v_k_16_){
_start:
{
lean_object* v___x_17_; 
v___x_17_ = l_ZeroPayloadCheckedRecords_Mark_ctorElim___redArg(v_t_14_, v_k_16_);
return v___x_17_;
}
}
LEAN_EXPORT lean_object* l_ZeroPayloadCheckedRecords_Mark_ctorElim___boxed(lean_object* v_motive_18_, lean_object* v_ctorIdx_19_, lean_object* v_t_20_, lean_object* v_h_21_, lean_object* v_k_22_){
_start:
{
lean_object* v_res_23_; 
v_res_23_ = l_ZeroPayloadCheckedRecords_Mark_ctorElim(v_motive_18_, v_ctorIdx_19_, v_t_20_, v_h_21_, v_k_22_);
lean_dec(v_ctorIdx_19_);
return v_res_23_;
}
}
LEAN_EXPORT lean_object* l_ZeroPayloadCheckedRecords_Mark_blank_elim___redArg(lean_object* v_t_24_, lean_object* v_blank_25_){
_start:
{
lean_object* v___x_26_; 
v___x_26_ = l_ZeroPayloadCheckedRecords_Mark_ctorElim___redArg(v_t_24_, v_blank_25_);
return v___x_26_;
}
}
LEAN_EXPORT lean_object* l_ZeroPayloadCheckedRecords_Mark_blank_elim(lean_object* v_motive_27_, lean_object* v_t_28_, lean_object* v_h_29_, lean_object* v_blank_30_){
_start:
{
lean_object* v___x_31_; 
v___x_31_ = l_ZeroPayloadCheckedRecords_Mark_ctorElim___redArg(v_t_28_, v_blank_30_);
return v___x_31_;
}
}
LEAN_EXPORT lean_object* l_ZeroPayloadCheckedRecords_Mark_marked_elim___redArg(lean_object* v_t_32_, lean_object* v_marked_33_){
_start:
{
lean_object* v___x_34_; 
v___x_34_ = l_ZeroPayloadCheckedRecords_Mark_ctorElim___redArg(v_t_32_, v_marked_33_);
return v___x_34_;
}
}
LEAN_EXPORT lean_object* l_ZeroPayloadCheckedRecords_Mark_marked_elim(lean_object* v_motive_35_, lean_object* v_t_36_, lean_object* v_h_37_, lean_object* v_marked_38_){
_start:
{
lean_object* v___x_39_; 
v___x_39_ = l_ZeroPayloadCheckedRecords_Mark_ctorElim___redArg(v_t_36_, v_marked_38_);
return v___x_39_;
}
}
LEAN_EXPORT lean_object* lb_zero_payload_full_probe_constructor_mkToken(lean_object* v_tag_43_){
_start:
{
lean_object* v___x_44_; 
v___x_44_ = lean_alloc_ctor(1, 1, 0);
lean_ctor_set(v___x_44_, 0, v_tag_43_);
return v___x_44_;
}
}
static lean_object* _init_lb_zero_payload_full_probe_constructor_mkAbsent(void){
_start:
{
lean_object* v___x_45_; 
v___x_45_ = lean_box(0);
return v___x_45_;
}
}
LEAN_EXPORT lean_object* lb_zero_payload_full_probe_source_witnessCount(lean_object* v_value_46_){
_start:
{
lean_object* v___x_47_; 
v___x_47_ = lean_unsigned_to_nat(1u);
return v___x_47_;
}
}
LEAN_EXPORT lean_object* lb_zero_payload_full_probe_source_absentCount(lean_object* v_value_48_){
_start:
{
lean_object* v___x_49_; 
v___x_49_ = lean_unsigned_to_nat(0u);
return v___x_49_;
}
}
LEAN_EXPORT lean_object* lb_zero_payload_full_probe_source_tokenTag(lean_object* v_value_50_){
_start:
{
return v_value_50_;
}
}
static lean_object* _init_lb_zero_payload_full_probe_source_produceWitness(void){
_start:
{
lean_object* v___x_51_; 
v___x_51_ = lean_box(0);
return v___x_51_;
}
}
static lean_object* _init_lb_zero_payload_full_probe_source_produceToken(void){
_start:
{
lean_object* v___x_52_; 
v___x_52_ = lean_box(0);
return v___x_52_;
}
}
LEAN_EXPORT lean_object* lb_zero_payload_full_probe_source_witnesses(lean_object* v_count_53_){
_start:
{
lean_object* v___x_54_; lean_object* v___x_55_; lean_object* v___x_56_; 
v___x_54_ = lean_box(0);
v___x_55_ = l_List_replicateTR___redArg(v_count_53_, v___x_54_);
v___x_56_ = lean_array_mk(v___x_55_);
return v___x_56_;
}
}
LEAN_EXPORT lean_object* lb_zero_payload_full_probe_source_maybeWitness(uint8_t v_present_57_){
_start:
{
if (v_present_57_ == 0)
{
lean_object* v___x_58_; 
v___x_58_ = lean_box(0);
return v___x_58_;
}
else
{
lean_object* v___x_59_; 
v___x_59_ = ((lean_object*)(l_ZeroPayloadCheckedRecords_mkWitness___closed__0));
return v___x_59_;
}
}
}
LEAN_EXPORT lean_object* l_ZeroPayloadCheckedRecords_maybeWitness___boxed(lean_object* v_present_60_){
_start:
{
uint8_t v_present_boxed_61_; lean_object* v_res_62_; 
v_present_boxed_61_ = lean_unbox(v_present_60_);
v_res_62_ = lb_zero_payload_full_probe_source_maybeWitness(v_present_boxed_61_);
return v_res_62_;
}
}
LEAN_EXPORT lean_object* lb_zero_payload_full_probe_source_markerCount(lean_object* v_value_63_){
_start:
{
lean_object* v___x_64_; 
v___x_64_ = lean_unsigned_to_nat(0u);
return v___x_64_;
}
}
static lean_object* _init_lb_zero_payload_full_probe_source_produceMarker(void){
_start:
{
lean_object* v___x_65_; 
v___x_65_ = lean_box(0);
return v___x_65_;
}
}
LEAN_EXPORT lean_object* lb_zero_payload_full_probe_source_markCount(lean_object* v_value_66_){
_start:
{
if (lean_obj_tag(v_value_66_) == 0)
{
lean_object* v___x_67_; 
v___x_67_ = lean_unsigned_to_nat(0u);
return v___x_67_;
}
else
{
lean_object* v___x_68_; 
lean_dec_ref_known(v_value_66_, 1);
v___x_68_ = lean_unsigned_to_nat(1u);
return v___x_68_;
}
}
}
LEAN_EXPORT lean_object* lb_zero_payload_full_probe_source_produceMark(uint8_t v_active_71_){
_start:
{
if (v_active_71_ == 0)
{
lean_object* v___x_72_; 
v___x_72_ = lean_box(0);
return v___x_72_;
}
else
{
lean_object* v___x_73_; 
v___x_73_ = ((lean_object*)(l_ZeroPayloadCheckedRecords_produceMark___closed__0));
return v___x_73_;
}
}
}
LEAN_EXPORT lean_object* l_ZeroPayloadCheckedRecords_produceMark___boxed(lean_object* v_active_74_){
_start:
{
uint8_t v_active_boxed_75_; lean_object* v_res_76_; 
v_active_boxed_75_ = lean_unbox(v_active_74_);
v_res_76_ = lb_zero_payload_full_probe_source_produceMark(v_active_boxed_75_);
return v_res_76_;
}
}
lean_object* initialize_Init(uint8_t builtin);
lean_object* initialize_Init(uint8_t builtin);
static bool _G_initialized = false;
LEAN_EXPORT lean_object* initialize_ZeroPayloadCheckedRecords(uint8_t builtin) {
lean_object * res;
if (_G_initialized) return lean_io_result_mk_ok(lean_box(0));
_G_initialized = true;
res = initialize_Init(builtin);
if (lean_io_result_is_error(res)) return res;
lean_dec_ref(res);
res = initialize_Init(builtin);
if (lean_io_result_is_error(res)) return res;
lean_dec_ref(res);
lb_zero_payload_full_probe_constructor_mkAbsent = _init_lb_zero_payload_full_probe_constructor_mkAbsent();
lean_mark_persistent(lb_zero_payload_full_probe_constructor_mkAbsent);
lb_zero_payload_full_probe_source_produceWitness = _init_lb_zero_payload_full_probe_source_produceWitness();
lean_mark_persistent(lb_zero_payload_full_probe_source_produceWitness);
lb_zero_payload_full_probe_source_produceToken = _init_lb_zero_payload_full_probe_source_produceToken();
lean_mark_persistent(lb_zero_payload_full_probe_source_produceToken);
lb_zero_payload_full_probe_source_produceMarker = _init_lb_zero_payload_full_probe_source_produceMarker();
lean_mark_persistent(lb_zero_payload_full_probe_source_produceMarker);
return lean_io_result_mk_ok(lean_box(0));
}
#ifdef __cplusplus
}
#endif
