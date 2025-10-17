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

// ---------- CLIENT ----------
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Channel]
});

// ---------- WEB (Render keep-alive) ----------
const app = express();
app.all("/", (req, res) => res.send("Bot MLC online ✅"));
app.listen(process.env.PORT || 3000, () => console.log("🌐 Servidor web ativo"));

// ---------- Config (canais exatos e cargo) ----------
const CHANNELS = {
  RECRUTAMENTO: "📋・recrutamento",
  SOLICITACOES: "📋・solicitações-mlc",
  RELATORIOS_REC: "📋・relatórios-de-rec",
  CRIAR_EVENTOS: "📅・criar-eventos",
  EVENTOS_MLC: "📖・eventos-mlc",
  BATE_PONTO: "🔥・bate-ponto",
  INATIVIDADES: "🚨・inatividades",
  LOGS_PONTOS: "🔥・logs-pontos"
};
const ROLE_NAME = "MLC";
const INACTIVITY_DAYS = 14;
const INACTIVITY_MS = INACTIVITY_DAYS * 24 * 60 * 60 * 1000;

// ---------- Estado em memória ----------
const pontos = new Map(); // userId => { inicio: timestamp, pausas: number, pausando?: boolean, pausaInicio?: timestamp }
const ultimaAtividade = new Map(); // userId => timestamp

// ---------- Helpers ----------
function formatDurationMs(ms) {
  const totalMin = Math.floor(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h > 0) return `${h}h ${m}min`;
  return `${m}min`;
}

// ---------- Limpar todas as mensagens do canal ----------
async function limparCanalCompleto(canal) {
  if (!canal || !canal.isTextBased()) return;
  let msgs;
  do {
    msgs = await canal.messages.fetch({ limit: 100 });
    if (msgs.size > 0) await canal.bulkDelete(msgs, true).catch(() => {});
  } while (msgs.size >= 2);
}

// ---------- Postar painéis fixos (limpa e posta um painel único) ----------
async function postarPainelRecrutamento(guild) {
  const canal = guild.channels.cache.find(c => c.name === CHANNELS.RECRUTAMENTO);
  if (!canal) return console.log("Canal recrutamento não encontrado.");
  await limparCanalCompleto(canal);
  const btn = new ButtonBuilder().setCustomId("abrir_recrutamento").setLabel("📋 Preencher Formulário").setStyle(ButtonStyle.Success);
  const row = new ActionRowBuilder().addComponents(btn);
  const embed = new EmbedBuilder().setTitle("📋 Recrutamento MLC").setDescription("Clique no botão para preencher o formulário de recrutamento.").setColor("Yellow");
  await canal.send({ embeds: [embed], components: [row] }).catch(() => {});
  console.log("Painel de recrutamento postado.");
}

async function postarPainelCriarEvento(guild) {
  const canal = guild.channels.cache.find(c => c.name === CHANNELS.CRIAR_EVENTOS);
  if (!canal) return console.log("Canal criar-eventos não encontrado.");
  await limparCanalCompleto(canal);
  const btn = new ButtonBuilder().setCustomId("abrir_evento").setLabel("📅 Criar Evento").setStyle(ButtonStyle.Primary);
  const row = new ActionRowBuilder().addComponents(btn);
  const embed = new EmbedBuilder().setTitle("📅 Criar Evento").setDescription("Clique para abrir o formulário de criação de evento. O evento será publicado em 📖・eventos-mlc").setColor("Blue");
  await canal.send({ embeds: [embed], components: [row] }).catch(() => {});
  console.log("Painel de criar evento postado.");
}

async function postarPainelBatePonto(guild) {
  const canal = guild.channels.cache.find(c => c.name === CHANNELS.BATE_PONTO);
  if (!canal) return console.log("Canal bate-ponto não encontrado.");
  await limparCanalCompleto(canal);
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("iniciar_ponto").setLabel("🟢 Iniciar").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId("pausar_ponto").setLabel("⏸️ Pausar").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("encerrar_ponto").setLabel("🔴 Encerrar").setStyle(ButtonStyle.Danger)
  );
  const embed = new EmbedBuilder().setTitle("🔥 Bate-Ponto MLC").setDescription("Use os botões para iniciar/pausar/encerrar o ponto.").setColor("Orange");
  await canal.send({ embeds: [embed], components: [row] }).catch(() => {});
  console.log("Painel de bate-ponto postado.");
}

