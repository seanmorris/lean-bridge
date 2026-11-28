#include "journal_wasmtime.h"
#include "lean_bridge_native_runtime.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
extern void wit_test_arm(int);
extern int wit_test_live(void),wit_test_released(void),wit_test_seen(void);
#define CHECK(x) do { if (!(x)) { fprintf(stderr,"failure line %d: %s\n",__LINE__,#x); exit(1); } } while(0)
static void report(wasmtime_error_t *e,const char *expected) {
    CHECK(e); wasm_name_t message; wasmtime_error_message(e,&message);
    char *text=calloc(message.size+1,1); CHECK(text); memcpy(text,message.data,message.size);
    if (!strstr(text,expected)) { fprintf(stderr,"expected '%s', got '%s'\n",expected,text); exit(1); }
    free(text); wasm_name_delete(&message); wasmtime_error_delete(e);
}
static void count(journal_wasmtime *s,bool ready) {
    wasmtime_component_val_t v={.kind=WASMTIME_COMPONENT_U8,.of.u8=79};
    wasmtime_error_t *e=journal_wasmtime_call(s,"count",NULL,0,&v);
    if (ready) { CHECK(!e && v.kind==WASMTIME_COMPONENT_U32 && !v.of.u32); wasmtime_component_val_delete(&v); }
    else { report(e,"Native bridge failure in Journal.count"); CHECK(v.kind==WASMTIME_COMPONENT_U8 && v.of.u8==79); }
}
int main(int argc,char **argv) {
    CHECK(argc==2); int m=atoi(argv[1]); CHECK(m>=1 && m<=6);
    journal_wasmtime *a=NULL,*b=NULL; CHECK(!journal_wasmtime_open(&a)); CHECK(!journal_wasmtime_open(&b));
    count(a,true); count(b,true); wit_test_arm(m);
    wasmtime_component_val_t byte={.kind=WASMTIME_COMPONENT_U8,.of.u8=66};
    wasmtime_component_val_t arg={.kind=WASMTIME_COMPONENT_LIST,.of.list={.size=1,.data=&byte}};
    const char *name="rt-bytes";
    if (m==5) { name="rt-string"; arg.kind=WASMTIME_COMPONENT_STRING; wasm_name_new(&arg.of.string,1,"x"); }
    if (m==6) { name="bump"; arg=(wasmtime_component_val_t){.kind=WASMTIME_COMPONENT_U32,.of.u32=2}; }
    wasmtime_component_val_t out={.kind=WASMTIME_COMPONENT_U8,.of.u8=37};
    wasmtime_error_t *e=journal_wasmtime_call(a,name,&arg,1,&out);
    report(e,m==2?"Native bridge failure":m==4?"conversion limit":m==6?"unreachable":"Malformed Lean reply");
    CHECK(out.kind==WASMTIME_COMPONENT_U8 && out.of.u8==37);
    if (m==5) wasmtime_component_val_delete(&arg);
    bool ready=(m==2 || m==4); count(b,ready); count(a,ready);
    lean_bridge_native_snapshot snap; lean_bridge_native_snapshot_read(&snap);
    CHECK(snap.runtime_state==(ready?2u:3u) && snap.runtime_init_runs==1 && snap.component_init_runs==1 && !snap.live_identities);
    CHECK(wit_test_seen()==1 && !wit_test_live() && wit_test_released()==(m==3 || m==4 || m==5));
    journal_wasmtime_close(b); journal_wasmtime_close(a);
    printf("fault:%d:%s:seen:1:live:0\n",m,ready?"ready":"retired");
}
