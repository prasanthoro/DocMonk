// All-uppercase document title: "COMMERCIAL RENTAL AGREEMENT"
// No lowercase letters, no colon (to avoid matching section labels)
const TITLE_RE = /^[A-Z][A-Z\s\d&,()/-]{4,}$/

// Pure section header with nothing after the colon: "2. Monthly Rent:"
const PURE_HEADER_RE = /^\d+\.\s+[^:]+:\s*$/

// Inline header — captures header and content separately:
//   "1. Lease Term: The lease shall…"  →  Group1="1. Lease Term:"  Group2="The lease shall…"
const INLINE_HEADER_RE = /^(\d+\.\s+[^:]+:)\s+(.+)$/

/**
 * Exports plain text to a .txt file
 */
export const exportToTxt = (text: string, filename: string) => {
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};

/**
 * Exports plain text to a .docx file (Browser only).
 *
 * Line types:
 *   - ALL-CAPS title  "COMMERCIAL RENTAL AGREEMENT"   → bold 14pt, centered
 *   - Pure header     "3. Security Deposit:"           → bold 11pt, left
 *   - Inline header   "1. Lease Term: The lease …"    → "1. Lease Term:" bold 11pt + content 10pt, left
 *   - Content         "The Tenant agrees to pay …"    → normal 10pt, left
 */
export const exportToDocx = async (text: string, filename: string) => {
    const { Document, Packer, Paragraph, TextRun, AlignmentType } = await import("docx");

    const paragraphs = text.split('\n').map(line => {
        const trimmed = line.trim()
        const isTitle = TITLE_RE.test(trimmed)
        const isPureHeader = PURE_HEADER_RE.test(trimmed)
        const inlineMatch = trimmed.match(INLINE_HEADER_RE)

        if (isTitle) {
            return new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new TextRun({ text: line, bold: true, size: 28 })], // 14pt
                spacing: { before: 80, after: 200 },
            })
        }

        if (isPureHeader) {
            return new Paragraph({
                children: [new TextRun({ text: line, bold: true, size: 22 })], // 11pt
                spacing: { before: 160, after: 40 },
            })
        }

        if (inlineMatch) {
            // Bold "N. Title:" part, normal content part — on the same paragraph line
            return new Paragraph({
                children: [
                    new TextRun({ text: inlineMatch[1], bold: true, size: 22 }),
                    new TextRun({ text: ' ' + inlineMatch[2], bold: false, size: 20 }),
                ],
                spacing: { before: 160, after: 40 },
            })
        }

        // Plain content or empty line
        return new Paragraph({
            children: [new TextRun({ text: line, bold: false, size: 20 })],
            spacing: { before: 0, after: 40 },
        })
    });

    const doc = new Document({
        sections: [{ properties: {}, children: paragraphs }],
    });

    const blob = await Packer.toBlob(doc);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.docx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};

/**
 * Exports plain text to a .pdf file with multi-page support (Browser only).
 *
 * Line types:
 *   - ALL-CAPS title  → bold, centered, extra gap after
 *   - Pure header     → bold, left-aligned, extra gap before
 *   - Inline header   → "N. Title:" bold + content normal on same line, extra gap before
 *   - Empty line      → half-step cursor advance, nothing drawn
 *   - Content         → normal, left-aligned
 */
export const exportToPdf = async (text: string, filename: string) => {
    const { jsPDF } = await import("jspdf");

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    const margin = 15;
    const fontSize = 10;
    const lineHeight = fontSize * 0.5;
    doc.setFontSize(fontSize);

    const splitText = doc.splitTextToSize(text, 180);
    let cursorY = margin;

    splitText.forEach((line: string) => {
        // Empty lines — small cursor advance, nothing drawn
        if (!line.trim()) {
            cursorY += lineHeight * 0.5;
            return;
        }

        const trimmed = line.trim()
        const isTitle = TITLE_RE.test(trimmed)
        const isPureHeader = PURE_HEADER_RE.test(trimmed)
        const inlineMatch = trimmed.match(INLINE_HEADER_RE)
        const isSectionHeader = isPureHeader || !!inlineMatch

        // Extra gap before section headers and titles
        if (isTitle || isSectionHeader) cursorY += lineHeight * 0.4;

        // Page break check
        if (cursorY + fontSize > pageHeight - margin) {
            doc.addPage();
            cursorY = margin;
        }

        if (isTitle) {
            // Bold + centered
            doc.setFont('helvetica', 'bold');
            doc.text(line, pageWidth / 2, cursorY, { align: 'center' });
            cursorY += lineHeight * 0.6; // extra gap after title
        } else if (isPureHeader) {
            // "2. Monthly Rent:" — whole line bold
            doc.setFont('helvetica', 'bold');
            doc.text(line, margin, cursorY);
        } else if (inlineMatch) {
            // "1. Lease Term: The lease shall…" — bold header part + normal content on same line
            const headerPart = inlineMatch[1] + ' ';
            const contentPart = inlineMatch[2];
            doc.setFont('helvetica', 'bold');
            const headerWidth = doc.getTextWidth(headerPart);
            doc.text(headerPart, margin, cursorY);
            doc.setFont('helvetica', 'normal');
            doc.text(contentPart, margin + headerWidth, cursorY);
        } else {
            // Plain content
            doc.setFont('helvetica', 'normal');
            doc.text(line, margin, cursorY);
        }

        cursorY += lineHeight;
    });

    doc.save(`${filename}.pdf`);
};
