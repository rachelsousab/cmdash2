/**
 * ==========================================================
 * HIGHLIGHTS DATA (Destaques de gravadoras)
 * ----------------------------------------------------------
 * Responsável por:
 * - Carregar os dados do Google Sheets (CSV)
 * - Normalizar todos os registros
 * - Criar índices para filtros
 * - Disponibilizar consultas para o dashboard
 *
 * Mesmo padrão do social-data.js. Este módulo NÃO calcula
 * KPIs e NÃO renderiza nada.
 * ==========================================================
 */

const HighlightsData = {

    csvUrl: "",

    rawData: [],

    rows: [],

    index: {

        paises: [],

        disqueras: [],

        ownerMajors: [],

        meses: [],

        anos: [],

        semanas: []

    },

    loaded: false,

    /**
     * ======================================================
     * Carrega o CSV
     * ======================================================
     */
    async load(csvUrl = this.csvUrl) {

        if (!csvUrl) {
            throw new Error("CSV URL não definida.");
        }

        this.csvUrl = csvUrl;

        return new Promise((resolve, reject) => {

            Papa.parse(csvUrl, {

                download: true,

                header: true,

                skipEmptyLines: true,

                complete: (results) => {

                    this.rawData = results.data;

                    this.normalize();

                    this.buildIndexes();

                    this.loaded = true;

                    console.log(
                        `[HighlightsData] ${this.rows.length} registros carregados.`
                    );

                    resolve(this.rows);

                },

                error: (error) => {

                    console.error(error);

                    reject(error);

                }

            });

        });

    },

    /**
     * ======================================================
     * Utilitários
     * ======================================================
     */
    toString(value) {

        if (value === undefined || value === null) {
            return "";
        }

        return String(value).trim();

    },

    capitalize(value) {

        const text = this.toString(value);

        if (!text) return "";

        return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();

    },

    /**
     * ======================================================
     * Converte data dd/mm/yyyy para Date
     * ======================================================
     */
    parseDate(value) {

        if (!value) {
            return null;
        }

        const text = this.toString(value);

        const parts = text.split("/");

        if (parts.length !== 3) {
            return null;
        }

        const day = Number(parts[0]);

        const month = Number(parts[1]) - 1;

        const year = Number(parts[2]);

        const date = new Date(year, month, day);

        return isNaN(date.getTime()) ? null : date;

    },

    /**
     * ======================================================
     * Remove duplicados e ordena (pt-BR).
     * ======================================================
     */
    uniqueSorted(values) {

        return [...new Set(values)]
            .filter(v => v !== "")
            .sort((a, b) => (""+a).localeCompare(""+b, "pt-BR", { sensitivity: "base" }));

    },

    /**
     * ======================================================
     * Normaliza todos os registros da planilha.
     * ======================================================
     */
    /**
     * ======================================================
     * Quebra o campo Disquera em nomes individuais. Um lançamento
     * pode pertencer a mais de uma gravadora (ex.: "The Orchard,
     * Tratore") — nesse caso vira uma linha pra cada uma (ver
     * normalize()). Sufixos corporativos soltos ("Inc", "LLC"...)
     * são recolados no nome anterior, pra não quebrar gravadoras
     * cujo nome tem vírgula (ex.: "Vydia, Inc").
     * ======================================================
     */
    splitDisqueras(value) {

        const parts = this.toString(value)
            .split(",")
            .map(part => part.trim())
            .filter(Boolean);

        const names = [];

        parts.forEach(part => {

            if (names.length && /^(inc\.?|llc|ltd\.?|ltda\.?)$/i.test(part)) {

                names[names.length - 1] += `, ${part}`;

                return;

            }

            if (!names.includes(part)) names.push(part);

        });

        return names.length ? names : [""];

    },

    normalize() {

        this.rows = this.rawData.flatMap(row => {

            const data = this.parseDate(row["Data/semana"]);

            const base = {

                pais: this.toString(row["País"]),

                destaque: this.toString(row["Destaque"]).toUpperCase(),

                playlist: this.toString(row["Playlist"]),

                link: this.toString(row["Link"]),

                artist: this.toString(row["Artist"]),

                contenido: this.toString(row["Contenido"]),

                ownerMajor: this.toString(row["Owner / Major"]),

                mes: this.capitalize(row["Mês"]),

                data,

                ano: data ? data.getFullYear() : null,

                semana: data ? data.toLocaleDateString("pt-BR") : "",

                mesKey: data
                    ? `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}`
                    : ""

            };

            return this.splitDisqueras(row["Disquera"]).map(disquera => ({ ...base, disquera }));

        }).filter(row => row.pais !== "" || row.disquera !== "");

    },

    /**
     * ======================================================
     * Cria os índices utilizados pelos filtros.
     * ======================================================
     */
    buildIndexes() {

        // Semanas em ordem cronológica (não alfabética — dd/mm/yyyy
        // como string ordena errado).
        const uniqueDates = [...new Map(
            this.rows
                .filter(r => r.data)
                .map(r => [r.data.getTime(), r.data])
        ).values()].sort((a, b) => a - b);

        this.index = {

            paises: this.uniqueSorted(this.rows.map(r => r.pais)),

            disqueras: this.uniqueSorted(this.rows.map(r => r.disquera)),

            ownerMajors: this.uniqueSorted(this.rows.map(r => r.ownerMajor)),

            meses: this.uniqueSorted(this.rows.map(r => r.mes))
                .sort((a, b) => {

                    const order = CONFIG.DATE.months.map(m => m.toLowerCase());

                    return order.indexOf(a.toLowerCase()) - order.indexOf(b.toLowerCase());

                }),

            anos: [...new Set(this.rows.map(r => r.ano).filter(Boolean))].sort((a, b) => a - b),

            semanas: uniqueDates.map(d => d.toLocaleDateString("pt-BR"))

        };

    },

    /**
     * ======================================================
     * Retorna os registros filtrados.
     * ======================================================
     */
    getFilteredRows(filters = {}) {

        return this.rows.filter(row => {

            if (filters.pais && row.pais !== filters.pais) {
                return false;
            }

            if (filters.disquera && row.disquera !== filters.disquera) {
                return false;
            }

            if (filters.ownerMajor && row.ownerMajor !== filters.ownerMajor) {
                return false;
            }

            if (filters.mes && row.mes !== filters.mes) {
                return false;
            }

            if (filters.ano && row.ano !== Number(filters.ano)) {
                return false;
            }

            if (filters.semana && row.semana !== filters.semana) {
                return false;
            }

            if (filters.q) {

                const haystack = `${row.artist} ${row.contenido} ${row.playlist}`.toLowerCase();

                if (!haystack.includes(filters.q)) {
                    return false;
                }

            }

            return true;

        });

    },

    /**
     * ======================================================
     * Índices públicos.
     * ======================================================
     */
    getPaises() {
        return [...this.index.paises];
    },

    getDisqueras() {
        return [...this.index.disqueras];
    },

    getOwnerMajors() {
        return [...this.index.ownerMajors];
    },

    getMeses() {
        return [...this.index.meses];
    },

    getAnos() {
        return [...this.index.anos];
    },

    getSemanas() {
        return [...this.index.semanas];
    },

    isLoaded() {
        return this.loaded;
    },

    clear() {

        this.rawData = [];

        this.rows = [];

        this.loaded = false;

        this.index = {

            paises: [],

            disqueras: [],

            ownerMajors: [],

            meses: [],

            anos: [],

            semanas: []

        };

    }

};