// ---------- Ready ----------
client.once(Events.ClientReady, async () => {
  console.log(`✅ Logado como ${client.user.tag}`);
  const guild = client.guilds.cache.first();
  if (!guild) return console.log("Bot não está em guilds na cache.");

  // postar painéis
  await Promise.all([
    postarPainelRecrutamento(guild),
    postarPainelCriarEvento(guild),
    postarPainelBatePonto(guild)
  ]);

  console.log("Painéis iniciais enviados.");
});

// ---------- Interações (botões + modais) ----------
client.on(Events.InteractionCreate, async (interaction) => {
  try {
    // ---------- Botão: abrir recrutamento ----------
    if (interaction.isButton() && interaction.customId === "abrir_recrutamento") {
      const modal = new ModalBuilder().setCustomId("modal_recrutamento").setTitle("📋 Formulário de Recrutamento");
      const nick = new TextInputBuilder().setCustomId("nick").setLabel("Nick no jogo").setStyle(TextInputStyle.Short).setRequired(true);
      const idjogo = new TextInputBuilder().setCustomId("idjogo").setLabel("ID no jogo").setStyle(TextInputStyle.Short).setRequired(true);
      const idrecr = new TextInputBuilder().setCustomId("idrecrutador").setLabel("ID do recrutador").setStyle(TextInputStyle.Short).setRequired(true);
      const whats = new TextInputBuilder().setCustomId("whats").setLabel("WhatsApp (Opcional)").setStyle(TextInputStyle.Short).setRequired(false);
      modal.addComponents(
        new ActionRowBuilder().addComponents(nick),
        new ActionRowBuilder().addComponents(idjogo),
        new ActionRowBuilder().addComponents(idrecr),
        new ActionRowBuilder().addComponents(whats)
      );
      await interaction.showModal(modal);
      return;
    }

    // ---------- Modal submit: recrutamento ----------
    if (interaction.isModalSubmit() && interaction.customId === "modal_recrutamento") {
      await interaction.deferReply({ ephemeral: true });
      const nick = interaction.fields.getTextInputValue("nick");
      const idjogo = interaction.fields.getTextInputValue("idjogo");
      const idrecr = interaction.fields.getTextInputValue("idrecrutador");
      const whats = interaction.fields.getTextInputValue("whats") || "Não informado";

      const embed = new EmbedBuilder()
        .setTitle("📋 Nova Solicitação de Recrutamento")
        .addFields(
          { name: "Nick", value: nick, inline: true },
          { name: "ID no jogo", value: idjogo, inline: true },
          { name: "Recrutador", value: idrecr, inline: true },
          { name: "WhatsApp", value: whats, inline: false },
          { name: "Discord", value: `<@${interaction.user.id}>`, inline: false }
        )
        .setColor("Yellow")
        .setTimestamp();

      const aceitar = new ButtonBuilder().setCustomId(`rec_aceitar_${interaction.user.id}`).setLabel("✅ Aceitar").setStyle(ButtonStyle.Success);
      const recusar = new ButtonBuilder().setCustomId(`rec_recusar_${interaction.user.id}`).setLabel("❌ Recusar").setStyle(ButtonStyle.Danger);
      const row = new ActionRowBuilder().addComponents(aceitar, recusar);

      const canalSolic = interaction.guild.channels.cache.find(c => c.name === CHANNELS.SOLICITACOES);
      if (!canalSolic) {
        await interaction.editReply({ content: "❌ Canal de solicitações não encontrado. Avise um admin." });
        return;
      }
      await canalSolic.send({ content: `Nova solicitação de ${interaction.user}`, embeds: [embed], components: [row] }).catch(() => {});
      await interaction.editReply({ content: "✅ Solicitação enviada para análise em 📋・solicitações-mlc" });
      return;
    }

    // ---------- Botões de aceitar/recusar recrutamento ----------
    if (interaction.isButton() && (interaction.customId.startsWith("rec_aceitar_") || interaction.customId.startsWith("rec_recusar_"))) {
      const member = interaction.member;
      const canManage = member.roles.cache.some(r => r.name === "Superior" || r.name === "Recrutador");
      if (!canManage) {
        await interaction.reply({ content: "🚫 Você não tem permissão para gerenciar solicitações.", ephemeral: true });
        return;
      }

      await interaction.deferUpdate();
      const parts = interaction.customId.split("_");
      const action = parts[1];
      const userId = parts[2];

      try {
        const msg = interaction.message;
        if (action === "aceitar") {
          const role = interaction.guild.roles.cache.find(r => r.name === ROLE_NAME);
          const target = await interaction.guild.members.fetch(userId).catch(() => null);
          if (role && target) {
            await target.roles.add(role).catch(() => {});
            const canalRel = interaction.guild.channels.cache.find(c => c.name === CHANNELS.RELATORIOS_REC);
            if (canalRel) await canalRel.send({ content: `✅ ${target} aprovado e recebeu o cargo ${ROLE_NAME}` }).catch(() => {});
          }
          try { await msg.edit({ content: "✅ Solicitação **Aprovada**", components: [] }); } catch {}
        } else {
          try { await msg.edit({ content: "❌ Solicitação **Recusada**", components: [] }); } catch {}
          const target = await interaction.guild.members.fetch(userId).catch(() => null);
          if (target) {
            target.send("❌ Seu recrutamento foi recusado. Por favor, preencha novamente o formulário em 📋・recrutamento.").catch(() => {});
          }
        }
      } catch (e) {
        console.error("Erro ao processar aceitar/recusar:", e);
      }
      return;
    }

    // ---------- Painel criar evento (abre modal) ----------
    if (interaction.isButton() && interaction.customId === "abrir_evento") {
      const modal = new ModalBuilder().setCustomId("modal_evento").setTitle("📅 Criar Evento");
      const titulo = new TextInputBuilder().setCustomId("titulo").setLabel("Título do evento").setStyle(TextInputStyle.Short).setRequired(true);
      const data = new TextInputBuilder().setCustomId("dataEvento").setLabel("Data (ex: 20/10/2025)").setStyle(TextInputStyle.Short).setRequired(true);
      const horario = new TextInputBuilder().setCustomId("horarioEvento").setLabel("Horário (ex: 18:00)").setStyle(TextInputStyle.Short).setRequired(true);
      const descricao = new TextInputBuilder().setCustomId("descricaoEvento").setLabel("Descrição").setStyle(TextInputStyle.Paragraph).setRequired(true);
      modal.addComponents(
        new ActionRowBuilder().addComponents(titulo),
        new ActionRowBuilder().addComponents(data),
        new ActionRowBuilder().addComponents(horario),
        new ActionRowBuilder().addComponents(descricao)
      );
      await interaction.showModal(modal);
      return;
    }

    // ---------- Submit: evento ----------
    if (interaction.isModalSubmit() && interaction.customId === "modal_evento") {
      await interaction.deferReply({ ephemeral: true });
      const titulo = interaction.fields.getTextInputValue("titulo");
      const data = interaction.fields.getTextInputValue("dataEvento");
      const horario = interaction.fields.getTextInputValue("horarioEvento");
      const descricao = interaction.fields.getTextInputValue("descricaoEvento");

      const embed = new EmbedBuilder()
        .setTitle(`🎉 ${titulo}`)
        .setDescription(descricao)
        .addFields(
          { name: "📅 Data", value: data, inline: true },
          { name: "⏰ Horário", value: horario, inline: true },
          { name: "👤 Criador", value: `<@${interaction.user.id}>`, inline: false }
        )
        .setColor("Blue")
        .setTimestamp();

      const canalEventos = interaction.guild.channels.cache.find(c => c.name === CHANNELS.EVENTOS_MLC);
      if (!canalEventos) {
        await interaction.editReply({ content: "❌ Canal de eventos não encontrado." });
        return;
      }
      await canalEventos.send({ embeds: [embed] }).catch(() => {});
      await interaction.editReply({ content: "✅ Evento criado e publicado em 📖・eventos-mlc" });
      return;
    }

    // ---------- BATE-PONTO: iniciar / pausar / encerrar ----------
    if (interaction.isButton() && ["iniciar_ponto", "pausar_ponto", "encerrar_ponto"].includes(interaction.customId)) {
      const guild = interaction.guild;
      const canalLogs = guild.channels.cache.find(c => c.name === CHANNELS.LOGS_PONTOS);
      await interaction.deferReply({ ephemeral: true });

      const uid = interaction.user.id;
      if (interaction.customId === "iniciar_ponto") {
        pontos.set(uid, { inicio: Date.now(), pausas: 0, encerrado: false });
        ultimaAtividade.set(uid, Date.now());
        const msg = `🟢 <@${uid}> iniciou o ponto em <t:${Math.floor(Date.now()/1000)}:f>.`;
        canalLogs?.send(msg).catch(() => {});
        await interaction.editReply({ content: "🟢 Ponto iniciado (registro em 🔥・logs-pontos)." });
        return;
      }

      if (interaction.customId === "pausar_ponto") {
        const rec = pontos.get(uid);
        if (!rec) {
          await interaction.editReply({ content: "⚠️ Você ainda não iniciou um ponto." });
          return;
        }
        rec.pausas = (rec.pausas || 0) + 1;
        rec.pausaInicio = Date.now();
        ultimaAtividade.set(uid, Date.now());
        const msg = `⏸️ <@${uid}> pausou o ponto (pausas: ${rec.pausas}).`;
        canalLogs?.send(msg).catch(() => {});
        await interaction.editReply({ content: `⏸️ Ponto pausado (pausas: ${rec.pausas}).` });
        return;
      }

      if (interaction.customId === "encerrar_ponto") {
        const rec = pontos.get(uid);
        if (!rec) {
          await interaction.editReply({ content: "⚠️ Você não tem ponto iniciado." });
          return;
        }
        rec.encerrado = true;
        const fim = Date.now();
        const durMs = fim - rec.inicio;
        const dur = formatDurationMs(durMs);
        ultimaAtividade.set(uid, Date.now());
        const msg = `🔴 <@${uid}> encerrou o ponto.\n🕐 Início: <t:${Math.floor(rec.inicio/1000)}:t>\n⏸️ Pausas: ${rec.pausas || 0}\n⏱️ Duração: ${dur}`;
        canalLogs?.send({ content: msg }).catch(() => {});
        await interaction.editReply({ content: `🔴 Ponto encerrado — ${dur} (registro em 🔥・logs-pontos).` });
        pontos.delete(uid);
        return;
      }
    }

  } catch (err) {
    console.error("Erro na interação:", err);
    try { if (!interaction.replied) await interaction.reply({ content: "❌ Erro ao processar interação.", ephemeral: true }); } catch {}
  }
});

// ---------- Rotina diária: expulsar inativos ----------
setInterval(async () => {
  try {
    const guild = client.guilds.cache.first();
    if (!guild) return;
    for (const [userId, lastTs] of ultimaAtividade.entries()) {
      if (Date.now() - lastTs > INACTIVITY_MS) {
        const member = await guild.members.fetch(userId).catch(() => null);
        if (!member) { ultimaAtividade.delete(userId); continue; }
        await member.kick("Inatividade (14 dias sem ponto)").catch((e) => console.log("kick err:", e.message));
        const canalInativos = guild.channels.cache.find(c => c.name === CHANNELS.INATIVIDADES);
        canalInativos?.send(`⚠️ <@${userId}> foi expulso por inatividade (14 dias sem bater ponto).`).catch(() => {});
        ultimaAtividade.delete(userId);
      }
    }
  } catch (e) {
    console.error("Erro rotina inatividade:", e);
  }
}, 24 * 60 * 60 * 1000);

// ---------- LOGIN ----------
client.login(process.env.TOKEN).catch(e => console.error("Login falhou:", e.message));
