// MLC BOT - Sistema completo de Recrutamento, Ponto e Inatividade
// Desenvolvido por GPT-5 para japacat4-star

const { Client, GatewayIntentBits, Partials, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, Events } = require("discord.js");
const fs = require("fs");

const TOKEN = process.env.TOKEN;
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});

const DATA_FILE = "data.json";
if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, JSON.stringify({ pontos: {}, recrutamentos: {}, ultimosPontos: {} }, null, 2));

const carregarDados = () => JSON.parse(fs.readFileSync(DATA_FILE));
const salvarDados = (data) => fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));

client.once(Events.ClientReady, async () => {
  console.log(`✅ Logado como ${client.user.tag}`);
});

// ========== SISTEMA DE RECRUTAMENTO ==========
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isButton()) return;
  const data = carregarDados();

  if (interaction.customId === "abrir_recrutamento") {
    const modal = {
      title: "📋 Formulário de Recrutamento",
      custom_id: "form_recrutamento",
      components: [
        {
          type: 1,
          components: [{ type: 4, custom_id: "nome", label: "Nome no jogo", style: 1, required: true }],
        },
        {
          type: 1,
          components: [{ type: 4, custom_id: "idjogo", label: "ID no jogo", style: 1, required: true }],
        },
        {
          type: 1,
          components: [{ type: 4, custom_id: "recrutador", label: "ID do recrutador", style: 1, required: true }],
        },
        {
          type: 1,
          components: [{ type: 4, custom_id: "whatsapp", label: "WhatsApp (opcional)", style: 1, required: false }],
        },
      ],
    };
    await interaction.showModal(modal);
  }
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isModalSubmit()) return;
  if (interaction.customId === "form_recrutamento") {
    const nome = interaction.fields.getTextInputValue("nome");
    const idjogo = interaction.fields.getTextInputValue("idjogo");
    const recrutador = interaction.fields.getTextInputValue("recrutador");
    const whatsapp = interaction.fields.getTextInputValue("whatsapp") || "Não informado";

    const canalRecrutamento = interaction.guild.channels.cache.find(c => c.name.includes("recrutamento"));
    if (canalRecrutamento) {
      await canalRecrutamento.send({
        embeds: [
          new EmbedBuilder()
            .setTitle("📥 Novo Recrutamento Recebido")
            .setColor("Green")
            .setDescription(`**Nome:** ${nome} / ${idjogo}\n**Recrutador:** ${recrutador}\n**WhatsApp:** ${whatsapp}\n**Discord:** ${interaction.user}`)
            .setFooter({ text: "Sistema de Recrutamento MLC" }),
        ],
      });
    }

    await interaction.reply({ content: "✅ Seu recrutamento foi enviado com sucesso!", ephemeral: true });
  }
});

// ========== SISTEMA DE PONTO ==========
client.on(Events.MessageCreate, async (msg) => {
  if (msg.channel.name.includes("bate-ponto")) {
    const data = carregarDados();
    const userId = msg.author.id;
    const agora = new Date();

    data.pontos[userId] = (data.pontos[userId] || 0) + 1;
    data.ultimosPontos[userId] = agora.getTime();
    salvarDados(data);

    const canalLogs = msg.guild.channels.cache.find(c => c.name.includes("logs"));
    if (canalLogs) canalLogs.send(`🕐 ${msg.author.tag} registrou ponto às ${agora.toLocaleString()}`);

    msg.react("✅");
  }
});

// ========== LIMPEZA DE INATIVOS (14 dias) ==========
setInterval(async () => {
  const data = carregarDados();
  const agora = Date.now();
  const dias = 14 * 24 * 60 * 60 * 1000;

  for (const [id, ultimo] of Object.entries(data.ultimosPontos)) {
    if (agora - ultimo > dias) {
      const guild = client.guilds.cache.first();
      const member = await guild.members.fetch(id).catch(() => null);
      if (member) {
        await member.kick("Inatividade de 14 dias sem ponto");
        delete data.pontos[id];
        delete data.ultimosPontos[id];
        salvarDados(data);
        const canalLogs = guild.channels.cache.find(c => c.name.includes("logs"));
        if (canalLogs) canalLogs.send(`🚨 ${member.user.tag} foi expulso por inatividade.`);
      }
    }
  }
}, 60 * 60 * 1000); // roda a cada 1h

client.login(TOKEN);
