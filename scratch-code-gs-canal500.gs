/**
 * ============================================================
 * DASHBOARD CM — CANAL 500 (Apps Script Web App)
 * ------------------------------------------------------------
 * Recebe submissões de "Registrar envio" e "Enviar evidência"
 * do dashboard e grava/atualiza na aba do Canal 500 desta
 * planilha. Sobe evidências (imagens) pra uma pasta do Drive e
 * grava os links no campo "Evidências".
 *
 * IMPORTANTE — colunas da aba:
 * As 55 linhas já existentes (preenchidas à mão) têm 12
 * colunas: Ação Prospectada, Artistas, Parceiro, Gênero,
 * Status, Entrada, Saída, Status de Veiculação, Responsável,
 * Programa (em caso de inclusão em programa), Comentários,
 * Evidências.
 *
 * Pra não mexer nessas 55 linhas, o ID e o Timestamp de criação
 * entram como colunas NOVAS NO FIM (13 e 14) — só preenchidas
 * a partir de agora, pelas linhas criadas por este script.
 * Antes de usar, adicione 2 colunas no fim da planilha:
 * "ID" (coluna M) e "Timestamp de criação" (coluna N).
 *
 * MODOS (payload.mode):
 * - ausente/"create" (padrão): cria uma linha nova, com Status
 *   sempre "Entregue" (automático, não vem do formulário),
 *   ID novo (UUID) e Timestamp de criação = agora.
 * - "attachEvidence": ACRESCENTA evidência (texto/imagens) na
 *   linha existente cujo ID bate com payload.id — não
 *   sobrescreve a evidência que já estava lá, só complementa.
 * - "update": sobrescreve todos os campos editáveis da linha
 *   existente cujo ID bate com payload.id.
 * - "updateStatus": troca só o Status de Veiculação da linha
 *   existente cujo ID bate com payload.id.
 * - "delete": apaga (DELETA a linha inteira, deslocando as de
 *   baixo pra cima) a linha existente cujo ID bate com
 *   payload.id — usado pelo botão 🗑️ da tabela, pra não
 *   precisar apagar manualmente na planilha.
 * ============================================================
 */

const SHEET_NAME = "Canal 500"; // ajuste pro nome real da aba
const EVIDENCE_FOLDER_ID = "1h9FP1Bzwb6B8AUvj2J_VIHymNk5KF85_";
const MAX_IMAGES = 3;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5MB

// Mesmo valor precisa estar em CONFIG.CANAL500_FORM.sharedSecret
// no config.js do dashboard — não é segurança de verdade, só um
// filtro contra acesso casual.
const SHARED_SECRET = "DashCM2026Canal500Rachel";

const REQUIRED_FIELDS = [
  "acaoProspectada", "artistas", "parceiro", "genero",
  "entrada", "saida", "statusVeiculacao", "responsavel"
];

// Ordem das colunas na aba (1-indexado).
const COL = {
  ACAO_PROSPECTADA: 1,
  ARTISTAS: 2,
  PARCEIRO: 3,
  GENERO: 4,
  STATUS: 5,
  ENTRADA: 6,
  SAIDA: 7,
  STATUS_VEICULACAO: 8,
  RESPONSAVEL: 9,
  PROGRAMA: 10,
  COMENTARIOS: 11,
  EVIDENCIAS: 12,
  ID: 13,
  TIMESTAMP: 14
};

function doPost(e) {

  try {

    const payload = JSON.parse(e.postData.contents);

    if (payload.token !== SHARED_SECRET) {
      return jsonResponse({ success: false, errors: ["Não autorizado."] });
    }

    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);

    if (payload.mode === "attachEvidence") {
      return handleAttachEvidence(sheet, payload);
    }

    if (payload.mode === "updateStatus") {
      return handleUpdateStatus(sheet, payload);
    }

    if (payload.mode === "update") {
      return handleUpdate(sheet, payload);
    }

    if (payload.mode === "delete") {
      return handleDelete(sheet, payload);
    }

    return handleCreate(sheet, payload);

  } catch (error) {

    return jsonResponse({ success: false, errors: [String(error)] });

  }

}

