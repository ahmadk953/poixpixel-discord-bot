import * as config from "./discord-bot/config";
import * as l_config from "./config";
import * as l_discord from "./discord";
import * as l_util from "./util";
import * as c_discord_bot from "../config/discord-bot";

export class DiscordBot extends l_discord.Bot {
    public static config: l_config.Config<config.Config_Interface>;
    public static discord_bot: l_discord.Bot;
    public static polling_interval: 50; // ms
    public static guild: l_discord.Guild;
    
    static main(
        p_config: config.Config_Interface
    ) {
        console.log("Running bot tasks")

        console.log("-- Loading configuration");
        this.config = new l_config.Config(
            config.defaulted,
            p_config
        );

        this.discord_bot = new l_discord.Bot(this.config.real.discord);

        try {
            console.log("-- Logging into bot API");
            this.discord_bot.running = true;
        } catch (error: any) {
            DiscordBot.error_stop(error);
        }

        try {
            console.log("-- Fetching guild");
            this.guild = this.discord_bot.get_guild({
                id: this.config.real.discord.guild_id
            })[0];
        } catch (error: any) {
            DiscordBot.error_stop(error);
        }

        try {
            const channel_id = "1043280866744488067";
            console.log("-- Fetching test channel");

            const channel = this.guild.get_channel({
                id: channel_id
            })[0];

            console.log(channel, this.guild);
            const msg = new l_discord.Message();
            msg.text = "HELLO TEXT";

            const message_stream = channel.messages;

            const embed = new l_discord.Embed();
            embed.title = "Hello";
            embed.description = "IDK";
            msg.embeds = [ embed ];

            message_stream.push(msg);
        } catch (error: any) {
            DiscordBot.error_stop(error);
        }


        console.log("All tasks completed");
    }

    static error_stop(error: Error) {
        console.error("Fatal Error: Failed to execute bot tasks");
        console.error(error);

        process.exit(1);
    }
}

DiscordBot.main(c_discord_bot.data);