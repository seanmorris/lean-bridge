import org.leanbridge.desk.Api;

class Example {
    public static void main(String[] args) {
        try (var ticket = Api.issue(41); var updated = org.leanbridge.counter.Api.bump(ticket)) {
            System.out.println(Api.count(updated));
        }
    }
}
