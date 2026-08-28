/**
 * ============================================================
 * CONSUMO POR ARTISTA — gera tabelas + gráficos
 * ------------------------------------------------------------
 * Mesmo esquema de scratch-code-gs-pivot.gs (Consumo de
 * Playlists), adaptado pro export "Artista Analítico": recebe
 * (via POST) os dados brutos de consumo de um artista (Data,
 * Artista, Álbum, Fonograma, Gravadora, Produto, País,
 * Quantidade) + período de destaque + tipo de destaque, e:
 *
 * 1) Cria uma Google Sheet nova, dentro da pasta do Drive
 *    configurada, com:
 *    - aba "Dados": os dados brutos, como vieram
 *    - aba "Por País", "Por Álbum" e "Por Fonograma": soma de
 *      Quantidade agrupada (via QUERY, mesmo motivo do pivot —
 *      a API nativa de PivotTable do Apps Script se mostrou
 *      pouco confiável), cada uma com um gráfico de barras dos
 *      15 primeiros.
 *
 * 2) Registra uma linha no "Histórico" (outra planilha, cujo ID
 *    fica em HISTORICO_SPREADSHEET_ID) — é esse histórico que o
 *    dashboard lê de volta (via CSV publicado) pra montar a
 *    lista pesquisável.
 *
 * ------------------------------------------------------------
 * SETUP NECESSÁRIO (uma vez só — mesmos 3 passos do Consumo de
 * Playlists):
 *
 * 1) Crie uma Google Sheet nova (fora da pasta de destino, pode
 *    ficar em qualquer lugar) chamada, por exemplo, "Histórico -
 *    Consumo por Artista". Nela, uma aba chamada exatamente
 *    "Histórico" com esse cabeçalho na linha 1, nessa ordem:
 *
 *    ID Artista | Nome do Artista | Data Início | Data Fim |
 *    Entrada Destaque | Saída Destaque | Tipo de Destaque |
 *    Consumo Total | Consumo Destaque | País de Destaque |
 *    Fonograma Mais Escutado | Drive File ID | Drive File URL |
 *    Criado em | Ações Relacionadas (IDs)
 *
 *    ("Ações Relacionadas (IDs)" fica reservada pra quando a
 *    relação entre Tipo de Destaque e as ações da Área de
 *    Marketing (e/ou da aba Destaques de Gravadoras, no caso de
 *    "Capa de playlist") for definida — por enquanto sempre
 *    grava vazio.)
 *
 * 2) Publique essa aba na web (Arquivo > Compartilhar > Publicar
 *    na Web > selecione a aba "Histórico" > CSV) e me mande a
 *    URL publicada — vai em CONFIG.ARTIST_DATA.csvUrl no
 *    config.js do dashboard.
 *
 * 3) Copie o ID dessa planilha (a parte da URL entre /d/ e
 *    /edit) e cole em HISTORICO_SPREADSHEET_ID logo abaixo.
 *
 * 4) Implante este script como Web App (Executar como: Eu,
 *    Quem tem acesso: Qualquer pessoa) e me mande a URL — vai
 *    em CONFIG.ARTIST_UPLOAD.webAppUrl no config.js.
 * ============================================================
 */

const SHARED_SECRET = "DashCM2026ArtistaRachel"; // mesmo valor de CONFIG.ARTIST_UPLOAD.sharedSecret

const DRIVE_FOLDER_ID = "1vZebJxkQ9RQtDW0lJ8R8rgiLG83HJeI8"; // pasta onde as planilhas geradas são salvas

const HISTORICO_SPREADSHEET_ID = "COLE_AQUI_O_ID_DA_PLANILHA_DE_HISTORICO"; // AJUSTAR (passo 3 acima)

const HISTORICO_SHEET_NAME = "Histórico";

function doGet(e) {

  // "e" vem vazio quando a função é rodada direto pelo botão
  // "Executar" do editor (sem uma requisição HTTP de verdade) —
  // sem esse fallback, isso quebra com "Cannot read properties
  // of undefined". Numa chamada real do Web App, "e" sempre vem
  // preenchido normalmente.
  const params = (e && e.parameter) || {};

  if (params.action === "getDados") {
    return handleGetDados(e);
  }

  return jsonResponse({ status: "online" });

}

/**
 * Devolve as linhas da aba "Dados" de uma Sheet já gerada (usado
 * pelo pop-up do histórico, pra desenhar tabelas+gráficos ali).
 * Buscar essas Sheets direto pela URL do Google (/export,
 * /gviz) NÃO funciona a partir do dashboard — mesma descoberta
 * feita no Consumo de Playlists (bloqueio de CORS mesmo com
 * "Qualquer pessoa com o link").
 */
