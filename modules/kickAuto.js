import { EmbedBuilder, Events } from 'discord.js';

const activity = new Map();

export function registerActivity(userId) {
  activity.set(userId, Date.now());
}

export default function setupKickAuto(client) {
  // Verificar inatividade a cada 24 horas
  client.once(Events.ClientReady, () => {
    setInterval(() => {
      const agora = Date.now();
      const dias14 = 14 * 24 * 60 * 60 * 1000; // 14 dias em milissegundos

      client.guilds.cache.forEach(guild => {
        guild.members.cache.forEach(member => {
          if (member.user.bot) return;
          
          const last = activity.get(member.id);
          
          // Se não tem atividade registrada ou está inativo há mais de 14 dias
          if (!last || agora - last > dias14) {
            const canalSaida = guild.channels.cache.find(c => c.name === 'logs-saida');
            
            if (canalSaida) {
              const embed = new EmbedBuilder()
                .setColor('Red')
                .setTitle('⚠️ Kick Automático por Inatividade')
                .setDescription(`${member.user.tag} foi removido por inatividade (+14 dias sem atividade registrada).`)
                .setTimestamp();
              
              canalSaida.send({ embeds: [embed] });
            }
            
            member.kick('Inatividade +14 dias').catch(() => {
              console.log(`⚠️ Não foi possível remover ${member.user.tag} por falta de permissão.`);
            });
          }
        });
      });
    }, 24 * 60 * 60 * 1000); // Executa a cada 24 horas
    
    console.log('✅ Sistema de Kick Automático ativado (verifica a cada 24h)');
  });

  console.log('✅ Módulo de Kick Automático carregado');
}
