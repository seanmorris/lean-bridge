#include <finreplies.hpp>
#include <cstdio>
#include <stdexcept>
#include <string>
#include <thread>
#include <sys/wait.h>
#include <unistd.h>

// Installed C++ acceptance for host callback replies with Fin bounds (VO #1453): every reply shape
// at n - 1, n and n + 1, rejected leaves first, middle and last, inactive branches, a host
// exception kept as the first failure, suppression of later host calls and fresh-call recovery.

namespace fr = lean_bridge::finreplies;
using fr::Nat;
static unsigned checks;
#define CHECK(...) do { if (!(__VA_ARGS__)) { std::fprintf(stderr, "failed at line %d: %s\n", __LINE__, #__VA_ARGS__); return 1; } ++checks; } while (0)
#define RUN(test) do { if (test) return 1; } while (0)
static const Nat wide_bound("184467440737095516170");

static std::string bound(const std::string& path, const char* n) { return std::string("callback result") + path + " is not below its Fin " + n + " bound"; }
template<class Call> static bool refused(Call&& call, const std::string& message) {
  try { (void)call(); return false; }
  catch (const fr::Error& error) {
    return error.status == FINREPLIES_STATUS_INVALID_ARGUMENT && error.code == FINREPLIES_ERROR_INVALID_ARGUMENT && error.what() == message;
  }
}
static std::vector<Nat> nats(std::initializer_list<unsigned> values) { std::vector<Nat> result; for (unsigned value : values) result.emplace_back(value); return result; }

// One bounded leaf: `call(v)` replies with v at that leaf. n - 1 gives `expected`; n and n + 1 are refused naming Fin n.
template<class Call> static int leaf_bounds(Call&& call, unsigned n, const Nat& expected, const char* path) {
  const std::string text = std::to_string(n);
  CHECK(call(n - 1) == expected);
  for (unsigned value : {n, n + 1}) CHECK(refused([&] { return call(value); }, bound(path, text.c_str())));
  return 0;
}

static int check_maybe() {
  unsigned calls = 0;
  auto replying = [&](long at, unsigned value) { return [&calls, at, value](Nat n) { ++calls; return std::optional<Nat>(n == at ? Nat(value) : n); }; };
  calls = 0; CHECK(fr::maybe(replying(-1, 0)) == 100 && calls == 4);
  calls = 0; CHECK(fr::maybe(replying(3, 4)) == 10 + 20 + 30 + 50);
  for (long at : {0L, 1L, 3L}) for (unsigned value : {5u, 6u}) {
    calls = 0; CHECK(refused([&] { return fr::maybe(replying(at, value)); }, bound("?", "5")) && calls == unsigned(at) + 1);
  }
  // A host exception is the first failure: it reaches the caller unchanged and stops later host calls.
  calls = 0;
  bool rethrown = false;
  try { (void)fr::maybe([&](Nat n) -> std::optional<Nat> { ++calls; if (n == 1) throw std::runtime_error("host refused"); return n; }); }
  catch (const std::runtime_error& error) { rethrown = std::string(error.what()) == "host refused"; }
  CHECK(rethrown && calls == 2);
  calls = 0; CHECK(fr::maybe(replying(-1, 0)) == 100);
  return 0;
}

static int check_digits() {
  CHECK(fr::digits([](Nat) { return nats({0, 1, 2}); }) == 123);
  CHECK(fr::digits([](Nat) { return nats({2, 2, 2}); }) == 333);
  for (auto values : {nats({3, 1, 2}), nats({0, 3, 2}), nats({0, 1, 3}), nats({4, 1, 2}), nats({0, 4, 2}), nats({0, 1, 4})}) {
    CHECK(refused([&] { return fr::digits([&](Nat) { return values; }); }, bound("[" + std::to_string(values[0] >= 3 ? 0 : values[1] >= 3 ? 1 : 2) + "]", "3")));
  }
  CHECK(fr::digits([](Nat) { return std::vector<Nat>{}; }) == 0);
  return 0;
}

