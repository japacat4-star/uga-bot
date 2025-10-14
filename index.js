import 'dotenv/config';
import { Client, GatewayIntentBits, Events } from 'discord.js';

import setupLogs from './modules/logs.js';
import setupRecrutamento from './modules/recrutamento.js';
import setupEventos from './modules/eventos.js';
import setupPonto from './modules/ponto.js';
import setupKickAuto from './modules/kickAuto.js';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// Carregar todos os módulos
setupLogs(client);
setupRecrutamento(client);
setupEventos(client);
setupPonto(client);
setupKickAuto(client);

// Bot conectado
client.once(Events.ClientReady, () => {
  console.log(`🤖 Bot conectado como ${client.user.tag}!`);
});
// ===============================
// 🌐 Servidor Web para manter o Replit online
// ===============================
import express from "express";
const app = express();

app.get("/", (req, res) => {
  res.send("Bot UGA UGA está online! 🦍");
});

app.listen(3000, () => console.log("🌐 Servidor web ativo"));

client.login(process.env.DISCORD_TOKEN);
