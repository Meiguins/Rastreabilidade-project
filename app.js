pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

const fileInput = document.querySelector("#pdfFile"),
      startInput = document.querySelector("#startDate"),
      endInput = document.querySelector("#endDate"),
      button = document.querySelector("#calculateBtn"),
      statusEl = document.querySelector("#status"),
      rowsEl = document.querySelector("#outageRows"),
      copyBtn = document.querySelector("#copyResultBtn");

let lastOutagesData = [];

function updateButton() {
    button.disabled = !(fileInput.files.length && startInput.value && endInput.value);
}

[fileInput, startInput, endInput].forEach(e => e.addEventListener("change", updateButton));

button.addEventListener("click", async () => {
    try {
        statusEl.textContent = "Lendo PDF…";
        button.disabled = true;

        const pdf = await pdfjsLib.getDocument({ data: await fileInput.files[0].arrayBuffer() }).promise;
        let lines = [];

        for (let p = 1; p <= pdf.numPages; p++) {
            const page = await pdf.getPage(p),
                  content = await page.getTextContent();
            lines.push(...groupLines(content.items));
        }

        const sessions = extractSessions(lines);
        if (!sessions.length) throw Error("Não encontrei sessões com o padrão esperado neste relatório. Verifique se o arquivo está correto.");

        const from = parseCustomDate(startInput.value),
              to = parseCustomDate(endInput.value);
        
        if (!Number.isFinite(+from) || !Number.isFinite(+to) || to <= from) {
            throw Error("O fim do período deve ser posterior ao início.");
        }

        const outages = makeOutages(sessions, from, to);
        render(outages);
        statusEl.textContent = `Leitura concluída: ${sessions.length} sessões identificadas no total.`;

    } catch (e) {
        statusEl.textContent = e.message || "Erro ao ler PDF.";
        rowsEl.innerHTML = '<tr><td colspan="4">Não foi possível calcular. Confira o arquivo.</td></tr>';
    } finally {
        updateButton();
    }
});

function groupLines(items) {
    const a = items.filter(i => i.str && i.str.trim())
                   .map(i => ({ s: i.str.trim(), x: i.transform[4], y: i.transform[5] }))
                   .sort((a, b) => Math.abs(a.y - b.y) > 2 ? b.y - a.y : a.x - b.x),
          lines = [];

    for (const it of a) {
        let l = lines.find(v => Math.abs(v.y - it.y) <= 2.2);
        if (!l) {
            l = { y: it.y, a: [] };
            lines.push(l);
        }
        l.a.push(it);
    }
    return lines.map(l => l.a.sort((a, b) => a.x - b.x).map(i => i.s).join(" "));
}

const dateRe = /(\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}(?::\d{2})?)/g;

function parseCustomDate(str) {
    const parts = str.trim().split(" ");
    if (parts.length < 2) return new Date(NaN);
    const [dd, mm, yy] = parts[0].split("/").map(Number);
    const timeParts = parts[1].split(":").map(Number);
    const h = timeParts[0] || 0;
    const m = timeParts[1] || 0;
    const s = timeParts[2] || 0;
    return new Date(yy, mm - 1, dd, h, m, s);
}

function extractSessions(lines) {
    const out = [];
    const fullText = lines.join(" ");

    const sessionRegex = /(\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}:\d{2})\s+(\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}:\d{2})[\s\S]*?(Lost-Carrier|NAS-Request|User-Request|Admin-Reset)/gi;

    let match;
    while ((match = sessionRegex.exec(fullText)) !== null) {
        const start = parseCustomDate(match[1]);
        const end = parseCustomDate(match[2]);
        const reason = match[3];

        if (Number.isFinite(+start) && Number.isFinite(+end)) {
            out.push({ start, end, reason });
        }
    }

    if (!out.length) {
        for (const line of lines) {
            const matches = [...line.matchAll(dateRe)];
            if (matches.length >= 2) {
                const start = parseCustomDate(matches[0][1]);
                const end = parseCustomDate(matches[1][1]);
                let reason = "Desconhecido";
                if (/Lost-Carrier/i.test(line)) reason = "Lost-Carrier";
                else if (/NAS-Request/i.test(line)) reason = "NAS-Request";
                else if (/User-Request/i.test(line)) reason = "User-Request";
                else if (/Admin-Reset/i.test(line)) reason = "Admin-Reset";

                if (Number.isFinite(+start) && Number.isFinite(+end)) {
                    out.push({ start, end, reason });
                }
            }
        }
    }

    return out.sort((a, b) => a.start - b.start);
}

