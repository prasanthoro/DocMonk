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
 * Exports plain text to a .docx file (Browser only)
 */
export const exportToDocx = async (text: string, filename: string) => {
    // Dynamic import to avoid SSR errors
    const { Document, Packer, Paragraph, TextRun } = await import("docx");

    const doc = new Document({
        sections: [{
            properties: {},
            children: text.split('\n').map(line =>
                new Paragraph({
                    children: [new TextRun(line)],
                })
            ),
        }],
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
 * Exports plain text to a .pdf file with multi-page support (Browser only)
 */
export const exportToPdf = async (text: string, filename: string) => {
    // Dynamic import to avoid SSR errors
    const { jsPDF } = await import("jspdf");

    const doc = new jsPDF();
    const pageHeight = doc.internal.pageSize.height;
    const margin = 15;
    const fontSize = 10;
    doc.setFontSize(fontSize);

    const splitText = doc.splitTextToSize(text, 180);
    let cursorY = margin;

    splitText.forEach((line: string) => {
        if (cursorY + fontSize > pageHeight - margin) {
            doc.addPage();
            cursorY = margin;
        }

        doc.text(line, margin, cursorY);
        cursorY += fontSize * 0.5;
    });

    doc.save(`${filename}-updated.pdf`);
};
