#include "application-record-table.h"
#include <assert.h>

static lwit_record_table t;
static uint32_t first;
static unsigned drops;
static bool plain(uint64_t owner[2]) {assert(owner[0] && owner[1]);++drops;return true;}
static bool reentrant(uint64_t owner[2]) {
    uint64_t stale[2]={0};
    assert(!lwit_record_lookup(&t,first,reentrant,stale));
    assert(!lwit_record_remove(&t,first,reentrant));
    return plain(owner);
}
int main(void) {
    uint64_t owner[2]={UINT64_MAX,UINT64_MAX-1}, copy[2]={0};
    assert(lwit_record_save(&t,reentrant,owner,&first) && !owner[0] && !owner[1]);
    assert(!lwit_record_lookup(&t,first,plain,copy));
    assert(lwit_record_lookup(&t,first,reentrant,copy) && copy[0]==UINT64_MAX && copy[1]==UINT64_MAX-1);
    assert(lwit_record_remove(&t,first,reentrant) && drops==1);
    uint32_t ids[LWIT_RECORD_LIMIT]={0};
    for (unsigned i=0;i<LWIT_RECORD_LIMIT;++i) {
        uint64_t next[2]={9,i+1u};
        assert(lwit_record_save(&t,plain,next,&ids[i]) && ids[i]!=first);
    }
    uint32_t limit=0;uint64_t extra[2]={1,2}, empty[2]={0};
    assert(!lwit_record_save(&t,plain,extra,&limit) && extra[1]==2 && !limit);
    assert(!lwit_record_lookup(&t,first,plain,empty));
    assert(lwit_record_remove(&t,ids[2],plain));
    assert(lwit_record_save(&t,plain,extra,&limit) && limit!=ids[2]);
    assert(lwit_record_table_close(&t) && lwit_record_table_close(&t) && drops==LWIT_RECORD_LIMIT+2u);
    assert(!lwit_record_remove(&t,limit,plain) && !lwit_record_save(&t,plain,copy,&limit));
    /* A slot at its last generation is retired, not recycled as generation 1. */
    lwit_record_table last={0};
    uint64_t edge[2]={2,3};uint32_t original=0, fresh=0;
    assert(lwit_record_save(&last,plain,edge,&original));
    uint32_t index=original & (LWIT_RECORD_LIMIT-1u);
    last.slots[index].generation=LWIT_RECORD_LAST_GEN;
    assert(lwit_record_remove(&last,(LWIT_RECORD_LAST_GEN<<LWIT_RECORD_BITS)|index,plain));
    edge[0]=4;edge[1]=5;
    assert(lwit_record_save(&last,plain,edge,&fresh) && (fresh & (LWIT_RECORD_LIMIT-1u))!=index);
    assert(!lwit_record_lookup(&last,original,plain,empty) && lwit_record_table_close(&last));
    return 0;
}
