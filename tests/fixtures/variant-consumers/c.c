#define _POSIX_C_SOURCE 200809L
#include "variants.h"
#include <assert.h>
#include <math.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

static size_t checks, calls, rejected;
static variants_error error;
#define CHECK(x) do { ++checks; assert((x)); } while (0)
#define CALL(x) do { ++calls; CHECK((x) == VARIANTS_STATUS_OK); } while (0)
#define INVALID(x) do { ++calls; CHECK((x) == VARIANTS_STATUS_INVALID_ARGUMENT); ++rejected; } while (0)
#define SELECT(type, value, tag) CHECK(variants_##type##_select(&(value), (tag)) == VARIANTS_STATUS_OK)
static const char text[] = "A\0\xf0\x9f\x8c\xb1";
static const uint8_t bytes[] = {0,255,1};
static void same_string(variants_string a, variants_string b) {
  CHECK(a.length == b.length); CHECK(!a.length || memcmp(a.data,b.data,a.length) == 0);
}
static void same_bytes(variants_bytes a, variants_bytes b) {
  CHECK(a.length == b.length); CHECK(!a.length || memcmp(a.data,b.data,a.length) == 0);
}
static void same_signal(const variants_signal* a, const variants_signal* b) {
  CHECK(a->kind == b->kind);
  switch (a->kind) {
    case VARIANTS_SIGNAL_KIND_IDLE: case VARIANTS_SIGNAL_KIND_STOPPED: break;
    case VARIANTS_SIGNAL_KIND_DATA: CHECK(a->cases.data.count == b->cases.data.count); same_string(a->cases.data.label,b->cases.data.label); break;
    case VARIANTS_SIGNAL_KIND_MARKER: CHECK(a->cases.marker.value == 0 && b->cases.marker.value == 0); break;
    default: CHECK(0);
  }
}
static void fill_scalars(variants_scalars* value) {
  CHECK(variants_scalars_select(value,VARIANTS_SCALARS_KIND_ALL) == VARIANTS_STATUS_OK);
  value->cases.all.bool_=true; value->cases.all.u8=UINT8_MAX; value->cases.all.u16=UINT16_MAX;
  value->cases.all.u32=UINT32_MAX; value->cases.all.u64=UINT64_MAX;
  value->cases.all.i8=INT8_MIN; value->cases.all.i16=INT16_MIN; value->cases.all.i32=INT32_MIN; value->cases.all.i64=INT64_MIN;
  mpz_setbit(value->cases.all.natural,5120); mpz_add_ui(value->cases.all.natural,value->cases.all.natural,19);
  mpz_setbit(value->cases.all.integer,5120); mpz_add_ui(value->cases.all.integer,value->cases.all.integer,31); mpz_neg(value->cases.all.integer,value->cases.all.integer);
  value->cases.all.f32=1.5f; value->cases.all.f64=-2.25;
  value->cases.all.text=(variants_string){text,6,NULL,NULL}; value->cases.all.bytes=(variants_bytes){bytes,3,NULL,NULL};
  value->cases.all.char_=0x1f331; value->cases.all.word=UINT32_MAX; value->cases.all.signed_word=INT32_MIN;
}
static void same_scalars(const variants_scalars* a, const variants_scalars* b) {
  CHECK(a->kind == b->kind); if (a->kind == VARIANTS_SCALARS_KIND_ABSENT) return;
  CHECK(a->kind == VARIANTS_SCALARS_KIND_ALL);
  CHECK(a->cases.all.unit == b->cases.all.unit); CHECK(a->cases.all.bool_ == b->cases.all.bool_);
  CHECK(a->cases.all.u8 == b->cases.all.u8); CHECK(a->cases.all.u16 == b->cases.all.u16); CHECK(a->cases.all.u32 == b->cases.all.u32); CHECK(a->cases.all.u64 == b->cases.all.u64);
  CHECK(a->cases.all.i8 == b->cases.all.i8); CHECK(a->cases.all.i16 == b->cases.all.i16); CHECK(a->cases.all.i32 == b->cases.all.i32); CHECK(a->cases.all.i64 == b->cases.all.i64);
  CHECK(mpz_cmp(a->cases.all.natural,b->cases.all.natural) == 0); CHECK(mpz_cmp(a->cases.all.integer,b->cases.all.integer) == 0);
  CHECK(isnan(a->cases.all.f32) ? isnan(b->cases.all.f32) : a->cases.all.f32 == b->cases.all.f32);
  CHECK(isnan(a->cases.all.f64) ? isnan(b->cases.all.f64) : a->cases.all.f64 == b->cases.all.f64);
  same_string(a->cases.all.text,b->cases.all.text); same_bytes(a->cases.all.bytes,b->cases.all.bytes);
  CHECK(a->cases.all.char_ == b->cases.all.char_); CHECK(a->cases.all.word == b->cases.all.word); CHECK(a->cases.all.signed_word == b->cases.all.signed_word);
}
static void primitives(void) {
  variants_scalars input,out; variants_scalars_init(&input); variants_scalars_init(&out); fill_scalars(&input);
  bool accepted=false; CALL(variants_inspect(&input,&accepted,&error)); CHECK(accepted);
  for (unsigned round=0; round<128; ++round) {
    CALL(variants_echo_scalars(&input,&out,&error)); same_scalars(&input,&out);
    CHECK(input.cases.all.text.data != out.cases.all.text.data && input.cases.all.bytes.data != out.cases.all.bytes.data);
    mpz_add_ui(out.cases.all.natural,out.cases.all.natural,1); CHECK(mpz_cmp(input.cases.all.natural,out.cases.all.natural) != 0);
    ((uint8_t*)out.cases.all.bytes.data)[0]=19; CHECK(input.cases.all.bytes.data[0] == 0);
  }
  for (unsigned field=0; field<18; ++field) {
    fill_scalars(&input);
    switch (field) {
      case 0: input.cases.all.bool_=false; break; case 1: input.cases.all.u8=0; break; case 2: input.cases.all.u16=0; break;
      case 3: input.cases.all.u32=0; break; case 4: input.cases.all.u64=0; break; case 5: input.cases.all.i8=0; break;
      case 6: input.cases.all.i16=0; break; case 7: input.cases.all.i32=0; break; case 8: input.cases.all.i64=0; break;
      case 9: mpz_set_ui(input.cases.all.natural,0); break; case 10: mpz_set_ui(input.cases.all.integer,0); break;
      case 11: input.cases.all.f32=0; break; case 12: input.cases.all.f64=0; break;
      case 13: input.cases.all.text.length=0; break; case 14: input.cases.all.bytes.length=0; break;
      case 15: input.cases.all.char_='A'; break; case 16: input.cases.all.word=0; break; case 17: input.cases.all.signed_word=0; break;
    }
    CALL(variants_inspect(&input,&accepted,&error)); CHECK(!accepted);
  }
  fill_scalars(&input); input.cases.all.word=UINT64_MAX; input.cases.all.signed_word=INT64_MIN;
  input.cases.all.f32=-0.0f; input.cases.all.f64=-0.0;
  CALL(variants_echo_scalars(&input,&out,&error)); same_scalars(&input,&out); CHECK(signbit(out.cases.all.f32) && signbit(out.cases.all.f64));
  input.cases.all.f32=INFINITY; input.cases.all.f64=-INFINITY;
  CALL(variants_echo_scalars(&input,&out,&error)); same_scalars(&input,&out);
  input.cases.all.f32=NAN; input.cases.all.f64=NAN;
  CALL(variants_echo_scalars(&input,&out,&error)); same_scalars(&input,&out);
  const uint32_t valid_chars[]={0,0xd7ff,0xe000,0x10ffff}, bad_chars[]={0xd800,0xdfff,0x110000};
  for (unsigned i=0;i<4;++i) { input.cases.all.char_=valid_chars[i]; CALL(variants_echo_scalars(&input,&out,&error)); CHECK(out.cases.all.char_ == valid_chars[i]); }
  for (unsigned i=0;i<3;++i) { input.cases.all.char_=bad_chars[i]; INVALID(variants_echo_scalars(&input,&out,&error)); CHECK(out.cases.all.char_ == 0x10ffff); }
  fill_scalars(&input); mpz_set_si(input.cases.all.natural,-1); INVALID(variants_echo_scalars(&input,&out,&error));
  fill_scalars(&input); input.cases.all.unit=1; INVALID(variants_echo_scalars(&input,&out,&error));
  const char* invalid[]={"\xff","\xc0\x80","\xed\xa0\x80"}; const size_t lengths[]={1,2,3};
  for (unsigned i=0;i<3;++i) { fill_scalars(&input); input.cases.all.text=(variants_string){invalid[i],lengths[i],NULL,NULL}; INVALID(variants_echo_scalars(&input,&out,&error)); }
  fill_scalars(&input); CALL(variants_echo_scalars(&input,&input,&error)); CALL(variants_inspect(&input,&accepted,&error)); CHECK(accepted);
  SELECT(scalars,input,VARIANTS_SCALARS_KIND_ABSENT); CALL(variants_echo_scalars(&input,&out,&error)); same_scalars(&input,&out);
  CALL(variants_inspect(&input,&accepted,&error)); CHECK(!accepted); variants_scalars_clear(&input); variants_scalars_clear(&out); variants_scalars_clear(&out);
}
static void same_nested(const variants_nested* a, const variants_nested* b) {
  CHECK(a->kind == b->kind);
  if (a->kind == VARIANTS_NESTED_KIND_EMPTY) return;
  if (a->kind == VARIANTS_NESTED_KIND_OUTCOME) {
    CHECK(a->cases.outcome.value.is_ok == b->cases.outcome.value.is_ok);
    if (a->cases.outcome.value.is_ok) { same_signal(&a->cases.outcome.value.ok.fst,&b->cases.outcome.value.ok.fst); CHECK(a->cases.outcome.value.ok.snd.kind == b->cases.outcome.value.ok.snd.kind); }
    else same_string(a->cases.outcome.value.error,b->cases.outcome.value.error);
    return;
  }
  CHECK(a->kind == VARIANTS_NESTED_KIND_PACKET);
  const variants_packet *x=&a->cases.packet.value,*y=&b->cases.packet.value;
  same_signal(&x->current,&y->current); CHECK(x->events.length == y->events.length);
  for (size_t i=0;i<x->events.length;++i) same_signal(&x->events.data[i],&y->events.data[i]);
  CHECK(x->fallback.has_value == y->fallback.has_value); if (x->fallback.has_value) same_signal(&x->fallback.value,&y->fallback.value);
  CHECK(x->modes.length == y->modes.length); for (size_t i=0;i<x->modes.length;++i) CHECK(x->modes.data[i].kind == y->modes.data[i].kind);
}
static void shapes(void) {
  variants_signal events[4],out; variants_signal_init(&out);
  const uint32_t tags[]={VARIANTS_SIGNAL_KIND_IDLE,VARIANTS_SIGNAL_KIND_STOPPED,VARIANTS_SIGNAL_KIND_DATA,VARIANTS_SIGNAL_KIND_MARKER};
  const uint32_t mode_tags[]={VARIANTS_MODE_KIND_FIRST,VARIANTS_MODE_KIND_SECOND,VARIANTS_MODE_KIND_THIRD};
  for (unsigned i=0;i<4;++i) { variants_signal_init(&events[i]); SELECT(signal,events[i],tags[i]); }
  events[2].cases.data.count=UINT32_MAX; events[2].cases.data.label=(variants_string){text,6,NULL,NULL};
  variants_mode modes[3],mode_out; variants_mode_init(&mode_out);
  for (unsigned i=0;i<3;++i) { variants_mode_init(&modes[i]); SELECT(mode,modes[i],mode_tags[i]); }
  variants_nested input,nested_out; variants_nested_init(&input); variants_nested_init(&nested_out);
  variants_anonymous anonymous,anonymous_out; variants_anonymous_init(&anonymous); variants_anonymous_init(&anonymous_out);
  variants_one one,one_out; variants_one_init(&one); variants_one_init(&one_out); one.cases.only.value=UINT32_MAX;
  variants_list_lean_variants_signal_span rows[3]={{events,4,NULL,NULL},{0},{events,4,NULL,NULL}};
  variants_array_list_lean_variants_signal_span matrix={rows,3,NULL,NULL},reversed; variants_array_list_lean_variants_signal_span_init(&reversed);
  for (unsigned round=0;round<128;++round) {
    for (unsigned i=0;i<4;++i) { CALL(variants_echo(&events[i],&out,&error)); same_signal(&events[i],&out); }
    for (unsigned i=0;i<3;++i) { CALL(variants_echo_mode(&modes[i],&mode_out,&error)); CHECK(mode_out.kind == mode_tags[i]); }
    SELECT(nested,input,VARIANTS_NESTED_KIND_PACKET);
    input.cases.packet.value.current=events[2]; input.cases.packet.value.events=(variants_list_lean_variants_signal_span){events,4,NULL,NULL};
    input.cases.packet.value.fallback.has_value=1; input.cases.packet.value.fallback.value=events[1]; input.cases.packet.value.modes=(variants_array_lean_variants_mode_span){modes,3,NULL,NULL};
    CALL(variants_echo_nested(&input,&nested_out,&error)); same_nested(&input,&nested_out);
    SELECT(nested,input,VARIANTS_NESTED_KIND_EMPTY); CALL(variants_echo_nested(&input,&nested_out,&error)); same_nested(&input,&nested_out);
    SELECT(nested,input,VARIANTS_NESTED_KIND_PACKET); CALL(variants_echo_nested(&input,&nested_out,&error)); same_nested(&input,&nested_out);
    SELECT(nested,input,VARIANTS_NESTED_KIND_OUTCOME); input.cases.outcome.value.is_ok=1;
    input.cases.outcome.value.ok.fst=events[round%4]; input.cases.outcome.value.ok.snd=modes[round%3];
    CALL(variants_echo_nested(&input,&nested_out,&error)); same_nested(&input,&nested_out);
    SELECT(nested,input,VARIANTS_NESTED_KIND_OUTCOME); input.cases.outcome.value.error=(variants_string){"error\0!",7,NULL,NULL};
    CALL(variants_echo_nested(&input,&nested_out,&error)); same_nested(&input,&nested_out);
    CALL(variants_signals(&matrix,&reversed,&error)); CHECK(reversed.length == 3 && reversed.data[1].length == 0);
    for (unsigned i=0;i<4;++i) { same_signal(&reversed.data[0].data[i],&events[3-i]); same_signal(&reversed.data[2].data[i],&events[3-i]); }
    CALL(variants_echo_one(&one,&one_out,&error)); CHECK(one_out.kind == VARIANTS_ONE_KIND_ONLY && one_out.cases.only.value == 0);
    SELECT(anonymous,anonymous,VARIANTS_ANONYMOUS_KIND_NUMBER); anonymous.cases.number.arg0=37;
    CALL(variants_echo_anonymous(&anonymous,&anonymous_out,&error)); CHECK(anonymous_out.kind == VARIANTS_ANONYMOUS_KIND_NUMBER && anonymous_out.cases.number.arg0 == 37);
    SELECT(anonymous,anonymous,VARIANTS_ANONYMOUS_KIND_PAIR); anonymous.cases.pair.arg0=19; anonymous.cases.pair.arg1=(variants_string){text,6,NULL,NULL};
    CALL(variants_echo_anonymous(&anonymous,&anonymous_out,&error)); CHECK(anonymous_out.kind == VARIANTS_ANONYMOUS_KIND_PAIR && anonymous_out.cases.pair.arg0 == 19); same_string(anonymous.cases.pair.arg1,anonymous_out.cases.pair.arg1);
    SELECT(anonymous,anonymous,VARIANTS_ANONYMOUS_KIND_COLLISION); anonymous.cases.collision.arg1=42; anonymous.cases.collision.arg1_=(variants_string){"collision",9,NULL,NULL};
    CALL(variants_echo_anonymous(&anonymous,&anonymous_out,&error)); CHECK(anonymous_out.kind == VARIANTS_ANONYMOUS_KIND_COLLISION && anonymous_out.cases.collision.arg1 == 42); same_string(anonymous.cases.collision.arg1_,anonymous_out.cases.collision.arg1_);
  }
  CALL(variants_next(&events[0],&out,&error)); CHECK(out.kind == VARIANTS_SIGNAL_KIND_STOPPED);
  CALL(variants_next(&events[1],&out,&error)); CHECK(out.kind == VARIANTS_SIGNAL_KIND_MARKER);
  CALL(variants_next(&events[3],&out,&error)); CHECK(out.kind == VARIANTS_SIGNAL_KIND_DATA && out.cases.data.count == 42); same_string(out.cases.data.label,(variants_string){"ready",5,NULL,NULL});
  CALL(variants_next(&events[2],&out,&error)); CHECK(out.cases.data.count == 0 && out.cases.data.label.length == 7);
  uint32_t code=0; const uint32_t codes[]={7,13,5,29};
  for (unsigned i=0;i<4;++i) { CALL(variants_code(&events[i],&code,&error)); CHECK(code == codes[i]); }
  CALL(variants_make(0,&out,&error)); CHECK(out.kind == VARIANTS_SIGNAL_KIND_IDLE);
  CALL(variants_make(7,&out,&error)); CHECK(out.cases.data.count == 7); same_string(out.cases.data.label,(variants_string){"made",4,NULL,NULL});
  variants_signal wrong; memset(&wrong,0xff,sizeof(wrong)); wrong.kind=VARIANTS_SIGNAL_KIND_IDLE;
  CALL(variants_echo(&wrong,&out,&error)); CHECK(out.kind == VARIANTS_SIGNAL_KIND_IDLE);
  wrong.kind=UINT32_MAX; INVALID(variants_echo(&wrong,&out,&error)); CHECK(out.kind == VARIANTS_SIGNAL_KIND_IDLE);
  CHECK(variants_signal_select(&out,UINT32_MAX) == VARIANTS_STATUS_INVALID_ARGUMENT); CHECK(out.kind == VARIANTS_SIGNAL_KIND_IDLE);
  variants_signal_clear(&wrong); variants_signal_clear(&out); variants_mode_clear(&mode_out);
  variants_nested_clear(&input); variants_nested_clear(&nested_out); variants_anonymous_clear(&anonymous); variants_anonymous_clear(&anonymous_out);
  variants_one_clear(&one); variants_one_clear(&one_out); variants_array_list_lean_variants_signal_span_clear(&reversed);
  for (unsigned i=0;i<4;++i) variants_signal_clear(&events[i]);
  for (unsigned i=0;i<3;++i) variants_mode_clear(&modes[i]);
}
static void ownership(void) {
  variants_buffers input,out; variants_buffers_init(&input); variants_buffers_init(&out);
  CALL(variants_echo_buffers(&input,&out,&error)); CHECK(out.kind == VARIANTS_BUFFERS_KIND_EMPTY);
  SELECT(buffers,input,VARIANTS_BUFFERS_KIND_PAIR); input.cases.pair.first=(variants_bytes){bytes,3,NULL,NULL};
  CALL(variants_echo_buffers(&input,&out,&error)); CHECK(out.kind == VARIANTS_BUFFERS_KIND_PAIR); same_bytes(input.cases.pair.first,out.cases.pair.first); CHECK(!out.cases.pair.second.length);
  uint8_t* owned=malloc(3); CHECK(owned); memcpy(owned,bytes,3); variants_bytes buffer={owned,3,owned,free};
  CALL(variants_duplicate(&buffer,&out,&error)); variants_bytes_clear(&buffer);
  same_bytes(out.cases.pair.first,(variants_bytes){bytes,3,NULL,NULL}); same_bytes(out.cases.pair.second,out.cases.pair.first);
  CHECK(out.cases.pair.first.data != out.cases.pair.second.data); ((uint8_t*)out.cases.pair.first.data)[0]=17; CHECK(out.cases.pair.second.data[0] == 0);
  variants_buffers_clear(&out); mpz_t size; mpz_init_set_ui(size,17u*1024u*1024u);
  INVALID(variants_produce(size,&out,&error)); CHECK(out.kind == VARIANTS_BUFFERS_KIND_EMPTY);
  mpz_set_ui(size,30000); CALL(variants_produce(size,&out,&error)); CHECK(out.cases.pair.first.length == 30000 && out.cases.pair.second.length == 1);
  for (size_t i=0;i<30000;++i) CHECK(out.cases.pair.first.data[i] == 17);
  const uint8_t* previous=out.cases.pair.first.data;
  variants_bytes oversized={bytes,17u*1024u*1024u,NULL,NULL}; INVALID(variants_duplicate(&oversized,&out,&error)); CHECK(out.cases.pair.first.data == previous);
  buffer=(variants_bytes){0}; CALL(variants_duplicate(&buffer,&out,&error)); CHECK(out.cases.pair.first.length == 0 && out.cases.pair.second.length == 0);
  variants_buffers_clear(&input); variants_buffers_clear(&out); variants_buffers_clear(&out); mpz_clear(size);
}
int main(void) {
  primitives(); shapes(); ownership();
  FILE* maps=fopen("/proc/self/maps","r"); CHECK(maps); char* line=NULL; size_t capacity=0,count=0; char libraries[8][4096];
  while (getline(&line,&capacity,maps)>=0) {
    char* path=strchr(line,'/'); if (!path) continue; path[strcspn(path,"\n")]=0;
    if (!strstr(path,"libvariants") && !strstr(path,"libcomponent_") && !strstr(path,"liblean_") && !strstr(path,"libleanshared.so") && !strstr(path,"libgmp.so.10")) continue;
    size_t i=0; for (;i<count;++i) if (!strcmp(libraries[i],path)) break;
    if (i == count) { CHECK(count<8 && strlen(path)<sizeof(libraries[0])); strcpy(libraries[count++],path); }
  }
  free(line); CHECK(!fclose(maps)); CHECK(count == 6);
  printf("c-variant-ok:%zu:%zu:%zu\n",checks,calls,rejected);
  for (size_t i=0;i<count;++i) printf("library:%s\n",libraries[i]);
}
