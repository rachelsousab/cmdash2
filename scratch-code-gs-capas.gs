/**
 * ============================================================
 * CAPAS DE PLAYLIST — busca automática no Drive
 * ------------------------------------------------------------
 * Varre "DESTAQUES EDITORIAIS CM - 2026" (ano > mês > semana >
 * país) e casa cada arquivo de capa com a linha correspondente
 * na planilha de Destaques, escrevendo o link numa coluna nova.
 *
 * LÓGICA DE GRUPO: alguns países sempre compartilham a mesma
 * capa (ex.: Argentina/Paraguay/Uruguay). Por isso a busca no
 * Drive acontece por GRUPO + Semana + Playlist — uma única vez
 * por combinação — e o resultado (link + confirmação de artista)
 * é REPLICADO pra todas as linhas de todos os países daquele
 * grupo que batem a mesma semana/playlist. Não tenta achar a
 * pasta de "Paraguay" ou "Uruguay" isoladas — elas não existem,
 * é sempre a pasta do grupo inteiro (ex.: "AR, PY, UY").
 *
 * CHAVE DE CASAMENTO: Grupo + Playlist + Semana (não o Artista —
 * essa combinação já é única por natureza). O Artista é usado só
 * como conferência: se bater, sai "Confirmado"; se não bater
 * (grafia diferente etc.), o link ainda é escrito, mas com aviso
 * "Confira manualmente".
 *
 * TESTE ATUAL: script limitado a Argentina/Paraguay/Uruguay via
 * TEST_COUNTRIES logo abaixo. Pra rodar geral depois, é só
 * esvaziar essa lista.
 *
 * PERFORMANCE: buscarCapas() varre a aba inteira de Destaques
 * (dezenas de milhares de linhas). Pra evitar reprocessar tudo
 * toda vez, FILTRAR_SOMENTE_RECENTES (logo abaixo) limita a
 * varredura só às linhas cuja Data/semana caiu nos últimos
 * DIAS_JANELA dias. Desative (false) só se precisar rodar a
 * base toda de novo (ex.: primeira carga, ou reprocessar algo
 * antigo).
 * ============================================================
 */

// --------------------------------------------------------
// CONFIGURAR AQUI antes de rodar
// --------------------------------------------------------

// Deixe só os países já padronizados. Esvazie ([]) pra rodar
// geral, quando o resto também estiver padronizado.
const TEST_COUNTRIES = ["Argentina", "Paraguay", "Uruguay", "Colombia", "Ecuador"];

// true = só processa linhas cuja Data/semana caiu nos últimos
// DIAS_JANELA dias (evita reprocessar as ~50 mil linhas
// históricas toda vez — só a semana recente importa no dia a
// dia). false = roda a planilha inteira, como antes (útil pra
// rodar geral uma vez, ou reprocessar algo antigo).
const FILTRAR_SOMENTE_RECENTES = true;

const DIAS_JANELA = 7;

const SHEET_NAME = "Destaques"; // AJUSTAR: nome real da aba na planilha de Destaques

const COL = {
  PAIS: 1,          // A — País
  DESTAQUE: 2,       // B — Destaque (CAPA/INCLUSÃO/INSTAGRAM)
  PLAYLIST: 3,       // C — Playlist
  ARTIST: 5,         // E — Artist
  DATA_SEMANA: 8,    // H — Data/semana

  LINK_CAPA: 11,     // K — coluna NOVA: link do Drive
  STATUS_CAPA: 12    // L — coluna NOVA: status do casamento
};

const ROOT_FOLDER_NAME = "DESTAQUES EDITORIAIS CM - 2026";

// País (como aparece na planilha) -> GRUPO fixo que compartilha
// a mesma capa. Mesma tabela "Códigos País" que você já tem no
// Sheets — se a Claro mudar os agrupamentos, o ajuste é só aqui.
const COUNTRY_GROUPS = {
  "Argentina": "AR, PY, UY",
  "Paraguay": "AR, PY, UY",
  "Uruguay": "AR, PY, UY",

  "Brasil": "BR",
  "Chile": "CL",
  "Colombia": "CO",

  "Costa Rica": "CR, NI, DO",
  "Nicaragua": "CR, NI, DO",
  "R. Dominicana": "CR, NI, DO",

  "Ecuador": "EC",

  "El Salvador": "GT, SV, HN",
  "Guatemala": "GT, SV, HN",
  "Honduras": "GT, SV, HN",

  "Peru": "PE"
};