static int check_zero() {
  CHECK(fr::none0([](Nat) { return std::optional<Nat>{}; }) == 11);
  CHECK(refused([] { return fr::none0([](Nat) { return std::optional<Nat>(0); }); }, bound("?", "0")));
  CHECK(fr::empty0([](Nat) { return std::vector<Nat>{}; }) == 0);
  CHECK(refused([] { return fr::empty0([](Nat) { return nats({0}); }); }, bound("[0]", "0")));
  return 0;
}

static int check_wide() {
  CHECK(fr::wide([](Nat) { return std::optional<Nat>(wide_bound - 1); }) == wide_bound);
  CHECK(refused([] { return fr::wide([](Nat) { return std::optional<Nat>(wide_bound); }); }, bound("?", "184467440737095516170")));
  CHECK(refused([] { return fr::wide([](Nat) { return std::optional<Nat>(wide_bound + 1); }); }, bound("?", "184467440737095516170")));
  return 0;
}

// Except (Fin 7) Nat bounds only its error side; Except Nat (Array (Fin 3)) only its ok side.
static int check_results() {
  using Failure = fr::Result<Nat, Nat>;
  CHECK(fr::failure([](Nat) { return Failure{fr::Ok<Nat>{Nat(1000000)}}; }) == 1000000);
  CHECK(fr::failure([](Nat) { return Failure{fr::Err<Nat>{Nat(6)}}; }) == 700);
  CHECK(refused([] { return fr::failure([](Nat) { return Failure{fr::Err<Nat>{Nat(7)}}; }); }, bound(".error", "7")));
  CHECK(refused([] { return fr::failure([](Nat) { return Failure{fr::Err<Nat>{Nat(8)}}; }); }, bound(".error", "7")));
  using Success = fr::Result<std::vector<Nat>, Nat>;
  RUN(leaf_bounds([](unsigned v) { return fr::success([v](Nat) { return Success{fr::Ok<std::vector<Nat>>{nats({0, v})}}; }); }, 3, 2, ".ok[1]"));
  CHECK(fr::success([](Nat) { return Success{fr::Err<Nat>{Nat(1000000)}}; }) == 1000000);
  return 0;
}

// Only the active digit case is checked.
static int check_late() {
  CHECK(fr::late([](Nat) { return fr::Trailing{fr::TrailingLabel{"abcdefghijkl"}}; }) == 12);
  CHECK(fr::late([](Nat) { return fr::Trailing{fr::TrailingDigit{Nat(9)}}; }) == 81);
  CHECK(refused([] { return fr::late([](Nat) { return fr::Trailing{fr::TrailingDigit{Nat(10)}}; }); }, bound(".digit.value", "10")));
  CHECK(refused([] { return fr::late([](Nat) { return fr::Trailing{fr::TrailingDigit{Nat(11)}}; }); }, bound(".digit.value", "10")));
  return 0;
}

static int check_composites() {
  RUN(leaf_bounds([](unsigned v) { return fr::maybe_tile([v](Nat) { return std::optional<fr::Tile>(fr::Tile{Nat(v), Nat(5)}); }); }, 5, 50 + 5, "?.digit"));
  CHECK(fr::maybe_tile([](Nat) { return std::optional<fr::Tile>{}; }) == 3);
  using Pair = std::pair<std::optional<Nat>, Nat>;
  RUN(leaf_bounds([](unsigned v) { return fr::product([v](Nat) { return Pair{Nat(v), Nat(9)}; }); }, 5, 9, ".0?"));
  CHECK(fr::product([](Nat) { return Pair{std::nullopt, Nat(9)}; }) == 9);
  RUN(leaf_bounds([](unsigned v) { return fr::slotted([v](Nat) { return fr::Slot{Nat(v), Nat(9)}; }); }, 5, 9, ".digit?"));
  CHECK(fr::slotted([](Nat) { return fr::Slot{std::nullopt, Nat(9)}; }) == 9);
  RUN(leaf_bounds([](unsigned v) { return fr::aliased([v](Nat) { return std::optional<Nat>(Nat(v)); }); }, 5, 4, "?"));
  RUN(leaf_bounds([](unsigned v) { return fr::nested([v](Nat) { return std::optional<std::vector<Nat>>(nats({0, v})); }); }, 3, 2, "?[1]"));
  CHECK(fr::nested([](Nat) { return std::optional<std::vector<Nat>>{}; }) == 2);
  return 0;
}

