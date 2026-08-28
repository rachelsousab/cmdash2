/**
 * ============================================================
 * CONSUMO DE PLAYLISTS — gera tabela dinâmica + gráfico
 * ------------------------------------------------------------
 * Recebe (via POST) os dados brutos de uma planilha de consumo
 * (Data, ID Playlist, Nome da Playlist, Consumo) + o período de
 * destaque (entrada/saída), e:
 *
 * 1) Cria uma Google Sheet nova, dentro da pasta do Drive
 *    configurada, com:
 *    - aba "Dados": os dados brutos, como vieram
 *    - aba "Tabela Dinâmica": um PIVOT TABLE de verdade (soma
 *      de Consumo por Data, ordem crescente, com total geral),
 *      as linhas do período de destaque destacadas em vermelho,
 *      e um gráfico de linha (Consumo por dia, com uma segunda
 *      série só do período de destaque, em vermelho, por cima)
 *
 * 2) Registra uma linha no "Histórico" (outra planilha, cujo ID
 *    fica em HISTORICO_SPREADSHEET_ID) — é esse histórico que o
 *    dashboard lê de volta (via CSV publicado) pra montar a
 *    lista pesquisável.
 *
 * ------------------------------------------------------------
 * SETUP NECESSÁRIO (uma vez só):
 *
 * 1) Crie uma Google Sheet nova (fora da pasta de destino, pode
 *    ficar em qualquer lugar) chamada, por exemplo, "Histórico -
 *    Consumo de Playlists". Nela, uma aba chamada exatamente
 *    "Histórico" com esse cabeçalho na linha 1, nessa ordem:
 *
 *    ID Playlist | Nome da Playlist | Data Início | Data Fim |
 *    Entrada Destaque | Saída Destaque | Consumo Total |
 *    Consumo Destaque | Drive File ID | Drive File URL |
 *    Criado em | Dados GID | Tabela Dinâmica GID |
 *    Variação Destaque (%) | Variação Pós-Destaque (%)
 *
 *    (se sua aba "Histórico" já existe com só as 11 primeiras
 *    colunas, adicione as 4 novas — Dados GID, Tabela Dinâmica
 *    GID, Variação Destaque (%), Variação Pós-Destaque (%) —
 *    nessa ordem, logo depois de "Criado em")
 *
 * 2) Publique essa aba na web (Arquivo > Compartilhar > Publicar
 *    na Web > selecione a aba "Histórico" > CSV) e me mande a
 *    URL publicada — vai em CONFIG.PIVOT_DATA.csvUrl no
 *    config.js do dashboard.
 *
 * 3) Copie o ID dessa planilha (a parte da URL entre /d/ e
 *    /edit) e cole em HISTORICO_SPREADSHEET_ID logo abaixo.
 *
 * 4) Implante este script como Web App (Executar como: Eu,
 *    Quem tem acesso: Qualquer pessoa) e me mande a URL — vai
 *    em CONFIG.PIVOT_UPLOAD.webAppUrl no config.js.
 * ============================================================
 */

const SHARED_SECRET = "DashCM2026PivotRachel"; // mesmo valor de CONFIG.PIVOT_UPLOAD.sharedSecret

