const test = require('node:test');
const assert = require('node:assert/strict');
const { checkAndExecuteStandingOrders } = require('./standingOrders');

test('standing order scheduled on Saturday delays execution to Monday and does not execute before Monday', () => {
    // Saturday date: 2026-03-07
    const person = {
        id: 'p1',
        payments: [],
        standingOrders: [
            {
                id: 'so1',
                amount: 50,
                startDate: '2026-03-07', // Saturday
                note: 'Test Saturday SO'
            }
        ]
    };

    // Case A: Mock system date as Saturday (2026-03-07)
    // On Saturday, executionDate is Monday (2026-03-09), so executionDate > limitDate (2026-03-07).
    // The standing order should NOT execute on Saturday.
    const OriginalDate = global.Date;
    class MockDateSaturday extends OriginalDate {
        constructor(...args) {
            if (args.length === 0) {
                super('2026-03-07T12:00:00Z');
            } else {
                super(...args);
            }
        }
    }
    global.Date = MockDateSaturday;

    try {
        const resultSat = checkAndExecuteStandingOrders(person);
        assert.equal(resultSat, null, 'Standing order should not execute on Saturday');
    } finally {
        global.Date = OriginalDate;
    }

    // Case B: Mock system date as Monday (2026-03-09)
    // On Monday, executionDate (2026-03-09) <= limitDate (2026-03-09).
    // The standing order should execute on Monday with payment date set to Monday 2026-03-09.
    class MockDateMonday extends OriginalDate {
        constructor(...args) {
            if (args.length === 0) {
                super('2026-03-09T12:00:00Z');
            } else {
                super(...args);
            }
        }
    }
    global.Date = MockDateMonday;

    try {
        const resultMon = checkAndExecuteStandingOrders(person);
        assert.notEqual(resultMon, null, 'Standing order should execute on Monday');
        assert.equal(resultMon.payments.length, 1);
        assert.equal(resultMon.payments[0].date, '2026-03-09');
        assert.equal(resultMon.payments[0].id, 'auto_so1_2026-03-07');
    } finally {
        global.Date = OriginalDate;
    }
});

test('standing order scheduled on Sunday delays execution to Monday and does not execute before Monday', () => {
    // Sunday date: 2026-03-08
    const person = {
        id: 'p2',
        payments: [],
        standingOrders: [
            {
                id: 'so2',
                amount: 30,
                startDate: '2026-03-08', // Sunday
                note: 'Test Sunday SO'
            }
        ]
    };

    const OriginalDate = global.Date;
    class MockDateSunday extends OriginalDate {
        constructor(...args) {
            if (args.length === 0) {
                super('2026-03-08T12:00:00Z');
            } else {
                super(...args);
            }
        }
    }
    global.Date = MockDateSunday;

    try {
        const resultSun = checkAndExecuteStandingOrders(person);
        assert.equal(resultSun, null, 'Standing order should not execute on Sunday');
    } finally {
        global.Date = OriginalDate;
    }

    class MockDateMonday extends OriginalDate {
        constructor(...args) {
            if (args.length === 0) {
                super('2026-03-09T12:00:00Z');
            } else {
                super(...args);
            }
        }
    }
    global.Date = MockDateMonday;

    try {
        const resultMon = checkAndExecuteStandingOrders(person);
        assert.notEqual(resultMon, null, 'Standing order should execute on Monday');
        assert.equal(resultMon.payments.length, 1);
        assert.equal(resultMon.payments[0].date, '2026-03-09');
        assert.equal(resultMon.payments[0].id, 'auto_so2_2026-03-08');
    } finally {
        global.Date = OriginalDate;
    }
});
