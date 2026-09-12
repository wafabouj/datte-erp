import PDFDocument from "pdfkit";

export function renderPdf(build: (doc: PDFKit.PDFDocument) => void): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 50 });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    build(doc);
    doc.end();
  });
}

export const COMPANY = {
  name: "Domaine des Dattes Export SARL",
  address: "Zone Industrielle, Kebili, Tunisie",
  email: "contact@dattes-export.tn",
  phone: "+216 XX XXX XXX",
  taxId: "MF 000000000",
};

export function drawHeader(doc: PDFKit.PDFDocument, title: string) {
  doc.fontSize(18).font("Helvetica-Bold").text(COMPANY.name);
  doc
    .fontSize(9)
    .font("Helvetica")
    .text(COMPANY.address)
    .text(`${COMPANY.email} — ${COMPANY.phone}`)
    .text(`Matricule fiscal: ${COMPANY.taxId}`);
  doc.moveDown(1);
  doc.fontSize(16).font("Helvetica-Bold").text(title, { align: "right" });
  doc.moveDown(1);
  doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
  doc.moveDown(0.5);
}

interface TableColumn {
  header: string;
  width: number;
  align?: "left" | "right" | "center";
}

export function drawTable(
  doc: PDFKit.PDFDocument,
  columns: TableColumn[],
  rows: (string | number)[][]
) {
  const startX = 50;
  let y = doc.y;
  doc.font("Helvetica-Bold").fontSize(9);
  let x = startX;
  for (const col of columns) {
    doc.text(col.header, x, y, { width: col.width, align: col.align ?? "left" });
    x += col.width;
  }
  y += 16;
  doc.moveTo(startX, y).lineTo(545, y).stroke();
  y += 4;
  doc.font("Helvetica").fontSize(9);

  for (const row of rows) {
    x = startX;
    const rowHeight = 16;
    for (let i = 0; i < columns.length; i++) {
      doc.text(String(row[i]), x, y, { width: columns[i].width, align: columns[i].align ?? "left" });
      x += columns[i].width;
    }
    y += rowHeight;
    if (y > 720) {
      doc.addPage();
      y = 50;
    }
  }
  doc.y = y + 8;
}
