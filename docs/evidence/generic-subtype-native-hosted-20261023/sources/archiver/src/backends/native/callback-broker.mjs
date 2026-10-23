/**
 * Shared generation-safe host callback slots for native and Wasm runtimes.
 *
 * @file
 */
export const nativeCallbackHeader = `
typedef struct lb_native_callback { void (*invoke)(void); void *context; } lb_native_callback;
uint64_t lb_native_callback_register(void (*invoke)(void), void *context);
void lb_native_callback_release(uint64_t token);
lb_native_callback lb_native_callback_lookup(uint64_t token);
int lb_native_callback_wrong_thread(uint64_t token);
int lb_native_callback_take_error(void);
`;
export const nativeCallbackBroker = `
typedef struct { lb_native_callback callback; uint64_t generation; pthread_t thread; int wrong_thread; } lb_callback_slot;
static lb_callback_slot callback_slots[4096];
static _Thread_local int callback_error;
uint64_t lb_native_callback_register(void (*invoke)(void), void *context) {
  if (!lean_bridge_native_process_valid()) return 0;
  pthread_mutex_lock(&runtime_mutex);
  if (!invoke || runtime_state != LEAN_BRIDGE_RUNTIME_READY) {
    pthread_mutex_unlock(&runtime_mutex); return 0;
  }
  for (size_t i = 0; i < 4096; ++i) if (!callback_slots[i].callback.invoke && callback_slots[i].generation < (UINT64_MAX >> 12)) {
    lb_callback_slot *slot = &callback_slots[i];
    slot->callback = (lb_native_callback){invoke, context};
    slot->thread = pthread_self(); slot->wrong_thread = 0;
    uint64_t token = (++slot->generation << 12) | i;
    pthread_mutex_unlock(&runtime_mutex); return token;
  }
  pthread_mutex_unlock(&runtime_mutex); return 0;
}
void lb_native_callback_release(uint64_t token) {
  if (!lean_bridge_native_process_valid()) return;
  pthread_mutex_lock(&runtime_mutex);
  lb_callback_slot *slot = &callback_slots[token & 4095];
  if (slot->generation == (token >> 12)) slot->callback = (lb_native_callback){0};
  pthread_mutex_unlock(&runtime_mutex);
}
lb_native_callback lb_native_callback_lookup(uint64_t token) {
  if (!lean_bridge_native_process_valid()) { callback_error = 1; return (lb_native_callback){0}; }
  pthread_mutex_lock(&runtime_mutex);
  lb_callback_slot *slot = &callback_slots[token & 4095];
  lb_native_callback result = runtime_state == LEAN_BRIDGE_RUNTIME_READY && slot->generation == (token >> 12)
    ? slot->callback : (lb_native_callback){0};
  if (result.invoke && !pthread_equal(slot->thread, pthread_self())) {
    slot->wrong_thread = 1; result = (lb_native_callback){0};
  }
  pthread_mutex_unlock(&runtime_mutex);
  if (!result.invoke) callback_error = 1;
  return result;
}
int lb_native_callback_wrong_thread(uint64_t token) {
  if (!lean_bridge_native_process_valid()) return 1;
  pthread_mutex_lock(&runtime_mutex);
  lb_callback_slot *slot = &callback_slots[token & 4095];
  int result = slot->generation == (token >> 12) && slot->wrong_thread;
  pthread_mutex_unlock(&runtime_mutex); return result;
}
int lb_native_callback_take_error(void) { int result = callback_error; callback_error = 0; return result; }
`;
