import {
  Client,
  GatewayIntentBits,
  Partials,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  Events
} from "discord.js";
import express from "express";
import dotenv from "dotenv";

dotenv.config();
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Channel]
});

// --- Servidor Render ---
const server = express();
server.all("/", (req, res) => res.send("Bot da MLC rodando ✅"));
server.listen(process.env.PORT || 3000, () => console.log("Servidor web ativo"));

// --- Dados temporários (simples) ---
const ultimosPontos = new Map(); // { userId: timestamp }

// --- IDs dos canais ---
const canais = {
  ponto: "🔥・bate-ponto",
  inativos: "🚨・inatividades",
  criarEvento: "📅・criar-eventos",
  eventos: "📖・eventos-mlc"
};

// === Função: limpar canal e reenviar painel ===
async function configurarCanais() {
  const guild = client.guilds.cache.first();
  if (!guild) return;

  const canalPonto = guild.channels.cache.find(c => c.name === canais.ponto);
  const canalEventos = guild.channels.cache.find(c => c.name === canais.criarEvento);

  // 🔥 Painel de ponto
  if (canalPonto) {
    const msgs = await canalPonto.messages.fetch({ limit: 100 });
    await Promise.all(msgs.map(m => m.delete().catch(() => {})));

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("iniciar_ponto").setLabel("🕒 Iniciar").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId("pausar_ponto").setLabel("⏸️ Pausar").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("encerrar_ponto").setLabel("✅ Encerrar").setStyle(ButtonStyle.Danger)
    );

    await canalPonto.send({
      embeds: [
        new EmbedBuilder()
          .setTitle("🔥 Sistema de Bate-Ponto MLC")
          .setDescription("Clique em um dos botões abaixo para registrar seu ponto:")
          .setColor("Gold")
      ],
      components: [row]
    });
  }

  // 📅 Painel de criar evento
  if (canalEventos) {
    const msgs = await canalEventos.messages.fetch({ limit: 100 });
    await Promise.all(msgs.map(m => m.delete().catch(() => {})));

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("criar_evento").setLabel("🗓️ Criar Evento").setStyle(ButtonStyle.Primary)
    );

    await canalEventos.send({
      embeds: [
        new EmbedBuilder()
          .setTitle("📅 Criador de Eventos MLC")
          .setDescription("Clique no botão abaixo para criar um novo evento para o servidor.")
          .setColor("Blue")
      ],
      components: [row]
    });
  }
}

// === Evento Ready ===
client.once("ready", async () => {
  console.log(`✅ Logado como ${client.user.tag}`);
  await configurarCanais();
});

// === Interações ===
client.on(Events.InteractionCreate, async (interaction) => {
  try {
    // --- Bate-ponto ---
    if (interaction.isButton()) {
      const canalPonto = interaction.guild.channels.cache.find(c => c.name === canais.ponto);
      const canalInativos = interaction.guild.channels.cache.find(c => c.name === canais.inativos);

      if (interaction.customId === "iniciar_ponto") {
        ultimosPontos.set(interaction.user.id, Date.now());
        await canalPonto.send(`🕒 ${interaction.user} iniciou o ponto em <t:${Math.floor(Date.now()/1000)}:f>.`);
        await interaction.reply({ content: "✅ Ponto iniciado com sucesso!", ephemeral: true });
      }

      if (interaction.customId === "pausar_ponto") {
        await canalPonto.send(`⏸️ ${interaction.user} pausou o ponto.`);
        await interaction.reply({ content: "Ponto pausado.", ephemeral: true });
      }

      if (interaction.customId === "encerrar_ponto") {
        await canalPonto.send(`✅ ${interaction.user} encerrou o ponto.`);
        await interaction.reply({ content: "Ponto encerrado.", ephemeral: true });
      }

      if (interaction.customId === "criar_evento") {
        const modal = new ModalBuilder()
          .setCustomId("form_evento")
          .setTitle("🗓️ Criar Evento");

        const nome = new TextInputBuilder()
          .setCustomId("titulo")
          .setLabel("Título do evento")
          .setStyle(TextInputStyle.Short)
          .setRequired(true);

        const descricao = new TextInputBuilder()
          .setCustomId("descricao")
          .setLabel("Descrição do evento")
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true);

        const data = new TextInputBuilder()
          .setCustomId("data")
          .setLabel("Data e hora do evento")
          .setStyle(TextInputStyle.Short)
          .setPlaceholder("Ex: 20/10 às 18h")
          .setRequired(true);

        modal.addComponents(
          new ActionRowBuilder().addComponents(nome),
          new ActionRowBuilder().addComponents(descricao),
          new ActionRowBuilder().addComponents(data)
        );

        await interaction.showModal(modal);
      }
    }

    // --- Formulário de evento ---
    if (interaction.isModalSubmit() && interaction.customId === "form_evento") {
      const titulo = interaction.fields.getTextInputValue("titulo");
      const descricao = interaction.fields.getTextInputValue("descricao");
      const data = interaction.fields.getTextInputValue("data");

      const canalEventos = interaction.guild.channels.cache.find(c => c.name === canais.eventos);

      if (!canalEventos) {
        return interaction.reply({ content: "❌ Canal de eventos não encontrado!", ephemeral: true });
      }

      const embed = new EmbedBuilder()
        .setTitle(`📖 ${titulo}`)
        .setDescription(descricao)
        .addFields({ name: "🕒 Quando", value: data })
        .setFooter({ text: `Evento criado por ${interaction.user.tag}` })
        .setColor("Blue")
        .setTimestamp();

      await canalEventos.send({ embeds: [embed] });
      await interaction.reply({ content: "✅ Evento criado com sucesso!", ephemeral: true });
    }

  } catch (err) {
    console.error("Erro na interação:", err);
    if (!interaction.replied) {
      await interaction.reply({ content: "❌ Ocorreu um erro na interação.", ephemeral: true });
    }
  }
});

// === Sistema de inatividade (verifica a cada 24h) ===
setInterval(async () => {
  const guild = client.guilds.cache.first();
  if (!guild) return;

  const canalAvisos = guild.channels.cache.find(c => c.name === canais.inativos);
  const agora = Date.now();
  const limite = 14 * 24 * 60 * 60 * 1000; // 14 dias

  guild.members.cache.forEach(async (membro) => {
    if (membro.user.bot) return;
    const ultimo = ultimosPontos.get(membro.id);
    if (!ultimo || agora - ultimo > limite) {
      try {
        await membro.kick("Inatividade (14 dias sem ponto)");
        await canalAvisos.send(`⚠️ ${membro} foi expulso por 14 dias de inatividade.`);
      } catch (err) {
        console.log(`Erro ao expulsar ${membro.user.tag}:`, err.message);
      }
    }
  });
}, 24 * 60 * 60 * 1000); // a cada 24h

client.login(process.env.TOKEN);
