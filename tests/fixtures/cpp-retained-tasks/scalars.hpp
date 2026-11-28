#pragma once
#include <cmath>
#include <limits>
inline void scalars() {
    const b::Nat n = (b::Nat(1) << 4095) + 23;
    b::scalar_tour(
        [] { return true; }, [](bool v) { assert(v); return U'🎼'; },
        [](char32_t c) { assert(c == U'🎼'); return std::string("λ\0é", 5); },
        [](std::string s) { assert(s == std::string("λ\0é", 5)); return std::vector<std::uint8_t>{0,255}; },
        [&](std::vector<std::uint8_t> v) { assert((v == std::vector<std::uint8_t>{0,255})); return n; },
        [&](b::Nat v) -> b::Int { assert(v == n); return -v; },
        [&](b::Int v) { assert(v == -n); return UINT8_MAX; },
        [](std::uint8_t v) { assert(v == UINT8_MAX); return UINT16_MAX; },
        [](std::uint16_t v) { assert(v == UINT16_MAX); return UINT32_MAX; },
        [](std::uint32_t v) { assert(v == UINT32_MAX); return UINT64_MAX; },
        [](std::uint64_t v) { assert(v == UINT64_MAX); return SIZE_MAX; },
        [](std::size_t v) { assert(v == SIZE_MAX); return INT8_MIN; },
        [](std::int8_t v) { assert(v == INT8_MIN); return INT16_MIN; },
        [](std::int16_t v) { assert(v == INT16_MIN); return INT32_MIN; },
        [](std::int32_t v) { assert(v == INT32_MIN); return INT64_MIN; },
        [](std::int64_t v) { assert(v == INT64_MIN); return INTPTR_MIN; },
        [](std::intptr_t v) { assert(v == INTPTR_MIN); return -0.0f; },
        [](float v) { assert(v == 0 && std::signbit(v)); return std::numeric_limits<double>::infinity(); },
        [](double v) { assert(std::isinf(v) && v > 0); }
    ).get();
}
