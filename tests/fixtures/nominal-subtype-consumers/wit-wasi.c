#include "nominalsubtypes_wasmtime.h"
#include "wit-values.h"
#include <stdio.h>

/* Public caller; NOMINAL_RESULT_ONLY selects the standalone output API. */
static nominalsubtypes_wasmtime *session;
static unsigned checks, host_rejections, rejections;
#define CHECK(condition) do { if (!(condition)) { fprintf(stderr,"nominal WIT check failed at %d: %s\n",__LINE__,#condition); exit(1); } ++checks; } while(0)

static value number(bool large, uint32_t offset) {
  if (!large) return small(offset);
  const uint32_t limbs[]={offset,0,0,16}; return nat(limbs,4);
}
static value result_group(bool large,uint32_t offset) { return group(envelope(number(large,offset+1),2)); }
static value result_pair(bool large,uint32_t offset) { return boxes(result_group(large,offset),result_group(large,offset+1)); }
static value two_values(value first,value second) {
  value out=list(2); out.of.list.data[0]=first; out.of.list.data[1]=second; return out;
}
static value result_choices(bool large,uint32_t offset) {
  value values=list(3); values.of.list.data[0]=none();
  values.of.list.data[1]=some(branch(true,number(large,offset+1)));
  values.of.list.data[2]=some(branch(false,number(large,offset+2)));
  return event_choices(values);
}
static void show_error(const char *name,wasmtime_error_t *error) {
  wasm_name_t message; wasmtime_error_message(error,&message);
  fprintf(stderr,"%s: %.*s\n",name,(int)message.size,message.data);
  wasm_name_delete(&message); wasmtime_error_delete(error);
}
static value success_many(const char *name,value *inputs,size_t count,value expected) {
  value before[2]={{0},{0}},out={0};
  if (count>2) abort();
  for (size_t i=0;i<count;++i) before[i]=clone(&inputs[i]);
  wasmtime_error_t *error=nominalsubtypes_wasmtime_call(session,name,inputs,count,&out);
  if (error) { show_error(name,error); exit(1); }
  CHECK(same(&out,&expected));
  for (size_t i=0;i<count;++i) { CHECK(same(&inputs[i],&before[i])); clear(&inputs[i]); clear(&before[i]); }
  CHECK(same(&out,&expected));
  clear(&expected); return out;
}
static value success(const char *name,value input,value expected) {
  return success_many(name,&input,1,expected);
}
static void expect(const char *name,value input,value expected) {
  value out=success(name,input,expected); clear(&out);
}
static void refused_many(const char *name,value *inputs,size_t count,const char *cause,bool host) {
  value before[2]={{0},{0}},out=small(777),sentinel=clone(&out);
  if (count>2) abort();
  for (size_t i=0;i<count;++i) before[i]=clone(&inputs[i]);
  wasmtime_error_t *error=nominalsubtypes_wasmtime_call(session,name,inputs,count,&out);
  CHECK(error!=NULL);
  wasm_name_t message; wasmtime_error_message(error,&message);
  bool exact=exact_cause(message.data,message.size,cause);
  if (!exact) fprintf(stderr,"%s: expected '%s', got '%.*s'\n",name,cause,(int)message.size,message.data);
  CHECK(exact); CHECK(same(&out,&sentinel));
  for (size_t i=0;i<count;++i) { CHECK(same(&inputs[i],&before[i])); clear(&inputs[i]); clear(&before[i]); }
  if (host) ++host_rejections; else ++rejections;
  wasm_name_delete(&message); wasmtime_error_delete(error);
  clear(&out); clear(&sentinel);
}
static void host_refused(const char *name,value input) {
  refused_many(name,&input,1,"Unknown export, invalid WIT input or 16 MiB conversion limit",true);
}
#ifndef NOMINAL_RESULT_ONLY
#include "wit-inputs.h"
#endif
int main(void) {
  (void)wide; (void)word;
  const unsigned snapshots=nominal_snapshot_controls(); CHECK(snapshots==15);
  wasmtime_error_t *error=nominalsubtypes_wasmtime_open(&session);
  if (error) { show_error("open",error); return 1; }
  CHECK(session!=NULL);
  for (unsigned sample=0;sample<3;++sample) {
    const bool large=sample==2; const uint32_t n=sample==1?40:0;
    expect("scalar",number(large,n),number(large,n+1));
    expect("produce-envelope",number(large,n),envelope(number(large,n+1),2));
    expect("array-values",number(large,n),two_values(number(large,n+1),number(large,n+2)));
    expect("list-values",number(large,n),two_values(number(large,n+1),number(large,n+2)));
    expect("optional",number(large,n),sample==0?none():some(number(large,n+1)));
    expect("product",number(large,n),pair(number(large,n+1),number(large,n+2)));
    expect("branch",number(large,n),branch(sample!=0,number(large,n+1)));
    expect("group-values",number(large,n),result_group(large,n));
    expect("pair-values",number(large,n),result_pair(large,n));
    expect("event-value",number(large,n),event_box(envelope(number(large,n+1),2)));
    expect("event-empty",number(large,n),event_empty());
    expect("event-choices",number(large,n),result_choices(large,n));
    expect("no-items",number(large,n),list(0));
  }
  host_refused("scalar",byte(1));
#ifdef NOMINAL_RESULT_ONLY
  host_refused("first",envelope(small(40),2));
#else
  full_inputs();
#endif
  expect("scalar",small(40),small(41));
  for (uint32_t round=0;round<1000;++round)
    expect("pair-values",number(true,round),result_pair(true,round));
  value kept=success("pair-values",number(true,0),result_pair(true,0));
  nominalsubtypes_wasmtime_close(session); session=NULL;
  value expected=result_pair(true,0); CHECK(same(&kept,&expected));
  clear(&kept); clear(&expected);
  printf("{\"checks\":%u,\"rejections\":%u,\"hostRejections\":%u,\"snapshotControls\":%u}\n",checks,rejections,host_rejections,snapshots);
  return 0;
}
