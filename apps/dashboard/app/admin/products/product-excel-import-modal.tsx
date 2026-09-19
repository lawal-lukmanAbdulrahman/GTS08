"use client";

import { API_BASE } from "../../lib/api-base";
import { useState, useRef } from "react";
import {
  parseProductsFromExcel,
  downloadSampleExcelTemplate,
  ParsedImportResult,
  ExcelImportRow,
} from "./product-excel-service";

interface ProductExcelImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportSuccess: () => void;
}

export default function ProductExcelImportModal({
  isOpen,
  onClose,
  onImportSuccess,
}: ProductExcelImportModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [parseResult, setParseResult] = useState<ParsedImportResult | null>(null);
  const [parseError, setParseError] = useState("");

  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<{ current: number; total: number }>({ current: 0, total: 0 });
  const [importSuccessCount, setImportSuccessCount] = useState<number | null>(null);
  const [importError, setImportError] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileSelected = async (selectedFile: File) => {
    if (!selectedFile.name.match(/\.(xlsx|xls|csv)$/i)) {
      setParseError("Please select a valid Excel (.xlsx, .xls) or CSV file.");
      return;
    }

    setFile(selectedFile);
    setParseError("");
    setParseResult(null);
    setImportSuccessCount(null);
    setImportError("");
    setIsParsing(true);

    try {
      const result = await parseProductsFromExcel(selectedFile);
      setParseResult(result);
      if (result.validRows.length === 0 && result.invalidRows.length > 0) {
        setParseError("No valid product rows were found in the uploaded file. Please review the errors below.");
      }
    } catch (err: any) {
      setParseError(err.message || "Failed to parse Excel file. Please ensure it is a valid workbook.");
    } finally {
      setIsParsing(false);
    }
  };

  const handleExecuteImport = async () => {
    if (!parseResult || parseResult.validRows.length === 0) return;

    setIsImporting(true);
    setImportError("");
    setImportProgress({ current: 0, total: parseResult.validRows.length });

    const token = localStorage.getItem("gts_token");
    let successful = 0;
    const errors: string[] = [];

    for (let i = 0; i < parseResult.validRows.length; i++) {
      const row = parseResult.validRows[i]!;
      setImportProgress({ current: i + 1, total: parseResult.validRows.length });

      try {
        const baseKobo = Math.round(row.base_price * 100);
        const compareKobo = row.compare_at_price ? Math.round(row.compare_at_price * 100) : null;
        const costKobo = row.cost_price ? Math.round(row.cost_price * 100) : null;
        const parsedTags = row.tags
          ? row.tags.split(",").map((t) => t.trim()).filter(Boolean)
          : [];
        if (row.brand && !parsedTags.includes(row.brand)) {
          parsedTags.push(row.brand);
        }

        const payload = {
          name: row.name,
          slug: row.name.toLowerCase().replace(/[^a-z0-9]+/g, "-") + "-" + Date.now().toString().slice(-4),
          sku: row.sku || undefined,
          brand: row.brand || "GTS",
          category_name: row.category,
          sub_category: row.sub_category || "",
          base_price: baseKobo,
          compare_at_price: compareKobo,
          cost_price: costKobo,
          status: row.status || "active",
          has_transparent_bg: true,
          image_url: row.primary_image_url || undefined,
          short_description: row.short_description || "",
          description: row.description || "",
          tags: parsedTags,
          variants: [
            {
              size: "Standard",
              color: "Default",
              color_hex: "#111827",
              quantity: row.stock_quantity ?? 100,
              variant_image_url: row.primary_image_url || "",
              has_transparent_bg: true,
            },
          ],
        };

        const res = await fetch(`${API_BASE}/products`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const json = await res.json().catch(() => ({}));
          throw new Error(json.error || `Failed to create product (${res.status})`);
        }

        successful++;
      } catch (err: any) {
        errors.push(`Row "${row.name}": ${err.message}`);
      }
    }

    setIsImporting(false);
    setImportSuccessCount(successful);

    if (errors.length > 0) {
      setImportError(`Imported ${successful} products with ${errors.length} errors. Sample: ${errors[0]}`);
    }

    if (successful > 0) {
      onImportSuccess();
    }
  };

  const handleReset = () => {
    setFile(null);
    setParseResult(null);
    setParseError("");
    setImportError("");
    setImportSuccessCount(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs font-sans">
      <div className="w-full max-w-2xl bg-white dark:bg-[#181818] border border-gray-200 dark:border-[#2C2C2C] rounded-[16px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 dark:border-[#262626] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#EDCF5D]/15 text-[#EDCF5D] flex items-center justify-center font-bold">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-gray-900 dark:text-white">
                Import Products via Excel (.xlsx)
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                Upload spreadsheet with product catalog details
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-[#242424] transition-colors cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          {/* Template Download Banner */}
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs">
            <div className="space-y-0.5">
              <p className="font-semibold text-amber-800 dark:text-amber-300">
                Need the standard Excel layout?
              </p>
              <p className="text-amber-700/80 dark:text-amber-400/80 text-[11px]">
                Download sample .xlsx file with ready-to-fill column headers & example items.
              </p>
            </div>
            <button
              type="button"
              onClick={downloadSampleExcelTemplate}
              className="px-3 py-1.5 rounded-md bg-[#EDCF5D] hover:bg-[#e2c34d] text-black font-bold transition-all shadow-xs shrink-0 cursor-pointer text-[11px] flex items-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M7.5 12L12 16.5m0 0L16.5 12m-4.5 4.5V3" />
              </svg>
              <span>Download Template</span>
            </button>
          </div>

          {/* Upload Drop Zone */}
          {!file && (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                const f = e.dataTransfer.files?.[0];
                if (f) handleFileSelected(f);
              }}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-3 ${
                isDragging
                  ? "border-[#EDCF5D] bg-[#EDCF5D]/10 scale-[1.01]"
                  : "border-gray-300 dark:border-[#333333] hover:border-[#EDCF5D] bg-gray-50/50 dark:bg-[#1C1C1C]/50 hover:bg-gray-100/50 dark:hover:bg-[#222222]"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx, .xls, .csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFileSelected(f);
                }}
              />
              <div className="w-12 h-12 rounded-full bg-[#EDCF5D]/15 text-[#EDCF5D] flex items-center justify-center">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m6.75 12l-3-3m0 0l-3 3m3-3v6m-1.5-15H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                </svg>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-bold text-gray-800 dark:text-gray-200">
                  Click to choose Excel file, or <span className="text-[#9E7B00] dark:text-[#EDCF5D] underline">drag and drop</span>
                </p>
                <p className="text-[11px] text-gray-400 font-mono">
                  Supports .xlsx, .xls, and .csv
                </p>
              </div>
            </div>
          )}

          {/* Parsing State */}
          {isParsing && (
            <div className="flex items-center justify-center gap-2.5 py-6 text-xs text-gray-500 font-medium">
              <svg className="w-4 h-4 animate-spin text-[#EDCF5D]" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span>Reading and validating spreadsheet rows...</span>
            </div>
          )}

          {/* Parse Error */}
          {parseError && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs font-medium">
              {parseError}
            </div>
          )}

          {/* File Loaded & Summary */}
          {file && parseResult && !isParsing && (
            <div className="space-y-4">
              {/* File Info Bar */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-[#202020] border border-gray-200 dark:border-[#333333]">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-lg bg-[#EDCF5D]/20 text-[#EDCF5D]">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-gray-900 dark:text-white truncate max-w-[260px] sm:max-w-[360px]">
                      {file.name}
                    </p>
                    <p className="text-[10px] text-gray-400 font-mono">
                      {(file.size / 1024).toFixed(1)} KB · {parseResult.totalRows} Total Rows
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleReset}
                  disabled={isImporting}
                  className="text-xs text-gray-500 hover:text-red-500 dark:text-gray-400 dark:hover:text-red-400 font-medium transition-colors cursor-pointer"
                >
                  Change File
                </button>
              </div>

              {/* Status Counters */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400 tracking-wider">
                      Ready to Import
                    </p>
                    <p className="text-lg font-extrabold text-emerald-700 dark:text-emerald-300">
                      {parseResult.validRows.length} Products
                    </p>
                  </div>
                  <span className="w-7 h-7 rounded-full bg-emerald-500 text-white flex items-center justify-center text-xs font-black">
                    ✓
                  </span>
                </div>

                <div className={`p-3 rounded-xl border flex items-center justify-between ${
                  parseResult.invalidRows.length > 0
                    ? "bg-amber-500/10 border-amber-500/20"
                    : "bg-gray-100 dark:bg-[#222222] border-gray-200 dark:border-[#333333]"
                }`}>
                  <div>
                    <p className="text-[10px] uppercase font-bold text-gray-500 dark:text-gray-400 tracking-wider">
                      Skipped / Invalid
                    </p>
                    <p className={`text-lg font-extrabold ${parseResult.invalidRows.length > 0 ? "text-amber-600 dark:text-amber-400" : "text-gray-500"}`}>
                      {parseResult.invalidRows.length} Rows
                    </p>
                  </div>
                  <span className="text-xs font-mono text-gray-400">
                    {parseResult.invalidRows.length === 0 ? "0 errors" : "Review"}
                  </span>
                </div>
              </div>

              {/* Valid Rows Preview Table */}
              {parseResult.validRows.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                    Valid Items Preview ({Math.min(5, parseResult.validRows.length)} of {parseResult.validRows.length})
                  </span>
                  <div className="max-h-40 overflow-y-auto rounded-xl border border-gray-200 dark:border-[#333333] divide-y divide-gray-100 dark:divide-[#282828] text-xs">
                    {parseResult.validRows.slice(0, 5).map((row, idx) => (
                      <div key={idx} className="p-2.5 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-[#202020]">
                        <div className="space-y-0.5">
                          <p className="font-semibold text-gray-900 dark:text-gray-100">
                            {row.name}
                          </p>
                          <p className="text-[11px] text-gray-400">
                            {row.category} {row.sub_category ? `· ${row.sub_category}` : ""} · {row.brand}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-gray-900 dark:text-white">
                            ₦{row.base_price.toLocaleString("en-NG")}
                          </p>
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-[#333333] text-gray-600 dark:text-gray-300 font-mono">
                            Qty: {row.stock_quantity ?? 100}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Invalid Rows Issues list */}
              {parseResult.invalidRows.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                    Invalid Rows ({parseResult.invalidRows.length})
                  </span>
                  <div className="max-h-32 overflow-y-auto rounded-xl border border-amber-500/20 bg-amber-500/5 p-2.5 divide-y divide-amber-500/10 text-[11px] text-amber-800 dark:text-amber-300">
                    {parseResult.invalidRows.map((inv, i) => (
                      <div key={i} className="py-1 flex items-center justify-between">
                        <span>Row {inv.rowNumber}: {inv.reason}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Import Progress Bar */}
              {isImporting && (
                <div className="space-y-1.5 pt-2">
                  <div className="flex items-center justify-between text-xs font-semibold text-gray-700 dark:text-gray-300">
                    <span>Importing products to GTS database...</span>
                    <span>{importProgress.current} / {importProgress.total}</span>
                  </div>
                  <div className="w-full h-2 bg-gray-200 dark:bg-[#333333] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#EDCF5D] transition-all duration-300"
                      style={{ width: `${(importProgress.current / importProgress.total) * 100}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Success Notification */}
              {importSuccessCount !== null && (
                <div className="p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-xs flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[10px] font-black shrink-0">
                      ✓
                    </span>
                    <span className="font-bold">
                      Successfully imported {importSuccessCount} products into your store catalog!
                    </span>
                  </div>
                </div>
              )}

              {importError && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs font-medium">
                  {importError}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-gray-100 dark:border-[#262626] bg-gray-50/50 dark:bg-[#151515] flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            disabled={isImporting}
            className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-[#242424] dark:hover:bg-[#2C2C2C] text-xs font-semibold text-gray-700 dark:text-gray-300 transition-colors cursor-pointer"
          >
            {importSuccessCount !== null ? "Done" : "Cancel"}
          </button>

          {parseResult && parseResult.validRows.length > 0 && importSuccessCount === null && (
            <button
              type="button"
              onClick={handleExecuteImport}
              disabled={isImporting}
              className="px-5 py-2 rounded-lg bg-[#EDCF5D] hover:bg-[#e2c34d] text-black text-xs font-bold transition-all shadow-sm flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isImporting ? (
                <>
                  <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>Importing ({importProgress.current}/{importProgress.total})...</span>
                </>
              ) : (
                <span>Import {parseResult.validRows.length} Products</span>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
