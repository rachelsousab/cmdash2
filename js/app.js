/* ==========================================================
   CLARO MÚSICA DASHBOARD
   APP MODULE
   Part 1 / 3
========================================================== */

const Dashboard = {

    initialized: false,

    /* ======================================================
       INITIALIZATION
    ====================================================== */

    /* ======================================================
       BOOTSTRAP

       Chamado pelo auth.js depois do login (ou de cara, se a
       sessão já estiver autenticada). Carrega as 3 bases em
       paralelo — assim a Visão Geral já nasce com números
       reais, e trocar de aba depois é instantâneo.
    ====================================================== */

    async bootstrap() {

        this.showLoading();

        try {

            // Destaques de gravadoras (36 mil+ linhas) NÃO entra aqui —
            // carrega sob demanda só quando a aba é aberta (ver
            // setActivePage). Marketing e Redes Sociais são pequenos e
            // entram de cara.
            await Promise.all([
                dataLoader.init(),
                SocialDashboard.init()
            ]);

            this.init();

            // restoreActiveTab() já dispara o refresh da aba certa
            // (Marketing, Destaques ou Redes Sociais).
            this.restoreActiveTab();

        }

        catch (error) {

            console.error(error);

            this.showError("Erro ao iniciar o Dashboard.");

        }

        this.hideLoading();

        console.log("✔ Dashboard carregado com sucesso.");

    },

    async init() {

        console.log("Inicializando dashboard...");

        this.bindGlobalEvents();

        this.bindPageNavigation();

        this.bindKpiDrilldowns();

        this.bindDrilldownModalEvents();

        // Liga o clique nas tabelas de país (Goals) ao modal
        Goals.onDrilldownRequest = (rows, title) => {

            this.openDrilldown(rows, title);

        };

        this.bindMarketingPeriodToggle();

        this.bindMarketingSubtabs();

        this.bindPivotSubtabs();

        this.bindRecentCompletedFilter();

        ManualActionsForm.init();

        Canal500Form.init();

        this.setDefaultYearFilter();

        this.updateLastRefresh();

        this.initialized = true;

        this.refresh();

    },

    /* ======================================================
       MARKETING: TOGGLE "ANO ATUAL / TOTAL"

       Mesma lógica do toggle "Mês atual/Total" da Visão Geral:
       controla o MESMO estado que o filtro "Ano" da sidebar
       (não é uma camada de filtro separada) — assim os dois
       nunca entram em contradição um com o outro.
    ====================================================== */

    bindMarketingPeriodToggle() {

        const yearBtn = document.getElementById("summaryYear");

        const totalBtn = document.getElementById("summaryTotal");

        const yearSelect = document.getElementById("filterYear");

        const applyYear = (value) => {

            APP.filters.year = value;

            if (yearSelect) yearSelect.value = value;

            dataLoader.applyFilters();

            this.syncYearToggleUI();

            this.refresh();

        };

        if (yearBtn) {

            yearBtn.addEventListener("click", () => {

                applyYear(String(new Date().getFullYear()));

            });

        }

        if (totalBtn) {

            totalBtn.addEventListener("click", () => {

                applyYear("Todos");

            });

        }

        // Se o filtro Ano da sidebar for trocado direto, mantém os
        // botões sincronizados com o que está realmente filtrado.
        if (yearSelect) {

            yearSelect.addEventListener("change", () => {

                this.syncYearToggleUI();

            });

        }

    },

    /* ======================================================
       MARKETING: ESTADO INICIAL DO FILTRO ANO

       "Ano Atual" só vira o padrão se o ano corrente já tiver
       dados (funciona sozinho nos próximos anos, conforme mais
       dados forem entrando); senão cai em "Total".
    ====================================================== */

    setDefaultYearFilter() {

        const currentYear = String(new Date().getFullYear());

        const available = dataLoader.getAvailableYears().map(String);

        const yearSelect = document.getElementById("filterYear");

        const value = available.includes(currentYear) ? currentYear : "Todos";

        APP.filters.year = value;

        if (yearSelect) yearSelect.value = value;

        this.syncYearToggleUI();

    },

    /* ======================================================
       MARKETING: SUB-ABAS "AÇÕES" / "METAS DO ANO"

       Os filtros da sidebar continuam sendo os mesmos (mesmo
       grupo #marketingFilterGroup) — só ficam desabilitados
       visualmente na sub-aba de Metas, porque não faz sentido
       filtrar um quadro de metas anual por Detalhe/Gravadora/
       etc. (as tabelas de Metas já somam TUDO daquele ano).
    ====================================================== */

    marketingSubtab: "actions",

    bindMarketingSubtabs() {

        document.querySelectorAll(".marketing-subtab").forEach(button => {

            button.addEventListener("click", () => {

                this.setMarketingSubtab(button.dataset.subtab);

            });

        });

        this.setMarketingSubtab("actions");

    },

    setMarketingSubtab(subtab) {

        this.marketingSubtab = subtab;

        document.querySelectorAll(".marketing-subtab").forEach(button => {

            button.classList.toggle("active", button.dataset.subtab === subtab);

        });

        document.querySelectorAll(".marketing-subpage").forEach(page => {

            page.classList.toggle("active", page.id === `marketing-subpage-${subtab}`);

        });

        const filterGroup = document.getElementById("marketingFilterGroup");

        if (filterGroup) {

            const disabled = subtab === "goals";

            filterGroup.classList.toggle("filters-disabled", disabled);

            filterGroup.title = disabled
                ? "Não é possível filtrar as metas do ano — os quadros já somam o ano inteiro."
                : "";

        }

    },

    /* ======================================================
       CONSUMO: SUB-ABAS "CONSUMO POR PLAYLIST" / "CONSUMO POR
       ARTISTA" — mesmo mecanismo de bindMarketingSubtabs acima,
       só que duplicado (não generalizado) pra não arriscar
       regressão no fluxo de Marketing, que já está em produção.
    ====================================================== */

    pivotSubtab: "playlist",

    bindPivotSubtabs() {

        document.querySelectorAll(".pivot-subnav .marketing-subtab").forEach(button => {

            button.addEventListener("click", () => {

                this.setPivotSubtab(button.dataset.pivotSubtab);

            });

        });

        this.setPivotSubtab("playlist");

    },

    setPivotSubtab(subtab) {

        this.pivotSubtab = subtab;

        document.querySelectorAll(".pivot-subnav .marketing-subtab").forEach(button => {

            button.classList.toggle("active", button.dataset.pivotSubtab === subtab);

        });

        document.querySelectorAll("#page-pivot .marketing-subpage").forEach(page => {

            page.classList.toggle("active", page.id === `pivot-subpage-${subtab}`);

        });

        if (subtab === "artista" && typeof ArtistDashboard !== "undefined") {

            ArtistDashboard.init();

        }

    },

    syncYearToggleUI() {

        const yearBtn = document.getElementById("summaryYear");

        const totalBtn = document.getElementById("summaryTotal");

        const currentYear = String(new Date().getFullYear());

        const value = APP.filters.year;

        if (yearBtn) yearBtn.classList.toggle("active", value === currentYear);

        if (totalBtn) totalBtn.classList.toggle("active", value === "Todos");

    },

/* ======================================================
   PAGE NAVIGATION

   Cada aba tem seu próprio grupo de filtros na sidebar
   (ou nenhum, no caso da Visão Geral). A aba ativa é
   salva na sessionStorage pra sobreviver a um F5.
====================================================== */

setActivePage(page) {

    const sidebar = document.querySelector(".sidebar");
    const main = document.querySelector("main");

    const filterGroups = {

        marketing: document.getElementById("marketingFilterGroup"),
        social: document.getElementById("socialFilterGroup"),
        labels: document.getElementById("highlightsFilterGroup"),
        analises: document.getElementById("analisesFilterGroup"),
        canal500: document.getElementById("canal500FilterGroup")

    };

    if (filterGroups[page]) {

        sidebar.style.display = "";

        main.classList.remove("full-width");

        Object.entries(filterGroups).forEach(([groupPage, group]) => {

            if (group) group.style.display = (groupPage === page) ? "" : "none";

        });

    } else {

        sidebar.style.display = "none";

        main.classList.add("full-width");

    }

    document.querySelectorAll(".page-tab").forEach(tab => {

        tab.classList.toggle("active", tab.dataset.page === page);

    });

    document.querySelectorAll(".page").forEach(pageElement => {

        pageElement.classList.toggle("active", pageElement.id === `page-${page}`);

    });

    if (page === "social") {

        SocialDashboard
            .init()
            .then(() => SocialDashboard.refresh())
            .catch(console.error);

    }

    if (page === "labels") {

        HighlightsDashboard
            .init()
            .then(() => HighlightsDashboard.refresh())
            .catch(console.error);

    }

    if (page === "analises") {

        AnalisesDashboard
            .init()
            .then(() => AnalisesDashboard.refresh())
            .catch(console.error);

    }

    if (page === "report") {

        ReportDashboard
            .init()
            .then(() => ReportDashboard.refresh())
            .catch(console.error);

    }

    if (page === "pivot") {

        PivotDashboard.init();

    }

    if (page === "canal500") {

        (Canal500Data.isLoaded()
            ? Promise.resolve()
            : Canal500Data.load(CONFIG.CANAL500_DATA.csvUrl))
            .then(() => this.refreshCanal500())
            .catch(console.error);

    }

    sessionStorage.setItem("cm_active_tab", page);

},

bindPageNavigation() {

    document.querySelectorAll(".page-tab").forEach(button => {

        button.addEventListener("click", () => {

            this.setActivePage(button.dataset.page);

        });

    });

},

/* ======================================================
   RESTAURA A ÚLTIMA ABA ATIVA (sessionStorage)
====================================================== */

restoreActiveTab() {

    const stored = sessionStorage.getItem("cm_active_tab") || "marketing";

    const exists = document.querySelector(`.page-tab[data-page="${stored}"]`);

    this.setActivePage(exists ? stored : "marketing");

},

    /* ======================================================
       REFRESH
    ====================================================== */

    refresh() {

    if (!this.initialized) return;

    console.log("Atualizando dashboard...");

    const data = getData();

    this.updateKPIs(data);

    this.updateSummary(data);

    this.renderMiniActionTables(data);

    /* ===============================
       GESTÃO DE METAS
    =============================== */

    Goals.init(data);

    Goals.render();

    /* ===============================
       GRÁFICOS
    =============================== */

    this.updateCharts(data);

},

    /* ======================================================
       KPI UPDATE
    ====================================================== */

    updateKPIs(data) {

        const total = Metrics.getTotal(data);

const completed = Metrics.getCompleted(data);

const inProgress = Metrics.getInProgress(data);

const standby = Metrics.getStandby(data);

const cancelled = Metrics.getCancelled(data);

const phraseologies = data.filter(
    row => Metrics.isPhraseology(row) && row.status === CONFIG.STATUS.completed
).length;

        document.getElementById("kpiTotal").textContent =
            total.toLocaleString("pt-BR");

        document.getElementById("kpiDone").textContent =
            completed.toLocaleString("pt-BR");

        document.getElementById("kpiProgress").textContent =
            inProgress.toLocaleString("pt-BR");

        document.getElementById("kpiStandby").textContent =
            standby.toLocaleString("pt-BR");

        document.getElementById("kpiCanceled").textContent =
            cancelled.toLocaleString("pt-BR");

        document.getElementById("kpiPhraseologies").textContent =
            phraseologies.toLocaleString("pt-BR");

        document.getElementById("kpiSocialContent").textContent =
            this.kpiDrilldownMap.kpiSocialContent.filter(data).length.toLocaleString("pt-BR");

        document.getElementById("kpiCanal500").textContent =
            this.kpiDrilldownMap.kpiCanal500.filter(data).length.toLocaleString("pt-BR");

        document.getElementById("kpiTV").textContent =
            this.kpiDrilldownMap.kpiTV.filter(data).length.toLocaleString("pt-BR");

        document.getElementById("kpiClaroActions").textContent =
            this.kpiDrilldownMap.kpiClaroActions.filter(data).length.toLocaleString("pt-BR");

        // Os próximos KPIs serão calculados
        // em metrics.js

       document.getElementById("kpiConversion").textContent =
        Metrics.getConversionRate(data) + "%";

        document.getElementById("kpiTime").textContent =
        Metrics.getAverageExecutionTime(data) + " dias";

    },

    /* ======================================================
       DRILL-DOWN: DEFINIÇÃO DAS COLUNAS

       As mesmas colunas aparecem tanto no clique dos KPIs
       quanto no clique de um tipo de ação nas tabelas de país.
       "hideIfNotApplicable" faz a célula ficar em branco (em
       vez de mostrar o texto "Não se aplica") — de forma
       genérica, sem depender de uma lista fixa de gravadoras
       ou regionais.
    ====================================================== */

    drilldownColumns: [

        { key: "country", label: "País" },

        { key: "area", label: "Área" },

        { key: "detail", label: "Detalhe" },

        { key: "proposalDate", label: "Data da proposta", type: "date" },

        { key: "summary", label: "Resumo da ação" },

        { key: "label", label: "Gravadora", hideIfNotApplicable: true },

        { key: "regional", label: "Regional", hideIfNotApplicable: true },

        { key: "status", label: "Status" },

        { key: "owner", label: "Responsável" },

        { key: "initiative", label: "Iniciativa" },

        { key: "publishDate", label: "Data final / publicação", type: "date" },

        { key: "extra", label: "Informações extras", longText: true }

    ],

    /* ======================================================
       MARKETING: CAIXINHAS "ACONTECENDO AGORA" /
       "ÚLTIMAS AÇÕES CONCLUÍDAS"

       Mesmo componente de tabela do drill-down, só que fixo na
       tela (não é modal) — altura fixa com scroll interno, pra
       não estourar a página quando tiver muita coisa.
    ====================================================== */

    /* Gravadora e Regional concatenadas numa coluna só, pra
       economizar espaço — só mostra o que existir de cada uma
       (nenhuma das duas obrigatória). */
    buildGravadoraRegionalColumn(includeGravadora = true) {

        return {

            label: includeGravadora ? "Gravadora / Regional" : "Regional",

            render: (value, row) => {

                const parts = [];

                if (includeGravadora && row.label && !this.isNotApplicable(row.label)) {
                    parts.push(row.label);
                }

                if (row.regional && !this.isNotApplicable(row.regional)) {
                    parts.push(row.regional);
                }

                return parts.length ? parts.join(" / ") : "—";

            }

        };

    },

    /* Botão de editar (abre direto o formulário de edição/
       duplicação, igual à tela "Editar ação existente" — só
       que sem passar pela lista). Ações travadas (Barker/
       Trilho/Banner/BG) mostram um cadeado em vez do botão. */
    buildMiniEditColumn(rowsRef) {

        return {

            label: "",

            render: (value, row, index) => {

                const locked =
                    (typeof ManualActionsForm !== "undefined" && ManualActionsForm.isDetailLocked(row.detail)) ||
                    (typeof Metrics !== "undefined" && Metrics.isPhraseology(row));

                if (locked) {

                    return `<span class="mini-edit-locked" title="Não editável por aqui">🔒</span>`;

                }

                return `<button type="button" class="mini-edit-btn" data-rows-ref="${rowsRef}" data-index="${index}" title="Editar ação">✏️</button>`;

            }

        };

    },

    /* Status editável direto na mini-tabela (igual ao Canal 500) —
       rows travadas (Barker/Trilho/Banner/BG, Fraseologias),
       fundidas (vários canais) ou sem ID mostram só o texto. */
    buildMiniStatusColumn(rowsRef) {

        return {

            key: "status",
            label: "Status",

            render: (value, row, index) => {

                const statusLockMessage = typeof ManualActionsForm !== "undefined"
                    ? ManualActionsForm.getStatusLockMessage(row.detail)
                    : null;

                if (statusLockMessage) {
                    return `<span class="mini-status-locked" data-tooltip="${this.escapeHtml(statusLockMessage)}">${row.status || "—"}</span>`;
                }

                const locked =
                    row._merged ||
                    !row.id ||
                    (typeof ManualActionsForm !== "undefined" && ManualActionsForm.isDetailLocked(row.detail)) ||
                    (typeof Metrics !== "undefined" && Metrics.isPhraseology(row));

                if (locked) {
                    return row.status || "—";
                }

                return `<select class="mini-status-select c500-status-select" data-rows-ref="${rowsRef}" data-index="${index}">` +
                    CONFIG.MANUAL_ACTIONS.statuses.map(s =>
                        `<option value="${s}" ${s === row.status ? "selected" : ""}>${s}</option>`
                    ).join("") +
                    `</select>`;

            }

        };

    },

    buildMiniColumns({ dateKey, dateLabel, hideGravadora, rowsRef }) {

        return [

            { key: dateKey, label: dateLabel, type: "date" },

            { key: "summary", label: "Resumo da ação" },

            this.buildGravadoraRegionalColumn(!hideGravadora),

            { key: "detail", label: "Detalhe" },

            { key: "owner", label: "Responsável" },

            this.buildMiniStatusColumn(rowsRef),

            this.buildMiniEditColumn(rowsRef)

        ];

    },

    marketingRecentCompletedFilter: "marketing",

    bindRecentCompletedFilter() {

        const container = document.getElementById("recentCompletedFilter");

        if (!container) return;

        Array.from(container.querySelectorAll("button")).forEach(btn => {

            btn.addEventListener("click", () => {

                this.marketingRecentCompletedFilter = btn.dataset.filter;

                Array.from(container.querySelectorAll("button")).forEach(b => {
                    b.classList.toggle("active", b === btn);
                });

                this.renderMiniActionTables(getData());

            });

        });

    },

    /* Clique nos botões de editar e mudança no select de Status das
       mini-tabelas — delegado uma vez só; lê sempre o array ATUAL
       guardado em this._miniRows, então funciona mesmo depois de
       re-render. */
    bindMiniTableEditButtons() {

        [document.getElementById("inProgressBox"), document.getElementById("recentCompletedBox")]
            .filter(Boolean)
            .forEach(box => {

                if (box.dataset.editBound) return;

                box.dataset.editBound = "1";

                box.addEventListener("click", (event) => {

                    const btn = event.target.closest(".mini-edit-btn");

                    if (!btn) return;

                    const rows = this._miniRows && this._miniRows[btn.dataset.rowsRef];

                    const row = rows && rows[Number(btn.dataset.index)];

                    if (row && typeof ManualActionsForm !== "undefined") {

                        ManualActionsForm.openEditForm(row);

                    }

                });

                box.addEventListener("change", (event) => {

                    const select = event.target.closest(".mini-status-select");

                    if (!select) return;

                    const rows = this._miniRows && this._miniRows[select.dataset.rowsRef];

                    const row = rows && rows[Number(select.dataset.index)];

                    if (!row || typeof ManualActionsForm === "undefined") return;

                    const previousStatus = row.status;
                    const newStatus = select.value;

                    select.disabled = true;

                    ManualActionsForm.updateStatusQuick(row, newStatus)
                        .then(() => {

                            row.status = newStatus;
                            this.renderMiniActionTables(getData());

                        })
                        .catch(error => {

                            console.error(error);
                            alert(error.message || "Não foi possível atualizar o status. Tente de novo.");

                            select.value = previousStatus;
                            select.disabled = false;

                        });

                });

            });

    },

    _miniRows: {},

    renderMiniActionTables(data) {

        const inProgressBox = document.getElementById("inProgressBox");

        const recentCompletedBox = document.getElementById("recentCompletedBox");

        const byDateDesc = (dateKey) => (a, b) => {

            const da = a[dateKey] ? a[dateKey].getTime() : -Infinity;
            const db = b[dateKey] ? b[dateKey].getTime() : -Infinity;

            return db - da;

        };

        if (inProgressBox) {

            const rows = data
                .filter(row => row.status === CONFIG.STATUS.inProgress)
                .sort(byDateDesc("proposalDate"));

            this._miniRows.inProgress = rows;

            inProgressBox.innerHTML = rows.length
                ? this.buildDrilldownTable(rows, this.buildMiniColumns({
                    dateKey: "proposalDate",
                    dateLabel: "Data da proposta",
                    rowsRef: "inProgress"
                }))
                : "<p class='maf-empty'>Nenhuma ação em andamento neste recorte.</p>";

        }

        if (recentCompletedBox) {

            let rows = data.filter(row => row.status === CONFIG.STATUS.completed);

            const filter = this.marketingRecentCompletedFilter || "marketing";

            if (filter === "marketing") {

                rows = rows.filter(row => row.area !== "TV" && !Metrics.isPhraseology(row));

            }
            else if (filter === "tv") {

                rows = rows.filter(row => row.area === "TV");

            }
            else if (filter === "fraseologias") {

                rows = rows.filter(row => Metrics.isPhraseology(row));

            }
            else if (filter === "licenciamento") {

                rows = rows.filter(row => row.area === "Licenciamento");

            }

            // Concluída = ordena pela data de CONCLUSÃO (não a
            // da proposta) — é isso que faz "última" fazer sentido.
            rows.sort(byDateDesc("publishDate"));

            this._miniRows.recentCompleted = rows;

            recentCompletedBox.innerHTML = rows.length
                ? this.buildDrilldownTable(rows, this.buildMiniColumns({
                    dateKey: "publishDate",
                    dateLabel: "Data de conclusão",
                    hideGravadora: filter === "tv" || filter === "fraseologias",
                    rowsRef: "recentCompleted"
                }))
                : "<p class='maf-empty'>Nenhuma ação concluída neste recorte.</p>";

        }

        this.bindMiniTableEditButtons();

    },

    /* ======================================================
       DRILL-DOWN: HELPERS
    ====================================================== */

    isNotApplicable(value) {

        if (!value) {

            return false;

        }

        const normalized = String(value)
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .trim()
            .toLowerCase();

        return normalized === "nao se aplica";

    },

    formatDrilldownValue(row, column, index) {

        const value = row[column.key];

        if (column.render) {

            return column.render(value, row, index);

        }

        if (column.type === "date") {

            if (!value) {

                return "—";

            }

            return value.toLocaleDateString(
                CONFIG.DATE.locale
            );

        }

        if (!value) {

            return "—";

        }

        if (column.hideIfNotApplicable && this.isNotApplicable(value)) {

            return "";

        }

        if (column.longText && String(value).length > 80) {

            const safe = this.escapeHtml(String(value));

            return `<div class="dd-longtext"><div class="dd-longtext-content">${safe}</div><button type="button" class="dd-longtext-toggle">Ver mais</button></div>`;

        }

        return value;

    },

    escapeHtml(text) {

        const div = document.createElement("div");
        div.textContent = text;
        return div.innerHTML;

    },

    /* ======================================================
       DRILL-DOWN: ABRIR MODAL
    ====================================================== */

    openDrilldown(rows, title, columns = this.drilldownColumns, options = {}) {

        const modal = document.getElementById("drilldownModal");

        const titleEl = document.getElementById("drilldownTitle");

        const countEl = document.getElementById("drilldownCount");

        const tableWrapper = document.getElementById("drilldownTableWrapper");

        const toggleWrap = document.getElementById("drilldownPhraseologyToggle");

        const checkbox = document.getElementById("drilldownPhraseologyCheckbox");

        if (!modal || !titleEl || !tableWrapper) {

            console.warn("Modal de drill-down não encontrado no HTML.");

            return;

        }

        titleEl.textContent = title;

        // Mais recente pra mais antiga (pela Data da proposta) em
        // todo detalhamento aberto por clique num KPI/gráfico.
        rows = [...rows].sort((a, b) => {

            const da = a.proposalDate ? a.proposalDate.getTime() : -Infinity;
            const db = b.proposalDate ? b.proposalDate.getTime() : -Infinity;

            return db - da;

        });

        // Guarda o conjunto completo (nunca muda) — o checkbox só
        // afeta o que é MOSTRADO na tabela, a contagem do topo
        // continua sempre representando o total real.
        this._drilldownState = { allRows: rows, columns };

        const allowToggle = !!options.allowPhraseologyToggle;

        if (toggleWrap) toggleWrap.style.display = allowToggle ? "" : "none";

        if (checkbox) checkbox.checked = false;

        if (allowToggle) {

            const phraseologyCount = rows.filter(r => Metrics.isPhraseology(r)).length;
            const marketingCount = rows.length - phraseologyCount;

            countEl.textContent =
                `${rows.length} ações encontradas no total — ${phraseologyCount} fraseologias — ${marketingCount} ações de marketing`;

        }
        else {

            const base = `${rows.length} ${rows.length === 1 ? "ação encontrada" : "ações encontradas"}`;

            const extra = options.extraCountText ? options.extraCountText(rows) : "";

            countEl.textContent = extra ? `${base} — ${extra}` : base;

        }

        this.renderDrilldownTable();

        if (checkbox && !checkbox.dataset.bound) {

            checkbox.dataset.bound = "1";

            checkbox.addEventListener("change", () => this.renderDrilldownTable());

        }

        if (!tableWrapper.dataset.longtextBound) {

            tableWrapper.dataset.longtextBound = "1";

            tableWrapper.addEventListener("click", (event) => {

                const btn = event.target.closest(".dd-longtext-toggle");

                if (!btn) return;

                const wrap = btn.closest(".dd-longtext");
                const expanded = wrap.classList.toggle("dd-longtext-expanded");

                btn.textContent = expanded ? "Ver menos" : "Ver mais";

            });

        }

        modal.classList.add("open");

        document.body.classList.add("modal-open");

    },

    /* ======================================================
       DRILL-DOWN: (RE)RENDERIZA A TABELA
       Reaplica o filtro de fraseologias (se o checkbox estiver
       marcado) em cima do conjunto completo guardado — não mexe
       na contagem do cabeçalho.
    ====================================================== */

    renderDrilldownTable() {

        const tableWrapper = document.getElementById("drilldownTableWrapper");

        const checkbox = document.getElementById("drilldownPhraseologyCheckbox");

        if (!tableWrapper || !this._drilldownState) return;

        const { allRows, columns } = this._drilldownState;

        const hidePhraseologies =
            !!checkbox && checkbox.checked && checkbox.closest("label").style.display !== "none";

        const rows = hidePhraseologies
            ? allRows.filter(r => !Metrics.isPhraseology(r))
            : allRows;

        tableWrapper.innerHTML = rows.length
            ? this.buildDrilldownTable(rows, columns)
            : "<p>Nenhuma ação encontrada para este recorte.</p>";

    },

    /* ======================================================
       DRILL-DOWN: MONTAR TABELA
    ====================================================== */

    buildDrilldownTable(rows, columns = this.drilldownColumns) {

        const headerHtml = columns
            .map(column => `<th>${column.label}</th>`)
            .join("");

        const bodyHtml = rows.map((row, index) => {

            const cells = columns
                .map(column => `<td>${this.formatDrilldownValue(row, column, index)}</td>`)
                .join("");

            return `<tr>${cells}</tr>`;

        }).join("");

        return (
            `<table class="drilldown-table">` +
            `<thead><tr>${headerHtml}</tr></thead>` +
            `<tbody>${bodyHtml}</tbody>` +
            `</table>`
        );

    },

    /* ======================================================
       DRILL-DOWN: FECHAR MODAL
    ====================================================== */

    closeDrilldown() {

        const modal = document.getElementById("drilldownModal");

        if (!modal) return;

        modal.classList.remove("open");

        document.body.classList.remove("modal-open");

    },

    /* ======================================================
       DRILL-DOWN: MAPA DE KPIs CLICÁVEIS
    ====================================================== */

    kpiDrilldownMap: {

        kpiTotal: {

            title: "Total de ações propostas",

            filter: data => data,

            allowPhraseologyToggle: true

        },

        kpiDone: {

            title: "Ações finalizadas/concluídas",

            filter: data => data.filter(
                row => row.status === CONFIG.STATUS.completed
            ),

            allowPhraseologyToggle: true

        },

        kpiProgress: {

            title: "Ações em andamento",

            filter: data => data.filter(
                row => row.status === CONFIG.STATUS.inProgress
            )

        },

        kpiStandby: {

            title: "Ações em standby",

            filter: data => data.filter(
                row => row.status === CONFIG.STATUS.standby
            )

        },

        kpiCanceled: {

            title: "Ações canceladas",

            filter: data => data.filter(
                row => row.status === CONFIG.STATUS.cancelled
            )

        }

        ,

        kpiPhraseologies: {

            title: "Fraseologias feitas",

            filter: data => data.filter(
                row => Metrics.isPhraseology(row) && row.status === CONFIG.STATUS.completed
            )

        },

        kpiSocialContent: {

            title: "Conteúdos para redes sociais",

            filter: data => data.filter(
                row => row.status === CONFIG.STATUS.completed &&
                    splitMultiValue(row.detail).includes("Conteúdo para redes sociais")
            )

        },

        kpiCanal500: {

            title: "Canal 500",

            filter: data => data.filter(
                row => row.status === CONFIG.STATUS.completed &&
                    splitMultiValue(row.detail).includes("Canal 500")
            )

        },

        kpiTV: {

            title: "TV",

            filter: data => data.filter(
                row => row.status === CONFIG.STATUS.completed &&
                    splitMultiValue(row.detail).some(d => Dashboard.TV_DETAILS.includes(d))
            ),

            extraCountText: rows => Dashboard.TV_DETAILS
                .map(detail => `${Dashboard.TV_DETAIL_LABELS[detail]}: ${
                    rows.filter(row => splitMultiValue(row.detail).includes(detail)).length
                }`)
                .join(" · ")

        },

        kpiClaroActions: {

            title: "Ações com a Claro",

            filter: data => data.filter(
                row => row.status === CONFIG.STATUS.completed &&
                    splitMultiValue(row.detail).some(d => Dashboard.CLARO_DETAILS.includes(d))
            )

        }

    },

    TV_DETAILS: [
        "Banner: Seção de Música",
        "Banner: Seção da Home",
        "Barker: Seção de Música",
        "BG: Seção de Música",
        "Trilho: Seção de Música"
    ],

    TV_DETAIL_LABELS: {
        "Banner: Seção de Música": "Banners (Música)",
        "Banner: Seção da Home": "Banners (Home)",
        "Barker: Seção de Música": "Barkers",
        "BG: Seção de Música": "BG",
        "Trilho: Seção de Música": "Trilhos"
    },

    CLARO_DETAILS: [
        "Eventos institucionais/Patrocínio",
        "LinkedIn (Claro)",
        "Site Bora",
        "TV Corporativa",
        "Vídeo institucional"
    ],

    /* ======================================================
       DRILL-DOWN: LIGAR CLIQUES NOS KPIs
    ====================================================== */

    bindKpiDrilldowns() {

        Object.entries(this.kpiDrilldownMap).forEach(([cardId, config]) => {

            const card = document.getElementById(cardId);

            if (!card) return;

            const clickable = card.closest(".kpi-card") || card;

            clickable.classList.add("clickable-kpi");

            clickable.addEventListener("click", () => {

                const rows = config.filter(getData());

                this.openDrilldown(rows, config.title, this.drilldownColumns, {
                    allowPhraseologyToggle: !!config.allowPhraseologyToggle,
                    extraCountText: config.extraCountText
                });

            });

        });

    },

    /* ======================================================
       DRILL-DOWN: LIGAR FECHAMENTO DO MODAL
    ====================================================== */

    bindDrilldownModalEvents() {

        const modal = document.getElementById("drilldownModal");

        if (!modal) return;

        const closeButton = document.getElementById("drilldownClose");

        if (closeButton) {

            closeButton.addEventListener("click", () => {

                this.closeDrilldown();

            });

        }

        modal.addEventListener("click", (event) => {

            if (event.target === modal) {

                this.closeDrilldown();

            }

        });

        document.addEventListener("keydown", (event) => {

            if (
                event.key === "Escape" &&
                modal.classList.contains("open")
            ) {

                this.closeDrilldown();

            }

        });

    },

    /* ======================================================
       SUMMARY
    ====================================================== */

    updateSummary(data) {

        const total = data.length;

        const completed = data.filter(
            row => row.status === CONFIG.STATUS.completed
        ).length;

        const text = Metrics.getExecutiveSummary(data);

        document.getElementById(
            "summaryText"
        ).textContent = text;

    },
        /* ======================================================
       CHARTS
    ====================================================== */

    updateCharts(data) {

        // Enquanto charts.js não existir,
        // evitamos erro.

        if (typeof Charts === "undefined") {

            console.log("Charts module ainda não carregado.");

            return;

        }

        Charts.renderAll(data);

    },

    /* ======================================================
       LAST UPDATE
    ====================================================== */

    updateLastRefresh() {

        const element =
            document.getElementById("last-update");

        if (!element) return;

        const now = new Date();

        element.textContent =
            "Atualizado em " +
            now.toLocaleDateString(
                CONFIG.DATE.locale
            ) +
            " às " +
            now.toLocaleTimeString(
                CONFIG.DATE.locale,
                {
                    hour: "2-digit",
                    minute: "2-digit"
                }
            );

    },

    /* ======================================================
       BUTTONS
    ====================================================== */

    bindGlobalEvents() {

        const refreshButton =
            document.getElementById(
                "refreshButton"
            );

        if (refreshButton) {

            refreshButton.addEventListener(
                "click",

                async () => {

                    refreshButton.disabled = true;

                    refreshButton.textContent =
                        "Atualizando...";

                    try {

                        await reloadData();

                        this.updateLastRefresh();

                        this.refresh();

                    }

                    catch (error) {

                        console.error(error);

                    }

                    refreshButton.disabled = false;

                    refreshButton.textContent =
                        "Atualizar";

                }

            );

        }

        // Delegado no documento (não direto no botão) — mais
        // robusto a qualquer re-render da sidebar acontecer
        // entre o bootstrap e o clique.
        document.addEventListener("click", (event) => {

            if (event.target.closest("#clearFiltersBtn")) {

                this.clearActiveFilters();

            }

        });

    },

    /* ======================================================
       LIMPAR FILTROS

       Reseta os <select> do grupo de filtros ATUALMENTE visível
       na sidebar pro valor padrão ("Todos", ou o primeiro item)
       e dispara "change" em cada um — assim reaproveita o
       listener que cada página já tem, sem duplicar lógica de
       filtro por aba.
    ====================================================== */

    clearActiveFilters() {

        const activeGroup = Array.from(document.querySelectorAll(".filter-group"))
            .find(group => getComputedStyle(group).display !== "none");

        if (!activeGroup) return;

        Array.from(activeGroup.querySelectorAll("select")).forEach(select => {

            if (select.value === select.options[0]?.value) return;

            select.value = select.options[0]?.value ?? "";

            select.dispatchEvent(new Event("change"));

        });

    },

    /* ======================================================
       LOADING
    ====================================================== */

    showLoading() {

        document.body.classList.add(
            "loading"
        );

    },

    hideLoading() {

        document.body.classList.remove(
            "loading"
        );

    },

    /* ======================================================
       ERRORS
    ====================================================== */

    showError(message) {

        console.error(message);

        alert(message);

    },

    /* ======================================================
       CANAL 500
    ====================================================== */

    _canal500Rows: {},

    canal500Filters: {
        year: "Todos",
        label: "Todos",
        regional: "Todos",
        owner: "Todos",
        status: "Todos"
    },

    canal500FiltersPopulated: false,

    /* "Parceiro" é um campo só, que mistura valor de gravadora e
       de regional — pra filtrar por um ou outro, reaproveita a
       mesma classificação (tag) usada no formulário. */
    getCanal500ParceiroTag(value) {

        if (!this._canal500ParceiroTagMap) {

            this._canal500ParceiroTagMap = new Map(
                Canal500Form.getParceiroOptions().map(o => [o.value, o.tag])
            );

        }

        return this._canal500ParceiroTagMap.get(value) || null;

    },

    populateCanal500Filters() {

        if (this.canal500FiltersPopulated) return;

        const rows = Canal500Data.rows;

        const years = [...new Set(
            rows.filter(r => r.entrada).map(r => r.entrada.getFullYear())
        )].sort((a, b) => b - a);

        const gravadoras = [...new Set(
            rows.map(r => r.parceiro).filter(v => v && this.getCanal500ParceiroTag(v) === "gravadora")
        )].sort((a, b) => a.localeCompare(b, "pt-BR"));

        const regionais = [...new Set(
            rows.map(r => r.parceiro).filter(v => v && this.getCanal500ParceiroTag(v) === "regional")
        )].sort((a, b) => a.localeCompare(b, "pt-BR"));

        const owners = [...new Set(
            rows.flatMap(r => splitMultiValue(r.responsavel))
        )].sort((a, b) => a.localeCompare(b, "pt-BR"));

        this.fillCanal500Select("filterC500Year", years);
        this.fillCanal500Select("filterC500Label", gravadoras);
        this.fillCanal500Select("filterC500Regional", regionais);
        this.fillCanal500Select("filterC500Owner", owners);
        this.fillCanal500Select("filterC500Status", CONFIG.CANAL500_FORM.statusVeiculacao);

        this.canal500FiltersPopulated = true;

    },

    fillCanal500Select(id, values) {

        const select = document.getElementById(id);

        if (!select) return;

        select.innerHTML = `<option value="Todos">Todos</option>` +
            values.map(v => `<option value="${v}">${v}</option>`).join("");

        select.value = "Todos";

    },

    bindCanal500Filters() {

        const map = {
            filterC500Year: "year",
            filterC500Label: "label",
            filterC500Regional: "regional",
            filterC500Owner: "owner",
            filterC500Status: "status"
        };

        Object.entries(map).forEach(([id, key]) => {

            const select = document.getElementById(id);

            if (!select || select.dataset.bound) return;

            select.dataset.bound = "1";

            select.addEventListener("change", () => {

                this.canal500Filters[key] = select.value;
                this.refreshCanal500();

            });

        });

    },

    getCanal500FilteredRows() {

        const f = this.canal500Filters;

        return Canal500Data.rows.filter(row => {

            if (f.year !== "Todos" && (!row.entrada || row.entrada.getFullYear() !== Number(f.year))) return false;
            if (f.label !== "Todos" && row.parceiro !== f.label) return false;
            if (f.regional !== "Todos" && row.parceiro !== f.regional) return false;
            if (f.owner !== "Todos" && !splitMultiValue(row.responsavel).includes(f.owner)) return false;
            if (f.status !== "Todos" && row.statusVeiculacao !== f.status) return false;

            return true;

        });

    },

    refreshCanal500() {

        this.populateCanal500Filters();

        this.bindCanal500Filters();

        const currentYear = new Date().getFullYear();

        const filtered = this.getCanal500FilteredRows();

        const totalEl = document.getElementById("c500KpiTotalAno");
        const emVeiculacaoEl = document.getElementById("c500KpiEmVeiculacao");

        const totalAnoRows = filtered.filter(r => r.entrada && r.entrada.getFullYear() === currentYear);
        const emVeiculacaoAllRows = filtered.filter(r => r.statusVeiculacao === "Em veiculação");

        if (totalEl) totalEl.textContent = totalAnoRows.length.toLocaleString("pt-BR");
        if (emVeiculacaoEl) emVeiculacaoEl.textContent = emVeiculacaoAllRows.length.toLocaleString("pt-BR");

        this._canal500KpiRows = { totalAno: totalAnoRows, emVeiculacao: emVeiculacaoAllRows };

        const byDateDesc = key => (a, b) => {
            const da = a[key] ? a[key].getTime() : -Infinity;
            const db = b[key] ? b[key].getTime() : -Infinity;
            return db - da;
        };

        const emVeiculacao = filtered.filter(r => r.statusVeiculacao === "Em veiculação").sort(byDateDesc("saida"));
        const enviados = filtered.filter(r => r.statusVeiculacao === "Enviado").sort(byDateDesc("entrada"));
        const foraDoAr = filtered.filter(r => r.statusVeiculacao === "Fora do Ar").sort(byDateDesc("saida"));

        this._canal500Rows.emVeiculacao = emVeiculacao;
        this._canal500Rows.enviados = enviados;
        this._canal500Rows.foraDoAr = foraDoAr;

        this.renderCanal500Table("c500EmVeiculacaoBox", emVeiculacao, "emVeiculacao", { showProgress: true });
        this.renderCanal500Table("c500EnviadosBox", enviados, "enviados", { showProgress: false });
        this.renderCanal500Table("c500ForaDoArBox", foraDoAr, "foraDoAr", { showProgress: false });

        this.bindCanal500TableEvents();
        this.bindCanal500KpiClicks();

    },

    bindCanal500KpiClicks() {

        const map = {
            c500KpiTotalAno: { key: "totalAno", title: "Total enviado no ano" },
            c500KpiEmVeiculacao: { key: "emVeiculacao", title: "Vídeos em veiculação agora" }
        };

        Object.entries(map).forEach(([elId, config]) => {

            const el = document.getElementById(elId);

            if (!el) return;

            const card = el.closest(".kpi-card") || el;

            card.classList.add("clickable-kpi");

            if (card.dataset.c500Bound) return;

            card.dataset.c500Bound = "1";

            card.addEventListener("click", () => {

                const rows = this._canal500KpiRows[config.key] || [];

                this.openCanal500Drilldown(rows, config.title);

            });

        });

    },

    openCanal500Drilldown(rows, title) {

        const modal = document.getElementById("drilldownModal");
        const titleEl = document.getElementById("drilldownTitle");
        const countEl = document.getElementById("drilldownCount");
        const toggleWrap = document.getElementById("drilldownPhraseologyToggle");

        if (!modal || !titleEl || !countEl) return;

        titleEl.textContent = title;

        if (toggleWrap) toggleWrap.style.display = "none";

        countEl.textContent = `${rows.length} ${rows.length === 1 ? "vídeo encontrado" : "vídeos encontrados"}`;

        this._canal500Rows.drilldown = rows;

        this.renderCanal500Table("drilldownTableWrapper", rows, "drilldown", { showProgress: false });

        this.bindCanal500TableEvents();

        modal.classList.add("open");
        document.body.classList.add("modal-open");

    },

    formatCanal500Date(date) {

        if (!date) return "—";

        return date.toLocaleDateString("pt-BR");

    },

    renderCanal500Table(containerId, rows, sourceKey, options = {}) {

        const container = document.getElementById(containerId);

        if (!container) return;

        if (!rows.length) {

            container.innerHTML = "<p class='maf-empty'>Nenhum vídeo neste recorte.</p>";
            return;

        }

        const progressCol = options.showProgress
            ? "<th>Progresso</th>"
            : "";

        const headerHtml =
            "<th>Ação Prospectada</th>" +
            "<th>Artistas</th>" +
            "<th>Parceiro</th>" +
            "<th>Gênero</th>" +
            "<th>Entrada</th>" +
            "<th>Saída</th>" +
            progressCol +
            "<th>Status</th>" +
            "<th>Responsável</th>" +
            "<th></th>";

        const bodyHtml = rows.map((row, index) => {

            let progressCell = "";

            if (options.showProgress) {

                const daysLeft = Canal500Data.getDaysRemaining(row);
                const overdue = daysLeft !== null && daysLeft < 0;
                const pct = overdue ? 100 : (Canal500Data.getProgress(row) || 0);

                const daysLabel = overdue
                    ? "Tempo finalizado, verificar se já saiu do ar"
                    : daysLeft === null
                        ? ""
                        : daysLeft === 0
                            ? "sai hoje"
                            : `${daysLeft} dia${daysLeft === 1 ? "" : "s"} pra sair`;

                progressCell = `
                    <td>
                        <div class="c500-progress-wrap" title="${daysLabel}">
                            <div class="c500-progress-bar${overdue ? " c500-progress-bar--overdue" : ""}" style="width:${pct}%"></div>
                        </div>
                        <small class="c500-progress-label${overdue ? " c500-progress-label--overdue" : ""}">${daysLabel}</small>
                    </td>
                `;

            }

            const statusCell = row.id
                ? `<select class="c500-status-select" data-rows-ref="${sourceKey}" data-index="${index}">` +
                    CONFIG.CANAL500_FORM.statusVeiculacao.map(s =>
                        `<option value="${s}" ${s === row.statusVeiculacao ? "selected" : ""}>${s}</option>`
                    ).join("") +
                    `</select>`
                : `<span title="Linha antiga sem ID — não editável por aqui">${row.statusVeiculacao || "—"}</span>`;

            const evidenceBtn = row.id
                ? `<button type="button" class="mini-edit-btn c500-evidence-btn" data-rows-ref="${sourceKey}" data-index="${index}" title="Enviar evidência">📎</button>`
                : `<span class="mini-edit-locked" title="Linha antiga sem ID — sem evidência por aqui">🔒</span>`;

            const editBtn = row.id
                ? `<button type="button" class="mini-edit-btn c500-edit-btn" data-rows-ref="${sourceKey}" data-index="${index}" title="Editar ação">✏️</button>`
                : `<span class="mini-edit-locked" title="Linha antiga sem ID — não editável por aqui">🔒</span>`;

            const deleteBtn = row.id
                ? `<button type="button" class="mini-edit-btn c500-delete-btn" data-rows-ref="${sourceKey}" data-index="${index}" title="Excluir entrada">🗑️</button>`
                : `<span class="mini-edit-locked" title="Linha antiga sem ID — não excluível por aqui">🔒</span>`;

            return `
                <tr>
                    <td>${row.acaoProspectada || "—"}</td>
                    <td>${row.artistas || "—"}</td>
                    <td>${row.parceiro || "—"}</td>
                    <td>${row.genero || "—"}</td>
                    <td>${this.formatCanal500Date(row.entrada)}</td>
                    <td>${this.formatCanal500Date(row.saida)}</td>
                    ${progressCell}
                    <td>${statusCell}</td>
                    <td>${row.responsavel || "—"}</td>
                    <td>${editBtn}${evidenceBtn}${deleteBtn}</td>
                </tr>
            `;

        }).join("");

        container.innerHTML =
            `<table class="drilldown-table c500-tv-table">` +
            `<thead><tr>${headerHtml}</tr></thead>` +
            `<tbody>${bodyHtml}</tbody>` +
            `</table>`;

    },

    bindCanal500TableEvents() {

        ["c500EmVeiculacaoBox", "c500EnviadosBox", "c500ForaDoArBox", "drilldownTableWrapper"].forEach(id => {

            const box = document.getElementById(id);

            if (!box || box.dataset.evidenceBound) return;

            box.dataset.evidenceBound = "1";

            box.addEventListener("click", (event) => {

                const evidenceBtn = event.target.closest(".c500-evidence-btn");
                const editBtn = event.target.closest(".c500-edit-btn");
                const deleteBtn = event.target.closest(".c500-delete-btn");

                if (!evidenceBtn && !editBtn && !deleteBtn) return;

                const btn = evidenceBtn || editBtn || deleteBtn;

                const rows = this._canal500Rows[btn.dataset.rowsRef];

                const row = rows && rows[Number(btn.dataset.index)];

                if (!row || typeof Canal500Form === "undefined") return;

                if (evidenceBtn) {
                    Canal500Form.openEvidenceForm(row);
                }
                else if (editBtn) {
                    Canal500Form.openEditForm(row);
                }
                else {

                    const label = `${row.acaoProspectada || "essa ação"}${row.artistas ? " — " + row.artistas : ""}`;

                    if (!confirm(`Excluir "${label}" da planilha do Canal 500? Essa ação não pode ser desfeita por aqui.`)) return;

                    deleteBtn.disabled = true;

                    Canal500Form.deleteEntry(row)
                        .then(() => {

                            // refreshCanal500() re-filtra a partir de
                            // Canal500Data.rows (não das listas em
                            // _canal500Rows, que são só a "foto" já
                            // filtrada/ordenada da última renderização)
                            // — por isso a remoção precisa acontecer
                            // na fonte, senão a linha reaparece no
                            // refresh a seguir.
                            const globalIndex = Canal500Data.rows.indexOf(row);

                            if (globalIndex !== -1) Canal500Data.rows.splice(globalIndex, 1);

                            this.refreshCanal500();

                        })
                        .catch(error => {

                            console.error(error);
                            alert("Não foi possível excluir agora. Tente de novo.");
                            deleteBtn.disabled = false;

                        });

                }

            });

            box.addEventListener("change", (event) => {

                const select = event.target.closest(".c500-status-select");

                if (!select) return;

                const rows = this._canal500Rows[select.dataset.rowsRef];

                const row = rows && rows[Number(select.dataset.index)];

                if (!row || typeof Canal500Form === "undefined") return;

                const newStatus = select.value;

                select.disabled = true;

                Canal500Form.updateStatus(row, newStatus)
                    .then(() => {

                        row.statusVeiculacao = newStatus;
                        this.refreshCanal500();

                    })
                    .catch(error => {

                        console.error(error);
                        alert("Não foi possível atualizar o status. Tente de novo.");
                        select.disabled = false;

                    });

            });

        });

    },

    /* ======================================================
       INFO
    ====================================================== */

    log() {

        console.log(
            "[Dashboard]",
            ...arguments
        );

    },
        /* ======================================================
       START
    ====================================================== */

    start() {

        this.log("Dashboard iniciado.");

        this.refresh();

    }

};



/* ==========================================================
   APPLICATION BOOTSTRAP
========================================================== */

document.addEventListener(

    "DOMContentLoaded",

    () => {

        // A trava de login chama Dashboard.bootstrap() assim que
        // a senha for validada (ou de cara, se a sessão já
        // estiver autenticada).
        Auth.init(() => {

            Dashboard.bootstrap();

        });

    }

);
