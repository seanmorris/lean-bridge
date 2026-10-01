/**
 * Independent Python receiver inputs and shared ownership regression probes.
 *
 * @file
 */
import { readFile } from "node:fs/promises";
import { ownedReceiverConfiguration, ownedReceiverReviewedIr, ownedReceiverSource } from "./owned-receiver-fixture.mjs";
import { ownedRustBorrowConfiguration, ownedRustBorrowReviewedIr } from "./owned-rust-borrow-fixture.mjs";

export const ownedPythonReceiverSource = ownedReceiverSource + `
namespace Owned
def moveRecord (value : Bundle) (callback : Bundle → Bundle) : Bundle := callback value
def moveArray (value : Array Ticket) : Array Ticket := value
end Owned
`;

/** Add an aggregate-consuming method and a consuming container function. */
export const ownedPythonReceiverConfiguration = async () => {
	const config = await ownedReceiverConfiguration(), prior = await ownedRustBorrowConfiguration();
	for(const name of ["Owned.moveRecord", "Owned.moveArray"])
	{
		config.exports.push(name); config.arities[name] = prior.arities[name];
		config.contracts[name] = prior.contracts[name];
	}
	config.contracts["Owned.moveRecord"].receiver = "method";
	return config;
};

/** Keep reviewed owner names independent of compiler parameter positions. */
export const ownedPythonReceiverReviewedIr = () => {
	const ir = ownedReceiverReviewedIr();
	for(const item of ownedRustBorrowReviewedIr().declarations.filter(item => ["moveRecord", "moveArray"].includes(item.name)))
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

/**
 * Describe resource-only receivers without callback or result-anchor capability.
 *
 * @param consuming - Include an original-owner transfer.
 */
export const ownedPythonPlainReceiverReviewedIr = consuming => {
	const ir = ownedReceiverReviewedIr();
	const names = ["newTicket", "serial", "retainTicket", ...consuming ? ["transferTicket"] : []];
	ir.declarations = ir.declarations.filter(item => names.includes(item.name));
	ir.types = ir.types.filter(item => item.id === "lean:Owned.Ticket"); ir.errors = [];
	for(const item of ir.declarations) if(item.result.ownership === "borrow")
		Object.assign(item.result, { ownership: "lease", lifetime: { scope: "explicit", anchor: null } });
	return ir;
};

/** Exercise every receiver before the unchanged allocation and race regressions. */
export const ownedPythonReceiverProbe = async () => {
	const prior = await readFile("tests/fixtures/structured-types/owned-python-borrows.py", "utf8");
	const receivers = await readFile("tests/fixtures/structured-types/owned-python-receivers.py", "utf8");
	const marker = "def owners():";
	if(prior.split(marker).length !== 2) throw new Error("Expected one independent Python owner probe");
	return prior.replace(marker, receivers + "\nreceiver_members()\n\n" + marker);
};

/** Exercise the same members using only ordinary imports from an installed wheel. */
export const ownedPythonInstalledReceiverProbe = async () => {
	const prior = await readFile("tests/fixtures/structured-types/owned-installed-python-borrows.py", "utf8");
	const receivers = (await readFile("tests/fixtures/structured-types/owned-python-receivers.py", "utf8"))
		.replaceAll("r.LeanBridgeError", "api.LeanBridgeError").replaceAll("data()", "payload()");
	const marker = "def owners():";
	if(prior.split(marker).length !== 2) throw new Error("Expected one independent installed Python owner probe");
	return prior.replace(marker, receivers + "\nreceiver_members()\n\n" + marker);
};

/**
 * Check the same original-owner rules when no optional capability is present.
 *
 * @param consuming - Exercise transfer as well as independent retention.
 */
export const ownedPythonPlainReceiverProbe = consuming => `import copy, ctypes, gc, json, sys
import lean_owned_aggregates as api
from lean_owned_aggregates import _native as native, _owned as runtime
library = ctypes.CDLL(sys.argv[1])
identities = library.receiver_identity_count
identities.argtypes = []
identities.restype = ctypes.c_size_t
checks = 0
def check(value):
    global checks
    assert value, "Plain Python receiver assertion failed"
    checks += 1
check(identities() == 0)
native._bind(runtime._OwnedRuntime(library))
state = native._runtime.current_state()
check(identities() == 1)
root = api.new_ticket(42, "plain")
alias, kept = copy.copy(root), root.retain_ticket()
check(root.serial == root.get().serial == 42)
root.close()
check(root.is_closed and alias.serial == 42)
alias.close()
check(kept.serial == 42)
${consuming ? `old = copy.copy(kept)
moved = kept.transfer_ticket()
check(kept.is_closed and old.is_closed and moved.serial == 42)
moved.close()` : "kept.close()"}
kept.close()
gc.collect()
state.drain()
check(identities() == 1)
state.close()
check(identities() == 0)
print(json.dumps({"checks": checks, "identities": identities()}))
`;
