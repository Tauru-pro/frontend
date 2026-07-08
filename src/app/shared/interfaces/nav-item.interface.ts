import { SafeHtml } from "@angular/platform-browser";

export interface NavItem {
    label: string;
    path: string;
    icon: SafeHtml;
    badge?: number;
}