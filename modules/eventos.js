import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  Events,
} from 'discord.js';

const eventosAtivos = new Map();

export default function setupEventos(client) {
  // Enviar botão de criar evento
  client.once(Events.ClientReady, async () => {
    const criarEventoChannel = client.channels.cache.find(c => c.name === '📖・criar-evento');
    if (criarEventoChannel) {
      const embed = new EmbedBuilder()
        .setColor('#ffcc00')
        .setTitle('🎯 Sistema de Eventos MLC')
        .setDescription('Apenas **Superiores** podem criar eventos. Clique abaixo para abrir o formulário de criação.');
      
      const button = new ButtonBuilder()
        .setCustomId('criar_evento')
        .setLabel('📝 Criar Evento')
        .setStyle(ButtonStyle.Success);
      
      criarEventoChannel.send({ 
        embeds: [embed], 
        components: [new ActionRowBuilder().addComponents(button)] 
      });
    }
  });

  // Abrir modal de criar evento
  client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isButton() || interaction.customId !== 'criar_evento') return;

    if (!interaction.member.roles.cache.some(r => r.name === 'Superior')) {
      return interaction.reply({ content: '🚫 Apenas Superiores podem criar eventos.', ephemeral: true });
    }

    const modal = new ModalBuilder()
      .setCustomId('form_criar_evento')
      .setTitle('📝 Criar Novo Evento');

    const tipo = new TextInputBuilder()
      .setCustomId('tipo')
      .setLabel('Tipo de Ação')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const horario = new TextInputBuilder()
      .setCustomId('horario')
      .setLabel('Horário de Início')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const vagas = new TextInputBuilder()
      .setCustomId('vagas')
      .setLabel('Quantidade de vagas')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const desc = new TextInputBuilder()
      .setCustomId('descricao')
      .setLabel('Descrição do Evento')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true);

    modal.addComponents(
      new ActionRowBuilder().addComponents(tipo),
      new ActionRowBuilder().addComponents(horario),
      new ActionRowBuilder().addComponents(vagas),
      new ActionRowBuilder().addComponents(desc)
    );

    await interaction.showModal(modal);
  });

  // Processar modal do evento
  client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isModalSubmit() || interaction.customId !== 'form_criar_evento') return;

    const tipo = interaction.fields.getTextInputValue('tipo');
    const horario = interaction.fields.getTextInputValue('horario');
    const vagas = parseInt(interaction.fields.getTextInputValue('vagas'));
    const descricao = interaction.fields.getTextInputValue('descricao');

    const canalEventos = interaction.guild.channels.cache.find(c => c.name === '📖・eventos-mlc');
    if (!canalEventos) return interaction.reply({ content: '❌ Canal de eventos não encontrado.', ephemeral: true });

    const embed = new EmbedBuilder()
      .setColor('#ffcc00')
      .setTitle(`📖 Novo Evento MLC`)
      .setDescription(`**Tipo:** ${tipo}\n**Horário:** ${horario}\n**Descrição:** ${descricao}\n**Vagas:** ${vagas}`)
      .addFields({ name: '👥 Participantes:', value: 'Nenhum ainda.' })
      .setFooter({ text: `Criado por ${interaction.user.tag}` })
      .setTimestamp();

    const entrar = new ButtonBuilder()
      .setCustomId(`entrar_${Date.now()}`)
      .setLabel('✅ Participar')
      .setStyle(ButtonStyle.Primary);

    const msg = await canalEventos.send({
      embeds: [embed],
      components: [new ActionRowBuilder().addComponents(entrar)],
    });

    eventosAtivos.set(msg.id, {
      criador: interaction.user.id,
      tipo,
      horario,
      vagas,
      descricao,
      participantes: [],
    });

    await interaction.reply({ content: '✅ Evento criado com sucesso em 📖・eventos-mlc!', ephemeral: true });
  });

  // Participar de evento
  client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isButton() || !interaction.customId.startsWith('entrar_')) return;

    const evento = eventosAtivos.get(interaction.message.id);
    if (!evento) return interaction.reply({ content: '❌ Evento não encontrado.', ephemeral: true });

    if (!interaction.member.roles.cache.some(r => r.name === 'MLC')) {
      return interaction.reply({ content: '🚫 Apenas membros MLC podem participar.', ephemeral: true });
    }

    const nick = interaction.member.displayName;
    if (evento.participantes.includes(nick)) {
      return interaction.reply({ content: '⚠️ Você já está inscrito.', ephemeral: true });
    }

    if (evento.participantes.length >= evento.vagas) {
      return interaction.reply({ content: '🚫 O evento já atingiu o limite de vagas.', ephemeral: true });
    }

    evento.participantes.push(nick);

    const embed = EmbedBuilder.from(interaction.message.embeds[0]);
    embed.spliceFields(0, 1, { name: '👥 Participantes:', value: evento.participantes.join('\n') });
    embed.setDescription(`**Tipo:** ${evento.tipo}\n**Horário:** ${evento.horario}\n**Descrição:** ${evento.descricao}\n**Vagas restantes:** ${evento.vagas - evento.participantes.length}`);

    await interaction.update({ embeds: [embed] });
  });

  console.log('✅ Módulo de Eventos carregado');
}
