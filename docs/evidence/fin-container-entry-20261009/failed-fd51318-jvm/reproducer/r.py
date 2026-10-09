import gdb, os
for s in ["pagination off", "confirm off", "breakpoint pending off", "disable-randomization off"]:
    gdb.execute("set " + s)
gdb.execute("handle all nostop noprint pass")
gdb.execute("file /app/.toolchains/jdk22/bin/java")
gdb.execute("starti -version > out.txt 2> err.txt")
gdb.events.new_objfile.connect(lambda e: None)
gdb.execute("continue")
print("exit", gdb.convenience_variable("_exitcode"))
