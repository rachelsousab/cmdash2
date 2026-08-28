/**
 * ============================================================
 * INSTAGRAM CMBR — SINCRONIZAÇÃO + WEB APP (edição manual)
 * ------------------------------------------------------------
 * Este arquivo é o SEU Code.gs original (atualizarDadosInstagram,
 * intacto) + uma coisa nova, adicionada no fim:
 *
 * Um doPost/doGet (Web App) pra receber as edições feitas
 * direto na tabela "Informações faltantes" do dashboard — mesmo
 * padrão do Canal 500 e Ações Manuais: token simples, acha a
 * linha pelo Post_ID, sobrescreve só o campo editado.
 *
 * ------------------------------------------------------------
 * SOBRE O RESUMO DA AÇÃO:
 * Chegamos a tentar gerar o Resumo automaticamente por IA (pela
 * fórmula =AI(...) do Sheets, e depois por chamada direta à API
 * do Gemini). Nenhuma das duas funciona: a fórmula não é
 * calculada quando escrita via script, e a chamada direta
 * precisa de uma chave do AI Studio, que está bloqueada pela
 * política do Workspace da Claro. Por isso o Resumo voltou a
 * ser um campo manual comum, preenchido direto na tabela
 * "Informações faltantes" do dashboard — igual Formato,
 * Responsável, Gravadora etc.
 *
 * IMPORTANTE: troque ACCESS_TOKEN pelo token de verdade (já
 * estava assim no seu script original) e ajuste SHARED_SECRET
 * se quiser um valor diferente do sugerido abaixo — só lembre
 * de usar o MESMO valor em CONFIG.SOCIAL_FORM.sharedSecret no
 * config.js do dashboard.
 * ============================================================
 */

const ACCESS_TOKEN = 'meu_token_aqui';
const SHEET_NAME = 'DADOS - INSTAGRAM CMBR - API';

function atualizarDadosInstagram() {

  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const sheet =
    ss.getSheetByName(SHEET_NAME) ||
    ss.insertSheet(SHEET_NAME);

  //---------------------------------------------------------
  // Cabeçalho
  //---------------------------------------------------------

  const headers = [

    "Formato",
    "Tipo",
    "Post_ID",
    "Data",
    "Resumo da ação",
    "Responsável",
    "Gravadora",
    "Collab",
    "Gênero",

    "Curtidas",
    "Comentários",
    "Reposts",
    "Compartilhamentos",
    "Salvamentos",
    "Visualizações",
    "Alcance",
    "Começaram a seguir",
    "Interações",

    "Link",
    "Legenda"

  ];

  if (sheet.getLastRow() === 0) {

    sheet.appendRow(headers);

  }

  //---------------------------------------------------------
  // Índice dos posts existentes
  //---------------------------------------------------------

  const values = sheet.getDataRange().getValues();

  const indexMap = new Map();

  for (let i = 1; i < values.length; i++) {

    const id = values[i][2];

    if (id) {

      indexMap.set(id, i + 1);

    }

  }

  //---------------------------------------------------------
  // Busca todos os posts
  //---------------------------------------------------------

  let mediaUrl =
    `https://graph.instagram.com/me/media` +
    `?fields=id,caption,media_type,timestamp,permalink` +
    `&access_token=${ACCESS_TOKEN}&limit=100`;

  let posts = [];

  while (mediaUrl) {

    const response = UrlFetchApp.fetch(mediaUrl);

    const data = JSON.parse(response.getContentText());

    if (!data.data) {

      Logger.log(response.getContentText());

      return;

    }

    posts = posts.concat(data.data);

    mediaUrl =
      data.paging && data.paging.next
        ? data.paging.next
        : null;

  }

  //---------------------------------------------------------
  // Ordena do mais antigo para o mais recente
  //---------------------------------------------------------

  posts.sort((a, b) => {

    return new Date(a.timestamp) - new Date(b.timestamp);

  });

  //---------------------------------------------------------
  // Processa posts
  //---------------------------------------------------------

  posts.forEach(post => {

    //-------------------------------------------------------
    // Apenas 2026
    //-------------------------------------------------------

    const ano = new Date(post.timestamp).getFullYear();

    if (ano !== 2026) {

      return;

    }

    //-------------------------------------------------------
    // Busca Insights
    //-------------------------------------------------------

    const insightsUrl =
      `https://graph.instagram.com/${post.id}/insights` +
      `?metric=likes,comments,shares,saved,views,reach,total_interactions` +
      `&access_token=${ACCESS_TOKEN}`;

    const insightsResp =
      UrlFetchApp.fetch(insightsUrl);

    const insights =
      JSON.parse(insightsResp.getContentText());

    const m = {};

    if (insights.data) {

      insights.data.forEach(metric => {

        m[metric.name] =
          metric.values[0].value;

      });

    }

    //-------------------------------------------------------
    // Já existe?
    //-------------------------------------------------------

    const row =
      indexMap.get(post.id);

    //-------------------------------------------------------
    // Novo post
    //-------------------------------------------------------

    if (!row) {

      sheet.appendRow([

        "", // Formato
        "", // Tipo

        post.id,

        new Date(post.timestamp),

        "", // Resumo da ação — preenchido manualmente no dashboard

        "", // Responsável
        "", // Gravadora
        "", // Collab
        "", // Gênero

        m.likes || 0,
        m.comments || 0,

        "", // Reposts

        m.shares || 0,
        m.saved || 0,
        m.views || 0,
        m.reach || 0,

        "", // Começaram a seguir

        m.total_interactions || 0,

        post.permalink || "",

        post.caption || ""

      ]);

      const novaLinha = sheet.getLastRow();

      //-----------------------------------------------------
      // Formata a data
      //-----------------------------------------------------

      sheet
        .getRange(novaLinha, 4)
        .setNumberFormat("dd/MM/yyyy");

    }

    //-------------------------------------------------------
    // Atualiza post existente
    //-------------------------------------------------------

    else {

      sheet
        .getRange(row, 4)
        .setValue(new Date(post.timestamp))
        .setNumberFormat("dd/MM/yyyy");

      sheet.getRange(row, 10).setValue(m.likes || 0);

      sheet.getRange(row, 11).setValue(m.comments || 0);

      sheet.getRange(row, 13).setValue(m.shares || 0);

      sheet.getRange(row, 14).setValue(m.saved || 0);

      sheet.getRange(row, 15).setValue(m.views || 0);

      sheet.getRange(row, 16).setValue(m.reach || 0);

      sheet.getRange(row, 18).setValue(
        m.total_interactions || 0
      );

      sheet.getRange(row, 19).setValue(
        post.permalink || ""
      );

      sheet.getRange(row, 20).setValue(
        post.caption || ""
      );

    }

  });

  Logger.log("Sincronização concluída.");

}

