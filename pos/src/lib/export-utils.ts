import * as XLSX from 'xlsx';
// @ts-ignore
import html2pdf from 'html2pdf.js';

export const exportToExcel = (data: any[], fileName: string) => {
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
  XLSX.writeFile(workbook, `${fileName}.xlsx`);
};

export const exportToPDF = (data: any[], fileName: string, title: string) => {
  const element = document.createElement('div');
  element.dir = 'rtl';
  element.style.padding = '20px';
  element.style.fontFamily = 'Inter, sans-serif';
  
  const h1 = document.createElement('h1');
  h1.innerText = title;
  h1.style.textAlign = 'center';
  h1.style.marginBottom = '20px';
  element.appendChild(h1);

  const table = document.createElement('table');
  table.style.width = '100%';
  table.style.borderCollapse = 'collapse';
  table.style.fontSize = '12px';

  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');
  const headers = Object.keys(data[0] || {});
  headers.forEach(header => {
    const th = document.createElement('th');
    th.innerText = header;
    th.style.border = '1px solid #ddd';
    th.style.padding = '8px';
    th.style.backgroundColor = '#f2f2f2';
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  data.forEach(row => {
    const tr = document.createElement('tr');
    headers.forEach(header => {
      const td = document.createElement('td');
      td.innerText = row[header];
      td.style.border = '1px solid #ddd';
      td.style.padding = '8px';
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  element.appendChild(table);

  const opt = {
    margin: 1,
    filename: `${fileName}.pdf`,
    image: { type: 'jpeg' as const, quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true },
    jsPDF: { unit: 'in' as const, format: 'letter' as const, orientation: 'portrait' as const }
  };

  html2pdf().from(element).set(opt).save();
};
