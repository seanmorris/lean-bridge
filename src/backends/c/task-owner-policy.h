static int lb_context(void) {
    return getpid() == (pid_t)syscall(SYS_gettid) && lean_bridge_native_process_valid();
}
