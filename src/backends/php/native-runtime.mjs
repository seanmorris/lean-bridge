import { createHash } from "node:crypto";

import { hashBindingIr } from "../../binding-ir/canonical.mjs";
import { validateBindingIr } from "../../binding-ir/contract.mjs";
import { compilePhpProjection } from "./projection.mjs";

export class PhpNativeRuntimeGenerationError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "PhpNativeRuntimeGenerationError";
    this.code = code;
    this.details = Object.freeze(structuredClone(details));
  }
}

const fail = (code, message, details = {}) => {
  throw new PhpNativeRuntimeGenerationError(code, message, details);
};

const sha256 = source => createHash("sha256").update(source, "utf8").digest("hex");
const snake = value => String(value)
  .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
  .replace(/[^A-Za-z0-9]+/g, "_")
  .replace(/^_+|_+$/g, "")
  .toLowerCase();
const upper = value => snake(value).toUpperCase();
const packageName = ir => ir.component.id.slice(0, ir.component.id.lastIndexOf("@"));
const packageStem = ir => snake(packageName(ir).split("/").at(-1));

const exactAlphaShape = (ir, projection) => {
  const expected = [
    "lean:Alpha.box",
    "lean:Alpha.Box.read",
    "bridge:Alpha.Box.identity",
    "lean:Alpha.roundTrip",
    "lean:Alpha.withCallback",
    "lean:Alpha.makeAdder",
  ];
  const payload = ir.types.find(type => type.kind === "record");
  const resource = ir.types.find(type => type.kind === "resource");
  const callback = ir.types.find(type => type.kind === "callback");
  const payloadFields = payload?.fields.map(field => `${field.name}:${field.type.kind === "primitive" ? field.type.name : field.type.constructor}`).join(",");
  if (
    ir.types.filter(type => type.kind === "record").length !== 1 ||
    ir.types.filter(type => type.kind === "resource").length !== 1 ||
    ir.types.filter(type => type.kind === "callback").length !== 1 ||
    payloadFields !== "enabled:bool,count:uint32,label:string,bytes:bytes,values:array" ||
    JSON.stringify(projection.operations.map(operation => operation.id)) !== JSON.stringify(expected)
  ) {
    fail("unsupported-native-runtime-shape", "the native runtime POC requires the reviewed Alpha value, resource, and callback fixture", {
      operations: projection.operations.map(operation => operation.id),
      payloadFields,
    });
  }
  return { payload, resource, callback };
};

const brokerHeader = `#ifndef LEAN_BRIDGE_NATIVE_RUNTIME_H
#define LEAN_BRIDGE_NATIVE_RUNTIME_H

#include <stddef.h>
#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

#define LEAN_BRIDGE_NATIVE_RUNTIME_ABI_VERSION 1u

#if defined(_WIN32)
#define LEAN_BRIDGE_NATIVE_API __declspec(dllexport)
#else
#define LEAN_BRIDGE_NATIVE_API __attribute__((visibility("default")))
#endif

typedef void *(*lean_bridge_native_initializer)(uint8_t builtin);

typedef struct lean_bridge_native_snapshot {
  uint32_t abi_version;
  uint32_t runtime_state;
  uint32_t runtime_init_runs;
  uint32_t component_init_runs;
  uint32_t attached_components;
  uint32_t live_identities;
  uint64_t runtime_instance_id;
  uint64_t identity_domain_id;
} lean_bridge_native_snapshot;

LEAN_BRIDGE_NATIVE_API int lean_bridge_native_component_initialize(
    const char *component_id,
    lean_bridge_native_initializer initializer
);
LEAN_BRIDGE_NATIVE_API void lean_bridge_native_component_detach(const char *component_id);
LEAN_BRIDGE_NATIVE_API uint64_t lean_bridge_native_identity_acquire(const char *kind, const void *pointer);
LEAN_BRIDGE_NATIVE_API int lean_bridge_native_identity_release(uint64_t token, const char *kind, const void *pointer);
LEAN_BRIDGE_NATIVE_API int lean_bridge_native_identity_release_pointer(const char *kind, const void *pointer);
LEAN_BRIDGE_NATIVE_API void lean_bridge_native_snapshot_read(lean_bridge_native_snapshot *out);

#ifdef __cplusplus
}
#endif

#endif
`;