function handleGetDados(e) {

  try {

    if (e.parameter.token !== SHARED_SECRET) {
      return jsonResponse({ success: false, errors: ["Não autorizado."] });
    }

    const fileId = e.parameter.fileId;

    if (!fileId) {
      return jsonResponse({ success: false, errors: ["fileId ausente."] });
    }

    const ss = SpreadsheetApp.openById(fileId);
    const sheet = ss.getSheetByName("Dados");

    if (!sheet) {
      return jsonResponse({ success: false, errors: ["Aba Dados não encontrada."] });
    }

    const lastRow = sheet.getLastRow();

    if (lastRow < 2) {
      return jsonResponse({ success: true, rows: [] });
    }

    const values = sheet.getRange(2, 1, lastRow - 1, 10).getValues();

    const rows = values.map(row => ({
      data: formatDateBR(row[0]),
      artistaId: String(row[1]),
      artista: String(row[2]),
      album: String(row[3]),
      fonogramaId: String(row[4]),
      fonograma: String(row[5]),
      gravadora: String(row[6]),
      produto: String(row[7]),
      pais: String(row[8]),
      quantidade: Number(row[9]) || 0
    }));

    return jsonResponse({ success: true, rows });

  } catch (error) {

    return jsonResponse({ success: false, errors: [String(error)] });

  }

}

function doPost(e) {

  try {

    const payload = JSON.parse(e.postData.contents);

    if (payload.token !== SHARED_SECRET) {
      return jsonResponse({ success: false, errors: ["Não autorizado."] });
    }

    return handleGerarConsumoArtista(payload);

  } catch (error) {

    return jsonResponse({ success: false, errors: [String(error)] });

  }

}

function handleGerarConsumoArtista(payload) {

  const rows = payload.rows || [];

  if (!rows.length) {
    return jsonResponse({ success: false, errors: ["Nenhuma linha enviada."] });
  }

  const artistaId = payload.artistaId || "";
  const artista = payload.artista || "Artista";

  const entrada = payload.entrada || ""; // "yyyy-MM-dd" ou ""
  const saida = payload.saida || "";

  const entradaDate = entrada ? parseDataKey(entrada) : null;
  const saidaDate = saida ? parseDataKey(saida) : null;

  rows.sort((a, b) => a.data.localeCompare(b.data));

  const datasOrdenadas = rows.map(r => parseDataKey(r.data)).sort((a, b) => a - b);
  const dataInicio = datasOrdenadas[0];
  const dataFim = datasOrdenadas[datasOrdenadas.length - 1];

  // -------- cria a planilha, já dentro da pasta certa --------

  const fileName = `${artista} - ${artistaId} - ${formatDateBR(dataInicio)} a ${formatDateBR(dataFim)}`;

  const ss = SpreadsheetApp.create(fileName);

  const arquivo = DriveApp.getFileById(ss.getId());
  const pasta = DriveApp.getFolderById(DRIVE_FOLDER_ID);

  pasta.addFile(arquivo);
  DriveApp.getRootFolder().removeFile(arquivo);

  // -------- aba "Dados" --------

  const dadosSheet = ss.getSheets()[0];
  dadosSheet.setName("Dados");

  dadosSheet.getRange(1, 1, 1, 10).setValues([[
    "Data", "Artista (Business ID)", "Artista", "Álbum",
    "Fonograma (Business ID)", "Nome do Fonograma", "Gravadora",
    "Produto", "País", "Quantidade"
  ]]);

  const dataRows = rows.map(r => [
    parseDataKey(r.data), r.artistaId, r.artista, r.album,
    r.fonogramaId, r.fonograma, r.gravadora, r.produto, r.pais,
    Number(r.quantidade || 0)
  ]);

  dadosSheet.getRange(2, 1, dataRows.length, 10).setValues(dataRows);
  dadosSheet.getRange(2, 1, dataRows.length, 1).setNumberFormat("dd/MM/yyyy");

  const lastDataRow = dadosSheet.getLastRow();

  // -------- abas agrupadas (Por País / Por Álbum / Por Fonograma) --------

  const consumoTotal = rows.reduce((soma, r) => soma + Number(r.quantidade || 0), 0);

  const consumoDestaque = (entradaDate && saidaDate)
    ? rows
        .filter(r => {
          const d = parseDataKey(r.data);
          return d >= entradaDate && d <= saidaDate;
        })
        .reduce((soma, r) => soma + Number(r.quantidade || 0), 0)
    : "";

  createGroupedSheet(ss, "Por País", "I", lastDataRow, "Consumo por país");
  createGroupedSheet(ss, "Por Álbum", "D", lastDataRow, "Consumo por álbum");
  createGroupedSheet(ss, "Por Fonograma", "F", lastDataRow, "Consumo por fonograma");

  // -------- registra no histórico --------

  registrarHistorico({

    artistaId,
    artista,

    dataInicio: formatDateBR(dataInicio),
    dataFim: formatDateBR(dataFim),

    entrada: entradaDate ? formatDateBR(entradaDate) : "",
    saida: saidaDate ? formatDateBR(saidaDate) : "",

    tipoDestaque: payload.tipoDestaque || "",

    consumoTotal,
    consumoDestaque,

    paisDestaque: payload.paisDestaque || "",
    fonogramaMaisEscutado: payload.fonogramaMaisEscutado || "",

    driveFileId: ss.getId(),
    driveUrl: ss.getUrl(),

    acoesRelacionadas: payload.acoesRelacionadas || ""

  });

  return jsonResponse({

    success: true,

    driveFileId: ss.getId(),
    driveUrl: ss.getUrl(),

    consumoTotal,
    consumoDestaque

  });

}

