#include <callbackcheckedrecords.hpp>

#include <cstdio>
#include <stdexcept>

namespace api = lean_bridge::callbackcheckedrecords;
static unsigned checks;
#define CHECK(test) do { if (!(test)) { std::fprintf(stderr, "failed at line %d: %s\n", __LINE__, #test); return 1; } ++checks; } while (0)

template<class F> static bool rejected(F&& call) {
	try { call(); }
	catch(const api::Error& error) { return error.status == CALLBACKCHECKEDRECORDS_STATUS_INVALID_ARGUMENT; }
	return false;
}
static api::Interval interval(unsigned lo, unsigned hi) { return api::Interval{api::Nat{lo}, api::Nat{hi}}; }
static api::Weighted weighted(unsigned weight, unsigned limit) { return api::Weighted{api::Nat{weight}, api::Nat{limit}}; }

int main() {
	unsigned callback_calls = 0;
	// A host reply selects mkInterval: Lean computes hi - lo of the constructed reply.
	auto widen = api::with_recovery([&](const api::Interval& value) {
		++callback_calls; if(value != interval(1, 3)) throw std::runtime_error("unexpected argument");
		return interval(1, 4);
	}, interval(1, 3));
	CHECK(api::call_host(widen) == 3 && callback_calls == 1);
	auto invalid_recovery = api::with_recovery([&](const api::Interval& value) {
		++callback_calls; return value;
	}, interval(3, 1));
	CHECK(rejected([&] { (void)api::call_host(invalid_recovery); }) && callback_calls == 1);
	auto invalid_reply = api::with_recovery([&](const api::Interval&) {
		++callback_calls; return interval(5, 2);
	}, interval(1, 3));
	CHECK(rejected([&] { (void)api::call_host(invalid_reply); }) && callback_calls == 2);
	CHECK(api::call_host(widen) == 3 && callback_calls == 3);

	auto host_mixed = api::with_recovery([&](const api::Nat& marker, const api::Interval& value) {
		++callback_calls; if(marker != 7) throw std::runtime_error("wrong marker");
		return api::Interval{value.lo, value.hi + 2};
	}, interval(1, 3));
	CHECK(api::call_host_mixed(host_mixed) == 4 && callback_calls == 4);

	// A leased closure constructs its interval argument before its body runs.
	auto closure = api::make_closure(api::Nat{9});
	CHECK(closure(interval(2, 5)) == 3);
	CHECK(rejected([&] { (void)closure(interval(5, 2)); }));
	CHECK(closure(interval(3, 3)) == 0);
	closure.close(); CHECK(closure.is_closed());

	// A Lean-produced closure result crosses as the proof-free interval.
	auto mixed = api::make_mixed_closure(api::Nat{0});
	CHECK(mixed(api::Nat{9}, interval(2, 5)) == interval(2, 5));
	CHECK(rejected([&] { (void)mixed(api::Nat{9}, interval(5, 2)); }));
	CHECK(mixed(api::Nat{9}, interval(3, 4)) == interval(3, 4));
	mixed.close(); CHECK(mixed.is_closed());

	// A checked payload field runs its own constructor before the record constructor.
	unsigned reply_weight = 2, reply_limit = 5;
	auto reweigh = api::with_recovery([&](const api::Weighted& value) {
		++callback_calls; if(value != weighted(1, 2)) throw std::runtime_error("unexpected argument");
		return weighted(reply_weight, reply_limit);
	}, weighted(1, 2));
	CHECK(api::call_host_nested(reweigh) == 3 && callback_calls == 5);
	reply_weight = 0;
	CHECK(rejected([&] { (void)api::call_host_nested(reweigh); }) && callback_calls == 6);
	reply_weight = 6;
	CHECK(rejected([&] { (void)api::call_host_nested(reweigh); }) && callback_calls == 7);
	auto invalid_weight = api::with_recovery([&](const api::Weighted& value) {
		++callback_calls; return value;
	}, weighted(0, 2));
	CHECK(rejected([&] { (void)api::call_host_nested(invalid_weight); }) && callback_calls == 7);
	reply_weight = 2;
	CHECK(api::call_host_nested(reweigh) == 3 && callback_calls == 8);

	auto nested = api::make_nested_closure(api::Nat{0});
	CHECK(nested(weighted(2, 5)) == 3);
	CHECK(rejected([&] { (void)nested(weighted(0, 5)); }));
	CHECK(rejected([&] { (void)nested(weighted(6, 5)); }));
	CHECK(nested(weighted(5, 5)) == 0);
	nested.close(); CHECK(nested.is_closed());

	std::printf("callback-checked-record-native-ok:%u\n", checks);
	return 0;
}
