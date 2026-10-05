#include "collections.h"
#include <assert.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

static int remaining=-1,live;
static size_t checks,failures,rejected,malformed;
int probe_bad_char;
#define CHECK(x) do { ++checks; assert((x)); } while (0)
#define CALL(x) CHECK((x)==COLLECTIONS_STATUS_OK)
static int allowed(void) { if (!remaining) return 0; if (remaining>0) --remaining; return 1; }
void* probe_malloc(size_t n) { if (!allowed()) return NULL; void* p=malloc(n); if(p)++live; return p; }
void* probe_calloc(size_t n,size_t w) { if (!allowed()) return NULL; void* p=calloc(n,w); if(p)++live; return p; }
void* probe_realloc(void* old,size_t n) { if (!allowed()) return NULL; int fresh=!old; void* p=realloc(old,n); if(fresh&&p)++live; return p; }
void probe_free(void* p) { if(p) { --live; free(p); } }
#define FAULTS(type,expression,good) do { \
  for(unsigned round=0;round<16;++round) { \
    int succeeded=0; \
    for(int limit=0;limit<1024;++limit) { \
      type out,before; memset(&out,0xa5,sizeof(out)); memcpy(&before,&out,sizeof(out)); \
      remaining=limit; collections_status status=(expression); remaining=-1; \
      if(status==COLLECTIONS_STATUS_OK) { \
        CHECK(good); type##_clear(&out); type##_clear(&out); CHECK(live==0); succeeded=1; break; \
      } \
      CHECK(status==COLLECTIONS_STATUS_UNEXPECTED_ERROR); CHECK(live==0); \
      CHECK(!memcmp(&out,&before,sizeof(out))); ++failures; \
    } \
    CHECK(succeeded); \
  } \
} while(0)
#define REJECT(type,expression) do { \
  type out,before; memset(&out,0x5a,sizeof(out)); memcpy(&before,&out,sizeof(out)); \
  CHECK((expression)==COLLECTIONS_STATUS_INVALID_ARGUMENT); \
  CHECK(!memcmp(&out,&before,sizeof(out))); CHECK(live==0); ++rejected; \
} while(0)
static collections_error error;

