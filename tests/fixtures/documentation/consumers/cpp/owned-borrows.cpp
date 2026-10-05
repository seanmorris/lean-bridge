#include "owned_aggregates.hpp"
#include <cassert>
#include <iostream>

namespace api = lean_bridge::owned_aggregates;

int main() {
    auto owner = api::new_ticket(42, "example");
    auto borrowed = api::retain_ticket(owner);
    auto kept = borrowed.retain();
    assert(borrowed == owner);
    owner.close();
    assert(borrowed.is_closed());
    std::cout << api::serial(kept) << '\n';
}
