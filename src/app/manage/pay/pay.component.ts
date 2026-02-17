import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface StaffPayroll {
  id: string;
  name: string;
  role: 'Manager' | 'Head Chef' | 'Line Cook' | 'Server' | 'Bartender';
  hoursWorked: number;
  hourlyRate: number;
  tips: number;
  deductions: number; 
  netPay?: number; 
  status: 'Paid' | 'Pending';
}

@Component({
  selector: 'app-pay',
  standalone: true,
  imports: [CommonModule], // Removed Material imports
  templateUrl: './pay.component.html',
  styleUrls: ['./pay.component.css']
})
export class PayComponent implements OnInit {
  // Mock data for restaurant staff
  staffRecords: StaffPayroll[] = [
    { id: '1', name: 'Gordon R.', role: 'Head Chef', hoursWorked: 45, hourlyRate: 30, tips: 0, deductions: 50, status: 'Paid' },
    { id: '2', name: 'Maria S.', role: 'Server', hoursWorked: 35, hourlyRate: 8, tips: 450, deductions: 15, status: 'Pending' },
    { id: '3', name: 'John D.', role: 'Bartender', hoursWorked: 40, hourlyRate: 10, tips: 320, deductions: 0, status: 'Pending' },
    { id: '4', name: 'Anna K.', role: 'Manager', hoursWorked: 50, hourlyRate: 25, tips: 0, deductions: 0, status: 'Paid' },
  ];

  totalPayroll: number = 0;
  totalTips: number = 0;
  pendingCount: number = 0;

  ngOnInit() {
    this.calculatePayroll();
  }

  calculatePayroll() {
    this.totalPayroll = 0;
    this.totalTips = 0;
    this.pendingCount = 0;

    this.staffRecords.forEach(staff => {
      // Calculate Net Pay: (Hours * Rate) + Tips - Deductions
      const basePay = staff.hoursWorked * staff.hourlyRate;
      staff.netPay = basePay + staff.tips - staff.deductions;

      // Update Dashboard Totals
      this.totalPayroll += staff.netPay;
      this.totalTips += staff.tips;
      
      if (staff.status === 'Pending') {
        this.pendingCount++;
      }
    });
  }

  markAsPaid(staffId: string) {
    const staff = this.staffRecords.find(s => s.id === staffId);
    if (staff) {
      staff.status = 'Paid';
      this.calculatePayroll(); // Recalculate totals
    }
  }
}