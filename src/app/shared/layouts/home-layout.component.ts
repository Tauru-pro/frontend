import { ChangeDetectionStrategy, Component } from "@angular/core";
import { RouterOutlet } from "@angular/router";
import { NavbarComponent } from "../components/navbar/navbar-component";
import { FooterComponent } from "../components/footer/footer";

@Component({
    selector: 'app-home',
    imports: [RouterOutlet, NavbarComponent, FooterComponent],
    template: `
    <app-navbar/>
    <main class="max-w-[1400px] mx-auto px-4 py-6 flex gap-5">
       <router-outlet />
    </main>
    <app-footer/>
    `,
    changeDetection: ChangeDetectionStrategy.OnPush,

})
export class HomeLayoutComponent {

}