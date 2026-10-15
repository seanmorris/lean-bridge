/* Independent nineteen-base input semantics for source-only caller controls. */
#include <math.h>
#include <stdio.h>
#ifdef NOMINAL_REVIEWED
static const char *argument_paths[] = {"value0", "value1"};
#else
static const char *argument_paths[] = {"arg0", "arg1"};
#endif
static const char *field_labels[] = {"unitValue", "boolValue", "uint8Value", "uint16Value", "uint32Value", "uint64Value",
  "int8Value", "int16Value", "int32Value", "int64Value", "natValue", "intValue", "float32Value", "float64Value",
  "textValue", "bytesValue", "charValue", "usizeValue", "isizeValue", "digit"};
static const char *constructor_names[] = {"unit", "bool", "uint8", "uint16", "uint32", "uint64", "int8", "int16", "int32", "int64",
  "nat", "int", "float32", "float64", "text", "bytes", "char", "usize", "isize"};

static bool group_shape(const value *v) {
  if (v->kind != WASMTIME_COMPONENT_LIST) return false;
  for (size_t i = 0; i < v->of.list.size; ++i) {
    const value *item = &v->of.list.data[i];
    if (item->kind != WASMTIME_COMPONENT_OPTION || (item->of.option && !packet_shape(item->of.option))) return false;
  }
  return true;
}
static bool pair_shape(const value *v) {
  return v->kind == WASMTIME_COMPONENT_RECORD && v->of.record.size == 2
    && named(&v->of.record.data[0].name, "left") && named(&v->of.record.data[1].name, "right")
    && group_shape(&v->of.record.data[0].val) && group_shape(&v->of.record.data[1].val);
}
static bool event_shape(const value *v) {
  if (v->kind != WASMTIME_COMPONENT_VARIANT) return false;
  if (named(&v->of.variant.discriminant, "empty")) return v->of.variant.val == NULL;
  if (!v->of.variant.val || v->of.variant.val->kind != WASMTIME_COMPONENT_RECORD || v->of.variant.val->of.record.size != 1) return false;
  const wasmtime_component_valrecord_entry_t *entry = &v->of.variant.val->of.record.data[0];
  if (named(&v->of.variant.discriminant, "box")) return named(&entry->name, "value") && packet_shape(&entry->val);
  if (!named(&v->of.variant.discriminant, "choices") || !named(&entry->name, "values") || entry->val.kind != WASMTIME_COMPONENT_LIST) return false;
  for (size_t i = 0; i < entry->val.of.list.size; ++i) {
    const value *item = &entry->val.of.list.data[i];
    if (item->kind != WASMTIME_COMPONENT_OPTION) return false;
    if (item->of.option && (item->of.option->kind != WASMTIME_COMPONENT_RESULT || !item->of.option->of.result.val
      || !packet_shape(item->of.option->of.result.val))) return false;
  }
  return true;
}

