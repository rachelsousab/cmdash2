/**
 * ==========================================================
 * SOCIAL DATA
 * ----------------------------------------------------------
 * Responsável por:
 * - Carregar os dados do Google Sheets (CSV)
 * - Normalizar todos os registros
 * - Criar índices para filtros
 * - Disponibilizar consultas para o dashboard
 *
 * Este módulo NÃO calcula KPIs.
 * Este módulo NÃO cria gráficos.
 * Este módulo NÃO renderiza tabelas.
 *
 * Todas essas responsabilidades ficarão em outros arquivos.
 * ==========================================================
 */

const SocialData = {

    /**
     * URL do CSV publicado pelo Google Sheets.
     * Será definida posteriormente em config.js
     */
    csvUrl: "",

    /**
     * Dados exatamente como vieram do CSV.
     */
    rawData: [],

    /**
     * Dados normalizados.
     */
    posts: [],

    /**
     * Índices utilizados pelos filtros.
     */
    index: {

        years: [],

        months: [],

        formatos: [],

        tipos: [],

        responsaveis: [],

        gravadoras: [],

        collabs: [],

        generos: []

        
    },

    /**
     * Indica se os dados já foram carregados.
     */
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

                    console.log(results.meta.fields);

                    this.rawData = results.data;

                    this.normalize();

                    console.log(this.posts[0]);

                    this.buildIndexes();

                    this.loaded = true;

                    console.log(
                        `[SocialData] ${this.posts.length} posts carregados.`
                    );

                    resolve(this.posts);

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
     * Utilitário
     * Converte qualquer valor para string.
     * ======================================================
     */
    toString(value) {

        if (value === undefined || value === null) {
            return "";
        }

        return String(value).trim();

    },

    /**
     * ======================================================
     * Utilitário
     * Converte texto para número.
     * Aceita:
     *
     * 5.432
     * 5,432
     * 5.432,55
     * 5432
     * vazio
     *
     * ======================================================
     */
    parseNumber(value) {

        if (value === undefined || value === null) {
            return 0;
        }

        let text = String(value).trim();

        if (text === "") {
            return 0;
        }

        text = text.replace(/\./g, "");
        text = text.replace(",", ".");

        const number = Number(text);

        return isNaN(number)
            ? 0
            : number;

    },

    /**
     * ======================================================
     * Utilitário
     * Converte Sim/Não para boolean.
     * ======================================================
     */
    parseBoolean(value) {

        const text = this.toString(value).toLowerCase();

        return (
            text === "sim" ||
            text === "yes" ||
            text === "true" ||
            text === "1"
        );

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

        return new Date(year, month, day);

    },

    /**
     * ======================================================
     * Retorna o nome do mês.
     * ======================================================
     */
    getMonthName(month) {

        const months = [

            "Janeiro",

            "Fevereiro",

            "Março",

            "Abril",

            "Maio",

            "Junho",

            "Julho",

            "Agosto",

            "Setembro",

            "Outubro",

            "Novembro",

            "Dezembro"

        ];

        return months[month - 1] || "";

    },

    /**
     * ======================================================
     * Remove duplicados e ordena.
     * ======================================================
     */
    uniqueSorted(values) {

        return [...new Set(values)]
            .filter(v => v !== "")
            .sort((a, b) => {

                if (typeof a === "number") {
                    return a - b;
                }

                return a.localeCompare(
                    b,
                    "pt-BR",
                    {
                        sensitivity: "base"
                    }
                );

            });

    },

    /**
     * ======================================================
     * Gera um ID para posts antigos
     * caso Post ID esteja vazio.
     * ======================================================
     */
    generateId() {

        if (window.crypto?.randomUUID) {
            return crypto.randomUUID();
        }

        return "POST_" +
            Date.now() +
            "_" +
            Math.floor(Math.random() * 1000000);

    },

    /**
     * ======================================================
     * Estas funções serão implementadas
     * nas próximas partes.
     * ======================================================
     */

    /**
 * ======================================================
 * Normaliza todos os registros da planilha.
 * ======================================================
 */
normalize() {

    this.posts = [];

    this.rawData.forEach((row, index) => {

        if (index === 0) {

    console.log(row);

}
        const data = this.parseDate(row["Data"]);

        const post = {

            //-----------------------------------------
            // Identificação
            //-----------------------------------------

            postId:
                this.toString(row["Post_ID"]) ||
                this.generateId(),

            //-----------------------------------------
            // Informações editoriais
            //-----------------------------------------

            formato:
                this.toString(row["Formato"]),

            tipo:
                this.toString(row["Tipo"]),

            data,

            ano:
                data ? data.getFullYear() : null,

            mes:
                data ? data.getMonth() + 1 : null,

            mesNome:
                data
                    ? this.getMonthName(data.getMonth() + 1)
                    : "",

            mesAno:
                this.toString(row["Mês/Ano"]),

            resumo:
                this.toString(row["Resumo da ação"]),

            legenda:
                this.toString(row["Legenda"]),

            responsavel:
                this.toString(row["Responsável"]),

            gravadora:
                this.toString(row["Gravadora"]),

            collab:
                this.toString(row["Collab"]),

            genero:
                this.toString(row["Gênero"]),

            //-----------------------------------------
            // Métricas
            //-----------------------------------------

            curtidas:
                this.parseNumber(row["Curtidas"]),

            comentarios:
                this.parseNumber(row["Comentários"]),

            reposts:
                this.parseNumber(row["Reposts"]),

            // "0" digitado de propósito é diferente de célula vazia —
            // guarda se a célula tinha algum texto (mesmo "0"), pra
            // não tratar um zero de verdade como "faltando".
            repostsSet:
                this.toString(row["Reposts"]) !== "",

            compartilhamentos:
                this.parseNumber(row["Compartilhamentos"]),

            salvamentos:
                this.parseNumber(row["Salvamentos"]),

            visualizacoes:
                this.parseNumber(row["Visualizações"]),

            alcance:
                this.parseNumber(row["Alcance"]),

            seguidores:
                this.parseNumber(row["Começaram a seguir"]),

            seguidoresSet:
                this.toString(row["Começaram a seguir"]) !== "",

            interacoes:
                this.parseNumber(row["Interações"]),

            //-----------------------------------------
            // Informações adicionais
            //-----------------------------------------

            link:
                this.toString(row["Link"]),

            destaque:
                this.parseBoolean(row["Material em alta"]),

            //-----------------------------------------
            // Linha original
            //-----------------------------------------

            original: row

        };

        //---------------------------------------------
        // Campos calculados
        //---------------------------------------------

//---------------------------------------------
// Taxa de engajamento
//---------------------------------------------

post.taxaEngajamento =

    post.alcance > 0

        ? (post.interacoes / post.alcance) * 100

        : 0;

        //---------------------------------------------

        post.mesKey =

            post.ano && post.mes

                ? `${post.ano}-${String(post.mes).padStart(2, "0")}`

                : "";

        //---------------------------------------------

        post.timestamp =

            data

                ? data.getTime()

                : 0;

        //---------------------------------------------

        post.index = index;

        //---------------------------------------------

        this.posts.push(post);

    });

    //---------------------------------------------
    // Ordena por data crescente
    //---------------------------------------------

    this.posts.sort((a, b) => {

        return a.timestamp - b.timestamp;

    });

},

    /**
 * ======================================================
 * Cria os índices utilizados pelos filtros.
 * ======================================================
 */
buildIndexes() {

    this.index = {

        years: this.uniqueSorted(
            this.posts
                .map(post => post.ano)
                .filter(Boolean)
        ),

        months: this.uniqueSorted(
            this.posts
                .map(post => post.mes)
                .filter(Boolean)
        ),

        formatos: this.uniqueSorted(
            this.posts.map(post => post.formato)
        ),

        tipos: this.uniqueSorted(
            this.posts.flatMap(post => splitMultiValue(post.tipo))
        ),

        responsaveis: this.uniqueSorted(
            this.posts.flatMap(post => splitMultiValue(post.responsavel))
        ),

        gravadoras: this.uniqueSorted(
            this.posts.flatMap(post => splitMultiValue(post.gravadora))
        ),

        collabs: this.uniqueSorted(
            this.posts.flatMap(post => splitMultiValue(post.collab))
        ),

        generos: this.uniqueSorted(
            this.posts.flatMap(post => splitMultiValue(post.genero))
        )

    };

    
},

    /**
 * ======================================================
 * Retorna todos os posts.
 * ======================================================
 */
getPosts() {

    return [...this.posts];

},

    /**
 * ======================================================
 * Retorna um único post.
 * ======================================================
 */
getPost(postId) {

    return this.posts.find(post =>
        post.postId === postId
    );

},

/**
 * ======================================================
 * Retorna os posts filtrados.
 * ======================================================
 */
getFilteredPosts(filters = {}) {

    return this.posts.filter(post => {

        if (filters.ano && post.ano !== Number(filters.ano)) {
            return false;
        }

        if (filters.mes && post.mes !== Number(filters.mes)) {
            return false;
        }

        if (filters.formato && post.formato !== filters.formato) {
            return false;
        }

        if (filters.tipo && !splitMultiValue(post.tipo).includes(filters.tipo)) {
            return false;
        }

        if (filters.gravadora && !splitMultiValue(post.gravadora).includes(filters.gravadora)) {
            return false;
        }

        if (filters.genero && !splitMultiValue(post.genero).includes(filters.genero)) {
            return false;
        }

        if (filters.responsavel && !splitMultiValue(post.responsavel).includes(filters.responsavel)) {
            return false;
        }

        if (filters.collab && !splitMultiValue(post.collab).includes(filters.collab)) {
            return false;
        }

        if (
            filters.destaque !== undefined &&
            post.destaque !== filters.destaque
        ) {
            return false;
        }

        return true;

    });

},

    /**
 * ======================================================
 * Índices públicos.
 * ======================================================
 */

getYears() {

    return [...this.index.years];

},

getMonths() {

    return [...this.index.months];

},

getFormats() {

    return [...this.index.formatos];

},

getTypes() {

    return [...this.index.tipos];

},

getOwners() {

    return [...this.index.responsaveis];

},

getLabels() {

    return [...this.index.gravadoras];

},

getGenres() {

    return [...this.index.generos];

},

getCollabs() {

    return [...this.index.collabs];

},

/**
 * ======================================================
 * Quantidade de posts.
 * ======================================================
 */
count(filters = {}) {

    return this.getFilteredPosts(filters).length;

},

/**
 * ======================================================
 * Primeiro post.
 * ======================================================
 */
first(filters = {}) {

    const posts = this.getFilteredPosts(filters);

    return posts.length
        ? posts[0]
        : null;

},

/**
 * ======================================================
 * Último post.
 * ======================================================
 */
last(filters = {}) {

    const posts = this.getFilteredPosts(filters);

    return posts.length
        ? posts[posts.length - 1]
        : null;

},

/**
 * ======================================================
 * Verifica se os dados foram carregados.
 * ======================================================
 */
isLoaded() {

    return this.loaded;

},

/**
 * ======================================================
 * Limpa todos os dados.
 * ======================================================
 */
clear() {

    this.rawData = [];

    this.posts = [];

    this.loaded = false;

    this.index = {

        years: [],

        months: [],

        formatos: [],

        tipos: [],

        responsaveis: [],

        gravadoras: [],

        collabs: [],

        generos: []

    };

}

};