const brokerSource = `#include "lean_bridge_native_runtime.h"

#include <lean/lean.h>
#include <pthread.h>
#include <stdbool.h>
#include <stdint.h>
#include <string.h>
#include <unistd.h>

extern lean_object *initialize_Init(uint8_t builtin);
extern void lean_initialize_runtime_module(void);

enum lean_bridge_runtime_state {
  LEAN_BRIDGE_RUNTIME_COLD = 0,
  LEAN_BRIDGE_RUNTIME_INITIALIZING = 1,
  LEAN_BRIDGE_RUNTIME_READY = 2,
  LEAN_BRIDGE_RUNTIME_FAILED = 3,
  LEAN_BRIDGE_RUNTIME_SHUT_DOWN = 4
};

enum {
  LEAN_BRIDGE_COMPONENT_CAPACITY = 128,
  LEAN_BRIDGE_COMPONENT_ID_CAPACITY = 160,
  LEAN_BRIDGE_IDENTITY_CAPACITY = 4096
};

typedef struct lean_bridge_component_slot {
  char id[LEAN_BRIDGE_COMPONENT_ID_CAPACITY];
  uint8_t state;
  bool attached;
} lean_bridge_component_slot;

typedef struct lean_bridge_identity_slot {
  const void *pointer;
  uint64_t kind_hash;
  uint32_t generation;
  uint32_t references;
  bool retired;
} lean_bridge_identity_slot;

static pthread_mutex_t runtime_mutex = PTHREAD_MUTEX_INITIALIZER;
static uint32_t runtime_state = LEAN_BRIDGE_RUNTIME_COLD;
static uint32_t runtime_init_runs = 0;
static uint32_t component_init_runs = 0;
static uint32_t attached_components = 0;
static uint32_t live_identities = 0;
static lean_bridge_component_slot components[LEAN_BRIDGE_COMPONENT_CAPACITY];
static lean_bridge_identity_slot identities[LEAN_BRIDGE_IDENTITY_CAPACITY];

__attribute__((destructor))
static void lean_bridge_native_process_shutdown(void)
{
  pthread_mutex_lock(&runtime_mutex);
  if (runtime_state == LEAN_BRIDGE_RUNTIME_READY && live_identities == 0) {
    lean_finalize_task_manager();
  }
  runtime_state = LEAN_BRIDGE_RUNTIME_SHUT_DOWN;
  pthread_mutex_unlock(&runtime_mutex);
}

static uint64_t hash_text(const char *text)
{
  uint64_t hash = UINT64_C(1469598103934665603);
  while (*text) {
    hash ^= (uint8_t)*text++;
    hash *= UINT64_C(1099511628211);
  }
  return hash;
}

static uint64_t opaque_process_id(const void *address, uint64_t domain)
{
  uint64_t value = (uint64_t)(uintptr_t)address ^ ((uint64_t)(uint32_t)getpid() << 32) ^ domain;
  value ^= value >> 30;
  value *= UINT64_C(0xbf58476d1ce4e5b9);
  value ^= value >> 27;
  value *= UINT64_C(0x94d049bb133111eb);
  value ^= value >> 31;
  return value == 0 ? domain : value;
}

static lean_bridge_component_slot *component_find(const char *component_id)
{
  for (size_t index = 0; index < LEAN_BRIDGE_COMPONENT_CAPACITY; index++) {
    if (components[index].id[0] != 0 && strcmp(components[index].id, component_id) == 0) return &components[index];
  }
  return NULL;
}

static lean_bridge_component_slot *component_reserve(const char *component_id)
{
  size_t length = strlen(component_id);
  if (length == 0 || length >= LEAN_BRIDGE_COMPONENT_ID_CAPACITY) return NULL;
  for (size_t index = 0; index < LEAN_BRIDGE_COMPONENT_CAPACITY; index++) {
    if (components[index].id[0] == 0) {
      memcpy(components[index].id, component_id, length + 1);
      components[index].state = LEAN_BRIDGE_RUNTIME_COLD;
      return &components[index];
    }
  }
  return NULL;
}

LEAN_BRIDGE_NATIVE_API int lean_bridge_native_component_initialize(
    const char *component_id,
    lean_bridge_native_initializer initializer
)
{
  if (component_id == NULL || initializer == NULL) return 0;
  pthread_mutex_lock(&runtime_mutex);
  lean_bridge_component_slot *component = component_find(component_id);
  if (component != NULL && component->state == LEAN_BRIDGE_RUNTIME_READY) {
    if (!component->attached) {
      component->attached = true;
      attached_components++;
    }
    pthread_mutex_unlock(&runtime_mutex);
    return 1;
  }
  if (component != NULL && component->state == LEAN_BRIDGE_RUNTIME_FAILED) {
    pthread_mutex_unlock(&runtime_mutex);
    return 0;
  }
  if (runtime_state == LEAN_BRIDGE_RUNTIME_FAILED || runtime_state == LEAN_BRIDGE_RUNTIME_INITIALIZING) {
    pthread_mutex_unlock(&runtime_mutex);
    return 0;
  }
  if (component == NULL) component = component_reserve(component_id);
  if (component == NULL) {
    pthread_mutex_unlock(&runtime_mutex);
    return 0;
  }

  bool first = runtime_state == LEAN_BRIDGE_RUNTIME_COLD;
  if (first) {
    runtime_state = LEAN_BRIDGE_RUNTIME_INITIALIZING;
    runtime_init_runs++;
    lean_initialize_runtime_module();
    lean_object *init_result = initialize_Init(1);
    if (lean_io_result_is_error(init_result)) {
      lean_dec(init_result);
      runtime_state = LEAN_BRIDGE_RUNTIME_FAILED;
      component->state = LEAN_BRIDGE_RUNTIME_FAILED;
      pthread_mutex_unlock(&runtime_mutex);
      return 0;
    }
    lean_dec(init_result);
  }

  component->state = LEAN_BRIDGE_RUNTIME_INITIALIZING;
  lean_object *component_result = (lean_object *)initializer(1);
  component_init_runs++;
  if (lean_io_result_is_error(component_result)) {
    lean_dec(component_result);
    component->state = LEAN_BRIDGE_RUNTIME_FAILED;
    if (first) runtime_state = LEAN_BRIDGE_RUNTIME_FAILED;
    pthread_mutex_unlock(&runtime_mutex);
    return 0;
  }
  lean_dec(component_result);
  if (first) {
    lean_io_mark_end_initialization();
    lean_init_task_manager();
    runtime_state = LEAN_BRIDGE_RUNTIME_READY;
  }
  component->state = LEAN_BRIDGE_RUNTIME_READY;
  component->attached = true;
  attached_components++;
  pthread_mutex_unlock(&runtime_mutex);
  return 1;
}

LEAN_BRIDGE_NATIVE_API void lean_bridge_native_component_detach(const char *component_id)
{
  if (component_id == NULL) return;
  pthread_mutex_lock(&runtime_mutex);
  lean_bridge_component_slot *component = component_find(component_id);
  if (component != NULL && component->attached) {
    component->attached = false;
    attached_components--;
  }
  pthread_mutex_unlock(&runtime_mutex);
}

LEAN_BRIDGE_NATIVE_API uint64_t lean_bridge_native_identity_acquire(const char *kind, const void *pointer)
{
  if (kind == NULL || pointer == NULL) return 0;
  uint64_t kind_hash = hash_text(kind);
  pthread_mutex_lock(&runtime_mutex);
  for (size_t index = 0; index < LEAN_BRIDGE_IDENTITY_CAPACITY; index++) {
    lean_bridge_identity_slot *slot = &identities[index];
    if (slot->pointer == pointer && slot->kind_hash == kind_hash && !slot->retired) {
      if (slot->references == UINT32_MAX) {
        pthread_mutex_unlock(&runtime_mutex);
        return 0;
      }
      slot->references++;
      uint64_t token = ((uint64_t)slot->generation << 32) | (uint64_t)(index + 1);
      pthread_mutex_unlock(&runtime_mutex);
      return token;
    }
  }
  for (size_t index = 0; index < LEAN_BRIDGE_IDENTITY_CAPACITY; index++) {
    lean_bridge_identity_slot *slot = &identities[index];
    if (slot->pointer != NULL || slot->retired) continue;
    if (slot->generation == 0) slot->generation = 1;
    slot->pointer = pointer;
    slot->kind_hash = kind_hash;
    slot->references = 1;
    live_identities++;
    uint64_t token = ((uint64_t)slot->generation << 32) | (uint64_t)(index + 1);
    pthread_mutex_unlock(&runtime_mutex);
    return token;
  }
  pthread_mutex_unlock(&runtime_mutex);
  return 0;
}

LEAN_BRIDGE_NATIVE_API int lean_bridge_native_identity_release(uint64_t token, const char *kind, const void *pointer)
{
  if (token == 0 || kind == NULL || pointer == NULL) return -1;
  uint32_t encoded_index = (uint32_t)token;
  uint32_t generation = (uint32_t)(token >> 32);
  if (encoded_index == 0 || encoded_index > LEAN_BRIDGE_IDENTITY_CAPACITY || generation == 0) return -1;
  pthread_mutex_lock(&runtime_mutex);
  lean_bridge_identity_slot *slot = &identities[encoded_index - 1];
  if (slot->pointer != pointer || slot->kind_hash != hash_text(kind) || slot->generation != generation || slot->references == 0 || slot->retired) {
    pthread_mutex_unlock(&runtime_mutex);
    return -1;
  }
  slot->references--;
  if (slot->references != 0) {
    pthread_mutex_unlock(&runtime_mutex);
    return 0;
  }
  slot->pointer = NULL;
  slot->kind_hash = 0;
  live_identities--;
  if (slot->generation == UINT32_MAX) {
    slot->retired = true;
  } else {
    slot->generation++;
  }
  pthread_mutex_unlock(&runtime_mutex);
  return 1;
}

LEAN_BRIDGE_NATIVE_API int lean_bridge_native_identity_release_pointer(const char *kind, const void *pointer)
{
  if (kind == NULL || pointer == NULL) return -1;
  uint64_t kind_hash = hash_text(kind);
  pthread_mutex_lock(&runtime_mutex);
  for (size_t index = 0; index < LEAN_BRIDGE_IDENTITY_CAPACITY; index++) {
    lean_bridge_identity_slot *slot = &identities[index];
    if (slot->pointer != pointer || slot->kind_hash != kind_hash || slot->references == 0 || slot->retired) continue;
    slot->references--;
    if (slot->references == 0) {
      slot->pointer = NULL;
      slot->kind_hash = 0;
      live_identities--;
      if (slot->generation == UINT32_MAX) slot->retired = true;
      else slot->generation++;
    }
    pthread_mutex_unlock(&runtime_mutex);
    return 1;
  }
  pthread_mutex_unlock(&runtime_mutex);
  return 0;
}

LEAN_BRIDGE_NATIVE_API void lean_bridge_native_snapshot_read(lean_bridge_native_snapshot *out)
{
  if (out == NULL) return;
  pthread_mutex_lock(&runtime_mutex);
  *out = (lean_bridge_native_snapshot){
    .abi_version = LEAN_BRIDGE_NATIVE_RUNTIME_ABI_VERSION,
    .runtime_state = runtime_state,
    .runtime_init_runs = runtime_init_runs,
    .component_init_runs = component_init_runs,
    .attached_components = attached_components,
    .live_identities = live_identities,
    .runtime_instance_id = opaque_process_id(&runtime_state, UINT64_C(0x4c65616e52756e31)),
    .identity_domain_id = opaque_process_id(identities, UINT64_C(0x4c65616e49646531))
  };
  pthread_mutex_unlock(&runtime_mutex);
}
`;

