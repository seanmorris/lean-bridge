#define NOMINAL_RESULT_ONLY
#include "nominalsubtypes_wasmtime.h"
#ifndef NOMINAL_SUBTYPE_WIT_VALUES_H
#define NOMINAL_SUBTYPE_WIT_VALUES_H
#include <wasmtime.h>
#include <stdbool.h>
#include <stdint.h>
#include <stdlib.h>
#include <string.h>
typedef wasmtime_component_val_t value;

/* Independent comparison of every active public payload, including NUL suffixes. */
static bool same(const value *a, const value *b) {
  if (a->kind != b->kind) return false;
  switch (a->kind) {
    case WASMTIME_COMPONENT_U8: return a->of.u8 == b->of.u8;
    case WASMTIME_COMPONENT_U32: return a->of.u32 == b->of.u32;
    case WASMTIME_COMPONENT_STRING:
      return a->of.string.size == b->of.string.size &&
        (!a->of.string.size || memcmp(a->of.string.data, b->of.string.data, a->of.string.size) == 0);
    case WASMTIME_COMPONENT_LIST:
      if (a->of.list.size != b->of.list.size) return false;
      for (size_t i = 0; i < a->of.list.size; ++i) if (!same(&a->of.list.data[i], &b->of.list.data[i])) return false;
      return true;
    case WASMTIME_COMPONENT_TUPLE:
      if (a->of.tuple.size != b->of.tuple.size) return false;
      for (size_t i = 0; i < a->of.tuple.size; ++i) if (!same(&a->of.tuple.data[i], &b->of.tuple.data[i])) return false;
      return true;
    case WASMTIME_COMPONENT_OPTION:
      if (!a->of.option || !b->of.option) return a->of.option == b->of.option;
      return same(a->of.option, b->of.option);
    case WASMTIME_COMPONENT_RESULT:
      if (a->of.result.is_ok != b->of.result.is_ok) return false;
      if (!a->of.result.val || !b->of.result.val) return a->of.result.val == b->of.result.val;
      return same(a->of.result.val, b->of.result.val);
    case WASMTIME_COMPONENT_RECORD:
      if (a->of.record.size != b->of.record.size) return false;
      for (size_t i = 0; i < a->of.record.size; ++i) {
        const wasmtime_component_valrecord_entry_t *x = &a->of.record.data[i], *y = &b->of.record.data[i];
        if (x->name.size != y->name.size || (x->name.size && memcmp(x->name.data, y->name.data, x->name.size))) return false;
        if (!same(&x->val, &y->val)) return false;
      }
      return true;
    case WASMTIME_COMPONENT_VARIANT:
      if (a->of.variant.discriminant.size != b->of.variant.discriminant.size) return false;
      if (a->of.variant.discriminant.size && memcmp(a->of.variant.discriminant.data, b->of.variant.discriminant.data, a->of.variant.discriminant.size)) return false;
      if (!a->of.variant.val || !b->of.variant.val) return a->of.variant.val == b->of.variant.val;
      return same(a->of.variant.val, b->of.variant.val);
    default: return false;
  }
}
static void clear(value *v) { wasmtime_component_val_delete(v); *v = (value){0}; }
static value clone(const value *v) { value copied = {0}; wasmtime_component_val_clone(v, &copied); return copied; }
static value list(size_t size) {
  value v = {.kind = WASMTIME_COMPONENT_LIST}; wasmtime_component_vallist_new_uninit(&v.of.list, size); return v;
}
static value nat(const uint32_t *limbs, size_t size) {
  value v = list(size);
  for (size_t i = 0; i < size; ++i) v.of.list.data[i] = (value){.kind = WASMTIME_COMPONENT_U32, .of.u32 = limbs[i]};
  return v;
}
static value small(uint32_t n) { return nat(&n, n ? 1 : 0); }
static value huge(bool increment) { const uint32_t limbs[] = {increment ? 1 : 0, 0, 0, 16}; return nat(limbs, 4); }
static value wide(bool below) { const uint32_t limbs[] = {below ? 9 : 10, 0, 10}; return nat(limbs, 3); }
static value text(const char *bytes, size_t size) {
  value v = {.kind = WASMTIME_COMPONENT_STRING}; wasm_name_new(&v.of.string, size, bytes); return v;
}
static value word(void) { static const char s[] = "h\xc3\xa9llo\0tail\xf0\x9f\x99\x82"; return text(s, sizeof(s) - 1); }
static value none(void) { return (value){.kind = WASMTIME_COMPONENT_OPTION, .of.option = NULL}; }
static value some(value payload) { return (value){.kind = WASMTIME_COMPONENT_OPTION, .of.option = wasmtime_component_val_new(&payload)}; }
static value pair(value first, value second) {
  value v = {.kind = WASMTIME_COMPONENT_TUPLE}; wasmtime_component_valtuple_new_uninit(&v.of.tuple, 2);
  v.of.tuple.data[0] = first; v.of.tuple.data[1] = second; return v;
}
static value branch(bool ok, value payload) {
  return (value){.kind = WASMTIME_COMPONENT_RESULT, .of.result = {.is_ok = ok, .val = wasmtime_component_val_new(&payload)}};
}
static value byte(uint8_t n) { return (value){.kind = WASMTIME_COMPONENT_U8, .of.u8 = n}; }

