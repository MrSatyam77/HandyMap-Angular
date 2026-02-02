import { Routes } from '@angular/router';

export const routes: Routes = [
    {
        path: '',
        redirectTo: '/home',
        pathMatch: 'full'
    },
    {
        path: 'home',
        loadComponent: () => import('./components/home/home.component').then(m => m.HomeComponent)
    },
    {
        path: 'booking',
        loadComponent: () => import('./components/booking/booking.component').then(m => m.BookingComponent)
    },
    {
        path: 'expert-tracking',
        loadComponent: () => import('./components/expert-tracking/expert-tracking.component').then(m => m.ExpertTrackingComponent)
    },
    {
        path: '**',
        redirectTo: '/home'
    }
];
