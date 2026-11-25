/* Private to the component. MRI owns a ticket; the binding owns the Lean
 * reference. GC never calls Lean or touches the owner's linked list. */
#include <stdatomic.h>
typedef VALUE (*lb_ticket_apply)(VALUE,VALUE);
typedef struct lb_ticket {
    struct lb_ticket *next, **prev;
    lb_rh_session *owner;
    lean_object *fn;
    lb_ticket_apply apply;
    atomic_uint refs;
} lb_ticket;
static lb_ticket *tickets;
static atomic_uint tickets_pending;
static VALUE ticket_class;
static void ticket_drop(lb_ticket *v) {
    if (atomic_fetch_sub(&v->refs,1)==1) ruby_xfree(v);
}
static void ticket_gc(void *p) {
    if (!p) return;
    ticket_drop(p); atomic_store(&tickets_pending,1);
}
static size_t ticket_size(const void *p) { return p ? sizeof(lb_ticket) : 0; }
static const rb_data_type_t ticket_type={
    .wrap_struct_name="LeanBridge::LeanClosure",
    .function={.dfree=ticket_gc,.dsize=ticket_size},
    .flags=RUBY_TYPED_FREE_IMMEDIATELY
};
static lb_ticket *get_ticket(VALUE obj) {
    lb_ticket *v; TypedData_Get_Struct(obj,lb_ticket,&ticket_type,v); return v;
}
static void detach_ticket(lb_ticket *v) {
    *v->prev=v->next; if (v->next) v->next->prev=v->prev;
    lean_object *fn=v->fn; v->owner=NULL; v->fn=NULL; v->prev=NULL; v->next=NULL;
    lean_dec(fn); ticket_drop(v);
}
static void collect_tickets(int all) {
    if (!atomic_exchange(&tickets_pending,0) && !all) return;
    for (lb_ticket *v=tickets,*n; v; v=n) {
        n=v->next; if (all || atomic_load(&v->refs)==1) detach_ticket(v);
    }
}
static VALUE new_ticket(lb_ticket_apply apply,lean_object *fn) {
    lb_ticket *v;
    VALUE self=TypedData_Make_Struct(ticket_class,lb_ticket,&ticket_type,v);
    atomic_init(&v->refs,2); v->fn=fn; lean_inc(fn); v->owner=session; v->apply=apply;
    v->next=tickets; v->prev=&tickets; if (tickets) tickets->prev=&v->next;
    tickets=v; return self;
}
static void ticket_owner(lb_ticket *v) {
    if (!v->fn || v->owner!=session) rb_raise(rb_eRuntimeError,"stale Lean closure");
    (void)lb_rh_type(session,0); /* thread, fiber and original process */
}
static lean_object *borrow_ticket(VALUE obj,lb_ticket_apply apply) {
    lb_ticket *v=get_ticket(obj); ticket_owner(v);
    if (v->apply!=apply) rb_raise(rb_eTypeError,"wrong Lean closure signature");
    lean_inc(v->fn); return v->fn; /* self-close cannot revoke this in-flight call */
}
static VALUE ticket_call(VALUE self,VALUE arg) {
    lb_ticket *v=get_ticket(self); ticket_owner(v); return v->apply(self,arg);
}
static VALUE ticket_close(VALUE self) {
    lb_ticket *v=get_ticket(self);
    if (v->fn) {
        ticket_owner(v); lb_rh_frame f; lb_rh_enter(session,&f);
        detach_ticket(v); lb_rh_leave(&f);
    }
    return Qnil;
}
static VALUE ticket_closed(VALUE self) { return get_ticket(self)->fn ? Qfalse : Qtrue; }
/* The Proc retains the checked ticket, never an unchecked native function. */
static VALUE ticket_proc(VALUE self) {
    return rb_funcall(rb_obj_method(self,ID2SYM(rb_intern("call"))),rb_intern("to_proc"),0);
}
static void init_tickets(VALUE mod) {
    ticket_class=rb_define_class_under(mod,"LeanClosure",rb_cObject); rb_global_variable(&ticket_class);
    rb_undef_alloc_func(ticket_class);
    rb_define_method(ticket_class,"call",ticket_call,1);
    rb_define_method(ticket_class,"to_proc",ticket_proc,0);
    rb_define_method(ticket_class,"close",ticket_close,0);
    rb_define_method(ticket_class,"closed?",ticket_closed,0);
}
