#include <stdio.h>
// Lean compiler output
// Module: LeanBridgeNative730462696d8af341
// Imports: public import Init public meta import Init public import CallbackSubtypes
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
size_t lean_array_size(lean_object*);
uint8_t lean_usize_dec_lt(size_t, size_t);
lean_object* lean_array_uget(lean_object*, size_t);
lean_object* lean_array_uset(lean_object*, size_t, lean_object*);
size_t lean_usize_add(size_t, size_t);
lean_object* lb_callback_subtype_probe_constructor_checkedPositive(lean_object*);
lean_object* lean_mk_empty_array_with_capacity(lean_object*);
lean_object* lean_array_push(lean_object*, lean_object*);
lean_object* lean_array_get_size(lean_object*);
uint8_t lean_nat_dec_lt(lean_object*, lean_object*);
uint8_t lean_nat_dec_eq(lean_object*, lean_object*);
lean_object* lean_array_fget_borrowed(lean_object*, lean_object*);
lean_object* lean_nat_sub(lean_object*, lean_object*);
lean_object* lean_array_uget_borrowed(lean_object*, size_t);
lean_object* l_CallbackSubtypes_makeMixedClosure___redArg(lean_object*);
lean_object* lb_callback_subtype_probe_source_callHost(lean_object*);
lean_object* l_CallbackSubtypes_makeClosure___redArg(lean_object*);
lean_object* l_Array_extract___redArg(lean_object*, lean_object*, lean_object*);
lean_object* l_CallbackSubtypes_callHostContainer(lean_object*);
lean_object* lb_callback_subtype_probe_source_callHostMixed(lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNative730462696d8af341_carrierValue___redArg(lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNative730462696d8af341_carrierValue___redArg___boxed(lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNative730462696d8af341_carrierValue(lean_object*, lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNative730462696d8af341_carrierValue___boxed(lean_object*, lean_object*);
static const lean_array_object l_LeanBridgeNative730462696d8af341_carrierResult___redArg___closed__0_value = {.m_header = {.m_rc = 0, .m_cs_sz = sizeof(lean_array_object) + sizeof(void*)*0, .m_other = 0, .m_tag = 246}, .m_size = 0, .m_capacity = 0, .m_data = {}};
static const lean_object* l_LeanBridgeNative730462696d8af341_carrierResult___redArg___closed__0 = (const lean_object*)&l_LeanBridgeNative730462696d8af341_carrierResult___redArg___closed__0_value;
LEAN_EXPORT lean_object* l_LeanBridgeNative730462696d8af341_carrierResult___redArg(lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNative730462696d8af341_carrierResult(lean_object*, lean_object*);
static const lean_ctor_object l___private_Init_Data_Array_Basic_0__Array_forIn_x27Unsafe_loop___at___00LeanBridgeNative730462696d8af341_carrierCollect_spec__0___redArg___closed__0_value = {.m_header = {.m_rc = 0, .m_cs_sz = sizeof(lean_ctor_object) + sizeof(void*)*1 + 0, .m_other = 1, .m_tag = 1}, .m_objs = {((lean_object*)(((size_t)(0) << 1) | 1))}};
static const lean_object* l___private_Init_Data_Array_Basic_0__Array_forIn_x27Unsafe_loop___at___00LeanBridgeNative730462696d8af341_carrierCollect_spec__0___redArg___closed__0 = (const lean_object*)&l___private_Init_Data_Array_Basic_0__Array_forIn_x27Unsafe_loop___at___00LeanBridgeNative730462696d8af341_carrierCollect_spec__0___redArg___closed__0_value;
LEAN_EXPORT lean_object* l___private_Init_Data_Array_Basic_0__Array_forIn_x27Unsafe_loop___at___00LeanBridgeNative730462696d8af341_carrierCollect_spec__0___redArg(lean_object*, size_t, size_t, lean_object*);
LEAN_EXPORT lean_object* l___private_Init_Data_Array_Basic_0__Array_forIn_x27Unsafe_loop___at___00LeanBridgeNative730462696d8af341_carrierCollect_spec__0___redArg___boxed(lean_object*, lean_object*, lean_object*, lean_object*);
static const lean_ctor_object l_LeanBridgeNative730462696d8af341_carrierCollect___redArg___closed__0_value = {.m_header = {.m_rc = 0, .m_cs_sz = sizeof(lean_ctor_object) + sizeof(void*)*2 + 0, .m_other = 2, .m_tag = 0}, .m_objs = {((lean_object*)(((size_t)(0) << 1) | 1)),((lean_object*)&l_LeanBridgeNative730462696d8af341_carrierResult___redArg___closed__0_value)}};
static const lean_object* l_LeanBridgeNative730462696d8af341_carrierCollect___redArg___closed__0 = (const lean_object*)&l_LeanBridgeNative730462696d8af341_carrierCollect___redArg___closed__0_value;
LEAN_EXPORT lean_object* l_LeanBridgeNative730462696d8af341_carrierCollect___redArg(lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNative730462696d8af341_carrierCollect___redArg___boxed(lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNative730462696d8af341_carrierCollect(lean_object*, lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNative730462696d8af341_carrierCollect___boxed(lean_object*, lean_object*);
LEAN_EXPORT lean_object* l___private_Init_Data_Array_Basic_0__Array_forIn_x27Unsafe_loop___at___00LeanBridgeNative730462696d8af341_carrierCollect_spec__0(lean_object*, lean_object*, size_t, size_t, lean_object*);
LEAN_EXPORT lean_object* l___private_Init_Data_Array_Basic_0__Array_forIn_x27Unsafe_loop___at___00LeanBridgeNative730462696d8af341_carrierCollect_spec__0___boxed(lean_object*, lean_object*, lean_object*, lean_object*, lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNative730462696d8af341_carrierListItems_loop___redArg(lean_object*, lean_object*, lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNative730462696d8af341_carrierListItems_loop(lean_object*, lean_object*, lean_object*, lean_object*);
static const lean_array_object l_LeanBridgeNative730462696d8af341_carrierListItems___redArg___closed__0_value = {.m_header = {.m_rc = 0, .m_cs_sz = sizeof(lean_array_object) + sizeof(void*)*0, .m_other = 0, .m_tag = 246}, .m_size = 0, .m_capacity = 0, .m_data = {}};
static const lean_object* l_LeanBridgeNative730462696d8af341_carrierListItems___redArg___closed__0 = (const lean_object*)&l_LeanBridgeNative730462696d8af341_carrierListItems___redArg___closed__0_value;
LEAN_EXPORT lean_object* l_LeanBridgeNative730462696d8af341_carrierListItems___redArg(lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNative730462696d8af341_carrierListItems(lean_object*, lean_object*);
LEAN_EXPORT lean_object* lean_bridge_23220a30761b2d3716c5b4ed_recursive_4fb79b80af1133bbb83d_make(lean_object*);
LEAN_EXPORT lean_object* l___private_Init_Data_Array_Basic_0__Array_mapMUnsafe_map___at___00LeanBridgeNative730462696d8af341_items4fb79b80af1133bbb83d_spec__0(size_t, size_t, lean_object*);
LEAN_EXPORT lean_object* l___private_Init_Data_Array_Basic_0__Array_mapMUnsafe_map___at___00LeanBridgeNative730462696d8af341_items4fb79b80af1133bbb83d_spec__0___boxed(lean_object*, lean_object*, lean_object*);
static const lean_array_object l_LeanBridgeNative730462696d8af341_items4fb79b80af1133bbb83d___closed__0_value = {.m_header = {.m_rc = 0, .m_cs_sz = sizeof(lean_array_object) + sizeof(void*)*0, .m_other = 0, .m_tag = 246}, .m_size = 0, .m_capacity = 0, .m_data = {}};
static const lean_object* l_LeanBridgeNative730462696d8af341_items4fb79b80af1133bbb83d___closed__0 = (const lean_object*)&l_LeanBridgeNative730462696d8af341_items4fb79b80af1133bbb83d___closed__0_value;
LEAN_EXPORT lean_object* lean_bridge_23220a30761b2d3716c5b4ed_recursive_4fb79b80af1133bbb83d_items(lean_object*);
LEAN_EXPORT uint32_t lean_bridge_23220a30761b2d3716c5b4ed_recursive_3f262999893350bc4fb4_branch(lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNative730462696d8af341_branch3f262999893350bc4fb4___boxed(lean_object*);
static const lean_ctor_object l_LeanBridgeNative730462696d8af341_none3f262999893350bc4fb4___closed__0_value = {.m_header = {.m_rc = 0, .m_cs_sz = sizeof(lean_ctor_object) + sizeof(void*)*1 + 0, .m_other = 1, .m_tag = 1}, .m_objs = {((lean_object*)(((size_t)(0) << 1) | 1))}};
static const lean_object* l_LeanBridgeNative730462696d8af341_none3f262999893350bc4fb4___closed__0 = (const lean_object*)&l_LeanBridgeNative730462696d8af341_none3f262999893350bc4fb4___closed__0_value;
static lean_once_cell_t l_LeanBridgeNative730462696d8af341_none3f262999893350bc4fb4___closed__1_once = LEAN_ONCE_CELL_INITIALIZER;
static lean_object* l_LeanBridgeNative730462696d8af341_none3f262999893350bc4fb4___closed__1;
LEAN_EXPORT lean_object* lean_bridge_23220a30761b2d3716c5b4ed_recursive_3f262999893350bc4fb4_none(lean_object*);
static lean_once_cell_t l_LeanBridgeNative730462696d8af341_make03f262999893350bc4fb4___closed__0_once = LEAN_ONCE_CELL_INITIALIZER;
static lean_object* l_LeanBridgeNative730462696d8af341_make03f262999893350bc4fb4___closed__0;
LEAN_EXPORT lean_object* lean_bridge_23220a30761b2d3716c5b4ed_recursive_3f262999893350bc4fb4_make0(lean_object*);
static lean_once_cell_t l_LeanBridgeNative730462696d8af341_field03f262999893350bc4fb4___closed__0_once = LEAN_ONCE_CELL_INITIALIZER;
static lean_object* l_LeanBridgeNative730462696d8af341_field03f262999893350bc4fb4___closed__0;
LEAN_EXPORT lean_object* lean_bridge_23220a30761b2d3716c5b4ed_recursive_3f262999893350bc4fb4_field0(lean_object*);
LEAN_EXPORT uint32_t lean_bridge_23220a30761b2d3716c5b4ed_recursive_ec3de31d02aa0faa1710_branch(lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNative730462696d8af341_branchec3de31d02aa0faa1710___boxed(lean_object*);
static lean_once_cell_t l_LeanBridgeNative730462696d8af341_make0ec3de31d02aa0faa1710___closed__0_once = LEAN_ONCE_CELL_INITIALIZER;
static lean_object* l_LeanBridgeNative730462696d8af341_make0ec3de31d02aa0faa1710___closed__0;
LEAN_EXPORT lean_object* lean_bridge_23220a30761b2d3716c5b4ed_recursive_ec3de31d02aa0faa1710_make0(lean_object*);
LEAN_EXPORT lean_object* lean_bridge_23220a30761b2d3716c5b4ed_recursive_ec3de31d02aa0faa1710_field0(lean_object*);
LEAN_EXPORT lean_object* lean_bridge_23220a30761b2d3716c5b4ed_recursive_ec3de31d02aa0faa1710_make1(lean_object*);
static lean_once_cell_t l_LeanBridgeNative730462696d8af341_field1ec3de31d02aa0faa1710___closed__0_once = LEAN_ONCE_CELL_INITIALIZER;
static lean_object* l_LeanBridgeNative730462696d8af341_field1ec3de31d02aa0faa1710___closed__0;
LEAN_EXPORT lean_object* lean_bridge_23220a30761b2d3716c5b4ed_recursive_ec3de31d02aa0faa1710_field1(lean_object*);
lean_object* lean_bridge_23220a30761b2d3716c5b4ed_structured_14cd8f1b0d065ede9a36f8590000c62c12d8e99c_invoke(size_t, lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNative730462696d8af341_invoke__14cd8f1b0d065ede9a36f8590000c62c12d8e99c___boxed(lean_object*, lean_object*);
lean_object* lean_bridge_23220a30761b2d3716c5b4ed_structured_14cd8f1b0d065ede9a36f8590000c62c12d8e99c_recovery(size_t);
LEAN_EXPORT lean_object* l_LeanBridgeNative730462696d8af341_recovery__14cd8f1b0d065ede9a36f8590000c62c12d8e99c___boxed(lean_object*);
lean_object* lean_bridge_23220a30761b2d3716c5b4ed_structured_14cd8f1b0d065ede9a36f8590000c62c12d8e99c_reject(size_t, lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNative730462696d8af341_reject__14cd8f1b0d065ede9a36f8590000c62c12d8e99c___boxed(lean_object*, lean_object*);
LEAN_EXPORT lean_object* lean_bridge_23220a30761b2d3716c5b4ed_structured_14cd8f1b0d065ede9a36f8590000c62c12d8e99c_wrap(size_t);
LEAN_EXPORT lean_object* l_LeanBridgeNative730462696d8af341_wrap__14cd8f1b0d065ede9a36f8590000c62c12d8e99c___boxed(lean_object*);
LEAN_EXPORT lean_object* lean_bridge_23220a30761b2d3716c5b4ed_structured_c27fa7df7f1805196544d398fb121b21c179beb1_apply(lean_object*, lean_object*);
LEAN_EXPORT uint8_t lean_bridge_23220a30761b2d3716c5b4ed_structured_c27fa7df7f1805196544d398fb121b21c179beb1_closure_graph_refinement_0_ba12b83e7ba38842c8fd(lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNative730462696d8af341_closure__c27fa7df7f1805196544d398fb121b21c179beb1__graph__refinement__0__ba12b83e7ba38842c8fd___boxed(lean_object*);
lean_object* lean_bridge_23220a30761b2d3716c5b4ed_structured_197d5bf19058d37bc5547c33a8e0bed3bf121ea7_invoke(size_t, lean_object*, lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNative730462696d8af341_invoke__197d5bf19058d37bc5547c33a8e0bed3bf121ea7___boxed(lean_object*, lean_object*, lean_object*);
lean_object* lean_bridge_23220a30761b2d3716c5b4ed_structured_197d5bf19058d37bc5547c33a8e0bed3bf121ea7_recovery(size_t);
LEAN_EXPORT lean_object* l_LeanBridgeNative730462696d8af341_recovery__197d5bf19058d37bc5547c33a8e0bed3bf121ea7___boxed(lean_object*);
lean_object* lean_bridge_23220a30761b2d3716c5b4ed_structured_197d5bf19058d37bc5547c33a8e0bed3bf121ea7_reject(size_t, lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNative730462696d8af341_reject__197d5bf19058d37bc5547c33a8e0bed3bf121ea7___boxed(lean_object*, lean_object*);
LEAN_EXPORT lean_object* lean_bridge_23220a30761b2d3716c5b4ed_structured_197d5bf19058d37bc5547c33a8e0bed3bf121ea7_wrap(size_t);
LEAN_EXPORT lean_object* l_LeanBridgeNative730462696d8af341_wrap__197d5bf19058d37bc5547c33a8e0bed3bf121ea7___boxed(lean_object*);
LEAN_EXPORT lean_object* lean_bridge_23220a30761b2d3716c5b4ed_structured_51bfd752726fcfd8a9187a7c3a979ace51f7c1be_apply(lean_object*, lean_object*, lean_object*);
LEAN_EXPORT uint8_t lean_bridge_23220a30761b2d3716c5b4ed_structured_51bfd752726fcfd8a9187a7c3a979ace51f7c1be_closure_graph_refinement_1_ba12b83e7ba38842c8fd(lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNative730462696d8af341_closure__51bfd752726fcfd8a9187a7c3a979ace51f7c1be__graph__refinement__1__ba12b83e7ba38842c8fd___boxed(lean_object*);
LEAN_EXPORT lean_object* lean_bridge_23220a30761b2d3716c5b4ed_structured_6cdd9c3be7604978d190e4f9d3a70db0539487ba_apply(lean_object*, lean_object*);
LEAN_EXPORT uint8_t lean_bridge_23220a30761b2d3716c5b4ed_structured_6cdd9c3be7604978d190e4f9d3a70db0539487ba_closure_graph_refinement_0_ba12b83e7ba38842c8fd(lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNative730462696d8af341_closure__6cdd9c3be7604978d190e4f9d3a70db0539487ba__graph__refinement__0__ba12b83e7ba38842c8fd___boxed(lean_object*);
lean_object* lean_bridge_23220a30761b2d3716c5b4ed_structured_6bc98ee774b20d3238b9e42a92309a51ce9dad0a_invoke(size_t, lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNative730462696d8af341_invoke__6bc98ee774b20d3238b9e42a92309a51ce9dad0a___boxed(lean_object*, lean_object*);
lean_object* lean_bridge_23220a30761b2d3716c5b4ed_structured_6bc98ee774b20d3238b9e42a92309a51ce9dad0a_recovery(size_t);
LEAN_EXPORT lean_object* l_LeanBridgeNative730462696d8af341_recovery__6bc98ee774b20d3238b9e42a92309a51ce9dad0a___boxed(lean_object*);
lean_object* lean_bridge_23220a30761b2d3716c5b4ed_structured_6bc98ee774b20d3238b9e42a92309a51ce9dad0a_reject(size_t, lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNative730462696d8af341_reject__6bc98ee774b20d3238b9e42a92309a51ce9dad0a___boxed(lean_object*, lean_object*);
LEAN_EXPORT lean_object* lean_bridge_23220a30761b2d3716c5b4ed_structured_6bc98ee774b20d3238b9e42a92309a51ce9dad0a_wrap(size_t);
LEAN_EXPORT lean_object* l_LeanBridgeNative730462696d8af341_wrap__6bc98ee774b20d3238b9e42a92309a51ce9dad0a___boxed(lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNative730462696d8af341_export0___lam__0(lean_object*, size_t, lean_object*, lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNative730462696d8af341_export0___lam__0___boxed(lean_object*, lean_object*, lean_object*, lean_object*);
LEAN_EXPORT lean_object* lean_bridge_23220a30761b2d3716c5b4ed_lean(lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNative730462696d8af341_export1___lam__0(lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNative730462696d8af341_export1___lam__1(lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNative730462696d8af341_export1___lam__2(lean_object*, size_t, lean_object*, lean_object*, lean_object*, lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNative730462696d8af341_export1___lam__2___boxed(lean_object*, lean_object*, lean_object*, lean_object*, lean_object*, lean_object*);
static const lean_closure_object l_LeanBridgeNative730462696d8af341_export1___closed__0_value = {.m_header = {.m_rc = 0, .m_cs_sz = sizeof(lean_closure_object) + sizeof(void*)*0, .m_other = 0, .m_tag = 245}, .m_fun = (void*)l_LeanBridgeNative730462696d8af341_export1___lam__0, .m_arity = 1, .m_num_fixed = 0, .m_objs = {} };
static const lean_object* l_LeanBridgeNative730462696d8af341_export1___closed__0 = (const lean_object*)&l_LeanBridgeNative730462696d8af341_export1___closed__0_value;
static const lean_closure_object l_LeanBridgeNative730462696d8af341_export1___closed__1_value = {.m_header = {.m_rc = 0, .m_cs_sz = sizeof(lean_closure_object) + sizeof(void*)*0, .m_other = 0, .m_tag = 245}, .m_fun = (void*)l_LeanBridgeNative730462696d8af341_export1___lam__1, .m_arity = 1, .m_num_fixed = 0, .m_objs = {} };
static const lean_object* l_LeanBridgeNative730462696d8af341_export1___closed__1 = (const lean_object*)&l_LeanBridgeNative730462696d8af341_export1___closed__1_value;
static const lean_ctor_object l_LeanBridgeNative730462696d8af341_export1___closed__2_value = {.m_header = {.m_rc = 0, .m_cs_sz = sizeof(lean_ctor_object) + sizeof(void*)*1 + 0, .m_other = 1, .m_tag = 1}, .m_objs = {((lean_object*)(((size_t)(0) << 1) | 1))}};
static const lean_object* l_LeanBridgeNative730462696d8af341_export1___closed__2 = (const lean_object*)&l_LeanBridgeNative730462696d8af341_export1___closed__2_value;
static const lean_ctor_object l_LeanBridgeNative730462696d8af341_export1___closed__3_value = {.m_header = {.m_rc = 0, .m_cs_sz = sizeof(lean_ctor_object) + sizeof(void*)*1 + 0, .m_other = 1, .m_tag = 1}, .m_objs = {((lean_object*)&l_LeanBridgeNative730462696d8af341_export1___closed__2_value)}};
static const lean_object* l_LeanBridgeNative730462696d8af341_export1___closed__3 = (const lean_object*)&l_LeanBridgeNative730462696d8af341_export1___closed__3_value;
static lean_once_cell_t l_LeanBridgeNative730462696d8af341_export1___closed__4_once = LEAN_ONCE_CELL_INITIALIZER;
static lean_object* l_LeanBridgeNative730462696d8af341_export1___closed__4;
LEAN_EXPORT lean_object* lean_bridge_8ffe188578f9a7b74003cf3c_lean(lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNative730462696d8af341_export2___lam__0(lean_object*, size_t, lean_object*, lean_object*, lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNative730462696d8af341_export2___lam__0___boxed(lean_object*, lean_object*, lean_object*, lean_object*, lean_object*);
LEAN_EXPORT lean_object* lean_bridge_4f106adfac5064464a2a8e3f_lean(lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNative730462696d8af341_export3___lam__0(lean_object*);
static lean_once_cell_t l_LeanBridgeNative730462696d8af341_export3___closed__0_once = LEAN_ONCE_CELL_INITIALIZER;
static lean_object* l_LeanBridgeNative730462696d8af341_export3___closed__0;
static const lean_closure_object l_LeanBridgeNative730462696d8af341_export3___closed__1_value = {.m_header = {.m_rc = 0, .m_cs_sz = sizeof(lean_closure_object) + sizeof(void*)*0, .m_other = 0, .m_tag = 245}, .m_fun = (void*)l_LeanBridgeNative730462696d8af341_export3___lam__0, .m_arity = 1, .m_num_fixed = 0, .m_objs = {} };
static const lean_object* l_LeanBridgeNative730462696d8af341_export3___closed__1 = (const lean_object*)&l_LeanBridgeNative730462696d8af341_export3___closed__1_value;
static const lean_ctor_object l_LeanBridgeNative730462696d8af341_export3___closed__2_value = {.m_header = {.m_rc = 0, .m_cs_sz = sizeof(lean_ctor_object) + sizeof(void*)*1 + 0, .m_other = 1, .m_tag = 1}, .m_objs = {((lean_object*)&l_LeanBridgeNative730462696d8af341_export3___closed__1_value)}};
static const lean_object* l_LeanBridgeNative730462696d8af341_export3___closed__2 = (const lean_object*)&l_LeanBridgeNative730462696d8af341_export3___closed__2_value;
static lean_once_cell_t l_LeanBridgeNative730462696d8af341_export3___closed__3_once = LEAN_ONCE_CELL_INITIALIZER;
static lean_object* l_LeanBridgeNative730462696d8af341_export3___closed__3;
LEAN_EXPORT lean_object* lean_bridge_e2d5407c03792441cb368ec1_lean(lean_object*);
LEAN_EXPORT lean_object* l___private_Init_Data_Array_Basic_0__Array_mapMUnsafe_map___at___00LeanBridgeNative730462696d8af341_export4_spec__0(size_t, size_t, lean_object*);
LEAN_EXPORT lean_object* l___private_Init_Data_Array_Basic_0__Array_mapMUnsafe_map___at___00LeanBridgeNative730462696d8af341_export4_spec__0___boxed(lean_object*, lean_object*, lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNative730462696d8af341_export4___lam__0(lean_object*);
static lean_once_cell_t l_LeanBridgeNative730462696d8af341_export4___closed__0_once = LEAN_ONCE_CELL_INITIALIZER;
static lean_object* l_LeanBridgeNative730462696d8af341_export4___closed__0;
static const lean_closure_object l_LeanBridgeNative730462696d8af341_export4___closed__1_value = {.m_header = {.m_rc = 0, .m_cs_sz = sizeof(lean_closure_object) + sizeof(void*)*0, .m_other = 0, .m_tag = 245}, .m_fun = (void*)l_LeanBridgeNative730462696d8af341_export4___lam__0, .m_arity = 1, .m_num_fixed = 0, .m_objs = {} };
static const lean_object* l_LeanBridgeNative730462696d8af341_export4___closed__1 = (const lean_object*)&l_LeanBridgeNative730462696d8af341_export4___closed__1_value;
static const lean_ctor_object l_LeanBridgeNative730462696d8af341_export4___closed__2_value = {.m_header = {.m_rc = 0, .m_cs_sz = sizeof(lean_ctor_object) + sizeof(void*)*1 + 0, .m_other = 1, .m_tag = 1}, .m_objs = {((lean_object*)&l_LeanBridgeNative730462696d8af341_export4___closed__1_value)}};
static const lean_object* l_LeanBridgeNative730462696d8af341_export4___closed__2 = (const lean_object*)&l_LeanBridgeNative730462696d8af341_export4___closed__2_value;
static lean_once_cell_t l_LeanBridgeNative730462696d8af341_export4___closed__3_once = LEAN_ONCE_CELL_INITIALIZER;
static lean_object* l_LeanBridgeNative730462696d8af341_export4___closed__3;
LEAN_EXPORT lean_object* lean_bridge_07d8425a546c7304b285ddcd_lean(lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNative730462696d8af341_export5___lam__0(lean_object*, lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNative730462696d8af341_export5___lam__0___boxed(lean_object*, lean_object*);
static lean_once_cell_t l_LeanBridgeNative730462696d8af341_export5___closed__0_once = LEAN_ONCE_CELL_INITIALIZER;
static lean_object* l_LeanBridgeNative730462696d8af341_export5___closed__0;
static const lean_closure_object l_LeanBridgeNative730462696d8af341_export5___closed__1_value = {.m_header = {.m_rc = 0, .m_cs_sz = sizeof(lean_closure_object) + sizeof(void*)*0, .m_other = 0, .m_tag = 245}, .m_fun = (void*)l_LeanBridgeNative730462696d8af341_export5___lam__0___boxed, .m_arity = 2, .m_num_fixed = 0, .m_objs = {} };
static const lean_object* l_LeanBridgeNative730462696d8af341_export5___closed__1 = (const lean_object*)&l_LeanBridgeNative730462696d8af341_export5___closed__1_value;
static const lean_ctor_object l_LeanBridgeNative730462696d8af341_export5___closed__2_value = {.m_header = {.m_rc = 0, .m_cs_sz = sizeof(lean_ctor_object) + sizeof(void*)*1 + 0, .m_other = 1, .m_tag = 1}, .m_objs = {((lean_object*)&l_LeanBridgeNative730462696d8af341_export5___closed__1_value)}};
static const lean_object* l_LeanBridgeNative730462696d8af341_export5___closed__2 = (const lean_object*)&l_LeanBridgeNative730462696d8af341_export5___closed__2_value;
static lean_once_cell_t l_LeanBridgeNative730462696d8af341_export5___closed__3_once = LEAN_ONCE_CELL_INITIALIZER;
static lean_object* l_LeanBridgeNative730462696d8af341_export5___closed__3;
LEAN_EXPORT lean_object* lean_bridge_36fd9c74c3921bfb2ead3644_lean(lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNative730462696d8af341_carrierValue___redArg(lean_object* v_value_1_){
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
LEAN_EXPORT lean_object* l_LeanBridgeNative730462696d8af341_carrierValue___redArg___boxed(lean_object* v_value_11_){
_start:
{
lean_object* v_res_12_; 
v_res_12_ = l_LeanBridgeNative730462696d8af341_carrierValue___redArg(v_value_11_);
lean_dec_ref(v_value_11_);
return v_res_12_;
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNative730462696d8af341_carrierValue(lean_object* v_00_u03b1_13_, lean_object* v_value_14_){
_start:
{
lean_object* v___x_15_; 
v___x_15_ = l_LeanBridgeNative730462696d8af341_carrierValue___redArg(v_value_14_);
return v___x_15_;
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNative730462696d8af341_carrierValue___boxed(lean_object* v_00_u03b1_16_, lean_object* v_value_17_){
_start:
{
lean_object* v_res_18_; 
v_res_18_ = l_LeanBridgeNative730462696d8af341_carrierValue(v_00_u03b1_16_, v_value_17_);
lean_dec_ref(v_value_17_);
return v_res_18_;
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNative730462696d8af341_carrierResult___redArg(lean_object* v_value_21_){
_start:
{
if (lean_obj_tag(v_value_21_) == 0)
{
lean_object* v___x_22_; 
v___x_22_ = ((lean_object*)(l_LeanBridgeNative730462696d8af341_carrierResult___redArg___closed__0));
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
LEAN_EXPORT lean_object* l_LeanBridgeNative730462696d8af341_carrierResult(lean_object* v_00_u03b1_27_, lean_object* v_value_28_){
_start:
{
lean_object* v___x_29_; 
v___x_29_ = l_LeanBridgeNative730462696d8af341_carrierResult___redArg(v_value_28_);
return v___x_29_;
}
}
LEAN_EXPORT lean_object* l___private_Init_Data_Array_Basic_0__Array_forIn_x27Unsafe_loop___at___00LeanBridgeNative730462696d8af341_carrierCollect_spec__0___redArg(lean_object* v_as_32_, size_t v_sz_33_, size_t v_i_34_, lean_object* v_b_35_){
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
v___x_42_ = l_LeanBridgeNative730462696d8af341_carrierValue___redArg(v_a_41_);
if (lean_obj_tag(v___x_42_) == 0)
{
lean_object* v___x_43_; lean_object* v___x_45_; 
v___x_43_ = ((lean_object*)(l___private_Init_Data_Array_Basic_0__Array_forIn_x27Unsafe_loop___at___00LeanBridgeNative730462696d8af341_carrierCollect_spec__0___redArg___closed__0));
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
LEAN_EXPORT lean_object* l___private_Init_Data_Array_Basic_0__Array_forIn_x27Unsafe_loop___at___00LeanBridgeNative730462696d8af341_carrierCollect_spec__0___redArg___boxed(lean_object* v_as_58_, lean_object* v_sz_59_, lean_object* v_i_60_, lean_object* v_b_61_){
_start:
{
size_t v_sz_boxed_62_; size_t v_i_boxed_63_; lean_object* v_res_64_; 
v_sz_boxed_62_ = lean_unbox_usize(v_sz_59_);
lean_dec(v_sz_59_);
v_i_boxed_63_ = lean_unbox_usize(v_i_60_);
lean_dec(v_i_60_);
v_res_64_ = l___private_Init_Data_Array_Basic_0__Array_forIn_x27Unsafe_loop___at___00LeanBridgeNative730462696d8af341_carrierCollect_spec__0___redArg(v_as_58_, v_sz_boxed_62_, v_i_boxed_63_, v_b_61_);
lean_dec_ref(v_as_58_);
return v_res_64_;
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNative730462696d8af341_carrierCollect___redArg(lean_object* v_values_68_){
_start:
{
lean_object* v___x_69_; lean_object* v___x_70_; uint8_t v___x_71_; 
v___x_69_ = lean_unsigned_to_nat(262144u);
v___x_70_ = lean_array_get_size(v_values_68_);
v___x_71_ = lean_nat_dec_lt(v___x_69_, v___x_70_);
if (v___x_71_ == 0)
{
lean_object* v___x_72_; size_t v_sz_73_; size_t v___x_74_; lean_object* v___x_75_; lean_object* v_fst_76_; 
v___x_72_ = ((lean_object*)(l_LeanBridgeNative730462696d8af341_carrierCollect___redArg___closed__0));
v_sz_73_ = lean_array_size(v_values_68_);
v___x_74_ = ((size_t)0ULL);
v___x_75_ = l___private_Init_Data_Array_Basic_0__Array_forIn_x27Unsafe_loop___at___00LeanBridgeNative730462696d8af341_carrierCollect_spec__0___redArg(v_values_68_, v_sz_73_, v___x_74_, v___x_72_);
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
LEAN_EXPORT lean_object* l_LeanBridgeNative730462696d8af341_carrierCollect___redArg___boxed(lean_object* v_values_81_){
_start:
{
lean_object* v_res_82_; 
v_res_82_ = l_LeanBridgeNative730462696d8af341_carrierCollect___redArg(v_values_81_);
lean_dec_ref(v_values_81_);
return v_res_82_;
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNative730462696d8af341_carrierCollect(lean_object* v_00_u03b1_83_, lean_object* v_values_84_){
_start:
{
lean_object* v___x_85_; 
v___x_85_ = l_LeanBridgeNative730462696d8af341_carrierCollect___redArg(v_values_84_);
return v___x_85_;
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNative730462696d8af341_carrierCollect___boxed(lean_object* v_00_u03b1_86_, lean_object* v_values_87_){
_start:
{
lean_object* v_res_88_; 
v_res_88_ = l_LeanBridgeNative730462696d8af341_carrierCollect(v_00_u03b1_86_, v_values_87_);
lean_dec_ref(v_values_87_);
return v_res_88_;
}
}
LEAN_EXPORT lean_object* l___private_Init_Data_Array_Basic_0__Array_forIn_x27Unsafe_loop___at___00LeanBridgeNative730462696d8af341_carrierCollect_spec__0(lean_object* v_00_u03b1_89_, lean_object* v_as_90_, size_t v_sz_91_, size_t v_i_92_, lean_object* v_b_93_){
_start:
{
lean_object* v___x_94_; 
v___x_94_ = l___private_Init_Data_Array_Basic_0__Array_forIn_x27Unsafe_loop___at___00LeanBridgeNative730462696d8af341_carrierCollect_spec__0___redArg(v_as_90_, v_sz_91_, v_i_92_, v_b_93_);
return v___x_94_;
}
}
LEAN_EXPORT lean_object* l___private_Init_Data_Array_Basic_0__Array_forIn_x27Unsafe_loop___at___00LeanBridgeNative730462696d8af341_carrierCollect_spec__0___boxed(lean_object* v_00_u03b1_95_, lean_object* v_as_96_, lean_object* v_sz_97_, lean_object* v_i_98_, lean_object* v_b_99_){
_start:
{
size_t v_sz_boxed_100_; size_t v_i_boxed_101_; lean_object* v_res_102_; 
v_sz_boxed_100_ = lean_unbox_usize(v_sz_97_);
lean_dec(v_sz_97_);
v_i_boxed_101_ = lean_unbox_usize(v_i_98_);
lean_dec(v_i_98_);
v_res_102_ = l___private_Init_Data_Array_Basic_0__Array_forIn_x27Unsafe_loop___at___00LeanBridgeNative730462696d8af341_carrierCollect_spec__0(v_00_u03b1_95_, v_as_96_, v_sz_boxed_100_, v_i_boxed_101_, v_b_99_);
lean_dec_ref(v_as_96_);
return v_res_102_;
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNative730462696d8af341_carrierListItems_loop___redArg(lean_object* v_a_103_, lean_object* v_a_104_, lean_object* v_a_105_){
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
LEAN_EXPORT lean_object* l_LeanBridgeNative730462696d8af341_carrierListItems_loop(lean_object* v_00_u03b1_116_, lean_object* v_a_117_, lean_object* v_a_118_, lean_object* v_a_119_){
_start:
{
lean_object* v___x_120_; 
v___x_120_ = l_LeanBridgeNative730462696d8af341_carrierListItems_loop___redArg(v_a_117_, v_a_118_, v_a_119_);
return v___x_120_;
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNative730462696d8af341_carrierListItems___redArg(lean_object* v_values_123_){
_start:
{
lean_object* v___x_124_; lean_object* v___x_125_; lean_object* v___x_126_; 
v___x_124_ = lean_unsigned_to_nat(262145u);
v___x_125_ = ((lean_object*)(l_LeanBridgeNative730462696d8af341_carrierListItems___redArg___closed__0));
v___x_126_ = l_LeanBridgeNative730462696d8af341_carrierListItems_loop___redArg(v___x_124_, v_values_123_, v___x_125_);
return v___x_126_;
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNative730462696d8af341_carrierListItems(lean_object* v_00_u03b1_127_, lean_object* v_values_128_){
_start:
{
lean_object* v___x_129_; 
v___x_129_ = l_LeanBridgeNative730462696d8af341_carrierListItems___redArg(v_values_128_);
return v___x_129_;
}
}
LEAN_EXPORT lean_object* lean_bridge_23220a30761b2d3716c5b4ed_recursive_4fb79b80af1133bbb83d_make(lean_object* v_values_130_){
_start:
{
lean_object* v___x_131_; lean_object* v___x_132_; 
v___x_131_ = l_LeanBridgeNative730462696d8af341_carrierCollect___redArg(v_values_130_);
lean_dec_ref(v_values_130_);
v___x_132_ = l_LeanBridgeNative730462696d8af341_carrierResult___redArg(v___x_131_);
return v___x_132_;
}
}
LEAN_EXPORT lean_object* l___private_Init_Data_Array_Basic_0__Array_mapMUnsafe_map___at___00LeanBridgeNative730462696d8af341_items4fb79b80af1133bbb83d_spec__0(size_t v_sz_133_, size_t v_i_134_, lean_object* v_bs_135_){
_start:
{
uint8_t v___x_136_; 
v___x_136_ = lean_usize_dec_lt(v_i_134_, v_sz_133_);
if (v___x_136_ == 0)
{
return v_bs_135_;
}
else
{
lean_object* v_v_137_; lean_object* v___x_138_; lean_object* v_bs_x27_139_; lean_object* v___x_140_; lean_object* v___x_141_; lean_object* v___x_142_; size_t v___x_143_; size_t v___x_144_; lean_object* v___x_145_; 
v_v_137_ = lean_array_uget(v_bs_135_, v_i_134_);
v___x_138_ = lean_unsigned_to_nat(0u);
v_bs_x27_139_ = lean_array_uset(v_bs_135_, v_i_134_, v___x_138_);
v___x_140_ = lean_unsigned_to_nat(1u);
v___x_141_ = lean_mk_empty_array_with_capacity(v___x_140_);
v___x_142_ = lean_array_push(v___x_141_, v_v_137_);
v___x_143_ = ((size_t)1ULL);
v___x_144_ = lean_usize_add(v_i_134_, v___x_143_);
v___x_145_ = lean_array_uset(v_bs_x27_139_, v_i_134_, v___x_142_);
v_i_134_ = v___x_144_;
v_bs_135_ = v___x_145_;
goto _start;
}
}
}
LEAN_EXPORT lean_object* l___private_Init_Data_Array_Basic_0__Array_mapMUnsafe_map___at___00LeanBridgeNative730462696d8af341_items4fb79b80af1133bbb83d_spec__0___boxed(lean_object* v_sz_147_, lean_object* v_i_148_, lean_object* v_bs_149_){
_start:
{
size_t v_sz_boxed_150_; size_t v_i_boxed_151_; lean_object* v_res_152_; 
v_sz_boxed_150_ = lean_unbox_usize(v_sz_147_);
lean_dec(v_sz_147_);
v_i_boxed_151_ = lean_unbox_usize(v_i_148_);
lean_dec(v_i_148_);
v_res_152_ = l___private_Init_Data_Array_Basic_0__Array_mapMUnsafe_map___at___00LeanBridgeNative730462696d8af341_items4fb79b80af1133bbb83d_spec__0(v_sz_boxed_150_, v_i_boxed_151_, v_bs_149_);
return v_res_152_;
}
}
LEAN_EXPORT lean_object* lean_bridge_23220a30761b2d3716c5b4ed_recursive_4fb79b80af1133bbb83d_items(lean_object* v_value_155_){
_start:
{
lean_object* v___x_156_; 
v___x_156_ = l_LeanBridgeNative730462696d8af341_carrierValue___redArg(v_value_155_);
lean_dec_ref(v_value_155_);
if (lean_obj_tag(v___x_156_) == 0)
{
lean_object* v___x_157_; 
v___x_157_ = ((lean_object*)(l_LeanBridgeNative730462696d8af341_items4fb79b80af1133bbb83d___closed__0));
return v___x_157_;
}
else
{
lean_object* v_val_158_; lean_object* v___x_159_; lean_object* v___x_160_; lean_object* v___x_161_; size_t v_sz_162_; size_t v___x_163_; lean_object* v___x_164_; 
v_val_158_ = lean_ctor_get(v___x_156_, 0);
lean_inc(v_val_158_);
lean_dec_ref_known(v___x_156_, 1);
v___x_159_ = lean_unsigned_to_nat(0u);
v___x_160_ = lean_unsigned_to_nat(262145u);
v___x_161_ = l_Array_extract___redArg(v_val_158_, v___x_159_, v___x_160_);
lean_dec(v_val_158_);
v_sz_162_ = lean_array_size(v___x_161_);
v___x_163_ = ((size_t)0ULL);
v___x_164_ = l___private_Init_Data_Array_Basic_0__Array_mapMUnsafe_map___at___00LeanBridgeNative730462696d8af341_items4fb79b80af1133bbb83d_spec__0(v_sz_162_, v___x_163_, v___x_161_);
return v___x_164_;
}
}
}
LEAN_EXPORT uint32_t lean_bridge_23220a30761b2d3716c5b4ed_recursive_3f262999893350bc4fb4_branch(lean_object* v_value_165_){
_start:
{
lean_object* v___x_166_; 
v___x_166_ = l_LeanBridgeNative730462696d8af341_carrierValue___redArg(v_value_165_);
lean_dec_ref(v_value_165_);
if (lean_obj_tag(v___x_166_) == 0)
{
uint32_t v___x_167_; 
v___x_167_ = 4294967295;
return v___x_167_;
}
else
{
lean_object* v_val_168_; 
v_val_168_ = lean_ctor_get(v___x_166_, 0);
lean_inc(v_val_168_);
lean_dec_ref_known(v___x_166_, 1);
if (lean_obj_tag(v_val_168_) == 0)
{
uint32_t v___x_169_; 
v___x_169_ = 0;
return v___x_169_;
}
else
{
uint32_t v___x_170_; 
lean_dec_ref_known(v_val_168_, 1);
v___x_170_ = 1;
return v___x_170_;
}
}
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNative730462696d8af341_branch3f262999893350bc4fb4___boxed(lean_object* v_value_171_){
_start:
{
uint32_t v_res_172_; lean_object* v_r_173_; 
v_res_172_ = lean_bridge_23220a30761b2d3716c5b4ed_recursive_3f262999893350bc4fb4_branch(v_value_171_);
v_r_173_ = lean_box_uint32(v_res_172_);
return v_r_173_;
}
}
static lean_object* _init_l_LeanBridgeNative730462696d8af341_none3f262999893350bc4fb4___closed__1(void){
_start:
{
lean_object* v___x_176_; lean_object* v___x_177_; 
v___x_176_ = ((lean_object*)(l_LeanBridgeNative730462696d8af341_none3f262999893350bc4fb4___closed__0));
v___x_177_ = l_LeanBridgeNative730462696d8af341_carrierResult___redArg(v___x_176_);
return v___x_177_;
}
}
LEAN_EXPORT lean_object* lean_bridge_23220a30761b2d3716c5b4ed_recursive_3f262999893350bc4fb4_none(lean_object* v___bridgeUnit_178_){
_start:
{
lean_object* v___x_179_; 
v___x_179_ = lean_obj_once(&l_LeanBridgeNative730462696d8af341_none3f262999893350bc4fb4___closed__1, &l_LeanBridgeNative730462696d8af341_none3f262999893350bc4fb4___closed__1_once, _init_l_LeanBridgeNative730462696d8af341_none3f262999893350bc4fb4___closed__1);
return v___x_179_;
}
}
static lean_object* _init_l_LeanBridgeNative730462696d8af341_make03f262999893350bc4fb4___closed__0(void){
_start:
{
lean_object* v___x_180_; lean_object* v___x_181_; 
v___x_180_ = lean_box(0);
v___x_181_ = l_LeanBridgeNative730462696d8af341_carrierResult___redArg(v___x_180_);
return v___x_181_;
}
}
LEAN_EXPORT lean_object* lean_bridge_23220a30761b2d3716c5b4ed_recursive_3f262999893350bc4fb4_make0(lean_object* v_a0_182_){
_start:
{
lean_object* v___x_183_; 
v___x_183_ = l_LeanBridgeNative730462696d8af341_carrierValue___redArg(v_a0_182_);
lean_dec_ref(v_a0_182_);
if (lean_obj_tag(v___x_183_) == 0)
{
lean_object* v___x_184_; 
v___x_184_ = lean_obj_once(&l_LeanBridgeNative730462696d8af341_make03f262999893350bc4fb4___closed__0, &l_LeanBridgeNative730462696d8af341_make03f262999893350bc4fb4___closed__0_once, _init_l_LeanBridgeNative730462696d8af341_make03f262999893350bc4fb4___closed__0);
return v___x_184_;
}
else
{
lean_object* v___x_185_; lean_object* v___x_186_; 
v___x_185_ = lean_alloc_ctor(1, 1, 0);
lean_ctor_set(v___x_185_, 0, v___x_183_);
v___x_186_ = l_LeanBridgeNative730462696d8af341_carrierResult___redArg(v___x_185_);
return v___x_186_;
}
}
}
static lean_object* _init_l_LeanBridgeNative730462696d8af341_field03f262999893350bc4fb4___closed__0(void){
_start:
{
lean_object* v___x_187_; lean_object* v___x_188_; 
v___x_187_ = lean_box(0);
v___x_188_ = l_LeanBridgeNative730462696d8af341_carrierResult___redArg(v___x_187_);
return v___x_188_;
}
}
LEAN_EXPORT lean_object* lean_bridge_23220a30761b2d3716c5b4ed_recursive_3f262999893350bc4fb4_field0(lean_object* v_value_189_){
_start:
{
lean_object* v___x_190_; 
v___x_190_ = l_LeanBridgeNative730462696d8af341_carrierValue___redArg(v_value_189_);
lean_dec_ref(v_value_189_);
if (lean_obj_tag(v___x_190_) == 0)
{
lean_object* v___x_191_; 
v___x_191_ = lean_obj_once(&l_LeanBridgeNative730462696d8af341_field03f262999893350bc4fb4___closed__0, &l_LeanBridgeNative730462696d8af341_field03f262999893350bc4fb4___closed__0_once, _init_l_LeanBridgeNative730462696d8af341_field03f262999893350bc4fb4___closed__0);
return v___x_191_;
}
else
{
lean_object* v_val_192_; 
v_val_192_ = lean_ctor_get(v___x_190_, 0);
lean_inc(v_val_192_);
lean_dec_ref_known(v___x_190_, 1);
if (lean_obj_tag(v_val_192_) == 1)
{
lean_object* v___x_193_; 
v___x_193_ = l_LeanBridgeNative730462696d8af341_carrierResult___redArg(v_val_192_);
return v___x_193_;
}
else
{
lean_object* v___x_194_; 
lean_dec(v_val_192_);
v___x_194_ = lean_obj_once(&l_LeanBridgeNative730462696d8af341_field03f262999893350bc4fb4___closed__0, &l_LeanBridgeNative730462696d8af341_field03f262999893350bc4fb4___closed__0_once, _init_l_LeanBridgeNative730462696d8af341_field03f262999893350bc4fb4___closed__0);
return v___x_194_;
}
}
}
}
LEAN_EXPORT uint32_t lean_bridge_23220a30761b2d3716c5b4ed_recursive_ec3de31d02aa0faa1710_branch(lean_object* v_value_195_){
_start:
{
lean_object* v___x_196_; 
v___x_196_ = l_LeanBridgeNative730462696d8af341_carrierValue___redArg(v_value_195_);
lean_dec_ref(v_value_195_);
if (lean_obj_tag(v___x_196_) == 0)
{
uint32_t v___x_197_; 
v___x_197_ = 4294967295;
return v___x_197_;
}
else
{
lean_object* v_val_198_; 
v_val_198_ = lean_ctor_get(v___x_196_, 0);
lean_inc(v_val_198_);
lean_dec_ref_known(v___x_196_, 1);
if (lean_obj_tag(v_val_198_) == 0)
{
uint32_t v___x_199_; 
lean_dec_ref_known(v_val_198_, 1);
v___x_199_ = 1;
return v___x_199_;
}
else
{
uint32_t v___x_200_; 
lean_dec_ref_known(v_val_198_, 1);
v___x_200_ = 0;
return v___x_200_;
}
}
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNative730462696d8af341_branchec3de31d02aa0faa1710___boxed(lean_object* v_value_201_){
_start:
{
uint32_t v_res_202_; lean_object* v_r_203_; 
v_res_202_ = lean_bridge_23220a30761b2d3716c5b4ed_recursive_ec3de31d02aa0faa1710_branch(v_value_201_);
v_r_203_ = lean_box_uint32(v_res_202_);
return v_r_203_;
}
}
static lean_object* _init_l_LeanBridgeNative730462696d8af341_make0ec3de31d02aa0faa1710___closed__0(void){
_start:
{
lean_object* v___x_204_; lean_object* v___x_205_; 
v___x_204_ = lean_box(0);
v___x_205_ = l_LeanBridgeNative730462696d8af341_carrierResult___redArg(v___x_204_);
return v___x_205_;
}
}
LEAN_EXPORT lean_object* lean_bridge_23220a30761b2d3716c5b4ed_recursive_ec3de31d02aa0faa1710_make0(lean_object* v_a0_206_){
_start:
{
lean_object* v___x_207_; 
v___x_207_ = l_LeanBridgeNative730462696d8af341_carrierValue___redArg(v_a0_206_);
lean_dec_ref(v_a0_206_);
if (lean_obj_tag(v___x_207_) == 0)
{
lean_object* v___x_208_; 
v___x_208_ = lean_obj_once(&l_LeanBridgeNative730462696d8af341_make0ec3de31d02aa0faa1710___closed__0, &l_LeanBridgeNative730462696d8af341_make0ec3de31d02aa0faa1710___closed__0_once, _init_l_LeanBridgeNative730462696d8af341_make0ec3de31d02aa0faa1710___closed__0);
return v___x_208_;
}
else
{
lean_object* v_val_209_; lean_object* v___x_211_; uint8_t v_isShared_212_; uint8_t v_isSharedCheck_218_; 
v_val_209_ = lean_ctor_get(v___x_207_, 0);
v_isSharedCheck_218_ = !lean_is_exclusive(v___x_207_);
if (v_isSharedCheck_218_ == 0)
{
v___x_211_ = v___x_207_;
v_isShared_212_ = v_isSharedCheck_218_;
goto v_resetjp_210_;
}
else
{
lean_inc(v_val_209_);
lean_dec(v___x_207_);
v___x_211_ = lean_box(0);
v_isShared_212_ = v_isSharedCheck_218_;
goto v_resetjp_210_;
}
v_resetjp_210_:
{
lean_object* v___x_213_; lean_object* v___x_215_; 
v___x_213_ = lean_alloc_ctor(1, 1, 0);
lean_ctor_set(v___x_213_, 0, v_val_209_);
if (v_isShared_212_ == 0)
{
lean_ctor_set(v___x_211_, 0, v___x_213_);
v___x_215_ = v___x_211_;
goto v_reusejp_214_;
}
else
{
lean_object* v_reuseFailAlloc_217_; 
v_reuseFailAlloc_217_ = lean_alloc_ctor(1, 1, 0);
lean_ctor_set(v_reuseFailAlloc_217_, 0, v___x_213_);
v___x_215_ = v_reuseFailAlloc_217_;
goto v_reusejp_214_;
}
v_reusejp_214_:
{
lean_object* v___x_216_; 
v___x_216_ = l_LeanBridgeNative730462696d8af341_carrierResult___redArg(v___x_215_);
return v___x_216_;
}
}
}
}
}
LEAN_EXPORT lean_object* lean_bridge_23220a30761b2d3716c5b4ed_recursive_ec3de31d02aa0faa1710_field0(lean_object* v_value_219_){
_start:
{
lean_object* v___x_220_; 
v___x_220_ = l_LeanBridgeNative730462696d8af341_carrierValue___redArg(v_value_219_);
lean_dec_ref(v_value_219_);
if (lean_obj_tag(v___x_220_) == 0)
{
lean_object* v___x_221_; 
v___x_221_ = lean_obj_once(&l_LeanBridgeNative730462696d8af341_make03f262999893350bc4fb4___closed__0, &l_LeanBridgeNative730462696d8af341_make03f262999893350bc4fb4___closed__0_once, _init_l_LeanBridgeNative730462696d8af341_make03f262999893350bc4fb4___closed__0);
return v___x_221_;
}
else
{
lean_object* v_val_222_; lean_object* v___x_224_; uint8_t v_isShared_225_; uint8_t v_isSharedCheck_232_; 
v_val_222_ = lean_ctor_get(v___x_220_, 0);
v_isSharedCheck_232_ = !lean_is_exclusive(v___x_220_);
if (v_isSharedCheck_232_ == 0)
{
v___x_224_ = v___x_220_;
v_isShared_225_ = v_isSharedCheck_232_;
goto v_resetjp_223_;
}
else
{
lean_inc(v_val_222_);
lean_dec(v___x_220_);
v___x_224_ = lean_box(0);
v_isShared_225_ = v_isSharedCheck_232_;
goto v_resetjp_223_;
}
v_resetjp_223_:
{
if (lean_obj_tag(v_val_222_) == 1)
{
lean_object* v_a_226_; lean_object* v___x_228_; 
v_a_226_ = lean_ctor_get(v_val_222_, 0);
lean_inc(v_a_226_);
lean_dec_ref_known(v_val_222_, 1);
if (v_isShared_225_ == 0)
{
lean_ctor_set(v___x_224_, 0, v_a_226_);
v___x_228_ = v___x_224_;
goto v_reusejp_227_;
}
else
{
lean_object* v_reuseFailAlloc_230_; 
v_reuseFailAlloc_230_ = lean_alloc_ctor(1, 1, 0);
lean_ctor_set(v_reuseFailAlloc_230_, 0, v_a_226_);
v___x_228_ = v_reuseFailAlloc_230_;
goto v_reusejp_227_;
}
v_reusejp_227_:
{
lean_object* v___x_229_; 
v___x_229_ = l_LeanBridgeNative730462696d8af341_carrierResult___redArg(v___x_228_);
return v___x_229_;
}
}
else
{
lean_object* v___x_231_; 
lean_del_object(v___x_224_);
lean_dec(v_val_222_);
v___x_231_ = lean_obj_once(&l_LeanBridgeNative730462696d8af341_make03f262999893350bc4fb4___closed__0, &l_LeanBridgeNative730462696d8af341_make03f262999893350bc4fb4___closed__0_once, _init_l_LeanBridgeNative730462696d8af341_make03f262999893350bc4fb4___closed__0);
return v___x_231_;
}
}
}
}
}
LEAN_EXPORT lean_object* lean_bridge_23220a30761b2d3716c5b4ed_recursive_ec3de31d02aa0faa1710_make1(lean_object* v_a0_233_){
_start:
{
lean_object* v___x_234_; 
v___x_234_ = l_LeanBridgeNative730462696d8af341_carrierValue___redArg(v_a0_233_);
lean_dec_ref(v_a0_233_);
if (lean_obj_tag(v___x_234_) == 0)
{
lean_object* v___x_235_; 
v___x_235_ = lean_obj_once(&l_LeanBridgeNative730462696d8af341_make0ec3de31d02aa0faa1710___closed__0, &l_LeanBridgeNative730462696d8af341_make0ec3de31d02aa0faa1710___closed__0_once, _init_l_LeanBridgeNative730462696d8af341_make0ec3de31d02aa0faa1710___closed__0);
return v___x_235_;
}
else
{
lean_object* v_val_236_; lean_object* v___x_238_; uint8_t v_isShared_239_; uint8_t v_isSharedCheck_245_; 
v_val_236_ = lean_ctor_get(v___x_234_, 0);
v_isSharedCheck_245_ = !lean_is_exclusive(v___x_234_);
if (v_isSharedCheck_245_ == 0)
{
v___x_238_ = v___x_234_;
v_isShared_239_ = v_isSharedCheck_245_;
goto v_resetjp_237_;
}
else
{
lean_inc(v_val_236_);
lean_dec(v___x_234_);
v___x_238_ = lean_box(0);
v_isShared_239_ = v_isSharedCheck_245_;
goto v_resetjp_237_;
}
v_resetjp_237_:
{
lean_object* v___x_240_; lean_object* v___x_242_; 
v___x_240_ = lean_alloc_ctor(0, 1, 0);
lean_ctor_set(v___x_240_, 0, v_val_236_);
if (v_isShared_239_ == 0)
{
lean_ctor_set(v___x_238_, 0, v___x_240_);
v___x_242_ = v___x_238_;
goto v_reusejp_241_;
}
else
{
lean_object* v_reuseFailAlloc_244_; 
v_reuseFailAlloc_244_ = lean_alloc_ctor(1, 1, 0);
lean_ctor_set(v_reuseFailAlloc_244_, 0, v___x_240_);
v___x_242_ = v_reuseFailAlloc_244_;
goto v_reusejp_241_;
}
v_reusejp_241_:
{
lean_object* v___x_243_; 
v___x_243_ = l_LeanBridgeNative730462696d8af341_carrierResult___redArg(v___x_242_);
return v___x_243_;
}
}
}
}
}
static lean_object* _init_l_LeanBridgeNative730462696d8af341_field1ec3de31d02aa0faa1710___closed__0(void){
_start:
{
lean_object* v___x_246_; lean_object* v___x_247_; 
v___x_246_ = lean_box(0);
v___x_247_ = l_LeanBridgeNative730462696d8af341_carrierResult___redArg(v___x_246_);
return v___x_247_;
}
}
LEAN_EXPORT lean_object* lean_bridge_23220a30761b2d3716c5b4ed_recursive_ec3de31d02aa0faa1710_field1(lean_object* v_value_248_){
_start:
{
lean_object* v___x_249_; 
v___x_249_ = l_LeanBridgeNative730462696d8af341_carrierValue___redArg(v_value_248_);
lean_dec_ref(v_value_248_);
if (lean_obj_tag(v___x_249_) == 0)
{
lean_object* v___x_250_; 
v___x_250_ = lean_obj_once(&l_LeanBridgeNative730462696d8af341_field1ec3de31d02aa0faa1710___closed__0, &l_LeanBridgeNative730462696d8af341_field1ec3de31d02aa0faa1710___closed__0_once, _init_l_LeanBridgeNative730462696d8af341_field1ec3de31d02aa0faa1710___closed__0);
return v___x_250_;
}
else
{
lean_object* v_val_251_; lean_object* v___x_253_; uint8_t v_isShared_254_; uint8_t v_isSharedCheck_261_; 
v_val_251_ = lean_ctor_get(v___x_249_, 0);
v_isSharedCheck_261_ = !lean_is_exclusive(v___x_249_);
if (v_isSharedCheck_261_ == 0)
{
v___x_253_ = v___x_249_;
v_isShared_254_ = v_isSharedCheck_261_;
goto v_resetjp_252_;
}
else
{
lean_inc(v_val_251_);
lean_dec(v___x_249_);
v___x_253_ = lean_box(0);
v_isShared_254_ = v_isSharedCheck_261_;
goto v_resetjp_252_;
}
v_resetjp_252_:
{
if (lean_obj_tag(v_val_251_) == 0)
{
lean_object* v_a_255_; lean_object* v___x_257_; 
v_a_255_ = lean_ctor_get(v_val_251_, 0);
lean_inc(v_a_255_);
lean_dec_ref_known(v_val_251_, 1);
if (v_isShared_254_ == 0)
{
lean_ctor_set(v___x_253_, 0, v_a_255_);
v___x_257_ = v___x_253_;
goto v_reusejp_256_;
}
else
{
lean_object* v_reuseFailAlloc_259_; 
v_reuseFailAlloc_259_ = lean_alloc_ctor(1, 1, 0);
lean_ctor_set(v_reuseFailAlloc_259_, 0, v_a_255_);
v___x_257_ = v_reuseFailAlloc_259_;
goto v_reusejp_256_;
}
v_reusejp_256_:
{
lean_object* v___x_258_; 
v___x_258_ = l_LeanBridgeNative730462696d8af341_carrierResult___redArg(v___x_257_);
return v___x_258_;
}
}
else
{
lean_object* v___x_260_; 
lean_del_object(v___x_253_);
lean_dec(v_val_251_);
v___x_260_ = lean_obj_once(&l_LeanBridgeNative730462696d8af341_field1ec3de31d02aa0faa1710___closed__0, &l_LeanBridgeNative730462696d8af341_field1ec3de31d02aa0faa1710___closed__0_once, _init_l_LeanBridgeNative730462696d8af341_field1ec3de31d02aa0faa1710___closed__0);
return v___x_260_;
}
}
}
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNative730462696d8af341_invoke__14cd8f1b0d065ede9a36f8590000c62c12d8e99c___boxed(lean_object* v_token_264_, lean_object* v_a0_265_){
_start:
{
size_t v_token_boxed_266_; lean_object* v_res_267_; 
v_token_boxed_266_ = lean_unbox_usize(v_token_264_);
lean_dec(v_token_264_);
v_res_267_ = lean_bridge_23220a30761b2d3716c5b4ed_structured_14cd8f1b0d065ede9a36f8590000c62c12d8e99c_invoke(v_token_boxed_266_, v_a0_265_);
return v_res_267_;
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNative730462696d8af341_recovery__14cd8f1b0d065ede9a36f8590000c62c12d8e99c___boxed(lean_object* v_token_269_){
_start:
{
size_t v_token_boxed_270_; lean_object* v_res_271_; 
v_token_boxed_270_ = lean_unbox_usize(v_token_269_);
lean_dec(v_token_269_);
v_res_271_ = lean_bridge_23220a30761b2d3716c5b4ed_structured_14cd8f1b0d065ede9a36f8590000c62c12d8e99c_recovery(v_token_boxed_270_);
return v_res_271_;
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNative730462696d8af341_reject__14cd8f1b0d065ede9a36f8590000c62c12d8e99c___boxed(lean_object* v_token_274_, lean_object* v_recovery_275_){
_start:
{
size_t v_token_boxed_276_; lean_object* v_res_277_; 
v_token_boxed_276_ = lean_unbox_usize(v_token_274_);
lean_dec(v_token_274_);
v_res_277_ = lean_bridge_23220a30761b2d3716c5b4ed_structured_14cd8f1b0d065ede9a36f8590000c62c12d8e99c_reject(v_token_boxed_276_, v_recovery_275_);
return v_res_277_;
}
}
LEAN_EXPORT lean_object* lean_bridge_23220a30761b2d3716c5b4ed_structured_14cd8f1b0d065ede9a36f8590000c62c12d8e99c_wrap(size_t v_token_278_){
_start:
{
lean_object* v___x_279_; lean_object* v___x_280_; lean_object* v___x_281_; lean_object* v___x_282_; 
v___x_279_ = lean_unsigned_to_nat(1u);
v___x_280_ = lean_mk_empty_array_with_capacity(v___x_279_);
v___x_281_ = lean_box_usize(v_token_278_);
v___x_282_ = lean_array_push(v___x_280_, v___x_281_);
return v___x_282_;
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNative730462696d8af341_wrap__14cd8f1b0d065ede9a36f8590000c62c12d8e99c___boxed(lean_object* v_token_283_){
_start:
{
size_t v_token_boxed_284_; lean_object* v_res_285_; 
v_token_boxed_284_ = lean_unbox_usize(v_token_283_);
lean_dec(v_token_283_);
v_res_285_ = lean_bridge_23220a30761b2d3716c5b4ed_structured_14cd8f1b0d065ede9a36f8590000c62c12d8e99c_wrap(v_token_boxed_284_);
return v_res_285_;
}
}
LEAN_EXPORT lean_object* lean_bridge_23220a30761b2d3716c5b4ed_structured_c27fa7df7f1805196544d398fb121b21c179beb1_apply(lean_object* v_closure_286_, lean_object* v_a0_287_){
  fputs("LB_CALLBACK_ENTRY_V1 enter adapter CallbackSubtypes.makeClosure:closure:lean\n", stderr);

_start:
{
lean_object* v___x_288_; 
v___x_288_ = l_LeanBridgeNative730462696d8af341_carrierValue___redArg(v_closure_286_);
lean_dec_ref(v_closure_286_);
if (lean_obj_tag(v___x_288_) == 0)
{
lean_object* v___x_289_; 
lean_dec_ref(v_a0_287_);
v___x_289_ = lean_obj_once(&l_LeanBridgeNative730462696d8af341_field03f262999893350bc4fb4___closed__0, &l_LeanBridgeNative730462696d8af341_field03f262999893350bc4fb4___closed__0_once, _init_l_LeanBridgeNative730462696d8af341_field03f262999893350bc4fb4___closed__0);
return v___x_289_;
}
else
{
lean_object* v_val_290_; lean_object* v___x_291_; 
v_val_290_ = lean_ctor_get(v___x_288_, 0);
lean_inc(v_val_290_);
lean_dec_ref_known(v___x_288_, 1);
v___x_291_ = l_LeanBridgeNative730462696d8af341_carrierValue___redArg(v_a0_287_);
lean_dec_ref(v_a0_287_);
if (lean_obj_tag(v___x_291_) == 0)
{
lean_object* v___x_292_; 
lean_dec(v_val_290_);
v___x_292_ = l_LeanBridgeNative730462696d8af341_carrierResult___redArg(v___x_291_);
return v___x_292_;
}
else
{
lean_object* v_val_293_; lean_object* v___x_294_; lean_object* v___x_295_; 
v_val_293_ = lean_ctor_get(v___x_291_, 0);
lean_inc(v_val_293_);
lean_dec_ref_known(v___x_291_, 1);
v___x_294_ = lean_apply_1(v_val_290_, v_val_293_);
v___x_295_ = l_LeanBridgeNative730462696d8af341_carrierResult___redArg(v___x_294_);
return v___x_295_;
}
}
}
}
LEAN_EXPORT uint8_t lean_bridge_23220a30761b2d3716c5b4ed_structured_c27fa7df7f1805196544d398fb121b21c179beb1_closure_graph_refinement_0_ba12b83e7ba38842c8fd(lean_object* v_carrier_296_){
  fputs("LB_CALLBACK_ENTRY_V1 enter validator CallbackSubtypes.makeClosure:callback_validator:closure_graph_refinement_0_ba12b83e7ba38842c8fd\n", stderr);

_start:
{
lean_object* v___x_297_; 
v___x_297_ = l_LeanBridgeNative730462696d8af341_carrierValue___redArg(v_carrier_296_);
lean_dec_ref(v_carrier_296_);
if (lean_obj_tag(v___x_297_) == 0)
{
uint8_t v___x_298_; 
v___x_298_ = 0;
return v___x_298_;
}
else
{
lean_object* v_val_299_; lean_object* v___x_300_; 
v_val_299_ = lean_ctor_get(v___x_297_, 0);
lean_inc(v_val_299_);
lean_dec_ref_known(v___x_297_, 1);
v___x_300_ = lb_callback_subtype_probe_constructor_checkedPositive(v_val_299_);
if (lean_obj_tag(v___x_300_) == 0)
{
uint8_t v___x_301_; 
v___x_301_ = 0;
return v___x_301_;
}
else
{
uint8_t v___x_302_; 
lean_dec_ref_known(v___x_300_, 1);
v___x_302_ = 1;
return v___x_302_;
}
}
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNative730462696d8af341_closure__c27fa7df7f1805196544d398fb121b21c179beb1__graph__refinement__0__ba12b83e7ba38842c8fd___boxed(lean_object* v_carrier_303_){
_start:
{
uint8_t v_res_304_; lean_object* v_r_305_; 
v_res_304_ = lean_bridge_23220a30761b2d3716c5b4ed_structured_c27fa7df7f1805196544d398fb121b21c179beb1_closure_graph_refinement_0_ba12b83e7ba38842c8fd(v_carrier_303_);
v_r_305_ = lean_box(v_res_304_);
return v_r_305_;
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNative730462696d8af341_invoke__197d5bf19058d37bc5547c33a8e0bed3bf121ea7___boxed(lean_object* v_token_309_, lean_object* v_a0_310_, lean_object* v_a1_311_){
_start:
{
size_t v_token_boxed_312_; lean_object* v_res_313_; 
v_token_boxed_312_ = lean_unbox_usize(v_token_309_);
lean_dec(v_token_309_);
v_res_313_ = lean_bridge_23220a30761b2d3716c5b4ed_structured_197d5bf19058d37bc5547c33a8e0bed3bf121ea7_invoke(v_token_boxed_312_, v_a0_310_, v_a1_311_);
return v_res_313_;
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNative730462696d8af341_recovery__197d5bf19058d37bc5547c33a8e0bed3bf121ea7___boxed(lean_object* v_token_315_){
_start:
{
size_t v_token_boxed_316_; lean_object* v_res_317_; 
v_token_boxed_316_ = lean_unbox_usize(v_token_315_);
lean_dec(v_token_315_);
v_res_317_ = lean_bridge_23220a30761b2d3716c5b4ed_structured_197d5bf19058d37bc5547c33a8e0bed3bf121ea7_recovery(v_token_boxed_316_);
return v_res_317_;
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNative730462696d8af341_reject__197d5bf19058d37bc5547c33a8e0bed3bf121ea7___boxed(lean_object* v_token_320_, lean_object* v_recovery_321_){
_start:
{
size_t v_token_boxed_322_; lean_object* v_res_323_; 
v_token_boxed_322_ = lean_unbox_usize(v_token_320_);
lean_dec(v_token_320_);
v_res_323_ = lean_bridge_23220a30761b2d3716c5b4ed_structured_197d5bf19058d37bc5547c33a8e0bed3bf121ea7_reject(v_token_boxed_322_, v_recovery_321_);
return v_res_323_;
}
}
LEAN_EXPORT lean_object* lean_bridge_23220a30761b2d3716c5b4ed_structured_197d5bf19058d37bc5547c33a8e0bed3bf121ea7_wrap(size_t v_token_324_){
_start:
{
lean_object* v___x_325_; lean_object* v___x_326_; lean_object* v___x_327_; lean_object* v___x_328_; 
v___x_325_ = lean_unsigned_to_nat(1u);
v___x_326_ = lean_mk_empty_array_with_capacity(v___x_325_);
v___x_327_ = lean_box_usize(v_token_324_);
v___x_328_ = lean_array_push(v___x_326_, v___x_327_);
return v___x_328_;
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNative730462696d8af341_wrap__197d5bf19058d37bc5547c33a8e0bed3bf121ea7___boxed(lean_object* v_token_329_){
_start:
{
size_t v_token_boxed_330_; lean_object* v_res_331_; 
v_token_boxed_330_ = lean_unbox_usize(v_token_329_);
lean_dec(v_token_329_);
v_res_331_ = lean_bridge_23220a30761b2d3716c5b4ed_structured_197d5bf19058d37bc5547c33a8e0bed3bf121ea7_wrap(v_token_boxed_330_);
return v_res_331_;
}
}
LEAN_EXPORT lean_object* lean_bridge_23220a30761b2d3716c5b4ed_structured_51bfd752726fcfd8a9187a7c3a979ace51f7c1be_apply(lean_object* v_closure_332_, lean_object* v_a0_333_, lean_object* v_a1_334_){
  fputs("LB_CALLBACK_ENTRY_V1 enter adapter CallbackSubtypes.makeMixedClosure:closure:lean\n", stderr);

_start:
{
lean_object* v___x_335_; 
v___x_335_ = l_LeanBridgeNative730462696d8af341_carrierValue___redArg(v_closure_332_);
lean_dec_ref(v_closure_332_);
if (lean_obj_tag(v___x_335_) == 0)
{
lean_object* v___x_336_; 
lean_dec_ref(v_a1_334_);
lean_dec_ref(v_a0_333_);
v___x_336_ = lean_obj_once(&l_LeanBridgeNative730462696d8af341_field03f262999893350bc4fb4___closed__0, &l_LeanBridgeNative730462696d8af341_field03f262999893350bc4fb4___closed__0_once, _init_l_LeanBridgeNative730462696d8af341_field03f262999893350bc4fb4___closed__0);
return v___x_336_;
}
else
{
lean_object* v_val_337_; lean_object* v___x_338_; 
v_val_337_ = lean_ctor_get(v___x_335_, 0);
lean_inc(v_val_337_);
lean_dec_ref_known(v___x_335_, 1);
v___x_338_ = l_LeanBridgeNative730462696d8af341_carrierValue___redArg(v_a0_333_);
lean_dec_ref(v_a0_333_);
if (lean_obj_tag(v___x_338_) == 0)
{
lean_object* v___x_339_; 
lean_dec(v_val_337_);
lean_dec_ref(v_a1_334_);
v___x_339_ = l_LeanBridgeNative730462696d8af341_carrierResult___redArg(v___x_338_);
return v___x_339_;
}
else
{
lean_object* v_val_340_; lean_object* v___x_341_; 
v_val_340_ = lean_ctor_get(v___x_338_, 0);
lean_inc(v_val_340_);
lean_dec_ref_known(v___x_338_, 1);
v___x_341_ = l_LeanBridgeNative730462696d8af341_carrierValue___redArg(v_a1_334_);
lean_dec_ref(v_a1_334_);
if (lean_obj_tag(v___x_341_) == 0)
{
lean_object* v___x_342_; 
lean_dec(v_val_340_);
lean_dec(v_val_337_);
v___x_342_ = l_LeanBridgeNative730462696d8af341_carrierResult___redArg(v___x_341_);
return v___x_342_;
}
else
{
lean_object* v_val_343_; lean_object* v___x_344_; lean_object* v___x_345_; 
v_val_343_ = lean_ctor_get(v___x_341_, 0);
lean_inc(v_val_343_);
lean_dec_ref_known(v___x_341_, 1);
v___x_344_ = lean_apply_2(v_val_337_, v_val_340_, v_val_343_);
v___x_345_ = l_LeanBridgeNative730462696d8af341_carrierResult___redArg(v___x_344_);
return v___x_345_;
}
}
}
}
}
LEAN_EXPORT uint8_t lean_bridge_23220a30761b2d3716c5b4ed_structured_51bfd752726fcfd8a9187a7c3a979ace51f7c1be_closure_graph_refinement_1_ba12b83e7ba38842c8fd(lean_object* v_carrier_346_){
  fputs("LB_CALLBACK_ENTRY_V1 enter validator CallbackSubtypes.makeMixedClosure:callback_validator:closure_graph_refinement_1_ba12b83e7ba38842c8fd\n", stderr);

_start:
{
lean_object* v___x_347_; 
v___x_347_ = l_LeanBridgeNative730462696d8af341_carrierValue___redArg(v_carrier_346_);
lean_dec_ref(v_carrier_346_);
if (lean_obj_tag(v___x_347_) == 0)
{
uint8_t v___x_348_; 
v___x_348_ = 0;
return v___x_348_;
}
else
{
lean_object* v_val_349_; lean_object* v___x_350_; 
v_val_349_ = lean_ctor_get(v___x_347_, 0);
lean_inc(v_val_349_);
lean_dec_ref_known(v___x_347_, 1);
v___x_350_ = lb_callback_subtype_probe_constructor_checkedPositive(v_val_349_);
if (lean_obj_tag(v___x_350_) == 0)
{
uint8_t v___x_351_; 
v___x_351_ = 0;
return v___x_351_;
}
else
{
uint8_t v___x_352_; 
lean_dec_ref_known(v___x_350_, 1);
v___x_352_ = 1;
return v___x_352_;
}
}
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNative730462696d8af341_closure__51bfd752726fcfd8a9187a7c3a979ace51f7c1be__graph__refinement__1__ba12b83e7ba38842c8fd___boxed(lean_object* v_carrier_353_){
_start:
{
uint8_t v_res_354_; lean_object* v_r_355_; 
v_res_354_ = lean_bridge_23220a30761b2d3716c5b4ed_structured_51bfd752726fcfd8a9187a7c3a979ace51f7c1be_closure_graph_refinement_1_ba12b83e7ba38842c8fd(v_carrier_353_);
v_r_355_ = lean_box(v_res_354_);
return v_r_355_;
}
}
LEAN_EXPORT lean_object* lean_bridge_23220a30761b2d3716c5b4ed_structured_6cdd9c3be7604978d190e4f9d3a70db0539487ba_apply(lean_object* v_closure_356_, lean_object* v_a0_357_){
_start:
{
lean_object* v___x_358_; 
v___x_358_ = l_LeanBridgeNative730462696d8af341_carrierValue___redArg(v_closure_356_);
lean_dec_ref(v_closure_356_);
if (lean_obj_tag(v___x_358_) == 0)
{
lean_object* v___x_359_; 
lean_dec_ref(v_a0_357_);
v___x_359_ = lean_obj_once(&l_LeanBridgeNative730462696d8af341_make03f262999893350bc4fb4___closed__0, &l_LeanBridgeNative730462696d8af341_make03f262999893350bc4fb4___closed__0_once, _init_l_LeanBridgeNative730462696d8af341_make03f262999893350bc4fb4___closed__0);
return v___x_359_;
}
else
{
lean_object* v_val_360_; lean_object* v___x_361_; 
v_val_360_ = lean_ctor_get(v___x_358_, 0);
lean_inc(v_val_360_);
lean_dec_ref_known(v___x_358_, 1);
v___x_361_ = l_LeanBridgeNative730462696d8af341_carrierValue___redArg(v_a0_357_);
lean_dec_ref(v_a0_357_);
if (lean_obj_tag(v___x_361_) == 0)
{
lean_object* v___x_362_; 
lean_dec(v_val_360_);
v___x_362_ = lean_obj_once(&l_LeanBridgeNative730462696d8af341_make03f262999893350bc4fb4___closed__0, &l_LeanBridgeNative730462696d8af341_make03f262999893350bc4fb4___closed__0_once, _init_l_LeanBridgeNative730462696d8af341_make03f262999893350bc4fb4___closed__0);
return v___x_362_;
}
else
{
lean_object* v_val_363_; lean_object* v___x_364_; lean_object* v___x_365_; 
v_val_363_ = lean_ctor_get(v___x_361_, 0);
lean_inc(v_val_363_);
lean_dec_ref_known(v___x_361_, 1);
v___x_364_ = lean_apply_1(v_val_360_, v_val_363_);
v___x_365_ = l_LeanBridgeNative730462696d8af341_carrierResult___redArg(v___x_364_);
return v___x_365_;
}
}
}
}
LEAN_EXPORT uint8_t lean_bridge_23220a30761b2d3716c5b4ed_structured_6cdd9c3be7604978d190e4f9d3a70db0539487ba_closure_graph_refinement_0_ba12b83e7ba38842c8fd(lean_object* v_carrier_366_){
_start:
{
lean_object* v___x_367_; 
v___x_367_ = l_LeanBridgeNative730462696d8af341_carrierValue___redArg(v_carrier_366_);
lean_dec_ref(v_carrier_366_);
if (lean_obj_tag(v___x_367_) == 0)
{
uint8_t v___x_368_; 
v___x_368_ = 0;
return v___x_368_;
}
else
{
lean_object* v_val_369_; lean_object* v___x_370_; 
v_val_369_ = lean_ctor_get(v___x_367_, 0);
lean_inc(v_val_369_);
lean_dec_ref_known(v___x_367_, 1);
v___x_370_ = lb_callback_subtype_probe_constructor_checkedPositive(v_val_369_);
if (lean_obj_tag(v___x_370_) == 0)
{
uint8_t v___x_371_; 
v___x_371_ = 0;
return v___x_371_;
}
else
{
uint8_t v___x_372_; 
lean_dec_ref_known(v___x_370_, 1);
v___x_372_ = 1;
return v___x_372_;
}
}
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNative730462696d8af341_closure__6cdd9c3be7604978d190e4f9d3a70db0539487ba__graph__refinement__0__ba12b83e7ba38842c8fd___boxed(lean_object* v_carrier_373_){
_start:
{
uint8_t v_res_374_; lean_object* v_r_375_; 
v_res_374_ = lean_bridge_23220a30761b2d3716c5b4ed_structured_6cdd9c3be7604978d190e4f9d3a70db0539487ba_closure_graph_refinement_0_ba12b83e7ba38842c8fd(v_carrier_373_);
v_r_375_ = lean_box(v_res_374_);
return v_r_375_;
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNative730462696d8af341_invoke__6bc98ee774b20d3238b9e42a92309a51ce9dad0a___boxed(lean_object* v_token_378_, lean_object* v_a0_379_){
_start:
{
size_t v_token_boxed_380_; lean_object* v_res_381_; 
v_token_boxed_380_ = lean_unbox_usize(v_token_378_);
lean_dec(v_token_378_);
v_res_381_ = lean_bridge_23220a30761b2d3716c5b4ed_structured_6bc98ee774b20d3238b9e42a92309a51ce9dad0a_invoke(v_token_boxed_380_, v_a0_379_);
return v_res_381_;
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNative730462696d8af341_recovery__6bc98ee774b20d3238b9e42a92309a51ce9dad0a___boxed(lean_object* v_token_383_){
_start:
{
size_t v_token_boxed_384_; lean_object* v_res_385_; 
v_token_boxed_384_ = lean_unbox_usize(v_token_383_);
lean_dec(v_token_383_);
v_res_385_ = lean_bridge_23220a30761b2d3716c5b4ed_structured_6bc98ee774b20d3238b9e42a92309a51ce9dad0a_recovery(v_token_boxed_384_);
return v_res_385_;
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNative730462696d8af341_reject__6bc98ee774b20d3238b9e42a92309a51ce9dad0a___boxed(lean_object* v_token_388_, lean_object* v_recovery_389_){
_start:
{
size_t v_token_boxed_390_; lean_object* v_res_391_; 
v_token_boxed_390_ = lean_unbox_usize(v_token_388_);
lean_dec(v_token_388_);
v_res_391_ = lean_bridge_23220a30761b2d3716c5b4ed_structured_6bc98ee774b20d3238b9e42a92309a51ce9dad0a_reject(v_token_boxed_390_, v_recovery_389_);
return v_res_391_;
}
}
LEAN_EXPORT lean_object* lean_bridge_23220a30761b2d3716c5b4ed_structured_6bc98ee774b20d3238b9e42a92309a51ce9dad0a_wrap(size_t v_token_392_){
_start:
{
lean_object* v___x_393_; lean_object* v___x_394_; lean_object* v___x_395_; lean_object* v___x_396_; 
v___x_393_ = lean_unsigned_to_nat(1u);
v___x_394_ = lean_mk_empty_array_with_capacity(v___x_393_);
v___x_395_ = lean_box_usize(v_token_392_);
v___x_396_ = lean_array_push(v___x_394_, v___x_395_);
return v___x_396_;
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNative730462696d8af341_wrap__6bc98ee774b20d3238b9e42a92309a51ce9dad0a___boxed(lean_object* v_token_397_){
_start:
{
size_t v_token_boxed_398_; lean_object* v_res_399_; 
v_token_boxed_398_ = lean_unbox_usize(v_token_397_);
lean_dec(v_token_397_);
v_res_399_ = lean_bridge_23220a30761b2d3716c5b4ed_structured_6bc98ee774b20d3238b9e42a92309a51ce9dad0a_wrap(v_token_boxed_398_);
return v_res_399_;
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNative730462696d8af341_export0___lam__0(lean_object* v_val_400_, size_t v_val_401_, lean_object* v_val_402_, lean_object* v___bridgeCallback0__0_403_){
_start:
{
lean_object* v___x_413_; lean_object* v___x_414_; lean_object* v___x_415_; lean_object* v___x_416_; lean_object* v___x_417_; 
v___x_413_ = lean_unsigned_to_nat(1u);
v___x_414_ = lean_mk_empty_array_with_capacity(v___x_413_);
v___x_415_ = lean_array_push(v___x_414_, v___bridgeCallback0__0_403_);
v___x_416_ = lean_bridge_23220a30761b2d3716c5b4ed_structured_6bc98ee774b20d3238b9e42a92309a51ce9dad0a_invoke(v_val_401_, v___x_415_);
v___x_417_ = l_LeanBridgeNative730462696d8af341_carrierValue___redArg(v___x_416_);
lean_dec_ref(v___x_416_);
if (lean_obj_tag(v___x_417_) == 0)
{
goto v___jp_404_;
}
else
{
lean_object* v_val_418_; lean_object* v___x_419_; 
v_val_418_ = lean_ctor_get(v___x_417_, 0);
lean_inc(v_val_418_);
lean_dec_ref_known(v___x_417_, 1);
v___x_419_ = lb_callback_subtype_probe_constructor_checkedPositive(v_val_418_);
if (lean_obj_tag(v___x_419_) == 0)
{
goto v___jp_404_;
}
else
{
lean_object* v_val_420_; 
lean_dec(v_val_400_);
v_val_420_ = lean_ctor_get(v___x_419_, 0);
lean_inc(v_val_420_);
lean_dec_ref_known(v___x_419_, 1);
return v_val_420_;
}
}
v___jp_404_:
{
lean_object* v___x_405_; lean_object* v___x_406_; lean_object* v___x_407_; lean_object* v___x_408_; lean_object* v___x_409_; 
v___x_405_ = lean_unsigned_to_nat(1u);
v___x_406_ = lean_mk_empty_array_with_capacity(v___x_405_);
v___x_407_ = lean_array_push(v___x_406_, v_val_400_);
v___x_408_ = lean_bridge_23220a30761b2d3716c5b4ed_structured_6bc98ee774b20d3238b9e42a92309a51ce9dad0a_reject(v_val_401_, v___x_407_);
v___x_409_ = l_LeanBridgeNative730462696d8af341_carrierValue___redArg(v___x_408_);
lean_dec_ref(v___x_408_);
if (lean_obj_tag(v___x_409_) == 0)
{
lean_inc(v_val_402_);
return v_val_402_;
}
else
{
lean_object* v_val_410_; lean_object* v___x_411_; 
v_val_410_ = lean_ctor_get(v___x_409_, 0);
lean_inc(v_val_410_);
lean_dec_ref_known(v___x_409_, 1);
v___x_411_ = lb_callback_subtype_probe_constructor_checkedPositive(v_val_410_);
if (lean_obj_tag(v___x_411_) == 0)
{
lean_inc(v_val_402_);
return v_val_402_;
}
else
{
lean_object* v_val_412_; 
v_val_412_ = lean_ctor_get(v___x_411_, 0);
lean_inc(v_val_412_);
lean_dec_ref_known(v___x_411_, 1);
return v_val_412_;
}
}
}
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNative730462696d8af341_export0___lam__0___boxed(lean_object* v_val_421_, lean_object* v_val_422_, lean_object* v_val_423_, lean_object* v___bridgeCallback0__0_424_){
_start:
{
size_t v_val_321__boxed_425_; lean_object* v_res_426_; 
v_val_321__boxed_425_ = lean_unbox_usize(v_val_422_);
lean_dec(v_val_422_);
v_res_426_ = l_LeanBridgeNative730462696d8af341_export0___lam__0(v_val_421_, v_val_321__boxed_425_, v_val_423_, v___bridgeCallback0__0_424_);
lean_dec(v_val_423_);
return v_res_426_;
}
}
LEAN_EXPORT lean_object* lean_bridge_23220a30761b2d3716c5b4ed_lean(lean_object* v_a0_427_){
  fputs("LB_CALLBACK_ENTRY_V1 enter adapter CallbackSubtypes.callHost:lean\n", stderr);

_start:
{
lean_object* v___x_428_; 
v___x_428_ = l_LeanBridgeNative730462696d8af341_carrierValue___redArg(v_a0_427_);
lean_dec_ref(v_a0_427_);
if (lean_obj_tag(v___x_428_) == 0)
{
lean_object* v___x_429_; 
v___x_429_ = lean_obj_once(&l_LeanBridgeNative730462696d8af341_field03f262999893350bc4fb4___closed__0, &l_LeanBridgeNative730462696d8af341_field03f262999893350bc4fb4___closed__0_once, _init_l_LeanBridgeNative730462696d8af341_field03f262999893350bc4fb4___closed__0);
return v___x_429_;
}
else
{
lean_object* v_val_430_; size_t v___x_431_; lean_object* v___x_432_; lean_object* v___x_433_; 
v_val_430_ = lean_ctor_get(v___x_428_, 0);
lean_inc(v_val_430_);
lean_dec_ref_known(v___x_428_, 1);
v___x_431_ = lean_unbox_usize(v_val_430_);
v___x_432_ = lean_bridge_23220a30761b2d3716c5b4ed_structured_6bc98ee774b20d3238b9e42a92309a51ce9dad0a_recovery(v___x_431_);
v___x_433_ = l_LeanBridgeNative730462696d8af341_carrierValue___redArg(v___x_432_);
lean_dec_ref(v___x_432_);
if (lean_obj_tag(v___x_433_) == 0)
{
lean_object* v___x_434_; 
lean_dec(v_val_430_);
v___x_434_ = l_LeanBridgeNative730462696d8af341_carrierResult___redArg(v___x_433_);
return v___x_434_;
}
else
{
lean_object* v_val_435_; lean_object* v___x_436_; 
v_val_435_ = lean_ctor_get(v___x_433_, 0);
lean_inc_n(v_val_435_, 2);
lean_dec_ref_known(v___x_433_, 1);
v___x_436_ = lb_callback_subtype_probe_constructor_checkedPositive(v_val_435_);
if (lean_obj_tag(v___x_436_) == 0)
{
lean_object* v___x_437_; 
lean_dec(v_val_435_);
lean_dec(v_val_430_);
v___x_437_ = lean_obj_once(&l_LeanBridgeNative730462696d8af341_field03f262999893350bc4fb4___closed__0, &l_LeanBridgeNative730462696d8af341_field03f262999893350bc4fb4___closed__0_once, _init_l_LeanBridgeNative730462696d8af341_field03f262999893350bc4fb4___closed__0);
return v___x_437_;
}
else
{
lean_object* v_val_438_; lean_object* v___x_440_; uint8_t v_isShared_441_; uint8_t v_isSharedCheck_448_; 
v_val_438_ = lean_ctor_get(v___x_436_, 0);
v_isSharedCheck_448_ = !lean_is_exclusive(v___x_436_);
if (v_isSharedCheck_448_ == 0)
{
v___x_440_ = v___x_436_;
v_isShared_441_ = v_isSharedCheck_448_;
goto v_resetjp_439_;
}
else
{
lean_inc(v_val_438_);
lean_dec(v___x_436_);
v___x_440_ = lean_box(0);
v_isShared_441_ = v_isSharedCheck_448_;
goto v_resetjp_439_;
}
v_resetjp_439_:
{
lean_object* v___f_442_; lean_object* v___x_443_; lean_object* v___x_445_; 
v___f_442_ = lean_alloc_closure((void*)(l_LeanBridgeNative730462696d8af341_export0___lam__0___boxed), 4, 3);
lean_closure_set(v___f_442_, 0, v_val_435_);
lean_closure_set(v___f_442_, 1, v_val_430_);
lean_closure_set(v___f_442_, 2, v_val_438_);
v___x_443_ = lb_callback_subtype_probe_source_callHost(v___f_442_);
if (v_isShared_441_ == 0)
{
lean_ctor_set(v___x_440_, 0, v___x_443_);
v___x_445_ = v___x_440_;
goto v_reusejp_444_;
}
else
{
lean_object* v_reuseFailAlloc_447_; 
v_reuseFailAlloc_447_ = lean_alloc_ctor(1, 1, 0);
lean_ctor_set(v_reuseFailAlloc_447_, 0, v___x_443_);
v___x_445_ = v_reuseFailAlloc_447_;
goto v_reusejp_444_;
}
v_reusejp_444_:
{
lean_object* v___x_446_; 
v___x_446_ = l_LeanBridgeNative730462696d8af341_carrierResult___redArg(v___x_445_);
return v___x_446_;
}
}
}
}
}
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNative730462696d8af341_export1___lam__0(lean_object* v___bridgeValue0_449_){
_start:
{
lean_object* v_val_451_; 
if (lean_obj_tag(v___bridgeValue0_449_) == 0)
{
lean_object* v___x_454_; 
v___x_454_ = lean_box(0);
v_val_451_ = v___x_454_;
goto v___jp_450_;
}
else
{
lean_object* v_val_455_; lean_object* v___x_456_; 
v_val_455_ = lean_ctor_get(v___bridgeValue0_449_, 0);
lean_inc(v_val_455_);
lean_dec_ref_known(v___bridgeValue0_449_, 1);
v___x_456_ = lb_callback_subtype_probe_constructor_checkedPositive(v_val_455_);
if (lean_obj_tag(v___x_456_) == 0)
{
lean_object* v___x_457_; 
v___x_457_ = lean_box(0);
return v___x_457_;
}
else
{
v_val_451_ = v___x_456_;
goto v___jp_450_;
}
}
v___jp_450_:
{
lean_object* v___x_452_; lean_object* v___x_453_; 
v___x_452_ = lean_alloc_ctor(1, 1, 0);
lean_ctor_set(v___x_452_, 0, v_val_451_);
v___x_453_ = lean_alloc_ctor(1, 1, 0);
lean_ctor_set(v___x_453_, 0, v___x_452_);
return v___x_453_;
}
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNative730462696d8af341_export1___lam__1(lean_object* v___bridgeValue0_458_){
_start:
{
lean_object* v___x_459_; lean_object* v___x_460_; 
v___x_459_ = lean_alloc_ctor(0, 1, 0);
lean_ctor_set(v___x_459_, 0, v___bridgeValue0_458_);
v___x_460_ = lean_alloc_ctor(1, 1, 0);
lean_ctor_set(v___x_460_, 0, v___x_459_);
return v___x_460_;
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNative730462696d8af341_export1___lam__2(lean_object* v_val_461_, size_t v_val_462_, lean_object* v_val_463_, lean_object* v___f_464_, lean_object* v___f_465_, lean_object* v___bridgeCallback0__0_466_){
_start:
{
lean_object* v___y_481_; lean_object* v___y_484_; 
if (lean_obj_tag(v___bridgeCallback0__0_466_) == 0)
{
lean_object* v___x_495_; 
v___x_495_ = lean_box(0);
v___y_484_ = v___x_495_;
goto v___jp_483_;
}
else
{
lean_object* v_val_496_; lean_object* v___x_498_; uint8_t v_isShared_499_; uint8_t v_isSharedCheck_503_; 
v_val_496_ = lean_ctor_get(v___bridgeCallback0__0_466_, 0);
v_isSharedCheck_503_ = !lean_is_exclusive(v___bridgeCallback0__0_466_);
if (v_isSharedCheck_503_ == 0)
{
v___x_498_ = v___bridgeCallback0__0_466_;
v_isShared_499_ = v_isSharedCheck_503_;
goto v_resetjp_497_;
}
else
{
lean_inc(v_val_496_);
lean_dec(v___bridgeCallback0__0_466_);
v___x_498_ = lean_box(0);
v_isShared_499_ = v_isSharedCheck_503_;
goto v_resetjp_497_;
}
v_resetjp_497_:
{
lean_object* v___x_501_; 
if (v_isShared_499_ == 0)
{
v___x_501_ = v___x_498_;
goto v_reusejp_500_;
}
else
{
lean_object* v_reuseFailAlloc_502_; 
v_reuseFailAlloc_502_ = lean_alloc_ctor(1, 1, 0);
lean_ctor_set(v_reuseFailAlloc_502_, 0, v_val_496_);
v___x_501_ = v_reuseFailAlloc_502_;
goto v_reusejp_500_;
}
v_reusejp_500_:
{
v___y_484_ = v___x_501_;
goto v___jp_483_;
}
}
}
v___jp_467_:
{
lean_object* v___x_468_; lean_object* v___x_469_; lean_object* v___x_470_; lean_object* v___x_471_; lean_object* v___x_472_; 
v___x_468_ = lean_unsigned_to_nat(1u);
v___x_469_ = lean_mk_empty_array_with_capacity(v___x_468_);
v___x_470_ = lean_array_push(v___x_469_, v_val_461_);
v___x_471_ = lean_bridge_23220a30761b2d3716c5b4ed_structured_14cd8f1b0d065ede9a36f8590000c62c12d8e99c_reject(v_val_462_, v___x_470_);
v___x_472_ = l_LeanBridgeNative730462696d8af341_carrierValue___redArg(v___x_471_);
lean_dec_ref(v___x_471_);
if (lean_obj_tag(v___x_472_) == 0)
{
lean_dec_ref(v___f_465_);
lean_dec_ref(v___f_464_);
lean_inc_ref(v_val_463_);
return v_val_463_;
}
else
{
lean_object* v_val_473_; 
v_val_473_ = lean_ctor_get(v___x_472_, 0);
lean_inc(v_val_473_);
lean_dec_ref_known(v___x_472_, 1);
if (lean_obj_tag(v_val_473_) == 0)
{
lean_object* v_a_474_; lean_object* v___x_475_; 
lean_dec_ref(v___f_465_);
v_a_474_ = lean_ctor_get(v_val_473_, 0);
lean_inc(v_a_474_);
lean_dec_ref_known(v_val_473_, 1);
v___x_475_ = lean_apply_1(v___f_464_, v_a_474_);
if (lean_obj_tag(v___x_475_) == 0)
{
lean_inc_ref(v_val_463_);
return v_val_463_;
}
else
{
lean_object* v_val_476_; 
v_val_476_ = lean_ctor_get(v___x_475_, 0);
lean_inc(v_val_476_);
lean_dec_ref_known(v___x_475_, 1);
return v_val_476_;
}
}
else
{
lean_object* v_a_477_; lean_object* v___x_478_; 
lean_dec_ref(v___f_464_);
v_a_477_ = lean_ctor_get(v_val_473_, 0);
lean_inc(v_a_477_);
lean_dec_ref_known(v_val_473_, 1);
v___x_478_ = lean_apply_1(v___f_465_, v_a_477_);
if (lean_obj_tag(v___x_478_) == 0)
{
lean_inc_ref(v_val_463_);
return v_val_463_;
}
else
{
lean_object* v_val_479_; 
v_val_479_ = lean_ctor_get(v___x_478_, 0);
lean_inc(v_val_479_);
lean_dec_ref_known(v___x_478_, 1);
return v_val_479_;
}
}
}
}
v___jp_480_:
{
if (lean_obj_tag(v___y_481_) == 0)
{
goto v___jp_467_;
}
else
{
lean_object* v_val_482_; 
lean_dec_ref(v___f_465_);
lean_dec_ref(v___f_464_);
lean_dec_ref(v_val_461_);
v_val_482_ = lean_ctor_get(v___y_481_, 0);
lean_inc(v_val_482_);
lean_dec_ref_known(v___y_481_, 1);
return v_val_482_;
}
}
v___jp_483_:
{
lean_object* v___x_485_; lean_object* v___x_486_; lean_object* v___x_487_; lean_object* v___x_488_; lean_object* v___x_489_; 
v___x_485_ = lean_unsigned_to_nat(1u);
v___x_486_ = lean_mk_empty_array_with_capacity(v___x_485_);
v___x_487_ = lean_array_push(v___x_486_, v___y_484_);
v___x_488_ = lean_bridge_23220a30761b2d3716c5b4ed_structured_14cd8f1b0d065ede9a36f8590000c62c12d8e99c_invoke(v_val_462_, v___x_487_);
v___x_489_ = l_LeanBridgeNative730462696d8af341_carrierValue___redArg(v___x_488_);
lean_dec_ref(v___x_488_);
if (lean_obj_tag(v___x_489_) == 0)
{
goto v___jp_467_;
}
else
{
lean_object* v_val_490_; 
v_val_490_ = lean_ctor_get(v___x_489_, 0);
lean_inc(v_val_490_);
lean_dec_ref_known(v___x_489_, 1);
if (lean_obj_tag(v_val_490_) == 0)
{
lean_object* v_a_491_; lean_object* v___x_492_; 
v_a_491_ = lean_ctor_get(v_val_490_, 0);
lean_inc(v_a_491_);
lean_dec_ref_known(v_val_490_, 1);
lean_inc_ref(v___f_464_);
v___x_492_ = lean_apply_1(v___f_464_, v_a_491_);
v___y_481_ = v___x_492_;
goto v___jp_480_;
}
else
{
lean_object* v_a_493_; lean_object* v___x_494_; 
v_a_493_ = lean_ctor_get(v_val_490_, 0);
lean_inc(v_a_493_);
lean_dec_ref_known(v_val_490_, 1);
lean_inc_ref(v___f_465_);
v___x_494_ = lean_apply_1(v___f_465_, v_a_493_);
v___y_481_ = v___x_494_;
goto v___jp_480_;
}
}
}
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNative730462696d8af341_export1___lam__2___boxed(lean_object* v_val_504_, lean_object* v_val_505_, lean_object* v_val_506_, lean_object* v___f_507_, lean_object* v___f_508_, lean_object* v___bridgeCallback0__0_509_){
_start:
{
size_t v_val_651__boxed_510_; lean_object* v_res_511_; 
v_val_651__boxed_510_ = lean_unbox_usize(v_val_505_);
lean_dec(v_val_505_);
v_res_511_ = l_LeanBridgeNative730462696d8af341_export1___lam__2(v_val_504_, v_val_651__boxed_510_, v_val_506_, v___f_507_, v___f_508_, v___bridgeCallback0__0_509_);
lean_dec_ref(v_val_506_);
return v_res_511_;
}
}
static lean_object* _init_l_LeanBridgeNative730462696d8af341_export1___closed__4(void){
_start:
{
lean_object* v___x_518_; lean_object* v___x_519_; 
v___x_518_ = ((lean_object*)(l_LeanBridgeNative730462696d8af341_export1___closed__3));
v___x_519_ = l_LeanBridgeNative730462696d8af341_carrierResult___redArg(v___x_518_);
return v___x_519_;
}
}
LEAN_EXPORT lean_object* lean_bridge_8ffe188578f9a7b74003cf3c_lean(lean_object* v_a0_520_){
_start:
{
lean_object* v___x_521_; 
v___x_521_ = l_LeanBridgeNative730462696d8af341_carrierValue___redArg(v_a0_520_);
lean_dec_ref(v_a0_520_);
if (lean_obj_tag(v___x_521_) == 0)
{
lean_object* v___x_522_; 
v___x_522_ = lean_obj_once(&l_LeanBridgeNative730462696d8af341_make0ec3de31d02aa0faa1710___closed__0, &l_LeanBridgeNative730462696d8af341_make0ec3de31d02aa0faa1710___closed__0_once, _init_l_LeanBridgeNative730462696d8af341_make0ec3de31d02aa0faa1710___closed__0);
return v___x_522_;
}
else
{
lean_object* v_val_523_; size_t v___x_524_; lean_object* v___x_525_; lean_object* v___x_526_; 
v_val_523_ = lean_ctor_get(v___x_521_, 0);
lean_inc(v_val_523_);
lean_dec_ref_known(v___x_521_, 1);
v___x_524_ = lean_unbox_usize(v_val_523_);
v___x_525_ = lean_bridge_23220a30761b2d3716c5b4ed_structured_14cd8f1b0d065ede9a36f8590000c62c12d8e99c_recovery(v___x_524_);
v___x_526_ = l_LeanBridgeNative730462696d8af341_carrierValue___redArg(v___x_525_);
lean_dec_ref(v___x_525_);
if (lean_obj_tag(v___x_526_) == 0)
{
lean_object* v___x_527_; 
lean_dec(v_val_523_);
v___x_527_ = l_LeanBridgeNative730462696d8af341_carrierResult___redArg(v___x_526_);
return v___x_527_;
}
else
{
lean_object* v_val_528_; lean_object* v___f_529_; lean_object* v___f_530_; lean_object* v___y_532_; 
v_val_528_ = lean_ctor_get(v___x_526_, 0);
lean_inc(v_val_528_);
lean_dec_ref_known(v___x_526_, 1);
v___f_529_ = ((lean_object*)(l_LeanBridgeNative730462696d8af341_export1___closed__0));
v___f_530_ = ((lean_object*)(l_LeanBridgeNative730462696d8af341_export1___closed__1));
if (lean_obj_tag(v_val_528_) == 0)
{
lean_object* v_a_574_; lean_object* v___x_575_; 
v_a_574_ = lean_ctor_get(v_val_528_, 0);
lean_inc(v_a_574_);
v___x_575_ = l_LeanBridgeNative730462696d8af341_export1___lam__1(v_a_574_);
v___y_532_ = v___x_575_;
goto v___jp_531_;
}
else
{
lean_object* v_a_576_; lean_object* v___x_577_; 
v_a_576_ = lean_ctor_get(v_val_528_, 0);
lean_inc(v_a_576_);
v___x_577_ = l_LeanBridgeNative730462696d8af341_export1___lam__0(v_a_576_);
v___y_532_ = v___x_577_;
goto v___jp_531_;
}
v___jp_531_:
{
if (lean_obj_tag(v___y_532_) == 0)
{
lean_object* v___x_533_; 
lean_dec(v_val_528_);
lean_dec(v_val_523_);
v___x_533_ = lean_obj_once(&l_LeanBridgeNative730462696d8af341_make0ec3de31d02aa0faa1710___closed__0, &l_LeanBridgeNative730462696d8af341_make0ec3de31d02aa0faa1710___closed__0_once, _init_l_LeanBridgeNative730462696d8af341_make0ec3de31d02aa0faa1710___closed__0);
return v___x_533_;
}
else
{
lean_object* v_val_534_; lean_object* v___x_536_; uint8_t v_isShared_537_; uint8_t v_isSharedCheck_573_; 
v_val_534_ = lean_ctor_get(v___y_532_, 0);
v_isSharedCheck_573_ = !lean_is_exclusive(v___y_532_);
if (v_isSharedCheck_573_ == 0)
{
v___x_536_ = v___y_532_;
v_isShared_537_ = v_isSharedCheck_573_;
goto v_resetjp_535_;
}
else
{
lean_inc(v_val_534_);
lean_dec(v___y_532_);
v___x_536_ = lean_box(0);
v_isShared_537_ = v_isSharedCheck_573_;
goto v_resetjp_535_;
}
v_resetjp_535_:
{
lean_object* v___f_538_; lean_object* v___x_539_; 
v___f_538_ = lean_alloc_closure((void*)(l_LeanBridgeNative730462696d8af341_export1___lam__2___boxed), 6, 5);
lean_closure_set(v___f_538_, 0, v_val_528_);
lean_closure_set(v___f_538_, 1, v_val_523_);
lean_closure_set(v___f_538_, 2, v_val_534_);
lean_closure_set(v___f_538_, 3, v___f_530_);
lean_closure_set(v___f_538_, 4, v___f_529_);
v___x_539_ = l_CallbackSubtypes_callHostContainer(v___f_538_);
if (lean_obj_tag(v___x_539_) == 0)
{
lean_object* v_a_540_; lean_object* v___x_542_; uint8_t v_isShared_543_; uint8_t v_isSharedCheck_551_; 
v_a_540_ = lean_ctor_get(v___x_539_, 0);
v_isSharedCheck_551_ = !lean_is_exclusive(v___x_539_);
if (v_isSharedCheck_551_ == 0)
{
v___x_542_ = v___x_539_;
v_isShared_543_ = v_isSharedCheck_551_;
goto v_resetjp_541_;
}
else
{
lean_inc(v_a_540_);
lean_dec(v___x_539_);
v___x_542_ = lean_box(0);
v_isShared_543_ = v_isSharedCheck_551_;
goto v_resetjp_541_;
}
v_resetjp_541_:
{
lean_object* v___x_545_; 
if (v_isShared_543_ == 0)
{
v___x_545_ = v___x_542_;
goto v_reusejp_544_;
}
else
{
lean_object* v_reuseFailAlloc_550_; 
v_reuseFailAlloc_550_ = lean_alloc_ctor(0, 1, 0);
lean_ctor_set(v_reuseFailAlloc_550_, 0, v_a_540_);
v___x_545_ = v_reuseFailAlloc_550_;
goto v_reusejp_544_;
}
v_reusejp_544_:
{
lean_object* v___x_547_; 
if (v_isShared_537_ == 0)
{
lean_ctor_set(v___x_536_, 0, v___x_545_);
v___x_547_ = v___x_536_;
goto v_reusejp_546_;
}
else
{
lean_object* v_reuseFailAlloc_549_; 
v_reuseFailAlloc_549_ = lean_alloc_ctor(1, 1, 0);
lean_ctor_set(v_reuseFailAlloc_549_, 0, v___x_545_);
v___x_547_ = v_reuseFailAlloc_549_;
goto v_reusejp_546_;
}
v_reusejp_546_:
{
lean_object* v___x_548_; 
v___x_548_ = l_LeanBridgeNative730462696d8af341_carrierResult___redArg(v___x_547_);
return v___x_548_;
}
}
}
}
else
{
lean_object* v_a_552_; lean_object* v___x_554_; uint8_t v_isShared_555_; uint8_t v_isSharedCheck_572_; 
v_a_552_ = lean_ctor_get(v___x_539_, 0);
v_isSharedCheck_572_ = !lean_is_exclusive(v___x_539_);
if (v_isSharedCheck_572_ == 0)
{
v___x_554_ = v___x_539_;
v_isShared_555_ = v_isSharedCheck_572_;
goto v_resetjp_553_;
}
else
{
lean_inc(v_a_552_);
lean_dec(v___x_539_);
v___x_554_ = lean_box(0);
v_isShared_555_ = v_isSharedCheck_572_;
goto v_resetjp_553_;
}
v_resetjp_553_:
{
if (lean_obj_tag(v_a_552_) == 0)
{
lean_object* v___x_556_; 
lean_del_object(v___x_554_);
lean_del_object(v___x_536_);
v___x_556_ = lean_obj_once(&l_LeanBridgeNative730462696d8af341_export1___closed__4, &l_LeanBridgeNative730462696d8af341_export1___closed__4_once, _init_l_LeanBridgeNative730462696d8af341_export1___closed__4);
return v___x_556_;
}
else
{
lean_object* v_val_557_; lean_object* v___x_559_; uint8_t v_isShared_560_; uint8_t v_isSharedCheck_571_; 
v_val_557_ = lean_ctor_get(v_a_552_, 0);
v_isSharedCheck_571_ = !lean_is_exclusive(v_a_552_);
if (v_isSharedCheck_571_ == 0)
{
v___x_559_ = v_a_552_;
v_isShared_560_ = v_isSharedCheck_571_;
goto v_resetjp_558_;
}
else
{
lean_inc(v_val_557_);
lean_dec(v_a_552_);
v___x_559_ = lean_box(0);
v_isShared_560_ = v_isSharedCheck_571_;
goto v_resetjp_558_;
}
v_resetjp_558_:
{
lean_object* v___x_562_; 
if (v_isShared_560_ == 0)
{
v___x_562_ = v___x_559_;
goto v_reusejp_561_;
}
else
{
lean_object* v_reuseFailAlloc_570_; 
v_reuseFailAlloc_570_ = lean_alloc_ctor(1, 1, 0);
lean_ctor_set(v_reuseFailAlloc_570_, 0, v_val_557_);
v___x_562_ = v_reuseFailAlloc_570_;
goto v_reusejp_561_;
}
v_reusejp_561_:
{
lean_object* v___x_564_; 
if (v_isShared_555_ == 0)
{
lean_ctor_set(v___x_554_, 0, v___x_562_);
v___x_564_ = v___x_554_;
goto v_reusejp_563_;
}
else
{
lean_object* v_reuseFailAlloc_569_; 
v_reuseFailAlloc_569_ = lean_alloc_ctor(1, 1, 0);
lean_ctor_set(v_reuseFailAlloc_569_, 0, v___x_562_);
v___x_564_ = v_reuseFailAlloc_569_;
goto v_reusejp_563_;
}
v_reusejp_563_:
{
lean_object* v___x_566_; 
if (v_isShared_537_ == 0)
{
lean_ctor_set(v___x_536_, 0, v___x_564_);
v___x_566_ = v___x_536_;
goto v_reusejp_565_;
}
else
{
lean_object* v_reuseFailAlloc_568_; 
v_reuseFailAlloc_568_ = lean_alloc_ctor(1, 1, 0);
lean_ctor_set(v_reuseFailAlloc_568_, 0, v___x_564_);
v___x_566_ = v_reuseFailAlloc_568_;
goto v_reusejp_565_;
}
v_reusejp_565_:
{
lean_object* v___x_567_; 
v___x_567_ = l_LeanBridgeNative730462696d8af341_carrierResult___redArg(v___x_566_);
return v___x_567_;
}
}
}
}
}
}
}
}
}
}
}
}
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNative730462696d8af341_export2___lam__0(lean_object* v_val_578_, size_t v_val_579_, lean_object* v_val_580_, lean_object* v___bridgeCallback0__0_581_, lean_object* v___bridgeCallback0__1_582_){
_start:
{
lean_object* v___x_592_; lean_object* v___x_593_; lean_object* v___x_594_; lean_object* v___x_595_; lean_object* v___x_596_; lean_object* v___x_597_; 
v___x_592_ = lean_unsigned_to_nat(1u);
v___x_593_ = lean_mk_empty_array_with_capacity(v___x_592_);
lean_inc_ref(v___x_593_);
v___x_594_ = lean_array_push(v___x_593_, v___bridgeCallback0__0_581_);
v___x_595_ = lean_array_push(v___x_593_, v___bridgeCallback0__1_582_);
v___x_596_ = lean_bridge_23220a30761b2d3716c5b4ed_structured_197d5bf19058d37bc5547c33a8e0bed3bf121ea7_invoke(v_val_579_, v___x_594_, v___x_595_);
v___x_597_ = l_LeanBridgeNative730462696d8af341_carrierValue___redArg(v___x_596_);
lean_dec_ref(v___x_596_);
if (lean_obj_tag(v___x_597_) == 0)
{
goto v___jp_583_;
}
else
{
lean_object* v_val_598_; lean_object* v___x_599_; 
v_val_598_ = lean_ctor_get(v___x_597_, 0);
lean_inc(v_val_598_);
lean_dec_ref_known(v___x_597_, 1);
v___x_599_ = lb_callback_subtype_probe_constructor_checkedPositive(v_val_598_);
if (lean_obj_tag(v___x_599_) == 0)
{
goto v___jp_583_;
}
else
{
lean_object* v_val_600_; 
lean_dec(v_val_578_);
v_val_600_ = lean_ctor_get(v___x_599_, 0);
lean_inc(v_val_600_);
lean_dec_ref_known(v___x_599_, 1);
return v_val_600_;
}
}
v___jp_583_:
{
lean_object* v___x_584_; lean_object* v___x_585_; lean_object* v___x_586_; lean_object* v___x_587_; lean_object* v___x_588_; 
v___x_584_ = lean_unsigned_to_nat(1u);
v___x_585_ = lean_mk_empty_array_with_capacity(v___x_584_);
v___x_586_ = lean_array_push(v___x_585_, v_val_578_);
v___x_587_ = lean_bridge_23220a30761b2d3716c5b4ed_structured_197d5bf19058d37bc5547c33a8e0bed3bf121ea7_reject(v_val_579_, v___x_586_);
v___x_588_ = l_LeanBridgeNative730462696d8af341_carrierValue___redArg(v___x_587_);
lean_dec_ref(v___x_587_);
if (lean_obj_tag(v___x_588_) == 0)
{
lean_inc(v_val_580_);
return v_val_580_;
}
else
{
lean_object* v_val_589_; lean_object* v___x_590_; 
v_val_589_ = lean_ctor_get(v___x_588_, 0);
lean_inc(v_val_589_);
lean_dec_ref_known(v___x_588_, 1);
v___x_590_ = lb_callback_subtype_probe_constructor_checkedPositive(v_val_589_);
if (lean_obj_tag(v___x_590_) == 0)
{
lean_inc(v_val_580_);
return v_val_580_;
}
else
{
lean_object* v_val_591_; 
v_val_591_ = lean_ctor_get(v___x_590_, 0);
lean_inc(v_val_591_);
lean_dec_ref_known(v___x_590_, 1);
return v_val_591_;
}
}
}
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNative730462696d8af341_export2___lam__0___boxed(lean_object* v_val_601_, lean_object* v_val_602_, lean_object* v_val_603_, lean_object* v___bridgeCallback0__0_604_, lean_object* v___bridgeCallback0__1_605_){
_start:
{
size_t v_val_337__boxed_606_; lean_object* v_res_607_; 
v_val_337__boxed_606_ = lean_unbox_usize(v_val_602_);
lean_dec(v_val_602_);
v_res_607_ = l_LeanBridgeNative730462696d8af341_export2___lam__0(v_val_601_, v_val_337__boxed_606_, v_val_603_, v___bridgeCallback0__0_604_, v___bridgeCallback0__1_605_);
lean_dec(v_val_603_);
return v_res_607_;
}
}
LEAN_EXPORT lean_object* lean_bridge_4f106adfac5064464a2a8e3f_lean(lean_object* v_a0_608_){
  fputs("LB_CALLBACK_ENTRY_V1 enter adapter CallbackSubtypes.callHostMixed:lean\n", stderr);

_start:
{
lean_object* v___x_609_; 
v___x_609_ = l_LeanBridgeNative730462696d8af341_carrierValue___redArg(v_a0_608_);
lean_dec_ref(v_a0_608_);
if (lean_obj_tag(v___x_609_) == 0)
{
lean_object* v___x_610_; 
v___x_610_ = lean_obj_once(&l_LeanBridgeNative730462696d8af341_field03f262999893350bc4fb4___closed__0, &l_LeanBridgeNative730462696d8af341_field03f262999893350bc4fb4___closed__0_once, _init_l_LeanBridgeNative730462696d8af341_field03f262999893350bc4fb4___closed__0);
return v___x_610_;
}
else
{
lean_object* v_val_611_; size_t v___x_612_; lean_object* v___x_613_; lean_object* v___x_614_; 
v_val_611_ = lean_ctor_get(v___x_609_, 0);
lean_inc(v_val_611_);
lean_dec_ref_known(v___x_609_, 1);
v___x_612_ = lean_unbox_usize(v_val_611_);
v___x_613_ = lean_bridge_23220a30761b2d3716c5b4ed_structured_197d5bf19058d37bc5547c33a8e0bed3bf121ea7_recovery(v___x_612_);
v___x_614_ = l_LeanBridgeNative730462696d8af341_carrierValue___redArg(v___x_613_);
lean_dec_ref(v___x_613_);
if (lean_obj_tag(v___x_614_) == 0)
{
lean_object* v___x_615_; 
lean_dec(v_val_611_);
v___x_615_ = l_LeanBridgeNative730462696d8af341_carrierResult___redArg(v___x_614_);
return v___x_615_;
}
else
{
lean_object* v_val_616_; lean_object* v___x_617_; 
v_val_616_ = lean_ctor_get(v___x_614_, 0);
lean_inc_n(v_val_616_, 2);
lean_dec_ref_known(v___x_614_, 1);
v___x_617_ = lb_callback_subtype_probe_constructor_checkedPositive(v_val_616_);
if (lean_obj_tag(v___x_617_) == 0)
{
lean_object* v___x_618_; 
lean_dec(v_val_616_);
lean_dec(v_val_611_);
v___x_618_ = lean_obj_once(&l_LeanBridgeNative730462696d8af341_field03f262999893350bc4fb4___closed__0, &l_LeanBridgeNative730462696d8af341_field03f262999893350bc4fb4___closed__0_once, _init_l_LeanBridgeNative730462696d8af341_field03f262999893350bc4fb4___closed__0);
return v___x_618_;
}
else
{
lean_object* v_val_619_; lean_object* v___x_621_; uint8_t v_isShared_622_; uint8_t v_isSharedCheck_629_; 
v_val_619_ = lean_ctor_get(v___x_617_, 0);
v_isSharedCheck_629_ = !lean_is_exclusive(v___x_617_);
if (v_isSharedCheck_629_ == 0)
{
v___x_621_ = v___x_617_;
v_isShared_622_ = v_isSharedCheck_629_;
goto v_resetjp_620_;
}
else
{
lean_inc(v_val_619_);
lean_dec(v___x_617_);
v___x_621_ = lean_box(0);
v_isShared_622_ = v_isSharedCheck_629_;
goto v_resetjp_620_;
}
v_resetjp_620_:
{
lean_object* v___f_623_; lean_object* v___x_624_; lean_object* v___x_626_; 
v___f_623_ = lean_alloc_closure((void*)(l_LeanBridgeNative730462696d8af341_export2___lam__0___boxed), 5, 3);
lean_closure_set(v___f_623_, 0, v_val_616_);
lean_closure_set(v___f_623_, 1, v_val_611_);
lean_closure_set(v___f_623_, 2, v_val_619_);
v___x_624_ = lb_callback_subtype_probe_source_callHostMixed(v___f_623_);
if (v_isShared_622_ == 0)
{
lean_ctor_set(v___x_621_, 0, v___x_624_);
v___x_626_ = v___x_621_;
goto v_reusejp_625_;
}
else
{
lean_object* v_reuseFailAlloc_628_; 
v_reuseFailAlloc_628_ = lean_alloc_ctor(1, 1, 0);
lean_ctor_set(v_reuseFailAlloc_628_, 0, v___x_624_);
v___x_626_ = v_reuseFailAlloc_628_;
goto v_reusejp_625_;
}
v_reusejp_625_:
{
lean_object* v___x_627_; 
v___x_627_ = l_LeanBridgeNative730462696d8af341_carrierResult___redArg(v___x_626_);
return v___x_627_;
}
}
}
}
}
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNative730462696d8af341_export3___lam__0(lean_object* v___bridgeCallbackResult__0_630_){
_start:
{
lean_object* v___x_631_; 
v___x_631_ = lb_callback_subtype_probe_constructor_checkedPositive(v___bridgeCallbackResult__0_630_);
if (lean_obj_tag(v___x_631_) == 0)
{
lean_object* v___x_632_; 
v___x_632_ = lean_box(0);
return v___x_632_;
}
else
{
lean_object* v_val_633_; lean_object* v___x_635_; uint8_t v_isShared_636_; uint8_t v_isSharedCheck_641_; 
v_val_633_ = lean_ctor_get(v___x_631_, 0);
v_isSharedCheck_641_ = !lean_is_exclusive(v___x_631_);
if (v_isSharedCheck_641_ == 0)
{
v___x_635_ = v___x_631_;
v_isShared_636_ = v_isSharedCheck_641_;
goto v_resetjp_634_;
}
else
{
lean_inc(v_val_633_);
lean_dec(v___x_631_);
v___x_635_ = lean_box(0);
v_isShared_636_ = v_isSharedCheck_641_;
goto v_resetjp_634_;
}
v_resetjp_634_:
{
lean_object* v___x_637_; lean_object* v___x_639_; 
v___x_637_ = l_CallbackSubtypes_makeClosure___redArg(v_val_633_);
if (v_isShared_636_ == 0)
{
lean_ctor_set(v___x_635_, 0, v___x_637_);
v___x_639_ = v___x_635_;
goto v_reusejp_638_;
}
else
{
lean_object* v_reuseFailAlloc_640_; 
v_reuseFailAlloc_640_ = lean_alloc_ctor(1, 1, 0);
lean_ctor_set(v_reuseFailAlloc_640_, 0, v___x_637_);
v___x_639_ = v_reuseFailAlloc_640_;
goto v_reusejp_638_;
}
v_reusejp_638_:
{
return v___x_639_;
}
}
}
}
}
static lean_object* _init_l_LeanBridgeNative730462696d8af341_export3___closed__0(void){
_start:
{
lean_object* v___x_642_; lean_object* v___x_643_; 
v___x_642_ = lean_box(0);
v___x_643_ = l_LeanBridgeNative730462696d8af341_carrierResult___redArg(v___x_642_);
return v___x_643_;
}
}
static lean_object* _init_l_LeanBridgeNative730462696d8af341_export3___closed__3(void){
_start:
{
lean_object* v___x_647_; lean_object* v___x_648_; 
v___x_647_ = ((lean_object*)(l_LeanBridgeNative730462696d8af341_export3___closed__2));
v___x_648_ = l_LeanBridgeNative730462696d8af341_carrierResult___redArg(v___x_647_);
return v___x_648_;
}
}
LEAN_EXPORT lean_object* lean_bridge_e2d5407c03792441cb368ec1_lean(lean_object* v_a0_649_){
  fputs("LB_CALLBACK_ENTRY_V1 enter adapter CallbackSubtypes.makeClosure:lean\n", stderr);

_start:
{
lean_object* v___x_650_; 
v___x_650_ = l_LeanBridgeNative730462696d8af341_carrierValue___redArg(v_a0_649_);
lean_dec_ref(v_a0_649_);
if (lean_obj_tag(v___x_650_) == 0)
{
lean_object* v___x_651_; 
v___x_651_ = lean_obj_once(&l_LeanBridgeNative730462696d8af341_export3___closed__0, &l_LeanBridgeNative730462696d8af341_export3___closed__0_once, _init_l_LeanBridgeNative730462696d8af341_export3___closed__0);
return v___x_651_;
}
else
{
lean_object* v___x_652_; 
lean_dec_ref_known(v___x_650_, 1);
v___x_652_ = lean_obj_once(&l_LeanBridgeNative730462696d8af341_export3___closed__3, &l_LeanBridgeNative730462696d8af341_export3___closed__3_once, _init_l_LeanBridgeNative730462696d8af341_export3___closed__3);
return v___x_652_;
}
}
}
LEAN_EXPORT lean_object* l___private_Init_Data_Array_Basic_0__Array_mapMUnsafe_map___at___00LeanBridgeNative730462696d8af341_export4_spec__0(size_t v_sz_653_, size_t v_i_654_, lean_object* v_bs_655_){
_start:
{
uint8_t v___x_656_; 
v___x_656_ = lean_usize_dec_lt(v_i_654_, v_sz_653_);
if (v___x_656_ == 0)
{
lean_object* v___x_657_; 
v___x_657_ = lean_alloc_ctor(1, 1, 0);
lean_ctor_set(v___x_657_, 0, v_bs_655_);
return v___x_657_;
}
else
{
lean_object* v_v_658_; lean_object* v___x_659_; lean_object* v_bs_x27_660_; lean_object* v_val_662_; 
v_v_658_ = lean_array_uget(v_bs_655_, v_i_654_);
v___x_659_ = lean_unsigned_to_nat(0u);
v_bs_x27_660_ = lean_array_uset(v_bs_655_, v_i_654_, v___x_659_);
if (lean_obj_tag(v_v_658_) == 0)
{
lean_object* v___x_667_; 
v___x_667_ = lean_box(0);
v_val_662_ = v___x_667_;
goto v___jp_661_;
}
else
{
lean_object* v_val_668_; lean_object* v___x_669_; 
v_val_668_ = lean_ctor_get(v_v_658_, 0);
lean_inc(v_val_668_);
lean_dec_ref_known(v_v_658_, 1);
v___x_669_ = lb_callback_subtype_probe_constructor_checkedPositive(v_val_668_);
if (lean_obj_tag(v___x_669_) == 0)
{
lean_object* v___x_670_; 
lean_dec_ref(v_bs_x27_660_);
v___x_670_ = lean_box(0);
return v___x_670_;
}
else
{
v_val_662_ = v___x_669_;
goto v___jp_661_;
}
}
v___jp_661_:
{
size_t v___x_663_; size_t v___x_664_; lean_object* v___x_665_; 
v___x_663_ = ((size_t)1ULL);
v___x_664_ = lean_usize_add(v_i_654_, v___x_663_);
v___x_665_ = lean_array_uset(v_bs_x27_660_, v_i_654_, v_val_662_);
v_i_654_ = v___x_664_;
v_bs_655_ = v___x_665_;
goto _start;
}
}
}
}
LEAN_EXPORT lean_object* l___private_Init_Data_Array_Basic_0__Array_mapMUnsafe_map___at___00LeanBridgeNative730462696d8af341_export4_spec__0___boxed(lean_object* v_sz_671_, lean_object* v_i_672_, lean_object* v_bs_673_){
_start:
{
size_t v_sz_boxed_674_; size_t v_i_boxed_675_; lean_object* v_res_676_; 
v_sz_boxed_674_ = lean_unbox_usize(v_sz_671_);
lean_dec(v_sz_671_);
v_i_boxed_675_ = lean_unbox_usize(v_i_672_);
lean_dec(v_i_672_);
v_res_676_ = l___private_Init_Data_Array_Basic_0__Array_mapMUnsafe_map___at___00LeanBridgeNative730462696d8af341_export4_spec__0(v_sz_boxed_674_, v_i_boxed_675_, v_bs_673_);
return v_res_676_;
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNative730462696d8af341_export4___lam__0(lean_object* v___bridgeCallbackResult__0_677_){
_start:
{
size_t v_sz_678_; size_t v___x_679_; lean_object* v___x_680_; 
v_sz_678_ = lean_array_size(v___bridgeCallbackResult__0_677_);
v___x_679_ = ((size_t)0ULL);
v___x_680_ = l___private_Init_Data_Array_Basic_0__Array_mapMUnsafe_map___at___00LeanBridgeNative730462696d8af341_export4_spec__0(v_sz_678_, v___x_679_, v___bridgeCallbackResult__0_677_);
if (lean_obj_tag(v___x_680_) == 0)
{
lean_object* v___x_681_; 
v___x_681_ = lean_box(0);
return v___x_681_;
}
else
{
lean_object* v___x_682_; 
lean_dec_ref_known(v___x_680_, 1);
v___x_682_ = ((lean_object*)(l_LeanBridgeNative730462696d8af341_none3f262999893350bc4fb4___closed__0));
return v___x_682_;
}
}
}
static lean_object* _init_l_LeanBridgeNative730462696d8af341_export4___closed__0(void){
_start:
{
lean_object* v___x_683_; lean_object* v___x_684_; 
v___x_683_ = lean_box(0);
v___x_684_ = l_LeanBridgeNative730462696d8af341_carrierResult___redArg(v___x_683_);
return v___x_684_;
}
}
static lean_object* _init_l_LeanBridgeNative730462696d8af341_export4___closed__3(void){
_start:
{
lean_object* v___x_688_; lean_object* v___x_689_; 
v___x_688_ = ((lean_object*)(l_LeanBridgeNative730462696d8af341_export4___closed__2));
v___x_689_ = l_LeanBridgeNative730462696d8af341_carrierResult___redArg(v___x_688_);
return v___x_689_;
}
}
LEAN_EXPORT lean_object* lean_bridge_07d8425a546c7304b285ddcd_lean(lean_object* v_a0_690_){
_start:
{
lean_object* v___x_691_; 
v___x_691_ = l_LeanBridgeNative730462696d8af341_carrierValue___redArg(v_a0_690_);
lean_dec_ref(v_a0_690_);
if (lean_obj_tag(v___x_691_) == 0)
{
lean_object* v___x_692_; 
v___x_692_ = lean_obj_once(&l_LeanBridgeNative730462696d8af341_export4___closed__0, &l_LeanBridgeNative730462696d8af341_export4___closed__0_once, _init_l_LeanBridgeNative730462696d8af341_export4___closed__0);
return v___x_692_;
}
else
{
lean_object* v___x_693_; 
lean_dec_ref_known(v___x_691_, 1);
v___x_693_ = lean_obj_once(&l_LeanBridgeNative730462696d8af341_export4___closed__3, &l_LeanBridgeNative730462696d8af341_export4___closed__3_once, _init_l_LeanBridgeNative730462696d8af341_export4___closed__3);
return v___x_693_;
}
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNative730462696d8af341_export5___lam__0(lean_object* v___bridgeCallbackResult__0_694_, lean_object* v___bridgeCallbackResult__1_695_){
_start:
{
lean_object* v___x_696_; 
v___x_696_ = lb_callback_subtype_probe_constructor_checkedPositive(v___bridgeCallbackResult__1_695_);
if (lean_obj_tag(v___x_696_) == 0)
{
lean_object* v___x_697_; 
v___x_697_ = lean_box(0);
return v___x_697_;
}
else
{
lean_object* v_val_698_; lean_object* v___x_700_; uint8_t v_isShared_701_; uint8_t v_isSharedCheck_706_; 
v_val_698_ = lean_ctor_get(v___x_696_, 0);
v_isSharedCheck_706_ = !lean_is_exclusive(v___x_696_);
if (v_isSharedCheck_706_ == 0)
{
v___x_700_ = v___x_696_;
v_isShared_701_ = v_isSharedCheck_706_;
goto v_resetjp_699_;
}
else
{
lean_inc(v_val_698_);
lean_dec(v___x_696_);
v___x_700_ = lean_box(0);
v_isShared_701_ = v_isSharedCheck_706_;
goto v_resetjp_699_;
}
v_resetjp_699_:
{
lean_object* v___x_702_; lean_object* v___x_704_; 
v___x_702_ = l_CallbackSubtypes_makeMixedClosure___redArg(v_val_698_);
lean_dec(v_val_698_);
if (v_isShared_701_ == 0)
{
lean_ctor_set(v___x_700_, 0, v___x_702_);
v___x_704_ = v___x_700_;
goto v_reusejp_703_;
}
else
{
lean_object* v_reuseFailAlloc_705_; 
v_reuseFailAlloc_705_ = lean_alloc_ctor(1, 1, 0);
lean_ctor_set(v_reuseFailAlloc_705_, 0, v___x_702_);
v___x_704_ = v_reuseFailAlloc_705_;
goto v_reusejp_703_;
}
v_reusejp_703_:
{
return v___x_704_;
}
}
}
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNative730462696d8af341_export5___lam__0___boxed(lean_object* v___bridgeCallbackResult__0_707_, lean_object* v___bridgeCallbackResult__1_708_){
_start:
{
lean_object* v_res_709_; 
v_res_709_ = l_LeanBridgeNative730462696d8af341_export5___lam__0(v___bridgeCallbackResult__0_707_, v___bridgeCallbackResult__1_708_);
lean_dec(v___bridgeCallbackResult__0_707_);
return v_res_709_;
}
}
static lean_object* _init_l_LeanBridgeNative730462696d8af341_export5___closed__0(void){
_start:
{
lean_object* v___x_710_; lean_object* v___x_711_; 
v___x_710_ = lean_box(0);
v___x_711_ = l_LeanBridgeNative730462696d8af341_carrierResult___redArg(v___x_710_);
return v___x_711_;
}
}
static lean_object* _init_l_LeanBridgeNative730462696d8af341_export5___closed__3(void){
_start:
{
lean_object* v___x_715_; lean_object* v___x_716_; 
v___x_715_ = ((lean_object*)(l_LeanBridgeNative730462696d8af341_export5___closed__2));
v___x_716_ = l_LeanBridgeNative730462696d8af341_carrierResult___redArg(v___x_715_);
return v___x_716_;
}
}
LEAN_EXPORT lean_object* lean_bridge_36fd9c74c3921bfb2ead3644_lean(lean_object* v_a0_717_){
  fputs("LB_CALLBACK_ENTRY_V1 enter adapter CallbackSubtypes.makeMixedClosure:lean\n", stderr);

_start:
{
lean_object* v___x_718_; 
v___x_718_ = l_LeanBridgeNative730462696d8af341_carrierValue___redArg(v_a0_717_);
lean_dec_ref(v_a0_717_);
if (lean_obj_tag(v___x_718_) == 0)
{
lean_object* v___x_719_; 
v___x_719_ = lean_obj_once(&l_LeanBridgeNative730462696d8af341_export5___closed__0, &l_LeanBridgeNative730462696d8af341_export5___closed__0_once, _init_l_LeanBridgeNative730462696d8af341_export5___closed__0);
return v___x_719_;
}
else
{
lean_object* v___x_720_; 
lean_dec_ref_known(v___x_718_, 1);
v___x_720_ = lean_obj_once(&l_LeanBridgeNative730462696d8af341_export5___closed__3, &l_LeanBridgeNative730462696d8af341_export5___closed__3_once, _init_l_LeanBridgeNative730462696d8af341_export5___closed__3);
return v___x_720_;
}
}
}
lean_object* initialize_Init(uint8_t builtin);
lean_object* initialize_Init(uint8_t builtin);
lean_object* initialize_CallbackSubtypes(uint8_t builtin);
static bool _G_initialized = false;
LEAN_EXPORT lean_object* initialize_LeanBridgeNative730462696d8af341(uint8_t builtin) {
lean_object * res;
if (_G_initialized) return lean_io_result_mk_ok(lean_box(0));
_G_initialized = true;
res = initialize_Init(builtin);
if (lean_io_result_is_error(res)) return res;
lean_dec_ref(res);
res = initialize_Init(builtin);
if (lean_io_result_is_error(res)) return res;
lean_dec_ref(res);
res = initialize_CallbackSubtypes(builtin);
if (lean_io_result_is_error(res)) return res;
lean_dec_ref(res);
return lean_io_result_mk_ok(lean_box(0));
}
#ifdef __cplusplus
}
#endif

#include "component.h"
