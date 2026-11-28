// C++ application compiled against only the installed package.
#include "workshop.hpp"
#include <cassert>
#include <cstdio>
#include <exception>
#include <optional>
#include <type_traits>
struct Failure { int code; };
struct Meter : std::enable_shared_from_this<Meter> {
    uint32_t value, reads=0; std::exception_ptr failure;
    explicit Meter(uint32_t n):value(n) {}
    uint32_t read() { ++reads; if(failure) std::rethrow_exception(failure); return value; }
    uint32_t getLevel() const { return value; }
    void setLevel(uint32_t x) { value=x; }
    std::shared_ptr<Meter> identity() { return shared_from_this(); }
    std::string echoText(std::string s) { return s; }
    std::vector<uint8_t> echoBytes(std::vector<uint8_t> b) { return b; }
    template<class N> N shift(N n) { return n; }
};
using Binding=lean_bridge::workshop::Binding<Meter>;
using Pair=Binding::Pair;
using Big=boost::multiprecision::cpp_int;
struct Different : Meter { using Meter::Meter; };
template<class T> concept Accepted = requires(Binding& b,const T& t){ b.flip(t); };
static_assert(Accepted<Pair> && !Accepted<lean_bridge::workshop::Binding<Different>::Pair>);
static_assert(std::is_same_v<decltype(std::declval<Pair>().lead()),std::shared_ptr<Meter>>);
template<class E,class F> void refuses(F f) {
    try { f(); assert(false); } catch(const E&) {}
}
int main() {
    Binding b; std::weak_ptr<Meter> left,right;
    std::optional<Pair> last;
    {
        auto x=std::make_shared<Meter>(23), y=std::make_shared<Meter>(19);
        left=x; right=y;
        std::vector<uint8_t> bytes{9,8}; Big n=(Big(1)<<130)+5;
        Pair a{x,bytes,n,y}; bytes[0]=0;
        assert(a.sample()[0]==9 && a.sequence()==n);
        auto other=b.create_pair(x); auto moved=std::move(other);
        refuses<std::invalid_argument>([&]{ (void)b.sum_read(a,other); });
        assert(x->reads==0 && y->reads==0 && b.sum_read(moved,a)==42);
        auto failure=std::make_exception_ptr(Failure{173}); x->failure=failure;
        try { (void)b.flip(a); assert(false); }
        catch(const Failure& f) { assert(f.code==173 && std::current_exception()==failure); }
        x->failure={}; last.emplace(b.flip(a));
        assert(last->lead()==y && last->spare()==x && last->sequence()==n+1);
        auto copy=last->sample(); assert((copy==std::vector<uint8_t>{9,8,23})); copy[0]=0;
        assert(last->sample()[0]==9);
        auto choose=b.choose(a); assert(choose(false)==y);
        assert(!y.owner_before(choose(false)) && !choose(false).owner_before(y));
        auto budget=std::make_shared<Meter>(7); std::weak_ptr<Meter> weak=budget;
        std::vector<uint8_t> large(9u*1024*1024);
        refuses<std::length_error>([&]{ (void)b.duplicate_sample(budget,large); });
        budget.reset(); assert(weak.expired() && choose(true)==x);
        choose.close();
    }
    b.close(); assert(!left.expired() && !right.expired());
    auto held=last->spare(); last.reset(); assert(right.expired() && held==left.lock());
    assert(held->read()==23); held.reset(); assert(left.expired());
    puts("C++ records: original shared owners, copied values, typed identity, rollback and independent RAII");
}
