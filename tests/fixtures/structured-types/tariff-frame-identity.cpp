// Downstream C++20: identity survives retain; the original borrow does not.
#include "tariff_quotes.hpp"
#include <cassert>
namespace api = lean_bridge::tariff_quotes;
using Quote = decltype(api::Tariff::quote);
#ifdef TARIFF_SEPARATE_VALUES_CLIENT
bool frame_identity(const Quote&, const Quote&);
#else
static bool frame_identity(const Quote& a, const Quote& b) { return a == b; }
#endif

int main() {
    Quote borrowed, retained;
    auto other = api::make_tariff(900);
    auto revise = [&](const api::Tariff& input) {
        borrowed = input.quote;
        retained = borrowed.retain();
        assert(frame_identity(borrowed, retained) && retained == borrowed && !frame_identity(borrowed, other.quote));
        return input;
    };
    assert(api::exchange_tariff(api::with_recovery(revise, other), 30, 3) == 33);
    assert(borrowed.is_closed() && !(borrowed == retained) && retained(5) == 35);
    try { (void)borrowed(5); assert(false); }
    catch (const api::Error& error) { assert(error.status == TARIFF_QUOTES_CLOSED); }
}
