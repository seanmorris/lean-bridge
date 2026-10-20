/* Installed C++ consumer for checked fields, RAII and atomic input moves. */
#include "owned_subtypes.hpp"
#include <cstdio>
#include <cstdlib>

namespace api = lean_bridge::owned_subtypes;
static size_t checks;
#define CHECK(value) do { ++checks; if (!(value)) { \
  std::fprintf(stderr, "owned Subtype C++ check failed at %s:%d: %s\n", __FILE__, __LINE__, #value); std::abort(); \
} } while (0)

template<class Operation> static void rejects(Operation operation) {
  bool failed = false;
  try { operation(); }
  catch(const api::Error& error) { failed = true; CHECK(error.status == OWNED_SUBTYPES_INVALID_ARGUMENT); }
  CHECK(failed);
}

static api::Bundle bundle(const api::Ticket& ticket, const api::Int& count) {
  return {ticket, std::nullopt, {ticket}, {ticket}, {count, {0, 255}}};
}

int main(void) {
  auto state = api::detail::current_state();
  if(std::getenv("LEAN_BRIDGE_OWNED_COLD_ONLY")) {
    state->close(); std::puts("cold"); return 0;
  }
  {
    auto ticket = api::new_ticket(41, "native"), retained = ticket.retain();
    ticket.close(); CHECK(ticket.is_closed()); CHECK(api::serial(retained) == 41);
    const auto value = bundle(retained, 7);
		api::CallbackBundle callbackValue{retained, {7, {0, 255}}};
		size_t callbackCalls = 0;
		auto callbackResult = api::callback_record(callbackValue
			, [&](const api::CallbackBundle& incoming) {
				++callbackCalls; return incoming;
			});
		CHECK(callbackCalls == 1 && callbackResult.payload.count == 7
			&& api::serial(callbackResult.primary) == 41);
    for(size_t i = 0; i < 30; ++i) {
      const auto echoed = api::echo_record(value);
      const auto alternate = api::echo_record_alternate(value);
      CHECK(echoed.payload.count == 7 && echoed.payload.bytes[1] == 255);
      CHECK(alternate.payload.count == 7 && api::serial(alternate.primary) == 41);
    }
    const auto invalid = bundle(retained, -1);
    rejects([&] { (void)api::echo_record(invalid); });
    rejects([&] { (void)api::echo_record_alternate(invalid); });
    CHECK(api::serial(retained) == 41);

    auto rejected = bundle(retained, -1); auto rejectionLease = rejected.primary.retain();
    rejects([&] { (void)api::transfer_record(std::move(rejected)); });
    CHECK(!rejected.primary.is_closed() && api::serial(rejected.primary) == 41);
    CHECK(api::serial(rejectionLease) == 41);

    auto moving = bundle(retained, 9); auto kept = moving.primary.retain();
    auto moved = api::transfer_record(std::move(moving));
    CHECK(moving.primary.is_closed() && api::serial(kept) == 41);
    CHECK(moved.payload.count == 9 && api::serial(moved.primary) == 41);

    auto raiiSurvivor = [] {
      auto abandoned = api::new_ticket(61, "raii");
      auto independent = abandoned.retain();
      CHECK(api::serial(abandoned) == 61);
      return independent;
    }();
    CHECK(api::serial(raiiSurvivor) == 61);
    raiiSurvivor.close(); CHECK(raiiSurvivor.is_closed());
    CHECK(api::serial(retained) == 41);

    rejectionLease.close(); kept.close(); moved.primary.close(); retained.close();
    CHECK(rejectionLease.is_closed() && kept.is_closed() && retained.is_closed());
  }
  state->drain(); state->close();
  std::printf("owned-subtype-cpp:%zu\n", checks); return 0;
}