function makeOutages(sessions, from, to) {
    const out = [];
    for (const s of sessions) {
        if (!/Lost-Carrier|NAS-Request/i.test(s.reason)) continue;
        if (s.end <= s.start) continue;

        const a = new Date(Math.max(+s.start, +from)),
              b = new Date(Math.min(+s.end, +to));
        
        if (b > a) {
            out.push({ a, b, reason: s.reason, ms: b - a });
        }
    }
    return out;
}

function fmt(d) {
    return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "medium" }).format(d);
}

function dur(ms) {
    let s = Math.floor(ms / 1000),
        d = Math.floor(s / 86400),
        h = Math.floor(s % 86400 / 3600),
        m = Math.floor(s % 3600 / 60),
        sec = s % 60;
    return (d ? d + "d " : "") + h + "h " + m + "min " + sec + "s";
}

function render(outages) {
    lastOutagesData = outages;
    const total = outages.reduce((n, o) => n + o.ms, 0),
          days = total ? Math.ceil(total / 86400000) : 0;

    document.querySelector("#totalDuration").textContent = dur(total);
    document.querySelector("#discountDays").textContent = days;
    document.querySelector("#outageCount").textContent = outages.length;
    document.querySelector("#explanation").textContent = "As durações são somadas e filtradas considerando apenas os motivos elegíveis dentro do período escolhido.";

    rowsEl.innerHTML = "";
    if (!outages.length) {
        rowsEl.innerHTML = '<tr><td colspan="4">Nenhuma queda elegível (Lost-Carrier / NAS-Request) identificada no intervalo.</td></tr>';
        return;
    }

    for (const o of outages) {
        const tr = document.createElement("tr");
        [fmt(o.a), fmt(o.b), o.reason, dur(o.ms)].forEach(v => {
            const td = document.createElement("td");
            td.textContent = v;
            tr.appendChild(td);
        });
        rowsEl.appendChild(tr);
    }
}

if (copyBtn) {
    copyBtn.addEventListener("click", () => {
        if (!lastOutagesData.length) {
            alert("Não há resultados calculados para copiar.");
            return;
        }

        const totalDurationText = document.querySelector("#totalDuration").textContent;
        const discountDaysText = document.querySelector("#discountDays").textContent;
        const outageCountText = document.querySelector("#outageCount").textContent;

        let textoCopia = `*Relatório de Rastreabilidade e Desconto*\n`;
        textoCopia += `• Tempo considerado: ${totalDurationText}\n`;
        textoCopia += `• Dias de desconto: ${discountDaysText}\n`;
        textoCopia += `• Quedas elegíveis: ${outageCountText}\n\n`;
        textoCopia += `*Detalhamento das quedas:*\n`;

        lastOutagesData.forEach((o, index) => {
            textoCopia += `${index + 1}. Início: ${fmt(o.a)} | Fim: ${fmt(o.b)} | Motivo: ${o.reason} | Duração: ${dur(o.ms)}\n`;
        });

        navigator.clipboard.writeText(textoCopia).then(() => {
            const originalText = copyBtn.textContent;
            copyBtn.textContent = "✅ Copiado com sucesso!";
            setTimeout(() => {
                copyBtn.textContent = originalText;
            }, 2000);
        }).catch(err => {
            console.error("Erro ao copiar:", err);
            alert("Erro ao tentar copiar para a área de transferência.");
        });
    });
}