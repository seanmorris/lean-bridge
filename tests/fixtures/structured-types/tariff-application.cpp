// Downstream application: only the generated public C++ API. The independent
// observer checks the broker after each scope and after the owner thread exits.
#include "tariff_quotes.hpp"
#include <cassert>
#include <cstdio>
#include <exception>
#include <thread>
#include <vector>

namespace api = lean_bridge::tariff_quotes;
using Quote = decltype(api::make_tariff(0).quote);
struct Failure {};
void checkpoint(const char *);
void after_owner_exit();

static void stale(const Quote& q) {
    try { (void)q(999); assert(false); }
    catch (const api::Error& e) { assert(e.status == TARIFF_QUOTES_CALLBACK_FAILED); }
}
static void scenarios() {
    assert(api::flat_quote([](uint32_t a, uint32_t b) { return a+b; }, 1, 2) == 3);
    std::vector<uint32_t> trace;
    auto price = [&](uint32_t n) -> uint32_t { trace.push_back(n); return 40+n; };
    { auto expired = api::pass_application_quote(price); stale(expired); }
    assert(trace.empty()); checkpoint("expired");
    {
        Quote saved;
        const auto fallback = api::make_tariff(800).quote;
        const auto value = api::visit_application_quote(price, [&](const Quote& q, uint32_t n) {
            saved = q.retain();
            auto live = api::pass_application_quote(q);
            assert(live(0) == 40);
            return api::staged_quote(api::with_recovery([&](uint32_t) { return live; }, fallback), 99, n);
        }, 2);
        assert(value == 42); std::printf("forwarded:%u\n", static_cast<unsigned>(value)); stale(saved);
    }
    checkpoint("forward");
    const auto original = std::make_exception_ptr(Failure{});
    const auto after = api::visit_application_quote(price, [&](const Quote& outer, uint32_t n) {
        try {
            api::visit_application_quote([&](uint32_t) -> uint32_t { std::rethrow_exception(original); },
                [](const Quote& inner, uint32_t m) { return inner(m); }, 99);
            assert(false);
        } catch (const Failure&) { assert(std::current_exception() == original); }
        return outer(n);
    }, 3);
    assert((after == 43 && trace == std::vector<uint32_t>{0,2,3}));
    std::printf("after-failure:%u\n", static_cast<unsigned>(after)); checkpoint("nested");
#ifdef TARIFF_FUNCTION_ONLY
    for (bool fail : {false,true}) {
        Quote borrow, retained;
        unsigned visits=0;
        try {
            const auto result = api::visit_application_quote(price, [&](const Quote& q, uint32_t n) -> uint32_t {
                ++visits; borrow=q; retained=q.retain();
                if (fail) std::rethrow_exception(original);
                return q(n);
            }, 4);
            assert(!fail && result == 44);
        } catch (const Failure&) { assert(fail && std::current_exception() == original); }
        assert(visits == 1 && borrow.is_closed()); stale(retained);
        borrow.close(); retained.close();
        checkpoint(fail ? "registration expired after failure" : "registration expired after success");
    }
    assert((trace == std::vector<uint32_t>{0,2,3,4}));
#else
    for (uint32_t n : {42u,71u}) {
        {
            const auto input=api::new_ticket(n), fallback=api::new_ticket(800), reply=api::new_ticket(n+1);
            unsigned calls=0;
            const auto result=api::exchange_ticket(input, api::with_recovery([&](const api::Ticket& t) {
                ++calls; assert(api::ticket_serial(t) == n); return reply;
            }, fallback));
            assert(calls == 1 && result == n+1);
            std::printf("ticket:%u:%u\n",static_cast<unsigned>(n),static_cast<unsigned>(result));
            try {
                (void)api::exchange_ticket(input, api::with_recovery([&](const api::Ticket& t) -> api::Ticket {
                    assert(api::ticket_serial(t) == n); std::rethrow_exception(original);
                }, fallback)); assert(false);
            } catch (const Failure&) { assert(std::current_exception() == original); }
            assert(api::ticket_serial(input) == n && api::ticket_serial(fallback) == 800);
        }
        checkpoint(n == 42 ? "ticket42" : "ticket71");
    }
#endif
    assert(api::make_tariff(900).quote(3) == 903); checkpoint("fresh");
}
int main() { std::thread owner(scenarios); owner.join(); after_owner_exit(); }
