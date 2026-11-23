class Bad {
    void bad() {
        org.leanbridge.counter.Api.bump(org.leanbridge.desk.Api.badge(1));
        org.leanbridge.counter.Api.bump(org.leanbridge.other_desk.Api.issue(1));
    }
}
