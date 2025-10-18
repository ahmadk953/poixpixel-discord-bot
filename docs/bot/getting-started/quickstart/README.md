---
description: Get started with the Discord bot
icon: bullseye-arrow
---

# Quickstart

## Requirements

* **A Database & Cache**: Use **Valkey** or **Redis** for caching (we use Valkey in this guide). The main database must be **PostgreSQL**.
* **Server**: A server or computer to host the bot, preferably running Linux.
* **Skills**: Basic knowledge of the command line and managing servers.
* **Permissions**: The **Manage Server** permission in the Discord server where you want to add the bot.
* **Discord Developer Dashboard** access.
* A Discord account (obviously).

## Step 0: Chose Your Hosting Method

You can either choose to host everything yourself, or you can use a cloud provider to hose everything for you.

{% hint style="info" %}
We recommend hosting everything in the cloud since it's easier for beginners. However, if you have a spare computer or server and the knowledge to host it yourself, we suggest you do that since its cheaper than paying a cloud provider to host it all for you.
{% endhint %}

## Step 1: Basic Setup and Preparation

After deciding on how you want to host the bot and its resources, move onto the basic setup and preparation outlined below.

{% stepper %}
{% step %}
#### Navigate to the Discord Developer Dashboard

[Click this link](https://discord.com/developers/applications) and sign into your discord account. Once you sign in, you should see a page like this:

<figure><img src="../../.gitbook/assets/DiscordApplicationsPage.png" alt="Applications page of the Discord Developer Dashboard"><figcaption><p>Discord Developer Dashboard Applications Page</p></figcaption></figure>

This is what's known as your applications page. This is where you'll see and manage all of your Discord bots and applications.
{% endstep %}

{% step %}
#### Create a new application

Click the button that says, "New Application".

<figure><img src="../../.gitbook/assets/DiscordApplicationsPageMarkedUp.png" alt="Red arrow pointing to button on left navigation pane that says &#x22;New Application&#x22;"><figcaption><p>Create a New Application</p></figcaption></figure>

After clicking the button, give you Discord Bot a name, click the check box, and then click "Create".

<figure><img src="../../.gitbook/assets/CreateApplicationDialogue.png" alt="Create application dialogue"><figcaption><p>Create Application Dialogue</p></figcaption></figure>

Once you click the "Create" button and complete the CAPTCHA, you should see a page like this:

<figure><img src="../../.gitbook/assets/BotHomePage.png" alt="Discord application overview page"><figcaption><p>Discord Application Overview Page</p></figcaption></figure>

This is the overview page for your Discord bot. Here, you can configure the app icon, the app name, and app description.
{% endstep %}

{% step %}
#### Invite the bot to your server

In the left navigation pane, click the button that says, "OAuth2".

<figure><img src="../../.gitbook/assets/OAuth2Tab.png" alt="Red arrow pointing to button on left navigation pane that says &#x22;OAuth2&#x22;"><figcaption><p>OAuth2 Button</p></figcaption></figure>

Once you click the button, you should see a page that looks like this:

<figure><img src="../../.gitbook/assets/OAuth2Page.png" alt="OAuth2 Page"><figcaption><p>OAuth2 Page</p></figcaption></figure>

Underneath the section that says, "Client Information" where it says "Client ID", click on the "Copy" button. Save this number as we'll need it for later.

<figure><img src="../../.gitbook/assets/ClientIDCopy.png" alt="Arrow pointing to &#x22;Copy&#x22; button under Client ID section"><figcaption><p>Client ID</p></figcaption></figure>

Next, scroll down to this section:

<figure><img src="../../.gitbook/assets/OAuth2URLGenerator.png" alt="OAuth2 URL Generator"><figcaption><p>OAuth2 URL Generator</p></figcaption></figure>

Check the checkbox next to where it says, "bot". Scroll down. Under the "Bot Permissions" section, click the checkbox for "Administrator" under the "General Permissions" section. Next, scroll down again and for the "Intergration Type" dropdown, make sure it says, "Guild Install". In the end, your configuration should look something like this:

<figure><img src="../../.gitbook/assets/OAuth2URLGeneratorConfiguration.png" alt="OAuth2 URL Generator Configuration Options"><figcaption><p>OAuth2 URL Generator Configuration</p></figcaption></figure>

Click "Copy" next to "Generated URL".\\

<figure><img src="../../.gitbook/assets/CopyGeneratedOAuth2URL.png" alt="Copy generated URL"><figcaption><p>Copy Generated URL</p></figcaption></figure>

Open a new browser tab, pase in the link, and press <kbd>Enter</kbd>. You should then see a screen where you can invite the bot into a Discord server. Select your Discord server from the dropdown menu and click "continue".

{% hint style="info" %}
If you don't see the server you want to add the bot to, it's probably because you don't have the **Manage Server** permission in that Discord server
{% endhint %}

<figure><img src="../../.gitbook/assets/InviteBotServerSelect.png" alt="Invite discord bot to server dialogue"><figcaption><p>Invite Discord Bot Dialogue</p></figcaption></figure>

On the next screen, click "Authorize" and if prompted, complete multifactor authentication and the CAPTCHA.

<figure><img src="../../.gitbook/assets/AuthorizeDiscordBot.png" alt="Authorize Discord Bot"><figcaption><p>Authorize Discord Bot</p></figcaption></figure>

If everything was successful, you should see a success message like the one below.

<figure><img src="../../.gitbook/assets/BotAddedSuccessMessage.png" alt="Discord bot added successfully message"><figcaption><p>Success Message</p></figcaption></figure>

The discord bot was successfully added to your selected Discord server. You can now continue with the rest of the guide.
{% endstep %}

{% step %}
#### Configure installation settings

Click the button on the left navigation pane that says, "Installation".

<figure><img src="../../.gitbook/assets/InstallationTab.png" alt="Red arrow pointing to button on left navigation pane that says &#x22;Installation&#x22;"><figcaption><p>Installation Button</p></figcaption></figure>

After you click on the button, you'll be greeted by a page that look something like this:

<figure><img src="../../.gitbook/assets/InstallationPage.png" alt="Installation page"><figcaption><p>Installation Page</p></figcaption></figure>

First, uncheck the checkbox next to "User Install". Next, select "None" from the "Install Link" dropdown (click where it says "Discord Provided Link"). Finally, click "Save" at the bottom of the screen. When you're done, your screen should look like this:

<figure><img src="../../.gitbook/assets/InstallationCompleteOptions.png" alt="Updated installation options"><figcaption><p>Updated Installation Options</p></figcaption></figure>

Now, it's time to configure the actual Discord bot.
{% endstep %}

{% step %}
#### Configure and get your bot's information

Click the button on the left navigation pane that says, "Bot".

<figure><img src="../../.gitbook/assets/BotTab.png" alt="Red arrow pointing to button on left navigation pane that says &#x22;Bot&#x22;"><figcaption></figcaption></figure>

After clicking on the "Bot" tab, you'll see a page like this:

<figure><img src="../../.gitbook/assets/BotPage.png" alt="Discord application bot tab"><figcaption><p>Discord Application Bot Tab</p></figcaption></figure>

Here, you can configure things such as the username, banner, and icon of your bot. Scroll down to the section that looks like this:

<figure><img src="../../.gitbook/assets/BotOptions.png" alt="Discord bot options"><figcaption><p>Bot Options</p></figcaption></figure>

Deselect the "Public Bot" option and choose all other options. Make sure to click "Save". Your screen should resemble this:

<figure><img src="../../.gitbook/assets/BotOptionsComplete.png" alt="Updated bot options"><figcaption><p>Updated Bot Options</p></figcaption></figure>

{% hint style="info" %}
**Explanation for Selected Options:**

* Unselecting "Public Bot" restricts adding the bot to a server specifically to you, which is our intention.
* Enabling "Requires OAuth2 Code Grant" ensures the bot receives all its permissions before entering your server.
* By selecting all options under "Privileged Gateway Intents," the bot can view member presence statuses, manage members, and access message content.
{% endhint %}

Next, scroll back up to this section:

<figure><img src="../../.gitbook/assets/BasicBotConfigOptions.png" alt="Bot details and token configuration options"><figcaption><p>Basic Bot Configuration and Token Options</p></figcaption></figure>

Underneath the "Token" header, click on the button that says, "Reset Token".

<figure><img src="../../.gitbook/assets/ResetBotTokenButton.png" alt="Reset bot token button"><figcaption><p>Reset Token Button</p></figcaption></figure>

Click "Yes, do it!" on the dialogue that pops up.

<figure><img src="../../.gitbook/assets/ResetBotTokenDialogue.png" alt="Reset bot token confirmation dialogue"><figcaption><p>Reset Bot Token Dialogue</p></figcaption></figure>

Follow the multifactor authentication steps, and once complete, you should see a screen like this:

{% hint style="danger" %}
**WARNING: DO NOT SHARE YOUR BOT TOKEN WITH ANYONE. Treat your bot token like a password. If someone gets access to your bot's token, they'll have unrestricted access to your bot and Discord server, meaning they can do anything that they want. Store this token in a safe place as you won't get to see it again and will have to regenerate it.**
{% endhint %}

<figure><img src="../../.gitbook/assets/BotToken.png" alt="Discord bot token"><figcaption><p>Discord Bot Token</p></figcaption></figure>

Copy your bot token and save it somewhere safe. We'll need it later.
{% endstep %}

{% step %}
#### Gather other information

If you've made it this far without getting lost, give yourself a pat on the back. Before we move onto the fun stuff, we have to gather one some last bits of information from our Discord server.

Head on over to [Discord](https://discord.com/app) and click on the settings icon next to your username.

<figure><img src="../../.gitbook/assets/SettingsIcon.png" alt="Red arrow pointing to settings button"><figcaption><p>Settings Icon</p></figcaption></figure>

Next, scroll down on the left navigation pane and click "Advanced".

<figure><img src="../../.gitbook/assets/AdvancedSettingsTab.png" alt="Red arrow pointing to button on left navigation pane that says &#x22;Advanced&#x22;"><figcaption><p>Advanced Settings Button</p></figcaption></figure>

Find the option that says, "Developer Mode" and turn that on. Once you are done, your screen should look like this:

<figure><img src="../../.gitbook/assets/DeveloperModeToggle.png" alt="Developer mode toggle on"><figcaption><p>Developer Mode Toggle Turned On</p></figcaption></figure>

Exit settings and navigate to your Discord server. On the left server selector pane, right click on your Discord server and click the "Copy Server ID" button on the bottom of the options menu. This is what's known as your "Guild ID". Save this ID as we'll need it later.

<figure><img src="../../.gitbook/assets/CopyServerID.png" alt="Red arrow pointing to button that says &#x22;Copy Server ID&#x22;"><figcaption><p>Copy Server ID Button</p></figcaption></figure>

Next, in your Discord server, right click on your logs channel and click the "Copy Channel ID" button. Repeat this for your welcome channel.

<figure><img src="../../.gitbook/assets/CopyChannelID.png" alt="Red arrow pointing to button that says &#x22;Copy Channel ID&#x22;"><figcaption><p>Copy Channel ID Button</p></figcaption></figure>

Lastly, click on your server's name at the top and click on "Server Settings".

<figure><img src="../../.gitbook/assets/ServerSettings.png" alt="Server settings button"><figcaption><p>Server Settings Button</p></figcaption></figure>

Then, click on the "Roles" button in the left navigation pane and find the role(s) that you want to assign to people as soon as they join your server. Right click on each role and select "Copy Role ID". Save these ID's as we'll need them later when configuring the bot.

<figure><img src="../../.gitbook/assets/CopyRoleID.png" alt="Copy role ID for join roles"><figcaption><p>Copy Join Role ID</p></figcaption></figure>

We are now done with the preparation for our Discord bot. It's now time to setup and deploy the Discord bot and its services. Based on your decision in Step 0, click on the corresponding link to take you to the rest of the quick start guide.
{% endstep %}
{% endstepper %}

{% content-ref url="self-hosting.md" %}
[self-hosting.md](self-hosting.md)
{% endcontent-ref %}

{% content-ref url="using-a-cloud-provider.md" %}
[using-a-cloud-provider.md](using-a-cloud-provider.md)
{% endcontent-ref %}