int main(int argc,char** argv) {
  if(argc==2&&!strcmp(argv[1],"--startup-only"))return 0;
  uint32_t limbs[161]={0}; limbs[6]=256;
  const uint8_t bytes[]={255,0,1};
  collections_primitives p={
    .flag=true,.u8=UINT8_MAX,.u16=UINT16_MAX,.u32=UINT32_MAX,.u64=UINT64_MAX,
    .i8=INT8_MIN,.i16=INT16_MIN,.i32=INT32_MIN,.i64=INT64_MIN,
    .natural={limbs,7,NULL,NULL},.integer={limbs,7,NULL,NULL,true},
    .f32=-0.0f,.f64=3.25,.text={"🌱\0",5,NULL,NULL},.bytes={bytes,3,NULL,NULL},
    .char_=0x1f331,.usize=UINT64_MAX,.isize=INT32_MIN
  };
  for(unsigned i=0;i<(argc==2&&!strcmp(argv[1],"--warmup-many")?1000u:1u);++i) {
    bool accepted=false; CALL(collections_record_inspect(&p,&accepted,&error)); CHECK(accepted);
    { /* independent Lean element checks */ }
    CHECK(live==0);
  }
  if(argc==2&&(!strcmp(argv[1],"--warmup")||!strcmp(argv[1],"--warmup-many")))return 0;
  collections_primitives values[]={p,p,p};
  collections_array_lean_records_primitives_span rows[]={{values,3,NULL,NULL},{NULL,0,NULL,NULL},{values,1,NULL,NULL}};
  uint32_t huge[161]={0}; huge[160]=1;
  collections_packet packet={
    .label={"packet",6,NULL,NULL},.values={rows,3,NULL,NULL},.single={UINT64_MAX},
    .count={{huge,161,NULL,NULL}},.pair={17,{"pair",4,NULL,NULL}},.reversed={{"reverse",7,NULL,NULL},23}
  };
  FAULTS(collections_packet,collections_record_shuffle(&packet,&out,&error),
    out.values.length==3&&out.values.data[0].length==1&&out.values.data[2].length==3&&out.label.length==7);
  FAULTS(collections_array_lean_records_packet_span,collections_record_duplicate(&packet,&out,&error),
    out.length==2&&out.data[0].values.data[0].data[0].bytes.data!=out.data[1].values.data[0].data[0].bytes.data);
  collections_string strings[]={{"A\0🌱",6,NULL,NULL},{"\xef\xbb\xbf",3,NULL,NULL},{"",0,NULL,NULL}};
  collections_array_string_span text_rows[]={{strings,3,NULL,NULL},{NULL,0,NULL,NULL},{strings,1,NULL,NULL}};
  collections_array_array_string_span text_matrix={text_rows,3,NULL,NULL};
  FAULTS(collections_array_array_string_span,collections_array_reverse_string(&text_matrix,&out,&error),
    out.length==3&&out.data[2].data[2].length==6);
  collections_nat naturals[]={{limbs,7,NULL,NULL},{huge,161,NULL,NULL},{NULL,0,NULL,NULL}};
  collections_array_nat_span nat_rows[]={{naturals,3,NULL,NULL},{naturals,1,NULL,NULL}};
  collections_array_array_nat_span nat_matrix={nat_rows,2,NULL,NULL};
  FAULTS(collections_array_array_nat_span,collections_array_reverse_nat(&nat_matrix,&out,&error),
    out.length==2&&out.data[1].data[1].length==161&&out.data[1].data[1].data[160]==1);
  collections_int integers[]={{huge,161,NULL,NULL,true},{limbs,7,NULL,NULL,false}};
  collections_array_int_span int_rows[]={{integers,2,NULL,NULL},{NULL,0,NULL,NULL}};
  collections_array_array_int_span int_matrix={int_rows,2,NULL,NULL};
  FAULTS(collections_array_array_int_span,collections_array_reverse_int(&int_matrix,&out,&error),
    out.length==2&&!out.data[0].length&&out.data[1].data[1].negative);
  collections_bytes buffers[]={{bytes,3,NULL,NULL},{NULL,0,NULL,NULL}};
  collections_array_bytes_span buffer_row={buffers,2,NULL,NULL};
  FAULTS(collections_array_bytes_span,collections_array_duplicate(&buffer_row,&out,&error),
    out.length==4&&out.data[0].data!=out.data[2].data);
  /* deep faults */
  for(unsigned field=0;field<11;++field) {
    collections_primitives wrong=p;
    switch(field) {
      case 0: wrong.unit=1; break; case 1: wrong.char_=0xd800; break;
      case 2: wrong.char_=0xdfff; break; case 3: wrong.char_=0x110000; break;
      case 4: wrong.text.data=NULL; break; case 5: wrong.text.length=SIZE_MAX; break;
      case 6: wrong.text=(collections_string){"\xff",1,NULL,NULL}; break;
      case 7: wrong.natural.data=NULL; break; case 8: wrong.integer.length=SIZE_MAX; break;
      case 9: wrong.bytes.data=NULL; break; case 10: wrong.bytes.length=SIZE_MAX; break;
    }
    values[1]=wrong;
    REJECT(collections_packet,collections_record_shuffle(&packet,&out,&error));
    values[1]=p;
  }
  rows[2].data=NULL; REJECT(collections_packet,collections_record_shuffle(&packet,&out,&error)); rows[2].data=values;
  rows[2].length=SIZE_MAX; REJECT(collections_packet,collections_record_shuffle(&packet,&out,&error)); rows[2].length=1;
  for(unsigned round=0;round<16;++round) {
    collections_array_lean_records_packet_span out,before; memset(&out,0xa5,sizeof(out)); memcpy(&before,&out,sizeof(out));
    probe_bad_char=1;
    CHECK(collections_record_duplicate(&packet,&out,&error)==COLLECTIONS_STATUS_UNEXPECTED_ERROR);
    CHECK(live==0&&!memcmp(&out,&before,sizeof(out))); ++malformed; probe_bad_char=0;
    CHECK(collections_record_duplicate(&packet,&out,&error)==COLLECTIONS_STATUS_OK);
    CHECK(out.length==2); collections_array_lean_records_packet_span_clear(&out); CHECK(live==0);
  }
  uint8_t* large=calloc(6u*1024u*1024u,1); CHECK(large);
  buffers[0]=(collections_bytes){large,6u*1024u*1024u,NULL,NULL}; buffer_row.length=1;
  REJECT(collections_array_bytes_span,collections_array_duplicate(&buffer_row,&out,&error)); free(large);
  uint32_t size=17u*1024u*1024u; collections_nat length={&size,1,NULL,NULL};
  REJECT(collections_array_unit_span,collections_generate(&length,&out,&error));
  size=30000; collections_array_unit_span generated={0};
  CHECK(collections_generate(&length,&generated,&error)==COLLECTIONS_STATUS_OK); CHECK(generated.length==30000);
  collections_array_unit_span_clear(&generated); CHECK(live==0);
  printf("collection-fault-ok:%zu:%zu:%zu:%zu\n",checks,failures,rejected,malformed);
}
