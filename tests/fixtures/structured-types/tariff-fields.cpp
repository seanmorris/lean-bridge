/* An installed application can build the record itself: no native handle or C callback. */
#include "tariff_quotes.hpp"
#include <cassert>
#include <thread>

namespace api = lean_bridge::tariff_quotes;
using Tariff = decltype(api::make_tariff(0));
void checkpoint(const char *);
void after_owner_exit();

static void scenarios() {
    {
        auto first = api::make_tariff(40);
        auto copy = first;
        first.quote.close();
        assert(copy.quote(2) == 42 && api::apply_tariff(copy, 3) == 43);
    }
    checkpoint("a record copy survives explicit field close");
    {
        auto fn = api::unpack_quote(api::make_tariff(20));
        Tariff input{fn};
        auto out = api::echo_tariff(input);
        fn.close(); input.quote.close();
        assert(out.quote(22) == 42 && api::apply_tariff(out, 5) == 25);
    }
    checkpoint("caller-built record returns a callable field");
    {
        auto value = api::make_tariff(36);
        auto fn = api::unpack_quote(value);
        value.quote.close();
        auto repacked = api::pack_quote(fn);
        fn.close();
        assert(repacked.quote(6) == 42);
    }
    checkpoint("repacked function outlives the original wrappers");
    {
        unsigned entries = 0;
        auto expired = api::pack_quote([&](uint32_t n) -> uint32_t { ++entries; return n; });
        try { (void)expired.quote(1); assert(false); }
        catch (const api::Error& e) { assert(e.status == TARIFF_QUOTES_CALLBACK_FAILED); }
        assert(entries == 0);
        try { (void)api::apply_tariff(expired, 1); assert(false); }
        catch (const api::Error& e) { assert(e.status == TARIFF_QUOTES_CALLBACK_FAILED); }
        assert(entries == 0);
    }
    checkpoint("storing a host borrow cannot extend its call scope");
    {
        auto closed = api::make_tariff(7);
        closed.quote.close();
        try { (void)api::echo_tariff(closed); assert(false); }
        catch (const api::Error& e) { assert(e.status == TARIFF_QUOTES_CLOSED); }
    }
    checkpoint("closed input field rejected");
    {
        const auto healthy = api::make_tariff(41);
        assert(healthy.quote(1) == 42 && api::apply_tariff(healthy, 2) == 43);
    }
    checkpoint("subsequent valid record accepted");
}
int main() { std::thread owner(scenarios); owner.join(); after_owner_exit(); }
