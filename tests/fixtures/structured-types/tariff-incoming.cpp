// A callback receives the Lean function itself, not an object field.
#include "tariff_quotes.hpp"
#include <cassert>
#include <exception>
#include <thread>

namespace api = lean_bridge::tariff_quotes;
using Quote = decltype(api::Tariff::quote);
void checkpoint(const char*);
void after_owner_exit();
struct Failure {};

static void expired(const Quote& q) {
    assert(q.is_closed());
    try { (void)q(1); assert(false); }
    catch (const api::Error& e) { assert(e.status == TARIFF_QUOTES_CLOSED); }
}
static void scenarios() {
    const auto error = std::make_exception_ptr(Failure{});
    for (bool keep : {false, true}) for (bool fail : {false, true}) {
        Quote borrowed, retained;
        unsigned entries = 0;
        auto visit = [&](const Quote& q, uint32_t n) -> uint32_t {
            ++entries; borrowed = q;
            if (keep) { retained = q.retain(); assert(retained == q); }
            assert(q(n) == 42);
            if (fail) std::rethrow_exception(error);
            return q(n);
        };
        try { const auto result = api::visit_quote(40, visit, 2); assert(!fail && result == 42); }
        catch (const Failure&) { assert(fail && std::current_exception() == error); }
        assert(entries == 1);
        expired(borrowed);
        if (keep) { assert(!(borrowed == retained) && retained(5) == 45); retained.close(); }
        checkpoint(keep ? (fail ? "lease survives failure" : "lease survives success")
                        : (fail ? "borrow expires after failure" : "borrow expires after success"));
    }
    Quote inner;
    assert(api::visit_quote(30, [&](const Quote& outer, uint32_t n) {
        try {
            api::visit_quote(90, [&](const Quote& q, uint32_t m) -> uint32_t {
                inner = q; assert(q(m) == 93 && !(outer == q)); std::rethrow_exception(error);
            }, 3);
            assert(false);
        } catch (const Failure&) { assert(std::current_exception() == error); }
        expired(inner);
        return outer(n);
    }, 4) == 34);
    checkpoint("inner failure leaves outer borrow valid");
    unsigned calls = 0;
    auto visit = [&](const Quote& q, uint32_t n) { ++calls; return q(n); };
    assert(api::visit_quote(1, visit, 5) == 6 && api::visit_quote(60, visit, 3) == 63 && calls == 2);
    checkpoint("fresh calls use their own captures");
}
int main() { std::thread owner(scenarios); owner.join(); after_owner_exit(); }
