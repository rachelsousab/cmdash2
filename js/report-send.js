/**
 * ==========================================================
 * GERADOR DE REPORTE — "Enviar reporte" (e-mail semanal)
 * ----------------------------------------------------------
 * Monta o e-mail que a Rachel manda toda sexta-feira pra cada
 * gravadora: destinatários e link da planilha compartilhada
 * (puxados de ReportRecipientsData, quando configurado),
 * assunto (PT/ES/EN, com a data da semana selecionada, idioma
 * inicial vindo do território mas trocável na hora) e um corpo
 * de e-mail livre e editável.
 *
 * Antes do pop-up principal, um pop-up de escolha (openChooser/
 * selectMode) define o modo, que muda o que aparece lá dentro:
 * - "planilha" (Enviar com planilha de destaques): só o botão
 *   "Atualizar planilha de destaque" no corpo, e os dois modos de
 *   envio (direto/copiar) no rodapé, como sempre foi.
 * - "corpo" (Enviar destaques no corpo do e-mail): só o botão
 *   "Colar tabela de destaques" (insere na posição do cursor, não
 *   sempre no final), sem os modos de envio — o envio sempre sai
 *   com formatação copiada (só a segunda opção funciona com uma
 *   tabela colada, já que o Gmail não aceita corpo formatado via
 *   URL de abertura direta, só texto puro).
 *
 * "[texto](URL)" no texto padrão da planilha ("E-mail padrão")
 * vira link de verdade em qualquer ponto do corpo (ver
 * textToParagraphs) — no modo "Enviar direto, sem formatação" já
 * sai sozinho como "texto (URL)".
 * ==========================================================
 */

