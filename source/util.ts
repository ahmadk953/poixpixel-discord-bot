export * as object from "./util/object";

export abstract class Runable {
    #running = false;

    abstract on_run(): void;
    abstract on_terminate(): void;

    public set running(value: boolean) {
        if (value && !this.#running) this.on_run();
        else if (!value && this.#running) this.on_terminate();
    }

    public get running() {
        return this.#running;
    }
}