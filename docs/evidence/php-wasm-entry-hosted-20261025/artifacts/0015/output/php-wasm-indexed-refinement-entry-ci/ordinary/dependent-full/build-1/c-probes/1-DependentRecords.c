#include <stdio.h>
// Lean compiler output
// Module: DependentRecords
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
LEAN_EXPORT lean_object* lb_dependent_full_probe_constructor_mkDependent(lean_object*, lean_object*);
LEAN_EXPORT lean_object* lb_dependent_full_probe_source_dependentTotal(lean_object*);
LEAN_EXPORT lean_object* lb_dependent_full_probe_source_dependentRoundtrip(lean_object*);
LEAN_EXPORT lean_object* lb_dependent_full_probe_source_dependentResult(lean_object*);
LEAN_EXPORT lean_object* lb_dependent_full_probe_constructor_mkDependent(lean_object* v_bound_1_, lean_object* v_below_2_){
  fputs("LB_SUBTYPE_ENTRY_V1 enter constructor DependentRecords.mkDependent\n", stderr);

_start:
{
uint8_t v___x_3_; 
v___x_3_ = lean_nat_dec_lt(v_below_2_, v_bound_1_);
if (v___x_3_ == 0)
{
lean_object* v___x_4_; 
lean_dec(v_below_2_);
lean_dec(v_bound_1_);
v___x_4_ = lean_box(0);
return v___x_4_;
}
else
{
lean_object* v___x_5_; lean_object* v___x_6_; 
v___x_5_ = lean_alloc_ctor(0, 2, 0);
lean_ctor_set(v___x_5_, 0, v_bound_1_);
lean_ctor_set(v___x_5_, 1, v_below_2_);
v___x_6_ = lean_alloc_ctor(1, 1, 0);
lean_ctor_set(v___x_6_, 0, v___x_5_);
return v___x_6_;
}
}
}
LEAN_EXPORT lean_object* lb_dependent_full_probe_source_dependentTotal(lean_object* v_value_7_){
  fputs("LB_SUBTYPE_ENTRY_V1 enter source DependentRecords.dependentTotal\n", stderr);

_start:
{
lean_object* v_bound_8_; lean_object* v_below_9_; lean_object* v___x_10_; 
v_bound_8_ = lean_ctor_get(v_value_7_, 0);
lean_inc(v_bound_8_);
v_below_9_ = lean_ctor_get(v_value_7_, 1);
lean_inc(v_below_9_);
lean_dec_ref(v_value_7_);
v___x_10_ = lean_nat_add(v_bound_8_, v_below_9_);
lean_dec(v_below_9_);
lean_dec(v_bound_8_);
return v___x_10_;
}
}
LEAN_EXPORT lean_object* lb_dependent_full_probe_source_dependentRoundtrip(lean_object* v_value_11_){
  fputs("LB_SUBTYPE_ENTRY_V1 enter source DependentRecords.dependentRoundtrip\n", stderr);

_start:
{
return v_value_11_;
}
}
LEAN_EXPORT lean_object* lb_dependent_full_probe_source_dependentResult(lean_object* v_seed_12_){
  fputs("LB_SUBTYPE_ENTRY_V1 enter source DependentRecords.dependentResult\n", stderr);

_start:
{
lean_object* v___x_13_; lean_object* v___x_14_; lean_object* v___x_15_; 
v___x_13_ = lean_unsigned_to_nat(1u);
v___x_14_ = lean_nat_add(v_seed_12_, v___x_13_);
v___x_15_ = lean_alloc_ctor(0, 2, 0);
lean_ctor_set(v___x_15_, 0, v___x_14_);
lean_ctor_set(v___x_15_, 1, v_seed_12_);
return v___x_15_;
}
}
lean_object* initialize_Init(uint8_t builtin);
lean_object* initialize_Init(uint8_t builtin);
static bool _G_initialized = false;
LEAN_EXPORT lean_object* initialize_DependentRecords(uint8_t builtin) {
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
