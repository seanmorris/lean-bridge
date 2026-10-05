#include "owned_aggregates.hpp"
#include <cassert>
#include <iostream>

namespace api = lean_bridge::owned_aggregates;

int main() {
    auto owner = api::new_ticket(42, "receiver");
    auto view = owner.retain_ticket();
    auto kept = view.retain();
    std::cout << view.serial() << '\n';
    owner.close();
    assert(view.is_closed());
    std::cout << kept.serial() << '\n';
}
