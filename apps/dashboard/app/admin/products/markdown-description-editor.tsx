"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";

interface MarkdownDescriptionEditorProps {
  value: string;
  onChange: (val: string) => void;
  isInvalid?: boolean;
  isShaking?: boolean;
  placeholder?: string;
}

// Convert markdown to clean HTML for initial loading in WYSIWYG
function markdownToHtml(md: string): string {
  if (!md || !md.trim()) return "<p><br></p>";
  
  // If it already looks like HTML, return as-is
  if (/<(p|h[1-6]|ul|ol|table|blockquote|div)[^>]*>/i.test(md)) {
    return md;
  }

  const lines = md.split("\n");
  const htmlParts: string[] = [];
  let inList: "ul" | "ol" | null = null;
  let inTable = false;
  let tableRows: string[][] = [];

  const flushList = () => {
    if (inList) {
      htmlParts.push(`</${inList}>`);
      inList = null;
    }
  };

  const flushTable = () => {
    if (inTable && tableRows.length > 0) {
      const headerRow = tableRows[0] || [];
      const bodyRows = tableRows.slice(1);
      
      let tableHtml = `<table class="w-full my-3 text-xs border border-gray-300 dark:border-[#444] rounded border-collapse">`;
      if (headerRow.length > 0) {
        tableHtml += `<thead class="bg-gray-100 dark:bg-[#252525] border-b border-gray-300 dark:border-[#444]"><tr>`;
        headerRow.forEach((c) => {
          tableHtml += `<th class="p-2.5 text-left border-r last:border-r-0 border-gray-300 dark:border-[#444] font-bold">${formatInline(c)}</th>`;
        });
        tableHtml += `</tr></thead>`;
      }
      tableHtml += `<tbody>`;
      bodyRows.forEach((row) => {
        tableHtml += `<tr class="border-b last:border-b-0 border-gray-200 dark:border-[#333]">`;
        row.forEach((c) => {
          tableHtml += `<td class="p-2.5 border-r last:border-r-0 border-gray-200 dark:border-[#333]">${formatInline(c)}</td>`;
        });
        tableHtml += `</tr>`;
      });
      tableHtml += `</tbody></table>`;
      htmlParts.push(tableHtml);
    }
    inTable = false;
    tableRows = [];
  };

  const formatInline = (str: string) => {
    return str
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.*?)\*/g, "<em>$1</em>")
      .replace(/~~(.*?)~~/g, "<del>$1</del>")
      .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank" rel="noreferrer" class="text-[#9E7B00] dark:text-[#EDCF5D] underline font-semibold">$1</a>')
      .replace(/`(.*?)`/g, '<code class="px-1.5 py-0.5 rounded bg-gray-200 dark:bg-[#333] font-mono text-[11px]">$1</code>');
  };

  lines.forEach((line) => {
    const trimmed = line.trim();

    if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
      flushList();
      if (/^\|(\s*:?-+:?\s*\|)+$/.test(trimmed)) {
        return;
      }
      inTable = true;
      const cells = trimmed
        .slice(1, -1)
        .split("|")
        .map((c) => c.trim());
      tableRows.push(cells);
      return;
    } else {
      flushTable();
    }

    if (trimmed.startsWith("###### ")) {
      flushList();
      htmlParts.push(`<h6 class="text-xs font-bold text-gray-500 uppercase tracking-wider mt-2 mb-1">${formatInline(trimmed.slice(7))}</h6>`);
    } else if (trimmed.startsWith("##### ")) {
      flushList();
      htmlParts.push(`<h5 class="text-xs sm:text-sm font-bold text-gray-900 dark:text-white mt-2.5 mb-1">${formatInline(trimmed.slice(6))}</h5>`);
    } else if (trimmed.startsWith("#### ")) {
      flushList();
      htmlParts.push(`<h4 class="text-sm sm:text-base font-bold text-gray-900 dark:text-white mt-3 mb-1">${formatInline(trimmed.slice(5))}</h4>`);
    } else if (trimmed.startsWith("### ")) {
      flushList();
      htmlParts.push(`<h3 class="text-base sm:text-lg font-bold text-gray-900 dark:text-white mt-3.5 mb-1.5">${formatInline(trimmed.slice(4))}</h3>`);
    } else if (trimmed.startsWith("## ")) {
      flushList();
      htmlParts.push(`<h2 class="text-lg sm:text-xl font-extrabold text-gray-900 dark:text-white mt-4 mb-2">${formatInline(trimmed.slice(3))}</h2>`);
    } else if (trimmed.startsWith("# ")) {
      flushList();
      htmlParts.push(`<h1 class="text-xl sm:text-2xl font-black text-gray-900 dark:text-white mt-5 mb-2.5">${formatInline(trimmed.slice(2))}</h1>`);
    } else if (trimmed.startsWith("- ") || trimmed.startsWith("* ") || trimmed.startsWith("• ")) {
      if (inList !== "ul") {
        flushList();
        inList = "ul";
        htmlParts.push('<ul class="list-disc pl-5 space-y-1 my-2">');
      }
      htmlParts.push(`<li>${formatInline(trimmed.replace(/^[-*•]\s+/, ""))}</li>`);
    } else if (/^\d+\.\s+/.test(trimmed)) {
      if (inList !== "ol") {
        flushList();
        inList = "ol";
        htmlParts.push('<ol class="list-decimal pl-5 space-y-1 my-2">');
      }
      htmlParts.push(`<li>${formatInline(trimmed.replace(/^\d+\.\s+/, ""))}</li>`);
    } else if (trimmed.startsWith("> ")) {
      flushList();
      htmlParts.push(`<blockquote class="border-l-3 border-[#EDCF5D] pl-3 py-1.5 my-2.5 bg-[#EDCF5D]/5 dark:bg-[#EDCF5D]/10 rounded-r text-xs italic text-gray-800 dark:text-gray-200">${formatInline(trimmed.slice(2))}</blockquote>`);
    } else if (trimmed === "---" || trimmed === "***") {
      flushList();
      htmlParts.push('<hr class="my-4 border-gray-200 dark:border-[#333]" />');
    } else if (trimmed.length > 0) {
      flushList();
      htmlParts.push(`<p class="my-1.5 leading-relaxed">${formatInline(trimmed)}</p>`);
    } else {
      flushList();
    }
  });

  flushList();
  flushTable();

  return htmlParts.join("") || "<p><br></p>";
}

