import { EmbedBuilder, Events } from 'discord.js';

export default function setupLogs(client) {
  // Log de entrada
  client.on(Events.GuildMemberAdd, async (member) => {
    const canal = member.guild.channels.cache.find(c => c.name === 'logs-entrada');
    if (!canal) return;
    
    const embed = new EmbedBuilder()
      .setColor('#ffcc00')
      .setTitle('🚪 Novo membro entrou!')
      .setDescription(`👤 ${member.user.tag} entrou no servidor!`)
      .setThumbnail(member.user.displayAvatarURL())
      .setTimestamp();
    
    canal.send({ embeds: [embed] });
  });

  // Log de saída
  client.on(Events.GuildMemberRemove, async (member) => {
    const canal = member.guild.channels.cache.find(c => c.name === 'logs-saida');
    if (!canal) return;
    
    const embed = new EmbedBuilder()
      .setColor('#ffcc00')
      .setTitle('🚪 Membro saiu!')
      .setDescription(`👋 ${member.user.tag} saiu do servidor.`)
      .setThumbnail(member.user.displayAvatarURL())
      .setTimestamp();
    
    canal.send({ embeds: [embed] });
  });

  console.log('✅ Módulo de Logs carregado');
}
