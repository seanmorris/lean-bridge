/* Test-only linker wrappers. Every fault starts with the actual Lean call. */
#include <stdint.h>
#include <stdlib.h>
#include <string.h>
static int mode,released,seen;
static uintptr_t live;
void wit_test_arm(int m) { mode=m; }
int wit_test_released(void) { return released; }
int wit_test_live(void) { return live!=0; }
int wit_test_seen(void) { return seen; }
extern void REAL_CLEAR(uint64_t *);
void WRAP_CLEAR(uint64_t *w) {
    if (live && w[0]==live && w[3]==1) { released++; live=0; }
    REAL_CLEAR(w);
}
extern int REAL_BYTES(const uint64_t *,uint64_t *,uint8_t *);
int WRAP_BYTES(const uint64_t *a,uint64_t *w,uint8_t *tags) {
    int s=REAL_BYTES(a,w,tags);
    if (!mode || s || w[3]!=1 || !w[0]) return s;
    int m=mode; mode=0; seen++;
    if (m==1 || m==2) { REAL_CLEAR(w); return m==1?1:12; }
    if (m==3) tags[0]=1;
    else if (m==4) {
        REAL_CLEAR(w);
        w[1]=1024u*1024u; w[0]=(uintptr_t)calloc(w[1],1); w[3]=1; if (!w[0]) abort();
    } else abort();
    live=w[0]; return s;
}
extern int REAL_STRING(const uint64_t *,uint64_t *,uint8_t *);
int WRAP_STRING(const uint64_t *a,uint64_t *w,uint8_t *tags) {
    int s=REAL_STRING(a,w,tags);
    if (mode==5 && !s && w[3]==1 && w[1]) {
        mode=0; seen++; live=w[0]; *(uint8_t *)(uintptr_t)w[0]=255;
    }
    return s;
}
extern int REAL_BUMP(const uint64_t *,uint64_t *,uint8_t *);
int WRAP_BUMP(const uint64_t *a,uint64_t *w,uint8_t *tags) {
    int s=REAL_BUMP(a,w,tags);
    if (mode==6 && !s && w[0]==2) { mode=0; seen++; }
    return s;
}
