/**
 * ==========================================================
 * DOWNLOAD DE CAPAS (Gerador de Reporte) — EM TESTE
 * ----------------------------------------------------------
 * Ao clicar em "Download capas (em teste)", pega os destaques
 * de tipo CAPA já filtrados na tela (Semana/Território/
 * Gravadora — respeitando Brasil/LatAm/Todos e a gravadora
 * selecionada) e manda pro Apps Script buscar os arquivos
 * correspondentes no Drive (mesma lógica de grupo de países
 * do scratch-code-gs-capas.gs), mostra uma prévia (nome do
 * arquivo + miniatura) e libera o download de tudo zipado.
 *
 * webAppUrl ainda não está preenchida em
 * CONFIG.COVERS_DOWNLOAD.webAppUrl — enquanto isso, o botão
 * avisa que a busca ainda não está configurada.
 * ==========================================================
 */

const ReportCoverDownload = {

    _rows: [],
    _formatCountry: (pais) => pais,
    _meta: {},
    _zipUrl: "",
    _bound: false,
    _notFound: [],
    _isSingleFile: false,

    // Chamado quando a pessoa "resolveu" a busca de capas: ou clicou
    // no download de verdade (zip/imagem), ou a busca voltou vazia
    // (nada pra baixar, mas ela já conferiu). Usado pelo popup de
    // "Enviar reporte" (js/report-send.js) pra liberar o botão de
    // enviar só depois desse passo.
    _onComplete: null,

    // Mesmo texto usado no "Copiar prompt de capas" do Gerador de
    // Reporte (js/report-dashboard.js) — aqui, porém, a lista que
    // acompanha o texto é só das capas que o Drive NÃO encontrou
    // sozinho (a busca automática exige que o arquivo já esteja
    // no padrão "País(es) - Playlist - Artista"; enquanto a
    // Editorial não padroniza todos os países, isso ajuda a achar
    // as que ainda faltam).
    COVER_PROMPT_INTRO: "Encontre, nessa pasta, as imagens referentes às capas das playlists listadas abaixo, por país.",

    open(rows, formatCountry, meta, onComplete) {

        this._rows = rows;
        this._formatCountry = formatCountry || ((pais) => pais);
        this._meta = meta || {};
        this._zipUrl = "";
        this._isSingleFile = false;
        this._onComplete = onComplete || null;

        this.bindEvents();

        const modal = document.getElementById("reportCoverDownloadModal");
        const subtitle = document.getElementById("reportCoverDownloadSubtitle");
        const zipBtn = document.getElementById("reportCoverDownloadZipBtn");
        const cancelBtn = document.getElementById("reportCoverDownloadCancelBtn");

        if (subtitle) subtitle.textContent = `${rows.length} ${rows.length === 1 ? "capa" : "capas"}`;

        if (zipBtn) {
            zipBtn.disabled = true;
            zipBtn.textContent = "⬇️ Baixar tudo (.zip)";
        }

        if (cancelBtn) cancelBtn.textContent = "Fechar";

        this.renderLoading();

        modal.classList.add("open");

        this.fetchCovers();

    },

    close() {

        const modal = document.getElementById("reportCoverDownloadModal");

        if (modal) modal.classList.remove("open");

    },

    bindEvents() {

        if (this._bound) return;

        this._bound = true;

        document.getElementById("reportCoverDownloadClose").addEventListener("click", () => this.close());
        document.getElementById("reportCoverDownloadCancelBtn").addEventListener("click", () => this.close());

        document.getElementById("reportCoverDownloadModal").addEventListener("click", (event) => {

            if (event.target.id === "reportCoverDownloadModal") this.close();

        });

        document.getElementById("reportCoverDownloadZipBtn").addEventListener("click", () => {

            if (!this._zipUrl) return;

            window.open(this._zipUrl, "_blank");

            const cancelBtn = document.getElementById("reportCoverDownloadCancelBtn");

            if (cancelBtn) {
                cancelBtn.textContent = this._isSingleFile ? "Imagem baixada, voltar" : "Capas baixadas, voltar";
            }

            if (this._onComplete) this._onComplete();

        });

    },

    renderLoading() {

        const body = document.getElementById("reportCoverDownloadBody");

        if (!body) return;

        body.innerHTML = `<p class="cover-download-status">Procurando as capas no Drive — isso pode levar um minuto...</p>`;

    },

    fetchCovers() {

        const body = document.getElementById("reportCoverDownloadBody");

        if (!CONFIG.COVERS_DOWNLOAD.webAppUrl) {

            if (body) {
                body.innerHTML = `<p class="cover-download-status cover-download-error">A busca de capas ainda não está configurada (CONFIG.COVERS_DOWNLOAD.webAppUrl vazia).</p>`;
            }

            return;

        }

        const payload = this._rows.map(row => ({
            pais: row.pais,
            playlist: row.playlist,
            artist: row.artist,
            semana: row.semana
        }));

        const url = `${CONFIG.COVERS_DOWNLOAD.webAppUrl}?action=buscarCapas&rows=${encodeURIComponent(JSON.stringify(payload))}&zipName=${encodeURIComponent(this.buildZipName())}`;

        fetch(url)
            .then(response => response.json())
            .then(data => this.render(data))
            .catch(error => {

                console.error("[ReportCoverDownload]", error);

                if (body) {
                    body.innerHTML = `<p class="cover-download-status cover-download-error">Não foi possível buscar as capas agora. Tente de novo em instantes.</p>`;
                }

            });

    },

    render(data) {

        const body = document.getElementById("reportCoverDownloadBody");
        const zipBtn = document.getElementById("reportCoverDownloadZipBtn");
        const subtitle = document.getElementById("reportCoverDownloadSubtitle");

        if (!body) return;

        if (!data || !data.success) {

            body.innerHTML = `<p class="cover-download-status cover-download-error">${this.escapeHtml((data && data.errors && data.errors[0]) || "Erro ao buscar as capas.")}</p>`;

            return;

        }

        const found = data.found || [];
        const notFound = data.notFound || [];

        this._zipUrl = data.zipUrl || "";
        this._notFound = notFound;
        this._isSingleFile = !!data.isSingleFile;

        // Nada encontrado -> não tem o que baixar, mas a pessoa já
        // clicou e conferiu a notificação. Com capas encontradas, só
        // marca como resolvido quando ela de fato clicar em baixar
        // (ver o listener do reportCoverDownloadZipBtn acima).
        if (!found.length && this._onComplete) this._onComplete();

        if (subtitle) {
            subtitle.textContent = `${found.length} encontrada${found.length === 1 ? "" : "s"} de ${this._rows.length}`;
        }

        if (zipBtn) {
            zipBtn.disabled = !this._zipUrl || !found.length;
            zipBtn.textContent = data.isSingleFile ? "⬇️ Baixar imagem" : "⬇️ Baixar tudo (.zip)";
        }

        let html = "";

        if (found.length) {

            html += `<div class="cover-download-grid">`;

            html += found.map(item => `
                <div class="cover-download-card">
                    <img src="https://drive.google.com/thumbnail?id=${encodeURIComponent(item.fileId)}&sz=w300" alt="" loading="lazy">
                    <div class="cover-download-card-info">
                        <strong>${this.escapeHtml(this._formatCountry(item.pais))}</strong>
                        <span>${this.escapeHtml(item.playlist)}</span>
                        <span class="cover-download-card-artist">${this.escapeHtml(item.artist || "")}</span>
                        <span class="cover-download-card-filename">${this.escapeHtml(item.fileName)}</span>
                    </div>
                </div>
            `).join("");

            html += `</div>`;

        }

        if (notFound.length) {

            html += `<div class="cover-download-missing">`;
            html += `<p class="cover-download-missing-title">${notFound.length} não encontrada${notFound.length === 1 ? "" : "s"} automaticamente:</p>`;
            html += `<p class="cover-download-missing-notice">A função de download das capas por aqui está em construção, junto à equipe Editorial. Por enquanto, use o prompt de capas para ajudar a encontrar as capas faltantes abaixo:</p>`;
            html += `<button type="button" id="reportCoverPromptMissingBtn" class="data-table-csv-btn">🖼️ Copiar prompt de capas</button>`;
            html += `<ul>`;

            html += notFound.map(item => `
                <li>${this.escapeHtml(this._formatCountry(item.pais))} — ${this.escapeHtml(item.playlist)} (${this.escapeHtml(item.motivo || "não encontrada")})</li>
            `).join("");

            html += `</ul></div>`;

        }

        if (!found.length && !notFound.length) {
            html = `<p class="cover-download-status">Nenhum resultado retornado.</p>`;
        }

        body.innerHTML = html;

        const promptBtn = document.getElementById("reportCoverPromptMissingBtn");

        if (promptBtn) {
            promptBtn.addEventListener("click", () => this.copyMissingCoverPrompt());
        }

    },

    copyMissingCoverPrompt() {

        if (!this._notFound.length) return;

        const lines = this._notFound.map(item => `${this._formatCountry(item.pais)} - ${item.playlist} - ${item.artist || ""}`);

        const text = `${this.COVER_PROMPT_INTRO}\n\n${lines.join("\n")}`;

        this.copyPlainText(text, "reportCoverPromptMissingBtn");

    },

    /**
     * IMPORTANTE: tenta o método síncrono (execCommand) primeiro —
     * mesma estratégia do "Copiar prompt de capas" original
     * (js/report-dashboard.js). A Clipboard API assíncrona às
     * vezes rejeita silenciosamente dependendo da origem/navegador
     * (ex.: GitHub Pages), e nesse caso o fallback só rodaria fora
     * do gesto de clique original — por isso execCommand precisa
     * ser o método principal, não o fallback.
     */
    copyPlainText(text, buttonId) {

        const btn = document.getElementById(buttonId);

        const finish = (ok) => {

            if (!btn) return;

            const original = btn.textContent;

            btn.textContent = ok ? "✔ Copiado!" : "Não foi possível copiar";

            setTimeout(() => { btn.textContent = original; }, 1800);

        };

        if (this.copyPlainTextFallback(text)) {

            finish(true);

        }
        else if (navigator.clipboard && navigator.clipboard.writeText) {

            navigator.clipboard.writeText(text)
                .then(() => finish(true))
                .catch(() => finish(false));

        }
        else {

            finish(false);

        }

    },

    copyPlainTextFallback(text) {

        const textarea = document.createElement("textarea");

        textarea.value = text;
        textarea.style.position = "fixed";
        textarea.style.left = "-9999px";

        document.body.appendChild(textarea);

        textarea.select();

        let ok = false;

        try {
            ok = document.execCommand("copy");
        }
        catch (error) {
            ok = false;
        }

        document.body.removeChild(textarea);

        return ok;

    },

    /**
     * "Território - Gravadora - Semana" (ex.: "LatAm - ONErpm -
     * 14-08-2026") — sem barra na data (Windows não aceita "/"
     * em nome de arquivo) e sem outros caracteres especiais que
     * possam vir da gravadora (ex.: "DMusic / AWAL").
     */
    buildZipName() {

        const { territorio, gravadora, semana } = this._meta;

        const semanaSlug = String(semana || "").replace(/\//g, "-");

        const raw = `${territorio || ""} - ${gravadora || "Todas"} - ${semanaSlug}`;

        return raw
            .replace(/[\\/:*?"<>|]/g, "")
            .replace(/\s+/g, " ")
            .trim();

    },

    escapeHtml(text) {

        return String(text || "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");

    }

};
