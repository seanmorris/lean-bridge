#define _POSIX_C_SOURCE 200809L
#include "collections.h"
#include <assert.h>
#include <math.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

static size_t checks,calls,rejected;
static collections_error error;
#define CHECK(x) do { ++checks; assert((x)); } while (0)
#define CALL(x) do { ++calls; CHECK((x)==COLLECTIONS_STATUS_OK); } while (0)
#define INVALID(x) do { ++calls; CHECK((x)==COLLECTIONS_STATUS_INVALID_ARGUMENT); ++rejected; } while (0)
static int same_number(double a,double b) { return (isnan(a)&&isnan(b)) || (a==b && (a!=0 || !!signbit(a)==!!signbit(b))); }
static const uint8_t bytes[]={0,255,1},other_bytes[]={255,0,128},seed_bytes[]={255,0,1};
static void fill_primitives(collections_primitives* p) {
  p->unit=0; p->flag=true; p->u8=UINT8_MAX; p->u16=UINT16_MAX; p->u32=UINT32_MAX; p->u64=UINT64_MAX;
  p->i8=INT8_MIN; p->i16=INT16_MIN; p->i32=INT32_MIN; p->i64=INT64_MIN;
  mpz_set_ui(p->natural,0); mpz_setbit(p->natural,200); mpz_neg(p->integer,p->natural);
  p->f32=-0.0f; p->f64=3.25; p->text=(collections_string){"🌱\0",5,NULL,NULL};
  p->bytes=(collections_bytes){seed_bytes,3,NULL,NULL}; p->char_=0x1f331; p->usize=UINT64_MAX; p->isize=INT32_MIN;
}
static void same_string(collections_string a,collections_string b) {
  CHECK(a.length==b.length); CHECK(!a.length || !memcmp(a.data,b.data,a.length));
}
static void same_primitives(const collections_primitives* a,const collections_primitives* b) {
  CHECK(a->unit==b->unit && a->flag==b->flag);
  CHECK(a->u8==b->u8 && a->u16==b->u16 && a->u32==b->u32 && a->u64==b->u64);
  CHECK(a->i8==b->i8 && a->i16==b->i16 && a->i32==b->i32 && a->i64==b->i64);
  CHECK(!mpz_cmp(a->natural,b->natural)); CHECK(!mpz_cmp(a->integer,b->integer));
  CHECK(same_number(a->f32,b->f32) && same_number(a->f64,b->f64));
  same_string(a->text,b->text);
  CHECK(a->bytes.length==b->bytes.length); CHECK(!a->bytes.length || !memcmp(a->bytes.data,b->bytes.data,a->bytes.length));
  CHECK(a->char_==b->char_ && a->usize==b->usize && a->isize==b->isize);
}
static void arrays(void) {
  /* array cases */
  collections_primitives p; collections_primitives_init(&p); fill_primitives(&p);
  /* independent Lean element checks */
  collections_primitives_clear(&p);
  collections_array_array_string_span words; collections_array_array_string_span_init(&words);
  CALL(collections_array_words(&words,&error)); CHECK(words.length==2 && words.data[0].length==2 && !words.data[1].length);
  same_string(words.data[0].data[0],(collections_string){"\xef\xbb\xbfLean",7,NULL,NULL});
  same_string(words.data[0].data[1],(collections_string){"🌱\0",5,NULL,NULL}); collections_array_array_string_span_clear(&words);
  mpz_t big,numbers[3],sum; mpz_init(big); mpz_setbit(big,5120); mpz_add_ui(big,big,31); mpz_init(sum);
  for (unsigned i=0;i<3;++i) mpz_init(numbers[i]);
  mpz_set(numbers[0],big); mpz_neg(numbers[1],big);
  collections_array_int_span rows[]={{numbers,3,NULL,NULL},{NULL,0,NULL,NULL}};
  collections_array_array_int_span input={rows,2,NULL,NULL},out; collections_array_array_int_span_init(&out);
  CALL(collections_array_add(big,&input,&out,&error)); CHECK(out.length==2 && out.data[0].length==3 && !out.data[1].length);
  mpz_add(sum,big,big); CHECK(!mpz_cmp(out.data[0].data[0],sum) && !mpz_sgn(out.data[0].data[1]) && !mpz_cmp(out.data[0].data[2],big));
  collections_array_array_int_span_clear(&out);
  mpz_set_ui(numbers[1],17); mpz_set_ui(numbers[2],3);
  collections_array_nat_span naturals[]={ {numbers,3,NULL,NULL},{NULL,0,NULL,NULL} };
  collections_array_array_nat_span n={naturals,2,NULL,NULL};
  CALL(collections_array_total(&n,sum,&error)); mpz_add_ui(big,big,20); CHECK(!mpz_cmp(sum,big));
  for (unsigned i=0;i<3;++i) mpz_clear(numbers[i]);
  mpz_clear(sum); mpz_clear(big);
  uint8_t units[]={0,0,0}; collections_array_unit_span u={units,3,NULL,NULL}; uint64_t length=0;
  CALL(collections_array_size(&u,&length,&error)); CHECK(length==3);
  units[1]=1; INVALID(collections_array_size(&u,&length,&error)); units[1]=0;
  u.length=0; CALL(collections_array_size(&u,&length,&error)); CHECK(length==0);
  uint32_t chars[]={65,0xd800,90}; collections_array_char_span c={chars,3,NULL,NULL};
  collections_array_array_char_span matrix={&c,1,NULL,NULL},copied; collections_array_array_char_span_init(&copied);
  const uint32_t bad_chars[]={0xd800,0xdfff,0x110000};
  for (unsigned i=0;i<3;++i) { chars[1]=bad_chars[i]; INVALID(collections_array_reverse_char(&matrix,&copied,&error)); CHECK(!copied.length); }
  chars[1]=0x1f331; CALL(collections_array_reverse_char(&matrix,&copied,&error)); CHECK(copied.data[0].data[1]==0x1f331); collections_array_array_char_span_clear(&copied);
  const char* bad_texts[]={"\xff","\xc0\x80","\xed\xa0\x80"}; const size_t bad_lengths[]={1,2,3};
  collections_string texts[]={{"valid",5,NULL,NULL},{NULL,0,NULL,NULL},{"later",5,NULL,NULL}};
  collections_array_string_span text_row={texts,3,NULL,NULL}; collections_array_array_string_span text_matrix={&text_row,1,NULL,NULL};
  for (unsigned i=0;i<3;++i) { texts[1]=(collections_string){bad_texts[i],bad_lengths[i],NULL,NULL}; INVALID(collections_array_reverse_string(&text_matrix,&words,&error)); CHECK(!words.length); }
  texts[1]=(collections_string){NULL,1,NULL,NULL}; INVALID(collections_array_reverse_string(&text_matrix,&words,&error));
  texts[1]=(collections_string){"ok",2,NULL,NULL}; CALL(collections_array_reverse_string(&text_matrix,&words,&error)); collections_array_array_string_span_clear(&words);
}
static void records(void) {
  collections_primitives p; collections_primitives_init(&p); fill_primitives(&p);
  bool accepted=false; CALL(collections_record_inspect(&p,&accepted,&error)); CHECK(accepted);
  for (unsigned field=0;field<18;++field) {
    fill_primitives(&p);
    switch (field) {
      case 0: p.flag=false; break; case 1: p.u8=0; break; case 2: p.u16=0; break;
      case 3: p.u32=0; break; case 4: p.u64=0; break; case 5: p.i8=0; break; case 6: p.i16=0; break;
      case 7: p.i32=0; break; case 8: p.i64=0; break; case 9: mpz_set_ui(p.natural,0); break;
      case 10: mpz_set_ui(p.integer,0); break; case 11: p.f32=0; break; case 12: p.f64=0; break;
      case 13: p.text.length=0; break; case 14: p.bytes.length=0; break; case 15: p.char_=65; break;
      case 16: p.usize=0; break; case 17: p.isize=0; break;
    }
    CALL(collections_record_inspect(&p,&accepted,&error)); CHECK(!accepted);
  }
  fill_primitives(&p);
  collections_primitives values[2];
  for (unsigned i=0;i<2;++i) { collections_primitives_init(&values[i]); fill_primitives(&values[i]); }
  collections_array_lean_records_primitives_span rows[]={{values,2,NULL,NULL},{NULL,0,NULL,NULL},{&p,1,NULL,NULL}};
  collections_packet input,out; collections_packet_init(&input); collections_packet_init(&out);
  input.label=(collections_string){"start",5,NULL,NULL}; input.values=(collections_array_array_lean_records_primitives_span){rows,3,NULL,NULL};
  input.single.value=UINT64_MAX; mpz_setbit(input.count.value,5120);
  input.pair.first=17; input.pair.second=(collections_string){"pair",4,NULL,NULL};
  input.reversed.first=23; input.reversed.second=(collections_string){"reversed",8,NULL,NULL};
  for (unsigned round=0;round<128;++round) {
    CALL(collections_record_shuffle(&input,&out,&error));
    same_string(out.label,(collections_string){"start!",6,NULL,NULL});
    CHECK(out.values.length==3 && out.values.data[0].length==1 && !out.values.data[1].length && out.values.data[2].length==2);
    for (size_t row=0;row<3;++row) for (size_t i=0;i<out.values.data[row].length;++i) same_primitives(&p,&out.values.data[row].data[i]);
    CHECK(out.single.value==0 && mpz_tstbit(out.count.value,5120) && mpz_get_ui(out.count.value)==7);
    CHECK(out.pair.first==18 && out.reversed.first==25);
    same_string(out.pair.second,(collections_string){"pairp",5,NULL,NULL}); same_string(out.reversed.second,(collections_string){"reversedr",9,NULL,NULL});
    collections_primitives* changed=(collections_primitives*)out.values.data[0].data;
    ((uint8_t*)changed->bytes.data)[0]=13; mpz_add_ui(changed->natural,changed->natural,1);
    CHECK(p.bytes.data[0]==255 && out.values.data[2].data[0].bytes.data[0]==255);
    CHECK(mpz_cmp(changed->natural,p.natural)!=0); same_primitives(&p,&out.values.data[2].data[1]);
    collections_packet_clear(&out); collections_packet_clear(&out);
  }
  collections_array_lean_records_packet_span siblings; collections_array_lean_records_packet_span_init(&siblings);
  CALL(collections_record_duplicate(&input,&siblings,&error)); CHECK(siblings.length==2);
  collections_packet* changed=(collections_packet*)siblings.data;
  ((uint8_t*)changed[0].values.data[0].data[0].bytes.data)[0]=7; mpz_add_ui(changed[0].count.value,changed[0].count.value,1);
  CHECK(changed[1].values.data[0].data[0].bytes.data[0]==255); CHECK(!mpz_cmp(changed[1].count.value,input.count.value));
  collections_array_lean_records_packet_span_clear(&siblings);
  collections_array_lean_records_primitives_span reversed; collections_array_lean_records_primitives_span_init(&reversed);
  CALL(collections_record_reverse(&rows[0],&reversed,&error)); CHECK(reversed.length==2); same_primitives(&p,&reversed.data[0]); collections_array_lean_records_primitives_span_clear(&reversed);
  p.char_=0xd800; INVALID(collections_record_reverse(&rows[2],&reversed,&error)); CHECK(!reversed.length); p.char_=0x1f331;
  mpz_set_si(p.natural,-1); INVALID(collections_record_inspect(&p,&accepted,&error)); fill_primitives(&p);
  p.unit=1; INVALID(collections_record_inspect(&p,&accepted,&error)); p.unit=0;
  p.text=(collections_string){"\xff",1,NULL,NULL}; INVALID(collections_record_inspect(&p,&accepted,&error)); fill_primitives(&p);
  CALL(collections_record_inspect(&p,&accepted,&error)); CHECK(accepted);
  collections_empty empty,empty_out; collections_empty_init(&empty); collections_empty_init(&empty_out);
  CALL(collections_record_empty(&empty,&empty_out,&error)); collections_empty_clear(&empty); collections_empty_clear(&empty_out);
  collections_single single,single_out; collections_single_init(&single); collections_single_init(&single_out); single.value=UINT64_MAX;
  CALL(collections_record_single(&single,&single_out,&error)); CHECK(single_out.value==0);
  CALL(collections_record_count(&input.count,&input.count,&error)); CHECK(mpz_tstbit(input.count.value,5120) && mpz_get_ui(input.count.value)==1);
  collections_pair made; collections_pair_init(&made); CALL(collections_record_make(&made,&error)); CHECK(made.first==42);
  same_string(made.second,(collections_string){"\xef\xbb\xbf🌱\0",8,NULL,NULL}); collections_pair_clear(&made);
  input.values.length=0; CALL(collections_record_duplicate(&input,&siblings,&error)); CHECK(siblings.length==2 && !siblings.data[0].values.length); collections_array_lean_records_packet_span_clear(&siblings);
  collections_packet_clear(&input); collections_packet_clear(&out); collections_primitives_clear(&p);
  for (unsigned i=0;i<2;++i) collections_primitives_clear(&values[i]);
}
static void deep(void) {
  /* deep cases */
}
static void ownership(void) {
  uint8_t* owned=malloc(3); CHECK(owned); memcpy(owned,bytes,3);
  collections_bytes source[]={{owned,3,owned,free},{NULL,0,NULL,NULL}};
  collections_array_bytes_span input={source,2,NULL,NULL},out; collections_array_bytes_span_init(&out);
  CALL(collections_array_duplicate(&input,&out,&error)); collections_bytes_clear(&source[0]);
  CHECK(out.length==4 && out.data[0].length==3 && !out.data[1].length && !out.data[3].length);
  CHECK(out.data[0].data!=out.data[2].data); ((uint8_t*)out.data[0].data)[0]=13; CHECK(out.data[2].data[0]==0);
  collections_array_bytes_span_clear(&out);
  uint8_t* large=calloc(6u*1024u*1024u,1); CHECK(large); source[0]=(collections_bytes){large,6u*1024u*1024u,NULL,NULL}; input.length=1;
  INVALID(collections_array_duplicate(&input,&out,&error)); CHECK(!out.length); free(large);
  mpz_t size; mpz_init_set_ui(size,17u*1024u*1024u);
  collections_array_unit_span generated; collections_array_unit_span_init(&generated);
  INVALID(collections_generate(size,&generated,&error)); CHECK(!generated.length);
  mpz_set_ui(size,30000); CALL(collections_generate(size,&generated,&error)); CHECK(generated.length==30000);
  for (size_t i=0;i<generated.length;++i) CHECK(generated.data[i]==0);
  collections_array_unit_span_clear(&generated); mpz_clear(size);
}
int main(void) {
  _Static_assert(sizeof(size_t)==8,"64-bit profile"); arrays(); records(); deep(); ownership();
  FILE* maps=fopen("/proc/self/maps","r"); CHECK(maps); char* line=NULL; size_t capacity=0,count=0; char libraries[8][4096];
  while (getline(&line,&capacity,maps)>=0) {
    char* path=strchr(line,'/'); if (!path) continue; path[strcspn(path,"\n")]=0;
    if (!strstr(path,"libcollections") && !strstr(path,"libcomponent_") && !strstr(path,"liblean_") && !strstr(path,"libleanshared.so") && !strstr(path,"libgmp.so.10")) continue;
    size_t i=0; for (;i<count;++i) if (!strcmp(libraries[i],path)) break;
    if (i==count) { CHECK(count<8 && strlen(path)<sizeof(libraries[0])); strcpy(libraries[count++],path); }
  }
  free(line); CHECK(!fclose(maps)); CHECK(count==6);
  printf("collection-ok:%zu:%zu:%zu:0\n",checks,calls,rejected);
  for (size_t i=0;i<count;++i) printf("library:%s\n",libraries[i]);
}
