/**
 * ==========================================================
 * GERADOR DE REPORTE SEMANAL
 * ----------------------------------------------------------
 * Monta a planilha de Destaques de gravadoras exatamente como
 * hoje é enviada por e-mail pra cada gravadora — mesma
 * formatação (Arial 8, cabeçalho vermelho-escuro, Capa/
 * Inclusão coloridos), já traduzida (PT/ES/EN), pronta pra
 * copiar (com formatação) ou baixar em planilha.
 *
 * Reaproveita a mesma base já carregada pela aba "Destaques de
 * gravadoras" (HighlightsData) — não duplica nem recarrega o
 * CSV.
 * ==========================================================
 */

const ReportDashboard = {

    initialized: false,

    filtersBound: false,

    filters: {

        semana: "",
        territorio: "Brasil",
        gravadora: "",
        idioma: "pt",
        includeCountry: false,
        includeHeader: true,
        busca: "",
        buscaCampo: "artist"

    },

    /**
     * Colunas exibidas na tela (sempre as 7 — País até
     * Gravadora). A cópia/download usa um subconjunto (ver
     * getCopyLanguage()).
     */
    LANGUAGES: {

        pt: {

            label: "Português",
            headers: ["País", "Destaque", "Playlist", "Link", "Artista", "Conteúdo", "Gravadora"],
            destaqueMap: { CAPA: "Capa", "INCLUSÃO": "Inclusão", INSTAGRAM: "Instagram" }

        },

        es: {

            label: "Espanhol",
            headers: ["País", "Destaque", "Playlist", "Link", "Artista", "Contenido", "Disquera"],
            destaqueMap: { CAPA: "Portada", "INCLUSÃO": "Inclusión", INSTAGRAM: "Instagram" }

        },

        en: {

            label: "Inglês",
            headers: ["Country", "Highlight", "Playlist", "Link", "Artist", "Content", "Label"],
            destaqueMap: { CAPA: "Cover", "INCLUSÃO": "Placement", INSTAGRAM: "Instagram" }

        }

    },

    async init() {

        if (!HighlightsData.isLoaded()) {

            await HighlightsData.load(CONFIG.HIGHLIGHTS_DATA.csvUrl);

        }

        if (this.initialized) {

            return this;

        }

        this.populateFilters();

        this.bindFilters();

        this.applyTerritoryDefaults(this.filters.territorio, { silent: true });

        this.initialized = true;

        return this;

    },

    /* ======================================================
       FILTROS
    ====================================================== */

    populateFilters() {

        const weeksDesc = [...HighlightsData.getSemanas()].reverse();

        this.fillSelect("reportWeek", weeksDesc, true);

        if (weeksDesc.length) {

            this.filters.semana = weeksDesc[0];

            document.getElementById("reportWeek").value = weeksDesc[0];

        }

        const gravadoras = HighlightsData.getDisqueras()
            .filter(n => this.normalizeText(n) !== "nao se aplica");

        this.fillSelect("reportLabel", gravadoras, true);

    },

    fillSelect(id, values, withTodos) {

        const select = document.getElementById(id);

        if (!select) return;

        select.innerHTML = "";

        if (withTodos) {

            const first = document.createElement("option");

            first.value = "";
            first.textContent = "Todas";

            select.appendChild(first);

        }

        values.forEach(value => {

            const option = document.createElement("option");

            option.value = value;
            option.textContent = value;

            select.appendChild(option);

        });

    },

    bindFilters() {

        if (this.filtersBound) return;

        this.filtersBound = true;

        document.getElementById("reportSearchInput").addEventListener("input", (event) => {

            this.filters.busca = this.normalizeText(event.target.value);

            this.refresh();

        });

        document.getElementById("reportSearchFieldGroup").querySelectorAll(".maf-chip").forEach(chip => {

            chip.addEventListener("click", () => {

                document.querySelectorAll("#reportSearchFieldGroup .maf-chip").forEach(c => c.classList.remove("active"));

                chip.classList.add("active");

                this.filters.buscaCampo = chip.dataset.field;

                this.refresh();

            });

        });

        document.getElementById("reportWeek").addEventListener("change", (event) => {

            this.filters.semana = event.target.value;

            this.refresh();

        });

        document.getElementById("reportTerritory").addEventListener("change", (event) => {

            this.applyTerritoryDefaults(event.target.value);

        });

        document.getElementById("reportLabel").addEventListener("change", (event) => {

            this.filters.gravadora = event.target.value;

            this.refresh();

        });

        document.getElementById("reportLanguage").addEventListener("change", (event) => {

            this.filters.idioma = event.target.value;

            this.refresh();

        });

        document.getElementById("reportIncludeCountry").addEventListener("change", (event) => {

            this.filters.includeCountry = event.target.checked;

        });

        document.getElementById("reportIncludeHeader").addEventListener("change", (event) => {

            this.filters.includeHeader = event.target.checked;

        });

        document.getElementById("reportCopyBtn").addEventListener("click", () => {

            this.copyToClipboard();

        });

        document.getElementById("reportDownloadBtn").addEventListener("click", () => {

            this.downloadSpreadsheet();

        });

        document.getElementById("reportSendBtn").addEventListener("click", () => {

            ReportSend.openChooser();

        });

    },

    /**
     * Brasil -> Português (editável); LatAm -> Espanhol
     * (editável); Todos -> fica em aberto pra pessoa escolher.
     * "Copiar com informação de País" segue a mesma lógica:
     * desligado só pro Brasil (país sempre óbvio), ligado nos
     * outros dois (o reporte mistura vários países).
     */
    applyTerritoryDefaults(territorio, { silent = false } = {}) {

        this.filters.territorio = territorio;

        const langSelect = document.getElementById("reportLanguage");

        const includeCountryToggle = document.getElementById("reportIncludeCountry");

        if (territorio === "Brasil") {

            langSelect.value = "pt";
            includeCountryToggle.checked = false;

        }
        else if (territorio === "LatAm") {

            langSelect.value = "es";
            includeCountryToggle.checked = true;

        }
        else {

            langSelect.value = "";
            includeCountryToggle.checked = true;

        }

        this.filters.idioma = langSelect.value;

        this.filters.includeCountry = includeCountryToggle.checked;

        if (!silent) {

            this.refresh();

        }

    },

    normalizeText(value) {

        return String(value || "")
            .normalize("NFD")
            .replace(/[̀-ͯ]/g, "")
            .trim()
            .toLowerCase();

    },

    /* ======================================================
       DADOS
    ====================================================== */

    getFilteredRows() {

        if (!HighlightsData.isLoaded()) return [];

        const rows = HighlightsData.rows.filter(row => {

            // Instagram só existe (e só faz sentido no reporte) pro Brasil.
            const isValidDestaque =
                row.destaque === "CAPA" ||
                row.destaque === "INCLUSÃO" ||
                (row.destaque === "INSTAGRAM" && row.pais === "Brasil");

            if (!isValidDestaque) return false;

            if (this.filters.semana && row.semana !== this.filters.semana) return false;

            if (this.filters.gravadora && row.disquera !== this.filters.gravadora) return false;

            if (this.filters.territorio === "Brasil" && row.pais !== "Brasil") return false;

            if (this.filters.territorio === "LatAm" && row.pais === "Brasil") return false;

            if (this.filters.busca) {

                const valor = this.normalizeText(row[this.filters.buscaCampo] || "");

                if (!valor.includes(this.filters.busca)) return false;

            }

            return true;

        });

        // No Brasil, ordena pela coluna Destaque de A a Z (Capa antes
        // de Inclusão antes de Instagram). LatAm e Todos são SEMPRE
        // ordenados por país, na ordem da planilha original (LatAm
        // começando por Colômbia, já que o Brasil fica de fora ali).
        if (this.filters.territorio === "Brasil") {

            rows.sort((a, b) =>
                a.destaque.localeCompare(b.destaque, "pt-BR", { sensitivity: "base" }) ||
                a.playlist.localeCompare(b.playlist, "pt-BR", { sensitivity: "base" }) ||
                a.artist.localeCompare(b.artist, "pt-BR", { sensitivity: "base" })
            );

        }
        else {

            const rank = this.getCountryRank(this.filters.territorio);

            rows.sort((a, b) => {

                const ra = rank.has(a.pais) ? rank.get(a.pais) : 999;
                const rb = rank.has(b.pais) ? rank.get(b.pais) : 999;

                if (ra !== rb) return ra - rb;

                return (
                    a.playlist.localeCompare(b.playlist, "pt-BR", { sensitivity: "base" }) ||
                    a.artist.localeCompare(b.artist, "pt-BR", { sensitivity: "base" })
                );

            });

        }

        return rows;

    },

    /**
     * Ordem dos países exatamente como aparecem na planilha
     * original de Destaques de gravadoras (1ª ocorrência de
     * cada um) — cacheada, já que os dados não mudam depois de
     * carregados. No LatAm, o Brasil sai da lista e a Colômbia
     * vai pra frente de todo mundo.
     */
    getCountryOrder() {

        if (!this._countryOrder) {

            const order = [];

            const seen = new Set();

            HighlightsData.rows.forEach(row => {

                if (row.pais && !seen.has(row.pais)) {

                    seen.add(row.pais);
                    order.push(row.pais);

                }

            });

            this._countryOrder = order;

        }

        return this._countryOrder;

    },

    normalizeCountryText(value) {

        return String(value || "")
            .normalize("NFD")
            .replace(/[̀-ͯ]/g, "")
            .trim()
            .toLowerCase();

    },

    getCountryRank(territorio) {

        const baseOrder = this.getCountryOrder();

        let order = baseOrder;

        if (territorio === "LatAm") {

            const colombiaValue = baseOrder.find(pais => this.normalizeCountryText(pais) === "colombia");

            const rest = baseOrder.filter(pais => pais !== "Brasil" && pais !== colombiaValue);

            order = colombiaValue ? [colombiaValue, ...rest] : rest;

        }

        const rank = new Map();

        order.forEach((pais, index) => rank.set(pais, index));

        return rank;

    },

    /* ======================================================
       RENDER (tela — sempre as 7 colunas)
    ====================================================== */

    refresh() {

        const wrapper = document.getElementById("reportTableWrapper");

        const countEl = document.getElementById("reportCount");

        if (!wrapper) return this;

        const lang = this.filters.idioma;

        if (!lang) {

            wrapper.innerHTML = `<p class="analises-empty">Selecione um idioma pra gerar o reporte.</p>`;

            if (countEl) countEl.textContent = "";

            return this;

        }

        const rows = this.getFilteredRows();

        if (countEl) {

            countEl.textContent = `${rows.length} ${rows.length === 1 ? "destaque" : "destaques"}`;

        }

        if (!rows.length) {

            wrapper.innerHTML = `<p class="analises-empty">Nenhum destaque encontrado para esse recorte.</p>`;

            return this;

        }

        wrapper.innerHTML = this.buildTableHtml(rows, this.LANGUAGES[lang], { fullTable: true });

        return this;

    },

    /**
     * "Brasil" -> "Brazil" só quando o idioma selecionado é
     * inglês — nos outros dois fica igual (é o mesmo nome em
     * português e espanhol).
     */
    formatCountry(pais) {

        if (this.filters.idioma === "en" && pais === "Brasil") {
            return "Brazil";
        }

        return pais;

    },

    /**
     * Monta o HTML da tabela. fullTable = true -> tela (7
     * colunas, sem estilos inline — usa o CSS da página, sempre
     * com cabeçalho). fullTable = false -> versão de exportação
     * (cópia/download), sempre sem Gravadora, com País e
     * cabeçalho opcionais, TODO estilo inline (pro destino
     * preservar a formatação).
     */
    buildTableHtml(rows, langDef, { fullTable, inline = false } = {}) {

        const includeCountry = fullTable ? true : this.filters.includeCountry;

        const includeHeader = fullTable ? true : this.filters.includeHeader;

        const headers = [];

        if (includeCountry) headers.push(langDef.headers[0]);

        headers.push(...[langDef.headers[1], langDef.headers[2], langDef.headers[3], langDef.headers[4], langDef.headers[5]]);

        if (fullTable) headers.push(langDef.headers[6]);

        // white-space:nowrap em tudo evita que qualquer coluna quebre
        // linha ao colar no corpo do e-mail; o Link ainda ganha uma
        // largura mínima maior, já que é o texto mais longo da tabela
        // e o que mais desconfigurava ao quebrar em duas linhas.
        const thStyleBase = "background:#990000;color:#ffffff;text-transform:uppercase;font-weight:bold;border:1px solid #cccccc;padding:4px 8px;font-family:Arial,Helvetica,sans-serif;font-size:8pt;text-align:left;white-space:nowrap;";

        const thStyle = inline ? ` style="${thStyleBase}"` : "";

        const tableStyle = inline
            ? ` style="border-collapse:collapse;font-family:Arial,Helvetica,sans-serif;font-size:8pt;color:#000000;background:#ffffff;"`
            : "";

        let html = `<table class="report-table"${tableStyle}>`;

        if (includeHeader) {

            html += "<thead><tr>";

            headers.forEach(h => {

                const isLinkHeader = h === langDef.headers[3];

                if (inline) {
                    const style = isLinkHeader ? `${thStyleBase}min-width:320px;` : thStyleBase;
                    html += `<th style="${style}">${String(h).toUpperCase()}</th>`;
                }
                else {
                    html += `<th${isLinkHeader ? ' class="report-link-col"' : ""}>${String(h).toUpperCase()}</th>`;
                }

            });

            html += "</tr></thead>";

        }

        html += "<tbody>";

        rows.forEach(row => {

            const isCapa = row.destaque === "CAPA";

            const isInstagram = row.destaque === "INSTAGRAM";

            const destaqueLabel = langDef.destaqueMap[row.destaque] || row.destaque;

            const tdStyle = inline
                ? `border:1px solid #cccccc;padding:4px 8px;font-family:Arial,Helvetica,sans-serif;font-size:8pt;color:#000000;text-align:left;white-space:nowrap;`
                : "";

            const highlightBg = isCapa ? "#d9ead3" : (isInstagram ? "#ead1dc" : "#fff2cc");

            const highlightClass = isCapa ? "report-capa" : (isInstagram ? "report-instagram" : "report-inclusao");

            const destaqueTd = inline
                ? `<td style="${tdStyle}background:${highlightBg};">${destaqueLabel}</td>`
                : `<td class="${highlightClass}">${destaqueLabel}</td>`;

            const linkTd = inline
                ? `<td style="${tdStyle}min-width:320px;"><a href="${row.link}" style="color:#1155cc;text-decoration:underline;">${row.link}</a></td>`
                : `<td class="report-link-col"><a href="${row.link}" target="_blank" rel="noopener">${row.link}</a></td>`;

            html += "<tr>";

            if (includeCountry) {

                const paisLabel = this.formatCountry(row.pais);

                html += inline ? `<td style="${tdStyle}">${paisLabel}</td>` : `<td>${paisLabel}</td>`;

            }

            html += destaqueTd;
            html += inline ? `<td style="${tdStyle}">${row.playlist}</td>` : `<td>${row.playlist}</td>`;
            html += linkTd;
            html += inline ? `<td style="${tdStyle}">${row.artist}</td>` : `<td>${row.artist}</td>`;
            html += inline ? `<td style="${tdStyle}">${row.contenido}</td>` : `<td>${row.contenido}</td>`;

            if (fullTable) {
                html += inline ? `<td style="${tdStyle}">${row.disquera}</td>` : `<td>${row.disquera}</td>`;
            }

            html += "</tr>";

        });

        html += "</tbody></table>";

        return html;

    },

    /**
     * Mesmos dados de buildTableHtml, só que como matriz simples
     * (cabeçalho + linhas de texto puro) em vez de HTML — usado
     * pra mandar a tabela pro Apps Script que insere a aba na
     * planilha da gravadora (ver js/report-send.js, updateSheet()).
     *
     * Mesma regra da tabela original: sem coluna Gravadora (a
     * gravadora já sabe que o lançamento é dela) e sem coluna País
     * quando o território é Brasil (só LatAm/Todos mostram País,
     * onde ele realmente varia) — mesmo `this.filters.includeCountry`
     * que já liga/desliga sozinho por território em
     * applyTerritoryDefaults(), e que a pessoa também pode ajustar
     * manualmente no toggle da tela.
     *
     * "tipos" vai à parte (CAPA/INCLUSÃO/INSTAGRAM, sempre no
     * código original) pro Apps Script conseguir colorir cada
     * linha do jeito certo mesmo com a coluna Destaque já traduzida
     * pro idioma escolhido (Portada/Cover etc. não dá pra usar
     * pra decidir a cor).
     */
    buildTableData(rows, langDef) {

        const includeCountry = this.filters.includeCountry;

        const headers = [];

        if (includeCountry) headers.push(langDef.headers[0]);

        headers.push(langDef.headers[1], langDef.headers[2], langDef.headers[3], langDef.headers[4], langDef.headers[5]);

        const data = rows.map(row => {

            const line = [];

            if (includeCountry) line.push(this.formatCountry(row.pais));

            line.push(
                langDef.destaqueMap[row.destaque] || row.destaque,
                row.playlist,
                row.link,
                row.artist,
                row.contenido
            );

            return line;

        });

        const tipos = rows.map(row => row.destaque);

        // Posição (a partir de 0) da coluna Destaque em "headers"/
        // cada linha de "data" — varia porque País só entra quando
        // includeCountry está ligado. O Apps Script usa isso pra
        // saber qual coluna colorir (ver scratch-code-gs-report-send.gs).
        const destaqueColIndex = includeCountry ? 1 : 0;

        return { headers, data, tipos, destaqueColIndex };

    },

    /* ======================================================
       COPIAR (com formatação) — sem Gravadora, País opcional
    ====================================================== */

    copyToClipboard() {

        const lang = this.filters.idioma;

        if (!lang) {

            alert("Selecione um idioma antes de copiar.");

            return;

        }

        const rows = this.getFilteredRows();

        if (!rows.length) {

            alert("Nenhum destaque encontrado para esse recorte.");

            return;

        }

        const html = this.buildTableHtml(rows, this.LANGUAGES[lang], { fullTable: false, inline: true });

        const holder = document.createElement("div");

        holder.style.position = "fixed";
        holder.style.left = "-9999px";
        holder.style.top = "0";

        holder.innerHTML = html;

        document.body.appendChild(holder);

        const range = document.createRange();

        range.selectNodeContents(holder);

        const selection = window.getSelection();

        selection.removeAllRanges();
        selection.addRange(range);

        let ok = false;

        try {

            ok = document.execCommand("copy");

        }
        catch (error) {

            ok = false;

        }

        selection.removeAllRanges();

        document.body.removeChild(holder);

        const btn = document.getElementById("reportCopyBtn");

        if (btn) {

            const original = btn.textContent;

            btn.textContent = ok ? "✔ Copiado!" : "Não foi possível copiar";

            setTimeout(() => { btn.textContent = original; }, 1800);

        }

    },

    /* ======================================================
       BAIXAR PLANILHA (.xls — HTML compatível, abre com toda a
       formatação no Excel/Google Sheets)
    ====================================================== */

    downloadSpreadsheet() {

        const lang = this.filters.idioma;

        if (!lang) {

            alert("Selecione um idioma antes de baixar.");

            return;

        }

        const rows = this.getFilteredRows();

        if (!rows.length) {

            alert("Nenhum destaque encontrado para esse recorte.");

            return;

        }

        const tableHtml = this.buildTableHtml(rows, this.LANGUAGES[lang], { fullTable: false, inline: true });

        const htmlDoc = `
            <html>
            <head><meta charset="UTF-8"></head>
            <body>${tableHtml}</body>
            </html>
        `;

        const blob = new Blob(["﻿" + htmlDoc], { type: "application/vnd.ms-excel" });

        const gravadoraSlug = (this.filters.gravadora || "Todas").replace(/[^\p{L}\p{N}]+/gu, "_");

        const semanaSlug = (this.filters.semana || "semana").replace(/\//g, "-");

        const a = document.createElement("a");

        a.href = URL.createObjectURL(blob);
        a.download = `Destaques_${gravadoraSlug}_${semanaSlug}.xls`;

        a.click();

        URL.revokeObjectURL(a.href);

    },

};
