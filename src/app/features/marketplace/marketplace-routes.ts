import { Routes } from "@angular/router";
import { RoutesApp } from "../../shared/const/routes";

export default <Routes>[
    { path: RoutesApp.root, loadComponent: () => import(`./home/home.component`) },
    { path: RoutesApp.catalog, loadComponent: () => import('./catalog/catalog.component') },
    { path: `${RoutesApp.catalog}/bull/:id`, loadComponent: () => import('./bull-detail/bull-detail.component') },
    { path: `${RoutesApp.catalog}/:id`, loadComponent: () => import('./catalog/product-detail.component') },
    { path: RoutesApp.cart, loadComponent: () => import('./cart/cart.component') },
    { path: RoutesApp.checkout, loadComponent: () => import('./checkout/checkout.component') },
    { path: RoutesApp.root, redirectTo: RoutesApp.root, pathMatch: 'full' },
]
