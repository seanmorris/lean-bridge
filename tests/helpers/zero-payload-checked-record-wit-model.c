/* Stand-in host for the immutable zero-payload WIT caller. It implements the
 * generated session API over the Wasmtime C value types only, without any
 * compiled component, so the caller's exact totals and fault sensitivity can
 * be measured without producing a package. Never evidence of installed
 * acceptance. */
#include "zeropayloadcheckedrecords_wasmtime.h"
#include <stdlib.h>
#include <string.h>

#ifndef ZERO_PAYLOAD_PARAMETER_PREFIX
#define ZERO_PAYLOAD_PARAMETER_PREFIX "arg"
#endif
#ifndef ZERO_PAYLOAD_FAULT
#define ZERO_PAYLOAD_FAULT ""
#endif

struct zeropayloadcheckedrecords_wasmtime { int open; };

static bool fault(const char *name) { return strcmp(ZERO_PAYLOAD_FAULT, name) == 0; }
static bool named(const wasm_name_t *name, const char *text) {
  return name->size == strlen(text) && memcmp(name->data, text, name->size) == 0;
}
static bool is_enum(const wasmtime_component_val_t *v, const char *name) {
  return v->kind == WASMTIME_COMPONENT_ENUM && named(&v->of.enumeration, name);
}
static bool is_token(const wasmtime_component_val_t *v) {
  return v->kind == WASMTIME_COMPONENT_RECORD && v->of.record.size == 1
    && named(&v->of.record.data[0].name, "tag") && is_enum(&v->of.record.data[0].val, "unit");
}
static bool is_mark(const wasmtime_component_val_t *v, bool *marked_out) {
  if (v->kind != WASMTIME_COMPONENT_VARIANT) return false;
  if (named(&v->of.variant.discriminant, "blank") && !v->of.variant.val) { *marked_out = false; return true; }
  if (named(&v->of.variant.discriminant, "marked") && v->of.variant.val) {
    const wasmtime_component_val_t *fields = v->of.variant.val;
    if (fields->kind == WASMTIME_COMPONENT_RECORD && fields->of.record.size == 1
      && named(&fields->of.record.data[0].name, "witness") && is_enum(&fields->of.record.data[0].val, "empty"))
    { *marked_out = true; return true; }
  }
  return false;
}
static bool is_nat(const wasmtime_component_val_t *v, uint32_t *out) {
  if (v->kind != WASMTIME_COMPONENT_LIST || v->of.list.size > 1) return false;
  for (size_t i = 0; i < v->of.list.size; ++i) {
    if (v->of.list.data[i].kind != WASMTIME_COMPONENT_U32) return false;
    if (v->of.list.data[i].of.u32 == 0) return false; /* canonical: no zero limb */
  }
  *out = v->of.list.size ? v->of.list.data[0].of.u32 : 0; return true;
}
static wasmtime_component_val_t enum_case(const char *name) {
  wasmtime_component_val_t v = {.kind = WASMTIME_COMPONENT_ENUM};
  wasm_name_new(&v.of.enumeration, strlen(name), name); return v;
}
static wasmtime_component_val_t small(uint32_t n) {
  wasmtime_component_val_t v = {.kind = WASMTIME_COMPONENT_LIST};
  wasmtime_component_vallist_new_uninit(&v.of.list, n ? 1 : 0);
  if (n) v.of.list.data[0] = (wasmtime_component_val_t){.kind = WASMTIME_COMPONENT_U32, .of.u32 = n};
  return v;
}
static wasmtime_component_val_t one_field(const char *label, wasmtime_component_val_t payload) {
  wasmtime_component_val_t out = {.kind = WASMTIME_COMPONENT_RECORD};
  wasmtime_component_valrecord_new_uninit(&out.of.record, 1);
  wasm_name_new(&out.of.record.data[0].name, strlen(label), label);
  out.of.record.data[0].val = payload; return out;
}
static wasmtime_component_val_t variant(const char *discriminant, const wasmtime_component_val_t *payload) {
  wasmtime_component_val_t v = {.kind = WASMTIME_COMPONENT_VARIANT};
  wasm_name_new(&v.of.variant.discriminant, strlen(discriminant), discriminant);
  v.of.variant.val = NULL;
  if (payload) { wasmtime_component_val_t taken = *payload; v.of.variant.val = wasmtime_component_val_new(&taken); }
  return v;
}

