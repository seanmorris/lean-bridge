#include <stdio.h>
// Lean compiler output
// Module: Owned
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
lean_object* lean_nat_to_int(lean_object*);
uint8_t lean_int_dec_le(lean_object*, lean_object*);
static lean_once_cell_t l_Owned_checkedCount___closed__0_once = LEAN_ONCE_CELL_INITIALIZER;
static lean_object* l_Owned_checkedCount___closed__0;
LEAN_EXPORT lean_object* lb_owned_entry_subtype_constructor_checkedCount(lean_object*);
LEAN_EXPORT lean_object* lb_owned_entry_subtype_constructor_checkedCountAlternate(lean_object*);
LEAN_EXPORT lean_object* lb_owned_entry_subtype_source_newTicket(lean_object*, lean_object*);
LEAN_EXPORT lean_object* l_Owned_serial(lean_object*);
LEAN_EXPORT lean_object* l_Owned_serial___boxed(lean_object*);
LEAN_EXPORT lean_object* lb_owned_entry_subtype_source_echoRecord(lean_object*);
LEAN_EXPORT lean_object* lb_owned_entry_subtype_source_echoRecordAlternate(lean_object*);
LEAN_EXPORT lean_object* lb_owned_entry_subtype_source_transferRecord(lean_object*);
LEAN_EXPORT lean_object* l_Owned_callbackRecord(lean_object*, lean_object*);
static lean_object* _init_l_Owned_checkedCount___closed__0(void){
_start:
{
lean_object* v___x_1_; lean_object* v___x_2_; 
v___x_1_ = lean_unsigned_to_nat(0u);
v___x_2_ = lean_nat_to_int(v___x_1_);
return v___x_2_;
}
}
LEAN_EXPORT lean_object* lb_owned_entry_subtype_constructor_checkedCount(lean_object* v_value_3_){
  fputs("LB_SUBTYPE_ENTRY_V1 enter constructor Owned.checkedCount\n", stderr);

_start:
{
lean_object* v___x_4_; uint8_t v___x_5_; 
v___x_4_ = lean_obj_once(&l_Owned_checkedCount___closed__0, &l_Owned_checkedCount___closed__0_once, _init_l_Owned_checkedCount___closed__0);
v___x_5_ = lean_int_dec_le(v___x_4_, v_value_3_);
if (v___x_5_ == 0)
{
lean_object* v___x_6_; 
lean_dec(v_value_3_);
v___x_6_ = lean_box(0);
return v___x_6_;
}
else
{
lean_object* v___x_7_; 
v___x_7_ = lean_alloc_ctor(1, 1, 0);
lean_ctor_set(v___x_7_, 0, v_value_3_);
return v___x_7_;
}
}
}
LEAN_EXPORT lean_object* lb_owned_entry_subtype_constructor_checkedCountAlternate(lean_object* v_value_8_){
  fputs("LB_SUBTYPE_ENTRY_V1 enter constructor Owned.checkedCountAlternate\n", stderr);

_start:
{
lean_object* v___x_9_; 
v___x_9_ = lb_owned_entry_subtype_constructor_checkedCount(v_value_8_);
return v___x_9_;
}
}
LEAN_EXPORT lean_object* lb_owned_entry_subtype_source_newTicket(lean_object* v_serial_10_, lean_object* v_label_11_){
  fputs("LB_SUBTYPE_ENTRY_V1 enter source Owned.newTicket\n", stderr);

_start:
{
lean_object* v___x_12_; 
v___x_12_ = lean_alloc_ctor(0, 2, 0);
lean_ctor_set(v___x_12_, 0, v_serial_10_);
lean_ctor_set(v___x_12_, 1, v_label_11_);
return v___x_12_;
}
}
LEAN_EXPORT lean_object* l_Owned_serial(lean_object* v_ticket_13_){
_start:
{
lean_object* v_serial_14_; 
v_serial_14_ = lean_ctor_get(v_ticket_13_, 0);
lean_inc(v_serial_14_);
return v_serial_14_;
}
}
LEAN_EXPORT lean_object* l_Owned_serial___boxed(lean_object* v_ticket_15_){
_start:
{
lean_object* v_res_16_; 
v_res_16_ = l_Owned_serial(v_ticket_15_);
lean_dec_ref(v_ticket_15_);
return v_res_16_;
}
}
LEAN_EXPORT lean_object* lb_owned_entry_subtype_source_echoRecord(lean_object* v_value_17_){
  fputs("LB_SUBTYPE_ENTRY_V1 enter source Owned.echoRecord\n", stderr);

_start:
{
return v_value_17_;
}
}
LEAN_EXPORT lean_object* lb_owned_entry_subtype_source_echoRecordAlternate(lean_object* v_value_18_){
  fputs("LB_SUBTYPE_ENTRY_V1 enter source Owned.echoRecordAlternate\n", stderr);

_start:
{
return v_value_18_;
}
}
LEAN_EXPORT lean_object* lb_owned_entry_subtype_source_transferRecord(lean_object* v_value_19_){
  fputs("LB_SUBTYPE_ENTRY_V1 enter source Owned.transferRecord\n", stderr);

_start:
{
return v_value_19_;
}
}
LEAN_EXPORT lean_object* l_Owned_callbackRecord(lean_object* v_value_20_, lean_object* v_callback_21_){
_start:
{
lean_object* v___x_22_; 
v___x_22_ = lean_apply_1(v_callback_21_, v_value_20_);
return v___x_22_;
}
}
lean_object* initialize_Init(uint8_t builtin);
lean_object* initialize_Init(uint8_t builtin);
static bool _G_initialized = false;
LEAN_EXPORT lean_object* initialize_Owned(uint8_t builtin) {
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
