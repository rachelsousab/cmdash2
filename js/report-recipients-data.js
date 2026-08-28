/**
 * ==========================================================
 * DESTINATÁRIOS DO REPORTE (por Território + Gravadora)
 * ----------------------------------------------------------
 * Lê a planilha "Gravadoras" publicada pela Rachel, usada pelo
 * botão "Enviar reporte" do Gerador de Reporte pra já vir com
 * destinatário, corpo padrão e assunto certos.
 *
 * Colunas usadas (nomes exatos da planilha real):
 * - "Território", "Gravadora"
 * - "Contatos" -> destinatários (separados por vírgula)
 * - "E-mail padrão" -> texto padrão do corpo do e-mail
 * - "Título Destaque" -> início do assunto (a data da semana
 *   entra depois, na hora de montar)
 * - "Destaques (enviar) (link direto)" -> link da planilha
 *   compartilhada, colado como texto simples (a coluna "Destaques
 *   (enviar)" original é um link "inteligente"/HYPERLINK do
 *   Sheets, e o CSV publicado exporta só o texto visível dele,
 *   não a URL real por trás — por isso essa coluna extra).
 *
 * Uma gravadora que usa o mesmo contato em qualquer país pode
 * ter uma linha com Território = "Todos" — o lookup usa o valor
 * exato que está selecionado no filtro, sem tentar combinar
 * territórios diferentes. Quando o filtro do dashboard está em
 * "Todos" (visão de vários territórios juntos) e a gravadora só
 * tem linha num território específico, cai num segundo lookup
 * só por Gravadora (ver lookup() abaixo).
 *
 * A planilha às vezes ganha uma linha de título/seção acima do
 * cabeçalho de verdade (ex.: "ENVIO AUTOMÁTICO DASHBOARD"), o que
 * faz o Papa.parse (que sempre lê a 1ª linha como cabeçalho) errar
 * feio e nenhuma gravadora ser encontrada. Por isso o parse abaixo
 * primeiro acha, no bruto (sem header), a linha real que contém
 * "Território" numa das células, e só aí monta os objetos — assim
 * continua funcionando mesmo com uma ou mais linhas extras acima.
 *
 * Vazio até a Rachel publicar essa planilha (CONFIG.REPORT_RECIPIENTS.csvUrl).
 * ==========================================================
 */

const ReportRecipientsData = {

    rows: [],
    loaded: false,

    async load(csvUrl = CONFIG.REPORT_RECIPIENTS.csvUrl) {

        if (!csvUrl) {

            this.rows = [];
            this.loaded = true;

            return this.rows;

        }

        return new Promise((resolve, reject) => {

            Papa.parse(csvUrl, {

                download: true,
                header: false,
                skipEmptyLines: true,

                complete: (results) => {

                    const raw = results.data;

                    const headerIndex = raw.findIndex(cells =>
                        cells.some(cell => this.normalizeKey(cell) === this.normalizeKey("Território"))
                    );

                    if (headerIndex === -1) {

                        console.error("[ReportRecipientsData] Não achei a linha de cabeçalho (coluna \"Território\") na planilha publicada.");

                        this.rows = [];
                        this.loaded = true;

                        resolve(this.rows);

                        return;

                    }

                    // Casa o nome da coluna ignorando acento/maiúscula e
                    // espaço sobrando — um CSV publicado pelo Sheets às
                    // vezes carrega BOM/espaço invisível ou uma forma de
                    // acentuação diferente da que a gente digita aqui no
                    // código, mesmo os dois parecendo idênticos na tela.
                    // Isso já fez uma coluna inteira (Legenda) sumir
                    // silenciosamente em outra parte do dashboard antes.
                    const headerCells = raw[headerIndex].map(cell => this.normalizeKey(cell));

                    const dataRows = raw.slice(headerIndex + 1);

                    this.rows = dataRows.map(cells => {

                        const row = {};

                        headerCells.forEach((key, index) => { row[key] = cells[index]; });

                        return {
                            territorio: this.toString(this.getColumn(row, "Território")),
                            gravadora: this.toString(this.getColumn(row, "Gravadora")),
                            destinatarios: this.toString(this.getColumn(row, "Contatos")),
                            corpoPadrao: this.toString(this.getColumn(row, "E-mail padrão")),
                            tituloDestaque: this.toString(this.getColumn(row, "Título Destaque")),
                            linkPlanilha: this.toString(this.getColumn(row, "Destaques (enviar) (link direto)"))
                        };

                    }).filter(row => row.gravadora);

                    this.loaded = true;

                    resolve(this.rows);

                },

                error: reject

            });

        });

    },

    isLoaded() {

        return this.loaded;

    },

    toString(value) {

        return String(value === undefined || value === null ? "" : value).trim();

    },

    /**
     * Sem acento, minúsculo, espaços simplificados — mesma
     * normalização usada no lookup() de Território/Gravadora,
     * aplicada aqui aos NOMES das colunas em vez dos valores.
     */
    normalizeKey(text) {

        return this.toString(text)
            .normalize("NFD")
            .replace(/[̀-ͯ]/g, "")
            .toLowerCase()
            .replace(/\s+/g, " ")
            .trim();

    },

    /**
     * Lê uma coluna pelo nome "de verdade" (como escrito no
     * código, com acento), casando com a versão normalizada que
     * transformHeader já deixou nas chaves de "row".
     */
    getColumn(row, columnName) {

        return row[this.normalizeKey(columnName)];

    },

    /**
     * Busca pela combinação exata Território+Gravadora (comparação
     * sem diferenciar maiúsculas/acentos, pra tolerar pequenas
     * diferenças de digitação entre a planilha e os filtros do
     * dashboard). Se não achar e o território do filtro for "Todos"
     * (visão de vários territórios juntos no dashboard, não um
     * valor real que aparece na planilha de gravadoras), busca só
     * pela Gravadora — mas só usa o resultado se houver exatamente
     * UMA linha daquela gravadora na planilha (achando 2+, território
     * diferentes de verdade, não arrisca escolher a errada). Retorna
     * null se não achar de nenhum jeito, ou se a planilha ainda não
     * estiver configurada.
     */
    lookup(territorio, gravadora) {

        const normalize = (text) => this.toString(text)
            .normalize("NFD")
            .replace(/[̀-ͯ]/g, "")
            .toLowerCase();

        const exact = this.rows.find(row =>
            normalize(row.territorio) === normalize(territorio) &&
            normalize(row.gravadora) === normalize(gravadora)
        );

        if (exact) return exact;

        if (normalize(territorio) === normalize("Todos")) {

            const porGravadora = this.rows.filter(row => normalize(row.gravadora) === normalize(gravadora));

            if (porGravadora.length === 1) return porGravadora[0];

        }

        return null;

    },

    /**
     * Quantas linhas essa Gravadora tem na planilha, não importa o
     * território (usado pra avisar no pop-up quando o filtro está
     * em "Todos" e a gravadora tem contato específico por
     * território, ver ReportSend.open()).
     */
    countRowsForGravadora(gravadora) {

        const normalize = (text) => this.toString(text)
            .normalize("NFD")
            .replace(/[̀-ͯ]/g, "")
            .toLowerCase();

        return this.rows.filter(row => normalize(row.gravadora) === normalize(gravadora)).length;

    }

};
