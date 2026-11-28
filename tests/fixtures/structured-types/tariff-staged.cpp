/* The application never reads a raw handle or supplies the C ABI. */
#include "tariff_quotes.hpp"
#include <cassert>
#include <cstdio>
#include <exception>
#include <thread>

namespace api = lean_bridge::tariff_quotes;
using Quote = decltype(api::unpack_quote(api::make_tariff(0)));
template<class F> concept CanStage = requires(F f) { api::staged_quote(f, 1, 2); };
static_assert(!CanStage<decltype([](uint32_t base) { return api::unpack_quote(api::make_tariff(base)); })>);
static_assert(!CanStage<decltype(api::with_recovery([](uint32_t) { return 9u; }, Quote{}))>);

#ifdef TARIFF_TEST_OBSERVER
void checkpoint(const char *);
void after_owner_exit();
#else
static void checkpoint(const char *name) { std::puts(name); }
#endif

static Quote quote(uint32_t base) { return api::unpack_quote(api::make_tariff(base)); }
static void scenarios() {
    assert(api::flat_quote([](uint32_t a, uint32_t b) { return a * b; }, 9, 3) == 27);
    checkpoint("flat scalar reply");
    {
        auto recovery = quote(900);
        assert(api::staged_quote(api::with_recovery([](uint32_t base) { return quote(base * 10); }, recovery), 9, 3) == 93);
        assert(recovery(1) == 901);
    }
    checkpoint("fresh Lean function reply");
    {
        auto recovery = quote(900), saved = quote(700);
        assert(api::staged_quote(api::with_recovery([&](uint32_t) { return saved; }, recovery), 9, 3) == 703);
        assert(saved(2) == 702);
    }
    checkpoint("independent caller still owns reply");
    {
        unsigned entries = 0;
        try {
            api::staged_quote(api::with_recovery([&](uint32_t base) { ++entries; return quote(base); }, Quote{}), 9, 3);
            assert(false);
        } catch (const api::Error& e) { assert(e.status == TARIFF_QUOTES_CLOSED && entries == 0); }
    }
    checkpoint("closed recovery refused before host entry");
    {
        struct PriceFailure {};
        auto original = std::make_exception_ptr(PriceFailure{});
        auto recovery = quote(900);
        unsigned entries = 0;
        try {
            api::staged_quote(api::with_recovery([&](uint32_t base) -> Quote {
                ++entries;
                auto temporary = quote(base);
                assert(temporary(2) == 11);
                std::rethrow_exception(original);
            }, recovery), 9, 3);
            assert(false);
        } catch (const PriceFailure&) { assert(std::current_exception() == original && entries == 1); }
        assert(recovery(2) == 902);
    }
    checkpoint("original host exception after allocation");
    {
        auto recovery = quote(900);
        unsigned entries = 0;
        try {
            api::staged_quote(api::with_recovery([&](uint32_t base) {
                ++entries;
                auto closed = quote(base); closed.close(); return closed;
            }, recovery), 9, 3);
            assert(false);
        } catch (const api::Error& e) { assert(e.status == TARIFF_QUOTES_CLOSED && entries == 1); }
        assert(api::staged_quote(api::with_recovery([](uint32_t b) { return quote(b); }, recovery), 4, 1) == 5);
    }
    checkpoint("closed reply refused and binding reusable");
}

int main() {
    std::thread owner(scenarios);
    owner.join();
#ifdef TARIFF_TEST_OBSERVER
    after_owner_exit();
#endif
}
