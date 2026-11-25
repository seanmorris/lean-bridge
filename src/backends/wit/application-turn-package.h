/* Operations shared by standalone and composable compiled Lean worker packages. */
#ifndef LB_WIT_TURN_PACKAGE_H
#define LB_WIT_TURN_PACKAGE_H
enum { LB_CMD_OPEN=8192,LB_CMD_CLOSE };
typedef struct {
    lb_wit_turns turns; lb_tc_refs refs; lb_ts_bus sync; lb_tg_native tasks;
    LB_BINDING binding; bool bound,finished;
} native_owner;


static bool dispatch(lb_wit_turns *t,void *data,lb_wit_message in,lb_wit_message *out){
    native_owner *n=data;
    if(in.op==LB_CMD_OPEN){
        if(n->bound || n->refs.turns)return false;
        n->refs.turns=t;n->sync.refs=&n->refs;
        return n->bound=LB_OPEN(&lb_ts_hosts,&n->sync,&n->binding)==LB_OK;
    }
    if(in.op==LB_CMD_CLOSE){
        if(!n->bound || LB_CLOSE(&n->binding)!=LB_OK)return false;
        n->bound=false;return true;
    }
    if(in.op==LB_TS_ENTER)return n->bound && lb_ts_dispatch(&n->sync,n->binding,in,out);
    if(!lb_tg_contains(in.op) || !n->refs.turns)return false;
    unsigned i=(in.op-LB_TG_BASE)/16,op=(in.op-LB_TG_BASE)%16;
    bool drain=op==(lb_tg_specs[i].kind==LB_TG_STREAM?LB_TC_DRAIN:LB_TF_DRAIN);
    return (n->bound || drain) && lb_tg_dispatch(&n->tasks,&n->refs,n->binding,in,out);
}
static void finish(void *data){
    native_owner *n=data;bool ok=lb_tg_shutdown(&n->tasks);
    if(n->bound){if(LB_CLOSE(&n->binding)!=LB_OK)ok=false;n->bound=false;}
    n->finished=ok;
}
static bool start_or_close(lb_wit_turns *t,unsigned op){
    lb_wit_event ev={0};
    return lb_wit_turn_begin(t,(lb_wit_message){.op=op},&ev) && ev.done && ev.message.op==0;
}
#endif