const providerSource = (ir, shape) => {
  const stem = packageStem(ir);
  const macro = upper(stem);
  const payload = snake(shape.payload.name);
  const resource = snake(shape.resource.name);
  const callback = snake(shape.callback.name);
  const componentId = `${ir.component.id}#${hashBindingIr(ir)}`;
  return `#include "${stem}_runtime.h"
#include "lean_bridge_native_runtime.h"

#include <lean/lean.h>
#include <stdlib.h>
#include <string.h>

extern lean_object *initialize_Alpha(uint8_t builtin);
extern lean_object *lean_link_alpha_box(uint32_t value);
extern uint32_t lean_link_alpha_read(lean_object *box);
extern lean_object *lean_link_alpha_payload(uint8_t enabled, uint32_t count, lean_object *label, lean_object *bytes, lean_object *values);
extern lean_object *lean_link_alpha_round_trip(lean_object *payload);
extern uint32_t lean_link_alpha_with_callback(uint32_t value, lean_object *transform);
extern lean_object *lean_link_alpha_make_adder(uint32_t base);
extern uint8_t lean_link_alpha_payload_enabled(lean_object *payload);
extern uint32_t lean_link_alpha_payload_count(lean_object *payload);
extern lean_object *lean_link_alpha_payload_label(lean_object *payload);
extern lean_object *lean_link_alpha_payload_bytes(lean_object *payload);
extern lean_object *lean_link_alpha_payload_values(lean_object *payload);

static const char component_id[] = "${componentId}";
static const char box_identity_kind[] = "${ir.component.id}:${shape.resource.name}";
static const char transform_identity_kind[] = "${ir.component.id}:${shape.callback.name}";

static ${stem}_status fail(${stem}_status status, ${stem}_error_code code, const char *message, ${stem}_error *error)
{
  if (error != NULL) {
    error->code = code;
    error->message = message;
    error->message_length = strlen(message);
  }
  return status;
}

static void release_heap(void *owner) { free(owner); }

static void *copy_bytes(const void *source, size_t length)
{
  if (length == 0) return NULL;
  void *copy = malloc(length);
  if (copy != NULL) memcpy(copy, source, length);
  return copy;
}

static ${stem}_status initialize(void *context, ${stem}_error *error)
{
  (void)context;
  if (!lean_bridge_native_component_initialize(component_id, (lean_bridge_native_initializer)initialize_Alpha)) {
    return fail(${macro}_STATUS_RUNTIME_REJECTED, ${macro}_ERROR_UNEXPECTED, "the shared native Lean runtime rejected Alpha initialization", error);
  }
  return ${macro}_STATUS_OK;
}

static ${stem}_status box_create(void *context, uint32_t value, uintptr_t *out, ${stem}_error *error)
{
  (void)context;
  (void)error;
  lean_object *box = lean_link_alpha_box(value);
  if (box == NULL) return fail(${macro}_STATUS_UNEXPECTED_ERROR, ${macro}_ERROR_UNEXPECTED, "Lean returned a null Box", error);
  if (lean_bridge_native_identity_acquire(box_identity_kind, box) == 0) {
    lean_dec(box);
    return fail(${macro}_STATUS_UNEXPECTED_ERROR, ${macro}_ERROR_UNEXPECTED, "native Box identity capacity is exhausted", error);
  }
  *out = (uintptr_t)box;
  return ${macro}_STATUS_OK;
}

static ${stem}_status box_read(void *context, uintptr_t self, uint32_t *out, ${stem}_error *error)
{
  (void)context;
  if (self == 0) return fail(${macro}_STATUS_DECLARED_ERROR, ${macro}_ERROR_DISPOSED_RESOURCE, "Box is closed", error);
  lean_object *box = (lean_object *)self;
  lean_inc(box);
  *out = lean_link_alpha_read(box);
  return ${macro}_STATUS_OK;
}

static ${stem}_status box_identity(void *context, uintptr_t self, uintptr_t *out, ${stem}_error *error)
{
  (void)context;
  if (self == 0) return fail(${macro}_STATUS_DECLARED_ERROR, ${macro}_ERROR_DISPOSED_RESOURCE, "Box is closed", error);
  *out = self;
  return ${macro}_STATUS_OK;
}

static ${stem}_status round_trip(void *context, const ${stem}_${payload} *input, ${stem}_${payload} *out, ${stem}_error *error)
{
  (void)context;
  lean_object *label = lean_mk_string_from_bytes(input->label.length == 0 ? "" : input->label.data, input->label.length);
  lean_object *bytes = lean_alloc_sarray(1, input->bytes.length, input->bytes.length);
  if (input->bytes.length != 0) memcpy(lean_sarray_cptr(bytes), input->bytes.data, input->bytes.length);
  lean_object *values = lean_alloc_array(input->values.length, input->values.length);
  for (size_t index = 0; index < input->values.length; index++) {
    lean_array_set_core(values, index, lean_box_uint32(input->values.data[index]));
  }
  lean_object *payload_value = lean_link_alpha_payload(input->enabled, input->count, label, bytes, values);
  lean_object *result = lean_link_alpha_round_trip(payload_value);
  if (result == NULL || lean_is_scalar(result)) {
    if (result != NULL) lean_dec(result);
    return fail(${macro}_STATUS_UNEXPECTED_ERROR, ${macro}_ERROR_UNEXPECTED, "Lean returned an invalid Payload", error);
  }

  lean_inc(result);
  uint8_t enabled = lean_link_alpha_payload_enabled(result);
  lean_inc(result);
  uint32_t count = lean_link_alpha_payload_count(result);
  lean_inc(result);
  lean_object *result_label = lean_link_alpha_payload_label(result);
  lean_inc(result);
  lean_object *result_bytes = lean_link_alpha_payload_bytes(result);
  lean_inc(result);
  lean_object *result_values = lean_link_alpha_payload_values(result);
  lean_dec(result);

  size_t label_length = lean_string_size(result_label) - 1;
  size_t bytes_length = lean_sarray_size(result_bytes);
  size_t values_length = lean_array_size(result_values);
  char *label_copy = copy_bytes(lean_string_cstr(result_label), label_length);
  uint8_t *bytes_copy = copy_bytes(lean_sarray_cptr(result_bytes), bytes_length);
  uint32_t *values_copy = values_length == 0 ? NULL : malloc(values_length * sizeof(uint32_t));
  if (values_copy != NULL) {
    for (size_t index = 0; index < values_length; index++) values_copy[index] = lean_unbox_uint32(lean_array_get_core(result_values, index));
  }
  lean_dec(result_label);
  lean_dec(result_bytes);
  lean_dec(result_values);
  if ((label_length != 0 && label_copy == NULL) || (bytes_length != 0 && bytes_copy == NULL) || (values_length != 0 && values_copy == NULL)) {
    free(label_copy);
    free(bytes_copy);
    free(values_copy);
    return fail(${macro}_STATUS_UNEXPECTED_ERROR, ${macro}_ERROR_UNEXPECTED, "native Payload copy allocation failed", error);
  }
  *out = (${stem}_${payload}){
    .enabled = enabled,
    .count = count,
    .label = {label_copy, label_length, label_copy, release_heap},
    .bytes = {bytes_copy, bytes_length, bytes_copy, release_heap},
    .values = {values_copy, values_length, values_copy, release_heap}
  };
  return ${macro}_STATUS_OK;
}

typedef struct callback_frame {
  const ${stem}_${callback} *callback;
  ${stem}_status status;
  ${stem}_error error;
} callback_frame;

static lean_object *callback_apply(lean_object *frame_value, lean_object *argument)
{
  callback_frame *frame = (callback_frame *)(uintptr_t)lean_unbox_usize(frame_value);
  uint32_t value = lean_unbox_uint32(argument);
  lean_dec(frame_value);
  lean_dec(argument);
  uint32_t result = 0;
  frame->status = frame->callback->call(frame->callback->context, value, &result, &frame->error);
  return lean_box_uint32(result);
}

static ${stem}_status with_callback(void *context, uint32_t value, const ${stem}_${callback} *callback_value, uint32_t *out, ${stem}_error *error)
{
  (void)context;
  callback_frame frame = {callback_value, ${macro}_STATUS_OK, {0}};
  lean_object *callback = lean_alloc_closure((void *)callback_apply, 2, 1);
  lean_closure_set(callback, 0, lean_box_usize((size_t)(uintptr_t)&frame));
  uint32_t result = lean_link_alpha_with_callback(value, callback);
  if (frame.status != ${macro}_STATUS_OK) {
    if (error != NULL) *error = frame.error;
    return frame.status;
  }
  *out = result;
  return ${macro}_STATUS_OK;
}

static ${stem}_status make_adder(void *context, uint32_t base, uintptr_t *out, ${stem}_error *error)
{
  (void)context;
  (void)error;
  lean_object *transform = lean_link_alpha_make_adder(base);
  if (transform == NULL) return fail(${macro}_STATUS_UNEXPECTED_ERROR, ${macro}_ERROR_UNEXPECTED, "Lean returned a null Transform", error);
  if (lean_bridge_native_identity_acquire(transform_identity_kind, transform) == 0) {
    lean_dec(transform);
    return fail(${macro}_STATUS_UNEXPECTED_ERROR, ${macro}_ERROR_UNEXPECTED, "native Transform identity capacity is exhausted", error);
  }
  *out = (uintptr_t)transform;
  return ${macro}_STATUS_OK;
}

static void box_dispose(void *context, uintptr_t value)
{
  (void)context;
  if (value != 0) {
    (void)lean_bridge_native_identity_release_pointer(box_identity_kind, (lean_object *)value);
    lean_dec((lean_object *)value);
  }
}

static ${stem}_status transform_call(void *context, uintptr_t self, uint32_t value, uint32_t *out, ${stem}_error *error)
{
  (void)context;
  if (self == 0) return fail(${macro}_STATUS_DECLARED_ERROR, ${macro}_ERROR_DISPOSED_RESOURCE, "Transform is closed", error);
  lean_object *transform = (lean_object *)self;
  lean_inc(transform);
  lean_object *result = lean_apply_1(transform, lean_box_uint32(value));
  *out = lean_unbox_uint32(result);
  lean_dec(result);
  return ${macro}_STATUS_OK;
}

static void transform_dispose(void *context, uintptr_t value)
{
  (void)context;
  if (value != 0) {
    (void)lean_bridge_native_identity_release_pointer(transform_identity_kind, (lean_object *)value);
    lean_dec((lean_object *)value);
  }
}

const ${stem}_runtime_v1 *${stem}_native_runtime_v1(void)
{
  static const ${stem}_runtime_v1 runtime = {
    .abi_version = ${macro}_BINDING_ABI_VERSION,
    .initialize = initialize,
    .box_create = box_create,
    .box_read = box_read,
    .box_identity = box_identity,
    .round_trip = round_trip,
    .with_callback = with_callback,
    .make_adder = make_adder,
    .box_dispose = box_dispose,
    .transform_call = transform_call,
    .transform_dispose = transform_dispose
  };
  return &runtime;
}

void ${stem}_native_runtime_detach(void)
{
  lean_bridge_native_component_detach(component_id);
}
`;
};

