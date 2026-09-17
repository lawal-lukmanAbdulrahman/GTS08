"use client";

import React from "react";
import { sanitizeXss, sanitizeUrl, escapeHtml } from "@gts/utils";

interface MarkdownContentProps {
  content: string;
  className?: string;
}

export function MarkdownContent({ content, className = "" }: MarkdownContentProps) {
  if (!content || !content.trim()) return null;

  // If content is already rich HTML (contains standard tags), sanitize and render
  if (/<(p|h[1-6]|ul|ol|table|blockquote|div|strong|em|hr)[^>]*>/i.test(content)) {
    const sanitizedHtml = sanitizeXss(content);
    return (
      <div
        className={`prose prose-sm max-w-none text-gray-700 leading-relaxed font-sans [&_table]:w-full [&_table]:border-collapse [&_table]:border [&_table]:border-gray-200 [&_table]:my-4 [&_table]:rounded-xl [&_thead]:bg-[#F9F8F5] [&_th]:p-3 [&_th]:border [&_th]:border-gray-200 [&_th]:font-bold [&_th]:text-[#010101] [&_td]:p-3 [&_td]:border [&_td]:border-gray-100 [&_blockquote]:border-l-3 [&_blockquote]:border-[#EDCF5D] [&_blockquote]:bg-[#F9F8F5] [&_blockquote]:p-3 [&_blockquote]:italic [&_blockquote]:my-3 [&_h1]:text-2xl [&_h1]:font-black [&_h1]:text-[#010101] [&_h2]:text-xl [&_h2]:font-extrabold [&_h2]:text-[#010101] [&_h3]:text-lg [&_h3]:font-bold [&_h3]:text-[#010101] [&_h4]:text-base [&_h4]:font-bold [&_h4]:text-[#010101] [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_a]:text-[#010101] [&_a]:underline [&_a]:font-semibold hover:[&_a]:text-[#EDCF5D] ${className}`}
        dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
      />
    );
  }

  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];
  let inList: "ul" | "ol" | null = null;
  let listItems: string[] = [];
  let inTable = false;
  let tableRows: string[][] = [];

  const flushList = () => {
    if (inList === "ul" && listItems.length > 0) {
      elements.push(
        <ul key={`ul-${elements.length}`} className="list-disc pl-5 space-y-2 my-3 text-gray-700 font-normal">
          {listItems.map((item, idx) => (
            <li key={idx} dangerouslySetInnerHTML={{ __html: formatInline(item) }} />
          ))}
        </ul>
      );
    } else if (inList === "ol" && listItems.length > 0) {
      elements.push(
        <ol key={`ol-${elements.length}`} className="list-decimal pl-5 space-y-2 my-3 text-gray-700 font-normal">
          {listItems.map((item, idx) => (
            <li key={idx} dangerouslySetInnerHTML={{ __html: formatInline(item) }} />
          ))}
        </ol>
      );
    }
    inList = null;
    listItems = [];
  };

  const flushTable = () => {
    if (inTable && tableRows.length > 0) {
      const headerRow = tableRows[0] || [];
      const bodyRows = tableRows.slice(1);
      elements.push(
        <div key={`table-${elements.length}`} className="overflow-x-auto my-4 border border-gray-200 rounded-xl shadow-2xs">
          <table className="w-full text-xs sm:text-sm text-left border-collapse">
            {headerRow.length > 0 && (
              <thead className="bg-[#F9F8F5] border-b border-gray-200">
                <tr>
                  {headerRow.map((cell, idx) => (
                    <th
                      key={idx}
                      className="px-4 py-2.5 font-bold text-[#010101] border-r last:border-r-0 border-gray-200"
                      dangerouslySetInnerHTML={{ __html: formatInline(cell) }}
                    />
                  ))}
                </tr>
              </thead>
            )}
            <tbody className="divide-y divide-gray-100">
              {bodyRows.map((row, rIdx) => (
                <tr key={rIdx} className="hover:bg-gray-50/70 transition-colors">
                  {row.map((cell, cIdx) => (
                    <td
                      key={cIdx}
                      className="px-4 py-2.5 text-gray-700 border-r last:border-r-0 border-gray-100"
                      dangerouslySetInnerHTML={{ __html: formatInline(cell) }}
                    />
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
    inTable = false;
    tableRows = [];
  };

  const formatInline = (str: string) => {
    // 1. First escape all raw HTML characters to prevent inline tag injection
    const escaped = escapeHtml(str);

    // 2. Safely apply markdown inline syntax
    return escaped
      .replace(/\*\*(.*?)\*\*/g, "<strong class='font-bold text-[#010101]'>$1</strong>")
      .replace(/\*(.*?)\*/g, "<em class='italic'>$1</em>")
      .replace(/~~(.*?)~~/g, "<del class='line-through text-gray-400'>$1</del>")
      .replace(/\[(.*?)\]\((.*?)\)/g, (_match, label, url) => {
        const safeUrl = sanitizeUrl(url, "#");
        return `<a href='${safeUrl}' target='_blank' rel='noopener noreferrer' class='text-[#010101] font-semibold underline underline-offset-2 hover:text-[#EDCF5D] transition-colors'>${label}</a>`;
      })
      .replace(/`(.*?)`/g, "<code class='px-1.5 py-0.5 rounded bg-gray-100 font-mono text-xs text-gray-800'>$1</code>");
  };

  lines.forEach((line, lineIdx) => {
    const trimmed = line.trim();

    // Check for Table Row
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
      elements.push(
        <h6
          key={lineIdx}
          className="text-xs font-bold text-gray-500 uppercase tracking-wider mt-3 mb-1"
          dangerouslySetInnerHTML={{ __html: formatInline(trimmed.slice(7)) }}
        />
      );
    } else if (trimmed.startsWith("##### ")) {
      flushList();
      elements.push(
        <h5
          key={lineIdx}
          className="text-xs sm:text-sm font-bold text-[#010101] mt-3.5 mb-1"
          dangerouslySetInnerHTML={{ __html: formatInline(trimmed.slice(6)) }}
        />
      );
    } else if (trimmed.startsWith("#### ")) {
      flushList();
      elements.push(
        <h4
          key={lineIdx}
          className="text-sm sm:text-base font-bold text-[#010101] mt-4 mb-1.5"
          dangerouslySetInnerHTML={{ __html: formatInline(trimmed.slice(5)) }}
        />
      );
    } else if (trimmed.startsWith("### ")) {
      flushList();
      elements.push(
        <h3
          key={lineIdx}
          className="text-base sm:text-lg font-bold text-[#010101] mt-5 mb-2"
          dangerouslySetInnerHTML={{ __html: formatInline(trimmed.slice(4)) }}
        />
      );
    } else if (trimmed.startsWith("## ")) {
      flushList();
      elements.push(
        <h2
          key={lineIdx}
          className="text-lg sm:text-xl font-extrabold text-[#010101] mt-6 mb-2.5"
          dangerouslySetInnerHTML={{ __html: formatInline(trimmed.slice(3)) }}
        />
      );
    } else if (trimmed.startsWith("# ")) {
      flushList();
      elements.push(
        <h1
          key={lineIdx}
          className="text-xl sm:text-2xl font-black text-[#010101] mt-7 mb-3"
          dangerouslySetInnerHTML={{ __html: formatInline(trimmed.slice(2)) }}
        />
      );
    } else if (trimmed.startsWith("- ") || trimmed.startsWith("* ") || trimmed.startsWith("• ")) {
      const itemText = trimmed.replace(/^[-*•]\s+/, "");
      if (inList !== "ul") {
        flushList();
        inList = "ul";
      }
      listItems.push(itemText);
    } else if (/^\d+\.\s+/.test(trimmed)) {
      const itemText = trimmed.replace(/^\d+\.\s+/, "");
      if (inList !== "ol") {
        flushList();
        inList = "ol";
      }
      listItems.push(itemText);
    } else if (trimmed.startsWith("> ")) {
      flushList();
      elements.push(
        <blockquote
          key={lineIdx}
          className="border-l-3 border-[#EDCF5D] pl-4 py-2 my-3 bg-[#F9F8F5] rounded-r text-xs sm:text-sm text-gray-800 italic"
          dangerouslySetInnerHTML={{ __html: formatInline(trimmed.slice(2)) }}
        />
      );
    } else if (trimmed === "---" || trimmed === "***") {
      flushList();
      elements.push(<hr key={lineIdx} className="my-5 border-gray-200" />);
    } else if (trimmed.length > 0) {
      flushList();
      elements.push(
        <p
          key={lineIdx}
          className="text-xs sm:text-sm text-gray-600 font-normal leading-relaxed my-2.5"
          dangerouslySetInnerHTML={{ __html: formatInline(trimmed) }}
        />
      );
    } else {
      flushList();
    }
  });

  flushList();
  flushTable();

  return <div className={`space-y-1 font-sans ${className}`}>{elements}</div>;
}
