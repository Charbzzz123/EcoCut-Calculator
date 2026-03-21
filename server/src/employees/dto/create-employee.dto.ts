export interface CreateEmployeeDto {
  firstName: string;
  lastName: string;
  phone: string;
  email?: string;
  role: string;
  hourlyRate: number;
  notes?: string;
}
