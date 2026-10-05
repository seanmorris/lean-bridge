static int remaining=-1,live;
static size_t failures,releases;
static int allowed(void) { if (!remaining) return 0; if (remaining>0) --remaining; return 1; }
void* probe_malloc(size_t n) { if (!allowed()) return NULL; void* p=malloc(n); if(p)++live; return p; }
void* probe_calloc(size_t n,size_t w) { if (!allowed()) return NULL; void* p=calloc(n,w); if(p)++live; return p; }
void probe_free(void* p) { if(p) { --live; free(p); } }
static void release_old(void* p) { ++releases; free(p); }
static void warm_constants(void) {
  collections_primitives p; collections_primitives_init(&p); fill_primitives(&p);
  bool accepted=false; CALL(collections_record_inspect(&p,&accepted,&error)); CHECK(accepted);
  { /* independent Lean element checks */ }
  collections_primitives_clear(&p); CHECK(live==0);
}
static void faults(void) {
  collections_primitives values[3];
  for(unsigned i=0;i<3;++i) { collections_primitives_init(&values[i]); fill_primitives(&values[i]); }
  collections_array_lean_records_primitives_span rows[]={{values,3,NULL,NULL},{NULL,0,NULL,NULL},{values,1,NULL,NULL}};
  collections_packet input,out; collections_packet_init(&input); collections_packet_init(&out);
  input.label=(collections_string){"packet",6,NULL,NULL}; input.values=(collections_array_array_lean_records_primitives_span){rows,3,NULL,NULL};
  mpz_setbit(input.count.value,5120);
  for(unsigned round=0;round<16;++round) {
    char* held=malloc(4); CHECK(held); memcpy(held,"held",4); out.label=(collections_string){held,4,held,release_old};
    mpz_set_ui(out.count.value,19); size_t previous=releases; int succeeded=0;
    for(int limit=0;limit<1024;++limit) {
      remaining=limit; collections_status status=collections_record_shuffle(&input,&out,&error); remaining=-1;
      if(status==COLLECTIONS_STATUS_OK) {
        CHECK(releases==previous+1&&out.label.length==7&&out.values.length==3);
        CHECK(mpz_tstbit(out.count.value,5120)&&mpz_get_ui(out.count.value)==7);
        collections_packet_clear(&out); collections_packet_clear(&out); CHECK(live==0);
        collections_packet_init(&out); succeeded=1; break;
      }
      CHECK(status==COLLECTIONS_STATUS_UNEXPECTED_ERROR&&live==0); ++failures;
      CHECK(out.label.data==held&&out.label.length==4&&releases==previous);
      CHECK(!mpz_cmp_ui(out.count.value,19));
    }
    CHECK(succeeded);
  }
  collections_array_lean_records_packet_span copies; collections_array_lean_records_packet_span_init(&copies);
  for(unsigned round=0;round<16;++round) {
    int succeeded=0;
    for(int limit=0;limit<2048;++limit) {
      remaining=limit; collections_status status=collections_record_duplicate(&input,&copies,&error); remaining=-1;
      if(status==COLLECTIONS_STATUS_OK) {
        CHECK(copies.length==2&&copies.data[0].values.data[0].data[0].bytes.data!=copies.data[1].values.data[0].data[0].bytes.data);
        collections_array_lean_records_packet_span_clear(&copies); CHECK(live==0); succeeded=1; break;
      }
      CHECK(status==COLLECTIONS_STATUS_UNEXPECTED_ERROR&&live==0&&!copies.length); ++failures;
    }
    CHECK(succeeded);
  }
  for(unsigned field=0;field<5;++field) {
    fill_primitives(&values[1]);
    switch(field) {
      case 0: values[1].unit=1; break; case 1: values[1].char_=0xd800; break;
      case 2: mpz_set_si(values[1].natural,-1); break;
      case 3: values[1].text.data=NULL; break; case 4: values[1].bytes.length=SIZE_MAX; break;
    }
    INVALID(collections_record_duplicate(&input,&copies,&error)); CHECK(live==0&&!copies.length);
  }
  fill_primitives(&values[1]); CALL(collections_record_duplicate(&input,&copies,&error));
  collections_array_lean_records_packet_span_clear(&copies); CHECK(live==0);
  collections_packet_clear(&out); collections_packet_clear(&input);
  for(unsigned i=0;i<3;++i) collections_primitives_clear(&values[i]);
}
