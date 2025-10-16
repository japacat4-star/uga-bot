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

// === CONFIGURAÇÃO DO CLIENT ===
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Channel]
});

// === SERVIDOR WEB (Render) ===
const server = express();
server.all("/", (req, res) => res.send("✅ Bot MLC está rodando"));
server.listen(process.env.PORT || 3000, () =>
  console.log("🌐 Servidor web ativo")
);

// === LOGIN ===
client.once(Events.ClientReady, async (c) => {
  console.log(`✅ Logado como ${c.user.tag}`);

  // === LIMPAR CANAIS AUTOMATICAMENTE ===
  const canaisParaLimpar = [
    "🔥・bate-ponto",
    "🚨・inatividades",
    "📋・recrutamento"
  ];

  for (const canalNome of canaisParaLimpar) {
    const canal = c.channels.cache.find(ch => ch.name === canalNome);
    if (canal && canal.isTextBased()) {
      try {
        const mensagens = await canal.messages.fetch({ limit: 100 });
        await canal.bulkDelete(mensagens, true);
        console.log(`🧹 Canal "${canalNome}" limpo (${mensagens.size} mensagens apagadas).`);
      } catch (err) {
        console.log(`⚠️ Erro ao limpar ${canalNome}:`, err.message);
      }
    }
  }

  console.log("✨ Limpeza inicial concluída.");
});

// === INTERAÇÕES ===
client.on(Events.InteractionCreate, async (interaction) => {
  try {
    // === COMANDO /RECRUTAR ===
    if (interaction.isChatInputCommand() && interaction.commandName === "recrutar") {
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
      return;
    }

    // === RESPOSTA DO FORMULÁRIO ===
    if (interaction.isModalSubmit() && interaction.customId === "form_recrutamento") {
      await interaction.deferReply({ ephemeral: true });

      const nome = interaction.fields.getTextInputValue("nome");
      const idjogo = interaction.fields.getTextInputValue("idjogo");
      const idrecrutador = interaction.fields.getTextInputValue("idrecrutador");
      const whatsapp = interaction.fields.getTextInputValue("whatsapp") || "Não informado";

      const embed = new EmbedBuilder()
        .setTitle("📋 Novo Recrutamento")
        .addFields(
          { name: "Nome no jogo", value: `${nome} / ${idjogo}` },
          { name: "ID do recrutador", value: idrecrutador },
          { name: "WhatsApp", value: whatsapp },
          { name: "Discord", value: `<@${interaction.user.id}>` }
        )
        .setColor("Green")
        .setTimestamp();

      await interaction.editReply({
        content: "✅ Formulário enviado com sucesso!",
        embeds: [embed]
      });

      // === LOG DE RECRUTAMENTO ===
      console.log(`📝 Novo recrutamento registrado: ${nome} / ${idjogo}`);
      return;
    }

    // === BOTÕES DE PONTO ===
    if (interaction.isButton()) {
      await interaction.deferReply({ ephemeral: true }); // evita "interação falhou"

      if (interaction.customId === "iniciar_ponto") {
        await interaction.editReply({ content: `🕒 ${interaction.user} iniciou o ponto.` });
        console.log(`🟢 ${interaction.user.tag} iniciou o ponto.`);
      } else if (interaction.customId === "pausar_ponto") {
        await interaction.editReply({ content: `⏸️ ${interaction.user} pausou o ponto.` });
        console.log(`🟡 ${interaction.user.tag} pausou o ponto.`);
      } else if (interaction.customId === "encerrar_ponto") {
        await interaction.editReply({ content: `✅ ${interaction.user} encerrou o ponto.` });
        console.log(`🔴 ${interaction.user.tag} encerrou o ponto.`);
      }

      return;
    }
  } catch (err) {
    console.error("❌ Erro na interação:", err);
    if (!interaction.replied) {
      try {
        await interaction.reply({
          content: "❌ Ocorreu um erro ao processar sua interação.",
          ephemeral: true
        });
      } catch (e) {
        console.error("Falha ao enviar resposta de erro:", e);
      }
    }
  }
});

client.login(process.env.TOKEN);
