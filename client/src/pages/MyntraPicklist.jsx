import { useEffect, useMemo, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import JsBarcode from 'jsbarcode';
import {
  FiDownload,
  FiFileText,
  FiPrinter,
  FiRefreshCw,
  FiSearch,
  FiTrash2,
  FiUpload,
  FiX,
} from 'react-icons/fi';
import toast from 'react-hot-toast';

import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

const SIZE_ORDER = [
  'XS',
  'S',
  'M',
  'L',
  'XL',
  'XXL',
  '3XL',
  '4XL',
  '5XL',
];

const normalizeText = value =>
  String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim();

const cleanSku = value =>
  String(value ?? '')
    .replace(/[\uFFFE\uFFFF\uFFFD]/g, '-')
    .replace(/[–—−]/g, '-')
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, '')
    .replace(/^['"]+|['"]+$/g, '')
    .replace(/\s+/g, '')
    .trim();

const normalizeColor = value =>
  normalizeText(value)
    .replace(/[._]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();

const getDesignNumber = design => {
  const match = String(design || '').match(/D\s*(\d+)/i);
  return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
};

const parseSellerSku = sellerSku => {
  const sku = cleanSku(sellerSku);
  const parts = sku.split('-');

  if (parts.length < 3) {
    return { design: '', color: '', size: '' };
  }

  const size = parts[parts.length - 1].toUpperCase();
  const design = parts[0].toUpperCase();
  const color = parts.slice(1, -1).join('-');

  return { design, color, size };
};

const getSizeIndex = size => {
  const index = SIZE_ORDER.indexOf(String(size || '').toUpperCase());
  return index === -1 ? SIZE_ORDER.length : index;
};

const sortPicklistItems = (a, b) => {
  const designDifference = getDesignNumber(a.design) - getDesignNumber(b.design);
  if (designDifference !== 0) return designDifference;

  const colorDifference = normalizeColor(a.color).localeCompare(normalizeColor(b.color));
  if (colorDifference !== 0) return colorDifference;

  return getSizeIndex(a.size) - getSizeIndex(b.size);
};

const extractPdfText = async file => {
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  const pages = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();

    const items = content.items
      .map(item => ({
        text: normalizeText(item.str),
        x: Number(item.transform?.[4] || 0),
        y: Number(item.transform?.[5] || 0),
        width: Number(item.width || 0),
      }))
      .filter(item => item.text);

    pages.push({ pageNumber, items });
  }

  return pages;
};

const SIZE_PATTERN = /^(?:XS|S|M|L|XL|XXL|XXXL|3XL|4XL|5XL)$/i;
const COMPLETE_SKU_PATTERN = /#?D\d+-[A-Z0-9._]+-(?:XS|S|M|L|XL|XXL|XXXL|3XL|4XL|5XL)\b/i;
const PARTIAL_SKU_PATTERN = /#?D\d+-[A-Z0-9._]+-$/i;

// Myntra SKU Code is marketplace-generated and can use different prefixes
// across brands/catalogues (for example VNRD..., RRR...). Never hard-code
// a brand prefix here. The code is a long contiguous alphanumeric token.
const MYNTRA_SKU_PATTERN = /\b[A-Z0-9]{10,}\b/i;

const sanitizePdfText = value =>
  String(value ?? '')
    .replace(/[\uFFFE\uFFFF\uFFFD]/g, '-')
    .replace(/[–—−]/g, '-')
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const findCompleteSellerSku = value => {
  const match = sanitizePdfText(value).match(COMPLETE_SKU_PATTERN);
  return match ? cleanSku(match[0]) : '';
};

const groupItemsIntoRows = items => {
  const sorted = items.slice().sort((a, b) => {
    if (Math.abs(a.y - b.y) > 3) return b.y - a.y;
    return a.x - b.x;
  });

  const rows = [];
  for (const item of sorted) {
    let row = rows.find(candidate => Math.abs(candidate.y - item.y) <= 3);
    if (!row) {
      row = { y: item.y, items: [] };
      rows.push(row);
    }
    row.items.push(item);
  }

  return rows
    .map(row => ({
      ...row,
      items: row.items.sort((a, b) => a.x - b.x),
    }))
    .sort((a, b) => b.y - a.y);
};

const parsePicklistRows = pages => {
  const parsedRows = [];
  const unparsedLines = [];

  for (const page of pages) {
    const rows = groupItemsIntoRows(page.items);
    let pageFound = 0;

    // Locate product rows by the Myntra SKU column. This is much more stable
    // than assuming Seller SKU is always one PDF.js text item.
    for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
      const row = rows[rowIndex];
      const rowText = row.items.map(item => sanitizePdfText(item.text)).join(' ');
      const myntraSkuMatch = rowText.match(MYNTRA_SKU_PATTERN);
      if (!myntraSkuMatch) continue;

      const myntraSku = myntraSkuMatch[0];
      const currentY = row.y;

      // A Myntra product entry can span several visual lines. Its block ends
      // immediately before the next row containing another Myntra SKU.
      let nextProductY = -Infinity;
      for (let next = rowIndex + 1; next < rows.length; next += 1) {
        const nextText = rows[next].items.map(item => sanitizePdfText(item.text)).join(' ');
        if (MYNTRA_SKU_PATTERN.test(nextText)) {
          nextProductY = rows[next].y;
          break;
        }
      }

      const blockRows = rows.filter(candidate =>
        candidate.y <= currentY + 8 && candidate.y > nextProductY + 3
      );
      const blockItems = blockRows.flatMap(candidate => candidate.items);

      // Seller SKU column starts around x=174 in Myntra's picklist. We use a
      // generous range so minor layout changes do not break parsing.
      const sellerColumnItems = blockItems
        .filter(item => item.x >= 150 && item.x < 256)
        .sort((a, b) => {
          if (Math.abs(a.y - b.y) > 3) return b.y - a.y;
          return a.x - b.x;
        });

      let sellerSku = '';
      const sellerCombined = sellerColumnItems
        .map(item => sanitizePdfText(item.text))
        .join(' ');

      sellerSku = findCompleteSellerSku(sellerCombined);

      if (!sellerSku) {
        for (let i = 0; i < sellerColumnItems.length; i += 1) {
          const text = sanitizePdfText(sellerColumnItems[i].text);
          const complete = findCompleteSellerSku(text);
          if (complete) {
            sellerSku = complete;
            break;
          }

          const partial = text.match(PARTIAL_SKU_PATTERN)?.[0];
          if (!partial) continue;

          for (let j = i + 1; j < Math.min(i + 5, sellerColumnItems.length); j += 1) {
            const size = sanitizePdfText(sellerColumnItems[j].text);
            if (SIZE_PATTERN.test(size)) {
              sellerSku = cleanSku(`${partial}${size}`);
              break;
            }
          }
          if (sellerSku) break;
        }
      }

      // Fallback: search the entire product block. This handles exports where
      // Myntra SKU + Seller SKU are merged into a single PDF.js text item.
      if (!sellerSku) {
        sellerSku = findCompleteSellerSku(
          blockItems.map(item => sanitizePdfText(item.text)).join(' ')
        );
      }

      if (!sellerSku) continue;

      // Product description column.
      const description = normalizeText(
        blockItems
          .filter(item => item.x >= 250 && item.x < 410)
          .sort((a, b) => {
            if (Math.abs(a.y - b.y) > 3) return b.y - a.y;
            return a.x - b.x;
          })
          .map(item => sanitizePdfText(item.text))
          .filter(text => text && !/Product Description/i.test(text))
          .join(' ')
      );

      // Quantity column. Restricting by x avoids accidentally using digits
      // from SKU codes or the Total Quantity footer.
      const quantityCandidates = blockItems
        .filter(item => item.x >= 405 && item.x < 490)
        .map(item => sanitizePdfText(item.text))
        .filter(text => /^\d+$/.test(text))
        .map(Number)
        .filter(value => Number.isFinite(value) && value > 0);

      const quantity = quantityCandidates[0] || 1;

      parsedRows.push({
        sellerSku,
        myntraSku,
        quantity,
        productDescription: description,
        pageNumber: page.pageNumber,
      });
      pageFound += 1;
    }

    if (!pageFound) {
      unparsedLines.push({
        pageNumber: page.pageNumber,
        message: 'No Seller SKU code detected on this page.',
      });
    }
  }

  return { parsedRows, unparsedLines };
};

const buildGroupedPicklist = rows => {
  const grouped = new Map();

  for (const row of rows) {
    const sellerSku = cleanSku(row.sellerSku);

    if (!sellerSku) {
      continue;
    }

    const parsed = parseSellerSku(sellerSku);
    const key = sellerSku.toUpperCase();

    if (!grouped.has(key)) {
      grouped.set(key, {
        id: key,
        sellerSku,
        myntraSku: row.myntraSku || '',
        design: parsed.design,
        color: parsed.color,
        size: parsed.size,
        productDescription: row.productDescription || '',
        requiredQuantity: 0,
        sourcePages: new Set(),
      });
    }

    const item = grouped.get(key);

    item.requiredQuantity += Number(row.quantity || 1);
    item.sourcePages.add(row.pageNumber);
  }

  return Array.from(grouped.values())
    .map(item => ({
      ...item,
      sourcePages: Array.from(item.sourcePages),
    }))
    .sort(sortPicklistItems);
};

const Barcode = ({ value }) => {
  const svgRef = useRef(null);

  useEffect(() => {
    if (!svgRef.current || !value) {
      return;
    }

    try {
      JsBarcode(svgRef.current, value, {
        format: 'CODE128',
        lineColor: '#111827',
        width: 2,
        height: 64,
        displayValue: true,
        fontSize: 14,
        margin: 8,
        textMargin: 4,
      });
    } catch (error) {
      console.error('Barcode generation failed:', error);
    }
  }, [value]);

  return (
    <svg
      ref={svgRef}
      className="max-w-full"
      aria-label={`Barcode for ${value}`}
    />
  );
};

export default function MyntraPicklist() {
  const fileInputRef = useRef(null);

  const [fileName, setFileName] = useState('');
  const [items, setItems] = useState([]);
  const [unparsedLines, setUnparsedLines] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showOnlySorted, setShowOnlySorted] = useState(false);

  const filteredItems = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    if (!query) {
      return items;
    }

    return items.filter(item =>
      [
        item.sellerSku,
        item.design,
        item.color,
        item.size,
        item.productDescription,
      ]
        .filter(Boolean)
        .some(value => String(value).toLowerCase().includes(query))
    );
  }, [items, searchTerm]);

  const totalRequired = useMemo(
    () =>
      items.reduce(
        (sum, item) => sum + Number(item.requiredQuantity || 0),
        0
      ),
    [items]
  );

  const resetPicklist = () => {
    setFileName('');
    setItems([]);
    setUnparsedLines([]);
    setSearchTerm('');

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleFile = async event => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      toast.error('Please upload a PDF picklist.');
      return;
    }

    setIsProcessing(true);
    setFileName(file.name);
    setItems([]);
    setUnparsedLines([]);

    try {
      const pages = await extractPdfText(file);
      const { parsedRows, unparsedLines: warnings } =
        parsePicklistRows(pages);

      if (!parsedRows.length) {
        toast.error(
          'No Seller SKU codes were detected. This PDF may be image-based or have a different layout.'
        );
        setUnparsedLines(warnings);
        return;
      }

      const groupedItems = buildGroupedPicklist(parsedRows);

      setItems(groupedItems);
      setUnparsedLines(warnings);

      toast.success(
        `${groupedItems.length} unique Seller SKU(s) found.`
      );
    } catch (error) {
      console.error('Myntra picklist processing error:', error);
      toast.error(
        'Could not read this PDF. Please try the original Myntra picklist file.'
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const openPrintWindow = (title, bodyHtml, extraCss = '') => {
    const printWindow = window.open('', '_blank', 'width=1100,height=800');

    if (!printWindow) {
      toast.error('Please allow pop-ups to print this sheet.');
      return;
    }

    printWindow.document.open();
    printWindow.document.write(`
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>${title}</title>
          <style>
            @page {
              size: A4;
              margin: 10mm;
            }

            * {
              box-sizing: border-box;
            }

            html,
            body {
              margin: 0;
              padding: 0;
              background: #ffffff;
              color: #111827;
              font-family: Arial, Helvetica, sans-serif;
            }

            .sheet {
              width: 100%;
            }

            .sheet-title {
              margin: 0 0 4px;
              font-size: 20px;
              font-weight: 700;
            }

            .sheet-meta {
              margin: 0 0 14px;
              color: #4b5563;
              font-size: 12px;
            }

            ${extraCss}
          </style>
        </head>
        <body>
          <div class="sheet">
            ${bodyHtml}
          </div>

          <script>
            window.onload = function () {
              setTimeout(function () {
                window.focus();
                window.print();
              }, 250);
            };

            window.onafterprint = function () {
              window.close();
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const printSkuQuantitySheet = () => {
    if (!items.length) {
      toast.error('Upload a picklist first.');
      return;
    }

    // "items" is already grouped and sorted by Design -> Color -> Size.
    const rows = items
      .map(
        (item, index) => `
          <tr>
            <td class="serial">${index + 1}</td>
            <td class="sku">${item.sellerSku}</td>
            <td class="qty">${item.requiredQuantity}</td>
          </tr>
        `
      )
      .join('');

    openPrintWindow(
      'Myntra SKU Quantity Sheet',
      `
        <h1 class="sheet-title">Myntra SKU Quantity Sheet</h1>
        <p class="sheet-meta">
          ${fileName || 'Myntra Picklist'} &nbsp;|&nbsp;
          Unique SKUs: ${items.length} &nbsp;|&nbsp;
          Total Quantity: ${totalRequired}
        </p>

        <table class="sku-table">
          <thead>
            <tr>
              <th class="serial">#</th>
              <th>Seller SKU</th>
              <th class="qty">Quantity</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      `,
      `
        .sku-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 14px;
        }

        .sku-table th,
        .sku-table td {
          border: 1px solid #9ca3af;
          padding: 8px 10px;
          text-align: left;
        }

        .sku-table th {
          background: #f3f4f6;
          font-weight: 700;
        }

        .sku-table .serial {
          width: 50px;
          text-align: center;
        }

        .sku-table .sku {
          font-family: "Courier New", monospace;
          font-weight: 700;
        }

        .sku-table .qty {
          width: 100px;
          text-align: center;
          font-weight: 700;
        }

        .sku-table tr {
          break-inside: avoid;
          page-break-inside: avoid;
        }
      `
    );
  };

  const printBarcodeSheet = () => {
    if (!items.length) {
      toast.error('Upload a picklist first.');
      return;
    }

    /*
      Generate fresh SVG barcodes specifically for the print document.
      This does not depend on the dashboard DOM or Tailwind print styles,
      so only the barcode sheet is printed.
    */
    const barcodeCards = items
      .map((item, index) => {
        const svg = document.createElementNS(
          'http://www.w3.org/2000/svg',
          'svg'
        );

        try {
          JsBarcode(svg, item.sellerSku, {
            format: 'CODE128',
            lineColor: '#000000',
            width: 2,
            height: 70,
            displayValue: true,
            fontSize: 14,
            margin: 8,
            textMargin: 4,
          });
        } catch (error) {
          console.error(
            `Barcode generation failed for ${item.sellerSku}:`,
            error
          );
        }

        return `
          <div class="print-barcode-card">
            <div class="card-top">
              <div>
                <div class="number">SKU ${index + 1}</div>
                <div class="sku-text">${item.sellerSku}</div>
              </div>
              <div class="qty-badge">Qty: ${item.requiredQuantity}</div>
            </div>

            <div class="details">
              <span><strong>Design:</strong> ${item.design || '-'}</span>
              <span><strong>Color:</strong> ${item.color || '-'}</span>
              <span><strong>Size:</strong> ${item.size || '-'}</span>
            </div>

            <div class="barcode-wrap">
              ${svg.outerHTML}
            </div>
          </div>
        `;
      })
      .join('');

    openPrintWindow(
      'Myntra Seller SKU Barcodes',
      `
        <h1 class="sheet-title">Myntra Seller SKU Barcodes</h1>
        <p class="sheet-meta">
          ${fileName || 'Myntra Picklist'} &nbsp;|&nbsp;
          Unique SKUs: ${items.length} &nbsp;|&nbsp;
          Total Quantity: ${totalRequired}
        </p>

        <div class="barcode-grid">
          ${barcodeCards}
        </div>
      `,
      `
        .barcode-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
        }

        .print-barcode-card {
          border: 1px solid #9ca3af;
          border-radius: 8px;
          padding: 10px;
          break-inside: avoid;
          page-break-inside: avoid;
          overflow: hidden;
        }

        .card-top {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 10px;
          margin-bottom: 7px;
        }

        .number {
          color: #6b7280;
          font-size: 10px;
          margin-bottom: 2px;
        }

        .sku-text {
          font-family: "Courier New", monospace;
          font-size: 15px;
          font-weight: 700;
          word-break: break-all;
        }

        .qty-badge {
          flex: 0 0 auto;
          border: 1px solid #d1d5db;
          border-radius: 999px;
          padding: 3px 7px;
          font-size: 11px;
          font-weight: 700;
        }

        .details {
          display: flex;
          flex-wrap: wrap;
          gap: 4px 12px;
          border-bottom: 1px solid #e5e7eb;
          padding-bottom: 7px;
          margin-bottom: 6px;
          color: #374151;
          font-size: 10px;
        }

        .barcode-wrap {
          display: flex;
          justify-content: center;
          align-items: center;
          width: 100%;
          overflow: hidden;
        }

        .barcode-wrap svg {
          display: block;
          max-width: 100%;
          height: auto;
        }

        @media print {
          .barcode-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
      `
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <style>{`
        @media print {
          body {
            background: white !important;
          }

          .no-print {
            display: none !important;
          }

          .print-area {
            display: block !important;
          }

          .barcode-card {
            break-inside: avoid;
            page-break-inside: avoid;
            border: 1px solid #d1d5db !important;
            box-shadow: none !important;
          }
        }
      `}</style>

      <div className="max-w-7xl mx-auto">
        <div className="no-print flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
              Myntra Picklist
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Upload a Myntra picklist PDF and generate Seller SKU barcodes.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              <FiUpload />
              Upload Picklist PDF
            </button>

            <button
              type="button"
              onClick={printSkuQuantitySheet}
              disabled={!items.length}
              className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 bg-white text-gray-700 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <FiPrinter />
              Print SKU + Qty
            </button>

            <button
              type="button"
              onClick={printBarcodeSheet}
              disabled={!items.length}
              className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <FiPrinter />
              Print Barcodes
            </button>

            <button
              type="button"
              onClick={resetPicklist}
              disabled={!items.length && !fileName}
              className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <FiRefreshCw />
              Clear
            </button>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf,.pdf"
            onChange={handleFile}
            className="hidden"
          />
        </div>

        <div className="no-print grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-xs text-gray-500">Unique SKUs</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">
              {items.length}
            </p>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-xs text-gray-500">Total Quantity</p>
            <p className="text-2xl font-bold text-indigo-600 mt-1">
              {totalRequired}
            </p>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-xs text-gray-500">Pages With Warnings</p>
            <p className="text-2xl font-bold text-orange-600 mt-1">
              {unparsedLines.length}
            </p>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-xs text-gray-500">Source File</p>
            <p className="text-sm font-semibold text-gray-800 mt-2 truncate">
              {fileName || 'No file uploaded'}
            </p>
          </div>
        </div>

        {isProcessing && (
          <div className="no-print bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-xl p-4 mb-6 flex items-center gap-3">
            <div className="w-5 h-5 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
            Reading picklist PDF and generating SKU list...
          </div>
        )}

        {!isProcessing && !items.length && (
          <div className="no-print bg-white border-2 border-dashed border-gray-300 rounded-2xl p-12 text-center">
            <FiFileText className="mx-auto text-5xl text-gray-300 mb-4" />
            <h2 className="text-lg font-semibold text-gray-800">
              Upload Myntra Picklist PDF
            </h2>
            <p className="text-sm text-gray-500 mt-2">
              The system will group Seller SKU codes and generate printable barcodes.
            </p>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="mt-5 inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
            >
              <FiUpload />
              Choose PDF
            </button>
          </div>
        )}

        {unparsedLines.length > 0 && (
          <div className="no-print bg-orange-50 border border-orange-200 rounded-xl p-4 mb-6">
            <div className="flex items-start gap-3">
              <FiX className="text-orange-600 mt-0.5" />
              <div>
                <p className="font-semibold text-orange-800">
                  Some pages had no detectable Seller SKU
                </p>

                <div className="mt-2 space-y-1 text-sm text-orange-700">
                  {unparsedLines.map((warning, index) => (
                    <p key={`${warning.pageNumber}-${index}`}>
                      Page {warning.pageNumber}: {warning.message}
                    </p>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {items.length > 0 && (
          <div className="print-area">
            <div className="no-print bg-white border border-gray-200 rounded-xl p-4 mb-5 flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
              <div className="relative flex-1 max-w-xl">
                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />

                <input
                  value={searchTerm}
                  onChange={event => setSearchTerm(event.target.value)}
                  placeholder="Search Seller SKU, design, color..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>

              <label className="inline-flex items-center gap-2 text-sm text-gray-600">
                <input
                  type="checkbox"
                  checked={showOnlySorted}
                  onChange={event => setShowOnlySorted(event.target.checked)}
                  className="w-4 h-4 rounded border-gray-300"
                />
                Show sorted SKU order
              </label>

              <p className="text-sm text-gray-500">
                Scan the printed barcode in the Myntra tab.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredItems.map((item, index) => (
                <div
                  key={item.id}
                  className="barcode-card bg-white border border-gray-200 rounded-xl p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <p className="text-xs text-gray-400">
                        SKU {index + 1}
                      </p>

                      <h2 className="text-lg font-bold text-indigo-700 font-mono break-all">
                        {item.sellerSku}
                      </h2>
                    </div>

                    <span className="shrink-0 px-2 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-bold">
                      Qty: {item.requiredQuantity}
                    </span>
                  </div>

                  <div className="space-y-1 text-sm text-gray-600 mb-3">
                    <p>
                      <span className="font-semibold text-gray-700">
                        Design:
                      </span>{' '}
                      {item.design || '-'}
                    </p>

                    <p>
                      <span className="font-semibold text-gray-700">
                        Color:
                      </span>{' '}
                      {item.color || '-'}
                    </p>

                    <p>
                      <span className="font-semibold text-gray-700">
                        Size:
                      </span>{' '}
                      {item.size || '-'}
                    </p>

                    {item.productDescription && (
                      <p className="text-xs text-gray-500 line-clamp-2">
                        {item.productDescription}
                      </p>
                    )}
                  </div>

                  <div className="border-t border-gray-100 pt-3 flex justify-center overflow-hidden">
                    <Barcode value={item.sellerSku} />
                  </div>
                </div>
              ))}
            </div>

            {!filteredItems.length && (
              <div className="no-print text-center py-12 text-gray-500">
                No SKU matches your search.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}