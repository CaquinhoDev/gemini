const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
} = require("@whiskeysockets/baileys");
const pino = require("pino");
const qrcode = require("qrcode-terminal");
const { getGeminiResponse } = require("./api");

async function startBot() {
  console.log("Iniciando o bot...");

  const { state, saveCreds } = await useMultiFileAuthState("auth_info");
  console.log("Estado de autenticação carregado");

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: false,
    logger: pino({ level: "silent" }),
    browser: ["CaquinhoDev", "Chrome (Linux)", "Safari"],
  });

  sock.ev.on("creds.update", saveCreds);
  sock.ev.on("connection.update", (update) =>
    handleConnectionUpdate(update, sock)
  );
  sock.ev.on("messages.upsert", async (m) => await handleMessage(m, sock));
}

function handleConnectionUpdate(update, sock) {
  const { connection, qr, lastDisconnect } = update;

  if (connection === "open") {
    console.log("Conexão aberta com sucesso!");
  }

  if (qr) {
    console.log("QR Code Recebido!");
    qrcode.generate(qr, { small: true });
  }

  if (connection === "close") {
    const shouldReconnect =
      lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
    if (shouldReconnect) {
      console.log("Reconectando...");
      startBot();
    } else {
      console.log("Bot foi desconectado permanentemente.");
    }
  }
}

async function digitarMensagem(mensagem, sock) {
  await sock.sendPresenceUpdate("composing", mensagem.key.remoteJid);
  await new Promise((resolve) =>
    setTimeout(resolve, Math.random() * (6000 - 3000) + 3000)
  );
  await sock.sendPresenceUpdate("paused", mensagem.key.remoteJid);
}

async function handleMessage({ messages }, sock) {
  const msg = messages[0];
  if (!msg.message || msg.key.fromMe) return;

  const from = msg.key.remoteJid;
  const botNumber = sock.user.id.split(":")[0] + "@s.whatsapp.net";
  const isGroup = from.endsWith("@g.us");

  const text =
    msg.message.conversation || msg.message.extendedTextMessage?.text;

  // Verifica se a mensagem é do grupo e se o bot foi mencionado
  const isMentioned =
    msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.includes(
      botNumber
    );

  // Verifica se o usuário respondeu a uma mensagem do bot
  const isReplyToBot =
    msg.message?.extendedTextMessage?.contextInfo?.quotedMessage &&
    msg.message.extendedTextMessage.contextInfo.participant === botNumber;

  // Se for grupo e o bot não for mencionado nem respondido, ignora a mensagem
  if (isGroup && !isMentioned && !isReplyToBot) return;

  if (text) {
    await digitarMensagem(msg, sock);
    try {
      const response = await getGeminiResponse(text);
      // Resposta sem marcar ninguém
      await sock.sendMessage(
        from,
        {
          text: response, // Resposta simples
        },
        { quoted: msg }
      );
    } catch (error) {
      console.error("[ERRO] Falha ao obter resposta da IA:", error.message);
      await sock.sendMessage(from, {
        text: "❌ Ocorreu um erro ao processar sua mensagem.",
      });
    }
  }
}

startBot();
