/** @file Execute a PHP test client on a distinct Zend heap in either host. */

/**
 * Mount the dependencies, run the consumer and collect its checked results.
 *
 * @param options - Interpreter class, private host bindings, dependency files and PHP client.
 */
export const runZendClient=async options=>{
	const {Php,shared,brick,sources}=options;
	const php=new Php({version: "8.4",autoTransaction: false,shared});let out="",err="";
	php.addEventListener("output",e=>{out+=e.detail.join("");});php.addEventListener("error",e=>{err+=e.detail.join("");});
	if((await php.binary).HEAPU8.buffer instanceof SharedArrayBuffer) throw new Error("Expected separate, unthreaded Zend heap");
	const dirs=new Set();
	for(const [path,contents] of Object.entries(brick))
	{
		const parts=path.split("/");let parent="";
		for(const part of parts.slice(0,-1))
		{
			parent+="/"+part;
			if(!dirs.has(parent))
			{await php.mkdir(parent);dirs.add(parent);}
		}
		await php.writeFile("/"+path,contents);
	}
	for(const [name,source] of Object.entries(sources)) await php.writeFile("/"+name+".php",source);
	const rc=await php.run("<?php require '/dependencies/brick-math/autoload.php';"+Object.keys(sources).map(n=>"require '/"+n+".php';").join(" "));
	if(rc!==0 || err) throw new Error(err || out || "PHP failed: "+rc);
	return JSON.parse(out);
};

/**
 * No completed test may leave a callback, notification or strong Lean root behind.
 *
 * @param runtime - The component's actual shared Lean worker runtime.
 */
export const drainedZendStats=async runtime=>{
	await runtime.whenIdle();const stats=runtime.stats();
	for(const key of ["frames","allocations","pending","notifications","nativeOwners","hostPins","hostErrors"])
		if(stats[key]!==0) throw new Error(key+" not drained: "+stats[key]);
	return stats;
};
