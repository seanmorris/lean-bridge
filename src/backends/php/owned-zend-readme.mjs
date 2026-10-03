/**
 * Consumer ownership and exact-width guidance for prepared PHP-Wasm packages.
 *
 * @file
 */

export const ownedPhpWasmReadme = `Records and variant cases are readonly generated classes. Arrays and Lists use consecutive-key PHP arrays; products use nested two-element arrays. Option uses null or Some(value), including Some(null) and nested Some. Except uses Ok(value) or Err(error). Aliases use their underlying PHP values. The generated PHPDoc describes nested types, and inputs validate without weak-mode coercion.

Resource-containing values use opaque Zend resource wrappers, not PHP integers or native pointers. Each returned wrapper owns a checked lease. Assigning a wrapper to another variable shares that wrapper; retain() creates an independently closable wrapper. Call close() on resources and Lean closures in a finally block. close() is idempotent. Destruction and request shutdown provide fallback cleanup. Cloning and serialization reject.

Callbacks receive borrowed resource and closure wrappers. They expire when the callback returns. Call retain() during the callback to keep a resource or returned Lean closure afterward. Retaining a borrowed PHP callback does not extend its enclosing call. Returned Lean closures are invokable and use the same retain()/close() operations.

Callbacks accept synchronous PHP callables or generated Lean closures. When a result has no type-safe automatic recovery value, pass with_recovery($callback, $fallback) with a valid value of the declared result type. Original PHP Throwable objects propagate after native cleanup; recovery values never mask failures. Reference arguments, reference returns, generators, wrong arity and asynchronous delivery reject.

A callback can call another initialized Lean package. First-use loading of a lazy package inside a callback rejects before loading, without poisoning either package. Use that peer's startup descriptor or make its first call before entering the callback, including after php.refresh(). Fetching or instantiating an extension can suspend PHP-Wasm, which this synchronous transport cannot do while Lean is on the stack.

On this 32-bit host, UInt32, UInt64, Int64, Nat, Int and USize use Brick\\Math\\BigInteger. ISize uses a signed 32-bit PHP int. Unit is null; Char is one UTF-8 scalar. String preserves Unicode and embedded NUL; Bytes::fromString preserves arbitrary bytes. Float32 rounds PHP floats to binary32. Big integers allow up to 16384 decimal digits. These mappings apply inside aggregates and callbacks.

Finite recursive values can contain resource leaves. Cycles, malformed branches, foreign classes, closed resources and expired borrows reject. Conversions permit 128 value levels and 262144 visits, with separate 16 MiB accounting budgets. These budgets exclude some PHP overhead and Lean working memory. Calls permit at most 64 reentry levels; the native scope limit can reject earlier. Allocation and limit failures recover. Malformed native results retire the runtime, while resource cleanup remains available.

Keep wrappers in their originating PHP instance and use the main PHP execution context. The pinned PHP-Wasm host cannot start Fibers. After exit or request termination, await php.refresh(), require the autoloader again and create new PHP values. Compatible copied and resource-containing packages use the same shared runtime automatically. Transferred inputs and anchored results are not implemented by this lease profile.
`;

export const ownedPhpWasmTransferReadme = ownedPhpWasmReadme.replace(
	"Transferred inputs and anchored results are not implemented by this lease profile.",
	"Owner-anchored borrowed results are not implemented by this lease profile."
) + `
Consuming parameters transfer their entire shared result lease, including siblings outside the supplied value. PHPDoc identifies each consuming parameter. Assignment aliases become closed when Lean receives the call. Use retain() beforehand to keep an independent lease. Repeated identities within one consuming argument are allowed; sharing one lease between two consuming arguments rejects before consumption. Callback borrows must be retained before transfer. A consuming callable parameter accepts a generated Lean closure, not an arbitrary PHP callable.

All arguments validate before consumption. Validation and preparation failures leave inputs open. Once the call reaches Lean, inputs remain consumed even if a callback throws or result conversion fails. Callbacks observe the consumed state during reentry. The original Throwable propagates after cleanup. close() remains safe on a consumed wrapper.
`;

