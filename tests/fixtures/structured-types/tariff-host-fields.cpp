/* No native handles or trampolines: the application supplies the field itself. */
#include "tariff_quotes.hpp"
#include <cassert>
#include <cstdio>
#include <memory>
#include <thread>

namespace api = lean_bridge::tariff_quotes;
using Quote = decltype(api::make_tariff(0).quote);
template<class T> concept Applies = requires(T& row) { api::apply_tariff(row, 1); };
static_assert(!Applies<api::TariffInput<decltype([](uint32_t) { return false; })>>);
static_assert(!Applies<api::TariffInput<int>>);
static_assert(std::same_as<decltype(api::echo_tariff(api::TariffInput{[](uint32_t x) { return x; }})), api::Tariff>);
static_assert(std::same_as<decltype(api::Tariff::quote), Quote>);

#ifdef TARIFF_TEST_OBSERVER
void checkpoint(const char *);
void after_owner_exit();
#else
static void checkpoint(const char *s) { std::puts(s); }
#endif

static void scenarios() {
    {
        auto row = api::TariffInput{[base=std::make_unique<uint32_t>(40)](uint32_t n) mutable { return n + (*base)++; }};
        static_assert(!std::is_copy_constructible_v<decltype(row)>);
        assert(api::apply_tariff(row, 2) == 42 && api::apply_tariff(row, 2) == 43);
    }
    checkpoint("move-only caller function in record");
    {
        const auto row = api::TariffInput{[](uint32_t n) {
            return api::apply_tariff(api::TariffInput{[](uint32_t x) { return x + 39; }}, n) + 1;
        }};
        assert(api::apply_tariff(row, 2) == 42);
    }
    checkpoint("nested record callbacks");
    {
        unsigned calls = 0;
        auto row = api::TariffInput{[&](uint32_t n) { ++calls; return n; }};
        auto escaped = api::echo_tariff(row);
        auto fn = api::unpack_quote(row);
        for (int i=0; i<2; i++) {
            try { (void)api::apply_tariff(escaped, 2); assert(false); }
            catch (const api::Error& e) { assert(e.status == TARIFF_QUOTES_CALLBACK_FAILED); }
            try { (void)fn(2); assert(false); }
            catch (const api::Error& e) { assert(e.status == TARIFF_QUOTES_CALLBACK_FAILED); }
        }
        assert(calls == 0);
    }
    checkpoint("escaped record and function reject without host entry");
    {
        struct Refused {};
        const auto marker = std::make_shared<Refused>();
        unsigned calls = 0;
        auto row = api::TariffInput{[&](uint32_t n) -> uint32_t {
            if (++calls == 1) throw marker;
            return n + 40;
        }};
        try { (void)api::apply_tariff(row, 2); assert(false); }
        catch (const std::shared_ptr<Refused>& same) { assert(same == marker); }
        assert(api::apply_tariff(row, 2) == 42 && calls == 2);
    }
    checkpoint("original exception and healthy retry");
    {
        api::TariffInput row{Quote{}};
        try { (void)api::apply_tariff(row, 2); assert(false); }
        catch (const api::Error& e) { assert(e.status == TARIFF_QUOTES_CLOSED); }
    }
    checkpoint("closed leased field rejected");
    {
        auto kept = api::echo_tariff(api::TariffInput{api::make_tariff(40).quote});
        assert(kept.quote(2) == 42 && api::apply_tariff(kept, 3) == 43);
    }
    checkpoint("genuine Lean lease survives source destruction");
}
int main() {
    std::thread worker(scenarios); worker.join();
#ifdef TARIFF_TEST_OBSERVER
    after_owner_exit();
#endif
}
