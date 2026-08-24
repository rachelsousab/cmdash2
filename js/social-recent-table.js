/**
 * ==========================================================
 * REDES SOCIAIS — "ÚLTIMAS POSTAGENS"
 * ----------------------------------------------------------
 * Tabela compacta (mesmo formato das mini-tabelas de Ações e
 * Canal 500 — cabeçalho fixo, scroll pra ver mais linhas) com
 * TODOS os posts, mais recente primeiro, independente dos
 * filtros da sidebar — é uma visão geral de "o que falta
 * preencher", não um recorte por período.
 *
 * Campos que vêm automaticamente da API do Instagram não são
 * editáveis por aqui. Os campos manuais (Formato, Tipo,
 * Resumo, Responsável, Gravadora, Collab, Gênero, Reposts,
 * Começaram a seguir), quando vazios, mostram um indicativo
 * vermelho "Informação faltante" com o campo de preenchimento
 * já embutido na própria célula.
 *
 * Formato/Tipo/Gravadora/Responsável/Collab/Gênero usam o
 * mesmo dropdown: opções em ordem alfabética ("Não se aplica"
 * sempre primeiro, quando existir), com busca no topo — a
 * busca só filtra, não aceita texto livre como resposta.
 * ==========================================================
 */

const SocialRecentTable = {

    _posts: [],

    render() {

        const container = document.getElementById("socialRecentPostsBox");

        if (!container) return;

        const allPosts = SocialData.getPosts();

        this._posts = allPosts
            .filter(post => this.getMissingFields(post).length > 0)
            .sort((a, b) => b.timestamp - a.timestamp);

        this.renderMissingNotice(this._posts.length, allPosts.length);

        if (!this._posts.length) {
            container.innerHTML = "";
            return;
        }

        const headerHtml =
            "<th>Data</th>" +
            "<th>Legenda</th>" +
            "<th>Resumo da ação</th>" +
            "<th>Formato</th>" +
            "<th>Tipo</th>" +
            "<th>Gravadora</th>" +
            "<th>Responsável</th>" +
            "<th>Collab</th>" +
            "<th>Gênero</th>" +
            "<th>Reposts</th>" +
            "<th>Começaram a seguir</th>" +
            "<th>Curtidas</th>" +
            "<th>Comentários</th>" +
            "<th>Compartilhamentos</th>" +
            "<th>Salvamentos</th>" +
            "<th>Visualizações</th>" +
            "<th>Alcance</th>" +
            "<th>Interações</th>";

        const bodyHtml = this._posts.map((post, index) => `
            <tr>
                <td>${post.data ? post.data.toLocaleDateString(CONFIG.DATE.locale) : "—"}</td>
                <td>${this.renderLegendaCell(post)}</td>
                <td>${this.renderResumoCell(post, index)}</td>
                <td>${this.renderDropdownCell(post, index, "formato", CONFIG.SOCIAL_FORM.formatos, false)}</td>
                <td>${this.renderDropdownCell(post, index, "tipo", CONFIG.SOCIAL_FORM.tipos, false)}</td>
                <td>${this.renderDropdownCell(post, index, "gravadora", this.getGravadoraOptions(), true)}</td>
                <td>${this.renderDropdownCell(post, index, "responsavel", CONFIG.SOCIAL_FORM.responsaveis, true)}</td>
                <td>${this.renderDropdownCell(post, index, "collab", CONFIG.SOCIAL_FORM.collabs, true)}</td>
                <td>${this.renderDropdownCell(post, index, "genero", CONFIG.SOCIAL_FORM.generos, true)}</td>
                <td>${this.renderNumberCell(post, index, "reposts")}</td>
                <td>${this.renderNumberCell(post, index, "seguidores")}</td>
                <td>${this.formatMetric(post.curtidas)}</td>
                <td>${this.formatMetric(post.comentarios)}</td>
                <td>${this.formatMetric(post.compartilhamentos)}</td>
                <td>${this.formatMetric(post.salvamentos)}</td>
                <td>${this.formatMetric(post.visualizacoes)}</td>
                <td>${this.formatMetric(post.alcance)}</td>
                <td>${this.formatMetric(post.interacoes)}</td>
            </tr>
        `).join("");

        container.innerHTML =
            `<table class="drilldown-table social-recent-table">` +
            `<thead><tr>${headerHtml}</tr></thead>` +
            `<tbody>${bodyHtml}</tbody>` +
            `</table>`;

        this.bindEvents(container);

    },

    getGravadoraOptions() {

        const gravadoras = CONFIG.MANUAL_ACTIONS.labels;

        const especiais = CONFIG.MANUAL_ACTIONS.labelSpecialOptions.map(o => o.value);

        return [...gravadoras, ...especiais];

    },

    /* Ordem alfabética (pt-BR) — "Não se aplica" sempre em
       primeiro lugar, quando existir entre as opções. */
    sortOptionsAlpha(options) {

        const naoSeAplica = options.filter(o => o === "Não se aplica");

        const resto = options
            .filter(o => o !== "Não se aplica")
            .sort((a, b) => a.localeCompare(b, "pt-BR", { sensitivity: "base" }));

        return [...naoSeAplica, ...resto];

    },

    /* Métricas de engajamento — vêm automaticamente da API,
       só leitura por aqui. */
    formatMetric(value) {

        return Number(value || 0).toLocaleString("pt-BR");

    },

    /* Abre o painel do dropdown como position:fixed, calculado
       a partir do botão que o abriu — assim ele escapa do
       scroll/corte da tabela (overflow-x/y) em vez de ficar
       cortado nas bordas dela, e sempre com o botão Salvar
       visível (abre pra cima se não couber embaixo). */
    positionPanel(toggle, panel) {

        panel.style.display = "block";
        panel.style.position = "fixed";
        panel.style.visibility = "hidden";

        const rect = toggle.getBoundingClientRect();
        const panelHeight = panel.offsetHeight;
        const panelWidth = panel.offsetWidth;

        const spaceBelow = window.innerHeight - rect.bottom;
        const openUp = spaceBelow < panelHeight + 8 && rect.top > panelHeight + 8;

        panel.style.top = openUp
            ? `${rect.top - panelHeight - 4}px`
            : `${rect.bottom + 4}px`;

        const maxLeft = window.innerWidth - panelWidth - 8;

        panel.style.left = `${Math.min(rect.left, Math.max(8, maxLeft))}px`;

        panel.style.visibility = "visible";

    },

    /* Campos considerados "faltando" pra fins do aviso e do
       indicativo vermelho. Reposts/Começaram a seguir usam o
       flag *Set (célula tinha algum texto, mesmo "0") em vez do
       valor em si — assim um zero de verdade não é tratado como
       "faltando" pra sempre. */
    getMissingFields(post) {

        const missing = [];

        if (!post.formato) missing.push("formato");
        if (!post.tipo) missing.push("tipo");
        if (!post.resumo) missing.push("resumo");
        if (!post.responsavel) missing.push("responsavel");
        if (!post.gravadora) missing.push("gravadora");
        if (!post.collab) missing.push("collab");
        if (!post.genero) missing.push("genero");
        if (!post.repostsSet) missing.push("reposts");
        if (!post.seguidoresSet) missing.push("seguidores");

        return missing;

    },

    renderMissingNotice(count, totalPosts) {

        const el = document.getElementById("socialMissingNotice");
        const okEl = document.getElementById("socialMissingOk");

        if (!el || !okEl) return;

        if (!count) {
            el.style.display = "none";
            okEl.style.display = totalPosts ? "" : "none";
            return;
        }

        okEl.style.display = "none";
        el.style.display = "";
        el.textContent = `${count} ${count === 1 ? "ação" : "ações"} com informações faltantes. O Instagram não consegue importar todas automaticamente. Favor adicionar de forma manual.`;

    },

    /* ======================================================
       LEGENDA — texto que veio junto com o post na importação
       do Instagram (só leitura, não editável por aqui). Ajuda a
       saber do que se trata a ação na hora de escrever o Resumo,
       ao lado. Sem legenda (post sem texto) mostra "—", sem
       indicativo de "faltando" — não é um campo obrigatório.
    ====================================================== */
    renderLegendaCell(post) {

        if (!post.legenda) return "—";

        return `<span class="social-legenda-text" title="${this.escapeAttr(post.legenda)}">${this.escapeHtml(post.legenda)}</span>`;

    },

    /* ======================================================
       RESUMO — campo de texto livre, preenchido manualmente
       (a IA do Sheets/Gemini não está disponível pra essa
       conta, então não há geração automática).
    ====================================================== */
    renderResumoCell(post, index) {

        if (post.resumo) {
            return this.escapeHtml(post.resumo);
        }

        return `
            <span class="social-missing-badge">Informação faltante</span>
            <div class="social-text-wrap">
                <input type="text" class="social-field-text" data-index="${index}" data-field="resumo" placeholder="Resumo da ação">
                <button type="button" class="data-table-csv-btn social-text-save-btn" data-index="${index}" data-field="resumo">Salvar</button>
            </div>
        `;

    },

    /* ======================================================
       DROPDOWN (Formato, Tipo, Gravadora, Responsável, Collab,
       Gênero) — mesmo componente pra seleção única ou múltipla,
       com busca (só filtra, não aceita texto livre) e opções em
       ordem alfabética ("Não se aplica" sempre primeiro).
    ====================================================== */
    renderDropdownCell(post, index, field, options, multi) {

        const value = post[field];

        if (value) {

            if (!multi) return this.escapeHtml(value);

            // Mais de um valor: uma linha por valor, em vez de
            // uma lista separada por vírgula esticando a coluna.
            return value
                .split(",")
                .map(v => v.trim())
                .filter(Boolean)
                .map(v => this.escapeHtml(v))
                .join("<br>");

        }

        const uid = `sm-${index}-${field}`;
        const sorted = this.sortOptionsAlpha(options);

        const optionsHtml = sorted.map(o => multi
            ? `
                <label class="social-multiselect-option">
                    <input type="checkbox" value="${this.escapeAttr(o)}" data-uid="${uid}">
                    ${this.escapeHtml(o)}
                </label>
            `
            : `
                <button type="button" class="social-dropdown-option-btn" data-uid="${uid}" data-index="${index}" data-field="${field}" data-value="${this.escapeAttr(o)}">
                    ${this.escapeHtml(o)}
                </button>
            `
        ).join("");

        return `
            <span class="social-missing-badge">Informação faltante</span>
            <div class="social-multiselect-dropdown" data-uid="${uid}">
                <button type="button" class="social-multiselect-toggle" data-uid="${uid}">Selecionar ▾</button>
                <div class="social-multiselect-panel" data-uid="${uid}" style="display:none;">
                    <input type="text" class="social-dropdown-search" data-uid="${uid}" placeholder="Buscar..." autocomplete="off">
                    <div class="social-multiselect-options" data-uid="${uid}">
                        ${optionsHtml}
                    </div>
                    ${multi ? `<button type="button" class="data-table-csv-btn social-multiselect-save-btn" data-index="${index}" data-field="${field}" data-uid="${uid}">Salvar</button>` : ""}
                </div>
            </div>
        `;

    },

    /* ======================================================
       CAMPO NUMÉRICO (Reposts / Começaram a seguir)
    ====================================================== */
    renderNumberCell(post, index, field) {

        const setFlag = field === "reposts" ? "repostsSet" : "seguidoresSet";

        if (post[setFlag]) {
            return Number(post[field]).toLocaleString("pt-BR");
        }

        return `
            <span class="social-missing-badge">Informação faltante</span>
            <div class="social-number-wrap">
                <input type="number" min="0" class="social-field-number" data-index="${index}" data-field="${field}" placeholder="0">
                <button type="button" class="data-table-csv-btn social-number-save-btn" data-index="${index}" data-field="${field}">Salvar</button>
            </div>
        `;

    },

    /* ======================================================
       EVENTOS
    ====================================================== */
    bindEvents(container) {

        Array.from(container.querySelectorAll(".social-text-save-btn")).forEach(btn => {

            btn.addEventListener("click", () => {

                const index = Number(btn.dataset.index);
                const field = btn.dataset.field;
                const post = this._posts[index];
                const input = container.querySelector(`.social-field-text[data-index="${index}"][data-field="${field}"]`);

                const value = (input.value || "").trim();

                if (!value) return;

                SocialForm.updateField(post, field, value);

                post[field] = value;

                this.render();

            });

        });

        Array.from(container.querySelectorAll(".social-field-text")).forEach(input => {

            input.addEventListener("keydown", (event) => {

                if (event.key !== "Enter") return;

                event.preventDefault();

                const index = input.dataset.index;
                const field = input.dataset.field;

                container.querySelector(`.social-text-save-btn[data-index="${index}"][data-field="${field}"]`).click();

            });

        });

        /* Dropdown compacto: fechado por padrão, abre/fecha ao
           clicar no botão, fecha ao clicar fora. Ao abrir, limpa
           a busca e mostra todas as opções de novo. */
        Array.from(container.querySelectorAll(".social-multiselect-toggle")).forEach(toggle => {

            toggle.addEventListener("click", (event) => {

                event.stopPropagation();

                const uid = toggle.dataset.uid;
                const panel = container.querySelector(`.social-multiselect-panel[data-uid="${uid}"]`);

                const isOpen = panel.style.display !== "none";

                // Fecha qualquer outro painel aberto antes de abrir este.
                Array.from(document.querySelectorAll(".social-multiselect-panel")).forEach(p => p.style.display = "none");

                if (isOpen) return;

                const search = panel.querySelector(".social-dropdown-search");

                if (search) {
                    search.value = "";
                    this.filterDropdownOptions(panel, "");
                }

                this.positionPanel(toggle, panel);

                if (search) search.focus();

            });

        });

        if (!this._docCloseBound) {

            this._docCloseBound = true;

            document.addEventListener("click", () => {
                Array.from(document.querySelectorAll(".social-multiselect-panel")).forEach(p => p.style.display = "none");
            });

            // Fecha o painel aberto se a tabela rolar — evita ele
            // ficar "flutuando" desconectado da linha original.
            document.getElementById("socialRecentPostsBox")?.addEventListener("scroll", () => {
                Array.from(document.querySelectorAll(".social-multiselect-panel")).forEach(p => p.style.display = "none");
            });

        }

        Array.from(container.querySelectorAll(".social-multiselect-panel")).forEach(panel => {
            panel.addEventListener("click", (event) => event.stopPropagation());
        });

        /* Busca — só filtra a lista visível, nunca vira valor
           enviado (não existe "opção livre" nesse campo). */
        Array.from(container.querySelectorAll(".social-dropdown-search")).forEach(search => {

            search.addEventListener("input", () => {

                const uid = search.dataset.uid;
                const panel = container.querySelector(`.social-multiselect-panel[data-uid="${uid}"]`);

                this.filterDropdownOptions(panel, search.value);

            });

            search.addEventListener("keydown", (event) => {
                if (event.key === "Enter") event.preventDefault();
            });

        });

        /* Seleção única (Formato/Tipo): clicar já salva e fecha.
           Atualização otimista — a tela já reflete a escolha na
           hora, sem esperar o Apps Script responder (esse round
           trip costuma levar alguns segundos, e travar a tela
           até ele voltar é o que deixava o preenchimento lento). */
        Array.from(container.querySelectorAll(".social-dropdown-option-btn")).forEach(optionBtn => {

            optionBtn.addEventListener("click", () => {

                const post = this._posts[Number(optionBtn.dataset.index)];
                const field = optionBtn.dataset.field;
                const value = optionBtn.dataset.value;

                SocialForm.updateField(post, field, value)
                    .catch(error => console.error(error));

                post[field] = value;
                this.render();

            });

        });

        Array.from(container.querySelectorAll(".social-multiselect-save-btn")).forEach(btn => {

            btn.addEventListener("click", () => {

                const index = Number(btn.dataset.index);
                const field = btn.dataset.field;
                const post = this._posts[index];
                const uid = btn.dataset.uid;

                const checked = Array.from(container.querySelectorAll(`input[type="checkbox"][data-uid="${uid}"]:checked`));

                const values = checked.map(c => c.value);

                if (!values.length) {
                    alert("Selecione ao menos uma opção.");
                    return;
                }

                SocialForm.updateField(post, field, values)
                    .catch(error => console.error(error));

                post[field] = values.join(", ");
                this.render();

            });

        });

        Array.from(container.querySelectorAll(".social-number-save-btn")).forEach(btn => {

            btn.addEventListener("click", () => {

                const index = Number(btn.dataset.index);
                const field = btn.dataset.field;
                const post = this._posts[index];
                const setFlag = field === "reposts" ? "repostsSet" : "seguidoresSet";

                const input = container.querySelector(`.social-field-number[data-index="${index}"][data-field="${field}"]`);

                // "" (nada digitado) continua inválido, mas "0" é uma
                // resposta legítima — só bloqueia texto vazio ou negativo.
                if (input.value === "" || Number(input.value) < 0) {
                    alert("Preencha um número (pode ser 0).");
                    return;
                }

                const value = Number(input.value);

                SocialForm.updateField(post, field, value)
                    .catch(error => console.error(error));

                post[field] = value;
                post[setFlag] = true;
                this.render();

            });

        });

        Array.from(container.querySelectorAll(".social-field-number")).forEach(input => {

            input.addEventListener("keydown", (event) => {

                if (event.key !== "Enter") return;

                event.preventDefault();

                const index = input.dataset.index;
                const field = input.dataset.field;

                container.querySelector(`.social-number-save-btn[data-index="${index}"][data-field="${field}"]`)?.click();

            });

        });

    },

    /* Filtra as opções (checkbox ou botão) dentro de um painel
       pelo texto digitado — substring, sem diferenciar
       maiúsculas/minúsculas. */
    filterDropdownOptions(panel, query) {

        const q = query.toLowerCase().trim();

        Array.from(panel.querySelectorAll(".social-multiselect-option, .social-dropdown-option-btn")).forEach(el => {

            const text = el.textContent.toLowerCase();

            el.style.display = !q || text.includes(q) ? "" : "none";

        });

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
