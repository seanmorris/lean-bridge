/* Only the original MRI main thread enters Ruby. Lean finalizers just free
 * invalidated C rows: no Ruby operation is legal on an arbitrary Lean worker. */
#include "host-domain.h"
#include <ruby/encoding.h>
#include <stdatomic.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <sys/syscall.h>

typedef struct lb_kind lb_kind;
typedef struct lb_value {
    struct lb_value *next;
    lb_kind *kind;
    lean_object *wrapper; /* registry reference; every Lean caller gets its own */
    VALUE object, anchors;
    int pinned;
} lb_value;
struct lb_kind {
    lb_kind *next;
    const char *id;
    VALUE klass;
    size_t users, provisional;
    int strong;
    lb_value *values;
};
struct lb_rh_session { VALUE fiber; size_t depth, count; lb_kind *kinds[]; };
struct lb_rh_fault { struct lb_rh_fault *next; VALUE original; lean_object *error; };
static lb_kind *kinds;
static lean_external_class *tag;
static size_t live;
static pid_t owner_pid;

static void finalize(void *row) { free(row); }
static void foreach(void *row, b_lean_obj_arg f) { (void)row; (void)f; }
void lb_rh_owner(void) {
    if ((owner_pid && owner_pid != getpid()) || getpid() != (pid_t)syscall(SYS_gettid) || rb_thread_current()!=rb_thread_main())
        rb_raise(rb_eRuntimeError,"Lean host imports require the original Ruby main thread");
}
static void bound(lb_rh_session *s) {
    lb_rh_owner();
    if (!s || s->fiber!=rb_fiber_current()) rb_raise(rb_eRuntimeError,"enter bind_hosts on this fiber first");
}
static void sweep(lb_kind *k,int all) {
    if (!all && k->strong && !k->provisional) return;
    lb_value **p=&k->values;
    while (*p) {
        lb_value *v=*p;
        if (!all && v->pinned) { p=&v->next; continue; }
        int rc=atomic_load_explicit(lean_get_rc_mt_addr(v->wrapper),memory_order_acquire);
        if (!all && rc!=1 && rc!=-1) { p=&v->next; continue; }
        if (k->strong && !v->pinned) --k->provisional;
        *p=v->next; v->kind=NULL; --live;
        rb_gc_unregister_address(&v->object); rb_gc_unregister_address(&v->anchors);
        v->object=Qnil; v->anchors=Qnil; lean_dec(v->wrapper);
    }
}
static void release_kinds(lb_rh_session *s) {
    while (s->count) {
        lb_kind *k=s->kinds[--s->count]; if (--k->users) continue;
        lb_kind **p=&kinds; while (*p!=k) p=&(*p)->next;
        *p=k->next; sweep(k,1); rb_gc_unregister_address(&k->klass); free(k);
    }
}
typedef struct { lb_rh_session *s; const lb_rh_spec *specs; size_t n; const VALUE *classes; } binding;
static VALUE add_kinds(VALUE data) {
    binding *b=(binding *)data;
    for (size_t i=0;i<b->n;i++) {
        if (!RB_TYPE_P(b->classes[i],T_CLASS)) rb_raise(rb_eTypeError,"bind_hosts requires a Ruby class");
        const lb_rh_spec spec=b->specs[i]; lb_kind *k=kinds;
        while (k && strcmp(k->id,spec.id)) k=k->next;
        if (k && (k->klass!=b->classes[i] || k->strong!=spec.strong))
            rb_raise(rb_eTypeError,"incompatible bindings for the same Lean host kind");
        if (!k) {
            k=calloc(1,sizeof(*k)); if (!k) rb_memerror();
            k->id=spec.id; k->strong=spec.strong; k->klass=b->classes[i];
            rb_gc_register_address(&k->klass); k->next=kinds; kinds=k;
        }
        ++k->users; b->s->kinds[b->s->count++]=k;
    }
    return Qnil;
}
lb_rh_session *lb_rh_bind(const lb_rh_spec *specs,size_t n,int argc,const VALUE *classes) {
    lb_rh_owner(); if (!n || n>64 || argc!=(int)n) rb_raise(rb_eArgError,"wrong number of bound classes");
    if (!tag) { tag=lean_register_external_class(finalize,foreach); owner_pid=getpid(); }
    lb_rh_session *s=calloc(1,sizeof(*s)+n*sizeof(lb_kind *)); if (!s) rb_memerror();
    s->fiber=rb_fiber_current(); rb_gc_register_address(&s->fiber);
    binding b={s,specs,n,classes}; int state=0;
    rb_protect(add_kinds,(VALUE)&b,&state);
    if (state) { release_kinds(s); rb_gc_unregister_address(&s->fiber); free(s); rb_jump_tag(state); }
    return s;
}
void lb_rh_unbind(lb_rh_session **ptr) {
    lb_rh_session *s=*ptr; bound(s);
    if (s->depth) rb_raise(rb_eRuntimeError,"cannot unbind inside an active Lean call");
    *ptr=NULL; release_kinds(s); rb_gc_unregister_address(&s->fiber); free(s);
}
void lb_rh_enter(lb_rh_session *s,lb_rh_frame *f) {
    bound(s); for (size_t i=0;i<s->count;++i) sweep(s->kinds[i],0);
    *f=(lb_rh_frame){.session=s}; ++s->depth;
}
void lb_rh_leave(lb_rh_frame *f) {
    lb_rh_session *s=f->session;
    while (f->faults) {
        lb_rh_fault *v=f->faults; f->faults=v->next;
        rb_gc_unregister_address(&v->original); lean_dec(v->error); free(v);
    }
    for (size_t i=0;i<s->count;++i) sweep(s->kinds[i],0);
    --s->depth;
}
VALUE lb_rh_type(lb_rh_session *s,unsigned i) {
    bound(s); if(i>=s->count) rb_raise(rb_eTypeError,"unknown host resource kind"); return s->kinds[i]->klass;
}
VALUE lb_rh_object(lb_rh_session *s,unsigned i,lean_object *o) {
    (void)lb_rh_type(s,i);
    if (o && !lean_is_scalar(o) && lean_is_external(o) && lean_get_external_class(o)==tag) {
        lb_value *v=lean_get_external_data(o);
        if (v->kind==s->kinds[i]) return v->object;
    }
    rb_raise(rb_eTypeError,"stale, foreign or wrong-kind Ruby host object");
}
lean_object *lb_rh_wrap(lb_rh_session *s,unsigned i,VALUE obj,VALUE anchor) {
    VALUE klass=lb_rh_type(s,i);
    if (!rb_obj_is_kind_of(obj,klass)) rb_raise(rb_eTypeError,"expected an instance of the bound Ruby class");
    lb_kind *k=s->kinds[i]; lb_value *v=k->values;
    while (v && v->object!=obj) v=v->next;
    if (!v) {
        v=calloc(1,sizeof(*v)); if (!v) rb_memerror();
        v->object=obj; v->anchors=Qnil; v->kind=k;
        rb_gc_register_address(&v->object); rb_gc_register_address(&v->anchors);
        v->wrapper=lean_alloc_external(tag,v); v->next=k->values; k->values=v; ++live;
        if (k->strong) ++k->provisional;
    }
    if (!NIL_P(anchor) && anchor!=obj) {
        if (NIL_P(v->anchors)) v->anchors=rb_ary_new();
        long j=0; while (j<RARRAY_LEN(v->anchors) && rb_ary_entry(v->anchors,j)!=anchor) ++j;
        if (j==RARRAY_LEN(v->anchors)) rb_ary_push(v->anchors,anchor);
    }
    lean_inc(v->wrapper); return v->wrapper;
}
/* A partially converted Ruby argument list has not entered Lean. Do not turn
 * its temporary reference into a binding-lifetime root until it actually does.
 * Reentry may already have admitted this canonical wrapper in another call. */
