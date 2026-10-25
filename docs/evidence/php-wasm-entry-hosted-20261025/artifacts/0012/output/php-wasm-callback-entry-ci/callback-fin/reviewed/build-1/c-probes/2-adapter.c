#include <stdio.h>
// Lean compiler output
// Module: LeanBridgeNative99d469b3ee044240
// Imports: public import Init public meta import Init public import ReviewedCallbacks
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
uint8_t lean_nat_dec_lt(lean_object*, lean_object*);
uint8_t lean_nat_dec_eq(lean_object*, lean_object*);
lean_object* lean_array_fget_borrowed(lean_object*, lean_object*);
lean_object* lean_mk_empty_array_with_capacity(lean_object*);
lean_object* lean_array_push(lean_object*, lean_object*);
lean_object* lb_callback_fin_probe_source_counter(lean_object*, lean_object*);
size_t lean_array_size(lean_object*);
uint8_t lean_usize_dec_lt(size_t, size_t);
lean_object* lean_array_uget(lean_object*, size_t);
lean_object* lean_array_uset(lean_object*, size_t, lean_object*);
size_t lean_usize_add(size_t, size_t);
lean_object* l_ReviewedCallbacks_digits___redArg(lean_object*);
lean_object* lean_array_uget_borrowed(lean_object*, size_t);
lean_object* lean_array_to_list(lean_object*);
lean_object* lb_callback_fin_probe_source_tiles(lean_object*, lean_object*);
lean_object* lb_callback_fin_probe_source_scaler(lean_object*, lean_object*);
lean_object* lean_nat_sub(lean_object*, lean_object*);
lean_object* lb_callback_fin_probe_source_three(lean_object*, lean_object*);
lean_object* lb_callback_fin_probe_source_tileMaker(lean_object*, lean_object*);
lean_object* l_Array_extract___redArg(lean_object*, lean_object*, lean_object*);
lean_object* lb_callback_fin_probe_source_visit(lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNative99d469b3ee044240_carrierValue___redArg(lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNative99d469b3ee044240_carrierValue___redArg___boxed(lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNative99d469b3ee044240_carrierValue(lean_object*, lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNative99d469b3ee044240_carrierValue___boxed(lean_object*, lean_object*);
static const lean_array_object l_LeanBridgeNative99d469b3ee044240_carrierResult___redArg___closed__0_value = {.m_header = {.m_rc = 0, .m_cs_sz = sizeof(lean_array_object) + sizeof(void*)*0, .m_other = 0, .m_tag = 246}, .m_size = 0, .m_capacity = 0, .m_data = {}};
static const lean_object* l_LeanBridgeNative99d469b3ee044240_carrierResult___redArg___closed__0 = (const lean_object*)&l_LeanBridgeNative99d469b3ee044240_carrierResult___redArg___closed__0_value;
LEAN_EXPORT lean_object* l_LeanBridgeNative99d469b3ee044240_carrierResult___redArg(lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNative99d469b3ee044240_carrierResult(lean_object*, lean_object*);
static const lean_ctor_object l___private_Init_Data_Array_Basic_0__Array_forIn_x27Unsafe_loop___at___00LeanBridgeNative99d469b3ee044240_carrierCollect_spec__0___redArg___closed__0_value = {.m_header = {.m_rc = 0, .m_cs_sz = sizeof(lean_ctor_object) + sizeof(void*)*1 + 0, .m_other = 1, .m_tag = 1}, .m_objs = {((lean_object*)(((size_t)(0) << 1) | 1))}};
static const lean_object* l___private_Init_Data_Array_Basic_0__Array_forIn_x27Unsafe_loop___at___00LeanBridgeNative99d469b3ee044240_carrierCollect_spec__0___redArg___closed__0 = (const lean_object*)&l___private_Init_Data_Array_Basic_0__Array_forIn_x27Unsafe_loop___at___00LeanBridgeNative99d469b3ee044240_carrierCollect_spec__0___redArg___closed__0_value;
LEAN_EXPORT lean_object* l___private_Init_Data_Array_Basic_0__Array_forIn_x27Unsafe_loop___at___00LeanBridgeNative99d469b3ee044240_carrierCollect_spec__0___redArg(lean_object*, size_t, size_t, lean_object*);
LEAN_EXPORT lean_object* l___private_Init_Data_Array_Basic_0__Array_forIn_x27Unsafe_loop___at___00LeanBridgeNative99d469b3ee044240_carrierCollect_spec__0___redArg___boxed(lean_object*, lean_object*, lean_object*, lean_object*);
static const lean_ctor_object l_LeanBridgeNative99d469b3ee044240_carrierCollect___redArg___closed__0_value = {.m_header = {.m_rc = 0, .m_cs_sz = sizeof(lean_ctor_object) + sizeof(void*)*2 + 0, .m_other = 2, .m_tag = 0}, .m_objs = {((lean_object*)(((size_t)(0) << 1) | 1)),((lean_object*)&l_LeanBridgeNative99d469b3ee044240_carrierResult___redArg___closed__0_value)}};
static const lean_object* l_LeanBridgeNative99d469b3ee044240_carrierCollect___redArg___closed__0 = (const lean_object*)&l_LeanBridgeNative99d469b3ee044240_carrierCollect___redArg___closed__0_value;
LEAN_EXPORT lean_object* l_LeanBridgeNative99d469b3ee044240_carrierCollect___redArg(lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNative99d469b3ee044240_carrierCollect___redArg___boxed(lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNative99d469b3ee044240_carrierCollect(lean_object*, lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNative99d469b3ee044240_carrierCollect___boxed(lean_object*, lean_object*);
LEAN_EXPORT lean_object* l___private_Init_Data_Array_Basic_0__Array_forIn_x27Unsafe_loop___at___00LeanBridgeNative99d469b3ee044240_carrierCollect_spec__0(lean_object*, lean_object*, size_t, size_t, lean_object*);
LEAN_EXPORT lean_object* l___private_Init_Data_Array_Basic_0__Array_forIn_x27Unsafe_loop___at___00LeanBridgeNative99d469b3ee044240_carrierCollect_spec__0___boxed(lean_object*, lean_object*, lean_object*, lean_object*, lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNative99d469b3ee044240_carrierListItems_loop___redArg(lean_object*, lean_object*, lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNative99d469b3ee044240_carrierListItems_loop(lean_object*, lean_object*, lean_object*, lean_object*);
static const lean_array_object l_LeanBridgeNative99d469b3ee044240_carrierListItems___redArg___closed__0_value = {.m_header = {.m_rc = 0, .m_cs_sz = sizeof(lean_array_object) + sizeof(void*)*0, .m_other = 0, .m_tag = 246}, .m_size = 0, .m_capacity = 0, .m_data = {}};
static const lean_object* l_LeanBridgeNative99d469b3ee044240_carrierListItems___redArg___closed__0 = (const lean_object*)&l_LeanBridgeNative99d469b3ee044240_carrierListItems___redArg___closed__0_value;
LEAN_EXPORT lean_object* l_LeanBridgeNative99d469b3ee044240_carrierListItems___redArg(lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNative99d469b3ee044240_carrierListItems(lean_object*, lean_object*);
static lean_once_cell_t l_LeanBridgeNative99d469b3ee044240_makeb80133b771640d801c25___closed__0_once = LEAN_ONCE_CELL_INITIALIZER;
static lean_object* l_LeanBridgeNative99d469b3ee044240_makeb80133b771640d801c25___closed__0;
LEAN_EXPORT lean_object* lean_bridge_fa450d817b39ecc8598f3607_recursive_b80133b771640d801c25_make(lean_object*, lean_object*);
static lean_once_cell_t l_LeanBridgeNative99d469b3ee044240_field0b80133b771640d801c25___closed__0_once = LEAN_ONCE_CELL_INITIALIZER;
static lean_object* l_LeanBridgeNative99d469b3ee044240_field0b80133b771640d801c25___closed__0;
LEAN_EXPORT lean_object* lean_bridge_fa450d817b39ecc8598f3607_recursive_b80133b771640d801c25_field0(lean_object*);
LEAN_EXPORT lean_object* lean_bridge_fa450d817b39ecc8598f3607_recursive_b80133b771640d801c25_field1(lean_object*);
static lean_once_cell_t l_LeanBridgeNative99d469b3ee044240_makeec759c31d2054a0d5114___closed__0_once = LEAN_ONCE_CELL_INITIALIZER;
static lean_object* l_LeanBridgeNative99d469b3ee044240_makeec759c31d2054a0d5114___closed__0;
LEAN_EXPORT lean_object* lean_bridge_fa450d817b39ecc8598f3607_recursive_ec759c31d2054a0d5114_make(lean_object*);
static const lean_array_object l_LeanBridgeNative99d469b3ee044240_itemsec759c31d2054a0d5114___closed__0_value = {.m_header = {.m_rc = 0, .m_cs_sz = sizeof(lean_array_object) + sizeof(void*)*0, .m_other = 0, .m_tag = 246}, .m_size = 0, .m_capacity = 0, .m_data = {}};
static const lean_object* l_LeanBridgeNative99d469b3ee044240_itemsec759c31d2054a0d5114___closed__0 = (const lean_object*)&l_LeanBridgeNative99d469b3ee044240_itemsec759c31d2054a0d5114___closed__0_value;
LEAN_EXPORT lean_object* lean_bridge_fa450d817b39ecc8598f3607_recursive_ec759c31d2054a0d5114_items(lean_object*);
LEAN_EXPORT lean_object* lean_bridge_fa450d817b39ecc8598f3607_recursive_32e4ced859935847a5f5_make(lean_object*);
LEAN_EXPORT lean_object* l___private_Init_Data_Array_Basic_0__Array_mapMUnsafe_map___at___00LeanBridgeNative99d469b3ee044240_items32e4ced859935847a5f5_spec__0(size_t, size_t, lean_object*);
LEAN_EXPORT lean_object* l___private_Init_Data_Array_Basic_0__Array_mapMUnsafe_map___at___00LeanBridgeNative99d469b3ee044240_items32e4ced859935847a5f5_spec__0___boxed(lean_object*, lean_object*, lean_object*);
static const lean_array_object l_LeanBridgeNative99d469b3ee044240_items32e4ced859935847a5f5___closed__0_value = {.m_header = {.m_rc = 0, .m_cs_sz = sizeof(lean_array_object) + sizeof(void*)*0, .m_other = 0, .m_tag = 246}, .m_size = 0, .m_capacity = 0, .m_data = {}};
static const lean_object* l_LeanBridgeNative99d469b3ee044240_items32e4ced859935847a5f5___closed__0 = (const lean_object*)&l_LeanBridgeNative99d469b3ee044240_items32e4ced859935847a5f5___closed__0_value;
LEAN_EXPORT lean_object* lean_bridge_fa450d817b39ecc8598f3607_recursive_32e4ced859935847a5f5_items(lean_object*);
static const lean_ctor_object l_LeanBridgeNative99d469b3ee044240_callbackDefault__b80133b771640d801c25___closed__0_value = {.m_header = {.m_rc = 0, .m_cs_sz = sizeof(lean_ctor_object) + sizeof(void*)*2 + 0, .m_other = 2, .m_tag = 0}, .m_objs = {((lean_object*)(((size_t)(0) << 1) | 1)),((lean_object*)(((size_t)(0) << 1) | 1))}};
static const lean_object* l_LeanBridgeNative99d469b3ee044240_callbackDefault__b80133b771640d801c25___closed__0 = (const lean_object*)&l_LeanBridgeNative99d469b3ee044240_callbackDefault__b80133b771640d801c25___closed__0_value;
LEAN_EXPORT const lean_object* l_LeanBridgeNative99d469b3ee044240_callbackDefault__b80133b771640d801c25 = (const lean_object*)&l_LeanBridgeNative99d469b3ee044240_callbackDefault__b80133b771640d801c25___closed__0_value;
lean_object* lean_bridge_fa450d817b39ecc8598f3607_structured_1c8c62ab9d1ea80d3641b41193c41bc6de9a3096_invoke(size_t, lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNative99d469b3ee044240_invoke__1c8c62ab9d1ea80d3641b41193c41bc6de9a3096___boxed(lean_object*, lean_object*);
lean_object* lean_bridge_fa450d817b39ecc8598f3607_structured_1c8c62ab9d1ea80d3641b41193c41bc6de9a3096_recovery(size_t);
LEAN_EXPORT lean_object* l_LeanBridgeNative99d469b3ee044240_recovery__1c8c62ab9d1ea80d3641b41193c41bc6de9a3096___boxed(lean_object*);
lean_object* lean_bridge_fa450d817b39ecc8598f3607_structured_1c8c62ab9d1ea80d3641b41193c41bc6de9a3096_reject(size_t, lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNative99d469b3ee044240_reject__1c8c62ab9d1ea80d3641b41193c41bc6de9a3096___boxed(lean_object*, lean_object*);
LEAN_EXPORT lean_object* lean_bridge_fa450d817b39ecc8598f3607_structured_1c8c62ab9d1ea80d3641b41193c41bc6de9a3096_wrap(size_t);
LEAN_EXPORT lean_object* l_LeanBridgeNative99d469b3ee044240_wrap__1c8c62ab9d1ea80d3641b41193c41bc6de9a3096___boxed(lean_object*);
LEAN_EXPORT lean_object* lean_bridge_fa450d817b39ecc8598f3607_structured_c9f9ab9808d5ed4cd9eb0c5380d7151c17138950_apply(lean_object*, lean_object*);
LEAN_EXPORT lean_object* lean_bridge_fa450d817b39ecc8598f3607_structured_423e0c37f5780352153f2e471aebd23d81e23f74_apply(lean_object*, lean_object*);
lean_object* lean_bridge_fa450d817b39ecc8598f3607_structured_ce903715575b2b74e1c334bc071ce4eceaad0558_invoke(size_t, lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNative99d469b3ee044240_invoke__ce903715575b2b74e1c334bc071ce4eceaad0558___boxed(lean_object*, lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNative99d469b3ee044240_wrap__ce903715575b2b74e1c334bc071ce4eceaad0558___lam__0(size_t, lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNative99d469b3ee044240_wrap__ce903715575b2b74e1c334bc071ce4eceaad0558___lam__0___boxed(lean_object*, lean_object*);
LEAN_EXPORT lean_object* lean_bridge_fa450d817b39ecc8598f3607_structured_ce903715575b2b74e1c334bc071ce4eceaad0558_wrap(size_t);
LEAN_EXPORT lean_object* l_LeanBridgeNative99d469b3ee044240_wrap__ce903715575b2b74e1c334bc071ce4eceaad0558___boxed(lean_object*);
LEAN_EXPORT lean_object* lean_bridge_fa450d817b39ecc8598f3607_structured_ce903715575b2b74e1c334bc071ce4eceaad0558_apply(lean_object*, lean_object*);
LEAN_EXPORT lean_object* lean_bridge_fa450d817b39ecc8598f3607_structured_3b911dc0ceee9737631b7e83276319d96008e83d_apply(lean_object*, lean_object*);
lean_object* lean_bridge_fa450d817b39ecc8598f3607_structured_ffe59c1b227e089c6c50c0421d94e57562f09578_invoke(size_t, lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNative99d469b3ee044240_invoke__ffe59c1b227e089c6c50c0421d94e57562f09578___boxed(lean_object*, lean_object*);
lean_object* lean_bridge_fa450d817b39ecc8598f3607_structured_ffe59c1b227e089c6c50c0421d94e57562f09578_recovery(size_t);
LEAN_EXPORT lean_object* l_LeanBridgeNative99d469b3ee044240_recovery__ffe59c1b227e089c6c50c0421d94e57562f09578___boxed(lean_object*);
lean_object* lean_bridge_fa450d817b39ecc8598f3607_structured_ffe59c1b227e089c6c50c0421d94e57562f09578_reject(size_t, lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNative99d469b3ee044240_reject__ffe59c1b227e089c6c50c0421d94e57562f09578___boxed(lean_object*, lean_object*);
LEAN_EXPORT lean_object* lean_bridge_fa450d817b39ecc8598f3607_structured_ffe59c1b227e089c6c50c0421d94e57562f09578_wrap(size_t);
LEAN_EXPORT lean_object* l_LeanBridgeNative99d469b3ee044240_wrap__ffe59c1b227e089c6c50c0421d94e57562f09578___boxed(lean_object*);
lean_object* lean_bridge_fa450d817b39ecc8598f3607_structured_d8cf2e9a7b0c40482bf9414b886a3e2086ac2e4e_invoke(size_t, lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNative99d469b3ee044240_invoke__d8cf2e9a7b0c40482bf9414b886a3e2086ac2e4e___boxed(lean_object*, lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNative99d469b3ee044240_wrap__d8cf2e9a7b0c40482bf9414b886a3e2086ac2e4e___lam__0(size_t, lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNative99d469b3ee044240_wrap__d8cf2e9a7b0c40482bf9414b886a3e2086ac2e4e___lam__0___boxed(lean_object*, lean_object*);
LEAN_EXPORT lean_object* lean_bridge_fa450d817b39ecc8598f3607_structured_d8cf2e9a7b0c40482bf9414b886a3e2086ac2e4e_wrap(size_t);
LEAN_EXPORT lean_object* l_LeanBridgeNative99d469b3ee044240_wrap__d8cf2e9a7b0c40482bf9414b886a3e2086ac2e4e___boxed(lean_object*);
LEAN_EXPORT lean_object* lean_bridge_fa450d817b39ecc8598f3607_structured_d8cf2e9a7b0c40482bf9414b886a3e2086ac2e4e_apply(lean_object*, lean_object*);
lean_object* lean_bridge_fa450d817b39ecc8598f3607_structured_8a8a1e0d7d82df3b4bfabb94f5d59f8bf4b9ed1d_invoke(size_t, lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNative99d469b3ee044240_invoke__8a8a1e0d7d82df3b4bfabb94f5d59f8bf4b9ed1d___boxed(lean_object*, lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNative99d469b3ee044240_wrap__8a8a1e0d7d82df3b4bfabb94f5d59f8bf4b9ed1d___lam__0(size_t, lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNative99d469b3ee044240_wrap__8a8a1e0d7d82df3b4bfabb94f5d59f8bf4b9ed1d___lam__0___boxed(lean_object*, lean_object*);
LEAN_EXPORT lean_object* lean_bridge_fa450d817b39ecc8598f3607_structured_8a8a1e0d7d82df3b4bfabb94f5d59f8bf4b9ed1d_wrap(size_t);
LEAN_EXPORT lean_object* l_LeanBridgeNative99d469b3ee044240_wrap__8a8a1e0d7d82df3b4bfabb94f5d59f8bf4b9ed1d___boxed(lean_object*);
LEAN_EXPORT lean_object* lean_bridge_fa450d817b39ecc8598f3607_structured_8a8a1e0d7d82df3b4bfabb94f5d59f8bf4b9ed1d_apply(lean_object*, lean_object*);
LEAN_EXPORT lean_object* lean_bridge_fa450d817b39ecc8598f3607_lean(lean_object*, lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNative99d469b3ee044240_export1___lam__0(lean_object*, lean_object*);
static lean_once_cell_t l_LeanBridgeNative99d469b3ee044240_export1___closed__0_once = LEAN_ONCE_CELL_INITIALIZER;
static lean_object* l_LeanBridgeNative99d469b3ee044240_export1___closed__0;
LEAN_EXPORT lean_object* lean_bridge_53b0de0e75e4c429aaad48c8_lean(lean_object*);
LEAN_EXPORT lean_object* l___private_Init_Data_Array_Basic_0__Array_mapMUnsafe_map___at___00LeanBridgeNative99d469b3ee044240_export2_spec__0(size_t, size_t, lean_object*);
LEAN_EXPORT lean_object* l___private_Init_Data_Array_Basic_0__Array_mapMUnsafe_map___at___00LeanBridgeNative99d469b3ee044240_export2_spec__0___boxed(lean_object*, lean_object*, lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNative99d469b3ee044240_export2___lam__0(lean_object*);
static lean_once_cell_t l_LeanBridgeNative99d469b3ee044240_export2___closed__0_once = LEAN_ONCE_CELL_INITIALIZER;
static lean_object* l_LeanBridgeNative99d469b3ee044240_export2___closed__0;
static const lean_closure_object l_LeanBridgeNative99d469b3ee044240_export2___closed__1_value = {.m_header = {.m_rc = 0, .m_cs_sz = sizeof(lean_closure_object) + sizeof(void*)*0, .m_other = 0, .m_tag = 245}, .m_fun = (void*)l_LeanBridgeNative99d469b3ee044240_export2___lam__0, .m_arity = 1, .m_num_fixed = 0, .m_objs = {} };
static const lean_object* l_LeanBridgeNative99d469b3ee044240_export2___closed__1 = (const lean_object*)&l_LeanBridgeNative99d469b3ee044240_export2___closed__1_value;
static const lean_ctor_object l_LeanBridgeNative99d469b3ee044240_export2___closed__2_value = {.m_header = {.m_rc = 0, .m_cs_sz = sizeof(lean_ctor_object) + sizeof(void*)*1 + 0, .m_other = 1, .m_tag = 1}, .m_objs = {((lean_object*)&l_LeanBridgeNative99d469b3ee044240_export2___closed__1_value)}};
static const lean_object* l_LeanBridgeNative99d469b3ee044240_export2___closed__2 = (const lean_object*)&l_LeanBridgeNative99d469b3ee044240_export2___closed__2_value;
static lean_once_cell_t l_LeanBridgeNative99d469b3ee044240_export2___closed__3_once = LEAN_ONCE_CELL_INITIALIZER;
static lean_object* l_LeanBridgeNative99d469b3ee044240_export2___closed__3;
LEAN_EXPORT lean_object* lean_bridge_8477254b8ea47a726adc68ad_lean(lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNative99d469b3ee044240_export3___lam__0(lean_object*, lean_object*);
LEAN_EXPORT lean_object* lean_bridge_fb3aeed37b46e0e2a78ba51c_lean(lean_object*);
LEAN_EXPORT uint8_t lean_bridge_2f9e82778120400da600fcee_refinement_1(lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNative99d469b3ee044240_export4__refinement__1___boxed(lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNative99d469b3ee044240_export4___lam__0(lean_object*, size_t, lean_object*, lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNative99d469b3ee044240_export4___lam__0___boxed(lean_object*, lean_object*, lean_object*, lean_object*);
LEAN_EXPORT lean_object* lean_bridge_2f9e82778120400da600fcee_lean(lean_object*, lean_object*);
static lean_once_cell_t l_LeanBridgeNative99d469b3ee044240_export5___closed__0_once = LEAN_ONCE_CELL_INITIALIZER;
static lean_object* l_LeanBridgeNative99d469b3ee044240_export5___closed__0;
LEAN_EXPORT lean_object* lean_bridge_e429d90b6e2575f2175e6951_lean(lean_object*);
static lean_once_cell_t l_LeanBridgeNative99d469b3ee044240_export6___closed__0_once = LEAN_ONCE_CELL_INITIALIZER;
static lean_object* l_LeanBridgeNative99d469b3ee044240_export6___closed__0;
LEAN_EXPORT lean_object* lean_bridge_b6410c4c69dffaa409842d74_lean(lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNative99d469b3ee044240_export7___lam__0(size_t, lean_object*, lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNative99d469b3ee044240_export7___lam__0___boxed(lean_object*, lean_object*, lean_object*);
LEAN_EXPORT lean_object* lean_bridge_a4054277eb23862f1406fddb_lean(lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNative99d469b3ee044240_carrierValue___redArg(lean_object* v_value_1_){
_start:
{
lean_object* v___x_2_; lean_object* v___x_3_; uint8_t v___x_4_; 
v___x_2_ = lean_unsigned_to_nat(0u);
v___x_3_ = lean_array_get_size(v_value_1_);
v___x_4_ = lean_nat_dec_lt(v___x_2_, v___x_3_);
if (v___x_4_ == 0)
{
lean_object* v___x_5_; 
v___x_5_ = lean_box(0);
return v___x_5_;
}
else
{
lean_object* v___x_6_; uint8_t v___x_7_; 
v___x_6_ = lean_unsigned_to_nat(1u);
v___x_7_ = lean_nat_dec_eq(v___x_3_, v___x_6_);
if (v___x_7_ == 0)
{
lean_object* v___x_8_; 
v___x_8_ = lean_box(0);
return v___x_8_;
}
else
{
lean_object* v___x_9_; lean_object* v___x_10_; 
v___x_9_ = lean_array_fget_borrowed(v_value_1_, v___x_2_);
lean_inc(v___x_9_);
v___x_10_ = lean_alloc_ctor(1, 1, 0);
lean_ctor_set(v___x_10_, 0, v___x_9_);
return v___x_10_;
}
}
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNative99d469b3ee044240_carrierValue___redArg___boxed(lean_object* v_value_11_){
_start:
{
lean_object* v_res_12_; 
v_res_12_ = l_LeanBridgeNative99d469b3ee044240_carrierValue___redArg(v_value_11_);
lean_dec_ref(v_value_11_);
return v_res_12_;
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNative99d469b3ee044240_carrierValue(lean_object* v_00_u03b1_13_, lean_object* v_value_14_){
_start:
{
lean_object* v___x_15_; 
v___x_15_ = l_LeanBridgeNative99d469b3ee044240_carrierValue___redArg(v_value_14_);
return v___x_15_;
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNative99d469b3ee044240_carrierValue___boxed(lean_object* v_00_u03b1_16_, lean_object* v_value_17_){
_start:
{
lean_object* v_res_18_; 
v_res_18_ = l_LeanBridgeNative99d469b3ee044240_carrierValue(v_00_u03b1_16_, v_value_17_);
lean_dec_ref(v_value_17_);
return v_res_18_;
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNative99d469b3ee044240_carrierResult___redArg(lean_object* v_value_21_){
_start:
{
if (lean_obj_tag(v_value_21_) == 0)
{
lean_object* v___x_22_; 
v___x_22_ = ((lean_object*)(l_LeanBridgeNative99d469b3ee044240_carrierResult___redArg___closed__0));
return v___x_22_;
}
else
{
lean_object* v_val_23_; lean_object* v___x_24_; lean_object* v___x_25_; lean_object* v___x_26_; 
v_val_23_ = lean_ctor_get(v_value_21_, 0);
lean_inc(v_val_23_);
lean_dec_ref_known(v_value_21_, 1);
v___x_24_ = lean_unsigned_to_nat(1u);
v___x_25_ = lean_mk_empty_array_with_capacity(v___x_24_);
v___x_26_ = lean_array_push(v___x_25_, v_val_23_);
return v___x_26_;
}
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNative99d469b3ee044240_carrierResult(lean_object* v_00_u03b1_27_, lean_object* v_value_28_){
_start:
{
lean_object* v___x_29_; 
v___x_29_ = l_LeanBridgeNative99d469b3ee044240_carrierResult___redArg(v_value_28_);
return v___x_29_;
}
}
LEAN_EXPORT lean_object* l___private_Init_Data_Array_Basic_0__Array_forIn_x27Unsafe_loop___at___00LeanBridgeNative99d469b3ee044240_carrierCollect_spec__0___redArg(lean_object* v_as_32_, size_t v_sz_33_, size_t v_i_34_, lean_object* v_b_35_){
_start:
{
uint8_t v___x_36_; 
v___x_36_ = lean_usize_dec_lt(v_i_34_, v_sz_33_);
if (v___x_36_ == 0)
{
return v_b_35_;
}
else
{
lean_object* v_snd_37_; lean_object* v___x_39_; uint8_t v_isShared_40_; uint8_t v_isSharedCheck_56_; 
v_snd_37_ = lean_ctor_get(v_b_35_, 1);
v_isSharedCheck_56_ = !lean_is_exclusive(v_b_35_);
if (v_isSharedCheck_56_ == 0)
{
lean_object* v_unused_57_; 
v_unused_57_ = lean_ctor_get(v_b_35_, 0);
lean_dec(v_unused_57_);
v___x_39_ = v_b_35_;
v_isShared_40_ = v_isSharedCheck_56_;
goto v_resetjp_38_;
}
else
{
lean_inc(v_snd_37_);
lean_dec(v_b_35_);
v___x_39_ = lean_box(0);
v_isShared_40_ = v_isSharedCheck_56_;
goto v_resetjp_38_;
}
v_resetjp_38_:
{
lean_object* v_a_41_; lean_object* v___x_42_; 
v_a_41_ = lean_array_uget_borrowed(v_as_32_, v_i_34_);
v___x_42_ = l_LeanBridgeNative99d469b3ee044240_carrierValue___redArg(v_a_41_);
if (lean_obj_tag(v___x_42_) == 0)
{
lean_object* v___x_43_; lean_object* v___x_45_; 
v___x_43_ = ((lean_object*)(l___private_Init_Data_Array_Basic_0__Array_forIn_x27Unsafe_loop___at___00LeanBridgeNative99d469b3ee044240_carrierCollect_spec__0___redArg___closed__0));
if (v_isShared_40_ == 0)
{
lean_ctor_set(v___x_39_, 0, v___x_43_);
v___x_45_ = v___x_39_;
goto v_reusejp_44_;
}
else
{
lean_object* v_reuseFailAlloc_46_; 
v_reuseFailAlloc_46_ = lean_alloc_ctor(0, 2, 0);
lean_ctor_set(v_reuseFailAlloc_46_, 0, v___x_43_);
lean_ctor_set(v_reuseFailAlloc_46_, 1, v_snd_37_);
v___x_45_ = v_reuseFailAlloc_46_;
goto v_reusejp_44_;
}
v_reusejp_44_:
{
return v___x_45_;
}
}
else
{
lean_object* v_val_47_; lean_object* v___x_48_; lean_object* v___x_49_; lean_object* v___x_51_; 
v_val_47_ = lean_ctor_get(v___x_42_, 0);
lean_inc(v_val_47_);
lean_dec_ref_known(v___x_42_, 1);
v___x_48_ = lean_box(0);
v___x_49_ = lean_array_push(v_snd_37_, v_val_47_);
if (v_isShared_40_ == 0)
{
lean_ctor_set(v___x_39_, 1, v___x_49_);
lean_ctor_set(v___x_39_, 0, v___x_48_);
v___x_51_ = v___x_39_;
goto v_reusejp_50_;
}
else
{
lean_object* v_reuseFailAlloc_55_; 
v_reuseFailAlloc_55_ = lean_alloc_ctor(0, 2, 0);
lean_ctor_set(v_reuseFailAlloc_55_, 0, v___x_48_);
lean_ctor_set(v_reuseFailAlloc_55_, 1, v___x_49_);
v___x_51_ = v_reuseFailAlloc_55_;
goto v_reusejp_50_;
}
v_reusejp_50_:
{
size_t v___x_52_; size_t v___x_53_; 
v___x_52_ = ((size_t)1ULL);
v___x_53_ = lean_usize_add(v_i_34_, v___x_52_);
v_i_34_ = v___x_53_;
v_b_35_ = v___x_51_;
goto _start;
}
}
}
}
}
}
LEAN_EXPORT lean_object* l___private_Init_Data_Array_Basic_0__Array_forIn_x27Unsafe_loop___at___00LeanBridgeNative99d469b3ee044240_carrierCollect_spec__0___redArg___boxed(lean_object* v_as_58_, lean_object* v_sz_59_, lean_object* v_i_60_, lean_object* v_b_61_){
_start:
{
size_t v_sz_boxed_62_; size_t v_i_boxed_63_; lean_object* v_res_64_; 
v_sz_boxed_62_ = lean_unbox_usize(v_sz_59_);
lean_dec(v_sz_59_);
v_i_boxed_63_ = lean_unbox_usize(v_i_60_);
lean_dec(v_i_60_);
v_res_64_ = l___private_Init_Data_Array_Basic_0__Array_forIn_x27Unsafe_loop___at___00LeanBridgeNative99d469b3ee044240_carrierCollect_spec__0___redArg(v_as_58_, v_sz_boxed_62_, v_i_boxed_63_, v_b_61_);
lean_dec_ref(v_as_58_);
return v_res_64_;
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNative99d469b3ee044240_carrierCollect___redArg(lean_object* v_values_68_){
_start:
{
lean_object* v___x_69_; lean_object* v___x_70_; uint8_t v___x_71_; 
v___x_69_ = lean_unsigned_to_nat(262144u);
v___x_70_ = lean_array_get_size(v_values_68_);
v___x_71_ = lean_nat_dec_lt(v___x_69_, v___x_70_);
if (v___x_71_ == 0)
{
lean_object* v___x_72_; size_t v_sz_73_; size_t v___x_74_; lean_object* v___x_75_; lean_object* v_fst_76_; 
v___x_72_ = ((lean_object*)(l_LeanBridgeNative99d469b3ee044240_carrierCollect___redArg___closed__0));
v_sz_73_ = lean_array_size(v_values_68_);
v___x_74_ = ((size_t)0ULL);
v___x_75_ = l___private_Init_Data_Array_Basic_0__Array_forIn_x27Unsafe_loop___at___00LeanBridgeNative99d469b3ee044240_carrierCollect_spec__0___redArg(v_values_68_, v_sz_73_, v___x_74_, v___x_72_);
v_fst_76_ = lean_ctor_get(v___x_75_, 0);
lean_inc(v_fst_76_);
if (lean_obj_tag(v_fst_76_) == 0)
{
lean_object* v_snd_77_; lean_object* v___x_78_; 
v_snd_77_ = lean_ctor_get(v___x_75_, 1);
lean_inc(v_snd_77_);
lean_dec_ref(v___x_75_);
v___x_78_ = lean_alloc_ctor(1, 1, 0);
lean_ctor_set(v___x_78_, 0, v_snd_77_);
return v___x_78_;
}
else
{
lean_object* v_val_79_; 
lean_dec_ref(v___x_75_);
v_val_79_ = lean_ctor_get(v_fst_76_, 0);
lean_inc(v_val_79_);
lean_dec_ref_known(v_fst_76_, 1);
return v_val_79_;
}
}
else
{
lean_object* v___x_80_; 
v___x_80_ = lean_box(0);
return v___x_80_;
}
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNative99d469b3ee044240_carrierCollect___redArg___boxed(lean_object* v_values_81_){
_start:
{
lean_object* v_res_82_; 
v_res_82_ = l_LeanBridgeNative99d469b3ee044240_carrierCollect___redArg(v_values_81_);
lean_dec_ref(v_values_81_);
return v_res_82_;
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNative99d469b3ee044240_carrierCollect(lean_object* v_00_u03b1_83_, lean_object* v_values_84_){
_start:
{
lean_object* v___x_85_; 
v___x_85_ = l_LeanBridgeNative99d469b3ee044240_carrierCollect___redArg(v_values_84_);
return v___x_85_;
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNative99d469b3ee044240_carrierCollect___boxed(lean_object* v_00_u03b1_86_, lean_object* v_values_87_){
_start:
{
lean_object* v_res_88_; 
v_res_88_ = l_LeanBridgeNative99d469b3ee044240_carrierCollect(v_00_u03b1_86_, v_values_87_);
lean_dec_ref(v_values_87_);
return v_res_88_;
}
}
LEAN_EXPORT lean_object* l___private_Init_Data_Array_Basic_0__Array_forIn_x27Unsafe_loop___at___00LeanBridgeNative99d469b3ee044240_carrierCollect_spec__0(lean_object* v_00_u03b1_89_, lean_object* v_as_90_, size_t v_sz_91_, size_t v_i_92_, lean_object* v_b_93_){
_start:
{
lean_object* v___x_94_; 
v___x_94_ = l___private_Init_Data_Array_Basic_0__Array_forIn_x27Unsafe_loop___at___00LeanBridgeNative99d469b3ee044240_carrierCollect_spec__0___redArg(v_as_90_, v_sz_91_, v_i_92_, v_b_93_);
return v___x_94_;
}
}
LEAN_EXPORT lean_object* l___private_Init_Data_Array_Basic_0__Array_forIn_x27Unsafe_loop___at___00LeanBridgeNative99d469b3ee044240_carrierCollect_spec__0___boxed(lean_object* v_00_u03b1_95_, lean_object* v_as_96_, lean_object* v_sz_97_, lean_object* v_i_98_, lean_object* v_b_99_){
_start:
{
size_t v_sz_boxed_100_; size_t v_i_boxed_101_; lean_object* v_res_102_; 
v_sz_boxed_100_ = lean_unbox_usize(v_sz_97_);
lean_dec(v_sz_97_);
v_i_boxed_101_ = lean_unbox_usize(v_i_98_);
lean_dec(v_i_98_);
v_res_102_ = l___private_Init_Data_Array_Basic_0__Array_forIn_x27Unsafe_loop___at___00LeanBridgeNative99d469b3ee044240_carrierCollect_spec__0(v_00_u03b1_95_, v_as_96_, v_sz_boxed_100_, v_i_boxed_101_, v_b_99_);
lean_dec_ref(v_as_96_);
return v_res_102_;
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNative99d469b3ee044240_carrierListItems_loop___redArg(lean_object* v_a_103_, lean_object* v_a_104_, lean_object* v_a_105_){
_start:
{
lean_object* v_zero_106_; uint8_t v_isZero_107_; 
v_zero_106_ = lean_unsigned_to_nat(0u);
v_isZero_107_ = lean_nat_dec_eq(v_a_103_, v_zero_106_);
if (v_isZero_107_ == 1)
{
lean_dec(v_a_104_);
lean_dec(v_a_103_);
return v_a_105_;
}
else
{
if (lean_obj_tag(v_a_104_) == 0)
{
lean_dec(v_a_103_);
return v_a_105_;
}
else
{
lean_object* v_head_108_; lean_object* v_tail_109_; lean_object* v_one_110_; lean_object* v_n_111_; lean_object* v___x_112_; lean_object* v___x_113_; lean_object* v___x_114_; 
v_head_108_ = lean_ctor_get(v_a_104_, 0);
lean_inc(v_head_108_);
v_tail_109_ = lean_ctor_get(v_a_104_, 1);
lean_inc(v_tail_109_);
lean_dec_ref_known(v_a_104_, 2);
v_one_110_ = lean_unsigned_to_nat(1u);
v_n_111_ = lean_nat_sub(v_a_103_, v_one_110_);
lean_dec(v_a_103_);
v___x_112_ = lean_mk_empty_array_with_capacity(v_one_110_);
v___x_113_ = lean_array_push(v___x_112_, v_head_108_);
v___x_114_ = lean_array_push(v_a_105_, v___x_113_);
v_a_103_ = v_n_111_;
v_a_104_ = v_tail_109_;
v_a_105_ = v___x_114_;
goto _start;
}
}
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNative99d469b3ee044240_carrierListItems_loop(lean_object* v_00_u03b1_116_, lean_object* v_a_117_, lean_object* v_a_118_, lean_object* v_a_119_){
_start:
{
lean_object* v___x_120_; 
v___x_120_ = l_LeanBridgeNative99d469b3ee044240_carrierListItems_loop___redArg(v_a_117_, v_a_118_, v_a_119_);
return v___x_120_;
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNative99d469b3ee044240_carrierListItems___redArg(lean_object* v_values_123_){
_start:
{
lean_object* v___x_124_; lean_object* v___x_125_; lean_object* v___x_126_; 
v___x_124_ = lean_unsigned_to_nat(262145u);
v___x_125_ = ((lean_object*)(l_LeanBridgeNative99d469b3ee044240_carrierListItems___redArg___closed__0));
v___x_126_ = l_LeanBridgeNative99d469b3ee044240_carrierListItems_loop___redArg(v___x_124_, v_values_123_, v___x_125_);
return v___x_126_;
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNative99d469b3ee044240_carrierListItems(lean_object* v_00_u03b1_127_, lean_object* v_values_128_){
_start:
{
lean_object* v___x_129_; 
v___x_129_ = l_LeanBridgeNative99d469b3ee044240_carrierListItems___redArg(v_values_128_);
return v___x_129_;
}
}
static lean_object* _init_l_LeanBridgeNative99d469b3ee044240_makeb80133b771640d801c25___closed__0(void){
_start:
{
lean_object* v___x_130_; lean_object* v___x_131_; 
v___x_130_ = lean_box(0);
v___x_131_ = l_LeanBridgeNative99d469b3ee044240_carrierResult___redArg(v___x_130_);
return v___x_131_;
}
}
LEAN_EXPORT lean_object* lean_bridge_fa450d817b39ecc8598f3607_recursive_b80133b771640d801c25_make(lean_object* v_a0_132_, lean_object* v_a1_133_){
_start:
{
lean_object* v___x_134_; 
v___x_134_ = l_LeanBridgeNative99d469b3ee044240_carrierValue___redArg(v_a0_132_);
lean_dec_ref(v_a0_132_);
if (lean_obj_tag(v___x_134_) == 0)
{
lean_object* v___x_135_; 
lean_dec_ref(v_a1_133_);
v___x_135_ = lean_obj_once(&l_LeanBridgeNative99d469b3ee044240_makeb80133b771640d801c25___closed__0, &l_LeanBridgeNative99d469b3ee044240_makeb80133b771640d801c25___closed__0_once, _init_l_LeanBridgeNative99d469b3ee044240_makeb80133b771640d801c25___closed__0);
return v___x_135_;
}
else
{
lean_object* v_val_136_; lean_object* v___x_137_; 
v_val_136_ = lean_ctor_get(v___x_134_, 0);
lean_inc(v_val_136_);
lean_dec_ref_known(v___x_134_, 1);
v___x_137_ = l_LeanBridgeNative99d469b3ee044240_carrierValue___redArg(v_a1_133_);
lean_dec_ref(v_a1_133_);
if (lean_obj_tag(v___x_137_) == 0)
{
lean_object* v___x_138_; 
lean_dec(v_val_136_);
v___x_138_ = lean_obj_once(&l_LeanBridgeNative99d469b3ee044240_makeb80133b771640d801c25___closed__0, &l_LeanBridgeNative99d469b3ee044240_makeb80133b771640d801c25___closed__0_once, _init_l_LeanBridgeNative99d469b3ee044240_makeb80133b771640d801c25___closed__0);
return v___x_138_;
}
else
{
lean_object* v_val_139_; lean_object* v___x_141_; uint8_t v_isShared_142_; uint8_t v_isSharedCheck_151_; 
v_val_139_ = lean_ctor_get(v___x_137_, 0);
v_isSharedCheck_151_ = !lean_is_exclusive(v___x_137_);
if (v_isSharedCheck_151_ == 0)
{
v___x_141_ = v___x_137_;
v_isShared_142_ = v_isSharedCheck_151_;
goto v_resetjp_140_;
}
else
{
lean_inc(v_val_139_);
lean_dec(v___x_137_);
v___x_141_ = lean_box(0);
v_isShared_142_ = v_isSharedCheck_151_;
goto v_resetjp_140_;
}
v_resetjp_140_:
{
lean_object* v___x_143_; uint8_t v___x_144_; 
v___x_143_ = lean_unsigned_to_nat(5u);
v___x_144_ = lean_nat_dec_lt(v_val_136_, v___x_143_);
if (v___x_144_ == 0)
{
lean_object* v___x_145_; 
lean_del_object(v___x_141_);
lean_dec(v_val_139_);
lean_dec(v_val_136_);
v___x_145_ = lean_obj_once(&l_LeanBridgeNative99d469b3ee044240_makeb80133b771640d801c25___closed__0, &l_LeanBridgeNative99d469b3ee044240_makeb80133b771640d801c25___closed__0_once, _init_l_LeanBridgeNative99d469b3ee044240_makeb80133b771640d801c25___closed__0);
return v___x_145_;
}
else
{
lean_object* v___x_146_; lean_object* v___x_148_; 
v___x_146_ = lean_alloc_ctor(0, 2, 0);
lean_ctor_set(v___x_146_, 0, v_val_136_);
lean_ctor_set(v___x_146_, 1, v_val_139_);
if (v_isShared_142_ == 0)
{
lean_ctor_set(v___x_141_, 0, v___x_146_);
v___x_148_ = v___x_141_;
goto v_reusejp_147_;
}
else
{
lean_object* v_reuseFailAlloc_150_; 
v_reuseFailAlloc_150_ = lean_alloc_ctor(1, 1, 0);
lean_ctor_set(v_reuseFailAlloc_150_, 0, v___x_146_);
v___x_148_ = v_reuseFailAlloc_150_;
goto v_reusejp_147_;
}
v_reusejp_147_:
{
lean_object* v___x_149_; 
v___x_149_ = l_LeanBridgeNative99d469b3ee044240_carrierResult___redArg(v___x_148_);
return v___x_149_;
}
}
}
}
}
}
}
static lean_object* _init_l_LeanBridgeNative99d469b3ee044240_field0b80133b771640d801c25___closed__0(void){
_start:
{
lean_object* v___x_152_; lean_object* v___x_153_; 
v___x_152_ = lean_box(0);
v___x_153_ = l_LeanBridgeNative99d469b3ee044240_carrierResult___redArg(v___x_152_);
return v___x_153_;
}
}
LEAN_EXPORT lean_object* lean_bridge_fa450d817b39ecc8598f3607_recursive_b80133b771640d801c25_field0(lean_object* v_value_154_){
_start:
{
lean_object* v___x_155_; 
v___x_155_ = l_LeanBridgeNative99d469b3ee044240_carrierValue___redArg(v_value_154_);
lean_dec_ref(v_value_154_);
if (lean_obj_tag(v___x_155_) == 0)
{
lean_object* v___x_156_; 
v___x_156_ = lean_obj_once(&l_LeanBridgeNative99d469b3ee044240_field0b80133b771640d801c25___closed__0, &l_LeanBridgeNative99d469b3ee044240_field0b80133b771640d801c25___closed__0_once, _init_l_LeanBridgeNative99d469b3ee044240_field0b80133b771640d801c25___closed__0);
return v___x_156_;
}
else
{
lean_object* v_val_157_; lean_object* v___x_159_; uint8_t v_isShared_160_; uint8_t v_isSharedCheck_166_; 
v_val_157_ = lean_ctor_get(v___x_155_, 0);
v_isSharedCheck_166_ = !lean_is_exclusive(v___x_155_);
if (v_isSharedCheck_166_ == 0)
{
v___x_159_ = v___x_155_;
v_isShared_160_ = v_isSharedCheck_166_;
goto v_resetjp_158_;
}
else
{
lean_inc(v_val_157_);
lean_dec(v___x_155_);
v___x_159_ = lean_box(0);
v_isShared_160_ = v_isSharedCheck_166_;
goto v_resetjp_158_;
}
v_resetjp_158_:
{
lean_object* v_digit_161_; lean_object* v___x_163_; 
v_digit_161_ = lean_ctor_get(v_val_157_, 0);
lean_inc(v_digit_161_);
lean_dec(v_val_157_);
if (v_isShared_160_ == 0)
{
lean_ctor_set(v___x_159_, 0, v_digit_161_);
v___x_163_ = v___x_159_;
goto v_reusejp_162_;
}
else
{
lean_object* v_reuseFailAlloc_165_; 
v_reuseFailAlloc_165_ = lean_alloc_ctor(1, 1, 0);
lean_ctor_set(v_reuseFailAlloc_165_, 0, v_digit_161_);
v___x_163_ = v_reuseFailAlloc_165_;
goto v_reusejp_162_;
}
v_reusejp_162_:
{
lean_object* v___x_164_; 
v___x_164_ = l_LeanBridgeNative99d469b3ee044240_carrierResult___redArg(v___x_163_);
return v___x_164_;
}
}
}
}
}
LEAN_EXPORT lean_object* lean_bridge_fa450d817b39ecc8598f3607_recursive_b80133b771640d801c25_field1(lean_object* v_value_167_){
_start:
{
lean_object* v___x_168_; 
v___x_168_ = l_LeanBridgeNative99d469b3ee044240_carrierValue___redArg(v_value_167_);
lean_dec_ref(v_value_167_);
if (lean_obj_tag(v___x_168_) == 0)
{
lean_object* v___x_169_; 
v___x_169_ = lean_obj_once(&l_LeanBridgeNative99d469b3ee044240_field0b80133b771640d801c25___closed__0, &l_LeanBridgeNative99d469b3ee044240_field0b80133b771640d801c25___closed__0_once, _init_l_LeanBridgeNative99d469b3ee044240_field0b80133b771640d801c25___closed__0);
return v___x_169_;
}
else
{
lean_object* v_val_170_; lean_object* v___x_172_; uint8_t v_isShared_173_; uint8_t v_isSharedCheck_179_; 
v_val_170_ = lean_ctor_get(v___x_168_, 0);
v_isSharedCheck_179_ = !lean_is_exclusive(v___x_168_);
if (v_isSharedCheck_179_ == 0)
{
v___x_172_ = v___x_168_;
v_isShared_173_ = v_isSharedCheck_179_;
goto v_resetjp_171_;
}
else
{
lean_inc(v_val_170_);
lean_dec(v___x_168_);
v___x_172_ = lean_box(0);
v_isShared_173_ = v_isSharedCheck_179_;
goto v_resetjp_171_;
}
v_resetjp_171_:
{
lean_object* v_count_174_; lean_object* v___x_176_; 
v_count_174_ = lean_ctor_get(v_val_170_, 1);
lean_inc(v_count_174_);
lean_dec(v_val_170_);
if (v_isShared_173_ == 0)
{
lean_ctor_set(v___x_172_, 0, v_count_174_);
v___x_176_ = v___x_172_;
goto v_reusejp_175_;
}
else
{
lean_object* v_reuseFailAlloc_178_; 
v_reuseFailAlloc_178_ = lean_alloc_ctor(1, 1, 0);
lean_ctor_set(v_reuseFailAlloc_178_, 0, v_count_174_);
v___x_176_ = v_reuseFailAlloc_178_;
goto v_reusejp_175_;
}
v_reusejp_175_:
{
lean_object* v___x_177_; 
v___x_177_ = l_LeanBridgeNative99d469b3ee044240_carrierResult___redArg(v___x_176_);
return v___x_177_;
}
}
}
}
}
static lean_object* _init_l_LeanBridgeNative99d469b3ee044240_makeec759c31d2054a0d5114___closed__0(void){
_start:
{
lean_object* v___x_180_; lean_object* v___x_181_; 
v___x_180_ = lean_box(0);
v___x_181_ = l_LeanBridgeNative99d469b3ee044240_carrierResult___redArg(v___x_180_);
return v___x_181_;
}
}
LEAN_EXPORT lean_object* lean_bridge_fa450d817b39ecc8598f3607_recursive_ec759c31d2054a0d5114_make(lean_object* v_values_182_){
_start:
{
lean_object* v___x_183_; 
v___x_183_ = l_LeanBridgeNative99d469b3ee044240_carrierCollect___redArg(v_values_182_);
lean_dec_ref(v_values_182_);
if (lean_obj_tag(v___x_183_) == 0)
{
lean_object* v___x_184_; 
v___x_184_ = lean_obj_once(&l_LeanBridgeNative99d469b3ee044240_makeec759c31d2054a0d5114___closed__0, &l_LeanBridgeNative99d469b3ee044240_makeec759c31d2054a0d5114___closed__0_once, _init_l_LeanBridgeNative99d469b3ee044240_makeec759c31d2054a0d5114___closed__0);
return v___x_184_;
}
else
{
lean_object* v_val_185_; lean_object* v___x_187_; uint8_t v_isShared_188_; uint8_t v_isSharedCheck_194_; 
v_val_185_ = lean_ctor_get(v___x_183_, 0);
v_isSharedCheck_194_ = !lean_is_exclusive(v___x_183_);
if (v_isSharedCheck_194_ == 0)
{
v___x_187_ = v___x_183_;
v_isShared_188_ = v_isSharedCheck_194_;
goto v_resetjp_186_;
}
else
{
lean_inc(v_val_185_);
lean_dec(v___x_183_);
v___x_187_ = lean_box(0);
v_isShared_188_ = v_isSharedCheck_194_;
goto v_resetjp_186_;
}
v_resetjp_186_:
{
lean_object* v___x_189_; lean_object* v___x_191_; 
v___x_189_ = lean_array_to_list(v_val_185_);
if (v_isShared_188_ == 0)
{
lean_ctor_set(v___x_187_, 0, v___x_189_);
v___x_191_ = v___x_187_;
goto v_reusejp_190_;
}
else
{
lean_object* v_reuseFailAlloc_193_; 
v_reuseFailAlloc_193_ = lean_alloc_ctor(1, 1, 0);
lean_ctor_set(v_reuseFailAlloc_193_, 0, v___x_189_);
v___x_191_ = v_reuseFailAlloc_193_;
goto v_reusejp_190_;
}
v_reusejp_190_:
{
lean_object* v___x_192_; 
v___x_192_ = l_LeanBridgeNative99d469b3ee044240_carrierResult___redArg(v___x_191_);
return v___x_192_;
}
}
}
}
}
LEAN_EXPORT lean_object* lean_bridge_fa450d817b39ecc8598f3607_recursive_ec759c31d2054a0d5114_items(lean_object* v_value_197_){
_start:
{
lean_object* v___x_198_; 
v___x_198_ = l_LeanBridgeNative99d469b3ee044240_carrierValue___redArg(v_value_197_);
lean_dec_ref(v_value_197_);
if (lean_obj_tag(v___x_198_) == 0)
{
lean_object* v___x_199_; 
v___x_199_ = ((lean_object*)(l_LeanBridgeNative99d469b3ee044240_itemsec759c31d2054a0d5114___closed__0));
return v___x_199_;
}
else
{
lean_object* v_val_200_; lean_object* v___x_201_; 
v_val_200_ = lean_ctor_get(v___x_198_, 0);
lean_inc(v_val_200_);
lean_dec_ref_known(v___x_198_, 1);
v___x_201_ = l_LeanBridgeNative99d469b3ee044240_carrierListItems___redArg(v_val_200_);
return v___x_201_;
}
}
}
LEAN_EXPORT lean_object* lean_bridge_fa450d817b39ecc8598f3607_recursive_32e4ced859935847a5f5_make(lean_object* v_values_202_){
_start:
{
lean_object* v___x_203_; lean_object* v___x_204_; 
v___x_203_ = l_LeanBridgeNative99d469b3ee044240_carrierCollect___redArg(v_values_202_);
lean_dec_ref(v_values_202_);
v___x_204_ = l_LeanBridgeNative99d469b3ee044240_carrierResult___redArg(v___x_203_);
return v___x_204_;
}
}
LEAN_EXPORT lean_object* l___private_Init_Data_Array_Basic_0__Array_mapMUnsafe_map___at___00LeanBridgeNative99d469b3ee044240_items32e4ced859935847a5f5_spec__0(size_t v_sz_205_, size_t v_i_206_, lean_object* v_bs_207_){
_start:
{
uint8_t v___x_208_; 
v___x_208_ = lean_usize_dec_lt(v_i_206_, v_sz_205_);
if (v___x_208_ == 0)
{
return v_bs_207_;
}
else
{
lean_object* v_v_209_; lean_object* v___x_210_; lean_object* v_bs_x27_211_; lean_object* v___x_212_; lean_object* v___x_213_; lean_object* v___x_214_; size_t v___x_215_; size_t v___x_216_; lean_object* v___x_217_; 
v_v_209_ = lean_array_uget(v_bs_207_, v_i_206_);
v___x_210_ = lean_unsigned_to_nat(0u);
v_bs_x27_211_ = lean_array_uset(v_bs_207_, v_i_206_, v___x_210_);
v___x_212_ = lean_unsigned_to_nat(1u);
v___x_213_ = lean_mk_empty_array_with_capacity(v___x_212_);
v___x_214_ = lean_array_push(v___x_213_, v_v_209_);
v___x_215_ = ((size_t)1ULL);
v___x_216_ = lean_usize_add(v_i_206_, v___x_215_);
v___x_217_ = lean_array_uset(v_bs_x27_211_, v_i_206_, v___x_214_);
v_i_206_ = v___x_216_;
v_bs_207_ = v___x_217_;
goto _start;
}
}
}
LEAN_EXPORT lean_object* l___private_Init_Data_Array_Basic_0__Array_mapMUnsafe_map___at___00LeanBridgeNative99d469b3ee044240_items32e4ced859935847a5f5_spec__0___boxed(lean_object* v_sz_219_, lean_object* v_i_220_, lean_object* v_bs_221_){
_start:
{
size_t v_sz_boxed_222_; size_t v_i_boxed_223_; lean_object* v_res_224_; 
v_sz_boxed_222_ = lean_unbox_usize(v_sz_219_);
lean_dec(v_sz_219_);
v_i_boxed_223_ = lean_unbox_usize(v_i_220_);
lean_dec(v_i_220_);
v_res_224_ = l___private_Init_Data_Array_Basic_0__Array_mapMUnsafe_map___at___00LeanBridgeNative99d469b3ee044240_items32e4ced859935847a5f5_spec__0(v_sz_boxed_222_, v_i_boxed_223_, v_bs_221_);
return v_res_224_;
}
}
LEAN_EXPORT lean_object* lean_bridge_fa450d817b39ecc8598f3607_recursive_32e4ced859935847a5f5_items(lean_object* v_value_227_){
_start:
{
lean_object* v___x_228_; 
v___x_228_ = l_LeanBridgeNative99d469b3ee044240_carrierValue___redArg(v_value_227_);
lean_dec_ref(v_value_227_);
if (lean_obj_tag(v___x_228_) == 0)
{
lean_object* v___x_229_; 
v___x_229_ = ((lean_object*)(l_LeanBridgeNative99d469b3ee044240_items32e4ced859935847a5f5___closed__0));
return v___x_229_;
}
else
{
lean_object* v_val_230_; lean_object* v___x_231_; lean_object* v___x_232_; lean_object* v___x_233_; size_t v_sz_234_; size_t v___x_235_; lean_object* v___x_236_; 
v_val_230_ = lean_ctor_get(v___x_228_, 0);
lean_inc(v_val_230_);
lean_dec_ref_known(v___x_228_, 1);
v___x_231_ = lean_unsigned_to_nat(0u);
v___x_232_ = lean_unsigned_to_nat(262145u);
v___x_233_ = l_Array_extract___redArg(v_val_230_, v___x_231_, v___x_232_);
lean_dec(v_val_230_);
v_sz_234_ = lean_array_size(v___x_233_);
v___x_235_ = ((size_t)0ULL);
v___x_236_ = l___private_Init_Data_Array_Basic_0__Array_mapMUnsafe_map___at___00LeanBridgeNative99d469b3ee044240_items32e4ced859935847a5f5_spec__0(v_sz_234_, v___x_235_, v___x_233_);
return v___x_236_;
}
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNative99d469b3ee044240_invoke__1c8c62ab9d1ea80d3641b41193c41bc6de9a3096___boxed(lean_object* v_token_242_, lean_object* v_a0_243_){
_start:
{
size_t v_token_boxed_244_; lean_object* v_res_245_; 
v_token_boxed_244_ = lean_unbox_usize(v_token_242_);
lean_dec(v_token_242_);
v_res_245_ = lean_bridge_fa450d817b39ecc8598f3607_structured_1c8c62ab9d1ea80d3641b41193c41bc6de9a3096_invoke(v_token_boxed_244_, v_a0_243_);
return v_res_245_;
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNative99d469b3ee044240_recovery__1c8c62ab9d1ea80d3641b41193c41bc6de9a3096___boxed(lean_object* v_token_247_){
_start:
{
size_t v_token_boxed_248_; lean_object* v_res_249_; 
v_token_boxed_248_ = lean_unbox_usize(v_token_247_);
lean_dec(v_token_247_);
v_res_249_ = lean_bridge_fa450d817b39ecc8598f3607_structured_1c8c62ab9d1ea80d3641b41193c41bc6de9a3096_recovery(v_token_boxed_248_);
return v_res_249_;
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNative99d469b3ee044240_reject__1c8c62ab9d1ea80d3641b41193c41bc6de9a3096___boxed(lean_object* v_token_252_, lean_object* v_recovery_253_){
_start:
{
size_t v_token_boxed_254_; lean_object* v_res_255_; 
v_token_boxed_254_ = lean_unbox_usize(v_token_252_);
lean_dec(v_token_252_);
v_res_255_ = lean_bridge_fa450d817b39ecc8598f3607_structured_1c8c62ab9d1ea80d3641b41193c41bc6de9a3096_reject(v_token_boxed_254_, v_recovery_253_);
return v_res_255_;
}
}
LEAN_EXPORT lean_object* lean_bridge_fa450d817b39ecc8598f3607_structured_1c8c62ab9d1ea80d3641b41193c41bc6de9a3096_wrap(size_t v_token_256_){
_start:
{
lean_object* v___x_257_; lean_object* v___x_258_; lean_object* v___x_259_; lean_object* v___x_260_; 
v___x_257_ = lean_unsigned_to_nat(1u);
v___x_258_ = lean_mk_empty_array_with_capacity(v___x_257_);
v___x_259_ = lean_box_usize(v_token_256_);
v___x_260_ = lean_array_push(v___x_258_, v___x_259_);
return v___x_260_;
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNative99d469b3ee044240_wrap__1c8c62ab9d1ea80d3641b41193c41bc6de9a3096___boxed(lean_object* v_token_261_){
_start:
{
size_t v_token_boxed_262_; lean_object* v_res_263_; 
v_token_boxed_262_ = lean_unbox_usize(v_token_261_);
lean_dec(v_token_261_);
v_res_263_ = lean_bridge_fa450d817b39ecc8598f3607_structured_1c8c62ab9d1ea80d3641b41193c41bc6de9a3096_wrap(v_token_boxed_262_);
return v_res_263_;
}
}
LEAN_EXPORT lean_object* lean_bridge_fa450d817b39ecc8598f3607_structured_c9f9ab9808d5ed4cd9eb0c5380d7151c17138950_apply(lean_object* v_closure_264_, lean_object* v_a0_265_){
  fputs("LB_CALLBACK_ENTRY_V1 enter adapter ReviewedCallbacks.scaler:closure:lean\n", stderr);

_start:
{
lean_object* v___x_266_; 
v___x_266_ = l_LeanBridgeNative99d469b3ee044240_carrierValue___redArg(v_closure_264_);
lean_dec_ref(v_closure_264_);
if (lean_obj_tag(v___x_266_) == 0)
{
lean_object* v___x_267_; 
lean_dec_ref(v_a0_265_);
v___x_267_ = lean_obj_once(&l_LeanBridgeNative99d469b3ee044240_field0b80133b771640d801c25___closed__0, &l_LeanBridgeNative99d469b3ee044240_field0b80133b771640d801c25___closed__0_once, _init_l_LeanBridgeNative99d469b3ee044240_field0b80133b771640d801c25___closed__0);
return v___x_267_;
}
else
{
lean_object* v_val_268_; lean_object* v___x_269_; 
v_val_268_ = lean_ctor_get(v___x_266_, 0);
lean_inc(v_val_268_);
lean_dec_ref_known(v___x_266_, 1);
v___x_269_ = l_LeanBridgeNative99d469b3ee044240_carrierValue___redArg(v_a0_265_);
lean_dec_ref(v_a0_265_);
if (lean_obj_tag(v___x_269_) == 0)
{
lean_object* v___x_270_; 
lean_dec(v_val_268_);
v___x_270_ = l_LeanBridgeNative99d469b3ee044240_carrierResult___redArg(v___x_269_);
return v___x_270_;
}
else
{
lean_object* v_val_271_; lean_object* v___x_272_; lean_object* v___x_273_; 
v_val_271_ = lean_ctor_get(v___x_269_, 0);
lean_inc(v_val_271_);
lean_dec_ref_known(v___x_269_, 1);
v___x_272_ = lean_apply_1(v_val_268_, v_val_271_);
v___x_273_ = l_LeanBridgeNative99d469b3ee044240_carrierResult___redArg(v___x_272_);
return v___x_273_;
}
}
}
}
LEAN_EXPORT lean_object* lean_bridge_fa450d817b39ecc8598f3607_structured_423e0c37f5780352153f2e471aebd23d81e23f74_apply(lean_object* v_closure_274_, lean_object* v_a0_275_){
_start:
{
lean_object* v___x_276_; 
v___x_276_ = l_LeanBridgeNative99d469b3ee044240_carrierValue___redArg(v_closure_274_);
lean_dec_ref(v_closure_274_);
if (lean_obj_tag(v___x_276_) == 0)
{
lean_object* v___x_277_; 
lean_dec_ref(v_a0_275_);
v___x_277_ = lean_obj_once(&l_LeanBridgeNative99d469b3ee044240_field0b80133b771640d801c25___closed__0, &l_LeanBridgeNative99d469b3ee044240_field0b80133b771640d801c25___closed__0_once, _init_l_LeanBridgeNative99d469b3ee044240_field0b80133b771640d801c25___closed__0);
return v___x_277_;
}
else
{
lean_object* v_val_278_; lean_object* v___x_279_; 
v_val_278_ = lean_ctor_get(v___x_276_, 0);
lean_inc(v_val_278_);
lean_dec_ref_known(v___x_276_, 1);
v___x_279_ = l_LeanBridgeNative99d469b3ee044240_carrierValue___redArg(v_a0_275_);
lean_dec_ref(v_a0_275_);
if (lean_obj_tag(v___x_279_) == 0)
{
lean_object* v___x_280_; 
lean_dec(v_val_278_);
v___x_280_ = lean_obj_once(&l_LeanBridgeNative99d469b3ee044240_field0b80133b771640d801c25___closed__0, &l_LeanBridgeNative99d469b3ee044240_field0b80133b771640d801c25___closed__0_once, _init_l_LeanBridgeNative99d469b3ee044240_field0b80133b771640d801c25___closed__0);
return v___x_280_;
}
else
{
lean_object* v_val_281_; lean_object* v___x_282_; lean_object* v___x_283_; 
v_val_281_ = lean_ctor_get(v___x_279_, 0);
lean_inc(v_val_281_);
lean_dec_ref_known(v___x_279_, 1);
v___x_282_ = lean_apply_1(v_val_278_, v_val_281_);
v___x_283_ = l_LeanBridgeNative99d469b3ee044240_carrierResult___redArg(v___x_282_);
return v___x_283_;
}
}
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNative99d469b3ee044240_invoke__ce903715575b2b74e1c334bc071ce4eceaad0558___boxed(lean_object* v_token_286_, lean_object* v_a0_287_){
_start:
{
size_t v_token_boxed_288_; lean_object* v_res_289_; 
v_token_boxed_288_ = lean_unbox_usize(v_token_286_);
lean_dec(v_token_286_);
v_res_289_ = lean_bridge_fa450d817b39ecc8598f3607_structured_ce903715575b2b74e1c334bc071ce4eceaad0558_invoke(v_token_boxed_288_, v_a0_287_);
return v_res_289_;
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNative99d469b3ee044240_wrap__ce903715575b2b74e1c334bc071ce4eceaad0558___lam__0(size_t v_token_290_, lean_object* v_a0_291_){
_start:
{
lean_object* v___x_292_; lean_object* v___x_293_; lean_object* v___x_294_; lean_object* v___x_295_; lean_object* v___x_296_; 
v___x_292_ = lean_unsigned_to_nat(1u);
v___x_293_ = lean_mk_empty_array_with_capacity(v___x_292_);
v___x_294_ = lean_array_push(v___x_293_, v_a0_291_);
v___x_295_ = lean_bridge_fa450d817b39ecc8598f3607_structured_ce903715575b2b74e1c334bc071ce4eceaad0558_invoke(v_token_290_, v___x_294_);
v___x_296_ = l_LeanBridgeNative99d469b3ee044240_carrierValue___redArg(v___x_295_);
lean_dec_ref(v___x_295_);
if (lean_obj_tag(v___x_296_) == 0)
{
lean_object* v___x_297_; 
v___x_297_ = lean_unsigned_to_nat(0u);
return v___x_297_;
}
else
{
lean_object* v_val_298_; 
v_val_298_ = lean_ctor_get(v___x_296_, 0);
lean_inc(v_val_298_);
lean_dec_ref_known(v___x_296_, 1);
return v_val_298_;
}
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNative99d469b3ee044240_wrap__ce903715575b2b74e1c334bc071ce4eceaad0558___lam__0___boxed(lean_object* v_token_299_, lean_object* v_a0_300_){
_start:
{
size_t v_token_boxed_301_; lean_object* v_res_302_; 
v_token_boxed_301_ = lean_unbox_usize(v_token_299_);
lean_dec(v_token_299_);
v_res_302_ = l_LeanBridgeNative99d469b3ee044240_wrap__ce903715575b2b74e1c334bc071ce4eceaad0558___lam__0(v_token_boxed_301_, v_a0_300_);
return v_res_302_;
}
}
LEAN_EXPORT lean_object* lean_bridge_fa450d817b39ecc8598f3607_structured_ce903715575b2b74e1c334bc071ce4eceaad0558_wrap(size_t v_token_303_){
_start:
{
lean_object* v___x_304_; lean_object* v___f_305_; lean_object* v___x_306_; lean_object* v___x_307_; lean_object* v___x_308_; 
v___x_304_ = lean_box_usize(v_token_303_);
v___f_305_ = lean_alloc_closure((void*)(l_LeanBridgeNative99d469b3ee044240_wrap__ce903715575b2b74e1c334bc071ce4eceaad0558___lam__0___boxed), 2, 1);
lean_closure_set(v___f_305_, 0, v___x_304_);
v___x_306_ = lean_unsigned_to_nat(1u);
v___x_307_ = lean_mk_empty_array_with_capacity(v___x_306_);
v___x_308_ = lean_array_push(v___x_307_, v___f_305_);
return v___x_308_;
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNative99d469b3ee044240_wrap__ce903715575b2b74e1c334bc071ce4eceaad0558___boxed(lean_object* v_token_309_){
_start:
{
size_t v_token_boxed_310_; lean_object* v_res_311_; 
v_token_boxed_310_ = lean_unbox_usize(v_token_309_);
lean_dec(v_token_309_);
v_res_311_ = lean_bridge_fa450d817b39ecc8598f3607_structured_ce903715575b2b74e1c334bc071ce4eceaad0558_wrap(v_token_boxed_310_);
return v_res_311_;
}
}
LEAN_EXPORT lean_object* lean_bridge_fa450d817b39ecc8598f3607_structured_ce903715575b2b74e1c334bc071ce4eceaad0558_apply(lean_object* v_closure_312_, lean_object* v_a0_313_){
  fputs("LB_CALLBACK_ENTRY_V1 enter adapter ReviewedCallbacks.tiles:closure:lean\n", stderr);

_start:
{
lean_object* v___x_314_; 
v___x_314_ = l_LeanBridgeNative99d469b3ee044240_carrierValue___redArg(v_closure_312_);
lean_dec_ref(v_closure_312_);
if (lean_obj_tag(v___x_314_) == 0)
{
lean_object* v___x_315_; 
lean_dec_ref(v_a0_313_);
v___x_315_ = lean_obj_once(&l_LeanBridgeNative99d469b3ee044240_field0b80133b771640d801c25___closed__0, &l_LeanBridgeNative99d469b3ee044240_field0b80133b771640d801c25___closed__0_once, _init_l_LeanBridgeNative99d469b3ee044240_field0b80133b771640d801c25___closed__0);
return v___x_315_;
}
else
{
lean_object* v_val_316_; lean_object* v___x_317_; 
v_val_316_ = lean_ctor_get(v___x_314_, 0);
lean_inc(v_val_316_);
lean_dec_ref_known(v___x_314_, 1);
v___x_317_ = l_LeanBridgeNative99d469b3ee044240_carrierValue___redArg(v_a0_313_);
lean_dec_ref(v_a0_313_);
if (lean_obj_tag(v___x_317_) == 0)
{
lean_object* v___x_318_; 
lean_dec(v_val_316_);
v___x_318_ = lean_obj_once(&l_LeanBridgeNative99d469b3ee044240_field0b80133b771640d801c25___closed__0, &l_LeanBridgeNative99d469b3ee044240_field0b80133b771640d801c25___closed__0_once, _init_l_LeanBridgeNative99d469b3ee044240_field0b80133b771640d801c25___closed__0);
return v___x_318_;
}
else
{
lean_object* v_val_319_; lean_object* v___x_321_; uint8_t v_isShared_322_; uint8_t v_isSharedCheck_328_; 
v_val_319_ = lean_ctor_get(v___x_317_, 0);
v_isSharedCheck_328_ = !lean_is_exclusive(v___x_317_);
if (v_isSharedCheck_328_ == 0)
{
v___x_321_ = v___x_317_;
v_isShared_322_ = v_isSharedCheck_328_;
goto v_resetjp_320_;
}
else
{
lean_inc(v_val_319_);
lean_dec(v___x_317_);
v___x_321_ = lean_box(0);
v_isShared_322_ = v_isSharedCheck_328_;
goto v_resetjp_320_;
}
v_resetjp_320_:
{
lean_object* v___x_323_; lean_object* v___x_325_; 
v___x_323_ = lean_apply_1(v_val_316_, v_val_319_);
if (v_isShared_322_ == 0)
{
lean_ctor_set(v___x_321_, 0, v___x_323_);
v___x_325_ = v___x_321_;
goto v_reusejp_324_;
}
else
{
lean_object* v_reuseFailAlloc_327_; 
v_reuseFailAlloc_327_ = lean_alloc_ctor(1, 1, 0);
lean_ctor_set(v_reuseFailAlloc_327_, 0, v___x_323_);
v___x_325_ = v_reuseFailAlloc_327_;
goto v_reusejp_324_;
}
v_reusejp_324_:
{
lean_object* v___x_326_; 
v___x_326_ = l_LeanBridgeNative99d469b3ee044240_carrierResult___redArg(v___x_325_);
return v___x_326_;
}
}
}
}
}
}
LEAN_EXPORT lean_object* lean_bridge_fa450d817b39ecc8598f3607_structured_3b911dc0ceee9737631b7e83276319d96008e83d_apply(lean_object* v_closure_329_, lean_object* v_a0_330_){
  fputs("LB_CALLBACK_ENTRY_V1 enter adapter ReviewedCallbacks.counter:closure:lean\n", stderr);

_start:
{
lean_object* v___x_331_; 
v___x_331_ = l_LeanBridgeNative99d469b3ee044240_carrierValue___redArg(v_closure_329_);
lean_dec_ref(v_closure_329_);
if (lean_obj_tag(v___x_331_) == 0)
{
lean_object* v___x_332_; 
lean_dec_ref(v_a0_330_);
v___x_332_ = lean_obj_once(&l_LeanBridgeNative99d469b3ee044240_field0b80133b771640d801c25___closed__0, &l_LeanBridgeNative99d469b3ee044240_field0b80133b771640d801c25___closed__0_once, _init_l_LeanBridgeNative99d469b3ee044240_field0b80133b771640d801c25___closed__0);
return v___x_332_;
}
else
{
lean_object* v_val_333_; lean_object* v___x_334_; 
v_val_333_ = lean_ctor_get(v___x_331_, 0);
lean_inc(v_val_333_);
lean_dec_ref_known(v___x_331_, 1);
v___x_334_ = l_LeanBridgeNative99d469b3ee044240_carrierValue___redArg(v_a0_330_);
lean_dec_ref(v_a0_330_);
if (lean_obj_tag(v___x_334_) == 0)
{
lean_object* v___x_335_; 
lean_dec(v_val_333_);
v___x_335_ = l_LeanBridgeNative99d469b3ee044240_carrierResult___redArg(v___x_334_);
return v___x_335_;
}
else
{
lean_object* v_val_336_; lean_object* v___x_337_; lean_object* v___x_338_; 
v_val_336_ = lean_ctor_get(v___x_334_, 0);
lean_inc(v_val_336_);
lean_dec_ref_known(v___x_334_, 1);
v___x_337_ = lean_apply_1(v_val_333_, v_val_336_);
v___x_338_ = l_LeanBridgeNative99d469b3ee044240_carrierResult___redArg(v___x_337_);
return v___x_338_;
}
}
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNative99d469b3ee044240_invoke__ffe59c1b227e089c6c50c0421d94e57562f09578___boxed(lean_object* v_token_341_, lean_object* v_a0_342_){
_start:
{
size_t v_token_boxed_343_; lean_object* v_res_344_; 
v_token_boxed_343_ = lean_unbox_usize(v_token_341_);
lean_dec(v_token_341_);
v_res_344_ = lean_bridge_fa450d817b39ecc8598f3607_structured_ffe59c1b227e089c6c50c0421d94e57562f09578_invoke(v_token_boxed_343_, v_a0_342_);
return v_res_344_;
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNative99d469b3ee044240_recovery__ffe59c1b227e089c6c50c0421d94e57562f09578___boxed(lean_object* v_token_346_){
_start:
{
size_t v_token_boxed_347_; lean_object* v_res_348_; 
v_token_boxed_347_ = lean_unbox_usize(v_token_346_);
lean_dec(v_token_346_);
v_res_348_ = lean_bridge_fa450d817b39ecc8598f3607_structured_ffe59c1b227e089c6c50c0421d94e57562f09578_recovery(v_token_boxed_347_);
return v_res_348_;
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNative99d469b3ee044240_reject__ffe59c1b227e089c6c50c0421d94e57562f09578___boxed(lean_object* v_token_351_, lean_object* v_recovery_352_){
_start:
{
size_t v_token_boxed_353_; lean_object* v_res_354_; 
v_token_boxed_353_ = lean_unbox_usize(v_token_351_);
lean_dec(v_token_351_);
v_res_354_ = lean_bridge_fa450d817b39ecc8598f3607_structured_ffe59c1b227e089c6c50c0421d94e57562f09578_reject(v_token_boxed_353_, v_recovery_352_);
return v_res_354_;
}
}
LEAN_EXPORT lean_object* lean_bridge_fa450d817b39ecc8598f3607_structured_ffe59c1b227e089c6c50c0421d94e57562f09578_wrap(size_t v_token_355_){
_start:
{
lean_object* v___x_356_; lean_object* v___x_357_; lean_object* v___x_358_; lean_object* v___x_359_; 
v___x_356_ = lean_unsigned_to_nat(1u);
v___x_357_ = lean_mk_empty_array_with_capacity(v___x_356_);
v___x_358_ = lean_box_usize(v_token_355_);
v___x_359_ = lean_array_push(v___x_357_, v___x_358_);
return v___x_359_;
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNative99d469b3ee044240_wrap__ffe59c1b227e089c6c50c0421d94e57562f09578___boxed(lean_object* v_token_360_){
_start:
{
size_t v_token_boxed_361_; lean_object* v_res_362_; 
v_token_boxed_361_ = lean_unbox_usize(v_token_360_);
lean_dec(v_token_360_);
v_res_362_ = lean_bridge_fa450d817b39ecc8598f3607_structured_ffe59c1b227e089c6c50c0421d94e57562f09578_wrap(v_token_boxed_361_);
return v_res_362_;
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNative99d469b3ee044240_invoke__d8cf2e9a7b0c40482bf9414b886a3e2086ac2e4e___boxed(lean_object* v_token_365_, lean_object* v_a0_366_){
_start:
{
size_t v_token_boxed_367_; lean_object* v_res_368_; 
v_token_boxed_367_ = lean_unbox_usize(v_token_365_);
lean_dec(v_token_365_);
v_res_368_ = lean_bridge_fa450d817b39ecc8598f3607_structured_d8cf2e9a7b0c40482bf9414b886a3e2086ac2e4e_invoke(v_token_boxed_367_, v_a0_366_);
return v_res_368_;
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNative99d469b3ee044240_wrap__d8cf2e9a7b0c40482bf9414b886a3e2086ac2e4e___lam__0(size_t v_token_369_, lean_object* v_a0_370_){
_start:
{
lean_object* v___x_371_; lean_object* v___x_372_; lean_object* v___x_373_; lean_object* v___x_374_; lean_object* v___x_375_; 
v___x_371_ = lean_unsigned_to_nat(1u);
v___x_372_ = lean_mk_empty_array_with_capacity(v___x_371_);
v___x_373_ = lean_array_push(v___x_372_, v_a0_370_);
v___x_374_ = lean_bridge_fa450d817b39ecc8598f3607_structured_d8cf2e9a7b0c40482bf9414b886a3e2086ac2e4e_invoke(v_token_369_, v___x_373_);
v___x_375_ = l_LeanBridgeNative99d469b3ee044240_carrierValue___redArg(v___x_374_);
lean_dec_ref(v___x_374_);
if (lean_obj_tag(v___x_375_) == 0)
{
lean_object* v___x_376_; 
v___x_376_ = ((lean_object*)(l_LeanBridgeNative99d469b3ee044240_callbackDefault__b80133b771640d801c25));
return v___x_376_;
}
else
{
lean_object* v_val_377_; 
v_val_377_ = lean_ctor_get(v___x_375_, 0);
lean_inc(v_val_377_);
lean_dec_ref_known(v___x_375_, 1);
return v_val_377_;
}
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNative99d469b3ee044240_wrap__d8cf2e9a7b0c40482bf9414b886a3e2086ac2e4e___lam__0___boxed(lean_object* v_token_378_, lean_object* v_a0_379_){
_start:
{
size_t v_token_boxed_380_; lean_object* v_res_381_; 
v_token_boxed_380_ = lean_unbox_usize(v_token_378_);
lean_dec(v_token_378_);
v_res_381_ = l_LeanBridgeNative99d469b3ee044240_wrap__d8cf2e9a7b0c40482bf9414b886a3e2086ac2e4e___lam__0(v_token_boxed_380_, v_a0_379_);
return v_res_381_;
}
}
LEAN_EXPORT lean_object* lean_bridge_fa450d817b39ecc8598f3607_structured_d8cf2e9a7b0c40482bf9414b886a3e2086ac2e4e_wrap(size_t v_token_382_){
_start:
{
lean_object* v___x_383_; lean_object* v___f_384_; lean_object* v___x_385_; lean_object* v___x_386_; lean_object* v___x_387_; 
v___x_383_ = lean_box_usize(v_token_382_);
v___f_384_ = lean_alloc_closure((void*)(l_LeanBridgeNative99d469b3ee044240_wrap__d8cf2e9a7b0c40482bf9414b886a3e2086ac2e4e___lam__0___boxed), 2, 1);
lean_closure_set(v___f_384_, 0, v___x_383_);
v___x_385_ = lean_unsigned_to_nat(1u);
v___x_386_ = lean_mk_empty_array_with_capacity(v___x_385_);
v___x_387_ = lean_array_push(v___x_386_, v___f_384_);
return v___x_387_;
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNative99d469b3ee044240_wrap__d8cf2e9a7b0c40482bf9414b886a3e2086ac2e4e___boxed(lean_object* v_token_388_){
_start:
{
size_t v_token_boxed_389_; lean_object* v_res_390_; 
v_token_boxed_389_ = lean_unbox_usize(v_token_388_);
lean_dec(v_token_388_);
v_res_390_ = lean_bridge_fa450d817b39ecc8598f3607_structured_d8cf2e9a7b0c40482bf9414b886a3e2086ac2e4e_wrap(v_token_boxed_389_);
return v_res_390_;
}
}
LEAN_EXPORT lean_object* lean_bridge_fa450d817b39ecc8598f3607_structured_d8cf2e9a7b0c40482bf9414b886a3e2086ac2e4e_apply(lean_object* v_closure_391_, lean_object* v_a0_392_){
  fputs("LB_CALLBACK_ENTRY_V1 enter adapter ReviewedCallbacks.tileMaker:closure:lean\n", stderr);

_start:
{
lean_object* v___x_393_; 
v___x_393_ = l_LeanBridgeNative99d469b3ee044240_carrierValue___redArg(v_closure_391_);
lean_dec_ref(v_closure_391_);
if (lean_obj_tag(v___x_393_) == 0)
{
lean_object* v___x_394_; 
lean_dec_ref(v_a0_392_);
v___x_394_ = lean_obj_once(&l_LeanBridgeNative99d469b3ee044240_makeb80133b771640d801c25___closed__0, &l_LeanBridgeNative99d469b3ee044240_makeb80133b771640d801c25___closed__0_once, _init_l_LeanBridgeNative99d469b3ee044240_makeb80133b771640d801c25___closed__0);
return v___x_394_;
}
else
{
lean_object* v_val_395_; lean_object* v___x_396_; 
v_val_395_ = lean_ctor_get(v___x_393_, 0);
lean_inc(v_val_395_);
lean_dec_ref_known(v___x_393_, 1);
v___x_396_ = l_LeanBridgeNative99d469b3ee044240_carrierValue___redArg(v_a0_392_);
lean_dec_ref(v_a0_392_);
if (lean_obj_tag(v___x_396_) == 0)
{
lean_object* v___x_397_; 
lean_dec(v_val_395_);
v___x_397_ = lean_obj_once(&l_LeanBridgeNative99d469b3ee044240_makeb80133b771640d801c25___closed__0, &l_LeanBridgeNative99d469b3ee044240_makeb80133b771640d801c25___closed__0_once, _init_l_LeanBridgeNative99d469b3ee044240_makeb80133b771640d801c25___closed__0);
return v___x_397_;
}
else
{
lean_object* v_val_398_; lean_object* v___x_400_; uint8_t v_isShared_401_; uint8_t v_isSharedCheck_407_; 
v_val_398_ = lean_ctor_get(v___x_396_, 0);
v_isSharedCheck_407_ = !lean_is_exclusive(v___x_396_);
if (v_isSharedCheck_407_ == 0)
{
v___x_400_ = v___x_396_;
v_isShared_401_ = v_isSharedCheck_407_;
goto v_resetjp_399_;
}
else
{
lean_inc(v_val_398_);
lean_dec(v___x_396_);
v___x_400_ = lean_box(0);
v_isShared_401_ = v_isSharedCheck_407_;
goto v_resetjp_399_;
}
v_resetjp_399_:
{
lean_object* v___x_402_; lean_object* v___x_404_; 
v___x_402_ = lean_apply_1(v_val_395_, v_val_398_);
if (v_isShared_401_ == 0)
{
lean_ctor_set(v___x_400_, 0, v___x_402_);
v___x_404_ = v___x_400_;
goto v_reusejp_403_;
}
else
{
lean_object* v_reuseFailAlloc_406_; 
v_reuseFailAlloc_406_ = lean_alloc_ctor(1, 1, 0);
lean_ctor_set(v_reuseFailAlloc_406_, 0, v___x_402_);
v___x_404_ = v_reuseFailAlloc_406_;
goto v_reusejp_403_;
}
v_reusejp_403_:
{
lean_object* v___x_405_; 
v___x_405_ = l_LeanBridgeNative99d469b3ee044240_carrierResult___redArg(v___x_404_);
return v___x_405_;
}
}
}
}
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNative99d469b3ee044240_invoke__8a8a1e0d7d82df3b4bfabb94f5d59f8bf4b9ed1d___boxed(lean_object* v_token_410_, lean_object* v_a0_411_){
_start:
{
size_t v_token_boxed_412_; lean_object* v_res_413_; 
v_token_boxed_412_ = lean_unbox_usize(v_token_410_);
lean_dec(v_token_410_);
v_res_413_ = lean_bridge_fa450d817b39ecc8598f3607_structured_8a8a1e0d7d82df3b4bfabb94f5d59f8bf4b9ed1d_invoke(v_token_boxed_412_, v_a0_411_);
return v_res_413_;
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNative99d469b3ee044240_wrap__8a8a1e0d7d82df3b4bfabb94f5d59f8bf4b9ed1d___lam__0(size_t v_token_414_, lean_object* v_a0_415_){
_start:
{
lean_object* v___x_416_; lean_object* v___x_417_; lean_object* v___x_418_; lean_object* v___x_419_; lean_object* v___x_420_; 
v___x_416_ = lean_unsigned_to_nat(1u);
v___x_417_ = lean_mk_empty_array_with_capacity(v___x_416_);
v___x_418_ = lean_array_push(v___x_417_, v_a0_415_);
v___x_419_ = lean_bridge_fa450d817b39ecc8598f3607_structured_8a8a1e0d7d82df3b4bfabb94f5d59f8bf4b9ed1d_invoke(v_token_414_, v___x_418_);
v___x_420_ = l_LeanBridgeNative99d469b3ee044240_carrierValue___redArg(v___x_419_);
lean_dec_ref(v___x_419_);
if (lean_obj_tag(v___x_420_) == 0)
{
lean_object* v___x_421_; 
v___x_421_ = lean_unsigned_to_nat(0u);
return v___x_421_;
}
else
{
lean_object* v_val_422_; 
v_val_422_ = lean_ctor_get(v___x_420_, 0);
lean_inc(v_val_422_);
lean_dec_ref_known(v___x_420_, 1);
return v_val_422_;
}
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNative99d469b3ee044240_wrap__8a8a1e0d7d82df3b4bfabb94f5d59f8bf4b9ed1d___lam__0___boxed(lean_object* v_token_423_, lean_object* v_a0_424_){
_start:
{
size_t v_token_boxed_425_; lean_object* v_res_426_; 
v_token_boxed_425_ = lean_unbox_usize(v_token_423_);
lean_dec(v_token_423_);
v_res_426_ = l_LeanBridgeNative99d469b3ee044240_wrap__8a8a1e0d7d82df3b4bfabb94f5d59f8bf4b9ed1d___lam__0(v_token_boxed_425_, v_a0_424_);
return v_res_426_;
}
}
LEAN_EXPORT lean_object* lean_bridge_fa450d817b39ecc8598f3607_structured_8a8a1e0d7d82df3b4bfabb94f5d59f8bf4b9ed1d_wrap(size_t v_token_427_){
_start:
{
lean_object* v___x_428_; lean_object* v___f_429_; lean_object* v___x_430_; lean_object* v___x_431_; lean_object* v___x_432_; 
v___x_428_ = lean_box_usize(v_token_427_);
v___f_429_ = lean_alloc_closure((void*)(l_LeanBridgeNative99d469b3ee044240_wrap__8a8a1e0d7d82df3b4bfabb94f5d59f8bf4b9ed1d___lam__0___boxed), 2, 1);
lean_closure_set(v___f_429_, 0, v___x_428_);
v___x_430_ = lean_unsigned_to_nat(1u);
v___x_431_ = lean_mk_empty_array_with_capacity(v___x_430_);
v___x_432_ = lean_array_push(v___x_431_, v___f_429_);
return v___x_432_;
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNative99d469b3ee044240_wrap__8a8a1e0d7d82df3b4bfabb94f5d59f8bf4b9ed1d___boxed(lean_object* v_token_433_){
_start:
{
size_t v_token_boxed_434_; lean_object* v_res_435_; 
v_token_boxed_434_ = lean_unbox_usize(v_token_433_);
lean_dec(v_token_433_);
v_res_435_ = lean_bridge_fa450d817b39ecc8598f3607_structured_8a8a1e0d7d82df3b4bfabb94f5d59f8bf4b9ed1d_wrap(v_token_boxed_434_);
return v_res_435_;
}
}
LEAN_EXPORT lean_object* lean_bridge_fa450d817b39ecc8598f3607_structured_8a8a1e0d7d82df3b4bfabb94f5d59f8bf4b9ed1d_apply(lean_object* v_closure_436_, lean_object* v_a0_437_){
_start:
{
lean_object* v___x_438_; 
v___x_438_ = l_LeanBridgeNative99d469b3ee044240_carrierValue___redArg(v_closure_436_);
lean_dec_ref(v_closure_436_);
if (lean_obj_tag(v___x_438_) == 0)
{
lean_object* v___x_439_; 
lean_dec_ref(v_a0_437_);
v___x_439_ = lean_obj_once(&l_LeanBridgeNative99d469b3ee044240_field0b80133b771640d801c25___closed__0, &l_LeanBridgeNative99d469b3ee044240_field0b80133b771640d801c25___closed__0_once, _init_l_LeanBridgeNative99d469b3ee044240_field0b80133b771640d801c25___closed__0);
return v___x_439_;
}
else
{
lean_object* v_val_440_; lean_object* v___x_441_; 
v_val_440_ = lean_ctor_get(v___x_438_, 0);
lean_inc(v_val_440_);
lean_dec_ref_known(v___x_438_, 1);
v___x_441_ = l_LeanBridgeNative99d469b3ee044240_carrierValue___redArg(v_a0_437_);
lean_dec_ref(v_a0_437_);
if (lean_obj_tag(v___x_441_) == 0)
{
lean_object* v___x_442_; 
lean_dec(v_val_440_);
v___x_442_ = l_LeanBridgeNative99d469b3ee044240_carrierResult___redArg(v___x_441_);
return v___x_442_;
}
else
{
lean_object* v_val_443_; lean_object* v___x_445_; uint8_t v_isShared_446_; uint8_t v_isSharedCheck_452_; 
v_val_443_ = lean_ctor_get(v___x_441_, 0);
v_isSharedCheck_452_ = !lean_is_exclusive(v___x_441_);
if (v_isSharedCheck_452_ == 0)
{
v___x_445_ = v___x_441_;
v_isShared_446_ = v_isSharedCheck_452_;
goto v_resetjp_444_;
}
else
{
lean_inc(v_val_443_);
lean_dec(v___x_441_);
v___x_445_ = lean_box(0);
v_isShared_446_ = v_isSharedCheck_452_;
goto v_resetjp_444_;
}
v_resetjp_444_:
{
lean_object* v___x_447_; lean_object* v___x_449_; 
v___x_447_ = lean_apply_1(v_val_440_, v_val_443_);
if (v_isShared_446_ == 0)
{
lean_ctor_set(v___x_445_, 0, v___x_447_);
v___x_449_ = v___x_445_;
goto v_reusejp_448_;
}
else
{
lean_object* v_reuseFailAlloc_451_; 
v_reuseFailAlloc_451_ = lean_alloc_ctor(1, 1, 0);
lean_ctor_set(v_reuseFailAlloc_451_, 0, v___x_447_);
v___x_449_ = v_reuseFailAlloc_451_;
goto v_reusejp_448_;
}
v_reusejp_448_:
{
lean_object* v___x_450_; 
v___x_450_ = l_LeanBridgeNative99d469b3ee044240_carrierResult___redArg(v___x_449_);
return v___x_450_;
}
}
}
}
}
}
LEAN_EXPORT lean_object* lean_bridge_fa450d817b39ecc8598f3607_lean(lean_object* v_a0_453_, lean_object* v_a1_454_){
_start:
{
lean_object* v___x_455_; 
v___x_455_ = l_LeanBridgeNative99d469b3ee044240_carrierValue___redArg(v_a0_453_);
lean_dec_ref(v_a0_453_);
if (lean_obj_tag(v___x_455_) == 0)
{
lean_object* v___x_456_; 
lean_dec_ref(v_a1_454_);
v___x_456_ = lean_obj_once(&l_LeanBridgeNative99d469b3ee044240_field0b80133b771640d801c25___closed__0, &l_LeanBridgeNative99d469b3ee044240_field0b80133b771640d801c25___closed__0_once, _init_l_LeanBridgeNative99d469b3ee044240_field0b80133b771640d801c25___closed__0);
return v___x_456_;
}
else
{
lean_object* v_val_457_; lean_object* v___x_458_; 
v_val_457_ = lean_ctor_get(v___x_455_, 0);
lean_inc(v_val_457_);
lean_dec_ref_known(v___x_455_, 1);
v___x_458_ = l_LeanBridgeNative99d469b3ee044240_carrierValue___redArg(v_a1_454_);
lean_dec_ref(v_a1_454_);
if (lean_obj_tag(v___x_458_) == 0)
{
lean_object* v___x_459_; 
lean_dec(v_val_457_);
v___x_459_ = l_LeanBridgeNative99d469b3ee044240_carrierResult___redArg(v___x_458_);
return v___x_459_;
}
else
{
lean_object* v_val_460_; lean_object* v___x_462_; uint8_t v_isShared_463_; uint8_t v_isSharedCheck_469_; 
v_val_460_ = lean_ctor_get(v___x_458_, 0);
v_isSharedCheck_469_ = !lean_is_exclusive(v___x_458_);
if (v_isSharedCheck_469_ == 0)
{
v___x_462_ = v___x_458_;
v_isShared_463_ = v_isSharedCheck_469_;
goto v_resetjp_461_;
}
else
{
lean_inc(v_val_460_);
lean_dec(v___x_458_);
v___x_462_ = lean_box(0);
v_isShared_463_ = v_isSharedCheck_469_;
goto v_resetjp_461_;
}
v_resetjp_461_:
{
lean_object* v___x_464_; lean_object* v___x_466_; 
v___x_464_ = lean_apply_1(v_val_457_, v_val_460_);
if (v_isShared_463_ == 0)
{
lean_ctor_set(v___x_462_, 0, v___x_464_);
v___x_466_ = v___x_462_;
goto v_reusejp_465_;
}
else
{
lean_object* v_reuseFailAlloc_468_; 
v_reuseFailAlloc_468_ = lean_alloc_ctor(1, 1, 0);
lean_ctor_set(v_reuseFailAlloc_468_, 0, v___x_464_);
v___x_466_ = v_reuseFailAlloc_468_;
goto v_reusejp_465_;
}
v_reusejp_465_:
{
lean_object* v___x_467_; 
v___x_467_ = l_LeanBridgeNative99d469b3ee044240_carrierResult___redArg(v___x_466_);
return v___x_467_;
}
}
}
}
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNative99d469b3ee044240_export1___lam__0(lean_object* v_val_470_, lean_object* v___bridgeCallbackResult__0_471_){
_start:
{
lean_object* v___x_472_; lean_object* v___x_473_; 
v___x_472_ = lb_callback_fin_probe_source_counter(v_val_470_, v___bridgeCallbackResult__0_471_);
v___x_473_ = lean_alloc_ctor(1, 1, 0);
lean_ctor_set(v___x_473_, 0, v___x_472_);
return v___x_473_;
}
}
static lean_object* _init_l_LeanBridgeNative99d469b3ee044240_export1___closed__0(void){
_start:
{
lean_object* v___x_474_; lean_object* v___x_475_; 
v___x_474_ = lean_box(0);
v___x_475_ = l_LeanBridgeNative99d469b3ee044240_carrierResult___redArg(v___x_474_);
return v___x_475_;
}
}
LEAN_EXPORT lean_object* lean_bridge_53b0de0e75e4c429aaad48c8_lean(lean_object* v_a0_476_){
  fputs("LB_CALLBACK_ENTRY_V1 enter adapter ReviewedCallbacks.counter:lean\n", stderr);

_start:
{
lean_object* v___x_477_; 
v___x_477_ = l_LeanBridgeNative99d469b3ee044240_carrierValue___redArg(v_a0_476_);
lean_dec_ref(v_a0_476_);
if (lean_obj_tag(v___x_477_) == 0)
{
lean_object* v___x_478_; 
v___x_478_ = lean_obj_once(&l_LeanBridgeNative99d469b3ee044240_export1___closed__0, &l_LeanBridgeNative99d469b3ee044240_export1___closed__0_once, _init_l_LeanBridgeNative99d469b3ee044240_export1___closed__0);
return v___x_478_;
}
else
{
lean_object* v_val_479_; lean_object* v___x_481_; uint8_t v_isShared_482_; uint8_t v_isSharedCheck_488_; 
v_val_479_ = lean_ctor_get(v___x_477_, 0);
v_isSharedCheck_488_ = !lean_is_exclusive(v___x_477_);
if (v_isSharedCheck_488_ == 0)
{
v___x_481_ = v___x_477_;
v_isShared_482_ = v_isSharedCheck_488_;
goto v_resetjp_480_;
}
else
{
lean_inc(v_val_479_);
lean_dec(v___x_477_);
v___x_481_ = lean_box(0);
v_isShared_482_ = v_isSharedCheck_488_;
goto v_resetjp_480_;
}
v_resetjp_480_:
{
lean_object* v___f_483_; lean_object* v___x_485_; 
v___f_483_ = lean_alloc_closure((void*)(l_LeanBridgeNative99d469b3ee044240_export1___lam__0), 2, 1);
lean_closure_set(v___f_483_, 0, v_val_479_);
if (v_isShared_482_ == 0)
{
lean_ctor_set(v___x_481_, 0, v___f_483_);
v___x_485_ = v___x_481_;
goto v_reusejp_484_;
}
else
{
lean_object* v_reuseFailAlloc_487_; 
v_reuseFailAlloc_487_ = lean_alloc_ctor(1, 1, 0);
lean_ctor_set(v_reuseFailAlloc_487_, 0, v___f_483_);
v___x_485_ = v_reuseFailAlloc_487_;
goto v_reusejp_484_;
}
v_reusejp_484_:
{
lean_object* v___x_486_; 
v___x_486_ = l_LeanBridgeNative99d469b3ee044240_carrierResult___redArg(v___x_485_);
return v___x_486_;
}
}
}
}
}
LEAN_EXPORT lean_object* l___private_Init_Data_Array_Basic_0__Array_mapMUnsafe_map___at___00LeanBridgeNative99d469b3ee044240_export2_spec__0(size_t v_sz_489_, size_t v_i_490_, lean_object* v_bs_491_){
_start:
{
uint8_t v___x_492_; 
v___x_492_ = lean_usize_dec_lt(v_i_490_, v_sz_489_);
if (v___x_492_ == 0)
{
lean_object* v___x_493_; 
v___x_493_ = lean_alloc_ctor(1, 1, 0);
lean_ctor_set(v___x_493_, 0, v_bs_491_);
return v___x_493_;
}
else
{
lean_object* v_v_494_; lean_object* v___x_495_; uint8_t v___x_496_; 
v_v_494_ = lean_array_uget(v_bs_491_, v_i_490_);
v___x_495_ = lean_unsigned_to_nat(3u);
v___x_496_ = lean_nat_dec_lt(v_v_494_, v___x_495_);
if (v___x_496_ == 0)
{
lean_object* v___x_497_; 
lean_dec(v_v_494_);
lean_dec_ref(v_bs_491_);
v___x_497_ = lean_box(0);
return v___x_497_;
}
else
{
lean_object* v___x_498_; lean_object* v_bs_x27_499_; size_t v___x_500_; size_t v___x_501_; lean_object* v___x_502_; 
v___x_498_ = lean_unsigned_to_nat(0u);
v_bs_x27_499_ = lean_array_uset(v_bs_491_, v_i_490_, v___x_498_);
v___x_500_ = ((size_t)1ULL);
v___x_501_ = lean_usize_add(v_i_490_, v___x_500_);
v___x_502_ = lean_array_uset(v_bs_x27_499_, v_i_490_, v_v_494_);
v_i_490_ = v___x_501_;
v_bs_491_ = v___x_502_;
goto _start;
}
}
}
}
LEAN_EXPORT lean_object* l___private_Init_Data_Array_Basic_0__Array_mapMUnsafe_map___at___00LeanBridgeNative99d469b3ee044240_export2_spec__0___boxed(lean_object* v_sz_504_, lean_object* v_i_505_, lean_object* v_bs_506_){
_start:
{
size_t v_sz_boxed_507_; size_t v_i_boxed_508_; lean_object* v_res_509_; 
v_sz_boxed_507_ = lean_unbox_usize(v_sz_504_);
lean_dec(v_sz_504_);
v_i_boxed_508_ = lean_unbox_usize(v_i_505_);
lean_dec(v_i_505_);
v_res_509_ = l___private_Init_Data_Array_Basic_0__Array_mapMUnsafe_map___at___00LeanBridgeNative99d469b3ee044240_export2_spec__0(v_sz_boxed_507_, v_i_boxed_508_, v_bs_506_);
return v_res_509_;
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNative99d469b3ee044240_export2___lam__0(lean_object* v___bridgeCallbackResult__0_510_){
_start:
{
size_t v_sz_511_; size_t v___x_512_; lean_object* v___x_513_; 
v_sz_511_ = lean_array_size(v___bridgeCallbackResult__0_510_);
v___x_512_ = ((size_t)0ULL);
v___x_513_ = l___private_Init_Data_Array_Basic_0__Array_mapMUnsafe_map___at___00LeanBridgeNative99d469b3ee044240_export2_spec__0(v_sz_511_, v___x_512_, v___bridgeCallbackResult__0_510_);
if (lean_obj_tag(v___x_513_) == 0)
{
lean_object* v___x_514_; 
v___x_514_ = lean_box(0);
return v___x_514_;
}
else
{
lean_object* v_val_515_; lean_object* v___x_517_; uint8_t v_isShared_518_; uint8_t v_isSharedCheck_523_; 
v_val_515_ = lean_ctor_get(v___x_513_, 0);
v_isSharedCheck_523_ = !lean_is_exclusive(v___x_513_);
if (v_isSharedCheck_523_ == 0)
{
v___x_517_ = v___x_513_;
v_isShared_518_ = v_isSharedCheck_523_;
goto v_resetjp_516_;
}
else
{
lean_inc(v_val_515_);
lean_dec(v___x_513_);
v___x_517_ = lean_box(0);
v_isShared_518_ = v_isSharedCheck_523_;
goto v_resetjp_516_;
}
v_resetjp_516_:
{
lean_object* v___x_519_; lean_object* v___x_521_; 
v___x_519_ = l_ReviewedCallbacks_digits___redArg(v_val_515_);
lean_dec(v_val_515_);
if (v_isShared_518_ == 0)
{
lean_ctor_set(v___x_517_, 0, v___x_519_);
v___x_521_ = v___x_517_;
goto v_reusejp_520_;
}
else
{
lean_object* v_reuseFailAlloc_522_; 
v_reuseFailAlloc_522_ = lean_alloc_ctor(1, 1, 0);
lean_ctor_set(v_reuseFailAlloc_522_, 0, v___x_519_);
v___x_521_ = v_reuseFailAlloc_522_;
goto v_reusejp_520_;
}
v_reusejp_520_:
{
return v___x_521_;
}
}
}
}
}
static lean_object* _init_l_LeanBridgeNative99d469b3ee044240_export2___closed__0(void){
_start:
{
lean_object* v___x_524_; lean_object* v___x_525_; 
v___x_524_ = lean_box(0);
v___x_525_ = l_LeanBridgeNative99d469b3ee044240_carrierResult___redArg(v___x_524_);
return v___x_525_;
}
}
static lean_object* _init_l_LeanBridgeNative99d469b3ee044240_export2___closed__3(void){
_start:
{
lean_object* v___x_529_; lean_object* v___x_530_; 
v___x_529_ = ((lean_object*)(l_LeanBridgeNative99d469b3ee044240_export2___closed__2));
v___x_530_ = l_LeanBridgeNative99d469b3ee044240_carrierResult___redArg(v___x_529_);
return v___x_530_;
}
}
LEAN_EXPORT lean_object* lean_bridge_8477254b8ea47a726adc68ad_lean(lean_object* v_a0_531_){
_start:
{
lean_object* v___x_532_; 
v___x_532_ = l_LeanBridgeNative99d469b3ee044240_carrierValue___redArg(v_a0_531_);
lean_dec_ref(v_a0_531_);
if (lean_obj_tag(v___x_532_) == 0)
{
lean_object* v___x_533_; 
v___x_533_ = lean_obj_once(&l_LeanBridgeNative99d469b3ee044240_export2___closed__0, &l_LeanBridgeNative99d469b3ee044240_export2___closed__0_once, _init_l_LeanBridgeNative99d469b3ee044240_export2___closed__0);
return v___x_533_;
}
else
{
lean_object* v___x_534_; 
lean_dec_ref_known(v___x_532_, 1);
v___x_534_ = lean_obj_once(&l_LeanBridgeNative99d469b3ee044240_export2___closed__3, &l_LeanBridgeNative99d469b3ee044240_export2___closed__3_once, _init_l_LeanBridgeNative99d469b3ee044240_export2___closed__3);
return v___x_534_;
}
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNative99d469b3ee044240_export3___lam__0(lean_object* v_val_535_, lean_object* v___bridgeCallbackResult__0_536_){
_start:
{
lean_object* v___x_537_; uint8_t v___x_538_; 
v___x_537_ = lean_unsigned_to_nat(10u);
v___x_538_ = lean_nat_dec_lt(v___bridgeCallbackResult__0_536_, v___x_537_);
if (v___x_538_ == 0)
{
lean_object* v___x_539_; 
lean_dec(v___bridgeCallbackResult__0_536_);
lean_dec(v_val_535_);
v___x_539_ = lean_box(0);
return v___x_539_;
}
else
{
lean_object* v___x_540_; lean_object* v___x_541_; 
v___x_540_ = lb_callback_fin_probe_source_scaler(v_val_535_, v___bridgeCallbackResult__0_536_);
v___x_541_ = lean_alloc_ctor(1, 1, 0);
lean_ctor_set(v___x_541_, 0, v___x_540_);
return v___x_541_;
}
}
}
LEAN_EXPORT lean_object* lean_bridge_fb3aeed37b46e0e2a78ba51c_lean(lean_object* v_a0_542_){
  fputs("LB_CALLBACK_ENTRY_V1 enter adapter ReviewedCallbacks.scaler:lean\n", stderr);

_start:
{
lean_object* v___x_543_; 
v___x_543_ = l_LeanBridgeNative99d469b3ee044240_carrierValue___redArg(v_a0_542_);
lean_dec_ref(v_a0_542_);
if (lean_obj_tag(v___x_543_) == 0)
{
lean_object* v___x_544_; 
v___x_544_ = lean_obj_once(&l_LeanBridgeNative99d469b3ee044240_export1___closed__0, &l_LeanBridgeNative99d469b3ee044240_export1___closed__0_once, _init_l_LeanBridgeNative99d469b3ee044240_export1___closed__0);
return v___x_544_;
}
else
{
lean_object* v_val_545_; lean_object* v___x_547_; uint8_t v_isShared_548_; uint8_t v_isSharedCheck_554_; 
v_val_545_ = lean_ctor_get(v___x_543_, 0);
v_isSharedCheck_554_ = !lean_is_exclusive(v___x_543_);
if (v_isSharedCheck_554_ == 0)
{
v___x_547_ = v___x_543_;
v_isShared_548_ = v_isSharedCheck_554_;
goto v_resetjp_546_;
}
else
{
lean_inc(v_val_545_);
lean_dec(v___x_543_);
v___x_547_ = lean_box(0);
v_isShared_548_ = v_isSharedCheck_554_;
goto v_resetjp_546_;
}
v_resetjp_546_:
{
lean_object* v___f_549_; lean_object* v___x_551_; 
v___f_549_ = lean_alloc_closure((void*)(l_LeanBridgeNative99d469b3ee044240_export3___lam__0), 2, 1);
lean_closure_set(v___f_549_, 0, v_val_545_);
if (v_isShared_548_ == 0)
{
lean_ctor_set(v___x_547_, 0, v___f_549_);
v___x_551_ = v___x_547_;
goto v_reusejp_550_;
}
else
{
lean_object* v_reuseFailAlloc_553_; 
v_reuseFailAlloc_553_ = lean_alloc_ctor(1, 1, 0);
lean_ctor_set(v_reuseFailAlloc_553_, 0, v___f_549_);
v___x_551_ = v_reuseFailAlloc_553_;
goto v_reusejp_550_;
}
v_reusejp_550_:
{
lean_object* v___x_552_; 
v___x_552_ = l_LeanBridgeNative99d469b3ee044240_carrierResult___redArg(v___x_551_);
return v___x_552_;
}
}
}
}
}
LEAN_EXPORT uint8_t lean_bridge_2f9e82778120400da600fcee_refinement_1(lean_object* v_carrier_555_){
  fputs("LB_CALLBACK_ENTRY_V1 enter validator ReviewedCallbacks.three:validator:refinement_1\n", stderr);

_start:
{
lean_object* v___x_556_; 
v___x_556_ = l_LeanBridgeNative99d469b3ee044240_carrierValue___redArg(v_carrier_555_);
lean_dec_ref(v_carrier_555_);
if (lean_obj_tag(v___x_556_) == 0)
{
uint8_t v___x_557_; 
v___x_557_ = 0;
return v___x_557_;
}
else
{
lean_object* v_val_558_; lean_object* v___x_559_; uint8_t v___x_560_; 
v_val_558_ = lean_ctor_get(v___x_556_, 0);
lean_inc(v_val_558_);
lean_dec_ref_known(v___x_556_, 1);
v___x_559_ = lean_unsigned_to_nat(3u);
v___x_560_ = lean_nat_dec_lt(v_val_558_, v___x_559_);
lean_dec(v_val_558_);
if (v___x_560_ == 0)
{
uint8_t v___x_561_; 
v___x_561_ = 0;
return v___x_561_;
}
else
{
uint8_t v___x_562_; 
v___x_562_ = 1;
return v___x_562_;
}
}
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNative99d469b3ee044240_export4__refinement__1___boxed(lean_object* v_carrier_563_){
_start:
{
uint8_t v_res_564_; lean_object* v_r_565_; 
v_res_564_ = lean_bridge_2f9e82778120400da600fcee_refinement_1(v_carrier_563_);
v_r_565_ = lean_box(v_res_564_);
return v_r_565_;
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNative99d469b3ee044240_export4___lam__0(lean_object* v_val_566_, size_t v_val_567_, lean_object* v___x_568_, lean_object* v___bridgeCallback0__0_569_){
_start:
{
lean_object* v___x_578_; lean_object* v___x_579_; lean_object* v___x_580_; lean_object* v___x_581_; lean_object* v___x_582_; 
v___x_578_ = lean_unsigned_to_nat(1u);
v___x_579_ = lean_mk_empty_array_with_capacity(v___x_578_);
v___x_580_ = lean_array_push(v___x_579_, v___bridgeCallback0__0_569_);
v___x_581_ = lean_bridge_fa450d817b39ecc8598f3607_structured_ffe59c1b227e089c6c50c0421d94e57562f09578_invoke(v_val_567_, v___x_580_);
v___x_582_ = l_LeanBridgeNative99d469b3ee044240_carrierValue___redArg(v___x_581_);
lean_dec_ref(v___x_581_);
if (lean_obj_tag(v___x_582_) == 0)
{
goto v___jp_570_;
}
else
{
lean_object* v_val_583_; uint8_t v___x_584_; 
v_val_583_ = lean_ctor_get(v___x_582_, 0);
lean_inc(v_val_583_);
lean_dec_ref_known(v___x_582_, 1);
v___x_584_ = lean_nat_dec_lt(v_val_583_, v___x_568_);
if (v___x_584_ == 0)
{
lean_dec(v_val_583_);
goto v___jp_570_;
}
else
{
lean_dec(v_val_566_);
return v_val_583_;
}
}
v___jp_570_:
{
lean_object* v___x_571_; lean_object* v___x_572_; lean_object* v___x_573_; lean_object* v___x_574_; lean_object* v___x_575_; 
v___x_571_ = lean_unsigned_to_nat(1u);
v___x_572_ = lean_mk_empty_array_with_capacity(v___x_571_);
lean_inc(v_val_566_);
v___x_573_ = lean_array_push(v___x_572_, v_val_566_);
v___x_574_ = lean_bridge_fa450d817b39ecc8598f3607_structured_ffe59c1b227e089c6c50c0421d94e57562f09578_reject(v_val_567_, v___x_573_);
v___x_575_ = l_LeanBridgeNative99d469b3ee044240_carrierValue___redArg(v___x_574_);
lean_dec_ref(v___x_574_);
if (lean_obj_tag(v___x_575_) == 0)
{
return v_val_566_;
}
else
{
lean_object* v_val_576_; uint8_t v___x_577_; 
v_val_576_ = lean_ctor_get(v___x_575_, 0);
lean_inc(v_val_576_);
lean_dec_ref_known(v___x_575_, 1);
v___x_577_ = lean_nat_dec_lt(v_val_576_, v___x_568_);
if (v___x_577_ == 0)
{
lean_dec(v_val_576_);
return v_val_566_;
}
else
{
lean_dec(v_val_566_);
return v_val_576_;
}
}
}
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNative99d469b3ee044240_export4___lam__0___boxed(lean_object* v_val_585_, lean_object* v_val_586_, lean_object* v___x_587_, lean_object* v___bridgeCallback0__0_588_){
_start:
{
size_t v_val_511__boxed_589_; lean_object* v_res_590_; 
v_val_511__boxed_589_ = lean_unbox_usize(v_val_586_);
lean_dec(v_val_586_);
v_res_590_ = l_LeanBridgeNative99d469b3ee044240_export4___lam__0(v_val_585_, v_val_511__boxed_589_, v___x_587_, v___bridgeCallback0__0_588_);
lean_dec(v___x_587_);
return v_res_590_;
}
}
LEAN_EXPORT lean_object* lean_bridge_2f9e82778120400da600fcee_lean(lean_object* v_a0_591_, lean_object* v_a1_592_){
  fputs("LB_CALLBACK_ENTRY_V1 enter adapter ReviewedCallbacks.three:lean\n", stderr);

_start:
{
lean_object* v___x_593_; 
v___x_593_ = l_LeanBridgeNative99d469b3ee044240_carrierValue___redArg(v_a0_591_);
lean_dec_ref(v_a0_591_);
if (lean_obj_tag(v___x_593_) == 0)
{
lean_object* v___x_594_; 
lean_dec_ref(v_a1_592_);
v___x_594_ = lean_obj_once(&l_LeanBridgeNative99d469b3ee044240_field0b80133b771640d801c25___closed__0, &l_LeanBridgeNative99d469b3ee044240_field0b80133b771640d801c25___closed__0_once, _init_l_LeanBridgeNative99d469b3ee044240_field0b80133b771640d801c25___closed__0);
return v___x_594_;
}
else
{
lean_object* v_val_595_; lean_object* v___x_596_; 
v_val_595_ = lean_ctor_get(v___x_593_, 0);
lean_inc(v_val_595_);
lean_dec_ref_known(v___x_593_, 1);
v___x_596_ = l_LeanBridgeNative99d469b3ee044240_carrierValue___redArg(v_a1_592_);
lean_dec_ref(v_a1_592_);
if (lean_obj_tag(v___x_596_) == 0)
{
lean_object* v___x_597_; 
lean_dec(v_val_595_);
v___x_597_ = l_LeanBridgeNative99d469b3ee044240_carrierResult___redArg(v___x_596_);
return v___x_597_;
}
else
{
lean_object* v_val_598_; size_t v___x_599_; lean_object* v___x_600_; lean_object* v___x_601_; 
v_val_598_ = lean_ctor_get(v___x_596_, 0);
lean_inc(v_val_598_);
lean_dec_ref_known(v___x_596_, 1);
v___x_599_ = lean_unbox_usize(v_val_595_);
v___x_600_ = lean_bridge_fa450d817b39ecc8598f3607_structured_ffe59c1b227e089c6c50c0421d94e57562f09578_recovery(v___x_599_);
v___x_601_ = l_LeanBridgeNative99d469b3ee044240_carrierValue___redArg(v___x_600_);
lean_dec_ref(v___x_600_);
if (lean_obj_tag(v___x_601_) == 0)
{
lean_object* v___x_602_; 
lean_dec(v_val_598_);
lean_dec(v_val_595_);
v___x_602_ = l_LeanBridgeNative99d469b3ee044240_carrierResult___redArg(v___x_601_);
return v___x_602_;
}
else
{
lean_object* v_val_603_; lean_object* v___x_605_; uint8_t v_isShared_606_; uint8_t v_isSharedCheck_618_; 
v_val_603_ = lean_ctor_get(v___x_601_, 0);
v_isSharedCheck_618_ = !lean_is_exclusive(v___x_601_);
if (v_isSharedCheck_618_ == 0)
{
v___x_605_ = v___x_601_;
v_isShared_606_ = v_isSharedCheck_618_;
goto v_resetjp_604_;
}
else
{
lean_inc(v_val_603_);
lean_dec(v___x_601_);
v___x_605_ = lean_box(0);
v_isShared_606_ = v_isSharedCheck_618_;
goto v_resetjp_604_;
}
v_resetjp_604_:
{
lean_object* v___x_607_; uint8_t v___x_608_; 
v___x_607_ = lean_unsigned_to_nat(3u);
v___x_608_ = lean_nat_dec_lt(v_val_603_, v___x_607_);
if (v___x_608_ == 0)
{
lean_object* v___x_609_; 
lean_del_object(v___x_605_);
lean_dec(v_val_603_);
lean_dec(v_val_598_);
lean_dec(v_val_595_);
v___x_609_ = lean_obj_once(&l_LeanBridgeNative99d469b3ee044240_field0b80133b771640d801c25___closed__0, &l_LeanBridgeNative99d469b3ee044240_field0b80133b771640d801c25___closed__0_once, _init_l_LeanBridgeNative99d469b3ee044240_field0b80133b771640d801c25___closed__0);
return v___x_609_;
}
else
{
uint8_t v___x_610_; 
v___x_610_ = lean_nat_dec_lt(v_val_598_, v___x_607_);
if (v___x_610_ == 0)
{
lean_object* v___x_611_; 
lean_del_object(v___x_605_);
lean_dec(v_val_603_);
lean_dec(v_val_598_);
lean_dec(v_val_595_);
v___x_611_ = lean_obj_once(&l_LeanBridgeNative99d469b3ee044240_field0b80133b771640d801c25___closed__0, &l_LeanBridgeNative99d469b3ee044240_field0b80133b771640d801c25___closed__0_once, _init_l_LeanBridgeNative99d469b3ee044240_field0b80133b771640d801c25___closed__0);
return v___x_611_;
}
else
{
lean_object* v___f_612_; lean_object* v___x_613_; lean_object* v___x_615_; 
v___f_612_ = lean_alloc_closure((void*)(l_LeanBridgeNative99d469b3ee044240_export4___lam__0___boxed), 4, 3);
lean_closure_set(v___f_612_, 0, v_val_603_);
lean_closure_set(v___f_612_, 1, v_val_595_);
lean_closure_set(v___f_612_, 2, v___x_607_);
v___x_613_ = lb_callback_fin_probe_source_three(v___f_612_, v_val_598_);
if (v_isShared_606_ == 0)
{
lean_ctor_set(v___x_605_, 0, v___x_613_);
v___x_615_ = v___x_605_;
goto v_reusejp_614_;
}
else
{
lean_object* v_reuseFailAlloc_617_; 
v_reuseFailAlloc_617_ = lean_alloc_ctor(1, 1, 0);
lean_ctor_set(v_reuseFailAlloc_617_, 0, v___x_613_);
v___x_615_ = v_reuseFailAlloc_617_;
goto v_reusejp_614_;
}
v_reusejp_614_:
{
lean_object* v___x_616_; 
v___x_616_ = l_LeanBridgeNative99d469b3ee044240_carrierResult___redArg(v___x_615_);
return v___x_616_;
}
}
}
}
}
}
}
}
}
static lean_object* _init_l_LeanBridgeNative99d469b3ee044240_export5___closed__0(void){
_start:
{
lean_object* v___x_619_; lean_object* v___x_620_; 
v___x_619_ = lean_box(0);
v___x_620_ = l_LeanBridgeNative99d469b3ee044240_carrierResult___redArg(v___x_619_);
return v___x_620_;
}
}
LEAN_EXPORT lean_object* lean_bridge_e429d90b6e2575f2175e6951_lean(lean_object* v_a0_621_){
  fputs("LB_CALLBACK_ENTRY_V1 enter adapter ReviewedCallbacks.tileMaker:lean\n", stderr);

_start:
{
lean_object* v___x_622_; 
v___x_622_ = l_LeanBridgeNative99d469b3ee044240_carrierValue___redArg(v_a0_621_);
lean_dec_ref(v_a0_621_);
if (lean_obj_tag(v___x_622_) == 0)
{
lean_object* v___x_623_; 
v___x_623_ = lean_obj_once(&l_LeanBridgeNative99d469b3ee044240_export5___closed__0, &l_LeanBridgeNative99d469b3ee044240_export5___closed__0_once, _init_l_LeanBridgeNative99d469b3ee044240_export5___closed__0);
return v___x_623_;
}
else
{
lean_object* v_val_624_; lean_object* v___x_626_; uint8_t v_isShared_627_; uint8_t v_isSharedCheck_633_; 
v_val_624_ = lean_ctor_get(v___x_622_, 0);
v_isSharedCheck_633_ = !lean_is_exclusive(v___x_622_);
if (v_isSharedCheck_633_ == 0)
{
v___x_626_ = v___x_622_;
v_isShared_627_ = v_isSharedCheck_633_;
goto v_resetjp_625_;
}
else
{
lean_inc(v_val_624_);
lean_dec(v___x_622_);
v___x_626_ = lean_box(0);
v_isShared_627_ = v_isSharedCheck_633_;
goto v_resetjp_625_;
}
v_resetjp_625_:
{
lean_object* v___x_628_; lean_object* v___x_630_; 
v___x_628_ = lean_alloc_closure((void*)(lb_callback_fin_probe_source_tileMaker), 2, 1);
lean_closure_set(v___x_628_, 0, v_val_624_);
if (v_isShared_627_ == 0)
{
lean_ctor_set(v___x_626_, 0, v___x_628_);
v___x_630_ = v___x_626_;
goto v_reusejp_629_;
}
else
{
lean_object* v_reuseFailAlloc_632_; 
v_reuseFailAlloc_632_ = lean_alloc_ctor(1, 1, 0);
lean_ctor_set(v_reuseFailAlloc_632_, 0, v___x_628_);
v___x_630_ = v_reuseFailAlloc_632_;
goto v_reusejp_629_;
}
v_reusejp_629_:
{
lean_object* v___x_631_; 
v___x_631_ = l_LeanBridgeNative99d469b3ee044240_carrierResult___redArg(v___x_630_);
return v___x_631_;
}
}
}
}
}
static lean_object* _init_l_LeanBridgeNative99d469b3ee044240_export6___closed__0(void){
_start:
{
lean_object* v___x_634_; lean_object* v___x_635_; 
v___x_634_ = lean_box(0);
v___x_635_ = l_LeanBridgeNative99d469b3ee044240_carrierResult___redArg(v___x_634_);
return v___x_635_;
}
}
LEAN_EXPORT lean_object* lean_bridge_b6410c4c69dffaa409842d74_lean(lean_object* v_a0_636_){
  fputs("LB_CALLBACK_ENTRY_V1 enter adapter ReviewedCallbacks.tiles:lean\n", stderr);

_start:
{
lean_object* v___x_637_; 
v___x_637_ = l_LeanBridgeNative99d469b3ee044240_carrierValue___redArg(v_a0_636_);
lean_dec_ref(v_a0_636_);
if (lean_obj_tag(v___x_637_) == 0)
{
lean_object* v___x_638_; 
v___x_638_ = lean_obj_once(&l_LeanBridgeNative99d469b3ee044240_export6___closed__0, &l_LeanBridgeNative99d469b3ee044240_export6___closed__0_once, _init_l_LeanBridgeNative99d469b3ee044240_export6___closed__0);
return v___x_638_;
}
else
{
lean_object* v_val_639_; lean_object* v___x_641_; uint8_t v_isShared_642_; uint8_t v_isSharedCheck_648_; 
v_val_639_ = lean_ctor_get(v___x_637_, 0);
v_isSharedCheck_648_ = !lean_is_exclusive(v___x_637_);
if (v_isSharedCheck_648_ == 0)
{
v___x_641_ = v___x_637_;
v_isShared_642_ = v_isSharedCheck_648_;
goto v_resetjp_640_;
}
else
{
lean_inc(v_val_639_);
lean_dec(v___x_637_);
v___x_641_ = lean_box(0);
v_isShared_642_ = v_isSharedCheck_648_;
goto v_resetjp_640_;
}
v_resetjp_640_:
{
lean_object* v___x_643_; lean_object* v___x_645_; 
v___x_643_ = lean_alloc_closure((void*)(lb_callback_fin_probe_source_tiles), 2, 1);
lean_closure_set(v___x_643_, 0, v_val_639_);
if (v_isShared_642_ == 0)
{
lean_ctor_set(v___x_641_, 0, v___x_643_);
v___x_645_ = v___x_641_;
goto v_reusejp_644_;
}
else
{
lean_object* v_reuseFailAlloc_647_; 
v_reuseFailAlloc_647_ = lean_alloc_ctor(1, 1, 0);
lean_ctor_set(v_reuseFailAlloc_647_, 0, v___x_643_);
v___x_645_ = v_reuseFailAlloc_647_;
goto v_reusejp_644_;
}
v_reusejp_644_:
{
lean_object* v___x_646_; 
v___x_646_ = l_LeanBridgeNative99d469b3ee044240_carrierResult___redArg(v___x_645_);
return v___x_646_;
}
}
}
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNative99d469b3ee044240_export7___lam__0(size_t v_val_649_, lean_object* v_val_650_, lean_object* v___bridgeCallback0__0_651_){
_start:
{
lean_object* v___x_652_; lean_object* v___x_653_; lean_object* v___x_654_; lean_object* v___x_655_; lean_object* v___x_656_; 
v___x_652_ = lean_unsigned_to_nat(1u);
v___x_653_ = lean_mk_empty_array_with_capacity(v___x_652_);
lean_inc_ref(v___x_653_);
v___x_654_ = lean_array_push(v___x_653_, v___bridgeCallback0__0_651_);
v___x_655_ = lean_bridge_fa450d817b39ecc8598f3607_structured_1c8c62ab9d1ea80d3641b41193c41bc6de9a3096_invoke(v_val_649_, v___x_654_);
v___x_656_ = l_LeanBridgeNative99d469b3ee044240_carrierValue___redArg(v___x_655_);
lean_dec_ref(v___x_655_);
if (lean_obj_tag(v___x_656_) == 0)
{
lean_object* v___x_657_; lean_object* v___x_658_; lean_object* v___x_659_; 
lean_inc(v_val_650_);
v___x_657_ = lean_array_push(v___x_653_, v_val_650_);
v___x_658_ = lean_bridge_fa450d817b39ecc8598f3607_structured_1c8c62ab9d1ea80d3641b41193c41bc6de9a3096_reject(v_val_649_, v___x_657_);
v___x_659_ = l_LeanBridgeNative99d469b3ee044240_carrierValue___redArg(v___x_658_);
lean_dec_ref(v___x_658_);
if (lean_obj_tag(v___x_659_) == 0)
{
return v_val_650_;
}
else
{
lean_object* v_val_660_; 
lean_dec(v_val_650_);
v_val_660_ = lean_ctor_get(v___x_659_, 0);
lean_inc(v_val_660_);
lean_dec_ref_known(v___x_659_, 1);
return v_val_660_;
}
}
else
{
lean_object* v_val_661_; 
lean_dec_ref(v___x_653_);
lean_dec(v_val_650_);
v_val_661_ = lean_ctor_get(v___x_656_, 0);
lean_inc(v_val_661_);
lean_dec_ref_known(v___x_656_, 1);
return v_val_661_;
}
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNative99d469b3ee044240_export7___lam__0___boxed(lean_object* v_val_662_, lean_object* v_val_663_, lean_object* v___bridgeCallback0__0_664_){
_start:
{
size_t v_val_256__boxed_665_; lean_object* v_res_666_; 
v_val_256__boxed_665_ = lean_unbox_usize(v_val_662_);
lean_dec(v_val_662_);
v_res_666_ = l_LeanBridgeNative99d469b3ee044240_export7___lam__0(v_val_256__boxed_665_, v_val_663_, v___bridgeCallback0__0_664_);
return v_res_666_;
}
}
LEAN_EXPORT lean_object* lean_bridge_a4054277eb23862f1406fddb_lean(lean_object* v_a0_667_){
  fputs("LB_CALLBACK_ENTRY_V1 enter adapter ReviewedCallbacks.visit:lean\n", stderr);

_start:
{
lean_object* v___x_668_; 
v___x_668_ = l_LeanBridgeNative99d469b3ee044240_carrierValue___redArg(v_a0_667_);
lean_dec_ref(v_a0_667_);
if (lean_obj_tag(v___x_668_) == 0)
{
lean_object* v___x_669_; 
v___x_669_ = lean_obj_once(&l_LeanBridgeNative99d469b3ee044240_field0b80133b771640d801c25___closed__0, &l_LeanBridgeNative99d469b3ee044240_field0b80133b771640d801c25___closed__0_once, _init_l_LeanBridgeNative99d469b3ee044240_field0b80133b771640d801c25___closed__0);
return v___x_669_;
}
else
{
lean_object* v_val_670_; size_t v___x_671_; lean_object* v___x_672_; lean_object* v___x_673_; 
v_val_670_ = lean_ctor_get(v___x_668_, 0);
lean_inc(v_val_670_);
lean_dec_ref_known(v___x_668_, 1);
v___x_671_ = lean_unbox_usize(v_val_670_);
v___x_672_ = lean_bridge_fa450d817b39ecc8598f3607_structured_1c8c62ab9d1ea80d3641b41193c41bc6de9a3096_recovery(v___x_671_);
v___x_673_ = l_LeanBridgeNative99d469b3ee044240_carrierValue___redArg(v___x_672_);
lean_dec_ref(v___x_672_);
if (lean_obj_tag(v___x_673_) == 0)
{
lean_object* v___x_674_; 
lean_dec(v_val_670_);
v___x_674_ = l_LeanBridgeNative99d469b3ee044240_carrierResult___redArg(v___x_673_);
return v___x_674_;
}
else
{
lean_object* v_val_675_; lean_object* v___x_677_; uint8_t v_isShared_678_; uint8_t v_isSharedCheck_685_; 
v_val_675_ = lean_ctor_get(v___x_673_, 0);
v_isSharedCheck_685_ = !lean_is_exclusive(v___x_673_);
if (v_isSharedCheck_685_ == 0)
{
v___x_677_ = v___x_673_;
v_isShared_678_ = v_isSharedCheck_685_;
goto v_resetjp_676_;
}
else
{
lean_inc(v_val_675_);
lean_dec(v___x_673_);
v___x_677_ = lean_box(0);
v_isShared_678_ = v_isSharedCheck_685_;
goto v_resetjp_676_;
}
v_resetjp_676_:
{
lean_object* v___f_679_; lean_object* v___x_680_; lean_object* v___x_682_; 
v___f_679_ = lean_alloc_closure((void*)(l_LeanBridgeNative99d469b3ee044240_export7___lam__0___boxed), 3, 2);
lean_closure_set(v___f_679_, 0, v_val_670_);
lean_closure_set(v___f_679_, 1, v_val_675_);
v___x_680_ = lb_callback_fin_probe_source_visit(v___f_679_);
if (v_isShared_678_ == 0)
{
lean_ctor_set(v___x_677_, 0, v___x_680_);
v___x_682_ = v___x_677_;
goto v_reusejp_681_;
}
else
{
lean_object* v_reuseFailAlloc_684_; 
v_reuseFailAlloc_684_ = lean_alloc_ctor(1, 1, 0);
lean_ctor_set(v_reuseFailAlloc_684_, 0, v___x_680_);
v___x_682_ = v_reuseFailAlloc_684_;
goto v_reusejp_681_;
}
v_reusejp_681_:
{
lean_object* v___x_683_; 
v___x_683_ = l_LeanBridgeNative99d469b3ee044240_carrierResult___redArg(v___x_682_);
return v___x_683_;
}
}
}
}
}
}
lean_object* initialize_Init(uint8_t builtin);
lean_object* initialize_Init(uint8_t builtin);
lean_object* initialize_ReviewedCallbacks(uint8_t builtin);
static bool _G_initialized = false;
LEAN_EXPORT lean_object* initialize_LeanBridgeNative99d469b3ee044240(uint8_t builtin) {
lean_object * res;
if (_G_initialized) return lean_io_result_mk_ok(lean_box(0));
_G_initialized = true;
res = initialize_Init(builtin);
if (lean_io_result_is_error(res)) return res;
lean_dec_ref(res);
res = initialize_Init(builtin);
if (lean_io_result_is_error(res)) return res;
lean_dec_ref(res);
res = initialize_ReviewedCallbacks(builtin);
if (lean_io_result_is_error(res)) return res;
lean_dec_ref(res);
return lean_io_result_mk_ok(lean_box(0));
}
#ifdef __cplusplus
}
#endif

#include "component.h"
