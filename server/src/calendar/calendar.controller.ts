import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { CalendarService } from './calendar.service.js';
import type { CreateCalendarEventDto } from './dto/create-calendar-event.dto.js';

@Controller('calendar')
export class CalendarController {
  constructor(private readonly calendarService: CalendarService) {}

  @Post('events')
  createEvent(@Body() body: CreateCalendarEventDto) {
    return this.calendarService.createEvent(body);
  }

  @Get('events')
  listEvents(
    @Query('timeMin') timeMin?: string,
    @Query('timeMax') timeMax?: string,
  ) {
    if (!timeMin || !timeMax) {
      throw new BadRequestException(
        'timeMin and timeMax query parameters are required.',
      );
    }
    return this.calendarService.listEvents({ timeMin, timeMax });
  }

  @Delete('events/:eventId')
  deleteEvent(@Param('eventId') eventId: string) {
    return this.calendarService.deleteEvent(eventId);
  }
}
