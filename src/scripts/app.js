/**
 * 画面を動かすための入口です。
 * 変数を外部へ漏らさないよう、全体を即時実行関数で包んでいます。
 */
(() => {
  "use strict";
  // ===== 1. HTML部品と画面状態 =====
  const ids = [
    "homeLink", "homeView", "appView", "startHelper", "startHelperFooter", "themeMode", "themeColor", "appVersion", "installHint", "updateNotice", "reloadForUpdate",
    "pasteSourcePanel", "fileSourcePanel", "folderSourcePanel", "collectionSourcePanel", "sourcePriority", "files", "folderFiles", "loadedRow", "loadedFiles", "loadedSummary", "fileCount", "clearFiles",
    "mixedFormatWarning", "forceMixedFormats", "format", "formatHelp", "source", "sourceCount", "sourceFeedback", "sample", "clear",
    "unifiedSpacing", "customSpacing", "applyUnified", "includeLeadingSpacing", "includeTrailingSpacing",
    "removeFirstHeading", "italicAsNote", "removeHorizontalRules", "disableSizeLimits", "sizeLimitWarning",
    "consecutiveHeadingSpacing", "headingSettings", "headingSettingsSummary", "listSettings", "listSettingsSummary", "markerSettings", "markerSettingsSummary", "conversionSettings", "conversionSettingsSummary", "resetSettings", "importSettings", "exportSettings", "settingsFileFeedback",
    "boldH1", "boldH2", "boldH3", "underlineH1", "underlineH2", "underlineH3", "underlineNote", "underlineBody",
    "listMarker", "listPrefixBold", "listPrefixUnderline", "listContentBold", "listContentUnderline", "previewDesktop", "previewMobile", "previewStage",
    "emptyPreview", "preview", "resultCount", "warningDetails", "warningSummary", "warnings",
    "copyFormat", "copyResult", "copyResultText", "copyFeedback", "status", "mobileAction", "mobileActionText",
    "openManualCopy", "manualCopy", "manualCopyReason", "selectManualCopy", "closeManualCopy", "manualCopyRich", "manualCopyText", "manualCopyFeedback",
    "openHelp", "closeHelp", "helpDialog", "helpTabPc", "helpTabMobile", "helpPc", "helpMobile", "pasteHintText",
    "folderModeLabel", "folderTouchNote"
  ];
  const spacingTypes = ["all", "h1", "h2", "h3", "note", "body"];
  const markerTypes = ["bold", "underline"];
  const markerDefaults = { bold: "**", underline: "==" };
  for (const type of spacingTypes) ids.push(`${type}Before`, `${type}After`);
  for (const type of markerTypes) ids.push(`${type}Marker`, `${type}StartMarker`, `${type}EndMarker`);
  /**
   * HTMLのidとJavaScriptの変数を一度に対応付けます。
   * 以降は document.getElementById を何度も書かず、el.source のように参照できます。
   */
  const el = Object.fromEntries(ids.map((id) => [id, document.getElementById(id)]));
  const modeInputs = Array.from(document.querySelectorAll('input[name="spacingMode"]'));
  const sourceModeInputs = Array.from(document.querySelectorAll('input[name="sourceMode"]'));
  const markerModeInputs = Array.from(document.querySelectorAll("input[data-marker-mode]"));
  const stepButtons = Array.from(document.querySelectorAll("[data-step-target]"));
  // starts は結合後の原稿で各ファイルが始まる行番号です。converter.js がファイル先頭の
  // YAMLプロパティだけを除外できるよう、変換オプションとして渡します。
  const collections = {
    files: { documents: [], combinedText: "", format: "markdown", starts: [0] },
    folder: { documents: [], combinedText: "", format: "markdown", starts: [0] }
  };
  let sourceMode = "paste";
  let result = { title: "", html: "", plainText: "", warnings: [], images: [] };
  let mode = "unified";
  let customInitialized = false;
  let conversionTimer;
  let statusTimer;
  let draggedFileIndex = -1;
  let busy = false;
  const storageKey = "talto-helper-settings-v1";
  /**
   * 端末の種類を判定します。案内文の出し分け、フォルダ選択の扱い、容量警告の閾値に使います。
   * 判定は表示と警告にだけ使い、機能そのものは制限しません（誤判定しても操作できる）。
   * iPadOS 13 以降の Safari は Mac と同じ UA を名乗るため、タッチ点数で見分けます。
   */
  function detectDevice() {
    const ua = navigator.userAgent;
    const touch = navigator.maxTouchPoints > 1;
    if (/iPhone|iPod/.test(ua)) return "iphone";
    if (/iPad/.test(ua) || (/Macintosh/.test(ua) && touch)) return "ipad";
    if (/Android/.test(ua)) return "android";
    return "windows";
  }
  const device = detectDevice();
  const isMobileDevice = device !== "windows";
  // タッチ主体の端末（指で操作するスマホ・タブレット）。UA で判定した端末に加え、タッチ点があり主入力が粗い（指）場合も含めます。
  // maxTouchPoints は実機で 5 前後ですが、エミュレーションでは 0〜1 のことがあるため「1 以上」ではなく「0 より大きい」で見ます。
  const isTouchDevice = isMobileDevice || (navigator.maxTouchPoints > 0 && window.matchMedia("(pointer: coarse)").matches);
  // タブレット判定: iPad、または短辺 600px 以上の Android。容量警告の閾値に使います。
  const isTablet = device === "ipad" || (device === "android" && Math.min(screen.width, screen.height) >= 600);
  // モバイルの容量警告の基準（計画書 Phase B の初期案。実機計測後に見直す）。超えても読み込みは止めず、確認だけ求めます。
  const mobileSizeWarning = isTablet
    ? { file: 10 * 1024 * 1024, total: 30 * 1024 * 1024 }
    : { file: 5 * 1024 * 1024, total: 20 * 1024 * 1024 };
  // ビルド時に VERSION.txt の値が meta へ埋め込まれます。ソースを直接開いたときは "dev" です。
  const appVersion = document.querySelector('meta[name="app-version"]')?.content || "dev";
  // "web" は GitHub Pages 向け、"single" は単一ファイル版、未指定はソースまたはZIP版（分割ファイル）です。
  const buildKind = document.documentElement.dataset.build || "split";
  const themeStorageKey = "talto-helper-theme-v1";
  const themeMedia = window.matchMedia("(prefers-color-scheme: dark)");
  const toggleIds = [
    "includeLeadingSpacing", "includeTrailingSpacing", "removeFirstHeading", "italicAsNote", "removeHorizontalRules", "disableSizeLimits",
    "boldH1", "boldH2", "boldH3", "underlineH1", "underlineH2", "underlineH3", "underlineNote", "underlineBody",
    "listPrefixBold", "listPrefixUnderline", "listContentBold", "listContentUnderline"
  ];
  /**
   * 空行数を0〜10の整数へ収めます。空文字や不正な値は安全側の0になります。
   */
  const count = (value) => Math.max(0, Math.min(10, Number.parseInt(value, 10) || 0));
  const detectFormat = (name) => /\.html?$/i.test(name) ? "html" : "markdown";
  const formatMegabytes = (bytes) => `${(bytes / 1024 / 1024).toFixed(bytes >= 10 * 1024 * 1024 ? 1 : 2)}MB`;
  const activeCollection = () => collections[sourceMode === "folder" ? "folder" : "files"];
  const activeSource = () => sourceMode === "paste" ? el.source.value : activeCollection().combinedText;
  const activeFormat = () => el.format.value;
  const mixedFilesBlocked = () => sourceMode !== "paste" && activeCollection().documents.length > 0 && new Set(activeCollection().documents.map((item) => item.format)).size > 1 && !el.forceMixedFormats.checked;
  const formatDescriptions = window.TaltoFormatCatalog.descriptions;

  // ===== 2. 形式別テスト原稿の生成 =====
  const sampleStyles = [["通常", []], ["太字", ["bold"]], ["下線", ["underline"]], ["太字＋下線", ["bold", "underline"]]];
  const sampleBlockTypes = [["h1", "見出し1"], ["h2", "見出し2"], ["h3", "見出し3"], ["blockquote", "注釈"], ["p", "本文"]];

  /**
   * サンプル文字へ、現在選択中の太字・下線識別子を付けます。
   * 前後同一、前後別、行頭だけ、行末だけの4方式をここで吸収します。
   */
  function sampleMarker(text, type) {
    const config = markerConfig(type);
    if (config.mode === "pair") return config.startMarker && config.endMarker ? `${config.startMarker}${text}${config.endMarker}` : text;
    if (!config.marker) return text;
    if (config.mode === "start") return `${config.marker}${text}`;
    if (config.mode === "end") return `${text}${config.marker}`;
    return `${config.marker}${text}${config.marker}`;
  }

  /**
   * 太字と下線の組み合わせを、内側から順に識別子へ変換します。
   */
  function decoratedMarkdownSample(text, styles) {
    let value = text;
    if (styles.includes("underline")) value = sampleMarker(value, "underline");
    if (styles.includes("bold")) value = sampleMarker(value, "bold");
    return value;
  }

  /**
   * 標準Markdown系で比較に使う、全表示パターンのテスト原稿を作ります。
   */
  function markdownSampleSource() {
    const prefixes = { h1: "# ", h2: "## ", h3: "### ", blockquote: "> ", p: "" };
    return sampleBlockTypes.flatMap(([type, label]) => sampleStyles.map(([style, styles]) =>
      `${prefixes[type]}${decoratedMarkdownSample(`${label}：${style}`, styles)}`
    )).join("\n\n");
  }

  /**
   * Obsidian固有記法を含むテスト原稿を作ります。
   * 除外・簡略化される記法も含め、変換結果をごまかさず比較できるようにします。
   */
  function obsidianSampleSource() {
    return [
      "---\nsample: true\n---",
      "%% このコメントは変換結果から除外されます %%",
      "<!-- このHTMLコメントも除外されます -->",
      markdownSampleSource(),
      "## 対応識別子の変換テスト",
      "#### 見出し4は太字の本文",
      "__アンダースコアによる太字__",
      "文中の _斜体_ は通常文字（前後に空白がある場合のみ。snake_case のような単語内の _ はそのまま）",
      "*行全体の斜体は注釈*",
      "~~打消しは通常文字~~",
      "> 引用は注釈",
      "> [!note]+ Calloutタイトル\n> Callout本文",
      "- 箇条書き\n* 別の箇条書き\n+ さらに別の箇条書き",
      "1. 番号付きリスト\n2) 丸括弧の番号付きリスト",
      "- [ ] 未完了タスク\n- [x] 完了タスク\n- [?] 独自記号の完了タスク",
      "`インラインコードは通常文字`",
      "```text\nコードブロックも通常文字\n```",
      "| 列1 | 列2 |\n| --- | --- |\n| セル1 | セル2 |",
      "[[フォルダ/リンク先|内部リンクの表示名]]",
      "[外部リンク](https://example.com/)",
      "![[sample.png|300]]",
      "![外部画像](https://example.com/sample.png)",
      "<u>HTMLのuタグによる下線</u>",
      "<s>HTMLのsタグによる打消しは通常文字</s>",
      "HTMLのbrタグ<br>による改行",
      "[ NPC1 ] はそのまま保持",
      "---"
    ].join("\n\n");
  }

  /**
   * 対応HTML要素を実際のタグで記述したテスト原稿を作ります。
   */
  function htmlSampleSource() {
    const tags = { h1: "h1", h2: "h2", h3: "h3", blockquote: "blockquote", p: "p" };
    const combinations = sampleBlockTypes.flatMap(([type, label]) => sampleStyles.map(([style, styles]) => {
      let value = TaltoMarkdown.escapeHtml(`${label}：${style}`);
      if (styles.includes("underline")) value = `<u>${value}</u>`;
      if (styles.includes("bold")) value = `<strong>${value}</strong>`;
      return `<${tags[type]}>${value}</${tags[type]}>`;
    }));
    return [...combinations,
      "<h2>対応要素の変換テスト</h2>",
      "<h4>見出し4は太字の本文</h4>",
      "<p>段落内の<br>改行</p>",
      "<p><strong>strongによる太字</strong> / <b>bによる太字</b></p>",
      "<p><u>uによる下線</u></p>",
      "<p>文中の<em>em</em>と<i>i</i>は通常文字</p>",
      "<p><em>段落全体がemなら注釈</em></p>",
      "<p><s>s</s> / <strike>strike</strike> / <del>del</del> は通常文字</p>",
      "<blockquote>blockquoteは注釈</blockquote>",
      "<p><a href=\"https://example.com/\">リンク文字</a></p>",
      "<ul><li>箇条書き1</li><li>箇条書き2</li></ul>",
      "<ol><li>番号付き1</li><li>番号付き2</li></ol>",
      "<table><tr><th>見出しセル</th><th>見出しセル</th></tr><tr><td>セル1</td><td>セル2</td></tr></table>",
      "<p><code>インラインコードは通常文字</code></p>",
      "<pre>コードブロックも通常文字</pre>",
      "<p><img src=\"sample.png\" alt=\"サンプル画像\"></p>",
      "<p><span style=\"font-weight:700\">spanの太字</span> / <span style=\"text-decoration:underline\">spanの下線</span></p>",
      "<section><p>section内の本文</p></section>",
      "<!-- HTMLコメントは表示されません -->"
    ].join("\n");
  }

  /**
   * pixiv小説記法で再現できる範囲を明示したテスト原稿を作ります。
   */
  function pixivSampleSource() {
    return [
      "[chapter:見出し1：通常]",
      "[chapter:見出し1：太字は章全体へ指定できません]",
      "本文：通常",
      "[b:本文：太字]",
      "[[emphasismark:本文：下線 > ・]]",
      "本文：太字＋下線はpixiv記法から直接変換できません"
    ].join("\n\n");
  }

  /**
   * 選択中の原稿形式に合うサンプル生成器へ処理を振り分けます。
   */
  function sampleSource(format) {
    if (format === "html") return htmlSampleSource();
    if (format === "pixiv") return pixivSampleSource();
    if (format === "text") return "本文：通常\n\nプレーンテキストでは見出し・注釈・太字・下線を識別できません。";
    return format === "obsidian" ? obsidianSampleSource() : markdownSampleSource();
  }

  /**
   * 形式カタログの内容から、対応表・残すもの・簡略化・除外の案内を組み立てます。
   * 説明文を変えるだけなら app.js ではなく format-catalog.js を編集します。
   */
  function updateFormatHelp() {
    const description = formatDescriptions[el.format.value] || formatDescriptions.obsidian;
    el.formatHelp.replaceChildren();
    for (const [key, label] of [["identifiers", "対応している識別子"], ["keep", "残すもの"], ["simplify", "簡略化するもの"], ["exclude", "除外するもの"]]) {
      const group = document.createElement("section");
      group.className = `format-help-group ${key}`;
      const heading = document.createElement("strong");
      heading.textContent = label;
      if (key === "identifiers") {
        const hasOfficialMeaning = description.identifiers.some((row) => row.length === 3);
        const table = document.createElement("table");
        const head = document.createElement("thead");
        const headRow = document.createElement("tr");
        for (const text of hasOfficialMeaning ? ["識別子", "公式上の意味", "TALTOでの表示"] : ["原稿上の記述", "TALTOでの表示"]) {
          const cell = document.createElement("th"); cell.scope = "col"; cell.textContent = text; headRow.append(cell);
        }
        head.append(headRow); table.append(head);
        const body = document.createElement("tbody");
        for (const rowData of description.identifiers) {
          const row = document.createElement("tr");
          for (const text of rowData) { const cell = document.createElement("td"); cell.textContent = text; row.append(cell); }
          body.append(row);
        }
        table.append(body); group.append(heading, table);
        if (description.references?.length) {
          const references = document.createElement("p");
          references.className = "official-references";
          references.append("公式案内：");
          description.references.forEach(([text, href], index) => {
            if (index) references.append("・");
            const link = document.createElement("a");
            link.href = href; link.target = "_blank"; link.rel = "noopener noreferrer"; link.textContent = text.replace(/^.+：/, "");
            references.append(link);
          });
          group.append(references);
        }
        el.formatHelp.append(group); continue;
      }
      const list = document.createElement("ul");
      for (const text of description[key]) {
        const item = document.createElement("li");
        item.textContent = text;
        list.append(item);
      }
      group.append(heading, list);
      el.formatHelp.append(group);
    }
  }

  // ===== 3. カスタム識別子とテーマ =====
  const markerModeFor = (type) => markerModeInputs.find((input) => input.dataset.markerMode === type && input.checked)?.value || "wrap";

  /**
   * 識別子方式に応じて、1個入力欄と前後2個の入力欄を切り替えます。
   */
  function updateMarkerInputVisibility(type) {
    const isPair = markerModeFor(type) === "pair";
    document.querySelector(`[data-single-marker="${type}"]`).hidden = isPair;
    document.querySelector(`[data-pair-markers="${type}"]`).hidden = !isPair;
  }

  /**
   * 画面に入力された識別子設定を、変換処理が受け取れる一つのオブジェクトへまとめます。
   */
  function markerConfig(type) {
    return {
      marker: el[`${type}Marker`].value,
      startMarker: el[`${type}StartMarker`].value,
      endMarker: el[`${type}EndMarker`].value,
      mode: markerModeFor(type)
    };
  }

  /**
   * テーマ選択を実際の明暗へ解決し、CSSが参照するdata属性へ反映します。
   */
  function applyTheme(value) {
    const theme = ["light", "dark"].includes(value) ? value : "system";
    const resolved = theme === "system" ? (themeMedia.matches ? "dark" : "light") : theme;
    el.themeMode.value = theme;
    document.documentElement.dataset.theme = theme;
    document.documentElement.dataset.resolvedTheme = resolved;
    el.themeColor.content = resolved === "dark" ? "#17151c" : "#f7f6f2";
  }

  /**
   * テーマを適用し、必要な場合だけ次回起動用にブラウザへ保存します。
   */
  function setTheme(value, shouldSave = true) {
    applyTheme(value);
    if (!shouldSave) return;
    try { localStorage.setItem(themeStorageKey, el.themeMode.value); } catch { /* 保存できない環境でも表示切替は続ける */ }
  }

  /**
   * 前回のテーマ設定を復元します。保存が読めない環境ではシステム設定を使います。
   */
  function restoreTheme() {
    let saved = "system";
    try { saved = localStorage.getItem(themeStorageKey) || "system"; } catch { /* システム設定を使う */ }
    applyTheme(saved);
  }

  /**
   * 画面下部の一時メッセージを表示します。エラー時は見分けられる色も付けます。
   */
  function setStatus(message, isError = false) {
    clearTimeout(statusTimer);
    el.status.textContent = message;
    el.status.classList.toggle("error", isError);
    el.status.hidden = !message;
    if (message && !isError) statusTimer = setTimeout(() => { el.status.hidden = true; }, 6000);
  }

  /**
   * 原稿欄の近くへ、読込結果や形式混在などの案内を表示します。
   */
  function setSourceFeedback(message, isError = false) {
    el.sourceFeedback.textContent = message;
    el.sourceFeedback.classList.toggle("error", isError);
    el.sourceFeedback.hidden = !message;
  }

  /**
   * 貼り付け・ファイル・フォルダのうち、現在どれだけが変換対象かを明示します。
   */
  function updateSourcePriority() {
    const hasPaste = Boolean(el.source.value.trim());
    const hasFiles = collections.files.documents.length > 0;
    const hasFolder = collections.folder.documents.length > 0;
    const retained = [hasPaste && sourceMode !== "paste", hasFiles && sourceMode !== "files", hasFolder && sourceMode !== "folder"].filter(Boolean).length;
    const selectedLabel = sourceMode === "paste" ? "貼り付けた原稿" : sourceMode === "folder" ? "選択したフォルダ" : "追加したファイル";
    el.sourcePriority.textContent = `変換対象：${selectedLabel}${retained ? "。ほかの入力は保持しています。" : ""}`;
  }

  /**
   * 入力方法を一つだけ有効にし、隠れた別入力が混ざらないようにします。
   */
  function setSourceMode(next, shouldSave = true) {
    sourceMode = ["files", "folder"].includes(next) ? next : "paste";
    for (const input of sourceModeInputs) input.checked = input.value === sourceMode;
    el.pasteSourcePanel.hidden = sourceMode !== "paste";
    el.fileSourcePanel.hidden = sourceMode !== "files";
    el.folderSourcePanel.hidden = sourceMode !== "folder";
    el.collectionSourcePanel.hidden = sourceMode === "paste";
    if (sourceMode !== "paste") {
      rebuildFileCombination(sourceMode);
      renderFileList();
      el.loadedRow.hidden = activeCollection().documents.length === 0;
    }
    setSourceFeedback("");
    updateSourcePriority();
    if (shouldSave) saveSettings();
    convert();
  }

  /**
   * コピー形式の選択に合わせ、ボタンの文言も同じ言葉へ揃えます。
   */
  function updateCopyButtonLabel() {
    const labels = { rich: "リッチテキストをコピー", plain: "書式なしテキストをコピー", html: "HTMLをコピー" };
    el.copyResultText.textContent = labels[el.copyFormat.value] || labels.rich;
  }

  /**
   * 以前のコピー結果を消し、現在の操作結果と取り違えないようにします。
   */
  function clearCopyFeedback() {
    el.copyFeedback.hidden = true;
    el.copyFeedback.textContent = "";
    el.copyFeedback.classList.remove("error");
    updateCopyButtonLabel();
  }

  /**
   * コピーの成功・失敗を、ボタン直下とステータス表示の両方へ知らせます。
   */
  function showCopyFeedback(message, isError = false) {
    el.copyFeedback.textContent = message;
    el.copyFeedback.classList.toggle("error", isError);
    el.copyFeedback.hidden = false;
    updateCopyButtonLabel();
    updateMobileAction();
  }

  /**
   * 閉じた設定欄でも有効項目が分かるよう、短い要約を再計算します。
   */
  // ===== 4. 設定の要約・保存・復元 =====
  function updateSettingSummaries() {
    const bold = [el.boldH1, el.boldH2, el.boldH3].filter((input) => input.checked).length;
    const underlined = [el.underlineH1, el.underlineH2, el.underlineH3, el.underlineNote, el.underlineBody].filter((input) => input.checked).length;
    const listStyles = [el.listPrefixBold, el.listPrefixUnderline, el.listContentBold, el.listContentUnderline].filter((input) => input.checked).length;
    const enabled = [el.removeFirstHeading, el.italicAsNote, el.removeHorizontalRules].filter((input) => input.checked).length;
    el.headingSettingsSummary.textContent = bold || underlined ? `太字${bold}・下線${underlined}` : "追加書式なし";
    const marker = el.listMarker.value;
    const markerLabel = marker === "" ? "冒頭なし" : marker.trim() === "" ? `冒頭に空白${marker.length}文字` : `冒頭「${marker.replaceAll(" ", "␠")}」`;
    el.listSettingsSummary.textContent = listStyles ? `${markerLabel}・書式${listStyles}件` : markerLabel;
    const underlineMode = markerModeFor("underline");
    const underlineMarker = el.underlineMarker.value || "無効";
    const underlinePair = `${el.underlineStartMarker.value || "無効"}文字${el.underlineEndMarker.value || "無効"}`;
    el.markerSettingsSummary.textContent = `下線 ${underlineMode === "wrap" ? `${underlineMarker}文字${underlineMarker}` : underlineMode === "pair" ? underlinePair : underlineMode === "start" ? `${underlineMarker} 行頭` : `行末 ${underlineMarker}`}`;
    el.conversionSettingsSummary.textContent = el.disableSizeLimits.checked ? `${enabled}件有効・容量制限解除中` : `${enabled}件有効`;
    el.sizeLimitWarning.hidden = !el.disableSizeLimits.checked;
  }

  /**
   * 画面の設定値だけをJSON化できる形へ集めます。原稿本文は含めません。
   */
  function settingsData() {
    const values = Object.fromEntries(spacingTypes.flatMap((type) => ["Before", "After"].map((side) => {
      const id = `${type}${side}`;
      return [id, count(el[id].value)];
    })));
    return {
      app: "unofficial-talto-migration-helper", version: 2, appVersion, mode, sourceMode, format: el.format.value,
      values, consecutiveHeadingSpacing: count(el.consecutiveHeadingSpacing.value), listMarker: el.listMarker.value,
      markers: Object.fromEntries(markerTypes.map((type) => [type, markerConfig(type)])),
      toggles: Object.fromEntries(toggleIds.map((id) => [id, el[id].checked])),
      open: { heading: el.headingSettings.open, list: el.listSettings.open, marker: el.markerSettings.open, conversion: el.conversionSettings.open }
    };
  }

  /**
   * 保存済み設定を画面へ戻します。欠けた値は現在の既定値を維持します。
   */
  function applySettingsData(saved, forceCustom = false) {
    if (!saved || ![1, 2].includes(saved.version)) throw new Error("このツールの設定ファイルとして認識できません。");
    if (saved.version === 2 && saved.app !== "unofficial-talto-migration-helper") throw new Error("別のアプリの設定ファイルです。");
    mode = forceCustom ? "custom" : saved.mode === "custom" ? "custom" : "unified";
    if (!forceCustom) sourceMode = ["files", "folder"].includes(saved.sourceMode) ? saved.sourceMode : "paste";
    if (["text", "commonmark", "gfm", "obsidian", "pixiv", "html"].includes(saved.format)) el.format.value = saved.format;
    for (const input of modeInputs) input.checked = input.value === mode;
    for (const input of sourceModeInputs) input.checked = input.value === sourceMode;
    for (const type of spacingTypes) for (const side of ["Before", "After"]) {
      const id = `${type}${side}`;
      if (saved.values?.[id] !== undefined) el[id].value = String(count(saved.values[id]));
    }
    el.consecutiveHeadingSpacing.value = String(count(saved.consecutiveHeadingSpacing));
    if (typeof saved.listMarker === "string") el.listMarker.value = saved.listMarker;
    for (const type of markerTypes) {
      if (typeof saved.markers?.[type]?.marker === "string") el[`${type}Marker`].value = saved.markers[type].marker;
      if (typeof saved.markers?.[type]?.startMarker === "string") el[`${type}StartMarker`].value = saved.markers[type].startMarker;
      if (typeof saved.markers?.[type]?.endMarker === "string") el[`${type}EndMarker`].value = saved.markers[type].endMarker;
      const savedMode = ["wrap", "pair", "start", "end"].includes(saved.markers?.[type]?.mode) ? saved.markers[type].mode : "wrap";
      for (const input of markerModeInputs.filter((item) => item.dataset.markerMode === type)) input.checked = input.value === savedMode;
      updateMarkerInputVisibility(type);
    }
    for (const id of toggleIds) if (typeof saved.toggles?.[id] === "boolean") el[id].checked = saved.toggles[id];
    el.headingSettings.open = saved.open?.heading === true;
    el.listSettings.open = saved.open?.list === true;
    el.markerSettings.open = saved.open?.marker === true;
    el.conversionSettings.open = saved.open?.conversion === true;
    customInitialized = forceCustom || mode === "custom" || spacingTypes.slice(1).some((type) => count(el[`${type}Before`].value) || count(el[`${type}After`].value));
    el.unifiedSpacing.hidden = mode !== "unified";
    el.customSpacing.hidden = mode !== "custom";
    updateFormatHelp();
  }

  /**
   * 設定をブラウザ内へ保存します。保存禁止環境でも変換自体は止めません。
   */
  function saveSettings() {
    try { localStorage.setItem(storageKey, JSON.stringify(settingsData())); }
    catch { /* The converter still works when browser storage is unavailable. */ }
  }

  /**
   * 起動時に前回設定を読み込みます。壊れたデータは無視して既定値で続行します。
   */
  function restoreSettings() {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || "null");
      if (saved) applySettingsData(saved);
    } catch { /* Ignore invalid or unavailable local settings. */ }
  }

  /**
   * ホーム画面と変換画面を切り替えます。
   */
  // ===== 5. 作業画面、変換、プレビュー =====
  function setView(view) {
    const isHome = view === "home";
    document.body.dataset.view = isHome ? "home" : "helper";
    el.homeView.hidden = !isHome;
    el.appView.hidden = isHome;
    updateMobileAction();
    window.scrollTo({ top: 0, behavior: "auto" });
    if (!isHome) requestAnimationFrame(() => document.getElementById("sourceHeading")?.focus({ preventScroll: true }));
  }

  /**
   * 画面全体の設定を、converter.jsへ渡す一つの変換オプションへ組み立てます。
   */
  function options() {
    return {
      title: "", firstH1AsTitle: false, removeFirstHeading: el.removeFirstHeading.checked,
      includeLeadingSpacing: el.includeLeadingSpacing.checked,
      includeTrailingSpacing: el.includeTrailingSpacing.checked,
      italicAsNote: el.italicAsNote.checked, removeHorizontalRules: el.removeHorizontalRules.checked,
      consecutiveHeadingSpacing: count(el.consecutiveHeadingSpacing.value),
      boldHeadings: { h1: el.boldH1.checked, h2: el.boldH2.checked, h3: el.boldH3.checked },
      underlineBlocks: {
        h1: el.underlineH1.checked, h2: el.underlineH2.checked, h3: el.underlineH3.checked,
        note: el.underlineNote.checked, body: el.underlineBody.checked
      },
      listMarker: el.listMarker.value,
      listPrefixBold: el.listPrefixBold.checked, listPrefixUnderline: el.listPrefixUnderline.checked,
      listContentBold: el.listContentBold.checked, listContentUnderline: el.listContentUnderline.checked,
      inlineMarkers: Object.fromEntries(markerTypes.map((type) => [type, markerConfig(type)])),
      frontmatterStarts: sourceMode === "paste" ? [0] : activeCollection().starts,
      spacingMode: mode,
      spacing: Object.fromEntries(spacingTypes.map((type) => [type, {
        before: count(el[`${type}Before`].value), after: count(el[`${type}After`].value)
      }]))
    };
  }

  /**
   * スマホ下部の固定ボタンを、現在の手順に合う次の操作へ更新します。
   */
  function updateMobileAction(temporaryLabel = "") {
    const isPreview = document.body.dataset.step === "preview";
    const nextLabels = { source: "形式へ", format: "設定へ", settings: "確認へ" };
    el.mobileActionText.textContent = temporaryLabel || (isPreview ? `${el.copyFormat.selectedOptions[0].textContent}をコピー` : nextLabels[document.body.dataset.step] || "次へ");
    el.mobileAction.lastElementChild.textContent = isPreview ? "↗" : "→";
    el.mobileAction.disabled = isPreview ? !result.html : !activeSource().trim() || mixedFilesBlocked();
  }

  /**
   * スマホ表示の4手順を切り替え、対象カードまで移動します。
   */
  function setStep(step) {
    document.body.dataset.step = step;
    for (const button of stepButtons) {
      if (button.dataset.stepTarget === step) button.setAttribute("aria-current", "step");
      else button.removeAttribute("aria-current");
    }
    updateMobileAction();
    // スマホでは工程ごとにカードを切り替えるため、新しいカードの先頭から読めるよう最上部へ戻します。
    // 工程タブ自体は画面上部に固定されているので、scrollIntoView では位置が変わりません。
    if (window.matchMedia("(max-width: 900px)").matches) {
      window.scrollTo({ top: 0, behavior: "auto" });
    }
  }

  /**
   * 最新の変換結果を安全なプレビューへ反映し、警告や件数も更新します。
   */
  function render() {
    const hasSource = Boolean(activeSource().trim()) && !mixedFilesBlocked();
    el.sourceCount.textContent = `${el.source.value.length.toLocaleString()}文字`;
    const collection = activeCollection();
    el.fileCount.textContent = sourceMode !== "paste" && collection.documents.length ? `${collection.combinedText.length.toLocaleString()}文字` : "";
    el.sample.disabled = false;
    el.emptyPreview.hidden = hasSource;
    el.preview.innerHTML = result.html;
    el.resultCount.textContent = hasSource
      ? `本文 ${result.plainText.replace(/\n/g, "").length.toLocaleString()}文字 · 画像 ${result.images.length}件`
      : "原稿を待っています";
    el.copyResult.disabled = !result.html;
    refreshManualCopy();
    el.warnings.replaceChildren();
    for (const warning of result.warnings) {
      const item = document.createElement("li");
      item.textContent = warning;
      el.warnings.append(item);
    }
    el.warningDetails.hidden = !result.warnings.length;
    el.warningSummary.textContent = `変換メモ · ${result.warnings.length}件`;
    updateSettingSummaries();
    updateCopyButtonLabel();
    updateMobileAction();
  }

  /**
   * 現在選ばれている原稿と形式を読み、対応する変換関数を呼ぶ中心処理です。
   * 形式混在など安全に判断できない状態では、変換せず理由を表示します。
   */
  function convert(preserveCopyFeedback = false) {
    clearTimeout(conversionTimer);
    if (!preserveCopyFeedback) clearCopyFeedback();
    updateSourcePriority();
    if (mixedFilesBlocked()) {
      result = { title: "", html: "", plainText: "", warnings: ["HTML拡張子とその他の原稿ファイルが混在しているため、変換を停止しました。"], images: [] };
      render();
      return false;
    }
    try {
      const settings = options();
      const text = activeSource();
      const format = activeFormat();
      if (format === "html") result = TaltoMarkdown.normalizeHtml(text, settings);
      else if (format === "text") result = TaltoMarkdown.parsePlainText(text, settings);
      else if (format === "pixiv") result = TaltoMarkdown.parsePixiv(text, settings);
      else result = TaltoMarkdown.parseMarkdown(text, { ...settings, markdownFlavor: format });
      render();
      return true;
    } catch (error) {
      result = { title: "", html: "", plainText: "", warnings: [], images: [] };
      render();
      const message = `変換できませんでした：${error.message}`;
      showCopyFeedback(message, true);
      setStatus(message, true);
      return false;
    }
  }

  /**
   * ファイル一覧を上から下へ結合し直します。
   * ファイル間には改行を入れ、隣の文章がつながらないようにします。
   */
  // ===== 6. ファイルの結合・並べ替え・読込 =====
  function rebuildFileCombination(collectionMode = sourceMode) {
    const collection = collections[collectionMode === "folder" ? "folder" : "files"];
    const formats = new Set(collection.documents.map((item) => item.format));
    collection.format = formats.size === 1 && collection.documents.length ? collection.documents[0].format : "markdown";
    const targetFormat = el.format.value;
    const texts = collection.documents.map((item) => {
      const normalized = item.text.replace(/\r\n?/g, "\n").replace(/^\uFEFF/, "");
      if (targetFormat !== "html" || item.format !== "html") return normalized;
      const parsed = new DOMParser().parseFromString(normalized, "text/html");
      return parsed.body.innerHTML;
    }).filter((text) => text.trim());
    // \u5404\u30D5\u30A1\u30A4\u30EB\u306E\u5148\u982D\u884C\u756A\u53F7\u3092\u8A18\u9332\u3057\u307E\u3059\u3002\u30D5\u30A1\u30A4\u30EB\u9593\u306B\u306F\u7A7A\u884C1\u3064\uFF08"\n\n"\uFF09\u3092\u631F\u3080\u305F\u3081\u3001
    // \u6B21\u306E\u30D5\u30A1\u30A4\u30EB\u306F\u300C\u524D\u306E\u30D5\u30A1\u30A4\u30EB\u306E\u884C\u6570 + 1\u300D\u884C\u76EE\u304B\u3089\u59CB\u307E\u308A\u307E\u3059\u3002
    const starts = [];
    let lineOffset = 0;
    for (const text of texts) {
      starts.push(lineOffset);
      lineOffset += text.split("\n").length + 1;
    }
    collection.combinedText = texts.join("\n\n");
    collection.starts = starts.length ? starts : [0];
    if (collection === activeCollection()) {
      el.loadedSummary.textContent = `${collection.documents.length}ファイルを上から順に結合`;
      el.fileCount.textContent = `${collection.combinedText.length.toLocaleString()}文字`;
      el.mixedFormatWarning.hidden = formats.size < 2;
      if (formats.size < 2) el.forceMixedFormats.checked = false;
    }
  }

  /**
   * 保持中のファイルを並べ替え・削除できる一覧として描画します。
   */
  function renderFileList() {
    const collection = activeCollection();
    el.loadedFiles.replaceChildren();
    collection.documents.forEach((item, index) => {
      const listItem = document.createElement("li");
      listItem.draggable = true;
      listItem.dataset.index = String(index);
      const name = document.createElement("span");
      name.className = "file-item-name";
      name.textContent = item.name;
      const format = document.createElement("small");
      format.textContent = item.format === "html" ? "HTML拡張子" : "テキスト系拡張子";
      name.append(format);
      const controls = document.createElement("span");
      controls.className = "file-order-buttons";
      for (const [direction, label, symbol] of [[-1, "上へ移動", "↑"], [1, "下へ移動", "↓"]]) {
        const button = document.createElement("button");
        button.type = "button";
        button.dataset.move = String(direction);
        button.dataset.index = String(index);
        button.setAttribute("aria-label", `${item.name}を${label}`);
        button.textContent = symbol;
        button.disabled = direction < 0 ? index === 0 : index === collection.documents.length - 1;
        controls.append(button);
      }
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "file-remove";
      remove.dataset.remove = String(index);
      remove.setAttribute("aria-label", `${item.name}を一覧から削除`);
      remove.textContent = "×";
      controls.append(remove);
      listItem.append(name, controls);
      el.loadedFiles.append(listItem);
    });
  }

  /**
   * 一覧内の1ファイルを移動し、その順番で結合と変換をやり直します。
   */
  function moveFile(from, to) {
    const collection = activeCollection();
    if (from === to || from < 0 || to < 0 || from >= collection.documents.length || to >= collection.documents.length) return;
    const [moved] = collection.documents.splice(from, 1);
    collection.documents.splice(to, 0, moved);
    rebuildFileCombination();
    renderFileList();
    setSourceFeedback(`結合順を変更しました。${to + 1}番目は${moved.name}です。`);
    convert();
  }

  /**
   * 一覧から対象だけを外します。利用者の元ファイルそのものは削除しません。
   */
  function removeFile(index) {
    const collection = activeCollection();
    if (index < 0 || index >= collection.documents.length) return;
    const [removed] = collection.documents.splice(index, 1);
    rebuildFileCombination();
    renderFileList();
    if (sourceMode === "folder") el.folderFiles.value = "";
    else el.files.value = "";
    el.loadedRow.hidden = collection.documents.length === 0;
    if (!collection.documents.length) el.mixedFormatWarning.hidden = true;
    setSourceFeedback(`${removed.name}を一覧から外しました。元ファイルは変更していません。`);
    updateSourcePriority();
    convert();
  }

  /**
   * 選ばれたファイルを検査して読み込み、既存一覧の末尾へ追加します。
   * 容量超過・画像・未対応拡張子は、理由を利用者へ伝えて安全に除外します。
   */
  async function loadFiles(fileList, collectionMode = "files") {
    if (!fileList.length) return;
    // 読み込み中に再度選択されても二重に追加しないようにします。
    if (busy) return;
    setBusy("ファイルを読み込んでいます…");
    try {
      const allFiles = Array.from(fileList);
      const textFiles = allFiles
        .filter((file) => /\.(?:md|markdown|html?|txt)$/i.test(file.name))
        .sort((a, b) => collectionMode === "folder"
          ? (a.webkitRelativePath || a.name).localeCompare(b.webkitRelativePath || b.name, "ja", { numeric: true })
          : 0);
      const ignoredImages = allFiles.filter((file) => file.type.startsWith("image/") || /\.(?:png|jpe?g|gif|webp|svg|bmp|avif)$/i.test(file.name)).length;
      const ignoredOther = allFiles.length - textFiles.length - ignoredImages;
      if (!textFiles.length) {
        const ignored = ignoredImages ? `画像${ignoredImages}件は読み込みません。` : "対応する原稿ファイルがありません。";
        setSourceFeedback(`${ignored} .md / .markdown / .html / .htm / .txtを含むフォルダを選んでください。`, true);
        return;
      }
      const sizeCheck = TaltoMarkdown.checkImportSize(textFiles, collectionMode, el.disableSizeLimits.checked);
      if (!sizeCheck.allowed) {
        const detail = sizeCheck.kind === "folder"
          ? `フォルダ内の対象原稿は合計${formatMegabytes(sizeCheck.actual)}で、上限100MBを超えています。`
          : `${sizeCheck.fileName}は${formatMegabytes(sizeCheck.actual)}で、単体上限10MBを超えています。`;
        setSourceFeedback(`${detail} 読み込む場合は、設定の「変換オプション」から「ファイル容量の制限を解除」をONにして、もう一度選択してください。`, true);
        if (collectionMode === "folder") el.folderFiles.value = "";
        else el.files.value = "";
        return;
      }
      const sizeOverrideMessage = sizeCheck.exceeded
        ? " 容量制限を解除して読み込みました。処理が重い場合は操作を中止してください。"
        : "";
      // スマホ・タブレットでは PC より小さい容量で固まりやすいため、上限内でも確認を求めます。
      if (isMobileDevice) {
        const largest = textFiles.reduce((max, file) => Math.max(max, Number(file.size) || 0), 0);
        const total = textFiles.reduce((sum, file) => sum + (Number(file.size) || 0), 0);
        if (largest > mobileSizeWarning.file || total > mobileSizeWarning.total) {
          const detail = largest > mobileSizeWarning.file
            ? `1ファイルが${formatMegabytes(largest)}あります`
            : `合計${formatMegabytes(total)}あります`;
          const proceed = window.confirm(`${detail}。スマートフォン・タブレットでは処理に時間がかかったり、画面が固まったりする可能性があります。\n読み込みますか？（元のファイルは変更されません）`);
          if (!proceed) {
            setSourceFeedback("読み込みを中止しました。原稿を分割するか、PCでの読み込みをお試しください。");
            if (collectionMode === "folder") el.folderFiles.value = "";
            else el.files.value = "";
            return;
          }
        }
      }
      const loaded = await Promise.all(textFiles.map(async (file) => {
        // どのファイルで失敗したか分かるよう、ファイル名を付けて投げ直します。
        let text;
        try { text = await file.text(); }
        catch (error) { throw new Error(`「${file.name}」を読めませんでした（${error.message}）`); }
        return { name: collectionMode === "folder" ? file.webkitRelativePath || file.name : file.name, format: detectFormat(file.name), text };
      }));
      const collection = collections[collectionMode];
      collection.documents.push(...loaded);
      const formats = new Set(collection.documents.map((item) => item.format));
      rebuildFileCombination(collectionMode);
      renderFileList();
      el.loadedRow.hidden = false;
      el.forceMixedFormats.checked = false;
      const ignoredMessage = collectionMode === "folder" && (ignoredImages || ignoredOther)
        ? ` 画像${ignoredImages}件${ignoredOther ? `・その他${ignoredOther}件` : ""}は読み込んでいません。`
        : "";
      setSourceFeedback(formats.size > 1
        ? `HTML拡張子とその他の原稿ファイルが混在しています。「02 形式」で原稿全体の記述形式を選び、内容を確認してから強制実行してください。${ignoredMessage}${sizeOverrideMessage}`
        : `${loaded.length}ファイルを追加し、合計${collection.documents.length}ファイルを結合しました。「02 形式」で原稿全体の記述形式を確認してください。${ignoredMessage}${sizeOverrideMessage}`, formats.size > 1);
      updateSourcePriority();
      convert();
      if (collectionMode === "folder") el.folderFiles.value = "";
      else el.files.value = "";
      setStatus(`${loaded.length}ファイルを追加しました。合計${collection.documents.length}ファイルです。${ignoredMessage}`);
    } catch (error) {
      const message = `ファイルを読み込めませんでした：${error.message}`;
      setSourceFeedback(`${message} ファイル形式と読み取り権限を確認し、そのファイルを外して再度お試しください。`, true);
      setStatus(message, true);
    } finally {
      clearBusy();
    }
  }

  /**
   * 共通の空行数を種類別設定へ複製し、カスタム調整の出発点を揃えます。
   */
  function copyUnifiedToCustom() {
    for (const type of spacingTypes.slice(1)) {
      el[`${type}Before`].value = String(count(el.allBefore.value));
      el[`${type}After`].value = String(count(el.allAfter.value));
    }
    customInitialized = true;
  }

  /**
   * 空行数の増減ボタンへ共通動作を設定します。0〜10の範囲外には進みません。
   */
  function initializeNumberSteppers() {
    for (const input of document.querySelectorAll('input[type="number"]')) {
      if (input.closest(".stepper-field")) continue;
      const label = input.getAttribute("aria-label") || document.querySelector(`label[for="${input.id}"]`)?.textContent.trim() || "数値";
      const field = document.createElement("div");
      field.className = "stepper-field";
      input.before(field);
      field.append(input);
      const controls = document.createElement("span");
      controls.className = "number-stepper";
      for (const [direction, symbol, action] of [[1, "＋", "増やす"], [-1, "−", "減らす"]]) {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = symbol;
        button.setAttribute("aria-label", `${label}を${action}`);
        button.addEventListener("click", () => {
          if (direction > 0) input.stepUp();
          else input.stepDown();
          input.dispatchEvent(new Event("change", { bubbles: true }));
        });
        controls.append(button);
      }
      field.append(controls);
    }
  }

  /**
   * 空行設定を「すべて同じ」と「種類別」のどちらか一方へ切り替えます。
   */
  function setMode(next) {
    mode = next;
    if (mode === "custom" && !customInitialized) copyUnifiedToCustom();
    el.unifiedSpacing.hidden = mode !== "unified";
    el.customSpacing.hidden = mode !== "custom";
    convert();
  }

  /**
   * プレビューのPC幅・スマホ幅を切り替えます。実際の変換HTMLは変えません。
   */
  function setDevice(device) {
    el.previewStage.dataset.device = device;
    el.previewDesktop.setAttribute("aria-pressed", String(device === "desktop"));
    el.previewMobile.setAttribute("aria-pressed", String(device === "mobile"));
  }

  // ===== 7. クリップボード =====
  // Supply the generated HTML explicitly so fallback copying cannot pick up
  // decorative preview CSS or drop the requested empty paragraphs.
  /**
   * Clipboard APIが使えないローカル環境向けの予備コピー処理です。
   * 一時要素を作り、処理後は選択範囲とフォーカスを元に戻します。
   */
  function fallbackCopy(text, html) {
    const active = document.activeElement;
    const selection = window.getSelection();
    const previousRanges = Array.from({ length: selection.rangeCount }, (_, i) => selection.getRangeAt(i).cloneRange());
    const holder = document.createElement("div");
    holder.contentEditable = "true";
    holder.style.cssText = "position:fixed;left:-9999px;top:0;white-space:pre-wrap;";
    if (html) holder.innerHTML = html;
    else holder.textContent = text;
    document.body.append(holder);
    const onCopy = (event) => {
      if (!event.clipboardData) return;
      event.clipboardData.setData("text/plain", text);
      if (html) event.clipboardData.setData("text/html", html);
      event.preventDefault();
    };
    document.addEventListener("copy", onCopy);
    let copied = false;
    try {
      holder.focus({ preventScroll: true });
      const range = document.createRange();
      range.selectNodeContents(holder);
      selection.removeAllRanges();
      selection.addRange(range);
      copied = document.execCommand("copy");
    } finally {
      document.removeEventListener("copy", onCopy);
      holder.remove();
      selection.removeAllRanges();
      for (const range of previousRanges) selection.addRange(range);
      active?.focus({ preventScroll: true });
    }
    if (!copied) throw new Error("コピー機能を利用できません。ブラウザのコピー許可を確認してください。");
  }

  /**
   * コピーに使う文字列と、手動コピー欄へ出す内容を、選択中の形式から決めます。
   */
  function copyPayload() {
    const copyType = el.copyFormat.value;
    if (copyType === "rich") return { copyType, text: result.plainText, html: result.html };
    return { copyType, text: copyType === "html" ? result.html : result.plainText, html: "" };
  }

  /**
   * 自動コピーが失敗した理由を3種類に分けます。案内文と手動コピー欄の説明がこれで変わります。
   *   unsupported … Clipboard API がない、または https でない（file:// で開いた場合など）
   *   denied      … ブラウザが許可しなかった（iOS Safari の権限拒否、ユーザー操作外での呼び出しなど）
   *   failed      … それ以外の失敗
   */
  function classifyCopyFailure(error) {
    if (!navigator.clipboard || !window.isSecureContext) return "unsupported";
    if (error && (error.name === "NotAllowedError" || error.name === "SecurityError")) return "denied";
    return "failed";
  }

  const copyFailureMessages = {
    unsupported: "このブラウザでは自動コピーを使えません。下の欄から手動でコピーしてください。",
    denied: "ブラウザがコピーを許可しませんでした。もう一度ボタンを押しても同じ場合は、下の欄から手動でコピーしてください。",
    failed: "自動コピーに失敗しました。下の欄から手動でコピーしてください。"
  };

  /**
   * Clipboard API で書き込みます。ボタン押下から write() までに await を挟みません。
   * iOS Safari はユーザー操作の同期文脈でしか許可しないため、ここで先に別の非同期処理を待つと必ず失敗します。
   * 戻り値は「書き込みの完了を表す Promise」で、失敗時は理由付きの Error で reject します。
   */
  function writeClipboard({ copyType, text, html }) {
    if (!navigator.clipboard) return Promise.reject(Object.assign(new Error("Clipboard API がありません。"), { name: "NotSupportedError" }));
    if (copyType !== "rich") return navigator.clipboard.writeText(text);
    if (typeof ClipboardItem === "undefined" || !navigator.clipboard.write) {
      // リッチテキストを書けない環境では、書式なしテキストだけでも入れておき、手動コピー欄で本命を案内します。
      return Promise.reject(Object.assign(new Error("リッチテキストのコピーに対応していません。"), { name: "NotSupportedError" }));
    }
    const item = new ClipboardItem({
      "text/html": new Blob([html], { type: "text/html" }),
      "text/plain": new Blob([text], { type: "text/plain" })
    });
    return navigator.clipboard.write([item]);
  }

  /**
   * プルダウンで選んだリッチテキスト・テキスト・HTMLのコピー方法へ振り分けます。
   * 経路は Clipboard API → execCommand の予備 → 手動コピー欄 の順で、後ろへ行くほど利用者の操作が増えます。
   */
  async function copySelectedResult() {
    if (busy) return;
    if (!activeSource().trim()) {
      const message = "先に原稿を入力してください。";
      showCopyFeedback(message, true);
      return setStatus(message, true);
    }
    // 変換に失敗した場合は convert() が原因を表示済みなので、ここでは上書きしません。
    if (!convert(true) || !result.html) return;
    const payload = copyPayload();
    const label = el.copyFormat.selectedOptions[0].textContent;
    const succeed = () => {
      const message = `${label}をコピーしました。TALTOへ貼り付けた後に表示と保存済み状態を確認してください。`;
      closeManualCopy();
      showCopyFeedback(message);
      setStatus(message);
    };
    // writeClipboard() は同期的に呼び出す必要があるため、処理中表示はその後に立てます（await を挟まない）。
    const pending = writeClipboard(payload);
    setBusy("コピーしています…");
    let reason;
    try {
      await pending;
      clearBusy();
      return succeed();
    } catch (error) {
      reason = classifyCopyFailure(error);
    }
    clearBusy();
    // 予備経路。iOS では効かないことが多いので、失敗しても例外を表に出さず手動コピー欄へ進みます。
    try {
      fallbackCopy(payload.text, payload.html);
      return succeed();
    } catch { /* 手動コピーへ */ }
    const message = copyFailureMessages[reason];
    showCopyFeedback(message, true);
    // 理由はボタン直下と手動コピー欄に出すので、画面下部の通知は消してスマホで欄を隠さないようにします。
    setStatus("");
    openManualCopy(message);
  }

  /**
   * 手動コピー欄を開き、選択中の形式に合わせて内容を入れます。
   * リッチテキストは編集可能領域に HTML として置き、利用者が「すべて選択→コピー」すると
   * ブラウザが text/html と text/plain の両方をクリップボードへ入れるため、TALTO へ書式付きで貼り付けられます。
   */
  function openManualCopy(reason = "", { scroll = true } = {}) {
    if (!result.html) {
      const message = "先に原稿を入力してください。";
      showCopyFeedback(message, true);
      return setStatus(message, true);
    }
    const payload = copyPayload();
    el.manualCopyReason.textContent = reason;
    el.manualCopyReason.hidden = !reason;
    el.manualCopyRich.hidden = payload.copyType !== "rich";
    el.manualCopyText.hidden = payload.copyType === "rich";
    if (payload.copyType === "rich") el.manualCopyRich.innerHTML = payload.html;
    else el.manualCopyText.value = payload.text;
    el.manualCopyFeedback.hidden = true;
    el.manualCopy.hidden = false;
    if (scroll) el.manualCopy.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }

  function closeManualCopy() {
    el.manualCopy.hidden = true;
    el.manualCopyRich.innerHTML = "";
    el.manualCopyText.value = "";
  }

  /** 手動コピー欄が開いている間に変換結果や形式が変わったら、欄の中身も追従させます。 */
  function refreshManualCopy() {
    if (el.manualCopy.hidden) return;
    if (!result.html) return closeManualCopy();
    // 入力のたびに呼ばれるため、画面を勝手にスクロールさせません。
    openManualCopy(el.manualCopyReason.hidden ? "" : el.manualCopyReason.textContent, { scroll: false });
  }

  /**
   * 手動コピー欄の内容をすべて選択します。選択後のコピーはブラウザのメニュー操作に任せます。
   * iOS では選択範囲を作ると「コピー」の吹き出しが出るため、長押しの手間を省けます。
   */
  function selectManualCopy() {
    if (!el.manualCopyText.hidden) {
      el.manualCopyText.focus({ preventScroll: true });
      el.manualCopyText.setSelectionRange(0, el.manualCopyText.value.length);
    } else {
      el.manualCopyRich.focus({ preventScroll: true });
      const range = document.createRange();
      range.selectNodeContents(el.manualCopyRich);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
    }
    el.manualCopyFeedback.textContent = "選択しました。表示されたメニューか、Ctrl+C（Macは⌘C）で「コピー」してください。";
    el.manualCopyFeedback.classList.remove("error");
    el.manualCopyFeedback.hidden = false;
  }

  /**
   * 設定ファイルの保存・読込結果を設定欄の近くへ表示します。
   */
  // ===== 8. 設定ファイルとテスト原稿 =====
  function showSettingsFileFeedback(message, isError = false) {
    el.settingsFileFeedback.textContent = message;
    el.settingsFileFeedback.classList.toggle("error", isError);
    el.settingsFileFeedback.hidden = !message;
  }

  /**
   * 原稿を含まない設定JSONをテキストファイルとしてダウンロードします。
   */
  function exportSettingsFile() {
    const blob = new Blob([JSON.stringify(settingsData(), null, 2)], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const date = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.download = `talto-helper-settings-${date}.txt`;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showSettingsFileFeedback("設定ファイルをダウンロードフォルダへ保存しました。");
    setStatus("設定ファイルを保存しました。");
  }

  /**
   * 設定ファイルを検査して適用します。不正なJSONは既存設定を壊さず拒否します。
   */
  async function importSettingsFile(file) {
    if (!file) return;
    try {
      if (file.size > 1024 * 1024) throw new Error("設定ファイルは1MB以下のテキストファイルを選んでください。");
      const saved = JSON.parse((await file.text()).replace(/^\uFEFF/, ""));
      applySettingsData(saved, true);
      saveSettings();
      convert();
      showSettingsFileFeedback(`${file.name}を読み込み、カスタム設定として適用しました。`);
      setStatus("設定ファイルをカスタム設定として適用しました。");
    } catch (error) {
      showSettingsFileFeedback(`読み込めませんでした：${error.message}`, true);
      setStatus("設定ファイルを読み込めませんでした。", true);
    } finally {
      el.importSettings.value = "";
    }
  }

  /**
   * 現在の形式に対応したテスト原稿へ置き換えます。既存原稿がある場合は先に確認します。
   */
  function loadSample() {
    if (el.source.value.trim() && !window.confirm("貼り付けた原稿を対応識別子のテスト原稿に置き換えますか？\nこの操作は元に戻せません。")) return;
    setSourceMode("paste");
    el.source.value = sampleSource(el.format.value);
    updateSourcePriority();
    convert();
    setStatus(`${el.format.selectedOptions[0].textContent}の対応識別子を使ったテスト原稿を読み込みました。`);
  }

  /**
   * ここから下は画面操作と上の関数を結び付けるイベント登録です。
   * 処理本体をイベント内へ詰め込まず、名前の付いた関数へ渡すことで追いやすくしています。
   */
  // ===== 9. 利用者の操作を各処理へ結び付ける =====
  el.files.addEventListener("change", () => loadFiles(el.files.files, "files"));
  el.folderFiles.addEventListener("change", () => loadFiles(el.folderFiles.files, "folder"));
  sourceModeInputs.forEach((input) => input.addEventListener("change", () => setSourceMode(input.value)));
  el.loadedFiles.addEventListener("click", (event) => {
    const remove = event.target.closest("button[data-remove]");
    if (remove) return removeFile(Number(remove.dataset.remove));
    const button = event.target.closest("button[data-move]");
    if (!button) return;
    const from = Number(button.dataset.index);
    moveFile(from, from + Number(button.dataset.move));
  });
  el.loadedFiles.addEventListener("dragstart", (event) => {
    const item = event.target.closest("li[data-index]");
    if (!item) return;
    draggedFileIndex = Number(item.dataset.index);
    item.classList.add("dragging");
    event.dataTransfer.effectAllowed = "move";
  });
  el.loadedFiles.addEventListener("dragover", (event) => {
    const item = event.target.closest("li[data-index]");
    if (!item) return;
    event.preventDefault();
    el.loadedFiles.querySelectorAll(".drop-target").forEach((node) => node.classList.remove("drop-target"));
    item.classList.add("drop-target");
    event.dataTransfer.dropEffect = "move";
  });
  el.loadedFiles.addEventListener("drop", (event) => {
    const item = event.target.closest("li[data-index]");
    if (!item) return;
    event.preventDefault();
    const targetIndex = Number(item.dataset.index);
    el.loadedFiles.querySelectorAll(".drop-target,.dragging").forEach((node) => node.classList.remove("drop-target", "dragging"));
    moveFile(draggedFileIndex, targetIndex);
    draggedFileIndex = -1;
  });
  el.loadedFiles.addEventListener("dragend", () => {
    el.loadedFiles.querySelectorAll(".drop-target,.dragging").forEach((node) => node.classList.remove("drop-target", "dragging"));
    draggedFileIndex = -1;
  });
  el.forceMixedFormats.addEventListener("change", () => {
    setSourceFeedback(el.forceMixedFormats.checked
      ? `${el.format.selectedOptions[0].textContent}として強制実行します。プレビューを必ず確認してください。`
      : "形式が混在しているため変換を停止しました。", !el.forceMixedFormats.checked);
    convert();
  });
  // ドロップ領域はファイル用とフォルダ用の2つあり、どちらもドラッグ中に強調表示します。
  // ファイル用は落とされたファイル一覧を直接読み込みます。フォルダ用は、フォルダの中身を
  // dataTransfer.files から列挙できないため、ブラウザ標準の「フォルダ入力欄へのドロップ」に任せます。
  for (const dropZone of document.querySelectorAll(".file-drop")) {
    for (const eventName of ["dragenter", "dragover"]) dropZone.addEventListener(eventName, (event) => {
      event.preventDefault(); dropZone.classList.add("dragging");
    });
    for (const eventName of ["dragleave", "drop"]) dropZone.addEventListener(eventName, () => dropZone.classList.remove("dragging"));
    if (dropZone.contains(el.files)) {
      dropZone.addEventListener("drop", (event) => { event.preventDefault(); loadFiles(event.dataTransfer.files, "files"); });
    }
  }
  el.source.addEventListener("input", () => {
    setSourceFeedback("");
    updateSourcePriority();
    clearTimeout(conversionTimer);
    conversionTimer = setTimeout(convert, 120);
  });
  el.source.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") { event.preventDefault(); convert(); setStep("preview"); }
  });
  el.format.addEventListener("change", () => { updateFormatHelp(); if (sourceMode !== "paste") rebuildFileCombination(); convert(); });
  el.themeMode.addEventListener("change", () => setTheme(el.themeMode.value));
  themeMedia.addEventListener?.("change", () => { if (el.themeMode.value === "system") applyTheme("system"); });
  for (const id of toggleIds) el[id].addEventListener("change", () => { saveSettings(); convert(); });
  el.listMarker.addEventListener("input", () => { saveSettings(); convert(); });
  for (const type of markerTypes) for (const suffix of ["Marker", "StartMarker", "EndMarker"]) {
    el[`${type}${suffix}`].addEventListener("input", () => { saveSettings(); convert(); });
  }
  markerModeInputs.forEach((input) => input.addEventListener("change", () => {
    updateMarkerInputVisibility(input.dataset.markerMode); saveSettings(); convert();
  }));
  for (const type of spacingTypes) for (const side of ["Before", "After"]) {
    const input = el[`${type}${side}`];
    input.addEventListener("input", () => {
      const value = Number.parseInt(input.value, 10);
      if (!Number.isNaN(value) && (value < 0 || value > 10)) input.value = String(count(value));
      saveSettings(); convert();
    });
    input.addEventListener("change", () => { input.value = String(count(input.value)); saveSettings(); convert(); });
  }
  el.consecutiveHeadingSpacing.addEventListener("input", () => {
    const value = Number.parseInt(el.consecutiveHeadingSpacing.value, 10);
    if (!Number.isNaN(value) && (value < 0 || value > 10)) el.consecutiveHeadingSpacing.value = String(count(value));
    saveSettings(); convert();
  });
  el.consecutiveHeadingSpacing.addEventListener("change", () => { el.consecutiveHeadingSpacing.value = String(count(el.consecutiveHeadingSpacing.value)); saveSettings(); convert(); });
  modeInputs.forEach((input) => input.addEventListener("change", () => { setMode(input.value); saveSettings(); }));
  el.applyUnified.addEventListener("click", () => { copyUnifiedToCustom(); saveSettings(); convert(); });
  for (const details of [el.headingSettings, el.listSettings, el.markerSettings, el.conversionSettings]) details.addEventListener("toggle", saveSettings);
  el.previewDesktop.addEventListener("click", () => setDevice("desktop"));
  el.previewMobile.addEventListener("click", () => setDevice("mobile"));
  stepButtons.forEach((button) => button.addEventListener("click", () => { convert(); setStep(button.dataset.stepTarget); }));
  el.mobileAction.addEventListener("click", () => {
    const current = document.body.dataset.step;
    if (current === "preview") copySelectedResult();
    else if (convert()) setStep({ source: "format", format: "settings", settings: "preview" }[current] || "preview");
  });
  el.copyFormat.addEventListener("change", () => { clearCopyFeedback(); updateMobileAction(); refreshManualCopy(); });
  el.copyResult.addEventListener("click", copySelectedResult);
  el.openManualCopy.addEventListener("click", () => openManualCopy());
  el.selectManualCopy.addEventListener("click", selectManualCopy);
  el.closeManualCopy.addEventListener("click", closeManualCopy);
  el.exportSettings.addEventListener("click", exportSettingsFile);
  el.importSettings.addEventListener("change", () => importSettingsFile(el.importSettings.files[0]));
  el.sample.addEventListener("click", loadSample);
  el.homeLink.addEventListener("click", () => setView("home"));
  el.startHelper.addEventListener("click", () => setView("helper"));
  el.startHelperFooter.addEventListener("click", () => setView("helper"));
  el.clearFiles.addEventListener("click", () => {
    const collection = activeCollection();
    collection.documents = []; collection.combinedText = ""; collection.starts = [0]; collection.format = "markdown";
    el.files.value = ""; el.folderFiles.value = ""; el.loadedRow.hidden = true; el.loadedFiles.replaceChildren();
    el.mixedFormatWarning.hidden = true; el.forceMixedFormats.checked = false;
    setSourceFeedback(""); updateSourcePriority(); convert();
  });
  el.resetSettings.addEventListener("click", () => {
    for (const type of spacingTypes) for (const side of ["Before", "After"]) el[`${type}${side}`].value = "0";
    el.consecutiveHeadingSpacing.value = "0";
    el.includeLeadingSpacing.checked = false; el.includeTrailingSpacing.checked = false;
    el.removeFirstHeading.checked = false; el.italicAsNote.checked = true; el.removeHorizontalRules.checked = false;
    el.disableSizeLimits.checked = false;
    el.boldH1.checked = false; el.boldH2.checked = false; el.boldH3.checked = false;
    el.underlineH1.checked = false; el.underlineH2.checked = false; el.underlineH3.checked = false; el.underlineNote.checked = false; el.underlineBody.checked = false;
    el.listMarker.value = "・ ";
    el.listPrefixBold.checked = false; el.listPrefixUnderline.checked = false; el.listContentBold.checked = false; el.listContentUnderline.checked = false;
    for (const type of markerTypes) {
      el[`${type}Marker`].value = markerDefaults[type];
      el[`${type}StartMarker`].value = markerDefaults[type];
      el[`${type}EndMarker`].value = markerDefaults[type];
      for (const input of markerModeInputs.filter((item) => item.dataset.markerMode === type)) input.checked = input.value === "wrap";
      updateMarkerInputVisibility(type);
    }
    el.headingSettings.open = false; el.listSettings.open = false; el.markerSettings.open = false; el.conversionSettings.open = false;
    customInitialized = false;
    for (const input of modeInputs) input.checked = input.value === "unified";
    setMode("unified"); saveSettings(); showSettingsFileFeedback("設定を初期値に戻しました。原稿は変更していません。"); setStatus("設定を初期値に戻しました。原稿は変更していません。");
  });
  el.clear.addEventListener("click", () => {
    if (el.source.value.trim() && !window.confirm("貼り付けた原稿を消しますか？読み込んだファイルは変更されません。")) return;
    el.source.value = "";
    setSourceFeedback(""); updateSourcePriority(); convert(); setStatus("");
  });
  /**
   * 最後に初期化を一定の順序で実行します。
   * 部品準備→保存値復元→表示更新→初回変換の順なので、途中の未設定状態が見えません。
   */
  // ===== 9b. 処理中表示・ソフトウェアキーボード・タッチ端末の入力方法 =====
  /**
   * 読み込み中・コピー中の状態を表示し、その間の二重操作を防ぎます。
   * CSS 側で body[data-busy] のボタンを無効化しているため、ここでは状態と通知だけを扱います。
   */
  function setBusy(label) {
    busy = true;
    document.body.dataset.busy = "true";
    setStatus(label);
  }
  function clearBusy() {
    busy = false;
    delete document.body.dataset.busy;
  }

  /**
   * ソフトウェアキーボードが出ている間は、画面下の固定ボタンを隠します。
   * visualViewport の高さが window より大きく縮んだときをキーボード表示とみなします（iOS Safari・Android Chrome 共通）。
   */
  function watchSoftwareKeyboard() {
    const viewport = window.visualViewport;
    if (!viewport || !isTouchDevice) return;
    const update = () => {
      const keyboardOpen = viewport.height < window.innerHeight * 0.75;
      if (keyboardOpen) document.body.dataset.keyboard = "open";
      else delete document.body.dataset.keyboard;
    };
    viewport.addEventListener("resize", update);
    update();
  }

  /**
   * タッチ主体の端末では、フォルダ選択が使えないことが多い（iPhone・iPad は不可、Android は端末次第）ため、
   * 選択肢に「PC向け」と添えて後回しにできるようにし、フォルダ欄に代替手段を示します。機能自体は無効化しません。
   */
  function markFolderForTouch() {
    if (!isTouchDevice) return;
    el.folderModeLabel.textContent = "フォルダ（PC向け）";
    el.folderTouchNote.hidden = false;
  }

  // ===== 10. Web版のオフライン対応と更新案内 =====
  /**
   * Web版（https で配信された場合）だけ Service Worker を登録します。
   * 登録後は配信ファイル一式がキャッシュされ、ネット接続なしでも起動できます。
   * ZIP版や単一ファイル版（file://）では何もしません。ブラウザが file:// での登録を許可しないためです。
   *
   * 新しい版の検出は「すでに動作中の SW がある状態で、別の SW がインストール完了した」ことで判定します。
   * 初回訪問時にも installed は起きますが、その時点では controller が無いので案内を出しません。
   */
  function registerServiceWorker() {
    if (buildKind !== "web" || !("serviceWorker" in navigator) || !/^https?:$/.test(location.protocol)) return;
    el.installHint.hidden = false;
    let reloading = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      // 再読み込みボタンを押した後にだけ再読み込みします。初回登録時の controllerchange では動かしません。
      if (reloading) location.reload();
    });
    navigator.serviceWorker.register("./sw.js").then((registration) => {
      const watch = (worker) => {
        if (!worker) return;
        worker.addEventListener("statechange", () => {
          if (worker.state === "installed" && navigator.serviceWorker.controller) el.updateNotice.hidden = false;
        });
      };
      watch(registration.installing);
      registration.addEventListener("updatefound", () => watch(registration.installing));
      // 起動時にすでに待機中の SW がある場合（前回の更新案内を閉じたまま再訪した場合など）も案内します。
      if (registration.waiting && navigator.serviceWorker.controller) el.updateNotice.hidden = false;
      el.reloadForUpdate.addEventListener("click", () => {
        reloading = true;
        const waiting = registration.waiting;
        if (waiting) waiting.postMessage({ type: "SKIP_WAITING" });
        else location.reload();
      });
    }).catch(() => { /* 登録できなくても通常の Web ページとして動作は続きます */ });
  }

  /**
   * ホーム画面の「端末ごとの始め方」で、いま使っている端末の項目を開きます。
   * 判定は表示の順序と開閉にだけ使い、機能を制限したり隠したりはしません（誤判定しても他の項目を開けば済む）。
   */
  function openDeviceGuide() {
    const item = document.querySelector(`.device-item[data-device="${device}"]`);
    if (!item) return;
    item.open = true;
    item.dataset.recommended = "true";
    // 該当項目を先頭へ移し、スクロールせずに目に入るようにします。
    item.parentElement.insertBefore(item, item.parentElement.querySelector(".device-item"));
  }

  /**
   * 作業中でも開ける「使い方」ダイアログ。PC／スマホ・タブレットのタブを持ち、端末判定で初期表示を決めます。
   * <dialog> に未対応の古いブラウザでは open 属性で代用します（正式対応外だが表示は崩さない）。
   */
  function showHelpTab(target) {
    const isPc = target === "pc";
    el.helpPc.hidden = !isPc;
    el.helpMobile.hidden = isPc;
    el.helpTabPc.setAttribute("aria-selected", String(isPc));
    el.helpTabMobile.setAttribute("aria-selected", String(!isPc));
  }
  function openHelp() {
    showHelpTab(isMobileDevice ? "mobile" : "pc");
    if (typeof el.helpDialog.showModal === "function") el.helpDialog.showModal();
    else el.helpDialog.setAttribute("open", "");
  }
  function closeHelp() {
    if (typeof el.helpDialog.close === "function" && el.helpDialog.open) el.helpDialog.close();
    else el.helpDialog.removeAttribute("open");
  }
  el.openHelp.addEventListener("click", openHelp);
  el.closeHelp.addEventListener("click", closeHelp);
  el.helpTabPc.addEventListener("click", () => showHelpTab("pc"));
  el.helpTabMobile.addEventListener("click", () => showHelpTab("mobile"));
  // 背景（ダイアログ枠の外）をクリックしたら閉じます。
  el.helpDialog.addEventListener("click", (event) => { if (event.target === el.helpDialog) closeHelp(); });

  // 確認画面の貼り付け案内を、端末に合わせた操作で表示します。
  el.pasteHintText.textContent = isMobileDevice
    ? `コピーした内容を、TALTOの本文欄を長押しして「${device === "android" ? "貼り付け" : "ペースト"}」してください。`
    : "コピーした内容を、TALTOの本文欄をクリックして Ctrl+V（Macは⌘V）で貼り付けてください。";

  // ===== 11. 起動時の初期化 =====
  openDeviceGuide();
  markFolderForTouch();
  watchSoftwareKeyboard();
  el.appVersion.textContent = appVersion;
  registerServiceWorker();
  initializeNumberSteppers();
  restoreTheme();
  restoreSettings();
  updateFormatHelp();
  el.unifiedSpacing.hidden = mode !== "unified";
  el.customSpacing.hidden = mode !== "custom";
  el.pasteSourcePanel.hidden = sourceMode !== "paste";
  el.fileSourcePanel.hidden = sourceMode !== "files";
  el.folderSourcePanel.hidden = sourceMode !== "folder";
  el.collectionSourcePanel.hidden = sourceMode === "paste";
  if (sourceMode !== "paste") {
    rebuildFileCombination(sourceMode);
    renderFileList();
    el.loadedRow.hidden = activeCollection().documents.length === 0;
  }
  updateSourcePriority();
  convert();
})();
