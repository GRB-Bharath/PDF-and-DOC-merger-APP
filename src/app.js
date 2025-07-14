const express = require('express');
const fs = require('fs');
const path = require('path');
const { PDFDocument } = require('pdf-lib');
const { Document, Packer, Paragraph } = require('docx');

const router = express.Router();

// Route to handle file upload and merge
router.post('/merge', async (req, res) => {
    try {
        const pdfFiles = req.files?.pdfFiles;
        const wordFiles = req.files?.wordFiles;

        // Merge PDF Files
        if (pdfFiles) {
            const pdfArray = Array.isArray(pdfFiles) ? pdfFiles : [pdfFiles];
            const mergedPdf = await PDFDocument.create();

            for (const file of pdfArray) {
                const pdfDoc = await PDFDocument.load(file.data);
                const copiedPages = await mergedPdf.copyPages(pdfDoc, pdfDoc.getPageIndices());
                copiedPages.forEach((page) => mergedPdf.addPage(page));
            }

            const pdfBuffer = await mergedPdf.save();
            const outputPath = path.join(__dirname, '../public/merged.pdf');
            fs.writeFileSync(outputPath, pdfBuffer);
        }

        // Merge Word Files
        if (wordFiles) {
            const wordArray = Array.isArray(wordFiles) ? wordFiles : [wordFiles];
            const doc = new Document();

            for (const file of wordArray) {
                const text = file.data.toString('utf-8'); // crude conversion
                doc.addSection({
                    children: [new Paragraph(text)],
                });
            }

            const wordBuffer = await Packer.toBuffer(doc);
            const outputPath = path.join(__dirname, '../public/merged.docx');
            fs.writeFileSync(outputPath, wordBuffer);
        }

        res.status(200).json({ message: 'Files merged successfully.', files: {
            pdf: !!pdfFiles,
            word: !!wordFiles
        }});
    } catch (error) {
        console.error('Merge error:', error);
        res.status(500).json({ error: 'Failed to merge files.' });
    }
});

module.exports = router;