export const ownedPhpWasmBorrowReadme = ownedPhpWasmReadme.replace(
	"Resource-containing values use opaque Zend resource wrappers, not PHP integers or native pointers. Each returned wrapper owns a checked lease. Assigning a wrapper to another variable shares that wrapper; retain() creates an independently closable wrapper. Call close() on resources and Lean closures in a finally block. close() is idempotent. Destruction and request shutdown provide fallback cleanup. Cloning and serialization reject.",
	"Resource-containing results return Value<T>, including empty collections, None and resource-free variant branches. get() reads the checked payload. share() adds a separately closable root to the same owner; retain() copies the whole value into an independent owner. Assignment shares the same PHP wrapper. Close whole owners in a finally block. close() is idempotent, and destruction and request shutdown provide fallback cleanup. Cloning and serialization reject. The generated classes expose no native pointers or integer identity tokens."
).replace("Transferred inputs and anchored results are not implemented by this lease profile.",
	"Receiver-anchored and callback-result-anchored lifetimes are not implemented by this profile.") + `
PHPDoc identifies whole-owner parameters. Pass a Value to an anchored or consuming parameter; pass get() to an ordinary call-scoped parameter. A borrowed result follows the original input owner, not a retained snapshot. Closing the last shared root or consuming it expires its borrowed descendants, including empty values and returned Lean closures. retain() keeps an independent copy; retaining a leaf keeps only that resource alive. Canonical identity equality and hashes do not depend on PHP wrapper identity.

Use copy_value($payload) for a nominal generated resource, record or variant, or select the type with resultOf: 'public_function' or parameterOf: ['public_function', 0]. Selectors also accept the generated public parameter name. Arrays, lists, tuples, options and results require a selector. copy_value($value) retains an existing Value independently. Wrong nominal types and weak-mode selector coercions reject.

Consuming calls move the original whole owner at the Lean boundary. Shares and existing borrowed descendants become closed before callbacks run. A borrowed owner cannot be consumed, and the same owner cannot be both an anchor and a consuming argument. Validation and preparation errors preserve inputs; failures after the handoff do not restore them. Original PHP exceptions propagate after cleanup, and unpublished results are released even when an exception is retained.
`;

/**
 * Explain callback-local owners without claiming receiver or export anchors.
 *
 * @param model - Checked callback-result model and its optional capabilities.
 */
export const ownedPhpWasmCallbackResultReadme = model => ownedPhpWasmBorrowReadme.replace(
	"Receiver-anchored and callback-result-anchored lifetimes are not implemented by this profile."
	, model.anchoredResults ? "This package also preserves its declared export-result anchors."
		: "This package declares no export-result or receiver anchors."
) + `
Borrowed results from a generated Lean closure follow the closure argument identified by the Lean contract. Closing that original whole argument expires the returned Value, including empty containers and results with no resource leaf. Host callback replies and recovery values may be raw PHP values or matching whole Values; a whole owner stays pinned until native code has copied the reply.

Generated callback resources and whole callback Values expose copyArg(index, payload) and copyResult(payload). Argument indices are zero-based and exclude the private closure parameter. These factories create independent whole Values for resource-bearing callback arguments and results. They reject copied-only selectors, foreign or closed closures, and mismatched whole Values before entering Lean.
`;

/**
 * Describe only the ownership capabilities present in this receiver package.
 *
 * @param model - Checked Zend receiver model and enabled transport features.
 */
export const ownedPhpWasmReceiverReadme = model => {
	const transfers = model.functions.some(fn => fn.transfers?.length);
	const paragraphs = ownedPhpWasmBorrowReadme.trim().split("\n\n").filter(paragraph => {
		if(paragraph.startsWith("Callbacks ") || paragraph.startsWith("A callback ")) return model.hostCallbacks;
		if(paragraph.startsWith("PHPDoc identifies whole-owner parameters.")) return false;
		if(paragraph.startsWith("Consuming calls ")) return transfers;
		return true;
	}).map(paragraph => paragraph.replace(
		"Receiver-anchored and callback-result-anchored lifetimes are not implemented by this profile."
		, model.callbackResultAnchors ? (model.anchoredResults
			? "This package preserves both receiver/export anchors and callback-result anchors."
			: "This package preserves callback-result anchors and declares no export-result anchors.")
			: model.anchoredResults ? "Callback-result-anchored lifetimes are not implemented by this profile."
			: "This package declares no borrowed-result anchors."
	).replace("These mappings apply inside aggregates and callbacks.", model.hostCallbacks
		? "These mappings apply inside aggregates and callbacks." : "These mappings apply inside aggregates."));
	paragraphs.push(`Methods use camelCase names; properties use read-only PHP property syntax. Resources and named aggregates have nominal owners such as TicketValue and BundleValue. share(), retain() and copy_value() preserve the owner class. Public functions remain available with snake_case names. Raw resource views omit members that require an original whole owner. Property assignment and deletion reject.`);
	paragraphs.push(`get() returns a borrowed payload. Pass a whole Value to parameters marked as whole-owner parameters in PHPDoc; pass get() to an ordinary call-scoped parameter. Closing the last shared root expires its raw resource views. retain() keeps an independent whole value. Canonical resource equality and hashes do not depend on PHP wrapper identity.`);
	if(model.anchoredResults) paragraphs.push(`A borrowed result follows its original receiver or selected parameter owner. Closing the last shared root or consuming that owner expires borrowed descendants, including empty values and returned Lean closures. Retaining a borrowed value keeps an independent copy.`);
	if(model.callbackResultAnchors) paragraphs.push(`A borrowed callback result follows the original whole callback argument selected by the Lean contract. Generated callback resources and whole callback Values provide copyArg() and copyResult() factories for independent owners. Host replies and recovery Values stay pinned through native handoff.`);
	return paragraphs.join("\n\n") + "\n";
};
