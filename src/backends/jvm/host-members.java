import java.lang.invoke.MethodHandle;
import java.lang.invoke.MethodHandles;
import java.lang.invoke.MethodType;
import java.lang.reflect.Method;
import java.lang.reflect.Modifier;
import java.math.BigInteger;
import java.util.Objects;

// Private to the generated component. Resolve all members before exposing
// the binding. No application object is called during this step.
final class HostMembers {
    record Site(String kind, Class<?> type) {
        Object checked(Object value, boolean result) {
            if (type == void.class && result) {
                if (value != null) throw new IllegalArgumentException("non-void setter result");
                return null;
            }
            Objects.requireNonNull(value, "null host value for " + kind);
            if (!type.isPrimitive()) type.cast(value);
            switch (kind) {
            case "uint8", "uint16", "char" -> {
                int n = (Integer)value;
                if (n < 0 || (kind.equals("uint8") && n > 255) ||
                    (kind.equals("uint16") && n > 65535) ||
                    (kind.equals("char") && (!Character.isValidCodePoint(n) || (n >= 0xd800 && n <= 0xdfff))))
                    throw new IllegalArgumentException("out of range: " + kind);
            }
            case "uint32" -> {
                long n = (Long)value;
                if (n < 0 || n > 0xffffffffL) throw new IllegalArgumentException("out of range: uint32");
            }
            case "uint64", "usize", "nat", "int" -> {
                BigInteger n = (BigInteger)value;
                if (n.getClass() != BigInteger.class || (!kind.equals("int") && n.signum() < 0) ||
                    ((kind.equals("uint64") || kind.equals("usize")) && n.bitLength() > 64))
                    throw new IllegalArgumentException("invalid " + kind);
            }
            case "string" -> {
                String s = (String)value;
                for (int i = 0; i < s.length(); i++) {
                    char c = s.charAt(i);
                    if (Character.isSurrogate(c) && !(Character.isHighSurrogate(c) && i + 1 < s.length()
                        && Character.isLowSurrogate(s.charAt(++i)))) throw new IllegalArgumentException("unpaired surrogate");
                }
            }
            case "bytes" -> { return ((byte[])value).clone(); }
            default -> {
                if (type.isPrimitive() && value.getClass() != MethodType.methodType(type).wrap().returnType())
                    throw new ClassCastException("wrong scalar for " + kind);
            }
            }
            return value;
        }
    }

    record Spec(Class<?> owner, String mode, String name, Site result, Site... parameters) {}
    // Emitted only for bad boundary values; a throwing application method is
    // outside the validation catch and retains its original exception type.
    static final class BoundaryFailure extends IllegalArgumentException {
        BoundaryFailure(String site, RuntimeException cause) { super("invalid host " + site, cause); }
    }
    private record Bound(MethodHandle invoke, Site[] args, int passed, Site result) {}
    private final Bound[] members;
    private final Class<?>[] classes;
    Class<?>[] classes() { return classes.clone(); }

    HostMembers(Class<?>[] classes, Spec... specs) {
        this.classes = classes.clone();
        members = new Bound[specs.length];
        for (int i = 0; i < specs.length; i++) {
            Spec s = specs[i];
            try {
                var lookup = MethodHandles.publicLookup();
                var owner = lookup.accessClass(s.owner);
                // Unit carries no application value. A Java host method need
                // not import a component-specific Unit class to serve two JARs.
                Class<?>[] args = java.util.Arrays.stream(s.parameters)
                    .filter(p -> !p.kind.equals("unit")).map(Site::type).toArray(Class<?>[]::new);
                MethodHandle target;
                boolean instance = s.mode.equals("instance");
                if (s.mode.equals("new")) {
                    if (Modifier.isAbstract(owner.getModifiers()) || owner.isEnum() || owner != s.result.type)
                        throw new IllegalArgumentException("not a constructible host class");
                    target = lookup.unreflectConstructor(owner.getConstructor(args));
                } else {
                    Method m = owner.getMethod(s.name, args);
                    if ((!instance && !s.mode.equals("static")) || Modifier.isStatic(m.getModifiers()) == instance ||
                        (m.getReturnType() != s.result.type && !s.result.type.isAssignableFrom(m.getReturnType())))
                        throw new IllegalArgumentException("member signature mismatch");
                    MethodType mt = MethodType.methodType(m.getReturnType(), args);
                    target = instance ? lookup.findVirtual(owner, s.name, mt) : lookup.findStatic(owner, s.name, mt);
                }
                Site[] sites = new Site[s.parameters.length + (instance ? 1 : 0)];
                if (instance) sites[0] = new Site("receiver", owner);
                System.arraycopy(s.parameters, 0, sites, instance ? 1 : 0, s.parameters.length);
                int passed = args.length + (instance ? 1 : 0);
                members[i] = new Bound(target.asFixedArity().asSpreader(Object[].class, passed)
                    .asType(MethodType.methodType(Object.class, Object[].class)), sites, passed, s.result);
            } catch (ReflectiveOperationException | IllegalArgumentException e) {
                throw new IllegalArgumentException("cannot bind " + s.owner.getTypeName() + "." + s.name, e);
            }
        }
    }

    // Private JNI ingress; checked exceptions escape unchanged to the
    // enclosing native call frame, never wrapped in InvocationTargetException.
    Object invokeWire(int slot, Object[] wire) throws Throwable {
        Bound b = members[slot];
        if (wire.length != b.args.length) throw new IllegalArgumentException("wrong host argument count");
        Object[] args = new Object[wire.length];
        for(int i=0; i<args.length; i++)
            args[i]=HostWire.decode(b.args[i].kind,b.args[i].type,wire[i]);
        return HostWire.encode(b.result.kind,invoke(slot,args));
    }
    Object invoke(int slot, Object[] input) throws Throwable {
        Bound b = members[slot];
        if (input.length != b.args.length) throw new IllegalArgumentException("wrong host argument count");
        Object[] args = new Object[b.passed];
        for (int i = 0,j = 0; i < input.length; i++) {
            try {
                Object v = b.args[i].checked(input[i], false);
                if (!b.args[i].kind.equals("unit")) args[j++] = v;
            }
            catch (RuntimeException e) { throw new BoundaryFailure("argument " + i, e); }
        }
        Object result = (Object)b.invoke.invokeExact(args);
        try { return b.result.checked(result, true); }
        catch (RuntimeException e) { throw new BoundaryFailure("result", e); }
    }
}
