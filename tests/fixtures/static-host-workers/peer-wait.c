/* Two packages have independent channel tables. A quiet peer must not
 * hide a ready one or consume its notification; only the producer owns fd. */
#include "application-turn-wait.h"
#include <assert.h>
#include <unistd.h>
int main(void){
    int a[2],b[2];assert(!pipe(a) && !pipe(b));struct pollfd scratch[4];
    bool active[]={true,true,false},delivered[]={false,true,false},ready;
    int left[]={a[0],b[0],-1},right[]={b[0],-1};
    for(unsigned order=0;order<2;order++){
        lb_wit_wait_set s={.fds=scratch,.capacity=4};char c=0;
        assert(!lb_wit_wait_collect(&s,active,order?right:left,order?NULL:delivered,order?2:3));
        assert(!lb_wit_wait_collect(&s,active,order?left:right,order?delivered:NULL,order?3:2));
        assert(s.used==2 && !s.immediate && !lb_wit_wait_poll(&s,0,&ready) && !ready);
        assert(write(b[1],"B",1)==1 && !lb_wit_wait_poll(&s,2000,&ready) && ready);
        assert(read(b[0],&c,1)==1 && c=='B' && !lb_wit_wait_poll(&s,0,&ready) && !ready);
        int nofd[]={-1};assert(!lb_wit_wait_collect(&s,active,nofd,delivered,1) && s.immediate);
        assert(!lb_wit_wait_poll(&s,2000,&ready) && ready);
    }
    lb_wit_wait_set limited={.fds=scratch,.capacity=1};
    assert(!lb_wit_wait_collect(&limited,active,left,delivered,3));
    assert(lb_wit_wait_collect(&limited,active,right,NULL,2)==ENOSPC && limited.used==1);
    assert(!close(a[1]) && !lb_wit_wait_poll(&limited,0,&ready) && ready);
    assert(!close(a[0]) && lb_wit_wait_poll(&limited,0,&ready)==EBADF);
    assert(!close(b[0]) && !close(b[1]));return 0;
}
