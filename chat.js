// chat.js - LIVEZILLA 2.0 FINAL - Equality Corretora

const chatBody = document.getElementById("chat-body");
const chatContainer = document.getElementById("chat-container");
const chatWrapper = document.querySelector(".chat-wrapper");
const chatToggle = document.querySelector(".chat-toggle");
const userInput = document.getElementById("user-input");

// Configurações
const BACKEND_URL = "https://backend-api-app.arj8vq.easypanel.host";
const WEBHOOK_URL = "https://n8n.equalitycorretora.com/webhook/01ec4b3a-1a4b-4b4e-9cc0-37e7b5e950a6/chat";
const BOT_AVATAR = "https://equalitycorretora.com.br/wp-content/uploads/2026/02/anne-final.png";
const WELCOME_AVATAR = "https://equalitycorretora.com.br/wp-content/uploads/2026/02/ane-joinha.png";

let isFirstOpen = true;
let isSending = false;

// ===== MENU PRINCIPAL =====
const MENU_OPTIONS = [
    { icon: "📋", text: "Cotação de Plano de Saúde" },
    { icon: "🦷", text: "Cotação de Plano Dental" },
    { icon: "👤", text: "Já sou cliente e preciso de ajuda" },
    { icon: "📞", text: "Canais de Atendimento" },
    { icon: "💼", text: "Quero ser vendedor(a) parceiro" },
    { icon: "📍", text: "Nosso endereço" },
    { icon: "❓", text: "Dúvidas sobre operadoras" },
    { icon: "💬", text: "Falar com atendente agora" }
];

// ===== SESSION ID =====
function getSessionId() {
    let id = sessionStorage.getItem("aneSessionId");
    if (!id) {
        id = "ane_" + Date.now() + "_" + Math.random().toString(36).substr(2, 6);
        sessionStorage.setItem("aneSessionId", id);
    }
    return id;
}

// ===== TRACKING =====
async function sendTrackEvent(event, data = {}) {
    try {
        await fetch(`${BACKEND_URL}/track`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                event: event,
                session_id: getSessionId(),
                data: data
            })
        });
    } catch (e) {
        console.error("Erro no tracking:", e);
    }
}

// ===== TOGGLE CHAT =====
function toggleChat() {
    const isOpen = chatContainer.style.display === "flex";
    
    if (isOpen) {
        chatContainer.style.display = "none";
        if (chatWrapper) chatWrapper.style.display = "flex";
    } else {
        chatContainer.style.display = "flex";
        if (chatWrapper) chatWrapper.style.display = "none";
        
        if (isFirstOpen) {
            isFirstOpen = false;
            sendTrackEvent("chat_opened");
            setTimeout(showWelcome, 300);
        }
        
        setTimeout(() => {
            if (userInput) userInput.focus();
        }, 300);
    }
}

function maximizeChat() {
    if (chatContainer) {
        chatContainer.classList.toggle("maximized");
    }
}