/**
 * Cria uma aba com uma tabela agrupada (QUERY somando a coluna
 * J — Quantidade — por uma coluna de agrupamento) + gráfico de
 * barras dos 15 primeiros. Mesmo padrão usado na aba "Tabela
 * Dinâmica" do Consumo de Playlists, só que aqui repetido 3x
 * (País / Álbum / Fonograma) — coluna de agrupamento passada
 * como letra (ex.: "I" pra País).
 */
function createGroupedSheet(ss, sheetName, groupColLetter, lastDataRow, chartTitle) {

  const sheet = ss.insertSheet(sheetName);

  sheet.getRange("A1:B1").setValues([[sheetName.replace("Por ", ""), "Soma de Consumo"]]);

  sheet.getRange("A2").setFormula(
    `=QUERY(Dados!A2:J${lastDataRow}; "select ${groupColLetter}, sum(J) where ${groupColLetter} is not null group by ${groupColLetter} order by sum(J) desc label sum(J) ''"; 0)`
  );

  SpreadsheetApp.flush();

  const lastRow = sheet.getLastRow();

  if (lastRow < 2) return;

  const totalRow = lastRow + 1;

  sheet.getRange(totalRow, 1).setValue("Total geral");
  sheet.getRange(totalRow, 2).setFormula(`=SUM(B2:B${lastRow})`);

  const chartRowCount = Math.min(lastRow - 1, 15);

  if (chartRowCount > 0) {

    const chartRange = sheet.getRange(1, 1, chartRowCount + 1, 2);

    const chart = sheet.newChart()
      .asBarChart()
      .addRange(chartRange)
      .setPosition(totalRow + 3, 1, 0, 0)
      .setOption("title", chartTitle)
      .setOption("series", { 0: { color: "#E30613" } })
      .setOption("width", 700)
      .setOption("height", 350)
      .build();

    sheet.insertChart(chart);

  }

}

function registrarHistorico(entry) {

  const ss = SpreadsheetApp.openById(HISTORICO_SPREADSHEET_ID);

  const sheet = ss.getSheetByName(HISTORICO_SHEET_NAME);

  sheet.appendRow([

    entry.artistaId,
    entry.artista,
    entry.dataInicio,
    entry.dataFim,
    entry.entrada,
    entry.saida,
    entry.tipoDestaque,
    entry.consumoTotal,
    entry.consumoDestaque,
    entry.paisDestaque,
    entry.fonogramaMaisEscutado,
    entry.driveFileId,
    entry.driveUrl,
    formatDateBR(new Date()),
    entry.acoesRelacionadas || ""

  ]);

}

/**
 * "yyyy-MM-dd" -> Date (meia-noite, fuso do script — evita
 * ambiguidade de "new Date('2026-08-14')", que o JS interpreta
 * como UTC e pode voltar um dia dependendo do fuso).
 */
function parseDataKey(key) {

  const [ano, mes, dia] = key.split("-").map(Number);

  return new Date(ano, mes - 1, dia);

}

function formatDateBR(date) {

  return Utilities.formatDate(date, Session.getScriptTimeZone(), "dd/MM/yyyy");

}

function jsonResponse(obj) {

  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);

}
