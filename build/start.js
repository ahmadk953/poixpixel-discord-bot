import * as api from "./api.js";

console.log("Compilation started");

try {
	api.compile_to_target();
} catch (error) {
	console.error(`Failed to compile, Error: ${error}`);
	process.exit(1);
}

console.log("Compiled successfully");

try {
	const target = api.run_target();
} catch (fault) {
	console.error(`Failed to run target, Error: ${fault}`);
}