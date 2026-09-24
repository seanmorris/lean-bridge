#define _GNU_SOURCE
#include <assert.h>
#include <dlfcn.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/wait.h>
#include <unistd.h>
#include "witprobe_wasmtime.h"
#include "otherprobe_wasmtime.h"

typedef struct {
  void *library;
  unsigned kind;
  void *session;
  void (*error_delete)(wasmtime_error_t *);
  void (*error_message)(const wasmtime_error_t *, wasm_name_t *);
  void (*name_delete)(wasm_name_t *);
} api;

#define SYMBOL(target, symbol) do { \
  void *address = dlsym(value->library, symbol); assert(address); \
  _Static_assert(sizeof(target) == sizeof(address), "POSIX function pointer"); \
  memcpy(&(target), &address, sizeof(target)); \
} while (0)

#define WRAPPERS(p, P) \
static wasmtime_error_t *open_##p(api *value) { \
  wasmtime_error_t *(*function)(p##_wasmtime **); \
  SYMBOL(function, #p "_wasmtime_open"); \
  p##_wasmtime *session = NULL; wasmtime_error_t *error = function(&session); \
  if (error) assert(!session); else { assert(session); value->session = session; } \
  return error; \
} \
static wasmtime_error_t *call_##p(api *value, uint32_t *result) { \
  wasmtime_error_t *(*function)(p##_wasmtime *, const p##_tree_t *, uint32_t *); \
  SYMBOL(function, #p "_wasmtime_value_evaluate"); \
  p##_tree_t input = {.kind = P##_TREE_T_KIND_LEAF, .cases.leaf.value = 1}; \
  return function(value->session, &input, result); \
} \
static void close_##p(api *value) { \
  void (*function)(p##_wasmtime *); SYMBOL(function, #p "_wasmtime_close"); \
  function(value->session); \
} \
static wasmtime_error_t *link_##p(api *value) { \
  wasmtime_error_t *(*function)(wasmtime_component_linker_t *); \
  SYMBOL(function, #p "_wasmtime_link"); return function(NULL); \
}

WRAPPERS(witprobe, WITPROBE)
WRAPPERS(otherprobe, OTHERPROBE)

static wasmtime_error_t *open_api(api *value) { return value->kind ? open_otherprobe(value) : open_witprobe(value); }
static wasmtime_error_t *call_api(api *value, uint32_t *result) { return value->kind ? call_otherprobe(value, result) : call_witprobe(value, result); }
static void close_api(api *value) { if (value->kind) close_otherprobe(value); else close_witprobe(value); }
static wasmtime_error_t *link_api(api *value) { return value->kind ? link_otherprobe(value) : link_witprobe(value); }

static api load(const char *path, unsigned kind, int flags) {
  api loaded = {.kind = kind}; api *value = &loaded;
  value->library = dlopen(path, RTLD_NOW | flags);
  if (!value->library) fprintf(stderr, "%s\n", dlerror());
  assert(value->library);
  SYMBOL(value->error_delete, "wasmtime_error_delete");
  SYMBOL(value->error_message, "wasmtime_error_message");
  SYMBOL(value->name_delete, "wasm_byte_vec_delete");
  return loaded;
}

static void reject(api *value, wasmtime_error_t *error, const char *reason) {
  assert(error);
  wasm_name_t message = {0}; value->error_message(error, &message);
  assert(memmem(message.data, message.size, reason, strlen(reason)));
  value->name_delete(&message); value->error_delete(error);
}

int main(int argc, char **argv) {
  assert(argc == 9);
  int flags = !strcmp(argv[1], "global") ? RTLD_GLOBAL : RTLD_LOCAL;
  void *preloaded = NULL;
  if (strcmp(argv[8], "none")) { preloaded = dlopen(argv[8], RTLD_NOW | flags); assert(preloaded); }
  api first = load(argv[3], (unsigned)atoi(argv[2]), flags);
  int expected_first = atoi(argv[4]), expected_second = atoi(argv[7]);
  wasmtime_error_t *error = open_api(&first);
  if (expected_first < 0) {
    reject(&first, error, "dependency conflict");
    reject(&first, link_api(&first), "dependency conflict");
    assert(!first.session); dlclose(first.library); if (preloaded) dlclose(preloaded);
    puts("{\"firstRejected\":true}"); return 0;
  }
  assert(!error);
  uint32_t before = 0, after = 0, other = UINT32_C(0xabcdef);
  assert(!call_api(&first, &before)); assert(before == (uint32_t)expected_first);
  api second = load(argv[6], (unsigned)atoi(argv[5]), flags);
  error = open_api(&second);
  if (expected_second < 0) {
    reject(&second, error, "dependency conflict"); assert(!second.session);
    reject(&second, link_api(&second), "dependency conflict");
    reject(&second, call_api(&second, &other), "dependency conflict");
    assert(other == UINT32_C(0xabcdef));
  } else {
    assert(!error); assert(!call_api(&second, &other)); assert(other == (uint32_t)expected_second);
  }
  assert(!call_api(&first, &after)); assert(after == before);
  pid_t child = fork(); assert(child >= 0);
  if (!child) {
    uint32_t unchanged = UINT32_C(0xabcdef);
    reject(&first, call_api(&first, &unchanged), "after fork");
    assert(unchanged == UINT32_C(0xabcdef));
    reject(&first, open_api(&first), "after fork");
    reject(&first, link_api(&first), "after fork");
    close_api(&first); _exit(0);
  }
  int status; assert(waitpid(child, &status, 0) == child);
  assert(WIFEXITED(status) && WEXITSTATUS(status) == 0);
  assert(!call_api(&first, &after)); assert(after == before);
  if (second.session) close_api(&second);
  dlclose(second.library); close_api(&first); dlclose(first.library);
  if (preloaded) dlclose(preloaded);
  printf("{\"first\":%u,\"secondRejected\":%s,\"second\":%u,\"firstAfter\":%u,\"inheritedHostRejected\":true}\n",
    before, expected_second < 0 ? "true" : "false", other, after);
}
