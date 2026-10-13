/* Independent nominal input semantics for source-only caller controls. */
#include <stdio.h>
static bool named(const wasm_name_t *name,const char *text) {
  return name->size==strlen(text) && !memcmp(name->data,text,name->size);
}
static bool fields(const value *v,const char *first,const char *second) {
  return v->kind==WASMTIME_COMPONENT_RECORD && v->of.record.size==(second?2u:1u)
    && named(&v->of.record.data[0].name,first)
    && (!second || named(&v->of.record.data[1].name,second));
}
static bool envelope_shape(const value *v) {
  return fields(v,"payload","digit") && natural(&v->of.record.data[0].val) && natural(&v->of.record.data[1].val);
}
static bool group_shape(const value *v) {
  if (v->kind!=WASMTIME_COMPONENT_LIST) return false;
  for (size_t i=0;i<v->of.list.size;++i) {
    const value *item=&v->of.list.data[i];
    if (item->kind!=WASMTIME_COMPONENT_OPTION || (item->of.option && !envelope_shape(item->of.option))) return false;
  }
  return true;
}
static bool pair_shape(const value *v,bool aliases) {
  return fields(v,"left","right") &&
    (aliases ? group_shape(&v->of.record.data[0].val) && group_shape(&v->of.record.data[1].val)
      : envelope_shape(&v->of.record.data[0].val) && envelope_shape(&v->of.record.data[1].val));
}
static bool event_shape(const value *v) {
  if (v->kind!=WASMTIME_COMPONENT_VARIANT) return false;
  if (named(&v->of.variant.discriminant,"empty")) return v->of.variant.val==NULL;
  if (!v->of.variant.val) return false;
  if (named(&v->of.variant.discriminant,"box"))
    return fields(v->of.variant.val,"value",NULL) && envelope_shape(&v->of.variant.val->of.record.data[0].val);
  if (!named(&v->of.variant.discriminant,"choices") || !fields(v->of.variant.val,"values",NULL)) return false;
  const value *list=&v->of.variant.val->of.record.data[0].val;
  if (list->kind!=WASMTIME_COMPONENT_LIST) return false;
  for (size_t i=0;i<list->of.list.size;++i) {
    const value *item=&list->of.list.data[i];
    if (item->kind!=WASMTIME_COMPONENT_OPTION) return false;
    if (item->of.option && (item->of.option->kind!=WASMTIME_COMPONENT_RESULT ||
        !item->of.option->of.result.val || !natural(item->of.option->of.result.val))) return false;
  }
  return true;
}
static unsigned magnitude(const value *v) {
  if (!natural(v) || v->of.list.size>1) abort();
  return v->of.list.size?v->of.list.data[0].of.u32:0;
}
static wasmtime_error_t *invalid_fin(const value *v,const char *path) {
  if (fault("missing-fin")) return NULL;
  if (v->of.list.size<=1 && magnitude(v)<3) return NULL;
  char message[512]; snprintf(message,sizeof(message),"%s is not below its Fin 3 bound",path);
  return wasmtime_error_new(message);
}
static wasmtime_error_t *all_fin(const value *v,const char *path) {
  char nested[512]; wasmtime_error_t *error;
  if (v->kind==WASMTIME_COMPONENT_RECORD) {
    for (size_t i=0;i<v->of.record.size;++i) {
      const wasmtime_component_valrecord_entry_t *field=&v->of.record.data[i];
      snprintf(nested,sizeof(nested),"%s.%.*s",path,(int)field->name.size,field->name.data);
      error=named(&field->name,"digit")?invalid_fin(&field->val,nested):all_fin(&field->val,nested);
      if (error) return error;
    }
  } else if (v->kind==WASMTIME_COMPONENT_LIST) {
    for (size_t i=0;i<v->of.list.size;++i) {
      snprintf(nested,sizeof(nested),"%s[%zu]",path,i);
      error=all_fin(&v->of.list.data[i],nested); if (error) return error;
    }
  } else if (v->kind==WASMTIME_COMPONENT_OPTION && v->of.option) {
    snprintf(nested,sizeof(nested),"%s?",path); return all_fin(v->of.option,nested);
  } else if (v->kind==WASMTIME_COMPONENT_VARIANT && v->of.variant.val) {
    snprintf(nested,sizeof(nested),"%s.%.*s",path,(int)v->of.variant.discriminant.size,v->of.variant.discriminant.data);
    return all_fin(v->of.variant.val,nested);
  }
  return NULL;
}
static wasmtime_error_t *normalize(value *v,unsigned amount,const char *path) {
  if (fault("conflated-constructor")) amount=1;
  unsigned limit=amount==1?100:90;
  if (v->of.list.size>1 || magnitude(v)>=limit) {
    char message[512]; snprintf(message,sizeof(message),"%s was rejected by NominalSubtypes.%s%s",
      fault("wrong-native-path")?"wrong":path,amount==1?"plusOne":"plusTwo",fault("diagnostic-suffix")?" extra":"");
    return wasmtime_error_new(message);
  }
  value result=add(v,fault("missing-normalization")?0:amount); clear(v); *v=result;
  return NULL;
}
static wasmtime_error_t *normalize_envelope(value *v,unsigned amount,const char *path) {
  char nested[512]; snprintf(nested,sizeof(nested),"%s.payload",path);
  return normalize(&v->of.record.data[0].val,amount,nested);
}
static wasmtime_error_t *normalize_group(value *v,unsigned amount,const char *path) {
  char nested[512];
  for (size_t i=0;i<v->of.list.size;++i) if (v->of.list.data[i].of.option) {
    snprintf(nested,sizeof(nested),"%s[%zu]?",path,i);
    wasmtime_error_t *error=normalize_envelope(v->of.list.data[i].of.option,amount,nested);
    if (error) return error;
  }
  return NULL;
}
static wasmtime_error_t *normalize_event(value *v,unsigned amount,const char *path) {
  char nested[512];
  if (named(&v->of.variant.discriminant,"empty")) return NULL;
  value *payload=&v->of.variant.val->of.record.data[0].val;
  if (named(&v->of.variant.discriminant,"box")) {
    snprintf(nested,sizeof(nested),"%s.box.value",path); return normalize_envelope(payload,amount,nested);
  }
  for (size_t i=0;i<payload->of.list.size;++i) {
    value *item=payload->of.list.data[i].of.option; if (!item) continue;
    snprintf(nested,sizeof(nested),"%s.choices.values[%zu]?.%s",path,i,item->of.result.is_ok?"ok":"error");
    unsigned selected=item->of.result.is_ok?amount:3-amount;
    wasmtime_error_t *error=normalize(item->of.result.val,fault("wrong-active-choice")?3-selected:selected,nested);
    if (error) return error;
  }
  return NULL;
}
static unsigned sum_group(const value *v) {
  unsigned sum=0;
  for (size_t i=0;i<v->of.list.size;++i)
    if (v->of.list.data[i].of.option) sum+=magnitude(&v->of.list.data[i].of.option->of.record.data[0].val);
  return sum;
}
static unsigned sum_event(const value *v) {
  if (!v->of.variant.val) return 0;
  const value *payload=&v->of.variant.val->of.record.data[0].val;
  if (named(&v->of.variant.discriminant,"box")) return magnitude(&payload->of.record.data[0].val);
  unsigned sum=0;
  for (size_t i=0;i<payload->of.list.size;++i)
    if (payload->of.list.data[i].of.option) sum+=magnitude(payload->of.list.data[i].of.option->of.result.val);
  return sum;
}
static bool known_input(const char *name) {
  const char *names[]={"first","second","combine","nested","event-first","event-second","echo","aliases","inspect-alias-pair","echo-groups","echo-pair","echo-event","plain-fin"};
  for (size_t i=0;i<sizeof(names)/sizeof(*names);++i) if (!strcmp(name,names[i])) return true;
  return false;
}
static wasmtime_error_t *model_input(const char *name,const value *args,size_t count,value *out) {
  const bool combined=!strcmp(name,"combine"),aliases=!strcmp(name,"aliases"),nested=!strcmp(name,"nested");
  const bool grouped=!strcmp(name,"echo-groups"),paired=!strcmp(name,"echo-pair")||!strcmp(name,"inspect-alias-pair");
  const bool event_api=!strcmp(name,"event-first")||!strcmp(name,"event-second")||!strcmp(name,"echo-event");
  const bool plain=!strcmp(name,"plain-fin");
  bool valid=count==(combined||aliases?2u:1u);
  for (size_t i=0;valid && i<count;++i)
    valid=plain?natural(&args[i]):event_api?event_shape(&args[i]):paired||nested?pair_shape(&args[i],paired):aliases||grouped?group_shape(&args[i]):envelope_shape(&args[i]);
  if (!valid) return wasmtime_error_new("Unknown export, invalid WIT input or 16 MiB conversion limit");
#ifdef NOMINAL_REVIEWED
  const char *paths[]={"value0","value1"};
#else
  const char *paths[]={"arg0","arg1"};
#endif
  value copies[2]={{0},{0}}; wasmtime_error_t *error=NULL;
  for (size_t i=0;i<count;++i) copies[i]=clone(&args[i]);
  if (!fault("fin-after-constructor")) for (size_t i=0;i<count;++i) {
    error=plain?invalid_fin(&copies[i],paths[i]):all_fin(&copies[i],paths[i]); if (error) goto finish;
  }
  if (plain) {}
  else if (event_api) error=normalize_event(&copies[0],!strcmp(name,"event-second")?2:1,paths[0]);
  else if (paired || nested) {
    char path[64];
    for (unsigned i=0;i<2;++i) {
      snprintf(path,sizeof(path),"%s.%s",paths[0],i?"right":"left");
      error=paired?normalize_group(&copies[0].of.record.data[i].val,i+1,path):normalize_envelope(&copies[0].of.record.data[i].val,i+1,path);
      if (error) break;
    }
  } else if (aliases || grouped) {
    for (size_t i=0;i<count;++i) { error=normalize_group(&copies[i],i+1,paths[i]); if (error) break; }
  } else {
    for (size_t i=0;i<count;++i) { error=normalize_envelope(&copies[i],!strcmp(name,"second")?2:i+1,paths[i]); if (error) break; }
  }
  if (error) goto finish;
  if (fault("fin-after-constructor")) for (size_t i=0;i<count;++i) {
    error=plain?invalid_fin(&copies[i],paths[i]):all_fin(&copies[i],paths[i]); if (error) goto finish;
  }
  if (plain || !strncmp(name,"echo",4)) *out=clone(&copies[0]);
  else if (aliases) *out=small(sum_group(&copies[0])+sum_group(&copies[1]));
  else if (paired) *out=small(sum_group(&copies[0].of.record.data[0].val)+sum_group(&copies[0].of.record.data[1].val));
  else if (event_api) *out=small(sum_event(&copies[0]));
  else if (combined) *out=small(100*magnitude(&copies[0].of.record.data[0].val)+magnitude(&copies[1].of.record.data[0].val));
  else if (nested) *out=small(100*magnitude(&copies[0].of.record.data[0].val.of.record.data[0].val)+magnitude(&copies[0].of.record.data[1].val.of.record.data[0].val));
  else *out=clone(&copies[0].of.record.data[0].val);
finish:
  for (size_t i=0;i<count;++i) clear(&copies[i]);
  return error;
}
