/** @file Generate typed CLR leases for records containing application-owned classes. */
import {dotnetScalarResult} from "./sync-io.mjs";

/**
 * Keep host classes as their actual closed generic types. A snapshot holds
 * strong references for a synchronous call; disposal only releases this
 * record, and never disposes the application objects it contains.
 *
 * @param api - Compiler-derived public interface.
 * @param g - Closed generic arguments shared with this package's typed binding.
 * @param constraints - Class constraints for application types.
 * @param leaf - Type spelling for each verified scalar or host class.
 */
export const dotnetHostRecords = (api, g, constraints, leaf) => {
	const entries = new Map(), classes = [], readers = [];
	const generics = g.slice(1, -1).split(",");
	const occupied = new Set(["Api", "Bound", "Wire", "Unit", "System", "Result", "DeclaredError", "LeanIOException", "WrongContextException", "RuntimeUnavailableException", "HostContract", "HostMembers", "HostCall", "HostRefs", "HostFunctionOwner", "HostFunctionLease", ...generics]);
	for(const type of api.types.filter(t => t.kind === "record"))
	{
		const name = type.name, pub = name + g;
		if(!/^[A-Z][A-Za-z0-9_]*$/u.test(name) || occupied.has(name)) throw new TypeError("Invalid CLR record name: " + name);
		occupied.add(name);
		const members = new Set([name, "Fields", "Snapshot", "FromNativeFields", "Dispose", "GetType", "GetHashCode", "Equals", "ToString", "Finalize", "MemberwiseClone", "ReferenceEquals", ...generics]);
		const fields = type.fields.map(f => {
			const property = f.name.split("_").map(p => p.charAt(0).toUpperCase() + p.slice(1)).join("");
			if(!/^[A-Z][A-Za-z0-9]*$/u.test(property) || members.has(property)) throw new TypeError("Colliding CLR record property: " + property);
			members.add(property); return {property, ref: f.type, type: leaf(f.type), parameter: "@" + f.name};
		});
		if(!fields.length || fields.length > 64 || !fields.some(f => f.ref.kind === "named")) throw new TypeError("Invalid CLR application record fields");
		const label = "ReadHostRecord" + entries.size;
		const params = fields.map(f => f.type + " " + f.parameter).join(",");
		const checked = f => f.ref.kind === "named" || ["string", "bytes"].includes(f.ref.name)
			? f.parameter + " ?? throw new global::System.ArgumentNullException(nameof(" + f.parameter + "))" : f.parameter;
		const copied = fields.map(f => f.ref.name === "bytes" ? "(byte[])(" + checked(f) + ").Clone()" : f.parameter);
		classes.push(`public sealed class ${pub} : global::System.IDisposable ${constraints} {
    internal sealed class Fields(${params}) {
${fields.map(f => "        internal readonly " + f.type + " " + f.property + "=" + checked(f) + ";").join("\n")}
    }
    private Fields? held;
    private ${name}(Fields fields) { this.held=fields; }
    public ${name}(${params}) : this(new Fields(${copied.join(",")})) {}
    internal static ${pub} FromNativeFields(${params}) => new(new Fields(${fields.map(f => f.parameter).join(",")}));
    internal Fields Snapshot() => global::System.Threading.Volatile.Read(ref held) ?? throw new global::System.ObjectDisposedException(nameof(${name}${g}));
${fields.map(f => "    public " + f.type + " " + f.property + " => " + (f.ref.name === "bytes" ? "(byte[])Snapshot()." + f.property + ".Clone()" : "Snapshot()." + f.property) + ";").join("\n")}
    public void Dispose() => global::System.Threading.Interlocked.Exchange(ref held,null);
}`);
		const reads = fields.map((f, i) => {
			const slot = "leaf" + i, nominal = f.ref.kind === "named";
			const disposition = ["int", "nat"].includes(f.ref.name) ? 2 : ["bytes", "string"].includes(f.ref.name) ? 1 : 0;
			const value = nominal ? "HostRefs.Read(" + slot + "[0]) as " + f.type + " ?? throw new global::System.InvalidOperationException(\"Invalid native CLR record object\")"
				: dotnetScalarResult(f.ref.name).replace(/\boutput\b/gu, slot);
			return "        ulong* " + slot + "=lanes+" + 4*i + "; if(" + slot + "[3]!=" + disposition + (nominal ? " || " + slot + "[1]!=0 || " + slot + "[2]!=0" : "") + ") throw new global::System.InvalidOperationException(\"Invalid record field storage\");\n        " + f.type + " f" + i + "=" + value + ";";
		});
		readers.push(`    private static ${pub} ${label}${g}(ulong* output) ${constraints} {
        if(output[3]!=3 || output[1]!=${fields.length} || output[2]!=0 || output[0]==0 || (output[0]&7)!=0)
            throw new global::System.InvalidOperationException("Invalid native CLR record");
        ulong* lanes=(ulong*)output[0];
${reads.join("\n")}
        return ${pub}.FromNativeFields(${fields.map((_, i) => "f" + i).join(",")});
    }`);
		entries.set(type.source.declaration, {pub, fields, read: label + g + "(output)"});
	}
	return {entries, classes: classes.join("\n"), readers: readers.join("\n")};
};
