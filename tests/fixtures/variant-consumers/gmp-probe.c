#include "variants.h"
#include <assert.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

static int remaining=-1,live;
static unsigned checks,failures,rejected,releases;
#define CHECK(x) do { ++checks; assert((x)); } while (0)
static int allowed(void) { if (!remaining) return 0; if (remaining>0) --remaining; return 1; }
void* probe_malloc(size_t n) { if (!allowed()) return NULL; void* p=malloc(n); if(p)++live; return p; }
void* probe_calloc(size_t n,size_t w) { if (!allowed()) return NULL; void* p=calloc(n,w); if(p)++live; return p; }
void probe_free(void* p) { if(p) { --live; free(p); } }
static void release_old(void* p) { ++releases; free(p); }
int main(int argc,char** argv) {
  if (argc == 2 && !strcmp(argv[1],"--startup-only")) return 0;
  variants_error error={0};
  variants_signal events[3]; for(unsigned i=0;i<3;++i) variants_signal_init(&events[i]);
  CHECK(variants_signal_select(&events[1],VARIANTS_SIGNAL_KIND_DATA) == VARIANTS_STATUS_OK);
  events[1].cases.data.count=91; events[1].cases.data.label=(variants_string){"label",5,NULL,NULL};
  CHECK(variants_signal_select(&events[2],VARIANTS_SIGNAL_KIND_MARKER) == VARIANTS_STATUS_OK);
  variants_nested input,out; variants_nested_init(&input); variants_nested_init(&out);
  CHECK(variants_nested_select(&input,VARIANTS_NESTED_KIND_PACKET) == VARIANTS_STATUS_OK);
  input.cases.packet.value.current=events[1];
  input.cases.packet.value.events=(variants_list_lean_variants_signal_span){events,3,NULL,NULL};
  input.cases.packet.value.fallback.has_value=1; input.cases.packet.value.fallback.value=events[1];
  for(unsigned round=0;round<32;++round) {
    CHECK(variants_nested_select(&out,VARIANTS_NESTED_KIND_OUTCOME) == VARIANTS_STATUS_OK);
    char* held=malloc(4); CHECK(held); memcpy(held,"held",4);
    out.cases.outcome.value.error=(variants_string){held,4,held,release_old};
    unsigned old_releases=releases; int succeeded=0;
    for(int limit=0;limit<100;++limit) {
      remaining=limit; variants_status status=variants_echo_nested(&input,&out,&error); remaining=-1;
      if(status == VARIANTS_STATUS_OK) {
        CHECK(releases == old_releases+1 && out.kind == VARIANTS_NESTED_KIND_PACKET);
        CHECK(out.cases.packet.value.events.length == 3 && out.cases.packet.value.fallback.has_value);
        CHECK(out.cases.packet.value.current.cases.data.label.data != out.cases.packet.value.events.data[1].cases.data.label.data);
        variants_nested_clear(&out); variants_nested_clear(&out); CHECK(live == 0); succeeded=1; break;
      }
      CHECK(status == VARIANTS_STATUS_UNEXPECTED_ERROR && live == 0); ++failures;
      CHECK(out.kind == VARIANTS_NESTED_KIND_OUTCOME && out.cases.outcome.value.error.data == held);
      CHECK(releases == old_releases && out.cases.outcome.value.error.length == 4);
    }
    CHECK(succeeded);
  }
  variants_scalars scalar,scalar_out; variants_scalars_init(&scalar); variants_scalars_init(&scalar_out);
  CHECK(variants_scalars_select(&scalar,VARIANTS_SCALARS_KIND_ALL) == VARIANTS_STATUS_OK);
  CHECK(variants_scalars_select(&scalar_out,VARIANTS_SCALARS_KIND_ALL) == VARIANTS_STATUS_OK);
  mpz_setbit(scalar.cases.all.natural,5120); mpz_setbit(scalar.cases.all.integer,2048); mpz_neg(scalar.cases.all.integer,scalar.cases.all.integer);
  scalar.cases.all.text=(variants_string){"copied",6,NULL,NULL}; const uint8_t data[]={0,255}; scalar.cases.all.bytes=(variants_bytes){data,2,NULL,NULL};
  for(unsigned round=0;round<32;++round) {
    mpz_set_ui(scalar_out.cases.all.natural,19); mpz_set_si(scalar_out.cases.all.integer,-91);
    int succeeded=0;
    for(int limit=0;limit<100;++limit) {
      remaining=limit; variants_status status=variants_echo_scalars(&scalar,&scalar_out,&error); remaining=-1;
      if(status == VARIANTS_STATUS_OK) {
        CHECK(mpz_cmp(scalar_out.cases.all.natural,scalar.cases.all.natural) == 0);
        CHECK(mpz_cmp(scalar_out.cases.all.integer,scalar.cases.all.integer) == 0);
        CHECK(!memcmp(scalar_out.cases.all.text.data,"copied",6)); succeeded=1; break;
      }
      CHECK(status == VARIANTS_STATUS_UNEXPECTED_ERROR && live == 0); ++failures;
      CHECK(scalar_out.kind == VARIANTS_SCALARS_KIND_ALL && !mpz_cmp_ui(scalar_out.cases.all.natural,19) && !mpz_cmp_si(scalar_out.cases.all.integer,-91));
    }
    CHECK(succeeded); CHECK(variants_scalars_select(&scalar_out,VARIANTS_SCALARS_KIND_ALL) == VARIANTS_STATUS_OK); CHECK(live == 0);
  }
  variants_signal invalid; memset(&invalid,0xff,sizeof(invalid)); invalid.kind=UINT32_MAX;
  variants_signal signal_out; variants_signal_init(&signal_out);
  CHECK(variants_echo(&invalid,&signal_out,&error) == VARIANTS_STATUS_INVALID_ARGUMENT); ++rejected;
  CHECK(signal_out.kind == VARIANTS_SIGNAL_KIND_IDLE && live == 0); variants_signal_clear(&invalid);
  mpz_set_si(scalar.cases.all.natural,-1);
  CHECK(variants_echo_scalars(&scalar,&scalar_out,&error) == VARIANTS_STATUS_INVALID_ARGUMENT); ++rejected; CHECK(live == 0);
  mpz_set_ui(scalar.cases.all.natural,7); scalar.cases.all.text.length=SIZE_MAX;
  CHECK(variants_echo_scalars(&scalar,&scalar_out,&error) == VARIANTS_STATUS_INVALID_ARGUMENT); ++rejected; CHECK(live == 0);
  scalar.cases.all.text.length=6; input.cases.packet.value.fallback.has_value=2;
  CHECK(variants_echo_nested(&input,&out,&error) == VARIANTS_STATUS_INVALID_ARGUMENT); ++rejected; CHECK(live == 0);
  input.cases.packet.value.fallback.has_value=1;
  CHECK(variants_echo_nested(&input,&out,&error) == VARIANTS_STATUS_OK); variants_nested_clear(&out);
  CHECK(variants_echo_scalars(&scalar,&scalar_out,&error) == VARIANTS_STATUS_OK); variants_scalars_clear(&scalar_out);
  CHECK(live == 0); variants_scalars_clear(&scalar); variants_scalars_clear(&scalar_out); variants_nested_clear(&input);
  variants_signal_clear(&signal_out); for(unsigned i=0;i<3;++i) variants_signal_clear(&events[i]);
  printf("gmp-variant-fault-ok:%u:%u:%u:%u\n",checks,failures,rejected,releases);
}
