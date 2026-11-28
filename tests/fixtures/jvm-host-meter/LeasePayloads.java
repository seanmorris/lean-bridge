import org.leanbridge.workshop.Api;
import org.leanbridge.workshop.MixedFaultError;
import org.leanbridge.workshop.Result;

final class LeasePayloads {
    static void check(boolean ok) { if (!ok) throw new AssertionError(); }
    static void readme(Class<?> component) throws Exception {
        var file = java.nio.file.Path.of(component.getProtectionDomain().getCodeSource().getLocation().toURI());
        try (var jar = new java.util.jar.JarFile(file.toFile()); var stream = jar.getInputStream(jar.getJarEntry("README.md"))) {
            String text = new String(stream.readAllBytes(), java.nio.charset.StandardCharsets.UTF_8);
            for (String required : new String[]{"Api.bindHosts(Box.class)", "new Box(long)",
                    "long Box.getLevel()", "void Box.setLevel(long)", "Box Box.identity()"}) check(text.contains(required));
        }
    }
    static void run() throws Exception {
        readme(Api.class); readme(org.leanbridge.workshop_peer.Api.class);
        Consumer.Box box;
        MixedFaultError saved;
        try (var a = Api.bindHosts(Consumer.Box.class); var b = org.leanbridge.workshop_peer.Api.bindHosts(Consumer.Box.class)) {
            box = b.make(17);
            Result<Consumer.Box,Consumer.Box> ok = a.chooseBox(box,true), err = a.chooseBox(box,false);
            check(((Result.Ok<Consumer.Box,Consumer.Box>)ok).value() == box);
            check(((Result.Err<Consumer.Box,Consumer.Box>)err).error() == box);
            try { b.rejectBox(box); throw new AssertionError(); }
            catch (org.leanbridge.workshop_peer.RejectBoxError e) {
                check(e.declaration().equals("Peer.rejectBox") && e.payload() == box && e.payload(Consumer.Box.class) == box);
                try { e.payload(String.class); throw new AssertionError(); } catch (ClassCastException expected) {}
            }
            a.mixedFault(box,3);
            try { a.mixedFault(box,0); throw new AssertionError(); }
            catch (MixedFaultError e) { check(e.payload(Consumer.Box.class).equals(new Result.Err<>("outer"))); }
            try { a.mixedFault(box,2); throw new AssertionError(); }
            catch (MixedFaultError e) { check(e.payload(Consumer.Box.class).equals(new Result.Ok<>(new Result.Ok<>(29L)))); }
            try { a.mixedFault(box,1); throw new AssertionError(); } catch (MixedFaultError e) { saved=e; }
        }
        // The throwable holds public Java values, not a JNI frame, a live
        // binding, or a pointer into a Lean result that has been released.
        Result<Result<Long,Consumer.Box>,String> result = saved.payload(Consumer.Box.class);
        var inner = ((Result.Ok<Result<Long,Consumer.Box>,String>)result).value();
        Consumer.Box original = ((Result.Err<Long,Consumer.Box>)inner).error();
        check(original == box && original.read() == 17);
        check(saved.payload() instanceof Result.Ok<?,?>);
        try { saved.payload(String.class); throw new AssertionError(); } catch (ClassCastException expected) {}
    }
}
