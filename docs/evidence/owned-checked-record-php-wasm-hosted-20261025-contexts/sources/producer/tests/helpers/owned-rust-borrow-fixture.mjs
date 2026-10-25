/**
 * Original-owner borrows and reentrant consumption for the Rust projection.
 *
 * @file
 */
import { ownedBorrowReviewedIr, ownedBorrowConfiguration, ownedBorrowSource } from "./owned-borrow-fixture.mjs";

/**
 * Count bridge allocation and original-owner handoff around the real C adapter.
 *
 * @param native - Generated C package.
 */
export const ownedRustBorrowNativeSource = native => {
	const handoff = "static inline void oc_transfer_consume(void *context) {";
	if(native.source.split(handoff).length !== 2) throw new Error("Expected one checked transfer handoff");
	return `#include <stddef.h>
#include <stdlib.h>
static size_t live, handoffs; static ptrdiff_t fail_after = -1;
static void *allocate(size_t size) {
  if (fail_after == 0) return NULL;
  if (fail_after > 0) --fail_after;
  void *value = malloc(size); if (value) ++live; return value;
}
static void deallocate(void *value) { if (value) { --live; free(value); } }
#define LB_OWNED_ALLOC allocate
#define LB_OWNED_FREE deallocate
${native.source.replace(handoff, handoff + "\n  ++handoffs;")}
size_t owned_test_live(void) { return live; }
size_t owned_test_handoffs(void) { return handoffs; }
void owned_test_fail_after(ptrdiff_t value) { fail_after = value; }
size_t owned_test_identities(void) { lean_bridge_native_snapshot snapshot; lean_bridge_native_snapshot_read(&snapshot); return snapshot.live_identities; }
`;
};

export const ownedRustBorrowSource = ownedBorrowSource + `
namespace Owned
def moveRecord (value : Bundle) (callback : Bundle → Bundle) : Bundle := callback value
def moveArray (value : Array Ticket) : Array Ticket := value
end Owned
`;

/**
 * Preserve independent reviewed parameter names and ownership decisions.
 *
 * @param options - Reviewed or compiler parameter naming.
 * @param options.friendly - Select source-authored names.
 */
export const ownedRustBorrowReviewedIr = ({ friendly = true } = {}) => {
	const ir = ownedBorrowReviewedIr({ mixed: true, friendly });
	for(const [name, original] of [["moveRecord", "callbackRecord"], ["moveArray", "echoArray"]])
	{
		const item = structuredClone(ir.declarations.find(value => value.name === original));
		item.id = `lean:Owned.${name}`; item.name = name; item.overloadKey = `Owned.${name}`;
		item.source.declaration = `Owned.${name}`; item.parameters[0].ownership = "transfer";
		item.result.ownership = "lease"; item.result.lifetime = { scope: "explicit", anchor: null };
		ir.declarations.push(item);
	}
	return ir;
};

/** State the same choices through ordinary author configuration. */
export const ownedRustBorrowConfiguration = async () => {
	const config = await ownedBorrowConfiguration({ mixed: true });
	for(const item of ownedRustBorrowReviewedIr({ friendly: false }).declarations.filter(value => ["moveRecord", "moveArray"].includes(value.name)))
	{
		config.exports.push(item.source.declaration); config.arities[item.source.declaration] = item.parameters.length;
		config.contracts[item.source.declaration] = { parameters: item.parameters.map(({ ownership, lifetime }) => ({ ownership, lifetime })) };
	}
	return config;
};
