/**
 * ==========================================================
 * GERADOR DE REPORTE — "Enviar reporte" (e-mail semanal)
 * ----------------------------------------------------------
 * Monta o e-mail que a Rachel manda toda sexta-feira pra cada
 * gravadora: destinatários e link da planilha compartilhada
 * (puxados de ReportRecipientsData, quando configurado),
 * assunto (PT/ES/EN, com a data da semana selecionada, idioma
 * inicial vindo do território mas trocável na hora) e um corpo
 * de e-mail livre e editável, com um placeholder (link
 * tracejado "tabela/link") que os botões "Colar tabela de
 * destaques" e "Atualizar planilha de destaque" preenchem.
 *
 * O Gmail não aceita corpo formatado (negrito/link) via URL de
 * abertura direta, só texto puro. Por isso o rodapé tem duas
 * opções mutuamente exclusivas:
 * - "Enviar direto, sem formatação": abre o Gmail com o corpo
 *   já preenchido em texto puro (link do placeholder aparece
 *   como texto + URL entre parênteses).
 * - "Copiar formatação e abrir Gmail para colar": copia o corpo
 *   COM formatação (negrito, link embutido) pra área de
 *   transferência e abre o Gmail só com destinatário/assunto,
 *   pra colar manualmente.
 * Com uma tabela colada no corpo, só a segunda opção faz
 * sentido (tabela em texto puro fica ilegível) — a primeira
 * fica desabilitada automaticamente nesse caso.
 * ==========================================================
 */

