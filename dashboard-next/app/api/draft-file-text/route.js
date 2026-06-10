import mammoth from 'mammoth';
import { htmlToText } from 'html-to-text';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_FILE_SIZE_BYTES = 12 * 1024 * 1024;

function getExtension(filename = '') {
  return String(filename || '').split('.').pop()?.toLowerCase() || '';
}

function normalizeExtractedText(value = '') {
  return String(value || '')
    .replace(/\r\n/g, '\n')
    .replace(/\u0000/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{4,}/g, '\n\n\n')
    .trim();
}

async function extractPdfText(buffer) {
  // Keep pdfjs out of Next's route bundler and disable workers for Node API runtime.
  const importPdfJs = new Function('specifier', 'return import(specifier)');
  const pdfjsLib = await importPdfJs('pdfjs-dist/legacy/build/pdf.mjs');
  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(buffer),
    disableWorker: true,
    useSystemFonts: true
  });
  const pdf = await loadingTask.promise;
  const pages = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item) => item?.str || '')
      .filter(Boolean)
      .join(' ');

    if (pageText.trim()) {
      pages.push(pageText);
    }
  }

  await pdf.destroy?.();
  return pages.join('\n\n');
}

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file || typeof file.arrayBuffer !== 'function') {
      return Response.json({ error: 'No file was uploaded.' }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return Response.json({ error: 'File is too large. Please upload a file under 12 MB.' }, { status: 413 });
    }

    const filename = file.name || 'uploaded-file';
    const extension = getExtension(filename);
    const buffer = Buffer.from(await file.arrayBuffer());
    let text = '';

    if (['txt', 'md', 'csv'].includes(extension) || String(file.type || '').startsWith('text/')) {
      text = buffer.toString('utf8');
    } else if (['html', 'htm'].includes(extension)) {
      text = htmlToText(buffer.toString('utf8'), {
        wordwrap: false,
        selectors: [
          { selector: 'a', options: { ignoreHref: true } },
          { selector: 'img', format: 'skip' }
        ]
      });
    } else if (extension === 'docx') {
      const result = await mammoth.extractRawText({ buffer });
      text = result.value || '';
    } else if (extension === 'pdf') {
      text = await extractPdfText(buffer);
    } else if (extension === 'doc') {
      return Response.json(
        { error: 'Old .doc files are not supported for clean browser preview. Please save the document as .docx and upload again.' },
        { status: 415 }
      );
    } else {
      return Response.json(
        { error: 'Unsupported file type. Please upload DOCX, PDF, TXT, HTML, MD, or CSV.' },
        { status: 415 }
      );
    }

    const cleanedText = normalizeExtractedText(text);

    if (!cleanedText) {
      return Response.json({ error: 'No readable text was found in this file.' }, { status: 422 });
    }

    return Response.json({ text: cleanedText, filename });
  } catch (error) {
    console.error('[draft-file-text] extraction failed', error);
    return Response.json(
      { error: error?.message || 'Could not extract readable text from this file.' },
      { status: 500 }
    );
  }
}
