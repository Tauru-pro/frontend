import { Routes } from "@angular/router";
import { RoutesApp } from "../../shared/const/routes";

export default <Routes>[
    { path: RoutesApp.root, loadComponent: () => import(`./home/home.component`) },
    { path: RoutesApp.root, redirectTo: RoutesApp.root, pathMatch: 'full' }
]