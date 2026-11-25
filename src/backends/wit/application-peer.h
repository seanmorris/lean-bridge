/* Private ABI between the installed peer runner and a trusted package's native
 * adapter. The two Wasm guest inputs never see these pointers or functions. */
#ifndef LB_WIT_APPLICATION_PEER_H
#define LB_WIT_APPLICATION_PEER_H
#include "application-object-store.h"
typedef struct {const uint8_t *data;size_t size;} lb_peer_bytes;
typedef struct {
    uint32_t version,size;
    const char *abi,*compat,*objects,*exchange,*native,*api;
    lb_peer_bytes native_type,vault,facade;
    void *(*create)(void);
    wasmtime_error_t *(*link)(wasmtime_component_linker_t *,void *);
    bool (*open)(lwit_store *,void *);
    bool (*close)(void *);
    void (*destroy)(void *);
} lb_peer_package;
typedef const lb_peer_package *(*lb_peer_query)(void);
#endif
