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
server.all("/", (req, res) => res.send("Bot MLC está rodando ✅"));
server.listen(process.env.PORT || 3000, () => console.log("Servidor web ativo"));

// --- Dados temporários ---
const ultimosPontos = new Map();

// --- Canais principais ---
const canais = {
  ponto: "🔥・bate-ponto",
  inativos: "🚨・inatividades",
  criarEvento: "📅・criar-eventos",
  eventos: "📖・eventos-mlc",
  recrutamento: "📋・recrutamento"
};

// === Função: limpar canal e enviar painéis ===
async function configurarCanais() {
  const guild = client.guilds.cache.first();
  if (!guild) return;

  const canalPonto = guild.channels.cache.find(c => c.name === canais.ponto);
  const canalEventos = guild.channels.cache.find(c => c.name === canais.criarEvento);
  const canalRecrutamento = guild.channels.cache.find(c => c.name === canais.recrutamento);

  // 🔥 Bate-ponto
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

  // 📅 Criar evento
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

  // 📋 Recrutamento
  if (canalRecrutamento) {
    const msgs = await canalRecrutamento.messages.fetch({ limit: 100 });
    await Promise.all(msgs.map(m => m.delete().catch(() => {})));

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("abrir_recrutamento").setLabel("📋 Novo Recrutamento").setStyle(ButtonStyle.Success)
    );

    await canalRecrutamento.send({
      embeds: [
        new EmbedBuilder()
          .setTitle("📋 Formulário de Recrutamento MLC")
          .setDescription("Clique abaixo para abrir o formulário de recrutamento e registrar um novo membro.")
          .setColor("Green")
      ],
      components: [row]
    });
  }
}

// === Ready ===
client.once("ready", async () => {
  console.log(`✅ Logado como ${client.user.tag}`);
  await configurarCanais();
});

// === Interações ===
client.on(Events.InteractionCreate, async (interaction) => {
  try {
    // --- Bate Ponto ---
    if (interaction.isButton()) {
      const canalPonto = interaction.guild.channels.cache.find(c => c.name === canais.ponto);
      const canalInativos = interaction.guild.channels.cache.find(c => c.name === canais.inativos);

      if (interaction.customId === "iniciar_ponto") {
        ultimosPontos.set(interaction.user.id, Date.now());
        await canalPonto.send(`🕒 ${interaction.user} iniciou o ponto em <t:${Math.floor(Date.now()/1000)}:f>.`);
        await interaction.reply({ content: "✅ Ponto iniciado!", ephemeral: true });
      }

      if (interaction.customId === "pausar_ponto") {
        await canalPonto.send(`⏸️ ${interaction.user} pausou o ponto.`);
        await interaction.reply({ content: "Ponto pausado.", ephemeral: true });
      }

      if (interaction.customId === "encerrar_ponto") {
        await canalPonto.send(`✅ ${interaction.user} encerrou o ponto.`);
        await interaction.reply({ content: "Ponto encerrado.", ephemeral: true });
      }

      // --- Criar evento ---
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
          .setLabel("Data e hora")
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

      // --- Abrir Recrutamento ---
      if (interaction.customId === "abrir_recrutamento") {
        const modal = new ModalBuilder()
          .setCustomId("form_recrutamento")
          .setTitle("📋 Formulário de Recrutamento");

        const nome = new TextInputBuilder()
          .setCustomId("nome")
          .setLabel("Nome no jogo")
          .setStyle(TextInputStyle.Short)
          .setRequired(true);

        const idjogo = new TextInputBuilder()
          .setCustomId("idjogo")
          .setLabel("ID no jogo")
          .setStyle(TextInputStyle.Short)
          .setRequired(true);

        const idrecrutador = new TextInputBuilder()
          .setCustomId("idrecrutador")
          .setLabel("ID do recrutador")
          .setStyle(TextInputStyle.Short)
          .setRequired(true);

        const whatsapp = new TextInputBuilder()
          .setCustomId("whatsapp")
          .setLabel("WhatsApp (Opcional)")
          .setStyle(TextInputStyle.Short)
          .setRequired(false);

        modal.addComponents(
          new ActionRowBuilder().addComponents(nome),
          new ActionRowBuilder().addComponents(idjogo),
          new ActionRowBuilder().addComponents(idrecrutador),
          new ActionRowBuilder().addComponents(whatsapp)
        );

        await interaction.showModal(modal);
      }
    }

    // --- Enviar evento criado ---
    if (interaction.isModalSubmit() && interaction.customId === "form_evento") {
      const titulo = interaction.fields.getTextInputValue("titulo");
      const descricao = interaction.fields.getTextInputValue("descricao");
      const data = interaction.fields.getTextInputValue("data");
      const canalEventos = interaction.guild.channels.cache.find(c => c.name === canais.eventos);

      const embed = new EmbedBuilder()
        .setTitle(`📖 ${titulo}`)
        .setDescription(descricao)
        .addFields({ name: "🕒 Quando", value: data })
        .setFooter({ text: `Criado por ${interaction.user.tag}` })
        .setColor("Blue")
        .setTimestamp();

      await canalEventos.send({ embeds: [embed] });
      await interaction.reply({ content: "✅ Evento criado!", ephemeral: true });
    }

    // --- Enviar recrutamento ---
    if (interaction.isModalSubmit() && interaction.customId === "form_recrutamento") {
      const nome = interaction.fields.getTextInputValue("nome");
      const idjogo = interaction.fields.getTextInputValue("idjogo");
      const idrecrutador = interaction.fields.getTextInputValue("idrecrutador");
      const whatsapp = interaction.fields.getTextInputValue("whatsapp") || "Não informado";

      const embed = new EmbedBuilder()
        .setTitle("📋 Novo Recrutamento")
        .addFields(
          { name: "Nome / ID", value: `${nome} / ${idjogo}` },
          { name: "ID do recrutador", value: idrecrutador },
          { name: "WhatsApp", value: whatsapp },
          { name: "Discord", value: `<@${interaction.user.id}>` }
        )
        .setColor("Green")
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    }

  } catch (err) {
    console.error("Erro na interação:", err);
    if (!interaction.replied)
      await interaction.reply({ content: "❌ Erro ao processar.", ephemeral: true });
  }
});

// --- Expulsão automática (14 dias sem ponto) ---
setInterval(async () => {
  const guild = client.guilds.cache.first();
  if (!guild) return;

  const canalAvisos = guild.channels.cache.find(c => c.name === canais.inativos);
  const agora = Date.now();
  const limite = 14 * 24 * 60 * 60 * 1000;

  guild.members.cache.forEach(async (membro) => {
    if (membro.user.bot) return;
    const ultimo = ultimosPontos.get(membro.id);
    if (!ultimo || agora - ultimo > limite) {
      try {
        await membro.kick("Inatividade (14 dias sem ponto)");
        await canalAvisos.send(`⚠️ ${membro} foi expulso por inatividade (14 dias).`);
      } catch (err) {
        console.log(`Erro ao expulsar ${membro.user.tag}:`, err.message);
      }
    }
  });
}, 24 * 60 * 60 * 1000);

client.login(process.env.TOKEN);
