#include <stdlib.h>
#include "application-async-peer.h"
#include "application-peer-io.h"
#include "peer-worker-binding.h"
#include "application-turn-package.h"
#include "peer-worker-data.h"
typedef struct {native_owner n;lb_ts_linker sync;lb_tg_store tasks;} peer;
static void *create(void){return calloc(1,sizeof(peer));}
static bool attach(void *data,lb_wit_turns *root,wasmtime_component_linker_instance_t *ports){
    peer *p=data;lb_wit_turns *r=&p->n.turns;
    return lb_wit_turn_attach(root,r,dispatch,&p->n) && report(lb_ts_link(&p->sync,&p->n.sync,r,ports)) &&
        report(lb_tg_link_all(&p->tasks,&p->n.tasks,ports,r));
}
static bool open_peer(void *data,wasmtime_component_instance_t *i,wasmtime_context_t *ctx,const char *prefix){
    peer *p=data;return lb_tg_open_all_at(&p->tasks,i,ctx,prefix) && start_or_close(&p->n.turns,LB_CMD_OPEN);
}
static wasmtime_error_t *advance(void *data,unsigned *changed){return lb_tg_advance_all(&((peer *)data)->tasks,changed);}
static wasmtime_error_t *collect(void *data,lb_wit_wait_set *set){return lb_tg_collect(&((peer *)data)->tasks,set);}
static wasmtime_error_t *retire(void *data){return lb_tg_retire_all(&((peer *)data)->tasks);}
static bool close_peer(void *data){return start_or_close(&((peer *)data)->n.turns,LB_CMD_CLOSE);}
static wasmtime_error_t *drain(void *data){return lb_tg_drain(&((peer *)data)->tasks);}
static bool finish_peer(void *data){peer *p=data;finish(&p->n);return p->n.finished;}
static bool clear_peer(void *data,lb_wit_turns *root){
    peer *p=data;return !p->sync.ctl.bus || lb_ts_retire_graph(&p->sync.ctl,root);
}
__attribute__((visibility("default"))) const lb_async_peer *lean_bridge_wit_async_peer_v1(void){
    static const lb_async_peer p={1,sizeof p,LB_AP_NAMES,LB_AP_PROGRAMS,
        sizeof channels/sizeof channels[0],sizeof controls/sizeof controls[0],channels,controls,
        create,attach,open_peer,advance,collect,retire,close_peer,drain,finish_peer,clear_peer,free};
    return &p;
}
