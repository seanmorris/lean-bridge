#include <stdio.h>
// Lean compiler output
// Module: ReviewedCallbacks
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
lean_object* lean_nat_mod(lean_object*, lean_object*);
lean_object* lean_array_get_size(lean_object*);
uint8_t lean_nat_dec_lt(lean_object*, lean_object*);
uint8_t lean_nat_dec_le(lean_object*, lean_object*);
size_t lean_usize_of_nat(lean_object*);
uint8_t lean_usize_dec_eq(size_t, size_t);
lean_object* lean_array_uget_borrowed(lean_object*, size_t);
lean_object* lean_nat_mul(lean_object*, lean_object*);
size_t lean_usize_add(size_t, size_t);
lean_object* l_List_range(lean_object*);
LEAN_EXPORT lean_object* lb_callback_fin_closure_scaler(lean_object*, lean_object*);
LEAN_EXPORT lean_object* lb_callback_fin_probe_source_scaler(lean_object*, lean_object*);
LEAN_EXPORT lean_object* lb_callback_fin_closure_counter(lean_object*, lean_object*);
LEAN_EXPORT lean_object* lb_callback_fin_probe_source_counter(lean_object*, lean_object*);
LEAN_EXPORT lean_object* l_List_foldl___at___00ReviewedCallbacks_visit_spec__0(lean_object*, lean_object*, lean_object*);
LEAN_EXPORT lean_object* l_List_foldl___at___00ReviewedCallbacks_visit_spec__0___boxed(lean_object*, lean_object*, lean_object*);
static lean_once_cell_t l_ReviewedCallbacks_visit___closed__0_once = LEAN_ONCE_CELL_INITIALIZER;
static lean_object* l_ReviewedCallbacks_visit___closed__0;
LEAN_EXPORT lean_object* lb_callback_fin_probe_source_visit(lean_object*);
LEAN_EXPORT lean_object* l___private_Init_Data_Array_Basic_0__Array_foldlMUnsafe_fold___at___00ReviewedCallbacks_digits_spec__0(lean_object*, size_t, size_t, lean_object*);
LEAN_EXPORT lean_object* l___private_Init_Data_Array_Basic_0__Array_foldlMUnsafe_fold___at___00ReviewedCallbacks_digits_spec__0___boxed(lean_object*, lean_object*, lean_object*, lean_object*);
LEAN_EXPORT lean_object* l_ReviewedCallbacks_digits___redArg(lean_object*);
LEAN_EXPORT lean_object* l_ReviewedCallbacks_digits___redArg___boxed(lean_object*);
LEAN_EXPORT lean_object* l_ReviewedCallbacks_digits(lean_object*, lean_object*);
LEAN_EXPORT lean_object* l_ReviewedCallbacks_digits___boxed(lean_object*, lean_object*);
LEAN_EXPORT lean_object* l_List_foldl___at___00ReviewedCallbacks_tilesProbeBody_spec__0(lean_object*, lean_object*);
LEAN_EXPORT lean_object* l_List_foldl___at___00ReviewedCallbacks_tilesProbeBody_spec__0___boxed(lean_object*, lean_object*);
LEAN_EXPORT lean_object* lb_callback_fin_closure_tiles(lean_object*);
LEAN_EXPORT lean_object* l_ReviewedCallbacks_tiles___redArg(lean_object*);
LEAN_EXPORT lean_object* lb_callback_fin_probe_source_tiles(lean_object*, lean_object*);
LEAN_EXPORT lean_object* lb_callback_fin_closure_tileMaker(lean_object*, lean_object*);
LEAN_EXPORT lean_object* lb_callback_fin_probe_source_tileMaker(lean_object*, lean_object*);
LEAN_EXPORT lean_object* l_ReviewedCallbacks_apply(lean_object*, lean_object*);
LEAN_EXPORT lean_object* lb_callback_fin_probe_source_three(lean_object*, lean_object*);
LEAN_EXPORT lean_object* lb_callback_fin_closure_scaler(lean_object* v_factor_1_, lean_object* v_digit_2_){
  fputs("LB_CALLBACK_ENTRY_V1 enter closure ReviewedCallbacks.scaler:body\n", stderr);

_start:
{
lean_object* v___x_3_; 
v___x_3_ = lean_nat_mul(v_digit_2_, v_factor_1_);
lean_dec(v_factor_1_);
lean_dec(v_digit_2_);
return v___x_3_;
}
}
LEAN_EXPORT lean_object* lb_callback_fin_probe_source_scaler(lean_object* v_factor_4_, lean_object* v_digit_5_){
  fputs("LB_CALLBACK_ENTRY_V1 enter source ReviewedCallbacks.scaler\n", stderr);

_start:
{
lean_object* v___x_6_; 
v___x_6_ = lb_callback_fin_closure_scaler(v_factor_4_, v_digit_5_);
return v___x_6_;
}
}
LEAN_EXPORT lean_object* lb_callback_fin_closure_counter(lean_object* v_start_7_, lean_object* v_step_8_){
  fputs("LB_CALLBACK_ENTRY_V1 enter closure ReviewedCallbacks.counter:body\n", stderr);

_start:
{
lean_object* v___x_9_; lean_object* v___x_10_; lean_object* v___x_11_; 
v___x_9_ = lean_unsigned_to_nat(10u);
v___x_10_ = lean_nat_add(v_start_7_, v_step_8_);
lean_dec(v_step_8_);
lean_dec(v_start_7_);
v___x_11_ = lean_nat_mod(v___x_10_, v___x_9_);
lean_dec(v___x_10_);
return v___x_11_;
}
}
LEAN_EXPORT lean_object* lb_callback_fin_probe_source_counter(lean_object* v_start_12_, lean_object* v_step_13_){
  fputs("LB_CALLBACK_ENTRY_V1 enter source ReviewedCallbacks.counter\n", stderr);

_start:
{
lean_object* v___x_14_; 
v___x_14_ = lb_callback_fin_closure_counter(v_start_12_, v_step_13_);
return v___x_14_;
}
}
LEAN_EXPORT lean_object* l_List_foldl___at___00ReviewedCallbacks_visit_spec__0(lean_object* v_host_15_, lean_object* v_x_16_, lean_object* v_x_17_){
_start:
{
if (lean_obj_tag(v_x_17_) == 0)
{
lean_dec_ref(v_host_15_);
return v_x_16_;
}
else
{
lean_object* v_head_18_; lean_object* v_tail_19_; lean_object* v___x_20_; lean_object* v___x_21_; lean_object* v___x_22_; lean_object* v___x_23_; 
v_head_18_ = lean_ctor_get(v_x_17_, 0);
v_tail_19_ = lean_ctor_get(v_x_17_, 1);
v___x_20_ = lean_unsigned_to_nat(5u);
v___x_21_ = lean_nat_mod(v_head_18_, v___x_20_);
lean_inc_ref(v_host_15_);
v___x_22_ = lean_apply_1(v_host_15_, v___x_21_);
v___x_23_ = lean_nat_add(v_x_16_, v___x_22_);
lean_dec(v___x_22_);
lean_dec(v_x_16_);
v_x_16_ = v___x_23_;
v_x_17_ = v_tail_19_;
goto _start;
}
}
}
LEAN_EXPORT lean_object* l_List_foldl___at___00ReviewedCallbacks_visit_spec__0___boxed(lean_object* v_host_25_, lean_object* v_x_26_, lean_object* v_x_27_){
_start:
{
lean_object* v_res_28_; 
v_res_28_ = l_List_foldl___at___00ReviewedCallbacks_visit_spec__0(v_host_25_, v_x_26_, v_x_27_);
lean_dec(v_x_27_);
return v_res_28_;
}
}
static lean_object* _init_l_ReviewedCallbacks_visit___closed__0(void){
_start:
{
lean_object* v___x_29_; lean_object* v___x_30_; 
v___x_29_ = lean_unsigned_to_nat(5u);
v___x_30_ = l_List_range(v___x_29_);
return v___x_30_;
}
}
LEAN_EXPORT lean_object* lb_callback_fin_probe_source_visit(lean_object* v_host_31_){
  fputs("LB_CALLBACK_ENTRY_V1 enter source ReviewedCallbacks.visit\n", stderr);

_start:
{
lean_object* v___x_32_; lean_object* v___x_33_; lean_object* v___x_34_; 
v___x_32_ = lean_unsigned_to_nat(0u);
v___x_33_ = lean_obj_once(&l_ReviewedCallbacks_visit___closed__0, &l_ReviewedCallbacks_visit___closed__0_once, _init_l_ReviewedCallbacks_visit___closed__0);
v___x_34_ = l_List_foldl___at___00ReviewedCallbacks_visit_spec__0(v_host_31_, v___x_32_, v___x_33_);
return v___x_34_;
}
}
LEAN_EXPORT lean_object* l___private_Init_Data_Array_Basic_0__Array_foldlMUnsafe_fold___at___00ReviewedCallbacks_digits_spec__0(lean_object* v_as_35_, size_t v_i_36_, size_t v_stop_37_, lean_object* v_b_38_){
_start:
{
uint8_t v___x_39_; 
v___x_39_ = lean_usize_dec_eq(v_i_36_, v_stop_37_);
if (v___x_39_ == 0)
{
lean_object* v___x_40_; lean_object* v___x_41_; lean_object* v___x_42_; lean_object* v___x_43_; size_t v___x_44_; size_t v___x_45_; 
v___x_40_ = lean_array_uget_borrowed(v_as_35_, v_i_36_);
v___x_41_ = lean_unsigned_to_nat(3u);
v___x_42_ = lean_nat_mul(v_b_38_, v___x_41_);
lean_dec(v_b_38_);
v___x_43_ = lean_nat_add(v___x_42_, v___x_40_);
lean_dec(v___x_42_);
v___x_44_ = ((size_t)1ULL);
v___x_45_ = lean_usize_add(v_i_36_, v___x_44_);
v_i_36_ = v___x_45_;
v_b_38_ = v___x_43_;
goto _start;
}
else
{
return v_b_38_;
}
}
}
LEAN_EXPORT lean_object* l___private_Init_Data_Array_Basic_0__Array_foldlMUnsafe_fold___at___00ReviewedCallbacks_digits_spec__0___boxed(lean_object* v_as_47_, lean_object* v_i_48_, lean_object* v_stop_49_, lean_object* v_b_50_){
_start:
{
size_t v_i_boxed_51_; size_t v_stop_boxed_52_; lean_object* v_res_53_; 
v_i_boxed_51_ = lean_unbox_usize(v_i_48_);
lean_dec(v_i_48_);
v_stop_boxed_52_ = lean_unbox_usize(v_stop_49_);
lean_dec(v_stop_49_);
v_res_53_ = l___private_Init_Data_Array_Basic_0__Array_foldlMUnsafe_fold___at___00ReviewedCallbacks_digits_spec__0(v_as_47_, v_i_boxed_51_, v_stop_boxed_52_, v_b_50_);
lean_dec_ref(v_as_47_);
return v_res_53_;
}
}
LEAN_EXPORT lean_object* l_ReviewedCallbacks_digits___redArg(lean_object* v_values_54_){
_start:
{
lean_object* v___x_55_; lean_object* v___x_56_; uint8_t v___x_57_; 
v___x_55_ = lean_unsigned_to_nat(0u);
v___x_56_ = lean_array_get_size(v_values_54_);
v___x_57_ = lean_nat_dec_lt(v___x_55_, v___x_56_);
if (v___x_57_ == 0)
{
return v___x_55_;
}
else
{
uint8_t v___x_58_; 
v___x_58_ = lean_nat_dec_le(v___x_56_, v___x_56_);
if (v___x_58_ == 0)
{
if (v___x_57_ == 0)
{
return v___x_55_;
}
else
{
size_t v___x_59_; size_t v___x_60_; lean_object* v___x_61_; 
v___x_59_ = ((size_t)0ULL);
v___x_60_ = lean_usize_of_nat(v___x_56_);
v___x_61_ = l___private_Init_Data_Array_Basic_0__Array_foldlMUnsafe_fold___at___00ReviewedCallbacks_digits_spec__0(v_values_54_, v___x_59_, v___x_60_, v___x_55_);
return v___x_61_;
}
}
else
{
size_t v___x_62_; size_t v___x_63_; lean_object* v___x_64_; 
v___x_62_ = ((size_t)0ULL);
v___x_63_ = lean_usize_of_nat(v___x_56_);
v___x_64_ = l___private_Init_Data_Array_Basic_0__Array_foldlMUnsafe_fold___at___00ReviewedCallbacks_digits_spec__0(v_values_54_, v___x_62_, v___x_63_, v___x_55_);
return v___x_64_;
}
}
}
}
LEAN_EXPORT lean_object* l_ReviewedCallbacks_digits___redArg___boxed(lean_object* v_values_65_){
_start:
{
lean_object* v_res_66_; 
v_res_66_ = l_ReviewedCallbacks_digits___redArg(v_values_65_);
lean_dec_ref(v_values_65_);
return v_res_66_;
}
}
LEAN_EXPORT lean_object* l_ReviewedCallbacks_digits(lean_object* v_x_67_, lean_object* v_values_68_){
_start:
{
lean_object* v___x_69_; 
v___x_69_ = l_ReviewedCallbacks_digits___redArg(v_values_68_);
return v___x_69_;
}
}
LEAN_EXPORT lean_object* l_ReviewedCallbacks_digits___boxed(lean_object* v_x_70_, lean_object* v_values_71_){
_start:
{
lean_object* v_res_72_; 
v_res_72_ = l_ReviewedCallbacks_digits(v_x_70_, v_values_71_);
lean_dec_ref(v_values_71_);
return v_res_72_;
}
}
LEAN_EXPORT lean_object* l_List_foldl___at___00ReviewedCallbacks_tilesProbeBody_spec__0(lean_object* v_x_73_, lean_object* v_x_74_){
_start:
{
if (lean_obj_tag(v_x_74_) == 0)
{
return v_x_73_;
}
else
{
lean_object* v_head_75_; lean_object* v_tail_76_; lean_object* v_digit_77_; lean_object* v_count_78_; lean_object* v___x_79_; lean_object* v___x_80_; lean_object* v___x_81_; lean_object* v___x_82_; 
v_head_75_ = lean_ctor_get(v_x_74_, 0);
v_tail_76_ = lean_ctor_get(v_x_74_, 1);
v_digit_77_ = lean_ctor_get(v_head_75_, 0);
v_count_78_ = lean_ctor_get(v_head_75_, 1);
v___x_79_ = lean_unsigned_to_nat(100u);
v___x_80_ = lean_nat_mul(v_digit_77_, v___x_79_);
v___x_81_ = lean_nat_add(v_x_73_, v___x_80_);
lean_dec(v___x_80_);
lean_dec(v_x_73_);
v___x_82_ = lean_nat_add(v___x_81_, v_count_78_);
lean_dec(v___x_81_);
v_x_73_ = v___x_82_;
v_x_74_ = v_tail_76_;
goto _start;
}
}
}
LEAN_EXPORT lean_object* l_List_foldl___at___00ReviewedCallbacks_tilesProbeBody_spec__0___boxed(lean_object* v_x_84_, lean_object* v_x_85_){
_start:
{
lean_object* v_res_86_; 
v_res_86_ = l_List_foldl___at___00ReviewedCallbacks_tilesProbeBody_spec__0(v_x_84_, v_x_85_);
lean_dec(v_x_85_);
return v_res_86_;
}
}
LEAN_EXPORT lean_object* lb_callback_fin_closure_tiles(lean_object* v_values_87_){
  fputs("LB_CALLBACK_ENTRY_V1 enter closure ReviewedCallbacks.tiles:body\n", stderr);

_start:
{
lean_object* v___x_88_; lean_object* v___x_89_; 
v___x_88_ = lean_unsigned_to_nat(0u);
v___x_89_ = l_List_foldl___at___00ReviewedCallbacks_tilesProbeBody_spec__0(v___x_88_, v_values_87_);
lean_dec(v_values_87_);
return v___x_89_;
}
}
LEAN_EXPORT lean_object* l_ReviewedCallbacks_tiles___redArg(lean_object* v_values_90_){
_start:
{
lean_object* v___x_91_; 
v___x_91_ = lb_callback_fin_closure_tiles(v_values_90_);
return v___x_91_;
}
}
LEAN_EXPORT lean_object* lb_callback_fin_probe_source_tiles(lean_object* v_x_92_, lean_object* v_values_93_){
  fputs("LB_CALLBACK_ENTRY_V1 enter source ReviewedCallbacks.tiles\n", stderr);

_start:
{
lean_object* v___x_94_; 
v___x_94_ = l_ReviewedCallbacks_tiles___redArg(v_values_93_);
return v___x_94_;
}
}
LEAN_EXPORT lean_object* lb_callback_fin_closure_tileMaker(lean_object* v_start_95_, lean_object* v_n_96_){
  fputs("LB_CALLBACK_ENTRY_V1 enter closure ReviewedCallbacks.tileMaker:body\n", stderr);

_start:
{
lean_object* v___x_97_; lean_object* v___x_98_; lean_object* v___x_99_; lean_object* v___x_100_; 
v___x_97_ = lean_unsigned_to_nat(5u);
v___x_98_ = lean_nat_add(v_start_95_, v_n_96_);
lean_dec(v_start_95_);
v___x_99_ = lean_nat_mod(v___x_98_, v___x_97_);
lean_dec(v___x_98_);
v___x_100_ = lean_alloc_ctor(0, 2, 0);
lean_ctor_set(v___x_100_, 0, v___x_99_);
lean_ctor_set(v___x_100_, 1, v_n_96_);
return v___x_100_;
}
}
LEAN_EXPORT lean_object* lb_callback_fin_probe_source_tileMaker(lean_object* v_start_101_, lean_object* v_n_102_){
  fputs("LB_CALLBACK_ENTRY_V1 enter source ReviewedCallbacks.tileMaker\n", stderr);

_start:
{
lean_object* v___x_103_; 
v___x_103_ = lb_callback_fin_closure_tileMaker(v_start_101_, v_n_102_);
return v___x_103_;
}
}
LEAN_EXPORT lean_object* l_ReviewedCallbacks_apply(lean_object* v_f_104_, lean_object* v_value_105_){
_start:
{
lean_object* v___x_106_; 
v___x_106_ = lean_apply_1(v_f_104_, v_value_105_);
return v___x_106_;
}
}
LEAN_EXPORT lean_object* lb_callback_fin_probe_source_three(lean_object* v_f_107_, lean_object* v_value_108_){
  fputs("LB_CALLBACK_ENTRY_V1 enter source ReviewedCallbacks.three\n", stderr);

_start:
{
lean_object* v___x_109_; 
v___x_109_ = lean_apply_1(v_f_107_, v_value_108_);
return v___x_109_;
}
}
lean_object* initialize_Init(uint8_t builtin);
lean_object* initialize_Init(uint8_t builtin);
static bool _G_initialized = false;
LEAN_EXPORT lean_object* initialize_ReviewedCallbacks(uint8_t builtin) {
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
