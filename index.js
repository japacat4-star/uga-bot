import { Client, GatewayIntentBits, Partials, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, Events } from "discord.js";
import express from "express";
import dotenv from "dotenv";

dotenv.config();
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
  partials: [Partials.Channel]
});

// --- SERVIDOR WEB (Render) ---
const server = express();
server.all("/", (req, res) => {
  res.send("Bot está rodando ✅");
});
server.listen(process.env.PORT || 3000, () => console.log("Servidor web ativo"));

// --- LOG DE INICIALIZAÇÃO ---
client.once("ready", () => {
  console.log(`✅ Logado como ${client.user.tag}`);
});

// --- COMANDO DE RECRUTAMENTO ---
client.on(Events.InteractionCreate, async (interaction) => {
  try {
    // Formulário de recrutamento
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
    }

    // Resposta do formulário
    if (interaction.isModalSubmit() && interaction.customId === "form_recrutamento") {
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

      await interaction.reply({ embeds: [embed] });
    }

    // Botões de ponto
    if (interaction.isButton()) {
      if (interaction.customId === "iniciar_ponto") {
        await interaction.reply(`🕒 ${interaction.user} iniciou o ponto.`);
      } else if (interaction.customId === "pausar_ponto") {
        await interaction.reply(`⏸️ ${interaction.user} pausou o ponto.`);
      } else if (interaction.customId === "encerrar_ponto") {
        await interaction.reply(`✅ ${interaction.user} encerrou o ponto.`);
      }
    }
  } catch (err) {
    console.error("Erro na interação:", err);
    if (interaction.replied === false) {
      await interaction.reply({ content: "❌ Ocorreu um erro ao processar a interação.", ephemeral: true });
    }
  }
});

client.login(process.env.TOKEN);
