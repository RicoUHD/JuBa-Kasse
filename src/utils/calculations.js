import { safeList } from './helpers.js';

export function getCurrentStatus(person, settings) {
    const today = new Date();
    return getStatusForMonth(person, today.getFullYear(), today.getMonth(), settings);
}

export function getStatusForMonth(person, year, month, settings, sortedHistory = null) {
    const currentTotal = year * 12 + month;

    const memberSince = person.memberSinceObj || new Date(person.originalMemberSince || person.memberSince);
    const memberStartTotal = memberSince.getFullYear() * 12 + memberSince.getMonth();

    if (currentTotal < memberStartTotal) {
        return null;
    }

    const history = sortedHistory || person.statusHistory;

    if (history && history.length > 0 && history[0].startTotal !== undefined) {
        for (const entry of history) {
            if (currentTotal >= entry.startTotal && (!entry.endTotal || currentTotal < entry.endTotal)) {
                return entry.status;
            }
        }
    } else {
        const targetDate = new Date(year, month, 15);
        const startOfMemberMonth = new Date(memberSince.getFullYear(), memberSince.getMonth(), 1);

        if (targetDate < startOfMemberMonth) return null;

        const fallbackHistory = safeList(person.statusHistory).slice().sort(
            (a, b) => new Date(a.startDate) - new Date(b.startDate)
        );

        for (const entry of fallbackHistory) {
            const start = new Date(entry.startDate);
            const end = entry.endDate ? new Date(entry.endDate) : null;
            const startMonth = new Date(start.getFullYear(), start.getMonth(), 1);

            if (targetDate >= startMonth && (!end || targetDate < new Date(end.getFullYear(), end.getMonth(), 1))) {
                return entry.status;
            }
        }
    }

    return person.status;
}

export function calculateTotalCostUntil(person, untilDate, settings) {
    const memberSince = person.memberSinceObj || new Date(person.originalMemberSince || person.memberSince);
    let totalCost = 0;

    let year = memberSince.getFullYear();
    let month = memberSince.getMonth();

    const sortedHistory = person.statusHistory;

    while (new Date(year, month, 1) <= untilDate) {
        const status = getStatusForMonth(person, year, month, settings, sortedHistory);
        if (status && settings[status]) {
            totalCost += settings[status];
        }

        month++;
        if (month > 11) {
            month = 0;
            year++;
        }
    }

    return totalCost;
}

export function calculatePaidUntil(person, settings) {
    return calculatePaymentStatus(person, settings).paidUntil;
}

export function calculatePaymentStatus(person, settings) {
    const totalPaid = person.totalPaid || 0;
    const start = person.memberSinceObj || new Date(person.originalMemberSince || person.memberSince);

    if (totalPaid === 0) {
        return {
            paidUntil: new Date(start.getFullYear(), start.getMonth(), 0),
            remainingCredit: 0
        };
    }

    let remainingCredit = totalPaid;

    let year = start.getFullYear();
    let month = start.getMonth();

    const sortedHistory = person.statusHistory;

    const maxIterations = 120;
    let iterations = 0;

    while (remainingCredit >= 0 && iterations < maxIterations) {
        const status = getStatusForMonth(person, year, month, settings, sortedHistory);
        const monthlyRate = status ? (settings[status] || 0) : 0;

        if (monthlyRate > 0) {
            if (remainingCredit >= monthlyRate) {
                remainingCredit -= monthlyRate;
            } else {
                break;
            }
        }

        month++;
        if (month > 11) {
            month = 0;
            year++;
        }
        iterations++;
    }

    month--;
    if (month < 0) {
        month = 11;
        year--;
    }

    return {
        paidUntil: new Date(year, month + 1, 0),
        remainingCredit: remainingCredit
    };
}

export function calculateCostRange(person, startDate, endDate, settings) {
    let totalCost = 0;
    let year = startDate.getFullYear();
    let month = startDate.getMonth();
    const sortedHistory = person.statusHistory;

    let limit = 0;
    while (new Date(year, month, 1) <= endDate && limit < 120) {
        const status = getStatusForMonth(person, year, month, settings, sortedHistory);
        if (status && settings[status]) {
            totalCost += settings[status];
        }
        month++;
        if (month > 11) { month = 0; year++; }
        limit++;
    }
    return totalCost;
}