/**
 * Tira acento, deixa minúsculo, colapsa espaços — pra comparar
 * "Novidades Gospel" com "novidades  gospel" sem falso negativo.
 */
function normalize(text) {

  return String(text || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

}

/**
 * Converte o valor da célula "Data/semana" (Date de verdade ou
 * texto "dd/mm/aaaa") sempre pra "dd/mm/aaaa" em string — evita
 * o problema de "new Date('14/08/2026')" ser interpretado de
 * forma ambígua (mês/dia trocados) pelo motor do Apps Script.
 */
function toDataSemanaStr(value) {

  if (Object.prototype.toString.call(value) === "[object Date]") {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), "dd/MM/yyyy");
  }

  const text = String(value || "").trim();
  const partes = text.split("/");

  if (partes.length !== 3) return text;

  const dia = partes[0].padStart(2, "0");
  const mes = partes[1].padStart(2, "0");
  const ano = partes[2];

  return `${dia}/${mes}/${ano}`;

}

/**
 * Converte o valor da célula "Data/semana" (Date de verdade ou
 * texto "dd/mm/aaaa") num objeto Date real, pra dar pra comparar
 * com "hoje". Usado só pelo filtro FILTRAR_SOMENTE_RECENTES —
 * se não der pra entender a célula, retorna null (a linha não é
 * pulada nesse caso, pra não arriscar sumir com dado válido).
 */
function parseDataSemanaCelula(value) {

  if (Object.prototype.toString.call(value) === "[object Date]") {
    return value;
  }

  const text = String(value || "").trim();
  const partes = text.split("/");

  if (partes.length !== 3) return null;

  const dia = Number(partes[0]);
  const mes = Number(partes[1]);
  const ano = Number(partes[2]);

  if (!dia || !mes || !ano) return null;

  return new Date(ano, mes - 1, dia);

}

/**
 * true se "data" caiu nos últimos "dias" dias contando de hoje
 * (inclui hoje; não exige saber o dia exato da semana/sexta).
 */
function isDataRecente(data, dias) {

  const hoje = new Date();
  const limite = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - dias);

  return data.getTime() >= limite.getTime();

}

/**
 * Acha a pasta da semana (ano > mês > semana) a partir da data.
 * A pasta do mês pode se chamar "08 - AGOSTO" — casamos pelo
 * prefixo numérico, não pelo nome inteiro (mais tolerante).
 */
function findWeekFolder(rootFolder, dataSemanaStr) {

  const partes = dataSemanaStr.split("/");

  if (partes.length !== 3) return null;

  const [dia, mes, ano] = partes;

  const yearFolders = rootFolder.getFoldersByName(ano);

  if (!yearFolders.hasNext()) return null;

  const yearFolder = yearFolders.next();

  let monthFolder = null;

  const monthIter = yearFolder.getFolders();

  while (monthIter.hasNext()) {

    const f = monthIter.next();

    if (f.getName().indexOf(mes + " - ") === 0) {
      monthFolder = f;
      break;
    }

  }

  if (!monthFolder) return null;

  const weekFolders = monthFolder.getFoldersByName(dataSemanaStr);

  if (!weekFolders.hasNext()) return null;

  return weekFolders.next();

}

// Alguns países têm grafia diferente entre a planilha de
// Destaques (normalmente em espanhol/inglês, ex.: "Ecuador") e as
// pastas do Drive (às vezes em português, ex.: "EQUADOR"). Só usado
// pra ACHAR a pasta certa — não muda o valor da coluna "País".
const COUNTRY_NAME_ALIASES = {
  "Ecuador": ["Equador"]
};

/**
 * Todos os países (nome completo) que pertencem a um grupo —
 * usado como fallback pra casar pastas nomeadas por extenso
 * (ex.: "ARGENTINA, PARAGUAY, URUGUAY" em vez de "AR, PY, UY"),
 * incluindo grafias alternativas (COUNTRY_NAME_ALIASES acima).
 */
