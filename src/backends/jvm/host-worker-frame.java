package __PACKAGE__;

import java.lang.foreign.MemorySegment;
import java.nio.ByteBuffer;
import java.util.Objects;
import static java.lang.foreign.ValueLayout.JAVA_INT;

/** Only Java references enter this sidecar. The owner thread resolves native
 * identities during a synchronous JNI call, never in the calling thread's arena. */
final class HostWorkerFrame {
    private final int slots;
    private Object[] inputs;
    private Object output;

    HostWorkerFrame(int slots) { this.slots = slots; }

    <T> void input(int slot, Class<T> type, T value) {
        Objects.checkIndex(slot, slots);
        Objects.requireNonNull(value, "missing JVM worker class");
        if (!type.isInstance(value)) throw new IllegalArgumentException("wrong nominal JVM worker class");
        if (inputs == null) inputs = new Object[slots];
        inputs[slot] = value;
    }

    <T> T output(Class<T> type) {
        Object value = output; output = null;
        return type.cast(Objects.requireNonNull(value, "missing JVM worker result"));
    }

    int call(HostMembers binding, int method, int op, MemorySegment args, MemorySegment handle,
             MemorySegment result, MemorySegment tags, MemorySegment control) {
        // A callback reply has two ABI slots: only slot 0 is a user value.
        // Slot 1 names the callback. It must never be interpreted as a Java object.
        Object[] classes = inputs;
        inputs = null; output = null;
        if (op == 8 && classes != null) classes = new Object[]{classes[0]};
        ByteBuffer in = args.byteSize() == 0 ? null : args.asByteBuffer();
        output = NativePort.work(binding, classes, method, op, in, handle.asByteBuffer(),
            result.asByteBuffer(), tags.asByteBuffer(), control.asByteBuffer());
        return control.get(JAVA_INT, 0);
    }
}
