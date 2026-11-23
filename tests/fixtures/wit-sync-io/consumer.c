#include WIT_HEADER
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/wait.h>
#include <unistd.h>

#define JOIN_(a,b) a##b
#define JOIN(a,b) JOIN_(a,b)
#define API(n) JOIN(WIT_PREFIX,n)
typedef wasmtime_component_val_t V;
static API(_wasmtime) *s;
static unsigned checks;
#define CHECK(x) do { if (!(x)) { fprintf(stderr,"failed line %d: %s\n",__LINE__,#x); exit(1); } ++checks; } while(0)
static void good(wasmtime_error_t *e) {
    if (!e) return;
    wasm_name_t msg; wasmtime_error_message(e,&msg); fprintf(stderr,"%.*s\n",(int)msg.size,msg.data);
    wasm_name_delete(&msg); wasmtime_error_delete(e); exit(1);
}
static V call(const char *name,const V *args,size_t n) {
    V out={0}; good(API(_wasmtime_call)(s,name,args,n,&out)); return out;
}
static V *arm(V *v,bool ok) {
    CHECK(v->kind==WASMTIME_COMPONENT_RESULT && v->of.result.is_ok==ok && v->of.result.val);
    return v->of.result.val;
}
static V str(const char *p,size_t n) {
    V v={.kind=WASMTIME_COMPONENT_STRING}; wasm_name_new(&v.of.string,n,p); return v;
}
static void text(V *v,const char *p,size_t n) {
    CHECK(v->kind==WASMTIME_COMPONENT_STRING && v->of.string.size==n && !memcmp(v->of.string.data,p,n));
}
static V boolean(bool b) { return (V){.kind=WASMTIME_COMPONENT_BOOL,.of.boolean=b}; }
#ifdef WIDE
#include "scalars.h"
#endif
static bool contains(wasmtime_error_t *e,const char *needle) {
    if (!e) return false;
    wasm_name_t msg; wasmtime_error_message(e,&msg);
    char *s=calloc(msg.size+1,1); CHECK(s); memcpy(s,msg.data,msg.size); bool found=strstr(s,needle)!=NULL;
    free(s); wasm_name_delete(&msg); wasmtime_error_delete(e); return found;
}
int main(int argc,char **argv) {
    if (argc==2 && !strcmp(argv[1],"dependency")) {
        CHECK(contains(API(_wasmtime_open)(&s),"WIT package dependency conflict") && !s);
        puts("mismatched-loaded-dependency:rejected"); return 0;
    }
    good(API(_wasmtime_open)(&s));
    const char msg[]={'k','\0',(char)0xce,(char)0xb4};
    V arg[3]={boolean(false),boolean(false),str(msg,sizeof(msg))}, out, held={0};
#ifdef LEDGER
    V two={.kind=WASMTIME_COMPONENT_U64,.of.u64=2}; const char *inc="add", *read="read-total";
#else
    V two={.kind=WASMTIME_COMPONENT_U32,.of.u32=2}; const char *inc="bump", *read="count";
#endif
    out=call(read,NULL,0);
    CHECK(out.kind==two.kind && (two.kind==WASMTIME_COMPONENT_U32?!out.of.u32:!out.of.u64)); wasmtime_component_val_delete(&out);
    V wrong=boolean(true), untouched={.kind=WASMTIME_COMPONENT_U8,.of.u8=91};
    wasmtime_error_t *bad=API(_wasmtime_call)(s,inc,&wrong,1,&untouched);
    CHECK(bad && untouched.kind==WASMTIME_COMPONENT_U8 && untouched.of.u8==91); wasmtime_error_delete(bad);
    out=call(inc,&two,1);
#ifdef LEDGER
    V *v=arm(&out,true); CHECK(v->kind==two.kind && v->of.u64==2);
#else
    CHECK(out.kind==two.kind && out.of.u32==2);
#endif
    wasmtime_component_val_delete(&out);
    for (unsigned fail=0;fail<2;fail++) for (unsigned ok=0;ok<2;ok++) {
        arg[0]=boolean(fail); arg[1]=boolean(ok); out=call("choose",arg,3);
        V *leaf=arm(arm(&out,!fail),ok);
        if (ok) text(leaf,msg,sizeof(msg));
        else {
#ifdef LEDGER
            CHECK(leaf->kind==WASMTIME_COMPONENT_U32 && leaf->of.u32==4000000000u);
#else
            CHECK(leaf->kind==WASMTIME_COMPONENT_U32 && leaf->of.u32==37);
#endif
        }
        if (fail && ok) held=out; else wasmtime_component_val_delete(&out);
    }
#ifdef LEDGER
    out=call("io-failure",NULL,0);
    text(arm(&out,false),"ledger offline",14); wasmtime_component_val_delete(&out);
#else
    V file[2]={str("wit-io-sample",13),str(msg,sizeof(msg))};
    out=call("read",file,1);
    V *error=arm(&out,false); CHECK(error->kind==WASMTIME_COMPONENT_STRING && error->of.string.size); wasmtime_component_val_delete(&out);
    out=call("store",file,2); CHECK(arm(&out,true)->kind==WASMTIME_COMPONENT_ENUM); wasmtime_component_val_delete(&out);
    out=call("read",file,1); text(arm(&out,true),msg,sizeof(msg)); wasmtime_component_val_delete(&out);
    wasmtime_component_val_delete(&file[0]); wasmtime_component_val_delete(&file[1]);
#endif
#ifdef WIDE
    scalar_checks(msg,sizeof(msg));
#endif
    out=call(read,NULL,0);
    CHECK(out.kind==two.kind && (two.kind==WASMTIME_COMPONENT_U32?out.of.u32==2:out.of.u64==2));
    wasmtime_component_val_delete(&out); wasmtime_component_val_delete(&arg[2]);
    pid_t child=fork(); CHECK(child>=0);
    if (!child) {
        V unused={0}; bool failed=contains(API(_wasmtime_call)(s,read,NULL,0,&unused),"after fork");
        API(_wasmtime_close)(s); _exit(failed?0:7);
    }
    int status; CHECK(waitpid(child,&status,0)==child && WIFEXITED(status) && WEXITSTATUS(status)==0);
    API(_wasmtime_close)(s); text(arm(arm(&held,false),true),msg,sizeof(msg)); wasmtime_component_val_delete(&held);
    printf("wasmtime-io:%u\n",checks); return 0;
}
