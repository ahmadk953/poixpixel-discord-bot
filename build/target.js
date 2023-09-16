import * as api from "./api.js";

try {
	const target = api.run_target();
} catch (fault) {
	console.error(`Failed to run target, Error: ${fault}`);
}