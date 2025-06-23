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
    browser: ["Safari", "CaquinhoDev", ""],
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

  const isMentioned =
    msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.includes(
      botNumber
    );

  const isReplyToBot =
    msg.message?.extendedTextMessage?.contextInfo?.quotedMessage &&
    msg.message.extendedTextMessage.contextInfo.participant === botNumber;

  if (isGroup && !isMentioned && !isReplyToBot) return;

  const quotedMessage =
    msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;

  let quotedText = "";
  if (quotedMessage) {
    quotedText =
      quotedMessage.conversation ||
      quotedMessage.extendedTextMessage?.text ||
      quotedMessage?.text ||
      "";
  }

  if (text || quotedText) {
    await digitarMensagem(msg, sock);

    try {
      let promptFinal = "";

      if (quotedText && text) {
        promptFinal = `Mensagem original: "${quotedText}"\n\nPedido do usuário: "${text}"`;
      } else if (quotedText) {
        promptFinal = quotedText;
      } else {
        promptFinal = text;
      }

      const response = await getGeminiResponse(promptFinal);

      await sock.sendMessage(
        from,
        {
          text: response,
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
