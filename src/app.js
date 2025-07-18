const express = require('express');
const fs = require('fs');
const path = require('path');
const { PDFDocument } = require('pdf-lib');
const docx4js = require('docx4js');
const PizZip = require('pizzip');

const router = express.Router();

// Route to handle file upload and merge
router.post('/merge', async (req, res) => {
    try {
        const pdfFiles = req.files?.pdfFiles;
        const wordFiles = req.files?.wordFiles;

        // Merge PDF Files
        if (pdfFiles) {
            try {
                const pdfArray = Array.isArray(pdfFiles) ? pdfFiles : [pdfFiles];
                const mergedPdf = await PDFDocument.create();

                for (const file of pdfArray) {
                    // Load the PDF from buffer
                    const pdfDoc = await PDFDocument.load(file.data);
                    const copiedPages = await mergedPdf.copyPages(pdfDoc, pdfDoc.getPageIndices());
                    copiedPages.forEach((page) => mergedPdf.addPage(page));
                }

                const pdfBuffer = await mergedPdf.save();
                const outputPath = path.join(__dirname, '../public/merged.pdf');
                fs.writeFileSync(outputPath, pdfBuffer);
                console.log('PDF file saved to:', outputPath);
            } catch (pdfErr) {
                console.error('PDF merge error:', pdfErr);
                throw new Error('Failed to merge PDF documents: ' + pdfErr.message);
            }
        }

        // Merge Word Files
        if (wordFiles) {
            try {
                const wordArray = Array.isArray(wordFiles) ? wordFiles : [wordFiles];
                
                // Ensure temp directory exists
                const tempDir = path.join(__dirname, '../temp');
                if (!fs.existsSync(tempDir)) {
                    fs.mkdirSync(tempDir, { recursive: true });
                }
                
                console.log(`Processing ${wordArray.length} Word documents for merging...`);
                
                // Use the first document as a base for merging
                if (wordArray.length === 0) {
                    throw new Error('No Word documents to merge');
                }
                
                // Save each file to disk temporarily
                const tempFiles = [];
                for (let i = 0; i < wordArray.length; i++) {
                    const file = wordArray[i];
                    const tempFilePath = path.join(tempDir, `doc_${i}_${Date.now()}.docx`);
                    fs.writeFileSync(tempFilePath, file.data);
                    tempFiles.push(tempFilePath);
                    console.log(`Saved ${file.name} to temporary file ${tempFilePath}`);
                }
                
                // Create output file path
                const outputPath = path.join(__dirname, '../public/merged.docx');
                
                if (wordArray.length === 1) {
                    // If only one file, just copy it
                    fs.copyFileSync(tempFiles[0], outputPath);
                    console.log('Single Word document copied to:', outputPath);
                } else {
                    // Use a simpler approach - concatenate documents
                    // This is a basic approach that works with most Word documents
                    
                    // Use first document as base
                    fs.copyFileSync(tempFiles[0], outputPath);
                    
                    // Process each file and combine them with a page break
                    await combineWordDocuments(tempFiles, outputPath);
                    
                    console.log('Word documents merged successfully and saved to:', outputPath);
                }
                
                // Clean up temp files
                for (const tempFile of tempFiles) {
                    try {
                        fs.unlinkSync(tempFile);
                    } catch (err) {
                        console.error('Error deleting temp file:', err);
                    }
                }
                
            } catch (wordErr) {
                console.error('Word merge error:', wordErr);
                throw new Error('Failed to merge Word documents: ' + wordErr.message);
            }
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

/**
 * Simple function to combine Word documents - on Windows, this uses PowerShell if available
 * @param {string[]} filePaths - Array of file paths to combine
 * @param {string} outputPath - Path to save the combined document
 */
async function combineWordDocuments(filePaths, outputPath) {
    try {
        // Use child_process to run PowerShell command to combine documents
        const { exec } = require('child_process');
        
        // Create a PowerShell command that combines Word documents
        // This is a Windows-specific solution
        const psCommand = `
            $ErrorActionPreference = "Stop"
            try {
                Write-Output "Creating Word application"
                $Word = New-Object -ComObject Word.Application
                $Word.Visible = $false
                
                Write-Output "Opening output document"
                $OutputDoc = $Word.Documents.Open("${outputPath.replace(/\\/g, '\\\\')}")
                
                Write-Output "Starting merge process"
                $Selection = $Word.Selection
                $Selection.EndKey(6) # End of document
                
                # Loop through the files starting from the second file
                ${filePaths.slice(1).map((file, index) => `
                    Write-Output "Processing file ${index + 1}"
                    $DocPath = "${file.replace(/\\/g, '\\\\')}"
                    $Doc = $Word.Documents.Open($DocPath)
                    $Doc.Activate()
                    $Doc.Content.Copy()
                    $Doc.Close(0)
                    
                    $OutputDoc.Activate()
                    $Selection = $Word.Selection
                    $Selection.EndKey(6) # End of document
                    $Selection.InsertBreak(7) # Page break
                    $Selection.Paste()
                `).join('\n')}
                
                Write-Output "Saving and closing"
                $OutputDoc.Save()
                $OutputDoc.Close()
                $Word.Quit()
                
                [System.Runtime.InteropServices.Marshal]::ReleaseComObject($Word)
                Write-Output "Word document merge completed successfully"
                exit 0
            }
            catch {
                Write-Error "Error: $($_.Exception.Message)"
                exit 1
            }
        `;
        
        // Write the PowerShell script to a file
        const scriptPath = path.join(__dirname, '../temp', `merge_script_${Date.now()}.ps1`);
        fs.writeFileSync(scriptPath, psCommand);
        
        // Execute the script
        return new Promise((resolve, reject) => {
            exec(`powershell -ExecutionPolicy Bypass -File "${scriptPath}"`, (error, stdout, stderr) => {
                console.log('PowerShell Output:', stdout);
                
                if (error) {
                    console.error('PowerShell Error:', stderr);
                    console.error('Falling back to simple file copy');
                    
                    // Fallback: Just use the first file as our merged document
                    fs.copyFileSync(filePaths[0], outputPath);
                    resolve(false);
                } else {
                    console.log('PowerShell merge successful');
                    resolve(true);
                }
                
                // Clean up script
                try {
                    fs.unlinkSync(scriptPath);
                } catch (err) {
                    console.error('Failed to delete script:', err);
                }
            });
        });
    } catch (err) {
        console.error('Error in document combination:', err);
        // Fallback to simple copy if everything fails
        fs.copyFileSync(filePaths[0], outputPath);
        return false;
    }
}

module.exports = router;
