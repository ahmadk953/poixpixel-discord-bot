import * as esbuild from "esbuild";
import * as file_system from "fs";
import * as path from "path";
import * as child_process from "child_process";
import * as events from "events";
import * as url from "url";

const RunTargetError = {
	TargetNotCompiled: "TargetNotCompiled",
	TargetProgramError: "TargetProgramError",
	TargetDirectoryMissing: "TargetDirectoryMissing"
}

const TargetInitializationError = {
	TargetDirectoryAlreadyExists: "TargetDirectoryAlreadyExists"
}

const TargetProgramError = {
	TargetNotRunning: "TargetNotRunning",
	InvalidTargetPath: "InvalidTargetPath"
}

const ProjectPackageError = {
	PackageMissing: "PackageMissing",
	InvalidJsonContents: "InvalidJsonContents"
}

const CompileToTargetError = {
	MissingPackageMainField: "MissingPackageMainField"
}

export const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
export const target_directory_path = path.join(__dirname, "../target/");
export const target_file_name = "_.cjs";
export const target_path = path.join(target_directory_path, target_file_name);
export const package_path = path.join(__dirname, "../package.json");

class TargetProgram extends events.EventEmitter {
	#child_process = null;
	#terminated = false;
	#error = 0;

	constructor(target_script_source) {
		super();

		if (!file_system.existsSync(target_script_source)) {
			throw new Error(TargetProgramError.InvalidTargetPath);
		}

		this.#child_process = child_process.spawn(
			`node${process.platform == "win32" ? ".exe" : ""}`,
			[ target_script_source ],
			{ stdio: "inherit" }
		);

		this.#child_process.on("exit", (code) => {
			this.#terminated = true;
			this.emit("terminate");

			if (code != 0) {
				this.#error = code;
				this.emit("error", code);
			}
		});
	}

	halt() {
		if (this.#terminated) {
			throw new Error(TargetprogramError.TargetNotRunning);
		}

		this.#child_process.kill('SIGINT');
	}

	get error() {
		return this.#error;
	}
}

export function initialize_target_directory() {
	if (!file_system.existsSync(target_directory_path)) {
		throw new Error(TargetInitializationError.TargetDirectoryAlreadyExists);
	}

	file_system.mkdirSync(target_directory_path, { recursive: true });
}

export function run_target() {
	if (!file_system.existsSync(target_directory_path)) {
		throw new Error(RunTargetError.TargetDirectoryMissing);
	}

	if (!file_system.existsSync(target_path)) {
		throw new Error(RunTargetError.TargetNotCompiled);
	}

	return new TargetProgram(target_path);
}

export function get_project_package() {
	if (!file_system.existsSync(package_path)) {
		throw new Error(ProjectPackageError.PackageMissing);
	}

	const contents = file_system.readFileSync(
		package_path,

		{
			encoding: "utf8",
			flag: "r"
		}
	);

	try {
		return JSON.parse(contents);
	} catch (_) {
		throw new Error(ProjectPackageError.InvalidJsonContents);
	}
}

export function compile_to_target() {
	const package_json = get_project_package();

	if (!package_json.main) {
		throw new Error(CompileToTargetError.MissingPackageMainField);
	}

	esbuild.buildSync({
		bundle: true,
		entryPoints: [ package_json.main ],
		outfile: target_path,
		platform: "node",
		format: "cjs",
		external: [ "deasync" ]
	});
}