wasmtime_error_t *zeropayloadcheckedrecords_wasmtime_open(zeropayloadcheckedrecords_wasmtime **out) {
  *out = calloc(1, sizeof(**out)); (*out)->open = 1; return NULL;
}
wasmtime_error_t *zeropayloadcheckedrecords_wasmtime_link(wasmtime_component_linker_t *linker) {
  (void)linker; return wasmtime_error_new("stand-in host has no linker");
}
void zeropayloadcheckedrecords_wasmtime_close(zeropayloadcheckedrecords_wasmtime *session) { free(session); }

wasmtime_error_t *zeropayloadcheckedrecords_wasmtime_call(zeropayloadcheckedrecords_wasmtime *session, const char *name,
    const wasmtime_component_val_t *args, size_t count, wasmtime_component_val_t *out) {
  static const char invalid[] = "Unknown export, invalid WIT input or 16 MiB conversion limit";
  if (!session || !session->open || !name || !out) return wasmtime_error_new("Invalid WIT call arguments or unavailable session");
  uint32_t n = 0; bool marked = false;
#ifndef ZERO_PAYLOAD_RESULT_ONLY
  if (strcmp(name, "witness-count") == 0 && count == 1 && is_enum(&args[0], "empty")) { *out = small(1); return NULL; }
  if (strcmp(name, "absent-count") == 0 && count == 1 && is_enum(&args[0], "empty")) {
    if (fault("accept-invalid")) { *out = small(0); return NULL; }
    return wasmtime_error_new(fault("wrong-message") ? "wrong0 was rejected by ZeroPayloadCheckedRecords.mkAbsent" : ZERO_PAYLOAD_PARAMETER_PREFIX "0 was rejected by ZeroPayloadCheckedRecords.mkAbsent");
  }
  if (strcmp(name, "token-tag") == 0 && count == 1 && is_token(&args[0])) { *out = enum_case("unit"); return NULL; }
  if (strcmp(name, "marker-count") == 0 && count == 1 && is_enum(&args[0], "empty")) { *out = small(0); return NULL; }
  if (strcmp(name, "mark-count") == 0 && count == 1 && is_mark(&args[0], &marked)) { *out = small(marked ? 1 : 0); return NULL; }
#else
  (void)marked; (void)is_token; (void)is_mark;
  if (fault("inputs-exported") && strcmp(name, "witness-count") == 0 && count == 1 && is_enum(&args[0], "empty")) { *out = small(1); return NULL; }
#endif
  if (strcmp(name, "produce-witness") == 0 && count == 0) { *out = enum_case("empty"); return NULL; }
  if (strcmp(name, "produce-token") == 0 && count == 0) { *out = one_field("tag", enum_case("unit")); return NULL; }
  if (strcmp(name, "witnesses") == 0 && count == 1 && is_nat(&args[0], &n)) {
    if (fault("array-length") && n) --n;
    wasmtime_component_val_t v = {.kind = WASMTIME_COMPONENT_LIST};
    wasmtime_component_vallist_new_uninit(&v.of.list, n);
    for (size_t i = 0; i < n; ++i) v.of.list.data[i] = enum_case("empty");
    *out = v; return NULL;
  }
  if (strcmp(name, "maybe-witness") == 0 && count == 1 && args[0].kind == WASMTIME_COMPONENT_BOOL) {
    if (!args[0].of.boolean) { *out = (wasmtime_component_val_t){.kind = WASMTIME_COMPONENT_OPTION, .of.option = NULL}; return NULL; }
    if (fault("option-collapsed")) { *out = enum_case("empty"); return NULL; }
    wasmtime_component_val_t payload = enum_case("empty"), v = {.kind = WASMTIME_COMPONENT_OPTION};
    v.of.option = wasmtime_component_val_new(&payload); *out = v; return NULL;
  }
  if (strcmp(name, "produce-marker") == 0 && count == 0) { *out = enum_case("empty"); return NULL; }
  if (strcmp(name, "produce-mark") == 0 && count == 1 && args[0].kind == WASMTIME_COMPONENT_BOOL) {
    if (!args[0].of.boolean || fault("wrong-produced")) { *out = variant("blank", NULL); return NULL; }
    wasmtime_component_val_t fields = one_field("witness", enum_case("empty"));
    *out = variant("marked", &fields); return NULL;
  }
  return wasmtime_error_new(invalid);
}
