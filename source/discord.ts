import * as discord from "discord.js";
import * as l_config from "./config";
import * as l_util from "./util";
import * as deasync from "deasync";
import * as discord_bot from "./discord-bot";

export interface Config_Interface {
    api_key?: string;
    application_client_id?: string;
    guild_id?: string;
}

export interface RecordFilter {
    id?: string;                                    // First ->-v
    name?: string;                                  // Second <-v
    filter?: (element: Guild | Channel) => boolean; // Third   <-
}

export const defaulted_config: Config_Interface = {
    api_key: "",
    application_client_id: "",
    guild_id: ""
}

export class InvalidToken_Error extends Error {
    constructor() {
        super("The token provided is invalid");
        this.name = "InvalidToken_Error"
    }
}

export class BotNotReady_Error extends Error {
    constructor() {
        super("The bot is not ready for API actions");
        this.name = "BotNotReady_Error"
    }
}

export class InvalidNetwork_Error extends Error {
    constructor() {
        super("The bot failed to perform any actions that relied on the network. Possible reasons are no network is connected, the API URL has changed, or the OS firewall is blocking the connection");
        this.name = "InvalidNetwork_Error"
    }
}

export class Bot extends l_util.Runable {
    public readonly config: l_config.Config<Config_Interface>;
    public readonly client: discord.Client;
    #ready = false;

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
        let error = null as any;

        this.client.once(discord.Events.ClientReady, () => {
            done = true;
        });

        this.client.login(this.config.real.api_key)
            .catch((sub_error) => {
                error = sub_error;
                done = true;
            });

        while (!done) { deasync.sleep(discord_bot.DiscordBot.polling_interval); }

        if (error) {
            if (error.name == "Error [TokenInvalid]") {
                throw new InvalidToken_Error();
            } else if (error.message.includes("getaddrinfo")) {
                throw new InvalidNetwork_Error();
            } else {
                throw error;
            }
        }

        this.#ready = true;
    }

    on_terminate(): void {
        let done = false;

        this.client.destroy()
            .then(() => {
                done = true;
            });

        while (!done) { deasync.sleep(100); }  
        this.#ready = false;
    }

    public get ready() {
        return this.#ready;
    }

    public get_guild(filter: RecordFilter) {
        if (!this.#ready) {
            throw new BotNotReady_Error();
        }

        if (
            filter.id
            && !filter.filter
            && !filter.name
        ) {
            let guild = null as any;
            let done = false;
            let error = null as any;

            this.client.guilds.fetch(filter.id)
                .then((api_build) => {
                    done = true;
                    guild = api_build;
                })
                .catch((api_error) => {
                    done = true;
                    error = api_error;
                });

            while (!done) { deasync.sleep(discord_bot.DiscordBot.polling_interval); }

            if (guild) {
                return [ new Guild(this, guild) ];
            }

            if (error) {
                throw error;
            }
        }

        const api_guilds = this.client.guilds.cache;

        // Filter by name
        let layer_1_filtered: discord.Guild[] = [];

        api_guilds.forEach((guild) => {
            if (guild.name == filter.name) {
                layer_1_filtered.push(guild);
            } else if (!filter.name) {
                layer_1_filtered.push(guild);
            }
        });

        // Filter with function
        let layer_2_filtered: Guild[] = [];

        layer_1_filtered.forEach((guild) => {
            const custom_guild = new Guild(this, guild);
            if (filter.filter && filter.filter(custom_guild)) {
                layer_2_filtered.push(custom_guild)
            } else if (!filter.filter) {
                layer_2_filtered.push(custom_guild);
            }
        });

        return layer_2_filtered;
    }
}

export class Guild {
    public readonly inner_guild: discord.Guild;
    public readonly bot: Bot;

    constructor(bot: Bot, guild: discord.Guild) {
        this.bot = bot;
        this.inner_guild = guild;
    }

    public get name() {
        return this.inner_guild.name;
    }

    public get_channel(filter: RecordFilter) {
        if (!this.bot.ready) {
            throw new BotNotReady_Error();
        }

        if (
            filter.id
            && !filter.filter
            && !filter.name
        ) {
            let channel = null as any;
            let done = false;
            let error = null as any;

            this.bot.client.channels.fetch(filter.id)
                .then((api_build) => {
                    done = true;
                    channel = api_build;
                })
                .catch((api_error) => {
                    done = true;
                    error = api_error;
                });

            while (!done) { deasync.sleep(discord_bot.DiscordBot.polling_interval); }

            if (channel) {
                return [ new Channel(this, channel) ];
            }

            if (error) {
                throw error;
            }
        }

        const api_channels = this.bot.client.channels.cache;

        // Filter by name
        let layer_1_filtered: discord.Channel[] = [];

        api_channels.forEach((channel) => {
            if ((channel as any).name == filter.name) {
                layer_1_filtered.push(channel);
            } else if (!filter.name) {
                layer_1_filtered.push(channel);
            }
        });

        // Filter with function
        let layer_2_filtered: Channel[] = [];

        layer_1_filtered.forEach((channel) => {
            const custom_channel = new Channel(this, channel);
            if (filter.filter && filter.filter(custom_channel)) {
                layer_2_filtered.push(custom_channel)
            } else if (!filter.filter) {
                layer_2_filtered.push(custom_channel);
            }
        });

        return layer_2_filtered;
    }
}

export class Channel {
    public readonly guild: Guild;
    public readonly inner_channel: discord.Channel;
    public readonly messages: Messages;

    constructor(guild: Guild, channel: discord.Channel) {
        this.guild = guild;
        this.inner_channel = channel;
        this.messages = new Messages(channel);
    }
}

export class Embed {
    public title = "";
    public description = "";
}

export class Messages {
    public readonly inner_channel: discord.Channel;

    constructor(channel: discord.Channel) {
        this.inner_channel = channel;
    }

    public push(message: Message) {
        const message_raw = { 
            content: message.text,
            embeds: Message.transform_embeds(message.embeds) as any
        };

        console.log(message_raw, message);
        (this.inner_channel as any).send(message_raw);
    }
}

export class Message {
    public text = "";
    public embeds: Embed[] = [];

    public static transform_embeds(embeds: Embed[]) {
        const embed_raw = [] as any[];

        embeds.forEach((embed) => {
            const raw = new discord.EmbedBuilder();

            raw.setTitle(embed.title);
            raw.setDescription(embed.description);

            embed_raw.push(raw);
        });

        return embed_raw;
    }
}

export interface CommandInteraction {
    channel: Channel;
}

export abstract class Command {
    public readonly trigger: string;
    public readonly description = "";
    
    constructor(trigger: string) {
        this.trigger = trigger;
    }

    abstract execute(interaction: CommandInteraction) {

    }
}