/**
 * ============================================================
 * WEB APP — edição manual pelo dashboard (Redes Sociais →
 * "Informações faltantes")
 * ============================================================
 */

// Mesmo valor precisa estar em CONFIG.SOCIAL_FORM.sharedSecret
// no config.js do dashboard.
const SHARED_SECRET = "DashCM2026SocialRachel";

// Colunas da aba (1-indexado) — mesma ordem do cabeçalho.
const COL = {
  FORMATO: 1,
  TIPO: 2,
  POST_ID: 3,
  DATA: 4,
  RESUMO: 5,
  RESPONSAVEL: 6,
  GRAVADORA: 7,
  COLLAB: 8,
  GENERO: 9,
  CURTIDAS: 10,
  COMENTARIOS: 11,
  REPOSTS: 12,
  COMPARTILHAMENTOS: 13,
  SALVAMENTOS: 14,
  VISUALIZACOES: 15,
  ALCANCE: 16,
  SEGUIDORES: 17,
  INTERACOES: 18,
  LINK: 19,
  LEGENDA: 20
};

// Campo (nome usado pelo dashboard) -> coluna da planilha.
const FIELD_TO_COL = {
  formato: COL.FORMATO,
  tipo: COL.TIPO,
  resumo: COL.RESUMO,
  responsavel: COL.RESPONSAVEL,
  gravadora: COL.GRAVADORA,
  collab: COL.COLLAB,
  genero: COL.GENERO,
  reposts: COL.REPOSTS,
  seguidores: COL.SEGUIDORES
};

function doPost(e) {

  try {

    const payload = JSON.parse(e.postData.contents);

    if (payload.token !== SHARED_SECRET) {
      return jsonResponse({ success: false, errors: ["Não autorizado."] });
    }

    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);

    if (payload.mode === "updateField") {
      return handleUpdateField(sheet, payload);
    }

    return jsonResponse({ success: false, errors: ["Modo desconhecido."] });

  } catch (error) {

    return jsonResponse({ success: false, errors: [String(error)] });

  }

}

/* ============================================
   ATUALIZAR UM CAMPO MANUAL (Formato, Tipo,
   Resumo, Responsável, Gravadora, Collab,
   Gênero, Reposts, Começaram a seguir)
============================================ */

function handleUpdateField(sheet, payload) {

  if (!payload.postId) {
    return jsonResponse({ success: false, errors: ["Nenhum Post_ID informado."] });
  }

  const col = FIELD_TO_COL[payload.field];

  if (!col) {
    return jsonResponse({ success: false, errors: [`Campo desconhecido: ${payload.field}`] });
  }

  const row = findRowByPostId(sheet, payload.postId);

  if (!row) {
    return jsonResponse({ success: false, errors: [`Nenhuma linha encontrada com Post_ID ${payload.postId}.`] });
  }

  sheet.getRange(row, col).setValue(payload.value);

  return jsonResponse({ success: true, postId: payload.postId });

}

/**
 * Acha a linha (1-indexada, pronta pra getRange) cujo Post_ID
 * (coluna 3) bate com o postId passado. Retorna null se não achar.
 */
function findRowByPostId(sheet, postId) {

  const lastRow = sheet.getLastRow();

  if (lastRow < 2) return null;

  const ids = sheet.getRange(2, COL.POST_ID, lastRow - 1, 1).getValues();

  for (let i = 0; i < ids.length; i++) {

    if (String(ids[i][0]).trim() === String(postId).trim()) {
      return i + 2;
    }

  }

  return null;

}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// Abrir a URL do Web App direto no navegador deve responder
// isso — confirma que o deploy está no ar.
function doGet() {
  return jsonResponse({ status: "online", sheet: SHEET_NAME });
}
