import { Routes } from "@angular/router";
import { RoutesApp } from "../../shared/const/routes";
import { guestGuard } from "../../core/guards/guest.guard";

export default <Routes>[
    { path: RoutesApp.signIn, canActivate: [guestGuard], loadComponent: () => import('./sign-in/sign-in.component') },
    { path: RoutesApp.signUp, canActivate: [guestGuard], loadComponent: () => import('./sign-up/sign-up.component') },
    { path: RoutesApp.forgotPassword, canActivate: [guestGuard], loadComponent: () => import('./forgot-password/forgot-password.component') },
    { path: RoutesApp.verifyEmail, loadComponent: () => import('./verify-email/verify-email.component') },
    { path: RoutesApp.setPassword, loadComponent: () => import('./set-password/set-password.component') },
    { path: RoutesApp.callback, loadComponent: () => import('./callback/callback.component') },
    { path: '', redirectTo: RoutesApp.signIn, pathMatch: 'full' },
]
