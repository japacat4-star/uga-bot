import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Events,
} from 'discord.js';
import { registerActivity } from './kickAuto.js';

const pontosAtivos = new Map();

function formatarTempo(ms) {
  const totalMin = Math.floor(ms / 60000);
  const horas = Math.floor(totalMin / 60);
  const minutos = totalMin % 60;
  if (horas > 0) return `${horas}h ${minutos}min`;
  return `${minutos}min`;
}

export default function setupPonto(client) {
  // Enviar botões de ponto
  client.once(Events.ClientReady, async () => {
    const canalPonto = client.channels.cache.find(c => c.name === '🔥・bate-ponto');
    if (canalPonto) {
      await canalPonto.bulkDelete(10).catch(() => {});
      
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
      console.log('✅ Botões de bate-ponto enviados.');
    }
  });

  // Iniciar ponto
  client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isButton() || interaction.customId !== 'ponto_iniciar') return;

    const membro = interaction.member;
    const agora = Date.now();

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

    // Registrar atividade para sistema de kick automático
    registerActivity(membro.id);
  });

  // Pausar ponto
  client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isButton() || !interaction.customId.startsWith('pausar_')) return;

    const id = interaction.customId.split('_')[1];
    const membro = interaction.member;
    const agora = Date.now();

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
  });

  // Encerrar ponto
  client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isButton() || !interaction.customId.startsWith('encerrar_')) return;

    const id = interaction.customId.split('_')[1];
    const membro = interaction.member;
    const agora = Date.now();

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

    // Registrar atividade para sistema de kick automático
    registerActivity(membro.id);
  });

  console.log('✅ Módulo de Ponto carregado');
}
