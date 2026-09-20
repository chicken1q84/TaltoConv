/**
 * ブラウザとNode.jsテストの両方で同じ変換処理を使うための外枠です。
 * ブラウザでは window.TaltoMarkdown、テストでは module.exports として公開します。
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.TaltoMarkdown = api;
})(typeof window !== "undefined" ? window : null, function () {
  "use strict";

  // ===== 1. 安全な文字列処理と容量制限 =====
  /**
   * 原稿中の記号をHTMLとして実行させず、文字として安全に表示するために変換します。
   */
  const escapeHtml = (value) =>
    String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");

  /**
   * 安全化された基本的なHTML文字参照を、書式なしテキストへ戻します。
   */
  const decodeBasicEntities = (value) =>
    value
      .replaceAll("&nbsp;", " ")
      .replaceAll("&lt;", "<")
      .replaceAll("&gt;", ">")
      .replaceAll("&quot;", '"')
      .replaceAll("&#39;", "'")
      .replaceAll("&amp;", "&");

  /**
   * 変換済みHTMLからコピー用の書式なしテキストを作ります。空行保持の有無も選べます。
   */
  function htmlToPlainText(html, preserveBlankLines = false) {
    if (preserveBlankLines) {
      return decodeBasicEntities(String(html)
        .replace(/<\/(p|h[1-6]|blockquote)>\s*(?=<)/gi, "</$1>")
        .replace(/<p>\s*<br\s*\/?\s*>\s*<\/p>/gi, "<p></p>")
        .replace(/<br\s*\/?\s*>/gi, "\n")
        .replace(/<\/(p|h[1-6]|blockquote)>/gi, "\n")
        .replace(/<[^>]+>/g, ""))
        .replace(/\n$/, "");
    }
    return decodeBasicEntities(
      String(html)
        .replace(/<br\s*\/?\s*>/gi, "\n")
        .replace(/<\/(p|h[1-6]|blockquote)>/gi, "\n\n")
        .replace(/<[^>]+>/g, "")
    )
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  /**
   * 空行設定を必ず0〜10の整数にします。画面外から不正値が来ても増えすぎません。
   */
  const blankLineCount = (value) => Math.max(0, Math.min(10, Number.parseInt(value, 10) || 0));
  const FILE_SIZE_LIMIT = 10 * 1024 * 1024;
  const FOLDER_SIZE_LIMIT = 100 * 1024 * 1024;
  /**
   * 単体ファイル10MB、フォルダ合計100MBの既定上限を検査します。
   * 解除設定が明示された場合だけ上限判定を飛ばします。
   */
  function checkImportSize(files, mode, override = false) {
    const items = Array.from(files || []);
    if (mode === "folder") {
      const actual = items.reduce((total, file) => total + Math.max(0, Number(file.size) || 0), 0);
      return { allowed: override || actual <= FOLDER_SIZE_LIMIT, exceeded: actual > FOLDER_SIZE_LIMIT, kind: "folder", actual, limit: FOLDER_SIZE_LIMIT };
    }
    const oversized = items.find((file) => (Number(file.size) || 0) > FILE_SIZE_LIMIT);
    const actual = oversized ? Number(oversized.size) || 0 : 0;
    return { allowed: override || !oversized, exceeded: Boolean(oversized), kind: "file", actual, limit: FILE_SIZE_LIMIT, fileName: oversized?.name || "" };
  }
  // ===== 2. TALTO向けの書式と空行 =====
  // An empty paragraph is one TALTO blank line. Adding <br> here creates a
  // second Lexical line break inside that paragraph and doubles the spacing.
  /**
   * TALTOで空行になる空の段落を、指定個数だけ作ります。
   */
  const emptyParagraphs = (count) => Array.from({ length: blankLineCount(count) }, () => "<p></p>");
  /**
   * 本文へ太字と下線を重ねます。両方のときもタグの対応が崩れない順序にします。
   */
  const styledContent = (content, bold, underline) => {
    let result = content;
    if (bold) result = `<strong>${result}</strong>`;
    if (underline) result = `<u>${result}</u>`;
    return result;
  };
  /**
   * 見出しレベル別の太字・下線設定を適用します。
   */
  const headingContent = (content, tag, options) => styledContent(
    content,
    options.boldHeadings?.[tag],
    options.underlineBlocks?.[tag]
  );
  const noteContent = (content, options) => styledContent(content, false, options.underlineBlocks?.note);
  const bodyContent = (content, options) => styledContent(content, false, options.underlineBlocks?.body);
  const listPrefixHtml = (value) => escapeHtml(value).replaceAll(" ", "&nbsp;").replaceAll("\t", "&nbsp;&nbsp;&nbsp;&nbsp;");
  /**
   * 疑似箇条書きの先頭記号と本文へ、それぞれ独立した書式を適用します。
   */
  const listItemContent = (prefix, content, options) => {
    const prefixMarkup = styledContent(listPrefixHtml(prefix), options.listPrefixBold, options.listPrefixUnderline);
    const contentMarkup = styledContent(content, options.listContentBold, options.listContentUnderline);
    return `${prefixMarkup}${contentMarkup}`;
  };
  /**
   * 見出し記法をTALTO対応のh1〜h3へ制限し、h4以降は太字本文へ簡略化します。
   */
  const headingBlocks = (markup, options) => [
    ...emptyParagraphs(options.spacingMode ? 0 : options.headingBlankLinesBefore),
    markup,
    ...emptyParagraphs(options.spacingMode ? 0 : options.headingBlankLinesAfter),
  ];

  // Adjacent blocks share a gap: the larger request wins, not their sum.
  // Existing empty HTML paragraphs count toward that gap and are kept.
  /**
   * すべての段落間隔を最後に一度だけ決定します。
   * 隣接設定は加算せず大きい方、連続見出しは専用値を最優先します。
   */
  function applyBlockSpacing(blocks, options) {
    if (!options.spacingMode || !blocks.length) return blocks.join("\n");
    const output = [];
    let previousAfter = 0;
    let previousWasHeading = false;
    let existingBlankLines = 0;
    for (const markup of blocks) {
      if (/^<p>\s*(?:<br\s*\/?\s*>\s*)?<\/p>$/.test(markup)) {
        existingBlankLines += 1;
        continue;
      }
      const tag = /^<(h[123]|blockquote)\b/.exec(markup)?.[1];
      const type = tag === "blockquote" ? "note" : tag || "body";
      const isHeading = /^h[123]$/.test(type);
      const spacing = options.spacing?.[options.spacingMode === "custom" ? type : "all"] || {};
      const before = blankLineCount(spacing.before);
      const isFirstBlock = output.length === 0;
      // A dedicated consecutive-heading value is exact and takes precedence
      // over both headings' ordinary before/after requests and source blanks.
      const gap = previousWasHeading && isHeading && options.consecutiveHeadingSpacing !== undefined
        ? blankLineCount(options.consecutiveHeadingSpacing)
        : isFirstBlock && options.includeLeadingSpacing !== true
          ? 0
          : Math.max(previousAfter, before, existingBlankLines);
      // Existing HTML may contain more than the selectable ten blank lines.
      output.push(...emptyParagraphs(gap), markup);
      previousAfter = blankLineCount(spacing.after);
      previousWasHeading = isHeading;
      existingBlankLines = 0;
    }
    if (options.includeTrailingSpacing === true) {
      output.push(...emptyParagraphs(Math.max(previousAfter, existingBlankLines)));
    }
    return output.join("\n");
  }

  /**
   * 行全体が斜体記法かを判定します。文中斜体と注釈変換を取り違えないための処理です。
   * 認識する例: 「*注意事項*」「_補足_」
   * 認識しない例: 「* 箇条書き *」（記号の内側が空白）「**太字**」
   */
  // ===== 3. Markdownの行内識別子 =====
  const matchItalicOnlyLine = (line) => {
    const match = /^(?:\*(?!\s)([^*\n]+?)(?<!\s)\*|_(?!\s)([^_\n]+?)(?<!\s)_)$/.exec(String(line).trim());
    return match ? match[1] || match[2] : null;
  };

  const markdownEscapablePunctuation = new Set(Array.from("!\"#$%&'()*+,-./:;<=>?@[\\]^_`{|}~"));

  /**
   * 先に確定した安全なHTMLを一時記号へ退避し、後続の文字置換から守ります。
   */
  const tokenized = (tokens, html) => {
    const token = `\u0000TOKEN${tokens.length}\u0000`;
    tokens.push(html);
    return token;
  };

  /**
   * Obsidian内部リンクから、画面に表示される名前を取り出します。
   */
  const wikiLinkLabel = (contents) => {
    const separator = /\\?\|/.exec(contents);
    if (separator) return contents.slice(separator.index + separator[0].length).trim();
    const target = contents.split("#")[0].trim().replace(/\\/g, "/");
    return target.split("/").pop().replace(/\.md$/i, "") || contents.trim();
  };

  /**
   * Obsidian埋め込みからファイル名と任意の表示サイズを分離します。
   */
  const wikiEmbedParts = (contents) => {
    const parts = String(contents).split(/\\?\|/);
    const target = parts[0].trim();
    const customLabel = parts.slice(1).join("|").trim();
    const targetName = target.split("#")[0].replace(/\\/g, "/").split("/").pop() || "名称なし";
    return {
      source: target,
      label: customLabel && !/^\d+(?:x\d+)?$/i.test(customLabel) ? customLabel : targetName
    };
  };

  /**
   * 利用者が指定した識別子を、正規表現の命令ではなく文字として扱えるようにします。
   */
  const escapeRegExp = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const defaultInlineMarkers = {
    bold: { marker: "**", mode: "wrap" },
    italic: { marker: "*", mode: "wrap" },
    strike: { marker: "~~", mode: "wrap" },
    underline: { marker: "==", mode: "wrap" },
  };

  /**
   * 「識別子で挟む」方式の正規表現を作ります。
   * CommonMarkと同じく、開始識別子の直後と終了識別子の直前が空白の場合は書式と見なしません。
   * これがないと「1d6*3 + 1d6*2」の乗算記号が斜体として消えてしまいます。
   * 識別子自体に空白を含む場合は、利用者の意図を優先して空白の検査を行いません。
   * 認識する例: 「**太字**」「==下線==」
   * 認識しない例: 「** 太字 **」「2 * 3 * 4」
   */
  const wrappedMarkerPattern = (encodedStart, encodedEnd, startRaw, endRaw) => {
    const start = escapeRegExp(encodedStart);
    const end = escapeRegExp(encodedEnd);
    // 1文字の識別子（* や _）は「**」のような連続の一部を拾わないよう、隣に同じ記号がないことも確認します。
    const startChar = startRaw.length === 1 ? start : "";
    const endChar = endRaw.length === 1 ? end : "";
    const beforeStart = startChar ? `(?<!${startChar})` : "";
    const afterStart = (/\s/.test(startRaw) ? "" : "(?!\\s)") + (startChar ? `(?!${startChar})` : "");
    const beforeEnd = (/\s/.test(endRaw) ? "" : "(?<!\\s)") + (endChar ? `(?<!${endChar})` : "");
    const afterEnd = endChar ? `(?!${endChar})` : "";
    return new RegExp(`${beforeStart}${start}${afterStart}([^\\n]+?)${beforeEnd}${end}${afterEnd}`, "g");
  };

  /**
   * カスタム識別子の4方式を読み、囲まれた文字へ太字または下線タグを適用します。
   */
  function applyInlineMarker(value, config, fallback, tag) {
    const marker = config?.marker !== undefined ? String(config.marker) : fallback.marker;
    const mode = ["start", "end", "pair"].includes(config?.mode) ? config.mode : "wrap";
    if (mode === "pair") {
      const startMarker = config?.startMarker !== undefined ? String(config.startMarker) : marker;
      const endMarker = config?.endMarker !== undefined ? String(config.endMarker) : marker;
      if (!startMarker || !endMarker) return value;
      return value.replace(wrappedMarkerPattern(escapeHtml(startMarker), escapeHtml(endMarker), startMarker, endMarker), `<${tag}>$1</${tag}>`);
    }
    if (!marker) return value;
    const encodedMarker = escapeHtml(marker);
    if (mode === "start") {
      return value.startsWith(encodedMarker) && value.length > encodedMarker.length
        ? `<${tag}>${value.slice(encodedMarker.length)}</${tag}>`
        : value;
    }
    if (mode === "end") {
      return value.endsWith(encodedMarker) && value.length > encodedMarker.length
        ? `<${tag}>${value.slice(0, -encodedMarker.length)}</${tag}>`
        : value;
    }
    return value.replace(wrappedMarkerPattern(encodedMarker, encodedMarker, marker, marker), `<${tag}>$1</${tag}>`);
  }

  /**
   * 1行内のリンク・画像・太字・下線などを安全なHTMLへ変換します。
   * 先に退避し、最後に戻す順序が誤変換とHTML注入を防ぎます。
   */
  function inlineMarkdown(input, options = {}) {
    const tokens = [];
    let value = String(input);

    value = value.replace(/`([^`\n]+)`/g, (_match, code) => {
      return tokenized(tokens, escapeHtml(code));
    });

    if (!options.markdownFlavor || options.markdownFlavor === "obsidian") {
      value = value.replace(/(!)?\[\[([^\]\n]+)\]\]/g, (_match, embedded, contents) => {
        const label = wikiLinkLabel(contents);
        const embed = wikiEmbedParts(contents);
        return tokenized(tokens, embedded
          ? `【画像：${escapeHtml(embed.label)}｜${escapeHtml(embed.source)}】`
          : escapeHtml(label));
      });
    }

    // Backslash-escaped punctuation is literal Markdown text. Shield it from
    // later emphasis/link parsing so \_ stays an underscore rather than <em>.
    value = value.replace(/\\([^\r\n])/g, (match, character) =>
      markdownEscapablePunctuation.has(character)
        ? tokenized(tokens, escapeHtml(character))
        : match
    );

    value = escapeHtml(value);
    value = value.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_match, alt, source) => {
      return tokenized(tokens, `【画像：${alt || "名称なし"}｜${source}】`);
    });
    value = value.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, label, href) => {
      return tokenized(tokens, `${label}（${href}）`);
    });
    const markers = options.inlineMarkers || {};
    value = applyInlineMarker(value, markers.bold, defaultInlineMarkers.bold, "strong");
    value = applyInlineMarker(value, markers.underline, defaultInlineMarkers.underline, "u");
    value = applyInlineMarker(value, markers.strike, defaultInlineMarkers.strike, "s");
    value = applyInlineMarker(value, markers.italic, defaultInlineMarkers.italic, "em");
    // Keep the alternate CommonMark emphasis markers when the standard
    // defaults are active. Custom identifiers intentionally take precedence.
    // CommonMarkでは「_」は単語の内側では書式にならないため、前後が文字・数字なら無視します。
    // これがないと「player_hp_max」のような識別子の下線が消えてしまいます。
    // 認識する例: 「これは __太字__ です」「これは _斜体_ です」
    // 認識しない例: 「snake_case_name」「__init__メソッド」
    if (!markers.bold || markers.bold.marker === "**") value = value.replace(/(^|[^\p{L}\p{N}_])__(?!\s)([^_\n]+?)(?<!\s)__(?![\p{L}\p{N}_])/gu, "$1<strong>$2</strong>");
    if (!markers.italic || markers.italic.marker === "*") value = value.replace(/(^|[^\p{L}\p{N}_])_(?!\s)([^_\n]+?)(?<!\s)_(?![\p{L}\p{N}_])/gu, "$1<em>$2</em>");

    // Obsidian officially supports sanitized HTML in Markdown notes. Keep only
    // the attribute-free inline tags that map safely to TALTO's limited output.
    value = value
      .replaceAll("&lt;u&gt;", "<u>").replaceAll("&lt;/u&gt;", "</u>")
      .replace(/&lt;\/?s&gt;/gi, "")
      .replace(/&lt;br\s*\/?&gt;/gi, "<br>");

    value = value.replace(/\u0000TOKEN(\d+)\u0000/g, (_match, index) => tokens[Number(index)]);
    return value.replace(/<\/?(?:em|s)>/g, "");
  }

  /**
   * ファイル先頭のYAMLプロパティだけを除外します。単なる区切り線は残します。
   * Obsidianはプロパティをファイルの1行目からしか認識しません。複数ファイルを結合した原稿では、
   * 各ファイルの先頭行番号を documentStarts で受け取り、その位置だけを調べます。
   * 途中の「---」で挟まれた「HP: 10」のようなステータス表を誤って削除しないための制限です。
   */
  // ===== 4. Markdown文書全体の補助処理 =====
  function removeMarkdownFrontmatter(source, documentStarts = [0]) {
    const lines = String(source).split("\n");
    const output = [];
    const starts = new Set((Array.isArray(documentStarts) ? documentStarts : [0]).map((value) => Number(value) || 0));
    let removed = 0;
    for (let index = 0; index < lines.length; index += 1) {
      const canStart = starts.has(index) && lines[index].trim() === "---";
      if (canStart) {
        let closing = index + 1;
        while (closing < lines.length && lines[closing].trim() !== "---") closing += 1;
        const bodyLines = lines.slice(index + 1, closing);
        const hasYamlKey = bodyLines.some((line) => /^[A-Za-z0-9_-]+\s*:/.test(line));
        const onlyYamlLines = bodyLines.length <= 200 && bodyLines.every((line) =>
          !line.trim() || /^[A-Za-z0-9_-]+\s*:/.test(line) || /^\s+\S/.test(line) || /^\s*-\s+/.test(line)
        );
        if (closing < lines.length && hasYamlKey && onlyYamlLines) {
          removed += 1;
          index = closing;
          continue;
        }
      }
      output.push(lines[index]);
    }
    return { value: output.join("\n"), removed };
  }

  /**
   * エスケープされた縦線を壊さず、Markdown表のセルを分割します。
   */
  function splitMarkdownTableRow(row) {
    const cells = [];
    let cell = "";
    for (let index = 0; index < row.length; index += 1) {
      const character = row[index];
      if (character === "|" && row[index - 1] !== "\\") {
        cells.push(cell);
        cell = "";
      } else {
        cell += character;
      }
    }
    cells.push(cell);
    return cells;
  }

  /**
   * 完全再現できない記法を検出し、利用者が手作業で確認できる警告へまとめます。
   */
  function collectWarnings(source) {
    const warnings = [];
    if (/!\[[^\]]*\]\([^)]+\)/.test(source)) {
      warnings.push("画像ファイルは読み込まず、参照先をプレースホルダーとして残しました。リンクを目印にTALTOで画像を手動挿入してください。");
    }
    if (/^\s*([-*+] |\d+[.)] )/m.test(source)) {
      warnings.push("リストはTALTOで確実に残るよう、各項目を「・」「1.」付きの通常段落に変換しました。");
    }
    // 表の警告は、実際に表として解釈した時点で parseMarkdown 側が追加します。
    // 行内に「|」があるだけの本文まで「表を変換した」と伝えないためです。
    if (/^#{4,6}\s+/m.test(source)) {
      warnings.push("H4〜H6は太字の通常段落に変換しました。TALTOで安定して扱える見出しはH1〜H3です。");
    }
    const hasSafeObsidianHtml = /<\/?u>|<\/?s>|<br\s*\/?>/i.test(source);
    const sourceWithoutSafeObsidianHtml = source.replace(/<\/?u>|<\/?s>|<br\s*\/?>/gi, "");
    if (/<[a-z][\s\S]*?>/i.test(sourceWithoutSafeObsidianHtml)) {
      warnings.push(hasSafeObsidianHtml
        ? "Markdown中に生HTMLが含まれています。属性なしの<u>・<s>・<br>だけを認識し、その他のHTMLタグは文字として扱いました。HTML原稿は入力形式をHTMLにしてください。"
        : "Markdown中の生HTMLは安全のため文字列として扱いました。HTML原稿は入力形式をHTMLにしてください。");
    }
    return warnings;
  }

  /**
   * Markdown／GFM／Obsidian原稿を行単位で読み、TALTO対応ブロックへ変換します。
   */
  // ===== 5. Markdown／GFM／Obsidianのブロック変換 =====
  function parseMarkdown(source, options = {}) {
    const original = String(source).replace(/\r\n?/g, "\n");
    const obsidianFlavor = !options.markdownFlavor || options.markdownFlavor === "obsidian";
    const gfmFlavor = options.markdownFlavor === "gfm" || obsidianFlavor;
    const frontmatter = obsidianFlavor ? removeMarkdownFrontmatter(original, options.frontmatterStarts) : { value: original, removed: 0 };
    const commentsRemoved = (frontmatter.value.match(/<!--[\s\S]*?-->/g) || []).length;
    const obsidianCommentsRemoved = obsidianFlavor ? (frontmatter.value.match(/%%[\s\S]*?%%/g) || []).length : 0;
    const normalized = frontmatter.value
      .replace(/<!--[\s\S]*?-->/g, "")
      .replace(obsidianFlavor ? /%%[\s\S]*?%%/g : /$^/, "");
    const lines = normalized.split("\n");
    const blocks = [];
    const paragraph = [];
    const warnings = collectWarnings(normalized);
    const images = [];
    let title = options.title || "";
    let firstMeaningfulLineSeen = false;
    // 段落が原稿の最初の内容かどうか。Setext見出しで「先頭の見出しを除外」を正しく判定するために使います。
    let paragraphStartedFirst = false;
    let italicNoteLines = 0;
    let horizontalRulesRemoved = 0;
    let tablesConverted = 0;

    for (const match of normalized.matchAll(/!\[([^\]]*)\]\(([^)]+)\)/g)) {
      images.push({ alt: match[1], source: match[2] });
    }
    if (obsidianFlavor) for (const match of normalized.matchAll(/!\[\[([^\]\n]+)\]\]/g)) {
      const embed = wikiEmbedParts(match[1]);
      images.push({ alt: embed.label, source: embed.source });
    }

    if (frontmatter.removed) warnings.push(`ObsidianのYAMLメタデータを${frontmatter.removed}件、本文から除外しました。`);
    if (commentsRemoved) warnings.push(`Markdown内のHTMLコメントを${commentsRemoved}件、本文から除外しました。`);
    if (obsidianCommentsRemoved) warnings.push(`Obsidianコメントを${obsidianCommentsRemoved}件、本文から除外しました。`);
    if (obsidianFlavor && /\[\[[^\]\n]+\]\]/.test(normalized)) warnings.push("Obsidianの内部リンクはTALTOで使えないため、表示名だけを残しました。");

    /**
     * 蓄積中の通常行を一つの段落として確定します。見出し等の前に必ず呼び出します。
     */
    const flushParagraph = () => {
      if (paragraph.length === 0) return;
      blocks.push(`<p>${bodyContent(paragraph.map((line) => inlineMarkdown(line, options)).join("<br>"), options)}</p>`);
      paragraph.length = 0;
    };

    /**
     * 見出し行をTALTO対応のブロックへ変換します。「#」形式とSetext形式の両方から呼びます。
     * 先頭の見出しは、設定によりタイトル取得や本文からの除外の対象になります。
     */
    const pushHeading = (level, headingText, isFirstHeadingBlock) => {
      if (isFirstHeadingBlock && level === 1 && options.firstH1AsTitle === true) {
        title = htmlToPlainText(inlineMarkdown(headingText, options));
      }
      if (isFirstHeadingBlock && options.removeFirstHeading === true) {
        // The heading may still have supplied the optional title above.
      } else if (level <= 3) {
        blocks.push(...headingBlocks(`<h${level}>${headingContent(inlineMarkdown(headingText, options), `h${level}`, options)}</h${level}>`, options));
      } else {
        blocks.push(...headingBlocks(`<p><strong>${inlineMarkdown(headingText, options)}</strong></p>`, options));
      }
    };

    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      const trimmed = line.trim();

      // コードフェンスは「```」と「~~~」の両方を認識します（CommonMark）。
      const fence = /^(`{3,}|~{3,})/.exec(trimmed);
      if (fence) {
        flushParagraph();
        const codeLines = [];
        index += 1;
        while (index < lines.length && !lines[index].trim().startsWith(fence[1][0].repeat(3))) {
          codeLines.push(lines[index]);
          index += 1;
        }
        blocks.push(`<p>${escapeHtml(codeLines.join("\n")).replaceAll("\n", "<br>")}</p>`);
        warnings.push("コードブロックはコード書式を除いた通常段落に変換しました。");
        firstMeaningfulLineSeen = true;
        continue;
      }

      if (!trimmed) {
        flushParagraph();
        continue;
      }

      // Setext見出し：直前の段落の直下に「===」または「---」だけの行を置く形式です。
      // 「---」は段落の直後に限り区切り線ではなく見出し2として扱います（CommonMark・Obsidian共通）。
      // 認識する例: 「章タイトル\n===」「節タイトル\n---」
      // 認識しない例: 空行を挟んだ「---」（区切り線）、「- - -」（区切り線）
      const setext = paragraph.length ? /^(=+|-+)$/.exec(trimmed) : null;
      if (setext) {
        const headingText = paragraph.join(" ");
        const wasFirst = paragraphStartedFirst;
        paragraph.length = 0;
        pushHeading(setext[1][0] === "=" ? 1 : 2, headingText, wasFirst);
        continue;
      }

      const heading = /^(#{1,6})\s+(.+)$/.exec(trimmed);
      if (heading) {
        flushParagraph();
        const level = heading[1].length;
        const headingText = heading[2].replace(/\s+#+\s*$/, "");
        pushHeading(level, headingText, !firstMeaningfulLineSeen);
        firstMeaningfulLineSeen = true;
        continue;
      }

      if (/^([-*_])(?:\s*\1){2,}\s*$/.test(trimmed)) {
        flushParagraph();
        if (options.removeHorizontalRules) horizontalRulesRemoved += 1;
        else blocks.push("<p>──────────</p>");
        firstMeaningfulLineSeen = true;
        continue;
      }

      if (/^>\s?/.test(trimmed)) {
        flushParagraph();
        const quoteLines = [];
        while (index < lines.length && /^>\s?/.test(lines[index].trim())) {
          quoteLines.push(lines[index].trim().replace(/^>\s?/, ""));
          index += 1;
        }
        index -= 1;
        const callout = obsidianFlavor ? /^\[![^\]]+\][+-]?\s*(.*)$/.exec(quoteLines[0] || "") : null;
        if (callout) {
          if (callout[1]) quoteLines[0] = callout[1];
          else quoteLines.shift();
          warnings.push("ObsidianのCalloutを注釈に変換し、種類と開閉状態を除外しました。");
        }
        blocks.push(`<blockquote>${noteContent(quoteLines.map((item) => inlineMarkdown(item, options)).join("<br>"), options)}</blockquote>`);
        firstMeaningfulLineSeen = true;
        continue;
      }

      const italicNote = options.italicAsNote === false ? null : matchItalicOnlyLine(trimmed);
      if (italicNote != null) {
        flushParagraph();
        const noteLines = [];
        while (index < lines.length) {
          const noteText = matchItalicOnlyLine(lines[index]);
          if (noteText == null) break;
          noteLines.push(noteText);
          italicNoteLines += 1;
          index += 1;
        }
        index -= 1;
        blocks.push(`<blockquote>${noteContent(noteLines.map((item) => inlineMarkdown(item, options)).join("<br>"), options)}</blockquote>`);
        firstMeaningfulLineSeen = true;
        continue;
      }

      const unordered = /^\s*[-*+]\s+(.+)$/.exec(line);
      if (unordered) {
        flushParagraph();
        const marker = options.listMarker !== undefined ? String(options.listMarker) : "・ ";
        const task = gfmFlavor ? /^\[([^\]])\]\s+(.+)$/.exec(unordered[1]) : null;
        const content = task ? `${task[1] === " " ? "□" : "☑"} ${task[2]}` : unordered[1];
        blocks.push(`<p>${listItemContent(marker, inlineMarkdown(content, options), options)}</p>`);
        firstMeaningfulLineSeen = true;
        continue;
      }

      const ordered = /^\s*(\d+)[.)]\s+(.+)$/.exec(line);
      if (ordered) {
        flushParagraph();
        blocks.push(`<p>${listItemContent(`${ordered[1]}. `, inlineMarkdown(ordered[2], options), options)}</p>`);
        firstMeaningfulLineSeen = true;
        continue;
      }

      // 表の区切り行は「|」を含み、ハイフンとコロンだけで構成される行に限ります。
      // 「|」のない「---」は区切り線（またはSetext見出し）なので、表として読みません。
      // 認識する例: 「| --- | :-: |」「---|---」
      // 認識しない例: 「---」「- - -」
      const nextLine = lines[index + 1] || "";
      if (gfmFlavor && line.includes("|") && nextLine.includes("|") && /^\s*\|?(\s*:?-{3,}:?\s*\|)*\s*:?-{3,}:?\s*\|?\s*$/.test(nextLine)) {
        flushParagraph();
        const tableLines = [line];
        index += 2;
        while (index < lines.length && lines[index].includes("|") && lines[index].trim()) {
          tableLines.push(lines[index]);
          index += 1;
        }
        index -= 1;
        for (const row of tableLines) {
          const cells = splitMarkdownTableRow(row.replace(/^\s*\||\|\s*$/g, "")).map((cell) => inlineMarkdown(cell.trim(), options));
          blocks.push(`<p>${bodyContent(cells.join(" ｜ "), options)}</p>`);
        }
        tablesConverted += 1;
        firstMeaningfulLineSeen = true;
        continue;
      }

      if (!paragraph.length) paragraphStartedFirst = !firstMeaningfulLineSeen;
      paragraph.push(line.replace(/\s{2}$/, ""));
      firstMeaningfulLineSeen = true;
    }

    flushParagraph();
    if (tablesConverted) {
      warnings.push("表はセルを「｜」で区切った通常段落に変換しました。");
    }
    if (italicNoteLines) {
      warnings.push(`行全体が斜体の${italicNoteLines}行をTALTOの注釈に変換しました。文中の斜体は通常文字へ変換しました。`);
    }
    if (horizontalRulesRemoved) {
      warnings.push(`Markdownの区切り線を${horizontalRulesRemoved}件削除しました。`);
    }
    const html = applyBlockSpacing(blocks, options);
    return { title, html, plainText: htmlToPlainText(html, true), warnings: [...new Set(warnings)], images };
  }

  /**
   * 識別子を解釈せず、文字と段落だけを安全な本文へ変換します。
   */
  // ===== 6. プレーンテキストとpixiv形式 =====
  function parsePlainText(source, options = {}) {
    const lines = String(source).replace(/\r\n?/g, "\n").split("\n");
    const blocks = [];
    const paragraph = [];
    /**
     * 現在ためている行を段落へ確定し、次の段落用に空にします。
     */
    const flush = () => {
      if (!paragraph.length) return;
      blocks.push(`<p>${bodyContent(paragraph.map(escapeHtml).join("<br>"), options)}</p>`);
      paragraph.length = 0;
    };
    for (const line of lines) {
      if (line.trim()) paragraph.push(line);
      else { flush(); blocks.push("<p></p>"); }
    }
    flush();
    const html = applyBlockSpacing(blocks, options);
    return { title: "", html, plainText: htmlToPlainText(html, true), warnings: [], images: [] };
  }

  /**
   * pixiv小説記法のうちTALTOで対応できる部分を変換し、残りは警告・簡略化します。
   */
  function parsePixiv(source, options = {}) {
    const normalized = String(source).replace(/\r\n?/g, "\n");
    const images = [];
    const warnings = [];
    const blocks = [];
    const paragraph = [];
    let pageTags = 0;
    let rubyTags = 0;
    let emphasisTags = 0;
    let jumpTags = 0;

    /**
     * pixivの1行内記法を処理します。入れ子を守るため確定済みHTMLを一時退避します。
     */
    const inline = (input) => {
      const tokens = [];
      let value = String(input);
      const protect = (html) => tokenized(tokens, html);
      value = value.replace(/\[\[jumpuri:([^>\]\n]+?)\s*>\s*([^\]\n]+)\]\]/g, (_m, label, url) => protect(`${escapeHtml(label.trim())}（${escapeHtml(url.trim())}）`));
      value = value.replace(/\[\[rb:([^>\]\n]+?)\s*>\s*([^\]\n]+)\]\]/g, (_m, base, ruby) => {
        rubyTags += 1;
        return protect(`${escapeHtml(base.trim())}（${escapeHtml(ruby.trim())}）`);
      });
      value = value.replace(/\[\[emphasismark:([^>\]\n]+?)\s*>\s*([^\]\n])\]\]/g, (_m, text, mark) => {
        emphasisTags += 1;
        return protect(`<u>${escapeHtml(text.trim())}</u>（傍点：${escapeHtml(mark)}）`);
      });
      value = value.replace(/\[b:([^\]\n]+)\]/g, (_m, text) => protect(`<strong>${escapeHtml(text)}</strong>`));
      value = value.replace(/\[i:([^\]\n]+)\]/g, (_m, text) => protect(escapeHtml(text)));
      value = value.replace(/\[jump:([^\]\n]+)\]/g, (_m, page) => {
        jumpTags += 1;
        return protect(`【ページ移動：${escapeHtml(page.trim())}】`);
      });
      value = escapeHtml(value);
      return value.replace(/\u0000TOKEN(\d+)\u0000/g, (_m, index) => tokens[Number(index)]);
    };
    const flush = () => {
      if (!paragraph.length) return;
      blocks.push(`<p>${bodyContent(paragraph.map(inline).join("<br>"), options)}</p>`);
      paragraph.length = 0;
    };
    for (const line of normalized.split("\n")) {
      const trimmed = line.trim();
      const chapter = /^\[chapter:([^\]\n]+)\]$/.exec(trimmed);
      const image = /^\[(uploadedimage|pixivimage):([^\]\n]+)\]$/.exec(trimmed);
      if (!trimmed) { flush(); continue; }
      if (chapter) {
        flush();
        blocks.push(`<h1>${headingContent(escapeHtml(chapter[1]), "h1", options)}</h1>`);
      } else if (trimmed === "[newpage]") {
        flush(); pageTags += 1; blocks.push("<p>──────────</p>");
      } else if (image) {
        flush();
        const sourceId = `${image[1]}:${image[2]}`;
        images.push({ alt: "pixiv挿絵", source: sourceId });
        blocks.push(`<p>【画像：pixiv挿絵｜${escapeHtml(sourceId)}】</p>`);
      } else {
        paragraph.push(line);
      }
    }
    flush();
    if (pageTags) warnings.push(`pixivの改ページタグ${pageTags}件を区切り線へ置き換えました。`);
    if (rubyTags) warnings.push(`pixivのルビ${rubyTags}件を「本文（よみ）」へ置き換えました。`);
    if (emphasisTags) warnings.push(`pixivの傍点${emphasisTags}件を下線と注記へ置き換えました。`);
    if (jumpTags) warnings.push(`pixiv内ページへの移動${jumpTags}件は機能しないため、参照文字として残しました。`);
    if (images.length) warnings.push("pixivの挿絵は画像プレースホルダーへ置き換えました。TALTOで手動挿入してください。");
    const html = applyBlockSpacing(blocks, options);
    return { title: "", html, plainText: htmlToPlainText(html, true), warnings, images };
  }

  /**
   * 貼り付けられたHTMLを許可した要素だけに正規化します。
   * script等は除外し、TALTOが扱える見出し・注釈・本文・太字・下線へ絞ります。
   */
  // ===== 7. HTMLの安全な正規化 =====
  function normalizeHtml(source, options = {}) {
    if (typeof DOMParser === "undefined") throw new Error("HTML変換はブラウザ内で実行してください。");
    const document = new DOMParser().parseFromString(String(source), "text/html");
    const warnings = [];
    const images = [];
    let title = options.title || "";
    let firstTitleHeadingConsumed = false;
    let italicNoteBlocks = 0;
    const dropped = new Set();

    // 実行・埋め込み・入力用の要素は、文章ではないため中身ごと除外します。
    // svg/video/audio/canvas の内側のテキストは代替説明であり本文ではありません。
    const droppedTags = ["script", "style", "iframe", "object", "embed", "form", "input", "button", "svg", "video", "audio", "canvas", "noscript"];
    const blockTagPattern = /^(h[1-6]|p|div|blockquote|ul|ol|table|pre|section|article|main|img|hr)$/i;

    const inline = (node) => {
      if (node.nodeType === 3) return escapeHtml(node.nodeValue || "");
      if (node.nodeType !== 1) return "";
      const tag = node.tagName.toLowerCase();
      if (droppedTags.includes(tag)) {
        dropped.add(tag);
        return "";
      }
      if (tag === "br") return "<br>";
      if (tag === "img") {
        const alt = node.getAttribute("alt") || "名称なし";
        const imageSource = node.getAttribute("src") || "参照先なし";
        images.push({ alt, source: imageSource });
        return `【画像：${escapeHtml(alt)}｜${escapeHtml(imageSource)}】`;
      }
      const children = Array.from(node.childNodes).map(inline).join("");
      if (["strong", "b"].includes(tag)) return `<strong>${children}</strong>`;
      if (tag === "u") return `<u>${children}</u>`;
      if (["em", "i", "s", "strike", "del"].includes(tag)) return children;
      if (tag === "code") return children;
      if (tag === "a") {
        const href = node.getAttribute("href");
        return href ? `${children}（${escapeHtml(href)}）` : children;
      }
      if (tag === "span") {
        const style = node.style;
        let result = children;
        if (style.fontWeight === "700" || style.fontWeight === "bold") result = `<strong>${result}</strong>`;
        if (style.textDecoration.includes("underline")) result = `<u>${result}</u>`;
        return result;
      }
      return children;
    };

    const blocks = [];
    let horizontalRulesRemoved = 0;
    /**
     * 容器（body・div など）の子を順に見て、ブロック要素は addBlock へ渡し、
     * テキストや <b>・<u> などの行内要素は「連続するまとまり」を1つの段落にします。
     * <p> を使わない HTML でも、太字や下線を保ったまま1段落として読めるようにするためです。
     */
    const addContainerChildren = (container) => {
      let run = [];
      const flushRun = () => {
        const content = run.map(inline).join("").replace(/^(?:\s|<br>)+|(?:\s|<br>)+$/g, "");
        run = [];
        if (content) blocks.push(`<p>${bodyContent(content, options)}</p>`);
      };
      for (const child of container.childNodes) {
        if (child.nodeType === 1 && blockTagPattern.test(child.tagName)) {
          flushRun();
          addBlock(child);
        } else if (child.nodeType === 1 || (child.nodeType === 3 && child.nodeValue.trim())) {
          run.push(child);
        }
      }
      flushRun();
    };
    /**
     * HTML要素を一つずつ調べ、対応するTALTO向けブロックとして追加します。
     */
    const addBlock = (element) => {
      const tag = element.tagName.toLowerCase();
      if (droppedTags.includes(tag)) {
        dropped.add(tag);
        return;
      }
      if (tag === "hr") {
        // Markdownの区切り線と同じ設定に従います。
        if (options.removeHorizontalRules) horizontalRulesRemoved += 1;
        else blocks.push("<p>──────────</p>");
        return;
      }
      if (["h1", "h2", "h3"].includes(tag)) {
        const content = Array.from(element.childNodes).map(inline).join("");
        const isFirstHeadingBlock = blocks.length === 0 && !firstTitleHeadingConsumed;
        if (isFirstHeadingBlock && tag === "h1" && options.firstH1AsTitle === true) {
          title = htmlToPlainText(content);
          firstTitleHeadingConsumed = true;
        }
        if (isFirstHeadingBlock && options.removeFirstHeading === true) {
          firstTitleHeadingConsumed = true;
        } else {
          blocks.push(...headingBlocks(`<${tag}>${headingContent(content, tag, options)}</${tag}>`, options));
          firstTitleHeadingConsumed = true;
        }
        return;
      }
      if (["h4", "h5", "h6"].includes(tag)) {
        blocks.push(...headingBlocks(`<p><strong>${Array.from(element.childNodes).map(inline).join("")}</strong></p>`, options));
        warnings.push("H4〜H6は太字の通常段落に変換しました。");
        return;
      }
      if (tag === "blockquote") {
        blocks.push(`<blockquote>${noteContent(Array.from(element.childNodes).map(inline).join(""), options)}</blockquote>`);
        return;
      }
      if (["ul", "ol"].includes(tag)) {
        const items = Array.from(element.children).filter((child) => child.tagName.toLowerCase() === "li");
        items.forEach((item, index) => {
          const prefix = tag === "ul"
            ? options.listMarker !== undefined ? String(options.listMarker) : "・ "
            : `${index + 1}. `;
          blocks.push(`<p>${listItemContent(prefix, Array.from(item.childNodes).map(inline).join(""), options)}</p>`);
        });
        warnings.push("HTMLのリストを通常段落に変換しました。");
        return;
      }
      if (tag === "table") {
        for (const row of element.querySelectorAll("tr")) {
          const cells = Array.from(row.querySelectorAll(":scope > th, :scope > td")).map((cell) => Array.from(cell.childNodes).map(inline).join(""));
          if (cells.length) blocks.push(`<p>${bodyContent(cells.join(" ｜ "), options)}</p>`);
        }
        warnings.push("HTMLの表を「｜」区切りの通常段落に変換しました。");
        return;
      }
      if (tag === "pre") {
        blocks.push(`<p>${escapeHtml(element.textContent || "").replaceAll("\n", "<br>")}</p>`);
        warnings.push("コードブロックを通常段落に変換しました。");
        return;
      }
      if (tag === "img") {
        blocks.push(`<p>${inline(element)}</p>`);
        return;
      }
      if (tag === "p" && options.italicAsNote !== false) {
        const meaningful = Array.from(element.childNodes).filter((child) => child.nodeType === 1 || (child.nodeType === 3 && child.nodeValue.trim()));
        if (meaningful.length === 1 && meaningful[0].nodeType === 1 && ["em", "i"].includes(meaningful[0].tagName.toLowerCase())) {
          blocks.push(`<blockquote>${noteContent(Array.from(meaningful[0].childNodes).map(inline).join(""), options)}</blockquote>`);
          italicNoteBlocks += 1;
          return;
        }
      }
      const hasBlockChildren = Array.from(element.children).some((child) => blockTagPattern.test(child.tagName));
      if (["body", "div", "section", "article", "main"].includes(tag) && hasBlockChildren) {
        addContainerChildren(element);
        return;
      }
      blocks.push(`<p>${bodyContent(Array.from(element.childNodes).map(inline).join(""), options)}</p>`);
    };

    addContainerChildren(document.body);

    if (images.length) warnings.push("画像はプレースホルダーに変換しました。TALTOでJPEG/PNGを個別に挿入してください。");
    if (italicNoteBlocks) warnings.push(`斜体だけで構成された${italicNoteBlocks}段落をTALTOの注釈に変換しました。`);
    if (horizontalRulesRemoved) warnings.push(`HTMLの区切り線を${horizontalRulesRemoved}件削除しました。`);
    if (dropped.size) warnings.push(`安全のため除外したHTML要素: ${[...dropped].join(", ")}`);
    const html = applyBlockSpacing(blocks, options);
    return { title, html, plainText: htmlToPlainText(html, true), warnings: [...new Set(warnings)], images };
  }

  /**
   * 外部へ公開する機能をここで限定します。内部補助関数は誤用されないよう公開しません。
   */
  // ===== 8. 外部へ公開するAPI =====
  return { escapeHtml, htmlToPlainText, parseMarkdown, parsePlainText, parsePixiv, normalizeHtml, checkImportSize, FILE_SIZE_LIMIT, FOLDER_SIZE_LIMIT };
});
