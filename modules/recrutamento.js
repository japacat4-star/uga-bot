import { 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  Events 
} from 'discord.js';

export default function setupRecrutamento(client) {
  // Enviar botão de formulário quando o bot iniciar
  client.once(Events.ClientReady, async () => {
    const recrutamentoChannel = client.channels.cache.find(c => c.name === '📋・recrutamento');
    if (recrutamentoChannel) {
      await recrutamentoChannel.bulkDelete(10).catch(() => {});
      
      const embed = new EmbedBuilder()
        .setColor('#ffcc00')
        .setTitle('📋 Sistema de Recrutamento MLC')
        .setDescription('Clique no botão abaixo para preencher seu formulário e entrar para a **MLC**!');
      
      const button = new ButtonBuilder()
        .setCustomId('abrir_formulario')
        .setLabel('📄 Abrir Formulário')
        .setStyle(ButtonStyle.Primary);
      
      recrutamentoChannel.send({ 
        embeds: [embed], 
        components: [new ActionRowBuilder().addComponents(button)] 
      });
    }
  });

  // Abrir modal do formulário
  client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isButton() || interaction.customId !== 'abrir_formulario') return;

    const modal = new ModalBuilder()
      .setCustomId('form_recrutamento')
      .setTitle('📋 Formulário de Recrutamento');

    const nick = new TextInputBuilder()
      .setCustomId('nick')
      .setLabel('Seu nick no jogo')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const id = new TextInputBuilder()
      .setCustomId('id')
      .setLabel('Seu ID no jogo')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const recrutador = new TextInputBuilder()
      .setCustomId('recrutador')
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
      new ActionRowBuilder().addComponents(id),
      new ActionRowBuilder().addComponents(recrutador),
      new ActionRowBuilder().addComponents(whatsapp)
    );

    await interaction.showModal(modal);
  });

  // Processar formulário enviado
  client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isModalSubmit() || interaction.customId !== 'form_recrutamento') return;

    const nick = interaction.fields.getTextInputValue('nick');
    const id = interaction.fields.getTextInputValue('id');
    const recrutador = interaction.fields.getTextInputValue('recrutador');
    const whatsapp = interaction.fields.getTextInputValue('whatsapp') || 'Não informado';

    const canalSolic = interaction.guild.channels.cache.find(c => c.name === '📋・solicitações-mlc');
    if (!canalSolic) return interaction.reply({ content: '❌ Canal de solicitações não encontrado.', ephemeral: true });

    const embed = new EmbedBuilder()
      .setColor('#ffcc00')
      .setTitle('📋 Nova Solicitação de Recrutamento')
      .addFields(
        { name: '👤 Nick:', value: nick, inline: true },
        { name: '🆔 ID:', value: id, inline: true },
        { name: '🧭 Recrutador:', value: recrutador, inline: true },
        { name: '📞 WhatsApp:', value: whatsapp, inline: true },
        { name: '💬 Discord:', value: `${interaction.user}`, inline: false }
      )
      .setFooter({ text: 'Aguardando aprovação' })
      .setTimestamp();

    const aprovar = new ButtonBuilder()
      .setCustomId('aprovar')
      .setLabel('✅ Aprovar')
      .setStyle(ButtonStyle.Success);

    const negar = new ButtonBuilder()
      .setCustomId('negar')
      .setLabel('❌ Negar')
      .setStyle(ButtonStyle.Danger);

    await canalSolic.send({
      content: `<@&Superior> <@&Recrutador> nova solicitação enviada por ${interaction.user}`,
      embeds: [embed],
      components: [new ActionRowBuilder().addComponents(aprovar, negar)],
    });

    await interaction.reply({ content: '✅ Solicitação enviada com sucesso! Aguarde aprovação.', ephemeral: true });
  });

  // Botões de aprovação/negação
  client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isButton() || (interaction.customId !== 'aprovar' && interaction.customId !== 'negar')) return;

    if (!interaction.member.roles.cache.some(r => ['Superior', 'Recrutador'].includes(r.name))) {
      return interaction.reply({ content: '🚫 Você não tem permissão para usar isso.', ephemeral: true });
    }

    const embed = EmbedBuilder.from(interaction.message.embeds[0]);
    const userMention = embed.data.fields.find(f => f.name === '💬 Discord:').value;

    if (interaction.customId === 'aprovar') {
      const cargo = interaction.guild.roles.cache.find(r => r.name === 'MLC');
      const usuario = interaction.guild.members.cache.find(m => `<@${m.id}>` === userMention);

      if (cargo && usuario) {
        await usuario.roles.add(cargo).catch(() => {});
        const nick = embed.data.fields.find(f => f.name === '👤 Nick:').value;
        const id = embed.data.fields.find(f => f.name === '🆔 ID:').value;
        await usuario.setNickname(`${nick} / ${id}`).catch(() => {
          console.log('⚠️ Sem permissão para alterar nickname');
        });
      }

      const canalRelatorio = interaction.guild.channels.cache.find(c => c.name === '📋・relatórios-de-rec');
      if (canalRelatorio) {
        const relatorio = new EmbedBuilder()
          .setColor('#00ff88')
          .setTitle('✅ Recrutamento Aprovado')
          .setDescription(`Recrutado: ${userMention}\nAprovado por: ${interaction.user}`)
          .setTimestamp();
        canalRelatorio.send({ embeds: [relatorio] });
      }

      await interaction.update({ content: `✅ Solicitação aprovada por ${interaction.user}`, embeds: [], components: [] });
    } else {
      await interaction.update({ content: `❌ Solicitação negada por ${interaction.user}`, embeds: [], components: [] });
    }
  });

  console.log('✅ Módulo de Recrutamento carregado');
}
