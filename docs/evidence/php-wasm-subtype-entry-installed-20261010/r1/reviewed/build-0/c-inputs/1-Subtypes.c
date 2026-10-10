// Lean compiler output
// Module: Subtypes
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
lean_object* lean_int_neg(lean_object*);
uint8_t lean_int_dec_le(lean_object*, lean_object*);
uint8_t lean_int_dec_lt(lean_object*, lean_object*);
lean_object* lean_nat_mul(lean_object*, lean_object*);
uint8_t lean_byte_array_get(lean_object*, lean_object*);
uint8_t lean_uint8_dec_eq(uint8_t, uint8_t);
lean_object* lean_byte_array_size(lean_object*);
uint8_t lean_nat_dec_lt(lean_object*, lean_object*);
uint8_t lean_nat_dec_eq(lean_object*, lean_object*);
lean_object* lean_nat_sub(lean_object*, lean_object*);
lean_object* lean_nat_mod(lean_object*, lean_object*);
lean_object* lean_string_append(lean_object*, lean_object*);
uint8_t lean_nat_dec_le(lean_object*, lean_object*);
lean_object* lean_nat_add(lean_object*, lean_object*);
lean_object* lean_string_length(lean_object*);
lean_object* lean_int_mul(lean_object*, lean_object*);
lean_object* lean_nat_shiftr(lean_object*, lean_object*);
LEAN_EXPORT lean_object* lb_probe_constructor_checkedWord(lean_object*);
LEAN_EXPORT lean_object* lb_probe_constructor_checkedEven(lean_object*);
static lean_once_cell_t l_Subtypes_checkedSmall___closed__0_once = LEAN_ONCE_CELL_INITIALIZER;
static lean_object* l_Subtypes_checkedSmall___closed__0;
static lean_once_cell_t l_Subtypes_checkedSmall___closed__1_once = LEAN_ONCE_CELL_INITIALIZER;
static lean_object* l_Subtypes_checkedSmall___closed__1;
LEAN_EXPORT lean_object* lb_probe_constructor_checkedSmall(lean_object*);
LEAN_EXPORT lean_object* lb_probe_constructor_checkedPayload(lean_object*);
static const lean_string_object l_Subtypes_shout___closed__0_value = {.m_header = {.m_rc = 0, .m_cs_sz = 0, .m_other = 0, .m_tag = 249}, .m_size = 2, .m_capacity = 2, .m_length = 1, .m_data = "!"};
static const lean_object* l_Subtypes_shout___closed__0 = (const lean_object*)&l_Subtypes_shout___closed__0_value;
LEAN_EXPORT lean_object* lb_probe_source_shout(lean_object*);
LEAN_EXPORT lean_object* lb_probe_source_half(lean_object*);
LEAN_EXPORT lean_object* lb_probe_source_scale(lean_object*, lean_object*);
LEAN_EXPORT uint8_t lb_probe_source_head(lean_object*);
LEAN_EXPORT lean_object* l_Subtypes_head___boxed(lean_object*);
LEAN_EXPORT lean_object* lb_probe_source_pad(lean_object*);
LEAN_EXPORT lean_object* lb_probe_source_join(lean_object*, lean_object*);
static const lean_ctor_object l_Subtypes_checkedBounded___closed__0_value = {.m_header = {.m_rc = 0, .m_cs_sz = sizeof(lean_ctor_object) + sizeof(void*)*1 + 0, .m_other = 1, .m_tag = 1}, .m_objs = {((lean_object*)(((size_t)(100) << 1) | 1))}};
static const lean_object* l_Subtypes_checkedBounded___closed__0 = (const lean_object*)&l_Subtypes_checkedBounded___closed__0_value;
LEAN_EXPORT lean_object* lb_probe_constructor_checkedBounded(lean_object*);
LEAN_EXPORT lean_object* lb_probe_source_clamp(lean_object*);
LEAN_EXPORT lean_object* lb_probe_source_mix(lean_object*, lean_object*);
LEAN_EXPORT lean_object* lb_probe_constructor_checkedByte(uint8_t);
LEAN_EXPORT lean_object* l_Subtypes_checkedByte___boxed(lean_object*);
LEAN_EXPORT uint8_t lb_probe_source_byte(uint8_t);
LEAN_EXPORT lean_object* l_Subtypes_byte___boxed(lean_object*);
LEAN_EXPORT lean_object* l_Subtypes_echo___redArg(lean_object*);
LEAN_EXPORT lean_object* l_Subtypes_echo___redArg___boxed(lean_object*);
LEAN_EXPORT lean_object* lb_probe_source_echo(lean_object*, lean_object*);
LEAN_EXPORT lean_object* lb_probe_constructor_normalizedEven(lean_object*);
LEAN_EXPORT lean_object* l_Subtypes_wrongEven(lean_object*);
LEAN_EXPORT lean_object* l_Subtypes_unsafeEven(lean_object*);
LEAN_EXPORT lean_object* l_Subtypes_partialEven(lean_object*);
LEAN_EXPORT lean_object* l_Subtypes_zeroEven;
LEAN_EXPORT lean_object* lb_probe_source_unrestricted(lean_object*);
LEAN_EXPORT lean_object* lb_probe_constructor_checkedWord(lean_object* v_value_1_){
_start:
{
lean_object* v___x_2_; lean_object* v___x_3_; uint8_t v___x_4_; 
v___x_2_ = lean_unsigned_to_nat(0u);
v___x_3_ = lean_string_length(v_value_1_);
v___x_4_ = lean_nat_dec_lt(v___x_2_, v___x_3_);
if (v___x_4_ == 0)
{
lean_object* v___x_5_; 
lean_dec_ref(v_value_1_);
v___x_5_ = lean_box(0);
return v___x_5_;
}
else
{
lean_object* v___x_6_; 
v___x_6_ = lean_alloc_ctor(1, 1, 0);
lean_ctor_set(v___x_6_, 0, v_value_1_);
return v___x_6_;
}
}
}
LEAN_EXPORT lean_object* lb_probe_constructor_checkedEven(lean_object* v_value_7_){
_start:
{
lean_object* v___x_8_; lean_object* v___x_9_; lean_object* v___x_10_; uint8_t v___x_11_; 
v___x_8_ = lean_unsigned_to_nat(2u);
v___x_9_ = lean_nat_mod(v_value_7_, v___x_8_);
v___x_10_ = lean_unsigned_to_nat(0u);
v___x_11_ = lean_nat_dec_eq(v___x_9_, v___x_10_);
lean_dec(v___x_9_);
if (v___x_11_ == 0)
{
lean_object* v___x_12_; 
lean_dec(v_value_7_);
v___x_12_ = lean_box(0);
return v___x_12_;
}
else
{
lean_object* v___x_13_; 
v___x_13_ = lean_alloc_ctor(1, 1, 0);
lean_ctor_set(v___x_13_, 0, v_value_7_);
return v___x_13_;
}
}
}
static lean_object* _init_l_Subtypes_checkedSmall___closed__0(void){
_start:
{
lean_object* v___x_14_; lean_object* v___x_15_; 
v___x_14_ = lean_unsigned_to_nat(128u);
v___x_15_ = lean_nat_to_int(v___x_14_);
return v___x_15_;
}
}
static lean_object* _init_l_Subtypes_checkedSmall___closed__1(void){
_start:
{
lean_object* v___x_16_; lean_object* v___x_17_; 
v___x_16_ = lean_obj_once(&l_Subtypes_checkedSmall___closed__0, &l_Subtypes_checkedSmall___closed__0_once, _init_l_Subtypes_checkedSmall___closed__0);
v___x_17_ = lean_int_neg(v___x_16_);
return v___x_17_;
}
}
LEAN_EXPORT lean_object* lb_probe_constructor_checkedSmall(lean_object* v_value_18_){
_start:
{
lean_object* v___x_19_; lean_object* v___x_20_; uint8_t v___x_21_; 
v___x_19_ = lean_obj_once(&l_Subtypes_checkedSmall___closed__0, &l_Subtypes_checkedSmall___closed__0_once, _init_l_Subtypes_checkedSmall___closed__0);
v___x_20_ = lean_obj_once(&l_Subtypes_checkedSmall___closed__1, &l_Subtypes_checkedSmall___closed__1_once, _init_l_Subtypes_checkedSmall___closed__1);
v___x_21_ = lean_int_dec_le(v___x_20_, v_value_18_);
if (v___x_21_ == 0)
{
lean_object* v___x_22_; 
lean_dec(v_value_18_);
v___x_22_ = lean_box(0);
return v___x_22_;
}
else
{
uint8_t v___x_23_; 
v___x_23_ = lean_int_dec_lt(v_value_18_, v___x_19_);
if (v___x_23_ == 0)
{
lean_object* v___x_24_; 
lean_dec(v_value_18_);
v___x_24_ = lean_box(0);
return v___x_24_;
}
else
{
lean_object* v___x_25_; 
v___x_25_ = lean_alloc_ctor(1, 1, 0);
lean_ctor_set(v___x_25_, 0, v_value_18_);
return v___x_25_;
}
}
}
}
LEAN_EXPORT lean_object* lb_probe_constructor_checkedPayload(lean_object* v_value_26_){
_start:
{
lean_object* v___x_27_; lean_object* v___x_28_; uint8_t v___x_29_; 
v___x_27_ = lean_unsigned_to_nat(0u);
v___x_28_ = lean_byte_array_size(v_value_26_);
v___x_29_ = lean_nat_dec_lt(v___x_27_, v___x_28_);
if (v___x_29_ == 0)
{
lean_object* v___x_30_; 
lean_dec_ref(v_value_26_);
v___x_30_ = lean_box(0);
return v___x_30_;
}
else
{
lean_object* v___x_31_; 
v___x_31_ = lean_alloc_ctor(1, 1, 0);
lean_ctor_set(v___x_31_, 0, v_value_26_);
return v___x_31_;
}
}
}
LEAN_EXPORT lean_object* lb_probe_source_shout(lean_object* v_word_33_){
_start:
{
lean_object* v___x_34_; lean_object* v___x_35_; 
v___x_34_ = ((lean_object*)(l_Subtypes_shout___closed__0));
v___x_35_ = lean_string_append(v_word_33_, v___x_34_);
return v___x_35_;
}
}
LEAN_EXPORT lean_object* lb_probe_source_half(lean_object* v_value_36_){
_start:
{
lean_object* v___x_37_; lean_object* v___x_38_; 
v___x_37_ = lean_unsigned_to_nat(1u);
v___x_38_ = lean_nat_shiftr(v_value_36_, v___x_37_);
lean_dec(v_value_36_);
return v___x_38_;
}
}
LEAN_EXPORT lean_object* lb_probe_source_scale(lean_object* v_factor_39_, lean_object* v_value_40_){
_start:
{
lean_object* v___x_41_; 
v___x_41_ = lean_int_mul(v_factor_39_, v_value_40_);
lean_dec(v_value_40_);
lean_dec(v_factor_39_);
return v___x_41_;
}
}
LEAN_EXPORT uint8_t lb_probe_source_head(lean_object* v_payload_42_){
_start:
{
lean_object* v___x_43_; uint8_t v___x_44_; 
v___x_43_ = lean_unsigned_to_nat(0u);
v___x_44_ = lean_byte_array_get(v_payload_42_, v___x_43_);
lean_dec_ref(v_payload_42_);
return v___x_44_;
}
}
LEAN_EXPORT lean_object* l_Subtypes_head___boxed(lean_object* v_payload_45_){
_start:
{
uint8_t v_res_46_; lean_object* v_r_47_; 
v_res_46_ = lb_probe_source_head(v_payload_45_);
v_r_47_ = lean_box(v_res_46_);
return v_r_47_;
}
}
LEAN_EXPORT lean_object* lb_probe_source_pad(lean_object* v_value_48_){
_start:
{
lean_object* v___x_49_; lean_object* v___x_50_; 
v___x_49_ = lean_unsigned_to_nat(2u);
v___x_50_ = lean_nat_mul(v_value_48_, v___x_49_);
lean_dec(v_value_48_);
return v___x_50_;
}
}
LEAN_EXPORT lean_object* lb_probe_source_join(lean_object* v_left_51_, lean_object* v_right_52_){
_start:
{
lean_object* v___x_53_; 
v___x_53_ = lean_string_append(v_left_51_, v_right_52_);
lean_dec_ref(v_right_52_);
return v___x_53_;
}
}
LEAN_EXPORT lean_object* lb_probe_constructor_checkedBounded(lean_object* v_value_56_){
_start:
{
lean_object* v___x_57_; uint8_t v___x_58_; 
v___x_57_ = lean_unsigned_to_nat(100u);
v___x_58_ = lean_nat_dec_le(v_value_56_, v___x_57_);
if (v___x_58_ == 0)
{
lean_object* v___x_59_; 
lean_dec(v_value_56_);
v___x_59_ = ((lean_object*)(l_Subtypes_checkedBounded___closed__0));
return v___x_59_;
}
else
{
lean_object* v___x_60_; 
v___x_60_ = lean_alloc_ctor(1, 1, 0);
lean_ctor_set(v___x_60_, 0, v_value_56_);
return v___x_60_;
}
}
}
LEAN_EXPORT lean_object* lb_probe_source_clamp(lean_object* v_value_61_){
_start:
{
return v_value_61_;
}
}
LEAN_EXPORT lean_object* lb_probe_source_mix(lean_object* v_value_62_, lean_object* v_digit_63_){
_start:
{
lean_object* v___x_64_; 
v___x_64_ = lean_nat_add(v_value_62_, v_digit_63_);
lean_dec(v_digit_63_);
lean_dec(v_value_62_);
return v___x_64_;
}
}
LEAN_EXPORT lean_object* lb_probe_constructor_checkedByte(uint8_t v_value_65_){
_start:
{
uint8_t v___x_66_; uint8_t v___x_67_; 
v___x_66_ = 0;
v___x_67_ = lean_uint8_dec_eq(v_value_65_, v___x_66_);
if (v___x_67_ == 0)
{
lean_object* v___x_68_; lean_object* v___x_69_; 
v___x_68_ = lean_box(v_value_65_);
v___x_69_ = lean_alloc_ctor(1, 1, 0);
lean_ctor_set(v___x_69_, 0, v___x_68_);
return v___x_69_;
}
else
{
lean_object* v___x_70_; 
v___x_70_ = lean_box(0);
return v___x_70_;
}
}
}
LEAN_EXPORT lean_object* l_Subtypes_checkedByte___boxed(lean_object* v_value_71_){
_start:
{
uint8_t v_value_boxed_72_; lean_object* v_res_73_; 
v_value_boxed_72_ = lean_unbox(v_value_71_);
v_res_73_ = lb_probe_constructor_checkedByte(v_value_boxed_72_);
return v_res_73_;
}
}
LEAN_EXPORT uint8_t lb_probe_source_byte(uint8_t v_value_74_){
_start:
{
return v_value_74_;
}
}
LEAN_EXPORT lean_object* l_Subtypes_byte___boxed(lean_object* v_value_75_){
_start:
{
uint8_t v_value_boxed_76_; uint8_t v_res_77_; lean_object* v_r_78_; 
v_value_boxed_76_ = lean_unbox(v_value_75_);
v_res_77_ = lb_probe_source_byte(v_value_boxed_76_);
v_r_78_ = lean_box(v_res_77_);
return v_r_78_;
}
}
LEAN_EXPORT lean_object* l_Subtypes_echo___redArg(lean_object* v_value_79_){
_start:
{
lean_inc(v_value_79_);
return v_value_79_;
}
}
LEAN_EXPORT lean_object* l_Subtypes_echo___redArg___boxed(lean_object* v_value_80_){
_start:
{
lean_object* v_res_81_; 
v_res_81_ = l_Subtypes_echo___redArg(v_value_80_);
lean_dec(v_value_80_);
return v_res_81_;
}
}
LEAN_EXPORT lean_object* lb_probe_source_echo(lean_object* v_00_u03b1_82_, lean_object* v_value_83_){
_start:
{
lean_object* v___x_84_; 
v___x_84_ = l_Subtypes_echo___redArg(v_value_83_);
lean_dec(v_value_83_);
return v___x_84_;
}
}
LEAN_EXPORT lean_object* lb_probe_constructor_normalizedEven(lean_object* v_value_85_){
_start:
{
lean_object* v___x_86_; lean_object* v___x_87_; lean_object* v___x_88_; 
v___x_86_ = lean_unsigned_to_nat(2u);
v___x_87_ = lean_nat_mul(v_value_85_, v___x_86_);
lean_dec(v_value_85_);
v___x_88_ = lean_alloc_ctor(1, 1, 0);
lean_ctor_set(v___x_88_, 0, v___x_87_);
return v___x_88_;
}
}
LEAN_EXPORT lean_object* l_Subtypes_wrongEven(lean_object* v_value_89_){
_start:
{
lean_object* v___x_90_; 
v___x_90_ = lean_alloc_ctor(1, 1, 0);
lean_ctor_set(v___x_90_, 0, v_value_89_);
return v___x_90_;
}
}
LEAN_EXPORT lean_object* l_Subtypes_unsafeEven(lean_object* v_value_91_){
_start:
{
lean_object* v___x_92_; 
v___x_92_ = lb_probe_constructor_checkedEven(v_value_91_);
return v___x_92_;
}
}
LEAN_EXPORT lean_object* l_Subtypes_partialEven(lean_object* v_value_93_){
_start:
{
lean_object* v___x_94_; uint8_t v___x_95_; 
v___x_94_ = lean_unsigned_to_nat(0u);
v___x_95_ = lean_nat_dec_eq(v_value_93_, v___x_94_);
if (v___x_95_ == 0)
{
lean_object* v___x_96_; lean_object* v___x_97_; 
v___x_96_ = lean_unsigned_to_nat(1u);
v___x_97_ = lean_nat_sub(v_value_93_, v___x_96_);
lean_dec(v_value_93_);
v_value_93_ = v___x_97_;
goto _start;
}
else
{
lean_object* v___x_99_; 
v___x_99_ = lb_probe_constructor_checkedEven(v_value_93_);
return v___x_99_;
}
}
}
static lean_object* _init_l_Subtypes_zeroEven(void){
_start:
{
lean_object* v___x_100_; 
v___x_100_ = lean_unsigned_to_nat(0u);
return v___x_100_;
}
}
LEAN_EXPORT lean_object* lb_probe_source_unrestricted(lean_object* v_value_101_){
_start:
{
return v_value_101_;
}
}
lean_object* initialize_Init(uint8_t builtin);
lean_object* initialize_Init(uint8_t builtin);
static bool _G_initialized = false;
LEAN_EXPORT lean_object* initialize_Subtypes(uint8_t builtin) {
lean_object * res;
if (_G_initialized) return lean_io_result_mk_ok(lean_box(0));
_G_initialized = true;
res = initialize_Init(builtin);
if (lean_io_result_is_error(res)) return res;
lean_dec_ref(res);
res = initialize_Init(builtin);
if (lean_io_result_is_error(res)) return res;
lean_dec_ref(res);
l_Subtypes_zeroEven = _init_l_Subtypes_zeroEven();
lean_mark_persistent(l_Subtypes_zeroEven);
return lean_io_result_mk_ok(lean_box(0));
}
#ifdef __cplusplus
}
#endif
