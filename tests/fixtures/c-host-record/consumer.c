/* Repository-free C11 application using only the installed public header. */
#include "workshop.h"
#include <assert.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

typedef struct { uint32_t value; unsigned *drops; } meter;
typedef struct { unsigned reads; uint32_t failure; } context;
static void dispose(void *ptr) { meter *m=ptr; ++*m->drops; free(m); }
static meter *payload(workshop_box b) {
    void *ptr=NULL; assert(workshop_box_data(b,&ptr)==workshop_OK); return ptr;
}
static uint32_t read_meter(void *ctx, workshop_box b, uint32_t *n) {
    context *c=ctx; ++c->reads; if(c->failure) return c->failure;
    *n=payload(b)->value; return 0;
}
static uint32_t write_meter(void *unused, workshop_box b, uint32_t n) {
    (void)unused; payload(b)->value=n; return 0;
}
static uint32_t create(void *unused, uint32_t n, workshop_box *out) {
    (void)unused; (void)n; (void)out; assert(0 && "not used by this source"); return 721;
}
static uint32_t identity(void *unused, workshop_box b, workshop_box *out) {
    (void)unused; assert(workshop_box_clone(b,out)==workshop_OK); return 0;
}
static workshop_box make(uint32_t n,unsigned *counter) {
    meter *m=malloc(sizeof *m); assert(m); *m=(meter){n,counter};
    workshop_box b={0}; assert(workshop_box_adopt(m,dispose,&b)==workshop_OK); return b;
}
static void same(workshop_box a,workshop_box b) {
    bool eq=false; assert(workshop_box_same(a,b,&eq)==workshop_OK && eq);
}
int main(void) {
    unsigned left_drops=0,right_drops=0; context ctx={0}; workshop_binding binding={0}; workshop_diagnostic diag={0};
    workshop_hosts methods={.box_create=create,.box_get_level=read_meter,.box_read=read_meter,.box_set_level=write_meter,.box_identity=identity};
    assert(workshop_with_hosts(&methods,&ctx,&binding)==workshop_OK);
    workshop_box x=make(23,&left_drops),y=make(19,&right_drops),out={0};
    uint8_t bytes[]={9,8}; uint64_t digits[]={5,0,4};
    workshop_pair a={0},b={0},alias={0},flipped={0};
    assert(workshop_pair_make(x,(workshop_view){bytes,2},(workshop_integer_view){digits,3,false},y,&a)==workshop_OK);
    bytes[0]=0; digits[0]=0;
    assert(workshop_create_pair(binding,x,&b,&diag)==workshop_OK);
    assert(workshop_pair_clone(a,&alias)==workshop_OK);
    workshop_pair stale=alias; assert(workshop_pair_drop(&alias)==workshop_OK);
    uint32_t result=987; assert(workshop_sum_read(binding,a,stale,&result,&diag)==workshop_STALE);
    assert(ctx.reads==0 && result==987);
    assert(workshop_sum_read(binding,b,a,&result,&diag)==workshop_OK && result==42);
    ctx.failure=173; assert(workshop_flip(binding,a,&flipped,&diag)==workshop_HOST_ERROR && diag.host_code==173);
    workshop_diagnostic_clear(&diag); ctx.failure=0;
    assert(workshop_flip(binding,a,&flipped,&diag)==workshop_OK);
    assert(workshop_pair_get_lead(flipped,&out)==workshop_OK); same(out,y); workshop_box_drop(&out);
    workshop_buffer copy={0}; assert(workshop_pair_get_sample(flipped,&copy)==workshop_OK);
    assert(copy.len==3 && !memcmp(copy.data,(uint8_t[]){9,8,23},3)); copy.data[0]=0; workshop_buffer_clear(&copy);
    assert(workshop_pair_get_sample(flipped,&copy)==workshop_OK && copy.data[0]==9); workshop_buffer_clear(&copy);
    workshop_integer wide={0}; assert(workshop_pair_get_sequence(flipped,&wide)==workshop_OK);
    assert(wide.len==3 && !wide.negative && wide.data[0]==6 && wide.data[2]==4); workshop_integer_clear(&wide);
    workshop_choose_closure choose={0}; assert(workshop_choose(binding,a,&choose,&diag)==workshop_OK);
    assert(workshop_pair_drop(&b)==workshop_OK && workshop_pair_drop(&a)==workshop_OK);
    assert(workshop_choose_call(&choose,false,&out,&diag)==workshop_OK); same(y,out); workshop_box_drop(&out);

    unsigned budget_drops=0; workshop_box budget=make(7,&budget_drops); const size_t n=9u*1024*1024;
    uint8_t *large=calloc(n,1); assert(large); workshop_reading never={0};
    assert(workshop_duplicate_sample(binding,budget,(workshop_view){large,n},&never,&diag)==workshop_LIMIT);
    free(large); assert(workshop_reading_drop(&never)==workshop_OK);
    assert(workshop_box_drop(&budget)==workshop_OK && budget_drops==1);
    assert(workshop_choose_call(&choose,true,&out,&diag)==workshop_OK); same(x,out); workshop_box_drop(&out);

    assert(workshop_box_drop(&x)==workshop_OK && workshop_box_drop(&y)==workshop_OK);
    assert(workshop_choose_drop(&choose)==workshop_OK && workshop_close(&binding)==workshop_OK);
    assert(left_drops==0 && right_drops==0); /* Only the independent result row remains. */
    assert(workshop_pair_get_spare(flipped,&out)==workshop_OK && payload(out)->value==23);
    assert(workshop_pair_drop(&flipped)==workshop_OK && right_drops==1 && left_drops==0);
    assert(workshop_pair_drop(&flipped)==workshop_OK && workshop_box_drop(&out)==workshop_OK && left_drops==1);
    puts("C11 records: original objects, copied bytes and Nat, validation, capture, failed partial output and independent final owners");
}
