#include <stdio.h>
// Lean compiler output
// Module: LeanBridgeNative9da28bcf49ab7dd6
// Imports: public import Init public meta import Init public import Subtypes
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
lean_object* lb_probe_source_pad(lean_object*);
lean_object* lb_probe_constructor_checkedSmall(lean_object*);
lean_object* lb_probe_source_scale(lean_object*, lean_object*);
lean_object* lb_probe_constructor_checkedWord(lean_object*);
lean_object* l_Int_repr(lean_object*);
lean_object* lb_probe_constructor_normalizedEven(lean_object*);
lean_object* l_Subtypes_echo___redArg(lean_object*);
lean_object* lb_probe_constructor_checkedEven(lean_object*);
lean_object* lb_probe_constructor_checkedByte(uint8_t);
lean_object* lb_probe_constructor_checkedBounded(lean_object*);
lean_object* lean_string_utf8_byte_size(lean_object*);
lean_object* l_String_Slice_toInt_x3f(lean_object*);
extern lean_object* l_Int_instInhabited;
lean_object* lean_panic_fn_borrowed(lean_object*, lean_object*);
lean_object* lb_probe_constructor_checkedPayload(lean_object*);
uint8_t lb_probe_source_head(lean_object*);
lean_object* l_Nat_reprFast(lean_object*);
lean_object* lb_probe_source_unrestricted(lean_object*);
uint8_t lb_probe_source_byte(uint8_t);
lean_object* lb_probe_source_half(lean_object*);
lean_object* lb_probe_source_shout(lean_object*);
lean_object* lb_probe_source_join(lean_object*, lean_object*);
lean_object* lb_probe_source_clamp(lean_object*);
uint8_t lean_nat_dec_lt(lean_object*, lean_object*);
lean_object* lb_probe_source_mix(lean_object*, lean_object*);
LEAN_EXPORT lean_object* lb_6815c3e5d952f60b3136d82d(uint8_t);
LEAN_EXPORT lean_object* l_LeanBridgeNative9da28bcf49ab7dd6_f__lb__6815c3e5d952f60b3136d82d___boxed(lean_object*);
LEAN_EXPORT uint8_t lb_6815c3e5d952f60b3136d82d_refinement_0(uint8_t);
LEAN_EXPORT lean_object* l_LeanBridgeNative9da28bcf49ab7dd6_f__lb__6815c3e5d952f60b3136d82d__refinement__0___boxed(lean_object*);
LEAN_EXPORT lean_object* lb_c91ef75f139613c4dde809e0(lean_object*);
LEAN_EXPORT uint8_t lb_c91ef75f139613c4dde809e0_refinement_0(lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNative9da28bcf49ab7dd6_f__lb__c91ef75f139613c4dde809e0__refinement__0___boxed(lean_object*);
LEAN_EXPORT lean_object* lb_9bb269bf43e5265e28a853e1(lean_object*);
LEAN_EXPORT uint8_t lb_9bb269bf43e5265e28a853e1_refinement_0(lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNative9da28bcf49ab7dd6_f__lb__9bb269bf43e5265e28a853e1__refinement__0___boxed(lean_object*);
LEAN_EXPORT lean_object* lb_91473598b255f6e5c1372d98(lean_object*);
LEAN_EXPORT uint8_t lb_91473598b255f6e5c1372d98_refinement_0(lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNative9da28bcf49ab7dd6_f__lb__91473598b255f6e5c1372d98__refinement__0___boxed(lean_object*);
LEAN_EXPORT lean_object* lb_1886f5b34ac04df8628c9301(lean_object*);
LEAN_EXPORT uint8_t lb_1886f5b34ac04df8628c9301_refinement_0(lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNative9da28bcf49ab7dd6_f__lb__1886f5b34ac04df8628c9301__refinement__0___boxed(lean_object*);
LEAN_EXPORT lean_object* lb_9205887c464685a24bd748da(lean_object*, lean_object*);
LEAN_EXPORT uint8_t lb_9205887c464685a24bd748da_refinement_0(lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNative9da28bcf49ab7dd6_f__lb__9205887c464685a24bd748da__refinement__0___boxed(lean_object*);
LEAN_EXPORT uint8_t lb_9205887c464685a24bd748da_refinement_1(lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNative9da28bcf49ab7dd6_f__lb__9205887c464685a24bd748da__refinement__1___boxed(lean_object*);
LEAN_EXPORT lean_object* lb_208c4c169dd06ab4d3767757(lean_object*, lean_object*);
LEAN_EXPORT uint8_t lb_208c4c169dd06ab4d3767757_refinement_0(lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNative9da28bcf49ab7dd6_f__lb__208c4c169dd06ab4d3767757__refinement__0___boxed(lean_object*);
LEAN_EXPORT lean_object* lb_726954a7fecd6b63c462c2e2(lean_object*);
LEAN_EXPORT lean_object* lb_fa19a195ff9ce74a4b7afc1d(lean_object*, lean_object*);
LEAN_EXPORT uint8_t lb_fa19a195ff9ce74a4b7afc1d_refinement_1(lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNative9da28bcf49ab7dd6_f__lb__fa19a195ff9ce74a4b7afc1d__refinement__1___boxed(lean_object*);
LEAN_EXPORT lean_object* lb_a5a1d2658399cacb73553f8b(lean_object*);
LEAN_EXPORT uint8_t lb_a5a1d2658399cacb73553f8b_refinement_0(lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNative9da28bcf49ab7dd6_f__lb__a5a1d2658399cacb73553f8b__refinement__0___boxed(lean_object*);
LEAN_EXPORT lean_object* lb_80fdcaaaf560c424e720029c(lean_object*);
LEAN_EXPORT uint8_t lb_80fdcaaaf560c424e720029c_refinement_0(lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNative9da28bcf49ab7dd6_f__lb__80fdcaaaf560c424e720029c__refinement__0___boxed(lean_object*);
LEAN_EXPORT lean_object* lb_1fd7234bf1e157d167e32146(lean_object*);
LEAN_EXPORT lean_object* lb_c467ef12fd0e27374fac8f55(lean_object*);
LEAN_EXPORT lean_object* lb_native_nat_text(lean_object*);
LEAN_EXPORT lean_object* lb_native_int_text(lean_object*);
LEAN_EXPORT lean_object* l_panic___at___00LeanBridgeNative9da28bcf49ab7dd6_f__lb__native__int__parse_spec__0(lean_object*);
static const lean_string_object l_LeanBridgeNative9da28bcf49ab7dd6_f__lb__native__int__parse___closed__0_value = {.m_header = {.m_rc = 0, .m_cs_sz = 0, .m_other = 0, .m_tag = 249}, .m_size = 13, .m_capacity = 13, .m_length = 12, .m_data = "Int expected"};
static const lean_object* l_LeanBridgeNative9da28bcf49ab7dd6_f__lb__native__int__parse___closed__0 = (const lean_object*)&l_LeanBridgeNative9da28bcf49ab7dd6_f__lb__native__int__parse___closed__0_value;
LEAN_EXPORT lean_object* lb_native_int_parse(lean_object*);
LEAN_EXPORT lean_object* lb_6815c3e5d952f60b3136d82d(uint8_t v_a0_1_){
  fputs("LB_SUBTYPE_ENTRY_V1 enter adapter Subtypes.byte\n", stderr);

_start:
{
lean_object* v___x_2_; 
v___x_2_ = lb_probe_constructor_checkedByte(v_a0_1_);
if (lean_obj_tag(v___x_2_) == 0)
{
lean_object* v___x_3_; 
v___x_3_ = lean_box(0);
return v___x_3_;
}
else
{
lean_object* v_val_4_; lean_object* v___x_6_; uint8_t v_isShared_7_; uint8_t v_isSharedCheck_14_; 
v_val_4_ = lean_ctor_get(v___x_2_, 0);
v_isSharedCheck_14_ = !lean_is_exclusive(v___x_2_);
if (v_isSharedCheck_14_ == 0)
{
v___x_6_ = v___x_2_;
v_isShared_7_ = v_isSharedCheck_14_;
goto v_resetjp_5_;
}
else
{
lean_inc(v_val_4_);
lean_dec(v___x_2_);
v___x_6_ = lean_box(0);
v_isShared_7_ = v_isSharedCheck_14_;
goto v_resetjp_5_;
}
v_resetjp_5_:
{
uint8_t v___x_8_; uint8_t v___x_9_; lean_object* v___x_10_; lean_object* v___x_12_; 
v___x_8_ = lean_unbox(v_val_4_);
lean_dec(v_val_4_);
v___x_9_ = lb_probe_source_byte(v___x_8_);
v___x_10_ = lean_box(v___x_9_);
if (v_isShared_7_ == 0)
{
lean_ctor_set(v___x_6_, 0, v___x_10_);
v___x_12_ = v___x_6_;
goto v_reusejp_11_;
}
else
{
lean_object* v_reuseFailAlloc_13_; 
v_reuseFailAlloc_13_ = lean_alloc_ctor(1, 1, 0);
lean_ctor_set(v_reuseFailAlloc_13_, 0, v___x_10_);
v___x_12_ = v_reuseFailAlloc_13_;
goto v_reusejp_11_;
}
v_reusejp_11_:
{
return v___x_12_;
}
}
}
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNative9da28bcf49ab7dd6_f__lb__6815c3e5d952f60b3136d82d___boxed(lean_object* v_a0_15_){
_start:
{
uint8_t v_a0_boxed_16_; lean_object* v_res_17_; 
v_a0_boxed_16_ = lean_unbox(v_a0_15_);
v_res_17_ = lb_6815c3e5d952f60b3136d82d(v_a0_boxed_16_);
return v_res_17_;
}
}
LEAN_EXPORT uint8_t lb_6815c3e5d952f60b3136d82d_refinement_0(uint8_t v_value_18_){
  fputs("LB_SUBTYPE_ENTRY_V1 enter validator Subtypes.byte:0\n", stderr);

_start:
{
lean_object* v___x_19_; 
v___x_19_ = lb_probe_constructor_checkedByte(v_value_18_);
if (lean_obj_tag(v___x_19_) == 0)
{
uint8_t v___x_20_; 
v___x_20_ = 0;
return v___x_20_;
}
else
{
uint8_t v___x_21_; 
lean_dec_ref_known(v___x_19_, 1);
v___x_21_ = 1;
return v___x_21_;
}
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNative9da28bcf49ab7dd6_f__lb__6815c3e5d952f60b3136d82d__refinement__0___boxed(lean_object* v_value_22_){
_start:
{
uint8_t v_value_boxed_23_; uint8_t v_res_24_; lean_object* v_r_25_; 
v_value_boxed_23_ = lean_unbox(v_value_22_);
v_res_24_ = lb_6815c3e5d952f60b3136d82d_refinement_0(v_value_boxed_23_);
v_r_25_ = lean_box(v_res_24_);
return v_r_25_;
}
}
LEAN_EXPORT lean_object* lb_c91ef75f139613c4dde809e0(lean_object* v_a0_26_){
  fputs("LB_SUBTYPE_ENTRY_V1 enter adapter Subtypes.clamp\n", stderr);

_start:
{
lean_object* v___x_27_; lean_object* v_val_28_; lean_object* v___x_30_; uint8_t v_isShared_31_; uint8_t v_isSharedCheck_36_; 
v___x_27_ = lb_probe_constructor_checkedBounded(v_a0_26_);
v_val_28_ = lean_ctor_get(v___x_27_, 0);
v_isSharedCheck_36_ = !lean_is_exclusive(v___x_27_);
if (v_isSharedCheck_36_ == 0)
{
v___x_30_ = v___x_27_;
v_isShared_31_ = v_isSharedCheck_36_;
goto v_resetjp_29_;
}
else
{
lean_inc(v_val_28_);
lean_dec(v___x_27_);
v___x_30_ = lean_box(0);
v_isShared_31_ = v_isSharedCheck_36_;
goto v_resetjp_29_;
}
v_resetjp_29_:
{
lean_object* v___x_32_; lean_object* v___x_34_; 
v___x_32_ = lb_probe_source_clamp(v_val_28_);
if (v_isShared_31_ == 0)
{
lean_ctor_set(v___x_30_, 0, v___x_32_);
v___x_34_ = v___x_30_;
goto v_reusejp_33_;
}
else
{
lean_object* v_reuseFailAlloc_35_; 
v_reuseFailAlloc_35_ = lean_alloc_ctor(1, 1, 0);
lean_ctor_set(v_reuseFailAlloc_35_, 0, v___x_32_);
v___x_34_ = v_reuseFailAlloc_35_;
goto v_reusejp_33_;
}
v_reusejp_33_:
{
return v___x_34_;
}
}
}
}
LEAN_EXPORT uint8_t lb_c91ef75f139613c4dde809e0_refinement_0(lean_object* v_value_37_){
  fputs("LB_SUBTYPE_ENTRY_V1 enter validator Subtypes.clamp:0\n", stderr);

_start:
{
lean_object* v___x_38_; uint8_t v___x_39_; 
v___x_38_ = lb_probe_constructor_checkedBounded(v_value_37_);
lean_dec(v___x_38_);
v___x_39_ = 1;
return v___x_39_;
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNative9da28bcf49ab7dd6_f__lb__c91ef75f139613c4dde809e0__refinement__0___boxed(lean_object* v_value_40_){
_start:
{
uint8_t v_res_41_; lean_object* v_r_42_; 
v_res_41_ = lb_c91ef75f139613c4dde809e0_refinement_0(v_value_40_);
v_r_42_ = lean_box(v_res_41_);
return v_r_42_;
}
}
LEAN_EXPORT lean_object* lb_9bb269bf43e5265e28a853e1(lean_object* v_a0_43_){
  fputs("LB_SUBTYPE_ENTRY_V1 enter adapter Subtypes.firstEven\n", stderr);

_start:
{
lean_object* v___x_44_; 
v___x_44_ = lb_probe_constructor_checkedEven(v_a0_43_);
if (lean_obj_tag(v___x_44_) == 0)
{
lean_object* v___x_45_; 
v___x_45_ = lean_box(0);
return v___x_45_;
}
else
{
lean_object* v_val_46_; lean_object* v___x_48_; uint8_t v_isShared_49_; uint8_t v_isSharedCheck_54_; 
v_val_46_ = lean_ctor_get(v___x_44_, 0);
v_isSharedCheck_54_ = !lean_is_exclusive(v___x_44_);
if (v_isSharedCheck_54_ == 0)
{
v___x_48_ = v___x_44_;
v_isShared_49_ = v_isSharedCheck_54_;
goto v_resetjp_47_;
}
else
{
lean_inc(v_val_46_);
lean_dec(v___x_44_);
v___x_48_ = lean_box(0);
v_isShared_49_ = v_isSharedCheck_54_;
goto v_resetjp_47_;
}
v_resetjp_47_:
{
lean_object* v___x_50_; lean_object* v___x_52_; 
v___x_50_ = l_Subtypes_echo___redArg(v_val_46_);
lean_dec(v_val_46_);
if (v_isShared_49_ == 0)
{
lean_ctor_set(v___x_48_, 0, v___x_50_);
v___x_52_ = v___x_48_;
goto v_reusejp_51_;
}
else
{
lean_object* v_reuseFailAlloc_53_; 
v_reuseFailAlloc_53_ = lean_alloc_ctor(1, 1, 0);
lean_ctor_set(v_reuseFailAlloc_53_, 0, v___x_50_);
v___x_52_ = v_reuseFailAlloc_53_;
goto v_reusejp_51_;
}
v_reusejp_51_:
{
return v___x_52_;
}
}
}
}
}
LEAN_EXPORT uint8_t lb_9bb269bf43e5265e28a853e1_refinement_0(lean_object* v_value_55_){
  fputs("LB_SUBTYPE_ENTRY_V1 enter validator Subtypes.firstEven:0\n", stderr);

_start:
{
lean_object* v___x_56_; 
v___x_56_ = lb_probe_constructor_checkedEven(v_value_55_);
if (lean_obj_tag(v___x_56_) == 0)
{
uint8_t v___x_57_; 
v___x_57_ = 0;
return v___x_57_;
}
else
{
uint8_t v___x_58_; 
lean_dec_ref_known(v___x_56_, 1);
v___x_58_ = 1;
return v___x_58_;
}
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNative9da28bcf49ab7dd6_f__lb__9bb269bf43e5265e28a853e1__refinement__0___boxed(lean_object* v_value_59_){
_start:
{
uint8_t v_res_60_; lean_object* v_r_61_; 
v_res_60_ = lb_9bb269bf43e5265e28a853e1_refinement_0(v_value_59_);
v_r_61_ = lean_box(v_res_60_);
return v_r_61_;
}
}
LEAN_EXPORT lean_object* lb_91473598b255f6e5c1372d98(lean_object* v_a0_62_){
  fputs("LB_SUBTYPE_ENTRY_V1 enter adapter Subtypes.half\n", stderr);

_start:
{
lean_object* v___x_63_; 
v___x_63_ = lb_probe_constructor_checkedEven(v_a0_62_);
if (lean_obj_tag(v___x_63_) == 0)
{
lean_object* v___x_64_; 
v___x_64_ = lean_box(0);
return v___x_64_;
}
else
{
lean_object* v_val_65_; lean_object* v___x_67_; uint8_t v_isShared_68_; uint8_t v_isSharedCheck_73_; 
v_val_65_ = lean_ctor_get(v___x_63_, 0);
v_isSharedCheck_73_ = !lean_is_exclusive(v___x_63_);
if (v_isSharedCheck_73_ == 0)
{
v___x_67_ = v___x_63_;
v_isShared_68_ = v_isSharedCheck_73_;
goto v_resetjp_66_;
}
else
{
lean_inc(v_val_65_);
lean_dec(v___x_63_);
v___x_67_ = lean_box(0);
v_isShared_68_ = v_isSharedCheck_73_;
goto v_resetjp_66_;
}
v_resetjp_66_:
{
lean_object* v___x_69_; lean_object* v___x_71_; 
v___x_69_ = lb_probe_source_half(v_val_65_);
if (v_isShared_68_ == 0)
{
lean_ctor_set(v___x_67_, 0, v___x_69_);
v___x_71_ = v___x_67_;
goto v_reusejp_70_;
}
else
{
lean_object* v_reuseFailAlloc_72_; 
v_reuseFailAlloc_72_ = lean_alloc_ctor(1, 1, 0);
lean_ctor_set(v_reuseFailAlloc_72_, 0, v___x_69_);
v___x_71_ = v_reuseFailAlloc_72_;
goto v_reusejp_70_;
}
v_reusejp_70_:
{
return v___x_71_;
}
}
}
}
}
LEAN_EXPORT uint8_t lb_91473598b255f6e5c1372d98_refinement_0(lean_object* v_value_74_){
  fputs("LB_SUBTYPE_ENTRY_V1 enter validator Subtypes.half:0\n", stderr);

_start:
{
lean_object* v___x_75_; 
v___x_75_ = lb_probe_constructor_checkedEven(v_value_74_);
if (lean_obj_tag(v___x_75_) == 0)
{
uint8_t v___x_76_; 
v___x_76_ = 0;
return v___x_76_;
}
else
{
uint8_t v___x_77_; 
lean_dec_ref_known(v___x_75_, 1);
v___x_77_ = 1;
return v___x_77_;
}
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNative9da28bcf49ab7dd6_f__lb__91473598b255f6e5c1372d98__refinement__0___boxed(lean_object* v_value_78_){
_start:
{
uint8_t v_res_79_; lean_object* v_r_80_; 
v_res_79_ = lb_91473598b255f6e5c1372d98_refinement_0(v_value_78_);
v_r_80_ = lean_box(v_res_79_);
return v_r_80_;
}
}
LEAN_EXPORT lean_object* lb_1886f5b34ac04df8628c9301(lean_object* v_a0_81_){
  fputs("LB_SUBTYPE_ENTRY_V1 enter adapter Subtypes.head\n", stderr);

_start:
{
lean_object* v___x_82_; 
v___x_82_ = lb_probe_constructor_checkedPayload(v_a0_81_);
if (lean_obj_tag(v___x_82_) == 0)
{
lean_object* v___x_83_; 
v___x_83_ = lean_box(0);
return v___x_83_;
}
else
{
lean_object* v_val_84_; lean_object* v___x_86_; uint8_t v_isShared_87_; uint8_t v_isSharedCheck_93_; 
v_val_84_ = lean_ctor_get(v___x_82_, 0);
v_isSharedCheck_93_ = !lean_is_exclusive(v___x_82_);
if (v_isSharedCheck_93_ == 0)
{
v___x_86_ = v___x_82_;
v_isShared_87_ = v_isSharedCheck_93_;
goto v_resetjp_85_;
}
else
{
lean_inc(v_val_84_);
lean_dec(v___x_82_);
v___x_86_ = lean_box(0);
v_isShared_87_ = v_isSharedCheck_93_;
goto v_resetjp_85_;
}
v_resetjp_85_:
{
uint8_t v___x_88_; lean_object* v___x_89_; lean_object* v___x_91_; 
v___x_88_ = lb_probe_source_head(v_val_84_);
v___x_89_ = lean_box(v___x_88_);
if (v_isShared_87_ == 0)
{
lean_ctor_set(v___x_86_, 0, v___x_89_);
v___x_91_ = v___x_86_;
goto v_reusejp_90_;
}
else
{
lean_object* v_reuseFailAlloc_92_; 
v_reuseFailAlloc_92_ = lean_alloc_ctor(1, 1, 0);
lean_ctor_set(v_reuseFailAlloc_92_, 0, v___x_89_);
v___x_91_ = v_reuseFailAlloc_92_;
goto v_reusejp_90_;
}
v_reusejp_90_:
{
return v___x_91_;
}
}
}
}
}
LEAN_EXPORT uint8_t lb_1886f5b34ac04df8628c9301_refinement_0(lean_object* v_value_94_){
  fputs("LB_SUBTYPE_ENTRY_V1 enter validator Subtypes.head:0\n", stderr);

_start:
{
lean_object* v___x_95_; 
v___x_95_ = lb_probe_constructor_checkedPayload(v_value_94_);
if (lean_obj_tag(v___x_95_) == 0)
{
uint8_t v___x_96_; 
v___x_96_ = 0;
return v___x_96_;
}
else
{
uint8_t v___x_97_; 
lean_dec_ref_known(v___x_95_, 1);
v___x_97_ = 1;
return v___x_97_;
}
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNative9da28bcf49ab7dd6_f__lb__1886f5b34ac04df8628c9301__refinement__0___boxed(lean_object* v_value_98_){
_start:
{
uint8_t v_res_99_; lean_object* v_r_100_; 
v_res_99_ = lb_1886f5b34ac04df8628c9301_refinement_0(v_value_98_);
v_r_100_ = lean_box(v_res_99_);
return v_r_100_;
}
}
LEAN_EXPORT lean_object* lb_9205887c464685a24bd748da(lean_object* v_a0_101_, lean_object* v_a1_102_){
  fputs("LB_SUBTYPE_ENTRY_V1 enter adapter Subtypes.join\n", stderr);

_start:
{
lean_object* v___x_103_; 
v___x_103_ = lb_probe_constructor_checkedWord(v_a0_101_);
if (lean_obj_tag(v___x_103_) == 0)
{
lean_object* v___x_104_; 
lean_dec_ref(v_a1_102_);
v___x_104_ = lean_box(0);
return v___x_104_;
}
else
{
lean_object* v_val_105_; lean_object* v___x_106_; 
v_val_105_ = lean_ctor_get(v___x_103_, 0);
lean_inc(v_val_105_);
lean_dec_ref_known(v___x_103_, 1);
v___x_106_ = lb_probe_constructor_checkedWord(v_a1_102_);
if (lean_obj_tag(v___x_106_) == 0)
{
lean_object* v___x_107_; 
lean_dec(v_val_105_);
v___x_107_ = lean_box(0);
return v___x_107_;
}
else
{
lean_object* v_val_108_; lean_object* v___x_110_; uint8_t v_isShared_111_; uint8_t v_isSharedCheck_116_; 
v_val_108_ = lean_ctor_get(v___x_106_, 0);
v_isSharedCheck_116_ = !lean_is_exclusive(v___x_106_);
if (v_isSharedCheck_116_ == 0)
{
v___x_110_ = v___x_106_;
v_isShared_111_ = v_isSharedCheck_116_;
goto v_resetjp_109_;
}
else
{
lean_inc(v_val_108_);
lean_dec(v___x_106_);
v___x_110_ = lean_box(0);
v_isShared_111_ = v_isSharedCheck_116_;
goto v_resetjp_109_;
}
v_resetjp_109_:
{
lean_object* v___x_112_; lean_object* v___x_114_; 
v___x_112_ = lb_probe_source_join(v_val_105_, v_val_108_);
if (v_isShared_111_ == 0)
{
lean_ctor_set(v___x_110_, 0, v___x_112_);
v___x_114_ = v___x_110_;
goto v_reusejp_113_;
}
else
{
lean_object* v_reuseFailAlloc_115_; 
v_reuseFailAlloc_115_ = lean_alloc_ctor(1, 1, 0);
lean_ctor_set(v_reuseFailAlloc_115_, 0, v___x_112_);
v___x_114_ = v_reuseFailAlloc_115_;
goto v_reusejp_113_;
}
v_reusejp_113_:
{
return v___x_114_;
}
}
}
}
}
}
LEAN_EXPORT uint8_t lb_9205887c464685a24bd748da_refinement_0(lean_object* v_value_117_){
  fputs("LB_SUBTYPE_ENTRY_V1 enter validator Subtypes.join:0\n", stderr);

_start:
{
lean_object* v___x_118_; 
v___x_118_ = lb_probe_constructor_checkedWord(v_value_117_);
if (lean_obj_tag(v___x_118_) == 0)
{
uint8_t v___x_119_; 
v___x_119_ = 0;
return v___x_119_;
}
else
{
uint8_t v___x_120_; 
lean_dec_ref_known(v___x_118_, 1);
v___x_120_ = 1;
return v___x_120_;
}
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNative9da28bcf49ab7dd6_f__lb__9205887c464685a24bd748da__refinement__0___boxed(lean_object* v_value_121_){
_start:
{
uint8_t v_res_122_; lean_object* v_r_123_; 
v_res_122_ = lb_9205887c464685a24bd748da_refinement_0(v_value_121_);
v_r_123_ = lean_box(v_res_122_);
return v_r_123_;
}
}
LEAN_EXPORT uint8_t lb_9205887c464685a24bd748da_refinement_1(lean_object* v_value_124_){
  fputs("LB_SUBTYPE_ENTRY_V1 enter validator Subtypes.join:1\n", stderr);

_start:
{
lean_object* v___x_125_; 
v___x_125_ = lb_probe_constructor_checkedWord(v_value_124_);
if (lean_obj_tag(v___x_125_) == 0)
{
uint8_t v___x_126_; 
v___x_126_ = 0;
return v___x_126_;
}
else
{
uint8_t v___x_127_; 
lean_dec_ref_known(v___x_125_, 1);
v___x_127_ = 1;
return v___x_127_;
}
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNative9da28bcf49ab7dd6_f__lb__9205887c464685a24bd748da__refinement__1___boxed(lean_object* v_value_128_){
_start:
{
uint8_t v_res_129_; lean_object* v_r_130_; 
v_res_129_ = lb_9205887c464685a24bd748da_refinement_1(v_value_128_);
v_r_130_ = lean_box(v_res_129_);
return v_r_130_;
}
}
LEAN_EXPORT lean_object* lb_208c4c169dd06ab4d3767757(lean_object* v_a0_131_, lean_object* v_a1_132_){
  fputs("LB_SUBTYPE_ENTRY_V1 enter adapter Subtypes.mix\n", stderr);

_start:
{
lean_object* v___x_133_; 
v___x_133_ = lb_probe_constructor_checkedEven(v_a0_131_);
if (lean_obj_tag(v___x_133_) == 0)
{
lean_object* v___x_134_; 
lean_dec(v_a1_132_);
v___x_134_ = lean_box(0);
return v___x_134_;
}
else
{
lean_object* v_val_135_; lean_object* v___x_137_; uint8_t v_isShared_138_; uint8_t v_isSharedCheck_146_; 
v_val_135_ = lean_ctor_get(v___x_133_, 0);
v_isSharedCheck_146_ = !lean_is_exclusive(v___x_133_);
if (v_isSharedCheck_146_ == 0)
{
v___x_137_ = v___x_133_;
v_isShared_138_ = v_isSharedCheck_146_;
goto v_resetjp_136_;
}
else
{
lean_inc(v_val_135_);
lean_dec(v___x_133_);
v___x_137_ = lean_box(0);
v_isShared_138_ = v_isSharedCheck_146_;
goto v_resetjp_136_;
}
v_resetjp_136_:
{
lean_object* v___x_139_; uint8_t v___x_140_; 
v___x_139_ = lean_unsigned_to_nat(10u);
v___x_140_ = lean_nat_dec_lt(v_a1_132_, v___x_139_);
if (v___x_140_ == 0)
{
lean_object* v___x_141_; 
lean_del_object(v___x_137_);
lean_dec(v_val_135_);
lean_dec(v_a1_132_);
v___x_141_ = lean_box(0);
return v___x_141_;
}
else
{
lean_object* v___x_142_; lean_object* v___x_144_; 
v___x_142_ = lb_probe_source_mix(v_val_135_, v_a1_132_);
if (v_isShared_138_ == 0)
{
lean_ctor_set(v___x_137_, 0, v___x_142_);
v___x_144_ = v___x_137_;
goto v_reusejp_143_;
}
else
{
lean_object* v_reuseFailAlloc_145_; 
v_reuseFailAlloc_145_ = lean_alloc_ctor(1, 1, 0);
lean_ctor_set(v_reuseFailAlloc_145_, 0, v___x_142_);
v___x_144_ = v_reuseFailAlloc_145_;
goto v_reusejp_143_;
}
v_reusejp_143_:
{
return v___x_144_;
}
}
}
}
}
}
LEAN_EXPORT uint8_t lb_208c4c169dd06ab4d3767757_refinement_0(lean_object* v_value_147_){
  fputs("LB_SUBTYPE_ENTRY_V1 enter validator Subtypes.mix:0\n", stderr);

_start:
{
lean_object* v___x_148_; 
v___x_148_ = lb_probe_constructor_checkedEven(v_value_147_);
if (lean_obj_tag(v___x_148_) == 0)
{
uint8_t v___x_149_; 
v___x_149_ = 0;
return v___x_149_;
}
else
{
uint8_t v___x_150_; 
lean_dec_ref_known(v___x_148_, 1);
v___x_150_ = 1;
return v___x_150_;
}
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNative9da28bcf49ab7dd6_f__lb__208c4c169dd06ab4d3767757__refinement__0___boxed(lean_object* v_value_151_){
_start:
{
uint8_t v_res_152_; lean_object* v_r_153_; 
v_res_152_ = lb_208c4c169dd06ab4d3767757_refinement_0(v_value_151_);
v_r_153_ = lean_box(v_res_152_);
return v_r_153_;
}
}
LEAN_EXPORT lean_object* lb_726954a7fecd6b63c462c2e2(lean_object* v_a0_154_){
  fputs("LB_SUBTYPE_ENTRY_V1 enter adapter Subtypes.pad\n", stderr);

_start:
{
lean_object* v___x_155_; 
v___x_155_ = lb_probe_source_pad(v_a0_154_);
return v___x_155_;
}
}
LEAN_EXPORT lean_object* lb_fa19a195ff9ce74a4b7afc1d(lean_object* v_a0_156_, lean_object* v_a1_157_){
  fputs("LB_SUBTYPE_ENTRY_V1 enter adapter Subtypes.scale\n", stderr);

_start:
{
lean_object* v___x_158_; 
v___x_158_ = lb_probe_constructor_checkedSmall(v_a1_157_);
if (lean_obj_tag(v___x_158_) == 0)
{
lean_object* v___x_159_; 
lean_dec(v_a0_156_);
v___x_159_ = lean_box(0);
return v___x_159_;
}
else
{
lean_object* v_val_160_; lean_object* v___x_162_; uint8_t v_isShared_163_; uint8_t v_isSharedCheck_168_; 
v_val_160_ = lean_ctor_get(v___x_158_, 0);
v_isSharedCheck_168_ = !lean_is_exclusive(v___x_158_);
if (v_isSharedCheck_168_ == 0)
{
v___x_162_ = v___x_158_;
v_isShared_163_ = v_isSharedCheck_168_;
goto v_resetjp_161_;
}
else
{
lean_inc(v_val_160_);
lean_dec(v___x_158_);
v___x_162_ = lean_box(0);
v_isShared_163_ = v_isSharedCheck_168_;
goto v_resetjp_161_;
}
v_resetjp_161_:
{
lean_object* v___x_164_; lean_object* v___x_166_; 
v___x_164_ = lb_probe_source_scale(v_a0_156_, v_val_160_);
if (v_isShared_163_ == 0)
{
lean_ctor_set(v___x_162_, 0, v___x_164_);
v___x_166_ = v___x_162_;
goto v_reusejp_165_;
}
else
{
lean_object* v_reuseFailAlloc_167_; 
v_reuseFailAlloc_167_ = lean_alloc_ctor(1, 1, 0);
lean_ctor_set(v_reuseFailAlloc_167_, 0, v___x_164_);
v___x_166_ = v_reuseFailAlloc_167_;
goto v_reusejp_165_;
}
v_reusejp_165_:
{
return v___x_166_;
}
}
}
}
}
LEAN_EXPORT uint8_t lb_fa19a195ff9ce74a4b7afc1d_refinement_1(lean_object* v_value_169_){
  fputs("LB_SUBTYPE_ENTRY_V1 enter validator Subtypes.scale:1\n", stderr);

_start:
{
lean_object* v___x_170_; 
v___x_170_ = lb_probe_constructor_checkedSmall(v_value_169_);
if (lean_obj_tag(v___x_170_) == 0)
{
uint8_t v___x_171_; 
v___x_171_ = 0;
return v___x_171_;
}
else
{
uint8_t v___x_172_; 
lean_dec_ref_known(v___x_170_, 1);
v___x_172_ = 1;
return v___x_172_;
}
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNative9da28bcf49ab7dd6_f__lb__fa19a195ff9ce74a4b7afc1d__refinement__1___boxed(lean_object* v_value_173_){
_start:
{
uint8_t v_res_174_; lean_object* v_r_175_; 
v_res_174_ = lb_fa19a195ff9ce74a4b7afc1d_refinement_1(v_value_173_);
v_r_175_ = lean_box(v_res_174_);
return v_r_175_;
}
}
LEAN_EXPORT lean_object* lb_a5a1d2658399cacb73553f8b(lean_object* v_a0_176_){
  fputs("LB_SUBTYPE_ENTRY_V1 enter adapter Subtypes.secondEven\n", stderr);

_start:
{
lean_object* v___x_177_; lean_object* v_val_178_; lean_object* v___x_180_; uint8_t v_isShared_181_; uint8_t v_isSharedCheck_186_; 
v___x_177_ = lb_probe_constructor_normalizedEven(v_a0_176_);
v_val_178_ = lean_ctor_get(v___x_177_, 0);
v_isSharedCheck_186_ = !lean_is_exclusive(v___x_177_);
if (v_isSharedCheck_186_ == 0)
{
v___x_180_ = v___x_177_;
v_isShared_181_ = v_isSharedCheck_186_;
goto v_resetjp_179_;
}
else
{
lean_inc(v_val_178_);
lean_dec(v___x_177_);
v___x_180_ = lean_box(0);
v_isShared_181_ = v_isSharedCheck_186_;
goto v_resetjp_179_;
}
v_resetjp_179_:
{
lean_object* v___x_182_; lean_object* v___x_184_; 
v___x_182_ = l_Subtypes_echo___redArg(v_val_178_);
lean_dec(v_val_178_);
if (v_isShared_181_ == 0)
{
lean_ctor_set(v___x_180_, 0, v___x_182_);
v___x_184_ = v___x_180_;
goto v_reusejp_183_;
}
else
{
lean_object* v_reuseFailAlloc_185_; 
v_reuseFailAlloc_185_ = lean_alloc_ctor(1, 1, 0);
lean_ctor_set(v_reuseFailAlloc_185_, 0, v___x_182_);
v___x_184_ = v_reuseFailAlloc_185_;
goto v_reusejp_183_;
}
v_reusejp_183_:
{
return v___x_184_;
}
}
}
}
LEAN_EXPORT uint8_t lb_a5a1d2658399cacb73553f8b_refinement_0(lean_object* v_value_187_){
  fputs("LB_SUBTYPE_ENTRY_V1 enter validator Subtypes.secondEven:0\n", stderr);

_start:
{
lean_object* v___x_188_; uint8_t v___x_189_; 
v___x_188_ = lb_probe_constructor_normalizedEven(v_value_187_);
lean_dec(v___x_188_);
v___x_189_ = 1;
return v___x_189_;
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNative9da28bcf49ab7dd6_f__lb__a5a1d2658399cacb73553f8b__refinement__0___boxed(lean_object* v_value_190_){
_start:
{
uint8_t v_res_191_; lean_object* v_r_192_; 
v_res_191_ = lb_a5a1d2658399cacb73553f8b_refinement_0(v_value_190_);
v_r_192_ = lean_box(v_res_191_);
return v_r_192_;
}
}
LEAN_EXPORT lean_object* lb_80fdcaaaf560c424e720029c(lean_object* v_a0_193_){
  fputs("LB_SUBTYPE_ENTRY_V1 enter adapter Subtypes.shout\n", stderr);

_start:
{
lean_object* v___x_194_; 
v___x_194_ = lb_probe_constructor_checkedWord(v_a0_193_);
if (lean_obj_tag(v___x_194_) == 0)
{
lean_object* v___x_195_; 
v___x_195_ = lean_box(0);
return v___x_195_;
}
else
{
lean_object* v_val_196_; lean_object* v___x_198_; uint8_t v_isShared_199_; uint8_t v_isSharedCheck_204_; 
v_val_196_ = lean_ctor_get(v___x_194_, 0);
v_isSharedCheck_204_ = !lean_is_exclusive(v___x_194_);
if (v_isSharedCheck_204_ == 0)
{
v___x_198_ = v___x_194_;
v_isShared_199_ = v_isSharedCheck_204_;
goto v_resetjp_197_;
}
else
{
lean_inc(v_val_196_);
lean_dec(v___x_194_);
v___x_198_ = lean_box(0);
v_isShared_199_ = v_isSharedCheck_204_;
goto v_resetjp_197_;
}
v_resetjp_197_:
{
lean_object* v___x_200_; lean_object* v___x_202_; 
v___x_200_ = lb_probe_source_shout(v_val_196_);
if (v_isShared_199_ == 0)
{
lean_ctor_set(v___x_198_, 0, v___x_200_);
v___x_202_ = v___x_198_;
goto v_reusejp_201_;
}
else
{
lean_object* v_reuseFailAlloc_203_; 
v_reuseFailAlloc_203_ = lean_alloc_ctor(1, 1, 0);
lean_ctor_set(v_reuseFailAlloc_203_, 0, v___x_200_);
v___x_202_ = v_reuseFailAlloc_203_;
goto v_reusejp_201_;
}
v_reusejp_201_:
{
return v___x_202_;
}
}
}
}
}
LEAN_EXPORT uint8_t lb_80fdcaaaf560c424e720029c_refinement_0(lean_object* v_value_205_){
  fputs("LB_SUBTYPE_ENTRY_V1 enter validator Subtypes.shout:0\n", stderr);

_start:
{
lean_object* v___x_206_; 
v___x_206_ = lb_probe_constructor_checkedWord(v_value_205_);
if (lean_obj_tag(v___x_206_) == 0)
{
uint8_t v___x_207_; 
v___x_207_ = 0;
return v___x_207_;
}
else
{
uint8_t v___x_208_; 
lean_dec_ref_known(v___x_206_, 1);
v___x_208_ = 1;
return v___x_208_;
}
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNative9da28bcf49ab7dd6_f__lb__80fdcaaaf560c424e720029c__refinement__0___boxed(lean_object* v_value_209_){
_start:
{
uint8_t v_res_210_; lean_object* v_r_211_; 
v_res_210_ = lb_80fdcaaaf560c424e720029c_refinement_0(v_value_209_);
v_r_211_ = lean_box(v_res_210_);
return v_r_211_;
}
}
LEAN_EXPORT lean_object* lb_1fd7234bf1e157d167e32146(lean_object* v_a0_212_){
  fputs("LB_SUBTYPE_ENTRY_V1 enter adapter Subtypes.unrestricted\n", stderr);

_start:
{
lean_object* v___x_213_; 
v___x_213_ = lb_probe_source_unrestricted(v_a0_212_);
return v___x_213_;
}
}
LEAN_EXPORT lean_object* lb_c467ef12fd0e27374fac8f55(lean_object* v_unit_214_){
  fputs("LB_SUBTYPE_ENTRY_V1 enter adapter Subtypes.zeroEven\n", stderr);

_start:
{
lean_object* v___x_215_; 
v___x_215_ = lean_unsigned_to_nat(0u);
return v___x_215_;
}
}
LEAN_EXPORT lean_object* lb_native_nat_text(lean_object* v_value_216_){
_start:
{
lean_object* v___x_217_; 
v___x_217_ = l_Nat_reprFast(v_value_216_);
return v___x_217_;
}
}
LEAN_EXPORT lean_object* lb_native_int_text(lean_object* v_value_218_){
_start:
{
lean_object* v___x_219_; 
v___x_219_ = l_Int_repr(v_value_218_);
lean_dec(v_value_218_);
return v___x_219_;
}
}
LEAN_EXPORT lean_object* l_panic___at___00LeanBridgeNative9da28bcf49ab7dd6_f__lb__native__int__parse_spec__0(lean_object* v_msg_220_){
_start:
{
lean_object* v___x_221_; lean_object* v___x_222_; 
v___x_221_ = l_Int_instInhabited;
v___x_222_ = lean_panic_fn_borrowed(v___x_221_, v_msg_220_);
return v___x_222_;
}
}
LEAN_EXPORT lean_object* lb_native_int_parse(lean_object* v_value_224_){
_start:
{
lean_object* v___x_225_; lean_object* v___x_226_; lean_object* v___x_227_; lean_object* v___x_228_; 
v___x_225_ = lean_unsigned_to_nat(0u);
v___x_226_ = lean_string_utf8_byte_size(v_value_224_);
v___x_227_ = lean_alloc_ctor(0, 3, 0);
lean_ctor_set(v___x_227_, 0, v_value_224_);
lean_ctor_set(v___x_227_, 1, v___x_225_);
lean_ctor_set(v___x_227_, 2, v___x_226_);
v___x_228_ = l_String_Slice_toInt_x3f(v___x_227_);
if (lean_obj_tag(v___x_228_) == 0)
{
lean_object* v___x_229_; lean_object* v___x_230_; 
v___x_229_ = ((lean_object*)(l_LeanBridgeNative9da28bcf49ab7dd6_f__lb__native__int__parse___closed__0));
v___x_230_ = l_panic___at___00LeanBridgeNative9da28bcf49ab7dd6_f__lb__native__int__parse_spec__0(v___x_229_);
return v___x_230_;
}
else
{
lean_object* v_val_231_; 
v_val_231_ = lean_ctor_get(v___x_228_, 0);
lean_inc(v_val_231_);
lean_dec_ref_known(v___x_228_, 1);
return v_val_231_;
}
}
}
lean_object* initialize_Init(uint8_t builtin);
lean_object* initialize_Init(uint8_t builtin);
lean_object* initialize_Subtypes(uint8_t builtin);
static bool _G_initialized = false;
LEAN_EXPORT lean_object* initialize_LeanBridgeNative9da28bcf49ab7dd6(uint8_t builtin) {
lean_object * res;
if (_G_initialized) return lean_io_result_mk_ok(lean_box(0));
_G_initialized = true;
res = initialize_Init(builtin);
if (lean_io_result_is_error(res)) return res;
lean_dec_ref(res);
res = initialize_Init(builtin);
if (lean_io_result_is_error(res)) return res;
lean_dec_ref(res);
res = initialize_Subtypes(builtin);
if (lean_io_result_is_error(res)) return res;
lean_dec_ref(res);
return lean_io_result_mk_ok(lean_box(0));
}
#ifdef __cplusplus
}
#endif

#include "component.h"
