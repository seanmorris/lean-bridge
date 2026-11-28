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
    struct Pair { int first; };
    auto parent=std::make_shared<Pair>(Pair{91});
    std::shared_ptr<int> field(parent,&parent->first);
    std::shared_ptr<void> a1=parent,a2=field;
    assert(a1.get()==a2.get() && !a1.owner_before(a2) && !a2.owner_before(a1));
    uint64_t w[2]{},v[2]{},invalid[2]{};
    assert(LB_CPP_OWNER(bind_type)(kind,&typeid(Pair))==CR_OK);
    assert(LB_CPP_OWNER(pin_typed)(kind,&typeid(Pair),&a1,w)==CR_OK);
    assert(LB_CPP_OWNER(pin_typed)(other,&typeid(int),&a2,v)==CR_OK);
    assert(LB_CPP_OWNER(share_typed)(other,&typeid(Pair),v,&recovered)==CR_INVALID);
    assert(LB_CPP_OWNER(share_typed)(kind,&typeid(Pair),v,&recovered)==CR_INVALID);
    assert(LB_CPP_OWNER(share_typed)(other,&typeid(int),v,&recovered)==CR_OK);
    assert(recovered.get()==a2.get() && !recovered.owner_before(parent) && !parent.owner_before(recovered));
    std::shared_ptr<void> impostor(a1.get(),[](void*){});
    assert(LB_CPP_OWNER(pin_typed)(other,&typeid(int),&impostor,invalid)==CR_INVALID);
    assert(LB_CPP_OWNER(unbind_type)(kind,&typeid(Pair))==CR_OK);
    // A live object still protects the type claim after the binding closes.
    assert(LB_CPP_OWNER(bind_type)(kind,&typeid(int))==CR_INVALID);
    lb_cr_ref rp{w[0],w[1]},rf{v[0],v[1]};
    assert(LB_CR(drop)(kind,&rp)==CR_OK && LB_CR(drop)(other,&rf)==CR_OK);
    assert(LB_CPP_OWNER(bind_type)(kind,&typeid(int))==CR_OK);
    assert(LB_CPP_OWNER(unbind_type)(kind,&typeid(int))==CR_OK);
    std::puts("C++ shared owner: same control block, exact destruction");
}