export function MarkdownDescriptionEditor({
  value,
  onChange,
  isInvalid = false,
  isShaking = false,
  placeholder = "Type product overview, specifications, features, warranty details, and tables...",
}: MarkdownDescriptionEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const savedSelectionRangeRef = useRef<Range | null>(null);

  // Active command states for toolbar highlighting
  const [activeFormats, setActiveFormats] = useState({
    bold: false,
    italic: false,
    strikethrough: false,
    unorderedList: false,
    orderedList: false,
    blockType: "Body",
  });

  // Dropdown states
  const [isHeadingMenuOpen, setIsHeadingMenuOpen] = useState(false);
  const [isListMenuOpen, setIsListMenuOpen] = useState(false);
  const [isTableMenuOpen, setIsTableMenuOpen] = useState(false);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [hoveredTable, setHoveredTable] = useState<{ rows: number; cols: number }>({ rows: 0, cols: 0 });

  // Link Dialog Modal state
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [linkText, setLinkText] = useState("");
  const [linkUrl, setLinkUrl] = useState("");

  // Sync incoming value to contentEditable if externally changed
  const lastHtmlRef = useRef<string>("");

  useEffect(() => {
    if (!editorRef.current) return;
    const initialHtml = markdownToHtml(value);
    if (editorRef.current.innerHTML !== initialHtml && value !== lastHtmlRef.current) {
      editorRef.current.innerHTML = initialHtml;
      lastHtmlRef.current = value;
    }
  }, [value]);

  // Save selection range so clicking toolbar/dropdown doesn't lose cursor/selection
  const saveCurrentSelection = useCallback(() => {
    if (typeof window === "undefined") return;
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && editorRef.current) {
      const range = sel.getRangeAt(0);
      if (editorRef.current.contains(range.commonAncestorContainer)) {
        savedSelectionRangeRef.current = range.cloneRange();
      }
    }
  }, []);

  const restoreSavedSelection = useCallback(() => {
    if (typeof window === "undefined" || !savedSelectionRangeRef.current) return;
    const sel = window.getSelection();
    if (sel) {
      sel.removeAllRanges();
      sel.addRange(savedSelectionRangeRef.current);
    }
  }, []);

  // Update active toolbar states based on cursor/selection
  const updateToolbarState = useCallback(() => {
    if (typeof document === "undefined") return;
    saveCurrentSelection();

    try {
      const isBold = document.queryCommandState("bold");
      const isItalic = document.queryCommandState("italic");
      const isStrike = document.queryCommandState("strikeThrough");
      const isUl = document.queryCommandState("insertUnorderedList");
      const isOl = document.queryCommandState("insertOrderedList");

      let currentBlock = "Body";
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        let parent: Node | null = selection.getRangeAt(0).commonAncestorContainer;
        if (parent && parent.nodeType === Node.TEXT_NODE) {
          parent = parent.parentNode;
        }
        while (parent && parent !== editorRef.current) {
          const tag = (parent as HTMLElement).tagName?.toLowerCase();
          if (tag === "h1") currentBlock = "Title (H1)";
          else if (tag === "h2") currentBlock = "Subtitle (H2)";
          else if (tag === "h3") currentBlock = "Heading (H3)";
          else if (tag === "h4") currentBlock = "Subheading (H4)";
          else if (tag === "h5") currentBlock = "Section (H5)";
          else if (tag === "h6") currentBlock = "Subsection (H6)";
          else if (tag === "blockquote") currentBlock = "Quote";
          else if (tag === "pre" || tag === "code") currentBlock = "Code";
          parent = parent.parentNode;
        }
      }

      setActiveFormats({
        bold: isBold,
        italic: isItalic,
        strikethrough: isStrike,
        unorderedList: isUl,
        orderedList: isOl,
        blockType: currentBlock,
      });
    } catch {
      // ignore
    }
  }, [saveCurrentSelection]);

  useEffect(() => {
    const handleSelectionChange = () => {
      if (document.activeElement === editorRef.current || editorRef.current?.contains(document.activeElement)) {
        updateToolbarState();
      }
    };
    document.addEventListener("selectionchange", handleSelectionChange);
    return () => document.removeEventListener("selectionchange", handleSelectionChange);
  }, [updateToolbarState]);

  // Close menus on clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (toolbarRef.current && !toolbarRef.current.contains(e.target as Node)) {
        setIsHeadingMenuOpen(false);
        setIsListMenuOpen(false);
        setIsTableMenuOpen(false);
        setIsMoreMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const closeAllMenus = () => {
    setIsHeadingMenuOpen(false);
    setIsListMenuOpen(false);
    setIsTableMenuOpen(false);
    setIsMoreMenuOpen(false);
  };

  // Emit changes to parent
  const handleInput = () => {
    if (!editorRef.current) return;
    const html = editorRef.current.innerHTML;
    lastHtmlRef.current = html;
    onChange(html);
    updateToolbarState();
  };

  // Execute standard formatting commands
  const exec = (command: string, val: string | undefined = undefined) => {
    if (!editorRef.current) return;
    restoreSavedSelection();
    editorRef.current.focus();
    document.execCommand(command, false, val);
    handleInput();
    updateToolbarState();
  };

  // Apply block heading to selected text or current paragraph
  const applyHeading = (level: number) => {
    if (!editorRef.current) return;
    restoreSavedSelection();
    editorRef.current.focus();

    const tag = level === 0 ? "p" : `h${level}`;
    const blockTag = `<${tag.toUpperCase()}>`;

    // Chrome/Edge/Safari formatBlock supports `<H1>`–`<H6>` and `<P>`
    let success = false;
    try {
      success = document.execCommand("formatBlock", false, blockTag);
    } catch {}

    if (!success) {
      try {
        document.execCommand("formatBlock", false, tag);
      } catch {}
    }

    handleInput();
    closeAllMenus();
    updateToolbarState();
  };

  // List applicator
  const applyList = (type: "bullet" | "number") => {
    if (type === "bullet") {
      exec("insertUnorderedList");
    } else {
      exec("insertOrderedList");
    }
    closeAllMenus();
  };

  const applyIndent = (dir: "increase" | "decrease") => {
    if (dir === "increase") {
      exec("indent");
    } else {
      exec("outdent");
    }
    closeAllMenus();
  };

  // Clear formatting from selection
  const handleClearFormatting = () => {
    exec("removeFormat");
    exec("unlink");
    closeAllMenus();
  };

  // Open Link Dialog
  const openLinkDialog = () => {
    closeAllMenus();
    saveCurrentSelection();
    let text = "";
    if (savedSelectionRangeRef.current) {
      text = savedSelectionRangeRef.current.toString();
    }
    setLinkText(text);
    setLinkUrl("");
    setIsLinkModalOpen(true);
  };

  // Insert Link from Modal
  const handleInsertLink = (e?: React.FormEvent | React.MouseEvent | React.KeyboardEvent) => {
    if (e) e.preventDefault();
    if (!linkUrl.trim() || !editorRef.current) return;

    restoreSavedSelection();
    editorRef.current.focus();

    const finalUrl = linkUrl.startsWith("http://") || linkUrl.startsWith("https://") || linkUrl.startsWith("/") || linkUrl.startsWith("mailto:")
      ? linkUrl
      : `https://${linkUrl}`;

    if (linkText.trim()) {
      const a = document.createElement("a");
      a.href = finalUrl;
      a.textContent = linkText;
      a.target = "_blank";
      a.rel = "noreferrer";
      a.className = "text-[#9E7B00] dark:text-[#EDCF5D] underline font-semibold";

      if (savedSelectionRangeRef.current) {
        savedSelectionRangeRef.current.deleteContents();
        savedSelectionRangeRef.current.insertNode(a);
      } else {
        document.execCommand("insertHTML", false, a.outerHTML);
      }
    } else {
      document.execCommand("createLink", false, finalUrl);
    }

    setIsLinkModalOpen(false);
    setLinkText("");
    setLinkUrl("");
    handleInput();
  };

  // Insert interactive WYSIWYG table
  const insertTable = (rows: number, cols: number) => {
    if (!editorRef.current) return;
    restoreSavedSelection();
    editorRef.current.focus();

    const r = Math.max(1, rows);
    const c = Math.max(1, cols);

    let tableHtml = `<table class="w-full my-3 text-xs border border-gray-300 dark:border-[#444] rounded border-collapse">`;
    tableHtml += `<thead class="bg-gray-100 dark:bg-[#252525] border-b border-gray-300 dark:border-[#444]"><tr>`;
    for (let i = 1; i <= c; i++) {
      tableHtml += `<th class="p-2 text-left border-r last:border-r-0 border-gray-300 dark:border-[#444] font-bold">Header ${i}</th>`;
    }
    tableHtml += `</tr></thead><tbody>`;

    for (let rowIdx = 1; rowIdx <= r; rowIdx++) {
      tableHtml += `<tr class="border-b last:border-b-0 border-gray-200 dark:border-[#333]">`;
      for (let colIdx = 1; colIdx <= c; colIdx++) {
        tableHtml += `<td class="p-2 border-r last:border-r-0 border-gray-200 dark:border-[#333]">Cell</td>`;
      }
      tableHtml += `</tr>`;
    }
    tableHtml += `</tbody></table><p><br></p>`;

    document.execCommand("insertHTML", false, tableHtml);
    handleInput();
    closeAllMenus();
  };

  // Insert Blockquote
  const insertBlockquote = () => {
    if (!editorRef.current) return;
    restoreSavedSelection();
    editorRef.current.focus();
    document.execCommand("formatBlock", false, "<BLOCKQUOTE>");
    handleInput();
    closeAllMenus();
  };

  // Insert Code block
  const insertCodeBlock = () => {
    if (!editorRef.current) return;
    restoreSavedSelection();
    editorRef.current.focus();
    const codeHtml = `<pre class="bg-gray-100 dark:bg-[#181818] p-3 rounded-[6px] border border-gray-200 dark:border-[#333] font-mono text-xs my-2"><code>Technical spec or code snippet...</code></pre><p><br></p>`;
    document.execCommand("insertHTML", false, codeHtml);
    handleInput();
    closeAllMenus();
  };

  // Insert Horizontal Rule
  const insertDivider = () => {
    exec("insertHorizontalRule");
    closeAllMenus();
  };

  return (
    <div
      className={`rounded-[6px] border bg-white dark:bg-[#202020] transition-all flex flex-col font-sans relative overflow-visible ${
        isInvalid && isShaking
          ? "shake-violent border-red-500 ring-2 ring-red-500/50 bg-red-500/5"
          : isInvalid
          ? "border-red-500"
          : "border-gray-200 dark:border-[#303030] focus-within:border-[#EDCF5D]"
      }`}
    >
      {/* ────── TOP WYSIWYG FORMATTING TOOLBAR ────── */}
      <div
        ref={toolbarRef}
        className="flex flex-wrap items-center justify-between gap-1.5 px-2.5 py-1.5 border-b border-gray-200 dark:border-[#2C2C2C] bg-gray-50/90 dark:bg-[#1A1A1A] select-none relative z-30 rounded-t-[6px] overflow-visible"
      >
        <div className="flex items-center gap-0.5 flex-wrap overflow-visible">
          {/* 1. Heading Hierarchy Dropdown (H1 ⌄) */}
          <div className="relative">
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                saveCurrentSelection();
              }}
              onClick={() => {
                setIsHeadingMenuOpen((prev) => !prev);
                setIsListMenuOpen(false);
                setIsTableMenuOpen(false);
                setIsMoreMenuOpen(false);
              }}
              className={`h-7 px-2 rounded-[4px] text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer ${
                isHeadingMenuOpen || activeFormats.blockType !== "Body"
                  ? "bg-gray-200 dark:bg-[#333333] text-gray-900 dark:text-white"
                  : "text-gray-700 dark:text-gray-300 hover:bg-gray-200/60 dark:hover:bg-[#282828]"
              }`}
              title="Heading & Typography Style"
            >
              <span className="text-[11px] font-bold truncate max-w-[80px]">
                {activeFormats.blockType.startsWith("Title")
                  ? "H1"
                  : activeFormats.blockType.startsWith("Subtitle")
                  ? "H2"
                  : activeFormats.blockType.startsWith("Heading")
                  ? "H3"
                  : activeFormats.blockType.startsWith("Subheading")
                  ? "H4"
                  : activeFormats.blockType.startsWith("Section")
                  ? "H5"
                  : activeFormats.blockType.startsWith("Subsection")
                  ? "H6"
                  : "H1"}
              </span>
              <svg className={`w-3 h-3 transition-transform ${isHeadingMenuOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Heading Dropdown Popup (Matched exactly to Reference Image 2) */}
            {isHeadingMenuOpen && (
              <div className="absolute left-0 top-full mt-1.5 w-52 bg-white dark:bg-[#1E1E1E] text-gray-900 dark:text-white border border-gray-200 dark:border-[#333333] rounded-[8px] shadow-2xl py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100 font-sans">
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => applyHeading(1)}
                  className="w-full text-left px-3.5 py-2 hover:bg-gray-100 dark:hover:bg-[#2A2A2A] transition-colors cursor-pointer flex items-center justify-between group"
                >
                  <span className="text-xl font-bold tracking-tight text-gray-900 dark:text-white">Title</span>
                  <span className="text-[10px] text-gray-400 font-mono">H1</span>
                </button>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => applyHeading(2)}
                  className="w-full text-left px-3.5 py-2 hover:bg-gray-100 dark:hover:bg-[#2A2A2A] transition-colors cursor-pointer flex items-center justify-between group"
                >
                  <span className="text-lg font-bold tracking-tight text-gray-900 dark:text-white">Subtitle</span>
                  <span className="text-[10px] text-gray-400 font-mono">H2</span>
                </button>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => applyHeading(3)}
                  className="w-full text-left px-3.5 py-1.5 hover:bg-gray-100 dark:hover:bg-[#2A2A2A] transition-colors cursor-pointer flex items-center justify-between group"
                >
                  <span className="text-base font-bold text-gray-900 dark:text-white">Heading</span>
                  <span className="text-[10px] text-gray-400 font-mono">H3</span>
                </button>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => applyHeading(4)}
                  className="w-full text-left px-3.5 py-1.5 hover:bg-gray-100 dark:hover:bg-[#2A2A2A] transition-colors cursor-pointer flex items-center justify-between group"
                >
                  <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">Subheading</span>
                  <span className="text-[10px] text-gray-400 font-mono">H4</span>
                </button>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => applyHeading(5)}
                  className="w-full text-left px-3.5 py-1.5 hover:bg-gray-100 dark:hover:bg-[#2A2A2A] transition-colors cursor-pointer flex items-center justify-between group"
                >
                  <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">Section</span>
                  <span className="text-[10px] text-gray-400 font-mono">H5</span>
                </button>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => applyHeading(6)}
                  className="w-full text-left px-3.5 py-1.5 hover:bg-gray-100 dark:hover:bg-[#2A2A2A] transition-colors cursor-pointer flex items-center justify-between group"
                >
                  <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400">Subsection</span>
                  <span className="text-[10px] text-gray-400 font-mono">H6</span>
                </button>

                <div className="h-px bg-gray-200 dark:bg-[#333333] my-1" />

                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => applyHeading(0)}
                  className="w-full text-left px-3.5 py-1.5 hover:bg-gray-100 dark:hover:bg-[#2A2A2A] transition-colors cursor-pointer flex items-center gap-2"
                >
                  <span className="w-1.5 h-3.5 rounded-full bg-[#EDCF5D]" />
                  <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Body</span>
                </button>
              </div>
            )}
          </div>

          {/* 2. List Menu Dropdown (:: ⌄) */}
          <div className="relative">
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                saveCurrentSelection();
              }}
              onClick={() => {
                setIsListMenuOpen((prev) => !prev);
                setIsHeadingMenuOpen(false);
                setIsTableMenuOpen(false);
                setIsMoreMenuOpen(false);
              }}
              className={`h-7 px-2 rounded-[4px] flex items-center gap-1 transition-colors cursor-pointer ${
                isListMenuOpen || activeFormats.unorderedList || activeFormats.orderedList
                  ? "bg-gray-200 dark:bg-[#333333] text-gray-900 dark:text-white"
                  : "text-gray-700 dark:text-gray-300 hover:bg-gray-200/60 dark:hover:bg-[#282828]"
              }`}
              title="Bullet & Numbered Lists"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 17.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
              </svg>
              <svg className={`w-3 h-3 transition-transform ${isListMenuOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* List Menu Popup */}
            {isListMenuOpen && (
              <div className="absolute left-0 top-full mt-1.5 w-48 bg-white dark:bg-[#1E1E1E] text-gray-900 dark:text-white border border-gray-200 dark:border-[#333333] rounded-[8px] shadow-2xl py-1 z-50 animate-in fade-in zoom-in-95 duration-100 text-xs font-sans">
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => applyList("bullet")}
                  className={`w-full text-left px-3 py-1.5 transition-colors cursor-pointer flex items-center justify-between ${
                    activeFormats.unorderedList ? "bg-gray-100 dark:bg-[#2A2A2A] font-bold text-[#EDCF5D]" : "hover:bg-gray-100 dark:hover:bg-[#2A2A2A]"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-bold">•</span>
                    <span>Bulleted list</span>
                  </div>
                  {activeFormats.unorderedList && <span>✓</span>}
                </button>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => applyList("number")}
                  className={`w-full text-left px-3 py-1.5 transition-colors cursor-pointer flex items-center justify-between ${
                    activeFormats.orderedList ? "bg-gray-100 dark:bg-[#2A2A2A] font-bold text-[#EDCF5D]" : "hover:bg-gray-100 dark:hover:bg-[#2A2A2A]"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[11px] font-bold">1.</span>
                    <span>Numbered list</span>
                  </div>
                  {activeFormats.orderedList && <span>✓</span>}
                </button>
                <div className="h-px bg-gray-200 dark:bg-[#333333] my-1" />
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => applyIndent("increase")}
                  className="w-full text-left px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-[#2A2A2A] transition-colors cursor-pointer flex items-center gap-2 text-gray-700 dark:text-gray-300"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12m-8.25-10.5l3.75 3.75-3.75 3.75" />
                  </svg>
                  <span>Increase indent</span>
                </button>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => applyIndent("decrease")}
                  className="w-full text-left px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-[#2A2A2A] transition-colors cursor-pointer flex items-center gap-2 text-gray-700 dark:text-gray-300"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12m3.75-7.5L12 9.75l3.75 3.75" />
                  </svg>
                  <span>Decrease indent</span>
                </button>
              </div>
            )}
          </div>

          <div className="h-3.5 w-px bg-gray-200 dark:bg-[#333333] mx-1" />

          {/* 3. Bold (B Toggle) */}
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              exec("bold");
            }}
            title="Bold (Ctrl+B)"
            className={`w-7 h-7 rounded-[4px] font-black text-xs flex items-center justify-center transition-colors cursor-pointer ${
              activeFormats.bold
                ? "bg-[#EDCF5D] text-black font-extrabold shadow-xs"
                : "text-gray-700 dark:text-gray-200 hover:bg-gray-200/60 dark:hover:bg-[#282828]"
            }`}
          >
            B
          </button>

          {/* 4. Italic (I Toggle) */}
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              exec("italic");
            }}
            title="Italic (Ctrl+I)"
            className={`w-7 h-7 rounded-[4px] italic font-serif text-xs flex items-center justify-center transition-colors cursor-pointer ${
              activeFormats.italic
                ? "bg-[#EDCF5D] text-black font-extrabold shadow-xs"
                : "text-gray-700 dark:text-gray-200 hover:bg-gray-200/60 dark:hover:bg-[#282828]"
            }`}
          >
            I
          </button>

          {/* 5. Strikethrough (S̶ Toggle) */}
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              exec("strikeThrough");
            }}
            title="Strikethrough"
            className={`w-7 h-7 rounded-[4px] line-through text-xs font-semibold flex items-center justify-center transition-colors cursor-pointer ${
              activeFormats.strikethrough
                ? "bg-[#EDCF5D] text-black font-extrabold shadow-xs"
                : "text-gray-700 dark:text-gray-200 hover:bg-gray-200/60 dark:hover:bg-[#282828]"
            }`}
          >
            S
          </button>

          {/* 6. Link (🔗 Open Modal) */}
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              openLinkDialog();
            }}
            title="Insert Link (Ctrl+K)"
            className="w-7 h-7 rounded-[4px] flex items-center justify-center text-gray-700 dark:text-gray-200 hover:bg-gray-200/60 dark:hover:bg-[#282828] cursor-pointer transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-3.048l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
            </svg>
          </button>

          {/* 7. Table Picker (⊞ ⌄) */}
          <div className="relative">
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                saveCurrentSelection();
              }}
              onClick={() => {
                setIsTableMenuOpen((prev) => !prev);
                setIsHeadingMenuOpen(false);
                setIsListMenuOpen(false);
                setIsMoreMenuOpen(false);
              }}
              title="Insert Interactive Table"
              className={`h-7 px-1.5 rounded-[4px] flex items-center gap-1 transition-colors cursor-pointer ${
                isTableMenuOpen
                  ? "bg-gray-200 dark:bg-[#333333] text-gray-900 dark:text-white"
                  : "text-gray-700 dark:text-gray-200 hover:bg-gray-200/60 dark:hover:bg-[#282828]"
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h12A2.25 2.25 0 0120.25 6v12A2.25 2.25 0 0118 20.25H6A2.25 2.25 0 013.75 18V6zM3.75 10.5h16.5m-16.5 4.5h16.5M10.5 3.75v16.5" />
              </svg>
              <svg className={`w-2.5 h-2.5 transition-transform ${isTableMenuOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Table Grid Popover */}
            {isTableMenuOpen && (
              <div className="absolute left-0 top-full mt-1.5 p-3 w-[164px] min-w-[164px] bg-white dark:bg-[#1E1E1E] text-gray-900 dark:text-white border border-gray-200 dark:border-[#333333] rounded-[8px] shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-100 font-sans">
                <div className="flex items-center justify-between text-xs font-semibold mb-2.5 text-gray-700 dark:text-gray-300">
                  <span className="text-xs font-medium">Table</span>
                  <span className="font-mono text-[#9E7B00] dark:text-[#EDCF5D] text-[11px] font-bold">
                    {hoveredTable.rows > 0 ? `${hoveredTable.cols} × ${hoveredTable.rows}` : "Select size"}
                  </span>
                </div>

                <div
                  className="grid grid-cols-5 gap-1.5 w-full"
                  onMouseLeave={() => setHoveredTable({ rows: 0, cols: 0 })}
                >
                  {Array.from({ length: 5 }).map((_, rowIdx) =>
                    Array.from({ length: 5 }).map((__, colIdx) => {
                      const r = rowIdx + 1;
                      const c = colIdx + 1;
                      const isHighlighted = r <= hoveredTable.rows && c <= hoveredTable.cols;
                      return (
                        <button
                          key={`${r}-${c}`}
                          type="button"
                          onMouseEnter={() => setHoveredTable({ rows: r, cols: c })}
                          onClick={() => insertTable(r, c)}
                          className={`w-5.5 h-5.5 shrink-0 rounded-[3px] border transition-all cursor-pointer ${
                            isHighlighted
                              ? "bg-[#EDCF5D] border-[#EDCF5D] shadow-xs"
                              : "bg-gray-100 dark:bg-[#282828] border-gray-300 dark:border-[#3E3E3E] hover:border-[#EDCF5D]"
                          }`}
                        />
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 8. Clear Formatting (Ab with eraser) */}
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              handleClearFormatting();
            }}
            title="Clear Formatting from selected text"
            className="h-7 px-1.5 rounded-[4px] flex items-center gap-0.5 text-gray-700 dark:text-gray-200 hover:bg-gray-200/60 dark:hover:bg-[#282828] cursor-pointer transition-colors"
          >
            <span className="font-bold text-[11px] font-sans">Ab</span>
            <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9.75L14.25 12m0 0l2.25 2.25M14.25 12l2.25-2.25M14.25 12L12 14.25m-2.58 4.92l-6.375-6.375a1.125 1.125 0 010-1.59L9.42 4.83a1.125 1.125 0 011.59 0l6.375 6.375a1.125 1.125 0 010 1.59l-6.375 6.375a1.125 1.125 0 01-1.59 0z" />
            </svg>
          </button>

          {/* 9. More Options (•••) */}
          <div className="relative">
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                saveCurrentSelection();
              }}
              onClick={() => {
                setIsMoreMenuOpen((prev) => !prev);
                setIsHeadingMenuOpen(false);
                setIsListMenuOpen(false);
                setIsTableMenuOpen(false);
              }}
              title="More options (Quotes, Divider, Code)"
              className={`w-7 h-7 rounded-[4px] flex items-center justify-center font-bold text-xs transition-colors cursor-pointer ${
                isMoreMenuOpen
                  ? "bg-gray-200 dark:bg-[#333333] text-gray-900 dark:text-white"
                  : "text-gray-700 dark:text-gray-200 hover:bg-gray-200/60 dark:hover:bg-[#282828]"
              }`}
            >
              •••
            </button>

            {/* More Menu Popup */}
            {isMoreMenuOpen && (
              <div className="absolute left-0 top-full mt-1.5 w-48 bg-white dark:bg-[#1E1E1E] text-gray-900 dark:text-white border border-gray-200 dark:border-[#333333] rounded-[8px] shadow-2xl py-1 z-50 animate-in fade-in zoom-in-95 duration-100 text-xs font-sans">
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={insertBlockquote}
                  className="w-full text-left px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-[#2A2A2A] transition-colors cursor-pointer flex items-center gap-2"
                >
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M4.583 17.321C3.553 16.227 3 15 3 13.011c0-3.5 2.457-6.637 6.03-8.188l.893 1.378c-3.335 1.804-3.987 4.145-4.247 5.621.537-.278 1.24-.375 1.929-.311 1.804.167 3.226 1.648 3.226 3.489a3.5 3.5 0 01-3.5 3.5c-1.073 0-2.099-.49-2.748-1.18zm10 0C13.553 16.227 13 15 13 13.011c0-3.5 2.457-6.637 6.03-8.188l.893 1.378c-3.335 1.804-3.987 4.145-4.247 5.621.537-.278 1.24-.375 1.929-.311 1.804.167 3.226 1.648 3.226 3.489a3.5 3.5 0 01-3.5 3.5c-1.073 0-2.099-.49-2.748-1.18z" />
                  </svg>
                  <span>Blockquote</span>
                </button>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={insertCodeBlock}
                  className="w-full text-left px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-[#2A2A2A] transition-colors cursor-pointer flex items-center gap-2 font-mono text-[11px]"
                >
                  <span>&lt;/&gt;</span>
                  <span>Code block</span>
                </button>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={insertDivider}
                  className="w-full text-left px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-[#2A2A2A] transition-colors cursor-pointer flex items-center gap-2 text-gray-700 dark:text-gray-300"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5" />
                  </svg>
                  <span>Horizontal rule</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ────── UNIFIED WYSIWYG DOCUMENT CANVAS ────── */}
      <div
        ref={editorRef}
        contentEditable
        onInput={handleInput}
        onKeyUp={updateToolbarState}
        onMouseUp={updateToolbarState}
        onSelect={saveCurrentSelection}
        data-placeholder={placeholder}
        className="editor-wysiwyg-canvas min-h-[220px] max-h-[520px] overflow-y-auto p-4 text-sm text-gray-900 dark:text-gray-100 outline-none leading-relaxed focus:ring-0 empty:before:content-[attr(data-placeholder)] empty:before:text-gray-400 dark:empty:before:text-gray-600 empty:before:pointer-events-none rounded-b-[6px]"
        style={{
          wordBreak: "break-word",
        }}
      />

      {/* ────── EXACT LINK DIALOG MODAL ────── */}
      {isLinkModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-[#242424] text-white border border-[#383838] rounded-[10px] p-5 w-full max-w-[340px] shadow-2xl space-y-4 font-sans animate-in zoom-in-95 duration-150">
            <h3 className="text-base font-bold text-white tracking-tight">Link</h3>

            <div
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleInsertLink();
                }
              }}
              className="space-y-3.5 text-xs"
            >
              <div>
                <label className="block text-gray-300 font-medium mb-1.5 text-xs">Display text</label>
                <input
                  type="text"
                  value={linkText}
                  onChange={(e) => setLinkText(e.target.value)}
                  placeholder="Text for the link (optional)"
                  className="w-full px-3 py-2 rounded-[6px] bg-[#1E1E1E] border border-[#3E3E3E] text-white placeholder-gray-500 focus:outline-none focus:border-[#E87A5D] transition-colors text-xs"
                />
              </div>

              <div>
                <label className="block text-gray-300 font-medium mb-1.5 text-xs">Address</label>
                <input
                  type="text"
                  autoFocus
                  required
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  placeholder="Link to an existing webpage"
                  className="w-full px-3 py-2 rounded-[6px] bg-[#1E1E1E] border border-[#3E3E3E] text-white placeholder-gray-500 focus:outline-none focus:border-[#E87A5D] transition-colors text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={handleInsertLink}
                  disabled={!linkUrl.trim()}
                  className={`px-4 py-1.5 rounded-[6px] text-xs font-semibold transition-all cursor-pointer ${
                    linkUrl.trim()
                      ? "bg-[#383838] hover:bg-[#484848] text-white border border-[#4C4C4C]"
                      : "bg-[#2D2D2D] text-gray-500 cursor-not-allowed border border-transparent"
                  }`}
                >
                  Insert
                </button>
                <button
                  type="button"
                  onClick={() => setIsLinkModalOpen(false)}
                  className="px-4 py-1.5 rounded-[6px] text-xs font-semibold bg-[#2C2C2C] hover:bg-[#383838] text-gray-300 transition-colors cursor-pointer border border-[#383838]"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ────── SCOPED TYPOGRAPHY & HEADING HIERARCHY STYLES ────── */}
      <style jsx global>{`
        .editor-wysiwyg-canvas h1 {
          font-size: 1.85rem !important;
          font-weight: 800 !important;
          line-height: 1.25 !important;
          margin-top: 1.25rem !important;
          margin-bottom: 0.5rem !important;
          letter-spacing: -0.025em !important;
          color: inherit !important;
        }
        .editor-wysiwyg-canvas h2 {
          font-size: 1.5rem !important;
          font-weight: 700 !important;
          line-height: 1.3 !important;
          margin-top: 1rem !important;
          margin-bottom: 0.4rem !important;
          letter-spacing: -0.02em !important;
          color: inherit !important;
        }
        .editor-wysiwyg-canvas h3 {
          font-size: 1.25rem !important;
          font-weight: 700 !important;
          line-height: 1.35 !important;
          margin-top: 0.875rem !important;
          margin-bottom: 0.35rem !important;
          letter-spacing: -0.015em !important;
          color: inherit !important;
        }
        .editor-wysiwyg-canvas h4 {
          font-size: 1.075rem !important;
          font-weight: 600 !important;
          line-height: 1.4 !important;
          margin-top: 0.75rem !important;
          margin-bottom: 0.25rem !important;
          color: inherit !important;
        }
        .editor-wysiwyg-canvas h5 {
          font-size: 0.95rem !important;
          font-weight: 600 !important;
          line-height: 1.4 !important;
          margin-top: 0.625rem !important;
          margin-bottom: 0.25rem !important;
          color: inherit !important;
        }
        .editor-wysiwyg-canvas h6 {
          font-size: 0.8rem !important;
          font-weight: 600 !important;
          text-transform: uppercase !important;
          letter-spacing: 0.05em !important;
          margin-top: 0.5rem !important;
          margin-bottom: 0.25rem !important;
          opacity: 0.75 !important;
          color: inherit !important;
        }
        .editor-wysiwyg-canvas p {
          font-size: 0.875rem !important;
          line-height: 1.6 !important;
          margin-top: 0.375rem !important;
          margin-bottom: 0.375rem !important;
        }
        .editor-wysiwyg-canvas strong,
        .editor-wysiwyg-canvas b {
          font-weight: 700 !important;
        }
        .editor-wysiwyg-canvas em,
        .editor-wysiwyg-canvas i {
          font-style: italic !important;
        }
        .editor-wysiwyg-canvas blockquote {
          border-left: 3px solid #EDCF5D !important;
          padding-left: 0.85rem !important;
          margin: 0.75rem 0 !important;
          font-style: italic !important;
          background: rgba(237, 207, 93, 0.06) !important;
          border-radius: 0 4px 4px 0 !important;
        }
        .editor-wysiwyg-canvas ul {
          list-style-type: disc !important;
          padding-left: 1.35rem !important;
          margin: 0.5rem 0 !important;
        }
        .editor-wysiwyg-canvas ol {
          list-style-type: decimal !important;
          padding-left: 1.35rem !important;
          margin: 0.5rem 0 !important;
        }
        .editor-wysiwyg-canvas li {
          margin: 0.25rem 0 !important;
        }
        .editor-wysiwyg-canvas hr {
          margin: 1.25rem 0 !important;
          border: 0 !important;
          border-top: 1px solid rgba(128, 128, 128, 0.25) !important;
        }
      `}</style>
    </div>
  );
}
