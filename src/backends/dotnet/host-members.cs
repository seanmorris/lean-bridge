using System;
using System.Linq;
using System.Numerics;
using System.Reflection;
using System.Text;

namespace LeanBridge.GeneratedHost;

// Component-private: resolve every exact signature before any application method executes.
internal sealed class HostMembers {
    internal sealed record Site(string Kind, Type Type) {
        internal object? Check(object? value) {
            if (Kind == "unit") return value is null ? null : throw new ArgumentException("Expected Unit");
            if (!Type.IsInstanceOfType(value)) throw new ArgumentException("Invalid value for " + Kind);
            if (Kind == "nat" && ((BigInteger)value!).Sign < 0) throw new ArgumentOutOfRangeException(nameof(value));
            if (value is string s && Kind == "string") _ = Utf8.GetByteCount(s);
            return Kind == "bytes" ? ((byte[])value!).Clone() : value;
        }
    }
    internal sealed record Spec(Type Owner, string Mode, string Name, Site Result, params Site[] Parameters);
    internal sealed class BadValue : ArgumentException {
        internal BadValue(string site, Exception e) : base("Invalid host " + site, e) {}
    }
    private sealed record Bound(MethodBase Method, bool Instance, Site[] Args, Site Result);
    private static readonly UTF8Encoding Utf8 = new(false, true);
    private readonly Bound[] members;
    internal HostMembers(Type[] types, params Spec[] specs) {
        if (types.Any(t => t is null || !t.IsVisible || !(t.IsClass || t.IsInterface) || t.IsArray || t.ContainsGenericParameters))
            throw new ArgumentException("Expected public, closed CLR reference types");
        members = specs.Select(s => {
            var args = s.Parameters.Where(p => p.Kind != "unit").Select(p => p.Type).ToArray();
            bool instance = s.Mode is "instance" or "get" or "set";
            const BindingFlags exact = BindingFlags.Public | BindingFlags.ExactBinding;
            var flags = exact | (instance ? BindingFlags.Instance : BindingFlags.Static | BindingFlags.FlattenHierarchy);
            MethodBase? m;
            if (s.Mode == "new") {
                m = s.Owner.IsAbstract ? null : s.Owner.GetConstructor(exact | BindingFlags.Instance, null, args, null);
            } else if (s.Mode is "get" or "set") {
                var property = s.Owner.GetProperty(s.Name, flags, null, s.Mode == "get" ? s.Result.Type : args[0], Type.EmptyTypes, null);
                m = s.Mode == "get" ? property?.GetGetMethod() : property?.GetSetMethod();
            } else m = s.Owner.GetMethod(s.Name, flags, null, args, null);
            if (m == null || m.ContainsGenericParameters || !m.GetParameters().Select(p => p.ParameterType).SequenceEqual(args)
                || (m is MethodInfo method && (method.IsStatic == instance || !(method.ReturnType == s.Result.Type ||
                    (s.Result.Kind == "nominal" && s.Result.Type.IsAssignableFrom(method.ReturnType))))))
                throw new ArgumentException("Missing exact CLR host member " + s.Owner + "." + s.Name);
            return new Bound(m, instance, instance ? new[]{new Site("nominal",s.Owner)}.Concat(s.Parameters).ToArray() : s.Parameters, s.Result);
        }).ToArray();
    }
    internal object? Invoke(int slot, params object?[] values) {
        var b = members[slot];
        if (values.Length != b.Args.Length) throw new ArgumentException("Wrong host member arity");
        object? receiver = null;
        var args = new object?[b.Method.GetParameters().Length];
        try {
            for (int i=0, j=0; i<values.Length; i++) {
                var value = b.Args[i].Check(values[i]);
                if (i == 0 && b.Instance) receiver = value;
                else if (b.Args[i].Kind != "unit") args[j++] = value;
            }
        } catch (ArgumentException e) { throw new BadValue("argument",e); }
        // Never unwrap TargetInvocationException: an application may itself throw one.
        const BindingFlags direct = BindingFlags.DoNotWrapExceptions;
        var result = b.Method is ConstructorInfo ctor ? ctor.Invoke(direct,null,args,null) : b.Method.Invoke(receiver,direct,null,args,null);
        try { return b.Result.Check(result); }
        catch (ArgumentException e) { throw new BadValue("return",e); }
    }
}
