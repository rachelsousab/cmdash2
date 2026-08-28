/* ==========================================================
   CLARO MÚSICA DASHBOARD
   Configuration File
   Version 1.0
========================================================== */

const CONFIG = {

    /* ==========================================
       DATA SOURCE
    ========================================== */

    DATA: {

        csvUrl:
            "https://docs.google.com/spreadsheets/d/e/2PACX-1vSKDQN4Tmp5zJyV3r69Sf2ck1JNpMtxvavsX8Iw1gZyZtQ6lKkHwfX_SSIZv0uctby2LGd_Cas0BDRi/pub?gid=1359106749&single=true&output=csv",

        autoRefresh: false,

        refreshIntervalMinutes: 10

    },

    SOCIAL_DATA: {

    csvUrl:
        "https://docs.google.com/spreadsheets/d/e/2PACX-1vSZgH0XiA52taz7aY8xqvz9s1YVuiiFgAKODPYq_jQfBODPv6SeYfOfrIZk2e77tSXBMsiHENUK5XJW/pub?gid=40752348&single=true&output=csv",

    autoRefresh: false,

    refreshIntervalMinutes: 10

},

    // Web App (Apps Script) que busca as capas no Drive e devolve
    // um .zip — feature em teste, ver js/report-cover-download.js.
    // Vazio até a Rachel implantar o script e colar a URL aqui.
    COVERS_DOWNLOAD: {

    webAppUrl: "https://script.google.com/macros/s/AKfycbxFSvBkx_NVx420H_gFbTqNFy-3UMa2I0I_N1oDScx04wpzKVEqO89rSLueVwcmiSQv/exec"

},

    // Destinatários/link de planilha do botão "Enviar reporte", por
    // Território + Gravadora (colunas: Território, Gravadora,
    // Destinatários, Link da Planilha — ver js/report-recipients-data.js).
    // Vazio até a Rachel publicar essa planilha.
    REPORT_RECIPIENTS: {

    csvUrl: "https://docs.google.com/spreadsheets/d/e/2PACX-1vTxorxB3kXZyYfx6xFvDypZOoIOVHnDSZEO3OzZhkXkYU111uP9gE0BsE4yyEdqciJ6uFTpmVht7yKT/pub?gid=0&single=true&output=csv"

},

    // Botão "Atualizar planilha de destaque" (dentro de "Enviar
    // reporte") — cria uma planilha temporária com a tabela de
    // destaques, só pra servir de origem pro "Copiar para >
    // Planilha existente" nativo do Google Sheets. Um único script
    // pra todas as gravadoras (ver scratch-code-gs-report-send.gs).
    // Vazio até a Rachel implantar o script.
    REPORT_SEND: {

    webAppUrl: "https://script.google.com/macros/s/AKfycbyBHvjxsU-EblRBJMgT_-vdcAfvnFtnZDI6fSiEDx3cuQE23YC1a56jpn6O5N7PNy24hQ/exec",

    sharedSecret: "DashCM2026ReportSendRachel"

},

    // "Consumo de Playlists" (tabela dinâmica automática) — histórico
    // vem do CSV publicado da planilha de rastreamento; upload vai
    // pro Web App que gera a Sheet com pivot table + gráfico.
    // Ambos vazios até a Rachel terminar o setup (ver instruções).
    PIVOT_DATA: {

    csvUrl: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSMS5qWPYnmVdapM3hi0HFb2rpnD851r93DJGawVJPhQwZ1H6uCSd46HyCF4LoDhiUFi5cB7s_xbFcB/pub?gid=0&single=true&output=csv",

    driveFolderUrl: "https://drive.google.com/drive/folders/1QX-XT44umbP7XlKmT3-NtDrQg60mdD4M?usp=drive_link"

},

    PIVOT_UPLOAD: {

    webAppUrl: "https://script.google.com/macros/s/AKfycbwN24RAeUSVKwLamd-HDCJn3Hg4v0gGOSvqKRcXhxLCo3iCl3_Aw2Sn_RUub9LM_5fxSQ/exec",

    sharedSecret: "DashCM2026PivotRachel"

},

    // "Consumo por Artista" (sub-aba nova, dentro de "Consumo") —
    // mesmo esquema do PIVOT_DATA/PIVOT_UPLOAD acima, planilha e
    // pasta do Drive separadas. Vazios até a Rachel terminar o
    // setup (criar a planilha de histórico, publicar como CSV e
    // implantar o Apps Script — ver scratch-code-gs-artista.gs).
    ARTIST_DATA: {

    csvUrl: "https://docs.google.com/spreadsheets/d/e/2PACX-1vQQJ4jSmLBWBh-x99s_m22LeDbAHbk7lPP_IJ_bkPikVgh-5TVC_RFfcjy1YirmQogz9HDWRwAjOr7v/pub?gid=0&single=true&output=csv",

    driveFolderUrl: "https://drive.google.com/drive/folders/1vZebJxkQ9RQtDW0lJ8R8rgiLG83HJeI8?usp=drive_link"

},

    ARTIST_UPLOAD: {

    webAppUrl: "https://script.google.com/a/macros/imusica.com.br/s/AKfycbwtqm2MCr1RAVRHefzHMOBcJJqqH9LqSEMN-8pCGwQbMJeQ5BXa7bCiuuDU4hq4bK_dZw/exec",

    sharedSecret: "DashCM2026ArtistaRachel"

},

    HIGHLIGHTS_DATA: {

    csvUrl:
        "https://docs.google.com/spreadsheets/d/e/2PACX-1vSGDwZ-s5BGVF5fxOECsPxVNMTcOYjH3LUBb2khyXbjoN-z8TqJOgt_Os75XwW5uTSqJv1ZIK-3wMhM/pub?gid=2044463510&single=true&output=csv",

    autoRefresh: false,

    refreshIntervalMinutes: 10

},

    CANAL500_DATA: {

    csvUrl:
        "https://docs.google.com/spreadsheets/d/e/2PACX-1vTHKU3_LDE-ZLxD7xzV8mTRcpK_WHZPpRAEslmIy3woqefyFyeHNdOK-DUMmSlE9kVVSIyQEKIVGTE8/pub?gid=191235500&single=true&output=csv",

    autoRefresh: false,

    refreshIntervalMinutes: 10

},

    /* ==========================================
       CANAL 500 — "Registrar envio" / "Enviar evidência"

       webAppUrl: preencher depois que a Rachel implantar o
       Apps Script (Code.gs) dedicado a essa planilha.
    ========================================== */
    CANAL500_FORM: {

        webAppUrl: "https://script.google.com/a/macros/imusica.com.br/s/AKfycbzm5kdiWIwQNJGntqlf3HaSJSpl1qtCSxnF38cjzBE37lGa4DvT2v0_f3tr6pgHKNmm/exec",

        sharedSecret: "DashCM2026Canal500Rachel",

        driveFolderUrl: "https://drive.google.com/drive/folders/1h9FP1Bzwb6B8AUvj2J_VIHymNk5KF85_?usp=drive_link",

        maxImages: 3,

        maxImageBytes: 5 * 1024 * 1024,

        maxTextLength: 2000,

        statusVeiculacao: ["Em veiculação", "Fora do Ar", "Enviado"],

        generos: [
            "Alternativo/Indie",
            "Eletrônica",
            "Forró",
            "Funk",
            "Gospel",
            "Hip Hop",
            "Kpop",
            "MPB",
            "Nova MPB",
            "Outros",
            "Pagode",
            "Pop",
            "Pop inter",
            "Rap/trap",
            "Reggae",
            "Reggaeton",
            "Rock",
            "Samba",
            "Sem gênero definido",
            "Sertanejo"
        ]

    },

    /* ==========================================
       AUTENTICAÇÃO

       Trava simples de acesso, NÃO é autenticação
       real: a senha fica em texto puro no código-
       fonte, visível a quem inspecionar a página.
       Serve só para afastar acesso casual.
    ========================================== */

    AUTH: {

        password: "LabelRelations2026#@CM"

    },

    /* ==========================================
       REDES SOCIAIS — edição manual de campos
       ------------------------------------------
       A maioria dos campos vem automaticamente da
       API do Instagram, mas alguns (Formato, Tipo,
       Resumo, Responsável, Gravadora, Collab,
       Gênero, Reposts, Começaram a seguir) têm que
       ser preenchidos à mão — ficam editáveis direto
       na tabela "Últimas postagens" quando vazios.

       webAppUrl: preencher depois que a Rachel
       adaptar/implantar o Apps Script já existente
       na planilha de Instagram.
    ========================================== */

    SOCIAL_FORM: {

        webAppUrl: "https://script.google.com/macros/s/AKfycbykxINAoV-nBTgPkfinLYw17BPVQr1wM80RZPmwsAaBHNSajcfF-PR0UClrI6fTacVH7g/exec",

        sharedSecret: "DashCM2026SocialRachel",

        formatos: [
            "Reels",
            "Carrossel",
            "Imagem estática"
        ],

        tipos: [
            "ID Lançamento",
            "Trecho de clipe",
            "Ação de feriados",
            "Gravação externa",
            "Participação em evento",
            "Cobertura de show",
            "Entrevista",
            "Post genérico",
            "Vídeo conceitual",
            "Meme",
            "Prêmio Claro música",
            "No Radar",
            "Desafio Claro música",
            "Pauta quente",
            "Institucional",
            "Papo Claro música",
            "Trend"
        ],

        responsaveis: [
            "Rachel Sousa",
            "Isabelle Rocha",
            "Ana Clara Mendes",
            "Vanessa Silva",
            "Victoria Liscio",
            "Rodrigo Rodriguez",
            "Felipe Marques",
            "Carol Ávila",
            "Mariá Vecchi",
            "Externo/Claro"
        ],

        collabs: [
            "Collab artista",
            "Collab fã clube",
            "Collab portal",
            "Collab gravadora",
            "Collab influenciador",
            "Collab Claro",
            "Sem collab"
        ],

        generos: [
            "Samba",
            "Pagode",
            "MPB",
            "Pop",
            "Funk",
            "Reggaeton",
            "Kpop",
            "Eletrônica",
            "Rock",
            "Alternativo/indie",
            "Outros",
            "Reggae",
            "Sertanejo",
            "Pop inter",
            "Rap/trap",
            "Gospel",
            "Nova MPB",
            "Vários gêneros",
            "Sem gênero definido/outros",
            "Hip hop",
            "Forró"
        ]

    },

    /* ==========================================
       COMPANY
    ========================================== */

    COMPANY: {

        name: "Claro música",

        dashboardName: "Label Relations Dashboard",

        version: "1.0.0"

    },

    /* ==========================================
       DATE SETTINGS
    ========================================== */

    DATE: {

        locale: "pt-BR",

        months: [

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

        ],

        shortMonths: [

            "Jan",
            "Fev",
            "Mar",
            "Abr",
            "Mai",
            "Jun",
            "Jul",
            "Ago",
            "Set",
            "Out",
            "Nov",
            "Dez"

        ]

    },

    /* ==========================================
       STATUS
    ========================================== */

    STATUS: {

        completed: "Concluída",

        inProgress: "Em andamento",

        cancelled: "Cancelada",

        standby: "Standby"

    },

    /* ==========================================
       COLORS
    ========================================== */

    COLORS: {

        primary: "#E30613",

        green: "#2EAD61",

        yellow: "#F5B301",

        red: "#E53935",

        blue: "#3A7AFE",

        gray: "#808080",

        background: "#F6F7FB"

    },

    /* ==========================================
       KPI COLORS
    ========================================== */

    KPI: {

        completed: "#2EAD61",

        inProgress: "#3A7AFE",

        standby: "#F5B301",

        cancelled: "#E53935",

        total: "#E30613"

    },

    /* ==========================================
       METAS
    ========================================== */

   /* "countries" define em quais países essa meta é FIXA na
      tabela (aparece sempre, mesmo com 0 ocorrências no ano).
      Hoje todas as metas por tipo de ação são do Brasil; a
      Colômbia usa apenas a meta-resumo em COUNTRY_SUMMARY_GOALS.
      Para uma meta valer para mais de um país, basta listar
      mais nomes aqui — nenhuma outra mudança de código é
      necessária. */

   /* Anos com um conjunto de metas de verdade cadastrado (ver
      GOALS/COUNTRY_SUMMARY_GOALS abaixo). Cada ano tem metas
      totalmente diferentes, definidas manualmente conforme vão
      sendo enviadas — não é algo que dá pra inferir dos dados.
      Adicione o ano aqui só quando as metas dele existirem de
      verdade (ex.: quando as metas de 2027 chegarem). */
   GOALS_AVAILABLE_YEARS: [2026],

   GOALS: {

    "Parcerias com Rádios": {
        annual: 1,
        countries: ["Brasil"]
    },

    "Canal 500": {
        annual: 72,
        countries: ["Brasil"]
    },

    "Barker": {
        annual: 12,
        countries: ["Brasil"]
    },

    "Trilho": {
        annual: 12,
        countries: ["Brasil"]
    },

    "BG": {
        annual: 4,
        countries: ["Brasil"]
    },

    "Papo Claro música": {
        annual: 9,
        countries: ["Brasil"]
    },

    "Conteúdo para redes sociais": {
        annual: 72,
        countries: ["Brasil"]
    },

    "TV Corporativa": {
        annual: 4,
        countries: ["Brasil"]
    },

    "E-mail marketing": {
        annual: 4,
        countries: ["Brasil"]
    },

    "Site Bora": {
        annual: 4,
        countries: ["Brasil"]
    },

    "LinkedIn (Claro)": {
        annual: 4,
        countries: ["Brasil"]
    },

    "Eventos institucionais/Patrocínio": {
        annual: 12,
        countries: ["Brasil"]
    },

    "Evento Prêmio Claro música": {
        annual: 1,
        countries: ["Brasil"]
    },

    "Vídeo institucional": {
        annual: 4,
        countries: ["Brasil"]
    },

    "Ativação JB FM": {
        annual: 1,
        countries: ["Brasil"]
    },

    "Banner: Seção da Home": {
        annual: 48,
        countries: ["Brasil"]
    },

    "Banner: Seção de Música": {
        annual: 144,
        countries: ["Brasil"]
    },

    "Stream to Win": {
        annual: 2,
        countries: ["Colômbia"]
    },

    "Artista de la semana": {
        annual: 48,
        countries: ["Colômbia"]
    }

},

ACTION_AREAS: {

    "Canal 500": "Label Relations",
    "Papo Claro música": "Label Relations",
    "Conteúdo para redes sociais": "Label Relations",
    "Evento Prêmio Claro música": "Label Relations",
    "Playlist personalizada": "Label Relations",
    "Vídeo Insertoras (TV Latam)": "Label Relations",
    "Audição": "Label Relations",
    "Café Claro": "Label Relations",
    "Íntimos Claro música": "Label Relations",
    "Micrófono": "Label Relations",
    "Te Lo Dice Cuervo": "Label Relations",
    "Stream to Win": "Label Relations",
    "Artista de la semana": "Label Relations",

    "E-mail marketing": "Marketing",
    "Site Bora": "Marketing",
    "LinkedIn (Claro)": "Marketing",
    "Eventos institucionais/Patrocínio": "Marketing",
    "Push Notification": "Marketing",
    "Ad no APP": "Marketing",
    "Youtube da Claro": "Marketing",
    "TV Corporativa": "Marketing",
    "Vídeo institucional": "Marketing",

    "Parcerias com Rádios": "Licenciamento",
    "Ativação JB FM": "Licenciamento",
    "Contrato OTT": "Licenciamento",

    "Barker": "TV",
    "Trilho": "TV",
    "BG": "TV",
    "Banner: Seção da Home": "TV",
    "Banner: Seção de Música": "TV"

},

AREA_ORDER: [

    "Label Relations",

    "Licenciamento",

    "Marketing",

    "TV"

],

/* GOAL_MAPPING: só precisa de entradas onde o valor bruto da
   coluna "Detalhe" (no Sheets) é DIFERENTE do nome da meta.
   Ex.: a planilha guarda "Barker: Seção de Música", mas a meta
   se chama apenas "Barker". Itens que já batem exatamente com
   o nome da meta (ex.: "Canal 500") não precisam de mapeamento. */

GOAL_MAPPING: {

    "Barker: Seção de Música": "Barker",

    "Trilho: Seção de Música": "Trilho",

    "BG: Seção de Música": "BG",

    "Negociação Rádios Zero Rating": "Parcerias com Rádios"

},

/* METAS-RESUMO POR PAÍS
   Linha extra, fixa no topo da tabela do país, somando TODAS
   as ações concluídas no ano naquele país (independente do
   tipo). Hoje só a Colômbia tem essa meta consolidada; para
   adicionar outro país no futuro, basta incluir uma entrada
   aqui — nenhum código precisa mudar. */

COUNTRY_SUMMARY_GOALS: {

    "Colômbia": {

        label: "Ações Colômbia",

        annual: 96

    }

},

    /* ==========================================
       CHART SETTINGS
    ========================================== */

    CHARTS: {

        animation: true,

        responsive: true,

        maintainAspectRatio: false,

        borderWidth: 2,

        borderRadius: 8

    },

    /* ==========================================
       CSV COLUMN NAMES
       (centralizado para facilitar mudanças)
    ========================================== */

    COLUMNS: {

        country: "País",

        area: "Área",

        detail: "Detalhe",

        proposalDate: "Data da proposta",

        summary: "Resumo da ação",

        label: "Gravadora",

        regional: "Regional",

        status: "Status",

        owner: "Responsável",

        initiative: "Iniciativa",

        publishDate: "Data final / publicação",

        extra: "Informações extras",

        id: "ID",

        createdTimestamp: "Timestamp de criação"

    },

    /* ==========================================
       PREFIXOS DE ID POR PLANILHA DE ORIGEM
       (ver js/actions-merge.js)
    ========================================== */
    ID_SOURCE_PREFIXES: {
        RS: "Redes sociais",
        C500: "Canal 500",
        CO: "Cronograma de posteio - Colombia",
        BAN: "Cronograma - Banners",
        PUSH: "Push Notification"
    },

    /* ==========================================
       CAMPOS DE MÚLTIPLOS VALORES
       (colunas onde o Sheets guarda mais de um
       valor separado por vírgula numa única
       célula — usado pelos filtros e pelo Goals)
    ========================================== */

    MULTI_VALUE_FIELDS: [

        "detail",

        "owner",

        "label"

    ],

    /* ==========================================
       AÇÕES MANUAIS (formulário "Adicionar nova
       ação" / "Editar ação existente")
       ------------------------------------------
       Grava numa planilha própria, separada da
       "Dados da área", via Apps Script Web App.
       webAppUrl/sharedSecret NÃO são segurança de
       verdade (ficam visíveis no código-fonte) —
       só uma trava contra descoberta casual da
       URL, mesma categoria da senha de login.
    ========================================== */

    MANUAL_ACTIONS: {

        webAppUrl: "https://script.google.com/a/macros/imusica.com.br/s/AKfycbx6WfB5SisH7KWNOzbIk5vXQVocisXnkS94itL6PBjjRBCSHXdo4HAlSsPREwX9P-2xYA/exec",

        sharedSecret: "DashCM2026FeitopelaRachel",

        maxImages: 3,

        maxImageBytes: 5 * 1024 * 1024,

        maxTextLength: 2000,

        countries: [
            "Brasil",
            "Colômbia",
            "Argentina",
            "México",
            "Peru",
            "Chile"
        ],

        areas: [
            "Label Relations",
            "Licenciamento",
            "TV",
            "Marketing"
        ],

        /* Cada Detalhe pode aparecer em mais de uma "tag" de
           filtro rápido — são só atalhos de busca na tela, o
           campo em si é uma lista única (achatada). */
        details: [
            { value: "Canal 500", tags: ["gravadora", "comunicacao", "regional"] },
            { value: "Papo Claro música", tags: ["gravadora"] },
            { value: "Conteúdo para redes sociais", tags: ["gravadora", "regional"] },
            { value: "Evento Prêmio Claro música", tags: ["gravadora"] },
            { value: "Playlist personalizada", tags: ["gravadora", "comunicacao", "regional"] },
            { value: "Audição", tags: ["gravadora"] },

            { value: "Barker: Seção de Música", tags: ["tv"] },
            { value: "Trilho: Seção de Música", tags: ["tv"] },
            { value: "Banner: Seção de Música", tags: ["tv"] },
            { value: "Banner: Seção da Home", tags: ["tv"] },
            { value: "BG: Seção de Música", tags: ["tv"] },

            { value: "TV Corporativa", tags: ["comunicacao"] },
            { value: "E-mail marketing", tags: ["comunicacao"] },
            { value: "Site Bora", tags: ["comunicacao"] },
            { value: "LinkedIn (Claro)", tags: ["comunicacao"] },
            { value: "Instagram da Claro", tags: ["comunicacao"] },
            { value: "Lojas físicas", tags: ["comunicacao", "regional"] },
            { value: "Eventos institucionais/Patrocínio", tags: ["comunicacao"] },
            { value: "Boletim", tags: ["comunicacao"] },
            { value: "Youtube da Claro", tags: ["comunicacao"] },

            { value: "Negociação Rádios Zero Rating", tags: ["licenciamento"] },
            { value: "Contrato OTT", tags: ["licenciamento"] },
            { value: "Contrato CM + RBT", tags: ["licenciamento"] },
            { value: "Parcerias com Rádios", tags: ["licenciamento"] },
            { value: "Ativação JB FM", tags: ["licenciamento"] },

            { value: "Ad no APP", tags: ["outros"] },
            { value: "Claro Shows", tags: ["outros"] },
            { value: "Push Notification", tags: ["outros"] },

            { value: "Stream to Win", tags: ["latam"] },
            { value: "Íntimos Claro música", tags: ["latam"] },
            { value: "Café Claro", tags: ["latam"] },
            { value: "Micrófono", tags: ["latam"] },
            { value: "Te Lo Dice Cuervo", tags: ["latam"] },
            { value: "Vídeo Insertoras (TV Latam)", tags: ["latam"] },
            { value: "Otro contenido (redes sociales)", tags: ["latam"] },
            { value: "Camilo Cuervo", tags: ["latam"] },
            { value: "Artista de la semana", tags: ["latam"] },
            { value: "Saludo Lanzamiento", tags: ["latam"] }
        ],

        /* ==========================================
           REGRAS DE EDIÇÃO POR DETALHE
           (tela "Editar ação existente")

           locked: true  -> aparece na lista, mas não é
                             clicável (Barker/Trilho/Banner/BG,
                             atualizados só pela aba de origem).
           warning: texto do aviso vermelho mostrado ao abrir
                    uma ação desse Detalhe cuja origem NÃO é
                    "Ações Manuais" (edição vira duplicação).
                    Ausente/null = editável direto, sem aviso.

           Detalhes que não aparecem aqui (ex.: Push Notification,
           que é fonte de Fraseologias) são tratados por
           Metrics.isPhraseology e nem entram na lista.
        ========================================== */
        detailEditRules: {
            "Canal 500": {
                warning: "Atualizado automaticamente pela aba Canal 500 — aqui você só pode adicionar informações ou outro canal de mídia pra essa ação (ex.: Vídeo Lucy Alves foi pro Canal 500 → também foi exibido na TV Corporativa)."
            },
            "Conteúdo para redes sociais": {
                warning: "Atualizado automaticamente via API do Instagram — aqui você só pode adicionar informações ou outro canal de mídia pra essa ação (ex.: um vídeo do Instagram também recebeu uma Playlist personalizada, ou foi pro Youtube da Claro)."
            },
            "Barker: Seção de Música": { locked: true },
            "Trilho: Seção de Música": { locked: true },
            "Banner: Seção de Música": { locked: true },
            "Banner: Seção da Home": { locked: true },
            "BG: Seção de Música": { locked: true },
            "Artista de la semana": {
                warning: "Atualizado automaticamente via planilha de postagens da Colômbia — aqui você só pode adicionar informações ou outro canal de mídia pra essa ação (ex.: também foi exibido na TV da Colômbia/LatAm).",
                statusLocked: true,
                statusLockedMessage: "Status atualizado automaticamente a partir da publicação do conteúdo pela Colômbia."
            },
            "Saludo Lanzamiento": {
                warning: "Atualizado automaticamente via planilha de postagens da Colômbia — aqui você só pode adicionar informações ou outro canal de mídia pra essa ação (ex.: também foi exibido na TV da Colômbia/LatAm).",
                statusLocked: true,
                statusLockedMessage: "Status atualizado automaticamente a partir da publicação do conteúdo pela Colômbia."
            }
        },

        editListNotice: "Ações do tipo Barker, Trilho, Banner (Seção de Música/Home) e BG não são editáveis por aqui — são atualizadas automaticamente. Fraseologias não aparecem nesta lista, pois seguem lógica própria.",

        detailTagLabels: {
            gravadora: "Ação com gravadora",
            tv: "Equipe TV",
            comunicacao: "Comunicação Claro (Endomarketing)",
            regional: "Ação com regional",
            licenciamento: "Licenciamento",
            outros: "Outros",
            latam: "LatAm (fora do Brasil)"
        },

        labels: [
            "Universal Music", "Som Livre", "Downtown Music / FUGA", "MK Music", "ADA",
            "Virgin Music", "The Orchard", "Sony Music", "Symphonic", "Altafonte",
            "BMG", "Warner Music", "Audiolink", "Believe", "Strm Music",
            "ONErpm", "Backstage Musica", "Interscope", "Farolatino", "Codiscos",
            "Paralogy", "United Masters", "YG Plus", "YT Rocket", "Ditto",
            "Ingrooves", "Audiosalad", "DMusic", "Xelon", "Fluxus",
            "Revelator Enterprises", "Hopeless Records", "Creation Music Group", "Absolute", "Adarga Group",
            "Create Music Group - Label Engine", "Tratore", "Integrity Music", "Ultra Records", "HYBE",
            "SM Entertainment", "New Music"
        ],

        labelSpecialOptions: [
            { value: "Não se aplica", exclusive: true },
            { value: "iMusica (ott)", exclusive: false }
        ],

        regionals: [
            "Regional Sul",
            "Regional SP",
            "Regional RJ/ES",
            "Regional Norte e Nordeste",
            "Regional MG",
            "Regional Centro-Oeste",
            "Matriz",
            "Colômbia",
            "México"
        ],

        statuses: [
            "Em andamento",
            "Standby",
            "Concluída",
            "Cancelada"
        ],

        owners: [
            "Rachel Sousa",
            "Isabelle Rocha",
            "Ana Clara Mendes",
            "Vanessa Silva",
            "Victoria Liscio",
            "Rodrigo Rodriguez",
            "Carol Ávila",
            "Felipe Marques"
        ]

    }

};


/* ==========================================================
   GLOBAL STATE
========================================================== */

const APP = {

    rawData: [],

    mergedData: [],

    filteredData: [],

    charts: {},

    filters: {

        year: "Todos",

        month: "Todos",

        country: "Todos",

        area: "Todos",

        detail: "Todos",

        label: "Todos",

        regional: "Todos",

        owner: "Todos",

        status: "Todos"

    }

};
