import { Client, GatewayIntentBits, EmbedBuilder } from "discord.js";
import dotenv from "dotenv";
dotenv.config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
  ],
});

// Quando o bot ligar
client.once("clientReady", () => {
  console.log(`✅ Bot conectado como ${client.user.tag}`);
});

// Quando alguém entrar no servidor
client.on("guildMemberAdd", async (member) => {
  const channel = member.guild.channels.cache.find(c => c.name === "logs-entrada");
  if (!channel) return;

  const embed = new EmbedBuilder()
    .setColor("Yellow")
    .setTitle("📥 Novo Membro Entrou!")
    .setDescription(`👤 **${member.user.tag}** entrou no servidor.`)
    .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
    .setTimestamp();

  channel.send({ embeds: [embed] });
});

// Quando alguém sair do servidor
client.on("guildMemberRemove", async (member) => {
  const channel = member.guild.channels.cache.find(c => c.name === "logs-saida");
  if (!channel) return;

  const embed = new EmbedBuilder()
    .setColor("Yellow")
    .setTitle("📤 Membro Saiu!")
    .setDescription(`👋 **${member.user.tag}** saiu do servidor.`)
    .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
    .setTimestamp();

  channel.send({ embeds: [embed] });
});

// Login do bot
client.login(process.env.DISCORD_TOKEN);
