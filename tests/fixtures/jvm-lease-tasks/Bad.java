class Bad {
    void bad() {
        org.leanbridge.depot.Api.pending(org.leanbridge.desk.Api.badge(1), true);
        org.leanbridge.depot.Api.tickets(org.leanbridge.other_desk.Api.issue(1), false);
    }
}
