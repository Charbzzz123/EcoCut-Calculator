import { Routes } from '@angular/router';
import { HomeShellComponent } from '../features/home/home-shell.component.js';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'home' },
  {
    path: 'home',
    component: HomeShellComponent,
    title: 'EcoCut | Home',
  },
  {
    path: 'clients',
    loadComponent: () =>
      import('../features/clients/clients-shell.component.js').then((m) => m.ClientsShellComponent),
    title: 'EcoCut | Clients',
  },
  {
    path: 'communications/broadcast',
    loadComponent: () =>
      import('../features/communications/broadcast-shell.component.js').then(
        (m) => m.BroadcastShellComponent,
      ),
    title: 'EcoCut | Broadcast',
  },
  {
    path: 'employees/manage',
    loadComponent: () =>
      import('../features/employees/manage-employees-shell.component.js').then(
        (m) => m.ManageEmployeesShellComponent,
      ),
    title: 'EcoCut | Manage Employees',
  },
  {
    path: 'jobs/start',
    loadComponent: () =>
      import('../features/jobs/start-next-job-shell.component.js').then(
        (m) => m.StartNextJobShellComponent,
      ),
    title: 'EcoCut | Start Next Job',
  },
  { path: '**', redirectTo: 'home' },
];
