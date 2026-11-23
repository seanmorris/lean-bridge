import org.leanbridge.timers.Api;

class ExitPending {
    public static void main(String[] args) {
        Api.reset();
        var task = Api.openTask(false, "do not wait for me at exit");
        Observe.until(() -> Api.state() == 1 && Observe.reactors() == 1);
        Observe.check(!task.isDone());
        System.out.println("normal JVM exit with a non-cooperative pending Lean task");
        // No cancellation, release, System.exit or Runtime.halt here.
    }
}
