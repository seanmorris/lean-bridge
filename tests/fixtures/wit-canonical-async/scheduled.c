/* Single-threaded embedding for a consumer of two independently parked Lean tasks.
 * No callback into Wasmtime while another call owns the store. */
#define _POSIX_C_SOURCE 200809L
#include <assert.h>
#include <errno.h>
#include <poll.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
#include <unistd.h>
#include <lbc_latches.h>
#include <wasmtime.h>
#include <wasmtime/component.h>
#include <canonical-future-reactor.h>

#define P(name) lbc_latches_##name
enum { LIMIT = 4 };
typedef struct reactor reactor;
typedef struct {
    reactor *r;
    P(parked_handle) owner;
    uint32_t slot;
} operation;
struct reactor {
    lb_cf_reactor driver;
    lb_cf_row rows[LIMIT];
    struct pollfd fds[LIMIT];
    operation ops[LIMIT];
    unsigned keys[LIMIT], order[8];
    unsigned started, taken, released, closed;
};

static void ok(wasmtime_error_t *error) {
    if (!error) return;
    wasm_name_t msg; wasmtime_error_message(error, &msg);
    fprintf(stderr, "%.*s\n", (int)msg.size, msg.data);
    wasm_name_delete(&msg); wasmtime_error_delete(error); exit(1);
}

static bool take_native(void *data, wasmtime_component_val_t *out) {
    operation *op=data; int64_t value=0, duplicate=0;
    if (P(parked_take)(&op->owner,&value)!=P(OK)) return false;
    assert(P(parked_take)(&op->owner,&duplicate)==P(CLOSED));
    assert(op->r->taken < 8);
    op->r->order[op->r->taken++] = op->slot;
    *out=(wasmtime_component_val_t){.kind=WASMTIME_COMPONENT_S64,.of.s64=value}; return true;
}
static void close_native(void *data) {
    operation *op=data;
    assert(P(parked_close)(&op->owner)==P(OK)); assert(!op->owner.id); ++op->r->closed;
}
static wasmtime_error_t *begin(void *data, wasmtime_context_t *ctx, const wasmtime_component_func_type_t *type,
        wasmtime_component_val_t *args, size_t n, wasmtime_component_val_t *out, size_t m) {
    (void)ctx; (void)type; reactor *r = data;
    assert(n == 2 && m == 1 && args[0].kind == WASMTIME_COMPONENT_U32 && args[1].kind == WASMTIME_COMPONENT_S64);
    unsigned key = lb_cf_reserve(&r->driver); assert(key);
    operation *op = &r->ops[key-1]; int fd = -1;
    op->r=r; op->slot = args[0].of.u32; assert(op->slot>=1 && op->slot<=LIMIT);
    r->keys[op->slot-1]=key;
    assert(P(parked_start)(op->slot, args[1].of.s64, &op->owner) == P(OK));
    assert(P(parked_poll)(op->owner, &fd) == P(PENDING));
    assert(lb_cf_arm(&r->driver,key,fd,op,take_native,close_native));
    ++r->started; out[0] = (wasmtime_component_val_t){.kind=WASMTIME_COMPONENT_U32, .of.u32=key};
    return NULL;
}
static wasmtime_error_t *release(void *data, wasmtime_context_t *ctx, const wasmtime_component_func_type_t *type,
        wasmtime_component_val_t *args, size_t n, wasmtime_component_val_t *out, size_t m) {
    (void)ctx; (void)type; (void)out; reactor *r = data; bool released = false;
    assert(n == 1 && !m && args[0].kind == WASMTIME_COMPONENT_U32);
    assert(P(release_call)(args[0].of.u32, &released) == P(OK) && released);
    ++r->released; return NULL;
}

