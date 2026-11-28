package experiment;

public interface Port extends AutoCloseable {
    void bind(Class<?> box, Class<?> key);
    Object self(int kind,Object x);
    Object corpus(Object x);
    Object remember(int kind,Object x);
    boolean same(int kind,Object x);
    Object recall(int kind);
    void clear();
    void rejectSecond(int kind,Object x);
    long live();
    void close();
}
