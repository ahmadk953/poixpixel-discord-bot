import * as discord from "discord.js";
import * as l_config from "./config";
import * as l_util from "./util";
import * as deasync from "deasync";

export interface Config_Interface {
    api_key?: string;
    application_client_id?: string;
    guild_id?: string;
}

const defaulted_config: Config_Interface = {
    api_key: "",
    application_client_id: "",
    guild_id: ""
}

export class Bot extends l_util.Runable {
    public readonly config: l_config.Config<Config_Interface>;
    public readonly client: discord.Client;

    constructor(
        config: Config_Interface
    ) {
        super();

        this.config = new l_config.Config(
            defaulted_config,
            config
        );

        let intents: discord.GatewayIntentBits[] = [];
        Object.keys(discord.GatewayIntentBits).forEach((intent_key: any) => intents.push(discord.GatewayIntentBits[intent_key] as any));

        this.client = new discord.Client({
            intents
        });
    }

    on_run(): void {
        let done = false;
        let error = false;

        this.client.once(discord.Events.ClientReady, () => {
            done = true;
        });

        this.client.login(this.config.real.api_key);

        while (!done) { deasync.sleep(100); }

        if (error) {
            console.error("FAILED TO LOGIN");
        } else {
            console.log("ONLINE");
        }
    }

    on_terminate(): void {
        
    }
}

export class Command {
    
}