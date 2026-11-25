// Only installed headers. This class has no Lean base class or bridge callbacks.
#include "workshop.hpp"
#include "peer.hpp"
#include <cassert>
#include <cstdio>
#include <functional>
#include <thread>
#include <sys/wait.h>
namespace sv=lean_bridge::sync_v1;
struct Refused { int reason; };
template<int N> struct Meter : std::enable_shared_from_this<Meter<N>> {
    static inline int destroyed=0;
    uint32_t level; std::exception_ptr error; std::function<void()> nested; bool invalid=false;
    explicit Meter(uint32_t n):level(n) {}
    ~Meter(){++destroyed;}
    uint32_t read(){if(nested) nested(); if(error) std::rethrow_exception(error); return level;}
    void setLevel(uint32_t v){level=v;}
    uint32_t getLevel() const{return level;}
    std::shared_ptr<Meter> identity(){return invalid?nullptr:this->shared_from_this();}
    std::string echoText(std::string s){return s+"!";}
    std::vector<uint8_t> echoBytes(std::vector<uint8_t> v){v.push_back(255);return v;}
    template<class Integer> Integer shift(Integer n){return n-5;}
};
using M=Meter<0>;
using A=lean_bridge::workshop::Binding<M>;
using B=lean_bridge::peer::Binding<M>;
int main() {
    A a; B b;
    try {lean_bridge::peer::Binding<Meter<1>> wrong; assert(false);} catch(const std::invalid_argument&) {}
    auto x=a.make(12), same=b.identity(x); std::weak_ptr<M> weak=x;
    assert(x==same && !x.owner_before(same) && !same.owner_before(x));
    assert(b.update(x,41)==41 && x->level==41 && a.read(x)==41);
#ifdef CHECK_COPIED_MEMBERS
    assert(a.text(x,std::string("a\0b",3))==std::string("a\0b!",4));
    assert(b.bytes(x,{0,128})==std::vector<uint8_t>({0,128,255}));
    const boost::multiprecision::cpp_int n=(boost::multiprecision::cpp_int(1)<<300)+7;
    assert(a.shift(x,-n)==-n-5 && b.shift(x,n)==n-5);
    assert(a.natural(n)==n && b.natural(0)==0);
    try {(void)a.natural(-1); assert(false);} catch(const std::invalid_argument&) {}
    b.update(x,0); try {(void)a.read_online(x); assert(false);} catch(const sv::IOError& e) {
        assert(e.declaration=="Workshop.readOnline" && e.message=="meter disconnected");
    }
    assert(a.update(x,41)==41);
#endif
    auto other=std::make_shared<M>(13);
    other->error=std::make_exception_ptr(Refused{91});
    x->nested=[&]{
        try {a.close(); assert(false);} catch(const sv::Busy&) {}
        try {(void)b.read(other); assert(false);} catch(const Refused& e) {
            assert(e.reason==91 && std::current_exception()==other->error);
        }
    };
    assert(a.read(x)==41);
    x->nested={}; x->error=std::make_exception_ptr(Refused{37});
    try {(void)a.read(x); assert(false);} catch(const Refused& e) {
        assert(e.reason==37 && std::current_exception()==x->error);
    }
    try {(void)b.mapped(x); assert(false);} catch(const sv::DeclaredError<std::string>& e) {
        assert(e.payload=="host read failed" && e.declaration=="Workshop.mapped");
    }
    try {(void)b.fail_with(x); assert(false);} catch(const sv::DeclaredError<std::shared_ptr<M>>& e) {
        assert(e.payload==x && !e.payload.owner_before(x) && !x.owner_before(e.payload));
    }
    auto result=a.choose(x,true);
    assert(std::get<sv::Ok<std::shared_ptr<M>>>(result).value==x);
    result=a.choose(x,false); assert(std::get<sv::Err<uint32_t>>(result).value==17);
    x->error={};
    try {(void)a.read(nullptr); assert(false);} catch(const std::invalid_argument&) {}
    std::thread worker([&]{try {(void)b.read(x); assert(false);} catch(const sv::WrongContext&) {}});
    worker.join();
    auto child=fork(); assert(child>=0);
    if(!child) {try {(void)a.read(x); _exit(2);} catch(const sv::WrongContext&) {_exit(0);}}
    int status=0; assert(waitpid(child,&status,0)==child && WIFEXITED(status) && !WEXITSTATUS(status));
    a.close(); a.close(); assert(b.read(same)==41);
    try {(void)a.read(x); assert(false);} catch(const sv::Closed&) {}
    std::thread disposer([m=std::move(b)]{}); disposer.join();
    sv::drain_host_closes();
    other.reset(); x.reset(); assert(!weak.expired()); same.reset();
    assert(weak.expired() && M::destroyed==2);
    // Last owner's destruction during a callback waits for the in-flight call.
    auto final=std::make_unique<A>(); auto probe=std::make_shared<M>(77);
    probe->nested=[&]{final.reset();}; assert(final->read(probe)==77 && !final);
    probe->nested={};
    A first; B second; probe->invalid=true;
    try {(void)first.identity(probe); assert(false);} catch(const sv::Unavailable&) {}
    try {(void)second.read(probe); assert(false);} catch(const sv::Unavailable&) {}
    first.close(); second.close(); probe.reset(); assert(M::destroyed==3);
    std::puts("C++ shared identity and original exception, cleanup after retirement");
}
