/**
 * Shared native Lean runtime and generation-safe identity registry.
 *
 * @file
 */
export const brokerHeader = `#ifndef LEAN_BRIDGE_NATIVE_RUNTIME_H
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

export const brokerSource = `#include "lean_bridge_native_runtime.h"

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
