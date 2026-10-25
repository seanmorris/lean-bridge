// Lean compiler output
// Module: LeanBridgeNative597c05ce6432c0d3
// Imports: public import Init public meta import Init public import RecursiveSubtypes
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
lean_object* lb_recursive_subtype_probe_constructor_plusOne(lean_object*);
lean_object* lean_mk_empty_array_with_capacity(lean_object*);
lean_object* lean_nat_sub(lean_object*, lean_object*);
lean_object* lean_array_push(lean_object*, lean_object*);
uint8_t lean_usize_dec_lt(size_t, size_t);
lean_object* lean_array_uget_borrowed(lean_object*, size_t);
size_t lean_usize_add(size_t, size_t);
lean_object* lb_recursive_subtype_probe_source_first(lean_object*);
lean_object* lean_array_uget(lean_object*, size_t);
lean_object* lean_array_uset(lean_object*, size_t, lean_object*);
size_t lean_array_size(lean_object*);
size_t lean_usize_of_nat(lean_object*);
uint8_t lean_usize_dec_eq(size_t, size_t);
lean_object* lb_recursive_subtype_probe_source_echoGroups(lean_object*);
lean_object* l_Array_extract___redArg(lean_object*, lean_object*, lean_object*);
lean_object* lb_recursive_subtype_probe_source_groups(lean_object*);
lean_object* lb_recursive_subtype_probe_source_echo(lean_object*);
lean_object* lb_recursive_subtype_probe_source_produce(lean_object*);
lean_object* lb_recursive_subtype_probe_constructor_plusTwo(lean_object*);
lean_object* lb_recursive_subtype_probe_source_second(lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNative597c05ce6432c0d3_LbErased_RecursiveSubtypes_Chain_ctorIdx(lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNative597c05ce6432c0d3_LbErased_RecursiveSubtypes_Chain_ctorIdx___boxed(lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNative597c05ce6432c0d3_LbErased_RecursiveSubtypes_Chain_ctorElim___redArg(lean_object*, lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNative597c05ce6432c0d3_LbErased_RecursiveSubtypes_Chain_ctorElim(lean_object*, lean_object*, lean_object*, lean_object*, lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNative597c05ce6432c0d3_LbErased_RecursiveSubtypes_Chain_ctorElim___boxed(lean_object*, lean_object*, lean_object*, lean_object*, lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNative597c05ce6432c0d3_LbErased_RecursiveSubtypes_Chain_empty_elim___redArg(lean_object*, lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNative597c05ce6432c0d3_LbErased_RecursiveSubtypes_Chain_empty_elim(lean_object*, lean_object*, lean_object*, lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNative597c05ce6432c0d3_LbErased_RecursiveSubtypes_Chain_node_elim___redArg(lean_object*, lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNative597c05ce6432c0d3_LbErased_RecursiveSubtypes_Chain_node_elim(lean_object*, lean_object*, lean_object*, lean_object*);
static const lean_ctor_object l_LeanBridgeNative597c05ce6432c0d3_LbErased_RecursiveSubtypes_Chain_via__2cb331aa51ddb668a8dff8336edd9916ab7be0f0ecaed898ae8a3eb5d32f1e81___closed__0_value = {.m_header = {.m_rc = 0, .m_cs_sz = sizeof(lean_ctor_object) + sizeof(void*)*1 + 0, .m_other = 1, .m_tag = 1}, .m_objs = {((lean_object*)(((size_t)(0) << 1) | 1))}};
static const lean_object* l_LeanBridgeNative597c05ce6432c0d3_LbErased_RecursiveSubtypes_Chain_via__2cb331aa51ddb668a8dff8336edd9916ab7be0f0ecaed898ae8a3eb5d32f1e81___closed__0 = (const lean_object*)&l_LeanBridgeNative597c05ce6432c0d3_LbErased_RecursiveSubtypes_Chain_via__2cb331aa51ddb668a8dff8336edd9916ab7be0f0ecaed898ae8a3eb5d32f1e81___closed__0_value;
LEAN_EXPORT lean_object* l_LeanBridgeNative597c05ce6432c0d3_LbErased_RecursiveSubtypes_Chain_via__2cb331aa51ddb668a8dff8336edd9916ab7be0f0ecaed898ae8a3eb5d32f1e81(lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNative597c05ce6432c0d3_LbErased_RecursiveSubtypes_Chain_via__b0a9989b03a240ff1df500f95717b8fa3424b6f89cf1f6bdd2410fb902067a89(lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNative597c05ce6432c0d3_LbErased_RecursiveSubtypes_Chain_erase(lean_object*);
LEAN_EXPORT uint8_t l_LeanBridgeNative597c05ce6432c0d3_LbErased_RecursiveSubtypes_Chain_validFin(lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNative597c05ce6432c0d3_LbErased_RecursiveSubtypes_Chain_validFin___boxed(lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNative597c05ce6432c0d3_carrierValue___redArg(lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNative597c05ce6432c0d3_carrierValue___redArg___boxed(lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNative597c05ce6432c0d3_carrierValue(lean_object*, lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNative597c05ce6432c0d3_carrierValue___boxed(lean_object*, lean_object*);
static const lean_array_object l_LeanBridgeNative597c05ce6432c0d3_carrierResult___redArg___closed__0_value = {.m_header = {.m_rc = 0, .m_cs_sz = sizeof(lean_array_object) + sizeof(void*)*0, .m_other = 0, .m_tag = 246}, .m_size = 0, .m_capacity = 0, .m_data = {}};
static const lean_object* l_LeanBridgeNative597c05ce6432c0d3_carrierResult___redArg___closed__0 = (const lean_object*)&l_LeanBridgeNative597c05ce6432c0d3_carrierResult___redArg___closed__0_value;
LEAN_EXPORT lean_object* l_LeanBridgeNative597c05ce6432c0d3_carrierResult___redArg(lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNative597c05ce6432c0d3_carrierResult(lean_object*, lean_object*);
static const lean_ctor_object l___private_Init_Data_Array_Basic_0__Array_forIn_x27Unsafe_loop___at___00LeanBridgeNative597c05ce6432c0d3_carrierCollect_spec__0___redArg___closed__0_value = {.m_header = {.m_rc = 0, .m_cs_sz = sizeof(lean_ctor_object) + sizeof(void*)*1 + 0, .m_other = 1, .m_tag = 1}, .m_objs = {((lean_object*)(((size_t)(0) << 1) | 1))}};
static const lean_object* l___private_Init_Data_Array_Basic_0__Array_forIn_x27Unsafe_loop___at___00LeanBridgeNative597c05ce6432c0d3_carrierCollect_spec__0___redArg___closed__0 = (const lean_object*)&l___private_Init_Data_Array_Basic_0__Array_forIn_x27Unsafe_loop___at___00LeanBridgeNative597c05ce6432c0d3_carrierCollect_spec__0___redArg___closed__0_value;
LEAN_EXPORT lean_object* l___private_Init_Data_Array_Basic_0__Array_forIn_x27Unsafe_loop___at___00LeanBridgeNative597c05ce6432c0d3_carrierCollect_spec__0___redArg(lean_object*, size_t, size_t, lean_object*);
LEAN_EXPORT lean_object* l___private_Init_Data_Array_Basic_0__Array_forIn_x27Unsafe_loop___at___00LeanBridgeNative597c05ce6432c0d3_carrierCollect_spec__0___redArg___boxed(lean_object*, lean_object*, lean_object*, lean_object*);
static const lean_ctor_object l_LeanBridgeNative597c05ce6432c0d3_carrierCollect___redArg___closed__0_value = {.m_header = {.m_rc = 0, .m_cs_sz = sizeof(lean_ctor_object) + sizeof(void*)*2 + 0, .m_other = 2, .m_tag = 0}, .m_objs = {((lean_object*)(((size_t)(0) << 1) | 1)),((lean_object*)&l_LeanBridgeNative597c05ce6432c0d3_carrierResult___redArg___closed__0_value)}};
static const lean_object* l_LeanBridgeNative597c05ce6432c0d3_carrierCollect___redArg___closed__0 = (const lean_object*)&l_LeanBridgeNative597c05ce6432c0d3_carrierCollect___redArg___closed__0_value;
LEAN_EXPORT lean_object* l_LeanBridgeNative597c05ce6432c0d3_carrierCollect___redArg(lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNative597c05ce6432c0d3_carrierCollect___redArg___boxed(lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNative597c05ce6432c0d3_carrierCollect(lean_object*, lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNative597c05ce6432c0d3_carrierCollect___boxed(lean_object*, lean_object*);
LEAN_EXPORT lean_object* l___private_Init_Data_Array_Basic_0__Array_forIn_x27Unsafe_loop___at___00LeanBridgeNative597c05ce6432c0d3_carrierCollect_spec__0(lean_object*, lean_object*, size_t, size_t, lean_object*);
LEAN_EXPORT lean_object* l___private_Init_Data_Array_Basic_0__Array_forIn_x27Unsafe_loop___at___00LeanBridgeNative597c05ce6432c0d3_carrierCollect_spec__0___boxed(lean_object*, lean_object*, lean_object*, lean_object*, lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNative597c05ce6432c0d3_carrierListItems_loop___redArg(lean_object*, lean_object*, lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNative597c05ce6432c0d3_carrierListItems_loop(lean_object*, lean_object*, lean_object*, lean_object*);
static const lean_array_object l_LeanBridgeNative597c05ce6432c0d3_carrierListItems___redArg___closed__0_value = {.m_header = {.m_rc = 0, .m_cs_sz = sizeof(lean_array_object) + sizeof(void*)*0, .m_other = 0, .m_tag = 246}, .m_size = 0, .m_capacity = 0, .m_data = {}};
static const lean_object* l_LeanBridgeNative597c05ce6432c0d3_carrierListItems___redArg___closed__0 = (const lean_object*)&l_LeanBridgeNative597c05ce6432c0d3_carrierListItems___redArg___closed__0_value;
LEAN_EXPORT lean_object* l_LeanBridgeNative597c05ce6432c0d3_carrierListItems___redArg(lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNative597c05ce6432c0d3_carrierListItems(lean_object*, lean_object*);
LEAN_EXPORT uint32_t lean_bridge_890e535d855edd42581629d4_recursive_d0f96c6a61c5999d6261_branch(lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNative597c05ce6432c0d3_branchd0f96c6a61c5999d6261___boxed(lean_object*);
static const lean_ctor_object l_LeanBridgeNative597c05ce6432c0d3_make0d0f96c6a61c5999d6261___closed__0_value = {.m_header = {.m_rc = 0, .m_cs_sz = sizeof(lean_ctor_object) + sizeof(void*)*1 + 0, .m_other = 1, .m_tag = 1}, .m_objs = {((lean_object*)(((size_t)(0) << 1) | 1))}};
static const lean_object* l_LeanBridgeNative597c05ce6432c0d3_make0d0f96c6a61c5999d6261___closed__0 = (const lean_object*)&l_LeanBridgeNative597c05ce6432c0d3_make0d0f96c6a61c5999d6261___closed__0_value;
static lean_once_cell_t l_LeanBridgeNative597c05ce6432c0d3_make0d0f96c6a61c5999d6261___closed__1_once = LEAN_ONCE_CELL_INITIALIZER;
static lean_object* l_LeanBridgeNative597c05ce6432c0d3_make0d0f96c6a61c5999d6261___closed__1;
LEAN_EXPORT lean_object* lean_bridge_890e535d855edd42581629d4_recursive_d0f96c6a61c5999d6261_make0(lean_object*);
static lean_once_cell_t l_LeanBridgeNative597c05ce6432c0d3_make1d0f96c6a61c5999d6261___closed__0_once = LEAN_ONCE_CELL_INITIALIZER;
static lean_object* l_LeanBridgeNative597c05ce6432c0d3_make1d0f96c6a61c5999d6261___closed__0;
LEAN_EXPORT lean_object* lean_bridge_890e535d855edd42581629d4_recursive_d0f96c6a61c5999d6261_make1(lean_object*, lean_object*, lean_object*);
static lean_once_cell_t l_LeanBridgeNative597c05ce6432c0d3_case1__field0d0f96c6a61c5999d6261___closed__0_once = LEAN_ONCE_CELL_INITIALIZER;
static lean_object* l_LeanBridgeNative597c05ce6432c0d3_case1__field0d0f96c6a61c5999d6261___closed__0;
LEAN_EXPORT lean_object* lean_bridge_890e535d855edd42581629d4_recursive_d0f96c6a61c5999d6261_case1_field0(lean_object*);
LEAN_EXPORT lean_object* lean_bridge_890e535d855edd42581629d4_recursive_d0f96c6a61c5999d6261_case1_field1(lean_object*);
LEAN_EXPORT lean_object* lean_bridge_890e535d855edd42581629d4_recursive_d0f96c6a61c5999d6261_case1_field2(lean_object*);
LEAN_EXPORT lean_object* lean_bridge_890e535d855edd42581629d4_recursive_7150ee578fdad1fd4810_make(lean_object*);
LEAN_EXPORT lean_object* l___private_Init_Data_Array_Basic_0__Array_mapMUnsafe_map___at___00LeanBridgeNative597c05ce6432c0d3_items7150ee578fdad1fd4810_spec__0(size_t, size_t, lean_object*);
LEAN_EXPORT lean_object* l___private_Init_Data_Array_Basic_0__Array_mapMUnsafe_map___at___00LeanBridgeNative597c05ce6432c0d3_items7150ee578fdad1fd4810_spec__0___boxed(lean_object*, lean_object*, lean_object*);
static const lean_array_object l_LeanBridgeNative597c05ce6432c0d3_items7150ee578fdad1fd4810___closed__0_value = {.m_header = {.m_rc = 0, .m_cs_sz = sizeof(lean_array_object) + sizeof(void*)*0, .m_other = 0, .m_tag = 246}, .m_size = 0, .m_capacity = 0, .m_data = {}};
static const lean_object* l_LeanBridgeNative597c05ce6432c0d3_items7150ee578fdad1fd4810___closed__0 = (const lean_object*)&l_LeanBridgeNative597c05ce6432c0d3_items7150ee578fdad1fd4810___closed__0_value;
LEAN_EXPORT lean_object* lean_bridge_890e535d855edd42581629d4_recursive_7150ee578fdad1fd4810_items(lean_object*);
LEAN_EXPORT uint32_t lean_bridge_890e535d855edd42581629d4_recursive_670fab78918c40675bdb_branch(lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNative597c05ce6432c0d3_branch670fab78918c40675bdb___boxed(lean_object*);
static const lean_ctor_object l_LeanBridgeNative597c05ce6432c0d3_none670fab78918c40675bdb___closed__0_value = {.m_header = {.m_rc = 0, .m_cs_sz = sizeof(lean_ctor_object) + sizeof(void*)*1 + 0, .m_other = 1, .m_tag = 1}, .m_objs = {((lean_object*)(((size_t)(0) << 1) | 1))}};
static const lean_object* l_LeanBridgeNative597c05ce6432c0d3_none670fab78918c40675bdb___closed__0 = (const lean_object*)&l_LeanBridgeNative597c05ce6432c0d3_none670fab78918c40675bdb___closed__0_value;
static lean_once_cell_t l_LeanBridgeNative597c05ce6432c0d3_none670fab78918c40675bdb___closed__1_once = LEAN_ONCE_CELL_INITIALIZER;
static lean_object* l_LeanBridgeNative597c05ce6432c0d3_none670fab78918c40675bdb___closed__1;
LEAN_EXPORT lean_object* lean_bridge_890e535d855edd42581629d4_recursive_670fab78918c40675bdb_none(lean_object*);
static lean_once_cell_t l_LeanBridgeNative597c05ce6432c0d3_make0670fab78918c40675bdb___closed__0_once = LEAN_ONCE_CELL_INITIALIZER;
static lean_object* l_LeanBridgeNative597c05ce6432c0d3_make0670fab78918c40675bdb___closed__0;
LEAN_EXPORT lean_object* lean_bridge_890e535d855edd42581629d4_recursive_670fab78918c40675bdb_make0(lean_object*);
LEAN_EXPORT lean_object* lean_bridge_890e535d855edd42581629d4_recursive_670fab78918c40675bdb_field0(lean_object*);
LEAN_EXPORT lean_object* lean_bridge_890e535d855edd42581629d4_recursive_83c50e7540f0bfb759d4_make(lean_object*);
LEAN_EXPORT lean_object* lean_bridge_890e535d855edd42581629d4_recursive_83c50e7540f0bfb759d4_field0(lean_object*);
LEAN_EXPORT uint8_t lean_bridge_890e535d855edd42581629d4_fin_guard_0(lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNative597c05ce6432c0d3_export0__fin__guard__0___boxed(lean_object*);
LEAN_EXPORT uint8_t lean_bridge_890e535d855edd42581629d4_refinement_0(lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNative597c05ce6432c0d3_export0__refinement__0___boxed(lean_object*);
LEAN_EXPORT uint8_t lean_bridge_890e535d855edd42581629d4_graph_refinement_0_f47f84e548df9f42ce87(lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNative597c05ce6432c0d3_export0__graph__refinement__0__f47f84e548df9f42ce87___boxed(lean_object*);
LEAN_EXPORT lean_object* lean_bridge_890e535d855edd42581629d4_lean(lean_object*);
LEAN_EXPORT uint8_t l___private_Init_Data_Array_Basic_0__Array_anyMUnsafe_any___at___00LeanBridgeNative597c05ce6432c0d3_export1__fin__guard__0_spec__0(lean_object*, size_t, size_t);
LEAN_EXPORT lean_object* l___private_Init_Data_Array_Basic_0__Array_anyMUnsafe_any___at___00LeanBridgeNative597c05ce6432c0d3_export1__fin__guard__0_spec__0___boxed(lean_object*, lean_object*, lean_object*);
LEAN_EXPORT uint8_t lean_bridge_61edaca9ace2104f41ea6e59_fin_guard_0(lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNative597c05ce6432c0d3_export1__fin__guard__0___boxed(lean_object*);
LEAN_EXPORT lean_object* l___private_Init_Data_Array_Basic_0__Array_mapMUnsafe_map___at___00LeanBridgeNative597c05ce6432c0d3_export1__refinement__0_spec__0(size_t, size_t, lean_object*);
LEAN_EXPORT lean_object* l___private_Init_Data_Array_Basic_0__Array_mapMUnsafe_map___at___00LeanBridgeNative597c05ce6432c0d3_export1__refinement__0_spec__0___boxed(lean_object*, lean_object*, lean_object*);
LEAN_EXPORT uint8_t lean_bridge_61edaca9ace2104f41ea6e59_refinement_0(lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNative597c05ce6432c0d3_export1__refinement__0___boxed(lean_object*);
LEAN_EXPORT uint8_t lean_bridge_61edaca9ace2104f41ea6e59_graph_refinement_0_f47f84e548df9f42ce87(lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNative597c05ce6432c0d3_export1__graph__refinement__0__f47f84e548df9f42ce87___boxed(lean_object*);
LEAN_EXPORT lean_object* l___private_Init_Data_Array_Basic_0__Array_mapMUnsafe_map___at___00LeanBridgeNative597c05ce6432c0d3_export1_spec__0(size_t, size_t, lean_object*);
LEAN_EXPORT lean_object* l___private_Init_Data_Array_Basic_0__Array_mapMUnsafe_map___at___00LeanBridgeNative597c05ce6432c0d3_export1_spec__0___boxed(lean_object*, lean_object*, lean_object*);
static lean_once_cell_t l_LeanBridgeNative597c05ce6432c0d3_export1___closed__0_once = LEAN_ONCE_CELL_INITIALIZER;
static lean_object* l_LeanBridgeNative597c05ce6432c0d3_export1___closed__0;
LEAN_EXPORT lean_object* lean_bridge_61edaca9ace2104f41ea6e59_lean(lean_object*);
LEAN_EXPORT uint8_t lean_bridge_a9ae70188abbca81b8f235ce_fin_guard_0(lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNative597c05ce6432c0d3_export2__fin__guard__0___boxed(lean_object*);
LEAN_EXPORT uint8_t lean_bridge_a9ae70188abbca81b8f235ce_refinement_0(lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNative597c05ce6432c0d3_export2__refinement__0___boxed(lean_object*);
LEAN_EXPORT uint8_t lean_bridge_a9ae70188abbca81b8f235ce_graph_refinement_0_f47f84e548df9f42ce87(lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNative597c05ce6432c0d3_export2__graph__refinement__0__f47f84e548df9f42ce87___boxed(lean_object*);
LEAN_EXPORT lean_object* lean_bridge_a9ae70188abbca81b8f235ce_lean(lean_object*);
LEAN_EXPORT uint8_t lean_bridge_5f9ebf1241c61a39ed1bdebf_fin_guard_0(lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNative597c05ce6432c0d3_export3__fin__guard__0___boxed(lean_object*);
LEAN_EXPORT uint8_t lean_bridge_5f9ebf1241c61a39ed1bdebf_refinement_0(lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNative597c05ce6432c0d3_export3__refinement__0___boxed(lean_object*);
LEAN_EXPORT uint8_t lean_bridge_5f9ebf1241c61a39ed1bdebf_graph_refinement_0_f47f84e548df9f42ce87(lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNative597c05ce6432c0d3_export3__graph__refinement__0__f47f84e548df9f42ce87___boxed(lean_object*);
LEAN_EXPORT lean_object* lean_bridge_5f9ebf1241c61a39ed1bdebf_lean(lean_object*);
LEAN_EXPORT uint8_t lean_bridge_cc48993941d89731cae43d8e_fin_guard_0(lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNative597c05ce6432c0d3_export4__fin__guard__0___boxed(lean_object*);
LEAN_EXPORT lean_object* lean_bridge_cc48993941d89731cae43d8e_lean(lean_object*);
LEAN_EXPORT uint8_t lean_bridge_9e8d2cbaa99dca92eb622921_fin_guard_0(lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNative597c05ce6432c0d3_export5__fin__guard__0___boxed(lean_object*);
LEAN_EXPORT uint8_t lean_bridge_9e8d2cbaa99dca92eb622921_refinement_0(lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNative597c05ce6432c0d3_export5__refinement__0___boxed(lean_object*);
LEAN_EXPORT uint8_t lean_bridge_9e8d2cbaa99dca92eb622921_graph_refinement_0_053cd996a2b855a7fe90(lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNative597c05ce6432c0d3_export5__graph__refinement__0__053cd996a2b855a7fe90___boxed(lean_object*);
LEAN_EXPORT lean_object* lean_bridge_9e8d2cbaa99dca92eb622921_lean(lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNative597c05ce6432c0d3_LbErased_RecursiveSubtypes_Chain_ctorIdx(lean_object* v_x_1_){
_start:
{
if (lean_obj_tag(v_x_1_) == 0)
{
lean_object* v___x_2_; 
v___x_2_ = lean_unsigned_to_nat(0u);
return v___x_2_;
}
else
{
lean_object* v___x_3_; 
v___x_3_ = lean_unsigned_to_nat(1u);
return v___x_3_;
}
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNative597c05ce6432c0d3_LbErased_RecursiveSubtypes_Chain_ctorIdx___boxed(lean_object* v_x_4_){
_start:
{
lean_object* v_res_5_; 
v_res_5_ = l_LeanBridgeNative597c05ce6432c0d3_LbErased_RecursiveSubtypes_Chain_ctorIdx(v_x_4_);
lean_dec(v_x_4_);
return v_res_5_;
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNative597c05ce6432c0d3_LbErased_RecursiveSubtypes_Chain_ctorElim___redArg(lean_object* v_t_6_, lean_object* v_k_7_){
_start:
{
if (lean_obj_tag(v_t_6_) == 0)
{
return v_k_7_;
}
else
{
lean_object* v_a0_8_; lean_object* v_a1_9_; lean_object* v_a2_10_; lean_object* v___x_11_; 
v_a0_8_ = lean_ctor_get(v_t_6_, 0);
lean_inc(v_a0_8_);
v_a1_9_ = lean_ctor_get(v_t_6_, 1);
lean_inc(v_a1_9_);
v_a2_10_ = lean_ctor_get(v_t_6_, 2);
lean_inc(v_a2_10_);
lean_dec_ref_known(v_t_6_, 3);
v___x_11_ = lean_apply_3(v_k_7_, v_a0_8_, v_a1_9_, v_a2_10_);
return v___x_11_;
}
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNative597c05ce6432c0d3_LbErased_RecursiveSubtypes_Chain_ctorElim(lean_object* v_motive_12_, lean_object* v_ctorIdx_13_, lean_object* v_t_14_, lean_object* v_h_15_, lean_object* v_k_16_){
_start:
{
lean_object* v___x_17_; 
v___x_17_ = l_LeanBridgeNative597c05ce6432c0d3_LbErased_RecursiveSubtypes_Chain_ctorElim___redArg(v_t_14_, v_k_16_);
return v___x_17_;
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNative597c05ce6432c0d3_LbErased_RecursiveSubtypes_Chain_ctorElim___boxed(lean_object* v_motive_18_, lean_object* v_ctorIdx_19_, lean_object* v_t_20_, lean_object* v_h_21_, lean_object* v_k_22_){
_start:
{
lean_object* v_res_23_; 
v_res_23_ = l_LeanBridgeNative597c05ce6432c0d3_LbErased_RecursiveSubtypes_Chain_ctorElim(v_motive_18_, v_ctorIdx_19_, v_t_20_, v_h_21_, v_k_22_);
lean_dec(v_ctorIdx_19_);
return v_res_23_;
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNative597c05ce6432c0d3_LbErased_RecursiveSubtypes_Chain_empty_elim___redArg(lean_object* v_t_24_, lean_object* v_empty_25_){
_start:
{
lean_object* v___x_26_; 
v___x_26_ = l_LeanBridgeNative597c05ce6432c0d3_LbErased_RecursiveSubtypes_Chain_ctorElim___redArg(v_t_24_, v_empty_25_);
return v___x_26_;
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNative597c05ce6432c0d3_LbErased_RecursiveSubtypes_Chain_empty_elim(lean_object* v_motive_27_, lean_object* v_t_28_, lean_object* v_h_29_, lean_object* v_empty_30_){
_start:
{
lean_object* v___x_31_; 
v___x_31_ = l_LeanBridgeNative597c05ce6432c0d3_LbErased_RecursiveSubtypes_Chain_ctorElim___redArg(v_t_28_, v_empty_30_);
return v___x_31_;
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNative597c05ce6432c0d3_LbErased_RecursiveSubtypes_Chain_node_elim___redArg(lean_object* v_t_32_, lean_object* v_node_33_){
_start:
{
lean_object* v___x_34_; 
v___x_34_ = l_LeanBridgeNative597c05ce6432c0d3_LbErased_RecursiveSubtypes_Chain_ctorElim___redArg(v_t_32_, v_node_33_);
return v___x_34_;
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNative597c05ce6432c0d3_LbErased_RecursiveSubtypes_Chain_node_elim(lean_object* v_motive_35_, lean_object* v_t_36_, lean_object* v_h_37_, lean_object* v_node_38_){
_start:
{
lean_object* v___x_39_; 
v___x_39_ = l_LeanBridgeNative597c05ce6432c0d3_LbErased_RecursiveSubtypes_Chain_ctorElim___redArg(v_t_36_, v_node_38_);
return v___x_39_;
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNative597c05ce6432c0d3_LbErased_RecursiveSubtypes_Chain_via__2cb331aa51ddb668a8dff8336edd9916ab7be0f0ecaed898ae8a3eb5d32f1e81(lean_object* v_value_42_){
_start:
{
if (lean_obj_tag(v_value_42_) == 0)
{
lean_object* v___x_43_; 
v___x_43_ = ((lean_object*)(l_LeanBridgeNative597c05ce6432c0d3_LbErased_RecursiveSubtypes_Chain_via__2cb331aa51ddb668a8dff8336edd9916ab7be0f0ecaed898ae8a3eb5d32f1e81___closed__0));
return v___x_43_;
}
else
{
lean_object* v_a0_44_; lean_object* v_a1_45_; lean_object* v_a2_46_; lean_object* v___x_48_; uint8_t v_isShared_49_; uint8_t v_isSharedCheck_68_; 
v_a0_44_ = lean_ctor_get(v_value_42_, 0);
v_a1_45_ = lean_ctor_get(v_value_42_, 1);
v_a2_46_ = lean_ctor_get(v_value_42_, 2);
v_isSharedCheck_68_ = !lean_is_exclusive(v_value_42_);
if (v_isSharedCheck_68_ == 0)
{
v___x_48_ = v_value_42_;
v_isShared_49_ = v_isSharedCheck_68_;
goto v_resetjp_47_;
}
else
{
lean_inc(v_a2_46_);
lean_inc(v_a1_45_);
lean_inc(v_a0_44_);
lean_dec(v_value_42_);
v___x_48_ = lean_box(0);
v_isShared_49_ = v_isSharedCheck_68_;
goto v_resetjp_47_;
}
v_resetjp_47_:
{
lean_object* v___x_50_; 
v___x_50_ = lb_recursive_subtype_probe_constructor_plusOne(v_a0_44_);
if (lean_obj_tag(v___x_50_) == 0)
{
lean_object* v___x_51_; 
lean_del_object(v___x_48_);
lean_dec(v_a2_46_);
lean_dec(v_a1_45_);
v___x_51_ = lean_box(0);
return v___x_51_;
}
else
{
lean_object* v_val_52_; lean_object* v___x_53_; uint8_t v___x_54_; 
v_val_52_ = lean_ctor_get(v___x_50_, 0);
lean_inc(v_val_52_);
lean_dec_ref_known(v___x_50_, 1);
v___x_53_ = lean_unsigned_to_nat(3u);
v___x_54_ = lean_nat_dec_lt(v_a1_45_, v___x_53_);
if (v___x_54_ == 0)
{
lean_object* v___x_55_; 
lean_dec(v_val_52_);
lean_del_object(v___x_48_);
lean_dec(v_a2_46_);
lean_dec(v_a1_45_);
v___x_55_ = lean_box(0);
return v___x_55_;
}
else
{
lean_object* v___x_56_; 
v___x_56_ = l_LeanBridgeNative597c05ce6432c0d3_LbErased_RecursiveSubtypes_Chain_via__2cb331aa51ddb668a8dff8336edd9916ab7be0f0ecaed898ae8a3eb5d32f1e81(v_a2_46_);
if (lean_obj_tag(v___x_56_) == 0)
{
lean_dec(v_val_52_);
lean_del_object(v___x_48_);
lean_dec(v_a1_45_);
return v___x_56_;
}
else
{
lean_object* v_val_57_; lean_object* v___x_59_; uint8_t v_isShared_60_; uint8_t v_isSharedCheck_67_; 
v_val_57_ = lean_ctor_get(v___x_56_, 0);
v_isSharedCheck_67_ = !lean_is_exclusive(v___x_56_);
if (v_isSharedCheck_67_ == 0)
{
v___x_59_ = v___x_56_;
v_isShared_60_ = v_isSharedCheck_67_;
goto v_resetjp_58_;
}
else
{
lean_inc(v_val_57_);
lean_dec(v___x_56_);
v___x_59_ = lean_box(0);
v_isShared_60_ = v_isSharedCheck_67_;
goto v_resetjp_58_;
}
v_resetjp_58_:
{
lean_object* v___x_62_; 
if (v_isShared_49_ == 0)
{
lean_ctor_set(v___x_48_, 2, v_val_57_);
lean_ctor_set(v___x_48_, 0, v_val_52_);
v___x_62_ = v___x_48_;
goto v_reusejp_61_;
}
else
{
lean_object* v_reuseFailAlloc_66_; 
v_reuseFailAlloc_66_ = lean_alloc_ctor(1, 3, 0);
lean_ctor_set(v_reuseFailAlloc_66_, 0, v_val_52_);
lean_ctor_set(v_reuseFailAlloc_66_, 1, v_a1_45_);
lean_ctor_set(v_reuseFailAlloc_66_, 2, v_val_57_);
v___x_62_ = v_reuseFailAlloc_66_;
goto v_reusejp_61_;
}
v_reusejp_61_:
{
lean_object* v___x_64_; 
if (v_isShared_60_ == 0)
{
lean_ctor_set(v___x_59_, 0, v___x_62_);
v___x_64_ = v___x_59_;
goto v_reusejp_63_;
}
else
{
lean_object* v_reuseFailAlloc_65_; 
v_reuseFailAlloc_65_ = lean_alloc_ctor(1, 1, 0);
lean_ctor_set(v_reuseFailAlloc_65_, 0, v___x_62_);
v___x_64_ = v_reuseFailAlloc_65_;
goto v_reusejp_63_;
}
v_reusejp_63_:
{
return v___x_64_;
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
LEAN_EXPORT lean_object* l_LeanBridgeNative597c05ce6432c0d3_LbErased_RecursiveSubtypes_Chain_via__b0a9989b03a240ff1df500f95717b8fa3424b6f89cf1f6bdd2410fb902067a89(lean_object* v_value_69_){
_start:
{
if (lean_obj_tag(v_value_69_) == 0)
{
lean_object* v___x_70_; 
v___x_70_ = ((lean_object*)(l_LeanBridgeNative597c05ce6432c0d3_LbErased_RecursiveSubtypes_Chain_via__2cb331aa51ddb668a8dff8336edd9916ab7be0f0ecaed898ae8a3eb5d32f1e81___closed__0));
return v___x_70_;
}
else
{
lean_object* v_a0_71_; lean_object* v_a1_72_; lean_object* v_a2_73_; lean_object* v___x_75_; uint8_t v_isShared_76_; uint8_t v_isSharedCheck_95_; 
v_a0_71_ = lean_ctor_get(v_value_69_, 0);
v_a1_72_ = lean_ctor_get(v_value_69_, 1);
v_a2_73_ = lean_ctor_get(v_value_69_, 2);
v_isSharedCheck_95_ = !lean_is_exclusive(v_value_69_);
if (v_isSharedCheck_95_ == 0)
{
v___x_75_ = v_value_69_;
v_isShared_76_ = v_isSharedCheck_95_;
goto v_resetjp_74_;
}
else
{
lean_inc(v_a2_73_);
lean_inc(v_a1_72_);
lean_inc(v_a0_71_);
lean_dec(v_value_69_);
v___x_75_ = lean_box(0);
v_isShared_76_ = v_isSharedCheck_95_;
goto v_resetjp_74_;
}
v_resetjp_74_:
{
lean_object* v___x_77_; 
v___x_77_ = lb_recursive_subtype_probe_constructor_plusTwo(v_a0_71_);
if (lean_obj_tag(v___x_77_) == 0)
{
lean_object* v___x_78_; 
lean_del_object(v___x_75_);
lean_dec(v_a2_73_);
lean_dec(v_a1_72_);
v___x_78_ = lean_box(0);
return v___x_78_;
}
else
{
lean_object* v_val_79_; lean_object* v___x_80_; uint8_t v___x_81_; 
v_val_79_ = lean_ctor_get(v___x_77_, 0);
lean_inc(v_val_79_);
lean_dec_ref_known(v___x_77_, 1);
v___x_80_ = lean_unsigned_to_nat(3u);
v___x_81_ = lean_nat_dec_lt(v_a1_72_, v___x_80_);
if (v___x_81_ == 0)
{
lean_object* v___x_82_; 
lean_dec(v_val_79_);
lean_del_object(v___x_75_);
lean_dec(v_a2_73_);
lean_dec(v_a1_72_);
v___x_82_ = lean_box(0);
return v___x_82_;
}
else
{
lean_object* v___x_83_; 
v___x_83_ = l_LeanBridgeNative597c05ce6432c0d3_LbErased_RecursiveSubtypes_Chain_via__b0a9989b03a240ff1df500f95717b8fa3424b6f89cf1f6bdd2410fb902067a89(v_a2_73_);
if (lean_obj_tag(v___x_83_) == 0)
{
lean_dec(v_val_79_);
lean_del_object(v___x_75_);
lean_dec(v_a1_72_);
return v___x_83_;
}
else
{
lean_object* v_val_84_; lean_object* v___x_86_; uint8_t v_isShared_87_; uint8_t v_isSharedCheck_94_; 
v_val_84_ = lean_ctor_get(v___x_83_, 0);
v_isSharedCheck_94_ = !lean_is_exclusive(v___x_83_);
if (v_isSharedCheck_94_ == 0)
{
v___x_86_ = v___x_83_;
v_isShared_87_ = v_isSharedCheck_94_;
goto v_resetjp_85_;
}
else
{
lean_inc(v_val_84_);
lean_dec(v___x_83_);
v___x_86_ = lean_box(0);
v_isShared_87_ = v_isSharedCheck_94_;
goto v_resetjp_85_;
}
v_resetjp_85_:
{
lean_object* v___x_89_; 
if (v_isShared_76_ == 0)
{
lean_ctor_set(v___x_75_, 2, v_val_84_);
lean_ctor_set(v___x_75_, 0, v_val_79_);
v___x_89_ = v___x_75_;
goto v_reusejp_88_;
}
else
{
lean_object* v_reuseFailAlloc_93_; 
v_reuseFailAlloc_93_ = lean_alloc_ctor(1, 3, 0);
lean_ctor_set(v_reuseFailAlloc_93_, 0, v_val_79_);
lean_ctor_set(v_reuseFailAlloc_93_, 1, v_a1_72_);
lean_ctor_set(v_reuseFailAlloc_93_, 2, v_val_84_);
v___x_89_ = v_reuseFailAlloc_93_;
goto v_reusejp_88_;
}
v_reusejp_88_:
{
lean_object* v___x_91_; 
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
}
}
}
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNative597c05ce6432c0d3_LbErased_RecursiveSubtypes_Chain_erase(lean_object* v_value_96_){
_start:
{
if (lean_obj_tag(v_value_96_) == 0)
{
lean_object* v___x_97_; 
v___x_97_ = lean_box(0);
return v___x_97_;
}
else
{
lean_object* v_value_98_; lean_object* v_digit_99_; lean_object* v_tail_100_; lean_object* v___x_102_; uint8_t v_isShared_103_; uint8_t v_isSharedCheck_108_; 
v_value_98_ = lean_ctor_get(v_value_96_, 0);
v_digit_99_ = lean_ctor_get(v_value_96_, 1);
v_tail_100_ = lean_ctor_get(v_value_96_, 2);
v_isSharedCheck_108_ = !lean_is_exclusive(v_value_96_);
if (v_isSharedCheck_108_ == 0)
{
v___x_102_ = v_value_96_;
v_isShared_103_ = v_isSharedCheck_108_;
goto v_resetjp_101_;
}
else
{
lean_inc(v_tail_100_);
lean_inc(v_digit_99_);
lean_inc(v_value_98_);
lean_dec(v_value_96_);
v___x_102_ = lean_box(0);
v_isShared_103_ = v_isSharedCheck_108_;
goto v_resetjp_101_;
}
v_resetjp_101_:
{
lean_object* v___x_104_; lean_object* v___x_106_; 
v___x_104_ = l_LeanBridgeNative597c05ce6432c0d3_LbErased_RecursiveSubtypes_Chain_erase(v_tail_100_);
if (v_isShared_103_ == 0)
{
lean_ctor_set(v___x_102_, 2, v___x_104_);
v___x_106_ = v___x_102_;
goto v_reusejp_105_;
}
else
{
lean_object* v_reuseFailAlloc_107_; 
v_reuseFailAlloc_107_ = lean_alloc_ctor(1, 3, 0);
lean_ctor_set(v_reuseFailAlloc_107_, 0, v_value_98_);
lean_ctor_set(v_reuseFailAlloc_107_, 1, v_digit_99_);
lean_ctor_set(v_reuseFailAlloc_107_, 2, v___x_104_);
v___x_106_ = v_reuseFailAlloc_107_;
goto v_reusejp_105_;
}
v_reusejp_105_:
{
return v___x_106_;
}
}
}
}
}
LEAN_EXPORT uint8_t l_LeanBridgeNative597c05ce6432c0d3_LbErased_RecursiveSubtypes_Chain_validFin(lean_object* v_value_109_){
_start:
{
if (lean_obj_tag(v_value_109_) == 0)
{
uint8_t v___x_110_; 
v___x_110_ = 1;
return v___x_110_;
}
else
{
lean_object* v_a1_111_; lean_object* v_a2_112_; lean_object* v___x_113_; uint8_t v___x_114_; 
v_a1_111_ = lean_ctor_get(v_value_109_, 1);
v_a2_112_ = lean_ctor_get(v_value_109_, 2);
v___x_113_ = lean_unsigned_to_nat(3u);
v___x_114_ = lean_nat_dec_lt(v_a1_111_, v___x_113_);
if (v___x_114_ == 0)
{
return v___x_114_;
}
else
{
v_value_109_ = v_a2_112_;
goto _start;
}
}
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNative597c05ce6432c0d3_LbErased_RecursiveSubtypes_Chain_validFin___boxed(lean_object* v_value_116_){
_start:
{
uint8_t v_res_117_; lean_object* v_r_118_; 
v_res_117_ = l_LeanBridgeNative597c05ce6432c0d3_LbErased_RecursiveSubtypes_Chain_validFin(v_value_116_);
lean_dec(v_value_116_);
v_r_118_ = lean_box(v_res_117_);
return v_r_118_;
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNative597c05ce6432c0d3_carrierValue___redArg(lean_object* v_value_119_){
_start:
{
lean_object* v___x_120_; lean_object* v___x_121_; uint8_t v___x_122_; 
v___x_120_ = lean_unsigned_to_nat(0u);
v___x_121_ = lean_array_get_size(v_value_119_);
v___x_122_ = lean_nat_dec_lt(v___x_120_, v___x_121_);
if (v___x_122_ == 0)
{
lean_object* v___x_123_; 
v___x_123_ = lean_box(0);
return v___x_123_;
}
else
{
lean_object* v___x_124_; uint8_t v___x_125_; 
v___x_124_ = lean_unsigned_to_nat(1u);
v___x_125_ = lean_nat_dec_eq(v___x_121_, v___x_124_);
if (v___x_125_ == 0)
{
lean_object* v___x_126_; 
v___x_126_ = lean_box(0);
return v___x_126_;
}
else
{
lean_object* v___x_127_; lean_object* v___x_128_; 
v___x_127_ = lean_array_fget_borrowed(v_value_119_, v___x_120_);
lean_inc(v___x_127_);
v___x_128_ = lean_alloc_ctor(1, 1, 0);
lean_ctor_set(v___x_128_, 0, v___x_127_);
return v___x_128_;
}
}
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNative597c05ce6432c0d3_carrierValue___redArg___boxed(lean_object* v_value_129_){
_start:
{
lean_object* v_res_130_; 
v_res_130_ = l_LeanBridgeNative597c05ce6432c0d3_carrierValue___redArg(v_value_129_);
lean_dec_ref(v_value_129_);
return v_res_130_;
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNative597c05ce6432c0d3_carrierValue(lean_object* v_00_u03b1_131_, lean_object* v_value_132_){
_start:
{
lean_object* v___x_133_; 
v___x_133_ = l_LeanBridgeNative597c05ce6432c0d3_carrierValue___redArg(v_value_132_);
return v___x_133_;
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNative597c05ce6432c0d3_carrierValue___boxed(lean_object* v_00_u03b1_134_, lean_object* v_value_135_){
_start:
{
lean_object* v_res_136_; 
v_res_136_ = l_LeanBridgeNative597c05ce6432c0d3_carrierValue(v_00_u03b1_134_, v_value_135_);
lean_dec_ref(v_value_135_);
return v_res_136_;
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNative597c05ce6432c0d3_carrierResult___redArg(lean_object* v_value_139_){
_start:
{
if (lean_obj_tag(v_value_139_) == 0)
{
lean_object* v___x_140_; 
v___x_140_ = ((lean_object*)(l_LeanBridgeNative597c05ce6432c0d3_carrierResult___redArg___closed__0));
return v___x_140_;
}
else
{
lean_object* v_val_141_; lean_object* v___x_142_; lean_object* v___x_143_; lean_object* v___x_144_; 
v_val_141_ = lean_ctor_get(v_value_139_, 0);
lean_inc(v_val_141_);
lean_dec_ref_known(v_value_139_, 1);
v___x_142_ = lean_unsigned_to_nat(1u);
v___x_143_ = lean_mk_empty_array_with_capacity(v___x_142_);
v___x_144_ = lean_array_push(v___x_143_, v_val_141_);
return v___x_144_;
}
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNative597c05ce6432c0d3_carrierResult(lean_object* v_00_u03b1_145_, lean_object* v_value_146_){
_start:
{
lean_object* v___x_147_; 
v___x_147_ = l_LeanBridgeNative597c05ce6432c0d3_carrierResult___redArg(v_value_146_);
return v___x_147_;
}
}
LEAN_EXPORT lean_object* l___private_Init_Data_Array_Basic_0__Array_forIn_x27Unsafe_loop___at___00LeanBridgeNative597c05ce6432c0d3_carrierCollect_spec__0___redArg(lean_object* v_as_150_, size_t v_sz_151_, size_t v_i_152_, lean_object* v_b_153_){
_start:
{
uint8_t v___x_154_; 
v___x_154_ = lean_usize_dec_lt(v_i_152_, v_sz_151_);
if (v___x_154_ == 0)
{
return v_b_153_;
}
else
{
lean_object* v_snd_155_; lean_object* v___x_157_; uint8_t v_isShared_158_; uint8_t v_isSharedCheck_174_; 
v_snd_155_ = lean_ctor_get(v_b_153_, 1);
v_isSharedCheck_174_ = !lean_is_exclusive(v_b_153_);
if (v_isSharedCheck_174_ == 0)
{
lean_object* v_unused_175_; 
v_unused_175_ = lean_ctor_get(v_b_153_, 0);
lean_dec(v_unused_175_);
v___x_157_ = v_b_153_;
v_isShared_158_ = v_isSharedCheck_174_;
goto v_resetjp_156_;
}
else
{
lean_inc(v_snd_155_);
lean_dec(v_b_153_);
v___x_157_ = lean_box(0);
v_isShared_158_ = v_isSharedCheck_174_;
goto v_resetjp_156_;
}
v_resetjp_156_:
{
lean_object* v_a_159_; lean_object* v___x_160_; 
v_a_159_ = lean_array_uget_borrowed(v_as_150_, v_i_152_);
v___x_160_ = l_LeanBridgeNative597c05ce6432c0d3_carrierValue___redArg(v_a_159_);
if (lean_obj_tag(v___x_160_) == 0)
{
lean_object* v___x_161_; lean_object* v___x_163_; 
v___x_161_ = ((lean_object*)(l___private_Init_Data_Array_Basic_0__Array_forIn_x27Unsafe_loop___at___00LeanBridgeNative597c05ce6432c0d3_carrierCollect_spec__0___redArg___closed__0));
if (v_isShared_158_ == 0)
{
lean_ctor_set(v___x_157_, 0, v___x_161_);
v___x_163_ = v___x_157_;
goto v_reusejp_162_;
}
else
{
lean_object* v_reuseFailAlloc_164_; 
v_reuseFailAlloc_164_ = lean_alloc_ctor(0, 2, 0);
lean_ctor_set(v_reuseFailAlloc_164_, 0, v___x_161_);
lean_ctor_set(v_reuseFailAlloc_164_, 1, v_snd_155_);
v___x_163_ = v_reuseFailAlloc_164_;
goto v_reusejp_162_;
}
v_reusejp_162_:
{
return v___x_163_;
}
}
else
{
lean_object* v_val_165_; lean_object* v___x_166_; lean_object* v___x_167_; lean_object* v___x_169_; 
v_val_165_ = lean_ctor_get(v___x_160_, 0);
lean_inc(v_val_165_);
lean_dec_ref_known(v___x_160_, 1);
v___x_166_ = lean_box(0);
v___x_167_ = lean_array_push(v_snd_155_, v_val_165_);
if (v_isShared_158_ == 0)
{
lean_ctor_set(v___x_157_, 1, v___x_167_);
lean_ctor_set(v___x_157_, 0, v___x_166_);
v___x_169_ = v___x_157_;
goto v_reusejp_168_;
}
else
{
lean_object* v_reuseFailAlloc_173_; 
v_reuseFailAlloc_173_ = lean_alloc_ctor(0, 2, 0);
lean_ctor_set(v_reuseFailAlloc_173_, 0, v___x_166_);
lean_ctor_set(v_reuseFailAlloc_173_, 1, v___x_167_);
v___x_169_ = v_reuseFailAlloc_173_;
goto v_reusejp_168_;
}
v_reusejp_168_:
{
size_t v___x_170_; size_t v___x_171_; 
v___x_170_ = ((size_t)1ULL);
v___x_171_ = lean_usize_add(v_i_152_, v___x_170_);
v_i_152_ = v___x_171_;
v_b_153_ = v___x_169_;
goto _start;
}
}
}
}
}
}
LEAN_EXPORT lean_object* l___private_Init_Data_Array_Basic_0__Array_forIn_x27Unsafe_loop___at___00LeanBridgeNative597c05ce6432c0d3_carrierCollect_spec__0___redArg___boxed(lean_object* v_as_176_, lean_object* v_sz_177_, lean_object* v_i_178_, lean_object* v_b_179_){
_start:
{
size_t v_sz_boxed_180_; size_t v_i_boxed_181_; lean_object* v_res_182_; 
v_sz_boxed_180_ = lean_unbox_usize(v_sz_177_);
lean_dec(v_sz_177_);
v_i_boxed_181_ = lean_unbox_usize(v_i_178_);
lean_dec(v_i_178_);
v_res_182_ = l___private_Init_Data_Array_Basic_0__Array_forIn_x27Unsafe_loop___at___00LeanBridgeNative597c05ce6432c0d3_carrierCollect_spec__0___redArg(v_as_176_, v_sz_boxed_180_, v_i_boxed_181_, v_b_179_);
lean_dec_ref(v_as_176_);
return v_res_182_;
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNative597c05ce6432c0d3_carrierCollect___redArg(lean_object* v_values_186_){
_start:
{
lean_object* v___x_187_; lean_object* v___x_188_; uint8_t v___x_189_; 
v___x_187_ = lean_unsigned_to_nat(262144u);
v___x_188_ = lean_array_get_size(v_values_186_);
v___x_189_ = lean_nat_dec_lt(v___x_187_, v___x_188_);
if (v___x_189_ == 0)
{
lean_object* v___x_190_; size_t v_sz_191_; size_t v___x_192_; lean_object* v___x_193_; lean_object* v_fst_194_; 
v___x_190_ = ((lean_object*)(l_LeanBridgeNative597c05ce6432c0d3_carrierCollect___redArg___closed__0));
v_sz_191_ = lean_array_size(v_values_186_);
v___x_192_ = ((size_t)0ULL);
v___x_193_ = l___private_Init_Data_Array_Basic_0__Array_forIn_x27Unsafe_loop___at___00LeanBridgeNative597c05ce6432c0d3_carrierCollect_spec__0___redArg(v_values_186_, v_sz_191_, v___x_192_, v___x_190_);
v_fst_194_ = lean_ctor_get(v___x_193_, 0);
lean_inc(v_fst_194_);
if (lean_obj_tag(v_fst_194_) == 0)
{
lean_object* v_snd_195_; lean_object* v___x_196_; 
v_snd_195_ = lean_ctor_get(v___x_193_, 1);
lean_inc(v_snd_195_);
lean_dec_ref(v___x_193_);
v___x_196_ = lean_alloc_ctor(1, 1, 0);
lean_ctor_set(v___x_196_, 0, v_snd_195_);
return v___x_196_;
}
else
{
lean_object* v_val_197_; 
lean_dec_ref(v___x_193_);
v_val_197_ = lean_ctor_get(v_fst_194_, 0);
lean_inc(v_val_197_);
lean_dec_ref_known(v_fst_194_, 1);
return v_val_197_;
}
}
else
{
lean_object* v___x_198_; 
v___x_198_ = lean_box(0);
return v___x_198_;
}
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNative597c05ce6432c0d3_carrierCollect___redArg___boxed(lean_object* v_values_199_){
_start:
{
lean_object* v_res_200_; 
v_res_200_ = l_LeanBridgeNative597c05ce6432c0d3_carrierCollect___redArg(v_values_199_);
lean_dec_ref(v_values_199_);
return v_res_200_;
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNative597c05ce6432c0d3_carrierCollect(lean_object* v_00_u03b1_201_, lean_object* v_values_202_){
_start:
{
lean_object* v___x_203_; 
v___x_203_ = l_LeanBridgeNative597c05ce6432c0d3_carrierCollect___redArg(v_values_202_);
return v___x_203_;
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNative597c05ce6432c0d3_carrierCollect___boxed(lean_object* v_00_u03b1_204_, lean_object* v_values_205_){
_start:
{
lean_object* v_res_206_; 
v_res_206_ = l_LeanBridgeNative597c05ce6432c0d3_carrierCollect(v_00_u03b1_204_, v_values_205_);
lean_dec_ref(v_values_205_);
return v_res_206_;
}
}
LEAN_EXPORT lean_object* l___private_Init_Data_Array_Basic_0__Array_forIn_x27Unsafe_loop___at___00LeanBridgeNative597c05ce6432c0d3_carrierCollect_spec__0(lean_object* v_00_u03b1_207_, lean_object* v_as_208_, size_t v_sz_209_, size_t v_i_210_, lean_object* v_b_211_){
_start:
{
lean_object* v___x_212_; 
v___x_212_ = l___private_Init_Data_Array_Basic_0__Array_forIn_x27Unsafe_loop___at___00LeanBridgeNative597c05ce6432c0d3_carrierCollect_spec__0___redArg(v_as_208_, v_sz_209_, v_i_210_, v_b_211_);
return v___x_212_;
}
}
LEAN_EXPORT lean_object* l___private_Init_Data_Array_Basic_0__Array_forIn_x27Unsafe_loop___at___00LeanBridgeNative597c05ce6432c0d3_carrierCollect_spec__0___boxed(lean_object* v_00_u03b1_213_, lean_object* v_as_214_, lean_object* v_sz_215_, lean_object* v_i_216_, lean_object* v_b_217_){
_start:
{
size_t v_sz_boxed_218_; size_t v_i_boxed_219_; lean_object* v_res_220_; 
v_sz_boxed_218_ = lean_unbox_usize(v_sz_215_);
lean_dec(v_sz_215_);
v_i_boxed_219_ = lean_unbox_usize(v_i_216_);
lean_dec(v_i_216_);
v_res_220_ = l___private_Init_Data_Array_Basic_0__Array_forIn_x27Unsafe_loop___at___00LeanBridgeNative597c05ce6432c0d3_carrierCollect_spec__0(v_00_u03b1_213_, v_as_214_, v_sz_boxed_218_, v_i_boxed_219_, v_b_217_);
lean_dec_ref(v_as_214_);
return v_res_220_;
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNative597c05ce6432c0d3_carrierListItems_loop___redArg(lean_object* v_a_221_, lean_object* v_a_222_, lean_object* v_a_223_){
_start:
{
lean_object* v_zero_224_; uint8_t v_isZero_225_; 
v_zero_224_ = lean_unsigned_to_nat(0u);
v_isZero_225_ = lean_nat_dec_eq(v_a_221_, v_zero_224_);
if (v_isZero_225_ == 1)
{
lean_dec(v_a_222_);
lean_dec(v_a_221_);
return v_a_223_;
}
else
{
if (lean_obj_tag(v_a_222_) == 0)
{
lean_dec(v_a_221_);
return v_a_223_;
}
else
{
lean_object* v_head_226_; lean_object* v_tail_227_; lean_object* v_one_228_; lean_object* v_n_229_; lean_object* v___x_230_; lean_object* v___x_231_; lean_object* v___x_232_; 
v_head_226_ = lean_ctor_get(v_a_222_, 0);
lean_inc(v_head_226_);
v_tail_227_ = lean_ctor_get(v_a_222_, 1);
lean_inc(v_tail_227_);
lean_dec_ref_known(v_a_222_, 2);
v_one_228_ = lean_unsigned_to_nat(1u);
v_n_229_ = lean_nat_sub(v_a_221_, v_one_228_);
lean_dec(v_a_221_);
v___x_230_ = lean_mk_empty_array_with_capacity(v_one_228_);
v___x_231_ = lean_array_push(v___x_230_, v_head_226_);
v___x_232_ = lean_array_push(v_a_223_, v___x_231_);
v_a_221_ = v_n_229_;
v_a_222_ = v_tail_227_;
v_a_223_ = v___x_232_;
goto _start;
}
}
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNative597c05ce6432c0d3_carrierListItems_loop(lean_object* v_00_u03b1_234_, lean_object* v_a_235_, lean_object* v_a_236_, lean_object* v_a_237_){
_start:
{
lean_object* v___x_238_; 
v___x_238_ = l_LeanBridgeNative597c05ce6432c0d3_carrierListItems_loop___redArg(v_a_235_, v_a_236_, v_a_237_);
return v___x_238_;
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNative597c05ce6432c0d3_carrierListItems___redArg(lean_object* v_values_241_){
_start:
{
lean_object* v___x_242_; lean_object* v___x_243_; lean_object* v___x_244_; 
v___x_242_ = lean_unsigned_to_nat(262145u);
v___x_243_ = ((lean_object*)(l_LeanBridgeNative597c05ce6432c0d3_carrierListItems___redArg___closed__0));
v___x_244_ = l_LeanBridgeNative597c05ce6432c0d3_carrierListItems_loop___redArg(v___x_242_, v_values_241_, v___x_243_);
return v___x_244_;
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNative597c05ce6432c0d3_carrierListItems(lean_object* v_00_u03b1_245_, lean_object* v_values_246_){
_start:
{
lean_object* v___x_247_; 
v___x_247_ = l_LeanBridgeNative597c05ce6432c0d3_carrierListItems___redArg(v_values_246_);
return v___x_247_;
}
}
LEAN_EXPORT uint32_t lean_bridge_890e535d855edd42581629d4_recursive_d0f96c6a61c5999d6261_branch(lean_object* v_value_248_){
_start:
{
lean_object* v___x_249_; 
v___x_249_ = l_LeanBridgeNative597c05ce6432c0d3_carrierValue___redArg(v_value_248_);
lean_dec_ref(v_value_248_);
if (lean_obj_tag(v___x_249_) == 0)
{
uint32_t v___x_250_; 
v___x_250_ = 4294967295;
return v___x_250_;
}
else
{
lean_object* v_val_251_; 
v_val_251_ = lean_ctor_get(v___x_249_, 0);
lean_inc(v_val_251_);
lean_dec_ref_known(v___x_249_, 1);
if (lean_obj_tag(v_val_251_) == 0)
{
uint32_t v___x_252_; 
v___x_252_ = 0;
return v___x_252_;
}
else
{
uint32_t v___x_253_; 
lean_dec_ref_known(v_val_251_, 3);
v___x_253_ = 1;
return v___x_253_;
}
}
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNative597c05ce6432c0d3_branchd0f96c6a61c5999d6261___boxed(lean_object* v_value_254_){
_start:
{
uint32_t v_res_255_; lean_object* v_r_256_; 
v_res_255_ = lean_bridge_890e535d855edd42581629d4_recursive_d0f96c6a61c5999d6261_branch(v_value_254_);
v_r_256_ = lean_box_uint32(v_res_255_);
return v_r_256_;
}
}
static lean_object* _init_l_LeanBridgeNative597c05ce6432c0d3_make0d0f96c6a61c5999d6261___closed__1(void){
_start:
{
lean_object* v___x_259_; lean_object* v___x_260_; 
v___x_259_ = ((lean_object*)(l_LeanBridgeNative597c05ce6432c0d3_make0d0f96c6a61c5999d6261___closed__0));
v___x_260_ = l_LeanBridgeNative597c05ce6432c0d3_carrierResult___redArg(v___x_259_);
return v___x_260_;
}
}
LEAN_EXPORT lean_object* lean_bridge_890e535d855edd42581629d4_recursive_d0f96c6a61c5999d6261_make0(lean_object* v___bridgeUnit_261_){
_start:
{
lean_object* v___x_262_; 
v___x_262_ = lean_obj_once(&l_LeanBridgeNative597c05ce6432c0d3_make0d0f96c6a61c5999d6261___closed__1, &l_LeanBridgeNative597c05ce6432c0d3_make0d0f96c6a61c5999d6261___closed__1_once, _init_l_LeanBridgeNative597c05ce6432c0d3_make0d0f96c6a61c5999d6261___closed__1);
return v___x_262_;
}
}
static lean_object* _init_l_LeanBridgeNative597c05ce6432c0d3_make1d0f96c6a61c5999d6261___closed__0(void){
_start:
{
lean_object* v___x_263_; lean_object* v___x_264_; 
v___x_263_ = lean_box(0);
v___x_264_ = l_LeanBridgeNative597c05ce6432c0d3_carrierResult___redArg(v___x_263_);
return v___x_264_;
}
}
LEAN_EXPORT lean_object* lean_bridge_890e535d855edd42581629d4_recursive_d0f96c6a61c5999d6261_make1(lean_object* v_a0_265_, lean_object* v_a1_266_, lean_object* v_a2_267_){
_start:
{
lean_object* v___x_268_; 
v___x_268_ = l_LeanBridgeNative597c05ce6432c0d3_carrierValue___redArg(v_a0_265_);
lean_dec_ref(v_a0_265_);
if (lean_obj_tag(v___x_268_) == 0)
{
lean_object* v___x_269_; 
lean_dec_ref(v_a2_267_);
lean_dec_ref(v_a1_266_);
v___x_269_ = lean_obj_once(&l_LeanBridgeNative597c05ce6432c0d3_make1d0f96c6a61c5999d6261___closed__0, &l_LeanBridgeNative597c05ce6432c0d3_make1d0f96c6a61c5999d6261___closed__0_once, _init_l_LeanBridgeNative597c05ce6432c0d3_make1d0f96c6a61c5999d6261___closed__0);
return v___x_269_;
}
else
{
lean_object* v_val_270_; lean_object* v___x_271_; 
v_val_270_ = lean_ctor_get(v___x_268_, 0);
lean_inc(v_val_270_);
lean_dec_ref_known(v___x_268_, 1);
v___x_271_ = l_LeanBridgeNative597c05ce6432c0d3_carrierValue___redArg(v_a1_266_);
lean_dec_ref(v_a1_266_);
if (lean_obj_tag(v___x_271_) == 0)
{
lean_object* v___x_272_; 
lean_dec(v_val_270_);
lean_dec_ref(v_a2_267_);
v___x_272_ = lean_obj_once(&l_LeanBridgeNative597c05ce6432c0d3_make1d0f96c6a61c5999d6261___closed__0, &l_LeanBridgeNative597c05ce6432c0d3_make1d0f96c6a61c5999d6261___closed__0_once, _init_l_LeanBridgeNative597c05ce6432c0d3_make1d0f96c6a61c5999d6261___closed__0);
return v___x_272_;
}
else
{
lean_object* v_val_273_; lean_object* v___x_274_; 
v_val_273_ = lean_ctor_get(v___x_271_, 0);
lean_inc(v_val_273_);
lean_dec_ref_known(v___x_271_, 1);
v___x_274_ = l_LeanBridgeNative597c05ce6432c0d3_carrierValue___redArg(v_a2_267_);
lean_dec_ref(v_a2_267_);
if (lean_obj_tag(v___x_274_) == 0)
{
lean_object* v___x_275_; 
lean_dec(v_val_273_);
lean_dec(v_val_270_);
v___x_275_ = l_LeanBridgeNative597c05ce6432c0d3_carrierResult___redArg(v___x_274_);
return v___x_275_;
}
else
{
lean_object* v_val_276_; lean_object* v___x_278_; uint8_t v_isShared_279_; uint8_t v_isSharedCheck_285_; 
v_val_276_ = lean_ctor_get(v___x_274_, 0);
v_isSharedCheck_285_ = !lean_is_exclusive(v___x_274_);
if (v_isSharedCheck_285_ == 0)
{
v___x_278_ = v___x_274_;
v_isShared_279_ = v_isSharedCheck_285_;
goto v_resetjp_277_;
}
else
{
lean_inc(v_val_276_);
lean_dec(v___x_274_);
v___x_278_ = lean_box(0);
v_isShared_279_ = v_isSharedCheck_285_;
goto v_resetjp_277_;
}
v_resetjp_277_:
{
lean_object* v___x_280_; lean_object* v___x_282_; 
v___x_280_ = lean_alloc_ctor(1, 3, 0);
lean_ctor_set(v___x_280_, 0, v_val_270_);
lean_ctor_set(v___x_280_, 1, v_val_273_);
lean_ctor_set(v___x_280_, 2, v_val_276_);
if (v_isShared_279_ == 0)
{
lean_ctor_set(v___x_278_, 0, v___x_280_);
v___x_282_ = v___x_278_;
goto v_reusejp_281_;
}
else
{
lean_object* v_reuseFailAlloc_284_; 
v_reuseFailAlloc_284_ = lean_alloc_ctor(1, 1, 0);
lean_ctor_set(v_reuseFailAlloc_284_, 0, v___x_280_);
v___x_282_ = v_reuseFailAlloc_284_;
goto v_reusejp_281_;
}
v_reusejp_281_:
{
lean_object* v___x_283_; 
v___x_283_ = l_LeanBridgeNative597c05ce6432c0d3_carrierResult___redArg(v___x_282_);
return v___x_283_;
}
}
}
}
}
}
}
static lean_object* _init_l_LeanBridgeNative597c05ce6432c0d3_case1__field0d0f96c6a61c5999d6261___closed__0(void){
_start:
{
lean_object* v___x_286_; lean_object* v___x_287_; 
v___x_286_ = lean_box(0);
v___x_287_ = l_LeanBridgeNative597c05ce6432c0d3_carrierResult___redArg(v___x_286_);
return v___x_287_;
}
}
LEAN_EXPORT lean_object* lean_bridge_890e535d855edd42581629d4_recursive_d0f96c6a61c5999d6261_case1_field0(lean_object* v_value_288_){
_start:
{
lean_object* v___x_289_; 
v___x_289_ = l_LeanBridgeNative597c05ce6432c0d3_carrierValue___redArg(v_value_288_);
lean_dec_ref(v_value_288_);
if (lean_obj_tag(v___x_289_) == 0)
{
lean_object* v___x_290_; 
v___x_290_ = lean_obj_once(&l_LeanBridgeNative597c05ce6432c0d3_case1__field0d0f96c6a61c5999d6261___closed__0, &l_LeanBridgeNative597c05ce6432c0d3_case1__field0d0f96c6a61c5999d6261___closed__0_once, _init_l_LeanBridgeNative597c05ce6432c0d3_case1__field0d0f96c6a61c5999d6261___closed__0);
return v___x_290_;
}
else
{
lean_object* v_val_291_; lean_object* v___x_293_; uint8_t v_isShared_294_; uint8_t v_isSharedCheck_301_; 
v_val_291_ = lean_ctor_get(v___x_289_, 0);
v_isSharedCheck_301_ = !lean_is_exclusive(v___x_289_);
if (v_isSharedCheck_301_ == 0)
{
v___x_293_ = v___x_289_;
v_isShared_294_ = v_isSharedCheck_301_;
goto v_resetjp_292_;
}
else
{
lean_inc(v_val_291_);
lean_dec(v___x_289_);
v___x_293_ = lean_box(0);
v_isShared_294_ = v_isSharedCheck_301_;
goto v_resetjp_292_;
}
v_resetjp_292_:
{
if (lean_obj_tag(v_val_291_) == 1)
{
lean_object* v_a0_295_; lean_object* v___x_297_; 
v_a0_295_ = lean_ctor_get(v_val_291_, 0);
lean_inc(v_a0_295_);
lean_dec_ref_known(v_val_291_, 3);
if (v_isShared_294_ == 0)
{
lean_ctor_set(v___x_293_, 0, v_a0_295_);
v___x_297_ = v___x_293_;
goto v_reusejp_296_;
}
else
{
lean_object* v_reuseFailAlloc_299_; 
v_reuseFailAlloc_299_ = lean_alloc_ctor(1, 1, 0);
lean_ctor_set(v_reuseFailAlloc_299_, 0, v_a0_295_);
v___x_297_ = v_reuseFailAlloc_299_;
goto v_reusejp_296_;
}
v_reusejp_296_:
{
lean_object* v___x_298_; 
v___x_298_ = l_LeanBridgeNative597c05ce6432c0d3_carrierResult___redArg(v___x_297_);
return v___x_298_;
}
}
else
{
lean_object* v___x_300_; 
lean_del_object(v___x_293_);
lean_dec(v_val_291_);
v___x_300_ = lean_obj_once(&l_LeanBridgeNative597c05ce6432c0d3_case1__field0d0f96c6a61c5999d6261___closed__0, &l_LeanBridgeNative597c05ce6432c0d3_case1__field0d0f96c6a61c5999d6261___closed__0_once, _init_l_LeanBridgeNative597c05ce6432c0d3_case1__field0d0f96c6a61c5999d6261___closed__0);
return v___x_300_;
}
}
}
}
}
LEAN_EXPORT lean_object* lean_bridge_890e535d855edd42581629d4_recursive_d0f96c6a61c5999d6261_case1_field1(lean_object* v_value_302_){
_start:
{
lean_object* v___x_303_; 
v___x_303_ = l_LeanBridgeNative597c05ce6432c0d3_carrierValue___redArg(v_value_302_);
lean_dec_ref(v_value_302_);
if (lean_obj_tag(v___x_303_) == 0)
{
lean_object* v___x_304_; 
v___x_304_ = lean_obj_once(&l_LeanBridgeNative597c05ce6432c0d3_case1__field0d0f96c6a61c5999d6261___closed__0, &l_LeanBridgeNative597c05ce6432c0d3_case1__field0d0f96c6a61c5999d6261___closed__0_once, _init_l_LeanBridgeNative597c05ce6432c0d3_case1__field0d0f96c6a61c5999d6261___closed__0);
return v___x_304_;
}
else
{
lean_object* v_val_305_; lean_object* v___x_307_; uint8_t v_isShared_308_; uint8_t v_isSharedCheck_315_; 
v_val_305_ = lean_ctor_get(v___x_303_, 0);
v_isSharedCheck_315_ = !lean_is_exclusive(v___x_303_);
if (v_isSharedCheck_315_ == 0)
{
v___x_307_ = v___x_303_;
v_isShared_308_ = v_isSharedCheck_315_;
goto v_resetjp_306_;
}
else
{
lean_inc(v_val_305_);
lean_dec(v___x_303_);
v___x_307_ = lean_box(0);
v_isShared_308_ = v_isSharedCheck_315_;
goto v_resetjp_306_;
}
v_resetjp_306_:
{
if (lean_obj_tag(v_val_305_) == 1)
{
lean_object* v_a1_309_; lean_object* v___x_311_; 
v_a1_309_ = lean_ctor_get(v_val_305_, 1);
lean_inc(v_a1_309_);
lean_dec_ref_known(v_val_305_, 3);
if (v_isShared_308_ == 0)
{
lean_ctor_set(v___x_307_, 0, v_a1_309_);
v___x_311_ = v___x_307_;
goto v_reusejp_310_;
}
else
{
lean_object* v_reuseFailAlloc_313_; 
v_reuseFailAlloc_313_ = lean_alloc_ctor(1, 1, 0);
lean_ctor_set(v_reuseFailAlloc_313_, 0, v_a1_309_);
v___x_311_ = v_reuseFailAlloc_313_;
goto v_reusejp_310_;
}
v_reusejp_310_:
{
lean_object* v___x_312_; 
v___x_312_ = l_LeanBridgeNative597c05ce6432c0d3_carrierResult___redArg(v___x_311_);
return v___x_312_;
}
}
else
{
lean_object* v___x_314_; 
lean_del_object(v___x_307_);
lean_dec(v_val_305_);
v___x_314_ = lean_obj_once(&l_LeanBridgeNative597c05ce6432c0d3_case1__field0d0f96c6a61c5999d6261___closed__0, &l_LeanBridgeNative597c05ce6432c0d3_case1__field0d0f96c6a61c5999d6261___closed__0_once, _init_l_LeanBridgeNative597c05ce6432c0d3_case1__field0d0f96c6a61c5999d6261___closed__0);
return v___x_314_;
}
}
}
}
}
LEAN_EXPORT lean_object* lean_bridge_890e535d855edd42581629d4_recursive_d0f96c6a61c5999d6261_case1_field2(lean_object* v_value_316_){
_start:
{
lean_object* v___x_317_; 
v___x_317_ = l_LeanBridgeNative597c05ce6432c0d3_carrierValue___redArg(v_value_316_);
lean_dec_ref(v_value_316_);
if (lean_obj_tag(v___x_317_) == 0)
{
lean_object* v___x_318_; 
v___x_318_ = l_LeanBridgeNative597c05ce6432c0d3_carrierResult___redArg(v___x_317_);
return v___x_318_;
}
else
{
lean_object* v_val_319_; lean_object* v___x_321_; uint8_t v_isShared_322_; uint8_t v_isSharedCheck_329_; 
v_val_319_ = lean_ctor_get(v___x_317_, 0);
v_isSharedCheck_329_ = !lean_is_exclusive(v___x_317_);
if (v_isSharedCheck_329_ == 0)
{
v___x_321_ = v___x_317_;
v_isShared_322_ = v_isSharedCheck_329_;
goto v_resetjp_320_;
}
else
{
lean_inc(v_val_319_);
lean_dec(v___x_317_);
v___x_321_ = lean_box(0);
v_isShared_322_ = v_isSharedCheck_329_;
goto v_resetjp_320_;
}
v_resetjp_320_:
{
if (lean_obj_tag(v_val_319_) == 1)
{
lean_object* v_a2_323_; lean_object* v___x_325_; 
v_a2_323_ = lean_ctor_get(v_val_319_, 2);
lean_inc(v_a2_323_);
lean_dec_ref_known(v_val_319_, 3);
if (v_isShared_322_ == 0)
{
lean_ctor_set(v___x_321_, 0, v_a2_323_);
v___x_325_ = v___x_321_;
goto v_reusejp_324_;
}
else
{
lean_object* v_reuseFailAlloc_327_; 
v_reuseFailAlloc_327_ = lean_alloc_ctor(1, 1, 0);
lean_ctor_set(v_reuseFailAlloc_327_, 0, v_a2_323_);
v___x_325_ = v_reuseFailAlloc_327_;
goto v_reusejp_324_;
}
v_reusejp_324_:
{
lean_object* v___x_326_; 
v___x_326_ = l_LeanBridgeNative597c05ce6432c0d3_carrierResult___redArg(v___x_325_);
return v___x_326_;
}
}
else
{
lean_object* v___x_328_; 
lean_del_object(v___x_321_);
lean_dec(v_val_319_);
v___x_328_ = lean_obj_once(&l_LeanBridgeNative597c05ce6432c0d3_make1d0f96c6a61c5999d6261___closed__0, &l_LeanBridgeNative597c05ce6432c0d3_make1d0f96c6a61c5999d6261___closed__0_once, _init_l_LeanBridgeNative597c05ce6432c0d3_make1d0f96c6a61c5999d6261___closed__0);
return v___x_328_;
}
}
}
}
}
LEAN_EXPORT lean_object* lean_bridge_890e535d855edd42581629d4_recursive_7150ee578fdad1fd4810_make(lean_object* v_values_330_){
_start:
{
lean_object* v___x_331_; lean_object* v___x_332_; 
v___x_331_ = l_LeanBridgeNative597c05ce6432c0d3_carrierCollect___redArg(v_values_330_);
lean_dec_ref(v_values_330_);
v___x_332_ = l_LeanBridgeNative597c05ce6432c0d3_carrierResult___redArg(v___x_331_);
return v___x_332_;
}
}
LEAN_EXPORT lean_object* l___private_Init_Data_Array_Basic_0__Array_mapMUnsafe_map___at___00LeanBridgeNative597c05ce6432c0d3_items7150ee578fdad1fd4810_spec__0(size_t v_sz_333_, size_t v_i_334_, lean_object* v_bs_335_){
_start:
{
uint8_t v___x_336_; 
v___x_336_ = lean_usize_dec_lt(v_i_334_, v_sz_333_);
if (v___x_336_ == 0)
{
return v_bs_335_;
}
else
{
lean_object* v_v_337_; lean_object* v___x_338_; lean_object* v_bs_x27_339_; lean_object* v___x_340_; lean_object* v___x_341_; lean_object* v___x_342_; size_t v___x_343_; size_t v___x_344_; lean_object* v___x_345_; 
v_v_337_ = lean_array_uget(v_bs_335_, v_i_334_);
v___x_338_ = lean_unsigned_to_nat(0u);
v_bs_x27_339_ = lean_array_uset(v_bs_335_, v_i_334_, v___x_338_);
v___x_340_ = lean_unsigned_to_nat(1u);
v___x_341_ = lean_mk_empty_array_with_capacity(v___x_340_);
v___x_342_ = lean_array_push(v___x_341_, v_v_337_);
v___x_343_ = ((size_t)1ULL);
v___x_344_ = lean_usize_add(v_i_334_, v___x_343_);
v___x_345_ = lean_array_uset(v_bs_x27_339_, v_i_334_, v___x_342_);
v_i_334_ = v___x_344_;
v_bs_335_ = v___x_345_;
goto _start;
}
}
}
LEAN_EXPORT lean_object* l___private_Init_Data_Array_Basic_0__Array_mapMUnsafe_map___at___00LeanBridgeNative597c05ce6432c0d3_items7150ee578fdad1fd4810_spec__0___boxed(lean_object* v_sz_347_, lean_object* v_i_348_, lean_object* v_bs_349_){
_start:
{
size_t v_sz_boxed_350_; size_t v_i_boxed_351_; lean_object* v_res_352_; 
v_sz_boxed_350_ = lean_unbox_usize(v_sz_347_);
lean_dec(v_sz_347_);
v_i_boxed_351_ = lean_unbox_usize(v_i_348_);
lean_dec(v_i_348_);
v_res_352_ = l___private_Init_Data_Array_Basic_0__Array_mapMUnsafe_map___at___00LeanBridgeNative597c05ce6432c0d3_items7150ee578fdad1fd4810_spec__0(v_sz_boxed_350_, v_i_boxed_351_, v_bs_349_);
return v_res_352_;
}
}
LEAN_EXPORT lean_object* lean_bridge_890e535d855edd42581629d4_recursive_7150ee578fdad1fd4810_items(lean_object* v_value_355_){
_start:
{
lean_object* v___x_356_; 
v___x_356_ = l_LeanBridgeNative597c05ce6432c0d3_carrierValue___redArg(v_value_355_);
lean_dec_ref(v_value_355_);
if (lean_obj_tag(v___x_356_) == 0)
{
lean_object* v___x_357_; 
v___x_357_ = ((lean_object*)(l_LeanBridgeNative597c05ce6432c0d3_items7150ee578fdad1fd4810___closed__0));
return v___x_357_;
}
else
{
lean_object* v_val_358_; lean_object* v___x_359_; lean_object* v___x_360_; lean_object* v___x_361_; size_t v_sz_362_; size_t v___x_363_; lean_object* v___x_364_; 
v_val_358_ = lean_ctor_get(v___x_356_, 0);
lean_inc(v_val_358_);
lean_dec_ref_known(v___x_356_, 1);
v___x_359_ = lean_unsigned_to_nat(0u);
v___x_360_ = lean_unsigned_to_nat(262145u);
v___x_361_ = l_Array_extract___redArg(v_val_358_, v___x_359_, v___x_360_);
lean_dec(v_val_358_);
v_sz_362_ = lean_array_size(v___x_361_);
v___x_363_ = ((size_t)0ULL);
v___x_364_ = l___private_Init_Data_Array_Basic_0__Array_mapMUnsafe_map___at___00LeanBridgeNative597c05ce6432c0d3_items7150ee578fdad1fd4810_spec__0(v_sz_362_, v___x_363_, v___x_361_);
return v___x_364_;
}
}
}
LEAN_EXPORT uint32_t lean_bridge_890e535d855edd42581629d4_recursive_670fab78918c40675bdb_branch(lean_object* v_value_365_){
_start:
{
lean_object* v___x_366_; 
v___x_366_ = l_LeanBridgeNative597c05ce6432c0d3_carrierValue___redArg(v_value_365_);
lean_dec_ref(v_value_365_);
if (lean_obj_tag(v___x_366_) == 0)
{
uint32_t v___x_367_; 
v___x_367_ = 4294967295;
return v___x_367_;
}
else
{
lean_object* v_val_368_; 
v_val_368_ = lean_ctor_get(v___x_366_, 0);
lean_inc(v_val_368_);
lean_dec_ref_known(v___x_366_, 1);
if (lean_obj_tag(v_val_368_) == 0)
{
uint32_t v___x_369_; 
v___x_369_ = 0;
return v___x_369_;
}
else
{
uint32_t v___x_370_; 
lean_dec_ref_known(v_val_368_, 1);
v___x_370_ = 1;
return v___x_370_;
}
}
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNative597c05ce6432c0d3_branch670fab78918c40675bdb___boxed(lean_object* v_value_371_){
_start:
{
uint32_t v_res_372_; lean_object* v_r_373_; 
v_res_372_ = lean_bridge_890e535d855edd42581629d4_recursive_670fab78918c40675bdb_branch(v_value_371_);
v_r_373_ = lean_box_uint32(v_res_372_);
return v_r_373_;
}
}
static lean_object* _init_l_LeanBridgeNative597c05ce6432c0d3_none670fab78918c40675bdb___closed__1(void){
_start:
{
lean_object* v___x_376_; lean_object* v___x_377_; 
v___x_376_ = ((lean_object*)(l_LeanBridgeNative597c05ce6432c0d3_none670fab78918c40675bdb___closed__0));
v___x_377_ = l_LeanBridgeNative597c05ce6432c0d3_carrierResult___redArg(v___x_376_);
return v___x_377_;
}
}
LEAN_EXPORT lean_object* lean_bridge_890e535d855edd42581629d4_recursive_670fab78918c40675bdb_none(lean_object* v___bridgeUnit_378_){
_start:
{
lean_object* v___x_379_; 
v___x_379_ = lean_obj_once(&l_LeanBridgeNative597c05ce6432c0d3_none670fab78918c40675bdb___closed__1, &l_LeanBridgeNative597c05ce6432c0d3_none670fab78918c40675bdb___closed__1_once, _init_l_LeanBridgeNative597c05ce6432c0d3_none670fab78918c40675bdb___closed__1);
return v___x_379_;
}
}
static lean_object* _init_l_LeanBridgeNative597c05ce6432c0d3_make0670fab78918c40675bdb___closed__0(void){
_start:
{
lean_object* v___x_380_; lean_object* v___x_381_; 
v___x_380_ = lean_box(0);
v___x_381_ = l_LeanBridgeNative597c05ce6432c0d3_carrierResult___redArg(v___x_380_);
return v___x_381_;
}
}
LEAN_EXPORT lean_object* lean_bridge_890e535d855edd42581629d4_recursive_670fab78918c40675bdb_make0(lean_object* v_a0_382_){
_start:
{
lean_object* v___x_383_; 
v___x_383_ = l_LeanBridgeNative597c05ce6432c0d3_carrierValue___redArg(v_a0_382_);
lean_dec_ref(v_a0_382_);
if (lean_obj_tag(v___x_383_) == 0)
{
lean_object* v___x_384_; 
v___x_384_ = lean_obj_once(&l_LeanBridgeNative597c05ce6432c0d3_make0670fab78918c40675bdb___closed__0, &l_LeanBridgeNative597c05ce6432c0d3_make0670fab78918c40675bdb___closed__0_once, _init_l_LeanBridgeNative597c05ce6432c0d3_make0670fab78918c40675bdb___closed__0);
return v___x_384_;
}
else
{
lean_object* v___x_385_; lean_object* v___x_386_; 
v___x_385_ = lean_alloc_ctor(1, 1, 0);
lean_ctor_set(v___x_385_, 0, v___x_383_);
v___x_386_ = l_LeanBridgeNative597c05ce6432c0d3_carrierResult___redArg(v___x_385_);
return v___x_386_;
}
}
}
LEAN_EXPORT lean_object* lean_bridge_890e535d855edd42581629d4_recursive_670fab78918c40675bdb_field0(lean_object* v_value_387_){
_start:
{
lean_object* v___x_388_; 
v___x_388_ = l_LeanBridgeNative597c05ce6432c0d3_carrierValue___redArg(v_value_387_);
lean_dec_ref(v_value_387_);
if (lean_obj_tag(v___x_388_) == 0)
{
lean_object* v___x_389_; 
v___x_389_ = lean_obj_once(&l_LeanBridgeNative597c05ce6432c0d3_make1d0f96c6a61c5999d6261___closed__0, &l_LeanBridgeNative597c05ce6432c0d3_make1d0f96c6a61c5999d6261___closed__0_once, _init_l_LeanBridgeNative597c05ce6432c0d3_make1d0f96c6a61c5999d6261___closed__0);
return v___x_389_;
}
else
{
lean_object* v_val_390_; 
v_val_390_ = lean_ctor_get(v___x_388_, 0);
lean_inc(v_val_390_);
lean_dec_ref_known(v___x_388_, 1);
if (lean_obj_tag(v_val_390_) == 1)
{
lean_object* v___x_391_; 
v___x_391_ = l_LeanBridgeNative597c05ce6432c0d3_carrierResult___redArg(v_val_390_);
return v___x_391_;
}
else
{
lean_object* v___x_392_; 
lean_dec(v_val_390_);
v___x_392_ = lean_obj_once(&l_LeanBridgeNative597c05ce6432c0d3_make1d0f96c6a61c5999d6261___closed__0, &l_LeanBridgeNative597c05ce6432c0d3_make1d0f96c6a61c5999d6261___closed__0_once, _init_l_LeanBridgeNative597c05ce6432c0d3_make1d0f96c6a61c5999d6261___closed__0);
return v___x_392_;
}
}
}
}
LEAN_EXPORT lean_object* lean_bridge_890e535d855edd42581629d4_recursive_83c50e7540f0bfb759d4_make(lean_object* v_a0_393_){
_start:
{
lean_object* v___x_394_; lean_object* v___x_395_; 
v___x_394_ = l_LeanBridgeNative597c05ce6432c0d3_carrierValue___redArg(v_a0_393_);
lean_dec_ref(v_a0_393_);
v___x_395_ = l_LeanBridgeNative597c05ce6432c0d3_carrierResult___redArg(v___x_394_);
return v___x_395_;
}
}
LEAN_EXPORT lean_object* lean_bridge_890e535d855edd42581629d4_recursive_83c50e7540f0bfb759d4_field0(lean_object* v_value_396_){
_start:
{
lean_object* v___x_397_; lean_object* v___x_398_; 
v___x_397_ = l_LeanBridgeNative597c05ce6432c0d3_carrierValue___redArg(v_value_396_);
lean_dec_ref(v_value_396_);
v___x_398_ = l_LeanBridgeNative597c05ce6432c0d3_carrierResult___redArg(v___x_397_);
return v___x_398_;
}
}
LEAN_EXPORT uint8_t lean_bridge_890e535d855edd42581629d4_fin_guard_0(lean_object* v_carrier_399_){
_start:
{
lean_object* v___x_400_; 
v___x_400_ = l_LeanBridgeNative597c05ce6432c0d3_carrierValue___redArg(v_carrier_399_);
lean_dec_ref(v_carrier_399_);
if (lean_obj_tag(v___x_400_) == 0)
{
uint8_t v___x_401_; 
v___x_401_ = 0;
return v___x_401_;
}
else
{
lean_object* v_val_402_; uint8_t v___x_403_; 
v_val_402_ = lean_ctor_get(v___x_400_, 0);
lean_inc(v_val_402_);
lean_dec_ref_known(v___x_400_, 1);
v___x_403_ = l_LeanBridgeNative597c05ce6432c0d3_LbErased_RecursiveSubtypes_Chain_validFin(v_val_402_);
lean_dec(v_val_402_);
if (v___x_403_ == 0)
{
uint8_t v___x_404_; 
v___x_404_ = 0;
return v___x_404_;
}
else
{
uint8_t v___x_405_; 
v___x_405_ = 1;
return v___x_405_;
}
}
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNative597c05ce6432c0d3_export0__fin__guard__0___boxed(lean_object* v_carrier_406_){
_start:
{
uint8_t v_res_407_; lean_object* v_r_408_; 
v_res_407_ = lean_bridge_890e535d855edd42581629d4_fin_guard_0(v_carrier_406_);
v_r_408_ = lean_box(v_res_407_);
return v_r_408_;
}
}
LEAN_EXPORT uint8_t lean_bridge_890e535d855edd42581629d4_refinement_0(lean_object* v_carrier_409_){
_start:
{
lean_object* v___x_410_; 
v___x_410_ = l_LeanBridgeNative597c05ce6432c0d3_carrierValue___redArg(v_carrier_409_);
lean_dec_ref(v_carrier_409_);
if (lean_obj_tag(v___x_410_) == 0)
{
uint8_t v___x_411_; 
v___x_411_ = 0;
return v___x_411_;
}
else
{
lean_object* v_val_412_; uint8_t v___x_413_; 
v_val_412_ = lean_ctor_get(v___x_410_, 0);
lean_inc(v_val_412_);
lean_dec_ref_known(v___x_410_, 1);
v___x_413_ = l_LeanBridgeNative597c05ce6432c0d3_LbErased_RecursiveSubtypes_Chain_validFin(v_val_412_);
if (v___x_413_ == 0)
{
uint8_t v___x_414_; 
lean_dec(v_val_412_);
v___x_414_ = 0;
return v___x_414_;
}
else
{
lean_object* v___x_415_; 
v___x_415_ = l_LeanBridgeNative597c05ce6432c0d3_LbErased_RecursiveSubtypes_Chain_via__2cb331aa51ddb668a8dff8336edd9916ab7be0f0ecaed898ae8a3eb5d32f1e81(v_val_412_);
if (lean_obj_tag(v___x_415_) == 0)
{
uint8_t v___x_416_; 
v___x_416_ = 0;
return v___x_416_;
}
else
{
uint8_t v___x_417_; 
lean_dec_ref_known(v___x_415_, 1);
v___x_417_ = 1;
return v___x_417_;
}
}
}
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNative597c05ce6432c0d3_export0__refinement__0___boxed(lean_object* v_carrier_418_){
_start:
{
uint8_t v_res_419_; lean_object* v_r_420_; 
v_res_419_ = lean_bridge_890e535d855edd42581629d4_refinement_0(v_carrier_418_);
v_r_420_ = lean_box(v_res_419_);
return v_r_420_;
}
}
LEAN_EXPORT uint8_t lean_bridge_890e535d855edd42581629d4_graph_refinement_0_f47f84e548df9f42ce87(lean_object* v_carrier_421_){
_start:
{
lean_object* v___x_422_; 
v___x_422_ = l_LeanBridgeNative597c05ce6432c0d3_carrierValue___redArg(v_carrier_421_);
lean_dec_ref(v_carrier_421_);
if (lean_obj_tag(v___x_422_) == 0)
{
uint8_t v___x_423_; 
v___x_423_ = 0;
return v___x_423_;
}
else
{
lean_object* v_val_424_; lean_object* v___x_425_; 
v_val_424_ = lean_ctor_get(v___x_422_, 0);
lean_inc(v_val_424_);
lean_dec_ref_known(v___x_422_, 1);
v___x_425_ = lb_recursive_subtype_probe_constructor_plusOne(v_val_424_);
if (lean_obj_tag(v___x_425_) == 0)
{
uint8_t v___x_426_; 
v___x_426_ = 0;
return v___x_426_;
}
else
{
uint8_t v___x_427_; 
lean_dec_ref_known(v___x_425_, 1);
v___x_427_ = 1;
return v___x_427_;
}
}
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNative597c05ce6432c0d3_export0__graph__refinement__0__f47f84e548df9f42ce87___boxed(lean_object* v_carrier_428_){
_start:
{
uint8_t v_res_429_; lean_object* v_r_430_; 
v_res_429_ = lean_bridge_890e535d855edd42581629d4_graph_refinement_0_f47f84e548df9f42ce87(v_carrier_428_);
v_r_430_ = lean_box(v_res_429_);
return v_r_430_;
}
}
LEAN_EXPORT lean_object* lean_bridge_890e535d855edd42581629d4_lean(lean_object* v_a0_431_){
_start:
{
lean_object* v___x_432_; 
v___x_432_ = l_LeanBridgeNative597c05ce6432c0d3_carrierValue___redArg(v_a0_431_);
lean_dec_ref(v_a0_431_);
if (lean_obj_tag(v___x_432_) == 0)
{
lean_object* v___x_433_; 
v___x_433_ = l_LeanBridgeNative597c05ce6432c0d3_carrierResult___redArg(v___x_432_);
return v___x_433_;
}
else
{
lean_object* v_val_434_; uint8_t v___x_435_; 
v_val_434_ = lean_ctor_get(v___x_432_, 0);
lean_inc(v_val_434_);
lean_dec_ref_known(v___x_432_, 1);
v___x_435_ = l_LeanBridgeNative597c05ce6432c0d3_LbErased_RecursiveSubtypes_Chain_validFin(v_val_434_);
if (v___x_435_ == 0)
{
lean_object* v___x_436_; 
lean_dec(v_val_434_);
v___x_436_ = lean_obj_once(&l_LeanBridgeNative597c05ce6432c0d3_make1d0f96c6a61c5999d6261___closed__0, &l_LeanBridgeNative597c05ce6432c0d3_make1d0f96c6a61c5999d6261___closed__0_once, _init_l_LeanBridgeNative597c05ce6432c0d3_make1d0f96c6a61c5999d6261___closed__0);
return v___x_436_;
}
else
{
lean_object* v___x_437_; 
v___x_437_ = l_LeanBridgeNative597c05ce6432c0d3_LbErased_RecursiveSubtypes_Chain_via__2cb331aa51ddb668a8dff8336edd9916ab7be0f0ecaed898ae8a3eb5d32f1e81(v_val_434_);
if (lean_obj_tag(v___x_437_) == 0)
{
lean_object* v___x_438_; 
v___x_438_ = lean_obj_once(&l_LeanBridgeNative597c05ce6432c0d3_make1d0f96c6a61c5999d6261___closed__0, &l_LeanBridgeNative597c05ce6432c0d3_make1d0f96c6a61c5999d6261___closed__0_once, _init_l_LeanBridgeNative597c05ce6432c0d3_make1d0f96c6a61c5999d6261___closed__0);
return v___x_438_;
}
else
{
lean_object* v_val_439_; lean_object* v___x_441_; uint8_t v_isShared_442_; uint8_t v_isSharedCheck_449_; 
v_val_439_ = lean_ctor_get(v___x_437_, 0);
v_isSharedCheck_449_ = !lean_is_exclusive(v___x_437_);
if (v_isSharedCheck_449_ == 0)
{
v___x_441_ = v___x_437_;
v_isShared_442_ = v_isSharedCheck_449_;
goto v_resetjp_440_;
}
else
{
lean_inc(v_val_439_);
lean_dec(v___x_437_);
v___x_441_ = lean_box(0);
v_isShared_442_ = v_isSharedCheck_449_;
goto v_resetjp_440_;
}
v_resetjp_440_:
{
lean_object* v___x_443_; lean_object* v___x_444_; lean_object* v___x_446_; 
v___x_443_ = lb_recursive_subtype_probe_source_echo(v_val_439_);
v___x_444_ = l_LeanBridgeNative597c05ce6432c0d3_LbErased_RecursiveSubtypes_Chain_erase(v___x_443_);
if (v_isShared_442_ == 0)
{
lean_ctor_set(v___x_441_, 0, v___x_444_);
v___x_446_ = v___x_441_;
goto v_reusejp_445_;
}
else
{
lean_object* v_reuseFailAlloc_448_; 
v_reuseFailAlloc_448_ = lean_alloc_ctor(1, 1, 0);
lean_ctor_set(v_reuseFailAlloc_448_, 0, v___x_444_);
v___x_446_ = v_reuseFailAlloc_448_;
goto v_reusejp_445_;
}
v_reusejp_445_:
{
lean_object* v___x_447_; 
v___x_447_ = l_LeanBridgeNative597c05ce6432c0d3_carrierResult___redArg(v___x_446_);
return v___x_447_;
}
}
}
}
}
}
}
LEAN_EXPORT uint8_t l___private_Init_Data_Array_Basic_0__Array_anyMUnsafe_any___at___00LeanBridgeNative597c05ce6432c0d3_export1__fin__guard__0_spec__0(lean_object* v_as_450_, size_t v_i_451_, size_t v_stop_452_){
_start:
{
uint8_t v___x_453_; 
v___x_453_ = lean_usize_dec_eq(v_i_451_, v_stop_452_);
if (v___x_453_ == 0)
{
uint8_t v___x_454_; uint8_t v___y_456_; lean_object* v_val_460_; 
v___x_454_ = 1;
v_val_460_ = lean_array_uget_borrowed(v_as_450_, v_i_451_);
if (lean_obj_tag(v_val_460_) == 0)
{
v___y_456_ = v___x_453_;
goto v___jp_455_;
}
else
{
lean_object* v_val_461_; uint8_t v___x_462_; 
v_val_461_ = lean_ctor_get(v_val_460_, 0);
v___x_462_ = l_LeanBridgeNative597c05ce6432c0d3_LbErased_RecursiveSubtypes_Chain_validFin(v_val_461_);
if (v___x_462_ == 0)
{
return v___x_454_;
}
else
{
v___y_456_ = v___x_453_;
goto v___jp_455_;
}
}
v___jp_455_:
{
if (v___y_456_ == 0)
{
size_t v___x_457_; size_t v___x_458_; 
v___x_457_ = ((size_t)1ULL);
v___x_458_ = lean_usize_add(v_i_451_, v___x_457_);
v_i_451_ = v___x_458_;
goto _start;
}
else
{
return v___x_454_;
}
}
}
else
{
uint8_t v___x_463_; 
v___x_463_ = 0;
return v___x_463_;
}
}
}
LEAN_EXPORT lean_object* l___private_Init_Data_Array_Basic_0__Array_anyMUnsafe_any___at___00LeanBridgeNative597c05ce6432c0d3_export1__fin__guard__0_spec__0___boxed(lean_object* v_as_464_, lean_object* v_i_465_, lean_object* v_stop_466_){
_start:
{
size_t v_i_boxed_467_; size_t v_stop_boxed_468_; uint8_t v_res_469_; lean_object* v_r_470_; 
v_i_boxed_467_ = lean_unbox_usize(v_i_465_);
lean_dec(v_i_465_);
v_stop_boxed_468_ = lean_unbox_usize(v_stop_466_);
lean_dec(v_stop_466_);
v_res_469_ = l___private_Init_Data_Array_Basic_0__Array_anyMUnsafe_any___at___00LeanBridgeNative597c05ce6432c0d3_export1__fin__guard__0_spec__0(v_as_464_, v_i_boxed_467_, v_stop_boxed_468_);
lean_dec_ref(v_as_464_);
v_r_470_ = lean_box(v_res_469_);
return v_r_470_;
}
}
LEAN_EXPORT uint8_t lean_bridge_61edaca9ace2104f41ea6e59_fin_guard_0(lean_object* v_carrier_471_){
_start:
{
lean_object* v___x_472_; 
v___x_472_ = l_LeanBridgeNative597c05ce6432c0d3_carrierValue___redArg(v_carrier_471_);
lean_dec_ref(v_carrier_471_);
if (lean_obj_tag(v___x_472_) == 0)
{
uint8_t v___x_473_; 
v___x_473_ = 0;
return v___x_473_;
}
else
{
lean_object* v_val_474_; lean_object* v___x_475_; lean_object* v___x_476_; uint8_t v___x_477_; 
v_val_474_ = lean_ctor_get(v___x_472_, 0);
lean_inc(v_val_474_);
lean_dec_ref_known(v___x_472_, 1);
v___x_475_ = lean_unsigned_to_nat(0u);
v___x_476_ = lean_array_get_size(v_val_474_);
v___x_477_ = lean_nat_dec_lt(v___x_475_, v___x_476_);
if (v___x_477_ == 0)
{
uint8_t v___x_478_; 
lean_dec(v_val_474_);
v___x_478_ = 1;
return v___x_478_;
}
else
{
if (v___x_477_ == 0)
{
uint8_t v___x_479_; 
lean_dec(v_val_474_);
v___x_479_ = 1;
return v___x_479_;
}
else
{
size_t v___x_480_; size_t v___x_481_; uint8_t v___x_482_; 
v___x_480_ = ((size_t)0ULL);
v___x_481_ = lean_usize_of_nat(v___x_476_);
v___x_482_ = l___private_Init_Data_Array_Basic_0__Array_anyMUnsafe_any___at___00LeanBridgeNative597c05ce6432c0d3_export1__fin__guard__0_spec__0(v_val_474_, v___x_480_, v___x_481_);
lean_dec(v_val_474_);
if (v___x_482_ == 0)
{
uint8_t v___x_483_; 
v___x_483_ = 1;
return v___x_483_;
}
else
{
uint8_t v___x_484_; 
v___x_484_ = 0;
return v___x_484_;
}
}
}
}
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNative597c05ce6432c0d3_export1__fin__guard__0___boxed(lean_object* v_carrier_485_){
_start:
{
uint8_t v_res_486_; lean_object* v_r_487_; 
v_res_486_ = lean_bridge_61edaca9ace2104f41ea6e59_fin_guard_0(v_carrier_485_);
v_r_487_ = lean_box(v_res_486_);
return v_r_487_;
}
}
LEAN_EXPORT lean_object* l___private_Init_Data_Array_Basic_0__Array_mapMUnsafe_map___at___00LeanBridgeNative597c05ce6432c0d3_export1__refinement__0_spec__0(size_t v_sz_488_, size_t v_i_489_, lean_object* v_bs_490_){
_start:
{
uint8_t v___x_491_; 
v___x_491_ = lean_usize_dec_lt(v_i_489_, v_sz_488_);
if (v___x_491_ == 0)
{
lean_object* v___x_492_; 
v___x_492_ = lean_alloc_ctor(1, 1, 0);
lean_ctor_set(v___x_492_, 0, v_bs_490_);
return v___x_492_;
}
else
{
lean_object* v_v_493_; lean_object* v___x_494_; lean_object* v_bs_x27_495_; lean_object* v_val_497_; 
v_v_493_ = lean_array_uget(v_bs_490_, v_i_489_);
v___x_494_ = lean_unsigned_to_nat(0u);
v_bs_x27_495_ = lean_array_uset(v_bs_490_, v_i_489_, v___x_494_);
if (lean_obj_tag(v_v_493_) == 0)
{
lean_object* v___x_502_; 
v___x_502_ = lean_box(0);
v_val_497_ = v___x_502_;
goto v___jp_496_;
}
else
{
lean_object* v_val_503_; lean_object* v___x_504_; 
v_val_503_ = lean_ctor_get(v_v_493_, 0);
lean_inc(v_val_503_);
lean_dec_ref_known(v_v_493_, 1);
v___x_504_ = l_LeanBridgeNative597c05ce6432c0d3_LbErased_RecursiveSubtypes_Chain_via__2cb331aa51ddb668a8dff8336edd9916ab7be0f0ecaed898ae8a3eb5d32f1e81(v_val_503_);
if (lean_obj_tag(v___x_504_) == 0)
{
lean_object* v___x_505_; 
lean_dec_ref(v_bs_x27_495_);
v___x_505_ = lean_box(0);
return v___x_505_;
}
else
{
v_val_497_ = v___x_504_;
goto v___jp_496_;
}
}
v___jp_496_:
{
size_t v___x_498_; size_t v___x_499_; lean_object* v___x_500_; 
v___x_498_ = ((size_t)1ULL);
v___x_499_ = lean_usize_add(v_i_489_, v___x_498_);
v___x_500_ = lean_array_uset(v_bs_x27_495_, v_i_489_, v_val_497_);
v_i_489_ = v___x_499_;
v_bs_490_ = v___x_500_;
goto _start;
}
}
}
}
LEAN_EXPORT lean_object* l___private_Init_Data_Array_Basic_0__Array_mapMUnsafe_map___at___00LeanBridgeNative597c05ce6432c0d3_export1__refinement__0_spec__0___boxed(lean_object* v_sz_506_, lean_object* v_i_507_, lean_object* v_bs_508_){
_start:
{
size_t v_sz_boxed_509_; size_t v_i_boxed_510_; lean_object* v_res_511_; 
v_sz_boxed_509_ = lean_unbox_usize(v_sz_506_);
lean_dec(v_sz_506_);
v_i_boxed_510_ = lean_unbox_usize(v_i_507_);
lean_dec(v_i_507_);
v_res_511_ = l___private_Init_Data_Array_Basic_0__Array_mapMUnsafe_map___at___00LeanBridgeNative597c05ce6432c0d3_export1__refinement__0_spec__0(v_sz_boxed_509_, v_i_boxed_510_, v_bs_508_);
return v_res_511_;
}
}
LEAN_EXPORT uint8_t lean_bridge_61edaca9ace2104f41ea6e59_refinement_0(lean_object* v_carrier_512_){
_start:
{
lean_object* v___x_513_; 
v___x_513_ = l_LeanBridgeNative597c05ce6432c0d3_carrierValue___redArg(v_carrier_512_);
lean_dec_ref(v_carrier_512_);
if (lean_obj_tag(v___x_513_) == 0)
{
uint8_t v___x_514_; 
v___x_514_ = 0;
return v___x_514_;
}
else
{
lean_object* v_val_515_; lean_object* v___x_522_; lean_object* v___x_523_; uint8_t v___x_524_; 
v_val_515_ = lean_ctor_get(v___x_513_, 0);
lean_inc(v_val_515_);
lean_dec_ref_known(v___x_513_, 1);
v___x_522_ = lean_unsigned_to_nat(0u);
v___x_523_ = lean_array_get_size(v_val_515_);
v___x_524_ = lean_nat_dec_lt(v___x_522_, v___x_523_);
if (v___x_524_ == 0)
{
goto v___jp_516_;
}
else
{
if (v___x_524_ == 0)
{
goto v___jp_516_;
}
else
{
size_t v___x_525_; size_t v___x_526_; uint8_t v___x_527_; 
v___x_525_ = ((size_t)0ULL);
v___x_526_ = lean_usize_of_nat(v___x_523_);
v___x_527_ = l___private_Init_Data_Array_Basic_0__Array_anyMUnsafe_any___at___00LeanBridgeNative597c05ce6432c0d3_export1__fin__guard__0_spec__0(v_val_515_, v___x_525_, v___x_526_);
if (v___x_527_ == 0)
{
goto v___jp_516_;
}
else
{
uint8_t v___x_528_; 
lean_dec(v_val_515_);
v___x_528_ = 0;
return v___x_528_;
}
}
}
v___jp_516_:
{
size_t v_sz_517_; size_t v___x_518_; lean_object* v___x_519_; 
v_sz_517_ = lean_array_size(v_val_515_);
v___x_518_ = ((size_t)0ULL);
v___x_519_ = l___private_Init_Data_Array_Basic_0__Array_mapMUnsafe_map___at___00LeanBridgeNative597c05ce6432c0d3_export1__refinement__0_spec__0(v_sz_517_, v___x_518_, v_val_515_);
if (lean_obj_tag(v___x_519_) == 0)
{
uint8_t v___x_520_; 
v___x_520_ = 0;
return v___x_520_;
}
else
{
uint8_t v___x_521_; 
lean_dec_ref_known(v___x_519_, 1);
v___x_521_ = 1;
return v___x_521_;
}
}
}
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNative597c05ce6432c0d3_export1__refinement__0___boxed(lean_object* v_carrier_529_){
_start:
{
uint8_t v_res_530_; lean_object* v_r_531_; 
v_res_530_ = lean_bridge_61edaca9ace2104f41ea6e59_refinement_0(v_carrier_529_);
v_r_531_ = lean_box(v_res_530_);
return v_r_531_;
}
}
LEAN_EXPORT uint8_t lean_bridge_61edaca9ace2104f41ea6e59_graph_refinement_0_f47f84e548df9f42ce87(lean_object* v_carrier_532_){
_start:
{
lean_object* v___x_533_; 
v___x_533_ = l_LeanBridgeNative597c05ce6432c0d3_carrierValue___redArg(v_carrier_532_);
lean_dec_ref(v_carrier_532_);
if (lean_obj_tag(v___x_533_) == 0)
{
uint8_t v___x_534_; 
v___x_534_ = 0;
return v___x_534_;
}
else
{
lean_object* v_val_535_; lean_object* v___x_536_; 
v_val_535_ = lean_ctor_get(v___x_533_, 0);
lean_inc(v_val_535_);
lean_dec_ref_known(v___x_533_, 1);
v___x_536_ = lb_recursive_subtype_probe_constructor_plusOne(v_val_535_);
if (lean_obj_tag(v___x_536_) == 0)
{
uint8_t v___x_537_; 
v___x_537_ = 0;
return v___x_537_;
}
else
{
uint8_t v___x_538_; 
lean_dec_ref_known(v___x_536_, 1);
v___x_538_ = 1;
return v___x_538_;
}
}
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNative597c05ce6432c0d3_export1__graph__refinement__0__f47f84e548df9f42ce87___boxed(lean_object* v_carrier_539_){
_start:
{
uint8_t v_res_540_; lean_object* v_r_541_; 
v_res_540_ = lean_bridge_61edaca9ace2104f41ea6e59_graph_refinement_0_f47f84e548df9f42ce87(v_carrier_539_);
v_r_541_ = lean_box(v_res_540_);
return v_r_541_;
}
}
LEAN_EXPORT lean_object* l___private_Init_Data_Array_Basic_0__Array_mapMUnsafe_map___at___00LeanBridgeNative597c05ce6432c0d3_export1_spec__0(size_t v_sz_542_, size_t v_i_543_, lean_object* v_bs_544_){
_start:
{
uint8_t v___x_545_; 
v___x_545_ = lean_usize_dec_lt(v_i_543_, v_sz_542_);
if (v___x_545_ == 0)
{
return v_bs_544_;
}
else
{
lean_object* v_v_546_; lean_object* v___x_547_; lean_object* v_bs_x27_548_; lean_object* v___y_550_; 
v_v_546_ = lean_array_uget(v_bs_544_, v_i_543_);
v___x_547_ = lean_unsigned_to_nat(0u);
v_bs_x27_548_ = lean_array_uset(v_bs_544_, v_i_543_, v___x_547_);
if (lean_obj_tag(v_v_546_) == 0)
{
lean_object* v___x_555_; 
v___x_555_ = lean_box(0);
v___y_550_ = v___x_555_;
goto v___jp_549_;
}
else
{
lean_object* v_val_556_; lean_object* v___x_558_; uint8_t v_isShared_559_; uint8_t v_isSharedCheck_564_; 
v_val_556_ = lean_ctor_get(v_v_546_, 0);
v_isSharedCheck_564_ = !lean_is_exclusive(v_v_546_);
if (v_isSharedCheck_564_ == 0)
{
v___x_558_ = v_v_546_;
v_isShared_559_ = v_isSharedCheck_564_;
goto v_resetjp_557_;
}
else
{
lean_inc(v_val_556_);
lean_dec(v_v_546_);
v___x_558_ = lean_box(0);
v_isShared_559_ = v_isSharedCheck_564_;
goto v_resetjp_557_;
}
v_resetjp_557_:
{
lean_object* v___x_560_; lean_object* v___x_562_; 
v___x_560_ = l_LeanBridgeNative597c05ce6432c0d3_LbErased_RecursiveSubtypes_Chain_erase(v_val_556_);
if (v_isShared_559_ == 0)
{
lean_ctor_set(v___x_558_, 0, v___x_560_);
v___x_562_ = v___x_558_;
goto v_reusejp_561_;
}
else
{
lean_object* v_reuseFailAlloc_563_; 
v_reuseFailAlloc_563_ = lean_alloc_ctor(1, 1, 0);
lean_ctor_set(v_reuseFailAlloc_563_, 0, v___x_560_);
v___x_562_ = v_reuseFailAlloc_563_;
goto v_reusejp_561_;
}
v_reusejp_561_:
{
v___y_550_ = v___x_562_;
goto v___jp_549_;
}
}
}
v___jp_549_:
{
size_t v___x_551_; size_t v___x_552_; lean_object* v___x_553_; 
v___x_551_ = ((size_t)1ULL);
v___x_552_ = lean_usize_add(v_i_543_, v___x_551_);
v___x_553_ = lean_array_uset(v_bs_x27_548_, v_i_543_, v___y_550_);
v_i_543_ = v___x_552_;
v_bs_544_ = v___x_553_;
goto _start;
}
}
}
}
LEAN_EXPORT lean_object* l___private_Init_Data_Array_Basic_0__Array_mapMUnsafe_map___at___00LeanBridgeNative597c05ce6432c0d3_export1_spec__0___boxed(lean_object* v_sz_565_, lean_object* v_i_566_, lean_object* v_bs_567_){
_start:
{
size_t v_sz_boxed_568_; size_t v_i_boxed_569_; lean_object* v_res_570_; 
v_sz_boxed_568_ = lean_unbox_usize(v_sz_565_);
lean_dec(v_sz_565_);
v_i_boxed_569_ = lean_unbox_usize(v_i_566_);
lean_dec(v_i_566_);
v_res_570_ = l___private_Init_Data_Array_Basic_0__Array_mapMUnsafe_map___at___00LeanBridgeNative597c05ce6432c0d3_export1_spec__0(v_sz_boxed_568_, v_i_boxed_569_, v_bs_567_);
return v_res_570_;
}
}
static lean_object* _init_l_LeanBridgeNative597c05ce6432c0d3_export1___closed__0(void){
_start:
{
lean_object* v___x_571_; lean_object* v___x_572_; 
v___x_571_ = lean_box(0);
v___x_572_ = l_LeanBridgeNative597c05ce6432c0d3_carrierResult___redArg(v___x_571_);
return v___x_572_;
}
}
LEAN_EXPORT lean_object* lean_bridge_61edaca9ace2104f41ea6e59_lean(lean_object* v_a0_573_){
_start:
{
lean_object* v___x_574_; 
v___x_574_ = l_LeanBridgeNative597c05ce6432c0d3_carrierValue___redArg(v_a0_573_);
lean_dec_ref(v_a0_573_);
if (lean_obj_tag(v___x_574_) == 0)
{
lean_object* v___x_575_; 
v___x_575_ = l_LeanBridgeNative597c05ce6432c0d3_carrierResult___redArg(v___x_574_);
return v___x_575_;
}
else
{
lean_object* v_val_576_; lean_object* v___x_594_; lean_object* v___x_595_; uint8_t v___x_596_; 
v_val_576_ = lean_ctor_get(v___x_574_, 0);
lean_inc(v_val_576_);
lean_dec_ref_known(v___x_574_, 1);
v___x_594_ = lean_unsigned_to_nat(0u);
v___x_595_ = lean_array_get_size(v_val_576_);
v___x_596_ = lean_nat_dec_lt(v___x_594_, v___x_595_);
if (v___x_596_ == 0)
{
goto v___jp_577_;
}
else
{
if (v___x_596_ == 0)
{
goto v___jp_577_;
}
else
{
size_t v___x_597_; size_t v___x_598_; uint8_t v___x_599_; 
v___x_597_ = ((size_t)0ULL);
v___x_598_ = lean_usize_of_nat(v___x_595_);
v___x_599_ = l___private_Init_Data_Array_Basic_0__Array_anyMUnsafe_any___at___00LeanBridgeNative597c05ce6432c0d3_export1__fin__guard__0_spec__0(v_val_576_, v___x_597_, v___x_598_);
if (v___x_599_ == 0)
{
goto v___jp_577_;
}
else
{
lean_object* v___x_600_; 
lean_dec(v_val_576_);
v___x_600_ = lean_obj_once(&l_LeanBridgeNative597c05ce6432c0d3_export1___closed__0, &l_LeanBridgeNative597c05ce6432c0d3_export1___closed__0_once, _init_l_LeanBridgeNative597c05ce6432c0d3_export1___closed__0);
return v___x_600_;
}
}
}
v___jp_577_:
{
size_t v_sz_578_; size_t v___x_579_; lean_object* v___x_580_; 
v_sz_578_ = lean_array_size(v_val_576_);
v___x_579_ = ((size_t)0ULL);
v___x_580_ = l___private_Init_Data_Array_Basic_0__Array_mapMUnsafe_map___at___00LeanBridgeNative597c05ce6432c0d3_export1__refinement__0_spec__0(v_sz_578_, v___x_579_, v_val_576_);
if (lean_obj_tag(v___x_580_) == 0)
{
lean_object* v___x_581_; 
v___x_581_ = lean_obj_once(&l_LeanBridgeNative597c05ce6432c0d3_export1___closed__0, &l_LeanBridgeNative597c05ce6432c0d3_export1___closed__0_once, _init_l_LeanBridgeNative597c05ce6432c0d3_export1___closed__0);
return v___x_581_;
}
else
{
lean_object* v_val_582_; lean_object* v___x_584_; uint8_t v_isShared_585_; uint8_t v_isSharedCheck_593_; 
v_val_582_ = lean_ctor_get(v___x_580_, 0);
v_isSharedCheck_593_ = !lean_is_exclusive(v___x_580_);
if (v_isSharedCheck_593_ == 0)
{
v___x_584_ = v___x_580_;
v_isShared_585_ = v_isSharedCheck_593_;
goto v_resetjp_583_;
}
else
{
lean_inc(v_val_582_);
lean_dec(v___x_580_);
v___x_584_ = lean_box(0);
v_isShared_585_ = v_isSharedCheck_593_;
goto v_resetjp_583_;
}
v_resetjp_583_:
{
lean_object* v___x_586_; size_t v_sz_587_; lean_object* v___x_588_; lean_object* v___x_590_; 
v___x_586_ = lb_recursive_subtype_probe_source_echoGroups(v_val_582_);
v_sz_587_ = lean_array_size(v___x_586_);
v___x_588_ = l___private_Init_Data_Array_Basic_0__Array_mapMUnsafe_map___at___00LeanBridgeNative597c05ce6432c0d3_export1_spec__0(v_sz_587_, v___x_579_, v___x_586_);
if (v_isShared_585_ == 0)
{
lean_ctor_set(v___x_584_, 0, v___x_588_);
v___x_590_ = v___x_584_;
goto v_reusejp_589_;
}
else
{
lean_object* v_reuseFailAlloc_592_; 
v_reuseFailAlloc_592_ = lean_alloc_ctor(1, 1, 0);
lean_ctor_set(v_reuseFailAlloc_592_, 0, v___x_588_);
v___x_590_ = v_reuseFailAlloc_592_;
goto v_reusejp_589_;
}
v_reusejp_589_:
{
lean_object* v___x_591_; 
v___x_591_ = l_LeanBridgeNative597c05ce6432c0d3_carrierResult___redArg(v___x_590_);
return v___x_591_;
}
}
}
}
}
}
}
LEAN_EXPORT uint8_t lean_bridge_a9ae70188abbca81b8f235ce_fin_guard_0(lean_object* v_carrier_601_){
_start:
{
lean_object* v___x_602_; 
v___x_602_ = l_LeanBridgeNative597c05ce6432c0d3_carrierValue___redArg(v_carrier_601_);
lean_dec_ref(v_carrier_601_);
if (lean_obj_tag(v___x_602_) == 0)
{
uint8_t v___x_603_; 
v___x_603_ = 0;
return v___x_603_;
}
else
{
lean_object* v_val_604_; uint8_t v___x_605_; 
v_val_604_ = lean_ctor_get(v___x_602_, 0);
lean_inc(v_val_604_);
lean_dec_ref_known(v___x_602_, 1);
v___x_605_ = l_LeanBridgeNative597c05ce6432c0d3_LbErased_RecursiveSubtypes_Chain_validFin(v_val_604_);
lean_dec(v_val_604_);
if (v___x_605_ == 0)
{
uint8_t v___x_606_; 
v___x_606_ = 0;
return v___x_606_;
}
else
{
uint8_t v___x_607_; 
v___x_607_ = 1;
return v___x_607_;
}
}
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNative597c05ce6432c0d3_export2__fin__guard__0___boxed(lean_object* v_carrier_608_){
_start:
{
uint8_t v_res_609_; lean_object* v_r_610_; 
v_res_609_ = lean_bridge_a9ae70188abbca81b8f235ce_fin_guard_0(v_carrier_608_);
v_r_610_ = lean_box(v_res_609_);
return v_r_610_;
}
}
LEAN_EXPORT uint8_t lean_bridge_a9ae70188abbca81b8f235ce_refinement_0(lean_object* v_carrier_611_){
_start:
{
lean_object* v___x_612_; 
v___x_612_ = l_LeanBridgeNative597c05ce6432c0d3_carrierValue___redArg(v_carrier_611_);
lean_dec_ref(v_carrier_611_);
if (lean_obj_tag(v___x_612_) == 0)
{
uint8_t v___x_613_; 
v___x_613_ = 0;
return v___x_613_;
}
else
{
lean_object* v_val_614_; uint8_t v___x_615_; 
v_val_614_ = lean_ctor_get(v___x_612_, 0);
lean_inc(v_val_614_);
lean_dec_ref_known(v___x_612_, 1);
v___x_615_ = l_LeanBridgeNative597c05ce6432c0d3_LbErased_RecursiveSubtypes_Chain_validFin(v_val_614_);
if (v___x_615_ == 0)
{
uint8_t v___x_616_; 
lean_dec(v_val_614_);
v___x_616_ = 0;
return v___x_616_;
}
else
{
lean_object* v___x_617_; 
v___x_617_ = l_LeanBridgeNative597c05ce6432c0d3_LbErased_RecursiveSubtypes_Chain_via__2cb331aa51ddb668a8dff8336edd9916ab7be0f0ecaed898ae8a3eb5d32f1e81(v_val_614_);
if (lean_obj_tag(v___x_617_) == 0)
{
uint8_t v___x_618_; 
v___x_618_ = 0;
return v___x_618_;
}
else
{
uint8_t v___x_619_; 
lean_dec_ref_known(v___x_617_, 1);
v___x_619_ = 1;
return v___x_619_;
}
}
}
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNative597c05ce6432c0d3_export2__refinement__0___boxed(lean_object* v_carrier_620_){
_start:
{
uint8_t v_res_621_; lean_object* v_r_622_; 
v_res_621_ = lean_bridge_a9ae70188abbca81b8f235ce_refinement_0(v_carrier_620_);
v_r_622_ = lean_box(v_res_621_);
return v_r_622_;
}
}
LEAN_EXPORT uint8_t lean_bridge_a9ae70188abbca81b8f235ce_graph_refinement_0_f47f84e548df9f42ce87(lean_object* v_carrier_623_){
_start:
{
lean_object* v___x_624_; 
v___x_624_ = l_LeanBridgeNative597c05ce6432c0d3_carrierValue___redArg(v_carrier_623_);
lean_dec_ref(v_carrier_623_);
if (lean_obj_tag(v___x_624_) == 0)
{
uint8_t v___x_625_; 
v___x_625_ = 0;
return v___x_625_;
}
else
{
lean_object* v_val_626_; lean_object* v___x_627_; 
v_val_626_ = lean_ctor_get(v___x_624_, 0);
lean_inc(v_val_626_);
lean_dec_ref_known(v___x_624_, 1);
v___x_627_ = lb_recursive_subtype_probe_constructor_plusOne(v_val_626_);
if (lean_obj_tag(v___x_627_) == 0)
{
uint8_t v___x_628_; 
v___x_628_ = 0;
return v___x_628_;
}
else
{
uint8_t v___x_629_; 
lean_dec_ref_known(v___x_627_, 1);
v___x_629_ = 1;
return v___x_629_;
}
}
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNative597c05ce6432c0d3_export2__graph__refinement__0__f47f84e548df9f42ce87___boxed(lean_object* v_carrier_630_){
_start:
{
uint8_t v_res_631_; lean_object* v_r_632_; 
v_res_631_ = lean_bridge_a9ae70188abbca81b8f235ce_graph_refinement_0_f47f84e548df9f42ce87(v_carrier_630_);
v_r_632_ = lean_box(v_res_631_);
return v_r_632_;
}
}
LEAN_EXPORT lean_object* lean_bridge_a9ae70188abbca81b8f235ce_lean(lean_object* v_a0_633_){
_start:
{
lean_object* v___x_634_; 
v___x_634_ = l_LeanBridgeNative597c05ce6432c0d3_carrierValue___redArg(v_a0_633_);
lean_dec_ref(v_a0_633_);
if (lean_obj_tag(v___x_634_) == 0)
{
lean_object* v___x_635_; 
v___x_635_ = lean_obj_once(&l_LeanBridgeNative597c05ce6432c0d3_case1__field0d0f96c6a61c5999d6261___closed__0, &l_LeanBridgeNative597c05ce6432c0d3_case1__field0d0f96c6a61c5999d6261___closed__0_once, _init_l_LeanBridgeNative597c05ce6432c0d3_case1__field0d0f96c6a61c5999d6261___closed__0);
return v___x_635_;
}
else
{
lean_object* v_val_636_; uint8_t v___x_637_; 
v_val_636_ = lean_ctor_get(v___x_634_, 0);
lean_inc(v_val_636_);
lean_dec_ref_known(v___x_634_, 1);
v___x_637_ = l_LeanBridgeNative597c05ce6432c0d3_LbErased_RecursiveSubtypes_Chain_validFin(v_val_636_);
if (v___x_637_ == 0)
{
lean_object* v___x_638_; 
lean_dec(v_val_636_);
v___x_638_ = lean_obj_once(&l_LeanBridgeNative597c05ce6432c0d3_case1__field0d0f96c6a61c5999d6261___closed__0, &l_LeanBridgeNative597c05ce6432c0d3_case1__field0d0f96c6a61c5999d6261___closed__0_once, _init_l_LeanBridgeNative597c05ce6432c0d3_case1__field0d0f96c6a61c5999d6261___closed__0);
return v___x_638_;
}
else
{
lean_object* v___x_639_; 
v___x_639_ = l_LeanBridgeNative597c05ce6432c0d3_LbErased_RecursiveSubtypes_Chain_via__2cb331aa51ddb668a8dff8336edd9916ab7be0f0ecaed898ae8a3eb5d32f1e81(v_val_636_);
if (lean_obj_tag(v___x_639_) == 0)
{
lean_object* v___x_640_; 
v___x_640_ = lean_obj_once(&l_LeanBridgeNative597c05ce6432c0d3_case1__field0d0f96c6a61c5999d6261___closed__0, &l_LeanBridgeNative597c05ce6432c0d3_case1__field0d0f96c6a61c5999d6261___closed__0_once, _init_l_LeanBridgeNative597c05ce6432c0d3_case1__field0d0f96c6a61c5999d6261___closed__0);
return v___x_640_;
}
else
{
lean_object* v_val_641_; lean_object* v___x_643_; uint8_t v_isShared_644_; uint8_t v_isSharedCheck_650_; 
v_val_641_ = lean_ctor_get(v___x_639_, 0);
v_isSharedCheck_650_ = !lean_is_exclusive(v___x_639_);
if (v_isSharedCheck_650_ == 0)
{
v___x_643_ = v___x_639_;
v_isShared_644_ = v_isSharedCheck_650_;
goto v_resetjp_642_;
}
else
{
lean_inc(v_val_641_);
lean_dec(v___x_639_);
v___x_643_ = lean_box(0);
v_isShared_644_ = v_isSharedCheck_650_;
goto v_resetjp_642_;
}
v_resetjp_642_:
{
lean_object* v___x_645_; lean_object* v___x_647_; 
v___x_645_ = lb_recursive_subtype_probe_source_first(v_val_641_);
if (v_isShared_644_ == 0)
{
lean_ctor_set(v___x_643_, 0, v___x_645_);
v___x_647_ = v___x_643_;
goto v_reusejp_646_;
}
else
{
lean_object* v_reuseFailAlloc_649_; 
v_reuseFailAlloc_649_ = lean_alloc_ctor(1, 1, 0);
lean_ctor_set(v_reuseFailAlloc_649_, 0, v___x_645_);
v___x_647_ = v_reuseFailAlloc_649_;
goto v_reusejp_646_;
}
v_reusejp_646_:
{
lean_object* v___x_648_; 
v___x_648_ = l_LeanBridgeNative597c05ce6432c0d3_carrierResult___redArg(v___x_647_);
return v___x_648_;
}
}
}
}
}
}
}
LEAN_EXPORT uint8_t lean_bridge_5f9ebf1241c61a39ed1bdebf_fin_guard_0(lean_object* v_carrier_651_){
_start:
{
lean_object* v___x_652_; 
v___x_652_ = l_LeanBridgeNative597c05ce6432c0d3_carrierValue___redArg(v_carrier_651_);
lean_dec_ref(v_carrier_651_);
if (lean_obj_tag(v___x_652_) == 0)
{
uint8_t v___x_653_; 
v___x_653_ = 0;
return v___x_653_;
}
else
{
lean_object* v_val_654_; lean_object* v___x_655_; lean_object* v___x_656_; uint8_t v___x_657_; 
v_val_654_ = lean_ctor_get(v___x_652_, 0);
lean_inc(v_val_654_);
lean_dec_ref_known(v___x_652_, 1);
v___x_655_ = lean_unsigned_to_nat(0u);
v___x_656_ = lean_array_get_size(v_val_654_);
v___x_657_ = lean_nat_dec_lt(v___x_655_, v___x_656_);
if (v___x_657_ == 0)
{
uint8_t v___x_658_; 
lean_dec(v_val_654_);
v___x_658_ = 1;
return v___x_658_;
}
else
{
if (v___x_657_ == 0)
{
uint8_t v___x_659_; 
lean_dec(v_val_654_);
v___x_659_ = 1;
return v___x_659_;
}
else
{
size_t v___x_660_; size_t v___x_661_; uint8_t v___x_662_; 
v___x_660_ = ((size_t)0ULL);
v___x_661_ = lean_usize_of_nat(v___x_656_);
v___x_662_ = l___private_Init_Data_Array_Basic_0__Array_anyMUnsafe_any___at___00LeanBridgeNative597c05ce6432c0d3_export1__fin__guard__0_spec__0(v_val_654_, v___x_660_, v___x_661_);
lean_dec(v_val_654_);
if (v___x_662_ == 0)
{
uint8_t v___x_663_; 
v___x_663_ = 1;
return v___x_663_;
}
else
{
uint8_t v___x_664_; 
v___x_664_ = 0;
return v___x_664_;
}
}
}
}
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNative597c05ce6432c0d3_export3__fin__guard__0___boxed(lean_object* v_carrier_665_){
_start:
{
uint8_t v_res_666_; lean_object* v_r_667_; 
v_res_666_ = lean_bridge_5f9ebf1241c61a39ed1bdebf_fin_guard_0(v_carrier_665_);
v_r_667_ = lean_box(v_res_666_);
return v_r_667_;
}
}
LEAN_EXPORT uint8_t lean_bridge_5f9ebf1241c61a39ed1bdebf_refinement_0(lean_object* v_carrier_668_){
_start:
{
lean_object* v___x_669_; 
v___x_669_ = l_LeanBridgeNative597c05ce6432c0d3_carrierValue___redArg(v_carrier_668_);
lean_dec_ref(v_carrier_668_);
if (lean_obj_tag(v___x_669_) == 0)
{
uint8_t v___x_670_; 
v___x_670_ = 0;
return v___x_670_;
}
else
{
lean_object* v_val_671_; lean_object* v___x_678_; lean_object* v___x_679_; uint8_t v___x_680_; 
v_val_671_ = lean_ctor_get(v___x_669_, 0);
lean_inc(v_val_671_);
lean_dec_ref_known(v___x_669_, 1);
v___x_678_ = lean_unsigned_to_nat(0u);
v___x_679_ = lean_array_get_size(v_val_671_);
v___x_680_ = lean_nat_dec_lt(v___x_678_, v___x_679_);
if (v___x_680_ == 0)
{
goto v___jp_672_;
}
else
{
if (v___x_680_ == 0)
{
goto v___jp_672_;
}
else
{
size_t v___x_681_; size_t v___x_682_; uint8_t v___x_683_; 
v___x_681_ = ((size_t)0ULL);
v___x_682_ = lean_usize_of_nat(v___x_679_);
v___x_683_ = l___private_Init_Data_Array_Basic_0__Array_anyMUnsafe_any___at___00LeanBridgeNative597c05ce6432c0d3_export1__fin__guard__0_spec__0(v_val_671_, v___x_681_, v___x_682_);
if (v___x_683_ == 0)
{
goto v___jp_672_;
}
else
{
uint8_t v___x_684_; 
lean_dec(v_val_671_);
v___x_684_ = 0;
return v___x_684_;
}
}
}
v___jp_672_:
{
size_t v_sz_673_; size_t v___x_674_; lean_object* v___x_675_; 
v_sz_673_ = lean_array_size(v_val_671_);
v___x_674_ = ((size_t)0ULL);
v___x_675_ = l___private_Init_Data_Array_Basic_0__Array_mapMUnsafe_map___at___00LeanBridgeNative597c05ce6432c0d3_export1__refinement__0_spec__0(v_sz_673_, v___x_674_, v_val_671_);
if (lean_obj_tag(v___x_675_) == 0)
{
uint8_t v___x_676_; 
v___x_676_ = 0;
return v___x_676_;
}
else
{
uint8_t v___x_677_; 
lean_dec_ref_known(v___x_675_, 1);
v___x_677_ = 1;
return v___x_677_;
}
}
}
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNative597c05ce6432c0d3_export3__refinement__0___boxed(lean_object* v_carrier_685_){
_start:
{
uint8_t v_res_686_; lean_object* v_r_687_; 
v_res_686_ = lean_bridge_5f9ebf1241c61a39ed1bdebf_refinement_0(v_carrier_685_);
v_r_687_ = lean_box(v_res_686_);
return v_r_687_;
}
}
LEAN_EXPORT uint8_t lean_bridge_5f9ebf1241c61a39ed1bdebf_graph_refinement_0_f47f84e548df9f42ce87(lean_object* v_carrier_688_){
_start:
{
lean_object* v___x_689_; 
v___x_689_ = l_LeanBridgeNative597c05ce6432c0d3_carrierValue___redArg(v_carrier_688_);
lean_dec_ref(v_carrier_688_);
if (lean_obj_tag(v___x_689_) == 0)
{
uint8_t v___x_690_; 
v___x_690_ = 0;
return v___x_690_;
}
else
{
lean_object* v_val_691_; lean_object* v___x_692_; 
v_val_691_ = lean_ctor_get(v___x_689_, 0);
lean_inc(v_val_691_);
lean_dec_ref_known(v___x_689_, 1);
v___x_692_ = lb_recursive_subtype_probe_constructor_plusOne(v_val_691_);
if (lean_obj_tag(v___x_692_) == 0)
{
uint8_t v___x_693_; 
v___x_693_ = 0;
return v___x_693_;
}
else
{
uint8_t v___x_694_; 
lean_dec_ref_known(v___x_692_, 1);
v___x_694_ = 1;
return v___x_694_;
}
}
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNative597c05ce6432c0d3_export3__graph__refinement__0__f47f84e548df9f42ce87___boxed(lean_object* v_carrier_695_){
_start:
{
uint8_t v_res_696_; lean_object* v_r_697_; 
v_res_696_ = lean_bridge_5f9ebf1241c61a39ed1bdebf_graph_refinement_0_f47f84e548df9f42ce87(v_carrier_695_);
v_r_697_ = lean_box(v_res_696_);
return v_r_697_;
}
}
LEAN_EXPORT lean_object* lean_bridge_5f9ebf1241c61a39ed1bdebf_lean(lean_object* v_a0_698_){
_start:
{
lean_object* v___x_699_; 
v___x_699_ = l_LeanBridgeNative597c05ce6432c0d3_carrierValue___redArg(v_a0_698_);
lean_dec_ref(v_a0_698_);
if (lean_obj_tag(v___x_699_) == 0)
{
lean_object* v___x_700_; 
v___x_700_ = lean_obj_once(&l_LeanBridgeNative597c05ce6432c0d3_case1__field0d0f96c6a61c5999d6261___closed__0, &l_LeanBridgeNative597c05ce6432c0d3_case1__field0d0f96c6a61c5999d6261___closed__0_once, _init_l_LeanBridgeNative597c05ce6432c0d3_case1__field0d0f96c6a61c5999d6261___closed__0);
return v___x_700_;
}
else
{
lean_object* v_val_701_; lean_object* v___x_717_; lean_object* v___x_718_; uint8_t v___x_719_; 
v_val_701_ = lean_ctor_get(v___x_699_, 0);
lean_inc(v_val_701_);
lean_dec_ref_known(v___x_699_, 1);
v___x_717_ = lean_unsigned_to_nat(0u);
v___x_718_ = lean_array_get_size(v_val_701_);
v___x_719_ = lean_nat_dec_lt(v___x_717_, v___x_718_);
if (v___x_719_ == 0)
{
goto v___jp_702_;
}
else
{
if (v___x_719_ == 0)
{
goto v___jp_702_;
}
else
{
size_t v___x_720_; size_t v___x_721_; uint8_t v___x_722_; 
v___x_720_ = ((size_t)0ULL);
v___x_721_ = lean_usize_of_nat(v___x_718_);
v___x_722_ = l___private_Init_Data_Array_Basic_0__Array_anyMUnsafe_any___at___00LeanBridgeNative597c05ce6432c0d3_export1__fin__guard__0_spec__0(v_val_701_, v___x_720_, v___x_721_);
if (v___x_722_ == 0)
{
goto v___jp_702_;
}
else
{
lean_object* v___x_723_; 
lean_dec(v_val_701_);
v___x_723_ = lean_obj_once(&l_LeanBridgeNative597c05ce6432c0d3_case1__field0d0f96c6a61c5999d6261___closed__0, &l_LeanBridgeNative597c05ce6432c0d3_case1__field0d0f96c6a61c5999d6261___closed__0_once, _init_l_LeanBridgeNative597c05ce6432c0d3_case1__field0d0f96c6a61c5999d6261___closed__0);
return v___x_723_;
}
}
}
v___jp_702_:
{
size_t v_sz_703_; size_t v___x_704_; lean_object* v___x_705_; 
v_sz_703_ = lean_array_size(v_val_701_);
v___x_704_ = ((size_t)0ULL);
v___x_705_ = l___private_Init_Data_Array_Basic_0__Array_mapMUnsafe_map___at___00LeanBridgeNative597c05ce6432c0d3_export1__refinement__0_spec__0(v_sz_703_, v___x_704_, v_val_701_);
if (lean_obj_tag(v___x_705_) == 0)
{
lean_object* v___x_706_; 
v___x_706_ = lean_obj_once(&l_LeanBridgeNative597c05ce6432c0d3_case1__field0d0f96c6a61c5999d6261___closed__0, &l_LeanBridgeNative597c05ce6432c0d3_case1__field0d0f96c6a61c5999d6261___closed__0_once, _init_l_LeanBridgeNative597c05ce6432c0d3_case1__field0d0f96c6a61c5999d6261___closed__0);
return v___x_706_;
}
else
{
lean_object* v_val_707_; lean_object* v___x_709_; uint8_t v_isShared_710_; uint8_t v_isSharedCheck_716_; 
v_val_707_ = lean_ctor_get(v___x_705_, 0);
v_isSharedCheck_716_ = !lean_is_exclusive(v___x_705_);
if (v_isSharedCheck_716_ == 0)
{
v___x_709_ = v___x_705_;
v_isShared_710_ = v_isSharedCheck_716_;
goto v_resetjp_708_;
}
else
{
lean_inc(v_val_707_);
lean_dec(v___x_705_);
v___x_709_ = lean_box(0);
v_isShared_710_ = v_isSharedCheck_716_;
goto v_resetjp_708_;
}
v_resetjp_708_:
{
lean_object* v___x_711_; lean_object* v___x_713_; 
v___x_711_ = lb_recursive_subtype_probe_source_groups(v_val_707_);
if (v_isShared_710_ == 0)
{
lean_ctor_set(v___x_709_, 0, v___x_711_);
v___x_713_ = v___x_709_;
goto v_reusejp_712_;
}
else
{
lean_object* v_reuseFailAlloc_715_; 
v_reuseFailAlloc_715_ = lean_alloc_ctor(1, 1, 0);
lean_ctor_set(v_reuseFailAlloc_715_, 0, v___x_711_);
v___x_713_ = v_reuseFailAlloc_715_;
goto v_reusejp_712_;
}
v_reusejp_712_:
{
lean_object* v___x_714_; 
v___x_714_ = l_LeanBridgeNative597c05ce6432c0d3_carrierResult___redArg(v___x_713_);
return v___x_714_;
}
}
}
}
}
}
}
LEAN_EXPORT uint8_t lean_bridge_cc48993941d89731cae43d8e_fin_guard_0(lean_object* v_carrier_724_){
_start:
{
lean_object* v___x_725_; 
v___x_725_ = l_LeanBridgeNative597c05ce6432c0d3_carrierValue___redArg(v_carrier_724_);
lean_dec_ref(v_carrier_724_);
if (lean_obj_tag(v___x_725_) == 0)
{
uint8_t v___x_726_; 
v___x_726_ = 0;
return v___x_726_;
}
else
{
uint8_t v___x_727_; 
lean_dec_ref_known(v___x_725_, 1);
v___x_727_ = 1;
return v___x_727_;
}
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNative597c05ce6432c0d3_export4__fin__guard__0___boxed(lean_object* v_carrier_728_){
_start:
{
uint8_t v_res_729_; lean_object* v_r_730_; 
v_res_729_ = lean_bridge_cc48993941d89731cae43d8e_fin_guard_0(v_carrier_728_);
v_r_730_ = lean_box(v_res_729_);
return v_r_730_;
}
}
LEAN_EXPORT lean_object* lean_bridge_cc48993941d89731cae43d8e_lean(lean_object* v_a0_731_){
_start:
{
lean_object* v___x_732_; 
v___x_732_ = l_LeanBridgeNative597c05ce6432c0d3_carrierValue___redArg(v_a0_731_);
lean_dec_ref(v_a0_731_);
if (lean_obj_tag(v___x_732_) == 0)
{
lean_object* v___x_733_; 
v___x_733_ = lean_obj_once(&l_LeanBridgeNative597c05ce6432c0d3_make1d0f96c6a61c5999d6261___closed__0, &l_LeanBridgeNative597c05ce6432c0d3_make1d0f96c6a61c5999d6261___closed__0_once, _init_l_LeanBridgeNative597c05ce6432c0d3_make1d0f96c6a61c5999d6261___closed__0);
return v___x_733_;
}
else
{
lean_object* v_val_734_; lean_object* v___x_736_; uint8_t v_isShared_737_; uint8_t v_isSharedCheck_744_; 
v_val_734_ = lean_ctor_get(v___x_732_, 0);
v_isSharedCheck_744_ = !lean_is_exclusive(v___x_732_);
if (v_isSharedCheck_744_ == 0)
{
v___x_736_ = v___x_732_;
v_isShared_737_ = v_isSharedCheck_744_;
goto v_resetjp_735_;
}
else
{
lean_inc(v_val_734_);
lean_dec(v___x_732_);
v___x_736_ = lean_box(0);
v_isShared_737_ = v_isSharedCheck_744_;
goto v_resetjp_735_;
}
v_resetjp_735_:
{
lean_object* v___x_738_; lean_object* v___x_739_; lean_object* v___x_741_; 
v___x_738_ = lb_recursive_subtype_probe_source_produce(v_val_734_);
v___x_739_ = l_LeanBridgeNative597c05ce6432c0d3_LbErased_RecursiveSubtypes_Chain_erase(v___x_738_);
if (v_isShared_737_ == 0)
{
lean_ctor_set(v___x_736_, 0, v___x_739_);
v___x_741_ = v___x_736_;
goto v_reusejp_740_;
}
else
{
lean_object* v_reuseFailAlloc_743_; 
v_reuseFailAlloc_743_ = lean_alloc_ctor(1, 1, 0);
lean_ctor_set(v_reuseFailAlloc_743_, 0, v___x_739_);
v___x_741_ = v_reuseFailAlloc_743_;
goto v_reusejp_740_;
}
v_reusejp_740_:
{
lean_object* v___x_742_; 
v___x_742_ = l_LeanBridgeNative597c05ce6432c0d3_carrierResult___redArg(v___x_741_);
return v___x_742_;
}
}
}
}
}
LEAN_EXPORT uint8_t lean_bridge_9e8d2cbaa99dca92eb622921_fin_guard_0(lean_object* v_carrier_745_){
_start:
{
lean_object* v___x_746_; 
v___x_746_ = l_LeanBridgeNative597c05ce6432c0d3_carrierValue___redArg(v_carrier_745_);
lean_dec_ref(v_carrier_745_);
if (lean_obj_tag(v___x_746_) == 0)
{
uint8_t v___x_747_; 
v___x_747_ = 0;
return v___x_747_;
}
else
{
lean_object* v_val_748_; uint8_t v___x_749_; 
v_val_748_ = lean_ctor_get(v___x_746_, 0);
lean_inc(v_val_748_);
lean_dec_ref_known(v___x_746_, 1);
v___x_749_ = l_LeanBridgeNative597c05ce6432c0d3_LbErased_RecursiveSubtypes_Chain_validFin(v_val_748_);
lean_dec(v_val_748_);
if (v___x_749_ == 0)
{
uint8_t v___x_750_; 
v___x_750_ = 0;
return v___x_750_;
}
else
{
uint8_t v___x_751_; 
v___x_751_ = 1;
return v___x_751_;
}
}
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNative597c05ce6432c0d3_export5__fin__guard__0___boxed(lean_object* v_carrier_752_){
_start:
{
uint8_t v_res_753_; lean_object* v_r_754_; 
v_res_753_ = lean_bridge_9e8d2cbaa99dca92eb622921_fin_guard_0(v_carrier_752_);
v_r_754_ = lean_box(v_res_753_);
return v_r_754_;
}
}
LEAN_EXPORT uint8_t lean_bridge_9e8d2cbaa99dca92eb622921_refinement_0(lean_object* v_carrier_755_){
_start:
{
lean_object* v___x_756_; 
v___x_756_ = l_LeanBridgeNative597c05ce6432c0d3_carrierValue___redArg(v_carrier_755_);
lean_dec_ref(v_carrier_755_);
if (lean_obj_tag(v___x_756_) == 0)
{
uint8_t v___x_757_; 
v___x_757_ = 0;
return v___x_757_;
}
else
{
lean_object* v_val_758_; uint8_t v___x_759_; 
v_val_758_ = lean_ctor_get(v___x_756_, 0);
lean_inc(v_val_758_);
lean_dec_ref_known(v___x_756_, 1);
v___x_759_ = l_LeanBridgeNative597c05ce6432c0d3_LbErased_RecursiveSubtypes_Chain_validFin(v_val_758_);
if (v___x_759_ == 0)
{
uint8_t v___x_760_; 
lean_dec(v_val_758_);
v___x_760_ = 0;
return v___x_760_;
}
else
{
lean_object* v___x_761_; 
v___x_761_ = l_LeanBridgeNative597c05ce6432c0d3_LbErased_RecursiveSubtypes_Chain_via__b0a9989b03a240ff1df500f95717b8fa3424b6f89cf1f6bdd2410fb902067a89(v_val_758_);
if (lean_obj_tag(v___x_761_) == 0)
{
uint8_t v___x_762_; 
v___x_762_ = 0;
return v___x_762_;
}
else
{
uint8_t v___x_763_; 
lean_dec_ref_known(v___x_761_, 1);
v___x_763_ = 1;
return v___x_763_;
}
}
}
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNative597c05ce6432c0d3_export5__refinement__0___boxed(lean_object* v_carrier_764_){
_start:
{
uint8_t v_res_765_; lean_object* v_r_766_; 
v_res_765_ = lean_bridge_9e8d2cbaa99dca92eb622921_refinement_0(v_carrier_764_);
v_r_766_ = lean_box(v_res_765_);
return v_r_766_;
}
}
LEAN_EXPORT uint8_t lean_bridge_9e8d2cbaa99dca92eb622921_graph_refinement_0_053cd996a2b855a7fe90(lean_object* v_carrier_767_){
_start:
{
lean_object* v___x_768_; 
v___x_768_ = l_LeanBridgeNative597c05ce6432c0d3_carrierValue___redArg(v_carrier_767_);
lean_dec_ref(v_carrier_767_);
if (lean_obj_tag(v___x_768_) == 0)
{
uint8_t v___x_769_; 
v___x_769_ = 0;
return v___x_769_;
}
else
{
lean_object* v_val_770_; lean_object* v___x_771_; 
v_val_770_ = lean_ctor_get(v___x_768_, 0);
lean_inc(v_val_770_);
lean_dec_ref_known(v___x_768_, 1);
v___x_771_ = lb_recursive_subtype_probe_constructor_plusTwo(v_val_770_);
if (lean_obj_tag(v___x_771_) == 0)
{
uint8_t v___x_772_; 
v___x_772_ = 0;
return v___x_772_;
}
else
{
uint8_t v___x_773_; 
lean_dec_ref_known(v___x_771_, 1);
v___x_773_ = 1;
return v___x_773_;
}
}
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNative597c05ce6432c0d3_export5__graph__refinement__0__053cd996a2b855a7fe90___boxed(lean_object* v_carrier_774_){
_start:
{
uint8_t v_res_775_; lean_object* v_r_776_; 
v_res_775_ = lean_bridge_9e8d2cbaa99dca92eb622921_graph_refinement_0_053cd996a2b855a7fe90(v_carrier_774_);
v_r_776_ = lean_box(v_res_775_);
return v_r_776_;
}
}
LEAN_EXPORT lean_object* lean_bridge_9e8d2cbaa99dca92eb622921_lean(lean_object* v_a0_777_){
_start:
{
lean_object* v___x_778_; 
v___x_778_ = l_LeanBridgeNative597c05ce6432c0d3_carrierValue___redArg(v_a0_777_);
lean_dec_ref(v_a0_777_);
if (lean_obj_tag(v___x_778_) == 0)
{
lean_object* v___x_779_; 
v___x_779_ = lean_obj_once(&l_LeanBridgeNative597c05ce6432c0d3_case1__field0d0f96c6a61c5999d6261___closed__0, &l_LeanBridgeNative597c05ce6432c0d3_case1__field0d0f96c6a61c5999d6261___closed__0_once, _init_l_LeanBridgeNative597c05ce6432c0d3_case1__field0d0f96c6a61c5999d6261___closed__0);
return v___x_779_;
}
else
{
lean_object* v_val_780_; uint8_t v___x_781_; 
v_val_780_ = lean_ctor_get(v___x_778_, 0);
lean_inc(v_val_780_);
lean_dec_ref_known(v___x_778_, 1);
v___x_781_ = l_LeanBridgeNative597c05ce6432c0d3_LbErased_RecursiveSubtypes_Chain_validFin(v_val_780_);
if (v___x_781_ == 0)
{
lean_object* v___x_782_; 
lean_dec(v_val_780_);
v___x_782_ = lean_obj_once(&l_LeanBridgeNative597c05ce6432c0d3_case1__field0d0f96c6a61c5999d6261___closed__0, &l_LeanBridgeNative597c05ce6432c0d3_case1__field0d0f96c6a61c5999d6261___closed__0_once, _init_l_LeanBridgeNative597c05ce6432c0d3_case1__field0d0f96c6a61c5999d6261___closed__0);
return v___x_782_;
}
else
{
lean_object* v___x_783_; 
v___x_783_ = l_LeanBridgeNative597c05ce6432c0d3_LbErased_RecursiveSubtypes_Chain_via__b0a9989b03a240ff1df500f95717b8fa3424b6f89cf1f6bdd2410fb902067a89(v_val_780_);
if (lean_obj_tag(v___x_783_) == 0)
{
lean_object* v___x_784_; 
v___x_784_ = lean_obj_once(&l_LeanBridgeNative597c05ce6432c0d3_case1__field0d0f96c6a61c5999d6261___closed__0, &l_LeanBridgeNative597c05ce6432c0d3_case1__field0d0f96c6a61c5999d6261___closed__0_once, _init_l_LeanBridgeNative597c05ce6432c0d3_case1__field0d0f96c6a61c5999d6261___closed__0);
return v___x_784_;
}
else
{
lean_object* v_val_785_; lean_object* v___x_787_; uint8_t v_isShared_788_; uint8_t v_isSharedCheck_794_; 
v_val_785_ = lean_ctor_get(v___x_783_, 0);
v_isSharedCheck_794_ = !lean_is_exclusive(v___x_783_);
if (v_isSharedCheck_794_ == 0)
{
v___x_787_ = v___x_783_;
v_isShared_788_ = v_isSharedCheck_794_;
goto v_resetjp_786_;
}
else
{
lean_inc(v_val_785_);
lean_dec(v___x_783_);
v___x_787_ = lean_box(0);
v_isShared_788_ = v_isSharedCheck_794_;
goto v_resetjp_786_;
}
v_resetjp_786_:
{
lean_object* v___x_789_; lean_object* v___x_791_; 
v___x_789_ = lb_recursive_subtype_probe_source_second(v_val_785_);
if (v_isShared_788_ == 0)
{
lean_ctor_set(v___x_787_, 0, v___x_789_);
v___x_791_ = v___x_787_;
goto v_reusejp_790_;
}
else
{
lean_object* v_reuseFailAlloc_793_; 
v_reuseFailAlloc_793_ = lean_alloc_ctor(1, 1, 0);
lean_ctor_set(v_reuseFailAlloc_793_, 0, v___x_789_);
v___x_791_ = v_reuseFailAlloc_793_;
goto v_reusejp_790_;
}
v_reusejp_790_:
{
lean_object* v___x_792_; 
v___x_792_ = l_LeanBridgeNative597c05ce6432c0d3_carrierResult___redArg(v___x_791_);
return v___x_792_;
}
}
}
}
}
}
}
lean_object* initialize_Init(uint8_t builtin);
lean_object* initialize_Init(uint8_t builtin);
lean_object* initialize_RecursiveSubtypes(uint8_t builtin);
static bool _G_initialized = false;
LEAN_EXPORT lean_object* initialize_LeanBridgeNative597c05ce6432c0d3(uint8_t builtin) {
lean_object * res;
if (_G_initialized) return lean_io_result_mk_ok(lean_box(0));
_G_initialized = true;
res = initialize_Init(builtin);
if (lean_io_result_is_error(res)) return res;
lean_dec_ref(res);
res = initialize_Init(builtin);
if (lean_io_result_is_error(res)) return res;
lean_dec_ref(res);
res = initialize_RecursiveSubtypes(builtin);
if (lean_io_result_is_error(res)) return res;
lean_dec_ref(res);
return lean_io_result_mk_ok(lean_box(0));
}
#ifdef __cplusplus
}
#endif

#include "component.h"
