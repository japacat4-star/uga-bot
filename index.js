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
import fs from "fs";
import dotenv from "dotenv";

dotenv.config();

// --- CLIENT DISCORD ---
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
  partials: [Partials.Channel],
});

// --- SERVIDOR WEB (Render) ---
const server = express();
server.all("/", (req, res) => res.send("Bot da MLC está rodando ✅"));
server.listen(process.env.PORT || 3000, () => console.log("🌐 Servidor web ativo"));

// --- DADOS DE PRESENÇA ---
const dataFile = "./pontos.json";
let pontos = fs.existsSync(dataFile) ? JSON.parse(fs.readFileSync(dataFile)) : {};

// --- FUNÇÃO: SALVAR ---
function salvarPontos() {
  fs.writeFileSync(dataFile, JSON.stringify(pontos, null, 2));
}

// --- QUANDO O BOT INICIA ---
client.once(Events.ClientReady, async () => {
  console.log(`✅ Logado como ${client.user.tag}`);

  // Canais fixos
  const canais = {
    recrutamento: "📋・recrutamento",
    solicitacoes: "📋・solicitações-mlc",
    relatorios: "📋・relatórios-de-rec",
    criarEventos: "📅・criar-eventos",
    eventosMlc: "📖・eventos-mlc",
    batePonto: "🔥・bate-ponto",
    inatividades: "🚨・inatividades",
    logsPontos: "🔥・logs-pontos",
  };

  // Limpar canais e enviar formulários fixos
  const guild = client.guilds.cache.first();
  if (!guild) return console.log("⚠️ Nenhum servidor encontrado!");

  // --- FORMULÁRIO DE RECRUTAMENTO ---
  const canalRec = guild.channels.cache.find(c => c.name === canais.recrutamento);
  if (canalRec) {
    await canalRec.bulkDelete(50).catch(() => {});
    const embed = new EmbedBuilder()
      .setTitle("📋 Formulário de Recrutamento")
      .setDescription("Clique no botão abaixo para enviar seu recrutamento!")
      .setColor("Green");
    const botao = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("abrir_form_recrutamento")
        .setLabel("📝 Enviar Recrutamento")
        .setStyle(ButtonStyle.Primary)
    );
    await canalRec.send({ embeds: [embed], components: [botao] });
  }

  // --- FORMULÁRIO DE EVENTOS ---
  const canalEvento = guild.channels.cache.find(c => c.name === canais.criarEventos);
  if (canalEvento) {
    await canalEvento.bulkDelete(50).catch(() => {});
    const embed = new EmbedBuilder()
      .setTitle("📅 Criar Evento")
      .setDescription("Clique no botão abaixo para cadastrar um novo evento.")
      .setColor("Blue");
    const botao = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("abrir_form_evento")
        .setLabel("🎉 Criar Evento")
        .setStyle(ButtonStyle.Success)
    );
    await canalEvento.send({ embeds: [embed], components: [botao] });
  }

  // --- BATE PONTO ---
  const canalPonto = guild.channels.cache.find(c => c.name === canais.batePonto);
  if (canalPonto) {
    await canalPonto.bulkDelete(50).catch(() => {});
    const embed = new EmbedBuilder()
      .setTitle("🔥 Bate Ponto MLC")
      .setDescription("Use os botões abaixo para iniciar, pausar ou encerrar seu ponto.")
      .setColor("Orange");
    const botoes = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("iniciar_ponto").setLabel("🕒 Iniciar").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId("pausar_ponto").setLabel("⏸️ Pausar").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("encerrar_ponto").setLabel("✅ Encerrar").setStyle(ButtonStyle.Danger)
    );
    await canalPonto.send({ embeds: [embed], components: [botoes] });
  }

  // --- VERIFICA INATIVOS (a cada 24h) ---
  setInterval(async () => {
    const canalInativos = guild.channels.cache.find(c => c.name === canais.inatividades);
    if (!canalInativos) return;
    const agora = Date.now();
    for (const [id, info] of Object.entries(pontos)) {
      const dias = (agora - info.ultimoPonto)
