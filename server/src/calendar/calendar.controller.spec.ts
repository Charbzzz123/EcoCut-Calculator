import { BadRequestException } from '@nestjs/common';
import { CalendarController } from './calendar.controller';
import type { CalendarService } from './calendar.service';

const serviceMock = {
  createEvent: jest.fn(),
  listEvents: jest.fn(),
  deleteEvent: jest.fn(),
  updateEvent: jest.fn(),
};

describe('CalendarController', () => {
  let controller: CalendarController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new CalendarController(
      serviceMock as unknown as CalendarService,
    );
  });

  it('delegates to the service when creating, deleting, and updating', async () => {
    serviceMock.createEvent.mockResolvedValue({});
    serviceMock.deleteEvent.mockResolvedValue({});
    serviceMock.updateEvent.mockResolvedValue({});

    const body = { summary: 'Job' } as never;
    await controller.createEvent(body);
    expect(serviceMock.createEvent).toHaveBeenCalledWith(body);

    await controller.deleteEvent('evt-1');
    expect(serviceMock.deleteEvent).toHaveBeenCalledWith('evt-1');

    await controller.updateEvent('evt-2', { summary: 'Updated' } as never);
    expect(serviceMock.updateEvent).toHaveBeenCalledWith('evt-2', {
      summary: 'Updated',
    });
  });

  it('requires timeMin/timeMax when listing events', () => {
    expect(() => controller.listEvents(undefined, 'b')).toThrow(
      BadRequestException,
    );
    expect(() => controller.listEvents('a', undefined)).toThrow(
      BadRequestException,
    );
    expect(() => controller.listEvents(undefined, undefined)).toThrow(
      BadRequestException,
    );
  });

  it('passes validated params to the service', async () => {
    serviceMock.listEvents.mockResolvedValue([]);
    await controller.listEvents('a', 'b');
    expect(serviceMock.listEvents).toHaveBeenCalledWith({
      timeMin: 'a',
      timeMax: 'b',
    });
  });
});

