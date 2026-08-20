import { Routes } from "@angular/router";
import { RoutesApp } from "../../shared/const/routes";
import { authGuard } from "../../core/guards/auth.guard";
import { becomeSellerGuard } from "../../core/guards/become-seller.guard";

export default <Routes>[
    { path: RoutesApp.root, loadComponent: () => import(`./home/home.component`) },
    { path: RoutesApp.catalog, loadComponent: () => import('./catalog/catalog.component') },
    { path: `${RoutesApp.catalog}/bull/:id`, loadComponent: () => import('./bull-detail/bull-detail.component') },
    { path: `${RoutesApp.catalog}/:id`, loadComponent: () => import('./catalog/product-detail.component') },
    { path: RoutesApp.cart, loadComponent: () => import('./cart/cart.component') },
    { path: RoutesApp.checkout, canActivate: [authGuard], loadComponent: () => import('./checkout/checkout.component') },
    { path: `${RoutesApp.checkout}/result`, canActivate: [authGuard], loadComponent: () => import('./checkout/result/result.component') },
    { path: RoutesApp.orders, canActivate: [authGuard], loadComponent: () => import('./orders/orders-list.component') },
    { path: `${RoutesApp.orders}/:id`, canActivate: [authGuard], loadComponent: () => import('./orders/order-detail.component') },
    { path: RoutesApp.profile, canActivate: [authGuard], loadComponent: () => import('./profile/profile.component') },
    { path: RoutesApp.becomeSeller, canActivate: [becomeSellerGuard], loadComponent: () => import('./become-seller/become-seller.component') },
    { path: 'terms/:audience', loadComponent: () => import('./terms/terms-page.component') },
    { path: RoutesApp.root, redirectTo: RoutesApp.root, pathMatch: 'full' },
]
