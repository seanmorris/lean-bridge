/* Private test driver: resolve each component through its own DSO. There is
   no fallback to a statically linked producer and no host-side task mapping. */
#include <dlfcn.h>
#include <stdio.h>
static lean_object *(*initialize_ThreadProbe)(uint8_t);
static lean_object *(*initialize_TaskPeer)(uint8_t);
static lean_object *(*lean_bridge_probe_gate)(void);
static lean_object *(*lean_bridge_probe_watch)(lean_object *);
static lean_object *(*lean_bridge_probe_ready)(uint32_t);
static lean_object *(*lean_bridge_probe_signal)(lean_object *, uint32_t);
static lean_object *(*lean_bridge_probe_temp_io)(void);
static lean_object *(*lean_bridge_probe_start)(lean_object *, lean_object *, uint8_t);
static lean_object *(*lean_bridge_task_peer_map)(lean_object *);

static int load_plugins(void) {
  void *producer = dlopen("/task-producer.wasm", RTLD_NOW | RTLD_LOCAL);
  if (!producer) { fprintf(stderr, "producer: %s\n", dlerror()); return 0; }
  void *peer = dlopen("/task-peer.wasm", RTLD_NOW | RTLD_LOCAL);
  if (!peer) { fprintf(stderr, "peer: %s\n", dlerror()); return 0; }
#define FROM(handle, symbol) do { \
  symbol = (__typeof__(symbol))dlsym(handle, #symbol); \
  if (!symbol) { fprintf(stderr, "%s: %s\n", #symbol, dlerror()); return 0; } \
} while (0)
  FROM(producer, initialize_ThreadProbe);
  FROM(producer, lean_bridge_probe_gate);
  FROM(producer, lean_bridge_probe_watch);
  FROM(producer, lean_bridge_probe_ready);
  FROM(producer, lean_bridge_probe_signal);
  FROM(producer, lean_bridge_probe_temp_io);
  FROM(producer, lean_bridge_probe_start);
  FROM(peer, initialize_TaskPeer);
  FROM(peer, lean_bridge_task_peer_map);
#undef FROM
  return 1;
}
