import org.leanbridge.desk.Api;

class Example {
    public static void main(String[] args) {
        try (var ticket = Api.issue(42); var completed = org.leanbridge.depot.Api.checked(false, ticket).join()) {
            System.out.println(Api.count(completed));
        }
    }
}
