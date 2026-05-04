import { Pipe, type PipeTransform } from '@angular/core';
import { environment } from '../../../environments/environment';

@Pipe({
  name: 'appS3fileUrl',
})
export class S3fileUrlPipe implements PipeTransform {

  transform(value: unknown, ...args: unknown[]): unknown {
    return `${environment.cdn}/${value}`;
  }

}
