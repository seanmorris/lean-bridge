/* Source-only stand-in for testing the result caller, never a Component Model run. */
#include "nominalsubtypes_wasmtime.h"
#include "wit-values.h"

struct nominalsubtypes_wasmtime { unsigned calls; };
static bool fault(const char *name) {
  const char *selected=getenv("NOMINAL_WIT_FAULT"); return selected && !strcmp(selected,name);
}
static bool natural(const value *v) {
  if (v->kind!=WASMTIME_COMPONENT_LIST) return false;
  for (size_t i=0;i<v->of.list.size;++i) if (v->of.list.data[i].kind!=WASMTIME_COMPONENT_U32) return false;
  return !v->of.list.size || v->of.list.data[v->of.list.size-1].of.u32!=0;
}
static value add(const value *v,unsigned amount) {
  size_t count=v->of.list.size;
  uint32_t *words=calloc(count+1,sizeof(*words)); if (!words) abort();
  uint64_t carry=amount;
  for (size_t i=0;i<count;++i) {
    uint64_t total=(uint64_t)v->of.list.data[i].of.u32+carry;
    words[i]=(uint32_t)total; carry=total>>32;
  }
  if (carry) words[count++]=(uint32_t)carry;
  if (fault("truncate-large") && count>1) count=words[0]?1:0;
  value out=nat(words,count); free(words); return out;
}
static value produced(const value *v,unsigned amount) {
  return envelope(add(v,amount),fault("wrong-digit")?1:2);
}
static value produced_group(const value *v,unsigned amount) {
  return group(produced(v,amount));
}
static value produced_pair(const value *v) {
  return boxes(produced_group(v,fault("swapped-pair")?2:1),produced_group(v,fault("swapped-pair")?1:2));
}
#ifndef NOMINAL_RESULT_ONLY
#include "nominal-subtype-wit-input-model.h"
#endif
wasmtime_error_t *nominalsubtypes_wasmtime_open(nominalsubtypes_wasmtime **out) {
  (void)wide; (void)word; (void)byte; (void)nominal_snapshot_controls; (void)exact_cause;
  if (!out) return wasmtime_error_new("no output");
  *out=calloc(1,sizeof(**out)); return *out?NULL:wasmtime_error_new("allocation");
}
void nominalsubtypes_wasmtime_close(nominalsubtypes_wasmtime *state) { free(state); }
wasmtime_error_t *nominalsubtypes_wasmtime_call(nominalsubtypes_wasmtime *state,const char *name,
    const value *args,size_t count,value *out) {
  const char *invalid="Unknown export, invalid WIT input or 16 MiB conversion limit";
  if (!state || !name || !args || !out)
    return wasmtime_error_new(invalid);
#ifndef NOMINAL_RESULT_ONLY
  if (known_input(name)) return model_input(name,args,count,out);
#endif
  if (count!=1 || !natural(args))
    return wasmtime_error_new(fault("wrong-host-diagnostic")?"Unexpected input":invalid);
  const value *input=&args[0]; value result={0};
  unsigned one=fault("wrong-plus-one")?2:1;
  unsigned two=fault("wrong-plus-two")?3:2;
  if (!strcmp(name,"scalar")) result=add(input,one);
  else if (!strcmp(name,"produce-envelope")) result=produced(input,one);
  else if (!strcmp(name,"array-values") || !strcmp(name,"list-values")) {
    result=list(2); result.of.list.data[0]=add(input,one); result.of.list.data[1]=add(input,two);
    if (fault("short-sequence")) { clear(&result.of.list.data[1]); result.of.list.size=1; }
  } else if (!strcmp(name,"optional")) result=input->of.list.size?some(add(input,one)):
      fault("present-zero-option")?some(small(1)):none();
  else if (!strcmp(name,"product")) result=pair(add(input,fault("swapped-product")?two:one),add(input,fault("swapped-product")?one:two));
  else if (!strcmp(name,"branch")) result=branch((input->of.list.size!=0)!=fault("swapped-result"),add(input,one));
  else if (!strcmp(name,"group-values")) result=produced_group(input,one);
  else if (!strcmp(name,"pair-values")) result=produced_pair(input);
  else if (!strcmp(name,"event-value")) result=fault("empty-box")?event_empty():event_box(produced(input,one));
  else if (!strcmp(name,"event-empty")) result=fault("nonempty-empty")?event_box(produced(input,one)):event_empty();
  else if (!strcmp(name,"event-choices")) {
    value values=list(3); values.of.list.data[0]=none();
    values.of.list.data[1]=some(branch(true,add(input,one)));
    values.of.list.data[2]=some(branch(fault("wrong-error-arm"),add(input,two)));
    result=event_choices(values);
  } else if (!strcmp(name,"no-items")) {
    result=list(fault("nonempty-list")?1:0);
    if (result.of.list.size) result.of.list.data[0]=add(input,one);
  } else return wasmtime_error_new(invalid);
  if (fault("changed-field-name") && result.kind==WASMTIME_COMPONENT_RECORD)
    result.of.record.data[0].name.data[0]='X';
  if (fault("input-mutation") && input->of.list.size)
    ++((value *)input)->of.list.data[0].of.u32;
  ++state->calls; *out=result; return NULL;
}
