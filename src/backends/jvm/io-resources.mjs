/**
 * Shared JVM nominal classes for compiler-identified Lean resources.
 *
 * @file
 */
import { taskResourceTypes } from "../c/task-resources.mjs";

/**
 * Authenticate the wire kind and its ledger before projecting any application type.
 *
 * @param api - Checked component binding IR.
 * @param wire - Private adapter generated from the same elaborated declarations.
 * @param evidence - Compiled native library inventory and ledger identity.
 * @param reserved - Reserved JVM identifiers that must be escaped.
 */
export const jvmLeaseModels = (api, wire, evidence, reserved) => {
	const kinds = taskResourceTypes(api.types?.filter(t => t.kind === "resource") ?? []);
	if(wire.leases !== undefined && !Array.isArray(wire.leases) || kinds.length !== (wire.leases?.length ?? 0)
		|| new Set(kinds.map(r => r.hash)).size !== kinds.length) throw new TypeError("Inconsistent JVM resource definitions");
	return new Map(kinds.map((r, i) => {
		const w = wire.leases[i], ledger = evidence?.ledgerId;
		if(!/^[a-f0-9]{64}$/u.test(ledger) || !/^[a-f0-9]{64}$/u.test(evidence?.libraries?.["liblb_task_resources_" + ledger + ".so"])
			|| w.type !== "lease:" + r.hash || w.hash !== r.hash || w.name !== r.name
			|| w.tag !== i + 3 || w.symbol !== wire.clear.slice(0,-6) + "_lease_" + i)
			throw new TypeError("Unverified JVM resource kind or ledger");
		const escape = reserved.has(r.name) || ["java", "as", "fun", "in", "is", "object", "typealias", "val", "when", "typeof"].includes(r.name);
		const ns = "org.leanbridge.resources.h" + r.hash, name = escape ? "_" + r.name : r.name;
		return [w.type, { ...w, id: r.id, ns, name, ledger, index: i, leaseClass: ns + "." + name }];
	}));
};

/**
 * Refuse changes of kind, position, borrow duration, result ownership or exception payload.
 *
 * @param leases - Authenticated nominal types keyed by wire spelling.
 * @param method - Compiler-selected private wire method.
 * @param decl - Corresponding public declaration.
 * @param api - Checked binding IR and failure table.
 */
export const verifyJvmLeaseSites = (leases, method, decl, api) => {
	if(!leases.size) return;
	const byId = new Map([...leases.values()].map(r => [r.id, r]));
	const site = (shape, field, input) => {
		const actual = leases.get(shape), expected = byId.get(field?.type?.id);
		if(actual !== expected || actual && (field.ownership !== (input ? "borrow" : "lease")
			|| field.lifetime?.scope !== (input ? "call" : "explicit") || field.lifetime.anchor !== null))
			throw new TypeError("Unverified JVM resource ownership: " + method.declaration);
	};
	method.args.forEach((t, j) => site(t, decl.parameters[j], true)); site(method.result, decl.result, false);
	const declared = new Set(decl.failure.errors.map(id => api.errors.find(e => e.id === id)?.payload?.id).filter(id => byId.has(id)));
	const actual = new Set([method.error, method.terminal].map(t => leases.get(t)?.id).filter(Boolean));
	if(actual.size !== declared.size || [...actual].some(id => !declared.has(id))) throw new TypeError("Unverified JVM resource error: " + method.declaration);
	for(const [stage, type] of [["EIO", method.error], ["AsyncStep", method.terminal]])
	{
		const id = "error:" + stage + "." + method.declaration;
		const expected = decl.failure.errors.includes(id) ? byId.get(api.errors.find(e => e.id === id)?.payload?.id) : undefined;
		if(expected !== leases.get(type)) throw new TypeError("Unverified JVM resource error stage: " + method.declaration);
	}
};

/**
 * Emit identical nominal class bytes in independent packages sharing a Lean kind.
 * Only the private constructor and accessors carry native identity; all public operations are typed.
 *
 * @param r - A verified JVM lease model.
 */
export const jvmLeaseSource = r => `package ${r.ns};

public final class ${r.name} implements java.lang.AutoCloseable {
    private final java.lang.String ledger;
    private final long id, domain;
    private final java.lang.invoke.MethodHandle dispatch;
    private volatile boolean closed;
    private ${r.name}(java.lang.String ledger, long id, long domain, java.lang.invoke.MethodHandle dispatch) {
        this.ledger = ledger; this.id = id; this.domain = domain; this.dispatch = dispatch;
    }
    private long key(java.lang.String expected) {
        if (!ledger.equals(expected)) throw new java.lang.IllegalArgumentException("Incompatible Lean resource ledger");
        if (closed) throw new java.lang.IllegalStateException("Lean resource is closed");
        return id;
    }
    private java.lang.Object apply(int op, java.lang.Object other) {
        key(ledger);
        try { return (java.lang.Object)dispatch.invokeExact(op, id, domain, other); }
        catch (java.lang.RuntimeException | java.lang.Error e) { throw e; }
        catch (java.lang.Throwable t) { throw new java.lang.IllegalStateException("Lean resource operation failed", t); }
    }
    public ${r.name} retain() { return (${r.name})apply(1, null); }
    public boolean sameResource(${r.name} other) { return (java.lang.Boolean)apply(2, java.util.Objects.requireNonNull(other)); }
    public boolean isClosed() { return closed; }
    @Override public synchronized void close() { if (!closed) { apply(0, null); closed = true; } }
}
`;
