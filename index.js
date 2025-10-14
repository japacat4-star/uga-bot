// index.js - BOT MLC (com Recrutamento, Eventos, Bate-Ponto e Kick automático)
// Requisitos: node 18+, discord.js v14, express, dotenv
// Variável de ambiente: TOKEN  (não coloque o token direto no código)

import fs from "fs/promises";
import path from "path";
import express from "express";
import dotenv from "dotenv";
import {
  Client,
  GatewayIntentBits,
  Partials,
  Events,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";

dotenv.config();
const TOKEN = process.env.TOKEN;
if (!TOKEN) {
  console.error("ERRO: defina a variável de ambiente TOKEN com o token do bot.");
  process.exit(1);
}

// ---------- Configs (edite se quiser) ----------
const GUILD_CHANNEL_RECRUTAMENTO = "📋・recrutamento";
const CHANNEL_SOLICITACOES = "📋・solicitações-mlc";
const CHANNEL_RELAT_REC = "📋・relatórios-de-rec";
const CHANNEL_EVENTOS = "📖・eventos-mlc";
const CHANNEL_CRIAR_EVENTO = "📖・criar-evento";
const CHANNEL_PONTO = "🔥・bate-ponto";
const CHANNEL_LOGS_ENTRADA = "logs-entrada";
const CHANNEL_LOGS_SAIDA = "logs-saida";

const ROLE_MLC = "MLC";
const ROLE_SUPERIOR = "Superior";
const ROLE_RECRUTADOR = "Recrutador";

const INACTIVITY_DAYS = 14;
const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000; // 1 dia

// ---------- Arquivos de dados ----------
const DATA_DIR = path.resolve("./data");
const FILE_ACTIVITY = path.join(DATA_DIR, "activity.json"); // last activity timestamps
const FILE_POINTS = path.join(DATA_DIR, "points.json"); // histórico de pontos
const FILE_EVENTS = path.join(DATA_DIR, "events.json"); // eventos e inscritos
const FILE_RECRUITS = path.join(DATA_DIR, "recruits.json"); // solicitações aprovadas/negadas

async function ensureDataFiles() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const files = [
    [FILE_ACTIVITY, "{}"],
    [FILE_POINTS, "{}"],
    [FILE_EVENTS, "{}"],
    [FILE_RECRUITS, "{}"],
  ];
  for (const [f, start] of files) {
    try {
      await fs.access(f);
    } catch {
      await fs.writeFile(f, start, "utf8");
    }
  }
}
async function readJSON(file) {
  try {
    const text = await fs.readFile(file, "utf8");
    return JSON.parse(text || "{}");
  } catch (e) {
    return {};
  }
}
async function writeJSON(file, obj) {
  await fs.writeFile(file, JSON.stringify(obj, null, 2), "utf8");
}

// ---------- Util helpers ----------
function formatDuration(ms) {
  const totalMin = Math.floor(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h > 0) return `${h}h ${m}min`;
  return `${m}min`;
}
function now() {
  return Date.now();
}

// ---------- Cliente Discord ----------
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildPresences, // só se precisar (pode remover)
  ],
  partials: [Partials.Channel, Partials.Message],
});

// memória temporária de pontos ativos: { userId: { inicio, pausas: [ms], pausado, pausaInicio, messageId, channelId } }
const pontosAtivos = new Map();

// memória temporária de eventos ativos carregados (id => event)
// eventos persistidos também em FILE_EVENTS