/* ============================================
   CRIAR NOVA LINHA ("Registrar envio")
============================================ */

function handleCreate(sheet, payload) {

  const errors = validatePayload(payload);

  if (errors.length) {
    return jsonResponse({ success: false, errors: errors });
  }

  const evidenceLinks = uploadEvidenceImages(payload.imagens || []);

  const evidenciasFinal = [payload.evidenciasTexto || "", ...evidenceLinks]
    .filter(Boolean)
    .join("\n");

  const id = Utilities.getUuid();

  sheet.appendRow([
    payload.acaoProspectada,
    payload.artistas,
    payload.parceiro,
    payload.genero,
    "Entregue", // Status é sempre automático, nunca vem do formulário
    payload.entrada,
    payload.saida,
    payload.statusVeiculacao,
    joinMulti(payload.responsavel),
    payload.programa || "",
    payload.comentarios || "",
    evidenciasFinal,
    id,
    new Date()
  ]);

  return jsonResponse({ success: true, id: id });

}

/* ============================================
   ANEXAR EVIDÊNCIA EM LINHA EXISTENTE
============================================ */

function handleAttachEvidence(sheet, payload) {

  if (!payload.id) {
    return jsonResponse({ success: false, errors: ["Nenhum ID informado."] });
  }

  const rowIndex = findRowById(sheet, payload.id);

  if (!rowIndex) {
    return jsonResponse({ success: false, errors: [`Nenhuma linha encontrada com ID ${payload.id}.`] });
  }

  if (Array.isArray(payload.imagens) && payload.imagens.length > MAX_IMAGES) {
    return jsonResponse({ success: false, errors: [`Máximo de ${MAX_IMAGES} imagens por envio.`] });
  }

  const evidenceLinks = uploadEvidenceImages(payload.imagens || []);

  const novaEvidencia = [payload.evidenciasTexto || "", ...evidenceLinks]
    .filter(Boolean)
    .join("\n");

  if (!novaEvidencia) {
    return jsonResponse({ success: false, errors: ["Nenhuma evidência enviada."] });
  }

  const cell = sheet.getRange(rowIndex, COL.EVIDENCIAS);
  const existente = cell.getValue();

  // ACRESCENTA — não apaga a evidência que já estava na linha.
  cell.setValue(existente ? `${existente}\n${novaEvidencia}` : novaEvidencia);

  return jsonResponse({ success: true, id: payload.id });

}

/* ============================================
   EDITAR LINHA EXISTENTE (botão "Editar" da tabela)
   Sobrescreve todos os campos editáveis da linha. Imagens
   anexadas aqui são NOVAS evidências e entram concatenadas
   junto com o texto de evidência (que já vem com o histórico
   anterior, porque o formulário abre pré-preenchido).
============================================ */

function handleUpdate(sheet, payload) {

  if (!payload.id) {
    return jsonResponse({ success: false, errors: ["Nenhum ID informado."] });
  }

  const rowIndex = findRowById(sheet, payload.id);

  if (!rowIndex) {
    return jsonResponse({ success: false, errors: [`Nenhuma linha encontrada com ID ${payload.id}.`] });
  }

  const errors = validatePayload(payload);

  if (errors.length) {
    return jsonResponse({ success: false, errors: errors });
  }

  const evidenceLinks = uploadEvidenceImages(payload.imagens || []);

  const evidenciasFinal = [payload.evidenciasTexto || "", ...evidenceLinks]
    .filter(Boolean)
    .join("\n");

  sheet.getRange(rowIndex, COL.ACAO_PROSPECTADA, 1, COL.EVIDENCIAS - COL.ACAO_PROSPECTADA + 1).setValues([[
    payload.acaoProspectada,
    payload.artistas,
    payload.parceiro,
    payload.genero,
    "Entregue", // Status continua automático
    payload.entrada,
    payload.saida,
    payload.statusVeiculacao,
    joinMulti(payload.responsavel),
    payload.programa || "",
    payload.comentarios || "",
    evidenciasFinal
  ]]);

  return jsonResponse({ success: true, id: payload.id });

}

