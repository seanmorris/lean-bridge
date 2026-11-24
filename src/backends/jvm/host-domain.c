#include "host-domain.h"
#include <stdatomic.h>
#include <stdlib.h>
#include <string.h>

typedef struct kind kind;
typedef struct anchor { struct anchor *next; jobject ref; } anchor;
typedef struct value {
    struct value *next; kind *kind;
    lean_object *wrapper; jobject object; anchor *anchors;
    int pinned;
} value;
struct kind {
    kind *next; char *key; jclass cls;
    size_t users, provisional; int strong;
    value *values;
};
struct lb_jhd_session {
    struct lb_jhd_session *next;
    jweak binder; char *component;
    size_t depth, count; kind *kinds[];
};
static kind *kinds;
static lb_jhd_session *sessions;
static lean_external_class *tag;
static size_t live;
/* A finalizer may run on a Lean worker; the owner already cleared JNI
   references before dropping its registry reference. */
static void finalize(void *row) { free(row); }
static void visit(void *row, b_lean_obj_arg fn) { (void)row; (void)fn; }
static void fail(JNIEnv *e, const char *type, const char *message) {
    if ((*e)->ExceptionCheck(e)) return;
    jclass c = (*e)->FindClass(e, type);
    if (c) { (*e)->ThrowNew(e,c,message); (*e)->DeleteLocalRef(e,c); }
}
static void oom(JNIEnv *e) { fail(e,"java/lang/OutOfMemoryError","cannot retain JVM host binding"); }
static int owner(lb_jh_frame *f) {
    if (LB_JVM_OWNER(current)()) return 1;
    fail(f->env,"java/lang/IllegalStateException","JVM host operation outside its owner"); return 0;
}
static void sweep(JNIEnv *e, kind *k, int all) {
    if (!all && k->strong && !k->provisional) return;
    value **cursor = &k->values;
    while (*cursor) {
        value *v = *cursor;
        if (!all) {
            int rc = atomic_load_explicit(lean_get_rc_mt_addr(v->wrapper),memory_order_acquire);
            if (v->pinned || (rc != 1 && rc != -1)) { cursor = &v->next; continue; }
        }
        *cursor = v->next;
        if (k->strong && !v->pinned) --k->provisional;
        while (v->anchors) {
            anchor *a = v->anchors; v->anchors = a->next;
            (*e)->DeleteGlobalRef(e,a->ref); free(a);
        }
        (*e)->DeleteGlobalRef(e,v->object); v->object = NULL; v->kind = NULL;
        --live; lean_dec(v->wrapper);
    }
}
static void retire(JNIEnv *e, lb_jhd_session *s) {
    while (s->count) {
        kind *k = s->kinds[--s->count];
        if (--k->users) continue;
        kind **p = &kinds; while (*p != k) p = &(*p)->next;
        *p = k->next; sweep(e,k,1);
        (*e)->DeleteGlobalRef(e,k->cls); free(k->key); free(k);
    }
    if (s->binder) (*e)->DeleteWeakGlobalRef(e,s->binder);
    free(s->component); free(s);
}
/* A binding forgotten by its host does not permanently root its classloader.
   Its weak binder is retired at the next owner entry, never on a GC thread. */
