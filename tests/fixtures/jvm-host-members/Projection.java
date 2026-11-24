package org.leanbridge.projection;

public final class Projection {
    static final class Left {}
    static final class Right {}
    public static void main(String[] args) {
        var left=new Left(); var right=new Right();
        var a=new BothError(new Result.Ok<>(right));
        var b=new BothError(new Result.Err<>(new Result.Ok<>(left)));
        var c=new BothError(new Result.Err<>(new Result.Err<>(right)));
        Result<Right,Result<Left,Right>> value=b.payload(Left.class,Right.class);
        if (!value.equals(new Result.Err<>(new Result.Ok<>(left))) ||
            !a.payload(Left.class,Right.class).equals(new Result.Ok<>(right)) ||
            !c.payload(Left.class,Right.class).equals(new Result.Err<>(new Result.Err<>(right)))) throw new AssertionError();
        try { b.payload(Right.class,Left.class); throw new AssertionError("accepted wrong active type"); }
        catch (ClassCastException expected) {}
        System.out.println("two nominal types; checked active branches");
    }
}
