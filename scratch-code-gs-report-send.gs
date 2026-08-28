/**
 * ============================================================
 * GERADOR DE REPORTE — "Atualizar planilha de destaque"
 * ------------------------------------------------------------
 * Recebe (via POST) a tabela de destaques já filtrada na tela
 * (cabeçalho + linhas + link da planilha da gravadora) e insere
 * uma aba NOVA, com esses dados já formatados (mesmas cores que
 * já usamos: cabeçalho vermelho, Capa/Inclusão/Instagram
 * coloridos), DIRETO dentro da planilha da própria gravadora —
 * sem planilha intermediária, sem precisar usar o "Copiar para"
 * manual do Sheets. O nome da aba é a semana selecionada, no
 * formato "dd/mm/aa".
 *
 * Rodar de novo pra mesma gravadora/semana SUBSTITUI a aba
 * anterior daquela semana (apaga e recria), em vez de duplicar.
 *
 * ÚNICO — não precisa de um script por gravadora/planilha. Ele
 * recebe o link da planilha de destino a cada chamada (vem da
 * planilha de destinatários, coluna do link direto), então serve
 * pra qualquer gravadora/território/pessoa da equipe.
 *
 * IMPORTANTE: como o script roda com a identidade de quem
 * implantou ele (a Rachel — ver nota abaixo), ele só consegue
 * inserir a aba em planilhas que ESSA conta já tem permissão de
 * edição. Como é a mesma conta que já cola os destaques
 * manualmente hoje, deve já ter acesso a todas.
 *
 * ------------------------------------------------------------
 * SETUP (uma vez só, sem planilha de histórico nem pasta do
 * Drive):
 *
 * 1) Implante este script como Web App (Executar como: Eu,
 *    Quem tem acesso: Qualquer pessoa) e me mande a URL — vai
 *    em CONFIG.REPORT_SEND.webAppUrl no config.js.
 * ============================================================
 */

const SHARED_SECRET = "DashCM2026ReportSendRachel"; // mesmo valor de CONFIG.REPORT_SEND.sharedSecret

// Mesmas cores de js/report-dashboard.js (buildTableHtml).
const COLOR_HEADER_BG = "#990000";
const COLOR_HEADER_FONT = "#ffffff";
const COLOR_CAPA_BG = "#d9ead3";
const COLOR_INSTAGRAM_BG = "#ead1dc";
const COLOR_INCLUSAO_BG = "#fff2cc";
const COLOR_BORDER = "#cccccc";

function doGet(e) {

  return jsonResponse({ status: "online" });

}

function doPost(e) {

  try {

    const payload = JSON.parse(e.postData.contents);

    if (payload.token !== SHARED_SECRET) {
      return jsonResponse({ success: false, errors: ["Não autorizado."] });
    }

    return handleAtualizarPlanilhaDestino(payload);

  } catch (error) {

    return jsonResponse({ success: false, errors: [String(error)] });

  }

}

function handleAtualizarPlanilhaDestino(payload) {

  const headers = payload.headers || [];
  const rows = payload.rows || [];
  const tipos = payload.tipos || [];
  const nomeAba = payload.nomeAba || "Destaques";
  const linkPlanilhaDestino = payload.linkPlanilhaDestino || "";

  // Posição (a partir de 0) da coluna Destaque — muda conforme a
  // coluna País entra ou não (ver ReportDashboard.buildTableData no
  // dashboard). 1 é o padrão de segurança (com País, formato mais
  // comum) caso o dashboard não mande esse campo por algum motivo.
  const destaqueColIndex = typeof payload.destaqueColIndex === "number" ? payload.destaqueColIndex : 1;

  if (!headers.length || !rows.length) {
    return jsonResponse({ success: false, errors: ["Nenhum dado enviado."] });
  }

  const destId = extractSpreadsheetId(linkPlanilhaDestino);

  if (!destId) {
    return jsonResponse({ success: false, errors: ["Link da planilha da gravadora inválido ou ausente."] });
  }

  let destSs;

  try {
    destSs = SpreadsheetApp.openById(destId);
  }
  catch (error) {
    return jsonResponse({ success: false, errors: [`Não consegui abrir a planilha da gravadora (confira se a conta que implantou o script tem acesso de edição nela): ${error}`] });
  }

  // Rodar de novo pra mesma semana substitui a aba anterior, em
  // vez de duplicar/acumular várias abas com o mesmo nome.
  const existente = destSs.getSheetByName(nomeAba);

  if (existente) {
    destSs.deleteSheet(existente);
  }

  const sheet = destSs.insertSheet(nomeAba);

  const numCols = headers.length;

  sheet.getRange(1, 1, 1, numCols).setValues([headers]);
  sheet.getRange(2, 1, rows.length, numCols).setValues(rows);

  const headerRange = sheet.getRange(1, 1, 1, numCols);

  headerRange
    .setBackground(COLOR_HEADER_BG)
    .setFontColor(COLOR_HEADER_FONT)
    .setFontWeight("bold");

  const fullRange = sheet.getRange(1, 1, rows.length + 1, numCols);

  fullRange.setBorder(true, true, true, true, true, true, COLOR_BORDER, SpreadsheetApp.BorderStyle.SOLID);

  // Mesma fonte usada na tabela do dashboard/"Copiar tabela"
  // (Arial 8pt).
  fullRange.setFontFamily("Arial").setFontSize(8);

  // Só a coluna "Destaque" (2ª coluna: País, Destaque, Playlist,
  // Link, Artista, Contenido, Gravadora) ganha a cor de
  // Capa/Inclusão/Instagram — igual ao dashboard e à função
  // "Copiar tabela", onde o resto da linha fica branco.
  rows.forEach((row, index) => {

    const tipo = tipos[index];

    const bg = tipo === "CAPA" ? COLOR_CAPA_BG
      : tipo === "INSTAGRAM" ? COLOR_INSTAGRAM_BG
      : COLOR_INCLUSAO_BG;

    sheet.getRange(index + 2, destaqueColIndex + 1, 1, 1).setBackground(bg);

  });

  // Largura fixa (não "encolher pro conteúdo", como autoResizeColumns
  // fazia) pra ficar com mais espaço de leitura, igual ao padrão que
  // já era usado antes de colar direto na planilha da gravadora.
  // A ordem das colunas é sempre a mesma (só muda se tem País/
  // destaqueColIndex=1, ou não/destaqueColIndex=0): [País,] Destaque,
  // Playlist, Link, Artista, Contenido.
  const widthsComPais = [100, 100, 160, 220, 140, 140];
  const widthsSemPais = [100, 160, 220, 140, 140];

  const widths = destaqueColIndex === 1 ? widthsComPais : widthsSemPais;

  widths.forEach((width, index) => {
    if (index < numCols) sheet.setColumnWidth(index + 1, width);
  });

  // Deixa a aba nova em primeiro lugar, mais fácil de achar.
  destSs.setActiveSheet(sheet);
  destSs.moveActiveSheet(1);

  const url = `${destSs.getUrl()}#gid=${sheet.getSheetId()}`;

  return jsonResponse({

    success: true,

    url

  });

}

/**
 * Tira o ID da planilha de uma URL do Google Sheets (o trecho
 * entre "/d/" e a próxima "/").
 */
function extractSpreadsheetId(url) {

  const match = String(url || "").match(/\/d\/([a-zA-Z0-9-_]+)/);

  return match ? match[1] : "";

}

function jsonResponse(obj) {

  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);

}
