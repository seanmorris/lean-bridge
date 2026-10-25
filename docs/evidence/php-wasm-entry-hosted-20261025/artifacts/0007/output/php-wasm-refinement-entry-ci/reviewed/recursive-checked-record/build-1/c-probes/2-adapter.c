#include <stdio.h>
// Lean compiler output
// Module: LeanBridgeNativea1d30b9a0f384ed5
// Imports: public import Init public meta import Init public import RecursiveCheckedRecords
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
uint8_t lean_usize_dec_lt(size_t, size_t);
lean_object* lean_array_uget_borrowed(lean_object*, size_t);
lean_object* lean_array_get_size(lean_object*);
uint8_t lean_nat_dec_lt(lean_object*, lean_object*);
uint8_t lean_nat_dec_eq(lean_object*, lean_object*);
lean_object* lean_array_fget_borrowed(lean_object*, lean_object*);
lean_object* lean_array_push(lean_object*, lean_object*);
size_t lean_usize_add(size_t, size_t);
lean_object* lean_mk_empty_array_with_capacity(lean_object*);
lean_object* l_Array_extract___redArg(lean_object*, lean_object*, lean_object*);
size_t lean_array_size(lean_object*);
lean_object* lean_array_uget(lean_object*, size_t);
lean_object* lean_array_uset(lean_object*, size_t, lean_object*);
size_t lean_usize_of_nat(lean_object*);
uint8_t lean_usize_dec_eq(size_t, size_t);
lean_object* lb_recursive_checked_record_probe_constructor_plusTwo(lean_object*);
lean_object* l_RecursiveCheckedRecords_normalizePacket___redArg(lean_object*, lean_object*);
lean_object* lb_recursive_checked_record_probe_source_echoGroups(lean_object*);
lean_object* lb_recursive_checked_record_probe_constructor_plusOne(lean_object*);
lean_object* lb_recursive_checked_record_probe_constructor_mkPacket(lean_object*, lean_object*, lean_object*);
lean_object* lb_recursive_checked_record_probe_source_first(lean_object*);
lean_object* lb_recursive_checked_record_probe_source_groups(lean_object*);
lean_object* lean_nat_sub(lean_object*, lean_object*);
lean_object* lb_recursive_checked_record_probe_source_produce(lean_object*);
lean_object* lb_recursive_checked_record_probe_source_second(lean_object*);
lean_object* lb_recursive_checked_record_probe_source_echo(lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNativea1d30b9a0f384ed5_LbErased_RecursiveCheckedRecords_Packet_erase(lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNativea1d30b9a0f384ed5_LbErased_RecursiveCheckedRecords_Packet_via__5b2d9cecaeed7529(lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNativea1d30b9a0f384ed5_LbErased_RecursiveCheckedRecords_Packet_via__738d92def9c0ab42(lean_object*);
LEAN_EXPORT uint8_t l_LeanBridgeNativea1d30b9a0f384ed5_LbErased_RecursiveCheckedRecords_Packet_validFin(lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNativea1d30b9a0f384ed5_LbErased_RecursiveCheckedRecords_Packet_validFin___boxed(lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNativea1d30b9a0f384ed5_carrierValue___redArg(lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNativea1d30b9a0f384ed5_carrierValue___redArg___boxed(lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNativea1d30b9a0f384ed5_carrierValue(lean_object*, lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNativea1d30b9a0f384ed5_carrierValue___boxed(lean_object*, lean_object*);
static const lean_array_object l_LeanBridgeNativea1d30b9a0f384ed5_carrierResult___redArg___closed__0_value = {.m_header = {.m_rc = 0, .m_cs_sz = sizeof(lean_array_object) + sizeof(void*)*0, .m_other = 0, .m_tag = 246}, .m_size = 0, .m_capacity = 0, .m_data = {}};
static const lean_object* l_LeanBridgeNativea1d30b9a0f384ed5_carrierResult___redArg___closed__0 = (const lean_object*)&l_LeanBridgeNativea1d30b9a0f384ed5_carrierResult___redArg___closed__0_value;
LEAN_EXPORT lean_object* l_LeanBridgeNativea1d30b9a0f384ed5_carrierResult___redArg(lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNativea1d30b9a0f384ed5_carrierResult(lean_object*, lean_object*);
static const lean_ctor_object l___private_Init_Data_Array_Basic_0__Array_forIn_x27Unsafe_loop___at___00LeanBridgeNativea1d30b9a0f384ed5_carrierCollect_spec__0___redArg___closed__0_value = {.m_header = {.m_rc = 0, .m_cs_sz = sizeof(lean_ctor_object) + sizeof(void*)*1 + 0, .m_other = 1, .m_tag = 1}, .m_objs = {((lean_object*)(((size_t)(0) << 1) | 1))}};
static const lean_object* l___private_Init_Data_Array_Basic_0__Array_forIn_x27Unsafe_loop___at___00LeanBridgeNativea1d30b9a0f384ed5_carrierCollect_spec__0___redArg___closed__0 = (const lean_object*)&l___private_Init_Data_Array_Basic_0__Array_forIn_x27Unsafe_loop___at___00LeanBridgeNativea1d30b9a0f384ed5_carrierCollect_spec__0___redArg___closed__0_value;
LEAN_EXPORT lean_object* l___private_Init_Data_Array_Basic_0__Array_forIn_x27Unsafe_loop___at___00LeanBridgeNativea1d30b9a0f384ed5_carrierCollect_spec__0___redArg(lean_object*, size_t, size_t, lean_object*);
LEAN_EXPORT lean_object* l___private_Init_Data_Array_Basic_0__Array_forIn_x27Unsafe_loop___at___00LeanBridgeNativea1d30b9a0f384ed5_carrierCollect_spec__0___redArg___boxed(lean_object*, lean_object*, lean_object*, lean_object*);
static const lean_ctor_object l_LeanBridgeNativea1d30b9a0f384ed5_carrierCollect___redArg___closed__0_value = {.m_header = {.m_rc = 0, .m_cs_sz = sizeof(lean_ctor_object) + sizeof(void*)*2 + 0, .m_other = 2, .m_tag = 0}, .m_objs = {((lean_object*)(((size_t)(0) << 1) | 1)),((lean_object*)&l_LeanBridgeNativea1d30b9a0f384ed5_carrierResult___redArg___closed__0_value)}};
static const lean_object* l_LeanBridgeNativea1d30b9a0f384ed5_carrierCollect___redArg___closed__0 = (const lean_object*)&l_LeanBridgeNativea1d30b9a0f384ed5_carrierCollect___redArg___closed__0_value;
LEAN_EXPORT lean_object* l_LeanBridgeNativea1d30b9a0f384ed5_carrierCollect___redArg(lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNativea1d30b9a0f384ed5_carrierCollect___redArg___boxed(lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNativea1d30b9a0f384ed5_carrierCollect(lean_object*, lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNativea1d30b9a0f384ed5_carrierCollect___boxed(lean_object*, lean_object*);
LEAN_EXPORT lean_object* l___private_Init_Data_Array_Basic_0__Array_forIn_x27Unsafe_loop___at___00LeanBridgeNativea1d30b9a0f384ed5_carrierCollect_spec__0(lean_object*, lean_object*, size_t, size_t, lean_object*);
LEAN_EXPORT lean_object* l___private_Init_Data_Array_Basic_0__Array_forIn_x27Unsafe_loop___at___00LeanBridgeNativea1d30b9a0f384ed5_carrierCollect_spec__0___boxed(lean_object*, lean_object*, lean_object*, lean_object*, lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNativea1d30b9a0f384ed5_carrierListItems_loop___redArg(lean_object*, lean_object*, lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNativea1d30b9a0f384ed5_carrierListItems_loop(lean_object*, lean_object*, lean_object*, lean_object*);
static const lean_array_object l_LeanBridgeNativea1d30b9a0f384ed5_carrierListItems___redArg___closed__0_value = {.m_header = {.m_rc = 0, .m_cs_sz = sizeof(lean_array_object) + sizeof(void*)*0, .m_other = 0, .m_tag = 246}, .m_size = 0, .m_capacity = 0, .m_data = {}};
static const lean_object* l_LeanBridgeNativea1d30b9a0f384ed5_carrierListItems___redArg___closed__0 = (const lean_object*)&l_LeanBridgeNativea1d30b9a0f384ed5_carrierListItems___redArg___closed__0_value;
LEAN_EXPORT lean_object* l_LeanBridgeNativea1d30b9a0f384ed5_carrierListItems___redArg(lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNativea1d30b9a0f384ed5_carrierListItems(lean_object*, lean_object*);
static lean_once_cell_t l_LeanBridgeNativea1d30b9a0f384ed5_make3cdb6e7435d0b988c5ab___closed__0_once = LEAN_ONCE_CELL_INITIALIZER;
static lean_object* l_LeanBridgeNativea1d30b9a0f384ed5_make3cdb6e7435d0b988c5ab___closed__0;
LEAN_EXPORT lean_object* lean_bridge_9a14c44da851e2d4fdfbfb9b_recursive_3cdb6e7435d0b988c5ab_make(lean_object*, lean_object*, lean_object*);
static lean_once_cell_t l_LeanBridgeNativea1d30b9a0f384ed5_field03cdb6e7435d0b988c5ab___closed__0_once = LEAN_ONCE_CELL_INITIALIZER;
static lean_object* l_LeanBridgeNativea1d30b9a0f384ed5_field03cdb6e7435d0b988c5ab___closed__0;
LEAN_EXPORT lean_object* lean_bridge_9a14c44da851e2d4fdfbfb9b_recursive_3cdb6e7435d0b988c5ab_field0(lean_object*);
LEAN_EXPORT lean_object* lean_bridge_9a14c44da851e2d4fdfbfb9b_recursive_3cdb6e7435d0b988c5ab_field1(lean_object*);
static lean_once_cell_t l_LeanBridgeNativea1d30b9a0f384ed5_field23cdb6e7435d0b988c5ab___closed__0_once = LEAN_ONCE_CELL_INITIALIZER;
static lean_object* l_LeanBridgeNativea1d30b9a0f384ed5_field23cdb6e7435d0b988c5ab___closed__0;
LEAN_EXPORT lean_object* lean_bridge_9a14c44da851e2d4fdfbfb9b_recursive_3cdb6e7435d0b988c5ab_field2(lean_object*);
LEAN_EXPORT uint32_t lean_bridge_9a14c44da851e2d4fdfbfb9b_recursive_796129d6f57eb5b14908_branch(lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNativea1d30b9a0f384ed5_branch796129d6f57eb5b14908___boxed(lean_object*);
static const lean_ctor_object l_LeanBridgeNativea1d30b9a0f384ed5_none796129d6f57eb5b14908___closed__0_value = {.m_header = {.m_rc = 0, .m_cs_sz = sizeof(lean_ctor_object) + sizeof(void*)*1 + 0, .m_other = 1, .m_tag = 1}, .m_objs = {((lean_object*)(((size_t)(0) << 1) | 1))}};
static const lean_object* l_LeanBridgeNativea1d30b9a0f384ed5_none796129d6f57eb5b14908___closed__0 = (const lean_object*)&l_LeanBridgeNativea1d30b9a0f384ed5_none796129d6f57eb5b14908___closed__0_value;
static lean_once_cell_t l_LeanBridgeNativea1d30b9a0f384ed5_none796129d6f57eb5b14908___closed__1_once = LEAN_ONCE_CELL_INITIALIZER;
static lean_object* l_LeanBridgeNativea1d30b9a0f384ed5_none796129d6f57eb5b14908___closed__1;
LEAN_EXPORT lean_object* lean_bridge_9a14c44da851e2d4fdfbfb9b_recursive_796129d6f57eb5b14908_none(lean_object*);
LEAN_EXPORT lean_object* lean_bridge_9a14c44da851e2d4fdfbfb9b_recursive_796129d6f57eb5b14908_make0(lean_object*);
LEAN_EXPORT lean_object* lean_bridge_9a14c44da851e2d4fdfbfb9b_recursive_796129d6f57eb5b14908_field0(lean_object*);
LEAN_EXPORT lean_object* lean_bridge_9a14c44da851e2d4fdfbfb9b_recursive_1ee7f471296218fa6414_make(lean_object*);
LEAN_EXPORT lean_object* l___private_Init_Data_Array_Basic_0__Array_mapMUnsafe_map___at___00LeanBridgeNativea1d30b9a0f384ed5_items1ee7f471296218fa6414_spec__0(size_t, size_t, lean_object*);
LEAN_EXPORT lean_object* l___private_Init_Data_Array_Basic_0__Array_mapMUnsafe_map___at___00LeanBridgeNativea1d30b9a0f384ed5_items1ee7f471296218fa6414_spec__0___boxed(lean_object*, lean_object*, lean_object*);
static const lean_array_object l_LeanBridgeNativea1d30b9a0f384ed5_items1ee7f471296218fa6414___closed__0_value = {.m_header = {.m_rc = 0, .m_cs_sz = sizeof(lean_array_object) + sizeof(void*)*0, .m_other = 0, .m_tag = 246}, .m_size = 0, .m_capacity = 0, .m_data = {}};
static const lean_object* l_LeanBridgeNativea1d30b9a0f384ed5_items1ee7f471296218fa6414___closed__0 = (const lean_object*)&l_LeanBridgeNativea1d30b9a0f384ed5_items1ee7f471296218fa6414___closed__0_value;
LEAN_EXPORT lean_object* lean_bridge_9a14c44da851e2d4fdfbfb9b_recursive_1ee7f471296218fa6414_items(lean_object*);
LEAN_EXPORT uint32_t lean_bridge_9a14c44da851e2d4fdfbfb9b_recursive_30b9cb19321dad5070fa_branch(lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNativea1d30b9a0f384ed5_branch30b9cb19321dad5070fa___boxed(lean_object*);
LEAN_EXPORT lean_object* lean_bridge_9a14c44da851e2d4fdfbfb9b_recursive_30b9cb19321dad5070fa_none(lean_object*);
LEAN_EXPORT lean_object* lean_bridge_9a14c44da851e2d4fdfbfb9b_recursive_30b9cb19321dad5070fa_make0(lean_object*);
LEAN_EXPORT lean_object* lean_bridge_9a14c44da851e2d4fdfbfb9b_recursive_30b9cb19321dad5070fa_field0(lean_object*);
LEAN_EXPORT lean_object* lean_bridge_9a14c44da851e2d4fdfbfb9b_recursive_adc23788b11cdeb3b9ab_make(lean_object*);
LEAN_EXPORT lean_object* lean_bridge_9a14c44da851e2d4fdfbfb9b_recursive_adc23788b11cdeb3b9ab_field0(lean_object*);
LEAN_EXPORT uint8_t lean_bridge_9a14c44da851e2d4fdfbfb9b_fin_guard_0(lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNativea1d30b9a0f384ed5_export0__fin__guard__0___boxed(lean_object*);
LEAN_EXPORT uint8_t lean_bridge_9a14c44da851e2d4fdfbfb9b_refinement_0(lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNativea1d30b9a0f384ed5_export0__refinement__0___boxed(lean_object*);
LEAN_EXPORT uint8_t lean_bridge_9a14c44da851e2d4fdfbfb9b_graph_refinement_0_71ba01578b385b329e98(lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNativea1d30b9a0f384ed5_export0__graph__refinement__0__71ba01578b385b329e98___boxed(lean_object*);
LEAN_EXPORT uint8_t lean_bridge_9a14c44da851e2d4fdfbfb9b_graph_refinement_0_8b6f9e05ee7b31aa9e96(lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNativea1d30b9a0f384ed5_export0__graph__refinement__0__8b6f9e05ee7b31aa9e96___boxed(lean_object*);
LEAN_EXPORT lean_object* lean_bridge_9a14c44da851e2d4fdfbfb9b_lean(lean_object*);
LEAN_EXPORT uint8_t l___private_Init_Data_Array_Basic_0__Array_anyMUnsafe_any___at___00LeanBridgeNativea1d30b9a0f384ed5_export1__fin__guard__0_spec__0(lean_object*, size_t, size_t);
LEAN_EXPORT lean_object* l___private_Init_Data_Array_Basic_0__Array_anyMUnsafe_any___at___00LeanBridgeNativea1d30b9a0f384ed5_export1__fin__guard__0_spec__0___boxed(lean_object*, lean_object*, lean_object*);
LEAN_EXPORT uint8_t lean_bridge_b1c46fbb29fb86a306017349_fin_guard_0(lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNativea1d30b9a0f384ed5_export1__fin__guard__0___boxed(lean_object*);
LEAN_EXPORT lean_object* l___private_Init_Data_Array_Basic_0__Array_mapMUnsafe_map___at___00LeanBridgeNativea1d30b9a0f384ed5_export1__refinement__0_spec__0(size_t, size_t, lean_object*);
LEAN_EXPORT lean_object* l___private_Init_Data_Array_Basic_0__Array_mapMUnsafe_map___at___00LeanBridgeNativea1d30b9a0f384ed5_export1__refinement__0_spec__0___boxed(lean_object*, lean_object*, lean_object*);
LEAN_EXPORT uint8_t lean_bridge_b1c46fbb29fb86a306017349_refinement_0(lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNativea1d30b9a0f384ed5_export1__refinement__0___boxed(lean_object*);
LEAN_EXPORT uint8_t lean_bridge_b1c46fbb29fb86a306017349_graph_refinement_0_262d1fa6be548d6d1dd0(lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNativea1d30b9a0f384ed5_export1__graph__refinement__0__262d1fa6be548d6d1dd0___boxed(lean_object*);
LEAN_EXPORT uint8_t lean_bridge_b1c46fbb29fb86a306017349_graph_refinement_0_88f1c5c2e3a6ba3c4460(lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNativea1d30b9a0f384ed5_export1__graph__refinement__0__88f1c5c2e3a6ba3c4460___boxed(lean_object*);
LEAN_EXPORT lean_object* l___private_Init_Data_Array_Basic_0__Array_mapMUnsafe_map___at___00LeanBridgeNativea1d30b9a0f384ed5_export1_spec__0(size_t, size_t, lean_object*);
LEAN_EXPORT lean_object* l___private_Init_Data_Array_Basic_0__Array_mapMUnsafe_map___at___00LeanBridgeNativea1d30b9a0f384ed5_export1_spec__0___boxed(lean_object*, lean_object*, lean_object*);
static lean_once_cell_t l_LeanBridgeNativea1d30b9a0f384ed5_export1___closed__0_once = LEAN_ONCE_CELL_INITIALIZER;
static lean_object* l_LeanBridgeNativea1d30b9a0f384ed5_export1___closed__0;
LEAN_EXPORT lean_object* lean_bridge_b1c46fbb29fb86a306017349_lean(lean_object*);
LEAN_EXPORT uint8_t lean_bridge_8540c0aac676a8863cdff838_fin_guard_0(lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNativea1d30b9a0f384ed5_export2__fin__guard__0___boxed(lean_object*);
LEAN_EXPORT uint8_t lean_bridge_8540c0aac676a8863cdff838_refinement_0(lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNativea1d30b9a0f384ed5_export2__refinement__0___boxed(lean_object*);
LEAN_EXPORT uint8_t lean_bridge_8540c0aac676a8863cdff838_graph_refinement_0_71ba01578b385b329e98(lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNativea1d30b9a0f384ed5_export2__graph__refinement__0__71ba01578b385b329e98___boxed(lean_object*);
LEAN_EXPORT uint8_t lean_bridge_8540c0aac676a8863cdff838_graph_refinement_0_8b6f9e05ee7b31aa9e96(lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNativea1d30b9a0f384ed5_export2__graph__refinement__0__8b6f9e05ee7b31aa9e96___boxed(lean_object*);
LEAN_EXPORT lean_object* lean_bridge_8540c0aac676a8863cdff838_lean(lean_object*);
LEAN_EXPORT uint8_t lean_bridge_24b13094b4039f73d0959480_fin_guard_0(lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNativea1d30b9a0f384ed5_export3__fin__guard__0___boxed(lean_object*);
LEAN_EXPORT lean_object* l___private_Init_Data_Array_Basic_0__Array_mapMUnsafe_map___at___00LeanBridgeNativea1d30b9a0f384ed5_export3__refinement__0_spec__0(size_t, size_t, lean_object*);
LEAN_EXPORT lean_object* l___private_Init_Data_Array_Basic_0__Array_mapMUnsafe_map___at___00LeanBridgeNativea1d30b9a0f384ed5_export3__refinement__0_spec__0___boxed(lean_object*, lean_object*, lean_object*);
LEAN_EXPORT uint8_t lean_bridge_24b13094b4039f73d0959480_refinement_0(lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNativea1d30b9a0f384ed5_export3__refinement__0___boxed(lean_object*);
LEAN_EXPORT uint8_t lean_bridge_24b13094b4039f73d0959480_graph_refinement_0_71ba01578b385b329e98(lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNativea1d30b9a0f384ed5_export3__graph__refinement__0__71ba01578b385b329e98___boxed(lean_object*);
LEAN_EXPORT uint8_t lean_bridge_24b13094b4039f73d0959480_graph_refinement_0_8b6f9e05ee7b31aa9e96(lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNativea1d30b9a0f384ed5_export3__graph__refinement__0__8b6f9e05ee7b31aa9e96___boxed(lean_object*);
LEAN_EXPORT lean_object* lean_bridge_24b13094b4039f73d0959480_lean(lean_object*);
LEAN_EXPORT uint8_t lean_bridge_df0f714db6fdbd3762d5e0a5_fin_guard_0(lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNativea1d30b9a0f384ed5_export4__fin__guard__0___boxed(lean_object*);
LEAN_EXPORT lean_object* lean_bridge_df0f714db6fdbd3762d5e0a5_lean(lean_object*);
LEAN_EXPORT uint8_t lean_bridge_c3338006aea7f276ff222c0c_fin_guard_0(lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNativea1d30b9a0f384ed5_export5__fin__guard__0___boxed(lean_object*);
LEAN_EXPORT uint8_t lean_bridge_c3338006aea7f276ff222c0c_refinement_0(lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNativea1d30b9a0f384ed5_export5__refinement__0___boxed(lean_object*);
LEAN_EXPORT uint8_t lean_bridge_c3338006aea7f276ff222c0c_graph_refinement_0_262d1fa6be548d6d1dd0(lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNativea1d30b9a0f384ed5_export5__graph__refinement__0__262d1fa6be548d6d1dd0___boxed(lean_object*);
LEAN_EXPORT uint8_t lean_bridge_c3338006aea7f276ff222c0c_graph_refinement_0_88f1c5c2e3a6ba3c4460(lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNativea1d30b9a0f384ed5_export5__graph__refinement__0__88f1c5c2e3a6ba3c4460___boxed(lean_object*);
LEAN_EXPORT lean_object* lean_bridge_c3338006aea7f276ff222c0c_lean(lean_object*);
LEAN_EXPORT lean_object* l_LeanBridgeNativea1d30b9a0f384ed5_LbErased_RecursiveCheckedRecords_Packet_erase(lean_object* v_value_1_){
_start:
{
lean_object* v_tail_2_; 
v_tail_2_ = lean_ctor_get(v_value_1_, 2);
lean_inc(v_tail_2_);
if (lean_obj_tag(v_tail_2_) == 0)
{
lean_object* v_value_3_; lean_object* v_digit_4_; lean_object* v___x_6_; uint8_t v_isShared_7_; uint8_t v_isSharedCheck_12_; 
v_value_3_ = lean_ctor_get(v_value_1_, 0);
v_digit_4_ = lean_ctor_get(v_value_1_, 1);
v_isSharedCheck_12_ = !lean_is_exclusive(v_value_1_);
if (v_isSharedCheck_12_ == 0)
{
lean_object* v_unused_13_; 
v_unused_13_ = lean_ctor_get(v_value_1_, 2);
lean_dec(v_unused_13_);
v___x_6_ = v_value_1_;
v_isShared_7_ = v_isSharedCheck_12_;
goto v_resetjp_5_;
}
else
{
lean_inc(v_digit_4_);
lean_inc(v_value_3_);
lean_dec(v_value_1_);
v___x_6_ = lean_box(0);
v_isShared_7_ = v_isSharedCheck_12_;
goto v_resetjp_5_;
}
v_resetjp_5_:
{
lean_object* v___x_8_; lean_object* v___x_10_; 
v___x_8_ = lean_box(0);
if (v_isShared_7_ == 0)
{
lean_ctor_set(v___x_6_, 2, v___x_8_);
v___x_10_ = v___x_6_;
goto v_reusejp_9_;
}
else
{
lean_object* v_reuseFailAlloc_11_; 
v_reuseFailAlloc_11_ = lean_alloc_ctor(0, 3, 0);
lean_ctor_set(v_reuseFailAlloc_11_, 0, v_value_3_);
lean_ctor_set(v_reuseFailAlloc_11_, 1, v_digit_4_);
lean_ctor_set(v_reuseFailAlloc_11_, 2, v___x_8_);
v___x_10_ = v_reuseFailAlloc_11_;
goto v_reusejp_9_;
}
v_reusejp_9_:
{
return v___x_10_;
}
}
}
else
{
lean_object* v_value_14_; lean_object* v_digit_15_; lean_object* v___x_17_; uint8_t v_isShared_18_; uint8_t v_isSharedCheck_31_; 
v_value_14_ = lean_ctor_get(v_value_1_, 0);
v_digit_15_ = lean_ctor_get(v_value_1_, 1);
v_isSharedCheck_31_ = !lean_is_exclusive(v_value_1_);
if (v_isSharedCheck_31_ == 0)
{
lean_object* v_unused_32_; 
v_unused_32_ = lean_ctor_get(v_value_1_, 2);
lean_dec(v_unused_32_);
v___x_17_ = v_value_1_;
v_isShared_18_ = v_isSharedCheck_31_;
goto v_resetjp_16_;
}
else
{
lean_inc(v_digit_15_);
lean_inc(v_value_14_);
lean_dec(v_value_1_);
v___x_17_ = lean_box(0);
v_isShared_18_ = v_isSharedCheck_31_;
goto v_resetjp_16_;
}
v_resetjp_16_:
{
lean_object* v_val_19_; lean_object* v___x_21_; uint8_t v_isShared_22_; uint8_t v_isSharedCheck_30_; 
v_val_19_ = lean_ctor_get(v_tail_2_, 0);
v_isSharedCheck_30_ = !lean_is_exclusive(v_tail_2_);
if (v_isSharedCheck_30_ == 0)
{
v___x_21_ = v_tail_2_;
v_isShared_22_ = v_isSharedCheck_30_;
goto v_resetjp_20_;
}
else
{
lean_inc(v_val_19_);
lean_dec(v_tail_2_);
v___x_21_ = lean_box(0);
v_isShared_22_ = v_isSharedCheck_30_;
goto v_resetjp_20_;
}
v_resetjp_20_:
{
lean_object* v___x_23_; lean_object* v___x_25_; 
v___x_23_ = l_LeanBridgeNativea1d30b9a0f384ed5_LbErased_RecursiveCheckedRecords_Packet_erase(v_val_19_);
if (v_isShared_22_ == 0)
{
lean_ctor_set(v___x_21_, 0, v___x_23_);
v___x_25_ = v___x_21_;
goto v_reusejp_24_;
}
else
{
lean_object* v_reuseFailAlloc_29_; 
v_reuseFailAlloc_29_ = lean_alloc_ctor(1, 1, 0);
lean_ctor_set(v_reuseFailAlloc_29_, 0, v___x_23_);
v___x_25_ = v_reuseFailAlloc_29_;
goto v_reusejp_24_;
}
v_reusejp_24_:
{
lean_object* v___x_27_; 
if (v_isShared_18_ == 0)
{
lean_ctor_set(v___x_17_, 2, v___x_25_);
v___x_27_ = v___x_17_;
goto v_reusejp_26_;
}
else
{
lean_object* v_reuseFailAlloc_28_; 
v_reuseFailAlloc_28_ = lean_alloc_ctor(0, 3, 0);
lean_ctor_set(v_reuseFailAlloc_28_, 0, v_value_14_);
lean_ctor_set(v_reuseFailAlloc_28_, 1, v_digit_15_);
lean_ctor_set(v_reuseFailAlloc_28_, 2, v___x_25_);
v___x_27_ = v_reuseFailAlloc_28_;
goto v_reusejp_26_;
}
v_reusejp_26_:
{
return v___x_27_;
}
}
}
}
}
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNativea1d30b9a0f384ed5_LbErased_RecursiveCheckedRecords_Packet_via__5b2d9cecaeed7529(lean_object* v_value_33_){
_start:
{
lean_object* v_value_34_; lean_object* v_digit_35_; lean_object* v_tail_36_; lean_object* v___x_37_; 
v_value_34_ = lean_ctor_get(v_value_33_, 0);
lean_inc(v_value_34_);
v_digit_35_ = lean_ctor_get(v_value_33_, 1);
lean_inc(v_digit_35_);
v_tail_36_ = lean_ctor_get(v_value_33_, 2);
lean_inc(v_tail_36_);
lean_dec_ref(v_value_33_);
v___x_37_ = lb_recursive_checked_record_probe_constructor_plusTwo(v_value_34_);
if (lean_obj_tag(v___x_37_) == 0)
{
lean_object* v___x_38_; 
lean_dec(v_tail_36_);
lean_dec(v_digit_35_);
v___x_38_ = lean_box(0);
return v___x_38_;
}
else
{
lean_object* v___x_39_; uint8_t v___x_40_; 
lean_dec_ref_known(v___x_37_, 1);
v___x_39_ = lean_unsigned_to_nat(3u);
v___x_40_ = lean_nat_dec_lt(v_digit_35_, v___x_39_);
if (v___x_40_ == 0)
{
lean_object* v___x_41_; 
lean_dec(v_tail_36_);
lean_dec(v_digit_35_);
v___x_41_ = lean_box(0);
return v___x_41_;
}
else
{
if (lean_obj_tag(v_tail_36_) == 0)
{
lean_object* v___x_42_; lean_object* v___x_43_; 
v___x_42_ = lean_box(0);
v___x_43_ = l_RecursiveCheckedRecords_normalizePacket___redArg(v_digit_35_, v___x_42_);
return v___x_43_;
}
else
{
lean_object* v_val_44_; lean_object* v___x_45_; 
v_val_44_ = lean_ctor_get(v_tail_36_, 0);
lean_inc(v_val_44_);
lean_dec_ref_known(v_tail_36_, 1);
v___x_45_ = l_LeanBridgeNativea1d30b9a0f384ed5_LbErased_RecursiveCheckedRecords_Packet_via__5b2d9cecaeed7529(v_val_44_);
if (lean_obj_tag(v___x_45_) == 0)
{
lean_dec(v_digit_35_);
return v___x_45_;
}
else
{
lean_object* v___x_46_; 
v___x_46_ = l_RecursiveCheckedRecords_normalizePacket___redArg(v_digit_35_, v___x_45_);
return v___x_46_;
}
}
}
}
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNativea1d30b9a0f384ed5_LbErased_RecursiveCheckedRecords_Packet_via__738d92def9c0ab42(lean_object* v_value_47_){
_start:
{
lean_object* v_value_48_; lean_object* v_digit_49_; lean_object* v_tail_50_; lean_object* v___x_51_; 
v_value_48_ = lean_ctor_get(v_value_47_, 0);
lean_inc(v_value_48_);
v_digit_49_ = lean_ctor_get(v_value_47_, 1);
lean_inc(v_digit_49_);
v_tail_50_ = lean_ctor_get(v_value_47_, 2);
lean_inc(v_tail_50_);
lean_dec_ref(v_value_47_);
v___x_51_ = lb_recursive_checked_record_probe_constructor_plusOne(v_value_48_);
if (lean_obj_tag(v___x_51_) == 0)
{
lean_object* v___x_52_; 
lean_dec(v_tail_50_);
lean_dec(v_digit_49_);
v___x_52_ = lean_box(0);
return v___x_52_;
}
else
{
lean_object* v_val_53_; lean_object* v___x_54_; uint8_t v___x_55_; 
v_val_53_ = lean_ctor_get(v___x_51_, 0);
lean_inc(v_val_53_);
lean_dec_ref_known(v___x_51_, 1);
v___x_54_ = lean_unsigned_to_nat(3u);
v___x_55_ = lean_nat_dec_lt(v_digit_49_, v___x_54_);
if (v___x_55_ == 0)
{
lean_object* v___x_56_; 
lean_dec(v_val_53_);
lean_dec(v_tail_50_);
lean_dec(v_digit_49_);
v___x_56_ = lean_box(0);
return v___x_56_;
}
else
{
if (lean_obj_tag(v_tail_50_) == 0)
{
lean_object* v___x_57_; lean_object* v___x_58_; 
v___x_57_ = lean_box(0);
v___x_58_ = lb_recursive_checked_record_probe_constructor_mkPacket(v_val_53_, v_digit_49_, v___x_57_);
return v___x_58_;
}
else
{
lean_object* v_val_59_; lean_object* v___x_60_; 
v_val_59_ = lean_ctor_get(v_tail_50_, 0);
lean_inc(v_val_59_);
lean_dec_ref_known(v_tail_50_, 1);
v___x_60_ = l_LeanBridgeNativea1d30b9a0f384ed5_LbErased_RecursiveCheckedRecords_Packet_via__738d92def9c0ab42(v_val_59_);
if (lean_obj_tag(v___x_60_) == 0)
{
lean_dec(v_val_53_);
lean_dec(v_digit_49_);
return v___x_60_;
}
else
{
lean_object* v___x_61_; 
v___x_61_ = lb_recursive_checked_record_probe_constructor_mkPacket(v_val_53_, v_digit_49_, v___x_60_);
return v___x_61_;
}
}
}
}
}
}
LEAN_EXPORT uint8_t l_LeanBridgeNativea1d30b9a0f384ed5_LbErased_RecursiveCheckedRecords_Packet_validFin(lean_object* v_value_62_){
_start:
{
lean_object* v_digit_63_; lean_object* v_tail_64_; lean_object* v___x_65_; uint8_t v___x_66_; 
v_digit_63_ = lean_ctor_get(v_value_62_, 1);
v_tail_64_ = lean_ctor_get(v_value_62_, 2);
v___x_65_ = lean_unsigned_to_nat(3u);
v___x_66_ = lean_nat_dec_lt(v_digit_63_, v___x_65_);
if (v___x_66_ == 0)
{
return v___x_66_;
}
else
{
if (lean_obj_tag(v_tail_64_) == 0)
{
return v___x_66_;
}
else
{
lean_object* v_val_67_; 
v_val_67_ = lean_ctor_get(v_tail_64_, 0);
v_value_62_ = v_val_67_;
goto _start;
}
}
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNativea1d30b9a0f384ed5_LbErased_RecursiveCheckedRecords_Packet_validFin___boxed(lean_object* v_value_69_){
_start:
{
uint8_t v_res_70_; lean_object* v_r_71_; 
v_res_70_ = l_LeanBridgeNativea1d30b9a0f384ed5_LbErased_RecursiveCheckedRecords_Packet_validFin(v_value_69_);
lean_dec_ref(v_value_69_);
v_r_71_ = lean_box(v_res_70_);
return v_r_71_;
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNativea1d30b9a0f384ed5_carrierValue___redArg(lean_object* v_value_72_){
_start:
{
lean_object* v___x_73_; lean_object* v___x_74_; uint8_t v___x_75_; 
v___x_73_ = lean_unsigned_to_nat(0u);
v___x_74_ = lean_array_get_size(v_value_72_);
v___x_75_ = lean_nat_dec_lt(v___x_73_, v___x_74_);
if (v___x_75_ == 0)
{
lean_object* v___x_76_; 
v___x_76_ = lean_box(0);
return v___x_76_;
}
else
{
lean_object* v___x_77_; uint8_t v___x_78_; 
v___x_77_ = lean_unsigned_to_nat(1u);
v___x_78_ = lean_nat_dec_eq(v___x_74_, v___x_77_);
if (v___x_78_ == 0)
{
lean_object* v___x_79_; 
v___x_79_ = lean_box(0);
return v___x_79_;
}
else
{
lean_object* v___x_80_; lean_object* v___x_81_; 
v___x_80_ = lean_array_fget_borrowed(v_value_72_, v___x_73_);
lean_inc(v___x_80_);
v___x_81_ = lean_alloc_ctor(1, 1, 0);
lean_ctor_set(v___x_81_, 0, v___x_80_);
return v___x_81_;
}
}
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNativea1d30b9a0f384ed5_carrierValue___redArg___boxed(lean_object* v_value_82_){
_start:
{
lean_object* v_res_83_; 
v_res_83_ = l_LeanBridgeNativea1d30b9a0f384ed5_carrierValue___redArg(v_value_82_);
lean_dec_ref(v_value_82_);
return v_res_83_;
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNativea1d30b9a0f384ed5_carrierValue(lean_object* v_00_u03b1_84_, lean_object* v_value_85_){
_start:
{
lean_object* v___x_86_; 
v___x_86_ = l_LeanBridgeNativea1d30b9a0f384ed5_carrierValue___redArg(v_value_85_);
return v___x_86_;
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNativea1d30b9a0f384ed5_carrierValue___boxed(lean_object* v_00_u03b1_87_, lean_object* v_value_88_){
_start:
{
lean_object* v_res_89_; 
v_res_89_ = l_LeanBridgeNativea1d30b9a0f384ed5_carrierValue(v_00_u03b1_87_, v_value_88_);
lean_dec_ref(v_value_88_);
return v_res_89_;
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNativea1d30b9a0f384ed5_carrierResult___redArg(lean_object* v_value_92_){
_start:
{
if (lean_obj_tag(v_value_92_) == 0)
{
lean_object* v___x_93_; 
v___x_93_ = ((lean_object*)(l_LeanBridgeNativea1d30b9a0f384ed5_carrierResult___redArg___closed__0));
return v___x_93_;
}
else
{
lean_object* v_val_94_; lean_object* v___x_95_; lean_object* v___x_96_; lean_object* v___x_97_; 
v_val_94_ = lean_ctor_get(v_value_92_, 0);
lean_inc(v_val_94_);
lean_dec_ref_known(v_value_92_, 1);
v___x_95_ = lean_unsigned_to_nat(1u);
v___x_96_ = lean_mk_empty_array_with_capacity(v___x_95_);
v___x_97_ = lean_array_push(v___x_96_, v_val_94_);
return v___x_97_;
}
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNativea1d30b9a0f384ed5_carrierResult(lean_object* v_00_u03b1_98_, lean_object* v_value_99_){
_start:
{
lean_object* v___x_100_; 
v___x_100_ = l_LeanBridgeNativea1d30b9a0f384ed5_carrierResult___redArg(v_value_99_);
return v___x_100_;
}
}
LEAN_EXPORT lean_object* l___private_Init_Data_Array_Basic_0__Array_forIn_x27Unsafe_loop___at___00LeanBridgeNativea1d30b9a0f384ed5_carrierCollect_spec__0___redArg(lean_object* v_as_103_, size_t v_sz_104_, size_t v_i_105_, lean_object* v_b_106_){
_start:
{
uint8_t v___x_107_; 
v___x_107_ = lean_usize_dec_lt(v_i_105_, v_sz_104_);
if (v___x_107_ == 0)
{
return v_b_106_;
}
else
{
lean_object* v_snd_108_; lean_object* v___x_110_; uint8_t v_isShared_111_; uint8_t v_isSharedCheck_127_; 
v_snd_108_ = lean_ctor_get(v_b_106_, 1);
v_isSharedCheck_127_ = !lean_is_exclusive(v_b_106_);
if (v_isSharedCheck_127_ == 0)
{
lean_object* v_unused_128_; 
v_unused_128_ = lean_ctor_get(v_b_106_, 0);
lean_dec(v_unused_128_);
v___x_110_ = v_b_106_;
v_isShared_111_ = v_isSharedCheck_127_;
goto v_resetjp_109_;
}
else
{
lean_inc(v_snd_108_);
lean_dec(v_b_106_);
v___x_110_ = lean_box(0);
v_isShared_111_ = v_isSharedCheck_127_;
goto v_resetjp_109_;
}
v_resetjp_109_:
{
lean_object* v_a_112_; lean_object* v___x_113_; 
v_a_112_ = lean_array_uget_borrowed(v_as_103_, v_i_105_);
v___x_113_ = l_LeanBridgeNativea1d30b9a0f384ed5_carrierValue___redArg(v_a_112_);
if (lean_obj_tag(v___x_113_) == 0)
{
lean_object* v___x_114_; lean_object* v___x_116_; 
v___x_114_ = ((lean_object*)(l___private_Init_Data_Array_Basic_0__Array_forIn_x27Unsafe_loop___at___00LeanBridgeNativea1d30b9a0f384ed5_carrierCollect_spec__0___redArg___closed__0));
if (v_isShared_111_ == 0)
{
lean_ctor_set(v___x_110_, 0, v___x_114_);
v___x_116_ = v___x_110_;
goto v_reusejp_115_;
}
else
{
lean_object* v_reuseFailAlloc_117_; 
v_reuseFailAlloc_117_ = lean_alloc_ctor(0, 2, 0);
lean_ctor_set(v_reuseFailAlloc_117_, 0, v___x_114_);
lean_ctor_set(v_reuseFailAlloc_117_, 1, v_snd_108_);
v___x_116_ = v_reuseFailAlloc_117_;
goto v_reusejp_115_;
}
v_reusejp_115_:
{
return v___x_116_;
}
}
else
{
lean_object* v_val_118_; lean_object* v___x_119_; lean_object* v___x_120_; lean_object* v___x_122_; 
v_val_118_ = lean_ctor_get(v___x_113_, 0);
lean_inc(v_val_118_);
lean_dec_ref_known(v___x_113_, 1);
v___x_119_ = lean_box(0);
v___x_120_ = lean_array_push(v_snd_108_, v_val_118_);
if (v_isShared_111_ == 0)
{
lean_ctor_set(v___x_110_, 1, v___x_120_);
lean_ctor_set(v___x_110_, 0, v___x_119_);
v___x_122_ = v___x_110_;
goto v_reusejp_121_;
}
else
{
lean_object* v_reuseFailAlloc_126_; 
v_reuseFailAlloc_126_ = lean_alloc_ctor(0, 2, 0);
lean_ctor_set(v_reuseFailAlloc_126_, 0, v___x_119_);
lean_ctor_set(v_reuseFailAlloc_126_, 1, v___x_120_);
v___x_122_ = v_reuseFailAlloc_126_;
goto v_reusejp_121_;
}
v_reusejp_121_:
{
size_t v___x_123_; size_t v___x_124_; 
v___x_123_ = ((size_t)1ULL);
v___x_124_ = lean_usize_add(v_i_105_, v___x_123_);
v_i_105_ = v___x_124_;
v_b_106_ = v___x_122_;
goto _start;
}
}
}
}
}
}
LEAN_EXPORT lean_object* l___private_Init_Data_Array_Basic_0__Array_forIn_x27Unsafe_loop___at___00LeanBridgeNativea1d30b9a0f384ed5_carrierCollect_spec__0___redArg___boxed(lean_object* v_as_129_, lean_object* v_sz_130_, lean_object* v_i_131_, lean_object* v_b_132_){
_start:
{
size_t v_sz_boxed_133_; size_t v_i_boxed_134_; lean_object* v_res_135_; 
v_sz_boxed_133_ = lean_unbox_usize(v_sz_130_);
lean_dec(v_sz_130_);
v_i_boxed_134_ = lean_unbox_usize(v_i_131_);
lean_dec(v_i_131_);
v_res_135_ = l___private_Init_Data_Array_Basic_0__Array_forIn_x27Unsafe_loop___at___00LeanBridgeNativea1d30b9a0f384ed5_carrierCollect_spec__0___redArg(v_as_129_, v_sz_boxed_133_, v_i_boxed_134_, v_b_132_);
lean_dec_ref(v_as_129_);
return v_res_135_;
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNativea1d30b9a0f384ed5_carrierCollect___redArg(lean_object* v_values_139_){
_start:
{
lean_object* v___x_140_; lean_object* v___x_141_; uint8_t v___x_142_; 
v___x_140_ = lean_unsigned_to_nat(262144u);
v___x_141_ = lean_array_get_size(v_values_139_);
v___x_142_ = lean_nat_dec_lt(v___x_140_, v___x_141_);
if (v___x_142_ == 0)
{
lean_object* v___x_143_; size_t v_sz_144_; size_t v___x_145_; lean_object* v___x_146_; lean_object* v_fst_147_; 
v___x_143_ = ((lean_object*)(l_LeanBridgeNativea1d30b9a0f384ed5_carrierCollect___redArg___closed__0));
v_sz_144_ = lean_array_size(v_values_139_);
v___x_145_ = ((size_t)0ULL);
v___x_146_ = l___private_Init_Data_Array_Basic_0__Array_forIn_x27Unsafe_loop___at___00LeanBridgeNativea1d30b9a0f384ed5_carrierCollect_spec__0___redArg(v_values_139_, v_sz_144_, v___x_145_, v___x_143_);
v_fst_147_ = lean_ctor_get(v___x_146_, 0);
lean_inc(v_fst_147_);
if (lean_obj_tag(v_fst_147_) == 0)
{
lean_object* v_snd_148_; lean_object* v___x_149_; 
v_snd_148_ = lean_ctor_get(v___x_146_, 1);
lean_inc(v_snd_148_);
lean_dec_ref(v___x_146_);
v___x_149_ = lean_alloc_ctor(1, 1, 0);
lean_ctor_set(v___x_149_, 0, v_snd_148_);
return v___x_149_;
}
else
{
lean_object* v_val_150_; 
lean_dec_ref(v___x_146_);
v_val_150_ = lean_ctor_get(v_fst_147_, 0);
lean_inc(v_val_150_);
lean_dec_ref_known(v_fst_147_, 1);
return v_val_150_;
}
}
else
{
lean_object* v___x_151_; 
v___x_151_ = lean_box(0);
return v___x_151_;
}
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNativea1d30b9a0f384ed5_carrierCollect___redArg___boxed(lean_object* v_values_152_){
_start:
{
lean_object* v_res_153_; 
v_res_153_ = l_LeanBridgeNativea1d30b9a0f384ed5_carrierCollect___redArg(v_values_152_);
lean_dec_ref(v_values_152_);
return v_res_153_;
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNativea1d30b9a0f384ed5_carrierCollect(lean_object* v_00_u03b1_154_, lean_object* v_values_155_){
_start:
{
lean_object* v___x_156_; 
v___x_156_ = l_LeanBridgeNativea1d30b9a0f384ed5_carrierCollect___redArg(v_values_155_);
return v___x_156_;
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNativea1d30b9a0f384ed5_carrierCollect___boxed(lean_object* v_00_u03b1_157_, lean_object* v_values_158_){
_start:
{
lean_object* v_res_159_; 
v_res_159_ = l_LeanBridgeNativea1d30b9a0f384ed5_carrierCollect(v_00_u03b1_157_, v_values_158_);
lean_dec_ref(v_values_158_);
return v_res_159_;
}
}
LEAN_EXPORT lean_object* l___private_Init_Data_Array_Basic_0__Array_forIn_x27Unsafe_loop___at___00LeanBridgeNativea1d30b9a0f384ed5_carrierCollect_spec__0(lean_object* v_00_u03b1_160_, lean_object* v_as_161_, size_t v_sz_162_, size_t v_i_163_, lean_object* v_b_164_){
_start:
{
lean_object* v___x_165_; 
v___x_165_ = l___private_Init_Data_Array_Basic_0__Array_forIn_x27Unsafe_loop___at___00LeanBridgeNativea1d30b9a0f384ed5_carrierCollect_spec__0___redArg(v_as_161_, v_sz_162_, v_i_163_, v_b_164_);
return v___x_165_;
}
}
LEAN_EXPORT lean_object* l___private_Init_Data_Array_Basic_0__Array_forIn_x27Unsafe_loop___at___00LeanBridgeNativea1d30b9a0f384ed5_carrierCollect_spec__0___boxed(lean_object* v_00_u03b1_166_, lean_object* v_as_167_, lean_object* v_sz_168_, lean_object* v_i_169_, lean_object* v_b_170_){
_start:
{
size_t v_sz_boxed_171_; size_t v_i_boxed_172_; lean_object* v_res_173_; 
v_sz_boxed_171_ = lean_unbox_usize(v_sz_168_);
lean_dec(v_sz_168_);
v_i_boxed_172_ = lean_unbox_usize(v_i_169_);
lean_dec(v_i_169_);
v_res_173_ = l___private_Init_Data_Array_Basic_0__Array_forIn_x27Unsafe_loop___at___00LeanBridgeNativea1d30b9a0f384ed5_carrierCollect_spec__0(v_00_u03b1_166_, v_as_167_, v_sz_boxed_171_, v_i_boxed_172_, v_b_170_);
lean_dec_ref(v_as_167_);
return v_res_173_;
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNativea1d30b9a0f384ed5_carrierListItems_loop___redArg(lean_object* v_a_174_, lean_object* v_a_175_, lean_object* v_a_176_){
_start:
{
lean_object* v_zero_177_; uint8_t v_isZero_178_; 
v_zero_177_ = lean_unsigned_to_nat(0u);
v_isZero_178_ = lean_nat_dec_eq(v_a_174_, v_zero_177_);
if (v_isZero_178_ == 1)
{
lean_dec(v_a_175_);
lean_dec(v_a_174_);
return v_a_176_;
}
else
{
if (lean_obj_tag(v_a_175_) == 0)
{
lean_dec(v_a_174_);
return v_a_176_;
}
else
{
lean_object* v_head_179_; lean_object* v_tail_180_; lean_object* v_one_181_; lean_object* v_n_182_; lean_object* v___x_183_; lean_object* v___x_184_; lean_object* v___x_185_; 
v_head_179_ = lean_ctor_get(v_a_175_, 0);
lean_inc(v_head_179_);
v_tail_180_ = lean_ctor_get(v_a_175_, 1);
lean_inc(v_tail_180_);
lean_dec_ref_known(v_a_175_, 2);
v_one_181_ = lean_unsigned_to_nat(1u);
v_n_182_ = lean_nat_sub(v_a_174_, v_one_181_);
lean_dec(v_a_174_);
v___x_183_ = lean_mk_empty_array_with_capacity(v_one_181_);
v___x_184_ = lean_array_push(v___x_183_, v_head_179_);
v___x_185_ = lean_array_push(v_a_176_, v___x_184_);
v_a_174_ = v_n_182_;
v_a_175_ = v_tail_180_;
v_a_176_ = v___x_185_;
goto _start;
}
}
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNativea1d30b9a0f384ed5_carrierListItems_loop(lean_object* v_00_u03b1_187_, lean_object* v_a_188_, lean_object* v_a_189_, lean_object* v_a_190_){
_start:
{
lean_object* v___x_191_; 
v___x_191_ = l_LeanBridgeNativea1d30b9a0f384ed5_carrierListItems_loop___redArg(v_a_188_, v_a_189_, v_a_190_);
return v___x_191_;
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNativea1d30b9a0f384ed5_carrierListItems___redArg(lean_object* v_values_194_){
_start:
{
lean_object* v___x_195_; lean_object* v___x_196_; lean_object* v___x_197_; 
v___x_195_ = lean_unsigned_to_nat(262145u);
v___x_196_ = ((lean_object*)(l_LeanBridgeNativea1d30b9a0f384ed5_carrierListItems___redArg___closed__0));
v___x_197_ = l_LeanBridgeNativea1d30b9a0f384ed5_carrierListItems_loop___redArg(v___x_195_, v_values_194_, v___x_196_);
return v___x_197_;
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNativea1d30b9a0f384ed5_carrierListItems(lean_object* v_00_u03b1_198_, lean_object* v_values_199_){
_start:
{
lean_object* v___x_200_; 
v___x_200_ = l_LeanBridgeNativea1d30b9a0f384ed5_carrierListItems___redArg(v_values_199_);
return v___x_200_;
}
}
static lean_object* _init_l_LeanBridgeNativea1d30b9a0f384ed5_make3cdb6e7435d0b988c5ab___closed__0(void){
_start:
{
lean_object* v___x_201_; lean_object* v___x_202_; 
v___x_201_ = lean_box(0);
v___x_202_ = l_LeanBridgeNativea1d30b9a0f384ed5_carrierResult___redArg(v___x_201_);
return v___x_202_;
}
}
LEAN_EXPORT lean_object* lean_bridge_9a14c44da851e2d4fdfbfb9b_recursive_3cdb6e7435d0b988c5ab_make(lean_object* v_a0_203_, lean_object* v_a1_204_, lean_object* v_a2_205_){
_start:
{
lean_object* v___x_206_; 
v___x_206_ = l_LeanBridgeNativea1d30b9a0f384ed5_carrierValue___redArg(v_a0_203_);
lean_dec_ref(v_a0_203_);
if (lean_obj_tag(v___x_206_) == 0)
{
lean_object* v___x_207_; 
lean_dec_ref(v_a2_205_);
lean_dec_ref(v_a1_204_);
v___x_207_ = lean_obj_once(&l_LeanBridgeNativea1d30b9a0f384ed5_make3cdb6e7435d0b988c5ab___closed__0, &l_LeanBridgeNativea1d30b9a0f384ed5_make3cdb6e7435d0b988c5ab___closed__0_once, _init_l_LeanBridgeNativea1d30b9a0f384ed5_make3cdb6e7435d0b988c5ab___closed__0);
return v___x_207_;
}
else
{
lean_object* v_val_208_; lean_object* v___x_209_; 
v_val_208_ = lean_ctor_get(v___x_206_, 0);
lean_inc(v_val_208_);
lean_dec_ref_known(v___x_206_, 1);
v___x_209_ = l_LeanBridgeNativea1d30b9a0f384ed5_carrierValue___redArg(v_a1_204_);
lean_dec_ref(v_a1_204_);
if (lean_obj_tag(v___x_209_) == 0)
{
lean_object* v___x_210_; 
lean_dec(v_val_208_);
lean_dec_ref(v_a2_205_);
v___x_210_ = lean_obj_once(&l_LeanBridgeNativea1d30b9a0f384ed5_make3cdb6e7435d0b988c5ab___closed__0, &l_LeanBridgeNativea1d30b9a0f384ed5_make3cdb6e7435d0b988c5ab___closed__0_once, _init_l_LeanBridgeNativea1d30b9a0f384ed5_make3cdb6e7435d0b988c5ab___closed__0);
return v___x_210_;
}
else
{
lean_object* v_val_211_; lean_object* v___x_212_; 
v_val_211_ = lean_ctor_get(v___x_209_, 0);
lean_inc(v_val_211_);
lean_dec_ref_known(v___x_209_, 1);
v___x_212_ = l_LeanBridgeNativea1d30b9a0f384ed5_carrierValue___redArg(v_a2_205_);
lean_dec_ref(v_a2_205_);
if (lean_obj_tag(v___x_212_) == 0)
{
lean_object* v___x_213_; 
lean_dec(v_val_211_);
lean_dec(v_val_208_);
v___x_213_ = lean_obj_once(&l_LeanBridgeNativea1d30b9a0f384ed5_make3cdb6e7435d0b988c5ab___closed__0, &l_LeanBridgeNativea1d30b9a0f384ed5_make3cdb6e7435d0b988c5ab___closed__0_once, _init_l_LeanBridgeNativea1d30b9a0f384ed5_make3cdb6e7435d0b988c5ab___closed__0);
return v___x_213_;
}
else
{
lean_object* v_val_214_; lean_object* v___x_216_; uint8_t v_isShared_217_; uint8_t v_isSharedCheck_223_; 
v_val_214_ = lean_ctor_get(v___x_212_, 0);
v_isSharedCheck_223_ = !lean_is_exclusive(v___x_212_);
if (v_isSharedCheck_223_ == 0)
{
v___x_216_ = v___x_212_;
v_isShared_217_ = v_isSharedCheck_223_;
goto v_resetjp_215_;
}
else
{
lean_inc(v_val_214_);
lean_dec(v___x_212_);
v___x_216_ = lean_box(0);
v_isShared_217_ = v_isSharedCheck_223_;
goto v_resetjp_215_;
}
v_resetjp_215_:
{
lean_object* v___x_218_; lean_object* v___x_220_; 
v___x_218_ = lean_alloc_ctor(0, 3, 0);
lean_ctor_set(v___x_218_, 0, v_val_208_);
lean_ctor_set(v___x_218_, 1, v_val_211_);
lean_ctor_set(v___x_218_, 2, v_val_214_);
if (v_isShared_217_ == 0)
{
lean_ctor_set(v___x_216_, 0, v___x_218_);
v___x_220_ = v___x_216_;
goto v_reusejp_219_;
}
else
{
lean_object* v_reuseFailAlloc_222_; 
v_reuseFailAlloc_222_ = lean_alloc_ctor(1, 1, 0);
lean_ctor_set(v_reuseFailAlloc_222_, 0, v___x_218_);
v___x_220_ = v_reuseFailAlloc_222_;
goto v_reusejp_219_;
}
v_reusejp_219_:
{
lean_object* v___x_221_; 
v___x_221_ = l_LeanBridgeNativea1d30b9a0f384ed5_carrierResult___redArg(v___x_220_);
return v___x_221_;
}
}
}
}
}
}
}
static lean_object* _init_l_LeanBridgeNativea1d30b9a0f384ed5_field03cdb6e7435d0b988c5ab___closed__0(void){
_start:
{
lean_object* v___x_224_; lean_object* v___x_225_; 
v___x_224_ = lean_box(0);
v___x_225_ = l_LeanBridgeNativea1d30b9a0f384ed5_carrierResult___redArg(v___x_224_);
return v___x_225_;
}
}
LEAN_EXPORT lean_object* lean_bridge_9a14c44da851e2d4fdfbfb9b_recursive_3cdb6e7435d0b988c5ab_field0(lean_object* v_value_226_){
_start:
{
lean_object* v___x_227_; 
v___x_227_ = l_LeanBridgeNativea1d30b9a0f384ed5_carrierValue___redArg(v_value_226_);
lean_dec_ref(v_value_226_);
if (lean_obj_tag(v___x_227_) == 0)
{
lean_object* v___x_228_; 
v___x_228_ = lean_obj_once(&l_LeanBridgeNativea1d30b9a0f384ed5_field03cdb6e7435d0b988c5ab___closed__0, &l_LeanBridgeNativea1d30b9a0f384ed5_field03cdb6e7435d0b988c5ab___closed__0_once, _init_l_LeanBridgeNativea1d30b9a0f384ed5_field03cdb6e7435d0b988c5ab___closed__0);
return v___x_228_;
}
else
{
lean_object* v_val_229_; lean_object* v___x_231_; uint8_t v_isShared_232_; uint8_t v_isSharedCheck_238_; 
v_val_229_ = lean_ctor_get(v___x_227_, 0);
v_isSharedCheck_238_ = !lean_is_exclusive(v___x_227_);
if (v_isSharedCheck_238_ == 0)
{
v___x_231_ = v___x_227_;
v_isShared_232_ = v_isSharedCheck_238_;
goto v_resetjp_230_;
}
else
{
lean_inc(v_val_229_);
lean_dec(v___x_227_);
v___x_231_ = lean_box(0);
v_isShared_232_ = v_isSharedCheck_238_;
goto v_resetjp_230_;
}
v_resetjp_230_:
{
lean_object* v_value_233_; lean_object* v___x_235_; 
v_value_233_ = lean_ctor_get(v_val_229_, 0);
lean_inc(v_value_233_);
lean_dec(v_val_229_);
if (v_isShared_232_ == 0)
{
lean_ctor_set(v___x_231_, 0, v_value_233_);
v___x_235_ = v___x_231_;
goto v_reusejp_234_;
}
else
{
lean_object* v_reuseFailAlloc_237_; 
v_reuseFailAlloc_237_ = lean_alloc_ctor(1, 1, 0);
lean_ctor_set(v_reuseFailAlloc_237_, 0, v_value_233_);
v___x_235_ = v_reuseFailAlloc_237_;
goto v_reusejp_234_;
}
v_reusejp_234_:
{
lean_object* v___x_236_; 
v___x_236_ = l_LeanBridgeNativea1d30b9a0f384ed5_carrierResult___redArg(v___x_235_);
return v___x_236_;
}
}
}
}
}
LEAN_EXPORT lean_object* lean_bridge_9a14c44da851e2d4fdfbfb9b_recursive_3cdb6e7435d0b988c5ab_field1(lean_object* v_value_239_){
_start:
{
lean_object* v___x_240_; 
v___x_240_ = l_LeanBridgeNativea1d30b9a0f384ed5_carrierValue___redArg(v_value_239_);
lean_dec_ref(v_value_239_);
if (lean_obj_tag(v___x_240_) == 0)
{
lean_object* v___x_241_; 
v___x_241_ = lean_obj_once(&l_LeanBridgeNativea1d30b9a0f384ed5_field03cdb6e7435d0b988c5ab___closed__0, &l_LeanBridgeNativea1d30b9a0f384ed5_field03cdb6e7435d0b988c5ab___closed__0_once, _init_l_LeanBridgeNativea1d30b9a0f384ed5_field03cdb6e7435d0b988c5ab___closed__0);
return v___x_241_;
}
else
{
lean_object* v_val_242_; lean_object* v___x_244_; uint8_t v_isShared_245_; uint8_t v_isSharedCheck_251_; 
v_val_242_ = lean_ctor_get(v___x_240_, 0);
v_isSharedCheck_251_ = !lean_is_exclusive(v___x_240_);
if (v_isSharedCheck_251_ == 0)
{
v___x_244_ = v___x_240_;
v_isShared_245_ = v_isSharedCheck_251_;
goto v_resetjp_243_;
}
else
{
lean_inc(v_val_242_);
lean_dec(v___x_240_);
v___x_244_ = lean_box(0);
v_isShared_245_ = v_isSharedCheck_251_;
goto v_resetjp_243_;
}
v_resetjp_243_:
{
lean_object* v_digit_246_; lean_object* v___x_248_; 
v_digit_246_ = lean_ctor_get(v_val_242_, 1);
lean_inc(v_digit_246_);
lean_dec(v_val_242_);
if (v_isShared_245_ == 0)
{
lean_ctor_set(v___x_244_, 0, v_digit_246_);
v___x_248_ = v___x_244_;
goto v_reusejp_247_;
}
else
{
lean_object* v_reuseFailAlloc_250_; 
v_reuseFailAlloc_250_ = lean_alloc_ctor(1, 1, 0);
lean_ctor_set(v_reuseFailAlloc_250_, 0, v_digit_246_);
v___x_248_ = v_reuseFailAlloc_250_;
goto v_reusejp_247_;
}
v_reusejp_247_:
{
lean_object* v___x_249_; 
v___x_249_ = l_LeanBridgeNativea1d30b9a0f384ed5_carrierResult___redArg(v___x_248_);
return v___x_249_;
}
}
}
}
}
static lean_object* _init_l_LeanBridgeNativea1d30b9a0f384ed5_field23cdb6e7435d0b988c5ab___closed__0(void){
_start:
{
lean_object* v___x_252_; lean_object* v___x_253_; 
v___x_252_ = lean_box(0);
v___x_253_ = l_LeanBridgeNativea1d30b9a0f384ed5_carrierResult___redArg(v___x_252_);
return v___x_253_;
}
}
LEAN_EXPORT lean_object* lean_bridge_9a14c44da851e2d4fdfbfb9b_recursive_3cdb6e7435d0b988c5ab_field2(lean_object* v_value_254_){
_start:
{
lean_object* v___x_255_; 
v___x_255_ = l_LeanBridgeNativea1d30b9a0f384ed5_carrierValue___redArg(v_value_254_);
lean_dec_ref(v_value_254_);
if (lean_obj_tag(v___x_255_) == 0)
{
lean_object* v___x_256_; 
v___x_256_ = lean_obj_once(&l_LeanBridgeNativea1d30b9a0f384ed5_field23cdb6e7435d0b988c5ab___closed__0, &l_LeanBridgeNativea1d30b9a0f384ed5_field23cdb6e7435d0b988c5ab___closed__0_once, _init_l_LeanBridgeNativea1d30b9a0f384ed5_field23cdb6e7435d0b988c5ab___closed__0);
return v___x_256_;
}
else
{
lean_object* v_val_257_; lean_object* v___x_259_; uint8_t v_isShared_260_; uint8_t v_isSharedCheck_266_; 
v_val_257_ = lean_ctor_get(v___x_255_, 0);
v_isSharedCheck_266_ = !lean_is_exclusive(v___x_255_);
if (v_isSharedCheck_266_ == 0)
{
v___x_259_ = v___x_255_;
v_isShared_260_ = v_isSharedCheck_266_;
goto v_resetjp_258_;
}
else
{
lean_inc(v_val_257_);
lean_dec(v___x_255_);
v___x_259_ = lean_box(0);
v_isShared_260_ = v_isSharedCheck_266_;
goto v_resetjp_258_;
}
v_resetjp_258_:
{
lean_object* v_tail_261_; lean_object* v___x_263_; 
v_tail_261_ = lean_ctor_get(v_val_257_, 2);
lean_inc(v_tail_261_);
lean_dec(v_val_257_);
if (v_isShared_260_ == 0)
{
lean_ctor_set(v___x_259_, 0, v_tail_261_);
v___x_263_ = v___x_259_;
goto v_reusejp_262_;
}
else
{
lean_object* v_reuseFailAlloc_265_; 
v_reuseFailAlloc_265_ = lean_alloc_ctor(1, 1, 0);
lean_ctor_set(v_reuseFailAlloc_265_, 0, v_tail_261_);
v___x_263_ = v_reuseFailAlloc_265_;
goto v_reusejp_262_;
}
v_reusejp_262_:
{
lean_object* v___x_264_; 
v___x_264_ = l_LeanBridgeNativea1d30b9a0f384ed5_carrierResult___redArg(v___x_263_);
return v___x_264_;
}
}
}
}
}
LEAN_EXPORT uint32_t lean_bridge_9a14c44da851e2d4fdfbfb9b_recursive_796129d6f57eb5b14908_branch(lean_object* v_value_267_){
_start:
{
lean_object* v___x_268_; 
v___x_268_ = l_LeanBridgeNativea1d30b9a0f384ed5_carrierValue___redArg(v_value_267_);
lean_dec_ref(v_value_267_);
if (lean_obj_tag(v___x_268_) == 0)
{
uint32_t v___x_269_; 
v___x_269_ = 4294967295;
return v___x_269_;
}
else
{
lean_object* v_val_270_; 
v_val_270_ = lean_ctor_get(v___x_268_, 0);
lean_inc(v_val_270_);
lean_dec_ref_known(v___x_268_, 1);
if (lean_obj_tag(v_val_270_) == 0)
{
uint32_t v___x_271_; 
v___x_271_ = 0;
return v___x_271_;
}
else
{
uint32_t v___x_272_; 
lean_dec_ref_known(v_val_270_, 1);
v___x_272_ = 1;
return v___x_272_;
}
}
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNativea1d30b9a0f384ed5_branch796129d6f57eb5b14908___boxed(lean_object* v_value_273_){
_start:
{
uint32_t v_res_274_; lean_object* v_r_275_; 
v_res_274_ = lean_bridge_9a14c44da851e2d4fdfbfb9b_recursive_796129d6f57eb5b14908_branch(v_value_273_);
v_r_275_ = lean_box_uint32(v_res_274_);
return v_r_275_;
}
}
static lean_object* _init_l_LeanBridgeNativea1d30b9a0f384ed5_none796129d6f57eb5b14908___closed__1(void){
_start:
{
lean_object* v___x_278_; lean_object* v___x_279_; 
v___x_278_ = ((lean_object*)(l_LeanBridgeNativea1d30b9a0f384ed5_none796129d6f57eb5b14908___closed__0));
v___x_279_ = l_LeanBridgeNativea1d30b9a0f384ed5_carrierResult___redArg(v___x_278_);
return v___x_279_;
}
}
LEAN_EXPORT lean_object* lean_bridge_9a14c44da851e2d4fdfbfb9b_recursive_796129d6f57eb5b14908_none(lean_object* v___bridgeUnit_280_){
_start:
{
lean_object* v___x_281_; 
v___x_281_ = lean_obj_once(&l_LeanBridgeNativea1d30b9a0f384ed5_none796129d6f57eb5b14908___closed__1, &l_LeanBridgeNativea1d30b9a0f384ed5_none796129d6f57eb5b14908___closed__1_once, _init_l_LeanBridgeNativea1d30b9a0f384ed5_none796129d6f57eb5b14908___closed__1);
return v___x_281_;
}
}
LEAN_EXPORT lean_object* lean_bridge_9a14c44da851e2d4fdfbfb9b_recursive_796129d6f57eb5b14908_make0(lean_object* v_a0_282_){
_start:
{
lean_object* v___x_283_; 
v___x_283_ = l_LeanBridgeNativea1d30b9a0f384ed5_carrierValue___redArg(v_a0_282_);
lean_dec_ref(v_a0_282_);
if (lean_obj_tag(v___x_283_) == 0)
{
lean_object* v___x_284_; 
v___x_284_ = lean_obj_once(&l_LeanBridgeNativea1d30b9a0f384ed5_field23cdb6e7435d0b988c5ab___closed__0, &l_LeanBridgeNativea1d30b9a0f384ed5_field23cdb6e7435d0b988c5ab___closed__0_once, _init_l_LeanBridgeNativea1d30b9a0f384ed5_field23cdb6e7435d0b988c5ab___closed__0);
return v___x_284_;
}
else
{
lean_object* v___x_285_; lean_object* v___x_286_; 
v___x_285_ = lean_alloc_ctor(1, 1, 0);
lean_ctor_set(v___x_285_, 0, v___x_283_);
v___x_286_ = l_LeanBridgeNativea1d30b9a0f384ed5_carrierResult___redArg(v___x_285_);
return v___x_286_;
}
}
}
LEAN_EXPORT lean_object* lean_bridge_9a14c44da851e2d4fdfbfb9b_recursive_796129d6f57eb5b14908_field0(lean_object* v_value_287_){
_start:
{
lean_object* v___x_288_; 
v___x_288_ = l_LeanBridgeNativea1d30b9a0f384ed5_carrierValue___redArg(v_value_287_);
lean_dec_ref(v_value_287_);
if (lean_obj_tag(v___x_288_) == 0)
{
lean_object* v___x_289_; 
v___x_289_ = lean_obj_once(&l_LeanBridgeNativea1d30b9a0f384ed5_make3cdb6e7435d0b988c5ab___closed__0, &l_LeanBridgeNativea1d30b9a0f384ed5_make3cdb6e7435d0b988c5ab___closed__0_once, _init_l_LeanBridgeNativea1d30b9a0f384ed5_make3cdb6e7435d0b988c5ab___closed__0);
return v___x_289_;
}
else
{
lean_object* v_val_290_; 
v_val_290_ = lean_ctor_get(v___x_288_, 0);
lean_inc(v_val_290_);
lean_dec_ref_known(v___x_288_, 1);
if (lean_obj_tag(v_val_290_) == 1)
{
lean_object* v___x_291_; 
v___x_291_ = l_LeanBridgeNativea1d30b9a0f384ed5_carrierResult___redArg(v_val_290_);
return v___x_291_;
}
else
{
lean_object* v___x_292_; 
lean_dec(v_val_290_);
v___x_292_ = lean_obj_once(&l_LeanBridgeNativea1d30b9a0f384ed5_make3cdb6e7435d0b988c5ab___closed__0, &l_LeanBridgeNativea1d30b9a0f384ed5_make3cdb6e7435d0b988c5ab___closed__0_once, _init_l_LeanBridgeNativea1d30b9a0f384ed5_make3cdb6e7435d0b988c5ab___closed__0);
return v___x_292_;
}
}
}
}
LEAN_EXPORT lean_object* lean_bridge_9a14c44da851e2d4fdfbfb9b_recursive_1ee7f471296218fa6414_make(lean_object* v_values_293_){
_start:
{
lean_object* v___x_294_; lean_object* v___x_295_; 
v___x_294_ = l_LeanBridgeNativea1d30b9a0f384ed5_carrierCollect___redArg(v_values_293_);
lean_dec_ref(v_values_293_);
v___x_295_ = l_LeanBridgeNativea1d30b9a0f384ed5_carrierResult___redArg(v___x_294_);
return v___x_295_;
}
}
LEAN_EXPORT lean_object* l___private_Init_Data_Array_Basic_0__Array_mapMUnsafe_map___at___00LeanBridgeNativea1d30b9a0f384ed5_items1ee7f471296218fa6414_spec__0(size_t v_sz_296_, size_t v_i_297_, lean_object* v_bs_298_){
_start:
{
uint8_t v___x_299_; 
v___x_299_ = lean_usize_dec_lt(v_i_297_, v_sz_296_);
if (v___x_299_ == 0)
{
return v_bs_298_;
}
else
{
lean_object* v_v_300_; lean_object* v___x_301_; lean_object* v_bs_x27_302_; lean_object* v___x_303_; lean_object* v___x_304_; lean_object* v___x_305_; size_t v___x_306_; size_t v___x_307_; lean_object* v___x_308_; 
v_v_300_ = lean_array_uget(v_bs_298_, v_i_297_);
v___x_301_ = lean_unsigned_to_nat(0u);
v_bs_x27_302_ = lean_array_uset(v_bs_298_, v_i_297_, v___x_301_);
v___x_303_ = lean_unsigned_to_nat(1u);
v___x_304_ = lean_mk_empty_array_with_capacity(v___x_303_);
v___x_305_ = lean_array_push(v___x_304_, v_v_300_);
v___x_306_ = ((size_t)1ULL);
v___x_307_ = lean_usize_add(v_i_297_, v___x_306_);
v___x_308_ = lean_array_uset(v_bs_x27_302_, v_i_297_, v___x_305_);
v_i_297_ = v___x_307_;
v_bs_298_ = v___x_308_;
goto _start;
}
}
}
LEAN_EXPORT lean_object* l___private_Init_Data_Array_Basic_0__Array_mapMUnsafe_map___at___00LeanBridgeNativea1d30b9a0f384ed5_items1ee7f471296218fa6414_spec__0___boxed(lean_object* v_sz_310_, lean_object* v_i_311_, lean_object* v_bs_312_){
_start:
{
size_t v_sz_boxed_313_; size_t v_i_boxed_314_; lean_object* v_res_315_; 
v_sz_boxed_313_ = lean_unbox_usize(v_sz_310_);
lean_dec(v_sz_310_);
v_i_boxed_314_ = lean_unbox_usize(v_i_311_);
lean_dec(v_i_311_);
v_res_315_ = l___private_Init_Data_Array_Basic_0__Array_mapMUnsafe_map___at___00LeanBridgeNativea1d30b9a0f384ed5_items1ee7f471296218fa6414_spec__0(v_sz_boxed_313_, v_i_boxed_314_, v_bs_312_);
return v_res_315_;
}
}
LEAN_EXPORT lean_object* lean_bridge_9a14c44da851e2d4fdfbfb9b_recursive_1ee7f471296218fa6414_items(lean_object* v_value_318_){
_start:
{
lean_object* v___x_319_; 
v___x_319_ = l_LeanBridgeNativea1d30b9a0f384ed5_carrierValue___redArg(v_value_318_);
lean_dec_ref(v_value_318_);
if (lean_obj_tag(v___x_319_) == 0)
{
lean_object* v___x_320_; 
v___x_320_ = ((lean_object*)(l_LeanBridgeNativea1d30b9a0f384ed5_items1ee7f471296218fa6414___closed__0));
return v___x_320_;
}
else
{
lean_object* v_val_321_; lean_object* v___x_322_; lean_object* v___x_323_; lean_object* v___x_324_; size_t v_sz_325_; size_t v___x_326_; lean_object* v___x_327_; 
v_val_321_ = lean_ctor_get(v___x_319_, 0);
lean_inc(v_val_321_);
lean_dec_ref_known(v___x_319_, 1);
v___x_322_ = lean_unsigned_to_nat(0u);
v___x_323_ = lean_unsigned_to_nat(262145u);
v___x_324_ = l_Array_extract___redArg(v_val_321_, v___x_322_, v___x_323_);
lean_dec(v_val_321_);
v_sz_325_ = lean_array_size(v___x_324_);
v___x_326_ = ((size_t)0ULL);
v___x_327_ = l___private_Init_Data_Array_Basic_0__Array_mapMUnsafe_map___at___00LeanBridgeNativea1d30b9a0f384ed5_items1ee7f471296218fa6414_spec__0(v_sz_325_, v___x_326_, v___x_324_);
return v___x_327_;
}
}
}
LEAN_EXPORT uint32_t lean_bridge_9a14c44da851e2d4fdfbfb9b_recursive_30b9cb19321dad5070fa_branch(lean_object* v_value_328_){
_start:
{
lean_object* v___x_329_; 
v___x_329_ = l_LeanBridgeNativea1d30b9a0f384ed5_carrierValue___redArg(v_value_328_);
lean_dec_ref(v_value_328_);
if (lean_obj_tag(v___x_329_) == 0)
{
uint32_t v___x_330_; 
v___x_330_ = 4294967295;
return v___x_330_;
}
else
{
lean_object* v_val_331_; 
v_val_331_ = lean_ctor_get(v___x_329_, 0);
lean_inc(v_val_331_);
lean_dec_ref_known(v___x_329_, 1);
if (lean_obj_tag(v_val_331_) == 0)
{
uint32_t v___x_332_; 
v___x_332_ = 0;
return v___x_332_;
}
else
{
uint32_t v___x_333_; 
lean_dec_ref_known(v_val_331_, 1);
v___x_333_ = 1;
return v___x_333_;
}
}
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNativea1d30b9a0f384ed5_branch30b9cb19321dad5070fa___boxed(lean_object* v_value_334_){
_start:
{
uint32_t v_res_335_; lean_object* v_r_336_; 
v_res_335_ = lean_bridge_9a14c44da851e2d4fdfbfb9b_recursive_30b9cb19321dad5070fa_branch(v_value_334_);
v_r_336_ = lean_box_uint32(v_res_335_);
return v_r_336_;
}
}
LEAN_EXPORT lean_object* lean_bridge_9a14c44da851e2d4fdfbfb9b_recursive_30b9cb19321dad5070fa_none(lean_object* v___bridgeUnit_337_){
_start:
{
lean_object* v___x_338_; 
v___x_338_ = lean_obj_once(&l_LeanBridgeNativea1d30b9a0f384ed5_none796129d6f57eb5b14908___closed__1, &l_LeanBridgeNativea1d30b9a0f384ed5_none796129d6f57eb5b14908___closed__1_once, _init_l_LeanBridgeNativea1d30b9a0f384ed5_none796129d6f57eb5b14908___closed__1);
return v___x_338_;
}
}
LEAN_EXPORT lean_object* lean_bridge_9a14c44da851e2d4fdfbfb9b_recursive_30b9cb19321dad5070fa_make0(lean_object* v_a0_339_){
_start:
{
lean_object* v___x_340_; 
v___x_340_ = l_LeanBridgeNativea1d30b9a0f384ed5_carrierValue___redArg(v_a0_339_);
lean_dec_ref(v_a0_339_);
if (lean_obj_tag(v___x_340_) == 0)
{
lean_object* v___x_341_; 
v___x_341_ = lean_obj_once(&l_LeanBridgeNativea1d30b9a0f384ed5_field23cdb6e7435d0b988c5ab___closed__0, &l_LeanBridgeNativea1d30b9a0f384ed5_field23cdb6e7435d0b988c5ab___closed__0_once, _init_l_LeanBridgeNativea1d30b9a0f384ed5_field23cdb6e7435d0b988c5ab___closed__0);
return v___x_341_;
}
else
{
lean_object* v___x_342_; lean_object* v___x_343_; 
v___x_342_ = lean_alloc_ctor(1, 1, 0);
lean_ctor_set(v___x_342_, 0, v___x_340_);
v___x_343_ = l_LeanBridgeNativea1d30b9a0f384ed5_carrierResult___redArg(v___x_342_);
return v___x_343_;
}
}
}
LEAN_EXPORT lean_object* lean_bridge_9a14c44da851e2d4fdfbfb9b_recursive_30b9cb19321dad5070fa_field0(lean_object* v_value_344_){
_start:
{
lean_object* v___x_345_; 
v___x_345_ = l_LeanBridgeNativea1d30b9a0f384ed5_carrierValue___redArg(v_value_344_);
lean_dec_ref(v_value_344_);
if (lean_obj_tag(v___x_345_) == 0)
{
lean_object* v___x_346_; 
v___x_346_ = lean_obj_once(&l_LeanBridgeNativea1d30b9a0f384ed5_make3cdb6e7435d0b988c5ab___closed__0, &l_LeanBridgeNativea1d30b9a0f384ed5_make3cdb6e7435d0b988c5ab___closed__0_once, _init_l_LeanBridgeNativea1d30b9a0f384ed5_make3cdb6e7435d0b988c5ab___closed__0);
return v___x_346_;
}
else
{
lean_object* v_val_347_; 
v_val_347_ = lean_ctor_get(v___x_345_, 0);
lean_inc(v_val_347_);
lean_dec_ref_known(v___x_345_, 1);
if (lean_obj_tag(v_val_347_) == 1)
{
lean_object* v___x_348_; 
v___x_348_ = l_LeanBridgeNativea1d30b9a0f384ed5_carrierResult___redArg(v_val_347_);
return v___x_348_;
}
else
{
lean_object* v___x_349_; 
lean_dec(v_val_347_);
v___x_349_ = lean_obj_once(&l_LeanBridgeNativea1d30b9a0f384ed5_make3cdb6e7435d0b988c5ab___closed__0, &l_LeanBridgeNativea1d30b9a0f384ed5_make3cdb6e7435d0b988c5ab___closed__0_once, _init_l_LeanBridgeNativea1d30b9a0f384ed5_make3cdb6e7435d0b988c5ab___closed__0);
return v___x_349_;
}
}
}
}
LEAN_EXPORT lean_object* lean_bridge_9a14c44da851e2d4fdfbfb9b_recursive_adc23788b11cdeb3b9ab_make(lean_object* v_a0_350_){
_start:
{
lean_object* v___x_351_; lean_object* v___x_352_; 
v___x_351_ = l_LeanBridgeNativea1d30b9a0f384ed5_carrierValue___redArg(v_a0_350_);
lean_dec_ref(v_a0_350_);
v___x_352_ = l_LeanBridgeNativea1d30b9a0f384ed5_carrierResult___redArg(v___x_351_);
return v___x_352_;
}
}
LEAN_EXPORT lean_object* lean_bridge_9a14c44da851e2d4fdfbfb9b_recursive_adc23788b11cdeb3b9ab_field0(lean_object* v_value_353_){
_start:
{
lean_object* v___x_354_; lean_object* v___x_355_; 
v___x_354_ = l_LeanBridgeNativea1d30b9a0f384ed5_carrierValue___redArg(v_value_353_);
lean_dec_ref(v_value_353_);
v___x_355_ = l_LeanBridgeNativea1d30b9a0f384ed5_carrierResult___redArg(v___x_354_);
return v___x_355_;
}
}
LEAN_EXPORT uint8_t lean_bridge_9a14c44da851e2d4fdfbfb9b_fin_guard_0(lean_object* v_carrier_356_){
  fputs("LB_SUBTYPE_ENTRY_V1 enter validator RecursiveCheckedRecords.echo:fin_guard_0\n", stderr);

_start:
{
lean_object* v___x_357_; 
v___x_357_ = l_LeanBridgeNativea1d30b9a0f384ed5_carrierValue___redArg(v_carrier_356_);
lean_dec_ref(v_carrier_356_);
if (lean_obj_tag(v___x_357_) == 0)
{
uint8_t v___x_358_; 
v___x_358_ = 0;
return v___x_358_;
}
else
{
lean_object* v_val_359_; uint8_t v___x_360_; 
v_val_359_ = lean_ctor_get(v___x_357_, 0);
lean_inc(v_val_359_);
lean_dec_ref_known(v___x_357_, 1);
v___x_360_ = l_LeanBridgeNativea1d30b9a0f384ed5_LbErased_RecursiveCheckedRecords_Packet_validFin(v_val_359_);
lean_dec(v_val_359_);
if (v___x_360_ == 0)
{
uint8_t v___x_361_; 
v___x_361_ = 0;
return v___x_361_;
}
else
{
uint8_t v___x_362_; 
v___x_362_ = 1;
return v___x_362_;
}
}
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNativea1d30b9a0f384ed5_export0__fin__guard__0___boxed(lean_object* v_carrier_363_){
_start:
{
uint8_t v_res_364_; lean_object* v_r_365_; 
v_res_364_ = lean_bridge_9a14c44da851e2d4fdfbfb9b_fin_guard_0(v_carrier_363_);
v_r_365_ = lean_box(v_res_364_);
return v_r_365_;
}
}
LEAN_EXPORT uint8_t lean_bridge_9a14c44da851e2d4fdfbfb9b_refinement_0(lean_object* v_carrier_366_){
  fputs("LB_SUBTYPE_ENTRY_V1 enter validator RecursiveCheckedRecords.echo:refinement_0\n", stderr);

_start:
{
lean_object* v___x_367_; 
v___x_367_ = l_LeanBridgeNativea1d30b9a0f384ed5_carrierValue___redArg(v_carrier_366_);
lean_dec_ref(v_carrier_366_);
if (lean_obj_tag(v___x_367_) == 0)
{
uint8_t v___x_368_; 
v___x_368_ = 0;
return v___x_368_;
}
else
{
lean_object* v_val_369_; uint8_t v___x_370_; 
v_val_369_ = lean_ctor_get(v___x_367_, 0);
lean_inc(v_val_369_);
lean_dec_ref_known(v___x_367_, 1);
v___x_370_ = l_LeanBridgeNativea1d30b9a0f384ed5_LbErased_RecursiveCheckedRecords_Packet_validFin(v_val_369_);
if (v___x_370_ == 0)
{
uint8_t v___x_371_; 
lean_dec(v_val_369_);
v___x_371_ = 0;
return v___x_371_;
}
else
{
lean_object* v___x_372_; 
v___x_372_ = l_LeanBridgeNativea1d30b9a0f384ed5_LbErased_RecursiveCheckedRecords_Packet_via__738d92def9c0ab42(v_val_369_);
if (lean_obj_tag(v___x_372_) == 0)
{
uint8_t v___x_373_; 
v___x_373_ = 0;
return v___x_373_;
}
else
{
uint8_t v___x_374_; 
lean_dec_ref_known(v___x_372_, 1);
v___x_374_ = 1;
return v___x_374_;
}
}
}
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNativea1d30b9a0f384ed5_export0__refinement__0___boxed(lean_object* v_carrier_375_){
_start:
{
uint8_t v_res_376_; lean_object* v_r_377_; 
v_res_376_ = lean_bridge_9a14c44da851e2d4fdfbfb9b_refinement_0(v_carrier_375_);
v_r_377_ = lean_box(v_res_376_);
return v_r_377_;
}
}
LEAN_EXPORT uint8_t lean_bridge_9a14c44da851e2d4fdfbfb9b_graph_refinement_0_71ba01578b385b329e98(lean_object* v_carrier_378_){
  fputs("LB_SUBTYPE_ENTRY_V1 enter validator RecursiveCheckedRecords.echo:graph_refinement_0_71ba01578b385b329e98\n", stderr);

_start:
{
lean_object* v___x_379_; 
v___x_379_ = l_LeanBridgeNativea1d30b9a0f384ed5_carrierValue___redArg(v_carrier_378_);
lean_dec_ref(v_carrier_378_);
if (lean_obj_tag(v___x_379_) == 0)
{
uint8_t v___x_380_; 
v___x_380_ = 0;
return v___x_380_;
}
else
{
lean_object* v_val_381_; lean_object* v___x_382_; 
v_val_381_ = lean_ctor_get(v___x_379_, 0);
lean_inc(v_val_381_);
lean_dec_ref_known(v___x_379_, 1);
v___x_382_ = lb_recursive_checked_record_probe_constructor_plusOne(v_val_381_);
if (lean_obj_tag(v___x_382_) == 0)
{
uint8_t v___x_383_; 
v___x_383_ = 0;
return v___x_383_;
}
else
{
uint8_t v___x_384_; 
lean_dec_ref_known(v___x_382_, 1);
v___x_384_ = 1;
return v___x_384_;
}
}
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNativea1d30b9a0f384ed5_export0__graph__refinement__0__71ba01578b385b329e98___boxed(lean_object* v_carrier_385_){
_start:
{
uint8_t v_res_386_; lean_object* v_r_387_; 
v_res_386_ = lean_bridge_9a14c44da851e2d4fdfbfb9b_graph_refinement_0_71ba01578b385b329e98(v_carrier_385_);
v_r_387_ = lean_box(v_res_386_);
return v_r_387_;
}
}
LEAN_EXPORT uint8_t lean_bridge_9a14c44da851e2d4fdfbfb9b_graph_refinement_0_8b6f9e05ee7b31aa9e96(lean_object* v_carrier_388_){
  fputs("LB_SUBTYPE_ENTRY_V1 enter validator RecursiveCheckedRecords.echo:graph_refinement_0_8b6f9e05ee7b31aa9e96\n", stderr);

_start:
{
lean_object* v___x_389_; 
v___x_389_ = l_LeanBridgeNativea1d30b9a0f384ed5_carrierValue___redArg(v_carrier_388_);
lean_dec_ref(v_carrier_388_);
if (lean_obj_tag(v___x_389_) == 0)
{
uint8_t v___x_390_; 
v___x_390_ = 0;
return v___x_390_;
}
else
{
lean_object* v_val_391_; lean_object* v___x_392_; 
v_val_391_ = lean_ctor_get(v___x_389_, 0);
lean_inc(v_val_391_);
lean_dec_ref_known(v___x_389_, 1);
v___x_392_ = l_LeanBridgeNativea1d30b9a0f384ed5_LbErased_RecursiveCheckedRecords_Packet_via__738d92def9c0ab42(v_val_391_);
if (lean_obj_tag(v___x_392_) == 0)
{
uint8_t v___x_393_; 
v___x_393_ = 0;
return v___x_393_;
}
else
{
uint8_t v___x_394_; 
lean_dec_ref_known(v___x_392_, 1);
v___x_394_ = 1;
return v___x_394_;
}
}
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNativea1d30b9a0f384ed5_export0__graph__refinement__0__8b6f9e05ee7b31aa9e96___boxed(lean_object* v_carrier_395_){
_start:
{
uint8_t v_res_396_; lean_object* v_r_397_; 
v_res_396_ = lean_bridge_9a14c44da851e2d4fdfbfb9b_graph_refinement_0_8b6f9e05ee7b31aa9e96(v_carrier_395_);
v_r_397_ = lean_box(v_res_396_);
return v_r_397_;
}
}
LEAN_EXPORT lean_object* lean_bridge_9a14c44da851e2d4fdfbfb9b_lean(lean_object* v_a0_398_){
  fputs("LB_SUBTYPE_ENTRY_V1 enter adapter RecursiveCheckedRecords.echo\n", stderr);

_start:
{
lean_object* v___x_399_; 
v___x_399_ = l_LeanBridgeNativea1d30b9a0f384ed5_carrierValue___redArg(v_a0_398_);
lean_dec_ref(v_a0_398_);
if (lean_obj_tag(v___x_399_) == 0)
{
lean_object* v___x_400_; 
v___x_400_ = l_LeanBridgeNativea1d30b9a0f384ed5_carrierResult___redArg(v___x_399_);
return v___x_400_;
}
else
{
lean_object* v_val_401_; uint8_t v___x_402_; 
v_val_401_ = lean_ctor_get(v___x_399_, 0);
lean_inc(v_val_401_);
lean_dec_ref_known(v___x_399_, 1);
v___x_402_ = l_LeanBridgeNativea1d30b9a0f384ed5_LbErased_RecursiveCheckedRecords_Packet_validFin(v_val_401_);
if (v___x_402_ == 0)
{
lean_object* v___x_403_; 
lean_dec(v_val_401_);
v___x_403_ = lean_obj_once(&l_LeanBridgeNativea1d30b9a0f384ed5_make3cdb6e7435d0b988c5ab___closed__0, &l_LeanBridgeNativea1d30b9a0f384ed5_make3cdb6e7435d0b988c5ab___closed__0_once, _init_l_LeanBridgeNativea1d30b9a0f384ed5_make3cdb6e7435d0b988c5ab___closed__0);
return v___x_403_;
}
else
{
lean_object* v___x_404_; 
v___x_404_ = l_LeanBridgeNativea1d30b9a0f384ed5_LbErased_RecursiveCheckedRecords_Packet_via__738d92def9c0ab42(v_val_401_);
if (lean_obj_tag(v___x_404_) == 0)
{
lean_object* v___x_405_; 
v___x_405_ = lean_obj_once(&l_LeanBridgeNativea1d30b9a0f384ed5_make3cdb6e7435d0b988c5ab___closed__0, &l_LeanBridgeNativea1d30b9a0f384ed5_make3cdb6e7435d0b988c5ab___closed__0_once, _init_l_LeanBridgeNativea1d30b9a0f384ed5_make3cdb6e7435d0b988c5ab___closed__0);
return v___x_405_;
}
else
{
lean_object* v_val_406_; lean_object* v___x_408_; uint8_t v_isShared_409_; uint8_t v_isSharedCheck_416_; 
v_val_406_ = lean_ctor_get(v___x_404_, 0);
v_isSharedCheck_416_ = !lean_is_exclusive(v___x_404_);
if (v_isSharedCheck_416_ == 0)
{
v___x_408_ = v___x_404_;
v_isShared_409_ = v_isSharedCheck_416_;
goto v_resetjp_407_;
}
else
{
lean_inc(v_val_406_);
lean_dec(v___x_404_);
v___x_408_ = lean_box(0);
v_isShared_409_ = v_isSharedCheck_416_;
goto v_resetjp_407_;
}
v_resetjp_407_:
{
lean_object* v___x_410_; lean_object* v___x_411_; lean_object* v___x_413_; 
v___x_410_ = lb_recursive_checked_record_probe_source_echo(v_val_406_);
v___x_411_ = l_LeanBridgeNativea1d30b9a0f384ed5_LbErased_RecursiveCheckedRecords_Packet_erase(v___x_410_);
if (v_isShared_409_ == 0)
{
lean_ctor_set(v___x_408_, 0, v___x_411_);
v___x_413_ = v___x_408_;
goto v_reusejp_412_;
}
else
{
lean_object* v_reuseFailAlloc_415_; 
v_reuseFailAlloc_415_ = lean_alloc_ctor(1, 1, 0);
lean_ctor_set(v_reuseFailAlloc_415_, 0, v___x_411_);
v___x_413_ = v_reuseFailAlloc_415_;
goto v_reusejp_412_;
}
v_reusejp_412_:
{
lean_object* v___x_414_; 
v___x_414_ = l_LeanBridgeNativea1d30b9a0f384ed5_carrierResult___redArg(v___x_413_);
return v___x_414_;
}
}
}
}
}
}
}
LEAN_EXPORT uint8_t l___private_Init_Data_Array_Basic_0__Array_anyMUnsafe_any___at___00LeanBridgeNativea1d30b9a0f384ed5_export1__fin__guard__0_spec__0(lean_object* v_as_417_, size_t v_i_418_, size_t v_stop_419_){
_start:
{
uint8_t v___x_420_; 
v___x_420_ = lean_usize_dec_eq(v_i_418_, v_stop_419_);
if (v___x_420_ == 0)
{
uint8_t v___x_421_; uint8_t v___y_423_; lean_object* v_val_427_; 
v___x_421_ = 1;
v_val_427_ = lean_array_uget_borrowed(v_as_417_, v_i_418_);
if (lean_obj_tag(v_val_427_) == 0)
{
v___y_423_ = v___x_420_;
goto v___jp_422_;
}
else
{
lean_object* v_val_428_; uint8_t v___x_429_; 
v_val_428_ = lean_ctor_get(v_val_427_, 0);
v___x_429_ = l_LeanBridgeNativea1d30b9a0f384ed5_LbErased_RecursiveCheckedRecords_Packet_validFin(v_val_428_);
if (v___x_429_ == 0)
{
return v___x_421_;
}
else
{
v___y_423_ = v___x_420_;
goto v___jp_422_;
}
}
v___jp_422_:
{
if (v___y_423_ == 0)
{
size_t v___x_424_; size_t v___x_425_; 
v___x_424_ = ((size_t)1ULL);
v___x_425_ = lean_usize_add(v_i_418_, v___x_424_);
v_i_418_ = v___x_425_;
goto _start;
}
else
{
return v___x_421_;
}
}
}
else
{
uint8_t v___x_430_; 
v___x_430_ = 0;
return v___x_430_;
}
}
}
LEAN_EXPORT lean_object* l___private_Init_Data_Array_Basic_0__Array_anyMUnsafe_any___at___00LeanBridgeNativea1d30b9a0f384ed5_export1__fin__guard__0_spec__0___boxed(lean_object* v_as_431_, lean_object* v_i_432_, lean_object* v_stop_433_){
_start:
{
size_t v_i_boxed_434_; size_t v_stop_boxed_435_; uint8_t v_res_436_; lean_object* v_r_437_; 
v_i_boxed_434_ = lean_unbox_usize(v_i_432_);
lean_dec(v_i_432_);
v_stop_boxed_435_ = lean_unbox_usize(v_stop_433_);
lean_dec(v_stop_433_);
v_res_436_ = l___private_Init_Data_Array_Basic_0__Array_anyMUnsafe_any___at___00LeanBridgeNativea1d30b9a0f384ed5_export1__fin__guard__0_spec__0(v_as_431_, v_i_boxed_434_, v_stop_boxed_435_);
lean_dec_ref(v_as_431_);
v_r_437_ = lean_box(v_res_436_);
return v_r_437_;
}
}
LEAN_EXPORT uint8_t lean_bridge_b1c46fbb29fb86a306017349_fin_guard_0(lean_object* v_carrier_438_){
  fputs("LB_SUBTYPE_ENTRY_V1 enter validator RecursiveCheckedRecords.echoGroups:fin_guard_0\n", stderr);

_start:
{
lean_object* v___x_439_; 
v___x_439_ = l_LeanBridgeNativea1d30b9a0f384ed5_carrierValue___redArg(v_carrier_438_);
lean_dec_ref(v_carrier_438_);
if (lean_obj_tag(v___x_439_) == 0)
{
uint8_t v___x_440_; 
v___x_440_ = 0;
return v___x_440_;
}
else
{
lean_object* v_val_441_; lean_object* v___x_442_; lean_object* v___x_443_; uint8_t v___x_444_; 
v_val_441_ = lean_ctor_get(v___x_439_, 0);
lean_inc(v_val_441_);
lean_dec_ref_known(v___x_439_, 1);
v___x_442_ = lean_unsigned_to_nat(0u);
v___x_443_ = lean_array_get_size(v_val_441_);
v___x_444_ = lean_nat_dec_lt(v___x_442_, v___x_443_);
if (v___x_444_ == 0)
{
uint8_t v___x_445_; 
lean_dec(v_val_441_);
v___x_445_ = 1;
return v___x_445_;
}
else
{
if (v___x_444_ == 0)
{
uint8_t v___x_446_; 
lean_dec(v_val_441_);
v___x_446_ = 1;
return v___x_446_;
}
else
{
size_t v___x_447_; size_t v___x_448_; uint8_t v___x_449_; 
v___x_447_ = ((size_t)0ULL);
v___x_448_ = lean_usize_of_nat(v___x_443_);
v___x_449_ = l___private_Init_Data_Array_Basic_0__Array_anyMUnsafe_any___at___00LeanBridgeNativea1d30b9a0f384ed5_export1__fin__guard__0_spec__0(v_val_441_, v___x_447_, v___x_448_);
lean_dec(v_val_441_);
if (v___x_449_ == 0)
{
uint8_t v___x_450_; 
v___x_450_ = 1;
return v___x_450_;
}
else
{
uint8_t v___x_451_; 
v___x_451_ = 0;
return v___x_451_;
}
}
}
}
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNativea1d30b9a0f384ed5_export1__fin__guard__0___boxed(lean_object* v_carrier_452_){
_start:
{
uint8_t v_res_453_; lean_object* v_r_454_; 
v_res_453_ = lean_bridge_b1c46fbb29fb86a306017349_fin_guard_0(v_carrier_452_);
v_r_454_ = lean_box(v_res_453_);
return v_r_454_;
}
}
LEAN_EXPORT lean_object* l___private_Init_Data_Array_Basic_0__Array_mapMUnsafe_map___at___00LeanBridgeNativea1d30b9a0f384ed5_export1__refinement__0_spec__0(size_t v_sz_455_, size_t v_i_456_, lean_object* v_bs_457_){
_start:
{
uint8_t v___x_458_; 
v___x_458_ = lean_usize_dec_lt(v_i_456_, v_sz_455_);
if (v___x_458_ == 0)
{
lean_object* v___x_459_; 
v___x_459_ = lean_alloc_ctor(1, 1, 0);
lean_ctor_set(v___x_459_, 0, v_bs_457_);
return v___x_459_;
}
else
{
lean_object* v_v_460_; lean_object* v___x_461_; lean_object* v_bs_x27_462_; lean_object* v_val_464_; 
v_v_460_ = lean_array_uget(v_bs_457_, v_i_456_);
v___x_461_ = lean_unsigned_to_nat(0u);
v_bs_x27_462_ = lean_array_uset(v_bs_457_, v_i_456_, v___x_461_);
if (lean_obj_tag(v_v_460_) == 0)
{
lean_object* v___x_469_; 
v___x_469_ = lean_box(0);
v_val_464_ = v___x_469_;
goto v___jp_463_;
}
else
{
lean_object* v_val_470_; lean_object* v___x_471_; 
v_val_470_ = lean_ctor_get(v_v_460_, 0);
lean_inc(v_val_470_);
lean_dec_ref_known(v_v_460_, 1);
v___x_471_ = l_LeanBridgeNativea1d30b9a0f384ed5_LbErased_RecursiveCheckedRecords_Packet_via__5b2d9cecaeed7529(v_val_470_);
if (lean_obj_tag(v___x_471_) == 0)
{
lean_object* v___x_472_; 
lean_dec_ref(v_bs_x27_462_);
v___x_472_ = lean_box(0);
return v___x_472_;
}
else
{
v_val_464_ = v___x_471_;
goto v___jp_463_;
}
}
v___jp_463_:
{
size_t v___x_465_; size_t v___x_466_; lean_object* v___x_467_; 
v___x_465_ = ((size_t)1ULL);
v___x_466_ = lean_usize_add(v_i_456_, v___x_465_);
v___x_467_ = lean_array_uset(v_bs_x27_462_, v_i_456_, v_val_464_);
v_i_456_ = v___x_466_;
v_bs_457_ = v___x_467_;
goto _start;
}
}
}
}
LEAN_EXPORT lean_object* l___private_Init_Data_Array_Basic_0__Array_mapMUnsafe_map___at___00LeanBridgeNativea1d30b9a0f384ed5_export1__refinement__0_spec__0___boxed(lean_object* v_sz_473_, lean_object* v_i_474_, lean_object* v_bs_475_){
_start:
{
size_t v_sz_boxed_476_; size_t v_i_boxed_477_; lean_object* v_res_478_; 
v_sz_boxed_476_ = lean_unbox_usize(v_sz_473_);
lean_dec(v_sz_473_);
v_i_boxed_477_ = lean_unbox_usize(v_i_474_);
lean_dec(v_i_474_);
v_res_478_ = l___private_Init_Data_Array_Basic_0__Array_mapMUnsafe_map___at___00LeanBridgeNativea1d30b9a0f384ed5_export1__refinement__0_spec__0(v_sz_boxed_476_, v_i_boxed_477_, v_bs_475_);
return v_res_478_;
}
}
LEAN_EXPORT uint8_t lean_bridge_b1c46fbb29fb86a306017349_refinement_0(lean_object* v_carrier_479_){
  fputs("LB_SUBTYPE_ENTRY_V1 enter validator RecursiveCheckedRecords.echoGroups:refinement_0\n", stderr);

_start:
{
lean_object* v___x_480_; 
v___x_480_ = l_LeanBridgeNativea1d30b9a0f384ed5_carrierValue___redArg(v_carrier_479_);
lean_dec_ref(v_carrier_479_);
if (lean_obj_tag(v___x_480_) == 0)
{
uint8_t v___x_481_; 
v___x_481_ = 0;
return v___x_481_;
}
else
{
lean_object* v_val_482_; lean_object* v___x_489_; lean_object* v___x_490_; uint8_t v___x_491_; 
v_val_482_ = lean_ctor_get(v___x_480_, 0);
lean_inc(v_val_482_);
lean_dec_ref_known(v___x_480_, 1);
v___x_489_ = lean_unsigned_to_nat(0u);
v___x_490_ = lean_array_get_size(v_val_482_);
v___x_491_ = lean_nat_dec_lt(v___x_489_, v___x_490_);
if (v___x_491_ == 0)
{
goto v___jp_483_;
}
else
{
if (v___x_491_ == 0)
{
goto v___jp_483_;
}
else
{
size_t v___x_492_; size_t v___x_493_; uint8_t v___x_494_; 
v___x_492_ = ((size_t)0ULL);
v___x_493_ = lean_usize_of_nat(v___x_490_);
v___x_494_ = l___private_Init_Data_Array_Basic_0__Array_anyMUnsafe_any___at___00LeanBridgeNativea1d30b9a0f384ed5_export1__fin__guard__0_spec__0(v_val_482_, v___x_492_, v___x_493_);
if (v___x_494_ == 0)
{
goto v___jp_483_;
}
else
{
uint8_t v___x_495_; 
lean_dec(v_val_482_);
v___x_495_ = 0;
return v___x_495_;
}
}
}
v___jp_483_:
{
size_t v_sz_484_; size_t v___x_485_; lean_object* v___x_486_; 
v_sz_484_ = lean_array_size(v_val_482_);
v___x_485_ = ((size_t)0ULL);
v___x_486_ = l___private_Init_Data_Array_Basic_0__Array_mapMUnsafe_map___at___00LeanBridgeNativea1d30b9a0f384ed5_export1__refinement__0_spec__0(v_sz_484_, v___x_485_, v_val_482_);
if (lean_obj_tag(v___x_486_) == 0)
{
uint8_t v___x_487_; 
v___x_487_ = 0;
return v___x_487_;
}
else
{
uint8_t v___x_488_; 
lean_dec_ref_known(v___x_486_, 1);
v___x_488_ = 1;
return v___x_488_;
}
}
}
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNativea1d30b9a0f384ed5_export1__refinement__0___boxed(lean_object* v_carrier_496_){
_start:
{
uint8_t v_res_497_; lean_object* v_r_498_; 
v_res_497_ = lean_bridge_b1c46fbb29fb86a306017349_refinement_0(v_carrier_496_);
v_r_498_ = lean_box(v_res_497_);
return v_r_498_;
}
}
LEAN_EXPORT uint8_t lean_bridge_b1c46fbb29fb86a306017349_graph_refinement_0_262d1fa6be548d6d1dd0(lean_object* v_carrier_499_){
  fputs("LB_SUBTYPE_ENTRY_V1 enter validator RecursiveCheckedRecords.echoGroups:graph_refinement_0_262d1fa6be548d6d1dd0\n", stderr);

_start:
{
lean_object* v___x_500_; 
v___x_500_ = l_LeanBridgeNativea1d30b9a0f384ed5_carrierValue___redArg(v_carrier_499_);
lean_dec_ref(v_carrier_499_);
if (lean_obj_tag(v___x_500_) == 0)
{
uint8_t v___x_501_; 
v___x_501_ = 0;
return v___x_501_;
}
else
{
lean_object* v_val_502_; lean_object* v___x_503_; 
v_val_502_ = lean_ctor_get(v___x_500_, 0);
lean_inc(v_val_502_);
lean_dec_ref_known(v___x_500_, 1);
v___x_503_ = lb_recursive_checked_record_probe_constructor_plusTwo(v_val_502_);
if (lean_obj_tag(v___x_503_) == 0)
{
uint8_t v___x_504_; 
v___x_504_ = 0;
return v___x_504_;
}
else
{
uint8_t v___x_505_; 
lean_dec_ref_known(v___x_503_, 1);
v___x_505_ = 1;
return v___x_505_;
}
}
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNativea1d30b9a0f384ed5_export1__graph__refinement__0__262d1fa6be548d6d1dd0___boxed(lean_object* v_carrier_506_){
_start:
{
uint8_t v_res_507_; lean_object* v_r_508_; 
v_res_507_ = lean_bridge_b1c46fbb29fb86a306017349_graph_refinement_0_262d1fa6be548d6d1dd0(v_carrier_506_);
v_r_508_ = lean_box(v_res_507_);
return v_r_508_;
}
}
LEAN_EXPORT uint8_t lean_bridge_b1c46fbb29fb86a306017349_graph_refinement_0_88f1c5c2e3a6ba3c4460(lean_object* v_carrier_509_){
  fputs("LB_SUBTYPE_ENTRY_V1 enter validator RecursiveCheckedRecords.echoGroups:graph_refinement_0_88f1c5c2e3a6ba3c4460\n", stderr);

_start:
{
lean_object* v___x_510_; 
v___x_510_ = l_LeanBridgeNativea1d30b9a0f384ed5_carrierValue___redArg(v_carrier_509_);
lean_dec_ref(v_carrier_509_);
if (lean_obj_tag(v___x_510_) == 0)
{
uint8_t v___x_511_; 
v___x_511_ = 0;
return v___x_511_;
}
else
{
lean_object* v_val_512_; lean_object* v___x_513_; 
v_val_512_ = lean_ctor_get(v___x_510_, 0);
lean_inc(v_val_512_);
lean_dec_ref_known(v___x_510_, 1);
v___x_513_ = l_LeanBridgeNativea1d30b9a0f384ed5_LbErased_RecursiveCheckedRecords_Packet_via__5b2d9cecaeed7529(v_val_512_);
if (lean_obj_tag(v___x_513_) == 0)
{
uint8_t v___x_514_; 
v___x_514_ = 0;
return v___x_514_;
}
else
{
uint8_t v___x_515_; 
lean_dec_ref_known(v___x_513_, 1);
v___x_515_ = 1;
return v___x_515_;
}
}
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNativea1d30b9a0f384ed5_export1__graph__refinement__0__88f1c5c2e3a6ba3c4460___boxed(lean_object* v_carrier_516_){
_start:
{
uint8_t v_res_517_; lean_object* v_r_518_; 
v_res_517_ = lean_bridge_b1c46fbb29fb86a306017349_graph_refinement_0_88f1c5c2e3a6ba3c4460(v_carrier_516_);
v_r_518_ = lean_box(v_res_517_);
return v_r_518_;
}
}
LEAN_EXPORT lean_object* l___private_Init_Data_Array_Basic_0__Array_mapMUnsafe_map___at___00LeanBridgeNativea1d30b9a0f384ed5_export1_spec__0(size_t v_sz_519_, size_t v_i_520_, lean_object* v_bs_521_){
_start:
{
uint8_t v___x_522_; 
v___x_522_ = lean_usize_dec_lt(v_i_520_, v_sz_519_);
if (v___x_522_ == 0)
{
return v_bs_521_;
}
else
{
lean_object* v_v_523_; lean_object* v___x_524_; lean_object* v_bs_x27_525_; lean_object* v___y_527_; 
v_v_523_ = lean_array_uget(v_bs_521_, v_i_520_);
v___x_524_ = lean_unsigned_to_nat(0u);
v_bs_x27_525_ = lean_array_uset(v_bs_521_, v_i_520_, v___x_524_);
if (lean_obj_tag(v_v_523_) == 0)
{
lean_object* v___x_532_; 
v___x_532_ = lean_box(0);
v___y_527_ = v___x_532_;
goto v___jp_526_;
}
else
{
lean_object* v_val_533_; lean_object* v___x_535_; uint8_t v_isShared_536_; uint8_t v_isSharedCheck_541_; 
v_val_533_ = lean_ctor_get(v_v_523_, 0);
v_isSharedCheck_541_ = !lean_is_exclusive(v_v_523_);
if (v_isSharedCheck_541_ == 0)
{
v___x_535_ = v_v_523_;
v_isShared_536_ = v_isSharedCheck_541_;
goto v_resetjp_534_;
}
else
{
lean_inc(v_val_533_);
lean_dec(v_v_523_);
v___x_535_ = lean_box(0);
v_isShared_536_ = v_isSharedCheck_541_;
goto v_resetjp_534_;
}
v_resetjp_534_:
{
lean_object* v___x_537_; lean_object* v___x_539_; 
v___x_537_ = l_LeanBridgeNativea1d30b9a0f384ed5_LbErased_RecursiveCheckedRecords_Packet_erase(v_val_533_);
if (v_isShared_536_ == 0)
{
lean_ctor_set(v___x_535_, 0, v___x_537_);
v___x_539_ = v___x_535_;
goto v_reusejp_538_;
}
else
{
lean_object* v_reuseFailAlloc_540_; 
v_reuseFailAlloc_540_ = lean_alloc_ctor(1, 1, 0);
lean_ctor_set(v_reuseFailAlloc_540_, 0, v___x_537_);
v___x_539_ = v_reuseFailAlloc_540_;
goto v_reusejp_538_;
}
v_reusejp_538_:
{
v___y_527_ = v___x_539_;
goto v___jp_526_;
}
}
}
v___jp_526_:
{
size_t v___x_528_; size_t v___x_529_; lean_object* v___x_530_; 
v___x_528_ = ((size_t)1ULL);
v___x_529_ = lean_usize_add(v_i_520_, v___x_528_);
v___x_530_ = lean_array_uset(v_bs_x27_525_, v_i_520_, v___y_527_);
v_i_520_ = v___x_529_;
v_bs_521_ = v___x_530_;
goto _start;
}
}
}
}
LEAN_EXPORT lean_object* l___private_Init_Data_Array_Basic_0__Array_mapMUnsafe_map___at___00LeanBridgeNativea1d30b9a0f384ed5_export1_spec__0___boxed(lean_object* v_sz_542_, lean_object* v_i_543_, lean_object* v_bs_544_){
_start:
{
size_t v_sz_boxed_545_; size_t v_i_boxed_546_; lean_object* v_res_547_; 
v_sz_boxed_545_ = lean_unbox_usize(v_sz_542_);
lean_dec(v_sz_542_);
v_i_boxed_546_ = lean_unbox_usize(v_i_543_);
lean_dec(v_i_543_);
v_res_547_ = l___private_Init_Data_Array_Basic_0__Array_mapMUnsafe_map___at___00LeanBridgeNativea1d30b9a0f384ed5_export1_spec__0(v_sz_boxed_545_, v_i_boxed_546_, v_bs_544_);
return v_res_547_;
}
}
static lean_object* _init_l_LeanBridgeNativea1d30b9a0f384ed5_export1___closed__0(void){
_start:
{
lean_object* v___x_548_; lean_object* v___x_549_; 
v___x_548_ = lean_box(0);
v___x_549_ = l_LeanBridgeNativea1d30b9a0f384ed5_carrierResult___redArg(v___x_548_);
return v___x_549_;
}
}
LEAN_EXPORT lean_object* lean_bridge_b1c46fbb29fb86a306017349_lean(lean_object* v_a0_550_){
  fputs("LB_SUBTYPE_ENTRY_V1 enter adapter RecursiveCheckedRecords.echoGroups\n", stderr);

_start:
{
lean_object* v___x_551_; 
v___x_551_ = l_LeanBridgeNativea1d30b9a0f384ed5_carrierValue___redArg(v_a0_550_);
lean_dec_ref(v_a0_550_);
if (lean_obj_tag(v___x_551_) == 0)
{
lean_object* v___x_552_; 
v___x_552_ = l_LeanBridgeNativea1d30b9a0f384ed5_carrierResult___redArg(v___x_551_);
return v___x_552_;
}
else
{
lean_object* v_val_553_; lean_object* v___x_571_; lean_object* v___x_572_; uint8_t v___x_573_; 
v_val_553_ = lean_ctor_get(v___x_551_, 0);
lean_inc(v_val_553_);
lean_dec_ref_known(v___x_551_, 1);
v___x_571_ = lean_unsigned_to_nat(0u);
v___x_572_ = lean_array_get_size(v_val_553_);
v___x_573_ = lean_nat_dec_lt(v___x_571_, v___x_572_);
if (v___x_573_ == 0)
{
goto v___jp_554_;
}
else
{
if (v___x_573_ == 0)
{
goto v___jp_554_;
}
else
{
size_t v___x_574_; size_t v___x_575_; uint8_t v___x_576_; 
v___x_574_ = ((size_t)0ULL);
v___x_575_ = lean_usize_of_nat(v___x_572_);
v___x_576_ = l___private_Init_Data_Array_Basic_0__Array_anyMUnsafe_any___at___00LeanBridgeNativea1d30b9a0f384ed5_export1__fin__guard__0_spec__0(v_val_553_, v___x_574_, v___x_575_);
if (v___x_576_ == 0)
{
goto v___jp_554_;
}
else
{
lean_object* v___x_577_; 
lean_dec(v_val_553_);
v___x_577_ = lean_obj_once(&l_LeanBridgeNativea1d30b9a0f384ed5_export1___closed__0, &l_LeanBridgeNativea1d30b9a0f384ed5_export1___closed__0_once, _init_l_LeanBridgeNativea1d30b9a0f384ed5_export1___closed__0);
return v___x_577_;
}
}
}
v___jp_554_:
{
size_t v_sz_555_; size_t v___x_556_; lean_object* v___x_557_; 
v_sz_555_ = lean_array_size(v_val_553_);
v___x_556_ = ((size_t)0ULL);
v___x_557_ = l___private_Init_Data_Array_Basic_0__Array_mapMUnsafe_map___at___00LeanBridgeNativea1d30b9a0f384ed5_export1__refinement__0_spec__0(v_sz_555_, v___x_556_, v_val_553_);
if (lean_obj_tag(v___x_557_) == 0)
{
lean_object* v___x_558_; 
v___x_558_ = lean_obj_once(&l_LeanBridgeNativea1d30b9a0f384ed5_export1___closed__0, &l_LeanBridgeNativea1d30b9a0f384ed5_export1___closed__0_once, _init_l_LeanBridgeNativea1d30b9a0f384ed5_export1___closed__0);
return v___x_558_;
}
else
{
lean_object* v_val_559_; lean_object* v___x_561_; uint8_t v_isShared_562_; uint8_t v_isSharedCheck_570_; 
v_val_559_ = lean_ctor_get(v___x_557_, 0);
v_isSharedCheck_570_ = !lean_is_exclusive(v___x_557_);
if (v_isSharedCheck_570_ == 0)
{
v___x_561_ = v___x_557_;
v_isShared_562_ = v_isSharedCheck_570_;
goto v_resetjp_560_;
}
else
{
lean_inc(v_val_559_);
lean_dec(v___x_557_);
v___x_561_ = lean_box(0);
v_isShared_562_ = v_isSharedCheck_570_;
goto v_resetjp_560_;
}
v_resetjp_560_:
{
lean_object* v___x_563_; size_t v_sz_564_; lean_object* v___x_565_; lean_object* v___x_567_; 
v___x_563_ = lb_recursive_checked_record_probe_source_echoGroups(v_val_559_);
v_sz_564_ = lean_array_size(v___x_563_);
v___x_565_ = l___private_Init_Data_Array_Basic_0__Array_mapMUnsafe_map___at___00LeanBridgeNativea1d30b9a0f384ed5_export1_spec__0(v_sz_564_, v___x_556_, v___x_563_);
if (v_isShared_562_ == 0)
{
lean_ctor_set(v___x_561_, 0, v___x_565_);
v___x_567_ = v___x_561_;
goto v_reusejp_566_;
}
else
{
lean_object* v_reuseFailAlloc_569_; 
v_reuseFailAlloc_569_ = lean_alloc_ctor(1, 1, 0);
lean_ctor_set(v_reuseFailAlloc_569_, 0, v___x_565_);
v___x_567_ = v_reuseFailAlloc_569_;
goto v_reusejp_566_;
}
v_reusejp_566_:
{
lean_object* v___x_568_; 
v___x_568_ = l_LeanBridgeNativea1d30b9a0f384ed5_carrierResult___redArg(v___x_567_);
return v___x_568_;
}
}
}
}
}
}
}
LEAN_EXPORT uint8_t lean_bridge_8540c0aac676a8863cdff838_fin_guard_0(lean_object* v_carrier_578_){
  fputs("LB_SUBTYPE_ENTRY_V1 enter validator RecursiveCheckedRecords.first:fin_guard_0\n", stderr);

_start:
{
lean_object* v___x_579_; 
v___x_579_ = l_LeanBridgeNativea1d30b9a0f384ed5_carrierValue___redArg(v_carrier_578_);
lean_dec_ref(v_carrier_578_);
if (lean_obj_tag(v___x_579_) == 0)
{
uint8_t v___x_580_; 
v___x_580_ = 0;
return v___x_580_;
}
else
{
lean_object* v_val_581_; uint8_t v___x_582_; 
v_val_581_ = lean_ctor_get(v___x_579_, 0);
lean_inc(v_val_581_);
lean_dec_ref_known(v___x_579_, 1);
v___x_582_ = l_LeanBridgeNativea1d30b9a0f384ed5_LbErased_RecursiveCheckedRecords_Packet_validFin(v_val_581_);
lean_dec(v_val_581_);
if (v___x_582_ == 0)
{
uint8_t v___x_583_; 
v___x_583_ = 0;
return v___x_583_;
}
else
{
uint8_t v___x_584_; 
v___x_584_ = 1;
return v___x_584_;
}
}
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNativea1d30b9a0f384ed5_export2__fin__guard__0___boxed(lean_object* v_carrier_585_){
_start:
{
uint8_t v_res_586_; lean_object* v_r_587_; 
v_res_586_ = lean_bridge_8540c0aac676a8863cdff838_fin_guard_0(v_carrier_585_);
v_r_587_ = lean_box(v_res_586_);
return v_r_587_;
}
}
LEAN_EXPORT uint8_t lean_bridge_8540c0aac676a8863cdff838_refinement_0(lean_object* v_carrier_588_){
  fputs("LB_SUBTYPE_ENTRY_V1 enter validator RecursiveCheckedRecords.first:refinement_0\n", stderr);

_start:
{
lean_object* v___x_589_; 
v___x_589_ = l_LeanBridgeNativea1d30b9a0f384ed5_carrierValue___redArg(v_carrier_588_);
lean_dec_ref(v_carrier_588_);
if (lean_obj_tag(v___x_589_) == 0)
{
uint8_t v___x_590_; 
v___x_590_ = 0;
return v___x_590_;
}
else
{
lean_object* v_val_591_; uint8_t v___x_592_; 
v_val_591_ = lean_ctor_get(v___x_589_, 0);
lean_inc(v_val_591_);
lean_dec_ref_known(v___x_589_, 1);
v___x_592_ = l_LeanBridgeNativea1d30b9a0f384ed5_LbErased_RecursiveCheckedRecords_Packet_validFin(v_val_591_);
if (v___x_592_ == 0)
{
uint8_t v___x_593_; 
lean_dec(v_val_591_);
v___x_593_ = 0;
return v___x_593_;
}
else
{
lean_object* v___x_594_; 
v___x_594_ = l_LeanBridgeNativea1d30b9a0f384ed5_LbErased_RecursiveCheckedRecords_Packet_via__738d92def9c0ab42(v_val_591_);
if (lean_obj_tag(v___x_594_) == 0)
{
uint8_t v___x_595_; 
v___x_595_ = 0;
return v___x_595_;
}
else
{
uint8_t v___x_596_; 
lean_dec_ref_known(v___x_594_, 1);
v___x_596_ = 1;
return v___x_596_;
}
}
}
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNativea1d30b9a0f384ed5_export2__refinement__0___boxed(lean_object* v_carrier_597_){
_start:
{
uint8_t v_res_598_; lean_object* v_r_599_; 
v_res_598_ = lean_bridge_8540c0aac676a8863cdff838_refinement_0(v_carrier_597_);
v_r_599_ = lean_box(v_res_598_);
return v_r_599_;
}
}
LEAN_EXPORT uint8_t lean_bridge_8540c0aac676a8863cdff838_graph_refinement_0_71ba01578b385b329e98(lean_object* v_carrier_600_){
  fputs("LB_SUBTYPE_ENTRY_V1 enter validator RecursiveCheckedRecords.first:graph_refinement_0_71ba01578b385b329e98\n", stderr);

_start:
{
lean_object* v___x_601_; 
v___x_601_ = l_LeanBridgeNativea1d30b9a0f384ed5_carrierValue___redArg(v_carrier_600_);
lean_dec_ref(v_carrier_600_);
if (lean_obj_tag(v___x_601_) == 0)
{
uint8_t v___x_602_; 
v___x_602_ = 0;
return v___x_602_;
}
else
{
lean_object* v_val_603_; lean_object* v___x_604_; 
v_val_603_ = lean_ctor_get(v___x_601_, 0);
lean_inc(v_val_603_);
lean_dec_ref_known(v___x_601_, 1);
v___x_604_ = lb_recursive_checked_record_probe_constructor_plusOne(v_val_603_);
if (lean_obj_tag(v___x_604_) == 0)
{
uint8_t v___x_605_; 
v___x_605_ = 0;
return v___x_605_;
}
else
{
uint8_t v___x_606_; 
lean_dec_ref_known(v___x_604_, 1);
v___x_606_ = 1;
return v___x_606_;
}
}
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNativea1d30b9a0f384ed5_export2__graph__refinement__0__71ba01578b385b329e98___boxed(lean_object* v_carrier_607_){
_start:
{
uint8_t v_res_608_; lean_object* v_r_609_; 
v_res_608_ = lean_bridge_8540c0aac676a8863cdff838_graph_refinement_0_71ba01578b385b329e98(v_carrier_607_);
v_r_609_ = lean_box(v_res_608_);
return v_r_609_;
}
}
LEAN_EXPORT uint8_t lean_bridge_8540c0aac676a8863cdff838_graph_refinement_0_8b6f9e05ee7b31aa9e96(lean_object* v_carrier_610_){
  fputs("LB_SUBTYPE_ENTRY_V1 enter validator RecursiveCheckedRecords.first:graph_refinement_0_8b6f9e05ee7b31aa9e96\n", stderr);

_start:
{
lean_object* v___x_611_; 
v___x_611_ = l_LeanBridgeNativea1d30b9a0f384ed5_carrierValue___redArg(v_carrier_610_);
lean_dec_ref(v_carrier_610_);
if (lean_obj_tag(v___x_611_) == 0)
{
uint8_t v___x_612_; 
v___x_612_ = 0;
return v___x_612_;
}
else
{
lean_object* v_val_613_; lean_object* v___x_614_; 
v_val_613_ = lean_ctor_get(v___x_611_, 0);
lean_inc(v_val_613_);
lean_dec_ref_known(v___x_611_, 1);
v___x_614_ = l_LeanBridgeNativea1d30b9a0f384ed5_LbErased_RecursiveCheckedRecords_Packet_via__738d92def9c0ab42(v_val_613_);
if (lean_obj_tag(v___x_614_) == 0)
{
uint8_t v___x_615_; 
v___x_615_ = 0;
return v___x_615_;
}
else
{
uint8_t v___x_616_; 
lean_dec_ref_known(v___x_614_, 1);
v___x_616_ = 1;
return v___x_616_;
}
}
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNativea1d30b9a0f384ed5_export2__graph__refinement__0__8b6f9e05ee7b31aa9e96___boxed(lean_object* v_carrier_617_){
_start:
{
uint8_t v_res_618_; lean_object* v_r_619_; 
v_res_618_ = lean_bridge_8540c0aac676a8863cdff838_graph_refinement_0_8b6f9e05ee7b31aa9e96(v_carrier_617_);
v_r_619_ = lean_box(v_res_618_);
return v_r_619_;
}
}
LEAN_EXPORT lean_object* lean_bridge_8540c0aac676a8863cdff838_lean(lean_object* v_a0_620_){
  fputs("LB_SUBTYPE_ENTRY_V1 enter adapter RecursiveCheckedRecords.first\n", stderr);

_start:
{
lean_object* v___x_621_; 
v___x_621_ = l_LeanBridgeNativea1d30b9a0f384ed5_carrierValue___redArg(v_a0_620_);
lean_dec_ref(v_a0_620_);
if (lean_obj_tag(v___x_621_) == 0)
{
lean_object* v___x_622_; 
v___x_622_ = lean_obj_once(&l_LeanBridgeNativea1d30b9a0f384ed5_field03cdb6e7435d0b988c5ab___closed__0, &l_LeanBridgeNativea1d30b9a0f384ed5_field03cdb6e7435d0b988c5ab___closed__0_once, _init_l_LeanBridgeNativea1d30b9a0f384ed5_field03cdb6e7435d0b988c5ab___closed__0);
return v___x_622_;
}
else
{
lean_object* v_val_623_; uint8_t v___x_624_; 
v_val_623_ = lean_ctor_get(v___x_621_, 0);
lean_inc(v_val_623_);
lean_dec_ref_known(v___x_621_, 1);
v___x_624_ = l_LeanBridgeNativea1d30b9a0f384ed5_LbErased_RecursiveCheckedRecords_Packet_validFin(v_val_623_);
if (v___x_624_ == 0)
{
lean_object* v___x_625_; 
lean_dec(v_val_623_);
v___x_625_ = lean_obj_once(&l_LeanBridgeNativea1d30b9a0f384ed5_field03cdb6e7435d0b988c5ab___closed__0, &l_LeanBridgeNativea1d30b9a0f384ed5_field03cdb6e7435d0b988c5ab___closed__0_once, _init_l_LeanBridgeNativea1d30b9a0f384ed5_field03cdb6e7435d0b988c5ab___closed__0);
return v___x_625_;
}
else
{
lean_object* v___x_626_; 
v___x_626_ = l_LeanBridgeNativea1d30b9a0f384ed5_LbErased_RecursiveCheckedRecords_Packet_via__738d92def9c0ab42(v_val_623_);
if (lean_obj_tag(v___x_626_) == 0)
{
lean_object* v___x_627_; 
v___x_627_ = lean_obj_once(&l_LeanBridgeNativea1d30b9a0f384ed5_field03cdb6e7435d0b988c5ab___closed__0, &l_LeanBridgeNativea1d30b9a0f384ed5_field03cdb6e7435d0b988c5ab___closed__0_once, _init_l_LeanBridgeNativea1d30b9a0f384ed5_field03cdb6e7435d0b988c5ab___closed__0);
return v___x_627_;
}
else
{
lean_object* v_val_628_; lean_object* v___x_630_; uint8_t v_isShared_631_; uint8_t v_isSharedCheck_637_; 
v_val_628_ = lean_ctor_get(v___x_626_, 0);
v_isSharedCheck_637_ = !lean_is_exclusive(v___x_626_);
if (v_isSharedCheck_637_ == 0)
{
v___x_630_ = v___x_626_;
v_isShared_631_ = v_isSharedCheck_637_;
goto v_resetjp_629_;
}
else
{
lean_inc(v_val_628_);
lean_dec(v___x_626_);
v___x_630_ = lean_box(0);
v_isShared_631_ = v_isSharedCheck_637_;
goto v_resetjp_629_;
}
v_resetjp_629_:
{
lean_object* v___x_632_; lean_object* v___x_634_; 
v___x_632_ = lb_recursive_checked_record_probe_source_first(v_val_628_);
if (v_isShared_631_ == 0)
{
lean_ctor_set(v___x_630_, 0, v___x_632_);
v___x_634_ = v___x_630_;
goto v_reusejp_633_;
}
else
{
lean_object* v_reuseFailAlloc_636_; 
v_reuseFailAlloc_636_ = lean_alloc_ctor(1, 1, 0);
lean_ctor_set(v_reuseFailAlloc_636_, 0, v___x_632_);
v___x_634_ = v_reuseFailAlloc_636_;
goto v_reusejp_633_;
}
v_reusejp_633_:
{
lean_object* v___x_635_; 
v___x_635_ = l_LeanBridgeNativea1d30b9a0f384ed5_carrierResult___redArg(v___x_634_);
return v___x_635_;
}
}
}
}
}
}
}
LEAN_EXPORT uint8_t lean_bridge_24b13094b4039f73d0959480_fin_guard_0(lean_object* v_carrier_638_){
  fputs("LB_SUBTYPE_ENTRY_V1 enter validator RecursiveCheckedRecords.groups:fin_guard_0\n", stderr);

_start:
{
lean_object* v___x_639_; 
v___x_639_ = l_LeanBridgeNativea1d30b9a0f384ed5_carrierValue___redArg(v_carrier_638_);
lean_dec_ref(v_carrier_638_);
if (lean_obj_tag(v___x_639_) == 0)
{
uint8_t v___x_640_; 
v___x_640_ = 0;
return v___x_640_;
}
else
{
lean_object* v_val_641_; lean_object* v___x_642_; lean_object* v___x_643_; uint8_t v___x_644_; 
v_val_641_ = lean_ctor_get(v___x_639_, 0);
lean_inc(v_val_641_);
lean_dec_ref_known(v___x_639_, 1);
v___x_642_ = lean_unsigned_to_nat(0u);
v___x_643_ = lean_array_get_size(v_val_641_);
v___x_644_ = lean_nat_dec_lt(v___x_642_, v___x_643_);
if (v___x_644_ == 0)
{
uint8_t v___x_645_; 
lean_dec(v_val_641_);
v___x_645_ = 1;
return v___x_645_;
}
else
{
if (v___x_644_ == 0)
{
uint8_t v___x_646_; 
lean_dec(v_val_641_);
v___x_646_ = 1;
return v___x_646_;
}
else
{
size_t v___x_647_; size_t v___x_648_; uint8_t v___x_649_; 
v___x_647_ = ((size_t)0ULL);
v___x_648_ = lean_usize_of_nat(v___x_643_);
v___x_649_ = l___private_Init_Data_Array_Basic_0__Array_anyMUnsafe_any___at___00LeanBridgeNativea1d30b9a0f384ed5_export1__fin__guard__0_spec__0(v_val_641_, v___x_647_, v___x_648_);
lean_dec(v_val_641_);
if (v___x_649_ == 0)
{
uint8_t v___x_650_; 
v___x_650_ = 1;
return v___x_650_;
}
else
{
uint8_t v___x_651_; 
v___x_651_ = 0;
return v___x_651_;
}
}
}
}
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNativea1d30b9a0f384ed5_export3__fin__guard__0___boxed(lean_object* v_carrier_652_){
_start:
{
uint8_t v_res_653_; lean_object* v_r_654_; 
v_res_653_ = lean_bridge_24b13094b4039f73d0959480_fin_guard_0(v_carrier_652_);
v_r_654_ = lean_box(v_res_653_);
return v_r_654_;
}
}
LEAN_EXPORT lean_object* l___private_Init_Data_Array_Basic_0__Array_mapMUnsafe_map___at___00LeanBridgeNativea1d30b9a0f384ed5_export3__refinement__0_spec__0(size_t v_sz_655_, size_t v_i_656_, lean_object* v_bs_657_){
_start:
{
uint8_t v___x_658_; 
v___x_658_ = lean_usize_dec_lt(v_i_656_, v_sz_655_);
if (v___x_658_ == 0)
{
lean_object* v___x_659_; 
v___x_659_ = lean_alloc_ctor(1, 1, 0);
lean_ctor_set(v___x_659_, 0, v_bs_657_);
return v___x_659_;
}
else
{
lean_object* v_v_660_; lean_object* v___x_661_; lean_object* v_bs_x27_662_; lean_object* v_val_664_; 
v_v_660_ = lean_array_uget(v_bs_657_, v_i_656_);
v___x_661_ = lean_unsigned_to_nat(0u);
v_bs_x27_662_ = lean_array_uset(v_bs_657_, v_i_656_, v___x_661_);
if (lean_obj_tag(v_v_660_) == 0)
{
lean_object* v___x_669_; 
v___x_669_ = lean_box(0);
v_val_664_ = v___x_669_;
goto v___jp_663_;
}
else
{
lean_object* v_val_670_; lean_object* v___x_671_; 
v_val_670_ = lean_ctor_get(v_v_660_, 0);
lean_inc(v_val_670_);
lean_dec_ref_known(v_v_660_, 1);
v___x_671_ = l_LeanBridgeNativea1d30b9a0f384ed5_LbErased_RecursiveCheckedRecords_Packet_via__738d92def9c0ab42(v_val_670_);
if (lean_obj_tag(v___x_671_) == 0)
{
lean_object* v___x_672_; 
lean_dec_ref(v_bs_x27_662_);
v___x_672_ = lean_box(0);
return v___x_672_;
}
else
{
v_val_664_ = v___x_671_;
goto v___jp_663_;
}
}
v___jp_663_:
{
size_t v___x_665_; size_t v___x_666_; lean_object* v___x_667_; 
v___x_665_ = ((size_t)1ULL);
v___x_666_ = lean_usize_add(v_i_656_, v___x_665_);
v___x_667_ = lean_array_uset(v_bs_x27_662_, v_i_656_, v_val_664_);
v_i_656_ = v___x_666_;
v_bs_657_ = v___x_667_;
goto _start;
}
}
}
}
LEAN_EXPORT lean_object* l___private_Init_Data_Array_Basic_0__Array_mapMUnsafe_map___at___00LeanBridgeNativea1d30b9a0f384ed5_export3__refinement__0_spec__0___boxed(lean_object* v_sz_673_, lean_object* v_i_674_, lean_object* v_bs_675_){
_start:
{
size_t v_sz_boxed_676_; size_t v_i_boxed_677_; lean_object* v_res_678_; 
v_sz_boxed_676_ = lean_unbox_usize(v_sz_673_);
lean_dec(v_sz_673_);
v_i_boxed_677_ = lean_unbox_usize(v_i_674_);
lean_dec(v_i_674_);
v_res_678_ = l___private_Init_Data_Array_Basic_0__Array_mapMUnsafe_map___at___00LeanBridgeNativea1d30b9a0f384ed5_export3__refinement__0_spec__0(v_sz_boxed_676_, v_i_boxed_677_, v_bs_675_);
return v_res_678_;
}
}
LEAN_EXPORT uint8_t lean_bridge_24b13094b4039f73d0959480_refinement_0(lean_object* v_carrier_679_){
  fputs("LB_SUBTYPE_ENTRY_V1 enter validator RecursiveCheckedRecords.groups:refinement_0\n", stderr);

_start:
{
lean_object* v___x_680_; 
v___x_680_ = l_LeanBridgeNativea1d30b9a0f384ed5_carrierValue___redArg(v_carrier_679_);
lean_dec_ref(v_carrier_679_);
if (lean_obj_tag(v___x_680_) == 0)
{
uint8_t v___x_681_; 
v___x_681_ = 0;
return v___x_681_;
}
else
{
lean_object* v_val_682_; lean_object* v___x_689_; lean_object* v___x_690_; uint8_t v___x_691_; 
v_val_682_ = lean_ctor_get(v___x_680_, 0);
lean_inc(v_val_682_);
lean_dec_ref_known(v___x_680_, 1);
v___x_689_ = lean_unsigned_to_nat(0u);
v___x_690_ = lean_array_get_size(v_val_682_);
v___x_691_ = lean_nat_dec_lt(v___x_689_, v___x_690_);
if (v___x_691_ == 0)
{
goto v___jp_683_;
}
else
{
if (v___x_691_ == 0)
{
goto v___jp_683_;
}
else
{
size_t v___x_692_; size_t v___x_693_; uint8_t v___x_694_; 
v___x_692_ = ((size_t)0ULL);
v___x_693_ = lean_usize_of_nat(v___x_690_);
v___x_694_ = l___private_Init_Data_Array_Basic_0__Array_anyMUnsafe_any___at___00LeanBridgeNativea1d30b9a0f384ed5_export1__fin__guard__0_spec__0(v_val_682_, v___x_692_, v___x_693_);
if (v___x_694_ == 0)
{
goto v___jp_683_;
}
else
{
uint8_t v___x_695_; 
lean_dec(v_val_682_);
v___x_695_ = 0;
return v___x_695_;
}
}
}
v___jp_683_:
{
size_t v_sz_684_; size_t v___x_685_; lean_object* v___x_686_; 
v_sz_684_ = lean_array_size(v_val_682_);
v___x_685_ = ((size_t)0ULL);
v___x_686_ = l___private_Init_Data_Array_Basic_0__Array_mapMUnsafe_map___at___00LeanBridgeNativea1d30b9a0f384ed5_export3__refinement__0_spec__0(v_sz_684_, v___x_685_, v_val_682_);
if (lean_obj_tag(v___x_686_) == 0)
{
uint8_t v___x_687_; 
v___x_687_ = 0;
return v___x_687_;
}
else
{
uint8_t v___x_688_; 
lean_dec_ref_known(v___x_686_, 1);
v___x_688_ = 1;
return v___x_688_;
}
}
}
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNativea1d30b9a0f384ed5_export3__refinement__0___boxed(lean_object* v_carrier_696_){
_start:
{
uint8_t v_res_697_; lean_object* v_r_698_; 
v_res_697_ = lean_bridge_24b13094b4039f73d0959480_refinement_0(v_carrier_696_);
v_r_698_ = lean_box(v_res_697_);
return v_r_698_;
}
}
LEAN_EXPORT uint8_t lean_bridge_24b13094b4039f73d0959480_graph_refinement_0_71ba01578b385b329e98(lean_object* v_carrier_699_){
  fputs("LB_SUBTYPE_ENTRY_V1 enter validator RecursiveCheckedRecords.groups:graph_refinement_0_71ba01578b385b329e98\n", stderr);

_start:
{
lean_object* v___x_700_; 
v___x_700_ = l_LeanBridgeNativea1d30b9a0f384ed5_carrierValue___redArg(v_carrier_699_);
lean_dec_ref(v_carrier_699_);
if (lean_obj_tag(v___x_700_) == 0)
{
uint8_t v___x_701_; 
v___x_701_ = 0;
return v___x_701_;
}
else
{
lean_object* v_val_702_; lean_object* v___x_703_; 
v_val_702_ = lean_ctor_get(v___x_700_, 0);
lean_inc(v_val_702_);
lean_dec_ref_known(v___x_700_, 1);
v___x_703_ = lb_recursive_checked_record_probe_constructor_plusOne(v_val_702_);
if (lean_obj_tag(v___x_703_) == 0)
{
uint8_t v___x_704_; 
v___x_704_ = 0;
return v___x_704_;
}
else
{
uint8_t v___x_705_; 
lean_dec_ref_known(v___x_703_, 1);
v___x_705_ = 1;
return v___x_705_;
}
}
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNativea1d30b9a0f384ed5_export3__graph__refinement__0__71ba01578b385b329e98___boxed(lean_object* v_carrier_706_){
_start:
{
uint8_t v_res_707_; lean_object* v_r_708_; 
v_res_707_ = lean_bridge_24b13094b4039f73d0959480_graph_refinement_0_71ba01578b385b329e98(v_carrier_706_);
v_r_708_ = lean_box(v_res_707_);
return v_r_708_;
}
}
LEAN_EXPORT uint8_t lean_bridge_24b13094b4039f73d0959480_graph_refinement_0_8b6f9e05ee7b31aa9e96(lean_object* v_carrier_709_){
  fputs("LB_SUBTYPE_ENTRY_V1 enter validator RecursiveCheckedRecords.groups:graph_refinement_0_8b6f9e05ee7b31aa9e96\n", stderr);

_start:
{
lean_object* v___x_710_; 
v___x_710_ = l_LeanBridgeNativea1d30b9a0f384ed5_carrierValue___redArg(v_carrier_709_);
lean_dec_ref(v_carrier_709_);
if (lean_obj_tag(v___x_710_) == 0)
{
uint8_t v___x_711_; 
v___x_711_ = 0;
return v___x_711_;
}
else
{
lean_object* v_val_712_; lean_object* v___x_713_; 
v_val_712_ = lean_ctor_get(v___x_710_, 0);
lean_inc(v_val_712_);
lean_dec_ref_known(v___x_710_, 1);
v___x_713_ = l_LeanBridgeNativea1d30b9a0f384ed5_LbErased_RecursiveCheckedRecords_Packet_via__738d92def9c0ab42(v_val_712_);
if (lean_obj_tag(v___x_713_) == 0)
{
uint8_t v___x_714_; 
v___x_714_ = 0;
return v___x_714_;
}
else
{
uint8_t v___x_715_; 
lean_dec_ref_known(v___x_713_, 1);
v___x_715_ = 1;
return v___x_715_;
}
}
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNativea1d30b9a0f384ed5_export3__graph__refinement__0__8b6f9e05ee7b31aa9e96___boxed(lean_object* v_carrier_716_){
_start:
{
uint8_t v_res_717_; lean_object* v_r_718_; 
v_res_717_ = lean_bridge_24b13094b4039f73d0959480_graph_refinement_0_8b6f9e05ee7b31aa9e96(v_carrier_716_);
v_r_718_ = lean_box(v_res_717_);
return v_r_718_;
}
}
LEAN_EXPORT lean_object* lean_bridge_24b13094b4039f73d0959480_lean(lean_object* v_a0_719_){
  fputs("LB_SUBTYPE_ENTRY_V1 enter adapter RecursiveCheckedRecords.groups\n", stderr);

_start:
{
lean_object* v___x_720_; 
v___x_720_ = l_LeanBridgeNativea1d30b9a0f384ed5_carrierValue___redArg(v_a0_719_);
lean_dec_ref(v_a0_719_);
if (lean_obj_tag(v___x_720_) == 0)
{
lean_object* v___x_721_; 
v___x_721_ = lean_obj_once(&l_LeanBridgeNativea1d30b9a0f384ed5_field03cdb6e7435d0b988c5ab___closed__0, &l_LeanBridgeNativea1d30b9a0f384ed5_field03cdb6e7435d0b988c5ab___closed__0_once, _init_l_LeanBridgeNativea1d30b9a0f384ed5_field03cdb6e7435d0b988c5ab___closed__0);
return v___x_721_;
}
else
{
lean_object* v_val_722_; lean_object* v___x_738_; lean_object* v___x_739_; uint8_t v___x_740_; 
v_val_722_ = lean_ctor_get(v___x_720_, 0);
lean_inc(v_val_722_);
lean_dec_ref_known(v___x_720_, 1);
v___x_738_ = lean_unsigned_to_nat(0u);
v___x_739_ = lean_array_get_size(v_val_722_);
v___x_740_ = lean_nat_dec_lt(v___x_738_, v___x_739_);
if (v___x_740_ == 0)
{
goto v___jp_723_;
}
else
{
if (v___x_740_ == 0)
{
goto v___jp_723_;
}
else
{
size_t v___x_741_; size_t v___x_742_; uint8_t v___x_743_; 
v___x_741_ = ((size_t)0ULL);
v___x_742_ = lean_usize_of_nat(v___x_739_);
v___x_743_ = l___private_Init_Data_Array_Basic_0__Array_anyMUnsafe_any___at___00LeanBridgeNativea1d30b9a0f384ed5_export1__fin__guard__0_spec__0(v_val_722_, v___x_741_, v___x_742_);
if (v___x_743_ == 0)
{
goto v___jp_723_;
}
else
{
lean_object* v___x_744_; 
lean_dec(v_val_722_);
v___x_744_ = lean_obj_once(&l_LeanBridgeNativea1d30b9a0f384ed5_field03cdb6e7435d0b988c5ab___closed__0, &l_LeanBridgeNativea1d30b9a0f384ed5_field03cdb6e7435d0b988c5ab___closed__0_once, _init_l_LeanBridgeNativea1d30b9a0f384ed5_field03cdb6e7435d0b988c5ab___closed__0);
return v___x_744_;
}
}
}
v___jp_723_:
{
size_t v_sz_724_; size_t v___x_725_; lean_object* v___x_726_; 
v_sz_724_ = lean_array_size(v_val_722_);
v___x_725_ = ((size_t)0ULL);
v___x_726_ = l___private_Init_Data_Array_Basic_0__Array_mapMUnsafe_map___at___00LeanBridgeNativea1d30b9a0f384ed5_export3__refinement__0_spec__0(v_sz_724_, v___x_725_, v_val_722_);
if (lean_obj_tag(v___x_726_) == 0)
{
lean_object* v___x_727_; 
v___x_727_ = lean_obj_once(&l_LeanBridgeNativea1d30b9a0f384ed5_field03cdb6e7435d0b988c5ab___closed__0, &l_LeanBridgeNativea1d30b9a0f384ed5_field03cdb6e7435d0b988c5ab___closed__0_once, _init_l_LeanBridgeNativea1d30b9a0f384ed5_field03cdb6e7435d0b988c5ab___closed__0);
return v___x_727_;
}
else
{
lean_object* v_val_728_; lean_object* v___x_730_; uint8_t v_isShared_731_; uint8_t v_isSharedCheck_737_; 
v_val_728_ = lean_ctor_get(v___x_726_, 0);
v_isSharedCheck_737_ = !lean_is_exclusive(v___x_726_);
if (v_isSharedCheck_737_ == 0)
{
v___x_730_ = v___x_726_;
v_isShared_731_ = v_isSharedCheck_737_;
goto v_resetjp_729_;
}
else
{
lean_inc(v_val_728_);
lean_dec(v___x_726_);
v___x_730_ = lean_box(0);
v_isShared_731_ = v_isSharedCheck_737_;
goto v_resetjp_729_;
}
v_resetjp_729_:
{
lean_object* v___x_732_; lean_object* v___x_734_; 
v___x_732_ = lb_recursive_checked_record_probe_source_groups(v_val_728_);
if (v_isShared_731_ == 0)
{
lean_ctor_set(v___x_730_, 0, v___x_732_);
v___x_734_ = v___x_730_;
goto v_reusejp_733_;
}
else
{
lean_object* v_reuseFailAlloc_736_; 
v_reuseFailAlloc_736_ = lean_alloc_ctor(1, 1, 0);
lean_ctor_set(v_reuseFailAlloc_736_, 0, v___x_732_);
v___x_734_ = v_reuseFailAlloc_736_;
goto v_reusejp_733_;
}
v_reusejp_733_:
{
lean_object* v___x_735_; 
v___x_735_ = l_LeanBridgeNativea1d30b9a0f384ed5_carrierResult___redArg(v___x_734_);
return v___x_735_;
}
}
}
}
}
}
}
LEAN_EXPORT uint8_t lean_bridge_df0f714db6fdbd3762d5e0a5_fin_guard_0(lean_object* v_carrier_745_){
  fputs("LB_SUBTYPE_ENTRY_V1 enter validator RecursiveCheckedRecords.produce:fin_guard_0\n", stderr);

_start:
{
lean_object* v___x_746_; 
v___x_746_ = l_LeanBridgeNativea1d30b9a0f384ed5_carrierValue___redArg(v_carrier_745_);
lean_dec_ref(v_carrier_745_);
if (lean_obj_tag(v___x_746_) == 0)
{
uint8_t v___x_747_; 
v___x_747_ = 0;
return v___x_747_;
}
else
{
uint8_t v___x_748_; 
lean_dec_ref_known(v___x_746_, 1);
v___x_748_ = 1;
return v___x_748_;
}
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNativea1d30b9a0f384ed5_export4__fin__guard__0___boxed(lean_object* v_carrier_749_){
_start:
{
uint8_t v_res_750_; lean_object* v_r_751_; 
v_res_750_ = lean_bridge_df0f714db6fdbd3762d5e0a5_fin_guard_0(v_carrier_749_);
v_r_751_ = lean_box(v_res_750_);
return v_r_751_;
}
}
LEAN_EXPORT lean_object* lean_bridge_df0f714db6fdbd3762d5e0a5_lean(lean_object* v_a0_752_){
  fputs("LB_SUBTYPE_ENTRY_V1 enter adapter RecursiveCheckedRecords.produce\n", stderr);

_start:
{
lean_object* v___x_753_; 
v___x_753_ = l_LeanBridgeNativea1d30b9a0f384ed5_carrierValue___redArg(v_a0_752_);
lean_dec_ref(v_a0_752_);
if (lean_obj_tag(v___x_753_) == 0)
{
lean_object* v___x_754_; 
v___x_754_ = lean_obj_once(&l_LeanBridgeNativea1d30b9a0f384ed5_make3cdb6e7435d0b988c5ab___closed__0, &l_LeanBridgeNativea1d30b9a0f384ed5_make3cdb6e7435d0b988c5ab___closed__0_once, _init_l_LeanBridgeNativea1d30b9a0f384ed5_make3cdb6e7435d0b988c5ab___closed__0);
return v___x_754_;
}
else
{
lean_object* v_val_755_; lean_object* v___x_757_; uint8_t v_isShared_758_; uint8_t v_isSharedCheck_765_; 
v_val_755_ = lean_ctor_get(v___x_753_, 0);
v_isSharedCheck_765_ = !lean_is_exclusive(v___x_753_);
if (v_isSharedCheck_765_ == 0)
{
v___x_757_ = v___x_753_;
v_isShared_758_ = v_isSharedCheck_765_;
goto v_resetjp_756_;
}
else
{
lean_inc(v_val_755_);
lean_dec(v___x_753_);
v___x_757_ = lean_box(0);
v_isShared_758_ = v_isSharedCheck_765_;
goto v_resetjp_756_;
}
v_resetjp_756_:
{
lean_object* v___x_759_; lean_object* v___x_760_; lean_object* v___x_762_; 
v___x_759_ = lb_recursive_checked_record_probe_source_produce(v_val_755_);
v___x_760_ = l_LeanBridgeNativea1d30b9a0f384ed5_LbErased_RecursiveCheckedRecords_Packet_erase(v___x_759_);
if (v_isShared_758_ == 0)
{
lean_ctor_set(v___x_757_, 0, v___x_760_);
v___x_762_ = v___x_757_;
goto v_reusejp_761_;
}
else
{
lean_object* v_reuseFailAlloc_764_; 
v_reuseFailAlloc_764_ = lean_alloc_ctor(1, 1, 0);
lean_ctor_set(v_reuseFailAlloc_764_, 0, v___x_760_);
v___x_762_ = v_reuseFailAlloc_764_;
goto v_reusejp_761_;
}
v_reusejp_761_:
{
lean_object* v___x_763_; 
v___x_763_ = l_LeanBridgeNativea1d30b9a0f384ed5_carrierResult___redArg(v___x_762_);
return v___x_763_;
}
}
}
}
}
LEAN_EXPORT uint8_t lean_bridge_c3338006aea7f276ff222c0c_fin_guard_0(lean_object* v_carrier_766_){
  fputs("LB_SUBTYPE_ENTRY_V1 enter validator RecursiveCheckedRecords.second:fin_guard_0\n", stderr);

_start:
{
lean_object* v___x_767_; 
v___x_767_ = l_LeanBridgeNativea1d30b9a0f384ed5_carrierValue___redArg(v_carrier_766_);
lean_dec_ref(v_carrier_766_);
if (lean_obj_tag(v___x_767_) == 0)
{
uint8_t v___x_768_; 
v___x_768_ = 0;
return v___x_768_;
}
else
{
lean_object* v_val_769_; uint8_t v___x_770_; 
v_val_769_ = lean_ctor_get(v___x_767_, 0);
lean_inc(v_val_769_);
lean_dec_ref_known(v___x_767_, 1);
v___x_770_ = l_LeanBridgeNativea1d30b9a0f384ed5_LbErased_RecursiveCheckedRecords_Packet_validFin(v_val_769_);
lean_dec(v_val_769_);
if (v___x_770_ == 0)
{
uint8_t v___x_771_; 
v___x_771_ = 0;
return v___x_771_;
}
else
{
uint8_t v___x_772_; 
v___x_772_ = 1;
return v___x_772_;
}
}
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNativea1d30b9a0f384ed5_export5__fin__guard__0___boxed(lean_object* v_carrier_773_){
_start:
{
uint8_t v_res_774_; lean_object* v_r_775_; 
v_res_774_ = lean_bridge_c3338006aea7f276ff222c0c_fin_guard_0(v_carrier_773_);
v_r_775_ = lean_box(v_res_774_);
return v_r_775_;
}
}
LEAN_EXPORT uint8_t lean_bridge_c3338006aea7f276ff222c0c_refinement_0(lean_object* v_carrier_776_){
  fputs("LB_SUBTYPE_ENTRY_V1 enter validator RecursiveCheckedRecords.second:refinement_0\n", stderr);

_start:
{
lean_object* v___x_777_; 
v___x_777_ = l_LeanBridgeNativea1d30b9a0f384ed5_carrierValue___redArg(v_carrier_776_);
lean_dec_ref(v_carrier_776_);
if (lean_obj_tag(v___x_777_) == 0)
{
uint8_t v___x_778_; 
v___x_778_ = 0;
return v___x_778_;
}
else
{
lean_object* v_val_779_; uint8_t v___x_780_; 
v_val_779_ = lean_ctor_get(v___x_777_, 0);
lean_inc(v_val_779_);
lean_dec_ref_known(v___x_777_, 1);
v___x_780_ = l_LeanBridgeNativea1d30b9a0f384ed5_LbErased_RecursiveCheckedRecords_Packet_validFin(v_val_779_);
if (v___x_780_ == 0)
{
uint8_t v___x_781_; 
lean_dec(v_val_779_);
v___x_781_ = 0;
return v___x_781_;
}
else
{
lean_object* v___x_782_; 
v___x_782_ = l_LeanBridgeNativea1d30b9a0f384ed5_LbErased_RecursiveCheckedRecords_Packet_via__5b2d9cecaeed7529(v_val_779_);
if (lean_obj_tag(v___x_782_) == 0)
{
uint8_t v___x_783_; 
v___x_783_ = 0;
return v___x_783_;
}
else
{
uint8_t v___x_784_; 
lean_dec_ref_known(v___x_782_, 1);
v___x_784_ = 1;
return v___x_784_;
}
}
}
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNativea1d30b9a0f384ed5_export5__refinement__0___boxed(lean_object* v_carrier_785_){
_start:
{
uint8_t v_res_786_; lean_object* v_r_787_; 
v_res_786_ = lean_bridge_c3338006aea7f276ff222c0c_refinement_0(v_carrier_785_);
v_r_787_ = lean_box(v_res_786_);
return v_r_787_;
}
}
LEAN_EXPORT uint8_t lean_bridge_c3338006aea7f276ff222c0c_graph_refinement_0_262d1fa6be548d6d1dd0(lean_object* v_carrier_788_){
  fputs("LB_SUBTYPE_ENTRY_V1 enter validator RecursiveCheckedRecords.second:graph_refinement_0_262d1fa6be548d6d1dd0\n", stderr);

_start:
{
lean_object* v___x_789_; 
v___x_789_ = l_LeanBridgeNativea1d30b9a0f384ed5_carrierValue___redArg(v_carrier_788_);
lean_dec_ref(v_carrier_788_);
if (lean_obj_tag(v___x_789_) == 0)
{
uint8_t v___x_790_; 
v___x_790_ = 0;
return v___x_790_;
}
else
{
lean_object* v_val_791_; lean_object* v___x_792_; 
v_val_791_ = lean_ctor_get(v___x_789_, 0);
lean_inc(v_val_791_);
lean_dec_ref_known(v___x_789_, 1);
v___x_792_ = lb_recursive_checked_record_probe_constructor_plusTwo(v_val_791_);
if (lean_obj_tag(v___x_792_) == 0)
{
uint8_t v___x_793_; 
v___x_793_ = 0;
return v___x_793_;
}
else
{
uint8_t v___x_794_; 
lean_dec_ref_known(v___x_792_, 1);
v___x_794_ = 1;
return v___x_794_;
}
}
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNativea1d30b9a0f384ed5_export5__graph__refinement__0__262d1fa6be548d6d1dd0___boxed(lean_object* v_carrier_795_){
_start:
{
uint8_t v_res_796_; lean_object* v_r_797_; 
v_res_796_ = lean_bridge_c3338006aea7f276ff222c0c_graph_refinement_0_262d1fa6be548d6d1dd0(v_carrier_795_);
v_r_797_ = lean_box(v_res_796_);
return v_r_797_;
}
}
LEAN_EXPORT uint8_t lean_bridge_c3338006aea7f276ff222c0c_graph_refinement_0_88f1c5c2e3a6ba3c4460(lean_object* v_carrier_798_){
  fputs("LB_SUBTYPE_ENTRY_V1 enter validator RecursiveCheckedRecords.second:graph_refinement_0_88f1c5c2e3a6ba3c4460\n", stderr);

_start:
{
lean_object* v___x_799_; 
v___x_799_ = l_LeanBridgeNativea1d30b9a0f384ed5_carrierValue___redArg(v_carrier_798_);
lean_dec_ref(v_carrier_798_);
if (lean_obj_tag(v___x_799_) == 0)
{
uint8_t v___x_800_; 
v___x_800_ = 0;
return v___x_800_;
}
else
{
lean_object* v_val_801_; lean_object* v___x_802_; 
v_val_801_ = lean_ctor_get(v___x_799_, 0);
lean_inc(v_val_801_);
lean_dec_ref_known(v___x_799_, 1);
v___x_802_ = l_LeanBridgeNativea1d30b9a0f384ed5_LbErased_RecursiveCheckedRecords_Packet_via__5b2d9cecaeed7529(v_val_801_);
if (lean_obj_tag(v___x_802_) == 0)
{
uint8_t v___x_803_; 
v___x_803_ = 0;
return v___x_803_;
}
else
{
uint8_t v___x_804_; 
lean_dec_ref_known(v___x_802_, 1);
v___x_804_ = 1;
return v___x_804_;
}
}
}
}
LEAN_EXPORT lean_object* l_LeanBridgeNativea1d30b9a0f384ed5_export5__graph__refinement__0__88f1c5c2e3a6ba3c4460___boxed(lean_object* v_carrier_805_){
_start:
{
uint8_t v_res_806_; lean_object* v_r_807_; 
v_res_806_ = lean_bridge_c3338006aea7f276ff222c0c_graph_refinement_0_88f1c5c2e3a6ba3c4460(v_carrier_805_);
v_r_807_ = lean_box(v_res_806_);
return v_r_807_;
}
}
LEAN_EXPORT lean_object* lean_bridge_c3338006aea7f276ff222c0c_lean(lean_object* v_a0_808_){
  fputs("LB_SUBTYPE_ENTRY_V1 enter adapter RecursiveCheckedRecords.second\n", stderr);

_start:
{
lean_object* v___x_809_; 
v___x_809_ = l_LeanBridgeNativea1d30b9a0f384ed5_carrierValue___redArg(v_a0_808_);
lean_dec_ref(v_a0_808_);
if (lean_obj_tag(v___x_809_) == 0)
{
lean_object* v___x_810_; 
v___x_810_ = lean_obj_once(&l_LeanBridgeNativea1d30b9a0f384ed5_field03cdb6e7435d0b988c5ab___closed__0, &l_LeanBridgeNativea1d30b9a0f384ed5_field03cdb6e7435d0b988c5ab___closed__0_once, _init_l_LeanBridgeNativea1d30b9a0f384ed5_field03cdb6e7435d0b988c5ab___closed__0);
return v___x_810_;
}
else
{
lean_object* v_val_811_; uint8_t v___x_812_; 
v_val_811_ = lean_ctor_get(v___x_809_, 0);
lean_inc(v_val_811_);
lean_dec_ref_known(v___x_809_, 1);
v___x_812_ = l_LeanBridgeNativea1d30b9a0f384ed5_LbErased_RecursiveCheckedRecords_Packet_validFin(v_val_811_);
if (v___x_812_ == 0)
{
lean_object* v___x_813_; 
lean_dec(v_val_811_);
v___x_813_ = lean_obj_once(&l_LeanBridgeNativea1d30b9a0f384ed5_field03cdb6e7435d0b988c5ab___closed__0, &l_LeanBridgeNativea1d30b9a0f384ed5_field03cdb6e7435d0b988c5ab___closed__0_once, _init_l_LeanBridgeNativea1d30b9a0f384ed5_field03cdb6e7435d0b988c5ab___closed__0);
return v___x_813_;
}
else
{
lean_object* v___x_814_; 
v___x_814_ = l_LeanBridgeNativea1d30b9a0f384ed5_LbErased_RecursiveCheckedRecords_Packet_via__5b2d9cecaeed7529(v_val_811_);
if (lean_obj_tag(v___x_814_) == 0)
{
lean_object* v___x_815_; 
v___x_815_ = lean_obj_once(&l_LeanBridgeNativea1d30b9a0f384ed5_field03cdb6e7435d0b988c5ab___closed__0, &l_LeanBridgeNativea1d30b9a0f384ed5_field03cdb6e7435d0b988c5ab___closed__0_once, _init_l_LeanBridgeNativea1d30b9a0f384ed5_field03cdb6e7435d0b988c5ab___closed__0);
return v___x_815_;
}
else
{
lean_object* v_val_816_; lean_object* v___x_818_; uint8_t v_isShared_819_; uint8_t v_isSharedCheck_825_; 
v_val_816_ = lean_ctor_get(v___x_814_, 0);
v_isSharedCheck_825_ = !lean_is_exclusive(v___x_814_);
if (v_isSharedCheck_825_ == 0)
{
v___x_818_ = v___x_814_;
v_isShared_819_ = v_isSharedCheck_825_;
goto v_resetjp_817_;
}
else
{
lean_inc(v_val_816_);
lean_dec(v___x_814_);
v___x_818_ = lean_box(0);
v_isShared_819_ = v_isSharedCheck_825_;
goto v_resetjp_817_;
}
v_resetjp_817_:
{
lean_object* v___x_820_; lean_object* v___x_822_; 
v___x_820_ = lb_recursive_checked_record_probe_source_second(v_val_816_);
if (v_isShared_819_ == 0)
{
lean_ctor_set(v___x_818_, 0, v___x_820_);
v___x_822_ = v___x_818_;
goto v_reusejp_821_;
}
else
{
lean_object* v_reuseFailAlloc_824_; 
v_reuseFailAlloc_824_ = lean_alloc_ctor(1, 1, 0);
lean_ctor_set(v_reuseFailAlloc_824_, 0, v___x_820_);
v___x_822_ = v_reuseFailAlloc_824_;
goto v_reusejp_821_;
}
v_reusejp_821_:
{
lean_object* v___x_823_; 
v___x_823_ = l_LeanBridgeNativea1d30b9a0f384ed5_carrierResult___redArg(v___x_822_);
return v___x_823_;
}
}
}
}
}
}
}
lean_object* initialize_Init(uint8_t builtin);
lean_object* initialize_Init(uint8_t builtin);
lean_object* initialize_RecursiveCheckedRecords(uint8_t builtin);
static bool _G_initialized = false;
LEAN_EXPORT lean_object* initialize_LeanBridgeNativea1d30b9a0f384ed5(uint8_t builtin) {
lean_object * res;
if (_G_initialized) return lean_io_result_mk_ok(lean_box(0));
_G_initialized = true;
res = initialize_Init(builtin);
if (lean_io_result_is_error(res)) return res;
lean_dec_ref(res);
res = initialize_Init(builtin);
if (lean_io_result_is_error(res)) return res;
lean_dec_ref(res);
res = initialize_RecursiveCheckedRecords(builtin);
if (lean_io_result_is_error(res)) return res;
lean_dec_ref(res);
return lean_io_result_mk_ok(lean_box(0));
}
#ifdef __cplusplus
}
#endif

#include "component.h"
