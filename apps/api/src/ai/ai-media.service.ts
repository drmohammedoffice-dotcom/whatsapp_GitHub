import { Injectable } from '@nestjs/common';
import { createWorker } from 'tesseract.js';
import { UploadedMediaFile } from '../common/uploaded-media-file';
import { AiProviderService } from './ai-provider.service';

@Injectable()
export class AiMediaService {
  constructor(private readonly provider: AiProviderService) {}

  speech(teamId: string, text: string) {
    return this.provider.speech(teamId, text);
  }

  transcribe(teamId: string, file: UploadedMediaFile) {
    return this.provider.transcribe(teamId, file);
  }

  async ocr(file: UploadedMediaFile) {
    const worker = await createWorker('eng');
    try {
      const result = await worker.recognize(file.buffer);
      return { text: result.data.text, confidence: result.data.confidence };
    } finally {
      await worker.terminate();
    }
  }
}
