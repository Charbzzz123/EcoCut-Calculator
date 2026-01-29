import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import type { PayrollEntry } from '../../home.models';

const currencyFormatter = new Intl.NumberFormat('en-CA', {
  style: 'currency',
  currency: 'CAD',
  maximumFractionDigits: 0,
});

@Component({
  selector: 'app-weekly-payroll',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './weekly-payroll.component.html',
  styleUrl: './weekly-payroll.component.scss',
})
export class WeeklyPayrollComponent {
  @Input() entries: PayrollEntry[] | null = [];

  protected get totals() {
    const hours = this.entries?.reduce((acc, entry) => acc + entry.hours, 0) ?? 0;
    const wages = this.entries?.reduce((acc, entry) => acc + entry.wages, 0) ?? 0;
    return { hours, wages };
  }

  protected formatCurrency(value: number): string {
    return currencyFormatter.format(value);
  }
}
