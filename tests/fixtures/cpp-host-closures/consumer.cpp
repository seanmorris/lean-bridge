// An application compiled against just the installed package.
#include "workshop.hpp"
#include <cassert>
#include <cstdio>
#include <exception>
#include <fstream>
#include <functional>
#include <optional>
#include <thread>
namespace sv=lean_bridge::sync_v1;
struct Failure { int code; };
struct Meter : std::enable_shared_from_this<Meter> {
    uint32_t value; unsigned reads=0; bool corrupt=false; std::function<void()> hook;
    explicit Meter(uint32_t n):value(n) {}
    uint32_t read(){ ++reads; if(hook)hook(); return value; }
    uint32_t getLevel() const{return value;}
    void setLevel(uint32_t n){value=n;}
    std::shared_ptr<Meter> identity(){return corrupt?nullptr:shared_from_this();}
    std::string echoText(std::string s){return s;}
    std::vector<uint8_t> echoBytes(std::vector<uint8_t> v){return v;}
    template<class V> V shift(V n){return n;}
};
using Binding=lean_bridge::workshop::Binding<Meter>;
template<class E,class F> void refuses(F f) {
    try {f();assert(false);} catch(const E&) {}
}
int main(int argc,char **argv) {
    Binding a,b;
    auto x=a.make(40),y=a.make(1); std::weak_ptr<Meter> weak=x,other=y;
    auto reader=a.reader(x),sibling=b.reader(y);
    static_assert(!std::is_copy_constructible_v<decltype(reader)>);
    if(argc==2 && std::string(argv[1])=="poison") {
        auto bad=a.identity_reader(x); x->corrupt=true; x.reset(); y.reset();
        refuses<sv::Unavailable>([&]{(void)bad(1);});
        refuses<sv::Unavailable>([&]{(void)sibling(2);});
        bad.close(); reader.close(); assert(weak.expired() && !other.expired());
        a.close(); b.close(); assert(other.expired());
        puts("C++ poisoned closure: captures released after runtime retirement"); return 0;
    }
    auto remember=a.remember(x); assert(remember(y)==x && reader(2)==42);
    std::exception_ptr failure=std::make_exception_ptr(Failure{173});
    y->hook=[&]{std::rethrow_exception(failure);};
    try{(void)remember(y);assert(false);}catch(const Failure& f){assert(f.code==173 && std::current_exception()==failure);}
    y->hook=[&]{assert(reader(3)==43);}; assert(remember(y)==x);
    unsigned before=x->reads;
    std::thread wrong([&]{
        refuses<sv::WrongContext>([&]{(void)reader(2);});
        refuses<sv::WrongContext>([&]{reader.close();});
        refuses<sv::WrongContext>([&]{(void)a.remember(x);});
    }); wrong.join(); assert(before==x->reads && reader(0)==40);
    y->hook=[&]{
        remember.close();
        refuses<sv::Closed>([&]{(void)remember(y);});
        refuses<sv::Busy>([&]{a.close();});
    };
    assert(remember(y)==x); remember.close(); y->hook={};
    auto fresh=a.make(9); std::weak_ptr<Meter> pending=fresh; auto remote=a.reader(fresh); fresh.reset();
    std::thread drop([fn=std::move(remote)]{}); drop.join();
    assert(!pending.expired());
#ifdef TEST_WORKER
    assert(a.echo_box(x).get()==x); // the ordinary owner loop drains queued disposals
    auto file=a.file_reader();
    for(std::string text:{"first","second"}) {
        std::ofstream("input")<<text; assert(file("input")==text);
    }
    file.close();
#else
    sv::drain_host_closes();
#endif
    assert(pending.expired());
    auto moved=std::move(reader); refuses<sv::Closed>([&]{(void)reader(2);});
    x.reset(); assert(!weak.expired()); a.close(); assert(weak.expired());
    refuses<sv::Closed>([&]{(void)moved(2);});
    // Destroy the last Binding in a member of an in-flight returned function.
    // The call finishes with a normal shared_ptr; later calls cannot rebind.
    std::optional<Binding> transient{std::in_place};
    auto cap=transient->make(6); std::weak_ptr<Meter> survivor=cap;
    auto orphan=transient->remember(cap); cap.reset();
    y->hook=[&]{transient.reset();};
    auto got=orphan(y); y->hook={};
    assert(got==survivor.lock() && got->value==6);
    refuses<sv::Closed>([&]{(void)orphan(y);}); got.reset(); assert(survivor.expired());
    assert(sibling(4)==5); y.reset(); assert(!other.expired()); sibling.close(); assert(other.expired()); b.close();
    Binding replacement; refuses<sv::Closed>([&]{(void)moved(2);}); moved.close(); replacement.close();
    puts("C++ returned closures: original shared_ptr, exception identity, self-close, foreign destruction, rebind");
}
