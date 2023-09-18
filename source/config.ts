import * as l_util from "./util";

export class Config<Config_Interface> {
    public readonly defaulted: Config_Interface;
    #real: Config_Interface;

    public events = {
        change: [] as unknown as (() => {})[]
    };

    constructor(
        defaulted: Config_Interface,
        real: Config_Interface
    ) {
        this.defaulted = defaulted;
        this.#real = l_util.object.merge.recursive_merge(defaulted, real);
    }

    public set real(new_real: Config_Interface) {
        this.#real = l_util.object.merge.recursive_merge(this.defaulted, new_real);
        this.events.change.forEach((event_callback: any) => event_callback());
    }

    public get real() {
        return this.#real;
    }
}