// A nonempty List (Fin 3): valid values, then each of the first, middle and last leaves at its bounds.
static int check_listed() {
  CHECK(fr::listed([](Nat) { return nats({0, 1, 2}); }) == 123);
  RUN(leaf_bounds([](unsigned v) { return fr::listed([v](Nat) { return nats({v, 1, 2}); }); }, 3, 323, "[0]"));
  RUN(leaf_bounds([](unsigned v) { return fr::listed([v](Nat) { return nats({0, v, 2}); }); }, 3, 133, "[1]"));
  RUN(leaf_bounds([](unsigned v) { return fr::listed([v](Nat) { return nats({0, 1, v}); }); }, 3, 123, "[2]"));
  CHECK(fr::listed([](Nat) { return std::vector<Nat>{}; }) == 0);
  return 0;
}

static int check_twice() {
  unsigned first = 0, second = 0;
  CHECK(refused([&] { return fr::twice([&](Nat) { ++first; return std::optional<Nat>(6); }, [&](Nat a) { ++second; return Nat(a % 8); }); }, bound("?", "5")) && first == 1 && second == 0);
  CHECK(fr::twice([](Nat n) { return std::optional<Nat>(n); }, [&](Nat a) { ++second; return Nat(a % 8); }) == 24 && second == 1);
  return 0;
}

// A refusal inside a reentrant call stays in the nested frame.
static int check_reentry() {
  bool nested_refused = false;
  Nat result = fr::maybe([&](Nat n) {
    if (n == 0) nested_refused = refused([] { return fr::maybe([](Nat m) { return std::optional<Nat>(m == 1 ? Nat(5) : m); }); }, bound("?", "5"));
    return std::optional<Nat>(n);
  });
  CHECK(result == 100 && nested_refused);
  return 0;
}

int main() {
  RUN(check_maybe()); RUN(check_digits()); RUN(check_zero()); RUN(check_wide()); RUN(check_results());
  RUN(check_late()); RUN(check_composites()); RUN(check_listed()); RUN(check_twice()); RUN(check_reentry());
  CHECK(fr::plain(Nat(41)) == 42);
  int thread_result = -1;
  std::thread([&] {
    unsigned calls = 0;
    bool first = refused([&] { return fr::maybe([&](Nat n) { ++calls; return std::optional<Nat>(n == 2 ? Nat(5) : n); }); }, bound("?", "5")) && calls == 3;
    thread_result = first && fr::maybe([](Nat n) { return std::optional<Nat>(n); }) == 100 ? 0 : 1;
  }).join();
  CHECK(thread_result == 0);
  std::fflush(nullptr);
  pid_t child = fork();
  if (child == 0) {
    unsigned calls = 0;
    int status = 0;
    try { (void)fr::maybe([&](Nat n) { ++calls; return std::optional<Nat>(n); }); }
    catch (const fr::Error& error) { status = int(error.status); }
    std::printf("fork-status %d %u\n", status, calls);
    std::fflush(stdout);
    _exit(status != 0 && calls == 0 ? 0 : 1);
  }
  int code = 0;
  CHECK(child > 0 && waitpid(child, &code, 0) == child && WIFEXITED(code) && WEXITSTATUS(code) == 0);
  std::printf("fin-reply-ok cpp %u\n", checks);
  return 0;
}