static lb_jhd_session **find(lb_jh_frame *f, const char *component) {
    JNIEnv *e = f->env; lb_jhd_session **p = &sessions, **match = NULL;
    while (*p) {
        lb_jhd_session *s = *p;
        if (!s->depth && (*e)->IsSameObject(e,s->binder,NULL)) {
            *p = s->next; retire(e,s); continue;
        }
        if (component && !strcmp(s->component,component) && (*e)->IsSameObject(e,s->binder,f->binder)) match = p;
        p = &s->next;
    }
    return match ? match : p;
}
int LB_JHD(open)(lb_jh_frame *f, const char *component, const lb_jhd_spec *spec, size_t n) {
    JNIEnv *e = f->env;
    if (!owner(f)) return 0;
    if (!n || n > 64 || *find(f,component)) {
        fail(e,"java/lang/IllegalStateException","invalid or duplicate host binding"); return 0;
    }
    jclass bc = (*e)->GetObjectClass(e,f->binder);
    jmethodID get = bc ? (*e)->GetMethodID(e,bc,"classes","()[Ljava/lang/Class;") : NULL;
    if (!get) return 0;
    jobjectArray classes = (*e)->CallObjectMethod(e,f->binder,get);
    if ((*e)->ExceptionCheck(e)) return 0;
    if (!classes || (*e)->GetArrayLength(e,classes) != (jsize)n) {
        fail(e,"java/lang/IllegalArgumentException","host class count differs from contract"); return 0;
    }
    lb_jhd_session *s = calloc(1,sizeof(*s) + n*sizeof(kind *));
    if (!s) { oom(e); return 0; }
    if (!(s->component = strdup(component)) || !(s->binder = (*e)->NewWeakGlobalRef(e,f->binder))) {
        oom(e); goto error;
    }
    if (!tag) tag = lean_register_external_class(finalize,visit);
    for (size_t i=0; i<n; ++i) {
        jclass cls = (*e)->GetObjectArrayElement(e,classes,(jsize)i);
        if (!cls) { fail(e,"java/lang/IllegalArgumentException","missing nominal class"); goto error; }
        kind *k = kinds; while (k && strcmp(k->key,spec[i].key)) k = k->next;
        if (k && (k->strong != spec[i].strong || !(*e)->IsSameObject(e,cls,k->cls))) {
            fail(e,"java/lang/IllegalArgumentException","incompatible class or identity policy for shared host kind"); goto error;
        }
        if (!k) {
            k = calloc(1,sizeof(*k));
            if (!k) { oom(e); goto error; }
            k->key = strdup(spec[i].key); k->cls = (*e)->NewGlobalRef(e,cls);
            if (!k->key || !k->cls) {
                if (k->cls) (*e)->DeleteGlobalRef(e,k->cls);
                free(k->key); free(k); oom(e); goto error;
            }
            k->strong = spec[i].strong; k->next = kinds; kinds = k;
        }
        ++k->users; s->kinds[s->count++] = k;
        (*e)->DeleteLocalRef(e,cls);
    }
    s->next = sessions; sessions = s; return 1;
error:
    retire(e,s); return 0;
}
int LB_JHD(close)(lb_jh_frame *f, const char *component) {
    if (!owner(f)) return 0;
    lb_jhd_session **p = find(f,component), *s = *p;
    if (!s) return 1;
    if (s->depth) { fail(f->env,"java/lang/IllegalStateException","cannot close an active host binding"); return 0; }
    *p = s->next; retire(f->env,s); return 1;
}
lb_jhd_session *LB_JHD(enter)(lb_jh_frame *f, const char *component) {
    if (!owner(f)) return NULL;
    lb_jhd_session *s = *find(f,component);
    if (!s) { fail(f->env,"java/lang/IllegalStateException","closed or foreign host binding"); return NULL; }
    for (size_t i=0; i<s->count; ++i) sweep(f->env,s->kinds[i],0);
    ++s->depth; return s;
}
void LB_JHD(leave)(lb_jh_frame *f, lb_jhd_session *s) {
    for (size_t i=0; i<s->count; ++i) sweep(f->env,s->kinds[i],0);
    --s->depth;
}
lean_object *LB_JHD(wrap)(lb_jh_frame *f, lb_jhd_session *s, unsigned i, jobject obj, jobject parent) {
    JNIEnv *e = f->env;
    if (i >= s->count || !obj || !(*e)->IsInstanceOf(e,obj,s->kinds[i]->cls)) {
        fail(e,"java/lang/IllegalArgumentException","wrong nominal JVM host object"); return NULL;
    }
    kind *k = s->kinds[i]; value *v = k->values;
    while (v && !(*e)->IsSameObject(e,v->object,obj)) v = v->next;
    if (!v) {
        v = calloc(1,sizeof(*v));
        if (!v || !(v->object = (*e)->NewGlobalRef(e,obj))) { free(v); oom(e); return NULL; }
        v->wrapper = lean_alloc_external(tag,v); v->kind = k;
        v->next = k->values; k->values = v; ++live; if (k->strong) ++k->provisional;
    }
    if (parent && !(*e)->IsSameObject(e,obj,parent)) {
        anchor *a = v->anchors;
        while (a && !(*e)->IsSameObject(e,a->ref,parent)) a = a->next;
        if (!a) {
            a = malloc(sizeof(*a));
            if (!a || !(a->ref = (*e)->NewGlobalRef(e,parent))) { free(a); oom(e); return NULL; }
            a->next = v->anchors; v->anchors = a;
        }
    }
    lean_inc(v->wrapper); return v->wrapper;
}
void LB_JHD(admit)(lean_object *wrapper) {
    value *v = lean_get_external_data(wrapper);
    if (v->kind->strong && !v->pinned) { v->pinned = 1; --v->kind->provisional; }
}
jobject LB_JHD(object)(lb_jh_frame *f, lb_jhd_session *s, unsigned i, b_lean_obj_arg wrapper) {
    if (i < s->count && wrapper && !lean_is_scalar(wrapper) && lean_is_external(wrapper) && lean_get_external_class(wrapper) == tag) {
        value *v = lean_get_external_data(wrapper);
        if (v->kind && v->kind == s->kinds[i]) return (*f->env)->NewLocalRef(f->env,v->object);
    }
    fail(f->env,"java/lang/IllegalStateException","stale, foreign or wrong-kind JVM host reference"); return NULL;
}
size_t LB_JHD(live)(lb_jh_frame *f) {
    if (!owner(f)) return 0;
    find(f,NULL); return live;
}
