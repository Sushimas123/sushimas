// Payment Terms Calculation Utilities

interface PaymentTerm {
  calculation_type: string;
  days: number;
  payment_dates?: number[];
  payment_day_of_week?: number;
}

// Calculate due date based on payment term
export const calculateDueDate = (
  baseDate: Date, 
  paymentTerm: PaymentTerm
): Date => {
  const dueDate = new Date(baseDate);
  
  switch (paymentTerm.calculation_type) {
    case 'from_invoice':
    case 'from_delivery':
      dueDate.setDate(dueDate.getDate() + paymentTerm.days);
      break;
      
    case 'fixed_dates':
      if (paymentTerm.payment_dates && paymentTerm.payment_dates.length > 0) {
        const currentDay = dueDate.getDate();
        let nextPaymentDate: Date | null = null;
        
        for (const paymentDate of paymentTerm.payment_dates) {
          let targetDate: Date;
          
          if (paymentDate === 999) {
            // End of month - get last day of current month
            targetDate = new Date(dueDate.getFullYear(), dueDate.getMonth() + 1, 0);
          } else {
            // Specific date
            targetDate = new Date(dueDate.getFullYear(), dueDate.getMonth(), paymentDate);
          }
          
          // If target date is in the past, move to next month
          if (targetDate <= dueDate) {
            if (paymentDate === 999) {
              // Next month end
              targetDate = new Date(dueDate.getFullYear(), dueDate.getMonth() + 2, 0);
            } else {
              // Next month same date
              targetDate = new Date(dueDate.getFullYear(), dueDate.getMonth() + 1, paymentDate);
            }
          }
          
          // Find the earliest valid payment date
          if (!nextPaymentDate || targetDate < nextPaymentDate) {
            nextPaymentDate = targetDate;
          }
        }
        
        if (nextPaymentDate) {
          return nextPaymentDate;
        }
      }
      break;
      
    case 'weekly':
      if (paymentTerm.payment_day_of_week !== undefined) {
        const currentDay = dueDate.getDay();
        const targetDay = paymentTerm.payment_day_of_week;
        let daysToAdd = targetDay - currentDay;
        
        // If target day is today or in the past, move to next week
        if (daysToAdd <= 0) {
          daysToAdd += 7;
        }
        
        dueDate.setDate(dueDate.getDate() + daysToAdd);
      }
      break;
  }
  
  return dueDate;
};

// Format payment term display text
export const formatPaymentTermDisplay = (paymentTerm: PaymentTerm): string => {
  switch (paymentTerm.calculation_type) {
    case 'from_invoice':
      return `${paymentTerm.days} hari dari invoice`;
      
    case 'from_delivery':
      return `${paymentTerm.days} hari dari delivery`;
      
    case 'fixed_dates':
      if (paymentTerm.payment_dates) {
        const dates = paymentTerm.payment_dates.map(date => 
          date === 999 ? 'Akhir Bulan' : `Tanggal ${date}`
        );
        return dates.join(', ');
      }
      return 'Tanggal tetap';
      
    case 'weekly':
      const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
      return `Setiap ${days[paymentTerm.payment_day_of_week || 0]}`;
      
    default:
      return `${paymentTerm.days} hari`;
  }
};

// Calculate early payment discount
export const calculateEarlyPaymentDiscount = (
  invoiceAmount: number,
  paymentDate: Date,
  dueDate: Date,
  earlyPaymentDays: number,
  discountPercentage: number
): { discountAmount: number; finalAmount: number; isEligible: boolean } => {
  const earlyPaymentDeadline = new Date(dueDate);
  earlyPaymentDeadline.setDate(earlyPaymentDeadline.getDate() - earlyPaymentDays);
  
  const isEligible = paymentDate <= earlyPaymentDeadline;
  const discountAmount = isEligible ? (invoiceAmount * discountPercentage / 100) : 0;
  const finalAmount = invoiceAmount - discountAmount;
  
  return {
    discountAmount,
    finalAmount,
    isEligible
  };
};

// Calculate late payment penalty
export const calculateLatePaymentPenalty = (
  invoiceAmount: number,
  paymentDate: Date,
  dueDate: Date,
  penaltyPercentage: number,
  gracePeriodDays: number = 0
): { penaltyAmount: number; daysLate: number; isLate: boolean } => {
  const gracePeriodEnd = new Date(dueDate);
  gracePeriodEnd.setDate(gracePeriodEnd.getDate() + gracePeriodDays);
  
  const isLate = paymentDate > gracePeriodEnd;
  const daysLate = isLate ? Math.ceil((paymentDate.getTime() - gracePeriodEnd.getTime()) / (1000 * 60 * 60 * 24)) : 0;
  const monthsLate = daysLate / 30; // Approximate months
  const penaltyAmount = isLate ? (invoiceAmount * penaltyPercentage / 100 * monthsLate) : 0;
  
  return {
    penaltyAmount,
    daysLate,
    isLate
  };
};

// Get next payment dates for a term (useful for cash flow planning)
export const getNextPaymentDates = (
  paymentTerm: PaymentTerm,
  startDate: Date = new Date(),
  count: number = 12
): Date[] => {
  const dates: Date[] = [];
  let currentDate = new Date(startDate);
  
  for (let i = 0; i < count; i++) {
    const nextDate = calculateDueDate(currentDate, paymentTerm);
    dates.push(new Date(nextDate));
    
    // Move to next period
    switch (paymentTerm.calculation_type) {
      case 'fixed_dates':
        currentDate = new Date(nextDate);
        currentDate.setDate(currentDate.getDate() + 1); // Move past current payment date
        break;
      case 'weekly':
        currentDate = new Date(nextDate);
        currentDate.setDate(currentDate.getDate() + 1);
        break;
      default:
        currentDate.setMonth(currentDate.getMonth() + 1);
        break;
    }
  }
  
  return dates;
};