static wasmtime_component_func_t port(wasmtime_component_instance_t *inst, wasmtime_context_t *ctx, const char *name) {
    wasmtime_component_export_index_t *idx = wasmtime_component_instance_get_export_index(inst, ctx, NULL, name, strlen(name));
    wasmtime_component_func_t f; assert(idx && wasmtime_component_instance_get_func(inst, ctx, idx, &f));
    wasmtime_component_export_index_delete(idx); return f;
}
static void step(wasmtime_component_func_t *f, wasmtime_context_t *ctx) {
    wasmtime_error_t *error = NULL;
    wasmtime_call_future_t *next = wasmtime_component_func_call_async(f, ctx, NULL, 0, NULL, 0, &error);
    assert(next);
    const struct timespec pause = {0, 1000000};
    while (!wasmtime_call_future_poll(next)) nanosleep(&pause, NULL);
    wasmtime_call_future_delete(next); ok(error);
}
static wasmtime_component_val_t call(wasmtime_component_func_t *f, wasmtime_context_t *ctx,
        const wasmtime_component_val_t *in, size_t n) {
    wasmtime_component_val_t out = {0}; ok(wasmtime_component_func_call(f, ctx, in, n, &out, 1)); return out;
}
int main(int argc, char **argv) {
    assert(argc == 2); alarm(20);
    FILE *f = fopen(argv[1], "rb"); assert(f && !fseek(f, 0, SEEK_END));
    long len = ftell(f); assert(len > 0 && len < 1048576); rewind(f);
    uint8_t *bytes = malloc((size_t)len); assert(bytes && fread(bytes, 1, (size_t)len, f) == (size_t)len); fclose(f);
    wasm_config_t *cfg = wasm_config_new(); assert(cfg);
    wasmtime_config_wasm_component_model_set(cfg, true);
    wasmtime_config_wasm_component_model_async_set(cfg, true);
    wasmtime_config_wasm_component_model_more_async_builtins_set(cfg, true);
    wasm_engine_t *engine = wasm_engine_new_with_config(cfg); assert(engine);
    wasmtime_component_t *component = NULL; ok(wasmtime_component_new(engine, bytes, (size_t)len, &component)); free(bytes);
    wasmtime_store_t *store = wasmtime_store_new(engine, NULL, NULL); assert(store);
    wasmtime_context_t *ctx = wasmtime_store_context(store);
    wasmtime_component_linker_t *link = wasmtime_component_linker_new(engine);
    wasmtime_component_linker_instance_t *root = wasmtime_component_linker_root(link);
    reactor r = {0};
    ok(wasmtime_component_linker_instance_add_func(root, "begin", 5, begin, &r, NULL));
    ok(wasmtime_component_linker_instance_add_func(root, "release", 7, release, &r, NULL));
    wasmtime_component_linker_instance_delete(root);
    wasmtime_component_instance_t inst; ok(wasmtime_component_linker_instantiate(link, ctx, component, &inst));
    wasmtime_component_func_t launch = port(&inst,ctx,"launch"), tick = port(&inst,ctx,"tick"),
        deliver = port(&inst,ctx,"deliver"), reap = port(&inst,ctx,"reap"),
        done = port(&inst,ctx,"done"), take = port(&inst,ctx,"take");
    r.driver=(lb_cf_reactor){.rows=r.rows,.fds=r.fds,.capacity=LIMIT,.ctx=ctx,.deliver=deliver,.reap=reap};
    step(&launch, ctx);
    for (unsigned round=0; round<12; ++round) {
        step(&tick, ctx);
        wasmtime_component_val_t complete = call(&done, ctx, NULL, 0);
        assert(complete.kind == WASMTIME_COMPONENT_BOOL);
        if (complete.of.boolean) break;
        ok(lb_cf_advance(&r.driver,5000));
    }
    assert(r.started==2 && r.taken==2 && r.released==2 && r.order[0]==2 && r.order[1]==1);
    for (unsigned i=0; i<LIMIT; ++i) assert(r.rows[i].phase==LB_CF_FREE);
    wasmtime_component_val_t result = call(&take, ctx, NULL, 0);
    assert(result.kind == WASMTIME_COMPONENT_S64 && result.of.s64 == INT64_C(100000000000000002));
    wasmtime_component_func_t hold = port(&inst,ctx,"hold"), discard = port(&inst,ctx,"discard"), consume = port(&inst,ctx,"consume");
    const int64_t values[] = {INT64_MIN, INT64_MAX, 37, -123};

    for (unsigned n=0; n<LIMIT; ++n) {
        wasmtime_component_val_t args[] = {{.kind=WASMTIME_COMPONENT_U32,.of.u32=n+1},
            {.kind=WASMTIME_COMPONENT_S64,.of.s64=values[n]}};
        ok(wasmtime_component_func_call(&hold, ctx, args, 2, NULL, 0));
        if (n==3) ok(wasmtime_component_func_call(&discard, ctx, args, 1, NULL, 0));
        unsigned key=r.keys[n]; assert(key && r.rows[key-1].phase==LB_CF_NATIVE);
        if (n==3) assert(!lb_cf_reserve(&r.driver)); /* bounded, no alias with a pinned writer */
        ok(lb_cf_advance(&r.driver,5000));
        assert(r.rows[key-1].phase==(n==3 ? LB_CF_FREE : LB_CF_WRITER));
    }
    for (unsigned n=3; n-- > 0;) {
        wasmtime_component_val_t slot = {.kind=WASMTIME_COMPONENT_U32,.of.u32=n+1};
        if (n==2) ok(wasmtime_component_func_call(&discard,ctx,&slot,1,NULL,0));
        else {
            wasmtime_component_val_t v = call(&consume,ctx,&slot,1);
            assert(v.kind == WASMTIME_COMPONENT_S64 && v.of.s64 == values[n]);
        }
        ok(lb_cf_advance(&r.driver,0)); assert(r.rows[r.keys[n]-1].phase==LB_CF_FREE);
    }
    assert(r.started == 6 && r.taken == 5 && r.released == 6 && r.closed == 1);
    for (unsigned i=0; i<LIMIT; ++i) assert(r.rows[i].phase==LB_CF_FREE);
    wasmtime_component_func_t park=port(&inst,ctx,"park");
    wasmtime_component_val_t last[]={{.kind=WASMTIME_COMPONENT_U32,.of.u32=1},{.kind=WASMTIME_COMPONENT_S64,.of.s64=42}};
    ok(wasmtime_component_func_call(&park,ctx,last,2,NULL,0));
    /* Unlike hold() above, this worker cannot finish until we release the
       Lean gate. Reader drop alone must reclaim its slot and close the owner. */
    ok(wasmtime_component_func_call(&discard,ctx,last,1,NULL,0));
    ok(lb_cf_advance(&r.driver,0)); ok(lb_cf_advance(&r.driver,0));
    assert(r.started==7 && r.released==6 && r.taken==5 && r.closed==2);
    assert(r.rows[r.keys[0]-1].phase==LB_CF_FREE);
    bool late=false; assert(P(release_call)(1,&late)==P(OK) && late);
    ok(wasmtime_component_func_call(&park,ctx,last,2,NULL,0));
    assert(r.started==8 && r.taken==5);
    lb_cf_shutdown(&r.driver); lb_cf_shutdown(&r.driver); assert(r.closed==3 && !lb_cf_reserve(&r.driver));
    late=false; assert(P(release_call)(1,&late)==P(OK) && late);
    wasmtime_component_linker_delete(link); wasmtime_store_delete(store);
    wasmtime_component_delete(component); wasm_engine_delete(engine);
    puts("canonical futures woke the app in order 2,1; exact sum 100000000000000002; both owners consumed");
    puts("reverse reads; reader drop closed a still-parked native owner before release; shutdown closed the eighth owner once");
    return 0;
}
