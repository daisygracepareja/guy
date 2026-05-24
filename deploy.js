import 'dotenv/config';
import { REST, Routes } from 'discord.js';
import fs from 'fs';
import path from 'path';

const commands = [];

// Track possible locations for the commands folder across framework layouts
const possiblePaths = [
    path.resolve('./src/commands'),
    path.resolve('./apps/bot/src/commands'),
    path.resolve('./packages/bot/src/commands'),
    path.resolve('./bot/src/commands')
];

let commandsPath = '';

for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
        commandsPath = p;
        break;
    }
}

if (!commandsPath) {
    console.error("❌ [DEPLOY CRITICAL] Could not locate your commands folder in any directory framework!");
    process.exit(1);
}

console.log(`✅ [DEPLOY] Successfully located commands directory at: ${commandsPath}`);

try {
    const commandFolders = fs.readdirSync(commandsPath);

    for (const folder of commandFolders) {
        const folderPath = path.join(commandsPath, folder);
        if (!fs.statSync(folderPath).isDirectory()) continue;

        const commandFiles = fs.readdirSync(folderPath).filter(file => file.endsWith('.js'));

        for (const file of commandFiles) {
            const filePath = path.join(folderPath, file);
            const fileUrl = new URL(`file://${filePath}`).href;
            const module = await import(fileUrl);
            const command = module.default || module;

            if (command && (command.data || command.name)) {
                const commandData = command.data?.toJSON ? command.data.toJSON() : {
                    name: command.name,
                    description: command.description || 'No description provided',
                    options: command.options || []
                };
                
                commands.push(commandData);
            }
        }
    }
} catch (err) {
    console.error(`❌ [DEPLOY] Error reading files:`, err);
}

const token = process.env.DISCORD_TOKEN;
if (!token) {
    console.error("❌ [DEPLOY] Missing DISCORD_TOKEN environment variable!");
    process.exit(1);
}

const rest = new REST({ version: '10' }).setToken(token);

(async () => {
    try {
        if (commands.length === 0) {
            console.error("❌ [DEPLOY] Found 0 commands inside the directory.");
            return;
        }

        console.log(`🚀 [DEPLOY] Pushing ${commands.length} commands globally...`);
        
        // This splits your token to automatically extract your bot ID without needing CLIENT_ID variable
        const autoClientId = Buffer.from(token.split('.')[0], 'base64').toString();

        await rest.put(
            Routes.applicationCommands(autoClientId),
            { body: commands },
        );
        
        console.log(`🎉 [DEPLOY] SUCCESS! Live deployment completed for ${commands.length} commands.`);
    } catch (error) {
        console.error("❌ [DEPLOY] Discord API Error:", error);
    }
})();
