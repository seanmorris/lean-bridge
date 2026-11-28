/* Check application member signatures against the instantiated component.
 * Looking up a name alone says nothing about the types behind it. None of
 * these checks calls guest code or accepts a numeric resource rep as a type. */
#ifndef LB_WIT_APPLICATION_MEMBER_TYPES_H
#define LB_WIT_APPLICATION_MEMBER_TYPES_H
#include "application-object-store.h"

enum { LWIT_VOID=128, LWIT_UNIT, LWIT_BYTES, LWIT_NAT, LWIT_INT };
typedef struct {unsigned kind; const wasmtime_component_resource_type_t *resource;} lwit_shape;
typedef struct {const char *name; lwit_shape shape;} lwit_param;
typedef wasmtime_component_valtype_t lwit_type;

static inline bool lwit_named(const char *value,size_t length,const char *expected) {
    return value && strlen(expected)==length && !memcmp(value,expected,length);
}
static inline bool lwit_list_of(const lwit_type *t,unsigned element) {
    if(t->kind!=WASMTIME_COMPONENT_VALTYPE_LIST)return false;
    lwit_type item;wasmtime_component_list_type_element(t->of.list,&item);
    bool ok=item.kind==element;wasmtime_component_valtype_delete(&item);return ok;
}
static inline bool lwit_matches(const lwit_type *t,lwit_shape shape) {
    const char *name=NULL;size_t len=0;
    switch(shape.kind){
    case LWIT_VOID: return false;
    case LWIT_UNIT:
        return t->kind==WASMTIME_COMPONENT_VALTYPE_ENUM && wasmtime_component_enum_type_names_count(t->of.enum_)==1 &&
            wasmtime_component_enum_type_names_nth(t->of.enum_,0,&name,&len) && lwit_named(name,len,"unit");
    case LWIT_BYTES: return lwit_list_of(t,WASMTIME_COMPONENT_VALTYPE_U8);
    case LWIT_NAT: return lwit_list_of(t,WASMTIME_COMPONENT_VALTYPE_U32);
    case LWIT_INT:
        if(t->kind!=WASMTIME_COMPONENT_VALTYPE_RECORD || wasmtime_component_record_type_field_count(t->of.record)!=2)return false;
        for(unsigned i=0;i<2;i++){
            lwit_type field;
            if(!wasmtime_component_record_type_field_nth(t->of.record,i,&name,&len,&field))return false;
            bool ok=lwit_named(name,len,i?"limbs":"negative") &&
                (i?lwit_list_of(&field,WASMTIME_COMPONENT_VALTYPE_U32):field.kind==WASMTIME_COMPONENT_VALTYPE_BOOL);
            wasmtime_component_valtype_delete(&field);if(!ok)return false;
        }
        return true;
    case WASMTIME_COMPONENT_VALTYPE_OWN: case WASMTIME_COMPONENT_VALTYPE_BORROW:
        return t->kind==shape.kind && shape.resource && wasmtime_component_resource_type_equal(
            t->kind==WASMTIME_COMPONENT_VALTYPE_OWN?t->of.own:t->of.borrow,shape.resource);
    default: return t->kind==shape.kind;
    }
}
/* Discover the failure resource from its typed receiver. Every declared err
 * arm must subsequently refer to this very type and must own its payload. */
static inline bool lwit_error_bind(lwit_store *s,const wasmtime_component_export_index_t *scope,
    const char *member,wasmtime_component_resource_type_t **out,wasmtime_component_func_t *message) {
    if(!out || *out || !lwit_lookup(s,scope,member,message))return false;
    wasmtime_component_func_type_t *ft=wasmtime_component_func_type(message,s->ctx);
    lwit_type t;const char *name=NULL;size_t n=0;bool ok=false;
    if(wasmtime_component_func_type_param_count(ft)==1 && wasmtime_component_func_type_param_nth(ft,0,&name,&n,&t)){
        if(lwit_named(name,n,"self") && t.kind==WASMTIME_COMPONENT_VALTYPE_BORROW)
            *out=wasmtime_component_resource_type_clone(t.of.borrow);
        wasmtime_component_valtype_delete(&t);
        if(*out && wasmtime_component_func_type_result(ft,&t)){
            ok=t.kind==WASMTIME_COMPONENT_VALTYPE_STRING;wasmtime_component_valtype_delete(&t);
        }
    }
    if(!ok && *out){wasmtime_component_resource_type_delete(*out);*out=NULL;}
    wasmtime_component_func_type_delete(ft);return ok;
}
static inline bool lwit_result_matches(const lwit_type *t,lwit_shape result,const wasmtime_component_resource_type_t *error) {
    if(!error)return lwit_matches(t,result);
    if(t->kind!=WASMTIME_COMPONENT_VALTYPE_RESULT)return false;
    lwit_type part;
    bool present=wasmtime_component_result_type_ok(t->of.result,&part);
    bool ok=present==(result.kind!=LWIT_VOID);
    if(present){ok=ok && lwit_matches(&part,result);wasmtime_component_valtype_delete(&part);}
    if(!ok || !wasmtime_component_result_type_err(t->of.result,&part))return false;
    ok=lwit_matches(&part,(lwit_shape){WASMTIME_COMPONENT_VALTYPE_OWN,error});
    wasmtime_component_valtype_delete(&part);return ok;
}
static inline bool lwit_member_bind(lwit_store *s,const wasmtime_component_export_index_t *scope,
    const char *member,const lwit_param *params,size_t count,lwit_shape result,
    const wasmtime_component_resource_type_t *error,wasmtime_component_func_t *out) {
    wasmtime_component_func_t fn;if(!out || !lwit_lookup(s,scope,member,&fn))return false;
    wasmtime_component_func_type_t *ft=wasmtime_component_func_type(&fn,s->ctx);
    bool ok=wasmtime_component_func_type_param_count(ft)==count;
    for(size_t i=0;ok && i<count;i++){
        lwit_type t;const char *name=NULL;size_t n=0;
        ok=wasmtime_component_func_type_param_nth(ft,i,&name,&n,&t);
        if(ok){
            ok=lwit_named(name,n,params[i].name) && lwit_matches(&t,params[i].shape);
            wasmtime_component_valtype_delete(&t);
        }
    }
    if(ok){
        lwit_type t;bool present=wasmtime_component_func_type_result(ft,&t);
        ok=present==(error!=NULL || result.kind!=LWIT_VOID);
        if(present){ok=ok && lwit_result_matches(&t,result,error);wasmtime_component_valtype_delete(&t);}
    }
    wasmtime_component_func_type_delete(ft);if(ok)*out=fn;return ok;
}
#endif