function getGroupCountryNames(grupo) {

  const nomes = Object.keys(COUNTRY_GROUPS).filter(k => COUNTRY_GROUPS[k] === grupo);

  const aliases = nomes.reduce((acc, nome) => acc.concat(COUNTRY_NAME_ALIASES[nome] || []), []);

  return nomes.concat(aliases);

}

/**
 * Uma pasta "cobre" um grupo se o nome dela contiver QUALQUER
 * um dos códigos do grupo OU o nome completo de qualquer país
 * do grupo — não precisa ter todos, só precisa bater pelo menos
 * um, já que é sempre a MESMA pasta pro grupo inteiro.
 */
function folderCoversGroup(folderName, groupCodesArr, groupCountryNames) {

  const nome = normalize(folderName);
  const tokens = nome.split(" ").filter(Boolean);

  const codeMatch = groupCodesArr.some(codigo => tokens.includes(codigo.toLowerCase()));

  const nameMatch = groupCountryNames.some(nomePais => nome.indexOf(normalize(nomePais)) !== -1);

  return codeMatch || nameMatch;

}

function findGroupFolders(weekFolder, groupCodesArr, groupCountryNames) {

  const matches = [];
  const todosOsNomes = [];

  const iter = weekFolder.getFolders();

  while (iter.hasNext()) {

    const f = iter.next();

    todosOsNomes.push(f.getName());

    if (folderCoversGroup(f.getName(), groupCodesArr, groupCountryNames)) {
      matches.push(f);
    }

  }

  return { matches, todosOsNomes };

}

/**
 * Faz o parse de um nome de arquivo no padrão "PAÍS(ES) -
 * Playlist - Artista.jpg" (artista é opcional — 2 ou 3 blocos).
 * Retorna null se o arquivo não seguir o padrão.
 */
function parseStandardFilename(filename) {

  const base = filename.replace(/\.[a-zA-Z]+$/, "");

  const parts = base.split(" - ").map(p => p.trim()).filter(Boolean);

  if (parts.length < 2) return null;

  return {
    playlist: parts[1],
    artist: parts[2] || ""
  };

}

/**
 * Procura, dentro das pastas do grupo já filtradas, um arquivo
 * de imagem cujo Playlist (normalizado) bata com o pedido.
 * Retorna { file, parsedArtist } ou null. Não recebe Artista —
 * a conferência de artista é feita depois, por linha, em cima
 * do resultado já encontrado (assim um mesmo arquivo encontrado
 * uma vez serve pra conferir o artista de várias linhas
 * diferentes do mesmo grupo).
 */
function findCoverFile(groupFolders, playlist) {

  const playlistNorm = normalize(playlist);

  for (const folder of groupFolders) {

    const iter = folder.getFiles();

    while (iter.hasNext()) {

      const file = iter.next();

      if (file.getMimeType().indexOf("image/") !== 0) continue;

      const parsed = parseStandardFilename(file.getName());

      if (!parsed) continue;

      if (normalize(parsed.playlist) === playlistNorm) {
        return { file, parsedArtist: parsed.artist };
      }

    }

  }

  return null;

}

/**
 * ============================================================
 * FUNÇÃO PRINCIPAL — roda sobre a planilha de Destaques e
 * escreve Link + Status numa coluna nova, ao lado de cada linha
 * de CAPA (respeitando TEST_COUNTRIES, se estiver preenchido).
 *
 * A busca no Drive acontece só UMA VEZ por combinação de
 * Grupo + Semana + Playlist (cache); o resultado é replicado
 * pra todas as linhas que caem nessa mesma combinação, seja
 * qual for o país individual da linha.
 * ============================================================
 */