lean_object *lb_rh_admit(lean_object *wrapper) {
    lb_value *v=lean_get_external_data(wrapper);
    if (v->kind->strong && !v->pinned) {
        v->pinned=1; --v->kind->provisional;
    }
    return wrapper;
}
static VALUE message_text(VALUE e) {
    VALUE msg=rb_str_export_to_enc(rb_obj_as_string(e),rb_utf8_encoding());
    return rb_enc_get(msg)==rb_utf8_encoding() && rb_enc_str_coderange(msg)!=ENC_CODERANGE_BROKEN ? msg : Qnil;
}
lean_object *lb_rh_fault_result(lb_rh_frame *f,int state) {
    VALUE e=rb_errinfo(); rb_set_errinfo(Qnil);
    lean_object *text=lean_mk_string("Ruby host call failed");
    int is_exception=state && RB_TYPE_P(e,T_OBJECT) && rb_obj_is_kind_of(e,rb_eException);
    if (is_exception) {
        int failed=0; VALUE msg=rb_protect(message_text,e,&failed);
        if (!failed && RB_TYPE_P(msg,T_STRING)) {
            lean_dec(text); text=lean_mk_string_from_bytes(RSTRING_PTR(msg),RSTRING_LEN(msg));
        }
        if (failed) rb_set_errinfo(Qnil);
    }
    lean_object *error=lean_mk_io_user_error(text);
    if (f && is_exception) {
        lb_rh_fault *v=malloc(sizeof(*v));
        if (v) { *v=(lb_rh_fault){f->faults,e,error}; lean_inc(error); rb_gc_register_address(&v->original); f->faults=v; }
    }
    return lean_io_result_mk_error(error);
}
VALUE lb_rh_original(lb_rh_frame *f,lean_object *err) {
    for (lb_rh_fault *v=f->faults;v;v=v->next) if(v->error==err) return v->original;
    return Qnil;
}
size_t lb_rh_live(void) { lb_rh_owner(); return live; }
