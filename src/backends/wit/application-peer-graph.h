/* Build the outer component from trusted package adapters. Guest-supplied
 * bytes are embedded only as isolated components. The guest cannot change an
 * outer import, see a private native port, or substitute a resource type. */
#ifndef LB_WIT_PEER_GRAPH_H
#define LB_WIT_PEER_GRAPH_H
#include "application-peer.h"
#include <stdlib.h>
#define LB_PEER_LIMIT 16u
#define LB_GRAPH_BYTES (192u*1024u*1024u)
typedef struct {uint8_t *p;size_t n,cap;bool bad;} lb_pg_buf;
static void lb_pg_put(lb_pg_buf *b,const void *src,size_t n){
    if(!n || b->bad)return;
    if(n>LB_GRAPH_BYTES-b->n){b->bad=true;return;}
    if(b->n+n>b->cap){
        size_t cap=b->cap?b->cap:256;while(cap<b->n+n)cap=cap>LB_GRAPH_BYTES/2?LB_GRAPH_BYTES:cap*2;
        uint8_t *p=realloc(b->p,cap);if(!p){b->bad=true;return;}b->p=p;b->cap=cap;
    }
    memcpy(b->p+b->n,src,n);b->n+=n;
}
static void lb_pg_byte(lb_pg_buf *b,unsigned c){uint8_t v=(uint8_t)c;lb_pg_put(b,&v,1);}
static void lb_pg_u32(lb_pg_buf *b,size_t n){
    do{lb_pg_byte(b,(n&127)|(n>=128?128:0));n>>=7;}while(n);
}
static void lb_pg_string(lb_pg_buf *b,const char *name){size_t n=strlen(name);lb_pg_u32(b,n);lb_pg_put(b,name,n);}
static void lb_pg_section(lb_pg_buf *graph,unsigned kind,lb_pg_buf *s){
    if(s->bad)graph->bad=true;
    lb_pg_byte(graph,kind);lb_pg_u32(graph,s->n);lb_pg_put(graph,s->p,s->n);free(s->p);
}
static void lb_pg_component(lb_pg_buf *b,lb_peer_bytes w){lb_pg_byte(b,4);lb_pg_u32(b,w.size);lb_pg_put(b,w.data,w.size);}
enum {LB_PG_FUNC=1,LB_PG_INSTANCE=5};
typedef struct {const char *name;unsigned instance;} lb_pg_arg;
static void lb_pg_import(lb_pg_buf *b,const char *name,unsigned type){
    lb_pg_buf s={0};lb_pg_byte(&s,1);lb_pg_byte(&s,0);lb_pg_string(&s,name);lb_pg_byte(&s,LB_PG_INSTANCE);lb_pg_u32(&s,type);lb_pg_section(b,10,&s);
}
static void lb_pg_instantiate(lb_pg_buf *b,unsigned component,const lb_pg_arg *args,size_t count){
    lb_pg_buf s={0};lb_pg_byte(&s,1);lb_pg_byte(&s,0);lb_pg_u32(&s,component);lb_pg_u32(&s,count);
    for(size_t i=0;i<count;i++){lb_pg_string(&s,args[i].name);lb_pg_byte(&s,LB_PG_INSTANCE);lb_pg_u32(&s,args[i].instance);}
    lb_pg_section(b,5,&s);
}
static void lb_pg_alias(lb_pg_buf *b,unsigned kind,unsigned instance,const char *name){
    lb_pg_buf s={0};lb_pg_byte(&s,1);lb_pg_byte(&s,kind);lb_pg_byte(&s,0);lb_pg_u32(&s,instance);lb_pg_string(&s,name);lb_pg_section(b,6,&s);
}
static void lb_pg_export(lb_pg_buf *b,unsigned kind,unsigned index,const char *name,int signature){
    lb_pg_buf s={0};lb_pg_byte(&s,1);lb_pg_byte(&s,0);lb_pg_string(&s,name);lb_pg_byte(&s,kind);lb_pg_u32(&s,index);
    lb_pg_byte(&s,signature>=0);if(signature>=0){lb_pg_byte(&s,kind);lb_pg_u32(&s,(unsigned)signature);}lb_pg_section(b,11,&s);
}
static lb_pg_buf lb_pg_build(const lb_peer_package *const *pkg,unsigned n,lb_peer_bytes owner,lb_peer_bytes guest){
    lb_pg_buf b={0};if(!n || n>LB_PEER_LIMIT){b.bad=true;return b;}
    static const uint8_t magic[]={0,97,115,109,13,0,1,0};lb_pg_put(&b,magic,sizeof magic);
    for(unsigned j=0;j<n;j++){lb_pg_put(&b,pkg[j]->native_type.data,pkg[j]->native_type.size);lb_pg_import(&b,pkg[j]->native,j);}
    unsigned code=0,instance=n;
    lb_pg_component(&b,owner);lb_pg_instantiate(&b,code++,NULL,0);unsigned defining=instance++;
    lb_pg_alias(&b,LB_PG_INSTANCE,defining,pkg[0]->objects);lb_pg_arg objects={pkg[0]->objects,instance++};
    lb_pg_component(&b,pkg[0]->vault);lb_pg_instantiate(&b,code++,&objects,1);unsigned vault=instance++;
    lb_pg_alias(&b,LB_PG_INSTANCE,vault,pkg[0]->exchange);lb_pg_arg exchange={pkg[0]->exchange,instance++};
    lb_pg_arg imports[1+LB_PEER_LIMIT]={objects};
    for(unsigned j=0;j<n;j++){
        const lb_pg_arg args[]={objects,exchange,{pkg[j]->native,j}};
        lb_pg_component(&b,pkg[j]->facade);lb_pg_instantiate(&b,code++,args,3);unsigned facade=instance++;
        lb_pg_alias(&b,LB_PG_INSTANCE,facade,pkg[j]->api);imports[j+1]=(lb_pg_arg){pkg[j]->api,instance++};
    }
    lb_pg_component(&b,guest);lb_pg_instantiate(&b,code,imports,n+1);
    lb_pg_alias(&b,LB_PG_FUNC,instance,"run");
    /* Ascribe the required public signature at validation time, before any
     * application initializer or native function can run. Type n follows
     * the n private instance types. (type (func (result s64))) */
    static const uint8_t entry_type[]={7,5,1,0x40,0,0,0x78};lb_pg_put(&b,entry_type,sizeof entry_type);
    lb_pg_export(&b,LB_PG_INSTANCE,objects.instance,objects.name,-1);
    lb_pg_export(&b,LB_PG_INSTANCE,exchange.instance,"private-exchange",-1);
    lb_pg_export(&b,LB_PG_FUNC,0,"run",(int)n);return b;
}
#endif
