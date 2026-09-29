pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

const fileInput = document.querySelector("#pdfFile"),
      startInput = document.querySelector("#startDate"),
      endInput = document.querySelector("#endDate"),
      button = document.querySelector("#calculateBtn"),
      statusEl = document.querySelector("#status"),
      rowsEl = document.querySelector("#outageRows");

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
        if (!sessions.length) throw Error("Não encontrei sessões com motivo e data/hora. Confira se o PDF é o relatório detalhado esperado.");

        const from = new Date(startInput.value),
              to = new Date(endInput.value);
        if (!Number.isFinite(+from) || !Number.isFinite(+to) || to <= from) throw Error("O fim do período deve ser posterior ao início.");

        const outages = makeOutages(sessions, from, to);
        render(outages);
        statusEl.textContent = `Leitura concluída: ${sessions.length} sessões elegíveis identificadas.`;

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

const dateRe = /(\d{2}\/\d{2}\/\d{4})\s+(\d{2}:\d{2}:\d{2})/g;

function dateOf(d, t) {
    const [dd, mm, yy] = d.split("/").map(Number),
          [h, m, s] = t.split(":").map(Number);
    return new Date(yy, mm - 1, dd, h, m, s);
}

function extractSessions(lines) {
    const out = [];
    for (const line0 of lines) {
        const line = line0.replace(/\s+/g, " ").trim();
        if (!/Lost-Carrier|NAS-Request/i.test(line)) continue;
        
        const ds = [...line.matchAll(dateRe)];
        if (!ds.length) continue;

        const start = dateOf(ds[0][1], ds[0][2]),
              end = ds.length > 1 ? dateOf(ds[1][1], ds[1][2]) : null;
        
        if (!Number.isFinite(+start)) continue;

        out.push({ start, end, reason: /Lost-Carrier/i.test(line) ? "Lost-Carrier" : "NAS-Request" });
    }
    return out.sort((a, b) => a.start - b.start);
}

function makeOutages(sessions, from, to) {
    const out = [];
    for (let i = 0; i < sessions.length; i++) {
        const s = sessions[i];
        if (!s.end || s.end <= s.start) continue;

        const next = sessions.slice(i + 1).find(x => x.start > s.end);
        if (!next) continue;

        const a = new Date(Math.max(+s.end, +from)),
              b = new Date(Math.min(+next.start, +to));
        
        if (b > a) out.push({ a, b, reason: s.reason, ms: b - a });
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
    const total = outages.reduce((n, o) => n + o.ms, 0),
          days = total ? Math.ceil(total / 86400000) : 0;

    document.querySelector("#totalDuration").textContent = dur(total);
    document.querySelector("#discountDays").textContent = days;
    document.querySelector("#outageCount").textContent = outages.length;
    document.querySelector("#explanation").textContent = "As durações são somadas e arredondadas para cima uma única vez. Só é contado o trecho dentro do período escolhido.";

    rowsEl.innerHTML = "";
    if (!outages.length) {
        rowsEl.innerHTML = '<tr><td colspan="4">Nenhuma queda elegível identificada no intervalo.</td></tr>';
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