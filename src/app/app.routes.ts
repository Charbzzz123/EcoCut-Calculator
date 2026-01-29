import { Routes } from '@angular/router';
import { HomeShellComponent } from './home/home-shell.component';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'home' },
  {
    path: 'home',
    component: HomeShellComponent,
    title: 'EcoCut | Home',
  },
  { path: '**', redirectTo: 'home' },
];
