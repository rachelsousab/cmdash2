/**
 * ==========================================================
 * UTM MAKER
 * ----------------------------------------------------------
 * Monta o link final com UTM (utm_source, utm_medium e
 * utm_campaign) a partir da URL de destino e dos campos do
 * padrão de nomenclatura do time. Tudo calculado no navegador,
 * ao vivo, a cada alteração — nada é enviado nem salvo.
 *
 * As listas de opções de cada campo e a ordem dos trechos do
 * nome da campanha ficam em CONFIG.UTM (js/config.js).
 * ==========================================================
 */

const UtmMaker = {

    initialized: false,

    selects: [

        { id: "utmPais", list: "paises", optional: false },
        { id: "utmSource", list: "herramientas", optional: false },
        { id: "utmMedium", list: "canales", optional: false },
        { id: "utmProveedor", list: "proveedores", optional: false },
        { id: "utmAccion", list: "acciones", optional: false },
        { id: "utmGenero", list: "generos", optional: true },
        { id: "utmFormato", list: "formatos", optional: true }

    ],

    _finalUrl: "",

    init() {

        if (this.initialized) return this;

        this.populateSelects();

        this.resetForm();

        this.bindEvents();

        this.initialized = true;

        this.update();

        return this;

    },

    /* ======================================================
       OPÇÕES
    ====================================================== */

    /**
     * Minúsculas, sem acento, sem espaço nem símbolo — o formato
     * de cada trecho dentro da UTM ("canal 500" -> "canal500").
     */
    slug(text) {

        return String(text || "")
            .normalize("NFD")
            .replace(/[̀-ͯ]/g, "")
            .toLowerCase()
            .replace(/[^a-z0-9]/g, "");

    },

    toOption(item) {

        if (typeof item === "string") {

            return { label: item, value: this.slug(item) };

        }

        return {
            label: item.label,
            value: item.value !== undefined ? item.value : this.slug(item.label)
        };

    },

    getPrefix() {

        return (CONFIG.UTM && CONFIG.UTM.prefijoDescriptivo) || "";

    },

    /**
     * Só a parte digitável do Descritivo (o prefixo fixo fica de fora).
     * Se a pessoa colar o texto já com o prefixo ("mkt-promo"), ele é
     * tirado pra não sair duplicado.
     */
    descriptivoSuffix(raw) {

        const prefix = this.getPrefix();

        let text = String(raw || "").trim();

        if (prefix && text.toLowerCase().startsWith(prefix.toLowerCase())) {

            text = text.slice(prefix.length);

        }

        return this.slug(text);

    },

    populateSelects() {

        const prefixEl = document.getElementById("utmDescriptivoPrefix");

        if (prefixEl) prefixEl.textContent = this.getPrefix();

        this.selects.forEach(({ id, list, optional }) => {

            const select = document.getElementById(id);

            if (!select) return;

            select.innerHTML = "";

            if (optional) {

                select.appendChild(new Option("— nenhum —", ""));

            }

            ((CONFIG.UTM && CONFIG.UTM[list]) || []).forEach(item => {

                const option = this.toOption(item);

                select.appendChild(new Option(option.label, option.value));

            });

        });

    },

    todayInputValue() {

        const now = new Date();

        const pad = n => String(n).padStart(2, "0");

        return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

    },

    resetForm() {

        document.getElementById("utmUrl").value = "";

        document.getElementById("utmFecha").value = this.todayInputValue();

        document.getElementById("utmDescriptivo").value = "";

        this.selects.forEach(({ id }) => {

            const select = document.getElementById(id);

            if (select) select.selectedIndex = 0;

        });

    },

    /* ======================================================
       EVENTOS
    ====================================================== */

    bindEvents() {

        const fieldIds = [
            "utmUrl",
            "utmFecha",
            "utmDescriptivo",
            ...this.selects.map(s => s.id)
        ];

        fieldIds.forEach(id => {

            const el = document.getElementById(id);

            el.addEventListener("input", () => this.update());
            el.addEventListener("change", () => this.update());

        });

        document.getElementById("utmClearBtn").addEventListener("click", () => {

            this.resetForm();

            this.update();

        });

        document.getElementById("utmTestBtn").addEventListener("click", () => {

            if (this._finalUrl) window.open(this._finalUrl, "_blank", "noopener");

        });

        document.getElementById("utmCopyBtn").addEventListener("click", () => {

            if (!this._finalUrl) return;

            this.copyText(this._finalUrl, document.getElementById("utmCopyBtn"));

        });

    },

    /* ======================================================
       CÁLCULO
    ====================================================== */

    getState() {

        const val = id => document.getElementById(id).value;

        return {

            url: val("utmUrl").trim(),
            fecha: val("utmFecha"),
            pais: val("utmPais"),
            source: val("utmSource"),
            medium: val("utmMedium"),
            proveedor: val("utmProveedor"),
            accion: val("utmAccion"),
            descriptivo: this.descriptivoSuffix(val("utmDescriptivo")),
            genero: val("utmGenero"),
            formato: val("utmFormato")

        };

    },

    isValidUrl(text) {

        try {

            return /^https?:$/.test(new URL(text).protocol);

        }
        catch (error) {

            return false;

        }

    },

    detectTipo(url) {

        const rules = (CONFIG.UTM && CONFIG.UTM.tiposDeUrl) || [];

        const lower = url.toLowerCase();

        const rule = rules.find(r => lower.includes(String(r.contem).toLowerCase()));

        return rule ? rule.value : "";

    },

    /**
     * Coloca a UTM no fim da URL, antes de um eventual #âncora. Se a
     * URL já tem parâmetros próprios, mantém todos e acrescenta a UTM
     * com "&" — só utm_source/utm_medium/utm_campaign antigos são
     * trocados (senão ficariam duplicados).
     */
    composeFinalUrl(rawUrl, utmParams) {

        const hashIndex = rawUrl.indexOf("#");

        const hash = hashIndex === -1 ? "" : rawUrl.slice(hashIndex);

        const noHash = hashIndex === -1 ? rawUrl : rawUrl.slice(0, hashIndex);

        const queryIndex = noHash.indexOf("?");

        const base = queryIndex === -1 ? noHash : noHash.slice(0, queryIndex);

        const kept = queryIndex === -1
            ? []
            : noHash
                .slice(queryIndex + 1)
                .split("&")
                .filter(Boolean)
                .filter(param => !/^utm_(source|medium|campaign)=/i.test(param));

        return {

            url: `${base}?${kept.concat(utmParams).join("&")}${hash}`,

            prefix: kept.length ? "&" : "?"

        };

    },

    build(state) {

        const urlFilled = state.url !== "";

        const urlValid = urlFilled && this.isValidUrl(state.url);

        const complete =
            urlValid &&
            state.fecha &&
            state.pais &&
            state.source &&
            state.medium &&
            state.proveedor &&
            state.accion;

        if (!complete) {

            return { ok: false, urlFilled, urlValid };

        }

        const parts = {

            fecha: state.fecha.replace(/-/g, ""),
            pais: state.pais,
            proveedor: state.proveedor,
            accion: state.accion,
            tipo: this.detectTipo(state.url),
            // Sem nada digitado, o trecho inteiro some (senão a campanha
            // terminaria só com o prefixo solto, "...-mkt-").
            descriptivo: state.descriptivo ? this.getPrefix() + state.descriptivo : "",
            genero: state.genero,
            formato: state.formato

        };

        const campaign = CONFIG.UTM.ordemCampanha
            .map(key => parts[key])
            .filter(Boolean)
            .join("-");

        const params = [
            `utm_source=${state.source}`,
            `utm_medium=${state.medium}`,
            `utm_campaign=${campaign}`
        ];

        const composed = this.composeFinalUrl(state.url, params);

        return {

            ok: true,
            urlFilled,
            urlValid,
            campaign,
            utmComplete: `${composed.prefix}${params.join("&")}`,
            finalUrl: composed.url

        };

    },

    /* ======================================================
       TELA
    ====================================================== */

    update() {

        const result = this.build(this.getState());

        this._finalUrl = result.ok ? result.finalUrl : "";

        const setOutput = (id, text) => {

            const el = document.getElementById(id);

            el.textContent = text || "—";

            el.classList.toggle("utm-output--empty", !text);

        };

        setOutput("utmQueryOut", result.ok ? result.utmComplete : "");
        setOutput("utmCampaignOut", result.ok ? result.campaign : "");
        setOutput("utmFinalOut", result.ok ? result.finalUrl : "");

        document.getElementById("utmTestBtn").disabled = !result.ok;
        document.getElementById("utmCopyBtn").disabled = !result.ok;

        const urlError = document.getElementById("utmUrlError");

        const showError = result.urlFilled && !result.urlValid;

        urlError.style.display = showError ? "" : "none";

    },

    /* ======================================================
       COPIAR
       Tenta o método síncrono (execCommand) primeiro — mesma
       estratégia do "Download de capas": a Clipboard API às
       vezes rejeita sem avisar dependendo da origem (ex.:
       GitHub Pages).
    ====================================================== */

    copyText(text, btn) {

        const finish = ok => this.flashButton(btn, ok ? "✔ Copiado!" : "Não foi possível copiar");

        if (this.copyWithTextarea(text)) {

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

    copyWithTextarea(text) {

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

    flashButton(btn, text) {

        if (!btn.dataset.label) btn.dataset.label = btn.textContent;

        btn.textContent = text;

        clearTimeout(btn._utmTimer);

        btn._utmTimer = setTimeout(() => {

            btn.textContent = btn.dataset.label;

        }, 1800);

    }

};