function buscarCapas() {

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAME);

  if (!sheet) {
    throw new Error(`Aba "${SHEET_NAME}" não encontrada — ajuste a constante SHEET_NAME no topo do script.`);
  }

  const rootFolders = DriveApp.getFoldersByName(ROOT_FOLDER_NAME);

  if (!rootFolders.hasNext()) {
    throw new Error(`Pasta raiz "${ROOT_FOLDER_NAME}" não encontrada (confira se está em "Compartilhados comigo" na mesma conta que roda o script).`);
  }

  const rootFolder = rootFolders.next();

  const values = sheet.getDataRange().getValues();

  const weekFolderCache = new Map();     // semana -> pasta da semana
  const groupFolderCache = new Map();    // semana|grupo -> pastas do grupo
  const coverCache = new Map();          // semana|grupo|playlist -> { file, parsedArtist } | null

  let processadas = 0;
  let confirmadas = 0;
  let conferir = 0;
  let naoEncontradas = 0;

  let debugPastaCount = 0;
  let debugArquivoCount = 0;
  const DEBUG_LIMIT = 3;

  for (let row = 1; row < values.length; row++) {

    const destaque = values[row][COL.DESTAQUE - 1];

    if (destaque !== "CAPA") continue;

    const pais = values[row][COL.PAIS - 1];

    if (TEST_COUNTRIES.length && TEST_COUNTRIES.indexOf(pais) === -1) continue;

    if (FILTRAR_SOMENTE_RECENTES) {

      const dataSemanaRow = parseDataSemanaCelula(values[row][COL.DATA_SEMANA - 1]);

      if (dataSemanaRow && !isDataRecente(dataSemanaRow, DIAS_JANELA)) continue;

    }

    const grupo = COUNTRY_GROUPS[pais];

    if (!grupo) {
      sheet.getRange(row + 1, COL.STATUS_CAPA).setValue("País sem grupo configurado no script");
      naoEncontradas++;
      continue;
    }

    processadas++;

    const playlist = values[row][COL.PLAYLIST - 1];
    const artist = values[row][COL.ARTIST - 1];
    const dataSemanaStr = toDataSemanaStr(values[row][COL.DATA_SEMANA - 1]);

    // -------- pasta da semana --------

    let weekFolder = weekFolderCache.get(dataSemanaStr);

    if (weekFolder === undefined) {
      weekFolder = findWeekFolder(rootFolder, dataSemanaStr);
      weekFolderCache.set(dataSemanaStr, weekFolder);
    }

    if (!weekFolder) {
      sheet.getRange(row + 1, COL.STATUS_CAPA).setValue("Semana não encontrada no Drive");
      naoEncontradas++;
      continue;
    }

    // -------- pasta(s) do grupo, dentro da semana --------

    const groupCacheKey = dataSemanaStr + "|" + grupo;

    let groupFolders = groupFolderCache.get(groupCacheKey);

    if (groupFolders === undefined) {

      const groupCodesArr = grupo.split(",").map(c => c.trim());
      const groupCountryNames = getGroupCountryNames(grupo);

      const resultado = findGroupFolders(weekFolder, groupCodesArr, groupCountryNames);

      groupFolders = resultado.matches;
      groupFolderCache.set(groupCacheKey, groupFolders);

      if (!groupFolders.length && debugPastaCount < DEBUG_LIMIT) {
        Logger.log(
          `[DEBUG pasta do grupo] Semana ${dataSemanaStr}, grupo "${grupo}" — pastas encontradas dentro da semana: ${JSON.stringify(resultado.todosOsNomes)}`
        );
        debugPastaCount++;
      }

    }

    if (!groupFolders.length) {
      sheet.getRange(row + 1, COL.STATUS_CAPA).setValue("Pasta do grupo não encontrada");
      naoEncontradas++;
      continue;
    }

    // -------- arquivo da capa, dentro da(s) pasta(s) do grupo --------
    // (cacheado por grupo+semana+playlist — é aqui que o resultado
    // achado pra Argentina é reaproveitado/replicado pras linhas
    // de Paraguay e Uruguay da mesma semana/playlist)

    const coverCacheKey = groupCacheKey + "|" + normalize(playlist);

    let cover = coverCache.get(coverCacheKey);

    if (cover === undefined) {

      cover = findCoverFile(groupFolders, playlist);
      coverCache.set(coverCacheKey, cover);

      if (!cover && debugArquivoCount < DEBUG_LIMIT) {

        const nomesArquivos = [];

        groupFolders.forEach(folder => {
          const iter = folder.getFiles();
          while (iter.hasNext()) nomesArquivos.push(iter.next().getName());
        });

        Logger.log(
          `[DEBUG arquivo] Playlist procurada: "${playlist}" | Semana ${dataSemanaStr} | grupo "${grupo}" — arquivos encontrados na pasta: ${JSON.stringify(nomesArquivos)}`
        );

        debugArquivoCount++;

      }

    }

    if (!cover) {
      sheet.getRange(row + 1, COL.STATUS_CAPA).setValue("Capa não encontrada automaticamente");
      naoEncontradas++;
      continue;
    }

    sheet.getRange(row + 1, COL.LINK_CAPA).setValue(cover.file.getUrl());

    const artistConfirmed = normalize(artist)
      ? normalize(artist) === normalize(cover.parsedArtist)
      : true;

    if (artistConfirmed) {
      sheet.getRange(row + 1, COL.STATUS_CAPA).setValue("Confirmado");
      confirmadas++;
    } else {
      sheet.getRange(row + 1, COL.STATUS_CAPA).setValue("Confira manualmente (artista não bateu)");
      conferir++;
    }

  }

  Logger.log(
    `Concluído. Linhas de CAPA processadas: ${processadas} | Confirmadas: ${confirmadas} | Conferir: ${conferir} | Não encontradas: ${naoEncontradas}`
  );

}

