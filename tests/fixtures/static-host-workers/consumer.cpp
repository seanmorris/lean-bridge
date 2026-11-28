// Ordinary installed headers only: two independent bindings share application types.
#include "workshop.hpp"
#include "peer.hpp"
#include <cassert>
#include <cstdio>
#include <thread>
namespace av=lean_bridge::async_v2;
namespace sv=lean_bridge::sync_v1;
struct Meter : std::enable_shared_from_this<Meter> {
    uint32_t level;explicit Meter(uint32_t n):level(n){}
    uint32_t read() const {return level;}
    uint32_t getLevel() const {return level;} void setLevel(uint32_t n){level=n;}
    std::shared_ptr<Meter> identity(){return shared_from_this();}
    std::string echoText(std::string s){return s;}
    std::vector<uint8_t> echoBytes(std::vector<uint8_t> v){return v;}
    template<class I>I shift(I n){return n-5;}
};
struct Dial {uint32_t read() const {return 97;}};
using A=lean_bridge::workshop::Binding<Meter,Dial>;
using B=lean_bridge::peer::Binding<Meter,Dial>;
using Box=std::shared_ptr<Meter>;
struct Refused:std::runtime_error {Refused():runtime_error("not today"){}};
struct Observer {
    struct promise_type {
        Observer get_return_object(){return {std::coroutine_handle<promise_type>::from_promise(*this)};}
        std::suspend_never initial_suspend() noexcept{return {};}
        std::suspend_always final_suspend() noexcept{return {};}
        void return_void() noexcept{} void unhandled_exception() noexcept{std::terminate();}
    };
    std::coroutine_handle<promise_type> frame;
    ~Observer(){frame.destroy();}
};
Observer await_retirement(av::Future<uint32_t>& parked,bool& woke){
    try{(void)co_await parked;assert(false);}catch(const av::Unavailable&){woke=true;}
}
av::Routine<Box> use(A& a,B& b,Box x){
    auto identity=co_await a.echo(x);
    assert(identity==x && !identity.owner_before(x) && !x.owner_before(identity));
    co_return co_await a.relay(x,[&](Box arg){assert(b.read(arg)==42);return arg;});
}
int main(){
    A a;B b;auto x=a.make(42);auto weak=std::weak_ptr<Meter>(x);
    assert(use(a,b,x).get()==x);
    auto dial=std::make_shared<Dial>();unsigned calls=0;
    auto same_owner=[](const auto& p,const auto& q){return p==q && !p.owner_before(q) && !q.owner_before(p);};
    assert(same_owner(a.identity(x),x));
    auto hand=a.handoff(x,[&](Box v){assert(same_owner(v,x));++calls;return dial;},
        [&](std::shared_ptr<Dial> d){assert(same_owner(d,dial));++calls;return d->read();});
    assert(hand.get()==97 && calls==2);
    puts("object positions: immediate Box identity; callback received Box and returned the original Dial");
    assert(a.signed_echo(-121).get()==-121);
    boost::multiprecision::cpp_int big=-((boost::multiprecision::cpp_int(1)<<384)+3);
    assert(std::get<sv::Ok<boost::multiprecision::cpp_int>>(a.large_result(big).get()).value==big);
    assert(a.with_buffer(dial,{2,0,255}).get()==std::vector<uint8_t>({2,0,255}));
    assert(std::get<sv::Err<Box>>(a.outcome(x).get()).value==x);
    try{(void)a.reject(x);assert(false);}catch(const av::StartError<Box>& e){assert(e.payload==x);}
    try{(void)a.prepare_io(x,true);assert(false);}catch(const av::IOError& e){assert(e.message=="factory IO");}
    try{(void)a.late_io(x,true).get();assert(false);}catch(const av::TaskIOError& e){assert(e.message=="late IO");}
    auto error=std::make_exception_ptr(Refused{});
    try{(void)a.relay(x,[&](Box)->Box{std::rethrow_exception(error);}).get();assert(false);}
    catch(const Refused&){assert(std::current_exception()==error);}
    using Callback=av::RetainedCallback<Box(Box)>;
    std::optional<Callback> self;unsigned seen=0;
    self.emplace([&](Box arg){++seen;self->close();return arg;});
    try{(void)a.twice(x,*self).get();assert(false);}catch(const av::CallbackClosed&){assert(seen==1);}
    try{(void)a.checked_relay(x,true,[](Box v){return v;}).get();assert(false);}
    catch(const av::StartError<Box>& e){assert(e.payload==x);}
    auto finite=a.finite(x);assert(finite.next().get()==x && !finite.next().get() && !finite.next().get());
    auto steps=a.series(x);assert(steps.next().get()==x);
    try{(void)steps.next().get();assert(false);}catch(const av::StepError<Box>& e){assert(e.payload==x);}
    try{(void)a.broken(x).next().get();assert(false);}catch(const lean_bridge::host_async_v1::StepIOError& e){assert(e.message=="step IO");}
    auto early=a.series(x);auto one=early.next();
    try{(void)early.next();assert(false);}catch(const av::Busy&){}
    early.close();try{(void)one.get();assert(false);}catch(const av::Cancelled&){}
    auto pending=a.dormant();assert(!pending.ready());
    std::thread cancel([&]{pending.cancel();});cancel.join();
    try{(void)pending.get();assert(false);}catch(const av::Cancelled&){}
    auto late=a.dormant();a.close();try{(void)late.get();assert(false);}catch(const av::Cancelled&){}
    auto remote=std::make_unique<A>();auto off=remote->dormant();assert(!off.ready());
    std::thread release([m=std::move(remote)]() mutable {m.reset();});release.join();
    try{(void)off.get();assert(false);}catch(const av::Cancelled&){}
    assert(b.read(x)==42);std::unique_ptr<A> owner=std::make_unique<A>();
    auto inside=owner->relay(x,[&](Box v){owner.reset();return v;});
    try{(void)inside.get();assert(false);}catch(const av::Cancelled&){}
    A last;auto parked=b.dormant();bool woke=false;auto watcher=await_retirement(parked,woke);
    assert(!watcher.frame.done() && !woke);
    try{(void)last.relay(x,[](Box)->Box{throw 17;}).get();assert(false);}catch(const av::CallbackTrap&){}
    for(unsigned i=0;i<8 && !woke;++i)av::run_one(0);
    assert(woke && watcher.frame.done());
    b.close();last.close();x.reset();assert(weak.expired());
    std::puts("installed C++ bound futures and streams");
}