/* ============================================
   ATUALIZAR STATUS DE VEICULAÇÃO
============================================ */

function handleUpdateStatus(sheet, payload) {

  if (!payload.id) {
    return jsonResponse({ success: false, errors: ["Nenhum ID informado."] });
  }

  if (!payload.statusVeiculacao) {
    return jsonResponse({ success: false, errors: ["Nenhum status informado."] });
  }

  const rowIndex = findRowById(sheet, payload.id);

  if (!rowIndex) {
    return jsonResponse({ success: false, errors: [`Nenhuma linha encontrada com ID ${payload.id}.`] });
  }

  sheet.getRange(rowIndex, COL.STATUS_VEICULACAO).setValue(payload.statusVeiculacao);

  return jsonResponse({ success: true, id: payload.id });

}

/* ============================================
   EXCLUIR LINHA EXISTENTE (botão 🗑️ da tabela)
   Só apaga linhas com ID real (criadas/editadas por este
   script) — não tem como localizar com segurança as 55 linhas
   antigas sem ID por aqui, então elas continuam exigindo
   exclusão manual mesmo.
============================================ */

function handleDelete(sheet, payload) {

  if (!payload.id) {
    return jsonResponse({ success: false, errors: ["Nenhum ID informado."] });
  }

  const rowIndex = findRowById(sheet, payload.id);

  if (!rowIndex) {
    return jsonResponse({ success: false, errors: [`Nenhuma linha encontrada com ID ${payload.id}.`] });
  }

  sheet.deleteRow(rowIndex);

  return jsonResponse({ success: true, id: payload.id });

}

/**
 * Acha a linha (1-indexada, pronta pra getRange) cujo ID
 * (coluna 13) bate com o id passado. Retorna null se não achar.
 */
function findRowById(sheet, id) {

  const lastRow = sheet.getLastRow();

  if (lastRow < 2) return null;

  const ids = sheet.getRange(2, COL.ID, lastRow - 1, 1).getValues();

  for (let i = 0; i < ids.length; i++) {

    if (String(ids[i][0]).trim() === String(id).trim()) {
      return i + 2;
    }

  }

  return null;

}

function validatePayload(payload) {

  const errors = [];

  REQUIRED_FIELDS.forEach(field => {

    const value = payload[field];
    const isEmpty = value === undefined || value === null || value === "" ||
      (Array.isArray(value) && value.length === 0);

    if (isEmpty) errors.push(`Campo obrigatório ausente: ${field}`);

  });

  const hasEvidencia = (payload.evidenciasTexto && payload.evidenciasTexto.trim()) ||
    (Array.isArray(payload.imagens) && payload.imagens.length > 0);

  if (!hasEvidencia) errors.push("Inclua ao menos uma evidência (texto ou imagem).");

  if (Array.isArray(payload.imagens) && payload.imagens.length > MAX_IMAGES) {
    errors.push(`Máximo de ${MAX_IMAGES} imagens por envio.`);
  }

  return errors;

}

function uploadEvidenceImages(imagens) {

  // Sem imagem nenhuma, nem tenta acessar o Drive — é isso que
  // travava (e estourava o tempo máximo de execução) até em
  // envios só com texto, que não precisavam do Drive pra nada.
  if (!imagens || !imagens.length) return [];

  const folder = DriveApp.getFolderById(EVIDENCE_FOLDER_ID);

  return imagens.slice(0, MAX_IMAGES).map(img => {

    const bytes = Utilities.base64Decode(img.base64);

    if (bytes.length > MAX_IMAGE_BYTES) {
      throw new Error(`Imagem "${img.filename}" excede 5MB.`);
    }

    const blob = Utilities.newBlob(bytes, img.mimeType, img.filename);
    const file = folder.createFile(blob);

    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    return file.getUrl();

  });

}

function joinMulti(value) {
  return Array.isArray(value) ? value.join(", ") : (value || "");
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