/* Accept a complete cause, not a substring of some unrelated Wasmtime failure. */
static bool exact_cause(const char *bytes, size_t size, const char *expected) {
  if (memchr(bytes, '\0', size)) return false;
  size_t length = strlen(expected);
  if (size == length && memcmp(bytes, expected, length) == 0) return true;
  static const char start[] = "error while executing at wasm backtrace:\n";
  static const char marker[] = "\n\nCaused by:\n    ";
  if (size < sizeof(start) - 1 + sizeof(marker) - 1 + length || memcmp(bytes, start, sizeof(start) - 1)) return false;
  /* Wasmtime's formatted error chain terminates in one newline. A bare cause
   * still requires byte-for-byte equality, and extra trailing data rejects. */
  if (bytes[size - 1] == '\n') --size;
  if (size < sizeof(start) - 1 + sizeof(marker) - 1 + length) return false;
  size_t end = size - length, at = end - (sizeof(marker) - 1);
  if (memcmp(bytes + at, marker, sizeof(marker) - 1) || memcmp(bytes + end, expected, length)) return false;
  /* A cause marker embedded in the backtrace would make the chain ambiguous. */
  for (size_t i = sizeof(start) - 1; i + sizeof(marker) - 1 <= at; ++i)
    if (memcmp(bytes + i, marker, sizeof(marker) - 1) == 0) return false;
  return true;
}

