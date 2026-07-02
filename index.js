const { Client, GatewayIntentBits, EmbedBuilder, ActivityType } = require('discord.js');
const express = require('express');

// =========================================================
// TOKEN DO DISCORD
// =========================================================
const TOKEN = process.env.DISCORD_TOKEN;

// ID do canal privado de logs do administrador
const CANAL_LOG_ID = '1519852269548474469';

// ---------------------------------------------------------
// Express — mantém o bot online (anti-sleep)
// ---------------------------------------------------------
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => res.send('Bot está online!'));
app.listen(PORT, () => console.log(`Servidor HTTP rodando na porta ${PORT}`));

// ---------------------------------------------------------
// Estado em memória
// ---------------------------------------------------------
const cupons = {};           // { 'VALE10': 10 }
const cuponsUsados = {};     // { 'VALE10': Set(['userId', ...]) }

// ---------------------------------------------------------
// Cliente do Discord
// ---------------------------------------------------------
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent,
  ],
});

// ---------------------------------------------------------
// Utilitário: envia log no canal privado do ADM
// ---------------------------------------------------------
async function enviarLog(guild, mensagem) {
  try {
    const canal = await guild.channels.fetch(CANAL_LOG_ID);
    if (canal) await canal.send(mensagem);
  } catch (err) {
    console.error('Erro ao enviar log para o canal ADM:', err);
  }
}

// ---------------------------------------------------------
// Evento: canal novo criado (detecção de ticket do Nori)
// ---------------------------------------------------------
client.on('channelCreate', async (canal) => {
  if (canal.type !== 0) return; // 0 = GUILD_TEXT

  try {
    await new Promise(resolve => setTimeout(resolve, 1500)); // aguarda o canal ficar pronto
    const embed = new EmbedBuilder()
      .setTitle('🍓 Bem-vindo(a) ao seu ticket!')
      .setDescription(
        'Olá! Seja bem-vindo(a) ao seu ticket. 🍓\n\n' +
        'Por favor, informe a quantidade de Robux que você deseja comprar.\n\n' +
        'Se você possui um cupom de desconto, você pode usá-lo digitando o comando:\n' +
        '`!usar-cupom NOMEDOCUPOM`\n\n' +
        '*(Lembrando que cada cupom só pode ser usado 1 vez por pessoa!)*'
      )
      .setColor('#FF69B4')
      .setFooter({ text: 'My Melody🍓' });

    await canal.send({ embeds: [embed] });
  } catch (err) {
    console.error('Erro ao enviar mensagem no novo canal:', err);
  }
});