/**
 * ============================================================
 * WEB APP — "Download capas (em teste)" no Gerador de Reporte
 * ------------------------------------------------------------
 * GET ?action=buscarCapas&rows=<JSON codificado>
 *
 * rows = array de { pais, playlist, artist, semana } — exatamente
 * as linhas de CAPA já filtradas na tela (Semana/Território/
 * Gravadora). semana já vem como "dd/mm/aaaa" (mesmo formato
 * usado nas pastas do Drive).
 *
 * Busca cada capa (mesma lógica de grupo do buscarCapas()),
 * zipa os arquivos ÚNICOS encontrados (uma imagem compartilhada
 * entre AR/PY/UY, por ex., entra só uma vez no zip) e devolve o
 * link de download do zip + a lista encontrada/não encontrada
 * pra montar a prévia no dashboard.
 *
 * O arquivo .zip é criado temporariamente no Drive da conta que
 * roda o script, com permissão "qualquer pessoa com o link pode
 * ver" — pra poder ser baixado direto do navegador de quem
 * estiver usando o dashboard.
 * ============================================================
 */
function doGet(e) {

  const action = e.parameter.action;

  if (action === "buscarCapas") {
    return handleBuscarCapasDownload(e);
  }

  return jsonResponse({ status: "online" });

}

// Extensão pelo tipo do arquivo — cobre o caso de a capa estar
// no Drive sem extensão no nome (alguns arquivos do time de
// capas vieram assim), que fazia o item baixar sem conseguir
// abrir/visualizar depois de extrair o zip.
const MIME_TO_EXT = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp"
};

function ensureBlobHasExtension(blob) {

  const nome = blob.getName() || "capa";

  if (/\.[a-zA-Z0-9]+$/.test(nome)) return blob;

  const ext = MIME_TO_EXT[blob.getContentType()] || "jpg";

  return blob.setName(`${nome}.${ext}`);

}

