import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): string {
    console.log("hello world from the app service")
    return 'Hello World 1234!';
  }
}
