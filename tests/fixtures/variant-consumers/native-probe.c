#include "variants.h"
#include <assert.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

static int remaining = -1, live;
static unsigned checks, failures, rejected, malformed;
int probe_bad_tag;
#define CHECK(x) do { ++checks; assert(x); } while (0)
static int allowed(void) { if (!remaining) return 0; if (remaining > 0) --remaining; return 1; }
void* probe_malloc(size_t n) { if (!allowed()) return NULL; void* p = malloc(n); if (p) ++live; return p; }
void* probe_calloc(size_t n, size_t w) { if (!allowed()) return NULL; void* p = calloc(n,w); if (p) ++live; return p; }
void* probe_realloc(void* old, size_t n) { if (!allowed()) return NULL; int fresh = !old; void* p = realloc(old,n); if (fresh && p) ++live; return p; }
void probe_free(void* p) { if (p) { --live; free(p); } }

int main(int argc, char** argv) {
  if (argc == 2 && strcmp(argv[1], "--startup-only") == 0) return 0;
  variants_error error = {0};
  variants_signal data = {.kind=2, .cases.data={19,{"A\0\xf0\x9f\x8c\xb1",6,NULL,NULL}}};
  variants_signal events[] = {data, {.kind=0}, data, {.kind=3, .cases.marker={0}}};
  variants_mode modes[] = {{.kind=0}, {.kind=1}, {.kind=2}};
  variants_nested input = {.kind=1};
  input.cases.packet.value.current = data;
  input.cases.packet.value.events.data = events; input.cases.packet.value.events.length = 4;
  input.cases.packet.value.fallback.has_value = 1; input.cases.packet.value.fallback.value = data;
  input.cases.packet.value.modes.data = modes; input.cases.packet.value.modes.length = 3;
  for (unsigned round=0; round<40; ++round) {
    int succeeded = 0;
    for (int limit=0; limit<128; ++limit) {
      variants_nested out, before; memset(&out,0xa5,sizeof(out)); memcpy(&before,&out,sizeof(out)); remaining=limit;
      variants_status status = variants_echo_nested(&input,&out,&error);
      remaining=-1;
      if (status == VARIANTS_STATUS_OK) {
        CHECK(out.kind == 1 && out.cases.packet.value.events.length == 4);
        CHECK(out.cases.packet.value.current.cases.data.label.length == 6);
        CHECK(out.cases.packet.value.current.cases.data.label.data != data.cases.data.label.data);
        CHECK(out.cases.packet.value.current.cases.data.label.data != out.cases.packet.value.events.data[0].cases.data.label.data);
        variants_nested_clear(&out); variants_nested_clear(&out); CHECK(live == 0); succeeded=1; break;
      }
      CHECK(status == VARIANTS_STATUS_UNEXPECTED_ERROR); CHECK(live == 0); CHECK(memcmp(&out,&before,sizeof(out)) == 0); ++failures;
    }
    CHECK(succeeded);
  }
  for (uint32_t tag=4; tag<68; ++tag) {
    variants_signal wrong; memset(&wrong,0xff,sizeof(wrong)); wrong.kind=tag;
    variants_signal out, before; memset(&out,0x5a,sizeof(out)); memcpy(&before,&out,sizeof(out));
    CHECK(variants_echo(&wrong,&out,&error) == VARIANTS_STATUS_INVALID_ARGUMENT);
    CHECK(memcmp(&out,&before,sizeof(out)) == 0 && live == 0); ++rejected;
    variants_signal_clear(&wrong); CHECK(wrong.kind == 0);
  }
  for (unsigned i=0; i<2; ++i) {
    variants_signal poison; memset(&poison,0xff,sizeof(poison)); poison.kind=i;
    variants_signal out={0}; CHECK(variants_echo(&poison,&out,&error) == VARIANTS_STATUS_OK);
    CHECK(out.kind == i); variants_signal_clear(&out); variants_signal_clear(&poison); CHECK(live == 0);
  }
  variants_signal wrong = data, out = {.kind=1};
  wrong.cases.data.label.data = NULL;
  CHECK(variants_echo(&wrong,&out,&error) == VARIANTS_STATUS_INVALID_ARGUMENT); CHECK(out.kind == 1); ++rejected;
  wrong=data; wrong.cases.data.label.length=SIZE_MAX;
  CHECK(variants_echo(&wrong,&out,&error) == VARIANTS_STATUS_INVALID_ARGUMENT); CHECK(out.kind == 1); ++rejected;
  wrong=data; wrong.cases.data.label.data="\xff"; wrong.cases.data.label.length=1;
  CHECK(variants_echo(&wrong,&out,&error) == VARIANTS_STATUS_INVALID_ARGUMENT); CHECK(out.kind == 1); ++rejected;
  wrong.kind=3; wrong.cases.marker.value=1;
  CHECK(variants_echo(&wrong,&out,&error) == VARIANTS_STATUS_INVALID_ARGUMENT); CHECK(out.kind == 1); ++rejected;
  variants_nested bad = input, nested_out = {.kind=2};
  bad.cases.packet.value.events.length=SIZE_MAX;
  CHECK(variants_echo_nested(&bad,&nested_out,&error) == VARIANTS_STATUS_INVALID_ARGUMENT); CHECK(nested_out.kind == 2); ++rejected;
  bad=input; bad.cases.packet.value.fallback.has_value=2;
  CHECK(variants_echo_nested(&bad,&nested_out,&error) == VARIANTS_STATUS_INVALID_ARGUMENT); CHECK(nested_out.kind == 2); ++rejected;
  probe_bad_tag=1;
  CHECK(variants_echo(&data,&out,&error) == VARIANTS_STATUS_UNEXPECTED_ERROR); CHECK(out.kind == 1 && live == 0); ++malformed;
  probe_bad_tag=0;
  CHECK(variants_echo(&data,&out,&error) == VARIANTS_STATUS_OK); CHECK(out.kind == 2 && error.code == VARIANTS_ERROR_NONE);
  variants_signal_clear(&out); CHECK(live == 0);
  const uint8_t bytes[]={0,255}; variants_bytes input_bytes={bytes,2,NULL,NULL};
  for (int limit=0; limit<2; ++limit) {
    variants_buffers buffers={.kind=0}; remaining=limit;
    CHECK(variants_duplicate(&input_bytes,&buffers,&error) == VARIANTS_STATUS_UNEXPECTED_ERROR);
    remaining=-1; CHECK(buffers.kind == 0 && live == 0); ++failures;
  }
  variants_buffers buffers={0}; CHECK(variants_duplicate(&input_bytes,&buffers,&error) == VARIANTS_STATUS_OK);
  CHECK(buffers.kind == 1 && buffers.cases.pair.first.data != buffers.cases.pair.second.data);
  variants_buffers_clear(&buffers); variants_buffers_clear(&buffers); CHECK(live == 0);
  printf("variant-fault-ok:%u:%u:%u:%u\n",checks,failures,rejected,malformed);
}
