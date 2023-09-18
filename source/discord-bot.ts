import * as config from "./discord-bot/config";
import * as l_config from "./config";
import * as l_discord from "./discord";
import * as l_util from "./util";
import * as c_discord_bot from "../config/discord-bot";

export class DiscordBot extends l_discord.Bot {
    public static config: l_config.Config<config.Config_Interface>;
    public static discord_bot: l_discord.Bot;
    
    static main(
        p_config: config.Config_Interface
    ) {
        this.config = new l_config.Config(
            config.defaulted,
            p_config
        );

        this.discord_bot = new l_discord.Bot(this.config.real.discord);
        console.log("Starting");
        this.discord_bot.running = true;
        console.log("READY")

        setTimeout(() => {
            this.discord_bot.running = false;
            console.log("offline");
        }, 2000);
    }
}

DiscordBot.main(c_discord_bot.data);