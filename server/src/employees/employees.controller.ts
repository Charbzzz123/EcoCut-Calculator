import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import type { CreateEmployeeDto } from './dto/create-employee.dto';
import type { CreateClockActionDto } from './dto/create-clock-action.dto';
import type { CreateHoursEntryDto } from './dto/create-hours-entry.dto';
import type { CreateStartNextJobAssignmentDto } from './dto/create-start-next-job-assignment.dto';
import type { UpdateEmployeeDto } from './dto/update-employee.dto';
import type { UpdateHoursEntryDto } from './dto/update-hours-entry.dto';
import { EmployeesService } from './employees.service';
import type { EmployeeOperatorRole } from './employees.types';

@Controller('employees')
export class EmployeesController {
  constructor(private readonly employees: EmployeesService) {}

  @Get('roster')
  listRoster() {
    return this.employees.listRoster();
  }

  @Get('hours')
  listHoursEntries() {
    return this.employees.listHoursEntries();
  }

  @Get('history')
  listJobHistoryEntries() {
    return this.employees.listJobHistoryEntries();
  }

  @Get('readiness')
  listStartNextJobReadiness() {
    return this.employees.listStartNextJobReadiness();
  }

  @Post('roster')
  createEmployeeProfile(
    @Body() body: CreateEmployeeDto,
    @Headers('x-operator-role') operatorRole?: string,
  ) {
    return this.employees.createEmployeeProfile(
      body,
      this.parseOperatorRole(operatorRole),
    );
  }

  @Patch('roster/:employeeId')
  updateEmployeeProfile(
    @Param('employeeId') employeeId: string,
    @Body() body: UpdateEmployeeDto,
    @Headers('x-operator-role') operatorRole?: string,
  ) {
    return this.employees.updateEmployeeProfile(
      employeeId,
      body,
      this.parseOperatorRole(operatorRole),
    );
  }

  @Post('roster/:employeeId/archive')
  archiveEmployee(
    @Param('employeeId') employeeId: string,
    @Headers('x-operator-role') operatorRole?: string,
  ) {
    return this.employees.archiveEmployee(
      employeeId,
      this.parseOperatorRole(operatorRole),
    );
  }

  @Post('hours')
  createHoursEntry(
    @Body() body: CreateHoursEntryDto,
    @Headers('x-operator-role') operatorRole?: string,
  ) {
    return this.employees.createHoursEntry(
      body,
      this.parseOperatorRole(operatorRole),
    );
  }

  @Post('hours/clock')
  recordClockAction(
    @Body() body: CreateClockActionDto,
    @Headers('x-operator-role') operatorRole?: string,
  ) {
    return this.employees.recordClockAction(
      body,
      this.parseOperatorRole(operatorRole),
    );
  }

  @Patch('hours/:entryId')
  updateHoursEntry(
    @Param('entryId') entryId: string,
    @Body() body: UpdateHoursEntryDto,
    @Headers('x-operator-role') operatorRole?: string,
  ) {
    return this.employees.updateHoursEntry(
      entryId,
      body,
      this.parseOperatorRole(operatorRole),
    );
  }

  @Delete('hours/:entryId')
  removeHoursEntry(
    @Param('entryId') entryId: string,
    @Headers('x-operator-role') operatorRole?: string,
  ) {
    return this.employees.removeHoursEntry(
      entryId,
      this.parseOperatorRole(operatorRole),
    );
  }

  @Post('assignments/start-next-job')
  createStartNextJobAssignment(
    @Body() body: CreateStartNextJobAssignmentDto,
    @Headers('x-operator-role') operatorRole?: string,
  ) {
    return this.employees.createStartNextJobAssignment(
      body,
      this.parseOperatorRole(operatorRole),
    );
  }

  @Post('history/:entryId/complete')
  completeJobHistoryEntry(
    @Param('entryId') entryId: string,
    @Headers('x-operator-role') operatorRole?: string,
  ) {
    return this.employees.completeJobHistoryEntry(
      entryId,
      this.parseOperatorRole(operatorRole),
    );
  }

  private parseOperatorRole(rawRole: string | undefined): EmployeeOperatorRole {
    return rawRole?.toLowerCase() === 'manager' ? 'manager' : 'owner';
  }
}
