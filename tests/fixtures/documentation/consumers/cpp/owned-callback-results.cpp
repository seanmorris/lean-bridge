#include "owned_aggregates.hpp"
#include <cassert>
#include <iostream>

namespace api = lean_bridge::owned_aggregates;

int main() {
    auto ticket = api::new_ticket(42, "callback");
    api::Bundle raw{ticket.get(), {}, {}, {}, {api::Int(0), {}}};
    auto captured = api::echo_record(raw);
    auto supplied = api::echo_record(raw);
    auto closure = api::make_record(captured);
    auto borrowed = closure(true, supplied);
    auto kept = borrowed.retain();
    supplied.close();
    assert(borrowed.is_closed());
    captured.close();
    closure.close();
    std::cout << api::serial(kept->primary) << '\n';
}