/* Little-endian limb arithmetic on canonical magnitudes. */
static value add_two(const value *limbs) {
  size_t count = limbs->of.list.size;
  uint32_t *words = calloc(count + 1, sizeof(*words)); if (!words) abort();
  uint64_t carry = 2;
  for (size_t i = 0; i < count; ++i) {
    uint64_t total = (uint64_t)limbs->of.list.data[i].of.u32 + carry;
    words[i] = (uint32_t)total; carry = total >> 32;
  }
  if (carry) words[count++] = (uint32_t)carry;
  value out = nat(words, count); free(words); return out;
}
static value subtract_two(const value *limbs) {
  size_t count = limbs->of.list.size;
  uint32_t *words = calloc(count ? count : 1, sizeof(*words)); if (!words) abort();
  uint64_t borrow = 2;
  for (size_t i = 0; i < count; ++i) {
    uint64_t current = limbs->of.list.data[i].of.u32;
    if (current >= borrow) { words[i] = (uint32_t)(current - borrow); borrow = 0; }
    else { words[i] = (uint32_t)(current + (UINT64_C(1) << 32) - borrow); borrow = 1; }
  }
  if (borrow) abort();
  while (count && !words[count - 1]) --count;
  value out = nat(words, count); free(words); return out;
}
static bool small_magnitude(const value *limbs, uint32_t *out) {
  if (limbs->of.list.size > 1) return false;
  *out = limbs->of.list.size ? limbs->of.list.data[0].of.u32 : 0; return true;
}
static size_t text_length(const wasm_name_t *s) {
  size_t length = 0;
  for (size_t i = 0; i < s->size; ++i) if (((unsigned char)s->data[i] & 0xc0) != 0x80) ++length;
  return length;
}
/* Returns whether the A selection accepts the field, and normalizes it for the B selection. */
static bool field_accepted(value *v, unsigned index, bool second) {
  uint32_t magnitude;
  switch (index) {
    case UNIT_FIELD: return true;
    case BOOL_FIELD: if (second) { if (v->of.boolean) return false; v->of.boolean = true; return true; } return v->of.boolean;
    case UINT8_FIELD: if (second) { v->of.u8 = (uint8_t)(v->of.u8 + 2); return v->of.u8 % 2 == 0; } return v->of.u8 < 100 && v->of.u8 % 2 == 0;
    case UINT16_FIELD: if (second) { v->of.u16 = (uint16_t)(v->of.u16 + 2); return v->of.u16 % 2 == 0; } return v->of.u16 < 100 && v->of.u16 % 2 == 0;
    case UINT32_FIELD: if (second) { v->of.u32 += 2; return v->of.u32 % 2 == 0; } return v->of.u32 < 100 && v->of.u32 % 2 == 0;
    case UINT64_FIELD: case USIZE_FIELD: if (second) { v->of.u64 += 2; return v->of.u64 % 2 == 0; } return v->of.u64 < 100 && v->of.u64 % 2 == 0;
    case INT8_FIELD: if (second) { v->of.s8 = (int8_t)((uint8_t)v->of.s8 + 2); return v->of.s8 % 2 == 0; } return v->of.s8 < 100 && v->of.s8 % 2 == 0;
    case INT16_FIELD: if (second) { v->of.s16 = (int16_t)((uint16_t)v->of.s16 + 2); return v->of.s16 % 2 == 0; } return v->of.s16 < 100 && v->of.s16 % 2 == 0;
    case INT32_FIELD: if (second) { v->of.s32 = (int32_t)((uint32_t)v->of.s32 + 2); return v->of.s32 % 2 == 0; } return v->of.s32 < 100 && v->of.s32 % 2 == 0;
    case INT64_FIELD: case ISIZE_FIELD: if (second) { v->of.s64 = (int64_t)((uint64_t)v->of.s64 + 2); return v->of.s64 % 2 == 0; } return v->of.s64 < 100 && v->of.s64 % 2 == 0;
    case NAT_FIELD: case DIGIT_FIELD:
      if (second) { value sum = add_two(v); clear(v); *v = sum; }
      else if (!small_magnitude(v, &magnitude) || magnitude >= 100) return false;
      return !v->of.list.size || v->of.list.data[0].of.u32 % 2 == 0;
    case INT_FIELD: {
      value *limbs = &v->of.record.data[1].val; bool negative = v->of.record.data[0].val.of.boolean;
      if (second) {
        if (!negative) { value sum = add_two(limbs); clear(limbs); *limbs = sum; }
        else if (small_magnitude(limbs, &magnitude) && magnitude <= 2) {
          clear(limbs); *limbs = small(2 - magnitude); v->of.record.data[0].val.of.boolean = false;
        } else { value difference = subtract_two(limbs); clear(limbs); *limbs = difference; }
      } else if (!negative && (!small_magnitude(limbs, &magnitude) || magnitude >= 100)) return false;
      return !limbs->of.list.size || limbs->of.list.data[0].of.u32 % 2 == 0;
    }
    case FLOAT32_FIELD: if (second) { if (!fault("float-sign")) v->of.f32 = -v->of.f32; return isfinite(v->of.f32); } return v->of.f32 < 10 && isfinite(v->of.f32);
    case FLOAT64_FIELD: if (second) { if (!fault("float-sign")) v->of.f64 = -v->of.f64; return isfinite(v->of.f64); } return v->of.f64 < 10 && isfinite(v->of.f64);
    case TEXT_FIELD: {
      if (!second) return text_length(&v->of.string) < 8 && v->of.string.size > 0;
      wasm_name_t extended; wasm_byte_vec_new_uninitialized(&extended, v->of.string.size + 1);
      if (v->of.string.size) memcpy(extended.data, v->of.string.data, v->of.string.size);
      extended.data[v->of.string.size] = '!'; wasm_name_delete(&v->of.string); v->of.string = extended;
      return true;
    }
    case BYTES_FIELD: {
      if (!second) return v->of.list.size < 8 && v->of.list.size > 0;
      value extended = list(v->of.list.size + 1);
      for (size_t i = 0; i < v->of.list.size; ++i) extended.of.list.data[i] = u8(v->of.list.data[i].of.u8);
      extended.of.list.data[v->of.list.size] = u8(255); clear(v); *v = extended;
      return true;
    }
    case CHAR_FIELD: if (second) { if (v->of.character == 'a') v->of.character = 'b'; return v->of.character != 0; } return v->of.character < 128 && v->of.character != 0;
    default: abort();
  }
}
static wasmtime_error_t *rejection(const char *path, const char *label, const char *constructor) {
  char message[512];
  snprintf(message, sizeof(message), "%s.%s was rejected by NominalPrimitiveSubtypes.%s%s",
    fault("wrong-native-path") ? "wrong" : path, label, constructor, fault("diagnostic-suffix") ? " extra" : "");
  return wasmtime_error_new(message);
}
static wasmtime_error_t *invalid_fin(const value *limbs, const char *path) {
  uint32_t magnitude;
  if (fault("missing-fin") || (small_magnitude(limbs, &magnitude) && magnitude < 3)) return NULL;
  char message[512]; snprintf(message, sizeof(message), "%s.digit is not below its Fin 3 bound", path);
  return wasmtime_error_new(message);
}
/* Every Fin bound in a carrier tree, in declaration order. */
static wasmtime_error_t *all_fin(const value *v, const char *path) {
  char nested[512]; wasmtime_error_t *error;
  if (v->kind == WASMTIME_COMPONENT_RECORD) {
    if (v->of.record.size == 20) return invalid_fin(&v->of.record.data[DIGIT_FIELD].val, path);
    for (size_t i = 0; i < v->of.record.size; ++i) {
      const wasmtime_component_valrecord_entry_t *entry = &v->of.record.data[i];
      snprintf(nested, sizeof(nested), "%s.%.*s", path, (int)entry->name.size, entry->name.data);
      error = all_fin(&entry->val, nested); if (error) return error;
    }
  } else if (v->kind == WASMTIME_COMPONENT_LIST) {
    for (size_t i = 0; i < v->of.list.size; ++i) {
      snprintf(nested, sizeof(nested), "%s[%zu]", path, i);
      error = all_fin(&v->of.list.data[i], nested); if (error) return error;
    }
  } else if (v->kind == WASMTIME_COMPONENT_OPTION && v->of.option) {
    snprintf(nested, sizeof(nested), "%s?", path); return all_fin(v->of.option, nested);
  } else if (v->kind == WASMTIME_COMPONENT_RESULT && v->of.result.val) {
    snprintf(nested, sizeof(nested), "%s.%s", path, v->of.result.is_ok ? "ok" : "error"); return all_fin(v->of.result.val, nested);
  } else if (v->kind == WASMTIME_COMPONENT_VARIANT && v->of.variant.val) {
    snprintf(nested, sizeof(nested), "%s.%.*s", path, (int)v->of.variant.discriminant.size, v->of.variant.discriminant.data);
    return all_fin(v->of.variant.val, nested);
  }
  return NULL;
}
/* Apply one selection (A or B, or the unit refusal) to every field of a packet copy. */
static wasmtime_error_t *select_packet(value *v, bool second, bool refuse_unit, const char *path) {
  if (fault("conflated-constructor")) second = false;
  if (fault("missing-normalization") && second) return NULL;
  char constructor[32];
  for (unsigned i = 0; i < DIGIT_FIELD; ++i) {
    if (i == UNIT_FIELD && refuse_unit) return rejection(path, field_labels[i], "unitReject");
    if (!field_accepted(field(v, i), i, second)) {
      snprintf(constructor, sizeof(constructor), "%s%s", constructor_names[i], second ? "B" : "A");
      return rejection(path, field_labels[i], constructor);
    }
  }
  return NULL;
}
static wasmtime_error_t *select_group(value *v, bool second, const char *path) {
  char nested[512];
  for (size_t i = 0; i < v->of.list.size; ++i) if (v->of.list.data[i].of.option) {
    snprintf(nested, sizeof(nested), "%s[%zu]?", path, i);
    wasmtime_error_t *error = select_packet(v->of.list.data[i].of.option, second, false, nested);
    if (error) return error;
  }
  return NULL;
}
static wasmtime_error_t *select_event(value *v, bool second, const char *path) {
  char nested[512];
  if (named(&v->of.variant.discriminant, "empty")) return NULL;
  value *payload = &v->of.variant.val->of.record.data[0].val;
  if (named(&v->of.variant.discriminant, "box")) {
    snprintf(nested, sizeof(nested), "%s.box.value", path); return select_packet(payload, second, false, nested);
  }
  for (size_t i = 0; i < payload->of.list.size; ++i) {
    value *item = payload->of.list.data[i].of.option; if (!item) continue;
    snprintf(nested, sizeof(nested), "%s.choices.values[%zu]?.%s", path, i, item->of.result.is_ok ? "ok" : "error");
    bool selected = item->of.result.is_ok ? second : !second;
    wasmtime_error_t *error = select_packet(item->of.result.val, fault("wrong-active-choice") ? !selected : selected, false, nested);
    if (error) return error;
  }
  return NULL;
}
static bool known_input(const char *label) {
  const char *names[] = {"echo-a", "echo-b", "refuse-unit", "combine", "echo-pair", "echo-event-a", "echo-event-b", "aliases"};
  for (size_t i = 0; i < sizeof(names) / sizeof(*names); ++i) if (!strcmp(label, names[i])) return true;
  return false;
}
static wasmtime_error_t *model_input(const char *label, const value *args, size_t count, value *out) {
  const bool combined = !strcmp(label, "combine"), aliases = !strcmp(label, "aliases"), paired = !strcmp(label, "echo-pair");
  const bool event_api = !strncmp(label, "echo-event-", 11), second_event = !strcmp(label, "echo-event-b");
  const bool echo_b = !strcmp(label, "echo-b"), refuse_unit = !strcmp(label, "refuse-unit");
  bool valid = count == (combined || aliases ? 2u : 1u);
  for (size_t i = 0; valid && i < count; ++i)
    valid = event_api ? event_shape(&args[i]) : paired ? pair_shape(&args[i]) : aliases ? group_shape(&args[i]) : packet_shape(&args[i]);
  if (!valid) return wasmtime_error_new(fault("wrong-host-diagnostic") ? "Unexpected input" : "Unknown export, invalid WIT input or 16 MiB conversion limit");
  value copies[2] = {{0}, {0}}; wasmtime_error_t *error = NULL;
  for (size_t i = 0; i < count; ++i) copies[i] = clone(&args[i]);
  const bool late_fin = fault("fin-after-constructor");
  if (!late_fin) for (size_t i = 0; i < count; ++i) { error = all_fin(&copies[i], argument_paths[i]); if (error) goto finish; }
  if (event_api) error = select_event(&copies[0], second_event, argument_paths[0]);
  else if (paired) {
    char path[64];
    for (unsigned i = 0; i < 2 && !error; ++i) {
      snprintf(path, sizeof(path), "%s.%s", argument_paths[0], i ? "right" : "left");
      error = select_group(&copies[0].of.record.data[i].val, i == 1, path);
    }
  } else if (aliases) {
    for (size_t i = 0; i < count && !error; ++i) error = select_group(&copies[i], i == 1, argument_paths[i]);
  } else {
    for (size_t i = 0; i < count && !error; ++i)
      error = select_packet(&copies[i], fault("echo-a") ? true : fault("echo-b") ? false : echo_b || i == 1, refuse_unit && !fault("refuse-unit"), argument_paths[i]);
  }
  if (error) goto finish;
  if (late_fin) for (size_t i = 0; i < count; ++i) { error = all_fin(&copies[i], argument_paths[i]); if (error) goto finish; }
  if (combined) { *out = fault("combine") ? pair(clone(&copies[1]), clone(&copies[0])) : pair(clone(&copies[0]), clone(&copies[1])); }
  else if (aliases) {
    size_t left = copies[0].of.list.size, right = copies[1].of.list.size;
    *out = list(left + right);
    for (size_t i = 0; i < left; ++i) out->of.list.data[i] = clone(&copies[0].of.list.data[i]);
    for (size_t i = 0; i < right; ++i) out->of.list.data[left + i] = clone(&copies[1].of.list.data[i]);
  } else *out = clone(&copies[0]);
  if (fault("mutate-accepted-input") && args[0].kind == WASMTIME_COMPONENT_RECORD && args[0].of.record.size == 20)
    ++((value *)&args[0])->of.record.data[UINT8_FIELD].val.of.u8;
finish:
  if (error && fault("mutate-rejected-input") && args[0].kind == WASMTIME_COMPONENT_RECORD && args[0].of.record.size == 20)
    ++((value *)&args[0])->of.record.data[UINT8_FIELD].val.of.u8;
  for (size_t i = 0; i < count; ++i) clear(&copies[i]);
  return error;
}