// ---------------------------------------------------------
// Eventos e comandos
// ---------------------------------------------------------
client.once('clientReady', (c) => {
  console.log(`Bot conectado como ${c.user.tag}`);
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  // ---------------------------
  // Comando: !verificar
  // ---------------------------
  if (message.content === '!verificar') {
    const cargo = message.guild.roles.cache.get('1519852268382584894');

    if (!cargo) {
      return message.reply('❌ Cargo **[🎭] Membro** não encontrado. Verifique se o bot está no servidor correto.');
    }
    if (message.member.roles.cache.has(cargo.id)) {
      return message.reply('✅ Você já possui o cargo **[🎭] Membro**!');
    }

    try {
      await message.member.roles.add(cargo);
      const embed = new EmbedBuilder()
        .setTitle('✅ Verificação concluída!')
        .setDescription('Bem-vindo(a)! O cargo **[🎭] Membro** foi entregue com sucesso.')
        .setColor('#FF69B4')
        .setFooter({ text: 'My Melody🍓' });
      return message.reply({ embeds: [embed] });
    } catch (err) {
      console.error('Erro ao adicionar cargo:', err);
      return message.reply('❌ Não consegui adicionar o cargo. Verifique as permissões do bot.');
    }
  }

  // ---------------------------
  // Comando: !clear
  // ---------------------------
  if (message.content.startsWith('!clear')) {
    if (!message.member.permissions.has('Administrator')) {
      return message.reply('❌ Apenas **Administradores** podem usar este comando.');
    }

    const args = message.content.split(' ');
    const quantidade = parseInt(args[1]) || 100;

    if (quantidade < 1 || quantidade > 100) {
      return message.reply('❌ Digite um número entre 1 e 100. Exemplo: `!clear 50`');
    }

    try {
      await message.channel.bulkDelete(quantidade, true);
      const aviso = await message.channel.send(`🗑️ **${quantidade} mensagens** apagadas com sucesso!`);
      setTimeout(() => aviso.delete().catch(() => {}), 4000);
    } catch (err) {
      console.error('Erro ao apagar mensagens:', err);
      await message.reply('❌ Não consegui apagar as mensagens. O bot precisa da permissão **Gerenciar Mensagens**.');
    }
    return;
  }

  // ---------------------------
  // Comando: !loja
  // ---------------------------
  if (message.content.startsWith('!loja')) {
    if (!message.member.permissions.has('Administrator')) return;

    const args = message.content.split(' ');
    const status = args[1]?.toLowerCase();

    if (status === 'aberta') {
      client.user.setActivity('Loja Aberta! 🟢', { type: ActivityType.Custom });
      const embed = new EmbedBuilder()
        .setTitle('🟢 Loja Aberta!')
        .setDescription('O status foi atualizado para **Loja Aberta! 🟢**')
        .setColor('#00FF7F')
        .setFooter({ text: 'My Melody🍓' });
      return message.reply({ embeds: [embed] });
    }

    if (status === 'fechada') {
      client.user.setActivity('Loja Fechada 🔴', { type: ActivityType.Custom });
      const embed = new EmbedBuilder()
        .setTitle('🔴 Loja Fechada!')
        .setDescription('O status foi atualizado para **Loja Fechada 🔴**')
        .setColor('#FF4444')
        .setFooter({ text: 'My Melody🍓' });
      return message.reply({ embeds: [embed] });
    }

    return message.reply('❌ Use: `!loja aberta` ou `!loja fechada`');
  }

  // ---------------------------
  // Comando: !criar-cupom
  // ---------------------------
  if (message.content.startsWith('!criar-cupom')) {
    if (!message.member.permissions.has('Administrator')) {
      return message.reply('❌ Apenas **Administradores** podem criar cupons.');
    }

    const args = message.content.split(' ');
    const nomeCupom = args[1]?.toUpperCase();
    const desconto = parseFloat(args[2]);

    if (!nomeCupom || isNaN(desconto) || desconto <= 0 || desconto >= 100) {
      return message.reply('❌ Uso correto: `!criar-cupom NOME PORCENTAGEM`\nExemplo: `!criar-cupom VALE10 10`');
    }

    cupons[nomeCupom] = desconto;
    cuponsUsados[nomeCupom] = cuponsUsados[nomeCupom] || new Set();

    const embed = new EmbedBuilder()
      .setTitle('🎟️ Cupom criado!')
      .setDescription(`✅ Cupom **${nomeCupom}** criado com **${desconto}% de desconto**.`)
      .setColor('#FF69B4')
      .setFooter({ text: 'My Melody🍓' });
    return message.reply({ embeds: [embed] });
  }

  // ---------------------------
  // Comando: !remover-cupom
  // ---------------------------
  if (message.content.startsWith('!remover-cupom')) {
    if (!message.member.permissions.has('Administrator')) {
      return message.reply('❌ Apenas **Administradores** podem remover cupons.');
    }

    const args = message.content.split(' ');
    const nomeCupom = args[1]?.toUpperCase();

    if (!nomeCupom) {
      return message.reply('❌ Use: `!remover-cupom NOME`\nExemplo: `!remover-cupom VALE10`');
    }

    if (cupons[nomeCupom] === undefined) {
      return message.reply(`❌ Cupom **${nomeCupom}** não existe.`);
    }

    delete cupons[nomeCupom];
    delete cuponsUsados[nomeCupom];

    const embed = new EmbedBuilder()
      .setTitle('🗑️ Cupom removido!')
      .setDescription(`✅ Cupom **${nomeCupom}** foi removido com sucesso.`)
      .setColor('#FF4444')
      .setFooter({ text: 'My Melody🍓' });
    return message.reply({ embeds: [embed] });
  }

  // ---------------------------
  // Comando: !lista-cupons
  // ---------------------------
  if (message.content === '!lista-cupons') {
    if (!message.member.permissions.has('Administrator')) {
      return message.reply('❌ Apenas **Administradores** podem ver a lista de cupons.');
    }

    const nomes = Object.keys(cupons);

    if (nomes.length === 0) {
      return message.reply('📭 Não há cupons ativos no momento.');
    }

    const lista = nomes.map(nome => `🎟️ **${nome}** — ${cupons[nome]}% de desconto`).join('\n');

    const embed = new EmbedBuilder()
      .setTitle('📋 Cupons ativos')
      .setDescription(lista)
      .setColor('#FF69B4')
      .setFooter({ text: `${nomes.length} cupom(s) ativo(s) • My Melody🍓` });

    return message.reply({ embeds: [embed] });
  }

  // ---------------------------
  // Comando: !calcular
  // ---------------------------
  if (message.content.startsWith('!calcular')) {
    const args = message.content.split(' ');
    const robuxDesejado = parseFloat(args[1]);

    if (!robuxDesejado || isNaN(robuxDesejado)) {
      return message.reply('❌ Por favor, digite a quantidade de Robux. Exemplo: `!calcular 100`');
    }

    const gamePass = Math.ceil(robuxDesejado / 0.7);
    const valorReais = ((robuxDesejado * 0.044) + 2.00).toFixed(2);

    const embed = new EmbedBuilder()
      .setTitle('💸 Calculadora de Robux')
      .setDescription(
        `🎮 **Robux desejado:** \`${robuxDesejado}\`\n\n` +
        `🛒 **Game Pass:** \`${gamePass} Robux\`\n\n` +
        `💵 **Valor:** \`R$ ${valorReais}\``
      )
      .setColor('#FF69B4')
      .setFooter({ text: 'My Melody🍓' });

    return message.reply({ embeds: [embed] });
  }

  // ---------------------------
  // Comando: !usar-cupom
  // ---------------------------
  if (message.content.startsWith('!usar-cupom')) {
    const args = message.content.split(' ');
    const nomeCupom = args[1]?.toUpperCase();

    if (!nomeCupom) {
      return message.reply('❌ Use: `!usar-cupom NOME`\nExemplo: `!usar-cupom VALE10`');
    }

    if (cupons[nomeCupom] === undefined) {
      return message.reply(`❌ Cupom **${nomeCupom}** não existe. Verifique o nome e tente novamente.`);
    }

    if (cuponsUsados[nomeCupom]?.has(message.author.id)) {
      return message.reply(`❌ Você já usou o cupom **${nomeCupom}** antes e não pode usá-lo novamente.`);
    }

    // Tenta extrair a quantidade de Robux do histórico do canal
    let robux = null;
    try {
      const msgs = await message.channel.messages.fetch({ limit: 50 });
      for (const msg of msgs.values()) {
        if (msg.author.id === message.author.id && msg.id !== message.id) {
          const match = msg.content.match(/\b(\d+(\.\d+)?)\b/);
          if (match) {
            robux = parseFloat(match[1]);
            break;
          }
        }
      }
    } catch (err) {
      console.error('Erro ao buscar histórico:', err);
    }

    if (!robux || isNaN(robux) || robux <= 0) {
      return message.reply('❌ Não encontrei a quantidade de Robux no chat. Por favor, informe a quantidade de Robux antes de usar o cupom.');
    }

    const percentual = cupons[nomeCupom];
    const valorBase = (robux * 0.044) + 2.00;
    const desconto = valorBase * (percentual / 100);
    const valorFinal = (valorBase - desconto).toFixed(2);
    const gamePass = Math.ceil(robux / 0.7);

    cuponsUsados[nomeCupom].add(message.author.id);

    const embed = new EmbedBuilder()
      .setTitle('✅ Cupom aplicado com sucesso!')
      .setDescription(
        `🎮 **Robux:** \`${robux}\`\n` +
        `🛒 **Game Pass:** \`${gamePass} Robux\`\n` +
        `🎟️ **Cupom:** \`${nomeCupom}\` (-${percentual}% = R$ -${desconto.toFixed(2)})\n` +
        `💵 **Valor final:** \`R$ ${valorFinal}\`\n\n` +
        `Um administrador irá atendê-lo em breve! 🍓`
      )
      .setColor('#FF69B4')
      .setFooter({ text: 'My Melody🍓' });

    await message.reply({ embeds: [embed] });

    // Log no canal privado do ADM
    await enviarLog(
      message.guild,
      `🛒 **Novo Pedido:** O usuário **${message.author.tag}** (<@${message.author.id}>) no ticket <#${message.channel.id}> utilizou o cupom **${nomeCupom}** *(${percentual}% de desconto)* — Preço final: **R$ ${valorFinal}** para **${robux} Robux**.`
    );

    return;
  }
});

// ---------------------------------------------------------
// Login
// ---------------------------------------------------------
if (!TOKEN) {
  console.error('ERRO: DISCORD_TOKEN não definido. Adicione o secret no Replit.');
  process.exit(1);
}

client.login(TOKEN);
