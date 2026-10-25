/**
 * Independently authored Rust receivers over the common Lean lifetime fixture.
 *
 * @file
 */
import { readFile } from "node:fs/promises";
import { ownedReceiverConfiguration, ownedReceiverReviewedIr, ownedReceiverSource } from "./owned-receiver-fixture.mjs";
import { ownedRustBorrowConfiguration, ownedRustBorrowReviewedIr } from "./owned-rust-borrow-fixture.mjs";

export const ownedRustReceiverLinker = `#!/bin/sh
for arg do
  case "$arg" in -c|-S|-E|-x*|-fsyntax-only|*.c|*.C|*.cc|*.cpp|*.cxx|*.s|*.S|@*) exit 65;; esac
done
exec /usr/bin/cc "$@"
`;

export const ownedRustReceiverSource = ownedReceiverSource + `
namespace Owned
def moveRecord (value : Bundle) (callback : Bundle → Bundle) : Bundle := callback value
def moveArray (value : Array Ticket) : Array Ticket := value
end Owned
`;

/** Select an aggregate-consuming method without supplying compiler types. */
export const ownedRustReceiverConfiguration = async () => {
	const configuration = await ownedReceiverConfiguration(), prior = await ownedRustBorrowConfiguration();
	for(const name of ["Owned.moveRecord", "Owned.moveArray"])
	{
		configuration.exports.push(name); configuration.arities[name] = prior.arities[name];
		configuration.contracts[name] = prior.contracts[name];
	}
	configuration.contracts["Owned.moveRecord"].receiver = "method";
	return configuration;
};

/** Keep reviewed owner names independent of compiler argument positions. */
export const ownedRustReceiverReviewedIr = () => {
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
 * Isolate receiver support from aggregates, anchored results and callbacks.
 *
 * @param consuming - Include an explicit original-owner transfer.
 */
export const ownedRustPlainReceiverReviewedIr = (consuming = false) => {
	const ir = ownedReceiverReviewedIr();
	const names = ["newTicket", "serial", "retainTicket", ...consuming ? ["transferTicket"] : []];
	ir.declarations = ir.declarations.filter(item => names.includes(item.name));
	ir.types = ir.types.filter(item => item.id === "lean:Owned.Ticket"); ir.errors = [];
	for(const item of ir.declarations) if(item.result.ownership === "borrow")
		Object.assign(item.result, { ownership: "lease", lifetime: { scope: "explicit", anchor: null } });
	return ir;
};

/** Exercise member calls alongside the independent original-owner assertions. */
export const ownedRustReceiverProbe = async () => {
	const original = await readFile("tests/fixtures/structured-types/owned-rust-borrows.rs", "utf8");
	const members = await readFile("tests/fixtures/structured-types/owned-rust-receivers.rs", "utf8");
	return original.replace("fn main() {", members + "\nfn main() {")
		.replace("[owners, shapes, transfers, depth, callbacks, fork_guard]", "[receiver_members, owners, shapes, transfers, depth, callbacks, fork_guard]")
		.replaceAll("owned-rust-borrows:", "owned-rust-receivers:");
};

/**
 * Exercise original owners without callbacks, aggregates or borrowed results.
 *
 * @param consuming - Include a consuming receiver with no result anchor.
 */
export const ownedRustPlainReceiverProbe = consuming => `
unsafe extern "C" { fn receiver_identity_count() -> usize; }
fn plain_receivers() {
    let mut checks = 0;
    assert_eq!(unsafe { receiver_identity_count() }, 0); checks += 1;
    let state = current_state().unwrap();
    assert_eq!(unsafe { receiver_identity_count() }, 1); checks += 1;
    {
        let mut root = new_ticket(&BigUint::from(42u32), "plain").unwrap();
        let mut alias = root.clone(); let mut independent = root.retain_ticket().unwrap();
        let copied = root.serial().unwrap();
        assert_eq!(copied, BigUint::from(42u32));
        assert_eq!(root.get().unwrap().serial().unwrap(), copied); checks += 1;
        root.close(); assert!(root.is_closed()); assert_eq!(alias.serial().unwrap(), copied); checks += 1;
        alias.close(); assert_eq!(independent.serial().unwrap(), copied); checks += 1;
        ${consuming ? `let old = independent.clone(); let mut moved = independent.transfer_ticket().unwrap();
        assert!(independent.is_closed() && old.is_closed());
        assert_eq!(moved.serial().unwrap(), copied); checks += 1;
        moved.close();` : "independent.close();"}
        assert_eq!(copied, BigUint::from(42u32)); checks += 1;
    }
    assert_eq!(unsafe { receiver_identity_count() }, 1); checks += 1;
    state.close().unwrap();
    assert_eq!(unsafe { receiver_identity_count() }, 0); checks += 1;
    println!(r#"owned-rust-plain-receivers:{{"checks":{},"identities":0}}"#, checks);
}
`;
