#include "component.h"
#include "lean_bridge_native_runtime.h"
#include <stdio.h>
#include <time.h>
#include <stdlib.h>
#include <string.h>

extern lean_object *LB_INITIALIZER(uint8_t builtin);
extern lean_object *LB_CALLBACK_WRAP(size_t token);
static volatile uint64_t sink;
static uint8_t source_bytes[1024];
static uint32_t callback(void *context, uint32_t value) { (void)context; return value * 2; }
static double now(void) { struct timespec t; clock_gettime(CLOCK_MONOTONIC, &t); return t.tv_sec * 1e9 + t.tv_nsec; }
static void call(int mode, uint64_t token) {
  if (mode == 0) sink = LB_ADD(19, 23);
  else if (mode == 1) {
    lean_object *bytes = lean_alloc_sarray(1, 1024, 1024);
    memcpy(lean_sarray_cptr(bytes), source_bytes, sizeof(source_bytes));
    lean_object *result = LB_BYTES(bytes);
    sink = lean_sarray_size(result); lean_dec(result);
  } else sink = LB_CALLBACK(20, LB_CALLBACK_WRAP(token));
}
static int compare(const void *a, const void *b) { double x = *(const double *)a, y = *(const double *)b; return (x > y) - (x < y); }
int main(void) {
  for (size_t i = 0; i < sizeof(source_bytes); i++) source_bytes[i] = (uint8_t)i;
  if (!lean_bridge_native_component_initialize("benchmark", (lean_bridge_native_initializer)LB_INITIALIZER)) return 1;
  uint64_t token = lb_native_callback_register((void (*)(void))callback, NULL);
  if (!token) return 2;
  const char *names[] = {"scalar", "bytes1024", "callback"};
  printf("{");
  for (int mode = 0; mode < 3; mode++) {
    for (int i = 0; i < 10000; i++) call(mode, token);
    double samples[9]; const int iterations = 1000000;
    for (int sample = 0; sample < 9; sample++) {
      double start = now();
      for (int i = 0; i < iterations; i++) call(mode, token);
      samples[sample] = (now() - start) / iterations;
    }
    qsort(samples, 9, sizeof(double), compare);
    printf("%s\"%s\":{\"medianNs\":%.6f,\"minimumNs\":%.6f,\"iterations\":%d,\"samples\":9}", mode ? "," : "", names[mode], samples[4], samples[0], iterations);
  }
  printf("}\n"); lb_native_callback_release(token);
  return sink == 41 ? 0 : 3;
}
