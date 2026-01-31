import { useState } from 'react';
import { FiDownload, FiFileText, FiTable } from 'react-icons/fi';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

const ExportButton = ({ data, filename, title }) => {
  const [showDropdown, setShowDropdown] = useState(false);

  const exportToCSV = () => {
    if (!data || data.length === 0) return;

    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(','),
      ...data.map(row => headers.map(header => {
        const value = row[header];
        return typeof value === 'string' && value.includes(',') 
          ? `"${value}"` 
          : value;
      }).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    setShowDropdown(false);
  };

  const exportToExcel = () => {
    if (!data || data.length === 0) return;

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Data');
    XLSX.writeFile(workbook, `${filename}_${new Date().toISOString().split('T')[0]}.xlsx`);
    setShowDropdown(false);
  };

  const exportToPDF = () => {
    if (!data || data.length === 0) return;

    const doc = new jsPDF();
    
    // Title
    doc.setFontSize(18);
    doc.text(title || filename, 14, 20);
    
    // Date
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 28);
    
    // Table
    const headers = Object.keys(data[0]);
    const rows = data.map(row => headers.map(header => row[header]));
    
    doc.autoTable({
      head: [headers],
      body: rows,
      startY: 35,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [99, 102, 241] }
    });
    
    doc.save(`${filename}_${new Date().toISOString().split('T')[0]}.pdf`);
    setShowDropdown(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
      >
        <FiDownload className="text-gray-500" />
        <span className="font-medium text-gray-700">Export</span>
      </button>

      {showDropdown && (
        <div className="absolute top-full right-0 mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-50 animate-fadeIn">
          <button
            onClick={exportToCSV}
            className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors first:rounded-t-lg"
          >
            <FiFileText className="text-green-500" />
            <span className="text-gray-700">Export as CSV</span>
          </button>
          <button
            onClick={exportToExcel}
            className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors"
          >
            <FiTable className="text-blue-500" />
            <span className="text-gray-700">Export as Excel</span>
          </button>
          <button
            onClick={exportToPDF}
            className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors last:rounded-b-lg"
          >
            <FiFileText className="text-red-500" />
            <span className="text-gray-700">Export as PDF</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default ExportButton;
