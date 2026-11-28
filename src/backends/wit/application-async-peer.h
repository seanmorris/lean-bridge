/* Private adapter ABI between trusted installed worker packages. No native
 * pointer, ticket, or scheduler interface is an application guest import. */
#ifndef LB_WIT_ASYNC_PEER_H
#define LB_WIT_ASYNC_PEER_H
#include "application-peer-bytes.h"
#include "application-turn.h"
#include "application-turn-wait.h"
#include <wasmtime.h>
typedef struct {const char *turn,*copied;} lb_ap_channel;
typedef struct {
    uint32_t version,size;
    const char *abi,*compat,*objects,*exchange,*native,*api,*scheduler,*tasks,*callbacks;
    lb_peer_bytes scheduler_type,cells,base,members,turn,facade,owners,jobs,supervisor;
    size_t n_channels,n_controls;
    const lb_ap_channel *channels;const char *const *controls;
    void *(*create)(void);
    bool (*attach)(void *,lb_wit_turns *,wasmtime_component_linker_instance_t *);
    bool (*open)(void *,wasmtime_component_instance_t *,wasmtime_context_t *,const char *);
    wasmtime_error_t *(*advance)(void *,unsigned *);
    wasmtime_error_t *(*collect)(void *,lb_wit_wait_set *);
    wasmtime_error_t *(*retire)(void *);
    bool (*close)(void *);
    wasmtime_error_t *(*drain)(void *);
    bool (*finish)(void *);
    bool (*clear)(void *,lb_wit_turns *);
    void (*destroy)(void *);
} lb_async_peer;
typedef const lb_async_peer *(*lb_async_query)(void);
#endif
