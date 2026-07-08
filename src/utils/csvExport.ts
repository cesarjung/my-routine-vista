/**
 * Robust utility to download CSV files with proper Excel compatibility (semicolon separator and UTF-8 BOM).
 */
export const downloadCSV = (filename: string, headers: string[], rows: (string | number)[][]) => {
  const separator = ';';
  
  const formatCell = (val: any) => {
    if (val === null || val === undefined) return '';
    const str = String(val);
    // If it contains semicolon, newline, or double quotes, escape and wrap in quotes
    if (str.includes(separator) || str.includes('\n') || str.includes('"')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const csvRows = [
    headers.join(separator),
    ...rows.map(row => row.map(formatCell).join(separator))
  ];

  const csvContent = '\uFEFF' + csvRows.join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
