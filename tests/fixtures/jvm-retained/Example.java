import org.leanbridge.feedback.Api;
import org.leanbridge.feedback.RetainedCallback;

class Example {
    public static void main(String[] args) {
        try (var addTwo = RetainedCallback.function((Long n) -> n + 2)) {
            System.out.println(Api.once(40, addTwo.callback()).join());
        }
    }
}
