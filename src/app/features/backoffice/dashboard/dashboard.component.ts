import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { NgClass } from '@angular/common';
import { RouterLink } from '@angular/router';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

interface StatCard {
  label: string;
  value: string;
  delta: string;
  positive: boolean;
  icon: SafeHtml;
  color: string;
}

interface ActivityRow {
  orderId: string;
  customer: string;
  product: string;
  status: string;
  date: string;
}

@Component({
  selector: 'app-dashboard',
  imports: [NgClass, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div>
      <div class="flex items-center justify-between mb-6">
        <h1 class="text-2xl font-bold text-gray-900">Dashboard</h1>
        <a
          routerLink="/"
          class="flex items-center gap-2 text-sm text-gray-500 hover:text-primary transition-colors"
        >
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"/>
          </svg>
          Ir al Marketplace
        </a>
      </div>

      <!-- Stat Cards -->
      <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 mb-8">
        @for (card of stats; track card.label) {
          <div class="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <div class="flex items-start justify-between mb-4">
              <div class="w-10 h-10 rounded-xl flex items-center justify-center" [ngClass]="card.color">
                <span [innerHTML]="card.icon" class="w-5 h-5 text-white [&>svg]:w-5 [&>svg]:h-5"></span>
              </div>
              <span class="text-xs font-semibold px-2 py-1 rounded-full"
                [ngClass]="card.positive ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500'">
                {{ card.delta }}
              </span>
            </div>
            <p class="text-2xl font-bold text-gray-900">{{ card.value }}</p>
            <p class="text-sm text-gray-400 mt-0.5">{{ card.label }}</p>
          </div>
        }
      </div>

      <!-- Quick Actions -->
      <div class="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 mb-8">
        <h2 class="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">Quick Actions</h2>
        <div class="flex flex-wrap gap-3">
          @for (action of quickActions; track action.label) {
            <button
              type="button"
              class="px-4 py-2 text-sm font-medium rounded-xl border transition-all"
              [ngClass]="action.primary
                ? 'bg-primary text-white border-transparent hover:bg-primary-dark'
                : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50 hover:border-gray-300'"
            >
              {{ action.label }}
            </button>
          }
        </div>
      </div>

      <!-- Recent Activity Table -->
      <div class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div class="px-5 py-4 border-b border-gray-100">
          <h2 class="text-sm font-semibold text-gray-700 uppercase tracking-wide">Recent Activity</h2>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="text-xs text-gray-400 uppercase tracking-wide bg-gray-50">
                <th class="px-5 py-3 text-left font-medium">Order ID</th>
                <th class="px-5 py-3 text-left font-medium">Customer</th>
                <th class="px-5 py-3 text-left font-medium">Product</th>
                <th class="px-5 py-3 text-left font-medium">Status</th>
                <th class="px-5 py-3 text-left font-medium">Date</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-50">
              @for (row of recentActivity; track row.orderId) {
                <tr class="hover:bg-gray-50 transition-colors">
                  <td class="px-5 py-3.5 font-mono text-gray-700 font-medium">{{ row.orderId }}</td>
                  <td class="px-5 py-3.5 text-gray-600">{{ row.customer }}</td>
                  <td class="px-5 py-3.5 text-gray-600">{{ row.product }}</td>
                  <td class="px-5 py-3.5">
                    <span class="px-2.5 py-1 rounded-full text-xs font-semibold" [ngClass]="statusClass(row.status)">
                      {{ row.status }}
                    </span>
                  </td>
                  <td class="px-5 py-3.5 text-gray-400 text-xs">{{ row.date }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `,
})
export default class DashboardComponent {
  private sanitizer = inject(DomSanitizer);

  private svg(raw: string): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(raw);
  }

  stats: StatCard[] = [
    {
      label: 'Total Users',
      value: '2,847',
      delta: '+12%',
      positive: true,
      color: 'bg-primary',
      icon: this.svg(`<svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/></svg>`),
    },
    {
      label: 'Total Orders',
      value: '1,293',
      delta: '+8%',
      positive: true,
      color: 'bg-accent',
      icon: this.svg(`<svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>`),
    },
    {
      label: 'Revenue Today',
      value: '$4,821',
      delta: '+3%',
      positive: true,
      color: 'bg-emerald-500',
      icon: this.svg(`<svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`),
    },
    {
      label: 'Active Products',
      value: '384',
      delta: '-2%',
      positive: false,
      color: 'bg-violet-500',
      icon: this.svg(`<svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg>`),
    },
  ];

  quickActions = [
    { label: '+ Add Product', primary: true },
    { label: '+ Invite User', primary: true },
    { label: 'Export Orders', primary: false },
    { label: 'View Reports', primary: false },
  ];

  recentActivity: ActivityRow[] = [
    { orderId: '#ORD-0192', customer: 'Carlos Mendez', product: 'Angus Bull 18mo', status: 'Completed', date: 'Apr 26, 2026' },
    { orderId: '#ORD-0191', customer: 'María Torres', product: 'Holstein Cow', status: 'Pending', date: 'Apr 25, 2026' },
    { orderId: '#ORD-0190', customer: 'Andrés Silva', product: 'Brahman Heifer', status: 'Processing', date: 'Apr 25, 2026' },
    { orderId: '#ORD-0189', customer: 'Lucía Gómez', product: 'Zebu Bull 2yr', status: 'Cancelled', date: 'Apr 24, 2026' },
    { orderId: '#ORD-0188', customer: 'Juan Perez', product: 'Simmental Steer', status: 'Completed', date: 'Apr 24, 2026' },
  ];

  statusClass(status: string): string {
    switch (status) {
      case 'Completed':  return 'bg-green-50 text-green-700';
      case 'Pending':    return 'bg-yellow-50 text-yellow-700';
      case 'Processing': return 'bg-blue-50 text-blue-700';
      case 'Cancelled':  return 'bg-red-50 text-red-500';
      default:           return 'bg-gray-100 text-gray-600';
    }
  }
}
