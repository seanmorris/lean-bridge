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
