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
