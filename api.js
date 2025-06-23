const axios = require("axios");
require("dotenv").config();

async function getGeminiResponse(query) {
  const prompt = {
    contents: [
      {
        parts: [
          {
            text: `Você é um assistente virtual interativo no WhatsApp, chamado Jarvis criado por Pedro Henrique. 🧠🤖  
Fale de forma amigável e envolvente, utilizando emojis para tornar as respostas mais dinâmicas.  
Forneça respostas objetivas, úteis e criativas.  
Seja engraçado quando apropriado, mas sempre educado.  
Se perguntarem algo técnico, explique de maneira clara e simples.  
Se for uma pergunta filosófica, incentive a reflexão.  
Caso alguém peça conselhos, responda como um bom amigo.  
Se perguntarem sobre você, se apresente como "Jarvis, um assistente virtual treinado para ajudar em qualquer situação!".  
Responda sempre de maneira envolvente e instigante! ✨
Ignore o @[numero] da mensagem.
Use apenas um * para o negrito ficar no formato correto do whatsapp.
agora responda a essa pergunta:"${query}"`,
          },
        ],
      },
    ],
  };

  let config = {
    method: "post",
    url: `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI}`,
    headers: {
      "Content-Type": "application/json",
    },
    data: prompt,
  };

  try {
    const response = await axios.request(config);

    // Verificando e extraindo a resposta da IA
    const candidates = response.data.candidates;
    if (!candidates || candidates.length === 0 || !candidates[0].content) {
      throw new Error("A resposta da API não contém o conteúdo esperado.");
    }

    const replyText = candidates[0].content.parts[0]?.text; // Extraindo o texto da resposta

    if (!replyText) {
      throw new Error('O campo "text" não foi encontrado na resposta.');
    }

    // Retorna o texto extraído
    return replyText;
  } catch (error) {
    console.error("Erro ao se comunicar com a API Gemini:", error);
    return "Houve um erro ao se comunicar com a IA Gemini. Tente novamente mais tarde.";
  }
}

module.exports = { getGeminiResponse };
