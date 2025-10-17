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
  Events,
  ChannelType
} from "discord.js";
import express from "express";
import dotenv from "dotenv";

dotenv.config();

// --- CLIENTE DISCORD ---
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Channel]
});

// --- SERVIDOR WEB (Render) ---
const server = express();
server.all("/", (req, res) => {
  res.send("Bot está rodando ✅");
});
server.listen(process.env.PORT || 3000, () => console.log("Servidor web ativo"));

// --- VARIÁVEIS ---
const tempoInatividade = 14 * 24 * 60 * 60 * 1000; // 14 dias em ms
const ultimosPontos = new Map(); // { userId: timestamp }
const pausas = new Map(); // { userId: contador de pausas }

// --- FUNÇÕES DE CANAIS ---
async function limparEPostarFormularioRecrutamento() {
  const canal = client.channels.cache.find(c => c.name === "📋・recrutamento");
  if (!canal) return console.log("❌ Canal de recrutamento não encontrado.");

  const msgs = await canal.messages.fetch({ limit: 100 });
  for (const msg of msgs.values()) await msg.delete().catch(() => {});

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("abrir_form_recrutamento")
      .setLabel("📋 Preencher Formulário")
      .setStyle(ButtonStyle.Primary)
  );

  await canal.send({
    embeds: [
      new EmbedBuilder()
        .setTitle("📋 Formulário de Recrutamento")
        .setDescription("Clique no botão abaixo para preencher seu formulário e ingressar na MLC!")
        .setColor("Aqua")
    ],
    components: [row]
  });
  console.log("✅ Formulário de recrutamento postado!");
}

async function limparEPostarFormularioEvento() {
  const canalCriar = client.channels.cache.find(c => c.name === "📅・criar-eventos");
  if (!canalCriar) return console.log("❌ Canal 📅・criar-eventos não encontrado.");

  const msgs = await canalCriar.messages.fetch({ limit: 100 });
  for (const msg of msgs.values()) await msg.delete().catch(() => {});

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("abrir_form_evento")
      .setLabel("📅 Criar Evento")
      .setStyle(ButtonStyle.Primary)
  );

  await canalCriar.send({
    embeds: [
      new EmbedBuilder()
        .setTitle("📅 Formulário de Criação de Evento")
        .setDescription("Clique no botão abaixo para criar um novo evento da MLC.")
        .setColor("Aqua")
    ],
    components: [row]
  });
  console.log("✅ Formulário de evento postado!");
}

// --- AO INICIAR O BOT ---
client.once("ready", async () => {
  console.log(`✅ Logado como ${client.user.tag}`);
  await limparEPostarFormularioRecrutamento();
  await limparEPostarFormularioEvento();
  verificarInatividade();
});

