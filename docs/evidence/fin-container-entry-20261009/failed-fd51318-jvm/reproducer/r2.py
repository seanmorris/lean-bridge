import gdb
for s in ["pagination off", "confirm off", "breakpoint pending off", "disable-randomization off"]:
    gdb.execute("set " + s)
gdb.execute("handle all nostop noprint pass")
gdb.execute("file /app/.toolchains/jdk22/bin/java")
gdb.execute("starti -version > out.txt 2> err.txt")
seen = []
gdb.events.new_objfile.connect(lambda e: seen.append(e.new_objfile.filename))
gdb.execute("continue")
print("lean objfiles in inferior:", [s for s in seen if "lean" in s])
print("exit", gdb.convenience_variable("_exitcode"))
