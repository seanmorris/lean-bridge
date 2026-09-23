#include <assert.h>
#include <stdio.h>

static lean_object ok = {0}, failure = {1};
static unsigned starts, finishes, marks, tasks, component_calls, core_error;
void lean_initialize_runtime_module(void) { ++starts; }
lean_object *initialize_Init(uint8_t builtin) { assert(builtin == 1); return core_error ? &failure : &ok; }
void lean_io_mark_end_initialization(void) { ++marks; }
void lean_init_task_manager(void) { ++tasks; }
void lean_finalize_task_manager(void) { ++finishes; }
static void *initialize_ok(uint8_t builtin) { assert(builtin == 1); ++component_calls; return &ok; }
static void *initialize_bad(uint8_t builtin) { assert(builtin == 1); ++component_calls; return &failure; }
static void callback(void) {}
static lean_bridge_native_snapshot snapshot(void) {
  lean_bridge_native_snapshot value = {0}; lean_bridge_native_snapshot_read(&value); return value;
}
static void rejected(void) {
  unsigned before = component_calls;
  assert(!lean_bridge_native_component_initialize("first", initialize_ok));
  assert(!lean_bridge_native_component_initialize("second", initialize_ok));
  assert(!lean_bridge_native_component_initialize("new", initialize_ok));
  assert(component_calls == before);
  assert(!lean_bridge_native_component_ready("first"));
  assert(!lean_bridge_native_component_ready("second"));
  assert(!lean_bridge_native_identity_acquire("value", &ok));
  assert(!lb_native_callback_register(callback, NULL));
}
static void initialized(void) {
  assert(!lean_bridge_native_component_ready(NULL));
  assert(!lean_bridge_native_component_ready("first"));
  assert(!lean_bridge_native_identity_acquire("value", &ok));
  assert(!lb_native_callback_register(callback, NULL));
  assert(lean_bridge_native_component_initialize("first", initialize_ok));
  assert(lean_bridge_native_component_initialize("second", initialize_ok));
  assert(lean_bridge_native_component_initialize("first", initialize_bad));
  assert(starts == 1 && component_calls == 2 && marks == 1 && tasks == 1);
  assert(snapshot().runtime_state == 2 && snapshot().abi_version == 1);
  assert(snapshot().attached_components == 2 && snapshot().component_init_runs == 2);
  lean_bridge_native_component_detach("first"); assert(!lean_bridge_native_component_ready("first"));
  assert(lean_bridge_native_component_initialize("first", initialize_bad));
  assert(lean_bridge_native_component_ready("first") && component_calls == 2);
  assert(!lb_native_callback_register(NULL, NULL));
}
static pthread_barrier_t barrier;
static void *worker(void *unused) {
  (void)unused; unsigned object = 0;
  assert(lean_bridge_native_component_initialize("first", initialize_ok));
  uint64_t identity = lean_bridge_native_identity_acquire("thread", &object);
  uint64_t token = lb_native_callback_register(callback, &object);
  assert(identity && token);
  assert(lb_native_callback_lookup(token).invoke == callback);
  pthread_barrier_wait(&barrier); pthread_barrier_wait(&barrier);
  rejected();
  assert(!lb_native_callback_lookup(token).invoke && lb_native_callback_take_error());
  assert(!lb_native_callback_take_error());
  lb_native_callback_release(token);
  assert(lean_bridge_native_identity_release(identity, "thread", &object) == 1);
  return NULL;
}
int main(int argc, char **argv) {
  assert(argc == 2);
  if (!strcmp(argv[1], "cold")) {
    lean_bridge_native_runtime_retire(); lean_bridge_native_runtime_retire(); rejected();
    assert(starts == 0 && component_calls == 0 && snapshot().runtime_state == 3);
  } else if (!strcmp(argv[1], "core-failure")) {
    core_error = 1;
    assert(!lean_bridge_native_component_initialize("first", initialize_ok)); rejected();
    assert(starts == 1 && component_calls == 0 && tasks == 0 && snapshot().runtime_state == 3);
  } else if (!strcmp(argv[1], "first-failure")) {
    assert(!lean_bridge_native_component_initialize("first", initialize_bad)); rejected();
    assert(starts == 1 && component_calls == 1 && tasks == 0 && snapshot().runtime_state == 3);
  } else {
    initialized();
    if (!strcmp(argv[1], "component-failure")) {
      assert(!lean_bridge_native_component_initialize("bad", initialize_bad));
      assert(!lean_bridge_native_component_initialize("bad", initialize_ok));
      assert(!lean_bridge_native_component_ready("bad") && component_calls == 3);
      assert(snapshot().runtime_state == 2 && lean_bridge_native_component_ready("first"));
      lean_bridge_native_runtime_retire(); rejected();
    } else if (!strcmp(argv[1], "retire")) {
      uint64_t identity = lean_bridge_native_identity_acquire("value", &ok);
      assert(identity && lean_bridge_native_identity_acquire("value", &ok) == identity);
      uint64_t other = lean_bridge_native_identity_acquire("other", &ok);
      uint64_t token = lb_native_callback_register(callback, &ok);
      assert(other && token && snapshot().live_identities == 2);
      lean_bridge_native_snapshot before = snapshot();
      lean_bridge_native_runtime_retire(); lean_bridge_native_runtime_retire(); rejected();
      assert(snapshot().runtime_state == 3 && snapshot().runtime_instance_id == before.runtime_instance_id);
      assert(snapshot().identity_domain_id == before.identity_domain_id);
      assert(!lb_native_callback_lookup(token).invoke && lb_native_callback_take_error());
      lb_native_callback_release(token);
      assert(lean_bridge_native_identity_release(identity, "value", &ok) == 0);
      assert(lean_bridge_native_identity_release(identity, "value", &ok) == 1);
      assert(lean_bridge_native_identity_release(identity, "value", &ok) == -1);
      assert(lean_bridge_native_identity_release_pointer("other", &ok) == 1);
      assert(snapshot().live_identities == 0);
      lean_bridge_native_component_detach("first"); lean_bridge_native_component_detach("second");
      assert(snapshot().attached_components == 0);
      lean_bridge_native_process_shutdown(); assert(finishes == 0);
    } else if (!strcmp(argv[1], "shutdown")) {
      lean_bridge_native_process_shutdown(); assert(finishes == 1); rejected();
      lean_bridge_native_runtime_retire(); assert(snapshot().runtime_state == 4);
      lean_bridge_native_process_shutdown(); assert(finishes == 1);
    } else {
      assert(!strcmp(argv[1], "threads")); pthread_t threads[8];
      assert(!pthread_barrier_init(&barrier, NULL, 9));
      for (size_t i = 0; i < 8; ++i) assert(!pthread_create(&threads[i], NULL, worker, NULL));
      pthread_barrier_wait(&barrier); assert(snapshot().live_identities == 8);
      lean_bridge_native_runtime_retire(); pthread_barrier_wait(&barrier);
      for (size_t i = 0; i < 8; ++i) assert(!pthread_join(threads[i], NULL));
      assert(!pthread_barrier_destroy(&barrier)); assert(snapshot().live_identities == 0);
    }
  }
  printf("native-runtime-ok %s\n", argv[1]); return 0;
}
