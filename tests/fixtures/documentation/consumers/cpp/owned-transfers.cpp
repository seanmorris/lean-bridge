#include "owned_aggregates.hpp"
#include <cassert>
#include <iostream>
#include <utility>

namespace api = lean_bridge::owned_aggregates;

int main() {
    auto input = api::new_ticket(41, "saved");
    auto alias = input;
    auto kept = input.retain();
    auto output = api::retain_ticket(std::move(input));
    assert(input.is_closed() && alias.is_closed());
    assert(api::serial(kept) == 41);
    assert(api::serial(output) == 41);
    std::cout << "transferred\n";
}
