/**
 * Extend the established public C++ acceptance with recursive values.
 * The consumer constructs named alternatives and never handles transport tags.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

/** Return the nine-shape, public-API-only recursive callback consumer. */
export const recursiveCallableCppConsumer = async () => {
	let source = await readFile("tests/fixtures/structured-callable-consumers/cpp.cpp", "utf8");
	const replace = (before, after) => {
		assert.equal(source.split(before).length, 2, before);
		source = source.replace(before, after);
	};
	replace('#include <new>', '#include <new>\n#include <thread>');
	replace("fault_stats[8]", "fault_stats[11]");
	replace("template<class T, class Call, class Twice, class Make>", `static api::Tree recursive_value(unsigned seed) {
  api::Tree value = api::TreeLeaf{(api::Nat(1) << 257) + seed};
  for (unsigned depth = 0; depth < seed % 6; ++depth)
    value = api::TreeBranch{{std::move(value), api::TreeLeaf{seed}, api::TreeBranch{}}};
  return value;
}
template<class T, class Call, class Twice, class Make>`);
	replace("shape_index = 7; EXERCISE(alias, record_value);", "shape_index = 7; EXERCISE(alias, record_value);\n    shape_index = 8; EXERCISE(recursive, recursive_value);");
	replace("  const auto value = record_value(7);", `  unsigned accepted_depths = 0, recycled_thread_checks = 0;
  {
    api::Tree chain = api::TreeLeaf{17};
    for (unsigned depth = 0; depth <= 64; ++depth) {
      if (depth < 64) {
        same(api::call_recursive(chain, [](api::Tree value) { return value; }), chain);
        auto closure = api::make_recursive(chain); same(closure.call(true, api::TreeLeaf{0}), chain); ++accepted_depths;
      } else {
        rejected([&] { api::call_recursive(chain, [](api::Tree value) { return value; }); });
        rejected([&] { api::make_recursive(chain); });
        rejected([&] { api::call_recursive(api::TreeLeaf{17}, [&](api::Tree) { return chain; }); });
        auto closure = api::make_recursive(api::TreeLeaf{17}); rejected([&] { closure.call(false, chain); });
      }
      if (depth < 64) chain = api::TreeBranch{{std::move(chain)}};
    }
    using Handle = decltype(api::make_recursive(api::TreeLeaf{17}));
    std::optional<Handle> foreign;
    std::thread([&] { foreign.emplace(api::make_recursive(api::TreeLeaf{17})); }).join();
    for (unsigned i = 0; i < 16; ++i) {
      std::thread([&] {
        auto local = api::make_recursive(api::TreeLeaf{19});
        same(local.call(true, api::TreeLeaf{0}), api::Tree(api::TreeLeaf{19}));
        rejected([&] { foreign->call(true, api::TreeLeaf{0}); }); rejected([&] { foreign->close(); });
      }).join(); ++recycled_thread_checks;
    }
  }
  for (unsigned seed = 0; seed < 12; ++seed) {
    using Nested = std::vector<std::optional<api::Alias>>;
    const auto value = record_value(seed);
    const Nested expected{value, std::nullopt, value};
    const auto text = value.text + "<none>" + value.text;
    for (unsigned kind = 0; kind < 2; ++kind) {
      shape_index = 9 + kind;
      auto call = [&](auto&& callback) {
        return kind ? api::call_nested_plain(value, callback) : api::call_nested_alias(value, callback);
      };
      auto make = [&] { return kind ? api::make_nested_plain(value) : api::make_nested_alias(value); };
      auto identity = [&](Nested input) { same(input, expected); return input; };
      same(call(identity), text);
      same(call([](Nested) { return Nested{}; }), std::string{});
      { auto closure = make(); same(closure.call({}), expected); closure.close();
        rejected([&] { closure.call({}); }); }
      int token = 19;
      try { call([&](Nested) -> Nested { throw &token; }); check(false); }
      catch (int* caught) { check(caught == &token); }
      faults([&] { same(call(identity), text); });
      faults([&] { same(call([](Nested) { return Nested{}; }), std::string{}); });
      faults([&] { auto closure = make(); same(closure.call(expected), expected); });
      { auto closure = make(); faults([&] { same(closure.call({}), expected); }); }
    }
  }
  const auto value = record_value(7);`);
	replace('"variant", "alias"};', '"variant", "alias", "recursive"};');
	replace("for (unsigned i = 0; i < 8; ++i)", "for (unsigned i = 0; i < 9; ++i)");
	replace('std::puts("]}");', String.raw`std::printf("],\"aliases\":[");
  for (unsigned i = 0; i < 2; ++i)
    std::printf("%s{\"shape\":\"%s\",\"cases\":%u,\"failures\":%u}", i ? "," : "",
      i ? "plain" : "alias", fault_stats[9 + i].cases, fault_stats[9 + i].failures);
  std::printf("],\"acceptedDepths\":%u,\"recycledThreadChecks\":%u}", accepted_depths, recycled_thread_checks); std::puts("");`);
	return source;
};

/**
 * Require separately observed allocation-failure coverage for all nine shapes.
 *
 * @param text - JSON output from the installed public C++ caller.
 */
export const parseRecursiveCallableCppResult = text => {
	const result = JSON.parse(text);
	assert.ok(result.checks > 1000);
	assert.deepEqual(result.faults.map(item => item.shape), ["array", "list", "option", "result", "tuple", "record", "variant", "alias", "recursive"]);
	assert.deepEqual(result.aliases.map(item => item.shape), ["alias", "plain"]);
	for(const item of [...result.faults, ...result.aliases])
	{ assert.equal(item.cases, 48); assert.ok(item.failures > 0); }
	assert.equal(result.allocationFailures, [...result.faults, ...result.aliases].reduce((sum, item) => sum + item.failures, 0));
	assert.equal(result.acceptedDepths, 64); assert.equal(result.recycledThreadChecks, 16);
	return result;
};
