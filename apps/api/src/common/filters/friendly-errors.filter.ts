import { ArgumentsHost, Catch, HttpStatus, Logger } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { Prisma } from '@watsapp/database';

/** Shown when a stored integration token cannot be decrypted (rotated key, corrupted row). */
export const RECONNECT_REQUIRED_MESSAGE = 'انتهى ربط حسابك أو أصبح غير صالح. أعد ربط حسابك من صفحة التكامل ثم حاول مرة أخرى.';

const DECRYPT_ERROR = /Invalid authentication tag|Unsupported state or unable to authenticate data|bad decrypt/i;

/**
 * Turns low-level failures that used to surface as a bare "Internal server error"
 * into actionable responses. Everything else keeps Nest's default handling.
 */
@Catch()
export class FriendlyErrorsFilter extends BaseExceptionFilter {
  private readonly logger = new Logger(FriendlyErrorsFilter.name);

  override catch(exception: unknown, host: ArgumentsHost) {
    if (host.getType() !== 'http') return super.catch(exception, host);
    const response = host.switchToHttp().getResponse<{ status: (code: number) => { json: (body: unknown) => void } }>();

    if (exception instanceof Prisma.PrismaClientValidationError) {
      this.logger.warn(`Invalid request reached the database layer: ${exception.message.split('\n').slice(-1)[0]}`);
      return response.status(HttpStatus.BAD_REQUEST).json({
        statusCode: HttpStatus.BAD_REQUEST,
        error: 'Bad Request',
        message: 'الطلب ناقص أو غير صالح. حدّث الصفحة وحاول مرة أخرى.',
      });
    }

    if (exception instanceof Error && DECRYPT_ERROR.test(exception.message)) {
      this.logger.warn(`Stored credential could not be decrypted: ${exception.message}`);
      return response.status(HttpStatus.CONFLICT).json({
        statusCode: HttpStatus.CONFLICT,
        error: 'Conflict',
        code: 'RECONNECT_REQUIRED',
        message: RECONNECT_REQUIRED_MESSAGE,
      });
    }

    return super.catch(exception, host);
  }
}
