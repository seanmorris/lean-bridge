/* Dynamic loading and process affinity of the installed public owned WIT API. */
#include "owned_aggregates_wasmtime.h"
#include <dlfcn.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/wait.h>
#include <unistd.h>

static size_t checks;
#define CHECK(value) do { ++checks; if (!(value)) { \
  fprintf(stderr, "owned WIT loader check failed at %s:%d: %s\n", __FILE__, __LINE__, #value); abort(); \
} } while (0)
typedef owned_aggregates_wasmtime_status status;
typedef owned_aggregates_wasmtime_session session;
typedef owned_aggregates_wasmtime_result owner;
typedef struct {
  void *library;
  status (*open)(session **);
  status (*close)(session **);
  status (*release)(owner **);
  status (*serial)(session *, owned_aggregates_wasmtime_ticket_t, mpz_srcptr *, owner **);
} api;
static api load(const char *path, int flags) {
  api result = {0}; result.library = dlopen(path, RTLD_NOW | flags);
  if (!result.library) fprintf(stderr, "%s\n", dlerror());
  CHECK(result.library != NULL);
#define SYMBOL(field, name) do { \
  void *symbol = dlsym(result.library, "owned_aggregates_wasmtime_" name); CHECK(symbol != NULL); \
  _Static_assert(sizeof(result.field) == sizeof(symbol), "POSIX function pointer"); \
  memcpy(&result.field, &symbol, sizeof(symbol)); \
} while (0)
  SYMBOL(open, "session_open"); SYMBOL(close, "session_close");
  SYMBOL(release, "result_release"); SYMBOL(serial, "serial");
#undef SYMBOL
  return result;
}
int main(int argc, char **argv) {
  CHECK(argc == 5);
  int visibility = !strcmp(argv[1], "global") ? RTLD_GLOBAL : RTLD_LOCAL;
  void *preload = NULL;
  if (strcmp(argv[4], "none")) {
    preload = dlopen(argv[4], RTLD_NOW | visibility);
    if (!preload) fprintf(stderr, "%s\n", dlerror());
    CHECK(preload != NULL);
  }
  api first = load(argv[2], visibility); session *a = NULL;
  if (preload) {
    CHECK(first.open(&a) == OWNED_AGGREGATES_WASMTIME_RUNTIME_UNAVAILABLE); CHECK(a == NULL);
    CHECK(first.close(&a) == OWNED_AGGREGATES_WASMTIME_RUNTIME_UNAVAILABLE); CHECK(a == NULL);
    owner *o = NULL; mpz_srcptr value = NULL;
    CHECK(first.release(&o) == OWNED_AGGREGATES_WASMTIME_RUNTIME_UNAVAILABLE); CHECK(o == NULL);
    CHECK(first.serial(NULL, NULL, &value, &o) == OWNED_AGGREGATES_WASMTIME_RUNTIME_UNAVAILABLE);
    CHECK(value == NULL && o == NULL);
  } else {
    CHECK(first.open(&a) == OWNED_AGGREGATES_WASMTIME_OK); CHECK(a != NULL);
    pid_t child = fork(); CHECK(child >= 0);
    if (!child) {
      session *inherited = a, *fresh = NULL; owner *o = NULL;
      CHECK(first.open(&fresh) == OWNED_AGGREGATES_WASMTIME_WRONG_PROCESS); CHECK(fresh == NULL);
      CHECK(first.close(&inherited) == OWNED_AGGREGATES_WASMTIME_WRONG_PROCESS); CHECK(inherited == a);
      CHECK(first.release(&o) == OWNED_AGGREGATES_WASMTIME_WRONG_PROCESS); CHECK(o == NULL);
      api second = load(argv[3], visibility);
      CHECK(second.open(&fresh) == OWNED_AGGREGATES_WASMTIME_RUNTIME_UNAVAILABLE); CHECK(fresh == NULL);
      _exit(0);
    }
    int outcome = 0; CHECK(waitpid(child, &outcome, 0) == child);
    CHECK(WIFEXITED(outcome) && WEXITSTATUS(outcome) == 0);
    api second = load(argv[3], visibility); session *b = NULL;
    CHECK(second.open(&b) == OWNED_AGGREGATES_WASMTIME_OK); CHECK(b != NULL);
    CHECK(second.close(&b) == OWNED_AGGREGATES_WASMTIME_OK); CHECK(b == NULL);
    CHECK(first.close(&a) == OWNED_AGGREGATES_WASMTIME_OK); CHECK(a == NULL);
    CHECK(dlclose(second.library) == 0);
  }
  CHECK(dlclose(first.library) == 0); if (preload) CHECK(dlclose(preload) == 0);
  printf("{\"checks\":%zu,\"conflict\":%s}\n", checks, preload ? "true" : "false");
  return 0;
}
