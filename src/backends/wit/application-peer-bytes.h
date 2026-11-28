/* Component binary sections shared by the offline package runners. */
#ifndef LB_WIT_PEER_BYTES_H
#define LB_WIT_PEER_BYTES_H
#include <stdbool.h>
#include <stdint.h>
#include <string.h>
#include <stdlib.h>
typedef struct {const uint8_t *data;size_t size;} lb_peer_bytes;
#define LB_PEER_LIMIT 16u
#define LB_GRAPH_BYTES (192u*1024u*1024u)
typedef struct {uint8_t *p;size_t n,cap;bool bad;} lb_pg_buf;
static inline void lb_pg_put(lb_pg_buf *b,const void *src,size_t n){
    if(!n || b->bad)return;
    if(n>LB_GRAPH_BYTES-b->n){b->bad=true;return;}
    if(b->n+n>b->cap){
        size_t cap=b->cap?b->cap:256;while(cap<b->n+n)cap=cap>LB_GRAPH_BYTES/2?LB_GRAPH_BYTES:cap*2;
        uint8_t *p=realloc(b->p,cap);if(!p){b->bad=true;return;}b->p=p;b->cap=cap;
    }
    memcpy(b->p+b->n,src,n);b->n+=n;
}
static inline void lb_pg_byte(lb_pg_buf *b,unsigned c){uint8_t v=(uint8_t)c;lb_pg_put(b,&v,1);}
static inline void lb_pg_u32(lb_pg_buf *b,size_t n){
    do{lb_pg_byte(b,(n&127)|(n>=128?128:0));n>>=7;}while(n);
}
static inline void lb_pg_string(lb_pg_buf *b,const char *name){size_t n=strlen(name);lb_pg_u32(b,n);lb_pg_put(b,name,n);}
static inline void lb_pg_section(lb_pg_buf *graph,unsigned kind,lb_pg_buf *s){
    if(s->bad)graph->bad=true;
    lb_pg_byte(graph,kind);lb_pg_u32(graph,s->n);lb_pg_put(graph,s->p,s->n);free(s->p);
}
static inline void lb_pg_component(lb_pg_buf *b,lb_peer_bytes w){lb_pg_byte(b,4);lb_pg_u32(b,w.size);lb_pg_put(b,w.data,w.size);}
enum {LB_PG_FUNC=1,LB_PG_INSTANCE=5};
typedef struct {const char *name;unsigned instance;} lb_pg_arg;
static inline void lb_pg_import(lb_pg_buf *b,const char *name,unsigned type){
    lb_pg_buf s={0};lb_pg_byte(&s,1);lb_pg_byte(&s,0);lb_pg_string(&s,name);lb_pg_byte(&s,LB_PG_INSTANCE);lb_pg_u32(&s,type);lb_pg_section(b,10,&s);
}
static inline void lb_pg_apply(lb_pg_buf *b,unsigned component,const lb_pg_arg *args,size_t count,const lb_pg_arg *funcs,size_t nf){
    lb_pg_buf s={0};lb_pg_byte(&s,1);lb_pg_byte(&s,0);lb_pg_u32(&s,component);lb_pg_u32(&s,count+nf);
    for(size_t i=0;i<count;i++){lb_pg_string(&s,args[i].name);lb_pg_byte(&s,LB_PG_INSTANCE);lb_pg_u32(&s,args[i].instance);}
    for(size_t i=0;i<nf;i++){lb_pg_string(&s,funcs[i].name);lb_pg_byte(&s,LB_PG_FUNC);lb_pg_u32(&s,funcs[i].instance);}
    lb_pg_section(b,5,&s);
}
static inline void lb_pg_instantiate(lb_pg_buf *b,unsigned component,const lb_pg_arg *args,size_t count){
    lb_pg_apply(b,component,args,count,NULL,0);
}
static inline void lb_pg_alias(lb_pg_buf *b,unsigned kind,unsigned instance,const char *name){
    lb_pg_buf s={0};lb_pg_byte(&s,1);lb_pg_byte(&s,kind);lb_pg_byte(&s,0);lb_pg_u32(&s,instance);lb_pg_string(&s,name);lb_pg_section(b,6,&s);
}
static inline void lb_pg_export(lb_pg_buf *b,unsigned kind,unsigned index,const char *name,int signature){
    lb_pg_buf s={0};lb_pg_byte(&s,1);lb_pg_byte(&s,0);lb_pg_string(&s,name);lb_pg_byte(&s,kind);lb_pg_u32(&s,index);
    lb_pg_byte(&s,signature>=0);if(signature>=0){lb_pg_byte(&s,kind);lb_pg_u32(&s,(unsigned)signature);}lb_pg_section(b,11,&s);
}
#endif
