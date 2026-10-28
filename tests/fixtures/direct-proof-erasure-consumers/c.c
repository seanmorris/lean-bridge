#include "directprooferasure.h"

#include <assert.h>
#include <stdint.h>
#include <stdio.h>

typedef directprooferasure_status (*keep_signature)(
    uint32_t, uint32_t *, directprooferasure_error *);

static keep_signature const exact_keep = &directprooferasure_keep;
static unsigned checks;

#define CHECK(condition) do { assert(condition); ++checks; } while (0)

int main(void) {
  directprooferasure_error error = {0};
  uint32_t output = 0;
  for (uint32_t value = 0; value < 1000; ++value) {
    CHECK(exact_keep(value, &output, &error) == DIRECTPROOFERASURE_STATUS_OK
        && output == value);
  }
  const uint32_t boundaries[] = {
    UINT32_C(0), UINT32_C(1), UINT32_C(42), UINT32_C(0x80000000), UINT32_MAX
  };
  for (size_t index = 0; index < sizeof(boundaries) / sizeof(boundaries[0]); ++index) {
    const uint32_t value = boundaries[index];
    CHECK(exact_keep(value, &output, &error) == DIRECTPROOFERASURE_STATUS_OK
        && output == value);
  }
  printf("direct-proof-c:%u\n", checks);
  return 0;
}
