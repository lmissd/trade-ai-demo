import fs from "node:fs";
import path from "node:path";
import * as XLSX from "xlsx";
import { DocumentType, Prisma } from "@prisma/client";

export const supportedDocumentExtensions = [
  ".pdf",
  ".doc",
  ".docx",
  ".png",
  ".jpg",
  ".jpeg",
  ".xlsx",
  ".xls",
  ".csv"
] as const;

export const supportedSpreadsheetExtensions = [".xlsx", ".xls", ".csv"] as const;

export const unsupportedFileTypeMessage =
  "上传文件格式不支持，请上传 PDF、Word、图片或 Excel/CSV 文件。";

type SpreadsheetSourceFormat = "excel" | "csv";

type ParsedSheetSummary = {
  name: string;
  rowCount: number;
  columnCount: number;
};

export type ParsedSpreadsheetDocument = {
  sourceFormat: SpreadsheetSourceFormat;
  sheets: ParsedSheetSummary[];
  activeSheetName: string | null;
  headerMap: Prisma.JsonObject;
  summaryFields: Prisma.JsonObject;
  lineItems: Prisma.JsonObject[];
  previewRows: Prisma.JsonObject[];
  warnings: string[];
};

type FieldKey =
  | "contractNoDraft"
  | "batchNoDraft"
  | "productName"
  | "customerName"
  | "supplierName"
  | "destinationWarehouse"
  | "totalQuantity"
  | "unit"
  | "amount"
  | "currency"
  | "deliveryDate"
  | "packingListNo"
  | "invoiceNo"
  | "unitPrice"
  | "paymentTerms"
  | "boxRange"
  | "packingDate";

const fieldAliasMap: Record<FieldKey, string[]> = {
  contractNoDraft: ["合同号", "合同编号", "合同号码", "contract no", "contract number", "contractno", "contract_no"],
  batchNoDraft: ["批次号", "批次编号", "批号", "batch no", "batch number", "batchno", "batch_no"],
  productName: ["商品名称", "货物名称", "产品名称", "品名", "sku名称", "sku name", "product", "product name", "goods"],
  customerName: ["客户", "客户名称", "买方", "采购方", "customer", "buyer"],
  supplierName: ["供应商", "供应商名称", "卖方", "供货方", "supplier", "seller"],
  destinationWarehouse: ["目的仓库", "目的地仓库", "仓库", "收货仓库", "destination warehouse", "warehouse"],
  totalQuantity: ["数量", "总数量", "合同数量", "本批数量", "箱数", "qty", "quantity", "total quantity"],
  unit: ["单位", "计量单位", "unit", "uom"],
  amount: ["金额", "总金额", "合同金额", "发票金额", "amount", "total amount", "invoice amount"],
  currency: ["币种", "货币", "currency"],
  deliveryDate: ["交期", "交货日期", "delivery date", "delivery"],
  packingListNo: ["箱单号", "装箱单号", "packing list no", "packinglistno"],
  invoiceNo: ["发票号", "发票编号", "invoice no", "invoice number", "invoiceno"],
  unitPrice: ["单价", "unit price", "price"],
  paymentTerms: ["付款条件", "付款条款", "payment terms", "terms"],
  boxRange: ["箱号范围", "箱号", "箱编号", "box range", "carton range", "carton no"],
  packingDate: ["装箱日期", "packing date"]
};

function normalizeExtension(fileName: string | null | undefined) {
  return path.extname(fileName ?? "").trim().toLowerCase();
}

function normalizeHeader(value: unknown) {
  return String(value ?? "")
    .trim()
    .replace(/^\uFEFF/, "")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function normalizeCellValue(value: unknown): string | number | boolean | null {
  if (value === null || typeof value === "undefined") {
    return null;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  const normalized = String(value).trim();
  return normalized.length > 0 ? normalized : null;
}

function readNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.replace(/,/g, "").replace(/[^\d.-]/g, "");
    if (normalized.length > 0) {
      const parsed = Number(normalized);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }

  return null;
}

function isNonEmptyRow(row: unknown[]) {
  return row.some((cell) => normalizeCellValue(cell) !== null);
}

function resolveFieldKey(header: unknown): FieldKey | null {
  const normalizedHeader = normalizeHeader(header);

  if (!normalizedHeader) {
    return null;
  }

  for (const [fieldKey, aliases] of Object.entries(fieldAliasMap) as Array<[FieldKey, string[]]>) {
    if (aliases.some((alias) => normalizeHeader(alias) === normalizedHeader)) {
      return fieldKey;
    }
  }

  return null;
}

function findHeaderRow(rows: unknown[][]) {
  let fallbackIndex = -1;

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index] ?? [];
    const nonEmptyCount = row.filter((cell) => normalizeCellValue(cell) !== null).length;
    const knownFieldCount = row.filter((cell) => resolveFieldKey(cell)).length;

    if (nonEmptyCount >= 2 && fallbackIndex < 0) {
      fallbackIndex = index;
    }

    if (knownFieldCount >= 2) {
      return index;
    }
  }

  return fallbackIndex;
}

function buildLineItems(headers: unknown[], rows: unknown[][], headerRowIndex: number) {
  const normalizedHeaders = headers.map((header, index) => {
    const headerText = String(header ?? "").trim();
    return headerText || `列${index + 1}`;
  });

  return rows
    .slice(headerRowIndex + 1)
    .filter(isNonEmptyRow)
    .slice(0, 100)
    .map((row) => {
      const item: Prisma.JsonObject = {};

      normalizedHeaders.forEach((header, index) => {
        const value = normalizeCellValue(row[index]);
        if (value !== null) {
          item[header] = value;
        }
      });

      return item;
    });
}

