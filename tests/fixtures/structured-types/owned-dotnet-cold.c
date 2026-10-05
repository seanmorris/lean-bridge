#include <errno.h>
#include <signal.h>
#include <stdio.h>
#include <sys/resource.h>
#include <sys/wait.h>
#include <unistd.h>

void probe_fork_exit(int (*call)(int), int kind) {
  struct rlimit limit = {0, 0};
  if (setrlimit(RLIMIT_CORE, &limit) != 0) _exit(252);
  pid_t child = fork();
  if (child < 0) _exit(254);
  if (child == 0) { alarm(5); _exit(call(kind)); }
  int status = 0;
  while (waitpid(child, &status, 0) < 0) if (errno != EINTR) _exit(253);
  if (WIFSIGNALED(status)) fprintf(stderr, "Child terminated by signal %d\n", WTERMSIG(status));
  if (!WIFEXITED(status)) _exit(128 + WTERMSIG(status));
  int code = WEXITSTATUS(status);
  printf("{\"childExit\":%d}\n", code);
  fflush(stdout);
  _exit(code == (kind == 1 ? 1 : 0) ? 0 : 250);
}
