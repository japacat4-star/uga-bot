import 'dotenv/config';
import {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  PermissionsBitField,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  Events,
} from 'discord.js';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.once(Events.ClientReady, () => {
  console.log(`🤖 Bot conectado como ${client.user.tag}!`);
  const recrutamentoChannel = client.channels.cache.find(c => c.name === '📋・recrutamento');
  if (recrutamentoChannel) {
    const embed = new EmbedBuilder()
      .setColor('#ffcc00')
      .setTitle('📋 Sistema de Recrutamento MLC')
      .setDescription('Clique no botão abaixo para preencher seu formulário e entrar para a **MLC**!');
    const button = new ButtonBuilder()
      .setCustomId('abrir_formulario')
      .setLabel('📄 Abrir Formulário')
      .setStyle(ButtonStyle.Primary);

    recrutamentoChannel.send({ embeds: [embed], components: [new ActionRowBuilder().addComponents(button)] });
  }
});

// Logs de entrada e saída
client.on(Events.GuildMemberAdd, async (member) => {
  const canalEntrada = member.guild.channels.cache.find(c => c.name === 'logs-entrada');
  if (!canalEntrada) return;
  const embed = new EmbedBuilder()
    .setColor('#ffcc00')
    .setTitle('🚪 Novo membro entrou!')
    .setDescription(`👤 ${member.user.tag} entrou no servidor!`)
    .setThumbnail(member.user.displayAvatarURL())
    .setTimestamp();
  canalEntrada.send({ embeds: [embed] });
});

client.on(Events.GuildMemberRemove, async (member) => {
  const canalSaida = member.guild.channels.cache.find(c => c.name === 'logs-saida');
  if (!canalSaida) return;
  const embed = new EmbedBuilder()
    .setColor('#ffcc00')
    .setTitle('🚪 Membro saiu do servidor!')
    .setDescription(`👋 ${member.user.tag} saiu do servidor.`)
    .setThumbnail(member.user.displayAvatarURL())
    .setTimestamp();
  canalSaida.send({ embeds: [embed] });
});

// Formulário de Recrutamento
client.on(Events.InteractionCreate, async (interaction) => {
  if (interaction.isButton() && interaction.customId === 'abrir_formulario') {
    const modal = new ModalBuilder()
      .setCustomId('formulario_recrutamento')
      .setTitle('📋 Formulário de Recrutamento');

    const nick = new TextInputBuilder()
      .setCustomId('nick')
      .setLabel('Nick no jogo')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const idJogo = new TextInputBuilder()
      .setCustomId('id_jogo')
      .setLabel('ID no jogo')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const idRecrutador = new TextInputBuilder()
      .setCustomId('id_recrutador')
      .setLabel('ID do Recrutador')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const whatsapp = new TextInputBuilder()
      .setCustomId('whatsapp')
      .setLabel('WhatsApp (opcional)')
      .setStyle(TextInputStyle.Short)
      .setRequired(false);

    modal.addComponents(
      new ActionRowBuilder().addComponents(nick),
      new ActionRowBuilder().addComponents(idJogo),
      new ActionRowBuilder().addComponents(idRecrutador),
      new ActionRowBuilder().addComponents(whatsapp)
    );

    await interaction.showModal(modal);
  }

  if (interaction.isModalSubmit() && interaction.customId === 'formulario_recrutamento') {
    const nick = interaction.fields.getTextInputValue('nick');
    const idJogo = interaction.fields.getTextInputValue('id_jogo');
    const idRecrutador = interaction.fields.getTextInputValue('id_recrutador');
    const whatsapp = interaction.fields.getTextInputValue('whatsapp') || 'Não informado';

    const solicitacoes = interaction.guild.channels.cache.find(c => c.name === '📋・solicitações-mlc');
    if (!solicitacoes) {
      return interaction.reply({ content: '❌ Canal de solicitações não encontrado.', ephemeral: true });
    }

    const embed = new EmbedBuilder()
      .setColor('#ffcc00')
      .setTitle('📋 Nova Solicitação de Recrutamento')
      .setDescription(
        `👤 **Jogador:** ${interaction.user}\n🎮 **Nick:** ${nick}\n🆔 **ID Jogo:** ${idJogo}\n🤝 **ID Recrutador:** ${idRecrutador}\n📱 **WhatsApp:** ${whatsapp}\n🕓 **Data:** <t:${Math.floor(Date.now() / 1000)}:F>`
      );

    const aprovar = new ButtonBuilder()
      .setCustomId(`aprovar_${interaction.user.id}_${idJogo}_${nick}`)
      .setLabel('✅ Aprovar')
      .setStyle(ButtonStyle.Success);

    const negar = new ButtonBuilder()
      .setCustomId(`negar_${interaction.user.id}`)
      .setLabel('❌ Negar')
      .setStyle(ButtonStyle.Danger);

    await solicitacoes.send({
      content: `📢 Nova solicitação de recrutamento de ${interaction.user}`,
      embeds: [embed],
      components: [new ActionRowBuilder().addComponents(aprovar, negar)],
    });

    await interaction.reply({ content: '📬 Sua solicitação foi enviada para análise!', ephemeral: true });
  }

  if (interaction.isButton()) {
    const { customId } = interaction;

    if (customId.startsWith('aprovar_')) {
      const [_, userId, idJogo, nick] = customId.split('_');
      const member = await interaction.guild.members.fetch(userId).catch(() => null);
      if (!member) return interaction.reply({ content: '❌ Membro não encontrado.', ephemeral: true });

      if (!interaction.member.roles.cache.some(r => r.name === 'Superior' || r.name === 'Recrutador')) {
        return interaction.reply({ content: '🚫 Você não tem permissão para aprovar.', ephemeral: true });
      }

      const cargoMLC = interaction.guild.roles.cache.find(r => r.name === 'MLC');
      const canalRelatorio = interaction.guild.channels.cache.find(c => c.name === '📋・relatórios-de-rec');

      if (cargoMLC) await member.roles.add(cargoMLC).catch(() => {});
      await member.setNickname(`${nick} / ${idJogo}`).catch(() => {});

      if (canalRelatorio) {
        const embed = new EmbedBuilder()
          .setColor('#00ff88')
          .setTitle('✅ Recrutamento Aprovado')
          .setDescription(`👤 ${member} foi aprovado por ${interaction.user}\n🎮 Nick: **${nick}**\n🆔 ID: **${idJogo}**`);
        canalRelatorio.send({ embeds: [embed] });
      }

      await interaction.update({ content: `✅ ${member} foi aprovado!`, components: [] });
    }

    if (customId.startsWith('negar_')) {
      if (!interaction.member.roles.cache.some(r => r.name === 'Superior' || r.name === 'Recrutador')) {
        return interaction.reply({ content: '🚫 Você não tem permissão para negar.', ephemeral: true });
      }

      await interaction.update({ content: '❌ Recrutamento negado.', components: [] });
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
