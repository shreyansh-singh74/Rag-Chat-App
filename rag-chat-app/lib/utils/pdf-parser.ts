// Use pdf2json - a Node.js-friendly PDF parser without worker requirements
const PDFParser = require('pdf2json');

/**
 * Parse PDF file and extract text content
 * @param buffer PDF file buffer
 * @returns Extracted text content
 */
export async function parsePDF(buffer: Buffer): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      const pdfParser = new PDFParser(null, 1);

      // Handle successful parsing
      pdfParser.on('pdfParser_dataError', (errData: any) => {
        console.error('PDF parsing error:', errData);
        reject(new Error(`Failed to parse PDF file: ${errData.parserError}`));
      });

      pdfParser.on('pdfParser_dataReady', (pdfData: any) => {
        try {
          // Extract text from all pages
          const textParts: string[] = [];

          if (pdfData.Pages && pdfData.Pages.length > 0) {
            pdfData.Pages.forEach((page: any) => {
              if (page.Texts && page.Texts.length > 0) {
                const pageText = page.Texts.map((textItem: any) => {
                  // Decode URI component and join R array (text runs)
                  if (textItem.R && textItem.R.length > 0) {
                    return textItem.R.map((r: any) => {
                      // Decode URI component for special characters
                      try {
                        return decodeURIComponent(r.T || '');
                      } catch {
                        return r.T || '';
                      }
                    }).join('');
                  }
                  return '';
                }).join(' ');
                textParts.push(pageText);
              }
            });
          }

          const fullText = textParts.join('\n\n').trim();

          if (!fullText || fullText.length === 0) {
            reject(new Error('No text content extracted from PDF'));
            return;
          }

          resolve(fullText);
        } catch (error) {
          console.error('Error extracting text from PDF data:', error);
          reject(new Error('Failed to extract text from PDF'));
        }
      });

      // Load PDF from buffer
      pdfParser.parseBuffer(buffer);
    } catch (error) {
      console.error('Error initializing PDF parser:', error);
      if (error instanceof Error) {
        reject(new Error(`Failed to parse PDF file: ${error.message}`));
      } else {
        reject(new Error('Failed to parse PDF file'));
      }
    }
  });
}

/**
 * Parse text file (plain text)
 * @param buffer Text file buffer
 * @returns Extracted text content
 */
export async function parseText(buffer: Buffer): Promise<string> {
  try {
    return buffer.toString('utf-8');
  } catch (error) {
    console.error('Error parsing text file:', error);
    throw new Error('Failed to parse text file');
  }
}

/**
 * Parse file based on MIME type
 * @param buffer File buffer
 * @param mimeType File MIME type
 * @returns Extracted text content
 */
export async function parseFile(
  buffer: Buffer,
  mimeType: string
): Promise<string> {
  switch (mimeType) {
    case 'application/pdf':
      return parsePDF(buffer);
    case 'text/plain':
    case 'text/markdown':
    case 'text/html':
      return parseText(buffer);
    default:
      throw new Error(`Unsupported file type: ${mimeType}`);
  }
}

