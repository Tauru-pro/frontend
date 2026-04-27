import { Routes } from "@angular/router";
import { RoutesApp } from "../../shared/const/routes";

export default <Routes>[
    { path: RoutesApp.signIn, loadComponent: () => import('./sign-in/sign-in.component') },
    { path: RoutesApp.signUp, loadComponent: () => import('./sign-up/sign-up.component') },
    { path: RoutesApp.verifyEmail, loadComponent: () => import('./verify-email/verify-email.component') },
    { path: '', redirectTo: RoutesApp.signIn, pathMatch: 'full' },
]
