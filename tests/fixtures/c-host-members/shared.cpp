#include "host-shared.hpp"
#include <cassert>
#include <cstdio>
#include <thread>
#include <sys/wait.h>
#include <unistd.h>
constexpr char kind[]="aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
constexpr char other[]="bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
int main() {
    int destroyed=0;
    std::shared_ptr<void> p(new int(9),[&](void *v){
        ++destroyed;
        std::shared_ptr<void> resurrect(v,[](void*){}); lb_cr_ref refused{};
        assert(LB_CPP_OWNER(pin)(kind,&resurrect,&refused)==CR_INVALID);
        delete static_cast<int*>(v);
    });
    lb_cr_ref a{},b{},none{};
    assert(LB_CPP_OWNER(pin)(kind,&p,&a)==CR_OK && LB_CPP_OWNER(pin)(kind,&p,&b)==CR_OK);
    std::shared_ptr<void> same_address(p.get(),[](void*){}),unowned(std::shared_ptr<void>{},p.get());
    assert(LB_CPP_OWNER(pin)(kind,&same_address,&none)==CR_INVALID);
    assert(LB_CPP_OWNER(pin)(kind,&unowned,&none)==CR_INVALID);
    assert(LB_CPP_OWNER(pin)(other,&p,&none)==CR_INVALID);
    std::shared_ptr<void> recovered;
    assert(LB_CPP_OWNER(share)(kind,a,&recovered)==CR_OK && p.get()==recovered.get());
    assert(!p.owner_before(recovered) && !recovered.owner_before(p));
    int eq=0; assert(LB_CR(same)(kind,a,b,&eq)==CR_OK && eq);
    auto wrong_thread=[&]{std::shared_ptr<void> bad;lb_cr_ref out{};
        assert(LB_CPP_OWNER(share)(kind,a,&bad)==CR_UNAVAILABLE && !bad);
        assert(LB_CPP_OWNER(pin)(kind,&p,&out)==CR_UNAVAILABLE && !out.ticket);
    };
    std::thread t(wrong_thread); t.join();
    pid_t child=fork(); assert(child>=0);
    if(!child) {wrong_thread(); _exit(0);}
    int status=0;assert(waitpid(child,&status,0)==child && WIFEXITED(status) && WEXITSTATUS(status)==0);
    auto stale=a; assert(LB_CR(drop)(kind,&a)==CR_OK);
    p.reset(); assert(!destroyed);
    recovered.reset(); assert(!destroyed);
    assert(LB_CPP_OWNER(share)(kind,stale,&recovered)==CR_STALE);
    assert(LB_CR(drop)(kind,&b)==CR_OK && destroyed==1);
    int foreign=0;assert(LB_CR(adopt)(kind,&foreign,nullptr,nullptr,&none)==CR_OK);
    assert(LB_CPP_OWNER(share)(kind,none,&recovered)==CR_INVALID && !recovered);
    assert(LB_CR(drop)(kind,&none)==CR_OK);
    std::puts("C++ shared owner: same control block, exact destruction");
}
