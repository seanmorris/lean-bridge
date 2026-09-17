/* Own public Wasmtime values; encode observations without expected Lean results. */
#include "c-family.h"
#include <link.h>

static int wit_loaded(struct dl_phdr_info *info, size_t size, void *raw) {
  (void)size;
  bool *comma = raw;
  if (!info->dlpi_name[0]) return 0;
  if (*comma) fputc(',', stdout);
  wire_quote(stdout, info->dlpi_name, strlen(info->dlpi_name)); *comma = true;
  return 0;
}
static inline void wit_libraries(void) {
  bool comma = false; fputs(",\"loadedLibraries\":[", stdout);
  dl_iterate_phdr(wit_loaded, &comma); fputc(']', stdout);
}

static inline bool wit_name(const wasm_name_t *name, const char *text) {
  return name->size == strlen(text) && (!name->size || memcmp(name->data, text, name->size) == 0);
}
static inline void wit_ok(wasmtime_error_t *error) {
  if (!error) return;
  wasm_name_t message; wasmtime_error_message(error, &message);
  fprintf(stderr, "%.*s\n", (int)message.size, message.data);
  wasm_name_delete(&message); wasmtime_error_delete(error); abort();
}
static inline void wit_error(wasmtime_error_t *error, const wasmtime_component_val_t *out) {
  assert(error && out->kind == WASMTIME_COMPONENT_U64 && out->of.u64 == UINT64_MAX);
}
static inline void wit_message(wasmtime_error_t *error) {
  wasm_name_t message; wasmtime_error_message(error, &message);
  wire_quote(stdout, message.data, message.size); wasm_name_delete(&message);
}
static inline wasmtime_component_val_t wit_text(const char *text, size_t size) {
  wasmtime_component_val_t value = {.kind = WASMTIME_COMPONENT_STRING};
  wasm_name_new(&value.of.string, size, text); return value;
}
static inline wasmtime_component_val_t wit_unit(const char *name) {
  wasmtime_component_val_t value = {.kind = WASMTIME_COMPONENT_ENUM};
  wasm_name_new(&value.of.enumeration, strlen(name), name); return value;
}
/* These builders transfer ownership from the temporary initializer arrays. */
static inline wasmtime_component_val_t wit_list(size_t size, wasmtime_component_val_t *items) {
  wasmtime_component_val_t value = {.kind = WASMTIME_COMPONENT_LIST};
  wasmtime_component_vallist_new_uninit(&value.of.list, size);
  if (size) memcpy(value.of.list.data, items, size * sizeof(*items));
  return value;
}
static inline wasmtime_component_val_t wit_record(size_t size, const char **names, wasmtime_component_val_t *items) {
  wasmtime_component_val_t value = {.kind = WASMTIME_COMPONENT_RECORD};
  wasmtime_component_valrecord_new_uninit(&value.of.record, size);
  for (size_t i = 0; i < size; ++i) {
    wasm_name_new(&value.of.record.data[i].name, strlen(names[i]), names[i]);
    value.of.record.data[i].val = items[i];
  }
  return value;
}
static inline wasmtime_component_val_t wit_integer(bool negative, wasmtime_component_val_t limbs) {
  return wit_record(2, (const char *[]){"negative", "limbs"},
    (wasmtime_component_val_t[]){{.kind = WASMTIME_COMPONENT_BOOL, .of.boolean = negative}, limbs});
}
static inline wasmtime_component_val_t wit_large_list(size_t size) {
  wasmtime_component_val_t value = {.kind = WASMTIME_COMPONENT_LIST};
  wasmtime_component_vallist_new_uninit(&value.of.list, size);
  for (size_t i = 0; i < size; ++i) value.of.list.data[i] = (wasmtime_component_val_t){.kind = WASMTIME_COMPONENT_U32, .of.u32 = 7};
  return value;
}
static inline wasmtime_component_val_t wit_large_text(size_t size) {
  char *text = malloc(size); assert(text); memset(text, 'a', size);
  wasmtime_component_val_t value = wit_text(text, size); free(text); return value;
}
static inline void wit_delete(wasmtime_component_val_t *values, size_t count) {
  for (size_t i = 0; i < count; ++i) wasmtime_component_val_delete(&values[i]);
}
static inline void wit_big(FILE *stream, const wasmtime_component_val_t *value, bool negative) {
  assert(value->kind == WASMTIME_COMPONENT_LIST);
  size_t size = value->of.list.size;
  uint32_t *limbs = calloc(size + 1, sizeof(*limbs)); assert(limbs);
  for (size_t i = 0; i < size; ++i) {
    assert(value->of.list.data[i].kind == WASMTIME_COMPONENT_U32);
    limbs[i] = value->of.list.data[i].of.u32;
  }
  assert(!size || limbs[size - 1]); assert(size || !negative);
  wire_big(stream, limbs, size, negative); free(limbs);
}
static inline void wit_disjoint(const wasmtime_component_val_t *left, const wasmtime_component_val_t *right) {
  assert(left != right && left->kind == right->kind);
  switch (left->kind) {
  case WASMTIME_COMPONENT_STRING:
    if (left->of.string.size && right->of.string.size) assert(left->of.string.data != right->of.string.data);
    break;
  case WASMTIME_COMPONENT_LIST:
    if (left->of.list.size && right->of.list.size) assert(left->of.list.data != right->of.list.data);
    for (size_t i = 0; i < left->of.list.size && i < right->of.list.size; ++i)
      wit_disjoint(&left->of.list.data[i], &right->of.list.data[i]);
    break;
  case WASMTIME_COMPONENT_RECORD:
    assert(left->of.record.size == right->of.record.size && left->of.record.data != right->of.record.data);
    for (size_t i = 0; i < left->of.record.size; ++i) {
      assert(left->of.record.data[i].name.data != right->of.record.data[i].name.data);
      wit_disjoint(&left->of.record.data[i].val, &right->of.record.data[i].val);
    }
    break;
  default: break;
  }
}
static inline void wit_mutate(wasmtime_component_val_t *value) {
  switch (value->kind) {
  case WASMTIME_COMPONENT_STRING: if (value->of.string.size) value->of.string.data[0] = '?'; break;
  case WASMTIME_COMPONENT_LIST:
    for (size_t i = 0; i < value->of.list.size; ++i) wit_mutate(&value->of.list.data[i]);
    break;
  case WASMTIME_COMPONENT_RECORD:
    for (size_t i = 0; i < value->of.record.size; ++i) wit_mutate(&value->of.record.data[i].val);
    break;
  case WASMTIME_COMPONENT_U32: value->of.u32 ^= 1; break;
  case WASMTIME_COMPONENT_BOOL: value->of.boolean = !value->of.boolean; break;
  default: break;
  }
}
