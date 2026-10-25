/* Installed C++ consumer for owned proof-erased checked records. */
#include "owned_checked_records.hpp"
#include <cstdio>
#include <cstdlib>
#include <stdexcept>

namespace api = lean_bridge::owned_checked_records;
static size_t checks;
#define CHECK(value) do { ++checks; if (!(value)) { \
  std::fprintf(stderr, "owned checked-record C++ check failed at %s:%d: %s\n", __FILE__, __LINE__, #value); std::abort(); \
} } while (0)

template<class Operation> static void rejects(Operation operation) {
  bool failed = false;
  try { operation(); }
  catch(const api::Error& error) {
    failed = true; CHECK(error.status == OWNED_CHECKED_RECORDS_INVALID_ARGUMENT);
  }
  CHECK(failed);
}

int main(void) {
  auto state = api::detail::current_state();
  if(std::getenv("LEAN_BRIDGE_OWNED_COLD_ONLY")) {
    state->close(); std::puts("cold"); return 0;
  }
  {
    auto ticket = api::new_ticket(41, "native"), retained = ticket.retain();
    CHECK(api::serial(ticket) == 41 && api::serial(retained) == 41);
    const api::Claim claim{ticket, 7};
    const api::Booking booking{ticket, {3, 8}};
    const auto echoed = api::echo_claim(claim);
    const auto echoed_booking = api::echo_booking(booking);
    CHECK(echoed.quota == 7 && api::serial(echoed.holder) == 41);
    CHECK(echoed_booking.window.hi == 8
      && api::serial(echoed_booking.holder) == 41);
    const api::Booking invalid_booking{ticket, {8, 3}};
    for(size_t i = 0; i < 10; ++i) {
      rejects([&] { (void)api::echo_booking(invalid_booking); });
      CHECK(invalid_booking.window.lo == 8 && invalid_booking.window.hi == 3
        && api::serial(invalid_booking.holder) == 41);
    }
    const auto equal_booking = api::echo_booking({ticket, {3, 3}});
    CHECK(equal_booking.window.lo == 3 && equal_booking.window.hi == 3
      && api::serial(equal_booking.holder) == 41);
    CHECK(api::booking_span(booking) == 5 && api::claim_quota(claim) == 7);
    const auto grant = api::echo_grant({ticket, 7, 8});
    CHECK(grant.weight == 7 && grant.limit == 8 && api::serial(grant.holder) == 41);
    rejects([&] { (void)api::echo_grant({ticket, 0, 8}); });
    rejects([&] { (void)api::echo_grant({ticket, 7, 3}); });
    const auto claims = api::echo_claims({claim, claim});
    CHECK(claims.size() == 2 && claims[1].quota == 7
      && api::serial(claims[0].holder) == 41);
    for(size_t i = 0; i < 10; ++i)
      rejects([&] { (void)api::echo_claims({claim, {ticket, 99}}); });
    CHECK(api::echo_claims({}).empty() && api::echo_claims({claim}).size() == 1);
    for(size_t i = 0; i < 100; ++i) {
      const auto repeated = api::echo_claim(claim);
      CHECK(repeated.quota == 7 && api::serial(repeated.holder) == 41);
    }
    rejects([&] { (void)api::echo_claim({ticket, 99}); });
    rejects([&] { (void)api::pair_claim(booking, {ticket, 99}); });
    CHECK(api::serial(ticket) == 41);

    auto moving = api::new_ticket(51, "moving");
    auto kept = moving.retain();
    api::Claim rejected{moving, 99};
    rejects([&] { (void)api::transfer_claim(std::move(rejected)); });
    CHECK(!rejected.holder.is_closed()
      && api::serial(rejected.holder) == 51 && api::serial(kept) == 51);
    api::Claim accepted{moving, 9};
    auto moved = api::transfer_claim(std::move(accepted));
    CHECK(accepted.holder.is_closed() && moving.is_closed());
    CHECK(moved.quota == 9 && api::serial(moved.holder) == 51
      && api::serial(kept) == 51);

    auto first = api::new_ticket(61, "first"), second = api::new_ticket(71, "second");
    auto first_kept = first.retain(), second_kept = second.retain();
    api::Booking moving_booking{first, {3, 8}};
    api::Claim moving_claim{second, 99};
    rejects([&] { (void)api::transfer_pair_claim(std::move(moving_booking), std::move(moving_claim)); });
    CHECK(!first.is_closed() && !second.is_closed()
      && api::serial(moving_booking.holder) == 61 && api::serial(moving_claim.holder) == 71);
    moving_claim.quota = 7;
    const auto pair = api::transfer_pair_claim(std::move(moving_booking), std::move(moving_claim));
    CHECK(first.is_closed() && second.is_closed() && pair.quota == 7);
    CHECK(api::serial(first_kept) == 61 && api::serial(second_kept) == 71);

    for(bool throws : {false, true}) {
      auto input = api::new_ticket(81, "post-transfer"), independent = input.retain();
      api::Claim transferred{input, 7};
      size_t entered = 0;
      bool failed = false;
      try {
        (void)api::transfer_with_claim_callback(std::move(transferred), [&](const api::Claim& incoming) {
          ++entered;
          if(throws) throw std::runtime_error("post-transfer callback");
          return api::Claim{incoming.holder, 99};
        });
      }
      catch(const api::Error& error) {
        CHECK(!throws && error.status == OWNED_CHECKED_RECORDS_INVALID_ARGUMENT); failed = true;
      }
      catch(const std::runtime_error& error) {
        CHECK(throws && std::string(error.what()) == "post-transfer callback"); failed = true;
      }
      CHECK(failed && entered == 1 && input.is_closed() && transferred.holder.is_closed());
      CHECK(api::serial(independent) == 81);
      api::Claim recovery{independent, 7};
      const auto recovered = api::transfer_with_claim_callback(std::move(recovery), [](const api::Claim& incoming) {
        return api::Claim{incoming.holder, 9};
      });
      CHECK(independent.is_closed() && recovered.quota == 9 && api::serial(recovered.holder) == 81);
    }

    size_t callback_calls = 0;
    auto callback_result = api::with_claim_callback(claim
      , [&](const api::Claim& incoming) {
        ++callback_calls; CHECK(incoming.quota == 7);
        return api::Claim{incoming.holder, 10};
      });
    CHECK(callback_calls == 1 && callback_result.quota == 10
      && api::serial(callback_result.holder) == 41);
    rejects([&] {
      (void)api::with_claim_callback(claim, [&](const api::Claim& incoming) {
        ++callback_calls; return api::Claim{incoming.holder, 99};
      });
    });
    CHECK(callback_calls == 2 && api::serial(ticket) == 41);
    const std::runtime_error sentinel("owned checked callback");
    bool callback_thrown = false;
    try {
      (void)api::with_claim_callback(claim, [&](const api::Claim&) -> api::Claim {
        throw sentinel;
      });
    }
    catch(const std::runtime_error& error) {
      callback_thrown = std::string(error.what()) == sentinel.what();
    }
    CHECK(callback_thrown && api::serial(ticket) == 41);

    auto closure = api::claim_closure();
    const auto from_closure = closure(claim);
    CHECK(from_closure.quota == 7 && api::serial(from_closure.holder) == 41);
    rejects([&] { (void)closure(api::Claim{ticket, 99}); });
    const auto reused = closure(api::Claim{ticket, 6});
    CHECK(reused.quota == 6 && api::serial(reused.holder) == 41);
    const auto produced = api::claim_for(retained);
    CHECK(produced && produced->quota == 0
      && api::serial(produced->holder) == 41);

    closure.close(); moved.holder.close(); kept.close(); moving.close();
    callback_result.holder.close(); retained.close(); ticket.close();
    CHECK(closure.is_closed() && kept.is_closed()
      && retained.is_closed() && ticket.is_closed());
  }
  state->drain(); state->close();
  std::printf("owned-checked-record-cpp:%zu\n", checks); return 0;
}