export const generateNativeRuntimePackage = (ir, {
  generator = { id: "lean-bridge/native-runtime", version: 1 },
  ownershipScope = "process",
  threadPolicy = "synchronous host entry; locked runtime and identity administration",
} = {}) => {
  validateBindingIr(ir);
  const projection = compilePhpProjection(ir);
  const shape = exactAlphaShape(ir, projection);
  const stem = packageStem(ir);
  const files = {
    "include/lean_bridge_native_runtime.h": brokerHeader,
    "src/lean_bridge_native_runtime.c": brokerSource,
    [`src/${stem}_native.c`]: providerSource(ir, shape),
  };
  const sourceFiles = Object.keys(files).sort();
  files["native-runtime-manifest.json"] = `${JSON.stringify({
    schemaVersion: 1,
    component: ir.component.id,
    bindingIrSha256: hashBindingIr(ir),
    generator,
    sharedRuntimeAbi: 1,
    ownershipScope,
    threadPolicy,
    componentProvider: `${stem}_native_runtime_v1`,
    sourceFiles,
    filesSha256: Object.fromEntries(sourceFiles.map(path => [path, sha256(files[path])])),
  }, null, 2)}\n`;
  return Object.freeze(files);
};

export const generatePhpNativeRuntimePackage = ir => generateNativeRuntimePackage(ir, {
  generator: { id: "lean-wasm/php-native-runtime", version: 1 },
  ownershipScope: "php-process",
  threadPolicy: "php-nts-only; synchronous request entry; locked runtime and identity administration",
});
