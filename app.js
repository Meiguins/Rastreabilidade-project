// Lógica da Calculadora de Desconto — sem banco de dados ou armazenamento persistente.
const $ = (id) => document.getElementById(id);

const form = $("discount-form");
const hasBlock = $("has-block");
const blockFields = $("block-fields");
const result = $("result");
const emptyState = $("empty-state");
const errorMessage = $("error-message");
let reportText = "";

function readDate(id) {
  const value = $(id).value;
  return value ? new Date(value) : null;
}

function formatDate(date) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "medium"
  }).format(date);
}

function formatDuration(milliseconds) {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${days} dias, ${hours} horas, ${minutes} minutos e ${seconds} segundos`;
}

function showError(message) {
  errorMessage.textContent = message;
  errorMessage.classList.remove("hidden");
}

function clearError() {
  errorMessage.textContent = "";
  errorMessage.classList.add("hidden");
}

function renderResult({ disconnect, reconnect, block }) {
  const offlineMs = reconnect - disconnect;
  const wholeDays = Math.floor(offlineMs / 86400000);

  const discountDays = wholeDays + (offlineMs % 86400000 > 0 ? 1 : 0);

  $("discount-days").textContent = discountDays;
  $("offline-duration").textContent = formatDuration(offlineMs);
  $("disconnect-output").textContent = formatDate(disconnect);
  $("reconnect-output").textContent = formatDate(reconnect);

  $("block-output").classList.toggle("hidden", !block);
  if (block) {
    $("block-duration").textContent = formatDuration(block.end - block.start);
    $("block-dates").textContent =
      `Início: ${formatDate(block.start)} • Fim: ${formatDate(block.end)}`;
  }

  reportText =
    `RASTREABILIDADE\n` +
    `Queda: ${formatDate(disconnect)}\n` +
    `Retorno: ${formatDate(reconnect)}\n` +
    `Período sem conexão: ${formatDuration(offlineMs)}\n` +
    (block
      ? `Início do bloqueio financeiro: ${formatDate(block.start)}\n` +
        `Fim do bloqueio financeiro: ${formatDate(block.end)}\n` +
        `Período de bloqueio: ${formatDuration(block.end - block.start)}\n`
      : "") +
    `Conceder ${discountDays} DIAS DE DESCONTO AO CLIENTE.`;

  emptyState.classList.add("hidden");
  result.classList.remove("hidden");
}

hasBlock.addEventListener("change", () => {
  blockFields.classList.toggle("hidden", !hasBlock.checked);
  $("block-start").required = hasBlock.checked;
  $("block-end").required = hasBlock.checked;
});

form.addEventListener("submit", (event) => {
  event.preventDefault();
  clearError();

  const disconnect = readDate("disconnect");
  const reconnect = readDate("reconnect");

  if (!disconnect || !reconnect) {
    showError("Informe a data e hora da queda e do retorno.");
    return;
  }
  if (reconnect < disconnect) {
    showError("A data de retorno não pode ser anterior à data de desconexão.");
    return;
  }

  let block = null;
  if (hasBlock.checked) {
    const start = readDate("block-start");
    const end = readDate("block-end");

    if (!start || !end) {
      showError("Informe o início e o fim do bloqueio financeiro.");
      return;
    }
    if (end < start) {
      showError("O término do bloqueio não pode ser anterior ao início.");
      return;
    }
    block = { start, end };
  }

  renderResult({ disconnect, reconnect, block });
});

form.addEventListener("reset", () => {
  // O reset nativo atualiza os campos depois deste evento.
  window.setTimeout(() => {
    clearError();
    blockFields.classList.add("hidden");
    result.classList.add("hidden");
    emptyState.classList.remove("hidden");
    $("copy-status").textContent = "";
    reportText = "";
  }, 0);
});

$("copy-button").addEventListener("click", async () => {
  if (!reportText) return;
  try {
    await navigator.clipboard.writeText(reportText);
    $("copy-status").textContent = "Rastreabilidade copiada.";
  } catch {
    $("copy-status").textContent =
      "Não foi possível copiar automaticamente. Copie os dados exibidos manualmente.";
  }
});