// ---------- Server web para Uptime (Render/Replit) ----------
const app = express();
app.get("/", (req, res) => res.send("Bot MLC está online ✅"));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🌐 Web server ativo na porta ${PORT}`));

// ---------- On ready: envia botões fixos se canais existirem ----------
client.once(Events.ClientReady, async () => {
  console.log(`🤖 Bot conectado como ${client.user.tag}`);
  await ensureDataFiles();

  // enviar botão recrutamento
  const guild = client.guilds.cache.first();
  if (!guild) return console.log("Bot não encontrado em nenhum servidor na cache.");
  try {
    const canalRec = guild.channels.cache.find((c) => c.name === GUILD_CHANNEL_RECRUTAMENTO);
    if (canalRec) {
      // remove mensagens antigas do bot para evitar duplicar
      try {
        await canalRec.bulkDelete(10);
      } catch {}
      const btn = new ButtonBuilder().setCustomId("abrir_formulario").setLabel("📋 Preencher Formulário de Recrutamento").setStyle(ButtonStyle.Primary);
      const row = new ActionRowBuilder().addComponents(btn);
      const embed = new EmbedBuilder().setColor("Yellow").setTitle("📋 Sistema de Recrutamento").setDescription("Clique no botão para abrir o formulário de recrutamento.");
      await canalRec.send({ embeds: [embed], components: [row] }).catch(() => {});
    }
  } catch (e) { console.error(e); }

  // enviar painel de bate-ponto
  try {
    const canalPonto = guild.channels.cache.find((c) => c.name === CHANNEL_PONTO);
    if (canalPonto) {
      try { await canalPonto.bulkDelete(10); } catch {}
      const botoes = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("iniciar_ponto").setLabel("🟢 Iniciar Ponto").setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId("pausar_ponto").setLabel("⏸️ Pausar").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId("encerrar_ponto").setLabel("🔴 Encerrar").setStyle(ButtonStyle.Danger)
      );
      const embed = new EmbedBuilder().setColor("Orange").setTitle("🔥 Sistema de Bate-Ponto").setDescription("Use os botões para iniciar, pausar ou encerrar seu ponto. Somente cargo MLC.");
      await canalPonto.send({ embeds: [embed], components: [botoes] }).catch(() => {});
    }
  } catch (e) { console.error(e); }

  // Recarregar eventos guardados (se houver)
  // (Nada necessário aqui - usaremos os dados do arquivo quando necessário)
});

// ---------- Interações unificadas (botões + modais) ----------
client.on(Events.InteractionCreate, async (interaction) => {
  try {
    // ---------- Botão: abrir formulário de recrutamento ----------
    if (interaction.isButton() && interaction.customId === "abrir_formulario") {
      // cria modal com customId único
      const modalId = `recrutamentoModal_${interaction.user.id}_${Date.now()}`;
      const modal = new ModalBuilder().setCustomId(modalId).setTitle("📋 Formulário de Recrutamento");

      const nick = new TextInputBuilder().setCustomId("nick").setLabel("Nick no jogo").setStyle(TextInputStyle.Short).setRequired(true);
      const idjogo = new TextInputBuilder().setCustomId("idjogo").setLabel("ID no jogo").setStyle(TextInputStyle.Short).setRequired(true);
      const recrutador = new TextInputBuilder().setCustomId("recrutador").setLabel("ID do recrutador").setStyle(TextInputStyle.Short).setRequired(true);
      const whats = new TextInputBuilder().setCustomId("whats").setLabel("WhatsApp (opcional)").setStyle(TextInputStyle.Short).setRequired(false);

      modal.addComponents(
        new ActionRowBuilder().addComponents(nick),
        new ActionRowBuilder().addComponents(idjogo),
        new ActionRowBuilder().addComponents(recrutador),
        new ActionRowBuilder().addComponents(whats)
      );

      return interaction.showModal(modal);
    }

    // ---------- Modal submit: recrutamento (qualquer customId que comece com recrutamentoModal_) ----------
    if (interaction.isModalSubmit() && interaction.customId.startsWith("recrutamentoModal_")) {
      const nick = interaction.fields.getTextInputValue("nick");
      const idjogo = interaction.fields.getTextInputValue("idjogo");
      const recrutador = interaction.fields.getTextInputValue("recrutador");
      const whats = interaction.fields.getTextInputValue("whats") || "Não informado";

      const canalSolic = interaction.guild.channels.cache.find((c) => c.name === CHANNEL_SOLICITACOES);
      const canalRel = interaction.guild.channels.cache.find((c) => c.name === CHANNEL_RELAT_REC);

      const embed = new EmbedBuilder()
        .setColor("Yellow")
        .setTitle("📋 Nova Solicitação de Recrutamento")
        .addFields(
          { name: "👤 Nick", value: nick, inline: true },
          { name: "🆔 ID no jogo", value: idjogo, inline: true },
          { name: "🎯 Recrutador", value: recrutador, inline: true },
          { name: "📞 WhatsApp", value: whats }
        )
        .addFields({ name: "Discord", value: `${interaction.user}` })
        .setTimestamp();

      // botões para aceitar/neg
      const aceitar = new ButtonBuilder().setCustomId(`recr_accept_${interaction.user.id}_${Date.now()}`).setLabel("✅ Aprovar").setStyle(ButtonStyle.Success);
      const negar = new ButtonBuilder().setCustomId(`recr_deny_${interaction.user.id}_${Date.now()}`).setLabel("❌ Negar").setStyle(ButtonStyle.Danger);
      const row = new ActionRowBuilder().addComponents(aceitar, negar);

      if (canalSolic) await canalSolic.send({ content: `Nova solicitação de ${interaction.user}`, embeds: [embed], components: [row] }).catch(() => {});
      if (canalRel) await canalRel.send({ content: `Registro: ${interaction.user}`, embeds: [embed] }).catch(() => {});

      await interaction.reply({ content: "✅ Seu formulário foi enviado para análise!", ephemeral: true });
      return;
    }

    // ---------- Botões de recrutamento: aprovar / negar ----------
    if (interaction.isButton() && (interaction.customId.startsWith("recr_accept_") || interaction.customId.startsWith("recr_deny_"))) {
      // verificar permissão: só Superior ou Recrutador
      const member = interaction.member;
      const canManage = member.roles.cache.some((r) => r.name === ROLE_SUPERIOR || r.name === ROLE_RECRUTADOR);
      if (!canManage) return interaction.reply({ content: "🚫 Você não tem permissão para gerenciar recrutamentos.", ephemeral: true });

      const parts = interaction.customId.split("_");
      const action = parts[1] === "accept" || parts[0].includes("recr") && parts[1] === "accept" ? "accept" : "deny";
      // note: customId include userid but we don't strictly need it

      // parse embed from message to extract nick/id
      const msg = interaction.message;
      const embed = msg.embeds[0];
      const targetDiscordLine = embed.fields.find(f => f.name === "Discord");
      const discordStr = targetDiscordLine ? targetDiscordLine.value : null;
      // get the user mention from the message content (we sent it earlier)
      // fallback: reply ephemeral
      if (action === "accept") {
        // try to parse user id from message content: "Nova solicitação de <@id>"
        const content = msg.content || "";
        const mentionMatch = content.match(/<@!?(\d+)>/);
        let userid = mentionMatch ? mentionMatch[1] : null;
        if (!userid) {
          // try to find from embed fields
          userid = null;
        }
        // assign role MLC and set nickname to format Nick/ID if possible
        if (userid) {
          const guild = interaction.guild;
          const target = await guild.members.fetch(userid).catch(() => null);
          if (target) {
            // add role
            const role = guild.roles.cache.find(r => r.name === ROLE_MLC);
            if (role) await target.roles.add(role).catch(() => {});
            // change nickname to "Nick/ID"
            const nickField = embed.fields.find(f => f.name === "👤 Nick");
            const idField = embed.fields.find(f => f.name === "🆔 ID no jogo");
            const newNick = nickField ? `${nickField.value}/${(idField? idField.value : "")}` : undefined;
            if (newNick) {
              try { await target.setNickname(newNick); } catch {}
            }
            // log in relatórios
            const canalRel = guild.channels.cache.find(c => c.name === CHANNEL_RELAT_REC);
            if (canalRel) {
              await canalRel.send({ content: `✅ ${target} aprovado e recebeu o cargo ${ROLE_MLC}` });
            }
            await interaction.reply({ content: `✅ ${target} aprovado com sucesso.`, ephemeral: true });
            // register activity once approved (starts counting from now)
            const act = await readJSON(FILE_ACTIVITY);
            act[userid] = now();
            await writeJSON(FILE_ACTIVITY, act);
            return;
          }
        }
        return interaction.reply({ content: "⚠️ Não consegui identificar o usuário para aprovar (verifique a mensagem de solicitação).", ephemeral: true });
      } else {
        await interaction.reply({ content: "❌ Solicitação negada.", ephemeral: true });
        return;
      }
    }

    // ---------- Sistema de eventos: criar evento (botão ou modal) ----------
    // Simples: superior usa botão no canal criar-evento para abrir modal
    if (interaction.isButton() && interaction.customId === "abrir_modal_criar_evento") {
      // só superiores
      const member = interaction.member;
      if (!member.roles.cache.some((r) => r.name === ROLE_SUPERIOR)) {
        return interaction.reply({ content: "🚫 Apenas superiores podem criar eventos.", ephemeral: true });
      }
      const modalId = `criaEvento_${interaction.user.id}_${Date.now()}`;
      const modal = new ModalBuilder().setCustomId(modalId).setTitle("📖 Criar Evento");
      const tipo = new TextInputBuilder().setCustomId("tipo").setLabel("Que tipo de ação?").setStyle(TextInputStyle.Short).setRequired(true);
      const inicio = new TextInputBuilder().setCustomId("inicio").setLabel("Começa que horas? (ex: 20:00)").setStyle(TextInputStyle.Short).setRequired(true);
      const quantidade = new TextInputBuilder().setCustomId("quantidade").setLabel("Quantidade para entrar").setStyle(TextInputStyle.Short).setRequired(true);

      modal.addComponents(new ActionRowBuilder().addComponents(tipo), new ActionRowBuilder().addComponents(inicio), new ActionRowBuilder().addComponents(quantidade));
      return interaction.showModal(modal);
    }

    if (interaction.isModalSubmit() && interaction.customId.startsWith("criaEvento_")) {
      // criar evento no canal eventos-mlc com botão para entrar
      const tipo = interaction.fields.getTextInputValue("tipo");
      const inicio = interaction.fields.getTextInputValue("inicio");
      const quantidade = interaction.fields.getTextInputValue("quantidade");
      const canalEventos = interaction.guild.channels.cache.find((c) => c.name === CHANNEL_EVENTOS);
      if (!canalEventos) return interaction.reply({ content: "Canal de eventos não encontrado.", ephemeral: true });

      // criar objeto evento e persistir
      const events = await readJSON(FILE_EVENTS);
      const eventId = `evt_${Date.now()}`;
      events[eventId] = {
        id: eventId,
        tipo,
        inicio,
        quantidade,
        creator: interaction.user.id,
        participantes: [],
        createdAt: now(),
      };
      await writeJSON(FILE_EVENTS, events);

      const joinBtn = new ButtonBuilder().setCustomId(`join_evt_${eventId}`).setLabel("Entrar no evento").setStyle(ButtonStyle.Primary);
      const row = new ActionRowBuilder().addComponents(joinBtn);
      const embed = new EmbedBuilder().setColor("Yellow").setTitle(`📖 Evento criado: ${tipo}`).setDescription(`Início: ${inicio}\nVagas: ${quantidade}\nCriado por: ${interaction.user}`);
      await canalEventos.send({ embeds: [embed], components: [row] });
      await interaction.reply({ content: "✅ Evento criado com sucesso!", ephemeral: true });
      return;
    }

    // participar do evento
    if (interaction.isButton() && interaction.customId.startsWith("join_evt_")) {
      const eventId = interaction.customId.replace("join_evt_", "");
      const events = await readJSON(FILE_EVENTS);
      const ev = events[eventId];
      if (!ev) return interaction.reply({ content: "Evento não encontrado.", ephemeral: true });

      // checar role MLC
      if (!interaction.member.roles.cache.some((r) => r.name === ROLE_MLC)) {
        return interaction.reply({ content: "🚫 Apenas membros com cargo MLC podem entrar no evento.", ephemeral: true });
      }
      if (ev.participantes.includes(interaction.user.id)) {
        return interaction.reply({ content: "⚠️ Você já está inscrito.", ephemeral: true });
      }
      if (ev.participantes.length >= Number(ev.quantidade)) {
        return interaction.reply({ content: "❌ Evento cheio.", ephemeral: true });
      }
      ev.participantes.push(interaction.user.id);
      await writeJSON(FILE_EVENTS, events);

      // registrar atividade para kick
      const act = await readJSON(FILE_ACTIVITY);
      act[interaction.user.id] = now();
      await writeJSON(FILE_ACTIVITY, act);

      await interaction.reply({ content: `✅ ${interaction.user} inscrito no evento!`, ephemeral: true });
      return;
    }

    // ---------- Sistema de ponto: iniciar / pausar / encerrar ----------
    if (interaction.isButton() && (interaction.customId === "iniciar_ponto" || interaction.customId === "pausar_ponto" || interaction.customId === "encerrar_ponto")) {
      const member = interaction.member;
      if (!member.roles.cache.some((r) => r.name === ROLE_MLC)) {
        return interaction.reply({ content: "🚫 Apenas membros com cargo MLC podem usar o ponto.", ephemeral: true });
      }
      const userid = interaction.user.id;
      const agora = now();

      if (interaction.customId === "iniciar_ponto") {
        if (pontosAtivos.has(userid)) return interaction.reply({ content: "⚠️ Você já tem um ponto ativo.", ephemeral: true });

        // cria mensagem de ponto personalizada no canal atual
        const canal = interaction.channel;
        const embed = new EmbedBuilder().setColor("Yellow").setTitle("📍 Ponto em andamento").setDescription(`👤 Membro: ${interaction.user}\n🕐 Início: <t:${Math.floor(agora / 1000)}:t>\n⏸️ Pausas: 0\n⏰ Tempo total: 0min`).setFooter({ text: "Use pausar / encerrar para controlar seu ponto." });
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`ponto_pausar_${userid}_${Date.now()}`).setLabel("⏸️ Pausar").setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId(`ponto_encerrar_${userid}_${Date.now()}`).setLabel("🔴 Encerrar").setStyle(ButtonStyle.Danger)
        );
        const msg = await canal.send({ content: `${interaction.user}`, embeds: [embed], components: [row] });
        pontosAtivos.set(userid, { inicio: agora, pausas: [], pausado: false, msgId: msg.id, canalId: msg.channelId });
        // registrar atividade inicial
        const act = await readJSON(FILE_ACTIVITY);
        act[userid] = agora;
        await writeJSON(FILE_ACTIVITY, act);

        return interaction.reply({ content: "✅ Ponto iniciado — mensagem criada no canal.", ephemeral: true });
      }

      if (interaction.customId === "pausar_ponto") {
        if (!pontosAtivos.has(userid)) return interaction.reply({ content: "❌ Você não tem ponto ativo.", ephemeral: true });
        const p = pontosAtivos.get(userid);
        if (p.pausado) return interaction.reply({ content: "⚠️ Seu ponto já está em pausa. Para retomar, clique em Iniciar (não implementado como toggle aqui).", ephemeral: true });
        p.pausado = true;
        p.pausaInicio = agora;
        // atualizar mensagem
        try {
          const chan = await client.channels.fetch(p.canalId).catch(() => null);
          if (chan) {
            const msg = await chan.messages.fetch(p.msgId).catch(() => null);
            if (msg) {
              const embed = EmbedBuilder.from(msg.embeds[0]).setColor("Orange").setTitle("⏸️ Ponto pausado");
              await msg.edit({ embeds: [embed] });
            }
          }
        } catch {}
        return interaction.reply({ content: "⏸️ Ponto pausado.", ephemeral: true });
      }

      if (interaction.customId === "encerrar_ponto") {
        if (!pontosAtivos.has(userid)) return interaction.reply({ content: "❌ Você não tem ponto ativo.", ephemeral: true });
        const p = pontosAtivos.get(userid);
        const fim = agora;
        let tempoPausado = 0;
        // se estava em pausa, soma pausa atual
        if (p.pausado && p.pausaInicio) {
          tempoPausado += (agora - p.pausaInicio);
          p.pausas.push(agora - p.pausaInicio);
        }
        // soma pausas registradas
        for (const t of p.pausas) tempoPausado += t;
        const tempoTotalMs = fim - p.inicio - tempoPausado;
        const tempoTotal = formatDuration(tempoTotalMs);
        const tempoPausaStr = formatDuration(tempoPausado);

        // atualizar mensagem final (mesma mensagem)
        try {
          const chan = await client.channels.fetch(p.canalId).catch(() => null);
          if (chan) {
            const msg = await chan.messages.fetch(p.msgId).catch(() => null);
            if (msg) {
              const embed = new EmbedBuilder().setColor("Yellow").setTitle("✅ Ponto encerrado").setDescription(
                `👤 Membro: <@${userid}>\n🕐 Início: <t:${Math.floor(p.inicio / 1000)}:t>\n⏸️ Pausas: ${p.pausas.length} vezes (${tempoPausaStr} total)\n⏰ Tempo total de serviço: ${tempoTotal}\n📅 Data: <t:${Math.floor(fim / 1000)}:d>`
              );
              await msg.edit({ content: `<@${userid}>`, embeds: [embed], components: [] });
            }
          }
        } catch (e) { console.error(e); }

        // persistir histórico
        const points = await readJSON(FILE_POINTS);
        if (!points[userid]) points[userid] = [];
        points[userid].push({
          inicio: p.inicio,
          fim,
          tempoPausado,
          pausas: p.pausas,
          tempoTotalMs,
          canalId: p.canalId,
          messageId: p.msgId,
          date: new Date(fim).toISOString()
        });
        await writeJSON(FILE_POINTS, points);

        // registrar atividade (finalizou ponto)
        const act = await readJSON(FILE_ACTIVITY);
        act[userid] = now();
        await writeJSON(FILE_ACTIVITY, act);

        pontosAtivos.delete(userid);
        return interaction.reply({ content: "✅ Ponto encerrado e registrado.", ephemeral: true });
      }
    }

  } catch (err) {
    console.error("Erro na interação:", err);
    if (interaction.replied || interaction.deferred) {
      try { await interaction.followUp({ content: "❌ Ocorreu um erro interno.", ephemeral: true }); } catch {}
    } else {
      try { await interaction.reply({ content: "❌ Ocorreu um erro interno.", ephemeral: true }); } catch {}
    }
  }
});

// ---------- Logs de entrada / saída ----------
client.on(Events.GuildMemberAdd, async (member) => {
  const canal = member.guild.channels.cache.find((c) => c.name === CHANNEL_LOGS_ENTRADA);
  if (!canal) return;
  const embed = new EmbedBuilder().setColor("Yellow").setTitle("👋 Novo membro chegou!").setDescription(`${member} entrou no servidor.`).setTimestamp();
  canal.send({ embeds: [embed] }).catch(() => {});
});
client.on(Events.GuildMemberRemove, async (member) => {
  const canal = member.guild.channels.cache.find((c) => c.name === CHANNEL_LOGS_SAIDA);
  if (!canal) return;
  const embed = new EmbedBuilder().setColor("Yellow").setTitle("🚪 Membro saiu").setDescription(`${member.user.tag} saiu do servidor.`).setTimestamp();
  canal.send({ embeds: [embed] }).catch(() => {});
});

// ---------- Kick automático (checagem diária) ----------
async function checkInactiveMembers() {
  try {
    const guild = client.guilds.cache.first();
    if (!guild) return;
    const mlcRole = guild.roles.cache.find((r) => r.name === ROLE_MLC);
    const logsChannel = guild.channels.cache.find((c) => c.name === CHANNEL_LOGS_SAIDA);
    if (!mlcRole) return;
    const activity = await readJSON(FILE_ACTIVITY);
    const nowTs = now();
    const limitMs = INACTIVITY_DAYS * 24 * 60 * 60 * 1000;
    const members = await guild.members.fetch();
    for (const [id, member] of members) {
      if (!member.roles.cache.has(mlcRole.id)) continue;
      const last = activity[id];
      if (!last) continue; // sem registro, começa a contar a partir de agora (conforme combinamos)
      if (nowTs - last >= limitMs) {
        // kick
        try {
          await member.kick(`Inatividade ${INACTIVITY_DAYS} dias`);
          if (logsChannel) {
            const lastDate = new Date(last).toLocaleDateString("pt-BR");
            await logsChannel.send(`🚨 **${member.user.tag}** foi removido por inatividade (${INACTIVITY_DAYS} dias). Última atividade: ${lastDate}`);
          }
          // remover do activity file
          const act = await readJSON(FILE_ACTIVITY);
          delete act[id];
          await writeJSON(FILE_ACTIVITY, act);
        } catch (e) {
          console.error("Falha ao kicar:", e);
        }
      }
    }
  } catch (e) {
    console.error("Erro ao checar inativos:", e);
  }
}
// roda a checagem a cada 24h (inicia após login)
setInterval(() => {
  if (client.isReady()) checkInactiveMembers();
}, CHECK_INTERVAL_MS);

// ---------- startup ----------
client.login(TOKEN);

// ---------- export (opcional) ----------
export default client;
