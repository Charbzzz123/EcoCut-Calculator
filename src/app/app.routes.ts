import { Routes } from '@angular/router';
import { HomeShellComponent } from './home/home-shell.component.js';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'home' },
  {
    path: 'home',
    component: HomeShellComponent,
    title: 'EcoCut | Home',
  },
  {
    path: 'clients',
    loadComponent: () => import('./clients/clients-shell.component.js').then((m) => m.ClientsShellComponent),
    title: 'EcoCut | Clients',
  },
  { path: '**', redirectTo: 'home' },
];
