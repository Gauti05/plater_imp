import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';

interface Campaign {
  id: string;
  name: string;
  channel: 'SMS' | 'Email' | 'Push App';
  status: 'Active' | 'Scheduled' | 'Completed' | 'Draft';
  audienceSize: number;
  conversions: number;
  budgetSpent: number;
  revenueGenerated: number;
}

interface PromoCode {
  code: string;
  type: 'Percentage' | 'Flat';
  value: number;
  uses: number;
  maxUses: number;
  status: 'Active' | 'Expired';
}

@Component({
  selector: 'app-marketing',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './marketing.component.html',
  styleUrls: ['./marketing.component.css']
})
export class MarketingComponent implements OnInit {
  // KPI Metrics
  totalCampaignRevenue: number = 0;
  activePromosCount: number = 0;
  totalAudienceReached: number = 0;

  // Mock Data: Campaigns
  campaigns: Campaign[] = [
    { id: 'C1', name: 'Weekend Biryani Fiesta', channel: 'SMS', status: 'Active', audienceSize: 2500, conversions: 120, budgetSpent: 500, revenueGenerated: 45000 },
    { id: 'C2', name: 'VIP Loyalty 20% Off', channel: 'Email', status: 'Active', audienceSize: 800, conversions: 45, budgetSpent: 0, revenueGenerated: 22500 },
    { id: 'C3', name: 'Happy Hour Drinks', channel: 'Push App', status: 'Scheduled', audienceSize: 5000, conversions: 0, budgetSpent: 0, revenueGenerated: 0 },
    { id: 'C4', name: 'Diwali Mega Thali', channel: 'SMS', status: 'Completed', audienceSize: 10000, conversions: 850, budgetSpent: 2000, revenueGenerated: 340000 },
  ];

  // Mock Data: Promo Codes
  promoCodes: PromoCode[] = [
    { code: 'WELCOME50', type: 'Flat', value: 50, uses: 342, maxUses: 500, status: 'Active' },
    { code: 'ZOMATO20', type: 'Percentage', value: 20, uses: 1050, maxUses: 2000, status: 'Active' },
    { code: 'FREEDESSERT', type: 'Flat', value: 150, uses: 100, maxUses: 100, status: 'Expired' },
  ];

  // Mock Data: Customer Segments (CRM)
  segments = [
    { name: 'VIP (High Spenders)', count: 450, color: 'gold' },
    { name: 'Churn Risk (No visit > 30 days)', count: 1200, color: 'red' },
    { name: 'New Customers (This month)', count: 320, color: 'green' }
  ];

  ngOnInit() {
    this.calculateMetrics();
  }

  calculateMetrics() {
    this.totalCampaignRevenue = this.campaigns.reduce((sum, camp) => sum + camp.revenueGenerated, 0);
    this.totalAudienceReached = this.campaigns.reduce((sum, camp) => sum + camp.audienceSize, 0);
    this.activePromosCount = this.promoCodes.filter(p => p.status === 'Active').length;
  }

  getConversionRate(conversions: number, audience: number): number {
    if (audience === 0) return 0;
    return (conversions / audience) * 100;
  }

  togglePromoStatus(promo: PromoCode) {
    promo.status = promo.status === 'Active' ? 'Expired' : 'Active';
    this.calculateMetrics();
  }
}