// --- INTERAÇÕES ---
client.on(Events.InteractionCreate, async (interaction) => {
  try {
    // === FORMULÁRIO DE RECRUTAMENTO ===
    if (interaction.isButton() && interaction.customId === "abrir_form_recrutamento") {
      const modal = new ModalBuilder()
        .setCustomId("form_recrutamento")
        .setTitle("📋 Formulário de Recrutamento");

      const nome = new TextInputBuilder().setCustomId("nome").setLabel("Nome no jogo").setStyle(TextInputStyle.Short).setRequired(true);
      const idjogo = new TextInputBuilder().setCustomId("idjogo").setLabel("ID no jogo").setStyle(TextInputStyle.Short).setRequired(true);
      const idrecrutador = new TextInputBuilder().setCustomId("idrecrutador").setLabel("ID do recrutador").setStyle(TextInputStyle.Short).setRequired(true);
      const whatsapp = new TextInputBuilder().setCustomId("whatsapp").setLabel("WhatsApp (Opcional)").setStyle(TextInputStyle.Short).setRequired(false);

      modal.addComponents(
        new ActionRowBuilder().addComponents(nome),
        new ActionRowBuilder().addComponents(idjogo),
        new ActionRowBuilder().addComponents(idrecrutador),
        new ActionRowBuilder().addComponents(whatsapp)
      );

      await interaction.showModal(modal);
    }

    // === RESPOSTA DO FORMULÁRIO DE RECRUTAMENTO ===
    if (interaction.isModalSubmit() && interaction.customId === "form_recrutamento") {
      const nome = interaction.fields.getTextInputValue("nome");
      const idjogo = interaction.fields.getTextInputValue("idjogo");
      const idrecrutador = interaction.fields.getTextInputValue("idrecrutador");
      const whatsapp = interaction.fields.getTextInputValue("whatsapp") || "Não informado";

      const canalSolicitacoes = client.channels.cache.find(c => c.name === "📋・solicitações-mlc");
      if (!canalSolicitacoes) return interaction.reply({ content: "❌ Canal de solicitações não encontrado.", ephemeral: true });

      const embed = new EmbedBuilder()
        .setTitle("📋 Nova Solicitação de Recrutamento")
        .addFields(
          { name: "Nome no jogo", value: `${nome} / ${idjogo}` },
          { name: "ID do recrutador", value: idrecrutador },
          { name: "WhatsApp", value: whatsapp },
          { name: "Discord", value: `<@${interaction.user.id}>` }
        )
        .setColor("Green")
        .setTimestamp();

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`aceitar_${interaction.user.id}`).setLabel("✅ Aceitar").setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`recusar_${interaction.user.id}`).setLabel("❌ Recusar").setStyle(ButtonStyle.Danger)
      );

      await canalSolicitacoes.send({ embeds: [embed], components: [row] });
      await interaction.reply({ content: "✅ Solicitação enviada com sucesso!", ephemeral: true });
    }

    // === AÇÃO DE ACEITAR / RECUSAR RECRUTAMENTO ===
    if (interaction.isButton()) {
      if (interaction.customId.startsWith("aceitar_")) {
        const userId = interaction.customId.split("_")[1];
        const guild = interaction.guild;
        const membro = await guild.members.fetch(userId).catch(() => null);
        const canalRelatorios = client.channels.cache.find(c => c.name === "📋・relatórios-de-rec");
        const cargo = guild.roles.cache.find(r => r.name === "MLC");

        if (membro && cargo) await membro.roles.add(cargo);
        if (canalRelatorios) await canalRelatorios.send(`✅ <@${userId}> foi aceito na MLC!`);
        await interaction.update({ content: "✅ Solicitação aceita.", components: [] });
      }

      if (interaction.customId.startsWith("recusar_")) {
        const userId = interaction.customId.split("_")[1];
        const canalRec = client.channels.cache.find(c => c.name === "📋・recrutamento");
        await interaction.update({ content: "❌ Solicitação recusada. Usuário deve refazer o formulário.", components: [] });
        if (canalRec) await canalRec.send(`<@${userId}> sua solicitação foi recusada. Preencha novamente o formulário.`);
      }
    }

    // === BATE PONTO ===
    if (interaction.isButton()) {
      const userId = interaction.user.id;
      const canalPonto = client.channels.cache.find(c => c.name === "🔥・bate-ponto");

      if (interaction.customId === "iniciar_ponto") {
        ultimosPontos.set(userId, Date.now());
        pausas.set(userId, 0);
        await canalPonto.send(`🕒 ${interaction.user} iniciou o ponto às ${new Date().toLocaleTimeString()}`);
        await interaction.deferUpdate();
      }

      if (interaction.customId === "pausar_ponto") {
        pausas.set(userId, (pausas.get(userId) || 0) + 1);
        await canalPonto.send(`⏸️ ${interaction.user} pausou o ponto (${pausas.get(userId)}x).`);
        await interaction.deferUpdate();
      }

      if (interaction.customId === "encerrar_ponto") {
        const inicio = ultimosPontos.get(userId);
        const tempo = inicio ? ((Date.now() - inicio) / 1000 / 60).toFixed(1) : "0";
        await canalPonto.send(`✅ ${interaction.user} encerrou o ponto após ${tempo} minutos.`);
        ultimosPontos.delete(userId);
        await interaction.deferUpdate();
      }
    }

    // === FORMULÁRIO DE EVENTOS ===
    if (interaction.isButton() && interaction.customId === "abrir_form_evento") {
      const modal = new ModalBuilder().setCustomId("form_evento").setTitle("📅 Criar Novo Evento");

      const nome = new TextInputBuilder().setCustomId("nome_evento").setLabel("Nome do evento").setStyle(TextInputStyle.Short).setRequired(true);
      const data = new TextInputBuilder().setCustomId("data_evento").setLabel("Data (ex: 20/10/2025)").setStyle(TextInputStyle.Short).setRequired(true);
      const horario = new TextInputBuilder().setCustomId("horario_evento").setLabel("Horário (ex: 20h00)").setStyle(TextInputStyle.Short).setRequired(true);
      const descricao = new TextInputBuilder().setCustomId("descricao_evento").setLabel("Descrição do evento").setStyle(TextInputStyle.Paragraph).setRequired(true);

      modal.addComponents(
        new ActionRowBuilder().addComponents(nome),
        new ActionRowBuilder().addComponents(data),
        new ActionRowBuilder().addComponents(horario),
        new ActionRowBuilder().addComponents(descricao)
      );

      await interaction.showModal(modal);
    }

    if (interaction.isModalSubmit() && interaction.customId === "form_evento") {
      const nome = interaction.fields.getTextInputValue("nome_evento");
      const data = interaction.fields.getTextInputValue("data_evento");
      const horario = interaction.fields.getTextInputValue("horario_evento");
      const descricao = interaction.fields.getTextInputValue("descricao_evento");

      const canalEventos = client.channels.cache.find(c => c.name === "📖・eventos-mlc");
      if (!canalEventos) return interaction.reply({ content: "❌ Canal de eventos não encontrado.", ephemeral: true });

      const embed = new EmbedBuilder()
        .setTitle(`🎉 Novo Evento: ${nome}`)
        .addFields(
          { name: "📅 Data", value: data, inline: true },
          { name: "⏰ Horário", value: horario, inline: true },
          { name: "📝 Descrição", value: descricao }
        )
        .setColor("Gold")
        .setFooter({ text: `Criado por ${interaction.user.tag}` })
        .setTimestamp();

      await canalEventos.send({ embeds: [embed] });
      await interaction.reply({ content: "✅ Evento criado com sucesso!", ephemeral: true });
    }
  } catch (err) {
    console.error("Erro na interação:", err);
    if (!interaction.replied) {
      await interaction.reply({ content: "❌ Ocorreu um erro ao processar a interação.", ephemeral: true });
    }
  }
});

// --- VERIFICAR INATIVIDADE ---
async function verificarInatividade() {
  setInterval(async () => {
    const guild = client.guilds.cache.first();
    if (!guild) return;
    const canalAvisos = guild.channels.cache.find(c => c.name === "🚨・inatividades");

    for (const [userId, ultimaData] of ultimosPontos.entries()) {
      if (Date.now() - ultimaData > tempoInatividade) {
        const membro = await guild.members.fetch(userId).catch(() => null);
        if (membro) {
          await membro.kick("Inatividade (14 dias sem ponto)");
          if (canalAvisos) canalAvisos.send(`🚨 <@${userId}> foi expulso por inatividade (14 dias sem bater ponto).`);
          ultimosPontos.delete(userId);
        }
      }
    }
  }, 24 * 60 * 60 * 1000);
}

client.login(process.env.TOKEN);
