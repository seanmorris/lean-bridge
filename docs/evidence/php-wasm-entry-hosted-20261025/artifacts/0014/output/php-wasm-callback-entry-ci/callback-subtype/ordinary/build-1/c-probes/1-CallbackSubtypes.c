#include <stdio.h>
// Lean compiler output
// Module: CallbackSubtypes
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
uint8_t lean_nat_dec_lt(lean_object*, lean_object*);
LEAN_EXPORT lean_object* lb_callback_subtype_probe_constructor_checkedPositive(lean_object*);
LEAN_EXPORT lean_object* lb_callback_subtype_probe_source_callHost(lean_object*);
LEAN_EXPORT lean_object* lb_callback_subtype_closure_makeClosure(lean_object*);
LEAN_EXPORT lean_object* l_CallbackSubtypes_makeClosure___redArg(lean_object*);
LEAN_EXPORT lean_object* lb_callback_subtype_probe_source_makeClosure(lean_object*, lean_object*);
LEAN_EXPORT lean_object* lb_callback_subtype_probe_source_callHostMixed(lean_object*);
LEAN_EXPORT lean_object* l_CallbackSubtypes_makeMixedClosureProbeBody___redArg(lean_object*);
LEAN_EXPORT lean_object* l_CallbackSubtypes_makeMixedClosureProbeBody___redArg___boxed(lean_object*);
LEAN_EXPORT lean_object* lb_callback_subtype_closure_makeMixedClosure(lean_object*, lean_object*);
LEAN_EXPORT lean_object* l_CallbackSubtypes_makeMixedClosure___redArg(lean_object*);
LEAN_EXPORT lean_object* l_CallbackSubtypes_makeMixedClosure___redArg___boxed(lean_object*);
LEAN_EXPORT lean_object* lb_callback_subtype_probe_source_makeMixedClosure(lean_object*, lean_object*, lean_object*);
LEAN_EXPORT lean_object* l_CallbackSubtypes_callHostContainer(lean_object*);
LEAN_EXPORT lean_object* l_CallbackSubtypes_makeContainerClosure(lean_object*, lean_object*);
LEAN_EXPORT lean_object* l_CallbackSubtypes_makeContainerClosure___boxed(lean_object*, lean_object*);
LEAN_EXPORT lean_object* lb_callback_subtype_probe_constructor_checkedPositive(lean_object* v_value_1_){
  fputs("LB_CALLBACK_ENTRY_V1 enter constructor CallbackSubtypes.checkedPositive\n", stderr);

_start:
{
lean_object* v___x_2_; uint8_t v___x_3_; 
v___x_2_ = lean_unsigned_to_nat(0u);
v___x_3_ = lean_nat_dec_lt(v___x_2_, v_value_1_);
if (v___x_3_ == 0)
{
lean_object* v___x_4_; 
lean_dec(v_value_1_);
v___x_4_ = lean_box(0);
return v___x_4_;
}
else
{
lean_object* v___x_5_; 
v___x_5_ = lean_alloc_ctor(1, 1, 0);
lean_ctor_set(v___x_5_, 0, v_value_1_);
return v___x_5_;
}
}
}
LEAN_EXPORT lean_object* lb_callback_subtype_probe_source_callHost(lean_object* v_callback_6_){
  fputs("LB_CALLBACK_ENTRY_V1 enter source CallbackSubtypes.callHost\n", stderr);

_start:
{
lean_object* v___x_7_; lean_object* v___x_8_; 
v___x_7_ = lean_unsigned_to_nat(1u);
v___x_8_ = lean_apply_1(v_callback_6_, v___x_7_);
return v___x_8_;
}
}
LEAN_EXPORT lean_object* lb_callback_subtype_closure_makeClosure(lean_object* v_value_9_){
  fputs("LB_CALLBACK_ENTRY_V1 enter closure CallbackSubtypes.makeClosure:body\n", stderr);

_start:
{
return v_value_9_;
}
}
LEAN_EXPORT lean_object* l_CallbackSubtypes_makeClosure___redArg(lean_object* v_value_10_){
_start:
{
lean_object* v___x_11_; 
v___x_11_ = lb_callback_subtype_closure_makeClosure(v_value_10_);
return v___x_11_;
}
}
LEAN_EXPORT lean_object* lb_callback_subtype_probe_source_makeClosure(lean_object* v___seed_12_, lean_object* v_value_13_){
  fputs("LB_CALLBACK_ENTRY_V1 enter source CallbackSubtypes.makeClosure\n", stderr);

_start:
{
lean_object* v___x_14_; 
lean_dec(v___seed_12_);
v___x_14_ = l_CallbackSubtypes_makeClosure___redArg(v_value_13_);
return v___x_14_;
}
}
LEAN_EXPORT lean_object* lb_callback_subtype_probe_source_callHostMixed(lean_object* v_callback_15_){
  fputs("LB_CALLBACK_ENTRY_V1 enter source CallbackSubtypes.callHostMixed\n", stderr);

_start:
{
lean_object* v___x_16_; lean_object* v___x_17_; lean_object* v___x_18_; 
v___x_16_ = lean_unsigned_to_nat(7u);
v___x_17_ = lean_unsigned_to_nat(1u);
v___x_18_ = lean_apply_2(v_callback_15_, v___x_16_, v___x_17_);
return v___x_18_;
}
}
LEAN_EXPORT lean_object* l_CallbackSubtypes_makeMixedClosureProbeBody___redArg(lean_object* v_value_19_){
_start:
{
lean_inc(v_value_19_);
return v_value_19_;
}
}
LEAN_EXPORT lean_object* l_CallbackSubtypes_makeMixedClosureProbeBody___redArg___boxed(lean_object* v_value_20_){
_start:
{
lean_object* v_res_21_; 
v_res_21_ = l_CallbackSubtypes_makeMixedClosureProbeBody___redArg(v_value_20_);
lean_dec(v_value_20_);
return v_res_21_;
}
}
LEAN_EXPORT lean_object* lb_callback_subtype_closure_makeMixedClosure(lean_object* v___marker_22_, lean_object* v_value_23_){
  fputs("LB_CALLBACK_ENTRY_V1 enter closure CallbackSubtypes.makeMixedClosure:body\n", stderr);

_start:
{
lean_object* v___x_24_; 
lean_dec(v___marker_22_);
v___x_24_ = l_CallbackSubtypes_makeMixedClosureProbeBody___redArg(v_value_23_);
lean_dec(v_value_23_);
return v___x_24_;
}
}
LEAN_EXPORT lean_object* l_CallbackSubtypes_makeMixedClosure___redArg(lean_object* v_value_25_){
_start:
{
lean_object* v___x_26_; 
v___x_26_ = l_CallbackSubtypes_makeMixedClosureProbeBody___redArg(v_value_25_);
return v___x_26_;
}
}
LEAN_EXPORT lean_object* l_CallbackSubtypes_makeMixedClosure___redArg___boxed(lean_object* v_value_27_){
_start:
{
lean_object* v_res_28_; 
v_res_28_ = l_CallbackSubtypes_makeMixedClosure___redArg(v_value_27_);
lean_dec(v_value_27_);
return v_res_28_;
}
}
LEAN_EXPORT lean_object* lb_callback_subtype_probe_source_makeMixedClosure(lean_object* v___seed_29_, lean_object* v___marker_30_, lean_object* v_value_31_){
  fputs("LB_CALLBACK_ENTRY_V1 enter source CallbackSubtypes.makeMixedClosure\n", stderr);

_start:
{
lean_object* v___x_32_; 
lean_dec(v___marker_30_);
lean_dec(v___seed_29_);
v___x_32_ = l_CallbackSubtypes_makeMixedClosure___redArg(v_value_31_);
lean_dec(v_value_31_);
return v___x_32_;
}
}
LEAN_EXPORT lean_object* l_CallbackSubtypes_callHostContainer(lean_object* v_callback_33_){
_start:
{
lean_object* v___x_34_; lean_object* v___x_35_; 
v___x_34_ = lean_box(0);
v___x_35_ = lean_apply_1(v_callback_33_, v___x_34_);
return v___x_35_;
}
}
LEAN_EXPORT lean_object* l_CallbackSubtypes_makeContainerClosure(lean_object* v___seed_36_, lean_object* v___values_37_){
_start:
{
lean_object* v___x_38_; 
v___x_38_ = lean_box(0);
return v___x_38_;
}
}
LEAN_EXPORT lean_object* l_CallbackSubtypes_makeContainerClosure___boxed(lean_object* v___seed_39_, lean_object* v___values_40_){
_start:
{
lean_object* v_res_41_; 
v_res_41_ = l_CallbackSubtypes_makeContainerClosure(v___seed_39_, v___values_40_);
lean_dec_ref(v___values_40_);
lean_dec(v___seed_39_);
return v_res_41_;
}
}
lean_object* initialize_Init(uint8_t builtin);
lean_object* initialize_Init(uint8_t builtin);
static bool _G_initialized = false;
LEAN_EXPORT lean_object* initialize_CallbackSubtypes(uint8_t builtin) {
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
