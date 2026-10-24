/* Installed C++ result-only consumer for owned proof-erased checked records. */
#include "owned_checked_records.hpp"
#include <cstdio>
#include <cstdlib>
namespace api = lean_bridge::owned_checked_records;
static size_t checks;
#define CHECK(value) do { ++checks; if (!(value)) std::abort(); } while (0)
int main(void) {
  auto state = api::detail::current_state();
  auto ticket = api::new_ticket(20, "result-only");
  const auto produced = api::claim_for(ticket);
  CHECK(produced && produced->quota == 0);
  CHECK(api::serial(produced->holder) == 20);
  ticket.close(); CHECK(ticket.is_closed()); state->drain(); state->close();
  std::printf("owned-checked-record-result-only-cpp:%zu\n", checks); return 0;
}
