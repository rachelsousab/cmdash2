/**
 * ==========================================================
 * CONSUMO POR ARTISTA — DADOS
 * ----------------------------------------------------------
 * Mesma responsabilidade de js/pivot-data.js, só que pro
 * export "Artista Analítico" (Data, Artista, Álbum, Fonograma,
 * Gravadora, Produto, País, Quantidade) em vez do export de
 * consumo de playlist.
 *
 * Reaproveita PivotData.loadXLSX() pro carregamento sob demanda
 * do SheetJS — não faz sentido duplicar esse helper, já que os
 * dois módulos convivem na mesma página.
 * ==========================================================
 */

const ArtistData = {

    historico: [],
    historicoLoaded: false,

    /* ======================================================
       LEITURA DO ARQUIVO ENVIADO (client-side, via SheetJS)
       ------------------------------------------------------
       Colunas lidas por POSIÇÃO (não por nome do cabeçalho) —
       mesmo motivo do parseFile de Consumo de Playlists: exports
       de ferramentas de BI às vezes vêm com cabeçalhos faltando
       ou em ordem/grafia inconsistente. Ordem confirmada no
       arquivo real de exemplo:
       Data(0), Artista Business ID(1), Artista(2), Álbum(3),
       Fonograma Business ID(4), Nome do Fonograma(5),
       Gravadora(6), Produto(7), País(8), Index(9), Quantidade(10).
    ====================================================== */

    async parseFile(file) {

        await PivotData.loadXLSX();

        return new Promise((resolve, reject) => {

            const reader = new FileReader();

            reader.onload = (event) => {

                try {

                    const workbook = XLSX.read(event.target.result, { type: "array", raw: true, cellDates: false });

                    const sheetName = workbook.SheetNames[0];
                    const sheet = workbook.Sheets[sheetName];

                    const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: true });

                    const rows = this.normalizeRows(matrix.slice(1));

                    if (!rows.length) {
                        reject(new Error("Nenhuma linha válida encontrada (confira se as colunas são Data, Artista (Business ID), Artista, Álbum, Fonograma (Business ID), Nome do Fonograma, Gravadora, Produto, País, Index e Quantidade, nessa ordem)."));
                        return;
                    }

                    resolve(rows);

                }
                catch (error) {

                    reject(error);

                }

            };

            reader.onerror = () => reject(new Error("Não foi possível ler o arquivo."));

            reader.readAsArrayBuffer(file);

        });

    },

    normalizeRows(matrix) {

        return matrix
            .filter(cols => Array.isArray(cols) && cols.length)
            .map(cols => ({
                data: this.toDate(cols[0]),
                artistaId: this.toString(cols[1]),
                artista: this.toString(cols[2]),
                album: this.toString(cols[3]),
                fonogramaId: this.toString(cols[4]),
                fonograma: this.toString(cols[5]),
                gravadora: this.toString(cols[6]),
                produto: this.toString(cols[7]),
                pais: this.toString(cols[8]),
                quantidade: this.toNumber(cols[10])
            }))
            .filter(row => row.data instanceof Date && !isNaN(row.data.getTime()));

    },

    toString(value) {

        return String(value === undefined || value === null ? "" : value).trim();

    },

    toNumber(value) {

        if (typeof value === "number") return value;

        const text = this.toString(value).replace(/\./g, "").replace(",", ".");

        const n = Number(text);

        return isNaN(n) ? 0 : n;

    },

    /**
     * "dd/mm/aaaa" OU "dd/mm/aaaa HH:mm:ss" (formato real do
     * export) -> Date. Também aceita um serial de Excel (número),
     * caso a pessoa reabra e resalve o CSV como .xlsx antes de
     * enviar.
     */
    toDate(value) {

        if (value instanceof Date) return value;

        if (typeof value === "number") {
            return new Date(Math.round((value - 25569) * 86400 * 1000));
        }

        const text = this.toString(value).split(" ")[0];

        const partes = text.split("/");

        if (partes.length === 3) {
            return new Date(Number(partes[2]), Number(partes[1]) - 1, Number(partes[0]));
        }

        return null;

    },

    /* ======================================================
       AGRUPAMENTOS — soma de Quantidade, ordem decrescente
    ====================================================== */

    groupBy(rows, field) {

        const map = new Map();

        rows.forEach(row => {

            const key = row[field] || "—";

            map.set(key, (map.get(key) || 0) + row.quantidade);

        });

        return [...map.entries()]
            .map(([key, total]) => ({ key, total }))
            .sort((a, b) => b.total - a.total);

    },

    groupByPais(rows) {
        return this.groupBy(rows, "pais");
    },

    groupByAlbum(rows) {
        return this.groupBy(rows, "album");
    },

    /**
     * Agrupa por fonograma, opcionalmente restrito a uma lista de
     * álbuns (dropdown de filtro na tabela de fonogramas). Sem
     * filtro (array vazio/undefined), usa todos os fonogramas.
     */
    groupByFonograma(rows, albunsFiltro) {

        const filtered = (albunsFiltro && albunsFiltro.length)
            ? rows.filter(row => albunsFiltro.includes(row.album))
            : rows;

        return this.groupBy(filtered, "fonograma");

    },

    uniqueAlbuns(rows) {

        return [...new Set(rows.map(row => row.album).filter(Boolean))]
            .sort((a, b) => a.localeCompare(b, "pt-BR", { sensitivity: "base" }));

    },

    formatDateBR(date) {

        if (!date) return "";

        return date.toLocaleDateString("pt-BR");

    },

    isWithinRange(date, start, end) {

        if (!start || !end) return false;

        const d = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
        const s = new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime();
        const e = new Date(end.getFullYear(), end.getMonth(), end.getDate()).getTime();

        return d >= s && d <= e;

    },

    dateKey(date) {

        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

    },

    parseDateBR(value) {

        const text = this.toString(value);

        const partes = text.split("/");

        if (partes.length !== 3) return null;

        return new Date(Number(partes[2]), Number(partes[1]) - 1, Number(partes[0]));

    },

    /* ======================================================
       HISTÓRICO
    ====================================================== */

    async loadHistorico(csvUrl = CONFIG.ARTIST_DATA.csvUrl) {

        if (!csvUrl) {

            this.historico = [];
            this.historicoLoaded = true;

            return this.historico;

        }

        return new Promise((resolve, reject) => {

            Papa.parse(csvUrl, {

                download: true,
                header: true,
                skipEmptyLines: true,
                transformHeader: (header) => header.trim(),

                complete: (results) => {

                    this.historico = results.data
                        .map(row => this.normalizeHistoricoRow(row))
                        .filter(row => row.artistaId || row.artista);

                    this.historicoLoaded = true;

                    resolve(this.historico);

                },

                error: reject

            });

        });

    },

    normalizeHistoricoRow(row) {

        return {

            artistaId: this.toString(row["ID Artista"]),
            artista: this.toString(row["Nome do Artista"]),

            dataInicio: this.parseDateBR(row["Data Início"]),
            dataFim: this.parseDateBR(row["Data Fim"]),

            entrada: this.parseDateBR(row["Entrada Destaque"]),
            saida: this.parseDateBR(row["Saída Destaque"]),

            tipoDestaque: this.toString(row["Tipo de Destaque"]),

            consumoTotal: this.toNumber(row["Consumo Total"]),
            consumoDestaque: this.toNumber(row["Consumo Destaque"]),

            paisDestaque: this.toString(row["País de Destaque"]),
            fonogramaMaisEscutado: this.toString(row["Fonograma Mais Escutado"]),

            driveFileId: this.toString(row["Drive File ID"]),
            driveUrl: this.toString(row["Drive File URL"]),

            criadoEm: this.toString(row["Criado em"]),

            // Reservado pra quando a relação Tipo de Destaque <->
            // ações (Marketing e/ou Destaques de Gravadoras) for
            // definida — por enquanto sempre vazio.
            acoesRelacionadas: this.toString(row["Ações Relacionadas (IDs)"])

        };

    },

    /* ======================================================
       ABA "DADOS" DE UMA SHEET JÁ GERADA (modal do histórico)
       ------------------------------------------------------
       Mesma descoberta/solução do Consumo de Playlists: buscar
       a Sheet direto pela URL do Google (/export, /gviz) esbarra
       em CORS, então passa pelo próprio Web App (action=getDados).
    ====================================================== */

    fetchDadosCsv(driveFileId) {

        const url = `${CONFIG.ARTIST_UPLOAD.webAppUrl}?action=getDados&fileId=${encodeURIComponent(driveFileId)}&token=${encodeURIComponent(CONFIG.ARTIST_UPLOAD.sharedSecret)}`;

        return fetch(url)
            .then(response => response.json())
            .then(data => {

                if (!data.success) {
                    throw new Error((data.errors && data.errors[0]) || "Não foi possível carregar os dados diários.");
                }

                const rows = (data.rows || [])
                    .map(row => ({
                        data: this.parseDateBR(row.data),
                        artistaId: this.toString(row.artistaId),
                        artista: this.toString(row.artista),
                        album: this.toString(row.album),
                        fonogramaId: this.toString(row.fonogramaId),
                        fonograma: this.toString(row.fonograma),
                        gravadora: this.toString(row.gravadora),
                        produto: this.toString(row.produto),
                        pais: this.toString(row.pais),
                        quantidade: this.toNumber(row.quantidade)
                    }))
                    .filter(row => row.data instanceof Date && !isNaN(row.data.getTime()));

                if (!rows.length) {
                    throw new Error("Nenhuma linha encontrada na aba Dados.");
                }

                return { rows };

            });

    }

};
