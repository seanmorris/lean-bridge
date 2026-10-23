#include <callbacksubtypes.hpp>

#include <cstdio>
#include <stdexcept>

namespace api = lean_bridge::callbacksubtypes;
static unsigned checks;
#define CHECK(test) do { if (!(test)) { std::fprintf(stderr, "failed at line %d: %s\n", __LINE__, #test); return 1; } ++checks; } while (0)

template<class F> static bool rejected(F&& call) {
	try { call(); }
	catch(const api::Error& error) { return error.status == CALLBACKSUBTYPES_STATUS_INVALID_ARGUMENT; }
	return false;
}

int main() {
	unsigned callback_calls = 0;
	auto increment = api::with_recovery([&](const api::Nat& value) {
		++callback_calls; return api::Nat{value + 1};
	}, api::Nat{1});
	CHECK(api::call_host(increment) == 2 && callback_calls == 1);
	auto invalid_recovery = api::with_recovery([&](const api::Nat& value) {
		++callback_calls; return value;
	}, api::Nat{0});
	CHECK(rejected([&] { (void)api::call_host(invalid_recovery); }) && callback_calls == 1);
	auto invalid_result = api::with_recovery([&](const api::Nat&) {
		++callback_calls; return api::Nat{0};
	}, api::Nat{1});
	CHECK(rejected([&] { (void)api::call_host(invalid_result); }) && callback_calls == 2);
	CHECK(api::call_host(increment) == 2 && callback_calls == 3);

	auto host_mixed = api::with_recovery([&](const api::Nat& marker, const api::Nat& value) {
		++callback_calls; if(marker != 7) throw std::runtime_error("wrong marker");
		return api::Nat{value + 2};
	}, api::Nat{1});
	CHECK(api::call_host_mixed(host_mixed) == 3 && callback_calls == 4);

	auto closure = api::make_closure(api::Nat{9});
	CHECK(closure(api::Nat{2}) == 2);
	CHECK(rejected([&] { (void)closure(api::Nat{0}); }));
	CHECK(closure(api::Nat{3}) == 3);
	closure.close(); CHECK(closure.is_closed());

	auto mixed = api::make_mixed_closure(api::Nat{0});
	CHECK(mixed(api::Nat{9}, api::Nat{2}) == 2);
	CHECK(rejected([&] { (void)mixed(api::Nat{9}, api::Nat{0}); }));
	CHECK(mixed(api::Nat{9}, api::Nat{3}) == 3);
	mixed.close(); CHECK(mixed.is_closed());

	std::printf("callback-subtype-native-ok:%u\n", checks);
	return 0;
}
