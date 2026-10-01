/**
 * Nominal C++ receivers with independent ordinary and reviewed contracts.
 *
 * @file
 */
import { readFile } from "node:fs/promises";
import { ownedReceiverConfiguration, ownedReceiverReviewedIr, ownedReceiverSource } from "./owned-receiver-fixture.mjs";
import { ownedCppBorrowConfiguration, ownedCppBorrowReviewedIr } from "./owned-cpp-borrow-fixture.mjs";

/**
 * Check no-anchor ownership independently of the generated C++ implementation.
 *
 * @param consuming - Include a consuming receiver without borrowed results.
 */
export const ownedCppPlainReceiverProbe = consuming => String.raw`#include "owned_aggregates.hpp"
#include <cassert>
#include <cstdio>
namespace api = lean_bridge::owned_aggregates;
extern "C" size_t receiver_identity_count(void);
int main() {
  unsigned checks = 0;
  assert(receiver_identity_count() == 0); ++checks;
  auto state = api::detail::current_state();
  assert(receiver_identity_count() == 1); ++checks;
  {
    auto root = api::new_ticket(42, "plain");
    auto alias = root, independent = root.retain_ticket();
    const auto copied = root.serial();
    assert(copied == 42 && root.get().serial() == 42); ++checks;
    root.close(); assert(root.is_closed() && alias.serial() == 42); ++checks;
    alias.close(); assert(independent.serial() == 42); ++checks;
    ${consuming ? `auto old = independent;
    auto moved = std::move(independent).transfer_ticket();
    assert(independent.is_closed() && old.is_closed() && moved.serial() == 42); ++checks;
    moved.close();` : "independent.close();"}
    assert(copied == 42); ++checks;
  }
  state->drain();
  assert(receiver_identity_count() == 1); ++checks;
  state->close();
  assert(receiver_identity_count() == 0); ++checks;
  std::printf("{\"checks\":%u,\"identities\":%zu}\n", checks, receiver_identity_count());
}
`;

export const ownedCppReceiverSource = ownedReceiverSource + `
namespace Owned
def moveRecord (value : Bundle) (callback : Bundle → Bundle) : Bundle := callback value
def moveArray (value : Array Ticket) : Array Ticket := value
end Owned
`;

/** Add an aggregate-consuming receiver and a consuming container function. */
export const ownedCppReceiverConfiguration = async () => {
	const config = await ownedReceiverConfiguration(), prior = await ownedCppBorrowConfiguration();
	for(const name of ["Owned.moveRecord", "Owned.moveArray"])
	{
		config.exports.push(name); config.arities[name] = prior.arities[name];
		config.contracts[name] = prior.contracts[name];
	}
	config.contracts["Owned.moveRecord"].receiver = "method";
	return config;
};

/** Keep reviewed argument names independent of the compiler's positional names. */
export const ownedCppReceiverReviewedIr = () => {
	const ir = ownedReceiverReviewedIr();
	for(const item of ownedCppBorrowReviewedIr().declarations.filter(item => ["moveRecord", "moveArray"].includes(item.name)))
	{
		if(item.name === "moveRecord")
		{
			const { type, ownership, lifetime, mutability } = item.parameters.shift();
			item.receiver = { type, ownership, lifetime, mutability };
			item.owner = type.id; item.kind = "method";
		}
		ir.declarations.push(item);
	}
	return ir;
};

/** Exercise member syntax alongside the existing independent lifetime probes. */
export const ownedCppReceiverProbe = async () => {
	const original = await readFile("tests/fixtures/structured-types/owned-cpp-borrows.cpp", "utf8");
	const members = await readFile("tests/fixtures/structured-types/owned-cpp-receivers.cpp", "utf8");
	return original.replace("int main() {", members + "\nint main() {")
		.replace("  test_owners(); check_clean();", "  test_receiver_members(); check_clean();\n  test_owners(); check_clean();")
		.replaceAll("owned-cpp-borrows-installed", "owned-cpp-receivers-installed");
};
