/**
 * Compile-valid changes that the public Rust ownership oracle must reject.
 *
 * @file
 */
import assert from "node:assert/strict";

/**
 * Select exact compile-valid ownership mutations from the generated sources.
 *
 * @param generated - Current Rust API, conversions and C layout.
 * @param combined - Include receiver, transfer and host callback mutations.
 */
export const ownedRustCallbackMutations = (generated, combined) => {
	const callback = generated.c.callbacks.find(item => item.anchor === 1
		&& generated.types.find(type => type.id === item.result)?.hostName === "Bundle");
	const type = generated.types.find(item => item.id === callback.id);
	const sources = { "src/lib.rs": generated.apiSource
		, "src/owned_values.rs": generated.source };
	const entries = [
		["unchecked-result-owner", "src/lib.rs"
			, "storage.lease.require()?; Ok(&storage.value)", "Ok(&storage.value)"]
		, ["retention-shares-owner", "src/lib.rs"
			, "pub fn retain(&self) -> Result<Self, Error> { self.get()?.copy_value() }"
			, "pub fn retain(&self) -> Result<Self, Error> { self.get()?; Ok(self.clone()) }"]
		, ...combined ? [
			["host-borrow-never-expires", "src/lib.rs"
				, "impl Drop for BorrowFrame { fn drop(&mut self) { self.active.set(false); } }"
				, "impl Drop for BorrowFrame { fn drop(&mut self) { let _ = self.active.get(); } }"]
			, ["host-reply-after-expiration", "src/owned_values.rs"
				, "let reply = reply.owned_reply()?;"
				, "drop(frame); let reply = reply.owned_reply()?;"]
			, ["host-panic-identity-erased", "src/owned_values.rs"
				, "Some(OwnedFailure::Panic(payload)) => std::panic::resume_unwind(payload),"
				, "Some(OwnedFailure::Panic(payload)) => { let _ = payload; std::panic::panic_any(\"erased callback panic\") },"]
			, ["transfer-consumes-copy", "src/owned_values.rs"
				, "moves.add(Rc::clone(&owner0), 0)?;"
				, "moves.add({ let _ = &owner0; copy_value(a0)?.lease(&state)? }, 0)?;"]
			, ["native-closure-uses-host-invoke", "src/lib.rs"
				, `fn closure(&self) -> Option<&${type.hostName}> { Some(self) }`
				, `fn closure(&self) -> Option<&${type.hostName}> { None }`]
		] : []
	];
	return entries.map(([name, path, before, after]) => {
		const original = sources[path], occurrences = original.split(before).length - 1;
		assert.ok(occurrences > 0, name);
		return { name, path, occurrences, source: original.replaceAll(before, after) };
	});
};
