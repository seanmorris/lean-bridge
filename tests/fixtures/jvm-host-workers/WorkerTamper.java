import java.io.*;
import java.net.*;
import java.nio.file.Path;

/** Negative loader check, separate from the application clients. */
public final class WorkerTamper {
    public static void main(String[] args) throws Exception {
        URL jar=Path.of(args[0]).toUri().toURL();
        String target=args[1];
        if(!target.equals("ledger") && !target.equals("jni")) throw new AssertionError(target);
        try(var altered=new URLClassLoader(new URL[]{jar},ClassLoader.getPlatformClassLoader()) {
            @Override public InputStream getResourceAsStream(String name) {
                if(target.equals("jni")?name.startsWith("META-INF/lean-bridge/jni/"):
                    name.startsWith("META-INF/lean-bridge/native/linux-x64/liblb_task_resources_"))
                    return new ByteArrayInputStream(new byte[]{1,2,3});
                return super.getResourceAsStream(name);
            }
        }) {
            try {
                altered.loadClass("org.leanbridge.workshop.Api").getMethod("bindHosts",Class.class).invoke(null,Installed.Box.class);
                throw new AssertionError("accepted modified "+target);
            } catch(java.lang.reflect.InvocationTargetException expected) {
                Throwable reason=expected.getCause();
                while(reason.getCause()!=null) reason=reason.getCause();
                String prefix=target.equals("jni")?"JNI entry library differs from verified component":"Packaged native library differs from compiled evidence: liblb_task_resources_";
                if(reason.getMessage()==null || !reason.getMessage().contains(prefix)) throw new AssertionError(target,expected);
            }
        }
        System.out.println("Modified worker "+target+" refused");
    }
}
