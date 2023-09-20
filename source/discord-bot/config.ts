import * as l_discord from "../discord";

export interface Config_Interface {
	discord: l_discord.Config_Interface;
	storage?: {}
}

export const defaulted: Config_Interface = {
	discord: {
		api_key: "",
		application_client_id: "",
		guild_id: ""
	},
	storage: {}
}