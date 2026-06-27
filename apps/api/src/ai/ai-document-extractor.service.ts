import { Injectable, BadRequestException } from '@nestjs/common';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { createHash } from 'crypto';
import mammoth from 'mammoth';
import pdfParseModule from 'pdf-parse';
import * as XLSX from 'xlsx';
import { UploadedMediaFile } from '../common/uploaded-media-file';

@Injectable()
export class AiDocumentExtractorService {
  async fromUpload(file: UploadedMediaFile) {
    const mime = file.mimetype;
    const checksum = createHash('sha256').update(file.buffer).digest('hex');
    return { title: file.originalname, mimeType: mime, checksum, content: await this.extract(file.buffer, mime, file.originalname) };
  }

  async fromWebsite(url: string) {
    const response = await axios.get<string>(url, { timeout: 20_000, responseType: 'text' });
    const $ = cheerio.load(response.data);
    $('script,style,nav,footer,header').remove();
    const title = $('title').text().trim() || url;
    const content = $('body').text().replace(/\s+/g, ' ').trim();
    if (!content) throw new BadRequestException('No readable website content found');
    return { title, mimeType: 'text/html', checksum: createHash('sha256').update(content).digest('hex'), content };
  }

  private async extract(buffer: Buffer, mimeType: string, fileName: string) {
    if (mimeType === 'application/pdf' || fileName.endsWith('.pdf')) {
      const parsePdf = pdfParseModule as unknown as (input: Buffer) => Promise<{ text: string }>;
      return (await parsePdf(buffer)).text;
    }
    if (mimeType.includes('word') || fileName.endsWith('.docx')) return (await mammoth.extractRawText({ buffer })).value;
    if (mimeType.includes('spreadsheet') || fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
      const workbook = XLSX.read(buffer);
      return workbook.SheetNames.map((name) => XLSX.utils.sheet_to_csv(workbook.Sheets[name])).join('\n');
    }
    if (mimeType.startsWith('text/') || fileName.endsWith('.txt') || fileName.endsWith('.md') || fileName.endsWith('.csv')) return buffer.toString('utf8');
    throw new BadRequestException(`Unsupported document type: ${mimeType}`);
  }
}