// Tira caracteres inválidos em nome de arquivo do Windows
// (\/:*?"<>|) e colapsa espaços — mesmo espírito da limpeza que
// já usamos pro nome das capas.
function sanitizeFilename(text) {

  return String(text || "")
    .replace(/[\\/:*?"<>|]/g, "")
    .replace(/\s+/g, " ")
    .trim();

}

function handleBuscarCapasDownload(e) {

  try {

    const rows = JSON.parse(e.parameter.rows || "[]");

    if (!rows.length) {
      return jsonResponse({ success: false, errors: ["Nenhuma linha enviada."] });
    }

    const rootFolders = DriveApp.getFoldersByName(ROOT_FOLDER_NAME);

    if (!rootFolders.hasNext()) {
      return jsonResponse({ success: false, errors: [`Pasta raiz "${ROOT_FOLDER_NAME}" não encontrada.`] });
    }

    const rootFolder = rootFolders.next();

    const weekFolderCache = new Map();
    const groupFolderCache = new Map();
    const coverCache = new Map();

    const found = [];
    const notFound = [];
    const blobs = [];
    const usedFileIds = new Set();

    rows.forEach(row => {

      const pais = row.pais;
      const playlist = row.playlist;
      const artist = row.artist;
      const dataSemanaStr = row.semana; // já vem "dd/mm/aaaa" do dashboard

      const grupo = COUNTRY_GROUPS[pais];

      if (!grupo) {
        notFound.push({ pais, playlist, artist, motivo: "país sem grupo configurado" });
        return;
      }

      let weekFolder = weekFolderCache.get(dataSemanaStr);

      if (weekFolder === undefined) {
        weekFolder = findWeekFolder(rootFolder, dataSemanaStr);
        weekFolderCache.set(dataSemanaStr, weekFolder);
      }

      if (!weekFolder) {
        notFound.push({ pais, playlist, artist, motivo: "semana não encontrada no Drive" });
        return;
      }

      const groupCacheKey = dataSemanaStr + "|" + grupo;

      let groupFolders = groupFolderCache.get(groupCacheKey);

      if (groupFolders === undefined) {
        const groupCodesArr = grupo.split(",").map(c => c.trim());
        const groupCountryNames = getGroupCountryNames(grupo);
        groupFolders = findGroupFolders(weekFolder, groupCodesArr, groupCountryNames).matches;
        groupFolderCache.set(groupCacheKey, groupFolders);
      }

      if (!groupFolders.length) {
        notFound.push({ pais, playlist, artist, motivo: "pasta do grupo não encontrada" });
        return;
      }

      const coverCacheKey = groupCacheKey + "|" + normalize(playlist);

      let cover = coverCache.get(coverCacheKey);

      if (cover === undefined) {
        cover = findCoverFile(groupFolders, playlist);
        coverCache.set(coverCacheKey, cover);
      }

      if (!cover) {
        notFound.push({ pais, playlist, artist, motivo: "capa não encontrada automaticamente" });
        return;
      }

      const fileId = cover.file.getId();

      found.push({
        pais,
        playlist,
        artist,
        fileId,
        fileName: cover.file.getName()
      });

    });

    // Dedupe pelo ID do arquivo, olhando pra lista final de
    // "found" (não durante o loop acima) — assim o zip nunca
    // repete uma capa mesmo se em algum momento o mesmo fileId
    // chegar até aqui por caminhos diferentes (ex.: grupo com
    // mais de uma pasta batendo, cache não reaproveitado etc.).
    // AR/PY/UY continuam aparecendo os 3 na prévia (found tem os
    // 3), só o zip que baixa 1 arquivo por fileId único.
    found.forEach(item => {

      if (usedFileIds.has(item.fileId)) return;

      usedFileIds.add(item.fileId);

      blobs.push(ensureBlobHasExtension(DriveApp.getFileById(item.fileId).getBlob()));

    });

    let zipUrl = "";
    let isSingleFile = false;
    let downloadFileName = "";

    if (blobs.length === 1) {

      // Só uma capa única (ex.: um só país, ou vários países mas
      // todos com o mesmo link) — baixa a imagem direto, sem
      // empacotar num .zip desnecessário. Nome do arquivo fica
      // IGUAL ao nome original no Drive (o nome padronizado com
      // data/gravadora/território é só pro .zip, quando há mais
      // de uma capa dentro dele).
      isSingleFile = true;

      const singleBlob = ensureBlobHasExtension(blobs[0]);

      downloadFileName = singleBlob.getName();

      const imageFile = DriveApp.createFile(singleBlob);

      imageFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

      zipUrl = "https://drive.google.com/uc?export=download&id=" + imageFile.getId();

    } else if (blobs.length > 1) {

      const zipNameParam = sanitizeFilename(e.parameter.zipName || "capas");

      downloadFileName = `${zipNameParam || "capas"}.zip`;

      const zipBlob = Utilities.zip(blobs, downloadFileName);

      const zipFile = DriveApp.createFile(zipBlob);

      zipFile.setName(downloadFileName);

      zipFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

      zipUrl = "https://drive.google.com/uc?export=download&id=" + zipFile.getId();

    }

    return jsonResponse({ success: true, found, notFound, zipUrl, isSingleFile, downloadFileName });

  } catch (error) {

    return jsonResponse({ success: false, errors: [String(error)] });

  }

}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
