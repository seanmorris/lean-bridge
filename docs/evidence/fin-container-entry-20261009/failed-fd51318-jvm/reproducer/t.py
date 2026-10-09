import gdb
gdb.execute("set pagination off")
gdb.execute("handle all nostop noprint pass")
gdb.execute("file /bin/true")
gdb.execute("starti")
gdb.execute("continue")
print("exit", gdb.convenience_variable("_exitcode"))