export function calculateTimeRemaining(person, settings, preCalculatedPaidUntil) {
    const standingOrders = safeList(person.standingOrders);
    const now = new Date();
    const todayStr = new Date(now.getTime() - (now.getTimezoneOffset() * 60000)).toISOString().split('T')[0];

    const hasActiveSO = standingOrders.some(so => {
         if (so.startDate > todayStr) return false;
         if (so.endDate && so.endDate < todayStr) return false;
         return true;
    });

    if (hasActiveSO) {
        return {
            text: 'Dauerauftrag aktiv',
            isOverdue: false,
            isSoonDue: false,
            isActiveStandingOrder: true
        };
    }

    const paidUntil = preCalculatedPaidUntil !== undefined ? preCalculatedPaidUntil : calculatePaidUntil(person, settings);
    if (!paidUntil) {
        return { text: 'Keine Zahlungen', isOverdue: true, isSoonDue: false };
    }

    const today = new Date();
    const currentMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const paidMonth = new Date(paidUntil.getFullYear(), paidUntil.getMonth(), 1);

    const monthsDiff = (paidMonth.getFullYear() - currentMonth.getFullYear()) * 12
                     + (paidMonth.getMonth() - currentMonth.getMonth());

    if (monthsDiff < 0) {
        const overdueMonths = Math.abs(monthsDiff);

        if (overdueMonths === 1) {
            const standingOrders = safeList(person.standingOrders);
            const hasCoverage = standingOrders.some(so => {
                const targetMonth = currentMonth.getMonth();
                const targetYear = currentMonth.getFullYear();

                if (so.endDate) {
                    const endDay = new Date(so.endDate);
                    endDay.setHours(23, 59, 59, 999);

                    const start = new Date(so.startDate);
                    const dayOfMonth = start.getDate();
                    const paymentDateInTargetMonth = new Date(targetYear, targetMonth, dayOfMonth);

                    if (paymentDateInTargetMonth.getMonth() !== targetMonth) {
                        const lastDay = new Date(targetYear, targetMonth + 1, 0).getDate();
                        paymentDateInTargetMonth.setMonth(targetMonth);
                        paymentDateInTargetMonth.setDate(Math.min(dayOfMonth, lastDay));
                    }

                    if (paymentDateInTargetMonth > endDay) return false;
                }

                if (so.lastAutoPayment) {
                    const last = new Date(so.lastAutoPayment);
                    last.setMonth(last.getMonth() + 1);
                    return last.getMonth() === targetMonth && last.getFullYear() === targetYear;
                } else {
                    const start = new Date(so.startDate);
                    return start.getMonth() === targetMonth && start.getFullYear() === targetYear;
                }
            });

            if (hasCoverage) {
                return {
                    text: 'Dauerauftrag geplant',
                    isOverdue: false,
                    isSoonDue: false,
                    isPlanned: true
                };
            }
        }

        return {
            text: `${overdueMonths} Monat${overdueMonths !== 1 ? 'e' : ''} überfällig`,
            isOverdue: true,
            isSoonDue: false
        };
    }

    if (monthsDiff === 0) {
        return { text: 'läuft diesen Monat ab', isOverdue: false, isSoonDue: true };
    } else if (monthsDiff === 1) {
        return { text: 'läuft nächsten Monat ab', isOverdue: false, isSoonDue: true };
    } else {
        return { text: `noch ${monthsDiff} Monat${monthsDiff !== 1 ? 'e' : ''}`, isOverdue: false, isSoonDue: false };
    }
}

export function calculateOverdueAmount(person, settings, preCalcPaidUntil, preCalcCredit) {
    const today = new Date();
    const targetDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);

    if (preCalcPaidUntil) {
        const startCalc = new Date(preCalcPaidUntil);
        startCalc.setDate(1);
        startCalc.setMonth(startCalc.getMonth() + 1);

        if (startCalc > targetDate) return 0;

        const missingCost = calculateCostRange(person, startCalc, targetDate, settings);
        const credit = preCalcCredit || 0;
        const finalMissing = missingCost - credit;

        return finalMissing > 0 ? finalMissing : 0;
    }

    const totalCost = calculateTotalCostUntil(person, targetDate, settings);
    const totalPaid = person.totalPaid || 0;

    const missing = totalCost - totalPaid;
    return missing > 0 ? missing : 0;
}
