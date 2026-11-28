// Each test JAR supplies its own package line.
public final class PortImpl implements experiment.Port {
    private enum Unit { INSTANCE }
    static { System.loadLibrary(LIBRARY); }
    private HostMembers port;
    private static native Object call(HostMembers p,int op,int kind,Object x);
    private static native long count(HostMembers p,int op,int kind,Object x);
    public void bind(Class<?> box,Class<?> key) {
        var candidate=HostContract.bind(Unit.class,box,key);
        call(candidate,0,0,null); port=candidate;
    }
    public Object self(int k,Object x) { return call(port,2,k,x); }
    public Object corpus(Object x) { return call(port,8,0,x); }
    public Object remember(int k,Object x) { return call(port,3,k,x); }
    public boolean same(int k,Object x) { return count(port,4,k,x)!=0; }
    public Object recall(int k) { return call(port,5,k,null); }
    public void clear() { call(port,6,0,null); }
    public void rejectSecond(int k,Object x) { call(port,7,k,x); }
    public long live() { return count(port,9,0,null); }
    public void close() { call(port,1,0,null); }
}
