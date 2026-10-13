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
  native_refused("first",wrapped(100,2),"arg0.payload was rejected by NominalSubtypes.plusOne");
  native_refused("second",wrapped(90,2),"arg0.payload was rejected by NominalSubtypes.plusTwo");
  native_refused_two("combine",wrapped(100,2),wrapped(40,2),"arg0.payload was rejected by NominalSubtypes.plusOne");
  native_refused_two("combine",wrapped(40,2),wrapped(90,2),"arg1.payload was rejected by NominalSubtypes.plusTwo");
  native_refused("nested",boxes(wrapped(100,2),wrapped(40,2)),"arg0.left.payload was rejected by NominalSubtypes.plusOne");
  native_refused("nested",boxes(wrapped(40,2),wrapped(90,2)),"arg0.right.payload was rejected by NominalSubtypes.plusTwo");
  native_refused("first",envelope(huge(false),2),"arg0.payload was rejected by NominalSubtypes.plusOne");
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
        snprintf(message,sizeof(message),"arg0.choices.values[%d]?.%s was rejected by NominalSubtypes.%s",
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
    snprintf(message,sizeof(message),"arg0[%u]?.payload was rejected by NominalSubtypes.plusOne",position);
    native_refused("echo-groups",invalid_group(position,100,2),message);
    snprintf(message,sizeof(message),"arg0.left[%u]?.payload was rejected by NominalSubtypes.plusOne",position);
    native_refused("inspect-alias-pair",boxes(invalid_group(position,100,2),input_group(true,0)),message);
    snprintf(message,sizeof(message),"arg0.right[%u]?.payload was rejected by NominalSubtypes.plusTwo",position);
    native_refused("inspect-alias-pair",boxes(input_group(false,0),invalid_group(position,90,2)),message);
  }
  /* Every Fin bound is checked before any selected Subtype constructor. */
  native_refused_two("combine",wrapped(100,2),wrapped(40,3),"arg1.digit is not below its Fin 3 bound");
  native_refused("nested",boxes(wrapped(100,2),wrapped(40,3)),"arg0.right.digit is not below its Fin 3 bound");
  native_refused_two("aliases",group(wrapped(100,2)),group(wrapped(40,3)),"arg1[1]?.digit is not below its Fin 3 bound");
  native_refused("echo-event",event_box(wrapped(100,3)),"arg0.box.value.digit is not below its Fin 3 bound");
  expect("plain-fin",small(2),small(2));
  native_refused("plain-fin",small(3),"arg0 is not below its Fin 3 bound");
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
    snprintf(message,sizeof(message),"arg0.right[%u]?.payload was rejected by NominalSubtypes.plusTwo",position);
    native_refused("echo-pair",boxes(input_group(false,0),invalid_group(position,90,2)),message);
    expect("echo-pair",boxes(input_group(false,0),input_group(true,0)),boxes(input_group(false,1),input_group(true,1)));
  }
}