static value named_fields(size_t count, const char **names, value *fields) {
  value out = {.kind = WASMTIME_COMPONENT_RECORD};
  wasmtime_component_valrecord_new_uninit(&out.of.record, count);
  for (size_t i = 0; i < count; ++i) {
    wasm_name_new(&out.of.record.data[i].name, strlen(names[i]), names[i]);
    out.of.record.data[i].val = fields[i];
  }
  return out;
}
static value one_field(const char *name, value payload) {
  const char *names[] = {name}; return named_fields(1, names, &payload);
}
static value two_fields(const char *first, value left, const char *second, value right) {
  const char *names[] = {first, second}; value fields[] = {left, right}; return named_fields(2, names, fields);
}
static value envelope(value payload, uint32_t digit) { return two_fields("payload", payload, "digit", small(digit)); }
static value boxes(value left, value right) { return two_fields("left", left, "right", right); }
static value event(const char *name, value *payload) {
  value out = {.kind = WASMTIME_COMPONENT_VARIANT};
  wasm_name_new(&out.of.variant.discriminant, strlen(name), name);
  out.of.variant.val = payload ? wasmtime_component_val_new(payload) : NULL;
  return out;
}
static value event_empty(void) { return event("empty", NULL); }
static value event_box(value wrapped) { value payload=one_field("value",wrapped); return event("box", &payload); }
static value event_choices(value values) { value payload=one_field("values",values); return event("choices", &payload); }
static value group(value wrapped) {
  value out=list(2); out.of.list.data[0]=none(); out.of.list.data[1]=some(wrapped); return out;
}
static unsigned nominal_snapshot_controls(void) {
  value wrapped=envelope(huge(false),2), a=event_box(clone(&wrapped)), b=boxes(group(clone(&wrapped)),group(clone(&wrapped)));
  value saved_a=clone(&a), saved_b=clone(&b);
  if (!same(&a,&saved_a) || !same(&b,&saved_b)) abort();
  unsigned controls=0;
#define DIFFERENT() do { if (same(&a,&saved_a) && same(&b,&saved_b)) abort(); ++controls; } while(0)
  wasmtime_component_valrecord_entry_t *field=&a.of.variant.val->of.record.data[0];
  field->name.data[0]^=1; DIFFERENT(); field->name.data[0]^=1;
  --field->name.size; DIFFERENT(); ++field->name.size;
  value *record=&field->val, *natural=&record->of.record.data[0].val;
  record->of.record.data[0].name.data[0]^=1; DIFFERENT(); record->of.record.data[0].name.data[0]^=1;
  ++natural->of.list.data[0].of.u32; DIFFERENT(); --natural->of.list.data[0].of.u32;
  ++natural->of.list.data[3].of.u32; DIFFERENT(); --natural->of.list.data[3].of.u32;
  --natural->of.list.size; DIFFERENT(); ++natural->of.list.size;
  ++record->of.record.data[1].val.of.list.data[0].of.u32; DIFFERENT(); --record->of.record.data[1].val.of.list.data[0].of.u32;
  --record->of.record.size; DIFFERENT(); ++record->of.record.size;
  a.of.variant.discriminant.data[0]^=1; DIFFERENT(); a.of.variant.discriminant.data[0]^=1;
  --a.of.variant.discriminant.size; DIFFERENT(); ++a.of.variant.discriminant.size;
  value *kept=a.of.variant.val; a.of.variant.val=NULL; DIFFERENT(); a.of.variant.val=kept;
  wasmtime_component_valrecord_entry_t first=b.of.record.data[0];
  b.of.record.data[0]=b.of.record.data[1]; b.of.record.data[1]=first; DIFFERENT();
  first=b.of.record.data[0]; b.of.record.data[0]=b.of.record.data[1]; b.of.record.data[1]=first;
  value *left=&b.of.record.data[0].val, *right=&b.of.record.data[1].val;
  --left->of.list.size; DIFFERENT(); ++left->of.list.size;
  value option=right->of.list.data[1]; right->of.list.data[1]=none(); DIFFERENT(); right->of.list.data[1]=option;
  if (!same(&a,&saved_a) || !same(&b,&saved_b)) abort();
#undef DIFFERENT
  clear(&wrapped); clear(&a); clear(&b); clear(&saved_a); clear(&saved_b);
  value values=list(3); values.of.list.data[0]=none(); values.of.list.data[1]=some(branch(true,huge(false))); values.of.list.data[2]=some(branch(false,small(40)));
  a=event_choices(values); saved_a=clone(&a);
  value *case_values=&a.of.variant.val->of.record.data[0].val;
  case_values->of.list.data[1].of.option->of.result.is_ok=false;
  if (same(&a,&saved_a)) abort();
  ++controls;
  case_values->of.list.data[1].of.option->of.result.is_ok=true;
  clear(&a); clear(&saved_a);
  return controls;
}
#endif

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
/* Independent input corpus. Every call owns its carrier trees. */
static value wrapped(uint32_t n,uint32_t digit) { return envelope(small(n),digit); }
static value input_group(bool right,unsigned normalization) {
  value out=list(right?2:3);
  if (right) {
    out.of.list.data[0]=some(wrapped(2+2*normalization,1));
    out.of.list.data[1]=none();
  } else {
    out.of.list.data[0]=none();
    out.of.list.data[1]=some(wrapped(40+normalization,2));
    out.of.list.data[2]=some(wrapped(1+normalization,0));
  }
  return out;
}
static value invalid_group(unsigned position,uint32_t n,uint32_t digit) {
  value out=list(3);
  for (unsigned i=0;i<3;++i)
    out.of.list.data[i]=i==position?some(wrapped(n,digit)):
      i==1?none():some(wrapped(40,2));
  return out;
}
static value input_choices(unsigned normal_ok,unsigned normal_error,int bad,bool ok) {
  value out=list(3);
  out.of.list.data[0]=none();
  out.of.list.data[1]=some(branch(true,small(40+normal_ok)));
  out.of.list.data[2]=some(branch(false,small(40+normal_error)));
  if (bad>=0) { clear(&out.of.list.data[bad]); out.of.list.data[bad]=some(branch(ok,small(100))); }
  return event_choices(out);
}
static void expect_two(const char *name,value first,value second,value expected) {
  value args[]={first,second}; value out=success_many(name,args,2,expected); clear(&out);
}
static void native_refused(const char *name,value input,const char *cause) {
  refused_many(name,&input,1,cause,false);
}
static void native_refused_two(const char *name,value first,value second,const char *cause) {
  value args[]={first,second}; refused_many(name,args,2,cause,false);
}
static void full_inputs(void) {
  char message[256];
  expect("first",wrapped(40,2),small(41));
  expect("second",wrapped(40,2),small(42));
  expect_two("combine",wrapped(40,2),wrapped(40,2),small(4142));
  expect("nested",boxes(wrapped(40,2),wrapped(40,2)),small(4142));
  expect("first",wrapped(99,2),small(100));
  expect("second",wrapped(89,2),small(91));
  expect("first",wrapped(90,2),small(91));
  native_refused("first",wrapped(100,2),"value0.payload was rejected by NominalSubtypes.plusOne");
  native_refused("second",wrapped(90,2),"value0.payload was rejected by NominalSubtypes.plusTwo");
  native_refused_two("combine",wrapped(100,2),wrapped(40,2),"value0.payload was rejected by NominalSubtypes.plusOne");
  native_refused_two("combine",wrapped(40,2),wrapped(90,2),"value1.payload was rejected by NominalSubtypes.plusTwo");
  native_refused("nested",boxes(wrapped(100,2),wrapped(40,2)),"value0.left.payload was rejected by NominalSubtypes.plusOne");
  native_refused("nested",boxes(wrapped(40,2),wrapped(90,2)),"value0.right.payload was rejected by NominalSubtypes.plusTwo");
  native_refused("first",envelope(huge(false),2),"value0.payload was rejected by NominalSubtypes.plusOne");
  expect("echo",wrapped(40,2),wrapped(41,2));
  for (unsigned which=0;which<2;++which) {
    const char *name=which?"event-second":"event-first";
    expect(name,event_empty(),small(0));
    expect(name,event_box(wrapped(40,2)),small(41+which));
    expect(name,event_choices(list(0)),small(0));
    value absent=list(1); absent.of.list.data[0]=none(); expect(name,event_choices(absent),small(0));
    expect(name,input_choices(0,0,-1,true),small(83));
    for (unsigned arm=0;arm<2;++arm) {
      value only=list(1); only.of.list.data[0]=some(branch(arm==0,small(40)));
      expect(name,event_choices(only),small(40+(which==arm?1:2)));
      for (int position=0;position<3;++position) {
        snprintf(message,sizeof(message),"value0.choices.values[%d]?.%s was rejected by NominalSubtypes.%s",
          position,arm?"error":"ok",which==arm?"plusOne":"plusTwo");
        native_refused(name,input_choices(0,0,position,arm==0),message);
      }
    }
  }
  expect_two("aliases",input_group(false,0),input_group(true,0),small(47));
  expect("inspect-alias-pair",boxes(input_group(false,0),input_group(true,0)),small(47));
  expect("echo-groups",input_group(false,0),input_group(false,1));
  value projected=success("echo-pair",boxes(input_group(false,0),input_group(true,0)),boxes(input_group(false,1),input_group(true,1)));
  expect("echo-pair",projected,boxes(input_group(false,2),input_group(true,2)));
  expect("echo-event",input_choices(0,0,-1,true),input_choices(1,2,-1,true));
  expect("echo-event",event_empty(),event_empty());
  expect("echo-event",event_box(wrapped(40,2)),event_box(wrapped(41,2)));
  expect("echo-groups",list(0),list(0));
  value absent=list(1); absent.of.list.data[0]=none();
  expect("echo-pair",boxes(list(0),clone(&absent)),boxes(list(0),absent));
  for (unsigned position=0;position<3;++position) {
    snprintf(message,sizeof(message),"value0[%u]?.payload was rejected by NominalSubtypes.plusOne",position);
    native_refused("echo-groups",invalid_group(position,100,2),message);
    snprintf(message,sizeof(message),"value0.left[%u]?.payload was rejected by NominalSubtypes.plusOne",position);
    native_refused("inspect-alias-pair",boxes(invalid_group(position,100,2),input_group(true,0)),message);
    snprintf(message,sizeof(message),"value0.right[%u]?.payload was rejected by NominalSubtypes.plusTwo",position);
    native_refused("inspect-alias-pair",boxes(input_group(false,0),invalid_group(position,90,2)),message);
  }
  /* Every Fin bound is checked before any selected Subtype constructor. */
  native_refused_two("combine",wrapped(100,2),wrapped(40,3),"value1.digit is not below its Fin 3 bound");
  native_refused("nested",boxes(wrapped(100,2),wrapped(40,3)),"value0.right.digit is not below its Fin 3 bound");
  native_refused_two("aliases",group(wrapped(100,2)),group(wrapped(40,3)),"value1[1]?.digit is not below its Fin 3 bound");
  native_refused("echo-event",event_box(wrapped(100,3)),"value0.box.value.digit is not below its Fin 3 bound");
  expect("plain-fin",small(2),small(2));
  native_refused("plain-fin",small(3),"value0 is not below its Fin 3 bound");
  /* Wrong shapes have valid backing storage and remain safe to clone/delete. */
  host_refused("first",byte(1));
  host_refused("first",one_field("payload",small(40)));
  host_refused("first",two_fields("digit",small(2),"payload",small(40)));
  host_refused("first",two_fields("payload",byte(40),"digit",small(2)));
  value wrong=wrapped(40,2); wrong.of.record.data[0].name.data[0]='P'; host_refused("first",wrong);
  wrong=wrapped(40,2); wasm_name_delete(&wrong.of.record.data[0].name);
  wasm_name_new(&wrong.of.record.data[0].name,8,"payload\0"); host_refused("first",wrong);
  const uint32_t noncanonical[]={1,0}; host_refused("first",envelope(nat(noncanonical,2),2));
  host_refused("event-first",event("unknown",NULL));
  host_refused("event-first",event("box",NULL));
  value extra=wrapped(40,2); host_refused("event-first",event("empty",&extra));
  value malformed={.kind=WASMTIME_COMPONENT_RESULT,.of.result={.is_ok=true,.val=NULL}};
  wrong=list(1); wrong.of.list.data[0]=some(malformed); host_refused("event-first",event_choices(wrong));
  host_refused("echo-groups",group(byte(1)));
  host_refused("combine",wrapped(40,2));
  host_refused("missing-export",small(40));
  expect("first",wrapped(40,2),small(41));
  for (unsigned round=0;round<1000;++round) {
    unsigned position=round%3;
    snprintf(message,sizeof(message),"value0.right[%u]?.payload was rejected by NominalSubtypes.plusTwo",position);
    native_refused("echo-pair",boxes(input_group(false,0),invalid_group(position,90,2)),message);
    expect("echo-pair",boxes(input_group(false,0),input_group(true,0)),boxes(input_group(false,1),input_group(true,1)));
  }
}

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
