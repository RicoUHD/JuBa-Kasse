import { defineStore } from 'pinia';
import { db, auth } from '../firebase';
import { ref as dbRef, set, get, child, update, query, orderByChild, equalTo, runTransaction, remove } from 'firebase/database';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, updatePassword } from 'firebase/auth';
import { safeList } from '../utils/helpers';

export const useAppStore = defineStore('app', {
    state: () => ({
        people: [],
        donations: [],
        expenses: [],
        requests: [],
        users: [],
        settings: {
            vollverdiener: 50,
            geringverdiener: 25,
            keinverdiener: 10,
            pausiert: 0,
            reportStartDate: null
        },
        inviteCode: '123456',
        user: null, // Current user profile
        authLoading: true,
        dataLoading: false,
        authError: null,
    }),

    getters: {
        isAdmin: (state) => state.user?.admin || false,
        isAuthenticated: (state) => !!state.user,
        currentUserPerson: (state) => {
             if (!state.user) return null;
             return state.people.find(p => p.uid === state.user.uid);
        },
        sortedRequests: (state) => {
            return [...state.requests].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        }
    },

    actions: {
        async initAuth() {
            return new Promise((resolve) => {
                onAuthStateChanged(auth, async (firebaseUser) => {
                    if (firebaseUser) {
                        this.authLoading = true;
                        try {
                            const profile = await this.fetchUserProfile(firebaseUser.uid);
                            if (profile) {
                                this.user = profile;
                            } else {
                                this.user = { role: 'user', email: firebaseUser.email, uid: firebaseUser.uid, firstName: 'User', lastName: '' };
                            }
                            await this.fetchData();
                        } catch (e) {
                            console.error("Auth init error", e);
                        } finally {
                            this.authLoading = false;
                            resolve(true);
                        }
                    } else {
                        this.user = null;
                        this.authLoading = false;
                        resolve(false);
                    }
                });
            });
        },

        async fetchUserProfile(uid) {
             const snap = await get(dbRef(db, 'users/' + uid));
             if (snap.exists()) return { ...snap.val(), uid };
             return null;
        },

        async login(email, password) {
            this.authError = null;
            try {
                await signInWithEmailAndPassword(auth, email, password);
            } catch (error) {
                this.authError = error.message;
                throw error;
            }
        },

        async register(email, password, firstName, lastName, code) {
            this.authError = null;

            // Validate code
            const codeSnap = await get(dbRef(db, 'system/inviteCode'));
            const validCode = codeSnap.exists() ? codeSnap.val() : '123456';
            if (String(code) !== String(validCode)) {
                throw new Error("Ungültiger Registrierungscode.");
            }

            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            await set(dbRef(db, 'users/' + user.uid), {
                firstName,
                lastName,
                email,
                admin: false
            });

            // Force fetch profile immediately
            this.user = { uid: user.uid, firstName, lastName, email, admin: false };
        },

        async logout() {
            await signOut(auth);
            this.user = null;
            this.people = [];
            this.requests = [];
        },

        async fetchData() {
            if (!this.user) return;
            this.dataLoading = true;
            const rootRef = dbRef(db);

            try {
                if (!this.isAdmin) {
                    // User View
                    const sSnap = await get(child(rootRef, 'settings'));
                    if (sSnap.exists()) this.settings = sSnap.val();

                    const peopleRef = child(rootRef, 'people');
                    let peopleList = [];

                    // Try fetch all and filter client side (simpler for migration)
                    const pSnap = await get(peopleRef);
                    const allPeople = safeList(pSnap.val());
                    const fullName = `${this.user.firstName} ${this.user.lastName}`.toLowerCase();

                    peopleList = allPeople.filter(p => p.uid === this.user.uid || p.name.toLowerCase() === fullName);

                    // Auto-link logic if needed (kept from original)
                     if (peopleList.length > 0) {
                        const p = peopleList[0];
                        if (!p.uid && p.name.toLowerCase() === fullName) {
                            p.uid = this.user.uid;
                            // Find key to update
                            if(pSnap.exists()) {
                                const val = pSnap.val();
                                const key = Object.keys(val).find(k => val[k].id === p.id);
                                if(key) {
                                    update(child(peopleRef, key), { uid: this.user.uid });
                                }
                            }
                        }
                    }
                    this.people = this.normalizePeople(peopleList);

                    const requestsRef = child(rootRef, 'requests');
                    const rSnap = await get(requestsRef);
                    const allRequests = safeList(rSnap.val());
                    this.requests = allRequests.filter(r => r.userId === this.user.uid);

                } else {
                    // Admin View
                    const [pSnap, dSnap, eSnap, sSnap, cSnap, rSnap, uSnap] = await Promise.all([
                        get(child(rootRef, 'people')),
                        get(child(rootRef, 'donations')),
                        get(child(rootRef, 'expenses')),
                        get(child(rootRef, 'settings')),
                        get(child(rootRef, 'system/inviteCode')),
                        get(child(rootRef, 'requests')),
                        get(child(rootRef, 'users'))
                    ]);

                    this.people = this.normalizePeople(safeList(pSnap.val()));
                    this.donations = safeList(dSnap.val());
                    this.expenses = safeList(eSnap.val());
                    this.requests = safeList(rSnap.val());
                    if (sSnap.exists()) this.settings = sSnap.val();
                    if (cSnap.exists()) this.inviteCode = cSnap.val();
                    this.users = uSnap.exists()
                        ? Object.entries(uSnap.val()).map(([uid, data]) => ({...data, uid}))
                        : [];

                    // Standing orders check
                    await this.checkAllStandingOrders();
                }
            } catch (err) {
                console.error("Fetch Data Error", err);
            } finally {
                this.dataLoading = false;
            }
        },

        normalizePeople(list) {
            return list.map(person => {
                if (!person.memberSince) person.memberSince = new Date().toISOString().split('T')[0];
                if (!person.originalMemberSince) person.originalMemberSince = person.memberSince;
                person.payments = safeList(person.payments);

                person.statusHistory = safeList(person.statusHistory).sort(
                    (a, b) => new Date(a.startDate) - new Date(b.startDate)
                );

                // Pre-calculate totals for fast lookup
                person.statusHistory.forEach(entry => {
                    const s = new Date(entry.startDate);
                    entry.startTotal = s.getFullYear() * 12 + s.getMonth();
                    if (entry.endDate) {
                        const e = new Date(entry.endDate);
                        entry.endTotal = e.getFullYear() * 12 + e.getMonth();
                    } else {
                        entry.endTotal = null;
                    }
                });

                person.memberSinceObj = new Date(person.originalMemberSince || person.memberSince);
                return person;
            });
        },

        async checkAllStandingOrders() {
            if (!this.isAdmin) return;
            const updates = [];

            for (let i = 0; i < this.people.length; i++) {
                const person = this.people[i];
                const result = this.checkAndExecuteStandingOrders(person);
                if (result) {
                    const newTotal = safeList(result.payments).reduce((acc, p) => acc + parseFloat(p.amount), 0);

                    // We need the firebase key, assuming person.id matches key or we search it?
                    // In original code: update(ref(db, 'people/' + person.id), ...)
                    // Assuming person.id IS the key used in paths.

                    updates.push(update(dbRef(db, 'people/' + person.id), {
                        payments: result.payments,
                        standingOrders: result.standingOrders,
                        totalPaid: newTotal
                    }));

                    // Update local state
                    Object.assign(person, result, { totalPaid: newTotal });
                }
            }

            if (updates.length > 0) await Promise.all(updates);
        },

        checkAndExecuteStandingOrders(person) {
            if (!person.standingOrders || !Array.isArray(person.standingOrders) || person.standingOrders.length === 0) return null;

            let modified = false;
            const payments = safeList(person.payments);
            const standingOrders = safeList(person.standingOrders);
            const today = new Date();
            today.setHours(23,59,59,999);

            const updatedStandingOrders = [];

            for (const so of standingOrders) {
                let soModified = false;
                let currentSO = { ...so };
                const startDate = new Date(currentSO.startDate);
                const dayOfMonth = startDate.getDate();
                let lastAuto = currentSO.lastAutoPayment ? new Date(currentSO.lastAutoPayment) : null;

                let limitDate = new Date(today);
                let isExpired = false;

                if (currentSO.endDate) {
                    const end = new Date(currentSO.endDate);
                    end.setHours(23, 59, 59, 999);
                    if (end < today) {
                        limitDate = end;
                        isExpired = true;
                    }
                }

                let nextDueDate;
                if (!lastAuto) {
                    nextDueDate = new Date(startDate);
                } else {
                    nextDueDate = new Date(lastAuto);
                    nextDueDate.setDate(1);
                    nextDueDate.setMonth(nextDueDate.getMonth() + 1);
                    const maxDays = new Date(nextDueDate.getFullYear(), nextDueDate.getMonth() + 1, 0).getDate();
                    nextDueDate.setDate(Math.min(dayOfMonth, maxDays));
                }

                let safety = 0;
                while (nextDueDate <= limitDate && safety < 120) {
                    const dateStr = nextDueDate.toISOString().split('T')[0];
                    const paymentId = `auto_${currentSO.id}_${dateStr}`;

                    const exists = payments.some(p => p.id === paymentId);

                    if (!exists) {
                        payments.push({
                            id: paymentId,
                            amount: parseFloat(currentSO.amount),
                            date: dateStr,
                            description: (currentSO.note || 'Dauerauftrag') + ' (Auto)',
                            isAuto: true
                        });
                        modified = true;
                        soModified = true;
                    }

                    lastAuto = new Date(nextDueDate);

                    nextDueDate.setDate(1);
                    nextDueDate.setMonth(nextDueDate.getMonth() + 1);
                    const maxDays = new Date(nextDueDate.getFullYear(), nextDueDate.getMonth() + 1, 0).getDate();
                    nextDueDate.setDate(Math.min(dayOfMonth, maxDays));
                    safety++;
                }

                if (soModified && lastAuto) {
                    currentSO.lastAutoPayment = lastAuto.toISOString().split('T')[0];
                }

                if (isExpired) {
                    modified = true;
                } else {
                    updatedStandingOrders.push(currentSO);
                    if (soModified) modified = true;
                }
            }

            if (modified) {
                return { ...person, payments, standingOrders: updatedStandingOrders };
            }
            return null;
        },

        async mutatePerson(personId, mutator) {
            const personRef = dbRef(db, 'people/' + personId);
            const result = await runTransaction(personRef, (current) => {
                if (!current) return current;
                const draft = { ...current };
                draft.payments = safeList(draft.payments);
                draft.statusHistory = safeList(draft.statusHistory);
                draft.standingOrders = safeList(draft.standingOrders);
                return mutator(draft);
            });
            const updated = result.snapshot.val();
            if (updated) {
                 // Update local state
                 const idx = this.people.findIndex(p => String(p.id) === String(personId));
                 const normalized = this.normalizePeople([updated])[0];
                 if (idx >= 0) {
                     this.people[idx] = normalized;
                 } else {
                     this.people.push(normalized);
                 }
            }
            return updated;
        },

        async addPerson(person) {
             await set(dbRef(db, 'people/' + person.id), person);
             const normalized = this.normalizePeople([person])[0];
             this.people.push(normalized);
        },

        async addPayment(personId, payment, isStandingOrder = false) {
             await this.mutatePerson(personId, (person) => {
                if (isStandingOrder) {
                    const standingOrders = safeList(person.standingOrders);
                    standingOrders.push(payment); // payment is SO object here

                    const draftPerson = { ...person, standingOrders };
                    const execResult = this.checkAndExecuteStandingOrders(draftPerson);
                    if (execResult) {
                         const newTotal = safeList(execResult.payments).reduce((acc, p) => acc + parseFloat(p.amount), 0);
                         return { ...execResult, totalPaid: newTotal };
                    }
                    return draftPerson;
                } else {
                    const payments = safeList(person.payments);
                    payments.push(payment);
                    const totalPaid = (person.totalPaid || 0) + parseFloat(payment.amount);
                    return { ...person, payments, totalPaid };
                }
             });
        },

        async addDonation(donation) {
            const nextDonations = [...this.donations, donation];
            await set(dbRef(db, 'donations'), { ...nextDonations });
            this.donations = nextDonations;
        },

        async addExpense(expense) {
            const nextExpenses = [...this.expenses, expense];
            await set(dbRef(db, 'expenses'), { ...nextExpenses });
            this.expenses = nextExpenses;
        },

        async deletePerson(id) {
            await remove(dbRef(db, 'people/' + id));
            this.people = this.people.filter(p => String(p.id) !== String(id));
        },

        async saveSettings(newSettings) {
            await set(dbRef(db, 'settings'), newSettings);
            this.settings = newSettings;
        },

        async generateNewInviteCode() {
            const newCode = Math.floor(100000 + Math.random() * 900000);
            await set(dbRef(db, 'system/inviteCode'), newCode);
            this.inviteCode = newCode;
        },

        async changePassword(newPassword) {
            if (auth.currentUser) {
                await updatePassword(auth.currentUser, newPassword);
            }
        },

        async assignUserToPerson(uid, personId) {
             await update(dbRef(db, 'people/' + personId), { uid });
             // Reload data to reflect changes
             await this.fetchData();
        },

        async submitRequest(type, data) {
             if (!this.user || !this.currentUserPerson) throw new Error("Nicht berechtigt");

             const req = {
                id: Date.now().toString(),
                type,
                userId: this.user.uid,
                personId: this.currentUserPerson.id,
                personName: this.currentUserPerson.name,
                data,
                status: 'pending',
                timestamp: Date.now()
             };

             await set(dbRef(db, 'requests/' + req.id), req);
             this.requests.push(req);
        },

        async approveRequest(reqId) {
            const req = this.requests.find(r => r.id === reqId);
            if (!req) return;

            if (req.type === 'payment') {
                await this.addPayment(req.personId, {
                    id: Date.now().toString(),
                    amount: parseFloat(req.data.amount),
                    date: req.data.date,
                    description: req.data.note || 'Zahlung (Genehmigt)'
                });
            } else if (req.type === 'status') {
                 // Status change logic is complex, putting it here inline for now
                 await this.mutatePerson(req.personId, (person) => {
                    const changeDate = req.data.date;
                    const newStatus = req.data.newStatus;
                    const changeDateObj = new Date(changeDate);

                    let currentStatusStartDate = person.originalMemberSince || person.memberSince;
                    const sortedHistory = safeList(person.statusHistory).slice().sort((a, b) => new Date(b.startDate) - new Date(a.startDate));
                    if (sortedHistory.length > 0 && sortedHistory[0].endDate) {
                        currentStatusStartDate = sortedHistory[0].endDate;
                    }

                    const updatedHistory = safeList(person.statusHistory).filter(entry => new Date(entry.startDate) < changeDateObj);
                    if (new Date(currentStatusStartDate) < changeDateObj) {
                        updatedHistory.push({
                            status: person.status,
                            startDate: currentStatusStartDate,
                            endDate: changeDate
                        });
                    }
                    return { ...person, status: newStatus, statusHistory: updatedHistory };
                 });
            } else if (req.type === 'expense') {
                await this.addExpense({
                    id: Date.now().toString(),
                    amount: parseFloat(req.data.amount),
                    description: req.data.description + ` (Von: ${req.personName})`,
                    date: req.data.date,
                    receipt: req.data.receipt
                });
            } else if (req.type === 'standing_order') {
                 await this.addPayment(req.personId, {
                    id: Date.now().toString(),
                    amount: parseFloat(req.data.amount),
                    startDate: req.data.date,
                    note: req.data.note || 'Dauerauftrag (Genehmigt)',
                    lastAutoPayment: null
                 }, true);
            }

            await update(dbRef(db, 'requests/' + reqId), { status: 'approved' });
            // Refresh data
            await this.fetchData();
        },

        async rejectRequest(reqId, reason) {
            await update(dbRef(db, 'requests/' + reqId), {
                status: 'rejected',
                rejectionReason: reason || 'Kein Grund angegeben'
            });
            await this.fetchData();
        },

        async saveStatusChange(personId, newStatus, changeDate) {
             await this.mutatePerson(personId, (person) => {
                const changeDateObj = new Date(changeDate);
                const memberSinceDate = new Date(person.originalMemberSince || person.memberSince);

                if (changeDateObj < memberSinceDate) {
                    throw new Error('Änderungsdatum liegt vor Mitgliedschaft.');
                }

                let history = safeList(person.statusHistory)
                    .filter(entry => new Date(entry.startDate) < changeDateObj)
                    .map(entry => {
                        if (entry.endDate) {
                            const entryEnd = new Date(entry.endDate);
                            if (entryEnd > changeDateObj) {
                                return { ...entry, endDate: changeDate };
                            }
                        }
                        return entry;
                    });

                let currentStatusStartDate = person.originalMemberSince || person.memberSince;
                const sortedHistory = history.slice().sort((a, b) => new Date(b.endDate || 0) - new Date(a.endDate || 0));
                if (sortedHistory.length > 0 && sortedHistory[0].endDate) {
                    currentStatusStartDate = sortedHistory[0].endDate;
                }

                if (new Date(currentStatusStartDate) < changeDateObj) {
                    history.push({
                        status: person.status,
                        startDate: currentStatusStartDate,
                        endDate: changeDate
                    });
                }

                return { ...person, status: newStatus, statusHistory: history };
            });
        },

        async endStandingOrder(personId, soId, endDate) {
             await this.mutatePerson(personId, (person) => {
                const endDateObj = new Date(endDate);
                endDateObj.setHours(23, 59, 59, 999);
                const today = new Date();

                // 1. Update SO end date
                let standingOrders = safeList(person.standingOrders).map(so => {
                    if (String(so.id) === String(soId)) {
                        return { ...so, endDate };
                    }
                    return so;
                });

                // 2. Remove future auto-payments related to this SO
                const payments = safeList(person.payments).filter(p => {
                    if (p.isAuto && p.id.startsWith(`auto_${soId}_`)) {
                        const pDate = new Date(p.date);
                        if (pDate > endDateObj) {
                            return false;
                        }
                    }
                    return true;
                });

                // 3. Remove SO if expired (delete itself after end date)
                if (endDateObj < today) {
                     standingOrders = standingOrders.filter(so => String(so.id) !== String(soId));
                }

                const totalPaid = payments.reduce((acc, p) => acc + parseFloat(p.amount), 0);
                return { ...person, standingOrders, payments, totalPaid };
            });
        },

        async deleteStandingOrder(personId, soId) {
             await this.mutatePerson(personId, (person) => {
                const standingOrders = safeList(person.standingOrders).filter(so => String(so.id) !== String(soId));
                return { ...person, standingOrders };
            });
        }
    }
});
