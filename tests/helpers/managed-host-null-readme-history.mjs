/**
 * Remove only the generated .NET/JVM HostNull documentation delta before
 * authenticating older managed-package receipts.
 *
 * @file
 */
import assert from "node:assert/strict";

const edits = Object.freeze([
	Object.freeze({
		current: "Lean HostNull T uses the direct nullable CLR carrier T?: null is the HostNull null branch and every non-null T is its value branch. HostNull (Option T) is Option<T>?, while Option (HostNull T) is Option<T?>, retaining None, Some(null), and Some(value) as distinct values. Directly nested HostNull is rejected because one CLR null cannot retain both branches. "
		, previous: ""
	})
	, Object.freeze({
		current: "Null payloads reject unless their declared type is HostNull;"
		, previous: "Active null reference payloads reject;"
	})
	, Object.freeze({
		current: "Null is accepted only for a declared HostNull branch; other nulls, invalid unsigned ranges and malformed UTF-16 reject before invoking Lean."
		, previous: "Null, invalid unsigned ranges and malformed UTF-16 are rejected."
	})
	, Object.freeze({
		current: "HostNull T uses the direct boxed Java payload with null as its null branch; Kotlin metadata exposes the same value as T?. HostNull (Option T) is a nullable Option<T>, while Option (HostNull T) retains None, Some(null), and Some(value). Directly nested HostNull rejects because one JVM null cannot retain both branches. Option<T> is a sealed None/Some hierarchy with none()/some(value) factories and isSome()/value(). Result<T,E> preserves Lean Except through ok(value)/err(error), isOk()/value()/error(). Pair<A,B> retains binary product nesting. Generic wrappers permit a null payload so nested HostNull remains representable; conversion rejects that null whenever the declared payload is not HostNull. Inactive payload access throws. Nested Unit options remain distinct. Domain errors return Err; bridge failures throw exceptions. These generic types box primitive payloads and compose with copied arrays and records. Import the generated Pair explicitly in Kotlin; it is not kotlin.Pair. Equality and hashing compare active payloads by contents, including nested arrays."
		, previous: "Option<T> is a sealed None/Some hierarchy with none()/some(value) factories and isSome()/value(). Result<T,E> preserves Lean Except through ok(value)/err(error), isOk()/value()/error(). Inactive payload access throws; null containers and payloads reject. Nested Unit options remain distinct. Domain errors return Err; bridge failures throw exceptions. Pair<A,B> retains binary product nesting. These generic types box primitive payloads and compose with copied arrays and records. Import the generated Pair explicitly in Kotlin; it is not kotlin.Pair. Equality and hashing compare active payloads by contents, including nested arrays."
	})
	, Object.freeze({
		current: "including deeply nested arrays and explicit T? HostNull carriers."
		, previous: "including deeply nested arrays."
	})
]);

/**
 * Restore the pre-HostNull README while preserving every unrelated byte.
 *
 * @param path - Generated package-relative path.
 * @param source - Complete generated source.
 */
export const beforeManagedHostNullReadme = (path, source) => {
	if(path !== "README.md") return source;
	let restored = source, changed = 0;
	for(const edit of edits)
	{
		const count = restored.split(edit.current).length - 1;
		assert.ok(count <= 1, "Managed HostNull README edit must be unique");
		if(count === 0) continue;
		restored = restored.replace(edit.current, edit.previous);
		++changed;
	}
	return changed === 0 ? source : restored;
};
