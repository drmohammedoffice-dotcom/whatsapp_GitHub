import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class PasswordService {
  hash(password: string) {
    return bcrypt.hash(password, 12);
  }

  verify(password: string, hash: string) {
    return bcrypt.compare(password, hash);
  }
}
