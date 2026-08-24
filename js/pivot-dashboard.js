/**
 * ==========================================================
 * CONSUMO DE PLAYLISTS — ORQUESTRADOR
 * ----------------------------------------------------------
 * Upload de um ou vários arquivos -> lista com prévia
 * instantânea por playlist (KPIs + tabela + gráfico, tudo
 * calculado no navegador, colapsada por padrão) -> "Salvar no
 * histórico" manda cada playlist marcada, uma de cada vez,
 * pro Apps Script, que cria a Google Sheet de verdade (aba
 * Dados + aba Tabela Dinâmica com pivot table e gráfico
 * nativos) e registra no histórico. O histórico é lido de
 * volta via CSV publicado.
 * ==========================================================
 */

const PivotDashboard = {

    initialized: false,
    bound: false,

    _uploads: [],
    _uidCounter: 0,

    _compareChart: null,
    _compareVisible: false,

    _historyChart: null,
    _historyFiltered: [],
    _activeHistoryRow: null,

    async init() {

        this.bindEvents();

        if (!PivotData.historicoLoaded) {

            try {
                await PivotData.loadHistorico();
            }
            catch (error) {
                console.error("[PivotDashboard]", error);
            }

        }

        this.renderHistoryList(PivotData.historico);

        this.initialized = true;

        return this;

    },

    bindEvents() {

        if (this.bound) return;

        this.bound = true;

        document.getElementById("pivotFileInput").addEventListener("change", (event) => {

            this.handleFilesSelected(event.target.files);

        });

        document.getElementById("pivotEntradaInput").addEventListener("change", () => this.refreshAllEntries());
        document.getElementById("pivotSaidaInput").addEventListener("change", () => this.refreshAllEntries());

        document.getElementById("pivotSamePeriodToggle").addEventListener("change", (event) => {

            // Ao desligar, cada playlist parte do período que estava
            // valendo até agora (compartilhado) — assim ninguém perde
            // as datas já preenchidas, só passa a poder editar cada
            // uma separadamente a partir daí.
            if (!event.target.checked) {

                const shared = this.getEntradaSaida();

                this._uploads.forEach(entry => {
                    if (!entry.entrada) entry.entrada = shared.entrada;
                    if (!entry.saida) entry.saida = shared.saida;
                });

            }

            this.updateSamePeriodFieldsVisibility();
            this.renderUploadsList();

        });

        document.getElementById("pivotSubmitBtn").addEventListener("click", () => this.submitSelected());

        document.getElementById("pivotCompareBtn").addEventListener("click", () => this.toggleCompare());

        document.getElementById("pivotUploadsList").addEventListener("click", (event) => {

            const toggleBtn = event.target.closest(".pivot-upload-item-toggle");

            if (!toggleBtn) return;

            const itemEl = toggleBtn.closest("[data-uid]");

            if (itemEl) this.toggleEntryExpanded(itemEl.dataset.uid);

        });

        document.getElementById("pivotUploadsList").addEventListener("change", (event) => {

            const itemEl = event.target.closest("[data-uid]");

            if (!itemEl) return;

            const entry = this.findEntry(itemEl.dataset.uid);

            if (!entry) return;

            if (event.target.classList.contains("pivot-upload-item-check")) {

                entry.selected = event.target.checked;

                if (this._compareVisible) this.renderComparison();

                return;

            }

            if (event.target.classList.contains("pivot-upload-item-entrada")) {

                entry.entrada = event.target.value ? this.parseDateInput(event.target.value) : null;
                this.onEntryPeriodChanged(entry);
                return;

            }

            if (event.target.classList.contains("pivot-upload-item-saida")) {

                entry.saida = event.target.value ? this.parseDateInput(event.target.value) : null;
                this.onEntryPeriodChanged(entry);
                return;

            }

        });

        document.getElementById("pivotHistorySearch").addEventListener("input", (event) => {

            this.filterHistory(event.target.value);

        });

        document.getElementById("pivotHistoryModalClose").addEventListener("click", () => this.closeHistoryModal());

        document.getElementById("pivotHistoryModal").addEventListener("click", (event) => {

            if (event.target.id === "pivotHistoryModal") this.closeHistoryModal();

        });

        document.addEventListener("keydown", (event) => {

            if (event.key !== "Escape") return;

            const modal = document.getElementById("pivotHistoryModal");

            if (modal.classList.contains("open")) this.closeHistoryModal();

        });

        this.updateSamePeriodFieldsVisibility();

    },

    /* ======================================================
       UPLOAD + PRÉVIA (100% no navegador, 1 ou vários arquivos)
    ====================================================== */

    handleFilesSelected(fileList) {

        const files = Array.from(fileList || []);

        if (!files.length) return;

        const status = document.getElementById("pivotUploadStatus");

        status.textContent = `Lendo ${files.length} arquivo${files.length === 1 ? "" : "s"}...`;
        status.classList.remove("pivot-upload-error");

        const tasks = files.map(file =>
            PivotData.parseFile(file)
                .then(rows => ({ file, rows }))
                .catch(error => { throw { file, error }; })
        );

        Promise.allSettled(tasks).then(results => {

            const errors = [];

            results.forEach(result => {

                if (result.status === "fulfilled") {

                    const { file, rows } = result.value;

                    this._uploads.push({

                        uid: this.makeUid(),
                        fileName: file.name,
                        rows,
                        grouped: PivotData.groupByDate(rows),
                        idPlaylist: rows[0].idPlaylist,
                        nomePlaylist: rows[0].nomePlaylist,
                        entrada: null,
                        saida: null,
                        selected: true,
                        expanded: false,
                        detailRendered: false,
                        chart: null,
                        status: ""

                    });

                }
                else {

                    const { file, error } = result.reason;

                    errors.push(`${file.name}: ${(error && error.message) || "erro ao ler"}`);

                }

            });

            if (errors.length) {

                status.textContent = errors.join(" · ");
                status.classList.add("pivot-upload-error");

            }
            else {

                status.textContent = `${results.length} arquivo${results.length === 1 ? "" : "s"} lido${results.length === 1 ? "" : "s"} com sucesso.`;

            }

            // Com uma playlist só, não faz sentido esconder o
            // resultado atrás da seta — abre direto. Com 2+, cada
            // uma continua colapsada por padrão (só a seta abre).
            if (this._uploads.length === 1) {

                this._uploads[0].expanded = true;

            }

            this.renderUploadsList();

        });

        // Limpa o input pra dar pra escolher os MESMOS arquivos de
        // novo depois (o navegador não dispara "change" se o valor
        // não mudar).
        document.getElementById("pivotFileInput").value = "";

    },

    makeUid() {

        this._uidCounter += 1;

        return `u${this._uidCounter}`;

    },

    findEntry(uid) {

        return this._uploads.find(entry => entry.uid === uid);

    },

    /* ======================================================
       PERÍODO DE DESTAQUE — compartilhado ou por playlist
    ====================================================== */

    getEntradaSaida() {

        const entradaValue = document.getElementById("pivotEntradaInput").value;
        const saidaValue = document.getElementById("pivotSaidaInput").value;

        const entrada = entradaValue ? this.parseDateInput(entradaValue) : null;
        const saida = saidaValue ? this.parseDateInput(saidaValue) : null;

        return { entrada, saida };

    },

    getEntryEntradaSaida(entry) {

        const samePeriod = document.getElementById("pivotSamePeriodToggle").checked;

        if (samePeriod) return this.getEntradaSaida();

        return { entrada: entry.entrada || null, saida: entry.saida || null };

    },

    parseDateInput(value) {

        // <input type="date"> devolve sempre "yyyy-mm-dd"
        const [y, m, d] = value.split("-").map(Number);

        return new Date(y, m - 1, d);

    },

    formatDateInput(date) {

        if (!date) return "";

        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, "0");
        const d = String(date.getDate()).padStart(2, "0");

        return `${y}-${m}-${d}`;

    },

    updateSamePeriodFieldsVisibility() {

        const samePeriod = document.getElementById("pivotSamePeriodToggle").checked;

        document.getElementById("pivotEntradaField").style.display = samePeriod ? "" : "none";
        document.getElementById("pivotSaidaField").style.display = samePeriod ? "" : "none";

    },

    refreshAllEntries() {

        this._uploads.forEach(entry => {

            this.renderEntryHeader(entry);

            if (entry.expanded) this.renderEntryDetail(entry);

        });

        if (this._compareVisible) this.renderComparison();

    },

    onEntryPeriodChanged(entry) {

        this.renderEntryHeader(entry);

        if (entry.expanded) this.renderEntryDetail(entry);

        if (this._compareVisible) this.renderComparison();

    },

    /* ======================================================
       CÁLCULOS (compartilhados entre lista, comparativo e
       modal do histórico)
    ====================================================== */

    computeKpis(rows, grouped, entrada, saida) {

        const total = rows.reduce((sum, row) => sum + row.consumo, 0);

        const destaque = rows
            .filter(row => PivotData.isWithinRange(row.data, entrada, saida))
            .reduce((sum, row) => sum + row.consumo, 0);

        const variacao = this.computeVariacao(grouped, entrada, saida);

        return {
            total,
            destaque,
            variacaoDestaque: variacao.destaque,
            variacaoPosDestaque: variacao.pos
        };

    },

    /**
     * Duas métricas só fazem sentido com entrada/saída preenchidas
     * (e pelo menos 1 dia de dado no período de comparação —
     * senão ficam "—", em vez de dividir por zero):
     *
     * - "% variação no consumo": média diária DURANTE o destaque
     *   vs. média diária ANTES da entrada.
     * - "% variação após término": média diária DEPOIS da saída
     *   vs. média diária DURANTE o destaque.
     */
    computeVariacao(grouped, entrada, saida) {

        if (!entrada || !saida) return { destaque: "—", pos: "—" };

        const antes = grouped.filter(item => item.date < entrada);
        const durante = grouped.filter(item => PivotData.isWithinRange(item.date, entrada, saida));
        const depois = grouped.filter(item => item.date > saida);

        const media = (items) => items.length
            ? items.reduce((sum, item) => sum + item.total, 0) / items.length
            : null;

        const mediaAntes = media(antes);
        const mediaDurante = media(durante);
        const mediaDepois = media(depois);

        return {
            destaque: this.formatVariacao(mediaAntes, mediaDurante),
            pos: this.formatVariacao(mediaDurante, mediaDepois)
        };

    },

    formatVariacao(base, comparado) {

        if (!base || comparado === null) return "—";

        const variacao = ((comparado - base) / base) * 100;

        const sinal = variacao > 0 ? "+" : "";

        return `${sinal}${variacao.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;

    },

    /* ======================================================
       LISTA DE PLAYLISTS CARREGADAS
    ====================================================== */

    renderUploadsList() {

        const container = document.getElementById("pivotUploadsList");
        const resultBox = document.getElementById("pivotResult");
        const compareBtn = document.getElementById("pivotCompareBtn");

        if (!this._uploads.length) {

            container.innerHTML = "";
            resultBox.style.display = "none";
            compareBtn.style.display = "none";

            return;

        }

        resultBox.style.display = "";
        compareBtn.style.display = this._uploads.length > 1 ? "" : "none";

        container.innerHTML = this._uploads.map(entry => this.buildUploadItemHtml(entry)).join("");

        // O innerHTML acima troca os elementos de tabela/gráfico por
        // uns novos (vazios) — pras playlists que já estavam
        // expandidas, "detailRendered" ficaria com um valor antigo
        // que não reflete mais o DOM atual, então precisa forçar o
        // redesenho aqui (senão fica em branco até fechar e abrir
        // de novo).
        this._uploads.forEach(entry => {

            if (!entry.expanded) return;

            entry.chart = null;
            entry.detailRendered = false;

            this.renderEntryDetail(entry);

        });

        if (this._compareVisible) this.renderComparison();

    },

    buildUploadItemHtml(entry) {

        const samePeriod = document.getElementById("pivotSamePeriodToggle").checked;

        const { entrada, saida } = this.getEntryEntradaSaida(entry);

        const kpis = this.computeKpis(entry.rows, entry.grouped, entrada, saida);

        const periodFieldsHtml = samePeriod ? "" : `
            <div class="pivot-upload-item-period-row">
                <div class="filter">
                    <label>Entrada do destaque (opcional)</label>
                    <input type="date" class="pivot-upload-item-entrada" value="${this.formatDateInput(entry.entrada)}">
                </div>
                <div class="filter">
                    <label>Saída do destaque (opcional)</label>
                    <input type="date" class="pivot-upload-item-saida" value="${this.formatDateInput(entry.saida)}">
                </div>
            </div>
        `;

        return `
            <div class="pivot-upload-item" data-uid="${entry.uid}">

                <div class="pivot-upload-item-header">

                    <input type="checkbox" class="pivot-upload-item-check" ${entry.selected ? "checked" : ""} title="Enviar pro Drive">

                    <button type="button" class="pivot-upload-item-toggle" aria-label="Expandir/recolher">${entry.expanded ? "▾" : "▸"}</button>

                    <div class="pivot-upload-item-info">
                        <strong>${this.escapeHtml(entry.nomePlaylist)}</strong>
                        <span class="pivot-upload-item-id">ID ${this.escapeHtml(entry.idPlaylist)} · ${this.escapeHtml(entry.fileName)}</span>
                    </div>

                    <div class="pivot-upload-item-kpis-inline">
                        <span>Total: <strong>${Math.round(kpis.total).toLocaleString("pt-BR")}</strong></span>
                        <span>Destaque: <strong>${Math.round(kpis.destaque).toLocaleString("pt-BR")}</strong></span>
                        <span>Variação: <strong>${kpis.variacaoDestaque}</strong></span>
                        <span>Pós: <strong>${kpis.variacaoPosDestaque}</strong></span>
                    </div>

                    <span class="pivot-upload-item-status" id="pivotUploadStatus-${entry.uid}">${this.statusLabel(entry.status)}</span>

                </div>

                ${periodFieldsHtml}

                <div class="pivot-upload-item-body" style="${entry.expanded ? "" : "display:none;"}">

                    <div class="pivot-grid">

                        <div class="card pivot-table-card">
                            <h3>Tabela dinâmica (por dia)</h3>
                            <div class="pivot-table-scroll" id="pivotTableContainer-${entry.uid}"></div>
                        </div>

                        <div class="card pivot-chart-card">
                            <h3>Consumo por dia</h3>
                            <div class="pivot-chart-canvas-wrap">
                                <canvas id="pivotChart-${entry.uid}"></canvas>
                            </div>
                        </div>

                    </div>

                </div>

            </div>
        `;

    },

    renderEntryHeader(entry) {

        const itemEl = document.querySelector(`.pivot-upload-item[data-uid="${entry.uid}"]`);

        if (!itemEl) return;

        const { entrada, saida } = this.getEntryEntradaSaida(entry);

        const kpis = this.computeKpis(entry.rows, entry.grouped, entrada, saida);

        const kpisEl = itemEl.querySelector(".pivot-upload-item-kpis-inline");

        kpisEl.innerHTML = `
            <span>Total: <strong>${Math.round(kpis.total).toLocaleString("pt-BR")}</strong></span>
            <span>Destaque: <strong>${Math.round(kpis.destaque).toLocaleString("pt-BR")}</strong></span>
            <span>Variação: <strong>${kpis.variacaoDestaque}</strong></span>
            <span>Pós: <strong>${kpis.variacaoPosDestaque}</strong></span>
        `;

    },

    renderEntryDetail(entry) {

        const tableEl = document.getElementById(`pivotTableContainer-${entry.uid}`);
        const canvasEl = document.getElementById(`pivotChart-${entry.uid}`);

        if (!tableEl || !canvasEl) return;

        const { entrada, saida } = this.getEntryEntradaSaida(entry);

        this.renderTableInto(tableEl, entry.grouped, entrada, saida);

        entry.chart = this.renderChartInto(canvasEl, entry.grouped, entrada, saida, entry.chart);

        entry.detailRendered = true;

    },

    toggleEntryExpanded(uid) {

        const entry = this.findEntry(uid);

        if (!entry) return;

        entry.expanded = !entry.expanded;

        const itemEl = document.querySelector(`.pivot-upload-item[data-uid="${uid}"]`);

        if (!itemEl) return;

        const bodyEl = itemEl.querySelector(".pivot-upload-item-body");
        const btnEl = itemEl.querySelector(".pivot-upload-item-toggle");

        bodyEl.style.display = entry.expanded ? "" : "none";
        btnEl.textContent = entry.expanded ? "▾" : "▸";

        if (entry.expanded && !entry.detailRendered) this.renderEntryDetail(entry);

    },

    statusLabel(status) {

        if (status === "sending") return "⏳";
        if (status === "sent") return "✔";
        if (status === "error") return "✖";

        return "";

    },

    updateEntryStatusUI(entry) {

        const el = document.getElementById(`pivotUploadStatus-${entry.uid}`);

        if (el) el.title = entry.error || "";
        if (el) el.textContent = this.statusLabel(entry.status);

    },

    /* ======================================================
       TABELA / GRÁFICO GENÉRICOS — usados na lista, no
       comparativo (só a lógica de cálculo) e no modal do
       histórico.
    ====================================================== */

    renderTableInto(container, grouped, entrada, saida) {

        const totalGeral = grouped.reduce((sum, item) => sum + item.total, 0);

        const body = grouped.map(item => {

            const destacado = PivotData.isWithinRange(item.date, entrada, saida);

            return `
                <tr class="${destacado ? "pivot-row-destaque" : ""}">
                    <td>${PivotData.formatDateBR(item.date)}</td>
                    <td>${Math.round(item.total).toLocaleString("pt-BR")}</td>
                </tr>
            `;

        }).join("");

        container.innerHTML = `
            <table class="goals-table">
                <thead>
                    <tr>
                        <th>Data</th>
                        <th>Soma de Consumo</th>
                    </tr>
                </thead>
                <tbody>
                    ${body}
                    <tr class="summary-row">
                        <td>Total geral</td>
                        <td>${Math.round(totalGeral).toLocaleString("pt-BR")}</td>
                    </tr>
                </tbody>
            </table>
        `;

    },

    renderChartInto(canvas, grouped, entrada, saida, existingChart) {

        if (existingChart) existingChart.destroy();

        const labels = grouped.map(item => PivotData.formatDateBR(item.date));

        const consumo = grouped.map(item => item.total);

        const consumoDestaque = grouped.map(item =>
            PivotData.isWithinRange(item.date, entrada, saida) ? item.total : null
        );

        return new Chart(canvas, {

            type: "line",

            data: {

                labels,

                datasets: [

                    {
                        label: "Consumo",
                        data: consumo,
                        borderColor: "#999999",
                        backgroundColor: "transparent",
                        tension: 0.2,
                        pointRadius: 2
                    },

                    {
                        label: "Consumo durante o destaque",
                        data: consumoDestaque,
                        borderColor: "#E30613",
                        backgroundColor: "transparent",
                        borderWidth: 4,
                        tension: 0.2,
                        pointRadius: 3,
                        spanGaps: false
                    }

                ]

            },

            options: {

                responsive: true,
                maintainAspectRatio: false,

                plugins: {
                    legend: { position: "bottom" }
                },

                scales: {
                    y: { beginAtZero: true }
                }

            }

        });

    },

    /* ======================================================
       COMPARATIVO ENTRE PLAYLISTS (sob demanda)
    ====================================================== */

    toggleCompare() {

        this._compareVisible = !this._compareVisible;

        document.getElementById("pivotCompareSection").style.display = this._compareVisible ? "" : "none";

        if (this._compareVisible) this.renderComparison();

    },

    renderComparison() {

        const tableContainer = document.getElementById("pivotCompareTableContainer");
        const chartWrap = document.getElementById("pivotCompareChart").closest(".pivot-chart-canvas-wrap");

        // Compara só as marcadas (checkbox de "enviar pro Drive") —
        // desmarcar uma tira ela da análise comparativa também.
        const selected = this._uploads.filter(entry => entry.selected);

        if (selected.length < 2) {

            tableContainer.innerHTML = `<p class="analises-empty">Marque pelo menos 2 playlists (checkbox à esquerda) pra comparar.</p>`;

            if (chartWrap) chartWrap.style.display = "none";

            if (this._compareChart) {
                this._compareChart.destroy();
                this._compareChart = null;
            }

            return;

        }

        if (chartWrap) chartWrap.style.display = "";

        const rowsHtml = selected.map(entry => {

            const { entrada, saida } = this.getEntryEntradaSaida(entry);

            const kpis = this.computeKpis(entry.rows, entry.grouped, entrada, saida);

            return `
                <tr>
                    <td>${this.escapeHtml(entry.nomePlaylist)}</td>
                    <td>${this.escapeHtml(entry.idPlaylist)}</td>
                    <td>${Math.round(kpis.total).toLocaleString("pt-BR")}</td>
                    <td>${Math.round(kpis.destaque).toLocaleString("pt-BR")}</td>
                    <td>${kpis.variacaoDestaque}</td>
                    <td>${kpis.variacaoPosDestaque}</td>
                </tr>
            `;

        }).join("");

        tableContainer.innerHTML = `
            <table class="goals-table">
                <thead>
                    <tr>
                        <th>Playlist</th>
                        <th>ID</th>
                        <th>Consumo total</th>
                        <th>Consumo destaque</th>
                        <th>Variação</th>
                        <th>Pós-destaque</th>
                    </tr>
                </thead>
                <tbody>${rowsHtml}</tbody>
            </table>
        `;

        const dateKeys = new Set();

        selected.forEach(entry => entry.grouped.forEach(item => dateKeys.add(item.dateKey)));

        const sortedKeys = [...dateKeys].sort();

        const labels = sortedKeys.map(key => PivotData.formatDateBR(PivotData.dateFromKey(key)));

        const palette = ["#E30613", "#1F6FEB", "#2EA043", "#D29922", "#8957E5", "#DB6D28", "#39C5CF", "#F778BA"];

        const datasets = selected.map((entry, index) => {

            const map = new Map(entry.grouped.map(item => [item.dateKey, item.total]));

            return {
                label: entry.nomePlaylist,
                data: sortedKeys.map(key => map.has(key) ? map.get(key) : null),
                borderColor: palette[index % palette.length],
                backgroundColor: "transparent",
                spanGaps: true,
                tension: 0.2,
                pointRadius: 2
            };

        });

        const canvas = document.getElementById("pivotCompareChart");

        if (this._compareChart) this._compareChart.destroy();

        this._compareChart = new Chart(canvas, {

            type: "line",

            data: { labels, datasets },

            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: "bottom" } },
                scales: { y: { beginAtZero: true } }
            }

        });

    },

    /* ======================================================
       ENVIO — gera a Sheet de verdade via Apps Script, uma
       playlist marcada de cada vez (sequencial, pra não
       estourar limite de execuções simultâneas do Apps Script
       e pra dar pra mostrar o progresso linha a linha).
    ====================================================== */

    async submitEntry(entry) {

        const { entrada, saida } = this.getEntryEntradaSaida(entry);

        const payload = {

            token: CONFIG.PIVOT_UPLOAD.sharedSecret,

            idPlaylist: entry.idPlaylist,
            nomePlaylist: entry.nomePlaylist,

            entrada: entrada ? PivotData.dateKey(entrada) : "",
            saida: saida ? PivotData.dateKey(saida) : "",

            rows: entry.rows.map(row => ({
                data: PivotData.dateKey(row.data),
                idPlaylist: row.idPlaylist,
                nomePlaylist: row.nomePlaylist,
                consumo: row.consumo
            }))

        };

        const response = await fetch(CONFIG.PIVOT_UPLOAD.webAppUrl, {

            method: "POST",
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify(payload)

        });

        const data = await response.json();

        if (!data.success) {
            throw new Error((data.errors && data.errors[0]) || "Erro ao gerar a planilha.");
        }

        return data;

    },

    async submitSelected() {

        const status = document.getElementById("pivotSubmitStatus");
        const btn = document.getElementById("pivotSubmitBtn");

        const selected = this._uploads.filter(entry => entry.selected);

        if (!selected.length) {

            alert("Marque ao menos uma playlist (checkbox à esquerda) pra enviar.");
            return;

        }

        if (!CONFIG.PIVOT_UPLOAD.webAppUrl) {

            status.textContent = "Geração ainda não configurada (CONFIG.PIVOT_UPLOAD.webAppUrl vazia).";
            return;

        }

        btn.disabled = true;

        let done = 0;
        let failed = 0;

        for (const entry of selected) {

            entry.status = "sending";
            entry.error = "";
            this.updateEntryStatusUI(entry);

            status.textContent = `Enviando ${done + 1} de ${selected.length}...`;

            try {

                await this.submitEntry(entry);
                entry.status = "sent";

            }
            catch (error) {

                console.error("[PivotDashboard]", error);
                entry.status = "error";
                entry.error = error.message;
                failed += 1;

            }

            this.updateEntryStatusUI(entry);

            done += 1;

        }

        btn.disabled = false;

        status.textContent = failed
            ? `✔ ${done - failed} de ${done} enviadas pro Drive — ${failed} falharam (veja o status de cada linha).`
            : `✔ ${done} playlist${done === 1 ? "" : "s"} enviada${done === 1 ? "" : "s"} pro Drive!`;

        try {

            await PivotData.loadHistorico();
            this.renderHistoryList(PivotData.historico);

        }
        catch (error) {

            console.error("[PivotDashboard]", error);

        }

    },

    /* ======================================================
       HISTÓRICO
    ====================================================== */

    filterHistory(query) {

        const normalized = String(query || "").trim().toLowerCase();

        const filtered = !normalized
            ? PivotData.historico
            : PivotData.historico.filter(row =>
                row.idPlaylist.toLowerCase().includes(normalized) ||
                row.nomePlaylist.toLowerCase().includes(normalized)
            );

        this.renderHistoryList(filtered);

    },

    renderHistoryList(rows) {

        this._historyFiltered = rows;

        const container = document.getElementById("pivotHistoryList");

        if (!rows.length) {

            container.innerHTML = `<p class="analises-empty">Nenhuma playlist no histórico ainda.</p>`;
            return;

        }

        const sorted = [...rows].sort((a, b) => (b.dataInicio || 0) - (a.dataInicio || 0));

        container.innerHTML = sorted.map((row, index) => `
            <div class="pivot-history-item" data-index="${index}">
                <div class="pivot-history-item-main">
                    <strong>${this.escapeHtml(row.nomePlaylist)}</strong>
                    <span class="pivot-history-item-id">ID ${this.escapeHtml(row.idPlaylist)}</span>
                </div>
                <div class="pivot-history-item-period">
                    ${PivotData.formatDateBR(row.dataInicio)} – ${PivotData.formatDateBR(row.dataFim)}
                </div>
                <div class="pivot-history-item-consumo">
                    Total: ${Math.round(row.consumoTotal).toLocaleString("pt-BR")} · Destaque: ${Math.round(row.consumoDestaque).toLocaleString("pt-BR")}
                </div>
            </div>
        `).join("");

        Array.from(container.querySelectorAll(".pivot-history-item")).forEach((el, index) => {

            el.addEventListener("click", () => this.openHistoryModal(sorted[index]));

        });

    },

    openHistoryModal(row) {

        this._activeHistoryRow = row;

        document.getElementById("pivotHistoryModalTitle").textContent = row.nomePlaylist;

        document.getElementById("pivotHistoryModalSubtitle").textContent =
            `ID ${row.idPlaylist} · ${PivotData.formatDateBR(row.dataInicio)} a ${PivotData.formatDateBR(row.dataFim)}` +
            (row.entrada && row.saida ? ` · Destaque: ${PivotData.formatDateBR(row.entrada)} a ${PivotData.formatDateBR(row.saida)}` : "");

        document.getElementById("pivotHistoryKpiTotal").textContent = Math.round(row.consumoTotal).toLocaleString("pt-BR");
        document.getElementById("pivotHistoryKpiDestaque").textContent = Math.round(row.consumoDestaque).toLocaleString("pt-BR");

        document.getElementById("pivotHistoryKpiVariacaoDestaque").textContent = this.formatVariacaoValue(row.variacaoDestaque);
        document.getElementById("pivotHistoryKpiVariacaoPosDestaque").textContent = this.formatVariacaoValue(row.variacaoPosDestaque);

        document.getElementById("pivotHistoryOpenDrive").href = row.driveUrl || "#";

        document.getElementById("pivotHistoryDownload").href = row.driveFileId
            ? `https://docs.google.com/spreadsheets/d/${row.driveFileId}/export?format=xlsx`
            : "#";

        // A troca de aba via URL (#gid=...) não é confiável dentro
        // de um iframe já carregado do Sheets — em vez de tentar
        // forçar isso, mostramos a planilha completa (com as
        // próprias abas do Sheets visíveis) e quem usa troca de
        // aba clicando direto nelas, dentro do embed mesmo.
        document.getElementById("pivotHistoryIframe").src = row.driveFileId
            ? `https://docs.google.com/spreadsheets/d/${row.driveFileId}/edit?rm=minimal`
            : "";

        document.getElementById("pivotHistoryModal").classList.add("open");

        this.loadHistoryVisual(row);

    },

    /**
     * Busca a aba "Dados" da Sheet dessa linha do histórico e
     * desenha a mesma tabela+gráfico da tela de upload, ANTES do
     * embed da planilha — deixa o pop-up mais visual em vez de só
     * mostrar o Google Sheets embutido direto. Se a busca falhar
     * (Sheet apagada/movida, sem internet etc.), some silenciosamente
     * e mantém só o embed, sem travar o pop-up.
     */
    loadHistoryVisual(row) {

        const visualSection = document.getElementById("pivotHistoryVisual");
        const statusEl = document.getElementById("pivotHistoryVisualStatus");

        visualSection.style.display = "none";

        if (this._historyChart) {
            this._historyChart.destroy();
            this._historyChart = null;
        }

        if (!row.driveFileId || !row.dadosGid) {
            statusEl.textContent = "";
            return;
        }

        statusEl.textContent = "Carregando gráfico e tabela...";

        PivotData.fetchDadosCsv(row.driveFileId)
            .then(({ grouped }) => {

                // Se o modal já foi fechado ou trocou de linha
                // antes disso terminar, não escreve por cima.
                if (this._activeHistoryRow !== row) return;

                this.renderTableInto(document.getElementById("pivotHistoryTableContainer"), grouped, row.entrada, row.saida);

                this._historyChart = this.renderChartInto(
                    document.getElementById("pivotHistoryChart"),
                    grouped,
                    row.entrada,
                    row.saida,
                    null
                );

                visualSection.style.display = "";
                statusEl.textContent = "";

            })
            .catch(error => {

                console.error("[PivotDashboard]", error);

                if (this._activeHistoryRow !== row) return;

                statusEl.textContent = "";

            });

    },

    closeHistoryModal() {

        document.getElementById("pivotHistoryModal").classList.remove("open");
        document.getElementById("pivotHistoryIframe").src = "";

        document.getElementById("pivotHistoryVisual").style.display = "none";
        document.getElementById("pivotHistoryVisualStatus").textContent = "";

        if (this._historyChart) {
            this._historyChart.destroy();
            this._historyChart = null;
        }

        this._activeHistoryRow = null;

    },

    formatVariacaoValue(value) {

        // A célula vem do Sheets com vírgula decimal (ex.: "71,7"),
        // que Number() não entende sozinho — troca por ponto antes.
        const texto = String(value === undefined || value === null ? "" : value).trim();

        const numero = Number(texto.replace(",", "."));

        if (texto === "" || isNaN(numero)) return "—";

        const sinal = numero > 0 ? "+" : "";

        return `${sinal}${numero.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;

    },

    escapeHtml(text) {

        return String(text || "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");

    }

};
