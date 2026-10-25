#include <stdio.h>
// Lean compiler output
// Module: OwnedCheckedRecords
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
uint8_t lean_nat_dec_lt(lean_object*, lean_object*);
uint8_t lean_usize_dec_lt(size_t, size_t);
lean_object* lean_array_uget_borrowed(lean_object*, size_t);
size_t lean_usize_add(size_t, size_t);
size_t lean_array_size(lean_object*);
lean_object* lean_nat_sub(lean_object*, lean_object*);
LEAN_EXPORT lean_object* lb_owned_entry_checked_record_constructor_mkWindow(lean_object*, lean_object*);
LEAN_EXPORT lean_object* lb_owned_entry_checked_record_constructor_mkClaim(lean_object*, lean_object*);
LEAN_EXPORT lean_object* lb_owned_entry_checked_record_constructor_checkedPositive(lean_object*);
LEAN_EXPORT lean_object* lb_owned_entry_checked_record_constructor_mkGrant(lean_object*, lean_object*, lean_object*);
LEAN_EXPORT lean_object* lb_owned_entry_checked_record_source_newTicket(lean_object*, lean_object*);
LEAN_EXPORT lean_object* l_OwnedCheckedRecords_serial(lean_object*);
LEAN_EXPORT lean_object* l_OwnedCheckedRecords_serial___boxed(lean_object*);
LEAN_EXPORT lean_object* lb_owned_entry_checked_record_source_echoBooking(lean_object*);
LEAN_EXPORT lean_object* l_OwnedCheckedRecords_bookingSpan(lean_object*);
LEAN_EXPORT lean_object* l_OwnedCheckedRecords_bookingSpan___boxed(lean_object*);
LEAN_EXPORT lean_object* lb_owned_entry_checked_record_source_echoClaim(lean_object*);
LEAN_EXPORT lean_object* l_OwnedCheckedRecords_claimQuota(lean_object*);
LEAN_EXPORT lean_object* l_OwnedCheckedRecords_claimQuota___boxed(lean_object*);
LEAN_EXPORT lean_object* lb_owned_entry_checked_record_source_transferClaim(lean_object*);
LEAN_EXPORT lean_object* lb_owned_entry_checked_record_source_echoGrant(lean_object*);
LEAN_EXPORT lean_object* l_OwnedCheckedRecords_echoClaims(lean_object*);
LEAN_EXPORT lean_object* l_OwnedCheckedRecords_echoClaims___boxed(lean_object*);
static const lean_ctor_object l___private_Init_Data_Array_Basic_0__Array_forIn_x27Unsafe_loop___at___00OwnedCheckedRecords_firstClaim_spec__0___closed__0_value = {.m_header = {.m_rc = 0, .m_cs_sz = sizeof(lean_ctor_object) + sizeof(void*)*2 + 0, .m_other = 2, .m_tag = 0}, .m_objs = {((lean_object*)(((size_t)(0) << 1) | 1)),((lean_object*)(((size_t)(0) << 1) | 1))}};
static const lean_object* l___private_Init_Data_Array_Basic_0__Array_forIn_x27Unsafe_loop___at___00OwnedCheckedRecords_firstClaim_spec__0___closed__0 = (const lean_object*)&l___private_Init_Data_Array_Basic_0__Array_forIn_x27Unsafe_loop___at___00OwnedCheckedRecords_firstClaim_spec__0___closed__0_value;
LEAN_EXPORT lean_object* l___private_Init_Data_Array_Basic_0__Array_forIn_x27Unsafe_loop___at___00OwnedCheckedRecords_firstClaim_spec__0(lean_object*, size_t, size_t, lean_object*);
LEAN_EXPORT lean_object* l___private_Init_Data_Array_Basic_0__Array_forIn_x27Unsafe_loop___at___00OwnedCheckedRecords_firstClaim_spec__0___boxed(lean_object*, lean_object*, lean_object*, lean_object*);
LEAN_EXPORT lean_object* l_OwnedCheckedRecords_firstClaim(lean_object*);
LEAN_EXPORT lean_object* l_OwnedCheckedRecords_firstClaim___boxed(lean_object*);
LEAN_EXPORT lean_object* l_OwnedCheckedRecords_claimFor(lean_object*);
LEAN_EXPORT lean_object* l_OwnedCheckedRecords_pairClaim___redArg(lean_object*);
LEAN_EXPORT lean_object* l_OwnedCheckedRecords_pairClaim___redArg___boxed(lean_object*);
LEAN_EXPORT lean_object* lb_owned_entry_checked_record_source_pairClaim(lean_object*, lean_object*);
LEAN_EXPORT lean_object* l_OwnedCheckedRecords_withClaimCallback(lean_object*, lean_object*);
LEAN_EXPORT lean_object* l_OwnedCheckedRecords_claimClosure(lean_object*);
LEAN_EXPORT lean_object* l_OwnedCheckedRecords_claimClosure___boxed(lean_object*);
LEAN_EXPORT lean_object* lb_owned_entry_checked_record_constructor_mkWindow(lean_object* v_lo_1_, lean_object* v_hi_2_){
  fputs("LB_SUBTYPE_ENTRY_V1 enter constructor OwnedCheckedRecords.mkWindow\n", stderr);

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
LEAN_EXPORT lean_object* lb_owned_entry_checked_record_constructor_mkClaim(lean_object* v_holder_7_, lean_object* v_quota_8_){
  fputs("LB_SUBTYPE_ENTRY_V1 enter constructor OwnedCheckedRecords.mkClaim\n", stderr);

_start:
{
lean_object* v_serial_9_; uint8_t v___x_10_; 
v_serial_9_ = lean_ctor_get(v_holder_7_, 0);
v___x_10_ = lean_nat_dec_le(v_quota_8_, v_serial_9_);
if (v___x_10_ == 0)
{
lean_object* v___x_11_; 
lean_dec(v_quota_8_);
lean_dec_ref(v_holder_7_);
v___x_11_ = lean_box(0);
return v___x_11_;
}
else
{
lean_object* v___x_12_; lean_object* v___x_13_; 
v___x_12_ = lean_alloc_ctor(0, 2, 0);
lean_ctor_set(v___x_12_, 0, v_holder_7_);
lean_ctor_set(v___x_12_, 1, v_quota_8_);
v___x_13_ = lean_alloc_ctor(1, 1, 0);
lean_ctor_set(v___x_13_, 0, v___x_12_);
return v___x_13_;
}
}
}
LEAN_EXPORT lean_object* lb_owned_entry_checked_record_constructor_checkedPositive(lean_object* v_value_14_){
  fputs("LB_SUBTYPE_ENTRY_V1 enter constructor OwnedCheckedRecords.checkedPositive\n", stderr);

_start:
{
lean_object* v___x_15_; uint8_t v___x_16_; 
v___x_15_ = lean_unsigned_to_nat(0u);
v___x_16_ = lean_nat_dec_lt(v___x_15_, v_value_14_);
if (v___x_16_ == 0)
{
lean_object* v___x_17_; 
lean_dec(v_value_14_);
v___x_17_ = lean_box(0);
return v___x_17_;
}
else
{
lean_object* v___x_18_; 
v___x_18_ = lean_alloc_ctor(1, 1, 0);
lean_ctor_set(v___x_18_, 0, v_value_14_);
return v___x_18_;
}
}
}
LEAN_EXPORT lean_object* lb_owned_entry_checked_record_constructor_mkGrant(lean_object* v_holder_19_, lean_object* v_weight_20_, lean_object* v_limit_21_){
  fputs("LB_SUBTYPE_ENTRY_V1 enter constructor OwnedCheckedRecords.mkGrant\n", stderr);

_start:
{
uint8_t v___x_22_; 
v___x_22_ = lean_nat_dec_le(v_weight_20_, v_limit_21_);
if (v___x_22_ == 0)
{
lean_object* v___x_23_; 
lean_dec(v_limit_21_);
lean_dec(v_weight_20_);
lean_dec_ref(v_holder_19_);
v___x_23_ = lean_box(0);
return v___x_23_;
}
else
{
lean_object* v___x_24_; lean_object* v___x_25_; 
v___x_24_ = lean_alloc_ctor(0, 3, 0);
lean_ctor_set(v___x_24_, 0, v_holder_19_);
lean_ctor_set(v___x_24_, 1, v_weight_20_);
lean_ctor_set(v___x_24_, 2, v_limit_21_);
v___x_25_ = lean_alloc_ctor(1, 1, 0);
lean_ctor_set(v___x_25_, 0, v___x_24_);
return v___x_25_;
}
}
}
LEAN_EXPORT lean_object* lb_owned_entry_checked_record_source_newTicket(lean_object* v_serial_26_, lean_object* v_label_27_){
  fputs("LB_SUBTYPE_ENTRY_V1 enter source OwnedCheckedRecords.newTicket\n", stderr);

_start:
{
lean_object* v___x_28_; 
v___x_28_ = lean_alloc_ctor(0, 2, 0);
lean_ctor_set(v___x_28_, 0, v_serial_26_);
lean_ctor_set(v___x_28_, 1, v_label_27_);
return v___x_28_;
}
}
LEAN_EXPORT lean_object* l_OwnedCheckedRecords_serial(lean_object* v_ticket_29_){
_start:
{
lean_object* v_serial_30_; 
v_serial_30_ = lean_ctor_get(v_ticket_29_, 0);
lean_inc(v_serial_30_);
return v_serial_30_;
}
}
LEAN_EXPORT lean_object* l_OwnedCheckedRecords_serial___boxed(lean_object* v_ticket_31_){
_start:
{
lean_object* v_res_32_; 
v_res_32_ = l_OwnedCheckedRecords_serial(v_ticket_31_);
lean_dec_ref(v_ticket_31_);
return v_res_32_;
}
}
LEAN_EXPORT lean_object* lb_owned_entry_checked_record_source_echoBooking(lean_object* v_value_33_){
  fputs("LB_SUBTYPE_ENTRY_V1 enter source OwnedCheckedRecords.echoBooking\n", stderr);

_start:
{
return v_value_33_;
}
}
LEAN_EXPORT lean_object* l_OwnedCheckedRecords_bookingSpan(lean_object* v_value_34_){
_start:
{
lean_object* v_window_35_; lean_object* v_lo_36_; lean_object* v_hi_37_; lean_object* v___x_38_; 
v_window_35_ = lean_ctor_get(v_value_34_, 1);
v_lo_36_ = lean_ctor_get(v_window_35_, 0);
v_hi_37_ = lean_ctor_get(v_window_35_, 1);
v___x_38_ = lean_nat_sub(v_hi_37_, v_lo_36_);
return v___x_38_;
}
}
LEAN_EXPORT lean_object* l_OwnedCheckedRecords_bookingSpan___boxed(lean_object* v_value_39_){
_start:
{
lean_object* v_res_40_; 
v_res_40_ = l_OwnedCheckedRecords_bookingSpan(v_value_39_);
lean_dec_ref(v_value_39_);
return v_res_40_;
}
}
LEAN_EXPORT lean_object* lb_owned_entry_checked_record_source_echoClaim(lean_object* v_value_41_){
  fputs("LB_SUBTYPE_ENTRY_V1 enter source OwnedCheckedRecords.echoClaim\n", stderr);

_start:
{
return v_value_41_;
}
}
LEAN_EXPORT lean_object* l_OwnedCheckedRecords_claimQuota(lean_object* v_value_42_){
_start:
{
lean_object* v_quota_43_; 
v_quota_43_ = lean_ctor_get(v_value_42_, 1);
lean_inc(v_quota_43_);
return v_quota_43_;
}
}
LEAN_EXPORT lean_object* l_OwnedCheckedRecords_claimQuota___boxed(lean_object* v_value_44_){
_start:
{
lean_object* v_res_45_; 
v_res_45_ = l_OwnedCheckedRecords_claimQuota(v_value_44_);
lean_dec_ref(v_value_44_);
return v_res_45_;
}
}
LEAN_EXPORT lean_object* lb_owned_entry_checked_record_source_transferClaim(lean_object* v_value_46_){
  fputs("LB_SUBTYPE_ENTRY_V1 enter source OwnedCheckedRecords.transferClaim\n", stderr);

_start:
{
return v_value_46_;
}
}
LEAN_EXPORT lean_object* lb_owned_entry_checked_record_source_echoGrant(lean_object* v_value_47_){
  fputs("LB_SUBTYPE_ENTRY_V1 enter source OwnedCheckedRecords.echoGrant\n", stderr);

_start:
{
return v_value_47_;
}
}
LEAN_EXPORT lean_object* l_OwnedCheckedRecords_echoClaims(lean_object* v_values_48_){
_start:
{
lean_inc_ref(v_values_48_);
return v_values_48_;
}
}
LEAN_EXPORT lean_object* l_OwnedCheckedRecords_echoClaims___boxed(lean_object* v_values_49_){
_start:
{
lean_object* v_res_50_; 
v_res_50_ = l_OwnedCheckedRecords_echoClaims(v_values_49_);
lean_dec_ref(v_values_49_);
return v_res_50_;
}
}
LEAN_EXPORT lean_object* l___private_Init_Data_Array_Basic_0__Array_forIn_x27Unsafe_loop___at___00OwnedCheckedRecords_firstClaim_spec__0(lean_object* v_as_54_, size_t v_sz_55_, size_t v_i_56_, lean_object* v_b_57_){
_start:
{
uint8_t v___x_58_; 
v___x_58_ = lean_usize_dec_lt(v_i_56_, v_sz_55_);
if (v___x_58_ == 0)
{
lean_inc_ref(v_b_57_);
return v_b_57_;
}
else
{
lean_object* v___x_59_; lean_object* v_a_60_; 
v___x_59_ = lean_box(0);
v_a_60_ = lean_array_uget_borrowed(v_as_54_, v_i_56_);
if (lean_obj_tag(v_a_60_) == 1)
{
lean_object* v___x_61_; lean_object* v___x_62_; 
lean_inc_ref(v_a_60_);
v___x_61_ = lean_alloc_ctor(1, 1, 0);
lean_ctor_set(v___x_61_, 0, v_a_60_);
v___x_62_ = lean_alloc_ctor(0, 2, 0);
lean_ctor_set(v___x_62_, 0, v___x_61_);
lean_ctor_set(v___x_62_, 1, v___x_59_);
return v___x_62_;
}
else
{
lean_object* v___x_63_; size_t v___x_64_; size_t v___x_65_; 
v___x_63_ = ((lean_object*)(l___private_Init_Data_Array_Basic_0__Array_forIn_x27Unsafe_loop___at___00OwnedCheckedRecords_firstClaim_spec__0___closed__0));
v___x_64_ = ((size_t)1ULL);
v___x_65_ = lean_usize_add(v_i_56_, v___x_64_);
v_i_56_ = v___x_65_;
v_b_57_ = v___x_63_;
goto _start;
}
}
}
}
LEAN_EXPORT lean_object* l___private_Init_Data_Array_Basic_0__Array_forIn_x27Unsafe_loop___at___00OwnedCheckedRecords_firstClaim_spec__0___boxed(lean_object* v_as_67_, lean_object* v_sz_68_, lean_object* v_i_69_, lean_object* v_b_70_){
_start:
{
size_t v_sz_boxed_71_; size_t v_i_boxed_72_; lean_object* v_res_73_; 
v_sz_boxed_71_ = lean_unbox_usize(v_sz_68_);
lean_dec(v_sz_68_);
v_i_boxed_72_ = lean_unbox_usize(v_i_69_);
lean_dec(v_i_69_);
v_res_73_ = l___private_Init_Data_Array_Basic_0__Array_forIn_x27Unsafe_loop___at___00OwnedCheckedRecords_firstClaim_spec__0(v_as_67_, v_sz_boxed_71_, v_i_boxed_72_, v_b_70_);
lean_dec_ref(v_b_70_);
lean_dec_ref(v_as_67_);
return v_res_73_;
}
}
LEAN_EXPORT lean_object* l_OwnedCheckedRecords_firstClaim(lean_object* v_values_74_){
_start:
{
lean_object* v___x_75_; lean_object* v___x_76_; size_t v_sz_77_; size_t v___x_78_; lean_object* v___x_79_; lean_object* v_fst_80_; 
v___x_75_ = lean_box(0);
v___x_76_ = ((lean_object*)(l___private_Init_Data_Array_Basic_0__Array_forIn_x27Unsafe_loop___at___00OwnedCheckedRecords_firstClaim_spec__0___closed__0));
v_sz_77_ = lean_array_size(v_values_74_);
v___x_78_ = ((size_t)0ULL);
v___x_79_ = l___private_Init_Data_Array_Basic_0__Array_forIn_x27Unsafe_loop___at___00OwnedCheckedRecords_firstClaim_spec__0(v_values_74_, v_sz_77_, v___x_78_, v___x_76_);
v_fst_80_ = lean_ctor_get(v___x_79_, 0);
lean_inc(v_fst_80_);
lean_dec_ref(v___x_79_);
if (lean_obj_tag(v_fst_80_) == 0)
{
return v___x_75_;
}
else
{
lean_object* v_val_81_; 
v_val_81_ = lean_ctor_get(v_fst_80_, 0);
lean_inc(v_val_81_);
lean_dec_ref_known(v_fst_80_, 1);
return v_val_81_;
}
}
}
LEAN_EXPORT lean_object* l_OwnedCheckedRecords_firstClaim___boxed(lean_object* v_values_82_){
_start:
{
lean_object* v_res_83_; 
v_res_83_ = l_OwnedCheckedRecords_firstClaim(v_values_82_);
lean_dec_ref(v_values_82_);
return v_res_83_;
}
}
LEAN_EXPORT lean_object* l_OwnedCheckedRecords_claimFor(lean_object* v_holder_84_){
_start:
{
lean_object* v___x_85_; lean_object* v___x_86_; 
v___x_85_ = lean_unsigned_to_nat(0u);
v___x_86_ = lb_owned_entry_checked_record_constructor_mkClaim(v_holder_84_, v___x_85_);
return v___x_86_;
}
}
LEAN_EXPORT lean_object* l_OwnedCheckedRecords_pairClaim___redArg(lean_object* v_claim_87_){
_start:
{
lean_inc_ref(v_claim_87_);
return v_claim_87_;
}
}
LEAN_EXPORT lean_object* l_OwnedCheckedRecords_pairClaim___redArg___boxed(lean_object* v_claim_88_){
_start:
{
lean_object* v_res_89_; 
v_res_89_ = l_OwnedCheckedRecords_pairClaim___redArg(v_claim_88_);
lean_dec_ref(v_claim_88_);
return v_res_89_;
}
}
LEAN_EXPORT lean_object* lb_owned_entry_checked_record_source_pairClaim(lean_object* v___booking_90_, lean_object* v_claim_91_){
  fputs("LB_SUBTYPE_ENTRY_V1 enter source OwnedCheckedRecords.pairClaim\n", stderr);

_start:
{
lean_object* v___x_92_; 
lean_dec_ref(v___booking_90_);
v___x_92_ = l_OwnedCheckedRecords_pairClaim___redArg(v_claim_91_);
lean_dec_ref(v_claim_91_);
return v___x_92_;
}
}
LEAN_EXPORT lean_object* l_OwnedCheckedRecords_withClaimCallback(lean_object* v_claim_93_, lean_object* v_callback_94_){
_start:
{
lean_object* v___x_95_; 
v___x_95_ = lean_apply_1(v_callback_94_, v_claim_93_);
return v___x_95_;
}
}
LEAN_EXPORT lean_object* l_OwnedCheckedRecords_claimClosure(lean_object* v_a_96_){
_start:
{
lean_inc_ref(v_a_96_);
return v_a_96_;
}
}
LEAN_EXPORT lean_object* l_OwnedCheckedRecords_claimClosure___boxed(lean_object* v_a_97_){
_start:
{
lean_object* v_res_98_; 
v_res_98_ = l_OwnedCheckedRecords_claimClosure(v_a_97_);
lean_dec_ref(v_a_97_);
return v_res_98_;
}
}
lean_object* initialize_Init(uint8_t builtin);
lean_object* initialize_Init(uint8_t builtin);
static bool _G_initialized = false;
LEAN_EXPORT lean_object* initialize_OwnedCheckedRecords(uint8_t builtin) {
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