const ReportSend = {

    _bound: false,
    _currentLookup: null,
    _idioma: "pt",

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

        const lookup = ReportRecipientsData.lookup(territorio, gravadora);

        this._currentLookup = lookup;

        document.getElementById("reportSendSubtitle").textContent = `${gravadora} · ${territorio}`;

        document.getElementById("reportSendTo").value = lookup ? lookup.destinatarios : "";

        this.renderForLanguage();

        document.getElementById("reportSendModal").classList.add("open");

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
     * Se o texto da célula tiver um trecho entre colchetes duplos
     * (ex.: "confira [[aqui]] a tabela"), esse trecho vira o link
     * clicável, exatamente onde foi escrito. Sem colchetes no
     * texto, o placeholder entra como um parágrafo novo no final.
     * "Colar tabela de destaques" substitui esse link pela tabela;
     * "Atualizar planilha de destaque" transforma ele num link de
     * verdade pra planilha. Sem corpo padrão configurado pra essa
     * gravadora, cai num texto-modelo genérico editável.
     */
    buildBodyTemplate(gravadora, idioma) {

        const labels = this.LABELS[idioma] || this.LABELS.pt;

        const genericPlaceholderHtml = `<p><a href="#" class="report-send-placeholder-link" data-placeholder="tabela-link">${this.escapeHtml(labels.placeholderText)}</a></p>`;

        if (this._currentLookup && this._currentLookup.corpoPadrao) {

            const { html, hasMarker } = this.textToParagraphs(this._currentLookup.corpoPadrao);

            return hasMarker ? html : html + genericPlaceholderHtml;

        }

        return [
            `<p>${this.escapeHtml(labels.greeting(gravadora))}</p>`,
            `<p>${this.escapeHtml(labels.intro)}</p>`,
            genericPlaceholderHtml,
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
     * precisa acrescentar o placeholder em outro lugar.
     */
    textToParagraphs(text) {

        let hasMarker = false;

        const html = text
            .split(/\n{2,}/)
            .map(block => block.trim())
            .filter(Boolean)
            .map(block => {

                let escaped = this.escapeHtml(block).replace(/\n/g, "<br>");

                escaped = this.linkifyHandles(escaped);

                escaped = escaped.replace(/\[\[(.+?)\]\]/g, (match, label) => {

                    hasMarker = true;

                    return `<a href="#" class="report-send-placeholder-link" data-placeholder="tabela-link">${label}</a>`;

                });

                return `<p>${escaped}</p>`;

            })
            .join("");

        return { html, hasMarker };

    },

    /**
     * "@usuario" -> link clicável pro perfil do Instagram. Só
     * considera "@" no início da linha ou depois de espaço (nunca
     * no meio de uma palavra), pra não confundir com o "@" de um
     * e-mail (ex.: "nome@gravadora.com" continua intacto).
     */
    linkifyHandles(escapedText) {

        return escapedText.replace(/(^|\s)@([a-zA-Z0-9._]+)/g, (match, prefix, handle) =>
            `${prefix}<a href="https://www.instagram.com/${handle}" target="_blank" rel="noopener">@${handle}</a>`
        );

    },

    bindEvents() {

        if (this._bound) return;

        this._bound = true;

        document.getElementById("reportSendClose").addEventListener("click", () => this.close());

        document.getElementById("reportSendModal").addEventListener("click", (event) => {

            if (event.target.id === "reportSendModal") this.close();

        });

        document.addEventListener("keydown", (event) => {

            if (event.key !== "Escape") return;

            const modal = document.getElementById("reportSendModal");

            if (modal.classList.contains("open")) this.close();

        });

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

        document.getElementById("reportSendPasteTableBtn").addEventListener("click", () => this.pasteTable());

        document.getElementById("reportSendUpdateSheetBtn").addEventListener("click", () => this.updateSheet());

        document.getElementById("reportSendRemoveTableBtn").addEventListener("click", () => this.removeTable());

        document.getElementById("reportSendBody").addEventListener("input", () => this.updateModeAvailability());

        document.getElementById("reportSendDownloadCoversLink").addEventListener("click", (event) => {

            event.preventDefault();

            this.downloadCovers();

        });

        document.getElementById("reportSendGmailBtn").addEventListener("click", () => this.sendEmail());

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
     * Substitui o placeholder pela tabela de destaques do recorte
     * atual (mesmo HTML de "Copiar tabela"), sempre com uma linha
     * em branco antes e depois pra ficar organizado.
     */
    pasteTable() {

        const placeholder = this.findPlaceholder();

        if (!placeholder) {

            alert("O placeholder de tabela/link não está mais no corpo do e-mail (foi apagado ou já foi usado). Apague o texto onde quer a tabela e tente de novo, ou reabra o pop-up pra recomeçar.");
            return;

        }

        const rows = ReportDashboard.getFilteredRows();

        if (!rows.length) {

            alert("Nenhum destaque encontrado para esse recorte.");
            return;

        }

        const tableHtml = ReportDashboard.buildTableHtml(rows, ReportDashboard.LANGUAGES[this._idioma], { fullTable: false, inline: true });

        const wrapper = document.createElement("div");

        wrapper.innerHTML = `<p><br></p>${tableHtml}<p><br></p>`;

        const parentParagraph = placeholder.closest("p") || placeholder;

        parentParagraph.replaceWith(...wrapper.childNodes);

        this.updateModeAvailability();

    },

    /**
     * Mesma técnica de "Copiar tabela" (seleciona + copia), só que
     * copia a planilha da gravadora selecionada, abre ela numa
     * aba nova (pra colar lá dentro) e, se o placeholder ainda
     * estiver no corpo, transforma ele num link de verdade pra
     * essa planilha.
     */
    /**
     * Cria uma planilha temporária de verdade (via Apps Script,
     * único script pra todas as gravadoras) com a tabela de
     * destaques já dentro, e abre ela numa aba nova — de lá, o
     * botão direito na aba tem o "Copiar para > Planilha
     * existente" nativo do Google Sheets, apontando pra planilha
     * da gravadora. O placeholder no corpo do e-mail continua
     * apontando pra planilha DA GRAVADORA (não pra essa temporária
     * — essa é só uma etapa intermediária).
     */
    async updateSheet() {

        if (!this._currentLookup || !this._currentLookup.linkPlanilha) {

            alert("Ainda não há uma planilha configurada pra essa gravadora/território. Isso vem da planilha de destinatários (em configuração).");
            return;

        }

        if (!CONFIG.REPORT_SEND.webAppUrl) {

            alert("Geração da planilha temporária ainda não configurada (CONFIG.REPORT_SEND.webAppUrl vazia).");
            return;

        }

        const rows = ReportDashboard.getFilteredRows();

        if (!rows.length) {

            alert("Nenhum destaque encontrado para esse recorte.");
            return;

        }

        const placeholder = this.findPlaceholder();

        if (placeholder) {
            placeholder.setAttribute("href", this._currentLookup.linkPlanilha);
        }

        const btn = document.getElementById("reportSendUpdateSheetBtn");
        const original = btn.textContent;

        btn.disabled = true;
        btn.textContent = "Gerando planilha...";

        const { headers, data } = ReportDashboard.buildTableData(rows, ReportDashboard.LANGUAGES[this._idioma]);

        const gravadora = ReportDashboard.filters.gravadora;
        const semana = (ReportDashboard.filters.semana || "").replace(/\//g, "-");

        try {

            const response = await fetch(CONFIG.REPORT_SEND.webAppUrl, {

                method: "POST",
                headers: { "Content-Type": "text/plain;charset=utf-8" },
                body: JSON.stringify({

                    token: CONFIG.REPORT_SEND.sharedSecret,
                    fileName: `Destaques - ${gravadora} - ${semana}`,
                    headers,
                    rows: data

                })

            });

            const result = await response.json();

            if (!result.success) {
                throw new Error((result.errors && result.errors[0]) || "Erro ao gerar a planilha.");
            }

            btn.textContent = "✔ Planilha criada, abrindo...";

            window.open(result.url, "_blank");

        }
        catch (error) {

            console.error("[ReportSend]", error);

            alert("Não foi possível gerar a planilha temporária agora. Tente de novo.");

        }
        finally {

            btn.disabled = false;

            setTimeout(() => { btn.textContent = original; }, 1800);

        }

    },

    downloadCovers() {

        const rows = ReportDashboard.getFilteredRows().filter(row => row.destaque === "CAPA");

        if (!rows.length) {

            alert("Nenhuma capa (Capa/Portada/Cover) encontrada para esse recorte.");
            return;

        }

        ReportCoverDownload.open(rows, ReportDashboard.formatCountry.bind(ReportDashboard), {

            territorio: ReportDashboard.filters.territorio,
            gravadora: ReportDashboard.filters.gravadora || "Todas",
            semana: ReportDashboard.filters.semana

        });

    },

    /**
     * Com uma tabela colada no corpo, "Enviar direto, sem
     * formatação" fica indisponível (uma tabela em texto puro sai
     * ilegível) — desmarca e desabilita essa opção automaticamente,
     * com um aviso.
     */
    updateModeAvailability() {

        const body = document.getElementById("reportSendBody");
        const hasTable = !!body.querySelector("table");

        const diretoInput = document.querySelector('input[name="reportSendMode"][value="direto"]');
        const copiarInput = document.querySelector('input[name="reportSendMode"][value="copiar"]');
        const notice = document.getElementById("reportSendTableNotice");
        const removeBtn = document.getElementById("reportSendRemoveTableBtn");

        diretoInput.disabled = hasTable;

        notice.style.display = hasTable ? "" : "none";

        removeBtn.style.display = hasTable ? "" : "none";

        if (hasTable && diretoInput.checked) {

            diretoInput.checked = false;
            copiarInput.checked = true;

        }

    },

    /**
     * Tira a tabela colada (e as linhas em branco que
     * "Colar tabela de destaques" adicionou antes/depois dela) e
     * devolve o placeholder no lugar, pra dar pra colar de novo ou
     * deixar o corpo só com texto mesmo.
     */
    removeTable() {

        const body = document.getElementById("reportSendBody");
        const table = body.querySelector("table");

        if (!table) return;

        const isBlankParagraph = (el) => el && el.tagName === "P" &&
            (el.innerHTML.trim() === "<br>" || el.textContent.trim() === "");

        const prev = table.previousElementSibling;
        const next = table.nextElementSibling;

        const labels = this.LABELS[this._idioma] || this.LABELS.pt;

        const placeholderParagraph = document.createElement("p");

        placeholderParagraph.innerHTML = `<a href="#" class="report-send-placeholder-link" data-placeholder="tabela-link">${this.escapeHtml(labels.placeholderText)}</a>`;

        table.replaceWith(placeholderParagraph);

        if (isBlankParagraph(prev)) prev.remove();
        if (isBlankParagraph(next)) next.remove();

        this.updateModeAvailability();

    },

    /**
     * "text (URL)" pra links de verdade (href diferente de "#" —
     * ainda não resolvido), só o texto quando o placeholder nunca
     * foi preenchido. Preserva parágrafos como linha em branco.
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

        const mode = document.querySelector('input[name="reportSendMode"]:checked').value;

        const to = document.getElementById("reportSendTo").value.trim();
        const subject = document.getElementById("reportSendSubject").value.trim();
        const bodyEl = document.getElementById("reportSendBody");

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