const ReportSend = {

    _bound: false,
    _currentLookup: null,
    _idioma: "pt",

    // "planilha" (Enviar com planilha de destaques) ou "corpo"
    // (Enviar destaques no corpo do e-mail) — escolhido no pop-up
    // que abre antes deste, ver openChooser()/selectMode().
    _mode: null,

    // Passo "Baixar capas" já resolvido nesta abertura do popup —
    // true quando a pessoa baixou de verdade (zip/imagem) OU quando
    // a busca voltou sem nenhuma capa pro recorte (nada pra baixar,
    // mas ela já conferiu). Zerado toda vez que o popup abre (ver
    // open()) — bloqueia "Enviar e-mail" enquanto for false (ver
    // updateModeAvailability()).
    _coversChecked: false,

    // Última posição do cursor dentro do corpo do e-mail (Range),
    // guardada a cada clique/tecla ali dentro — é onde "Colar
    // tabela de destaques" insere a tabela, em vez de sempre no
    // final. Zerada sempre que o corpo é regerado do zero (troca
    // de idioma), já que a posição antiga deixa de existir.
    _savedRange: null,

    // E-mails fixos dos checkboxes "Copiar ..." abaixo de
    // Destinatários. Editorial e Marketing entram sempre; Ruben
    // entra automaticamente só quando o território é LatAm ou
    // Todos (mas pode ser desmarcado manualmente).
    EXTRA_RECIPIENTS: {
        editorial: "editorial@imusica.com.br",
        marketing: "marketing@imusica.com.br",
        ruben: "ruben.ramirez@claro.com.ar"
    },

    LABELS: {

        pt: {
            langLabel: "Português",
            greeting: (gravadora) => `Olá, equipe ${gravadora},`,
            intro: "Segue o reporte semanal de destaques.",
            placeholderText: "confira a tabela/planilha aqui",
            closing: "Qualquer dúvida, estamos à disposição."
        },

        es: {
            langLabel: "Espanhol",
            greeting: (gravadora) => `Hola, equipo ${gravadora},`,
            intro: "Aquí tienen el reporte semanal de destacados.",
            placeholderText: "consulten la tabla/planilla aquí",
            closing: "Cualquier duda, quedamos a disposición."
        },

        en: {
            langLabel: "Inglês",
            greeting: (gravadora) => `Hi ${gravadora} team,`,
            intro: "Please find this week's highlights report below.",
            placeholderText: "check the table/spreadsheet here",
            closing: "Let us know if you have any questions."
        }

    },

    /**
     * Primeiro passo do "Enviar reporte": valida a gravadora e abre
     * o pop-up de escolha (planilha vs. corpo do e-mail) antes do
     * pop-up de verdade — cada escolha muda quais botões aparecem
     * lá dentro (ver renderForMode()).
     */
    openChooser() {

        const gravadora = ReportDashboard.filters.gravadora;

        if (!gravadora) {

            alert("Selecione uma gravadora específica (não \"Todas\") antes de enviar o reporte.");
            return;

        }

        this.bindEvents();

        document.getElementById("reportSendChooserSubtitle").textContent = `${gravadora} · ${ReportDashboard.filters.territorio}`;

        document.getElementById("reportSendChooserModal").classList.add("open");

    },

    closeChooser() {

        document.getElementById("reportSendChooserModal").classList.remove("open");

    },

    selectMode(mode) {

        this._mode = mode;

        this.closeChooser();

        this.open();

    },

    async open() {

        const territorio = ReportDashboard.filters.territorio;
        const gravadora = ReportDashboard.filters.gravadora;

        if (!gravadora) {

            alert("Selecione uma gravadora específica (não \"Todas\") antes de enviar o reporte.");
            return;

        }

        if (!ReportRecipientsData.isLoaded()) {

            try {
                await ReportRecipientsData.load();
            }
            catch (error) {
                console.error("[ReportSend]", error);
            }

        }

        this.bindEvents();

        this._idioma = ReportDashboard.filters.idioma || "pt";

        this._coversChecked = false;

        const lookup = ReportRecipientsData.lookup(territorio, gravadora);

        this._currentLookup = lookup;

        document.getElementById("reportSendSubtitle").textContent = `${gravadora} · ${territorio}`;

        document.getElementById("reportSendToHeaderName").textContent = gravadora;

        document.getElementById("reportSendTo").value = lookup ? lookup.destinatarios : "";

        this.renderAmbiguousWarning(territorio, gravadora, lookup);

        document.getElementById("reportSendCcRuben").checked = (territorio === "LatAm" || territorio === "Todos");

        this.syncExtraRecipients();

        this.renderForMode();

        this.renderForLanguage();

        document.getElementById("reportSendModal").classList.add("open");

    },

    /**
     * Mostra só o que se aplica ao modo escolhido no pop-up
     * anterior: em "corpo", só o botão de colar tabela (a tabela
     * vai no texto) e a mensagem fixa de que o envio já sai
     * copiado; em "planilha", só o botão de atualizar planilha e os
     * dois modos de envio (direto/copiar), como já era antes, com
     * "Copiar formatação" marcado por padrão a cada abertura.
     *
     * Também numera os passos do rodapé: no modo "planilha",
     * "Atualizar planilha" (fixo, numerado direto no HTML) é o
     * passo 1, então "Baixar capas"/"Enviar e-mail" viram 2 e 3; no
     * modo "corpo" esse passo nem existe, então eles voltam a 1 e 2.
     */
    renderForMode() {

        const isCorpo = this._mode === "corpo";

        document.getElementById("reportSendPasteTableBtn").style.display = isCorpo ? "" : "none";
        document.getElementById("reportSendUpdateSheetBtn").style.display = isCorpo ? "none" : "";
        document.getElementById("reportSendUpdateSheetStepNum").style.display = isCorpo ? "none" : "";

        document.getElementById("reportSendModeToggle").style.display = isCorpo ? "none" : "";
        document.getElementById("reportSendCorpoReadyHint").style.display = isCorpo ? "" : "none";

        document.getElementById("reportSendCoversStepNum").textContent = isCorpo ? "1" : "2";
        document.getElementById("reportSendGmailStepNum").textContent = isCorpo ? "2" : "3";

        if (!isCorpo) {

            document.querySelector('input[name="reportSendMode"][value="copiar"]').checked = true;

        }

        this.updateModeAvailability();

    },

    /**
     * Mostra, sempre que se aplicar, um aviso vermelho junto de
     * Destinatários explicando por que o campo não veio preenchido
     * sozinho: a gravadora tem contato específico por território
     * (Brasil/LatAm) na planilha, mas o filtro do dashboard está
     * em "Todos", então o dashboard não sabe qual dos dois usar.
     * Sem esse aviso, o campo vazio parece um bug em vez de um
     * caso esperado.
     */
    renderAmbiguousWarning(territorio, gravadora, lookup) {

        const warning = document.getElementById("reportSendAmbiguousWarning");

        const isAmbiguous = !lookup &&
            territorio === "Todos" &&
            ReportRecipientsData.countRowsForGravadora(gravadora) > 1;

        warning.style.display = isAmbiguous ? "" : "none";

        warning.textContent = isAmbiguous
            ? `${gravadora} tem contato específico por território na planilha. Selecione Brasil ou LatAm no filtro (em vez de "Todos") para preencher destinatários automaticamente.`
            : "";

    },

    close() {

        document.getElementById("reportSendModal").classList.remove("open");

    },

    /**
     * Regera assunto + corpo-modelo no idioma atual (this._idioma)
     * e atualiza os botões de idioma pra mostrar qual está ativo.
     */
    renderForLanguage() {

        const gravadora = ReportDashboard.filters.gravadora;

        document.getElementById("reportSendSubject").value = this.buildSubject(gravadora, this._idioma);

        // O corpo é regerado do zero — qualquer posição de cursor
        // salva antes deixa de existir.
        this._savedRange = null;

        document.getElementById("reportSendBody").innerHTML = this.buildBodyTemplate(gravadora, this._idioma);

        document.querySelectorAll(".report-send-lang-btn").forEach(btn => {

            btn.classList.toggle("active", btn.dataset.lang === this._idioma);

        });

        this.updateModeAvailability();

    },

    /**
     * Data da semana selecionada no filtro (já vem "dd/mm/aaaa"),
     * reformatada pro padrão de cada idioma. Usa o início de
     * assunto que a própria gravadora tem na planilha ("Título
     * Destaque") sempre que existir, independente do idioma
     * marcado ali em cima (essa coluna só existe em português na
     * planilha, mas mostrar ela mesmo assim é mais previsível do
     * que trocar escondido pra um texto genérico sem avisar).
     */
    buildSubject(gravadora, idioma) {

        const semana = ReportDashboard.filters.semana || "";

        if (this._currentLookup && this._currentLookup.tituloDestaque) {

            return `${this._currentLookup.tituloDestaque} ${semana}`.trim();

        }

        if (idioma === "en") {

            const partes = semana.split("/");

            const dataEn = partes.length === 3 ? `${partes[1]}/${partes[0]}/${partes[2]}` : semana;

            return `Claro música | ${gravadora} - Highlights of the week ${dataEn}`;

        }

        if (idioma === "es") {

            return `Claro música | ${gravadora} - Destacados de la semana ${semana}`;

        }

        return `Claro música | ${gravadora} - Destaques da semana ${semana}`;

    },

    /**
     * Usa o corpo padrão da própria gravadora (coluna "E-mail
     * padrão" da planilha) sempre que existir, independente do
     * idioma marcado (mesmo motivo do assunto, ver buildSubject).
     *
     * No modo "planilha", um trecho entre colchetes duplos (ex.:
     * "confira [[aqui]] a tabela") vira o link clicável, exatamente
     * onde foi escrito. Sem colchetes no texto, o placeholder entra
     * como um parágrafo novo no final. "Atualizar planilha de
     * destaque" transforma ele num link de verdade pra planilha.
     *
     * No modo "corpo", os colchetes duplos não fazem sentido (a
     * tabela vai onde a pessoa clicar com "Colar tabela de
     * destaques", não num ponto fixo do texto padrão) — o texto
     * sai normal, sem os colchetes e sem virar link, e nenhum
     * placeholder extra é acrescentado (ver textToParagraphs).
     *
     * Sem corpo padrão configurado pra essa gravadora, cai num
     * texto-modelo genérico editável.
     */
    buildBodyTemplate(gravadora, idioma) {

        const labels = this.LABELS[idioma] || this.LABELS.pt;

        const isCorpo = this._mode === "corpo";

        const genericPlaceholderHtml = `<p><a href="#" class="report-send-placeholder-link" data-placeholder="tabela-link">${this.escapeHtml(labels.placeholderText)}</a></p>`;

        if (this._currentLookup && this._currentLookup.corpoPadrao) {

            const { html, hasMarker } = this.textToParagraphs(this._currentLookup.corpoPadrao);

            if (isCorpo) return html;

            return hasMarker ? html : html + genericPlaceholderHtml;

        }

        return [
            `<p>${this.escapeHtml(labels.greeting(gravadora))}</p>`,
            `<p>${this.escapeHtml(labels.intro)}</p>`,
            isCorpo ? "" : genericPlaceholderHtml,
            `<p>${this.escapeHtml(labels.closing)}</p>`
        ].join("");

    },

    /**
     * Texto puro (com linhas em branco separando parágrafos, como
     * vem da célula da planilha) -> parágrafos HTML, preservando
     * quebras de linha simples dentro de cada parágrafo. Um trecho
     * entre colchetes duplos, tipo "[[clique aqui]]", vira o link
     * clicável (placeholder) bem naquele ponto do texto — devolve
     * também se achou algum, pra quem chamou saber se ainda
     * precisa acrescentar o placeholder em outro lugar. No modo
     * "corpo" (ver buildBodyTemplate), os colchetes duplos são só
     * ignorados/removidos, sobrando o texto normal.
     */
    textToParagraphs(text) {

        let hasMarker = false;

        const isCorpo = this._mode === "corpo";

        const html = text
            .split(/\n{2,}/)
            .map(block => block.trim())
            .filter(Boolean)
            .map(block => {

                let escaped = this.escapeHtml(block).replace(/\n/g, "<br>");

                escaped = this.linkifyHandles(escaped);

                escaped = escaped.replace(/\[\[(.+?)\]\]/g, (match, label) => {

                    if (isCorpo) return label;

                    hasMarker = true;

                    return `<a href="#" class="report-send-placeholder-link" data-placeholder="tabela-link">${label}</a>`;

                });

                // "[texto](URL)" -> link de verdade, qualquer um,
                // em qualquer ponto do texto padrão (diferente do
                // [[texto]] acima, que é só pro placeholder da
                // tabela/planilha). No modo "Enviar direto, sem
                // formatação" já sai como "texto (URL)" sozinho
                // (ver htmlToPlainText).
                escaped = escaped.replace(/\[([^\[\]]+?)\]\(([^()\s]+)\)/g, (match, label, url) =>
                    `<a href="${url}" target="_blank" rel="noopener">${label}</a>`
                );

                return `<p>${escaped}</p>`;

            })
            .join("");

        return { html, hasMarker };

    },

    /**
     * "@usuario" -> link clicável pro perfil do Instagram. Só
     * considera "@" no início da linha ou depois de espaço (nunca
     * no meio de uma palavra), pra não confundir com o "@" de um
     * e-mail (ex.: "nome@gravadora.com" continua intacto). O handle
     * não pode TERMINAR em ponto (só interno, ex.: "@claro.musica"),
     * senão o ponto final de frase ("...@handle." de fim de frase)
     * entrava junto no link e na URL.
     *
     * A classe "report-send-ig-link" marca esse link como especial
     * pro htmlToPlainText: diferente do link da planilha ([[texto]])
     * e de um link manual (botão 🔗), que no modo "Enviar direto"
     * sempre mostram a URL entre parênteses, o @handle no modo
     * direto fica só o texto, sem link nenhum (nem clicável, nem a
     * URL por extenso) — só o clique/formatação copiada é que
     * precisa do link de verdade.
     */
    linkifyHandles(escapedText) {

        return escapedText.replace(/(^|\s)@([a-zA-Z0-9_](?:[a-zA-Z0-9._]*[a-zA-Z0-9_])?)/g, (match, prefix, handle) =>
            `${prefix}<a href="https://www.instagram.com/${handle}" target="_blank" rel="noopener" class="report-send-ig-link">@${handle}</a>`
        );

    },

    bindEvents() {

        if (this._bound) return;

        this._bound = true;

        document.getElementById("reportSendChooserClose").addEventListener("click", () => this.closeChooser());

        document.getElementById("reportSendChooserModal").addEventListener("click", (event) => {

            if (event.target.id === "reportSendChooserModal") this.closeChooser();

        });

        document.getElementById("reportSendChooserPlanilha").addEventListener("click", () => this.selectMode("planilha"));

        document.getElementById("reportSendChooserCorpo").addEventListener("click", () => this.selectMode("corpo"));

        document.getElementById("reportSendClose").addEventListener("click", () => this.close());

        document.getElementById("reportSendModal").addEventListener("click", (event) => {

            if (event.target.id === "reportSendModal") this.close();

        });

        document.getElementById("reportSendConfirmClose").addEventListener("click", () => this.closeConfirm());

        document.getElementById("reportSendConfirmModal").addEventListener("click", (event) => {

            if (event.target.id === "reportSendConfirmModal") this.closeConfirm();

        });

        document.getElementById("reportSendConfirmRetryLink").addEventListener("click", (event) => {

            event.preventDefault();

            this.sendEmail();

        });

        document.getElementById("reportSendConfirmDoneBtn").addEventListener("click", () => {

            this.closeConfirm();
            this.close();

        });

        document.addEventListener("keydown", (event) => {

            if (event.key !== "Escape") return;

            const confirmModal = document.getElementById("reportSendConfirmModal");
            const modal = document.getElementById("reportSendModal");
            const chooser = document.getElementById("reportSendChooserModal");

            if (confirmModal.classList.contains("open")) this.closeConfirm();
            else if (modal.classList.contains("open")) this.close();
            else if (chooser.classList.contains("open")) this.closeChooser();

        });

        // Guarda onde o cursor está dentro do corpo a cada clique/
        // tecla, pra "Colar tabela de destaques" inserir bem ali,
        // em vez de sempre no final.
        const bodyForRange = document.getElementById("reportSendBody");

        bodyForRange.addEventListener("mouseup", () => this.saveSelection());
        bodyForRange.addEventListener("keyup", () => this.saveSelection());

        document.querySelectorAll(".report-send-lang-btn").forEach(btn => {

            btn.addEventListener("click", () => {

                this._idioma = btn.dataset.lang;

                this.renderForLanguage();

            });

        });

        document.getElementById("reportSendBoldBtn").addEventListener("click", () => {

            document.getElementById("reportSendBody").focus();
            document.execCommand("bold");

        });

        document.getElementById("reportSendLinkBtn").addEventListener("click", () => {

            const url = prompt("Cole o link:");

            if (!url) return;

            document.getElementById("reportSendBody").focus();
            document.execCommand("createLink", false, url);

        });

        document.getElementById("reportSendCcRuben").addEventListener("change", () => this.syncExtraRecipients());

        document.getElementById("reportSendPasteTableBtn").addEventListener("click", () => this.pasteTable());

        document.getElementById("reportSendUpdateSheetBtn").addEventListener("click", () => this.updateSheet());

        document.getElementById("reportSendRemoveTableBtn").addEventListener("click", () => this.removeTable());

        document.getElementById("reportSendBody").addEventListener("input", () => this.updateModeAvailability());

        document.getElementById("reportSendCoversBtn").addEventListener("click", () => this.downloadCovers());

        document.getElementById("reportSendGmailBtn").addEventListener("click", () => this.sendEmail());

    },

    /**
     * Junta os e-mails fixos dos checkboxes marcados ("Copiar
     * Editorial"/"Copiar Marketing"/"Copiar Ruben") aos
     * destinatários já preenchidos, sem duplicar e sem apagar
     * edições manuais no campo. Roda de novo a cada vez que um
     * checkbox muda, removendo primeiro os 3 e-mails fixos (onde
     * quer que estejam) e recolocando só os que continuam
     * marcados.
     */
    syncExtraRecipients() {

        const input = document.getElementById("reportSendTo");

        const normalize = (email) => email.trim().toLowerCase();

        const extrasNormalized = Object.values(this.EXTRA_RECIPIENTS).map(normalize);

        const current = input.value
            .split(",")
            .map(email => email.trim())
            .filter(email => email && !extrasNormalized.includes(normalize(email)));

        if (document.getElementById("reportSendCcEditorial").checked) current.push(this.EXTRA_RECIPIENTS.editorial);
        if (document.getElementById("reportSendCcMarketing").checked) current.push(this.EXTRA_RECIPIENTS.marketing);
        if (document.getElementById("reportSendCcRuben").checked) current.push(this.EXTRA_RECIPIENTS.ruben);

        input.value = current.join(", ");

    },

    /**
     * Acha o placeholder (âncora tracejada) no corpo, se ainda
     * estiver lá — undefined se já foi resolvido (virou tabela)
     * ou apagado pela pessoa.
     */
    findPlaceholder() {

        return document.getElementById("reportSendBody").querySelector(".report-send-placeholder-link");

    },

    /**
     * Guarda a posição atual do cursor/seleção dentro do corpo do
     * e-mail, só quando ela está mesmo dentro dele (clique fora não
     * sobrescreve a última posição válida).
     */
    saveSelection() {

        const selection = window.getSelection();

        if (!selection.rangeCount) return;

        const range = selection.getRangeAt(0);
        const body = document.getElementById("reportSendBody");

        if (body.contains(range.commonAncestorContainer)) {

            this._savedRange = range.cloneRange();

        }

    },

    /**
     * Tira o placeholder padrão ("confira a tabela/planilha aqui"),
     * se ainda estiver no corpo — usado depois de colar a tabela em
     * outro lugar, pra não sobrar um link quebrado (href="#") solto
     * no texto.
     */
    removeLeftoverPlaceholder() {

        const placeholder = this.findPlaceholder();

        if (!placeholder) return;

        const parentParagraph = placeholder.closest("p") || placeholder;

        parentParagraph.remove();

    },

    /**
     * Insere a tabela de destaques do recorte atual (mesmo HTML de
     * "Copiar tabela") bem na posição do cursor dentro do corpo,
     * sempre com uma linha em branco antes e depois pra ficar
     * organizado. Sem uma posição de cursor salva (a pessoa nunca
     * clicou dentro do corpo nessa sessão do pop-up), cai no final
     * do texto, como antes.
     *
     * Usa document.execCommand("insertHTML") em vez de mexer direto
     * na Range/DOM — inserir manualmente um <table> (bloco) no meio
     * do texto de um <p> aninha errado (<p> dentro de <p>, HTML
     * inválido); o execCommand faz a mesma "quebra de parágrafo" que
     * um editor de texto de verdade faz ao colar um bloco no meio de
     * uma frase.
     */
    pasteTable() {

        const rows = ReportDashboard.getFilteredRows();

        if (!rows.length) {

            alert("Nenhum destaque encontrado para esse recorte.");
            return;

        }

        const tableHtml = ReportDashboard.buildTableHtml(rows, ReportDashboard.LANGUAGES[this._idioma], { fullTable: false, inline: true });

        const insertHtml = `<p><br></p>${tableHtml}<p><br></p>`;

        const body = document.getElementById("reportSendBody");

        body.focus();

        const selection = window.getSelection();

        const range = this._savedRange;
        const rangeValid = range && body.contains(range.commonAncestorContainer);

        selection.removeAllRanges();

        if (rangeValid) {

            selection.addRange(range);

        }
        else {

            // Sem posição salva -> cursor no final do corpo.
            const endRange = document.createRange();

            endRange.selectNodeContents(body);
            endRange.collapse(false);

            selection.addRange(endRange);

        }

        const inserted = document.execCommand("insertHTML", false, insertHtml);

        if (!inserted) {

            // Sem suporte a execCommand nesse navegador -> pelo
            // menos garante que a tabela entra em algum lugar (fim
            // do corpo), em vez de não fazer nada.
            body.insertAdjacentHTML("beforeend", insertHtml);

        }

        if (selection.rangeCount) this.saveSelection();

        this.removeLeftoverPlaceholder();

        this.updateModeAvailability();

    },

    /**
     * Manda a tabela de destaques pro Apps Script (único, serve
     * pra todas as gravadoras), que insere uma aba nova DIRETO na
     * planilha da própria gravadora, já formatada (cores de
     * Capa/Inclusão/Instagram, cabeçalho vermelho), nomeada com a
     * semana ("dd/mm/aa"). Rodar de novo pra mesma semana
     * substitui a aba anterior, em vez de duplicar. Abre a
     * planilha da gravadora já na aba nova, pra conferir. O
     * placeholder no corpo do e-mail vira um link de verdade pra
     * essa planilha (a mesma, não uma intermediária).
     */
    async updateSheet() {

        if (!this._currentLookup || !this._currentLookup.linkPlanilha) {

            alert("Ainda não há uma planilha configurada pra essa gravadora/território. Isso vem da planilha de destinatários (em configuração).");
            return;

        }

        if (!CONFIG.REPORT_SEND.webAppUrl) {

            alert("Atualização de planilha ainda não configurada (CONFIG.REPORT_SEND.webAppUrl vazia).");
            return;

        }

        const rows = ReportDashboard.getFilteredRows();

        if (!rows.length) {

            alert("Nenhum destaque encontrado para esse recorte.");
            return;

        }

        const btn = document.getElementById("reportSendUpdateSheetBtn");
        const original = btn.textContent;

        btn.disabled = true;
        btn.textContent = "Atualizando planilha...";

        const { headers, data, tipos, destaqueColIndex } = ReportDashboard.buildTableData(rows, ReportDashboard.LANGUAGES[this._idioma]);

        const nomeAba = this.formatTabName(ReportDashboard.filters.semana);

        try {

            const response = await fetch(CONFIG.REPORT_SEND.webAppUrl, {

                method: "POST",
                headers: { "Content-Type": "text/plain;charset=utf-8" },
                body: JSON.stringify({

                    token: CONFIG.REPORT_SEND.sharedSecret,
                    linkPlanilhaDestino: this._currentLookup.linkPlanilha,
                    nomeAba,
                    headers,
                    rows: data,
                    tipos,
                    destaqueColIndex

                })

            });

            const result = await response.json();

            if (!result.success) {
                throw new Error((result.errors && result.errors[0]) || "Erro ao atualizar a planilha.");
            }

            // O placeholder só vira link de verdade (e o botão
            // "Enviar e-mail" só libera, ver updateModeAvailability)
            // DEPOIS de confirmar que a planilha foi mesmo
            // atualizada — setar antes, otimisticamente, deixaria o
            // link/botão liberados mesmo se essa chamada falhasse.
            const placeholder = this.findPlaceholder();

            if (placeholder) {
                placeholder.setAttribute("href", this._currentLookup.linkPlanilha);
            }

            this.updateModeAvailability();

            btn.textContent = "✔ Planilha atualizada, abrindo...";

            window.open(result.url, "_blank");

        }
        catch (error) {

            console.error("[ReportSend]", error);

            alert("Não foi possível atualizar a planilha agora. Tente de novo.");

        }
        finally {

            btn.disabled = false;

            setTimeout(() => { btn.textContent = original; }, 1800);

        }

    },

    /**
     * "dd/mm/aaaa" (formato do filtro de semana) -> "dd/mm/aa",
     * usado como nome da aba nova na planilha da gravadora.
     */
    formatTabName(semanaStr) {

        const partes = String(semanaStr || "").split("/");

        if (partes.length !== 3) return semanaStr || "Destaques";

        return `${partes[0]}/${partes[1]}/${partes[2].slice(-2)}`;

    },

    downloadCovers() {

        const rows = ReportDashboard.getFilteredRows().filter(row => row.destaque === "CAPA");

        if (!rows.length) {

            alert("Nenhuma capa (Capa/Portada/Cover) encontrada para esse recorte.");

            // Não há capa nenhuma pra esse recorte -> não tem o que
            // baixar, mas a pessoa já clicou e conferiu, então o
            // passo conta como resolvido (ver updateModeAvailability).
            this.markCoversChecked();

            return;

        }

        ReportCoverDownload.open(rows, ReportDashboard.formatCountry.bind(ReportDashboard), {

            territorio: ReportDashboard.filters.territorio,
            gravadora: ReportDashboard.filters.gravadora || "Todas",
            semana: ReportDashboard.filters.semana

        }, () => this.markCoversChecked());

    },

    /**
     * Marca o passo "Baixar capas" como resolvido (ver
     * _coversChecked acima) e reavalia se "Enviar e-mail" já pode
     * ser liberado.
     */
    markCoversChecked() {

        this._coversChecked = true;

        this.updateModeAvailability();

    },

    /**
     * No modo "planilha", com uma tabela colada no corpo, "Enviar
     * direto, sem formatação" fica indisponível (uma tabela em
     * texto puro sai ilegível) — desmarca e desabilita essa opção
     * automaticamente, com um aviso. No modo "corpo" esses radios
     * nem aparecem (ver renderForMode()), então isso não se aplica.
     *
     * Também impõe a ordem dos passos no modo "planilha" (1.
     * Atualizar planilha -> 2. Baixar capas -> 3. Enviar e-mail):
     * - "Baixar capas" só destrava depois que "Atualizar planilha
     *   de destaque" resolver o link da planilha ([[texto]]) com
     *   sucesso — enquanto isso, fica desabilitado com uma dica. No
     *   modo "corpo" esse passo nem existe, então "Baixar capas" já
     *   nasce destravado.
     * - "Enviar e-mail" só destrava depois dos dois passos
     *   anteriores resolvidos: o link da planilha (só no modo
     *   "planilha" — sem nenhum [[texto]] no corpo, ou no modo
     *   "corpo" onde ele nem chega a virar link, não há nada
     *   esperando resolução por aqui) e this._coversChecked (ver
     *   markCoversChecked()).
     * Uma dica ao passar o mouse nos botões desabilitados explica o
     * que falta.
     */
    updateModeAvailability() {

        const body = document.getElementById("reportSendBody");
        const hasTable = !!body.querySelector("table");

        const diretoInput = document.querySelector('input[name="reportSendMode"][value="direto"]');
        const copiarInput = document.querySelector('input[name="reportSendMode"][value="copiar"]');
        const notice = document.getElementById("reportSendTableNotice");
        const removeBtn = document.getElementById("reportSendRemoveTableBtn");

        diretoInput.disabled = hasTable;

        notice.style.display = (hasTable && this._mode !== "corpo") ? "" : "none";

        removeBtn.style.display = (hasTable && this._mode === "corpo") ? "" : "none";

        if (hasTable && diretoInput.checked) {

            diretoInput.checked = false;
            copiarInput.checked = true;

        }

        const isPlanilha = this._mode === "planilha";

        const placeholder = this.findPlaceholder();
        const placeholderHref = placeholder ? (placeholder.getAttribute("href") || "") : "";
        const linkPendente = !!placeholder && (placeholderHref === "#" || placeholderHref === "");
        const sheetPendente = isPlanilha && linkPendente;

        const sheetCheck = document.getElementById("reportSendUpdateSheetCheck");

        if (sheetCheck) sheetCheck.style.display = (isPlanilha && !linkPendente) ? "" : "none";

        const coversBtn = document.getElementById("reportSendCoversBtn");

        if (coversBtn) {

            coversBtn.disabled = sheetPendente;

            coversBtn.title = sheetPendente
                ? "Clique em \"Atualizar planilha de destaque\" antes de baixar as capas."
                : "";

        }

        const coversCheck = document.getElementById("reportSendCoversCheck");

        if (coversCheck) coversCheck.style.display = this._coversChecked ? "" : "none";

        const sendBtn = document.getElementById("reportSendGmailBtn");
        const coversPendente = !this._coversChecked;

        sendBtn.disabled = linkPendente || coversPendente;

        const pendingSteps = [];

        if (linkPendente) pendingSteps.push("atualizar a planilha de destaque");
        if (coversPendente) pendingSteps.push("baixar as capas");

        sendBtn.title = pendingSteps.length
            ? `Antes de enviar, é preciso: ${pendingSteps.join(" e ")}.`
            : "";

    },

    /**
     * Tira a tabela colada (e as linhas em branco que
     * "Colar tabela de destaques" adicionou antes/depois dela),
     * deixando o corpo só com o texto — pra colar de novo em outro
     * lugar, é só posicionar o cursor e clicar em "Colar tabela de
     * destaques" mais uma vez.
     */
    removeTable() {

        const body = document.getElementById("reportSendBody");
        const table = body.querySelector("table");

        if (!table) return;

        const isBlankParagraph = (el) => el && el.tagName === "P" &&
            (el.innerHTML.trim() === "<br>" || el.textContent.trim() === "");

        const prev = table.previousElementSibling;
        const next = table.nextElementSibling;

        if (isBlankParagraph(prev)) prev.remove();
        if (isBlankParagraph(next)) next.remove();

        table.remove();

        this._savedRange = null;

        this.updateModeAvailability();

    },

    /**
     * Troca, DIRETO na caixa visível (não numa cópia fora da tela —
     * isso já causou um bug visual de fundo azul ao copiar, um
     * elemento posicionado fora da tela aparentemente pinta esquisito
     * o destaque de seleção nele), qualquer placeholder AINDA não
     * resolvido (href="#", "Atualizar planilha de destaque" não
     * clicado) por texto puro, sem link nenhum. Sem essa troca,
     * copiar formatado faria o navegador resolver o "#" pra URL da
     * própria página do dashboard, mandando um link errado no
     * e-mail. Devolve uma lista pra desfazer a troca logo depois
     * (ver restoreUnresolvedPlaceholders) — a pessoa nem chega a
     * perceber, a troca e o desfazer acontecem no mesmo instante,
     * antes da tela redesenhar.
     */
    stripUnresolvedPlaceholders(bodyEl) {

        const replacements = [];

        bodyEl.querySelectorAll(".report-send-placeholder-link").forEach(anchor => {

            const href = anchor.getAttribute("href") || "";

            if (href === "#" || href === "") {

                const textNode = document.createTextNode(anchor.textContent);

                anchor.replaceWith(textNode);

                replacements.push({ anchor, textNode });

            }

        });

        return replacements;

    },

    restoreUnresolvedPlaceholders(replacements) {

        replacements.forEach(({ anchor, textNode }) => { textNode.replaceWith(anchor); });

    },

    /**
     * "text (URL)" pra links de verdade (href diferente de "#" —
     * ainda não resolvido), só o texto quando o placeholder nunca
     * foi preenchido. Preserva parágrafos como linha em branco.
     *
     * Exceção: link de @handle do Instagram (linkifyHandles, classe
     * "report-send-ig-link") sempre fica só o texto no modo direto,
     * mesmo já tendo uma URL de verdade — diferente do link da
     * planilha ([[texto]]) e de um link manual (botão 🔗), que
     * sempre mostram a URL entre parênteses.
     */
    htmlToPlainText(root) {

        const walk = (node) => {

            if (node.nodeType === Node.TEXT_NODE) return node.textContent;

            if (node.nodeType !== Node.ELEMENT_NODE) return "";

            const tag = node.tagName.toLowerCase();

            if (tag === "br") return "\n";

            if (tag === "a") {

                const text = node.textContent;
                const href = node.getAttribute("href") || "";

                if (node.classList.contains("report-send-ig-link")) return text;

                return (href && href !== "#") ? `${text} (${href})` : text;

            }

            let inner = "";

            node.childNodes.forEach(child => { inner += walk(child); });

            if (tag === "p" || tag === "div") return `${inner}\n\n`;

            return inner;

        };

        return walk(root)
            .replace(/\n{3,}/g, "\n\n")
            .trim();

    },

    sendEmail() {

        // No modo "corpo" (tabela colada no texto), o envio é
        // sempre com formatação copiada — não tem os radios pra
        // escolher (ver renderForMode()).
        const mode = this._mode === "corpo"
            ? "copiar"
            : document.querySelector('input[name="reportSendMode"]:checked').value;

        const to = document.getElementById("reportSendTo").value.trim();
        const subject = document.getElementById("reportSendSubject").value.trim();

        // Chega até aqui só quando o botão "Enviar e-mail" está
        // liberado (ver updateModeAvailability) — ele mesmo fica
        // desabilitado, com dica ao passar o mouse, enquanto o link
        // da planilha não foi resolvido. A troca abaixo continua
        // como segunda camada de segurança, pra nunca vazar um link
        // "#" (ele viraria a URL do próprio dashboard ao copiar
        // formatado) mesmo num caso não previsto — troca e desfaz na
        // hora, direto na caixa visível (nada de clone fora da tela).
        const bodyEl = document.getElementById("reportSendBody");

        const replacements = this.stripUnresolvedPlaceholders(bodyEl);

        try {

            this.sendEmailWithBody(bodyEl, mode, to, subject);

        }
        finally {

            this.restoreUnresolvedPlaceholders(replacements);

        }

        this.showConfirm();

    },

    /**
     * Popup de confirmação mostrado depois de abrir o Gmail (nos
     * dois modos de envio) — como o "envio" de verdade só acontece
     * quando a pessoa clica em enviar lá dentro do Gmail (o
     * dashboard só prepara/abre o rascunho), esse popup serve pra
     * lembrete + registro de que o passo por aqui foi concluído, com
     * um link de retentativa caso algo tenha dado errado (reabre o
     * Gmail com o mesmo conteúdo, chamando sendEmail() de novo).
     */
    showConfirm() {

        const gravadora = ReportDashboard.filters.gravadora;
        const semana = ReportDashboard.filters.semana;
        const territorio = ReportDashboard.filters.territorio;

        const territorioTexto =
            territorio === "Brasil" ? "no Brasil"
                : territorio === "LatAm" ? "na LatAm"
                    : "em todos os territórios";

        const message = document.getElementById("reportSendConfirmMessage");

        if (message) {

            message.textContent =
                `E-mail enviado para ${gravadora}, referente aos destaques da semana ${semana} ${territorioTexto}.`;

        }

        document.getElementById("reportSendConfirmModal").classList.add("open");

    },

    closeConfirm() {

        const modal = document.getElementById("reportSendConfirmModal");

        if (!modal) return;

        modal.classList.remove("open");

    },

    sendEmailWithBody(bodyEl, mode, to, subject) {

        if (mode === "copiar") {

            const range = document.createRange();

            range.selectNodeContents(bodyEl);

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

            const btn = document.getElementById("reportSendGmailBtn");
            const original = btn.textContent;

            btn.textContent = ok ? "✔ Copiado! Abrindo Gmail..." : "Não foi possível copiar";

            setTimeout(() => { btn.textContent = original; }, 1800);

            const url = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(to)}&su=${encodeURIComponent(subject)}`;

            window.open(url, "_blank");

            return;

        }

        // O parâmetro de corpo da URL do Gmail só interpreta quebra
        // de linha de forma confiável em CRLF (\r\n) — só \n
        // (padrão do navegador) às vezes vem tudo grudado.
        const plainBody = this.htmlToPlainText(bodyEl).replace(/\n/g, "\r\n");

        const url = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(to)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(plainBody)}`;

        window.open(url, "_blank");

    },

    escapeHtml(text) {

        return String(text || "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");

    }

};
