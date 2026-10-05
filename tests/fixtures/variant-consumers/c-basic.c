#define _POSIX_C_SOURCE 200809L
#include "variants.h"
#include <assert.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

static size_t checks,calls,rejected;
#define CHECK(x) do { ++checks; assert((x)); } while (0)
#define CALL(x) do { ++calls; CHECK((x) == VARIANTS_STATUS_OK); } while (0)
int main(void) {
  variants_signal input,out; variants_signal_init(&input); variants_signal_init(&out); variants_error error={0};
  for (unsigned i=0;i<128;++i) {
    CHECK(variants_signal_select(&input,VARIANTS_SIGNAL_KIND_DATA) == VARIANTS_STATUS_OK);
    input.cases.data.count=i; input.cases.data.label=(variants_string){"A\0!",3,NULL,NULL};
    CALL(variants_next(&input,&out,&error)); CHECK(out.kind == VARIANTS_SIGNAL_KIND_DATA);
    CHECK(out.cases.data.count == i+1 && out.cases.data.label.length == 4 && !memcmp(out.cases.data.label.data,"A\0!!",4));
    CHECK(out.cases.data.label.data != input.cases.data.label.data);
    CHECK(variants_signal_select(&out,UINT32_MAX) == VARIANTS_STATUS_INVALID_ARGUMENT); CHECK(out.cases.data.count == i+1);
    CHECK(variants_signal_select(&out,VARIANTS_SIGNAL_KIND_IDLE) == VARIANTS_STATUS_OK);
    CALL(variants_next(&out,&input,&error)); CHECK(input.kind == VARIANTS_SIGNAL_KIND_STOPPED);
    variants_signal_clear(&out); CALL(variants_next(&input,&out,&error)); CHECK(out.kind == VARIANTS_SIGNAL_KIND_MARKER);
    variants_signal_clear(&input); CALL(variants_next(&out,&input,&error)); CHECK(input.kind == VARIANTS_SIGNAL_KIND_DATA && input.cases.data.count == 42);
    variants_signal_clear(&input); variants_signal_clear(&out);
  }
  variants_nested nested={0},nested_out={0};
  CHECK(variants_nested_select(&nested,VARIANTS_NESTED_KIND_PACKET) == VARIANTS_STATUS_OK);
  CHECK(variants_signal_select(&nested.cases.packet.value.current,VARIANTS_SIGNAL_KIND_DATA) == VARIANTS_STATUS_OK);
  nested.cases.packet.value.current.cases.data.count=91;
  nested.cases.packet.value.current.cases.data.label=(variants_string){"nested",6,NULL,NULL};
  CALL(variants_echo_nested(&nested,&nested_out,&error));
  CHECK(nested_out.kind == VARIANTS_NESTED_KIND_PACKET && nested_out.cases.packet.value.current.cases.data.count == 91);
  CHECK(!memcmp(nested_out.cases.packet.value.current.cases.data.label.data,"nested",6));
  variants_nested_clear(&nested); variants_nested_clear(&nested_out); variants_nested_clear(&nested_out);
  uint8_t bytes[]={0,255}; variants_bytes borrowed={bytes,2,NULL,NULL}; variants_buffers buffers={0},buffers_out={0};
  CALL(variants_echo_buffers(&buffers,&buffers_out,&error)); CHECK(buffers_out.kind == VARIANTS_BUFFERS_KIND_EMPTY);
  variants_buffers_clear(&buffers_out); CALL(variants_duplicate(&borrowed,&buffers_out,&error));
  CHECK(buffers_out.kind == VARIANTS_BUFFERS_KIND_PAIR && buffers_out.cases.pair.first.length == 2);
  CHECK(buffers_out.cases.pair.first.data != buffers_out.cases.pair.second.data && buffers_out.cases.pair.first.data != bytes);
  variants_buffers_clear(&buffers); CALL(variants_echo_buffers(&buffers_out,&buffers,&error));
  variants_buffers_clear(&buffers_out); CHECK(buffers.cases.pair.second.length == 2 && buffers.cases.pair.second.data[1] == 255);
  variants_buffers_clear(&buffers); variants_buffers_clear(&buffers);
  input.kind=UINT32_MAX; ++calls; ++rejected; CHECK(variants_echo(&input,&out,&error) == VARIANTS_STATUS_INVALID_ARGUMENT);
  CHECK(out.kind == VARIANTS_SIGNAL_KIND_IDLE); variants_signal_clear(&input);
  CALL(variants_make(7,&out,&error)); CHECK(out.cases.data.count == 7); variants_signal_clear(&out);
  FILE* maps=fopen("/proc/self/maps","r"); CHECK(maps); char* line=NULL; size_t capacity=0,count=0; char libraries[8][4096];
  while (getline(&line,&capacity,maps)>=0) {
    char* path=strchr(line,'/'); if (!path) continue; path[strcspn(path,"\n")]=0;
    if (!strstr(path,"libvariants") && !strstr(path,"libcomponent_") && !strstr(path,"liblean_") && !strstr(path,"libleanshared.so")) continue;
    size_t i=0; for (;i<count;++i) if (!strcmp(libraries[i],path)) break;
    if (i == count) { CHECK(count<8 && strlen(path)<sizeof(libraries[0])); strcpy(libraries[count++],path); }
  }
  free(line); CHECK(!fclose(maps)); CHECK(count == 4);
  printf("c-variant-ok:%zu:%zu:%zu\n",checks,calls,rejected);
  for (size_t i=0;i<count;++i) printf("library:%s\n",libraries[i]);
}