function buildSummaryFields(
  documentType: DocumentType,
  headers: unknown[],
  lineItems: Prisma.JsonObject[]
) {
  const headerMap: Prisma.JsonObject = {};
  const summaryFields: Prisma.JsonObject = {};
  const numericFields = new Set<FieldKey>(["totalQuantity", "amount", "unitPrice"]);

  headers.forEach((header) => {
    const fieldKey = resolveFieldKey(header);
    if (fieldKey) {
      headerMap[fieldKey] = String(header ?? "").trim();
    }
  });

  for (const [fieldKey, header] of Object.entries(headerMap)) {
    const headerName = String(header);
    const values = lineItems
      .map((item) => item[headerName])
      .filter((value) => value !== null && typeof value !== "undefined" && String(value).trim().length > 0);

    if (values.length === 0) {
      continue;
    }

    if (numericFields.has(fieldKey as FieldKey)) {
      if (fieldKey === "totalQuantity") {
        const numericValues = values.map(readNumber).filter((value): value is number => typeof value === "number");
        if (numericValues.length > 1) {
          summaryFields[fieldKey] = numericValues.reduce((sum, value) => sum + value, 0);
          continue;
        }
      }

      const firstNumber = readNumber(values[0]);
      if (firstNumber !== null) {
        summaryFields[fieldKey] = firstNumber;
        continue;
      }
    }

    summaryFields[fieldKey] = normalizeCellValue(values[0]);
  }

  if (documentType === DocumentType.PACKING_LIST && summaryFields.totalQuantity) {
    summaryFields.packingQuantity = summaryFields.totalQuantity;
  }

  if (documentType === DocumentType.INVOICE && summaryFields.amount) {
    summaryFields.invoiceAmount = summaryFields.amount;
  }

  return { headerMap, summaryFields };
}

export function isSupportedDocumentFileName(fileName: string | null | undefined) {
  const extension = normalizeExtension(fileName);
  return supportedDocumentExtensions.includes(extension as (typeof supportedDocumentExtensions)[number]);
}

export function isSpreadsheetFileName(fileName: string | null | undefined) {
  const extension = normalizeExtension(fileName);
  return supportedSpreadsheetExtensions.includes(extension as (typeof supportedSpreadsheetExtensions)[number]);
}

export function getSupportedUploadHint() {
  return "支持 PDF、Word、图片（PNG/JPG/JPEG）以及 Excel/CSV（XLSX/XLS/CSV）。";
}

export async function parseSpreadsheetDocument(
  filePath: string,
  documentType: DocumentType
): Promise<ParsedSpreadsheetDocument> {
  const extension = normalizeExtension(filePath);
  const sourceFormat: SpreadsheetSourceFormat = extension === ".csv" ? "csv" : "excel";
  const workbook =
    extension === ".csv"
      ? XLSX.read(fs.readFileSync(filePath, "utf8"), {
          type: "string",
          cellDates: false,
          raw: false
        })
      : XLSX.readFile(filePath, {
          cellDates: false,
          raw: false
        });

  const sheets = workbook.SheetNames.map((sheetName) => {
    const worksheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
      header: 1,
      defval: "",
      raw: false,
      blankrows: false
    });

    return {
      name: sheetName,
      rowCount: rows.length,
      columnCount: rows.reduce((max, row) => Math.max(max, row.length), 0)
    };
  });

  const activeSheetName = workbook.SheetNames.find((sheetName) => {
    const summary = sheets.find((item) => item.name === sheetName);
    return Boolean(summary && summary.rowCount > 0 && summary.columnCount > 0);
  }) ?? null;

  if (!activeSheetName) {
    return {
      sourceFormat,
      sheets,
      activeSheetName: null,
      headerMap: {},
      summaryFields: {},
      lineItems: [],
      previewRows: [],
      warnings: ["Excel/CSV 文件中没有可识别的数据行。"]
    };
  }

  const activeSheet = workbook.Sheets[activeSheetName];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(activeSheet, {
    header: 1,
    defval: "",
    raw: false,
    blankrows: false
  });
  const headerRowIndex = findHeaderRow(rows);

  if (headerRowIndex < 0) {
    return {
      sourceFormat,
      sheets,
      activeSheetName,
      headerMap: {},
      summaryFields: {},
      lineItems: [],
      previewRows: [],
      warnings: [`工作表 ${activeSheetName} 中没有找到可识别表头。`]
    };
  }

  const headers = rows[headerRowIndex] ?? [];
  const lineItems = buildLineItems(headers, rows, headerRowIndex);
  const { headerMap, summaryFields } = buildSummaryFields(documentType, headers, lineItems);
  const warnings: string[] = [];

  if (Object.keys(headerMap).length === 0) {
    warnings.push("未识别到标准业务表头，已保留原始明细预览，请人工核对。");
  }

  if (lineItems.length === 0) {
    warnings.push("未识别到有效明细行，请检查 Excel/CSV 是否为空。");
  }

  if (!summaryFields.contractNoDraft) {
    warnings.push("未从 Excel/CSV 中识别到合同号，将使用 Demo Mock 默认合同草稿号。");
  }

  if (
    (documentType === DocumentType.CONTRACT || documentType === DocumentType.PACKING_LIST) &&
    !summaryFields.totalQuantity
  ) {
    warnings.push("未从 Excel/CSV 中识别到数量，将使用 DemoConfig 默认数量。");
  }

  return {
    sourceFormat,
    sheets,
    activeSheetName,
    headerMap,
    summaryFields,
    lineItems,
    previewRows: lineItems.slice(0, 10),
    warnings
  };
}