const DRIVE_FOLDER_ID = "1QX-XT44umbP7XlKmT3-NtDrQg60mdD4M"; // pasta onde as planilhas geradas são salvas

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
 * pelo pop-up do histórico, pra desenhar tabela+gráfico ali).
 *
 * IMPORTANTE: buscar essas Sheets direto pela URL do Google
 * (/export?format=csv ou /gviz/tq) NÃO funciona a partir do
 * dashboard — testado ao vivo e o navegador bloqueia por CORS,
 * mesmo a Sheet estando com "Qualquer pessoa com o link". Por
 * isso passa por aqui: mesmo Web App que já cria a Sheet, e que
 * já devolve JSON legível sem esse problema (mesmo padrão do
 * download de capas).
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

    const values = sheet.getRange(2, 1, lastRow - 1, 4).getValues();

    const rows = values.map(row => ({
      data: formatDateBR(row[0]),
      idPlaylist: String(row[1]),
      nomePlaylist: String(row[2]),
      consumo: Number(row[3]) || 0
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

    return handleGerarPivot(payload);

  } catch (error) {

    return jsonResponse({ success: false, errors: [String(error)] });

  }

}

function handleGerarPivot(payload) {

  const rows = payload.rows || [];

  if (!rows.length) {
    return jsonResponse({ success: false, errors: ["Nenhuma linha enviada."] });
  }

  const idPlaylist = payload.idPlaylist || "";
  const nomePlaylist = payload.nomePlaylist || "Playlist";

  const entrada = payload.entrada || ""; // "yyyy-MM-dd" ou ""
  const saida = payload.saida || "";

  const entradaDate = entrada ? parseDataKey(entrada) : null;
  const saidaDate = saida ? parseDataKey(saida) : null;

  // Ordena por data (garante consistência na aba Dados).
  rows.sort((a, b) => a.data.localeCompare(b.data));

  const datasOrdenadas = rows.map(r => parseDataKey(r.data)).sort((a, b) => a - b);
  const dataInicio = datasOrdenadas[0];
  const dataFim = datasOrdenadas[datasOrdenadas.length - 1];

  // -------- cria a planilha, já dentro da pasta certa --------

  const fileName = `${nomePlaylist} - ${idPlaylist} - ${formatDateBR(dataInicio)} a ${formatDateBR(dataFim)}`;

  const ss = SpreadsheetApp.create(fileName);

  const arquivo = DriveApp.getFileById(ss.getId());
  const pasta = DriveApp.getFolderById(DRIVE_FOLDER_ID);

  pasta.addFile(arquivo);
  DriveApp.getRootFolder().removeFile(arquivo);

  // -------- aba "Dados" --------

  const dadosSheet = ss.getSheets()[0];
  dadosSheet.setName("Dados");

  dadosSheet.getRange(1, 1, 1, 4).setValues([["Data", "ID Playlist", "Nome da Playlist", "Consumo"]]);

  const dataRows = rows.map(r => [parseDataKey(r.data), r.idPlaylist, r.nomePlaylist, Number(r.consumo || 0)]);

  dadosSheet.getRange(2, 1, dataRows.length, 4).setValues(dataRows);
  dadosSheet.getRange(2, 1, dataRows.length, 1).setNumberFormat("dd/MM/yyyy");

  // -------- agrupamento por dia (usado no gráfico e na coloração) --------

  const grouped = {}; // "yyyy-MM-dd" -> total

  rows.forEach(r => {
    grouped[r.data] = (grouped[r.data] || 0) + Number(r.consumo || 0);
  });

  const groupedKeys = Object.keys(grouped).sort();

  function isDestaque(key) {
    if (!entradaDate || !saidaDate) return false;
    const d = parseDataKey(key);
    return d >= entradaDate && d <= saidaDate;
  }

  const consumoTotal = groupedKeys.reduce((soma, key) => soma + grouped[key], 0);
  const consumoDestaque = groupedKeys.filter(isDestaque).reduce((soma, key) => soma + grouped[key], 0);

  // -------- % de variação (mesma lógica da prévia no dashboard) --------

  function media(valores) {
    return valores.length ? valores.reduce((soma, v) => soma + v, 0) / valores.length : null;
  }

  function calcVariacao(base, comparado) {
    if (!base || comparado === null) return "";
    return Number((((comparado - base) / base) * 100).toFixed(1));
  }

  let variacaoDestaque = "";
  let variacaoPosDestaque = "";

  if (entradaDate && saidaDate) {

    const valoresAntes = groupedKeys.filter(key => parseDataKey(key) < entradaDate).map(key => grouped[key]);
    const valoresDurante = groupedKeys.filter(isDestaque).map(key => grouped[key]);
    const valoresDepois = groupedKeys.filter(key => parseDataKey(key) > saidaDate).map(key => grouped[key]);

    variacaoDestaque = calcVariacao(media(valoresAntes), media(valoresDurante));
    variacaoPosDestaque = calcVariacao(media(valoresDurante), media(valoresDepois));

  }

  // -------- aba "Tabela Dinâmica" (resumo por dia via QUERY) --------
  //
  // A API nativa de Pivot Table do Apps Script (createPivotTable/
  // addRowGroup/addPivotValue) se mostrou pouco confiável aqui —
  // deu "índice de colunas fora do intervalo" mesmo com os índices
  // documentados como corretos. Em vez disso, montamos a tabela
  // agrupada com uma fórmula QUERY — mesmo resultado visual (Data,
  // Soma de Consumo, ordem crescente, total geral), continua
  // editável pela Rachel, e não depende dessa API específica.

  const pivotSheet = ss.insertSheet("Tabela Dinâmica");

  pivotSheet.getRange("A1:B1").setValues([["Data", "Soma de Consumo"]]);

  const lastDataRow = dadosSheet.getLastRow();

  pivotSheet.getRange("A2").setFormula(
    `=QUERY(Dados!A2:D${lastDataRow}; "select A, sum(D) where A is not null group by A order by A label sum(D) ''"; 0)`
  );

  SpreadsheetApp.flush();

  const groupedRowCount = groupedKeys.length;
  const totalRow = 2 + groupedRowCount;

  pivotSheet.getRange(totalRow, 1).setValue("Total geral");
  pivotSheet.getRange(totalRow, 2).setFormula(`=SUM(B2:B${totalRow - 1})`);

  pivotSheet.getRange(2, 1, groupedRowCount, 1).setNumberFormat("dd/MM/yyyy");

  // Colore de vermelho claro as linhas cuja data cai dentro do
  // período de destaque.
  for (let r = 2; r < totalRow; r++) {

    const valorCelula = pivotSheet.getRange(r, 1).getValue();

    if (Object.prototype.toString.call(valorCelula) === "[object Date]") {

      const key = Utilities.formatDate(valorCelula, Session.getScriptTimeZone(), "yyyy-MM-dd");

      if (isDestaque(key)) {
        pivotSheet.getRange(r, 1, 1, 2).setBackground("#f4cccc");
      }

    }

  }

  // -------- dados de apoio pro gráfico (mesma aba, mais afastado) --------

  const chartStartCol = 6; // coluna F

  pivotSheet.getRange(1, chartStartCol, 1, 3).setValues([["Data", "Consumo", "Consumo (destaque)"]]);

  const chartRows = groupedKeys.map(key => [
    parseDataKey(key),
    grouped[key],
    isDestaque(key) ? grouped[key] : null
  ]);

  pivotSheet.getRange(2, chartStartCol, chartRows.length, 3).setValues(chartRows);
  pivotSheet.getRange(2, chartStartCol, chartRows.length, 1).setNumberFormat("dd/MM/yyyy");

  // -------- KPIs escritos na própria planilha --------

  pivotSheet.getRange("J1").setValue("Consumo total da playlist:");
  pivotSheet.getRange("K1").setValue(consumoTotal);

  pivotSheet.getRange("J2").setValue("Consumo durante o destaque:");
  pivotSheet.getRange("K2").setValue(consumoDestaque);

  // -------- gráfico de linha --------

  const chartRange = pivotSheet.getRange(1, chartStartCol, chartRows.length + 1, 3);

  const chart = pivotSheet.newChart()
    .asLineChart()
    .addRange(chartRange)
    .setPosition(chartRows.length + 6, chartStartCol, 0, 0)
    .setOption("title", `Consumo por dia — ${nomePlaylist}`)
    .setOption("series", {
      0: { color: "#999999" },
      1: { color: "#CC0000", lineWidth: 4 }
    })
    .setOption("width", 700)
    .setOption("height", 350)
    .build();

  pivotSheet.insertChart(chart);

  // -------- registra no histórico --------

  registrarHistorico({

    idPlaylist,
    nomePlaylist,

    dataInicio: formatDateBR(dataInicio),
    dataFim: formatDateBR(dataFim),

    entrada: entradaDate ? formatDateBR(entradaDate) : "",
    saida: saidaDate ? formatDateBR(saidaDate) : "",

    consumoTotal,
    consumoDestaque,

    driveFileId: ss.getId(),
    driveUrl: ss.getUrl(),

    dadosGid: dadosSheet.getSheetId(),
    pivotGid: pivotSheet.getSheetId(),

    variacaoDestaque,
    variacaoPosDestaque

  });

  return jsonResponse({

    success: true,

    driveFileId: ss.getId(),
    driveUrl: ss.getUrl(),

    consumoTotal,
    consumoDestaque

  });

}

function registrarHistorico(entry) {

  const ss = SpreadsheetApp.openById(HISTORICO_SPREADSHEET_ID);

  const sheet = ss.getSheetByName(HISTORICO_SHEET_NAME);

  sheet.appendRow([

    entry.idPlaylist,
    entry.nomePlaylist,
    entry.dataInicio,
    entry.dataFim,
    entry.entrada,
    entry.saida,
    entry.consumoTotal,
    entry.consumoDestaque,
    entry.driveFileId,
    entry.driveUrl,
    formatDateBR(new Date()),
    entry.dadosGid,
    entry.pivotGid,
    entry.variacaoDestaque,
    entry.variacaoPosDestaque

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
