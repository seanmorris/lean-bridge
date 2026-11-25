/* Assemble each facade and scheduler independently over the same defining
 * component. Applications receive only public object, API, callback and
 * task instances, never the graph supervisor's bind/retire/drain functions. */
#ifndef LB_WIT_ASYNC_GRAPH_H
#define LB_WIT_ASYNC_GRAPH_H
#include "application-async-peer.h"
#include <stdio.h>
typedef struct {lb_pg_buf b;unsigned code,instance,func;} lb_ag;
static inline unsigned lb_ag_apply(lb_ag *g,lb_peer_bytes code,const lb_pg_arg *args,size_t n,const lb_pg_arg *f,size_t nf){
    lb_pg_component(&g->b,code);lb_pg_apply(&g->b,g->code++,args,n,f,nf);return g->instance++;
}
static inline lb_pg_arg lb_ag_instance(lb_ag *g,unsigned src,const char *name){
    lb_pg_alias(&g->b,LB_PG_INSTANCE,src,name);return (lb_pg_arg){name,g->instance++};
}
static inline lb_pg_arg lb_ag_func(lb_ag *g,unsigned src,const char *name){
    lb_pg_alias(&g->b,LB_PG_FUNC,src,name);return (lb_pg_arg){name,g->func++};
}
static inline void lb_ag_control(lb_ag *g,unsigned src,const char *name,const char *prefix){
    size_t p=strlen(prefix),n=strlen(name);if(n>LB_GRAPH_BYTES || p>LB_GRAPH_BYTES-n){g->b.bad=true;return;}
    char *key=malloc(p+n+1);if(!key){g->b.bad=true;return;}
    memcpy(key,prefix,p);memcpy(key+p,name,n+1);
    lb_pg_export(&g->b,LB_PG_FUNC,lb_ag_func(g,src,name).instance,key,-1);++g->func;free(key);
}
static inline void lb_ag_lifecycle(lb_ag *g,unsigned src,const char *prefix){
    lb_ag_control(g,src,"bind",prefix);lb_ag_control(g,src,"seal",prefix);lb_ag_control(g,src,"close",prefix);
}
static inline lb_pg_buf lb_ag_build(const lb_async_peer *const *pkgs,unsigned n,lb_peer_bytes owner,const lb_peer_bytes *providers,lb_peer_bytes guest){
    lb_ag g={0};if(!n || n>LB_PEER_LIMIT){g.b.bad=true;return g.b;}
    const lb_async_peer *p=pkgs[0];static const uint8_t magic[]={0,97,115,109,13,0,1,0};
    lb_pg_put(&g.b,magic,sizeof magic);for(unsigned i=0;i<n;i++){
        lb_pg_put(&g.b,pkgs[i]->scheduler_type.data,pkgs[i]->scheduler_type.size);
        lb_pg_import(&g.b,pkgs[i]->scheduler,i);++g.instance;
    }
    unsigned def=lb_ag_apply(&g,owner,NULL,0,NULL,0);
    lb_pg_arg obj=lb_ag_instance(&g,def,p->objects);
    unsigned cells=lb_ag_apply(&g,p->cells,&obj,1,NULL,0);
    lb_pg_arg exchange=lb_ag_instance(&g,cells,p->exchange);
    unsigned base=lb_ag_apply(&g,p->base,&obj,1,NULL,0);
    lb_pg_arg leases={"leases",base},member_args[]={obj,leases};
    lb_pg_arg mem={"members",lb_ag_apply(&g,p->members,member_args,2,NULL,0)};
    lb_ag_lifecycle(&g,base,"objects-");
    lb_pg_arg app[1+3*LB_PEER_LIMIT]={obj};size_t na=1;
    for(unsigned i=0;i<n;i++){
        p=pkgs[i];lb_pg_arg sync=lb_ag_instance(&g,i,"sync-ports"),args[]={obj,exchange,leases,mem,sync};
        unsigned turn=lb_ag_apply(&g,p->turn,args,5,NULL,0);
        lb_pg_arg native=lb_ag_instance(&g,turn,p->native),facade_args[]={obj,exchange,native};
        app[na++]=lb_ag_instance(&g,lb_ag_apply(&g,p->facade,facade_args,3,NULL,0),p->api);
    }
    const size_t public_sync=na;
    for(unsigned i=0;i<n;i++){
        p=pkgs[i];char prefix[32];snprintf(prefix,sizeof prefix,"p%u-",i);
        if(p->n_channels>LB_GRAPH_BYTES/sizeof(lb_pg_arg)-3){g.b.bad=true;break;}
        lb_pg_arg *ins=calloc(3+p->n_channels,sizeof *ins),*fns=calloc(p->n_channels,sizeof *fns);
        if(!ins || !fns){free(ins);free(fns);g.b.bad=true;break;}
        size_t ni=0;ins[ni++]=obj;unsigned vault=base;
        if(p->callbacks){
            unsigned cb=lb_ag_apply(&g,providers[i],app,public_sync,NULL,0);
            lb_pg_arg registrations=lb_ag_instance(&g,cb,p->callbacks);
            app[na++]=registrations;ins[ni++]=registrations;
            lb_pg_arg args[]={obj,registrations,{"object-owners",base}};
            vault=lb_ag_apply(&g,p->owners,args,3,NULL,0);lb_ag_lifecycle(&g,vault,prefix);
        }
        ins[ni++]=(lb_pg_arg){"leases",vault};
        for(size_t j=0;j<p->n_channels;j++){
            const lb_ap_channel *c=p->channels+j;
            if(c->copied)ins[ni++]=lb_ag_instance(&g,i,c->copied);
            fns[j]=lb_ag_func(&g,i,c->turn);
        }
        unsigned jobs=lb_ag_apply(&g,p->jobs,ins,ni,fns,p->n_channels);free(ins);free(fns);
        app[na++]=lb_ag_instance(&g,jobs,p->tasks);
        for(size_t j=0;j<p->n_controls;j++)lb_ag_control(&g,jobs,p->controls[j],prefix);
    }
    if(!g.b.bad){
        unsigned consumer=lb_ag_apply(&g,guest,app,na,NULL,0);
        lb_pg_arg entry=lb_ag_func(&g,consumer,"run");entry.name="app";
        /* The supervisor import enforces async func() -> s64 at validation
         * time, before a consumer initializer can perform any effects. */
        unsigned s=lb_ag_apply(&g,pkgs[0]->supervisor,NULL,0,&entry,1);
        const char *names[]={"launch","tick","done","take"};for(unsigned j=0;j<4;j++)lb_ag_control(&g,s,names[j],"");
    }
    return g.b;
}
#endif
