/* Build the outer component from trusted package adapters. Guest-supplied
 * bytes are embedded only as isolated components. The guest cannot change an
 * outer import, see a private native port, or substitute a resource type. */
#ifndef LB_WIT_PEER_GRAPH_H
#define LB_WIT_PEER_GRAPH_H
#include "application-peer.h"
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
