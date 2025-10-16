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
const dadosPonto = new Map();

// --- Canais principais ---
const canais = {
  ponto: "🔥・bate-ponto",
  inativos: "🚨・inatividades",
  criarEvento: "📅・criar-eventos",
  eventos: "📖・eventos-mlc",
  recrutamento: "📋・recrutamento",
  solicitacoes: "📋・solicitações-mlc",
  relatoriosRec: "📋・relatórios-de-rec"
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
          .setDescription("Clique abaixo para abrir o formulário e registrar um novo membro.")
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

      // Iniciar
      if (interaction.customId === "iniciar_ponto") {
        const agora = Date.now();
        ultimosPontos.set(interaction.user.id, agora);
        dadosPonto.set(interaction.user.id, { inicio: agora, pausas: 0 });
        await canalPonto.send(`🕒 ${interaction.user} iniciou o ponto em <t:${Math.floor(agora/1000)}:f>.`);
        await interaction.reply({ content: "✅ Ponto iniciado!", ephemeral: true });
      }

      // Pausar
      if (interaction.customId === "pausar_ponto") {
        const dados = dadosPonto.get(interaction.user.id);
        if (dados) dados.pausas++;
        await canalPonto.send(`⏸️ ${interaction.user} pausou o ponto (${dados?.pausas || 1}ª pausa).`);
        await interaction.reply({ content: "⏸️ Ponto pausado.", ephemeral: true });
      }

      // Encerrar
      if (interaction.customId === "encerrar_ponto") {
        const dados = dadosPonto.get(interaction.user.id);
        if (!dados) return interaction.reply({ content: "❌ Você precisa iniciar primeiro!", ephemeral: true });

        const duracao = Math.floor((Date.now() - dados.inicio) / 60000);
        await canalPonto.send(
          `✅ ${interaction.user} encerrou o ponto.\n🕒 Início: <t:${Math.floor(dados.inicio/1000)}:t>\n⏸️ Pausas: ${dados.pausas}\n🕕 Duração total: ${duracao} min`
        );
        dadosPonto.delete(interaction.user.id);
        await interaction.reply({ content: "✅ Ponto encerrado.", ephemeral: true });
      }

      // --- Abrir Recrutamento ---
      if (interaction.customId === "abrir_recrutamento") {
        const modal = new ModalBuilder()
          .setCustomId("form_recrutamento")
          .setTitle("📋 Formulário de Recrutamento");

        const nome = new TextInputBuilder().setCustomId("nome").setLabel("Nome no jogo").setStyle(TextInputStyle.Short).setRequired(true);
        const idjogo = new TextInputBuilder().setCustomId("idjogo").setLabel("ID no jogo").setStyle(TextInputStyle.Short).setRequired(true);
        const idrecrutador = new TextInputBuilder().setCustomId("idrecrutador").setLabel("ID do recrutador").setStyle(TextInputStyle.Short).setRequired(true);
        const whatsapp = new TextInputBuilder().setCustomId("whatsapp").setLabel("WhatsApp (Opcional)").setStyle(TextInputStyle.Short);

        modal.addComponents(
          new ActionRowBuilder().addComponents(nome),
          new ActionRowBuilder().addComponents(idjogo),
          new ActionRowBuilder().addComponents(idrecrutador),
          new ActionRowBuilder().addComponents(whatsapp)
        );

        await interaction.showModal(modal);
      }

      // --- Aprovação/Reprovação ---
      if (interaction.customId.startsWith("rec_")) {
        const [_, acao, userId] = interaction.customId.split("_");
        const canalRelatorios = interaction.guild.channels.cache.find(c => c.name === canais.relatoriosRec);
        const membro = await interaction.guild.members.fetch(userId).catch(() => null);

        if (acao === "aceitar") {
          const cargo = interaction.guild.roles.cache.find(r => r.name === "MLC");
          if (cargo && membro) await membro.roles.add(cargo);

          await canalRelatorios.send(`✅ **${membro}** foi aceito como novo membro MLC!`);
          await interaction.message.edit({ content: "✅ Solicitação **Aprovada**!", components: [] });
          await interaction.reply({ content: "Membro aceito com sucesso!", ephemeral: true });
        }

        if (acao === "recusar") {
          await interaction.message.edit({ content: "❌ Solicitação **Recusada**.", components: [] });
          if (membro) membro.send("❌ Seu recrutamento foi recusado. Refaça o formulário em 📋・recrutamento.").catch(() => {});
          await interaction.reply({ content: "Recrutamento recusado.", ephemeral: true });
        }
      }
    }

    // --- Formulário de Recrutamento ---
    if (interaction.isModalSubmit() && interaction.customId === "form_recrutamento") {
      const nome = interaction.fields.getTextInputValue("nome");
      const idjogo = interaction.fields.getTextInputValue("idjogo");
      const idrecrutador = interaction.fields.getTextInputValue("idrecrutador");
      const whatsapp = interaction.fields.getTextInputValue("whatsapp") || "Não informado";
      const canalSolicitacoes = interaction.guild.channels.cache.find(c => c.name === canais.solicitacoes);

      const embed = new EmbedBuilder()
        .setTitle("📋 Nova Solicitação de Recrutamento")
        .addFields(
          { name: "Nome / ID", value: `${nome} / ${idjogo}` },
          { name: "ID do recrutador", value: idrecrutador },
          { name: "WhatsApp", value: whatsapp },
          { name: "Discord", value: `<@${interaction.user.id}>` }
        )
        .setColor("Green")
        .setTimestamp();

      const botoes = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`rec_aceitar_${interaction.user.id}`).setLabel("✅ Aceitar").setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`rec_recusar_${interaction.user.id}`).setLabel("❌ Recusar").setStyle(ButtonStyle.Danger)
      );

      await canalSolicitacoes.send({ embeds: [embed], components: [botoes] });
      await interaction.reply({ content: "📋 Solicitação enviada para análise em 📋・solicitações-mlc!", ephemeral: true });
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
