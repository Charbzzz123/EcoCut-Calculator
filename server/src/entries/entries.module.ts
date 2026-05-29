import { Module } from '@nestjs/common';
import { CommunicationsModule } from '../communications/communications.module';
import { EntriesController } from './entries.controller';
import { EntriesRepository } from './entries.repository';
import { EntriesService } from './entries.service';

@Module({
  imports: [CommunicationsModule],
  controllers: [EntriesController],
  providers: [EntriesService, EntriesRepository],
  exports: [EntriesService],
})
export class EntriesModule {}
