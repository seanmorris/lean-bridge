import org.leanbridge.journal.Api;
import org.leanbridge.journal.ChooseError;
import org.leanbridge.journal.Result;

class Example {
    public static void main(String[] args) {
        Api.store(args[0], "ready");
        System.out.println(Api.read(args[0]));
        try {
            Api.choose(true, false, "unused");
        } catch (ChooseError e) {
            Result<String, Long> payload = e.payload();
            if (payload instanceof Result.Err<String, Long> err)
                System.out.println(err.error());
        }
    }
}
