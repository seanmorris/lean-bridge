#include <lbc_cpp_budget.hpp>
#include <cassert>
#include <exception>
#include <iostream>
#include <memory>
#include <string_view>
#include "observer.h"

namespace api = lean_bridge::lbc_cpp_budget;
#ifdef NDEBUG
#error Assertions are part of this installed test.
#endif
template<class F> void policy(F f) {
    try { f().get(); } catch (const api::CallbackAlreadyInvoked& e) {
        assert(std::string_view(e.what()) == "callback-already-invoked"); return;
    }
    throw std::logic_error("expected the callback admission error");
}
int main() {
    unsigned once=0, many=0;
    auto owner=std::make_shared<int>(1); std::weak_ptr<int> weak=owner;
    auto original=std::make_exception_ptr(std::runtime_error("callback-already-invoked"));
    {
        api::RetainedCallback<std::uint32_t(std::uint32_t)> f{[&,keep=owner](auto n){ once++; return n+*keep; }};
        auto g=[&](std::uint32_t n){ many++; return n+1; };
        policy([&]{return api::probe(1,f,g);}); assert(once==1 && many==2);
        assert(api::pair(40,f,f).get()==42 && once==3);
        assert(api::single(41,f).get()==42 && once==4);
        auto boom=[&](std::uint32_t)->std::uint32_t {++once; std::rethrow_exception(original);};
        policy([&]{return api::retry(1,boom);}); assert(once==5);
        try { api::single(1,boom).get(); assert(false); }
        catch (const std::exception&) { assert(std::current_exception()==original); }
        policy([&]{return api::during_start(1,f);}); assert(once==7);
        try { api::replace(1,f).get(); assert(false); }
        catch (const api::TaskIOError& e) { assert(std::string_view(e.what()).find("callback-already-invoked")!=std::string_view::npos); }
        for (unsigned i=0;i<16;i++) {
            auto before=once; policy([&]{return api::race(i,f);}); assert(once==before+1);
        }
        owner.reset(); assert(!weak.expired());
    }
    assert(weak.expired());
    expect_zero_leases();
    std::cout << "C++20: one-call admission; 16 worker races; separate start, terminal and original exception; capture released; zero leases\n";
}
