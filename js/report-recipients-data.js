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
 * territórios diferentes.
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
                header: true,
                skipEmptyLines: true,

                // Casa o nome da coluna ignorando acento/maiúscula e
                // espaço sobrando — um CSV publicado pelo Sheets às
                // vezes carrega BOM/espaço invisível ou uma forma de
                // acentuação diferente da que a gente digita aqui no
                // código, mesmo os dois parecendo idênticos na tela.
                // Isso já fez uma coluna inteira (Legenda) sumir
                // silenciosamente em outra parte do dashboard antes.
                transformHeader: (header) => this.normalizeKey(header),

                complete: (results) => {

                    this.rows = results.data.map(row => ({
                        territorio: this.toString(this.getColumn(row, "Território")),
                        gravadora: this.toString(this.getColumn(row, "Gravadora")),
                        destinatarios: this.toString(this.getColumn(row, "Contatos")),
                        corpoPadrao: this.toString(this.getColumn(row, "E-mail padrão")),
                        tituloDestaque: this.toString(this.getColumn(row, "Título Destaque")),
                        linkPlanilha: this.toString(this.getColumn(row, "Destaques (enviar) (link direto)"))
                    }));

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
     * dashboard). Retorna null se não achar ou se a planilha ainda
     * não estiver configurada.
     */
    lookup(territorio, gravadora) {

        const normalize = (text) => this.toString(text)
            .normalize("NFD")
            .replace(/[̀-ͯ]/g, "")
            .toLowerCase();

        const match = this.rows.find(row =>
            normalize(row.territorio) === normalize(territorio) &&
            normalize(row.gravadora) === normalize(gravadora)
        );

        return match || null;

    }

};
