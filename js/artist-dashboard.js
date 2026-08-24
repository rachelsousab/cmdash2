/**
 * ==========================================================
 * CONSUMO POR ARTISTA — ORQUESTRADOR
 * ----------------------------------------------------------
 * Mesmo mecanismo de js/pivot-dashboard.js (upload múltiplo,
 * lista colapsável com checkbox/seta, envio sequencial pro
 * Apps Script, comparativo sob demanda, histórico com pop-up
 * visual) — adaptado pro export "Artista Analítico": KPIs,
 * tabelas e gráficos por País/Álbum/Fonograma em vez de por
 * dia, e um campo de Tipo de Destaque (compartilhado entre os
 * artistas enviados numa mesma leva).
 *
 * A relação entre Tipo de Destaque e as ações da Área de
 * Marketing fica pra uma próxima atualização (combinado com a
 * Rachel) — por enquanto só entra como texto no histórico.
 * ==========================================================
 */

const ArtistDashboard = {

    initialized: false,
    bound: false,

    _uploads: [],
    _uidCounter: 0,

    _compareChart: null,
    _compareVisible: false,

    _historyCharts: {},
    _historyFiltered: [],
    _activeHistoryRow: null,

    TOP_N_CHART: 15,

    async init() {

        this.bindEvents();

        if (!ArtistData.historicoLoaded) {

            try {
                await ArtistData.loadHistorico();
            }
            catch (error) {
                console.error("[ArtistDashboard]", error);
            }

        }

        this.renderHistoryList(ArtistData.historico);

        this.initialized = true;

        return this;

    },

    bindEvents() {

        if (this.bound) return;

        this.bound = true;

        document.getElementById("artistFileInput").addEventListener("change", (event) => {

            this.handleFilesSelected(event.target.files);

        });

        document.getElementById("artistEntradaInput").addEventListener("change", () => this.refreshAllEntries());
        document.getElementById("artistSaidaInput").addEventListener("change", () => this.refreshAllEntries());

        document.getElementById("artistSamePeriodToggle").addEventListener("change", (event) => {

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

        document.getElementById("artistSubmitBtn").addEventListener("click", () => this.submitSelected());

        document.getElementById("artistCompareBtn").addEventListener("click", () => this.toggleCompare());

        document.getElementById("artistUploadsList").addEventListener("click", (event) => {

            const toggleBtn = event.target.closest(".pivot-upload-item-toggle");

            if (!toggleBtn) return;

            const itemEl = toggleBtn.closest("[data-uid]");

            if (itemEl) this.toggleEntryExpanded(itemEl.dataset.uid);

        });

        document.getElementById("artistUploadsList").addEventListener("change", (event) => {

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

            if (event.target.classList.contains("artist-album-filter")) {

                entry.albumFiltro = this.resolveAlbumFiltroSelection(event.target);

                if (entry.expanded) this.renderFonogramaDetail(entry);

                return;

            }

        });

        document.getElementById("artistHistorySearch").addEventListener("input", (event) => {

            this.filterHistory(event.target.value);

        });

        document.getElementById("artistHistoryModalClose").addEventListener("click", () => this.closeHistoryModal());

        document.getElementById("artistHistoryModal").addEventListener("click", (event) => {

            if (event.target.id === "artistHistoryModal") this.closeHistoryModal();

        });

        document.addEventListener("keydown", (event) => {

            if (event.key !== "Escape") return;

            const modal = document.getElementById("artistHistoryModal");

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

        const status = document.getElementById("artistUploadStatus");

        status.textContent = `Lendo ${files.length} arquivo${files.length === 1 ? "" : "s"}...`;
        status.classList.remove("pivot-upload-error");

        const tasks = files.map(file =>
            ArtistData.parseFile(file)
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
                        groupedPais: ArtistData.groupByPais(rows),
                        groupedAlbum: ArtistData.groupByAlbum(rows),
                        albuns: ArtistData.uniqueAlbuns(rows),
                        albumFiltro: [],
                        artistaId: rows[0].artistaId,
                        artista: rows[0].artista,
                        entrada: null,
                        saida: null,
                        selected: true,
                        expanded: false,
                        detailRendered: false,
                        chartPais: null,
                        chartAlbum: null,
                        chartFonograma: null,
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

            // Com um artista só, não faz sentido esconder o
            // resultado atrás da seta — abre direto. Com 2+, cada
            // um continua colapsado por padrão (só a seta abre).
            if (this._uploads.length === 1) {

                this._uploads[0].expanded = true;

            }

            this.renderUploadsList();

        });

        document.getElementById("artistFileInput").value = "";

    },

    makeUid() {

        this._uidCounter += 1;

        return `au${this._uidCounter}`;

    },

    findEntry(uid) {

        return this._uploads.find(entry => entry.uid === uid);

    },

    /* ======================================================
       PERÍODO DE DESTAQUE — compartilhado ou por artista
    ====================================================== */

    getEntradaSaida() {

        const entradaValue = document.getElementById("artistEntradaInput").value;
        const saidaValue = document.getElementById("artistSaidaInput").value;

        const entrada = entradaValue ? this.parseDateInput(entradaValue) : null;
        const saida = saidaValue ? this.parseDateInput(saidaValue) : null;

        return { entrada, saida };

    },

    getEntryEntradaSaida(entry) {

        const samePeriod = document.getElementById("artistSamePeriodToggle").checked;

        if (samePeriod) return this.getEntradaSaida();

        return { entrada: entry.entrada || null, saida: entry.saida || null };

    },

    getTipoDestaque() {

        return Array.from(document.querySelectorAll("#artistTipoDestaqueField input:checked")).map(el => el.value);

    },

    /**
     * "Todos" e álbuns específicos se excluem — clicar num álbum
     * normal (sem Ctrl/Cmd) já desmarca "Todos" sozinho, mas com
     * Ctrl/Cmd (ou Shift) dá pra selecionar os dois juntos, o que
     * não faz sentido. Resolve pra um dos dois lados e já corrige
     * visualmente o <select> se precisar.
     */
    resolveAlbumFiltroSelection(select) {

        const todosOption = select.querySelector('option[value="__TODOS__"]');

        let selectedValues = Array.from(select.selectedOptions).map(o => o.value);

        if (selectedValues.length === 0) {

            // Desmarcou tudo (Ctrl+clique no único marcado) — volta
            // pro "Todos" em vez de ficar sem nada selecionado.
            if (todosOption) todosOption.selected = true;

            return [];

        }

        if (selectedValues.includes("__TODOS__") && selectedValues.length > 1) {

            // "Todos" + algum álbum marcados ao mesmo tempo —
            // prioriza os álbuns específicos, tira o "Todos".
            todosOption.selected = false;

            selectedValues = selectedValues.filter(v => v !== "__TODOS__");

        }

        if (selectedValues.includes("__TODOS__")) return [];

        return selectedValues;

    },

    parseDateInput(value) {

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

        const samePeriod = document.getElementById("artistSamePeriodToggle").checked;

        document.getElementById("artistEntradaField").style.display = samePeriod ? "" : "none";
        document.getElementById("artistSaidaField").style.display = samePeriod ? "" : "none";

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

    computeKpis(entry, entrada, saida) {

        const rows = entry.rows;

        const datas = rows.map(row => row.data.getTime());

        const dataInicio = new Date(Math.min(...datas));
        const dataFim = new Date(Math.max(...datas));

        const dias = Math.round((dataFim - dataInicio) / (1000 * 60 * 60 * 24)) + 1;

        const total = rows.reduce((sum, row) => sum + row.quantidade, 0);

        const paisDestaque = entry.groupedPais.length ? entry.groupedPais[0].key : "—";

        const fonogramaMaisEscutado = ArtistData.groupByFonograma(rows)[0]?.key || "—";

        const consumoDestaque = (entrada && saida)
            ? rows.filter(row => ArtistData.isWithinRange(row.data, entrada, saida)).reduce((sum, row) => sum + row.quantidade, 0)
            : null;

        return {
            dataInicio,
            dataFim,
            dias,
            total,
            paisDestaque,
            fonogramaMaisEscutado,
            consumoDestaque
        };

    },

    formatPeriodo(kpis) {

        const inicio = ArtistData.formatDateBR(kpis.dataInicio);
        const fim = ArtistData.formatDateBR(kpis.dataFim);

        const meses = kpis.dias >= 60 ? ` (~${Math.round(kpis.dias / 30)} meses)` : "";

        return `${inicio} – ${fim} · ${kpis.dias} dia${kpis.dias === 1 ? "" : "s"}${meses}`;

    },

    /* ======================================================
       LISTA DE ARTISTAS CARREGADOS
    ====================================================== */

    renderUploadsList() {

        const container = document.getElementById("artistUploadsList");
        const resultBox = document.getElementById("artistResult");
        const compareBtn = document.getElementById("artistCompareBtn");

        if (!this._uploads.length) {

            container.innerHTML = "";
            resultBox.style.display = "none";
            compareBtn.style.display = "none";

            return;

        }

        resultBox.style.display = "";
        compareBtn.style.display = this._uploads.length > 1 ? "" : "none";

        container.innerHTML = this._uploads.map(entry => this.buildUploadItemHtml(entry)).join("");

        this._uploads.forEach(entry => {

            if (!entry.expanded) return;

            entry.chartPais = null;
            entry.chartAlbum = null;
            entry.chartFonograma = null;
            entry.detailRendered = false;

            this.renderEntryDetail(entry);

        });

        if (this._compareVisible) this.renderComparison();

    },

    buildUploadItemHtml(entry) {

        const samePeriod = document.getElementById("artistSamePeriodToggle").checked;

        const { entrada, saida } = this.getEntryEntradaSaida(entry);

        const kpis = this.computeKpis(entry, entrada, saida);

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

        const albumOptionsHtml =
            `<option value="__TODOS__" ${entry.albumFiltro.length ? "" : "selected"}>Todos</option>` +
            entry.albuns.map(album =>
                `<option value="${this.escapeAttr(album)}" ${entry.albumFiltro.includes(album) ? "selected" : ""}>${this.escapeHtml(album)}</option>`
            ).join("");

        return `
            <div class="pivot-upload-item" data-uid="${entry.uid}">

                <div class="pivot-upload-item-header">

                    <input type="checkbox" class="pivot-upload-item-check" ${entry.selected ? "checked" : ""} title="Enviar pro Drive">

                    <button type="button" class="pivot-upload-item-toggle" aria-label="Expandir/recolher">${entry.expanded ? "▾" : "▸"}</button>

                    <div class="pivot-upload-item-info">
                        <strong>${this.escapeHtml(entry.artista)}</strong>
                        <span class="pivot-upload-item-id">ID ${this.escapeHtml(entry.artistaId)} · ${this.escapeHtml(entry.fileName)}</span>
                    </div>

                    <div class="pivot-upload-item-kpis-inline">
                        <span>Período: <strong>${this.formatPeriodo(kpis)}</strong></span>
                        <span>Total: <strong>${Math.round(kpis.total).toLocaleString("pt-BR")}</strong></span>
                        <span>País destaque: <strong>${this.escapeHtml(kpis.paisDestaque)}</strong></span>
                        <span>Destaque: <strong>${kpis.consumoDestaque === null ? "—" : Math.round(kpis.consumoDestaque).toLocaleString("pt-BR")}</strong></span>
                        <span>Fonograma+: <strong>${this.escapeHtml(kpis.fonogramaMaisEscutado)}</strong></span>
                    </div>

                    <span class="pivot-upload-item-status" id="artistUploadStatus-${entry.uid}">${this.statusLabel(entry.status)}</span>

                </div>

                ${periodFieldsHtml}

                <div class="pivot-upload-item-body" style="${entry.expanded ? "" : "display:none;"}">

                    <div class="pivot-grid">
                        <div class="card pivot-table-card">
                            <h3>Consumo por país</h3>
                            <div class="pivot-table-scroll" id="artistPaisTableContainer-${entry.uid}"></div>
                        </div>
                        <div class="card pivot-chart-card">
                            <h3>Consumo por país</h3>
                            <div class="pivot-chart-canvas-wrap"><canvas id="artistPaisChart-${entry.uid}"></canvas></div>
                        </div>
                    </div>

                    <div class="pivot-grid">
                        <div class="card pivot-table-card">
                            <h3>Consumo por álbum</h3>
                            <div class="pivot-table-scroll" id="artistAlbumTableContainer-${entry.uid}"></div>
                        </div>
                        <div class="card pivot-chart-card">
                            <h3>Consumo por álbum</h3>
                            <div class="pivot-chart-canvas-wrap"><canvas id="artistAlbumChart-${entry.uid}"></canvas></div>
                        </div>
                    </div>

                    <div class="artist-album-filter-row">
                        <label>Filtrar fonogramas por álbum (opcional)</label>
                        <select multiple class="artist-album-filter" id="artistAlbumFilter-${entry.uid}" size="4">
                            ${albumOptionsHtml}
                        </select>
                        <span class="report-hint">Segure Ctrl (ou Cmd no Mac) pra marcar mais de um álbum. "Todos" mostra os ${entry.albuns.length} álbuns.</span>
                    </div>

                    <div class="pivot-grid">
                        <div class="card pivot-table-card">
                            <h3>Consumo por fonograma</h3>
                            <div class="pivot-table-scroll" id="artistFonogramaTableContainer-${entry.uid}"></div>
                        </div>
                        <div class="card pivot-chart-card">
                            <h3>Consumo por fonograma</h3>
                            <div class="pivot-chart-canvas-wrap"><canvas id="artistFonogramaChart-${entry.uid}"></canvas></div>
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

        const kpis = this.computeKpis(entry, entrada, saida);

        const kpisEl = itemEl.querySelector(".pivot-upload-item-kpis-inline");

        kpisEl.innerHTML = `
            <span>Período: <strong>${this.formatPeriodo(kpis)}</strong></span>
            <span>Total: <strong>${Math.round(kpis.total).toLocaleString("pt-BR")}</strong></span>
            <span>País destaque: <strong>${this.escapeHtml(kpis.paisDestaque)}</strong></span>
            <span>Destaque: <strong>${kpis.consumoDestaque === null ? "—" : Math.round(kpis.consumoDestaque).toLocaleString("pt-BR")}</strong></span>
            <span>Fonograma+: <strong>${this.escapeHtml(kpis.fonogramaMaisEscutado)}</strong></span>
        `;

    },

    renderEntryDetail(entry) {

        const paisTableEl = document.getElementById(`artistPaisTableContainer-${entry.uid}`);
        const paisCanvasEl = document.getElementById(`artistPaisChart-${entry.uid}`);
        const albumTableEl = document.getElementById(`artistAlbumTableContainer-${entry.uid}`);
        const albumCanvasEl = document.getElementById(`artistAlbumChart-${entry.uid}`);

        if (!paisTableEl || !albumTableEl) return;

        this.renderGroupTableInto(paisTableEl, entry.groupedPais, "País");
        entry.chartPais = this.renderBarChartInto(paisCanvasEl, entry.groupedPais, entry.chartPais);

        this.renderGroupTableInto(albumTableEl, entry.groupedAlbum, "Álbum");
        entry.chartAlbum = this.renderBarChartInto(albumCanvasEl, entry.groupedAlbum, entry.chartAlbum);

        this.renderFonogramaDetail(entry);

        entry.detailRendered = true;

    },

    renderFonogramaDetail(entry) {

        const tableEl = document.getElementById(`artistFonogramaTableContainer-${entry.uid}`);
        const canvasEl = document.getElementById(`artistFonogramaChart-${entry.uid}`);

        if (!tableEl) return;

        const grouped = ArtistData.groupByFonograma(entry.rows, entry.albumFiltro);

        this.renderGroupTableInto(tableEl, grouped, "Fonograma");
        entry.chartFonograma = this.renderBarChartInto(canvasEl, grouped, entry.chartFonograma);

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

        const el = document.getElementById(`artistUploadStatus-${entry.uid}`);

        if (el) el.title = entry.error || "";
        if (el) el.textContent = this.statusLabel(entry.status);

    },

    /* ======================================================
       TABELA / GRÁFICO GENÉRICOS
    ====================================================== */

    renderGroupTableInto(container, grouped, labelHeader) {

        const totalGeral = grouped.reduce((sum, item) => sum + item.total, 0);

        const body = grouped.map(item => `
            <tr>
                <td>${this.escapeHtml(item.key)}</td>
                <td>${Math.round(item.total).toLocaleString("pt-BR")}</td>
            </tr>
        `).join("");

        container.innerHTML = `
            <table class="goals-table">
                <thead>
                    <tr>
                        <th>${labelHeader}</th>
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

    renderBarChartInto(canvas, grouped, existingChart) {

        if (existingChart) existingChart.destroy();

        if (!canvas) return null;

        const top = grouped.slice(0, this.TOP_N_CHART);

        return new Chart(canvas, {

            type: "bar",

            data: {

                labels: top.map(item => item.key),

                datasets: [{
                    label: "Consumo",
                    data: top.map(item => item.total),
                    backgroundColor: top.map((item, index) => index === 0 ? "#E30613" : "#999999")
                }]

            },

            options: {

                indexAxis: "y",
                responsive: true,
                maintainAspectRatio: false,

                plugins: {
                    legend: { display: false }
                },

                scales: {
                    x: { beginAtZero: true }
                }

            }

        });

    },

    /* ======================================================
       COMPARATIVO ENTRE ARTISTAS (sob demanda, só as marcadas)
    ====================================================== */

    toggleCompare() {

        this._compareVisible = !this._compareVisible;

        document.getElementById("artistCompareSection").style.display = this._compareVisible ? "" : "none";

        if (this._compareVisible) this.renderComparison();

    },

    renderComparison() {

        const tableContainer = document.getElementById("artistCompareTableContainer");
        const chartWrap = document.getElementById("artistCompareChart").closest(".pivot-chart-canvas-wrap");

        const selected = this._uploads.filter(entry => entry.selected);

        if (selected.length < 2) {

            tableContainer.innerHTML = `<p class="analises-empty">Marque pelo menos 2 artistas (checkbox à esquerda) pra comparar.</p>`;

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

            const kpis = this.computeKpis(entry, entrada, saida);

            return `
                <tr>
                    <td>${this.escapeHtml(entry.artista)}</td>
                    <td>${this.escapeHtml(entry.artistaId)}</td>
                    <td>${Math.round(kpis.total).toLocaleString("pt-BR")}</td>
                    <td>${this.escapeHtml(kpis.paisDestaque)}</td>
                    <td>${kpis.consumoDestaque === null ? "—" : Math.round(kpis.consumoDestaque).toLocaleString("pt-BR")}</td>
                    <td>${this.escapeHtml(kpis.fonogramaMaisEscutado)}</td>
                </tr>
            `;

        }).join("");

        tableContainer.innerHTML = `
            <table class="goals-table">
                <thead>
                    <tr>
                        <th>Artista</th>
                        <th>ID</th>
                        <th>Consumo total</th>
                        <th>País destaque</th>
                        <th>Consumo destaque</th>
                        <th>Fonograma mais escutado</th>
                    </tr>
                </thead>
                <tbody>${rowsHtml}</tbody>
            </table>
        `;

        const palette = ["#E30613", "#1F6FEB", "#2EA043", "#D29922", "#8957E5", "#DB6D28", "#39C5CF", "#F778BA"];

        const canvas = document.getElementById("artistCompareChart");

        if (this._compareChart) this._compareChart.destroy();

        this._compareChart = new Chart(canvas, {

            type: "bar",

            data: {
                labels: selected.map(entry => entry.artista),
                datasets: [{
                    label: "Consumo total",
                    data: selected.map(entry => entry.rows.reduce((sum, row) => sum + row.quantidade, 0)),
                    backgroundColor: selected.map((entry, index) => palette[index % palette.length])
                }]
            },

            options: {
                indexAxis: "y",
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: { x: { beginAtZero: true } }
            }

        });

    },

    /* ======================================================
       ENVIO — gera a Sheet de verdade via Apps Script, um
       artista marcado de cada vez (sequencial).
    ====================================================== */

    async submitEntry(entry) {

        const { entrada, saida } = this.getEntryEntradaSaida(entry);

        const kpis = this.computeKpis(entry, entrada, saida);

        const payload = {

            token: CONFIG.ARTIST_UPLOAD.sharedSecret,

            artistaId: entry.artistaId,
            artista: entry.artista,

            entrada: entrada ? ArtistData.dateKey(entrada) : "",
            saida: saida ? ArtistData.dateKey(saida) : "",

            tipoDestaque: this.getTipoDestaque().join(", "),

            paisDestaque: kpis.paisDestaque,
            fonogramaMaisEscutado: kpis.fonogramaMaisEscutado,
            consumoTotal: kpis.total,
            consumoDestaque: kpis.consumoDestaque === null ? "" : kpis.consumoDestaque,

            rows: entry.rows.map(row => ({
                data: ArtistData.dateKey(row.data),
                artistaId: row.artistaId,
                artista: row.artista,
                album: row.album,
                fonogramaId: row.fonogramaId,
                fonograma: row.fonograma,
                gravadora: row.gravadora,
                produto: row.produto,
                pais: row.pais,
                quantidade: row.quantidade
            }))

        };

        const response = await fetch(CONFIG.ARTIST_UPLOAD.webAppUrl, {

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

        const status = document.getElementById("artistSubmitStatus");
        const btn = document.getElementById("artistSubmitBtn");

        const selected = this._uploads.filter(entry => entry.selected);

        if (!selected.length) {

            alert("Marque ao menos um artista (checkbox à esquerda) pra enviar.");
            return;

        }

        if (!CONFIG.ARTIST_UPLOAD.webAppUrl) {

            status.textContent = "Geração ainda não configurada (CONFIG.ARTIST_UPLOAD.webAppUrl vazia).";
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

                console.error("[ArtistDashboard]", error);
                entry.status = "error";
                entry.error = error.message;
                failed += 1;

            }

            this.updateEntryStatusUI(entry);

            done += 1;

        }

        btn.disabled = false;

        status.textContent = failed
            ? `✔ ${done - failed} de ${done} enviados pro Drive — ${failed} falharam (veja o status de cada linha).`
            : `✔ ${done} artista${done === 1 ? "" : "s"} enviado${done === 1 ? "" : "s"} pro Drive!`;

        try {

            await ArtistData.loadHistorico();
            this.renderHistoryList(ArtistData.historico);

        }
        catch (error) {

            console.error("[ArtistDashboard]", error);

        }

    },

    /* ======================================================
       HISTÓRICO
    ====================================================== */

    filterHistory(query) {

        const normalized = String(query || "").trim().toLowerCase();

        const filtered = !normalized
            ? ArtistData.historico
            : ArtistData.historico.filter(row =>
                row.artistaId.toLowerCase().includes(normalized) ||
                row.artista.toLowerCase().includes(normalized)
            );

        this.renderHistoryList(filtered);

    },

    renderHistoryList(rows) {

        this._historyFiltered = rows;

        const container = document.getElementById("artistHistoryList");

        if (!rows.length) {

            container.innerHTML = `<p class="analises-empty">Nenhum artista no histórico ainda.</p>`;
            return;

        }

        const sorted = [...rows].sort((a, b) => (b.dataInicio || 0) - (a.dataInicio || 0));

        container.innerHTML = sorted.map((row, index) => `
            <div class="pivot-history-item" data-index="${index}">
                <div class="pivot-history-item-main">
                    <strong>${this.escapeHtml(row.artista)}</strong>
                    <span class="pivot-history-item-id">ID ${this.escapeHtml(row.artistaId)}</span>
                </div>
                <div class="pivot-history-item-period">
                    ${ArtistData.formatDateBR(row.dataInicio)} – ${ArtistData.formatDateBR(row.dataFim)}
                </div>
                <div class="pivot-history-item-consumo">
                    Total: ${Math.round(row.consumoTotal).toLocaleString("pt-BR")} · País destaque: ${this.escapeHtml(row.paisDestaque || "—")}
                </div>
            </div>
        `).join("");

        Array.from(container.querySelectorAll(".pivot-history-item")).forEach((el, index) => {

            el.addEventListener("click", () => this.openHistoryModal(sorted[index]));

        });

    },

    openHistoryModal(row) {

        this._activeHistoryRow = row;

        document.getElementById("artistHistoryModalTitle").textContent = row.artista;

        document.getElementById("artistHistoryModalSubtitle").textContent =
            `ID ${row.artistaId} · ${ArtistData.formatDateBR(row.dataInicio)} a ${ArtistData.formatDateBR(row.dataFim)}` +
            (row.entrada && row.saida ? ` · Destaque: ${ArtistData.formatDateBR(row.entrada)} a ${ArtistData.formatDateBR(row.saida)}` : "");

        document.getElementById("artistHistoryKpiTotal").textContent = Math.round(row.consumoTotal).toLocaleString("pt-BR");
        document.getElementById("artistHistoryKpiPais").textContent = row.paisDestaque || "—";
        document.getElementById("artistHistoryKpiDestaque").textContent = row.consumoDestaque ? Math.round(row.consumoDestaque).toLocaleString("pt-BR") : "—";
        document.getElementById("artistHistoryKpiFonograma").textContent = row.fonogramaMaisEscutado || "—";

        const tipoEl = document.getElementById("artistHistoryTipoDestaque");

        tipoEl.textContent = row.tipoDestaque ? `Tipo de destaque: ${row.tipoDestaque}` : "";

        document.getElementById("artistHistoryOpenDrive").href = row.driveUrl || "#";

        document.getElementById("artistHistoryDownload").href = row.driveFileId
            ? `https://docs.google.com/spreadsheets/d/${row.driveFileId}/export?format=xlsx`
            : "#";

        document.getElementById("artistHistoryModal").classList.add("open");

        this.loadHistoryVisual(row);

    },

    loadHistoryVisual(row) {

        const visualSection = document.getElementById("artistHistoryVisual");
        const statusEl = document.getElementById("artistHistoryVisualStatus");

        visualSection.style.display = "none";

        Object.values(this._historyCharts).forEach(chart => chart && chart.destroy());
        this._historyCharts = {};

        if (!row.driveFileId) {
            statusEl.textContent = "";
            return;
        }

        statusEl.textContent = "Carregando gráficos e tabelas...";

        ArtistData.fetchDadosCsv(row.driveFileId)
            .then(({ rows }) => {

                if (this._activeHistoryRow !== row) return;

                const groupedPais = ArtistData.groupByPais(rows);
                const groupedAlbum = ArtistData.groupByAlbum(rows);
                const groupedFonograma = ArtistData.groupByFonograma(rows);

                this.renderGroupTableInto(document.getElementById("artistHistoryPaisTableContainer"), groupedPais, "País");
                this._historyCharts.pais = this.renderBarChartInto(document.getElementById("artistHistoryPaisChart"), groupedPais, null);

                this.renderGroupTableInto(document.getElementById("artistHistoryAlbumTableContainer"), groupedAlbum, "Álbum");
                this._historyCharts.album = this.renderBarChartInto(document.getElementById("artistHistoryAlbumChart"), groupedAlbum, null);

                this.renderGroupTableInto(document.getElementById("artistHistoryFonogramaTableContainer"), groupedFonograma, "Fonograma");
                this._historyCharts.fonograma = this.renderBarChartInto(document.getElementById("artistHistoryFonogramaChart"), groupedFonograma, null);

                visualSection.style.display = "";
                statusEl.textContent = "";

            })
            .catch(error => {

                console.error("[ArtistDashboard]", error);

                if (this._activeHistoryRow !== row) return;

                statusEl.textContent = "";

            });

    },

    closeHistoryModal() {

        document.getElementById("artistHistoryModal").classList.remove("open");

        document.getElementById("artistHistoryVisual").style.display = "none";
        document.getElementById("artistHistoryVisualStatus").textContent = "";

        Object.values(this._historyCharts).forEach(chart => chart && chart.destroy());
        this._historyCharts = {};

        this._activeHistoryRow = null;

    },

    escapeHtml(text) {

        return String(text || "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");

    },

    escapeAttr(text) {

        return this.escapeHtml(text).replace(/"/g, "&quot;");

    }

};
