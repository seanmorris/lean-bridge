#include "peer-turn-state.h"
#include <dlfcn.h>
#include <stdio.h>

typedef struct {
    lb_wit_turns root;peer_turn_state p[2];lb_wit_enter enter[2];
    lb_wit_ticket stale;unsigned first,finished;bool stop;
} graph;
static bool application(lb_wit_turns *root,void *data){
    graph *g=data;lb_wit_event e[3]={0},unused={0};
    assert(!lb_wit_turn_begin(root,(lb_wit_message){0},&unused));
    for(unsigned i=0;i<2;i++)assert(lb_wit_turn_attach(root,&g->p[i].route,g->enter[i],&g->p[i]));
    assert(!lb_wit_turn_attach(root,&g->p[0].route,g->enter[0],&g->p[0]));
    for(unsigned j=0;j<3;j++){
        unsigned i=(j+g->first)%2;lb_wit_turns *r=&g->p[i].route;
        assert(lb_wit_turn_begin(r,(lb_wit_message){.op=7,.words={j+1}},e+j));
        assert(!e[j].done && e[j].ticket.owner==r && e[j].message.op==10*(i+1) && e[j].message.words[0]==j+1);
        assert(!lb_wit_turn_retire(r));
        lb_wit_turns late={0};assert(!lb_wit_turn_attach(root,&late,g->enter[i],&g->p[i]));
        if(g->stale.owner)assert(!lb_wit_turn_reply(g->stale.owner,g->stale,(lb_wit_message){0},&unused));
        if(j){
            lb_wit_ticket t=e[j-1].ticket;
            assert(!lb_wit_turn_reply(t.owner,t,(lb_wit_message){0},&unused));
            assert(!lb_wit_turn_reply(t.owner,e[j].ticket,(lb_wit_message){0},&unused));
        }
        if(g->stop && j==1)return lb_wit_turn_retire(root);
    }
    g->stale=e[0].ticket;
    for(unsigned k=3;k;k--){
        unsigned j=k-1,i=(j+g->first)%2;lb_wit_turns *r=&g->p[i].route;
        assert(lb_wit_turn_reply(r,e[j].ticket,(lb_wit_message){.op=8,.words={k}},e+j));
        assert(e[j].done && e[j].message.op==10*(i+1) && e[j].message.words[0]==k+10*(i+1));
        assert(!lb_wit_turn_reply(r,e[j].ticket,(lb_wit_message){0},&unused));
    }
    return true;
}
static bool bounded(lb_wit_turns *root,void *data){
    graph *g=data;lb_wit_event frames[LB_WIT_TURN_DEPTH],ev={0};
    for(unsigned i=0;i<2;i++)assert(lb_wit_turn_attach(root,&g->p[i].route,g->enter[i],&g->p[i]));
    for(unsigned i=0;i<LB_WIT_TURN_DEPTH;i++){
        assert(lb_wit_turn_begin(&g->p[i%2].route,(lb_wit_message){.op=7,.words={i}},frames+i));
        assert(!frames[i].done && frames[i].message.words[0]==i);
    }
    for(unsigned i=0;i<2;i++)assert(!lb_wit_turn_begin(&g->p[i].route,(lb_wit_message){.op=7},&ev));
    for(unsigned k=LB_WIT_TURN_DEPTH;k;k--){
        unsigned i=k-1;assert(lb_wit_turn_reply(&g->p[i%2].route,frames[i].ticket,(lb_wit_message){.op=8,.words={i}},&ev));
        assert(ev.done && ev.message.words[0]==i+10*((i%2)+1));
    }
    return true;
}
static void finish(void *data){
    graph *g=data;assert(pthread_equal(pthread_self(),g->p[0].owner));
    assert(!g->p[0].active && !g->p[1].active);++g->finished;
}
int main(int argc,char **argv){
    assert(argc==3);graph g={0};void *lib[2];
    for(unsigned i=0;i<2;i++){
        lib[i]=dlopen(argv[i+1],RTLD_NOW|RTLD_LOCAL);assert(lib[i]);
        g.enter[i]=(lb_wit_enter)dlsym(lib[i],"peer_dispatch");assert(g.enter[i]);
        g.p[i].owner=pthread_self();g.p[i].other=&g.p[1-i].route;
    }
    for(unsigned j=0;j<4;j++){
        g.first=j%2;g.stop=j>=2;
        assert(lb_wit_turn_run(&g.root,NULL,finish,&g,application,&g));
        for(unsigned i=0;i<2;i++){
            lb_wit_event e={0};assert(!g.p[i].route.loop);
            assert(!lb_wit_turn_begin(&g.p[i].route,(lb_wit_message){0},&e));
        }
    }
    assert(g.finished==4);
    assert(lb_wit_turn_run(&g.root,NULL,finish,&g,bounded,&g) && g.finished==5);
    for(unsigned i=0;i<2;i++){
        unsigned nested=(LB_WIT_TURN_DEPTH+1-i)/2;
        assert(g.p[i].calls==5+nested && g.p[i].returned==3+nested && g.p[i].unwound==2);
        assert(!dlclose(lib[i]));
    }
    puts("two dispatchers; both nested orders; four parked frames unwound");
}
