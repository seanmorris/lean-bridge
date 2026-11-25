#include <stdlib.h>
#include "application-peer.h"
#include "application-operations.h"
#include "peer-data.h"

static void *create(void){return calloc(1,sizeof(lwit_operations));}
static wasmtime_error_t *link_api(wasmtime_component_linker_t *l,void *state){return lwit_operations_link(l,state);}
static bool open_api(lwit_store *s,void *state){return lwit_operations_open(s,state);}
static bool close_api(void *state){return lwit_operations_close(state)==LB_PEER_OK;}

__attribute__((visibility("default"))) const lb_peer_package *lean_bridge_wit_peer_v1(void){
    static const lb_peer_package api={1,sizeof(lb_peer_package),LB_PEER_NAMES,
        {native_type,sizeof native_type},{vault,sizeof vault},{facade,sizeof facade},create,link_api,open_api,close_api,free};
    return &api;
}
