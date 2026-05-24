import 'dotenv/config';
import { REST, Routes } from 'discord.js';
import fs from 'fs';
import path from 'path';

const commands = [];

try {
    // 1. Locate the correct commands directory path
    const commandsPath = path.resolve('./src/commands');
    console.log(`[DEPLOY] Scanning directory: ${commandsPath}`);
    
    if (!fs.existsSync(commandsPath)) {
        throw new Error(`Directory does not exist at ${commandsPath}`);
    }

    const commandFolders = fs.readdirSync(commandsPath);
    console.log(`[DEPLOY] Found folders: ${commandFolders.join(', ')}`);

    // 2. Loop through every folder (Community, Welcome, Ticket, etc.)
    for (const folder of commandFolders) {
        const folderPath = path.join(commandsPath, folder);
        
        // Skip files, only scan directories
        if (!fs.statSync(folderPath).isDirectory()) continue;

        const commandFiles = fs.readdirSync(folderPath).filter(file => file.endsWith('.js'));
        console.log(`[DEPLOY] Folder [${folder}] has ${commandFiles.length} command files.`);

        // 3. Read every file inside the folder
        for (const file of commandFiles) {
            const filePath = path.join(folderPath, file);
            
            // Convert file path to a valid file URL format for Windows/Linux ESM compatibility
            const fileUrl = new URL(`file://${filePath}`).href;
            const module = await import(fileUrl);
            
            // Handle standard export structures
            const command = module.default || module;

            if (command && (command.data || command.name)) {
                // If it uses SlashCommandBuilder, convert to JSON. Otherwise, use raw object
                const commandData = command.data?.toJSON ? command.data.toJSON() : {
                    name: command.name,
                    description: command.description || 'No description provided',
                    options: command.options || []
                };
                
                commands.push(commandData);
                console.log(`[DEPLOY] Loaded command: /${commandData.name}`);
            } else {
                console.log(`[DEPLOY] Skipped file ${file}: Missing data structure.`);
            }
        }
    }
} catch (err) {
    console.error(`[DEPLOY] Critical error reading command folder structure:`, err);
}

// 4. Connect to Discord REST API
const token = process.env.DISCORD_TOKEN;
if (!token) {
    console.error("[DEPLOY] CRITICAL ERROR: DISCORD_TOKEN variable is completely missing in Railway!");
    process.exit(1);
}

const rest = new REST({ version: '10' }).setToken(token);

(async () => {
    try {
        if (commands.length === 0) {
            console.error("[DEPLOY] ERROR: Found 0 valid commands to push. Check directory mapping.");
            return;
        }

        console.log(`\n[DEPLOY] Initializing global deployment for ${commands.length} application (/) commands...`);
        
        // This targets the client globally. It will look at your token to know which bot it belongs to.
        await rest.put(
            Routes.applicationCommands(process.env.CLIENT_ID || Buffer.from(token.split('.')[0], 'base64').toString()),
            { body: commands },
        );
        
        console.log(`\n[DEPLOY] SUCCESS! Distributed ${commands.length} application (/) commands globally across Discord network!`);
    } catch (error) {
        console.error("\n[DEPLOY] Discord API Deployment Error:", error);
    }
})();