// ===== HORÁRIO =====
function getTime() {
    return new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

// ===== MENSAGEM DE BOAS-VINDAS =====
function showWelcome() {
    if (!chatBody) return;

    const welcome = document.createElement("div");
    welcome.className = "welcome-section";

    const avatar = document.createElement("img");
    avatar.src = WELCOME_AVATAR;
    avatar.className = "welcome-avatar";
    avatar.alt = "Ane";

    const text = document.createElement("div");
    text.className = "welcome-text";
    text.innerHTML = "Olá! 😊 Eu sou a <strong>Ane</strong>, assistente virtual da <strong>Equality Corretora</strong>. Como posso te ajudar hoje?";

    welcome.appendChild(avatar);
    welcome.appendChild(text);
    chatBody.appendChild(welcome);

    setTimeout(() => {
        showMenuButtons();
        scrollToBottom();
    }, 400);
}

// ===== MENU DE BOTÕES =====
function showMenuButtons() {
    if (!chatBody) return;

    const container = document.createElement("div");
    container.className = "quick-buttons";
    container.id = "menu-buttons-container";

    MENU_OPTIONS.forEach(option => {
        const btn = document.createElement("button");
        btn.className = "quick-btn";

        const icon = document.createElement("span");
        icon.className = "quick-btn-icon";
        icon.textContent = option.icon;

        const label = document.createElement("span");
        label.textContent = option.text;

        btn.appendChild(icon);
        btn.appendChild(label);

        btn.onclick = function () {
            addUserMessage(option.text);
            sendToBot(option.text);
        };

        container.appendChild(btn);
    });

    chatBody.appendChild(container);
    scrollToBottom();
}

// ===== MENSAGEM DO USUÁRIO =====
function addUserMessage(text) {
    if (!chatBody) return;

    const msg = document.createElement("div");
    msg.className = "message message-user";

    const content = document.createElement("div");
    content.className = "message-content";
    content.innerText = text;

    const time = document.createElement("div");
    time.className = "message-time";
    time.textContent = getTime();
    content.appendChild(time);

    msg.appendChild(content);
    chatBody.appendChild(msg);
    scrollToBottom();
}

// ===== MENSAGEM DO BOT =====
function addBotMessage(text) {
    removeTyping();

    const msg = document.createElement("div");
    msg.className = "message message-bot";

    const avatar = document.createElement("img");
    avatar.src = BOT_AVATAR;
    avatar.className = "bot-avatar";
    avatar.alt = "Ane";

    const content = document.createElement("div");
    content.className = "message-content";

    let cleanText = text.replace(/^\"+|\"+$/g, "").trim();
    cleanText = cleanText
        .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" style="color: #128c7e; text-decoration: none;">$1</a>')
        .replace(/\n/g, "<br>");

    content.innerHTML = cleanText;

    const time = document.createElement("div");
    time.className = "message-time";
    time.textContent = getTime();
    content.appendChild(time);

    msg.appendChild(avatar);
    msg.appendChild(content);
    chatBody.appendChild(msg);

    parseDynamicButtons(cleanText);
    scrollToBottom();
}

// ===== BOTÕES DINÂMICOS =====
function parseDynamicButtons(text) {
    if (!chatBody) return;

    const btnRegex = /\[([^\\]]+)\]/g;
    const matches = [];
    let match;
    while ((match = btnRegex.exec(text)) !== null) {
        const btnText = match[1].trim();
        if (!btnText.startsWith("http") && !btnText.startsWith("www")) {
            matches.push(btnText);
        }
    }

    if (matches.length > 0) {
        const container = document.createElement("div");
        container.className = "quick-buttons";

        matches.forEach(option => {
            const btn = document.createElement("button");
            btn.className = "quick-btn";
            btn.textContent = option;
            btn.onclick = function () {
                addUserMessage(option);
                sendToBot(option);
            };
            container.appendChild(btn);
        });

        chatBody.appendChild(container);
        scrollToBottom();
    }
}

// ===== UTILS =====
function scrollToBottom() {
    if (chatBody) {
        setTimeout(() => {
            chatBody.scrollTop = chatBody.scrollHeight;
        }, 50);
    }
}

function showTyping() {
    if (!chatBody) return;
    if (document.getElementById("typing-indicator")) return;

    const msg = document.createElement("div");
    msg.className = "message message-bot";
    msg.id = "typing-indicator";

    const avatar = document.createElement("img");
    avatar.src = BOT_AVATAR;
    avatar.className = "bot-avatar";

    const content = document.createElement("div");
    content.className = "message-content";
    content.innerHTML = '<div class="typing-dots"><span></span><span></span><span></span></div>';

    msg.appendChild(avatar);
    msg.appendChild(content);
    chatBody.appendChild(msg);
    scrollToBottom();
}

function removeTyping() {
    const typing = document.getElementById("typing-indicator");
    if (typing) typing.remove();
}

function handleResponse(text) {
    const lines = text.split("\n").filter(Boolean);
    let botResponse = "";

    for (const line of lines) {
        try {
            const parsed = JSON.parse(line);
            if (parsed.type === "item" && parsed.content) {
                botResponse += parsed.content;
            }
        } catch (e) {
            if (!line.startsWith("{")) {
                botResponse += line;
            }
        }
    }
    
    const finalResponse = botResponse || "Desculpe, tive um problema técnico.";
    addBotMessage(finalResponse);
    sendTrackEvent("message_received", { response: finalResponse });
}

// ===== ACTIONS =====
async function sendToBot(text) {
    if (isSending) return;
    isSending = true;

    sendTrackEvent("message_sent", { message: text });
    showTyping();

    try {
        const res = await fetch(WEBHOOK_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                sessionId: getSessionId(),
                chatInput: text
            })
        });
        const data = await res.text();
        handleResponse(data);
    } catch (err) {
        removeTyping();
        addBotMessage("⚠️ Erro ao conectar com a Anne. Tente novamente.");
        console.error(err);
    } finally {
        isSending = false;
    }
}

function sendMessage() {
    const message = userInput.value.trim();
    if (!message || isSending) return;

    addUserMessage(message);
    userInput.value = "";
    sendToBot(message);
}

// ===== EVENT LISTENERS =====
if (chatToggle) chatToggle.addEventListener("click", toggleChat);
if (userInput) {
    userInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter") sendMessage();
    });
}

// Auto-open
(function autoOpen() {
    if (!sessionStorage.getItem("aneAutoOpened")) {
        setTimeout(() => {
            if (chatContainer && chatContainer.style.display !== "flex") {
                toggleChat();
                sessionStorage.setItem("aneAutoOpened", "1");
            }
        }, 8000);
    }
})();
