import 'dotenv/config';
import {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
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

const eventosAtivos = new Map();
const pontosAtivos = new Map();

// Função para formatar milissegundos em "1h 43min"
function formatarTempo(ms) {
  const totalMin = Math.floor(ms / 60000);
  const horas = Math.floor(totalMin / 60);
  const minutos = totalMin % 60;
  if (horas > 0) return `${horas}h ${minutos}min`;
  return `${minutos}min`;
}

// ✅ Quando o bot inicia
client.once(Events.ClientReady, async () => {
  console.log(`🤖 Bot conectado como ${client.user.tag}!`);

  // 📋 Recrutamento
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

  // 📖 Eventos
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
    criarEventoChannel.send({ embeds: [embed], components: [new ActionRowBuilder().addComponents(button)] });
  }

  // 🔥 Bate-Ponto
  const canalPonto = client.channels.cache.find(c => c.name === '🔥・bate-ponto');
  if (canalPonto) {
    const embed = new EmbedBuilder()
      .setColor('#ffcc00')
      .setTitle('🔥 Sistema de Bate-Ponto MLC')
      .setDescription('Clique nos botões abaixo para **iniciar, pausar ou encerrar** seu ponto.\n\nSomente membros com cargo `MLC` podem usar.')
      .setFooter({ text: 'MLC • Sistema de ponto automático' });

    const botoes = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('ponto_iniciar')
        .setLabel('🟢 Iniciar Ponto')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('ponto_pausar')
        .setLabel('⏸️ Pausar')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('ponto_encerrar')
        .setLabel('🔴 Encerrar')
        .setStyle(ButtonStyle.Danger)
    );

    await canalPonto.send({ embeds: [embed], components: [botoes] });
    console.log('✅ Botões de bate-ponto enviados com sucesso.');
  }
});

// ✅ Logs de entrada/saída
client.on(Events.GuildMemberAdd, async (member) => {
  const canal = member.guild.channels.cache.find(c => c.name === 'logs-entrada');
  if (canal) {
    const embed = new EmbedBuilder()
      .setColor('#ffcc00')
      .setTitle('🚪 Novo membro entrou!')
      .setDescription(`👤 ${member.user.tag} entrou no servidor!`)
      .setThumbnail(member.user.displayAvatarURL())
      .setTimestamp();
    canal.send({ embeds: [embed] });
  }
});

client.on(Events.GuildMemberRemove, async (member) => {
  const canal = member.guild.channels.cache.find(c => c.name === 'logs-saida');
  if (canal) {
    const embed = new EmbedBuilder()
      .setColor('#ffcc00')
      .setTitle('🚪 Membro saiu!')
      .setDescription(`👋 ${member.user.tag} saiu do servidor.`)
      .setThumbnail(member.user.displayAvatarURL())
      .setTimestamp();
    canal.send({ embeds: [embed] });
  }
});

