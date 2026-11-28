/* Downstream C11 application; only the installed public header and libc. */
#include "workshop.h"
#include <assert.h>
#include <poll.h>
#include <pthread.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

typedef struct { uint32_t value; unsigned id; } meter;
typedef struct {
    workshop_binding *binding;
    workshop_remember_closure *remember;
    workshop_reader_closure *reader;
    unsigned calls,mode;
} application;
static unsigned created,destroyed[8];
static void dispose(void *p) {
    meter *m=p; assert(m->id<8 && destroyed[m->id]++==0); free(p);
}
static meter *data(workshop_box b) {
    void *p=NULL; assert(workshop_box_data(b,&p)==workshop_OK); return p;
}
static uint32_t create(void *ctx,uint32_t n,workshop_box *out) {
    (void)ctx; meter *m=malloc(sizeof *m); assert(m);
    *m=(meter){n,++created}; assert(workshop_box_adopt(m,dispose,out)==workshop_OK); return 0;
}
static uint32_t read_meter(void *ctx,workshop_box b,uint32_t *out) {
    application *a=ctx; ++a->calls; meter *m=data(b);
    if(m->id==2 && a->mode) {
        workshop_diagnostic diag={0};
        if(a->mode==1) return 173;
        if(a->mode==2) { uint32_t n=0; assert(workshop_reader_call(a->reader,2,&n,&diag)==workshop_OK && n==42); }
        if(a->mode==3) {
            workshop_remember_closure alias=*a->remember; workshop_box unchanged={0};
            assert(workshop_remember_drop(a->remember)==workshop_OK);
            assert(workshop_remember_call(&alias,b,&unchanged,&diag)==workshop_STALE);
            assert(workshop_close(a->binding)==workshop_BUSY);
        }
    }
    *out=m->value; return 0;
}
static uint32_t set_meter(void *ctx,workshop_box b,uint32_t n) { (void)ctx; data(b)->value=n; return 0; }
static uint32_t identity(void *ctx,workshop_box b,workshop_box *out) {
    if(((application *)ctx)->mode==4) return 0; /* malformed success: no required object */
    assert(workshop_box_clone(b,out)==workshop_OK); return 0;
}
static void *foreign(void *p) {
    workshop_reader_closure copy=*(workshop_reader_closure *)p; workshop_diagnostic d={0}; uint32_t n=123;
    assert(workshop_reader_call(&copy,5,&n,&d)!=workshop_OK && n==123);
    assert(workshop_reader_drop(&copy)!=workshop_OK); return NULL;
}
#ifdef TEST_WORKER
static void change_file(const char *text) {
    FILE *f=fopen("input","wb"); assert(f); assert(fputs(text,f)>=0); assert(!fclose(f));
}
static void check_worker(workshop_binding binding,workshop_box box) {
    workshop_diagnostic d={0}; workshop_echo_box_handle job={0}; workshop_box got={0};
    assert(workshop_echo_box_start(binding,box,&job,&d)==workshop_OK);
    int fd=-1; workshop_status st;
    while((st=workshop_echo_box_poll(job,&fd))==workshop_PENDING) {
        struct pollfd f={fd,POLLIN,0}; assert(fd>=0 && poll(&f,1,5000)>0);
    }
    assert(st==workshop_OK && workshop_echo_box_take(&job,&got,&d)==workshop_OK);
    bool same=false; assert(workshop_box_same(got,box,&same)==workshop_OK && same); workshop_box_drop(&got);
    workshop_file_reader_closure file={0}; assert(workshop_file_reader(binding,&file,&d)==workshop_OK);
    const char *values[]={"first","second"};
    for(unsigned i=0;i<2;i++) {
        workshop_buffer out={0}; change_file(values[i]);
        assert(workshop_file_reader_call(&file,(workshop_view){(const uint8_t *)"input",5},&out,&d)==workshop_OK);
        assert(out.len==strlen(values[i]) && !memcmp(out.data,values[i],out.len)); workshop_buffer_clear(&out);
    }
    assert(workshop_file_reader_drop(&file)==workshop_OK);
}
#endif
int main(int argc,char **argv) {
    workshop_hosts hosts={.box_create=create,.box_get_level=read_meter,.box_read=read_meter,.box_set_level=set_meter,.box_identity=identity};
    workshop_binding a={0},b={0}; application left={.binding=&a},right={.binding=&b}; workshop_diagnostic d={0};
    assert(workshop_with_hosts(&hosts,&left,&a)==workshop_OK && workshop_with_hosts(&hosts,&right,&b)==workshop_OK);
    workshop_box captured={0},supplied={0},out={0};
    assert(workshop_make(a,40,&captured,&d)==workshop_OK && workshop_make(a,1,&supplied,&d)==workshop_OK);
    if(argc==2 && !strcmp(argv[1],"poison")) {
        workshop_identity_reader_closure bad={0}; workshop_reader_closure good={0}; uint32_t n=93;
        assert(workshop_identity_reader(a,captured,&bad,&d)==workshop_OK && workshop_reader(b,supplied,&good,&d)==workshop_OK);
        assert(workshop_box_drop(&captured)==workshop_OK && workshop_box_drop(&supplied)==workshop_OK);
        left.mode=4;
        assert(workshop_identity_reader_call(&bad,1,&out,&d)==workshop_UNAVAILABLE);
        assert(workshop_reader_call(&good,1,&n,&d)==workshop_UNAVAILABLE && n==93);
        assert(destroyed[1]==0 && destroyed[2]==0);
        assert(workshop_close(&a)==workshop_OK && destroyed[1]==1 && destroyed[2]==0);
        assert(workshop_reader_drop(&good)==workshop_OK && destroyed[2]==1);
        assert(workshop_reader_drop(&good)==workshop_OK);
        assert(workshop_close(&b)==workshop_OK && destroyed[2]==1);
        puts("poisoned callback: sibling refused, binding-local captures released once"); return 0;
    }
    workshop_remember_closure fn={0}; workshop_reader_closure reader={0},sibling={0};
    left.remember=&fn; left.reader=&reader;
    assert(workshop_remember(a,captured,&fn,&d)==workshop_OK && workshop_reader(a,captured,&reader,&d)==workshop_OK);
    assert(workshop_reader(b,supplied,&sibling,&d)==workshop_OK);
    pthread_t t; unsigned before=left.calls; assert(!pthread_create(&t,NULL,foreign,&reader)); assert(!pthread_join(t,NULL));
    assert(left.calls==before);
    /* A hostile client can byte-copy public C structs. Neither wrong signature
       nor mixed binding coordinates may reach Lean or poison the binding. */
    workshop_reader_closure wrong; _Static_assert(sizeof wrong==sizeof fn,"ticket sizes");
    memcpy(&wrong,&fn,sizeof wrong);
    uint32_t n=321; assert(workshop_reader_call(&wrong,2,&n,&d)==workshop_STALE && n==321);
    wrong=reader; memcpy(&wrong,&sibling,sizeof b);
    assert(workshop_reader_call(&wrong,2,&n,&d)==workshop_STALE && n==321);
    assert(workshop_reader_call(&reader,2,&n,&d)==workshop_OK && n==42);
    left.mode=1; assert(workshop_remember_call(&fn,supplied,&out,&d)==workshop_HOST_ERROR && d.host_code==173); workshop_diagnostic_clear(&d);
    left.mode=2; assert(workshop_remember_call(&fn,supplied,&out,&d)==workshop_OK);
    bool same=false; assert(workshop_box_same(captured,out,&same)==workshop_OK && same); workshop_box_drop(&out);
    workshop_remember_closure old=fn;
    left.mode=3; assert(workshop_remember_call(&fn,supplied,&out,&d)==workshop_OK && data(out)->id==1); workshop_box_drop(&out);
    assert(workshop_remember_drop(&fn)==workshop_OK && workshop_remember_call(&old,supplied,&out,&d)==workshop_STALE);
    left.mode=0;
#ifdef TEST_WORKER
    check_worker(a,captured);
#endif
    workshop_reader_closure batch[24]={0};
    for(unsigned i=0;i<24;i++) assert(workshop_reader(a,captured,batch+i,&d)==workshop_OK);
    workshop_reader_closure dead=batch[0];
    for(unsigned i=0;i<24;i++) assert(workshop_reader_drop(batch+i)==workshop_OK);
    assert(workshop_reader(a,captured,batch,&d)==workshop_OK);
    assert(workshop_reader_call(&dead,0,&n,&d)==workshop_STALE);
    assert(workshop_box_drop(&captured)==workshop_OK && destroyed[1]==0);
    /* No call into the sibling should be necessary to flush a revoked capture. */
    assert(workshop_close(&a)==workshop_OK && destroyed[1]==1);
    assert(workshop_reader_call(&reader,0,&n,&d)==workshop_STALE);
    assert(workshop_reader_call(&sibling,4,&n,&d)==workshop_OK && n==5 && right.calls);
    assert(workshop_with_hosts(&hosts,&left,&a)==workshop_OK);
    assert(workshop_reader_call(batch,0,&n,&d)==workshop_STALE && workshop_close(&a)==workshop_OK);
    assert(workshop_box_drop(&supplied)==workshop_OK && destroyed[2]==0);
    assert(workshop_reader_drop(&sibling)==workshop_OK && destroyed[2]==1 && workshop_close(&b)==workshop_OK);
    assert(created==2); puts("C closures: same object, isolated bindings, reentry, host error, self-drop, stale copies; two disposals");
}
