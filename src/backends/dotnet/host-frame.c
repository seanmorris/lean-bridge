#define _GNU_SOURCE
#include "host-frame.h"
#include <stdlib.h>
#include <unistd.h>
#include <sys/syscall.h>

typedef struct lb_dn_fault { struct lb_dn_fault *next; lean_object *error; uint32_t id; } lb_dn_fault;
static _Thread_local lb_dn_frame *top;
lb_dn_frame *lb_dn_current(void) { return top; }
static lean_object *io_error(const char *why) {
    return lean_io_result_mk_error(lean_mk_io_user_error(lean_mk_string(why)));
}
int lb_dn_enter(lb_dn_frame *f, uint64_t call, lb_dn_dispatch dispatch, void (*retire)(void)) {
    if(getpid() != (pid_t)syscall(SYS_gettid)) return LB_DN_WRONG_THREAD;
    if(!call || !dispatch || !retire || (top && top->fatal)) return LB_DN_FATAL;
    *f=(lb_dn_frame){.parent=top,.call=call,.dispatch=dispatch,.retire=retire};
    top=f; return LB_DN_OK;
}
void lb_dn_leave(lb_dn_frame *f) {
    if(f!=top) abort(); /* caller violated the private stack lifetime */
    top=f->parent;
    while(f->faults) {
        lb_dn_fault *p=f->faults; f->faults=p->next;
        lean_dec(p->error); free(p);
    }
}
static void poison(lb_dn_frame *f) {
    for(lb_dn_frame *p=f; p; p=p->parent) p->fatal=1;
    f->retire();
}
lean_object *lb_dn_corrupt(void) {
    if(top && !top->fatal) poison(top);
    return io_error("invalid CLR host wire result");
}
lean_object *lb_dn_member(int32_t slot,const uint64_t *args,size_t arity,uint64_t *out) {
    lb_dn_frame *f=top;
    if(!f || f->fatal) return io_error("no active CLR host binding");
    uint32_t id=0;
    int status=f->dispatch(f->call,slot,args,arity,out,&id);
    if(status==LB_DN_OK && !id && !f->fatal) return NULL;
    if(status==LB_DN_ERROR && id && !f->fatal) {
        lb_dn_fault *row=malloc(sizeof(*row));
        if(row) {
            lean_object *error=lean_mk_io_user_error(lean_mk_string("CLR host member failed"));
            lean_inc(error); *row=(lb_dn_fault){f->faults,error,id}; f->faults=row;
            return lean_io_result_mk_error(error);
        }
    }
    poison(f); return io_error("CLR host runtime retired");
}
uint32_t lb_dn_original(lb_dn_frame *f,b_lean_obj_arg error) {
    for(lb_dn_fault *p=f->faults;p;p=p->next) if(p->error==error) return p->id;
    return 0;
}