// ✅ Interações do bot
client.on(Events.InteractionCreate, async (interaction) => {
  // ======== 📋 SISTEMA DE RECRUTAMENTO ========
  if (interaction.isButton() && interaction.customId === 'abrir_formulario') {
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
  }

  // Quando o formulário é enviado
  if (interaction.isModalSubmit() && interaction.customId === 'form_recrutamento') {
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
  }

  // Botões de aprovação/negação
  if (interaction.isButton() && (interaction.customId === 'aprovar' || interaction.customId === 'negar')) {
    if (!interaction.member.roles.cache.some(r => ['Superior', 'Recrutador'].includes(r.name))) {
      return interaction.reply({ content: '🚫 Você não tem permissão para usar isso.', ephemeral: true });
    }

    const embed = EmbedBuilder.from(interaction.message.embeds[0]);
    const userMention = embed.data.fields.find(f => f.name === '💬 Discord:').value;

    if (interaction.customId === 'aprovar') {
      const cargo = interaction.guild.roles.cache.find(r => r.name === 'MLC');
      const usuario = interaction.guild.members.cache.find(m => `<@${m.id}>` === userMention);

      if (cargo && usuario) {
        await usuario.roles.add(cargo);
        const nick = embed.data.fields.find(f => f.name === '👤 Nick:').value;
        const id = embed.data.fields.find(f => f.name === '🆔 ID:').value;
        await usuario.setNickname(`${nick} / ${id}`);
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
  }

  // ======== 🎯 SISTEMA DE EVENTOS ========
  if (interaction.isButton() && interaction.customId === 'criar_evento') {
    if (!interaction.member.roles.cache.some(r => r.name === 'Superior')) {
      return interaction.reply({ content: '🚫 Apenas Superiores podem criar eventos.', ephemeral: true });
    }

    const modal = new ModalBuilder()
      .setCustomId('form_criar_evento')
      .setTitle('📝 Criar Novo Evento');

    const tipo = new TextInputBuilder().setCustomId('tipo').setLabel('Tipo de Ação').setStyle(TextInputStyle.Short).setRequired(true);
    const horario = new TextInputBuilder().setCustomId('horario').setLabel('Horário de Início').setStyle(TextInputStyle.Short).setRequired(true);
    const vagas = new TextInputBuilder().setCustomId('vagas').setLabel('Quantidade de vagas').setStyle(TextInputStyle.Short).setRequired(true);
    const desc = new TextInputBuilder().setCustomId('descricao').setLabel('Descrição do Evento').setStyle(TextInputStyle.Paragraph).setRequired(true);

    modal.addComponents(
      new ActionRowBuilder().addComponents(tipo),
      new ActionRowBuilder().addComponents(horario),
      new ActionRowBuilder().addComponents(vagas),
      new ActionRowBuilder().addComponents(desc)
    );

    await interaction.showModal(modal);
  }

  // Modal do evento
  if (interaction.isModalSubmit() && interaction.customId === 'form_criar_evento') {
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

    const entrar = new ButtonBuilder().setCustomId(`entrar_${Date.now()}`).setLabel('✅ Participar').setStyle(ButtonStyle.Primary);

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
  }

  // Participar de evento
  if (interaction.isButton() && interaction.customId.startsWith('entrar_')) {
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
  }

  // ======== 🔥 SISTEMA DE BATE-PONTO ========
  const membro = interaction.member;
  const agora = Date.now();

  // Iniciar ponto
  if (interaction.isButton() && interaction.customId === 'ponto_iniciar') {
    if (!membro.roles.cache.some(r => r.name === 'MLC')) {
      return interaction.reply({ content: '🚫 Você não tem permissão para usar o sistema de ponto.', ephemeral: true });
    }

    if (pontosAtivos.has(membro.id)) {
      return interaction.reply({ content: '⚠️ Você já tem um ponto ativo!', ephemeral: true });
    }

    const embed = new EmbedBuilder()
      .setColor('#ffcc00')
      .setTitle('📍 Ponto em andamento')
      .setDescription(`👤 Membro: ${membro}\n🕐 Início: <t:${Math.floor(agora / 1000)}:t>\n⏸️ Pausas: 0\n⏰ Tempo total: 0min`)
      .setFooter({ text: 'Clique nos botões para pausar ou encerrar.' });

    const botoes = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`pausar_${membro.id}`)
        .setLabel('⏸️ Pausar')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`encerrar_${membro.id}`)
        .setLabel('🔴 Encerrar')
        .setStyle(ButtonStyle.Danger)
    );

    const msg = await interaction.reply({ embeds: [embed], components: [botoes], fetchReply: true });

    pontosAtivos.set(membro.id, {
      inicio: agora,
      pausas: 0,
      tempoPausado: 0,
      pausado: false,
      msgId: msg.id,
      canalId: msg.channelId,
    });
  }

  // Pausar ponto
  if (interaction.isButton() && interaction.customId.startsWith('pausar_')) {
    const id = interaction.customId.split('_')[1];
    if (membro.id !== id) {
      return interaction.reply({ content: '🚫 Esse ponto não é seu!', ephemeral: true });
    }

    const ponto = pontosAtivos.get(id);
    if (!ponto) {
      return interaction.reply({ content: '⚠️ Nenhum ponto ativo encontrado.', ephemeral: true });
    }

    if (!ponto.pausado) {
      ponto.pausado = true;
      ponto.pausaInicio = agora;
      ponto.pausas += 1;
      interaction.update({
        embeds: [
          new EmbedBuilder()
            .setColor('Orange')
            .setTitle('⏸️ Ponto pausado')
            .setDescription(`👤 Membro: ${membro}\n🕐 Início: <t:${Math.floor(ponto.inicio / 1000)}:t>\n⏸️ Pausas: ${ponto.pausas}\n🕓 Tempo pausado: ${formatarTempo(ponto.tempoPausado)}`)
        ],
      });
    } else {
      const tempoPausa = agora - ponto.pausaInicio;
      ponto.pausado = false;
      ponto.tempoPausado += tempoPausa;
      interaction.update({
        embeds: [
          new EmbedBuilder()
            .setColor('#ffcc00')
            .setTitle('📍 Ponto retomado')
            .setDescription(`👤 Membro: ${membro}\n🕐 Início: <t:${Math.floor(ponto.inicio / 1000)}:t>\n⏸️ Pausas: ${ponto.pausas}\n🕓 Tempo pausado: ${formatarTempo(ponto.tempoPausado)}`)
        ],
      });
    }
  }

  // Encerrar ponto
  if (interaction.isButton() && interaction.customId.startsWith('encerrar_')) {
    const id = interaction.customId.split('_')[1];
    if (membro.id !== id) {
      return interaction.reply({ content: '🚫 Esse ponto não é seu!', ephemeral: true });
    }

    const ponto = pontosAtivos.get(id);
    if (!ponto) {
      return interaction.reply({ content: '⚠️ Nenhum ponto ativo encontrado.', ephemeral: true });
    }

    const tempoTotal = agora - ponto.inicio - ponto.tempoPausado;
    const embed = new EmbedBuilder()
      .setColor('#ffcc00')
      .setTitle('✅ Ponto encerrado')
      .setDescription(`👤 Membro: ${membro}\n🕐 Início: <t:${Math.floor(ponto.inicio / 1000)}:t>\n⏸️ Pausas: ${ponto.pausas} vezes (${formatarTempo(ponto.tempoPausado)} total)\n⏰ Tempo total de serviço: ${formatarTempo(tempoTotal)}\n📅 Data: <t:${Math.floor(agora / 1000)}:d>`);

    interaction.update({ embeds: [embed], components: [] });
    pontosAtivos.delete(id);
  }
});

client.login(process.env.DISCORD_TOKEN);
