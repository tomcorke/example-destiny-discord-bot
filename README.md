# Example Destiny Discord Bot

## Features



## Configuration

Copy `.env.example` to `.env`, and fill it with your Discord and Bungie application credentials

- To create a Discord application go to: https://discordapp.com/developers/applications/
  - Choose appropriate permissions for your application on the "OAuth2" section of your application
  - I've been using `92224`, which grants the following permissions:
    - Send Messages
    - Manage Messages
    - Embed Links
    - Read Message History
    - Add Reactions
    
- To create a Bungie application go to: https://www.bungie.net/en/Application
  - Your application's redirect URL should be `https://localhost:3000/register`

Create self-signed certificates for localhost, so the application can run with HTTPS

- I use [mkcert](https://github.com/FiloSottile/mkcert), which has releases for macOS, Linux and Windows
- Certificates should be in the root directory of the project, and named:
  - localhost-key.pem
  - localhost.pem
- Generate these by running `mkcert localhost` in the project directory.
  
## Installing

Install dependencies with `npm i`

## Running

Start the bot with `npm start`

- This will run the application using `ts-node` under `nodemon` for automatic restarts when you change source files.

Add the bot to your server by visiting it's oauth URL - this should be printed to the console when the bot starts, or you can replace your configuration variables in the following URL:

- `https://discordapp.com/api/oauth2/authorize?client_id={DISCORD_APPLICATION_CLIENT_ID}&permissions={DISCORD_APPLICATION_PERMISSIONS_FLAGS}&scope=bot`

Add appropriate roles to your bot after it joins your Discord server, so it can access the channels you want.

Test the bot with `*hello` or `*register`

## More

Now you're on your own! Have fun!
